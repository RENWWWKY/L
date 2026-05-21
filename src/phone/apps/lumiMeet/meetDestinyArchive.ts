import { parseMemorySourcePrefix } from '../wechat/memory/memorySourceBadges'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { isMeetScopedCharacterMemory } from './meetClearEncounterData'
import type {
  DestinyArchiveCharMeta,
  EncounterMatchType,
  EncounterMemory,
  EncounterNPC,
  EncounterStatus,
  LumiMeetPersistedState,
} from './meetTypes'

export const DESTINY_FADED_PLACEHOLDER = '信号微弱，未能建立深度联结。'

export function newDestinyMemoryId(charId?: string): string {
  const base = charId?.trim() || 'manual'
  return `da-${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 旧版 buildDestinyArchiveCharMetaOnOutcome 首次成功会误写成 matchAttempts=2，导致显示「兜兜转转」 */
export function normalizeDestinyArchiveCharMeta(
  meta: DestinyArchiveCharMeta | undefined,
): DestinyArchiveCharMeta | undefined {
  if (!meta) return meta
  if (meta.matchAttempts === 2 && !meta.everMissed && !meta.lastMatchWasReunion) {
    return { ...meta, matchAttempts: 1 }
  }
  return meta
}

export function deriveMatchTypeFromNpc(
  status: EncounterStatus,
  meta: DestinyArchiveCharMeta | undefined,
): EncounterMatchType {
  const m = normalizeDestinyArchiveCharMeta(meta)
  if (status === 'missed') return 'faded'
  if (status === 'matched' || status === 'wechat_added') {
    if (m?.lastMatchWasReunion || m?.everMissed) return 'reconnected'
    if ((m?.matchAttempts ?? 1) > 1) return 'reconnected'
    return 'resonated'
  }
  return 'faded'
}

export async function fetchLatestMeetAiSummaryForCharacter(charId: string): Promise<string> {
  const cid = charId.trim()
  if (!cid) return ''
  const mems = await personaDb.listCharacterMemoriesForCharacter(cid)
  const meetRows = mems
    .filter(isMeetScopedCharacterMemory)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const top = meetRows[0]
  if (!top) return ''
  const parsed = parseMemorySourcePrefix(top.content)
  return (parsed.body || top.content).trim().slice(0, 1200)
}

export function buildDestinyArchiveCharMetaOnOutcome(
  prev: DestinyArchiveCharMeta | undefined,
  outcome: 'miss' | 'resonated' | 'reconnected',
  opts?: { reunion?: boolean },
): DestinyArchiveCharMeta {
  const base: DestinyArchiveCharMeta = {
    matchAttempts: (prev?.matchAttempts ?? 0) + 1,
    everMissed: prev?.everMissed ?? false,
    lastMatchWasReunion: prev?.lastMatchWasReunion,
  }
  if (outcome === 'miss') {
    base.everMissed = true
    base.lastMatchWasReunion = false
  } else {
    base.lastMatchWasReunion = outcome === 'reconnected' || opts?.reunion === true
    if (outcome === 'reconnected') base.everMissed = true
  }
  return base
}

const DESTINY_ARCHIVE_NPC_STATUSES: EncounterNPC['status'][] = ['matched', 'missed', 'wechat_added']

export function mergeNpcIntoDestinyArchive(
  archive: EncounterMemory[],
  metaMap: Record<string, DestinyArchiveCharMeta>,
  npcs: EncounterNPC[],
): EncounterMemory[] {
  const archiveByChar = new Map<string, EncounterMemory>()
  for (const row of archive) {
    const cid = row.charId.trim()
    if (!cid || row.isManual) continue
    archiveByChar.set(cid, row)
  }

  const byChar = new Map<string, EncounterMemory>()

  for (const npc of npcs) {
    if (!DESTINY_ARCHIVE_NPC_STATUSES.includes(npc.status)) continue
    const meta = normalizeDestinyArchiveCharMeta(metaMap[npc.id])
    const matchType = deriveMatchTypeFromNpc(npc.status, meta)
    const attempts = Math.max(1, meta?.matchAttempts ?? 1, archiveByChar.get(npc.id)?.matchAttempts ?? 1)
    const existing = archiveByChar.get(npc.id)
    const aiSummary =
      matchType === 'faded'
        ? existing?.aiSummary?.trim() || DESTINY_FADED_PLACEHOLDER
        : existing?.aiSummary?.trim() || ''

    byChar.set(npc.id, {
      id: existing?.id ?? `da-${npc.id}`,
      charId: npc.id,
      avatarUrl: npc.avatarUrl,
      nickname: npc.nickname,
      matchType,
      matchAttempts: attempts,
      aiSummary,
      customMemo: existing?.customMemo,
      timestamp: Math.max(npc.lastEncounterTime, existing?.timestamp ?? npc.lastEncounterTime),
    })
  }

  return [...byChar.values()].sort((a, b) => b.timestamp - a.timestamp)
}

export async function hydrateDestinyArchiveAiSummaries(entries: EncounterMemory[]): Promise<EncounterMemory[]> {
  const out: EncounterMemory[] = []
  for (const row of entries) {
    if (row.matchType === 'faded') {
      out.push({
        ...row,
        aiSummary: row.aiSummary.trim() || DESTINY_FADED_PLACEHOLDER,
      })
      continue
    }
    const fromDb = row.aiSummary.trim() ? row.aiSummary : await fetchLatestMeetAiSummaryForCharacter(row.charId)
    out.push({
      ...row,
      aiSummary: fromDb.trim() || row.customMemo?.trim() || '这段交汇尚未写下自动总结，可在下方补充手记。',
    })
  }
  return out
}

export function computeDestinyArchiveStats(entries: EncounterMemory[]): {
  total: number
  resonated: number
  reconnected: number
  faded: number
  epitaph: string
} {
  const total = entries.length
  const resonated = entries.filter((e) => e.matchType === 'resonated').length
  const reconnected = entries.filter((e) => e.matchType === 'reconnected').length
  const faded = entries.filter((e) => e.matchType === 'faded').length
  const soulHits = resonated + reconnected
  let epitaph = '尚无交汇被写入残卷；每一次寻觅都会在此留下痕迹。'
  if (total > 0) {
    epitaph = `已与 ${total} 个灵魂产生交汇，其中 ${soulHits} 个产生了共鸣${
      reconnected > 0 ? `，${reconnected} 段为兜兜转转的重逢` : ''
    }${faded > 0 ? `；${faded} 段波长已消散在风里` : ''}。`
  }
  return { total, resonated, reconnected, faded, epitaph }
}

export function patchDestinyArchiveInState(
  state: LumiMeetPersistedState,
  archive: EncounterMemory[],
): LumiMeetPersistedState {
  return {
    ...state,
    destinyArchive: archive,
    version: 5,
  }
}
