import { personaDb } from '../newFriendsPersona/idb'
import {
  applyAffectionDerivedRelationship,
  buildDefaultCharacterPsycheState,
  extractCharacterPsycheMetrics,
  normalizeCharacterPsycheSnapshotRow,
  normalizeCharacterPsycheState,
  type CharacterPsycheMetricsSnapshot,
  type CharacterPsycheSnapshotRow,
  type CharacterPsycheState,
} from './characterPsycheTypes'
import {
  mergeCharacterPsycheSummaries,
  type CharacterPsychePageSummaries,
} from './characterPsycheSummaries'

export type CharacterPsycheLoaded = {
  state: CharacterPsycheState
  summaries: CharacterPsychePageSummaries
  previousMetrics: CharacterPsycheMetricsSnapshot | null
  /** 上次 AI 生成并入库的时间戳；未生成过则为 null */
  lastGeneratedAt: number | null
}

export function formatCharacterPsycheGeneratedAt(ts: number): string {
  const d = new Date(ts)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const KV_PREFIX = 'character-psyche:v1:'

function psycheKvKey(conversationCharacterId: string, playerIdentityId: string): string {
  return `${KV_PREFIX}${conversationCharacterId}::${playerIdentityId}`
}

export async function loadCharacterPsycheState(params: {
  conversationCharacterId: string
  playerIdentityId: string
  personaCharacterId?: string | null
  characterFullName: string
  lastUserQuote?: string
}): Promise<CharacterPsycheLoaded> {
  const cid = params.conversationCharacterId.trim()
  const pid = params.playerIdentityId.trim()
  const summaryCtx = {
    characterFullName: params.characterFullName.trim() || 'TA',
    lastUserQuote: params.lastUserQuote,
  }
  if (!cid || !pid) {
    const state = normalizeCharacterPsycheState({})
    return {
      state,
      summaries: mergeCharacterPsycheSummaries(state, summaryCtx),
      previousMetrics: null,
      lastGeneratedAt: null,
    }
  }

  const raw = await personaDb.getPhoneKv(psycheKvKey(cid, pid))
  const row = normalizeCharacterPsycheSnapshotRow(raw)
  let state: CharacterPsycheState
  if (row?.state) {
    state = applyAffectionDerivedRelationship(normalizeCharacterPsycheState(row.state))
  } else {
    const seed = `${cid}::${pid}::${params.personaCharacterId ?? ''}`
    state = buildDefaultCharacterPsycheState(seed)
  }

  return {
    state,
    summaries: mergeCharacterPsycheSummaries(state, summaryCtx),
    previousMetrics: row?.previousMetrics ?? null,
    lastGeneratedAt: row?.updatedAt ?? null,
  }
}

export async function saveCharacterPsycheState(params: {
  conversationCharacterId: string
  playerIdentityId: string
  state: CharacterPsycheState
}): Promise<CharacterPsycheSnapshotRow> {
  const cid = params.conversationCharacterId.trim()
  const pid = params.playerIdentityId.trim()
  const state = applyAffectionDerivedRelationship(normalizeCharacterPsycheState(params.state))

  const raw = await personaDb.getPhoneKv(psycheKvKey(cid, pid))
  const existing = normalizeCharacterPsycheSnapshotRow(raw)
  const previousMetrics = existing?.state ? extractCharacterPsycheMetrics(existing.state) : null

  const row: CharacterPsycheSnapshotRow = {
    conversationCharacterId: cid,
    playerIdentityId: pid,
    state,
    previousMetrics,
    updatedAt: Date.now(),
  }
  await personaDb.setPhoneKv(psycheKvKey(cid, pid), row)
  return row
}

export function summariesFromPsycheState(state: CharacterPsycheState): CharacterPsychePageSummaries {
  const s = state.summaries
  return {
    emotion: s?.emotion?.trim() ?? '',
    darkness: s?.darkness?.trim() ?? '',
    vitals: s?.vitals?.trim() ?? '',
  }
}
