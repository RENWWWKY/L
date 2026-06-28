/** 每轮尾声延展专用判断：失败时全局 toast（无变化 / 已跳过不提示） */
export const WORLD_BOOK_AFTER_PER_ROUND_SYNC_RESULT_EVENT = 'worldbook-after-per-round-sync-result'

export type WorldBookAfterPerRoundSyncResultDetail = {
  ok: boolean
  displayName: string
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
          failureReason: detail.failureReason?.trim() || undefined,
        },
      },
    ),
  )
}
