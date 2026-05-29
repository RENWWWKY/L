import { pickQrCreate, pickUnikey } from './neteaseParse'
import type { NeteaseApiResult } from './neteaseRequest'

const PATH_MAP: Record<string, string> = {
  '/login/qrcode/unikey': '/login/qr/key',
  '/login/qrcode/create': '/login/qr/create',
  '/login/qrcode/check': '/login/qr/check',
}

/** 通过 NeteaseCloudMusicApi 兼容镜像转发（需自行部署或填写可信地址） */
export async function neteaseWeapiViaUpstream<T = unknown>(
  weapiPath: string,
  data: Record<string, unknown>,
  upstreamBase: string,
): Promise<NeteaseApiResult<T>> {
  const route = PATH_MAP[weapiPath]
  if (!route) {
    throw new Error(`镜像不支持的路径: ${weapiPath}`)
  }

  const base = upstreamBase.replace(/\/+$/, '')
  const url = new URL(`${base}${route}`)
  url.searchParams.set('timestamp', String(Date.now()))

  if (weapiPath === '/login/qrcode/create') {
    const key = data.key
    if (typeof key === 'string') url.searchParams.set('key', key)
    url.searchParams.set('qrimg', data.qrimg ? 'true' : 'false')
  } else if (weapiPath === '/login/qrcode/check') {
    const key = data.key
    if (typeof key === 'string') url.searchParams.set('key', key)
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`镜像返回空 (HTTP ${res.status}): ${base}`)
  }

  const parsed = JSON.parse(text) as Record<string, unknown>
  const bodyCode = typeof parsed.code === 'number' ? parsed.code : 200

  if (weapiPath === '/login/qrcode/check') {
    return {
      status: res.status,
      body: {
        code: bodyCode,
        message: parsed.message,
        cookie: typeof parsed.cookie === 'string' ? parsed.cookie : '',
        ...parsed,
      } as T,
      cookie: typeof parsed.cookie === 'string' ? parsed.cookie : '',
    }
  }

  return {
    status: res.status,
    body: parsed as T,
    cookie: '',
  }
}

export function normalizeUpstreamQrStart(
  keyRes: NeteaseApiResult<unknown>,
  createRes: NeteaseApiResult<unknown>,
  key: string,
) {
  const body = pickQrCreate(createRes.body)
  const qrurl =
    body.qrurl ?? `https://music.163.com/login?codekey=${encodeURIComponent(key)}`
  let qrimgData = body.qrimg ?? ''
  if (qrimgData && !qrimgData.startsWith('data:')) {
    qrimgData = `data:image/png;base64,${qrimgData}`
  }
  return { key, qrurl, qrimg: qrimgData || null }
}

export { pickUnikey }
