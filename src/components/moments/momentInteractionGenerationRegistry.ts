/** 追踪用户动态 AI 互动生成中状态，以及「生成完成后立即显示」排队 */

import type { MomentInteraction } from './momentInteractionTypes'
import { revealAllPendingMomentInteractions } from './momentInteractionTypes'

export type MomentInteractionGenerationOutcome = 'ai_ok' | 'fallback_only'

type MomentInteractionGenerationRecord = {
  pending: boolean
  outcome: MomentInteractionGenerationOutcome | null
  outcomeAt: number
  aiDraftCount: number
}

const records = new Map<string, MomentInteractionGenerationRecord>()
const revealWhenReadyIds = new Set<string>()
const listeners = new Set<() => void>()

/** useSyncExternalStore 要求 snapshot 引用稳定，禁止每次 get 都 new 对象 */
const EMPTY_SNAPSHOT: MomentInteractionGenerationRecord = {
  pending: false,
  outcome: null,
  outcomeAt: 0,
  aiDraftCount: 0,
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function getRecord(momentId: string): MomentInteractionGenerationRecord {
  const id = momentId.trim()
  if (!id) return EMPTY_SNAPSHOT
  return records.get(id) ?? EMPTY_SNAPSHOT
}

export function subscribeMomentInteractionGeneration(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function markMomentInteractionGenerationStart(momentId: string): void {
  const id = momentId.trim()
  if (!id) return
  records.set(id, {
    pending: true,
    outcome: null,
    outcomeAt: 0,
    aiDraftCount: 0,
  })
  notify()
}

export function markMomentInteractionGenerationEnd(
  momentId: string,
  aiDraftCount = 0,
): void {
  const id = momentId.trim()
  if (!id) return
  records.set(id, {
    pending: false,
    outcome: aiDraftCount > 0 ? 'ai_ok' : 'fallback_only',
    outcomeAt: Date.now(),
    aiDraftCount,
  })
  notify()
}

export function isMomentInteractionGenerationPending(momentId: string): boolean {
  return getRecord(momentId).pending
}

export function getMomentInteractionGenerationSnapshot(
  momentId: string,
): MomentInteractionGenerationRecord {
  return getRecord(momentId)
}

export function queueRevealWhenInteractionReady(momentId: string): void {
  const id = momentId.trim()
  if (!id) return
  revealWhenReadyIds.add(id)
}

export function consumeRevealWhenInteractionReady(momentId: string): boolean {
  const id = momentId.trim()
  if (!id || !revealWhenReadyIds.has(id)) return false
  revealWhenReadyIds.delete(id)
  return true
}

export function clearRevealWhenInteractionReady(momentId: string): void {
  revealWhenReadyIds.delete(momentId.trim())
}

/** 生成写入前：若用户已排队「直接显示」，则一次性解锁全部互动 */
export function applyQueuedRevealAfterGeneration(
  momentId: string,
  interactions: MomentInteraction[],
  now = Date.now(),
): MomentInteraction[] {
  if (!consumeRevealWhenInteractionReady(momentId)) return interactions
  return revealAllPendingMomentInteractions(interactions, now) ?? interactions
}
