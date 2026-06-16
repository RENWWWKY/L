import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import type { CharacterMemory } from '../newFriendsPersona/types'
import type { WechatAccountsBundle } from '../wechatAccountTypes'
import {
  parseGroupIdFromMemoryBucketCharacterId,
  WECHAT_GROUP_BOT_CHARACTER_ID,
  WECHAT_GROUP_USER_CHAR_ID,
} from '../wechatConversationKey'
import { flattenMemoryTriggerKeywords } from './memoryTriggerUtils'
import {
  composeMemoryWithSourcePrefix,
  parseMemorySourcePrefix,
  type ParsedMemoryWithSources,
} from './memorySourceBadges'
import type { MemoryEntry, MemorySceneTag, MemorySourceIdentity } from './memoryArchiveTypes'

export type MemoryArchiveLookup = {
  contactByCharId: Map<string, WeChatContactRow>
  charNameById: Map<string, string>
  groupNameById: Map<string, string>
  primaryAccountId: string | null
}

export function buildMemoryArchiveLookup(
  contacts: WeChatContactRow[],
  charNameById: Map<string, string>,
  groupNameById: Map<string, string>,
  bundle: WechatAccountsBundle | null,
): MemoryArchiveLookup {
  const contactByCharId = new Map<string, WeChatContactRow>()
  for (const c of contacts) {
    const id = c.id.trim()
    if (id) contactByCharId.set(id, c)
  }
  const primaryAccountId = bundle?.accounts[0]?.accountId?.trim() || null
  return { contactByCharId, charNameById, groupNameById, primaryAccountId }
}

export function resolveMemorySourceIdentity(
  m: CharacterMemory,
  primaryAccountId: string | null,
): MemorySourceIdentity {
  if (m.memoryScope === 'meet') return 'lumi_meet'
  const parsed = parseMemorySourcePrefix(m.content)
  if (parsed.hasMeetTag && !parsed.hasOnlineTag && !parsed.hasGroupChatTag && !m.sourceWechatAccountId?.trim()) {
    return 'lumi_meet'
  }
  const acc = m.sourceWechatAccountId?.trim()
  if (!acc) return 'main_wechat'
  if (primaryAccountId && acc === primaryAccountId) return 'main_wechat'
  return 'sub_wechat'
}

export function memorySceneTagsFromRow(m: CharacterMemory): MemorySceneTag[] {
  const parsed = parseMemorySourcePrefix(m.content)
  const tags: MemorySceneTag[] = []
  if (parsed.hasMomentTag || m.memoryScope === 'moment') tags.push('朋友圈')
  if (parsed.hasMeetTag || m.memoryScope === 'meet') tags.push('遇见')
  if (parsed.hasOnlineTag) tags.push('私聊')
  if (parsed.hasGroupChatTag || m.memoryScope === 'group') tags.push('群聊')
  if (parsed.hasOfflineTag) tags.push('线下')
  if (parsed.hasLinkedOfflineTag || m.memoryScope === 'linked') tags.push('关联线下')
  if (!tags.length) tags.push('私聊')
  return tags
}

function resolveFocusCharId(m: CharacterMemory): string {
  if (m.memoryScope === 'group') {
    const ids = m.involvedCharIds ?? []
    const first = ids.find((x) => {
      const t = x.trim()
      return t && t !== WECHAT_GROUP_USER_CHAR_ID && t !== WECHAT_GROUP_BOT_CHARACTER_ID
    })
    if (first?.trim()) return first.trim()
    const gid = m.groupId?.trim() || parseGroupIdFromMemoryBucketCharacterId(m.characterId)
    return gid ? `__group__${gid}` : m.characterId
  }
  return m.characterId.trim()
}

export function resolveMemoryEntryTimestamp(m: CharacterMemory): number {
  const updatedAt = typeof m.updatedAt === 'number' && Number.isFinite(m.updatedAt) ? m.updatedAt : 0
  const createdAt = typeof m.createdAt === 'number' && Number.isFinite(m.createdAt) ? m.createdAt : 0
  const base = updatedAt || createdAt
  if (m.memoryScope === 'moment') {
    const publishedAt = m.momentPayload?.publishedAt
    if (typeof publishedAt === 'number' && Number.isFinite(publishedAt) && publishedAt > 0) {
      return Math.max(base, publishedAt)
    }
  }
  return base
}

function resolveCharDisplayName(charId: string, lookup: MemoryArchiveLookup): string {
  const c = lookup.contactByCharId.get(charId)
  if (c?.remarkName?.trim()) return c.remarkName.trim()
  const n = lookup.charNameById.get(charId)
  if (n?.trim()) return n.trim()
  if (charId.startsWith('__group__')) {
    const gid = charId.slice('__group__'.length)
    return lookup.groupNameById.get(gid) || `群聊 ${gid.slice(0, 6)}`
  }
  return charId.slice(0, 8)
}

export function characterMemoryToMemoryEntry(
  m: CharacterMemory,
  lookup: MemoryArchiveLookup,
): MemoryEntry {
  const parsed = parseMemorySourcePrefix(m.content)
  const charId = resolveFocusCharId(m)
  const contact = lookup.contactByCharId.get(charId)
  const gid = m.groupId?.trim() || parseGroupIdFromMemoryBucketCharacterId(m.characterId) || undefined
  const linkedInteractorIds =
    m.momentMemoryRole !== 'interactor' ? (m.momentLinkedInteractorCharIds ?? []) : []
  const momentLinkedInteractors = linkedInteractorIds
    .map((id) => {
      const trimmed = id.trim()
      if (!trimmed) return null
      const contact = lookup.contactByCharId.get(trimmed)
      return {
        charId: trimmed,
        displayName: resolveCharDisplayName(trimmed, lookup),
        avatarUrl: contact?.avatarUrl,
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
  return {
    id: m.id,
    sourceIdentity: resolveMemorySourceIdentity(m, lookup.primaryAccountId),
    charId,
    storageCharacterId: m.characterId,
    charDisplayName: resolveCharDisplayName(charId, lookup),
    charAvatarUrl: contact?.avatarUrl,
    content: parsed.body,
    tags: memorySceneTagsFromRow(m),
    triggerType: m.memoryTriggerMode === 'always' ? 'always' : 'keyword',
    triggerKeywords:
      m.memoryTriggerMode === 'keyword' ? flattenMemoryTriggerKeywords(m) : undefined,
    timestamp: resolveMemoryEntryTimestamp(m),
    ...(gid ? { groupId: gid, groupDisplayName: lookup.groupNameById.get(gid) } : {}),
    ...(m.sourceWechatAccountId?.trim() ? { sourceWechatAccountId: m.sourceWechatAccountId.trim() } : {}),
    memoryScope: m.memoryScope,
    linkedFromCharacterId: m.linkedFromCharacterId,
    ...(m.momentPayload ? { momentPayload: m.momentPayload } : {}),
    ...(momentLinkedInteractors.length ? { momentLinkedInteractors } : {}),
    ...(m.momentMemoryRole ? { momentMemoryRole: m.momentMemoryRole } : {}),
  }
}

export function memoryTagsToPrefixFlags(tags: MemorySceneTag[]): ParsedMemoryWithSources {
  const set = new Set(tags)
  return {
    hasMeetTag: set.has('遇见'),
    hasOnlineTag: set.has('私聊'),
    hasGroupChatTag: set.has('群聊'),
    hasOfflineTag: set.has('线下'),
    hasLinkedOfflineTag: set.has('关联线下'),
    hasMomentTag: set.has('朋友圈'),
    body: '',
  }
}

export function memoryEntryToPersistPayload(
  entry: Pick<
    MemoryEntry,
    'content' | 'tags' | 'triggerType' | 'triggerKeywords' | 'charId' | 'storageCharacterId' | 'groupId' | 'memoryScope' | 'linkedFromCharacterId'
  >,
  raw: CharacterMemory | null,
  opts?: {
    sourceWechatAccountId?: string
    sourceSessionPlayerIdentityId?: string
  },
): Omit<CharacterMemory, 'id' | 'createdAt' | 'updatedAt'> & {
  memoryTriggerMode: CharacterMemory['memoryTriggerMode']
  memoryKeywords?: string[]
} {
  const flags = memoryTagsToPrefixFlags(entry.tags)
  const content = composeMemoryWithSourcePrefix(flags, entry.content.trim())
  const scope =
    entry.tags.includes('朋友圈') || raw?.memoryScope === 'moment'
      ? 'moment'
      : entry.tags.includes('群聊') || raw?.memoryScope === 'group'
      ? 'group'
      : entry.tags.includes('关联线下') || raw?.memoryScope === 'linked'
        ? 'linked'
        : entry.tags.includes('遇见') && !entry.tags.includes('私聊') && !entry.tags.includes('群聊')
          ? 'meet'
          : raw?.memoryScope === 'meet'
            ? 'meet'
            : 'private'

  const triggerMode = entry.triggerType === 'always' ? 'always' : 'keyword'
  const kws =
    triggerMode === 'keyword' && entry.triggerKeywords?.length
      ? [...new Set(entry.triggerKeywords.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))]
      : undefined

  return {
    characterId: entry.storageCharacterId.trim() || raw?.characterId?.trim() || entry.charId.trim(),
    content: content.slice(0, 4000),
    isAutoGenerated: raw?.isAutoGenerated ?? false,
    memoryScope: scope,
    memoryTriggerMode: triggerMode,
    memoryTriggerCategory: undefined,
    memoryTriggerPrecise: undefined,
    memoryTriggerEmotionNeed: undefined,
    memoryKeywords: kws,
    ...(scope === 'linked' && (raw?.linkedFromCharacterId || entry.linkedFromCharacterId)
      ? { linkedFromCharacterId: raw?.linkedFromCharacterId ?? entry.linkedFromCharacterId }
      : {}),
    ...(scope === 'group' && (raw?.groupId || entry.groupId)
      ? {
          groupId: raw?.groupId ?? entry.groupId,
          involvedCharIds: raw?.involvedCharIds,
        }
      : {}),
    ...(raw?.userPlaceholderBindings?.length
      ? { userPlaceholderBindings: raw.userPlaceholderBindings }
      : {}),
    ...(raw?.sourceWechatAccountId || opts?.sourceWechatAccountId
      ? { sourceWechatAccountId: raw?.sourceWechatAccountId ?? opts?.sourceWechatAccountId }
      : {}),
    ...(raw?.sourceSessionPlayerIdentityId || opts?.sourceSessionPlayerIdentityId
      ? {
          sourceSessionPlayerIdentityId:
            raw?.sourceSessionPlayerIdentityId ?? opts?.sourceSessionPlayerIdentityId,
        }
      : {}),
    ...(raw?.memoryEmbedding ? { memoryEmbedding: raw.memoryEmbedding } : {}),
    ...(raw?.memoryEmbeddingHash ? { memoryEmbeddingHash: raw.memoryEmbeddingHash } : {}),
    ...(raw?.momentSourceMomentId ? { momentSourceMomentId: raw.momentSourceMomentId } : {}),
    ...(raw?.momentPayload ? { momentPayload: raw.momentPayload } : {}),
    ...(raw?.momentMemoryRole ? { momentMemoryRole: raw.momentMemoryRole } : {}),
    ...(raw?.momentPublisherCharacterId
      ? { momentPublisherCharacterId: raw.momentPublisherCharacterId }
      : {}),
    ...(raw?.momentLinkedInteractorCharIds?.length
      ? { momentLinkedInteractorCharIds: raw.momentLinkedInteractorCharIds }
      : {}),
  }
}
