/** 将 audio.play / 加载失败转为用户可读文案（避免 Safari 英文 DOMException 直接露出） */
export function formatPlaybackError(err: unknown): string {
  if (!(err instanceof Error)) {
    return '播放失败，请换一首或稍后重试'
  }

  const name = err.name
  const msg = err.message.toLowerCase()

  if (name === 'NotAllowedError') {
    return '需要您点击播放按钮后才能出声（浏览器限制自动播放）'
  }

  if (
    name === 'NotSupportedError' ||
    msg.includes('not supported') ||
    msg.includes('no supported source')
  ) {
    return '该歌曲无法在本设备播放（可能无版权、仅会员可听或音源格式不支持）'
  }

  if (name === 'AbortError' || msg.includes('aborted')) {
    return '播放被中断，请再点一次播放'
  }

  if (msg.includes('network') || msg.includes('failed to load')) {
    return '音频加载失败，请检查网络后重试'
  }

  return '播放失败，请换一首或稍后重试'
}
