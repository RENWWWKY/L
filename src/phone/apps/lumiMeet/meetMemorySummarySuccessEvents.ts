/** 遇见 / 合并记忆自动总结成功时全局提示（与 UI 组件分文件，避免 Vite 解析到 .ts/.tsx 冲突） */
export const MEET_MEMORY_SUMMARY_SUCCESS_EVENT = 'meet-memory-summary-success'

export type MeetMemorySummarySuccessDetail = {
  characterName: string
}

export function dispatchMeetMemorySummarySuccess(detail: MeetMemorySummarySuccessDetail) {
  if (typeof window === 'undefined') return
  const name = detail.characterName.trim() || '对方'
  window.dispatchEvent(
    new CustomEvent<MeetMemorySummarySuccessDetail>(MEET_MEMORY_SUMMARY_SUCCESS_EVENT, {
      detail: { characterName: name },
    }),
  )
}
