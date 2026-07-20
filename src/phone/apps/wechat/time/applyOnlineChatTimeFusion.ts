import { loadDatingPlotsFromKv } from '../unifiedMemoryAutoSummary'
import { resolveStoryCalendarAnchorFromPlots } from '../memory/storyTimelineCalendarContext'
import {
  composeStoryTimelineCalendarAnchorLabel,
  createEmptyStoryTimelineState,
  formatGregorianStoryDayFromMs,
  parseStoryCalendarDayStartMs,
  type StoryTimelineState,
} from '../memory/storyTimelineTypes'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatTimeConfig } from '../newFriendsPersona/types'
import { normalizeWeChatTimeConfig } from './wechatTimeUtils'

export type StoryTimeFloorInfo = {
  /** 用户可见剧情锚点文案 */
  label: string
  /** 不可早于该毫秒（含钟点；无钟点则为当日 0 点） */
  floorMs: number | null
  hasFloor: boolean
}

/**
 * 自定义时钟是否已落在「剧情锚点往后」的故事日历上。
 * 系统墙钟（如真实 2026）即使数值大于剧情日（如 2025 夜），也不算对齐。
 */
export function isWeChatClockAlignedWithStoryFloor(
  liveMs: number,
  floorMs: number,
  mode: WeChatTimeConfig['mode'],
): boolean {
  if (mode !== 'custom') return false
  if (!Number.isFinite(liveMs) || !Number.isFinite(floorMs) || liveMs < floorMs) return false
  const floorY = new Date(floorMs).getFullYear()
  const liveY = new Date(liveMs).getFullYear()
  if (liveY === floorY) return true
  // 允许跨年推进（如年末→次日清晨），但限制在锚点后 180 天内
  if (liveY === floorY + 1 && liveMs - floorMs <= 180 * 86_400_000) return true
  return false
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** 墙钟毫秒 → 剧情时段 HH:mm */
export function formatStoryTimeClockFromMs(ms: number): string {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 从「2025年10月1日 … 22:30」类锚点解析毫秒（优先区间末段；含钟点） */
export function parseStoryAnchorLabelToMs(anchor: string | null | undefined): number | null {
  const raw = String(anchor ?? '').trim()
  if (!raw) return null
  const segments = raw.split(/\s*-\s*/)
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]!.trim()
    const dayPart = seg.match(/^(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1]
    if (!dayPart) continue
    const dayMs = parseStoryCalendarDayStartMs(dayPart)
    if (dayMs == null) continue
    const clock = seg.match(/(\d{1,2}):(\d{2})/)
    if (!clock) return dayMs
    const h = Math.min(23, Math.max(0, Number(clock[1])))
    const m = Math.min(59, Math.max(0, Number(clock[2])))
    return dayMs + h * 3_600_000 + m * 60_000
  }
  return null
}

function labelFromState(state: StoryTimelineState | null | undefined): string {
  if (!state) return ''
  return composeStoryTimelineCalendarAnchorLabel({
    story_day: state.currentStoryDay,
    story_time: state.currentStoryTime,
  }).trim()
}

/** 解析角色当前剧情时间下限（state 优先，否则线下 plot 锚点） */
export async function resolveCharacterStoryTimeFloor(characterId: string): Promise<StoryTimeFloorInfo> {
  const cid = characterId.trim()
  if (!cid) return { label: '', floorMs: null, hasFloor: false }

  const state = await personaDb.getStoryTimelineState(cid)
  const stateLabel = labelFromState(state)
  if (stateLabel) {
    const floorMs = parseStoryAnchorLabelToMs(stateLabel)
    if (floorMs != null) {
      return { label: stateLabel, floorMs, hasFloor: true }
    }
  }

  try {
    const plots = await loadDatingPlotsFromKv(cid)
    const plotLabel = resolveStoryCalendarAnchorFromPlots(
      plots.map((p) => ({
        type: p.type,
        timelineDelta: p.type === 'ai' ? p.timelineDelta : undefined,
        timelineSnapshot: p.timelineSnapshot,
      })),
    ).trim()
    if (plotLabel) {
      const floorMs = parseStoryAnchorLabelToMs(plotLabel)
      return {
        label: plotLabel,
        floorMs,
        hasFloor: floorMs != null || Boolean(plotLabel),
      }
    }
  } catch {
    // ignore plot load failures
  }

  if (state?.currentStoryDay?.trim() || state?.currentStoryTime?.trim()) {
    const fallback = [state.currentStoryDay?.trim(), state.currentStoryTime?.trim()].filter(Boolean).join(' ')
    return { label: fallback, floorMs: parseStoryAnchorLabelToMs(fallback), hasFloor: true }
  }

  return { label: '', floorMs: null, hasFloor: false }
}

export type ApplyOnlineChatTimeFusionParams = {
  characterId: string
  /** 设定的线上/故事「现在」墙钟毫秒 */
  chosenTimeMs: number
  timeMultiplier: number
  /**
   * 无剧情锚点时保留用户对「时间感知」的选择；
   * 有剧情锚点时强制 true。
   */
  timePerceptionEnabled?: boolean
  /** 无剧情锚点时是否允许 system 模式；有锚点时强制 custom */
  mode?: WeChatTimeConfig['mode']
}

/**
 * 保存线上时间设置。
 * - 有剧情锚点：强制 custom + 时间感知开；两边一起推（时钟 + storyTimelineState）；chosen 不得早于 floor。
 * - 无剧情锚点：仅写角色时钟设置（与旧版一致），不改剧情轴。
 */
export async function applyOnlineChatTimeFusion(
  params: ApplyOnlineChatTimeFusionParams,
): Promise<{ clamped: boolean; chosenTimeMs: number; storyLabel: string; advancedStory: boolean }> {
  const cid = params.characterId.trim()
  if (!cid) throw new Error('missing_character_id')

  const floor = await resolveCharacterStoryTimeFloor(cid)
  let chosen = Math.round(params.chosenTimeMs)
  if (!Number.isFinite(chosen) || chosen <= 0) chosen = Date.now()
  let clamped = false
  if (floor.floorMs != null && chosen < floor.floorMs) {
    chosen = floor.floorMs
    clamped = true
  }

  const hasFloor = floor.hasFloor && floor.floorMs != null
  const mode: WeChatTimeConfig['mode'] = hasFloor ? 'custom' : params.mode === 'system' ? 'system' : 'custom'
  const perception = hasFloor ? true : params.timePerceptionEnabled !== false
  const now = Date.now()
  const config = normalizeWeChatTimeConfig({
    mode,
    customBaseTime: mode === 'custom' ? chosen : now,
    customAnchorRealTime: now,
    timeMultiplier: params.timeMultiplier,
  })

  await personaDb.putCharacterTimeSettings({
    characterId: cid,
    config,
    timePerceptionEnabled: perception,
  })

  if (!hasFloor) {
    return { clamped, chosenTimeMs: chosen, storyLabel: floor.label, advancedStory: false }
  }

  const storyDay = formatGregorianStoryDayFromMs(chosen)
  const storyTime = formatStoryTimeClockFromMs(chosen)
  const prev = (await personaDb.getStoryTimelineState(cid)) ?? createEmptyStoryTimelineState(cid)
  const next: StoryTimelineState = {
    ...prev,
    characterId: cid,
    updatedAt: now,
    currentStoryDay: storyDay,
    currentStoryTime: storyTime,
    todos: [],
  }
  await personaDb.putStoryTimelineState(next)

  const storyLabel = composeStoryTimelineCalendarAnchorLabel({
    story_day: storyDay,
    story_time: storyTime,
  })

  return { clamped, chosenTimeMs: chosen, storyLabel, advancedStory: true }
}

/**
 * 将剧情轴「现在」与线上流动时钟对齐（仅前进、不早于剧情锚点）。
 * - 无剧情锚点 / 非 custom / 时间感知关 / 墙钟未落在故事日历上：不写库。
 * - 供私聊 AI 注入、控制台展示等在「时钟已流逝但未点保存」时补同步。
 */
export async function syncStoryTimelineNowFromOnlineClock(params: {
  characterId: string
  liveTimeMs: number
}): Promise<{ storyLabel: string; synced: boolean }> {
  const cid = params.characterId.trim()
  if (!cid) return { storyLabel: '', synced: false }

  const live = Math.round(params.liveTimeMs)
  if (!Number.isFinite(live) || live <= 0) return { storyLabel: '', synced: false }

  const floor = await resolveCharacterStoryTimeFloor(cid)
  if (!floor.hasFloor || floor.floorMs == null) {
    return { storyLabel: floor.label, synced: false }
  }

  const settings = await personaDb.getCharacterTimeSettings(cid)
  const mode = settings?.config?.mode ?? 'system'
  if (mode !== 'custom' || settings?.timePerceptionEnabled === false) {
    return { storyLabel: floor.label, synced: false }
  }

  let chosen = live
  if (chosen < floor.floorMs) chosen = floor.floorMs

  if (!isWeChatClockAlignedWithStoryFloor(chosen, floor.floorMs, 'custom')) {
    return { storyLabel: floor.label, synced: false }
  }

  const storyDay = formatGregorianStoryDayFromMs(chosen)
  const storyTime = formatStoryTimeClockFromMs(chosen)
  const storyLabel = composeStoryTimelineCalendarAnchorLabel({
    story_day: storyDay,
    story_time: storyTime,
  })

  const prev = (await personaDb.getStoryTimelineState(cid)) ?? createEmptyStoryTimelineState(cid)
  const prevDay = prev.currentStoryDay?.trim() || ''
  const prevTime = prev.currentStoryTime?.trim() || ''
  if (prevDay === storyDay && prevTime === storyTime) {
    return { storyLabel, synced: false }
  }

  const next: StoryTimelineState = {
    ...prev,
    characterId: cid,
    updatedAt: Date.now(),
    currentStoryDay: storyDay,
    currentStoryTime: storyTime,
    todos: [],
  }
  await personaDb.putStoryTimelineState(next)
  return { storyLabel, synced: true }
}
