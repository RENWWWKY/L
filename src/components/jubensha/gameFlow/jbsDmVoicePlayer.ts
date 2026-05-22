import { waitForAudioReady } from './waitForMediaReady'

/** DM 主持语音轨（独立 Audio，对齐 VN 对白轨） */
export type JbsDmVoicePlayer = {
  play: (src: string, playbackRate: number, opts?: { fromGesture?: boolean }) => Promise<void>
  pause: () => void
  stop: () => void
  getAudio: () => HTMLAudioElement
  onEnded: (handler: () => void) => () => void
}

export function createJbsDmVoicePlayer(): JbsDmVoicePlayer {
  let audio: HTMLAudioElement | null = null
  let endedHandler: (() => void) | null = null

  const getAudio = () => {
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto'
    }
    return audio
  }

  const play = async (src: string, playbackRate: number, _opts?: { fromGesture?: boolean }) => {
    const el = getAudio()
    el.volume = 1
    el.muted = false
    el.playbackRate = playbackRate
    el.src = src
    el.currentTime = 0
    el.load()

    try {
      await el.play()
    } catch {
      /* 自动播可能被拦截，缓冲完成后再试 */
    }

    await waitForAudioReady(el, 25000)

    if (el.paused) {
      await el.play()
    }
  }

  const pause = () => {
    getAudio().pause()
  }

  const stop = () => {
    const el = audio
    if (!el) return
    el.pause()
    el.removeAttribute('src')
    el.load()
  }

  const onEnded = (handler: () => void) => {
    endedHandler = handler
    const el = getAudio()
    const wrapped = () => endedHandler?.()
    el.addEventListener('ended', wrapped)
    return () => el.removeEventListener('ended', wrapped)
  }

  return { play, pause, stop, getAudio, onEnded }
}
