/** 剧情一次性音效轨（与 DM 语音 / BGM 分轨） */
export type JbsSfxPlayer = {
  play: (src: string, volume?: number) => void
  /** 按序叠播（如换盘 → 倒酒） */
  playSequence: (urls: readonly string[], volume?: number, gapMs?: number) => void
  stop: () => void
}

export function createJbsSfxPlayer(): JbsSfxPlayer {
  let audio: HTMLAudioElement | null = null
  let sequenceTimers: number[] = []

  const clearSequenceTimers = () => {
    for (const timer of sequenceTimers) window.clearTimeout(timer)
    sequenceTimers = []
  }

  const play = (src: string, volume = 1) => {
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto'
    }
    audio.volume = volume
    audio.src = src
    audio.currentTime = 0
    audio.load()
    void audio.play().catch(() => {})
  }

  const playSequence = (urls: readonly string[], volume = 1, gapMs = 520) => {
    clearSequenceTimers()
    if (urls.length === 0) return
    play(urls[0]!, volume)
    for (let i = 1; i < urls.length; i += 1) {
      const timer = window.setTimeout(() => play(urls[i]!, volume), gapMs * i)
      sequenceTimers.push(timer)
    }
  }

  const stop = () => {
    clearSequenceTimers()
    const el = audio
    if (!el) return
    el.pause()
    el.removeAttribute('src')
    el.load()
  }

  return { play, playSequence, stop }
}
