/** 每轮剧情摘要表：单独补救失败时全局 toast（成功 / 无正文不提示） */
export const STORY_TIMELINE_PER_ROUND_SYNC_RESULT_EVENT = 'story-timeline-per-round-sync-result'

export type StoryTimelinePerRoundSyncResultDetail = {
  ok: boolean
  displayName: string
  failureReason?: string
}

export function dispatchStoryTimelinePerRoundSyncResult(
  detail: StoryTimelinePerRoundSyncResultDetail,
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<StoryTimelinePerRoundSyncResultDetail>(
      STORY_TIMELINE_PER_ROUND_SYNC_RESULT_EVENT,
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
