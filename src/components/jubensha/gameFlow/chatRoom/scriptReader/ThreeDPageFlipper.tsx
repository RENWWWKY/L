import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import { CLUE_FLIP_PERSPECTIVE, CLUE_FLIP_SPRING } from '../clueCardMotion'
import {
  ScriptAnnotatablePage,
  ScriptAnnotationToolbar,
  ScriptStickyNotesOverlay,
} from './ScriptPageAnnotations'
import { ScriptPageMetricsReporter } from './ScriptPageMetricsReporter'
import { ScriptSectionTagJump } from './ScriptSectionTagJump'
import type { ScriptPage } from './scriptReaderTypes'
import type { JBSStep, ScriptSection } from '../jbsFlowTypes'

const FLIP_THRESHOLD = 0.28
const VELOCITY_THRESHOLD = 650

export type ThreeDPageFlipperProps = {
  page: ScriptPage
  /** 往前翻时底层/叶背展示的下一页（与 `canGoNext` 同时传入） */
  nextPage?: ScriptPage | null
  /** 往回翻时揭起的上一页内容（与 `canGoPrev` 同时传入） */
  prevPage?: ScriptPage | null
  paperSurfaceStyle: CSSProperties
  canGoNext: boolean
  canGoPrev: boolean
  onNext: () => void
  onPrev: () => void
  /** 启用便签粘贴与下划线/圈选（封印页自动关闭） */
  annotationsEnabled?: boolean
  /** 页角标签分幕跳转（封印页不展示） */
  scriptSections?: readonly ScriptSection[]
  allPages?: readonly ScriptPage[]
  scriptStep?: JBSStep
  scriptLoopRound?: number
  onJumpToPage?: (pageIndex: number) => void
}

function PageContent({
  page,
  bodyRef,
  sectionJump,
}: {
  page: ScriptPage
  bodyRef?: React.RefObject<HTMLParagraphElement | null>
  sectionJump?: React.ReactNode
}) {
  if (page.isLockPage) {
    return (
      <div className="flex min-h-[min(36vh,320px)] flex-col items-center justify-center gap-4">
        <div className="jbs-script-lock-seal flex flex-col items-center justify-center text-center">
          <span>SEAL</span>
        </div>
        <p className="jbs-font-serif whitespace-pre-wrap text-center text-[11px] leading-relaxed tracking-[0.18em] text-[#5c3d2e]/72">
          {page.body}
        </p>
      </div>
    )
  }

  return (
    <div className="jbs-script-page-content relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {sectionJump ?? (
        <span className="jbs-script-section-tag jbs-font-serif" aria-label={`所属：${page.sectionTag}`}>
          {page.sectionTag}
        </span>
      )}
      <div className="jbs-script-page-body-box min-h-0 flex-1 overflow-hidden">
        <p
          ref={bodyRef}
          data-script-coach="body"
          className="jbs-script-page-body jbs-font-kai select-text whitespace-pre-wrap"
        >
          {page.body}
        </p>
      </div>
    </div>
  )
}

function FlipLeaf({
  frontPage,
  backPage,
  paperSurfaceStyle,
  rotateY,
  rotateX,
  zLift,
  transformOrigin = 'left center',
}: {
  frontPage: ScriptPage
  backPage: ScriptPage
  paperSurfaceStyle: CSSProperties
  rotateY: MotionValue<number>
  rotateX: MotionValue<number>
  zLift: MotionValue<number>
  transformOrigin?: string
}) {
  return (
    <motion.div
      className="jbs-script-flip-leaf absolute inset-0"
      style={{
        rotateY,
        rotateX,
        z: zLift,
        transformOrigin,
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className="jbs-script-flip-face jbs-script-flip-face--front absolute inset-0 flex h-full flex-col overflow-hidden px-5 pb-4 pt-3"
        style={{
          ...paperSurfaceStyle,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <PageContent page={frontPage} />
      </div>
      <div
        className="jbs-script-flip-face jbs-script-flip-face--back absolute inset-0 flex h-full flex-col overflow-hidden rounded-lg px-5 pb-4 pt-3"
        style={{
          ...paperSurfaceStyle,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        <PageContent page={backPage} />
      </div>
    </motion.div>
  )
}

function AnnotatedPageShell({
  enabled,
  bodyRef,
  page,
  className,
  style,
  children,
}: {
  enabled: boolean
  bodyRef: React.RefObject<HTMLParagraphElement | null>
  page: ScriptPage
  className: string
  style?: CSSProperties
  children: ReactNode
}) {
  if (!enabled || page.isLockPage) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <div className={className} style={style}>
      <ScriptAnnotatablePage bodyRef={bodyRef}>{children}</ScriptAnnotatablePage>
    </div>
  )
}

type FlipDragMode = 'next' | 'prev'

export function ThreeDPageFlipper({
  page,
  nextPage = null,
  prevPage = null,
  paperSurfaceStyle,
  canGoNext,
  canGoPrev,
  onNext,
  onPrev,
  annotationsEnabled = false,
  scriptSections,
  allPages,
  scriptStep,
  scriptLoopRound = 0,
  onJumpToPage,
}: ThreeDPageFlipperProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const annotate = annotationsEnabled && !page.isLockPage
  const dragRef = useRef({
    active: false,
    mode: null as FlipDragMode | null,
    startX: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,
  })
  const [activeFlip, setActiveFlip] = useState<FlipDragMode | null>(null)
  const [animating, setAnimating] = useState(false)

  const nextProgress = useMotionValue(0)
  const nextRotateY = useTransform(nextProgress, [0, 1], [0, -180])
  const nextRotateX = useTransform(nextProgress, [0, 0.45, 1], [0, -12, -5])
  const nextZLift = useTransform(nextProgress, [0, 0.5, 1], [0, 28, 10])
  const nextUnderReveal = useTransform(nextProgress, [0, 0.42, 1], [0, 0.15, 1])

  /** 与下一页对称：左缘为轴，自 -180° 揭回至 0° */
  const prevProgress = useMotionValue(0)
  const prevRotateY = useTransform(prevProgress, [0, 1], [-180, 0])
  const prevRotateX = useTransform(prevProgress, [0, 0.45, 1], [0, -12, -5])
  const prevZLift = useTransform(prevProgress, [0, 0.5, 1], [0, 28, 10])
  const prevUnderReveal = useTransform(prevProgress, [0, 0.42, 1], [0, 0.15, 1])

  const flipNextEnabled = canGoNext && !!nextPage && !page.isLockPage
  const flipPrevEnabled = canGoPrev && !!prevPage
  const flipInteractive = flipNextEnabled || flipPrevEnabled

  const sectionJump =
    !page.isLockPage &&
    scriptSections?.length &&
    allPages?.length &&
    scriptStep != null &&
    onJumpToPage
      ? (
          <ScriptSectionTagJump
            currentPage={page}
            pages={allPages}
            sections={scriptSections}
            step={scriptStep}
            loopRound={scriptLoopRound}
            onJumpToPage={onJumpToPage}
          />
        )
      : undefined

  const finishFlip = useCallback(
    (
      _mode: FlipDragMode,
      progress: MotionValue<number>,
      to: number,
      onDone?: () => void,
    ) => {
      setAnimating(true)
      void animate(progress, to, {
        ...CLUE_FLIP_SPRING,
        onComplete: () => {
          setAnimating(false)
          progress.set(to)
          if (to === 0) {
            setActiveFlip(null)
          }
          onDone?.()
        },
      })
    },
    [],
  )

  const beginFlipDrag = useCallback(
    (e: React.PointerEvent, mode: FlipDragMode) => {
      if (animating) return
      const t = e.target as HTMLElement
      if (t.closest('.jbs-script-sticky-note, .jbs-script-section-tag-wrap')) return
      e.preventDefault()
      setActiveFlip(mode)
      dragRef.current = {
        active: true,
        mode,
        startX: e.clientX,
        lastX: e.clientX,
        lastT: performance.now(),
        vx: 0,
      }
      stageRef.current?.setPointerCapture(e.pointerId)
    },
    [animating],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.active || !dragRef.current.mode) return
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return
      const now = performance.now()
      const dt = Math.max(now - dragRef.current.lastT, 1)
      dragRef.current.vx = ((e.clientX - dragRef.current.lastX) / dt) * 1000
      dragRef.current.lastX = e.clientX
      dragRef.current.lastT = now

      if (dragRef.current.mode === 'next') {
        const delta = dragRef.current.startX - e.clientX
        const p = Math.max(0, Math.min(1, delta / (rect.width * 0.88)))
        nextProgress.set(p)
      } else {
        const delta = e.clientX - dragRef.current.startX
        const p = Math.max(0, Math.min(1, delta / (rect.width * 0.88)))
        prevProgress.set(p)
      }
    },
    [nextProgress, prevProgress],
  )

  const onPointerUp = useCallback(() => {
    if (!dragRef.current.active || !dragRef.current.mode) return
    const mode = dragRef.current.mode
    dragRef.current.active = false
    dragRef.current.mode = null
    const vx = dragRef.current.vx

    if (mode === 'next') {
      const p = nextProgress.get()
      const shouldFlip =
        p > FLIP_THRESHOLD || (vx < -VELOCITY_THRESHOLD && p > 0.08)
      if (shouldFlip) {
        finishFlip('next', nextProgress, 1, () => {
          nextProgress.set(0)
          setActiveFlip(null)
          onNext()
        })
      } else {
        finishFlip('next', nextProgress, 0)
      }
      return
    }

    const p = prevProgress.get()
    const shouldFlip =
      p > FLIP_THRESHOLD || (vx > VELOCITY_THRESHOLD && p > 0.08)
    if (shouldFlip) {
      finishFlip('prev', prevProgress, 1, () => {
        prevProgress.set(0)
        setActiveFlip(null)
        onPrev()
      })
    } else {
      finishFlip('prev', prevProgress, 0)
    }
  }, [finishFlip, nextProgress, onNext, onPrev, prevProgress])

  const flipToNext = useCallback(() => {
    if (!flipNextEnabled || animating) return
    setActiveFlip('next')
    finishFlip('next', nextProgress, 1, () => {
      nextProgress.set(0)
      setActiveFlip(null)
      onNext()
    })
  }, [animating, finishFlip, flipNextEnabled, nextProgress, onNext])

  const flipToPrev = useCallback(() => {
    if (!flipPrevEnabled || animating) return
    setActiveFlip('prev')
    finishFlip('prev', prevProgress, 1, () => {
      prevProgress.set(0)
      setActiveFlip(null)
      onPrev()
    })
  }, [animating, finishFlip, flipPrevEnabled, onPrev, prevProgress])

  const pageContent = (
    <PageContent
      page={page}
      bodyRef={annotate ? bodyRef : undefined}
      sectionJump={sectionJump}
    />
  )

  const pageShell = (inner: ReactNode, extraClass = '') => {
    const isFlip = extraClass.includes('--flip')
    return (
      <div
        className={`jbs-script-page relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg${isFlip ? ' absolute inset-0' : ''} ${extraClass}`}
        style={paperSurfaceStyle}
      >
        {inner}
      </div>
    )
  }

  const annotatedInner = (content: ReactNode, shellClass: string, shellStyle?: CSSProperties) =>
    pageShell(
      <>
        <AnnotatedPageShell
          enabled={annotate}
          bodyRef={bodyRef}
          page={page}
          className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-3"
          style={shellStyle}
        >
          {content}
        </AnnotatedPageShell>
        <ScriptStickyNotesOverlay />
      </>,
      shellClass,
    )

  const toolbar = annotate ? <ScriptAnnotationToolbar bodyRootRef={bodyRef} /> : null
  const metricsReporter =
    annotate && bodyRef ? <ScriptPageMetricsReporter bodyRef={bodyRef} pageId={page.id} /> : null

  if (!flipInteractive) {
    return (
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        {metricsReporter}
        <div
          className="jbs-script-flip-scene relative mx-auto min-h-0 w-full max-w-[min(100%,340px)] flex-1"
          data-script-coach="read-page"
        >
          {annotate ? annotatedInner(pageContent, '') : pageShell(pageContent)}
        </div>
        {toolbar}
        <NavBar
          pageIndex={page.index}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext && !page.isLockPage}
          animating={animating}
          onPrev={onPrev}
          onNext={flipToNext}
        />
      </div>
    )
  }

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
      {metricsReporter}
      <div
        ref={stageRef}
        className={`jbs-script-flip-scene relative mx-auto min-h-0 w-full max-w-[min(100%,340px)] flex-1${annotate ? '' : ' select-none'}`}
        data-script-coach="read-page"
        style={{ perspective: CLUE_FLIP_PERSPECTIVE }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {pageShell(
          <>
            {flipNextEnabled && nextPage ? (
              <motion.div
                className="jbs-script-page-under absolute inset-0 z-[1] flex h-full flex-col overflow-hidden px-5 pb-4 pt-3"
                style={{ ...paperSurfaceStyle, opacity: nextUnderReveal }}
                aria-hidden={activeFlip !== 'next'}
              >
                <PageContent page={nextPage} />
              </motion.div>
            ) : null}

            {flipPrevEnabled && prevPage ? (
              <motion.div
                className="jbs-script-page-under absolute inset-0 z-[1] flex h-full flex-col overflow-hidden px-5 pb-4 pt-3"
                style={{ ...paperSurfaceStyle, opacity: prevUnderReveal }}
                aria-hidden={activeFlip !== 'prev'}
              >
                <PageContent page={prevPage} />
              </motion.div>
            ) : null}

            <AnnotatedPageShell
              enabled={annotate}
              bodyRef={bodyRef}
              page={page}
              className="jbs-script-page-static relative z-[2] flex h-full min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-3"
              style={{
                visibility: activeFlip === 'next' ? 'hidden' : 'visible',
                pointerEvents: activeFlip === 'next' ? 'none' : 'auto',
              }}
            >
              <PageContent
                page={page}
                bodyRef={annotate ? bodyRef : undefined}
                sectionJump={sectionJump}
              />
            </AnnotatedPageShell>

            {annotate ? <ScriptStickyNotesOverlay /> : null}

            {activeFlip === 'next' && nextPage ? (
              <div className="absolute inset-0 z-[5]">
                <FlipLeaf
                  frontPage={page}
                  backPage={nextPage}
                  paperSurfaceStyle={paperSurfaceStyle}
                  rotateY={nextRotateY}
                  rotateX={nextRotateX}
                  zLift={nextZLift}
                  transformOrigin="left center"
                />
              </div>
            ) : null}

            {activeFlip === 'prev' && prevPage ? (
              <div className="pointer-events-none absolute inset-0 z-[3]">
                <FlipLeaf
                  frontPage={prevPage}
                  backPage={page}
                  paperSurfaceStyle={paperSurfaceStyle}
                  rotateY={prevRotateY}
                  rotateX={prevRotateX}
                  zLift={prevZLift}
                  transformOrigin="left center"
                />
              </div>
            ) : null}

            {flipPrevEnabled ? (
              <div
                className="jbs-script-flip-edge jbs-script-flip-edge--prev"
                onPointerDown={(e) => beginFlipDrag(e, 'prev')}
                aria-label="左侧揭页返回上一页"
              />
            ) : null}
            {flipNextEnabled ? (
              <div
                className="jbs-script-flip-edge jbs-script-flip-edge--next"
                onPointerDown={(e) => beginFlipDrag(e, 'next')}
                aria-label="右侧揭页进入下一页"
              />
            ) : null}

            {activeFlip === null && !animating ? (
              <>
                {flipPrevEnabled ? (
                  <div className="jbs-script-flip-hint pointer-events-none absolute bottom-3 left-4 z-[4]">
                    <span className="jbs-font-serif text-[8px] tracking-[0.2em] text-[#5c3d2e]/42">
                      按住左侧向右翻回
                    </span>
                  </div>
                ) : null}
                {flipNextEnabled ? (
                  <div className="jbs-script-flip-hint pointer-events-none absolute bottom-3 right-4 z-[4]">
                    <span className="jbs-font-serif text-[8px] tracking-[0.2em] text-[#5c3d2e]/42">
                      按住右侧向左揭页
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}
          </>,
          'jbs-script-page--flip',
        )}
      </div>

      {toolbar}
      <NavBar
        pageIndex={page.index}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        animating={animating}
        onPrev={flipPrevEnabled ? flipToPrev : onPrev}
        onNext={flipToNext}
      />
    </div>
  )
}

function NavBar({
  pageIndex,
  canGoPrev,
  canGoNext,
  animating,
  onPrev,
  onNext,
}: {
  pageIndex: number
  canGoPrev: boolean
  canGoNext: boolean
  animating: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 px-1">
      <button
        type="button"
        disabled={!canGoPrev || animating}
        onClick={onPrev}
        className="jbs-script-reader-bookmark-btn flex size-10 items-center justify-center rounded-full disabled:opacity-35"
        aria-label="上一页"
      >
        <ChevronLeft className="size-4" strokeWidth={1.25} />
      </button>
      <span className="jbs-font-serif text-[10px] tracking-[0.2em] text-[#c4a876]/80">
        {pageIndex + 1}
      </span>
      <button
        type="button"
        disabled={!canGoNext || animating}
        onClick={onNext}
        className="jbs-script-reader-bookmark-btn flex size-10 items-center justify-center rounded-full disabled:opacity-35"
        aria-label="下一页"
      >
        <ChevronRight className="size-4" strokeWidth={1.25} />
      </button>
    </div>
  )
}
