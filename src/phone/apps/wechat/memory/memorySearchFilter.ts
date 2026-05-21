import type { CharacterMemory } from '../newFriendsPersona/types'
import { parseMemorySourcePrefix } from './memorySourceBadges'

/** 记忆正文 / 去标签正文 / 触发词字段是否包含关键词（不区分大小写，trim 后为空则视为不过滤） */
export function memoryTextMatchesQuery(mem: CharacterMemory, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  const raw = String(mem.content ?? '').toLowerCase()
  if (raw.includes(t)) return true
  const parsed = parseMemorySourcePrefix(mem.content)
  const body = parsed.body.toLowerCase()
  if (body.includes(t)) return true
  const src = parsed
  const sourceLabels = [
    src.hasOnlineTag ? '私聊' : '',
    src.hasGroupChatTag ? '群聊' : '',
    src.hasOfflineTag ? '线下' : '',
    src.hasLinkedOfflineTag ? '关联线下' : '',
    src.hasMeetTag ? '遇见' : '',
  ].filter(Boolean)
  const meta = [
    ...sourceLabels,
    mem.memoryTriggerMode === 'always' ? '始终触发' : '关键词触发',
    mem.memoryTriggerCategory,
    mem.memoryTriggerPrecise,
    ...(mem.memoryTriggerEmotionNeed ?? []),
    ...(mem.memoryKeywords ?? []),
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (meta.includes(t)) return true
  return false
}

export function groupTitleMatchesQuery(title: string, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return false
  return title.trim().toLowerCase().includes(t)
}
