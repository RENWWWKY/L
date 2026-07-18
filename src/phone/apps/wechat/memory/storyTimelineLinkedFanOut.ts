import type { ApiConfigCore } from '../../api/types'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { fetchStoryTimelineSummaryFallback } from './storyTimelineSummaryFallback'
import {
  buildStoryTimelinePlotRowFromDelta,
  composeStoryTimelineCalendarAnchorLabel,
  hasTimelineDeltaContent,
  normalizeStoryTimelineRowTitle,
  STORY_TIMELINE_ROW_TITLE_MAX,
  type StoryTimelineEventScope,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

export type StoryTimelineLinkedFanOutEntry = {
  characterId: string
  content: string
  /** 模型 JSON linked[].timeline（若有） */
  timelineDelta?: StoryTimelineSummaryDelta | null
}

function buildLinkedSummaryMaterial(params: {
  linkedContent: string
  latestPlotBody?: string
}): string {
  const parts = [
    '【任务·人脉关联记忆 → 剧情摘要表】',
    '须输出 [TIMELINE] markup（禁止 JSON）：标题 4～10 字；关键词 3～5 个、每条 ≤5 字；故事日/时刻/地点尽量填；事件为融合叙事（道具与动机写进事件，勿单列服装/物品/伏笔/待办）。',
    '视角：本条 linked 角色的 {{char}}=该 NPC 本人；{{archive_char}}=线下存档主角；{{user}}=玩家。',
  ]
  const plot = String(params.latestPlotBody ?? '').trim()
  if (plot) {
    parts.push(`【本轮约会主线摘录（仅参照，勿整段写入）】\n${plot.slice(0, 2200)}`)
  }
  parts.push(`【关联记忆正文（据此提炼）】\n${params.linkedContent}`)
  return parts.join('\n\n')
}

function stripLinkedProsePrefix(content: string): string {
  return String(content ?? '')
    .replace(/^\[关联线下\]\s*/, '')
    .trim()
}

function mergeLinkedEventSummary(timelineSummary: string | undefined, linkedContent: string): string {
  const fromTimeline = String(timelineSummary ?? '').trim()
  if (fromTimeline) return fromTimeline.slice(0, 400)
  return stripLinkedProsePrefix(linkedContent).slice(0, 240)
}

function inferFallbackLinkedRowTitle(linkedContent: string): string | undefined {
  const body = stripLinkedProsePrefix(linkedContent).replace(/\s+/g, ' ')
  if (!body) return undefined
  const cut = body.slice(0, STORY_TIMELINE_ROW_TITLE_MAX)
  const punct = cut.search(/[。！？；，、]/)
  if (punct >= 4) return normalizeStoryTimelineRowTitle(cut.slice(0, punct))
  return normalizeStoryTimelineRowTitle(cut)
}

async function resolveLinkedStoryTimelineDelta(params: {
  apiConfig: ApiConfigCore | null
  npcCharacterId: string
  linkedContent: string
  cachedDelta?: StoryTimelineSummaryDelta | null
  sharedPrimaryDelta?: StoryTimelineSummaryDelta | null
  latestPlotBody?: string
  storyCalendarAnchor?: string | null
}): Promise<StoryTimelineSummaryDelta> {
  const linkedContent = stripLinkedProsePrefix(params.linkedContent)
  const cached = params.cachedDelta
  if (cached && hasTimelineDeltaContent(cached)) {
    return {
      ...cached,
      ...(normalizeStoryTimelineRowTitle(cached.row_title)
        ? { row_title: normalizeStoryTimelineRowTitle(cached.row_title) }
        : {}),
      event_summary: mergeLinkedEventSummary(cached.event_summary, linkedContent),
    }
  }

  const apiDelta = await fetchStoryTimelineSummaryFallback({
    chatFallback: params.apiConfig,
    materialBlock: buildLinkedSummaryMaterial({
      linkedContent,
      latestPlotBody: params.latestPlotBody,
    }),
    peerCharacterId: params.npcCharacterId,
    latestRoundBody: linkedContent,
    storyCalendarAnchor: params.storyCalendarAnchor,
  })
  if (apiDelta && hasTimelineDeltaContent(apiDelta)) {
    return {
      ...apiDelta,
      event_summary: mergeLinkedEventSummary(apiDelta.event_summary, linkedContent),
    }
  }

  const shared = params.sharedPrimaryDelta
  const sharedTitle = normalizeStoryTimelineRowTitle(shared?.row_title)
  const inferred = inferFallbackLinkedRowTitle(linkedContent)
  return {
    ...(shared?.story_day ? { story_day: shared.story_day } : {}),
    ...(shared?.story_time ? { story_time: shared.story_time } : {}),
    ...(shared?.relative_time ? { relative_time: shared.relative_time } : {}),
    ...(shared?.location ? { location: shared.location } : {}),
    ...(sharedTitle || inferred ? { row_title: sharedTitle ?? inferred } : {}),
    event_summary: mergeLinkedEventSummary(undefined, linkedContent),
  }
}

/** 将关联记忆改写成各 NPC 摘要表中的一行（不写入 prose linked 记忆）。 */
export async function fanOutStoryTimelineLinkedRows(params: {
  entries: StoryTimelineLinkedFanOutEntry[]
  scope?: StoryTimelineEventScope
  plotId?: string | null
  recordedAtMs?: number
  resolveNpcLabel?: (characterId: string) => Promise<string>
  apiConfig?: ApiConfigCore | null
  /** 本轮主角 timeline（可复用锚点/标题） */
  sharedPrimaryDelta?: StoryTimelineSummaryDelta | null
  latestPlotBody?: string
}): Promise<string[]> {
  const scope: StoryTimelineEventScope = params.scope ?? 'linked'
  const plotId = params.plotId?.trim() || undefined
  const recordedAt =
    typeof params.recordedAtMs === 'number' && Number.isFinite(params.recordedAtMs)
      ? params.recordedAtMs
      : Date.now()
  const labels: string[] = []
  const storyCalendarAnchor = params.sharedPrimaryDelta
    ? composeStoryTimelineCalendarAnchorLabel(params.sharedPrimaryDelta)
    : ''

  for (const entry of params.entries) {
    const npcId = entry.characterId.trim()
    const body = entry.content.trim().slice(0, 2000)
    if (!npcId || !body) continue

    const delta = await resolveLinkedStoryTimelineDelta({
      apiConfig: params.apiConfig ?? null,
      npcCharacterId: npcId,
      linkedContent: body,
      cachedDelta: entry.timelineDelta,
      sharedPrimaryDelta: params.sharedPrimaryDelta,
      latestPlotBody: params.latestPlotBody,
      storyCalendarAnchor,
    })
    const row = buildStoryTimelinePlotRowFromDelta(npcId, delta, scope, {
      plotId,
      recordedAtMs: recordedAt,
    })
    if (!row) continue
    await personaDb.upsertStoryTimelinePlotRow(row)

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
