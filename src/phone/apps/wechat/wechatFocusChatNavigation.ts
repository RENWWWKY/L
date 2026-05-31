import type { AppSlot } from '../../types'

export const WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY = 'lumi-wechat-focus-persona-chat-id'

export const WECHAT_FOCUS_PERSONA_CHAT_EVENT = 'wechat:focus-persona-chat'

export type WeChatFocusPersonaChatDetail = {
  characterId: string
}

/** 写入待打开私聊角色并拉起微信（由 WeChatApp 消费） */
export function requestOpenWeChatPersonaChat(characterId: string): void {
  const id = characterId.trim()
  if (!id) return
  try {
    sessionStorage.setItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY, id)
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent<WeChatFocusPersonaChatDetail>(WECHAT_FOCUS_PERSONA_CHAT_EVENT, {
      detail: { characterId: id },
    }),
  )
  window.dispatchEvent(new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'wechat' } }))
}

export function consumeWeChatFocusPersonaChatId(): string | null {
  try {
    const id = sessionStorage.getItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY)?.trim() || ''
    if (id) sessionStorage.removeItem(WECHAT_FOCUS_PERSONA_CHAT_SESSION_KEY)
    return id || null
  } catch {
    return null
  }
}
