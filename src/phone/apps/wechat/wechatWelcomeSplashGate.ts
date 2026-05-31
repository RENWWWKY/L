const PENDING_KEY = 'wechat-welcome-splash-pending'

/** 首次注册完成、即将展示欢迎动效前调用 */
export function markWeChatWelcomeSplashPending(): void {
  try {
    sessionStorage.setItem(PENDING_KEY, '1')
  } catch {
    // ignore
  }
}

export function isWeChatWelcomeSplashPending(): boolean {
  try {
    return sessionStorage.getItem(PENDING_KEY) === '1'
  } catch {
    return false
  }
}

export function clearWeChatWelcomeSplashPending(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // ignore
  }
}

/** 深度注销微信后重置，以便下次注册可再次播放 */
export function resetWeChatWelcomeSplashGate(): void {
  clearWeChatWelcomeSplashPending()
}
