import type { CharacterMemory } from '../newFriendsPersona/types'
import type { WechatAccountsBundle } from '../wechatAccountTypes'
import { parseMemorySourcePrefix } from './memorySourceBadges'
import type { MemoryEntry } from './memoryArchiveTypes'

export type MemoryArchiveAccountOption = {
  accountId: string
  label: string
  avatarUrl?: string
}

export function buildMemoryArchiveAccountOptions(
  bundle: WechatAccountsBundle | null | undefined,
): MemoryArchiveAccountOption[] {
  if (!bundle?.accounts.length) return []
  return bundle.accounts.map((a) => ({
    accountId: a.accountId,
    label: a.nickname.trim() || a.wechatId.trim() || '微信账号',
    avatarUrl: a.avatarUrl.trim() || undefined,
  }))
}

export function resolvePrimaryWechatAccountId(bundle: WechatAccountsBundle | null | undefined): string | null {
  return bundle?.accounts[0]?.accountId?.trim() || null
}

/** 纯遇见记忆：不按微信账号分线，用场景标签「遇见」区分 */
export function isMeetOnlyMemoryRow(m: Pick<CharacterMemory, 'memoryScope' | 'sourceWechatAccountId' | 'content'>): boolean {
  if (m.memoryScope === 'meet') return true
  if (m.sourceWechatAccountId?.trim()) return false
  const parsed = parseMemorySourcePrefix(m.content ?? '')
  return parsed.hasMeetTag && !parsed.hasOnlineTag && !parsed.hasGroupChatTag
}

export function isMeetOnlyMemoryEntry(
  entry: Pick<MemoryEntry, 'memoryScope' | 'sourceWechatAccountId' | 'tags'>,
): boolean {
  if (entry.memoryScope === 'meet') return true
  if (entry.sourceWechatAccountId?.trim()) return false
  if (!entry.tags.includes('遇见')) return false
  return !entry.tags.includes('私聊') && !entry.tags.includes('群聊')
}

export function resolveMemoryEntryAccountId(
  entry: Pick<MemoryEntry, 'sourceWechatAccountId'>,
  primaryAccountId: string | null,
): string | null {
  return entry.sourceWechatAccountId?.trim() || primaryAccountId?.trim() || null
}

export function matchesMemoryArchiveAccount(
  entry: MemoryEntry,
  selectedAccountId: string,
  primaryAccountId: string | null,
): boolean {
  if (isMeetOnlyMemoryEntry(entry)) return true
  const acc = resolveMemoryEntryAccountId(entry, primaryAccountId)
  if (!acc) return true
  return acc === selectedAccountId.trim()
}
