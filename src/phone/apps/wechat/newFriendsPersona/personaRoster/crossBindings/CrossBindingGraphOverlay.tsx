import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Save } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { personaDb } from '../../idb'
import { MemoryCoachPortal } from '../../../memory/MemoryCoachPortal'
import {
  PERSONA_COACH_ROOT_ATTR,
  PERSONA_COACH_TARGET_ATTR,
  PERSONA_GRAPH_COACH_SEEN_KEY,
  readPersonaCoachSeen,
  writePersonaCoachSeen,
} from '../../../memory/memoryCoachTypes'
import { PersonaTutorialButton } from '../coach/PersonaTutorialButton'
import { PersonaTutorialModal } from '../coach/PersonaTutorialModal'
import { PERSONA_GRAPH_COACH_STEPS } from '../coach/personaGraphCoachSteps'
import { PERSONA_GRAPH_TUTORIAL } from '../coach/personaGraphTutorialCopy'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import { CrossBindingGraphMode } from './CrossBindingGraphMode'
import {
  crossBindingGraphLayoutId,
  snapshotFromGraphLayoutRecord,
} from './crossBindingGraphLayout'
import { nodeKey } from './crossBindingEngine'
import type { CrossBindingGraphLayoutSnapshot, CrossBindingNode, RelationshipEdge } from './crossBindingTypes'
import type { CrossBindingStore } from './useCrossBindingStore'

export function CrossBindingGraphOverlay({
  open,
  anchor,
  store,
  onClose,
  onEditEdge,
  onCreateEdge,
}: {
  open: boolean
  anchor: CrossBindingNode | null
  store: CrossBindingStore
  onClose: () => void
  onEditEdge: (edge: RelationshipEdge, anchorId: string) => void
  onCreateEdge: (draft: RelationshipEdge, anchorId: string) => void
}) {
  const [linkEditMode, setLinkEditMode] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [graphCoachLayoutEpoch, setGraphCoachLayoutEpoch] = useState(0)
  const [initialLayout, setInitialLayout] = useState<CrossBindingGraphLayoutSnapshot | null>(null)
  const [layoutSessionKey, setLayoutSessionKey] = useState(0)
  const [layoutReady, setLayoutReady] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)

  const committedSnapshotRef = useRef<CrossBindingGraphLayoutSnapshot | null>(null)
  const currentSnapshotRef = useRef<CrossBindingGraphLayoutSnapshot | null>(null)
  const saveToastTimerRef = useRef<number | null>(null)

  const bumpGraphCoachLayout = useCallback(() => {
    setGraphCoachLayoutEpoch((v) => v + 1)
  }, [])

  const showSaveToast = useCallback((message: string) => {
    if (saveToastTimerRef.current != null) {
      window.clearTimeout(saveToastTimerRef.current)
    }
    setSaveToast(message)
    saveToastTimerRef.current = window.setTimeout(() => {
      saveToastTimerRef.current = null
      setSaveToast(null)
    }, 1600)
  }, [])

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current != null) {
        window.clearTimeout(saveToastTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setLinkEditMode(false)
      setTutorialOpen(false)
      setCoachOpen(false)
      setExitConfirmOpen(false)
      setDirty(false)
      setLayoutReady(false)
      setInitialLayout(null)
      committedSnapshotRef.current = null
      currentSnapshotRef.current = null
      return
    }
    if (!anchor) return

    let cancelled = false
    setLayoutReady(false)
    setDirty(false)

    void (async () => {
      const stored = await personaDb.getCrossBindingGraphLayout(anchor.type, anchor.id)
      if (cancelled) return
      const snapshot = stored ? snapshotFromGraphLayoutRecord(stored) : null
      committedSnapshotRef.current = snapshot
      currentSnapshotRef.current = snapshot
      setInitialLayout(snapshot)
      setLayoutSessionKey((v) => v + 1)
      setLayoutReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [anchor?.id, anchor?.type, open])

  const handleLayoutSnapshotChange = useCallback((snapshot: CrossBindingGraphLayoutSnapshot) => {
    currentSnapshotRef.current = snapshot
  }, [])

  const handleLayoutDirty = useCallback(() => {
    setDirty(true)
  }, [])

  const persistLayout = useCallback(async () => {
    if (!anchor || !currentSnapshotRef.current) return false
    setSaveBusy(true)
    try {
      const snapshot = currentSnapshotRef.current
      await personaDb.putCrossBindingGraphLayout({
        id: crossBindingGraphLayoutId(anchor.type, anchor.id),
        anchorType: anchor.type,
        anchorId: anchor.id,
        ...snapshot,
        updatedAt: Date.now(),
      })
      committedSnapshotRef.current = snapshot
      setDirty(false)
      showSaveToast('布局已保存')
      return true
    } finally {
      setSaveBusy(false)
    }
  }, [anchor, showSaveToast])

  const requestClose = useCallback(() => {
    if (dirty) {
      setExitConfirmOpen(true)
      return
    }
    onClose()
  }, [dirty, onClose])

  const startLiveCoach = useCallback(() => {
    setLinkEditMode(false)
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback((opts?: { openTutorial?: boolean }) => {
    writePersonaCoachSeen(PERSONA_GRAPH_COACH_SEEN_KEY)
    setCoachOpen(false)
    setCoachStepIndex(0)
    if (opts?.openTutorial) setTutorialOpen(true)
  }, [])

  const handleCoachBeforeStep = useCallback((step: { target: string | null }) => {
    if (step.target === 'graph-link-mode') setLinkEditMode(false)
    if (step.target === 'graph-exit-focus') setLinkEditMode(false)
  }, [])

  useEffect(() => {
    if (!open) return
    if (readPersonaCoachSeen(PERSONA_GRAPH_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 520)
    return () => window.clearTimeout(id)
  }, [open, startLiveCoach])

  if (!open || !anchor) return null

  const focusKey = nodeKey(anchor.type, anchor.id)

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            {...{ [PERSONA_COACH_ROOT_ATTR]: 'persona-graph' }}
            className="fixed inset-0 z-[1100] flex select-none touch-manipulation flex-col bg-[#F7F7F9] [-webkit-touch-callout:none]"
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <header
              className="shrink-0 border-b border-[#E5E7EB]/80 bg-white/95 px-4 backdrop-blur-md"
              style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))', paddingBottom: 10 }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={requestClose}
                  className="rounded-xl p-2 transition-colors hover:bg-[#fafafa]"
                  aria-label="返回"
                >
                  <ArrowLeft className="size-5 text-[#111827]" />
                </button>
                <PersonaRosterAvatar
                  character={anchor.avatar ?? null}
                  size={36}
                  kind={anchor.type === 'user' ? 'identity' : 'wechat'}
                />
                <div className="min-w-0 flex-1" data-persona-coach="graph-header">
                  <p
                    className="truncate text-[15px] font-semibold text-[#111827]"
                    style={{ fontFamily: PERSONA_SERIF }}
                  >
                    {anchor.label}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                    关系图谱 · {linkEditMode ? '连线模式' : '聚焦 · 已绑定关系'}
                    {dirty ? ' · 未保存' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  data-graph-ui-control
                  {...{ [PERSONA_COACH_TARGET_ATTR]: 'graph-save-layout' }}
                  disabled={saveBusy || !dirty}
                  onClick={() => {
                    void persistLayout()
                  }}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    dirty
                      ? 'bg-[#111827] text-white shadow-sm'
                      : 'border border-[#E5E7EB] bg-white text-[#9CA3AF]'
                  } disabled:opacity-50`}
                >
                  <Save className="size-3" />
                  {saveBusy ? '保存中' : dirty ? '保存布局' : '已保存'}
                </button>
                <PersonaTutorialButton
                  compact
                  onClick={() => setTutorialOpen(true)}
                  coachTarget="graph-tutorial-btn"
                />
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col p-3">
              {layoutReady ? (
                <CrossBindingGraphMode
                  store={store}
                  onEditEdge={onEditEdge}
                  onCreateEdge={onCreateEdge}
                  initialFocusKey={focusKey}
                  linkEditMode={linkEditMode}
                  onLinkEditModeChange={setLinkEditMode}
                  coachAssistActive={coachOpen}
                  onCoachLayoutReady={bumpGraphCoachLayout}
                  initialLayout={initialLayout}
                  layoutSessionKey={layoutSessionKey}
                  onLayoutSnapshotChange={handleLayoutSnapshotChange}
                  onLayoutDirty={handleLayoutDirty}
                  className="h-full min-h-[360px] flex-1 rounded-2xl shadow-none"
                />
              ) : (
                <div className="flex h-full min-h-[360px] flex-1 items-center justify-center rounded-2xl bg-white text-[12px] text-[#9CA3AF]">
                  加载图谱布局…
                </div>
              )}
            </div>

            {saveToast ? (
              <div className="pointer-events-none absolute left-1/2 top-[max(72px,calc(env(safe-area-inset-top,0px)+56px))] z-40 -translate-x-1/2 rounded-full bg-[#111827]/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg">
                {saveToast}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {exitConfirmOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="关闭"
              className="fixed inset-0 z-[1200] bg-black/25 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExitConfirmOpen(false)}
            />
            <motion.div
              className="fixed inset-x-4 top-1/2 z-[1201] mx-auto max-w-[360px] -translate-y-1/2 overflow-hidden rounded-[22px] border border-[#EBEBEF] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.14)]"
              initial={{ opacity: 0, scale: 0.96, y: '-44%' }}
              animate={{ opacity: 1, scale: 1, y: '-50%' }}
              exit={{ opacity: 0, scale: 0.98, y: '-46%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <p className="text-center text-[15px] font-semibold text-[#111827]">保存图谱布局？</p>
              <p className="mt-2 text-center text-[12px] leading-relaxed text-[#6B7280]">
                你已移动节点或调整画布视图，尚未保存。退出后将丢失这些排版。
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={() => {
                    void (async () => {
                      const ok = await persistLayout()
                      if (!ok) return
                      setExitConfirmOpen(false)
                      onClose()
                    })()
                  }}
                  className="w-full rounded-full bg-[#111827] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {saveBusy ? '保存中…' : '保存并退出'}
                </button>
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={() => {
                    setExitConfirmOpen(false)
                    onClose()
                  }}
                  className="w-full rounded-full border border-[#E5E7EB] py-2.5 text-[13px] font-medium text-[#374151] disabled:opacity-50"
                >
                  不保存，直接退出
                </button>
                <button
                  type="button"
                  disabled={saveBusy}
                  onClick={() => setExitConfirmOpen(false)}
                  className="w-full rounded-full py-2.5 text-[13px] font-medium text-[#9CA3AF] disabled:opacity-50"
                >
                  继续编辑
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <PersonaTutorialModal
        open={tutorialOpen && open}
        onClose={() => setTutorialOpen(false)}
        title={PERSONA_GRAPH_TUTORIAL.title}
        subtitle={PERSONA_GRAPH_TUTORIAL.subtitle}
        sections={[...PERSONA_GRAPH_TUTORIAL.sections]}
        onStartLiveCoach={startLiveCoach}
        zIndex={61150}
      />

      <MemoryCoachPortal
        open={coachOpen && open}
        steps={PERSONA_GRAPH_COACH_STEPS}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        onBeforeStep={handleCoachBeforeStep}
        scopeRoot="persona-graph"
        layoutEpoch={`${linkEditMode}-${focusKey}-${store.edges.length}-${coachStepIndex}-${graphCoachLayoutEpoch}-${dirty}`}
        zIndex={61100}
        coachTargetAttr={PERSONA_COACH_TARGET_ATTR}
        coachRootAttr={PERSONA_COACH_ROOT_ATTR}
      />
    </>
  )
}
