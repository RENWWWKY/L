import { parseMemorySourcePrefix } from '../wechat/memory/memorySourceBadges'
import { emitWeChatStorageChanged, personaDb } from '../wechat/newFriendsPersona/idb'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import { parsePrivateWeChatConversationCharacterAndSession } from '../wechat/wechatConversationKey'
import { getWorldbookLoreEntriesSnapshot, removeLoreEntry } from '../../worldbook/worldbookLoreStore'
import { DEFAULT_MEET_STATE } from './constants'
import { getMeetEpilogueImpressionEntryId, getMeetNineDossierEntryId } from './meetPersonaWorldbookSync'
import { getMeetTruthMirrorLoreEntryId, removeMeetTruthMirrorWorldbookForCharacter } from './meetTruthMirrorWorldbook'
import type { EncounterNPC, LumiMeetPersistedState } from './meetTypes'

export type ClearMeetEncounterDataResult = {
  /** 从遇见存档移除的邂逅角色数（含已转入微信者） */
  removedNpcCount: number
  /** 从人设库删除的遇见向长期记忆条数 */
  removedMeetMemoryCount: number
  /** 清除前已标记 wechat_added 且人设库仍存在的角色数（微信侧未删） */
  protectedWechatContactCount: number
}

export function isMeetScopedCharacterMemory(m: CharacterMemory): boolean {
  if (m.memoryScope === 'meet') return true
  return parseMemorySourcePrefix(m.content).hasMeetTag
}

/**
 * 将遇见 KV 恢复为「刚安装」邂逅状态：清空全部 NPC / 会话 / 广场等；
 * 保留用户在本应用填写的 MASK / 氛围 / 锚点资料与雷达筛选。
 */
export function buildMeetPersistAfterAppReset(state: LumiMeetPersistedState): LumiMeetPersistedState {
  return {
    ...DEFAULT_MEET_STATE,
    meetProfile: { ...state.meetProfile },
    radarFilters: { ...state.radarFilters },
    destinyArchive: [],
    destinyArchiveMetaByCharId: {},
  }
}

const MEET_LORE_ARCHIVE_ID_PREFIXES = [
  'meet-nine-dossier-',
  'meet-epilogue-impression-',
  'meet-truth-mirror-log-',
] as const

/** 从全局档案室移除该邂逅角色的一切遇见遗留条目（匹配角色只保留在人设 worldBooks） */
export function removeMeetLoreEntriesForNpcIds(npcIds: string[]): void {
  for (const id of npcIds) {
    const cid = id.trim()
    if (!cid) continue
    removeLoreEntry(getMeetNineDossierEntryId(cid))
    removeLoreEntry(getMeetEpilogueImpressionEntryId(cid))
    removeLoreEntry(getMeetTruthMirrorLoreEntryId(cid))
  }
}

/** 启动时一次性清理档案室中所有遇见相关遗留条目 */
export function purgeAllMeetEntriesFromLoreArchive(): void {
  for (const e of getWorldbookLoreEntriesSnapshot()) {
    const id = String(e.id ?? '').trim()
    if (!id) continue
    if (MEET_LORE_ARCHIVE_ID_PREFIXES.some((p) => id.startsWith(p))) {
      removeLoreEntry(id)
    }
  }
}

export async function removeMeetTruthMirrorWorldbooksForNpcIds(npcIds: string[]): Promise<void> {
  for (const id of npcIds) {
    await removeMeetTruthMirrorWorldbookForCharacter(id)
  }
}

/** 删除指定角色名下所有遇见向长期记忆（含自动总结 [遇见] 与 memoryScope=meet） */
export async function deleteMeetScopedMemoriesForCharacterIds(characterIds: string[]): Promise<number> {
  const ids = [...new Set(characterIds.map((x) => x.trim()).filter(Boolean))]
  if (!ids.length) return 0

  let removed = 0
  const deletedIds = new Set<string>()

  for (const cid of ids) {
    const mems = await personaDb.listCharacterMemoriesForCharacter(cid)
    for (const m of mems) {
      if (!isMeetScopedCharacterMemory(m)) continue
      if (deletedIds.has(m.id)) continue
      await personaDb.deleteCharacterMemory(m.id)
      deletedIds.add(m.id)
      removed += 1
    }
  }

  if (removed > 0) emitWeChatStorageChanged()
  return removed
}

async function countProtectedWechatContacts(npcs: EncounterNPC[]): Promise<number> {
  const added = npcs.filter((n) => n.status === 'wechat_added')
  if (!added.length) return 0
  let count = 0
  for (const n of added) {
    const ch = await personaDb.getCharacter(n.id)
    if (ch) count += 1
  }
  return count
}

/** 重置遇见相关 memorySettings 游标（全部遇见会话游标 + 涉及角色的私聊/约会计数） */
export async function resetMeetMemorySettingsForNpcIds(characterIds: string[]): Promise<void> {
  const idSet = new Set(characterIds.map((x) => x.trim()).filter(Boolean))
  const settings = await personaDb.getMemorySettings()
  const meetMap = { ...(settings.meetSummaryCursorTimestampByCharacterId ?? {}) }
  const datingMap = { ...(settings.datingPlotSummaryCursorByCharacterId ?? {}) }
  const aiMap = { ...(settings.aiRoundCountByConversation ?? {}) }
  const sumMap = { ...(settings.summaryCursorTimestampByConversation ?? {}) }

  if (idSet.size) {
    for (const id of idSet) {
      delete meetMap[id]
      delete datingMap[id]
    }
    for (const k of Object.keys(aiMap)) {
      const parsed = parsePrivateWeChatConversationCharacterAndSession(k)
      if (parsed && idSet.has(parsed.characterId)) delete aiMap[k]
    }
    for (const k of Object.keys(sumMap)) {
      const parsed = parsePrivateWeChatConversationCharacterAndSession(k)
      if (parsed && idSet.has(parsed.characterId)) delete sumMap[k]
    }
  }

  await personaDb.putMemorySettings({
    meetSummaryCursorTimestampByCharacterId: undefined,
    datingPlotSummaryCursorByCharacterId: Object.keys(datingMap).length ? datingMap : undefined,
    aiRoundCountByConversation: Object.keys(aiMap).length ? aiMap : undefined,
    summaryCursorTimestampByConversation: Object.keys(sumMap).length ? sumMap : undefined,
  })
}

/**
 * 重置遇见应用邂逅数据（等同重新打开寻觅），并清除已入库的遇见长期记忆。
 * 不删除微信通讯录人设、私聊消息与非遇见向长期记忆。
 */
export async function clearMeetEncounterDataKeepingWechatAdded(
  state: LumiMeetPersistedState,
): Promise<{ next: LumiMeetPersistedState; result: ClearMeetEncounterDataResult }> {
  const snapshotNpcs = state.npcs
  const allNpcIds = snapshotNpcs.map((n) => n.id)
  const protectedWechatContactCount = await countProtectedWechatContacts(snapshotNpcs)

  const removedMeetMemoryCount = await deleteMeetScopedMemoriesForCharacterIds(allNpcIds)
  removeMeetLoreEntriesForNpcIds(allNpcIds)
  await removeMeetTruthMirrorWorldbooksForNpcIds(allNpcIds)
  await resetMeetMemorySettingsForNpcIds(allNpcIds)

  const next = buildMeetPersistAfterAppReset(state)
  return {
    next,
    result: {
      removedNpcCount: snapshotNpcs.length,
      removedMeetMemoryCount,
      protectedWechatContactCount,
    },
  }
}
