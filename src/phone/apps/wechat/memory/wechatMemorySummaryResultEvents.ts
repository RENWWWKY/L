import type { MemorySummaryRetryKind } from '../newFriendsPersona/types'

/** 合并自动总结（写入角色长期记忆）成功或失败时全局提示 */
export const WECHAT_MEMORY_SUMMARY_RESULT_EVENT = 'wechat-memory-summary-result'

export type WechatMemorySummaryResultDetail = {
  ok: boolean
  displayName: string
  kind: MemorySummaryRetryKind
  failureReason?: string
  modelOutput?: string
  parsedPreview?: string
}

export function dispatchWechatMemorySummaryResult(detail: WechatMemorySummaryResultDetail) {
  if (typeof window === 'undefined') return
  const displayName = detail.displayName?.trim() || '对方'
  window.dispatchEvent(
    new CustomEvent<WechatMemorySummaryResultDetail>(WECHAT_MEMORY_SUMMARY_RESULT_EVENT, {
      detail: {
        ok: detail.ok,
        displayName,
        kind: detail.kind,
        failureReason: detail.failureReason?.trim() || undefined,
        modelOutput: detail.modelOutput?.trim() || undefined,
        parsedPreview: detail.parsedPreview?.trim() || undefined,
      },
    }),
  )
}

export function memorySummaryRetryKindLabel(kind: MemorySummaryRetryKind): string {
  switch (kind) {
    case 'dating':
      return '约会剧情'
    case 'group':
      return '群聊'
    case 'meet':
      return '遇见'
    default:
      return '私聊'
  }
}
