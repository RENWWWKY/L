import {
  isScriptSectionUnlocked,
  type JBSStep,
  type ScriptSection,
  type ScriptSectionId,
} from '../jbsFlowTypes'

import { paginateBodyExact } from './scriptPagePaginator'
import { getPageBodyMetrics, isValidPageBodyMetrics } from './scriptPageMetrics'
import { resolveSectionTag } from './scriptSectionTag'
import { LOCK_PAGE_BODY, type ReadingSession, type ScriptPage } from './scriptReaderTypes'

function paginateBody(section: ScriptSection): string[] {
  const metrics = getPageBodyMetrics()
  if (!isValidPageBodyMetrics(metrics)) return []
  return paginateBodyExact(section.body, metrics)
}

function hasLockedSectionsAhead(
  sections: readonly ScriptSection[],
  step: JBSStep,
  loopRound: number,
): boolean {
  return sections.some((s) => !isScriptSectionUnlocked(s.id, step, loopRound))
}

/** 按当前进程生成可翻页列表（须先由阅读器探针写入 metrics） */
export function buildScriptPages(
  sections: readonly ScriptSection[],
  step: JBSStep,
  loopRound: number,
): ScriptPage[] {
  const pages: ScriptPage[] = []
  let index = 0

  for (const section of sections) {
    if (!isScriptSectionUnlocked(section.id, step, loopRound)) continue
    const sectionTag = resolveSectionTag(section.id, section.title)
    const chunks = paginateBody(section)
    if (chunks.length === 0) continue
    chunks.forEach((body, i) => {
      pages.push({
        id: `${section.id}-${i}`,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionTag,
        body,
        index: index++,
      })
    })
  }

  if (hasLockedSectionsAhead(sections, step, loopRound)) {
    pages.push({
      id: 'locked-seal',
      sectionId: 'locked',
      sectionTitle: '未解封',
      sectionTag: resolveSectionTag('locked', '未解封'),
      body: LOCK_PAGE_BODY,
      index: index++,
      isLockPage: true,
    })
  }

  return pages.map((p, i) => ({ ...p, index: i }))
}

/** 跳转到某分幕时使用的首页索引；未解锁或无页时返回 -1 */
export function findFirstPageIndexForSection(
  pages: readonly ScriptPage[],
  sectionId: ScriptSectionId,
): number {
  return pages.findIndex((p) => p.sectionId === sectionId && !p.isLockPage)
}

export function lastReadablePageIndex(pages: readonly ScriptPage[]): number {
  let last = 0
  for (const p of pages) {
    if (!p.isLockPage) last = p.index
  }
  return last
}

export function canMarkScriptReadingFinished(
  session: Pick<ReadingSession, 'pages' | 'currentPage' | 'hasFinishedPhase' | 'bookDelivered'>,
): boolean {
  if (session.hasFinishedPhase || !session.bookDelivered) return false
  const page = session.pages[session.currentPage]
  if (!page || page.isLockPage) return false
  return session.currentPage === lastReadablePageIndex(session.pages)
}
