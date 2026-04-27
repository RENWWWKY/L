export type MiniMaxCredentials = { apiKey: string; groupId: string }

export type MiniMaxVoiceInfo = {
  voice_id: string
  voice_name?: string
  description?: string[]
  voice_type?: 'system' | 'voice_cloning' | 'voice_generation' | 'unknown'
}

type MiniMaxBaseResp = { status_code?: number; status_msg?: string }

const MINIMAX_API_BASE = (import.meta.env.VITE_MINIMAX_API_BASE as string | undefined)?.trim() || 'https://api.minimaxi.com'

function decodeMiniMaxCode(code: number) {
  const map: Record<number, string> = {
    1000: '服务端临时异常，请稍后重试',
    1001: '请求超时，请稍后重试',
    1002: '请求频率过高，请稍后重试',
    1004: '鉴权失败，请检查 API Key / GroupId',
    2013: '任务结果文件暂不可用，请继续轮询后重试',
  }
  return map[code]
}

function errFromResp(payload: any, fallback: string) {
  const codeRaw = payload?.base_resp?.status_code
  const code = Number(codeRaw)
  const msg = payload?.base_resp?.status_msg
  const requestId = payload?.request_id ? String(payload.request_id) : ''
  const known = Number.isFinite(code) ? decodeMiniMaxCode(code) : ''
  const s = known || (msg ? String(msg) : fallback)
  const withReq = requestId ? `${s}（request_id=${requestId}）` : s
  if (Number.isFinite(code) && code !== 0) {
    // 仅开发环境输出完整原始 payload，便于继续定位。
    // eslint-disable-next-line no-console
    console.warn('[MiniMax error payload]', { code, msg, requestId, payload })
  }
  return new Error(Number.isFinite(code) ? `${withReq} (code=${code})` : withReq)
}

async function minimaxFetch(path: string, creds: MiniMaxCredentials, init: RequestInit) {
  const apiKey = creds.apiKey.trim()
  const groupId = creds.groupId.trim()
  if (!apiKey) throw new Error('请先填写 MiniMax API Key')
  const url = `${MINIMAX_API_BASE}${path}`
  const doFetch = async () =>
    fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(groupId ? { GroupId: groupId } : {}),
        ...(init.headers ?? {}),
      },
    })
  let resp = await doFetch()
  let text = await resp.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  // 仅针对服务端瞬时异常做一次轻量重试，避免用户频繁手动重试。
  const firstCode = Number(json?.base_resp?.status_code)
  if ((!resp.ok || (Number.isFinite(firstCode) && firstCode !== 0)) && (firstCode === 1000 || firstCode === 1001)) {
    await new Promise((r) => setTimeout(r, 450))
    resp = await doFetch()
    text = await resp.text()
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
  }
  if (!resp.ok) {
    throw errFromResp(json, `请求失败（HTTP ${resp.status}）`)
  }
  if (json?.base_resp) {
    const code = Number(json.base_resp.status_code)
    if (Number.isFinite(code) && code !== 0) {
      throw errFromResp(json, '请求失败')
    }
  }
  return json
}

/** 拉取音色列表（官方 get_voice 接口）。 */
export async function fetchMiniMaxVoices(creds: MiniMaxCredentials): Promise<MiniMaxVoiceInfo[]> {
  const json = await minimaxFetch('/v1/get_voice', creds, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_type: 'all' }),
  })

  const payload = (json?.data && typeof json.data === 'object' ? json.data : json) as any
  const readArray = (...candidates: any[]) => {
    for (const c of candidates) {
      if (Array.isArray(c)) return c
    }
    return [] as any[]
  }

  const sys = readArray(payload?.system_voice, payload?.system_voices)
  const cloning = readArray(payload?.voice_cloning, payload?.voice_clonings)
  const gen = readArray(payload?.voice_generation, payload?.voice_generations)
  const flat = readArray(payload?.voices, payload?.voice_list)

  const mapBlock = (arr: any[], type: MiniMaxVoiceInfo['voice_type']) =>
    arr
      .map((v) => ({
        voice_id: String(v?.voice_id ?? v?.voiceId ?? v?.id ?? '').trim(),
        voice_name:
          typeof v?.voice_name === 'string'
            ? v.voice_name
            : typeof v?.name === 'string'
              ? v.name
              : typeof v?.display_name === 'string'
                ? v.display_name
                : undefined,
        description: Array.isArray(v?.description)
          ? v.description.map((s: any) => String(s))
          : typeof v?.description === 'string'
            ? [v.description]
            : undefined,
        voice_type: type,
      }))
      .filter((v) => !!v.voice_id)

  const inferredFromFlat = flat.map((v) => {
    const t = String(v?.voice_type ?? v?.type ?? '').toLowerCase()
    const voice_type: MiniMaxVoiceInfo['voice_type'] = t.includes('clone')
      ? 'voice_cloning'
      : t.includes('generation') || t.includes('gen')
        ? 'voice_generation'
        : 'system'
    return {
      voice_id: String(v?.voice_id ?? v?.voiceId ?? v?.id ?? '').trim(),
      voice_name:
        typeof v?.voice_name === 'string'
          ? v.voice_name
          : typeof v?.name === 'string'
            ? v.name
            : typeof v?.display_name === 'string'
              ? v.display_name
              : undefined,
      description: Array.isArray(v?.description)
        ? v.description.map((s: any) => String(s))
        : typeof v?.description === 'string'
          ? [v.description]
          : undefined,
      voice_type,
    } as MiniMaxVoiceInfo
  })

  const merged = [
    ...mapBlock(sys, 'system'),
    ...mapBlock(cloning, 'voice_cloning'),
    ...mapBlock(gen, 'voice_generation'),
    ...inferredFromFlat,
  ].filter((v) => !!v.voice_id)

  // 去重：避免同一 voice_id 在多结构返回中重复展示
  const dedup = new Map<string, MiniMaxVoiceInfo>()
  for (const item of merged) {
    if (!dedup.has(item.voice_id)) dedup.set(item.voice_id, item)
  }
  return Array.from(dedup.values())
}

export type MiniMaxT2ACreateResp = {
  task_id: string
  task_token: string
  file_id?: string | number
  base_resp?: MiniMaxBaseResp
}

export type MiniMaxT2AQueryResp = {
  status?: string
  audio_url?: string
  file_id?: string | number
  base_resp?: MiniMaxBaseResp
}

const hexToBytes = (hex: string): Uint8Array => {
  const cleaned = String(hex || '').trim()
  const pairs = cleaned.match(/.{1,2}/g)
  if (!pairs) return new Uint8Array()
  return new Uint8Array(pairs.map((h) => Number.parseInt(h, 16)))
}

export async function createMiniMaxT2ASyncAudioBlob(
  creds: MiniMaxCredentials,
  params: { voice_id: string; text: string; model?: string },
) {
  const voiceId = params.voice_id.trim()
  const text = params.text.trim()
  const model = String(params.model || 'speech-2.8-hd').trim() || 'speech-2.8-hd'
  if (!voiceId) throw new Error('请先选择 voice_id')
  if (!text) throw new Error('请输入要合成的台词')

  const json = await minimaxFetch('/v1/t2a_v2', creds, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      text: text.slice(0, 500),
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
      subtitle_enable: false,
    }),
  })

  const hexAudio = String((json as any)?.data?.audio ?? (json as any)?.data?.audio_hex ?? (json as any)?.audio ?? '').trim()
  if (!hexAudio) throw new Error('同步合成未返回音频数据')
  const bytes = hexToBytes(hexAudio)
  if (!bytes.length) throw new Error('同步合成音频数据格式无效')
  const ab = bytes.buffer instanceof ArrayBuffer ? bytes.buffer : bytes.slice().buffer
  return new Blob([ab], { type: 'audio/mpeg' })
}

export async function createMiniMaxT2AAsyncTask(
  creds: MiniMaxCredentials,
  params: { voice_id: string; text: string; model?: string },
) {
  const voiceId = params.voice_id.trim()
  const text = params.text.trim()
  const model = String(params.model || 'speech-2.8-hd').trim() || 'speech-2.8-hd'
  if (!voiceId) throw new Error('请先选择 voice_id')
  if (!text) throw new Error('请输入要合成的台词')
  return (await minimaxFetch('/v1/t2a_async_v2', creds, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      text,
      voice_setting: {
        voice_id: voiceId,
        speed: 1,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        format: 'mp3',
        audio_sample_rate: 32000,
        bitrate: 128000,
        channel: 1,
      },
    }),
  })) as MiniMaxT2ACreateResp
}

export async function queryMiniMaxT2AAsyncTask(
  creds: MiniMaxCredentials,
  params: { task_id: string },
) {
  const task_id = params.task_id.trim()
  if (!task_id) throw new Error('任务信息不完整')

  // 官方文档：GET /v1/query/t2a_async_query_v2?task_id=...
  const apiKey = creds.apiKey.trim()
  const groupId = creds.groupId.trim()
  const url = `${MINIMAX_API_BASE}/v1/query/t2a_async_query_v2?task_id=${encodeURIComponent(task_id)}`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(groupId ? { GroupId: groupId } : {}),
      'Content-Type': 'application/json',
    },
  })
  const text = await resp.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!resp.ok) {
    throw errFromResp(json, `请求失败（HTTP ${resp.status}）`)
  }
  if (json?.base_resp) {
    const code = Number(json.base_resp.status_code)
    if (Number.isFinite(code) && code !== 0) {
      throw errFromResp(json, '请求失败')
    }
  }
  return json as MiniMaxT2AQueryResp
}

export async function retrieveMiniMaxAudioFileUrl(
  creds: MiniMaxCredentials,
  params: { file_id: string | number },
) {
  const apiKey = creds.apiKey.trim()
  const groupId = creds.groupId.trim()
  const fileId = String(params.file_id ?? '').trim()
  if (!fileId) throw new Error('file_id 为空，无法下载音频')

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  if (groupId) headers.GroupId = groupId

  const inferAudioMime = (bytes: Uint8Array): string => {
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mpeg' // ID3
    if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg' // MP3 frame
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x41 &&
      bytes[10] === 0x56 &&
      bytes[11] === 0x45
    ) {
      return 'audio/wav'
    }
    if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'audio/ogg'
    if (
      bytes.length >= 12 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70 &&
      bytes[8] === 0x4d &&
      bytes[9] === 0x34 &&
      bytes[10] === 0x41
    ) {
      return 'audio/mp4'
    }
    return ''
  }

  const isGzip = (bytes: Uint8Array) => bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b

  const isTarArchive = (bytes: Uint8Array, blobType: string) => {
    if (blobType.includes('x-tar') || blobType.includes('tar')) return true
    // tar magic: "ustar" at offset 257
    return (
      bytes.length > 262 &&
      bytes[257] === 0x75 &&
      bytes[258] === 0x73 &&
      bytes[259] === 0x74 &&
      bytes[260] === 0x61 &&
      bytes[261] === 0x72
    )
  }

  const parseTarOctal = (field: Uint8Array) => {
    const raw = new TextDecoder().decode(field).replace(/\0/g, '').trim()
    if (!raw) return 0
    const n = Number.parseInt(raw, 8)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  const gunzip = async (buf: ArrayBuffer) => {
    if (typeof DecompressionStream === 'undefined') return null
    try {
      const ds = new DecompressionStream('gzip')
      const stream = new Blob([buf]).stream().pipeThrough(ds)
      return await new Response(stream).arrayBuffer()
    } catch {
      return null
    }
  }

  const extractAudioFromTar = (buf: ArrayBuffer): Blob | null => {
    const bytes = new Uint8Array(buf)
    const decoder = new TextDecoder()
    const pickMimeByName = (name: string) => {
      const lower = name.toLowerCase()
      if (lower.endsWith('.mp3')) return 'audio/mpeg'
      if (lower.endsWith('.wav')) return 'audio/wav'
      if (lower.endsWith('.ogg')) return 'audio/ogg'
      if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4'
      return ''
    }

    const candidates: { mime: string; fileBytes: Uint8Array; name: string }[] = []
    let offset = 0
    while (offset + 512 <= bytes.length) {
      const header = bytes.slice(offset, offset + 512)
      const allZero = header.every((b) => b === 0)
      if (allZero) break

      const name = decoder.decode(header.slice(0, 100)).replace(/\0/g, '').trim()
      const size = parseTarOctal(header.slice(124, 136))
      const dataStart = offset + 512
      const dataEnd = dataStart + size
      if (size > 0 && dataEnd <= bytes.length) {
        const mime = pickMimeByName(name)
        if (mime) {
          const fileBytes = bytes.slice(dataStart, dataEnd)
          candidates.push({ mime, fileBytes, name })
        }
      }
      const blocks = Math.ceil(size / 512)
      offset = dataStart + blocks * 512
    }
    if (!candidates.length) return null

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
    const isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && 'ontouchend' in window)
    const priority = isIOS
      ? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
      : ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']

    for (const mime of priority) {
      const hit = candidates.find((c) => c.mime === mime)
      if (!hit) continue
      if (isIOS && mime === 'audio/ogg') continue
      return new Blob([hit.fileBytes], { type: hit.mime })
    }
    // iOS 下若只有 ogg，直接返回 null，让上层给出清晰错误提示而不是 “Load failed”。
    return isIOS ? null : new Blob([candidates[0].fileBytes], { type: candidates[0].mime })
  }

  const ensurePlayableAudioBlob = async (blob: Blob) => {
    let buf = await blob.arrayBuffer()
    let head = new Uint8Array(buf.slice(0, 300))
    const blobType = String(blob.type || '').toLowerCase()
    if (isGzip(head)) {
      const unzipped = await gunzip(buf)
      if (unzipped) {
        buf = unzipped
        head = new Uint8Array(buf.slice(0, 300))
      }
    }
    if (isTarArchive(head, blobType)) {
      const extracted = extractAudioFromTar(buf)
      if (!extracted) {
        throw new Error('iOS Safari 暂不支持该预览音频编码（可能仅返回 ogg）。请在模型设置里优先使用 MP3/WAV 可播放格式。')
      }
      return extracted
    }
    const bytes = new Uint8Array(buf.slice(0, 64))
    const inferred = inferAudioMime(bytes)
    const audioLike = blobType.startsWith('audio/') || !!inferred
    if (!audioLike) {
      const preview = new TextDecoder().decode(bytes).trim().slice(0, 80)
      throw new Error(`下载结果不是可播放音频（mime=${blobType || 'unknown'}，内容预览=${preview || 'binary'}）`)
    }
    if (blobType.startsWith('audio/')) return blob
    if (inferred) return new Blob([buf], { type: inferred })
    return blob
  }

  const toBlobUrl = async (sourceUrl: string) => {
    const r = await fetch(sourceUrl, { method: 'GET' })
    if (!r.ok) throw new Error(`音频下载失败（HTTP ${r.status}）`)
    const b = await ensurePlayableAudioBlob(await r.blob())
    return URL.createObjectURL(b)
  }

  const tryDownload = async (path: string) => {
    const url = `${MINIMAX_API_BASE}${path}?file_id=${encodeURIComponent(fileId)}`
    const resp = await fetch(url, { method: 'GET', headers })
    if (!resp.ok) throw new Error(`文件获取失败（HTTP ${resp.status}）`)
    const contentType = String(resp.headers.get('content-type') ?? '').toLowerCase()
    if (contentType.includes('application/json')) {
      const json = await resp.json().catch(() => null)
      const directUrl = String(
        json?.audio_url ?? json?.url ?? json?.file_url ?? json?.data?.audio_url ?? json?.data?.url ?? '',
      ).trim()
      if (directUrl) return await toBlobUrl(directUrl)
      throw errFromResp(json, '文件获取失败')
    }
    const blob = await ensurePlayableAudioBlob(await resp.blob())
    return URL.createObjectURL(blob)
  }

  try {
    return await tryDownload('/v1/files/retrieve')
  } catch {
    return await tryDownload('/v1/files/retrieve_content')
  }
}

