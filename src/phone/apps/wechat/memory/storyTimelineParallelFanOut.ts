import type { ApiConfigCore } from '../../api/types'
import { resolveDatingPlotDisplayFromItem } from '../dating/plotCoT'
import type { PlotItem } from '../dating/types'
import { listAllLinkedMemoryEligibleCharacters } from './linkedMemoryEligiblePeers'
import { fetchStoryTimelineSummaryFallback } from './storyTimelineSummaryFallback'
import {
  buildStoryTimelinePlotRowFromDelta,
  hasTimelineDeltaContent,
  normalizeStoryTimelineRowTitle,
  type StoryTimelinePlotRow,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

function buildParallelEventSummaryMaterial(params: {
  anchorPlotBody?: string
  parallelBody: string
}): string {
  const parts: string[] = [
    '【任务·屏外平行事件 → 剧情摘要表】',
    '须输出与主线相同的 [TIMELINE] markup（禁止 JSON）：含标题、关键词、锚点、事件等；事件为**融合叙事摘要**，禁止整段粘贴下方正文。',
    '标题：与主线摘要表相同（4～10 字概括平行切片情绪/转折）；**禁止**写「屏外平行」「IF」「第 N 轮」等类型标签。',
    '关键词：3～5 个检索词，每条 ≤5 字，概括平行切片场景/人物/情绪钩子。',
    '与锚点轮**同一时刻** elsewhere；主角色 {{char}} **未在场** → 侧幕填「是」。',
    '在场：仅列平行切片内实际出场者（可用 {{id:…}}），**不得**含 {{char}}。',
    '事件：把在场 NPC 的动作、用到的道具、其动机都写进「事件」一段；**禁止**单列服装/物品/伏笔/待办。',
    '**禁止**写约会主角色 {{char}}（锚点侧、本切片未在场）的内心线或对 {{char}} 的猜测。',
  ]
  const anchor = String(params.anchorPlotBody ?? '').trim()
  if (anchor) {
    parts.push(
      `【锚点轮主线（仅对齐时刻/地点，勿写进 parallel 摘要）】\n${anchor.slice(0, 2200)}`,
    )
  }
  parts.push(`【屏外平行正文（据此提炼摘要）】\n${params.parallelBody}`)
  return parts.join('\n\n')
}

function tagEventSummary(prefix: string, summary: string | undefined): string {
  const body = String(summary ?? '').trim()
  const head = prefix.trim()
  if (!body) return head.slice(0, 400)
  if (body.startsWith(head.slice(0, 8))) return body.slice(0, 400)
  return `${head}${body}`.slice(0, 400)
}

type AnchorEntry = { text?: string; status?: string }

/** 平行 NPC 行：只保留与该 NPC 相关的伏笔/待办，剔除约会主角 {{char}} 动机 */
function filterParallelAnchorEntriesForNpc(
  entries: AnchorEntry[] | undefined,
  npcId: string,
  npcName: string,
): AnchorEntry[] | undefined {
  if (!entries?.length) return undefined
  const idToken = `{{id:${npcId.trim()}}}`
  const name = npcName.trim()
  const filtered = entries.filter((entry) => {
    const text = String(entry.text ?? '').trim()
    if (!text) return false
    // 平行切片内约会主角未在场：以 {{char}} 为主体的条目不进 NPC 关联行
    if (text.includes('{{char}}')) return false
    return (
      (idToken.length > 8 && text.includes(idToken)) || (name.length >= 2 && text.includes(name))
    )
  })
  return filtered.length ? filtered.slice(0, 8) : undefined
}

/** 在 API delta 上叠加平行行边界；保留 row_title 等字段，与主线摘要表一致 */
function buildParallelTimelineRowDelta(
  baseDelta: StoryTimelineSummaryDelta | undefined,
  overrides: {
    sidePerspective: boolean
    charactersPresent?: string[]
    eventSummaryPrefix: string
    fallbackEventSummary: string
    /** 在场 NPC 行：只保留与该 id 相关的 foreshadows / todos */
    npcId?: string
    npcName?: string
  },
): StoryTimelineSummaryDelta {
  const summaryCore = baseDelta?.event_summary?.trim()
  const event_summary = tagEventSummary(
    overrides.eventSummaryPrefix,
    summaryCore ||
      (hasTimelineDeltaContent(baseDelta ?? {})
        ? '屏外同步切片已记录。'
        : overrides.fallbackEventSummary),
  )
  const present =
    overrides.charactersPresent?.length
      ? overrides.charactersPresent
      : baseDelta?.characters_present

  const delta: StoryTimelineSummaryDelta = {
    ...(baseDelta ?? {}),
    ...(normalizeStoryTimelineRowTitle(baseDelta?.row_title)
      ? { row_title: normalizeStoryTimelineRowTitle(baseDelta?.row_title) }
      : {}),
    side_perspective: overrides.sidePerspective,
    ...(present?.length ? { characters_present: present } : {}),
    event_summary,
  }

  if (overrides.sidePerspective) {
    delete delta.foreshadows
    delete delta.todos
  } else if (overrides.npcId?.trim()) {
    delta.foreshadows = filterParallelAnchorEntriesForNpc(
      baseDelta?.foreshadows,
      overrides.npcId,
      overrides.npcName ?? '',
    )
    delta.todos = filterParallelAnchorEntriesForNpc(
      baseDelta?.todos,
      overrides.npcId,
      overrides.npcName ?? '',
    )
    if (!delta.foreshadows?.length) delete delta.foreshadows
    if (!delta.todos?.length) delete delta.todos
  }

  return delta
}

/** 在平行事件正文中匹配人脉/NPC 真实姓名 → characterId */
export async function matchNpcIdsInParallelEventText(
  parallelText: string,
  archiveOwnerId: string,
  excludeCharacterIds: string[] = [],
): Promise<Array<{ id: string; name: string }>> {
  const text = String(parallelText ?? '')
  const owner = archiveOwnerId.trim()
  if (!text.trim() || !owner) return []
  const exclude = new Set(excludeCharacterIds.map((x) => x.trim()).filter(Boolean))
  const { all } = await listAllLinkedMemoryEligibleCharacters(owner)
  const matches: Array<{ id: string; name: string }> = []
  for (const ch of all) {
    const id = String(ch.id ?? '').trim()
    if (!id || exclude.has(id)) continue
    const name = String(ch.name ?? ch.wechatNickname ?? '').trim()
    if (name.length < 2) continue
    if (text.includes(name)) matches.push({ id, name })
  }
  matches.sort((a, b) => b.name.length - a.name.length)
  const seen = new Set<string>()
  return matches.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

/** 平行正文 → 剧情摘要表结构化 delta（单独摘要 API，非粘贴原文） */
export async function resolveParallelEventSummaryDelta(params: {
  apiConfig: ApiConfigCore | null
  mainCharacterId: string
  plot: PlotItem
  anchorPlotBody?: string
  cachedDelta?: StoryTimelineSummaryDelta | null
}): Promise<StoryTimelineSummaryDelta | undefined> {
  const cached = params.cachedDelta
  if (cached && hasTimelineDeltaContent(cached)) return cached

  const parallel = params.plot.parallelEvent?.content?.trim()
  const cid = params.mainCharacterId.trim()
  if (!parallel || !cid || params.plot.type !== 'ai') return undefined

  const anchorBody =
    String(params.anchorPlotBody ?? '').trim() ||
    resolveDatingPlotDisplayFromItem(params.plot).displayBody.trim()

  return fetchStoryTimelineSummaryFallback({
    chatFallback: params.apiConfig,
    materialBlock: buildParallelEventSummaryMaterial({
      anchorPlotBody: anchorBody,
      parallelBody: parallel,
    }),
    peerCharacterId: cid,
    latestRoundBody: parallel,
    skipPriorOpenAnchors: true,
  })
}

/**
 * 平行事件 → 剧情摘要表行（结构化摘要，非原文）：
 * - 主角色：侧幕/非全知 redact 行（side_perspective，{{char}} 不在场）
 * - 平行内出场 NPC：各自 linked 行（在场、可全知本切片）
 */
export async function buildParallelEventTimelineRowsForPlot(
  mainCharacterId: string,
  plot: PlotItem,
  opts?: { apiConfig?: ApiConfigCore | null },
): Promise<StoryTimelinePlotRow[]> {
  const parallel = plot.parallelEvent?.content?.trim()
  const cid = mainCharacterId.trim()
  const plotId = plot.id.trim()
  if (!parallel || !cid || !plotId || plot.type !== 'ai') return []

  const recordedAt =
    typeof plot.timestamp === 'number' && Number.isFinite(plot.timestamp) ? plot.timestamp : Date.now()
  const npcMatches = await matchNpcIdsInParallelEventText(parallel, cid, [cid])
  const presentTokens = npcMatches.map((m) => `{{id:${m.id}}}`)

  const baseDelta = await resolveParallelEventSummaryDelta({
    apiConfig: opts?.apiConfig ?? null,
    mainCharacterId: cid,
    plot,
    cachedDelta: plot.parallelEvent?.timelineDelta,
  })

  const apiMissingFallback = '屏外同步切片已记录（摘要 API 未返回，请到剧情摘要表手动补写）。'
  const rows: StoryTimelinePlotRow[] = []

  const mainDelta = buildParallelTimelineRowDelta(baseDelta, {
    sidePerspective: true,
    charactersPresent: presentTokens.length ? presentTokens : undefined,
    eventSummaryPrefix: '【屏外平行·{{char}}未在场·非全知】与锚定轮主线同时 elsewhere；',
    fallbackEventSummary: apiMissingFallback,
  })
  const mainRow = buildStoryTimelinePlotRowFromDelta(cid, mainDelta, 'offline', {
    plotId: `${plotId}-parallel-main`,
    recordedAtMs: recordedAt + 1,
  })
  if (mainRow) rows.push(mainRow)

  for (const npc of npcMatches) {
    const npcDelta = buildParallelTimelineRowDelta(baseDelta, {
      sidePerspective: false,
      charactersPresent: [`{{id:${npc.id}}}`],
      eventSummaryPrefix: `【屏外平行·${npc.name}在场·全知本切片】与主线同步；`,
      fallbackEventSummary: '屏外同步切片已记录。',
      npcId: npc.id,
      npcName: npc.name,
    })
    const npcRow = buildStoryTimelinePlotRowFromDelta(npc.id, npcDelta, 'linked', {
      plotId: `${plotId}-parallel-npc-${npc.id}`,
      recordedAtMs: recordedAt + 2,
    })
    if (npcRow) rows.push(npcRow)
  }

  return rows
}

/** 合并进主剧情摘要行的一句标注（写在主轮 event_summary 末尾） */
export function parallelEventMainPlotSummaryFootnote(): string {
  return '【关联屏外平行】同步 elsewhere 有切片摘要；{{char}}未在场、非全知，同轮另有「屏外平行」行。'
}
