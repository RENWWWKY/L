const COMMUNITY_TROUBLESHOOT_REGISTER_KEY = 'us_discord_register_from_community_troubleshoot'

/** 标记接下来的 Discord 注册来自身份组异常排查 */
export function markDiscordRegisterFromCommunityTroubleshoot(): void {
  try {
    sessionStorage.setItem(COMMUNITY_TROUBLESHOOT_REGISTER_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumeDiscordRegisterFromCommunityTroubleshoot(): boolean {
  try {
    const v = sessionStorage.getItem(COMMUNITY_TROUBLESHOOT_REGISTER_KEY)
    sessionStorage.removeItem(COMMUNITY_TROUBLESHOOT_REGISTER_KEY)
    return v === '1'
  } catch {
    return false
  }
}
