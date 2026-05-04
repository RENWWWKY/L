import type { CharacterMemory } from '../newFriendsPersona/types'
import { parseMemorySourcePrefix } from './memorySourceBadges'

/** 记忆正文 / 去标签正文是否包含关键词（不区分大小写，trim 后为空则视为不过滤） */
export function memoryTextMatchesQuery(mem: CharacterMemory, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  const raw = String(mem.content ?? '').toLowerCase()
  if (raw.includes(t)) return true
  const body = parseMemorySourcePrefix(mem.content).body.toLowerCase()
  return body.includes(t)
}

export function groupTitleMatchesQuery(title: string, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return false
  return title.trim().toLowerCase().includes(t)
}
