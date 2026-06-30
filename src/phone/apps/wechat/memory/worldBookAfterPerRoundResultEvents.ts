/** 每轮尾声延展专用判断：失败 / 线下无变化时全局 toast（已跳过不提示） */
export const WORLD_BOOK_AFTER_PER_ROUND_SYNC_RESULT_EVENT = 'worldbook-after-per-round-sync-result'

export type WorldBookAfterPerRoundSyncResultKind = 'failed' | 'no_change'

export type WorldBookAfterPerRoundSyncResultDetail = {
  ok: boolean
  displayName: string
  kind?: WorldBookAfterPerRoundSyncResultKind
  failureReason?: string
}

export function dispatchWorldBookAfterPerRoundSyncResult(
  detail: WorldBookAfterPerRoundSyncResultDetail,
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<WorldBookAfterPerRoundSyncResultDetail>(
      WORLD_BOOK_AFTER_PER_ROUND_SYNC_RESULT_EVENT,
      {
        detail: {
          ok: detail.ok === true,
          displayName: detail.displayName?.trim() || '角色',
          kind: detail.kind === 'no_change' ? 'no_change' : detail.kind === 'failed' ? 'failed' : undefined,
          failureReason: detail.failureReason?.trim() || undefined,
        },
      },
    ),
  )
}
