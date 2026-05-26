import type { ScriptSectionId } from '../jbsFlowTypes'

export type ScriptPage = {
  id: string
  sectionId: ScriptSectionId | 'locked'
  sectionTitle: string
  /** 左上角小标签文案 */
  sectionTag: string
  body: string
  /** 该页在全书中的序号（0 起） */
  index: number
  isLockPage?: boolean
}

export type ReadingSession = {
  pages: ScriptPage[]
  totalPageCount: number
  /** 可翻阅到的最大页码（含封印页） */
  allowedMaxPage: number
  currentPage: number
  isOpen: boolean
  isMinimized: boolean
  /** 当前阶段是否已点「阅读完毕」 */
  hasFinishedPhase: boolean
  /** 聊天流中是否已投递剧本卡片 */
  bookDelivered: boolean
}

export const SCRIPT_BOOK_LAYOUT_ID = 'jbs-script-book'

export const LOCK_PAGE_BODY =
  'THE FUTURE IS LOCKED\n下一幕剧本尚未解封'
