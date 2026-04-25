/**
 * 与通讯录内置 Lumi 联系人 id 一致。
 * Lumi 小助手的聊天记录**始终**使用该 id 存 IndexedDB，与具体人设角色 id 无关，避免与「角色私聊」串会话。
 */
export const WECHAT_LUMI_PEER_CHARACTER_ID = 'wechat-lumi-assistant'

export function wechatConversationKey(characterId: string, playerIdentityId: string): string {
  const pid = playerIdentityId.trim() || '__none__'
  return `${characterId}::${pid}`
}
