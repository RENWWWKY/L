/** 当前前台正在打开的会话 key（与微信一致：在该会话内不收系统通知） */
let foregroundConversationKey: string | null = null

export function setWeChatForegroundConversationKey(key: string | null): void {
  foregroundConversationKey = key?.trim() || null
}

export function getWeChatForegroundConversationKey(): string | null {
  return foregroundConversationKey
}

/**
 * 对方新消息入库后调用：若用户不在该会话页、且未开启免打扰，则尝试浏览器系统通知。
 * 免打扰不影响未读与红点，仅跳过通知（调用方传入 `isMuted`）。
 */
export function maybeNotifyWeChatCharacterMessage(params: {
  conversationKey: string
  peerDisplayName: string
  preview: string
  isMuted: boolean
}): void {
  const k = params.conversationKey.trim()
  if (!k) return
  if (foregroundConversationKey === k) return
  if (params.isMuted) return

  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  try {
    const title = params.peerDisplayName.trim() || '微信'
    const body = params.preview.trim().slice(0, 120) || '新消息'
    new Notification(title, { body, silent: false })
  } catch {
    /* 部分环境禁止通知 */
  }
}
