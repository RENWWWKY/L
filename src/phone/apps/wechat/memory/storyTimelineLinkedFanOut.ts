import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import {
  buildStoryTimelinePlotRowFromDelta,
  type StoryTimelineEventScope,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

export type StoryTimelineLinkedFanOutEntry = {
  characterId: string
  content: string
}

/** 将关联记忆改写成各 NPC 摘要表中的一行（不写入 prose linked 记忆）。 */
export async function fanOutStoryTimelineLinkedRows(params: {
  entries: StoryTimelineLinkedFanOutEntry[]
  scope?: StoryTimelineEventScope
  plotId?: string | null
  recordedAtMs?: number
  resolveNpcLabel?: (characterId: string) => Promise<string>
}): Promise<string[]> {
  const scope: StoryTimelineEventScope = params.scope ?? 'linked'
  const plotId = params.plotId?.trim() || undefined
  const recordedAt =
    typeof params.recordedAtMs === 'number' && Number.isFinite(params.recordedAtMs)
      ? params.recordedAtMs
      : Date.now()
  const labels: string[] = []

  for (const entry of params.entries) {
    const npcId = entry.characterId.trim()
    const body = entry.content.trim().slice(0, 2000)
    if (!npcId || !body) continue

    const delta: StoryTimelineSummaryDelta = { event_summary: body.slice(0, 240) }
    const row = buildStoryTimelinePlotRowFromDelta(npcId, delta, scope, {
      plotId,
      recordedAtMs: recordedAt,
    })
    if (!row) continue
    await personaDb.appendStoryTimelinePlotRow(row)

    if (params.resolveNpcLabel) {
      try {
        labels.push((await params.resolveNpcLabel(npcId)).trim() || npcId.slice(0, 8))
      } catch {
        labels.push(npcId.slice(0, 8))
      }
    } else {
      labels.push(npcId.slice(0, 8))
    }
  }

  return [...new Set(labels.map((x) => x.trim()).filter(Boolean))]
}

export async function deleteStoryTimelineLinkedRowsForDatingRound(params: {
  characterIds: string[]
  plotId: string
}): Promise<void> {
  const plotId = params.plotId.trim()
  if (!plotId) return
  const ids = [...new Set(params.characterIds.map((x) => x.trim()).filter(Boolean))]
  for (const cid of ids) {
    await personaDb.deleteStoryTimelinePlotRowsByPlotIdForCharacter(cid, plotId)
  }
}

export async function resolveNpcDisplayLabel(characterId: string): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''
  try {
    const row = (await personaDb.getCharacter(cid)) as Character | null
    return String(row?.name ?? row?.wechatNickname ?? '').trim() || cid.slice(0, 8)
  } catch {
    return cid.slice(0, 8)
  }
}
