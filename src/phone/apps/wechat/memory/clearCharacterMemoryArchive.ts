import { loadMeetPersisted } from '../../lumiMeet/meetPersistLoad'
import { resolveOfflineDatingArchiveContext } from '../dating/offlineDatingArchiveResolve'
import { loadDatingPlotsFromKv } from '../unifiedMemoryAutoSummary'
import { personaDb, emitWeChatStorageChanged } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import {
  parseGroupIdFromMemoryBucketCharacterId,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountGroupConversationKey,
  resolveGroupWeChatStorageConversationKey,
} from '../wechatConversationKey'
import { collectMemoryIdsForArchiveCharacterClear } from './collectMemoryIdsForArchiveCharacterClear'
import { loadStoryTimelineArchiveForCharacter } from './memoryStoryTimelineArchive'
import type { MemoryEntry } from './memoryArchiveTypes'
import type { StoryTimelineState } from './storyTimelineTypes'

export type MemoryArchiveClearScope = 'online' | 'offline' | 'both'

export type MemoryArchiveClearCounts = {
  onlineMemoryCount: number
  offlineRowCount: number
  offlineHasState: boolean
}

function hasMeaningfulStoryTimelineState(state: StoryTimelineState | null | undefined): boolean {
  if (!state) return false
  return !!(
    state.manualAnchorBlock?.trim() ||
    state.currentLocation?.trim() ||
    state.currentStoryDay?.trim() ||
    state.currentStoryTime?.trim() ||
    state.costumes.length ||
    state.items.length ||
    state.foreshadows.length ||
    (state.todos?.length ?? 0) ||
    state.recentEvents.length
  )
}

export function resolveMemoryArchiveClearCounts(params: {
  selectedCharId: string
  allEntries: MemoryEntry[]
  rawMemories: CharacterMemory[]
  offlineRowCount: number
  offlineHasState?: boolean
}): MemoryArchiveClearCounts {
  const onlineMemoryCount = collectMemoryIdsForArchiveCharacterClear({
    selectedCharId: params.selectedCharId,
    allEntries: params.allEntries,
    rawMemories: params.rawMemories,
  }).length
  return {
    onlineMemoryCount,
    offlineRowCount: params.offlineRowCount,
    offlineHasState: params.offlineHasState ?? false,
  }
}

export function memoryArchiveClearScopeHasWork(
  scope: MemoryArchiveClearScope,
  counts: MemoryArchiveClearCounts,
): boolean {
  if (scope === 'online') return counts.onlineMemoryCount > 0
  if (scope === 'offline') return counts.offlineRowCount > 0 || counts.offlineHasState
  return counts.onlineMemoryCount > 0 || counts.offlineRowCount > 0 || counts.offlineHasState
}

async function collectConversationKeysForCharacter(characterId: string): Promise<string[]> {
  const cid = characterId.trim()
  if (!cid) return []

  const keys = new Set<string>()
  const settings = await personaDb.listAllChatConversationSettings()
  for (const row of settings) {
    const ck = row.conversationKey?.trim()
    if (!ck) continue
    if (row.peerCharacterId?.trim() === cid) {
      keys.add(ck)
      continue
    }
    const parsed = parsePrivateWeChatConversationCharacterAndSession(ck)
    if (parsed?.characterId === cid) keys.add(ck)
  }

  const groups = await personaDb.listGroupChats()
  for (const group of groups) {
    const gid = group.id?.trim()
    if (!gid) continue
    const members = group.members ?? []
    if (!members.some((m) => m.charId?.trim() === cid)) continue
    for (const row of settings) {
      const parsed = parseWechatAccountGroupConversationKey(row.conversationKey)
      if (!parsed || parsed.groupId !== gid) continue
      keys.add(row.conversationKey.trim())
      keys.add(
        resolveGroupWeChatStorageConversationKey(
          parsed.groupId,
          parsed.wechatAccountId,
          parsed.sessionPlayerId,
        ),
      )
    }
  }

  const gidFromBucket = parseGroupIdFromMemoryBucketCharacterId(cid)
  if (gidFromBucket) {
    for (const row of settings) {
      const parsed = parseWechatAccountGroupConversationKey(row.conversationKey)
      if (parsed?.groupId === gidFromBucket) {
        keys.add(row.conversationKey.trim())
      }
    }
  }

  return [...keys]
}

async function advanceSummaryCursorsForConversationKeys(conversationKeys: string[]): Promise<void> {
  for (const ck of conversationKeys) {
    const key = ck.trim()
    if (!key) continue
    await personaDb.clearMemorySummaryRetry(key)
    const msgs = await personaDb.listWeChatChatMessagesByConversationKey(key)
    let maxTs = 0
    for (const m of msgs) {
      if (m.isRecalled) continue
      const ts = m.timestamp
      if (typeof ts === 'number' && Number.isFinite(ts) && ts > maxTs) maxTs = ts
    }
    if (maxTs > 0) {
      await personaDb.setMemorySummaryCursorTimestamp(key, maxTs)
    }
  }
}

async function suppressOnlineAutoMemorySummaryForCharacter(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return

  const conversationKeys = await collectConversationKeysForCharacter(cid)
  await advanceSummaryCursorsForConversationKeys(conversationKeys)

  const settings = await personaDb.getMemorySettings()
  const aiMap = { ...(settings.aiRoundCountByConversation ?? {}) }
  let aiChanged = false
  for (const ck of conversationKeys) {
    if (ck in aiMap) {
      delete aiMap[ck]
      aiChanged = true
    }
  }

  const prevRetries = settings.memorySummaryRetryQueue ?? []
  const nextRetries = prevRetries.filter((q) => q.characterId.trim() !== cid)

  const patch: Parameters<typeof personaDb.putMemorySettings>[0] = {}
  if (aiChanged) {
    patch.aiRoundCountByConversation = Object.keys(aiMap).length ? aiMap : undefined
  }
  if (nextRetries.length !== prevRetries.length) {
    patch.memorySummaryRetryQueue = nextRetries.length ? nextRetries : undefined
  }
  if (Object.keys(patch).length) {
    await personaDb.putMemorySettings(patch, { emit: false })
  }

  let meetMaxTs = Date.now()
  try {
    const meet = await loadMeetPersisted()
    const thread = meet?.chatThreads?.[cid] ?? []
    for (const m of thread) {
      const ts = m.ts
      if (typeof ts === 'number' && Number.isFinite(ts) && ts > meetMaxTs) meetMaxTs = ts
    }
  } catch {
    /* ignore */
  }
  await personaDb.setMeetSummaryCursorTimestamp(cid, meetMaxTs)
}

async function suppressOfflineAutoStoryTimelineResummary(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return

  const archiveIds = new Set<string>([cid])
  try {
    const ctx = await resolveOfflineDatingArchiveContext(cid)
    const archiveId = ctx?.archiveCharacterId?.trim()
    if (archiveId) archiveIds.add(archiveId)
  } catch {
    /* ignore */
  }

  let maxPlotTs = Date.now()
  for (const id of archiveIds) {
    const plots = await loadDatingPlotsFromKv(id)
    for (const plot of plots) {
      const ts = plot.timestamp
      if (typeof ts === 'number' && Number.isFinite(ts) && ts > maxPlotTs) maxPlotTs = ts
    }
    await personaDb.setDatingPlotSummaryCursor(id, maxPlotTs)
  }
}

async function clearOnlineCharacterMemories(params: {
  selectedCharId: string
  allEntries: MemoryEntry[]
  rawMemories: CharacterMemory[]
}): Promise<number> {
  const ids = collectMemoryIdsForArchiveCharacterClear(params)
  const unique = [...new Set(ids)]
  for (const id of unique) {
    await personaDb.deleteCharacterMemory(id)
  }
  await suppressOnlineAutoMemorySummaryForCharacter(params.selectedCharId)
  return unique.length
}

async function clearOfflineStoryTimelineArchive(params: {
  characterId: string
  displayName: string
}): Promise<number> {
  const cid = params.characterId.trim()
  if (!cid) return 0

  const { rows, state } = await loadStoryTimelineArchiveForCharacter(cid)
  const hasState = hasMeaningfulStoryTimelineState(state)
  if (!rows.length && !hasState) return 0

  await personaDb.appendIndexedTrashEntry({
    kind: 'story-timeline-archive',
    title: `删除线下剧情摘要 · ${params.displayName.trim() || '角色'}`,
    summary: `${rows.length} 条摘要行${hasState ? ' · 含状态表' : ''}`,
    payload: {
      characterId: cid,
      rows,
      state: hasState ? state : null,
    },
  })

  await personaDb.purgeStoryTimelineDataForCharacterIds([cid])
  await suppressOfflineAutoStoryTimelineResummary(cid)
  return rows.length + (hasState ? 1 : 0)
}

export async function clearCharacterMemoryArchive(params: {
  selectedCharId: string
  displayName: string
  scope: MemoryArchiveClearScope
  allEntries: MemoryEntry[]
  rawMemories: CharacterMemory[]
}): Promise<{ onlineDeleted: number; offlineDeleted: number }> {
  const scope = params.scope
  let onlineDeleted = 0
  let offlineDeleted = 0

  if (scope === 'online' || scope === 'both') {
    onlineDeleted = await clearOnlineCharacterMemories({
      selectedCharId: params.selectedCharId,
      allEntries: params.allEntries,
      rawMemories: params.rawMemories,
    })
  }

  if (scope === 'offline' || scope === 'both') {
    offlineDeleted = await clearOfflineStoryTimelineArchive({
      characterId: params.selectedCharId,
      displayName: params.displayName,
    })
  }

  emitWeChatStorageChanged()
  return { onlineDeleted, offlineDeleted }
}