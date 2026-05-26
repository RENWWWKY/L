import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ReadingSession } from './scriptReaderTypes'
import { MiniBookAnchor } from './MiniBookAnchor'
import { SCRIPT_PAPER_TEXTURE_URL } from './scriptReaderAssets'
import { getScriptPaperSurfaceStyle } from './scriptReaderPaperStyle'
import { SCRIPT_BOOK_LAYOUT_ID } from './scriptReaderTypes'
import type { JBSStep } from '../jbsFlowTypes'
import type { ScriptSection } from '../jbsFlowTypes'

import { ScriptAnnotationProvider } from './ScriptPageAnnotations'
import { ScriptPageBuilder } from './ScriptPageBuilder'
import { resetPageBodyMetrics } from './scriptPageMetrics'
import { SCRIPT_READER_COACH_STEPS } from './scriptReaderCoachSteps'
import {
  readScriptReaderCoachSeen,
  writeScriptReaderCoachSeen,
} from './scriptReaderCoachTypes'
import { ScriptReaderCoachPortal } from './ScriptReaderCoachPortal'
import { ScriptReaderTutorialModal } from './ScriptReaderTutorialModal'
import { SCRIPT_READER_TUTORIAL_SECTIONS } from './scriptReaderTutorialCopy'
import { ThreeDPageFlipper } from './ThreeDPageFlipper'

import './script-reader.css'

const SCRIPT_COACH_SCOPE = 'script-reader'

export type ScriptInteractiveReaderProps = {
  session: ReadingSession
  roleName: string
  scriptId: string
  roleId: string
  scriptSections: readonly ScriptSection[]
  currentStep: JBSStep
  loopRound: number
  onPagesBuilt: (pages: import('./scriptReaderTypes').ScriptPage[]) => void
  onCollapse: () => void
  onRestore: () => void
  onPageChange: (page: number) => void
}

export function ScriptInteractiveReader({
  session,
  roleName,
  scriptId,
  roleId,
  scriptSections,
  currentStep,
  loopRound,
  onPagesBuilt,
  onCollapse,
  onRestore,
  onPageChange,
}: ScriptInteractiveReaderProps) {
  const { pages, currentPage, isOpen, isMinimized } = session
  const page = pages[currentPage]

  const canGoPrev = currentPage > 0
  const canGoNext = currentPage < session.allowedMaxPage

  const paperSurfaceStyle = useMemo(
    () => getScriptPaperSurfaceStyle(SCRIPT_PAPER_TEXTURE_URL),
    [],
  )

  const shellRef = useRef<HTMLDivElement>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback((opts?: { openTutorial?: boolean }) => {
    setCoachOpen(false)
    writeScriptReaderCoachSeen()
    if (opts?.openTutorial) setTutorialOpen(true)
  }, [])

  const skipCoach = useCallback(() => {
    setCoachOpen(false)
    writeScriptReaderCoachSeen()
  }, [])

  useEffect(() => {
    if (!isOpen || isMinimized || !page || page.isLockPage) return
    if (readScriptReaderCoachSeen()) return
    const id = window.setTimeout(() => startLiveCoach(), 960)
    return () => window.clearTimeout(id)
  }, [isOpen, isMinimized, page?.id, page?.isLockPage, startLiveCoach])

  useEffect(() => {
    if (isOpen && !isMinimized) return
    resetPageBodyMetrics()
  }, [isOpen, isMinimized])

  useEffect(() => {
    if (!isOpen || isMinimized) return
    const t = window.setTimeout(() => {
      shellRef.current
        ?.querySelector<HTMLElement>('.jbs-script-annotate-layer')
        ?.focus({ preventScroll: true })
    }, 120)
    return () => window.clearTimeout(t)
  }, [isOpen, isMinimized, currentPage, page?.id])

  const handleCoverOpenComplete = useCallback(() => {
    /* 封面翻开由 layout 动画完成，内页由 isOpen 控制 */
  }, [])

  if (isMinimized) {
    return <MiniBookAnchor onRestore={onRestore} />
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="jbs-script-reader-scrim fixed inset-0 z-[85] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            ref={shellRef}
            layoutId={SCRIPT_BOOK_LAYOUT_ID}
            data-script-coach-root={SCRIPT_COACH_SCOPE}
            className="jbs-script-reader-shell mx-auto mt-[max(12px,env(safe-area-inset-top))] flex min-h-0 w-full max-w-lg flex-1 flex-col rounded-t-2xl px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            onAnimationComplete={handleCoverOpenComplete}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[#c4a876]/20 pb-3">
              <div>
                <p className="jbs-script-book-tag">READING PHASE</p>
                <p className="jbs-font-handwriting mt-1 text-[16px] text-[#e8e0d0]/92">
                  {roleName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  data-script-coach="header-tutorial"
                  onClick={() => setTutorialOpen(true)}
                  className="jbs-script-tutorial-btn jbs-font-serif flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] tracking-[0.12em]"
                  aria-label="正文标注教程"
                >
                  <BookOpen className="size-3.5" strokeWidth={1.5} aria-hidden />
                  教程
                </button>
                <button
                  type="button"
                  onClick={onCollapse}
                  className="jbs-script-collapse-btn jbs-font-serif flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] tracking-[0.12em]"
                  aria-label="收起剧本"
                >
                  <ChevronDown className="size-3.5" strokeWidth={1.5} />
                  收起剧本
                </button>
              </div>
            </header>

            <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 grid-rows-1">
              <ScriptPageBuilder
                sections={scriptSections}
                step={currentStep}
                loopRound={loopRound}
                onPagesBuilt={onPagesBuilt}
              />
              <div className="col-start-1 row-start-1 flex min-h-0 flex-col">
                {page ? (
                  <ScriptAnnotationProvider
                    key={page.id}
                    scriptId={scriptId}
                    roleId={roleId}
                    pageId={page.id}
                  >
                    <ThreeDPageFlipper
                      page={page}
                      nextPage={canGoNext ? pages[currentPage + 1] : null}
                      prevPage={canGoPrev ? pages[currentPage - 1] : null}
                      paperSurfaceStyle={paperSurfaceStyle}
                      canGoPrev={canGoPrev}
                      canGoNext={canGoNext}
                      annotationsEnabled
                      scriptSections={scriptSections}
                      allPages={pages}
                      scriptStep={currentStep}
                      scriptLoopRound={loopRound}
                      onJumpToPage={onPageChange}
                      onPrev={() => onPageChange(currentPage - 1)}
                      onNext={() => onPageChange(currentPage + 1)}
                    />
                  </ScriptAnnotationProvider>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                    <p className="jbs-font-serif text-[11px] tracking-[0.14em] text-[#c4a876]/45">
                      正在排版剧本…
                    </p>
                  </div>
                )}
              </div>
            </div>

            <ScriptReaderTutorialModal
              open={tutorialOpen}
              onClose={() => setTutorialOpen(false)}
              sections={SCRIPT_READER_TUTORIAL_SECTIONS}
              onStartLiveCoach={page && !page.isLockPage ? startLiveCoach : undefined}
            />
            <ScriptReaderCoachPortal
              open={coachOpen && !!page && !page.isLockPage}
              steps={SCRIPT_READER_COACH_STEPS}
              stepIndex={coachStepIndex}
              onStepChange={setCoachStepIndex}
              onSkip={skipCoach}
              onComplete={finishCoach}
              scopeRoot={SCRIPT_COACH_SCOPE}
              layoutEpoch={`${page?.id ?? ''}-${coachStepIndex}`}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
