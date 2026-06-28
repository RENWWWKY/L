import type { ApiConfig } from '../../api/types'
import { requestStoryTimelineSummaryOnly } from '../wechatChatAi'
import { resolveTimelineSummaryApiConfig } from './memoryTimelineSummaryApi'
import {
  hasTimelineDeltaContent,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

export type StoryTimelineSummaryFallbackParams = {
  chatFallback: ApiConfig | null
  materialBlock: string
  peerCharacterId?: string
  latestRoundBody?: string
  storyTimeHintMs?: number | null
}

/** 模型未输出 timeline 时，用摘要表接口（或聊天主接口）单独补写增量 */
export async function fetchStoryTimelineSummaryFallback(
  params: StoryTimelineSummaryFallbackParams,
): Promise<StoryTimelineSummaryDelta | undefined> {
  const api = await resolveTimelineSummaryApiConfig(params.chatFallback)
  if (!api?.apiUrl?.trim() || !api.apiKey?.trim() || !api.modelId?.trim()) return undefined
  const material = String(params.materialBlock || '').trim()
  const latest = String(params.latestRoundBody || '').trim()
  if (!material && !latest) return undefined
  try {
    const delta = await requestStoryTimelineSummaryOnly({
      apiConfig: api,
      materialBlock: material,
      peerCharacterId: params.peerCharacterId,
      latestRoundBody: latest,
      storyTimeHintMs: params.storyTimeHintMs,
    })
    return delta && hasTimelineDeltaContent(delta) ? delta : undefined
  } catch (e) {
    console.warn('[memory] story timeline summary fallback failed', e)
    return undefined
  }
}

export function buildDatingStoryTimelineFallbackMaterial(params: {
  offlineBlock?: string
  plotBody?: string
}): string {
  const parts: string[] = []
  const offline = String(params.offlineBlock || '').trim()
  const plot = String(params.plotBody || '').trim()
  if (offline) parts.push(`【线下剧情摘录】\n${offline}`)
  if (plot) parts.push(`【本轮剧情正文】\n${plot}`)
  return parts.join('\n\n')
}

export function buildUnifiedStoryTimelineFallbackMaterial(params: {
  onlineBlock?: string
  offlineBlock?: string
  npcLinkedBlock?: string
  meetBlock?: string
}): string {
  const parts: string[] = []
  const online = String(params.onlineBlock || '').trim()
  const meet = String(params.meetBlock || '').trim()
  const offline = String(params.offlineBlock || '').trim()
  const npc = String(params.npcLinkedBlock || '').trim()
  if (online) parts.push(`【微信私聊摘录】\n${online}`)
  if (meet) parts.push(`【遇见会话摘录】\n${meet}`)
  if (offline) parts.push(`【线下约会剧情摘录】\n${offline}`)
  if (npc) parts.push(`【人脉 NPC 关联摘录】\n${npc}`)
  return parts.join('\n\n')
}
