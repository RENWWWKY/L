/** 长期记忆正文前缀：与 memorySourceBadges 的 `[遇见]` 解析一致 */
export const MEET_MEMORY_CONTENT_TAG = '[遇见]'

export function meetEncounterMemoryId(characterId: string): string {
  return `mem-meet-encounter-${characterId.trim()}`
}

export function meetImportedChatMessageId(characterId: string, meetMessageId: string): string {
  return `meet-import-${characterId.trim()}-${meetMessageId.trim()}`
}

/** 历史版本曾把遇见线程写入微信 chatMessages，此类 id 不得出现在微信 UI / AI 上下文 */
export function isMeetImportedWeChatMessageId(messageId: string, characterId?: string): boolean {
  const id = messageId.trim()
  if (!id.startsWith('meet-import-')) return false
  const cid = characterId?.trim()
  if (!cid) return true
  return id.startsWith(`meet-import-${cid}-`)
}
