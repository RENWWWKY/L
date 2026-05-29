import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Character, PlayerIdentity } from '../../types'
import { MemoryCoachPortal } from '../../../memory/MemoryCoachPortal'
import {
  PERSONA_COACH_ROOT_ATTR,
  PERSONA_COACH_TARGET_ATTR,
  PERSONA_RELATIONS_COACH_SEEN_KEY,
  readPersonaCoachSeen,
  writePersonaCoachSeen,
} from '../../../memory/memoryCoachTypes'
import { PersonaTutorialButton } from '../coach/PersonaTutorialButton'
import { PersonaTutorialModal } from '../coach/PersonaTutorialModal'
import { PERSONA_RELATIONS_COACH_STEPS, relationsCoachSubTabForTarget } from '../coach/personaRelationsCoachSteps'
import { PERSONA_RELATIONS_TUTORIAL } from '../coach/personaRelationsTutorialCopy'
import { AnchorRelationsEditorSheet } from './AnchorRelationsEditorSheet'
import { CrossBindingGraphOverlay } from './CrossBindingGraphOverlay'
import { CrossBindingListMode } from './CrossBindingListMode'
import { CrossBindingSubTabs } from './CrossBindingSubTabs'
import { RelationEditorSheet } from './RelationEditorSheet'
import type { CrossBindingNode, CrossBindingSubTabId, RelationshipEdge } from './crossBindingTypes'
import { useCrossBindingStore } from './useCrossBindingStore'

type RelationEditorContext = {
  edge: RelationshipEdge
  anchorId: string
  isNew?: boolean
}

export function CrossBindingsPanel({
  mainCharacters,
  npcCharacters,
  identityList,
  identityNameById,
  loading: rosterLoading,
  onTopBarRight,
  onEnsureRelationsTab,
}: {
  mainCharacters: Character[]
  npcCharacters: Character[]
  identityList: PlayerIdentity[]
  identityNameById: Record<string, string>
  loading: boolean
  /** 名册顶栏右侧「教程」按钮（需在 relations-roster coach 根内） */
  onTopBarRight?: (node: ReactNode | null) => void
  /** 引导前切到「关系与绑定」Tab */
  onEnsureRelationsTab?: () => void
}) {
  const [subTab, setSubTab] = useState<CrossBindingSubTabId>('user')
  const [editorCtx, setEditorCtx] = useState<RelationEditorContext | null>(null)
  const [textEditAnchor, setTextEditAnchor] = useState<CrossBindingNode | null>(null)
  const [graphAnchor, setGraphAnchor] = useState<CrossBindingNode | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)

  const store = useCrossBindingStore({
    identityList,
    mainCharacters,
    npcCharacters,
    identityNameById,
    enabled: true,
  })

  const loading = rosterLoading || store.loading

  const startLiveCoach = useCallback(() => {
    onEnsureRelationsTab?.()
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [onEnsureRelationsTab])

  const finishCoach = useCallback(
    (opts?: { openTutorial?: boolean }) => {
      writePersonaCoachSeen(PERSONA_RELATIONS_COACH_SEEN_KEY)
      setCoachOpen(false)
      setCoachStepIndex(0)
      if (opts?.openTutorial) setTutorialOpen(true)
    },
    [],
  )

  const handleCoachBeforeStep = useCallback(
    (step: { target: string | null }) => {
      if (step.target === 'roster-tab-relations') {
        onEnsureRelationsTab?.()
      }
      const nextSub = relationsCoachSubTabForTarget(step.target)
      if (nextSub) setSubTab(nextSub)
    },
    [onEnsureRelationsTab],
  )

  const autoCoachStartedRef = useRef(false)

  useEffect(() => {
    onTopBarRight?.(
      <PersonaTutorialButton
        onClick={() => setTutorialOpen(true)}
        coachTarget="relations-tutorial"
      />,
    )
    return () => onTopBarRight?.(null)
  }, [onTopBarRight])

  useEffect(() => {
    if (autoCoachStartedRef.current) return
    if (readPersonaCoachSeen(PERSONA_RELATIONS_COACH_SEEN_KEY)) return
    autoCoachStartedRef.current = true
    const id = window.setTimeout(() => {
      onEnsureRelationsTab?.()
      setCoachStepIndex(0)
      setCoachOpen(true)
    }, 640)
    return () => window.clearTimeout(id)
  }, [onEnsureRelationsTab])

  return (
    <>
      <div className="space-y-3">
        <p className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9CA3AF]">
          RELATION MATRIX · {store.edges.length}
        </p>

        <CrossBindingSubTabs active={subTab} onChange={setSubTab} />

        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.28 }}
          >
            <CrossBindingListMode
              subTab={subTab}
              store={store}
              onOpenTextEditor={setTextEditAnchor}
              onOpenGraph={setGraphAnchor}
            />
          </motion.div>
        </AnimatePresence>

        {loading ? (
          <p className="text-center text-[10px] text-[#9CA3AF]">同步关系数据中…</p>
        ) : null}
      </div>

      <PersonaTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title={PERSONA_RELATIONS_TUTORIAL.title}
        subtitle={PERSONA_RELATIONS_TUTORIAL.subtitle}
        sections={[...PERSONA_RELATIONS_TUTORIAL.sections]}
        onStartLiveCoach={startLiveCoach}
        zIndex={61400}
      />

      <MemoryCoachPortal
        open={coachOpen}
        steps={PERSONA_RELATIONS_COACH_STEPS}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        onBeforeStep={handleCoachBeforeStep}
        scopeRoot="relations-roster"
        layoutEpoch={`${subTab}-${store.edges.length}`}
        zIndex={61300}
        coachTargetAttr={PERSONA_COACH_TARGET_ATTR}
        coachRootAttr={PERSONA_COACH_ROOT_ATTR}
      />

      <CrossBindingGraphOverlay
        open={!!graphAnchor}
        anchor={graphAnchor}
        store={store}
        onClose={() => setGraphAnchor(null)}
        onEditEdge={(edge, anchorId) => setEditorCtx({ edge, anchorId, isNew: false })}
        onCreateEdge={(edge, anchorId) => setEditorCtx({ edge, anchorId, isNew: true })}
      />

      <AnchorRelationsEditorSheet
        open={!!textEditAnchor}
        anchor={textEditAnchor}
        store={store}
        onClose={() => setTextEditAnchor(null)}
        onSave={async (edge) => {
          await store.upsertEdge(edge)
        }}
        onDelete={async (edge) => {
          await store.removeEdge(edge)
        }}
      />

      <RelationEditorSheet
        open={!!editorCtx}
        edge={editorCtx?.edge ?? null}
        anchorId={editorCtx?.anchorId ?? null}
        isNew={editorCtx?.isNew}
        registry={store.registry}
        onClose={() => setEditorCtx(null)}
        onSave={async (edge) => {
          await store.upsertEdge(edge)
        }}
        onDelete={async (edge) => {
          await store.removeEdge(edge)
        }}
      />
    </>
  )
}

/** 名册列表页 coach 根属性（包住 TopBar + 滚动区） */
export const PERSONA_RELATIONS_COACH_ROOT = {
  [PERSONA_COACH_ROOT_ATTR]: 'relations-roster',
} as const
