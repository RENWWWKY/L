/** 微信顶栏高度：safe-area + 标题行（≈36px）+ 底内边距（8px） */
export const WECHAT_HEADER_BODY_PX = 44

/** 通知条距屏幕顶（safe-area 下）的偏移：允许条体覆盖标题栏 */
export const GLOBAL_MESSAGE_TOAST_TOP_INSET_PX = 4

/** 通知条首行（头像+昵称）占用的顶栏区高度，使正文从标题栏下缘开始 */
export const globalMessageToastTopStyle = {
  top: `calc(max(0px, env(safe-area-inset-top, 0px)) + ${GLOBAL_MESSAGE_TOAST_TOP_INSET_PX}px)`,
} as const

/** 通知条左侧头像列宽（含呼吸边距） */
export const GLOBAL_MESSAGE_TOAST_AVATAR_COL_PX = 52
/** 头像列与文字列间距 */
export const GLOBAL_MESSAGE_TOAST_COLUMN_GAP_PX = 14

export const globalMessageToastGridStyle = {
  gridTemplateColumns: `${GLOBAL_MESSAGE_TOAST_AVATAR_COL_PX}px minmax(0, 1fr)`,
  columnGap: `${GLOBAL_MESSAGE_TOAST_COLUMN_GAP_PX}px`,
  gridTemplateRows: `${WECHAT_HEADER_BODY_PX - GLOBAL_MESSAGE_TOAST_TOP_INSET_PX}px auto`,
  minHeight: `${WECHAT_HEADER_BODY_PX + 44}px`,
} as const

/** 快捷回复悬浮舱：与通知条同顶对齐，展开后正文同样在标题栏下方 */
export const quickReplyModalTopStyle = {
  top: `calc(max(0px, env(safe-area-inset-top, 0px)) + ${GLOBAL_MESSAGE_TOAST_TOP_INSET_PX}px)`,
} as const

/** 快捷回复面板首行高度，与通知条 grid 首行一致 */
export const quickReplyModalHeaderRowStyle = {
  minHeight: `${WECHAT_HEADER_BODY_PX - GLOBAL_MESSAGE_TOAST_TOP_INSET_PX}px`,
} as const
