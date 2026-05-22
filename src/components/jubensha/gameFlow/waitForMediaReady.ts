/** 等待 audio/video 可播；大体积 wav 有时不触发 canplaythrough */
export function waitForAudioReady(audio: HTMLAudioElement, timeoutMs = 20000): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, timeoutMs)

    const ok = () => {
      cleanup()
      resolve()
    }

    const err = () => {
      cleanup()
      reject(new Error('media-error'))
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      audio.removeEventListener('canplaythrough', ok)
      audio.removeEventListener('canplay', ok)
      audio.removeEventListener('loadeddata', ok)
      audio.removeEventListener('error', err)
    }

    audio.addEventListener('canplaythrough', ok, { once: true })
    audio.addEventListener('canplay', ok, { once: true })
    audio.addEventListener('loadeddata', ok, { once: true })
    audio.addEventListener('error', err, { once: true })
  })
}
