import type { ApiConfig } from '../../api/types'
import { personaDb } from '../newFriendsPersona/idb'
import { gatherLatestRoundBodyForEpilogue } from './memoryEpilogueArchive'
import { resolveTimelineSummaryApiConfig } from './memoryTimelineSummaryApi'
import { persistStoryTimelineFromSummaryDelta } from './storyTimelinePersist'
import {
  buildDatingStoryTimelineFallbackMaterial,
  fetchStoryTimelineSummaryFallback,
  type StoryTimelineSummaryFallbackParams,
} from './storyTimelineSummaryFallback'
import { dispatchStoryTimelinePerRoundSyncResult } from './storyTimelinePerRoundResultEvents'
import {
  hasTimelineDeltaContent,
  type StoryTimelineEventScope,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

export async function resolveStoryTimelinePerRoundFailureReason(
  chatFallback: ApiConfig | null,
): Promise<string> {
  const api = await resolveTimelineSummaryApiConfig(chatFallback)
  if (!api?.apiUrl?.trim() || !api.apiKey?.trim() || !api.modelId?.trim()) {
    return '未配置剧情摘要 API（记忆设置 · 剧情摘要表）'
  }
  return '模型未返回有效剧情摘要'
}

function notifyStoryTimelinePerRoundFailure(
  displayName: string,
  chatFallback: ApiConfig | null,
  failureReason?: string,
) {
  void resolveStoryTimelinePerRoundFailureReason(chatFallback).then((defaultReason) => {
    dispatchStoryTimelinePerRoundSyncResult({
      ok: false,
      displayName,
      failureReason: failureReason?.trim() || defaultReason,
    })
  })
}

/**
 * 同轮 inline 未产出有效 timeline 时，额外请求一次单独摘要 API。
 * 不写入库，仅返回 delta（约会剧情气泡落库 / rebuild 用）。
 */
export async function resolveStoryTimelineDeltaWithSeparateAttempt(params: {
  chatFallback: ApiConfig | null
  inlineDelta?: StoryTimelineSummaryDelta | null
  fallback: Omit<StoryTimelineSummaryFallbackParams, 'chatFallback'>
  displayName: string
  notifyOnFailure?: boolean
}): Promise<StoryTimelineSummaryDelta | undefined> {
  const inline = params.inlineDelta
  if (inline && hasTimelineDeltaContent(inline)) return inline

  const separate = await fetchStoryTimelineSummaryFallback({
    chatFallback: params.chatFallback,
    ...params.fallback,
  })
  if (separate && hasTimelineDeltaContent(separate)) return separate

  if (params.notifyOnFailure) {
    notifyStoryTimelinePerRoundFailure(params.displayName, params.chatFallback)
  }
  return undefined
}

/** 写入剧情摘要表：inline 失败后再单独请求一次；仍失败可 toast */
export async function writePerRoundStoryTimelineWithSeparateAttempt(params: {
  chatFallback: ApiConfig | null
  characterId: string
  displayName: string
  timelineScope: StoryTimelineEventScope
  inlineDelta?: StoryTimelineSummaryDelta | null
  fallback: Omit<StoryTimelineSummaryFallbackParams, 'chatFallback'>
  persistOpts?: { plotId?: string | null; recordedAtMs?: number }
  advanceCursors?: () => Promise<void>
  notifyOnFailure?: boolean
}): Promise<boolean> {
  const cid = params.characterId.trim()
  if (!cid) return false

  const delta = await resolveStoryTimelineDeltaWithSeparateAttempt({
    chatFallback: params.chatFallback,
    inlineDelta: params.inlineDelta,
    fallback: params.fallback,
    displayName: params.displayName,
    notifyOnFailure: false,
  })

  if (!delta || !hasTimelineDeltaContent(delta)) {
    if (params.notifyOnFailure) {
      notifyStoryTimelinePerRoundFailure(params.displayName, params.chatFallback)
    }
    return false
  }

  await persistStoryTimelineFromSummaryDelta(cid, delta, params.timelineScope, params.persistOpts)
  if (params.advanceCursors) await params.advanceCursors()
  return true
}

/** 档案馆手动补写：粘贴本轮正文后单独请求摘要并落库 */
export async function runManualStoryTimelineSummary(params: {
  apiConfig: ApiConfig | null
  characterId: string
  latestRoundBody?: string
  displayName?: string
  timelineScope?: StoryTimelineEventScope
}): Promise<{ status: 'applied' | 'failed' | 'skipped'; reason?: string }> {
  const cid = params.characterId.trim()
  if (!cid) return { status: 'failed', reason: '无效角色' }
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return { status: 'failed', reason: '角色不存在' }

  let body = String(params.latestRoundBody ?? '').trim()
  if (body.length < 8) {
    body = await gatherLatestRoundBodyForEpilogue(cid)
  }
  if (body.length < 8) {
    return { status: 'failed', reason: '请粘贴至少一轮剧情 / 回复正文（8 字以上）' }
  }

  const scope = params.timelineScope ?? 'private'
  const displayName =
    params.displayName?.trim() || ch.name?.trim() || ch.wechatNickname?.trim() || '角色'

  const written = await writePerRoundStoryTimelineWithSeparateAttempt({
    chatFallback: params.apiConfig,
    characterId: cid,
    displayName,
    timelineScope: scope,
    fallback: {
      materialBlock: buildDatingStoryTimelineFallbackMaterial({ plotBody: body }),
      peerCharacterId: cid,
      latestRoundBody: body,
    },
    notifyOnFailure: false,
  })

  if (!written) {
    const reason = await resolveStoryTimelinePerRoundFailureReason(params.apiConfig)
    return { status: 'failed', reason }
  }
  return { status: 'applied' }
}
