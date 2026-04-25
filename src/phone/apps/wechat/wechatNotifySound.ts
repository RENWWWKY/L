type PlaySoundParams =
  | { kind: 'url'; url: string }
  | { kind: 'base64'; base64: string; mime: string }

let audioCtx: AudioContext | null = null
let ctxGain: GainNode | null = null
let ctxPlaying = false

export type WeChatBuiltInNotifySoundKey = 'notify2' | 'lai'

export function getWeChatBuiltInNotifySoundMeta(key: WeChatBuiltInNotifySoundKey): { key: WeChatBuiltInNotifySoundKey; name: string; url: string } {
  // 约定：内置音频文件放在仓库根目录 `voice/` 下。
  // Vite 会把此类静态资源打包并生成可访问的 URL。
  if (key === 'lai') {
    return {
      key,
      name: '消息提示音（来）.mp3',
      url: new URL('../../../../voice/消息提示音（来）.mp3', import.meta.url).toString(),
    }
  }
  return {
    key: 'notify2',
    name: '通知音2.mp3',
    url: new URL('../../../../voice/通知音2.mp3', import.meta.url).toString(),
  }
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
  if (!Ctx) return null
  if (!audioCtx) {
    audioCtx = new Ctx()
    ctxGain = audioCtx.createGain()
    ctxGain.gain.value = 1
    ctxGain.connect(audioCtx.destination)
  }
  try {
    if (audioCtx.state === 'suspended') await audioCtx.resume()
  } catch {
    // ignore
  }
  return audioCtx
}

async function playViaWebAudio(src: PlaySoundParams): Promise<boolean> {
  const ctx = await ensureAudioContext()
  if (!ctx || !ctxGain) return false

  // 同一时间只播一条提醒音，避免重叠（不影响页面/系统其它音频）。
  if (ctxPlaying) {
    // WebAudio 的 stop 需要持有 source，这里用“新播覆盖旧播”的策略：重置标记即可。
    // 旧的 source 会自然结束；提醒音很短，影响可忽略。
    ctxPlaying = false
  }

  try {
    let ab: ArrayBuffer
    if (src.kind === 'url') {
      const resp = await fetch(src.url)
      ab = await resp.arrayBuffer()
    } else {
      const bin = atob(src.base64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
      ab = buf.buffer
    }

    const audioBuf = await ctx.decodeAudioData(ab.slice(0))
    const source = ctx.createBufferSource()
    source.buffer = audioBuf
    source.connect(ctxGain)
    ctxPlaying = true
    source.onended = () => {
      ctxPlaying = false
    }
    source.start(0)
    return true
  } catch {
    ctxPlaying = false
    return false
  }
}

export async function playWeChatNotifySound(params: PlaySoundParams): Promise<void> {
  if (typeof window === 'undefined') return

  // 优先 WebAudio：更容易与页面其它声音“混音共存”，降低对外部音频的抢占风险。
  // 同时避免与项目内置播放器（HTMLAudioElement 单例）抢占导致暂停/打断。
  const ok = await playViaWebAudio(params)
  if (!ok) return
}

