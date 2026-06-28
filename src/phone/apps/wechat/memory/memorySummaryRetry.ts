import type { ApiConfig } from '../../api/types'
import { personaDb } from '../newFriendsPersona/idb'
import type { MemorySummaryRetryItem } from '../newFriendsPersona/types'
import {
  runGroupChatMemorySummaryAfterThreshold,
  runUnifiedAutoMemorySummaryAfterThreshold,
} from '../unifiedMemoryAutoSummary'
import {
  dispatchWechatMemorySummaryResult,
  memorySummaryRetryKindLabel,
} from './wechatMemorySummaryResultEvents'

export type MemorySummaryNotifyContext = {
  conversationKey: string
  characterId: string
  displayName: string
  kind: MemorySummaryRetryItem['kind']
  groupId?: string
  sessionPlayerIdentityId?: string
  wechatAccountId?: string
  datingAiPlotId?: string
}

export async function notifyMemorySummaryAttempt(
  params: MemorySummaryNotifyContext & {
    ok: boolean
    primaryWritten: boolean
    failureReason?: string
    suppressNotify?: boolean
  },
): Promise<void> {
  if (params.suppressNotify) return
  const ck = params.conversationKey.trim()
  const displayName = params.displayName.trim() || '对方'
  const succeeded = params.ok && params.primaryWritten

  if (succeeded) {
    await personaDb.clearMemorySummaryRetry(ck)
    dispatchWechatMemorySummaryResult({
      ok: true,
      displayName,
      kind: params.kind,
    })
    return
  }

  const reason =
    params.failureReason?.trim() ||
    (params.primaryWritten ? '总结未完整写入' : '总结未写入长期记忆')

  await personaDb.enqueueMemorySummaryRetry({
    conversationKey: ck,
    characterId: params.characterId.trim(),
    displayName,
    kind: params.kind,
    groupId: params.groupId,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId,
    wechatAccountId: params.wechatAccountId,
    datingAiPlotId: params.datingAiPlotId,
    failureReason: reason,
  })

  dispatchWechatMemorySummaryResult({
    ok: false,
    displayName,
    kind: params.kind,
    failureReason: reason,
  })
}

export async function retryMemorySummaryItem(
  item: MemorySummaryRetryItem,
  apiConfig: ApiConfig | null,
): Promise<{ ok: boolean; primaryWritten: boolean }> {
  const ck = item.conversationKey.trim()
  if (!ck) return { ok: false, primaryWritten: false }

  if (item.kind === 'group' && item.groupId?.trim()) {
    const result = await runGroupChatMemorySummaryAfterThreshold({
      apiConfig,
      conversationKey: ck,
      groupId: item.groupId.trim(),
      playerIdentityId: item.sessionPlayerIdentityId?.trim() || '',
      isManualRetry: true,
    })
    return { ok: result.ok, primaryWritten: result.primaryWritten }
  }

  const result = await runUnifiedAutoMemorySummaryAfterThreshold({
    apiConfig,
    conversationKey: ck,
    characterId: item.characterId,
    characterRealName: item.displayName,
    sessionPlayerIdentityId: item.sessionPlayerIdentityId ?? null,
    wechatAccountId: item.wechatAccountId ?? null,
    datingAiPlotId: item.datingAiPlotId ?? null,
    skipConversationRoundBump: true,
    aiRoundCountChannel: item.kind === 'meet' ? 'meet' : 'wechat',
    summaryNotifyKind: item.kind,
    isManualRetry: true,
  })
  return { ok: result.ok, primaryWritten: result.primaryWritten }
}

export function formatMemorySummaryRetrySubtitle(item: MemorySummaryRetryItem): string {
  const kind = memorySummaryRetryKindLabel(item.kind)
  const reason = item.failureReason?.trim()
  return reason ? `${kind} · ${reason}` : kind
}

/** 档案馆 · 线上总结进度：手动触发一次 prose 总结（不额外消耗计轮）。 */
export async function runManualMemorySummaryFromProgress(params: {
  kind: 'private' | 'group'
  apiConfig: ApiConfig | null
  conversationKey: string
  displayName: string
  characterId: string
  groupId?: string
  sessionPlayerIdentityId: string
  wechatAccountId?: string | null
}): Promise<{ ok: boolean; primaryWritten: boolean }> {
  const ck = params.conversationKey.trim()
  if (!ck) return { ok: false, primaryWritten: false }

  if (params.kind === 'group') {
    const gid = params.groupId?.trim() || params.characterId.trim()
    if (!gid) return { ok: false, primaryWritten: false }
    return runGroupChatMemorySummaryAfterThreshold({
      apiConfig: params.apiConfig,
      conversationKey: ck,
      groupId: gid,
      playerIdentityId: params.sessionPlayerIdentityId.trim(),
      isManualRetry: true,
    })
  }

  const cid = params.characterId.trim()
  if (!cid) return { ok: false, primaryWritten: false }
  return runUnifiedAutoMemorySummaryAfterThreshold({
    apiConfig: params.apiConfig,
    conversationKey: ck,
    characterId: cid,
    characterRealName: params.displayName.trim() || '对方',
    sessionPlayerIdentityId: params.sessionPlayerIdentityId.trim() || null,
    wechatAccountId: params.wechatAccountId?.trim() || null,
    skipConversationRoundBump: true,
    isManualRetry: true,
    summaryNotifyKind: 'private',
  })
}
