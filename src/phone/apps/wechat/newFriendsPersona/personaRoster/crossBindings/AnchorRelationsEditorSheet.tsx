import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MemoryCoachPortal } from '../../../memory/MemoryCoachPortal'
import {
  PERSONA_ANCHOR_EDITOR_COACH_SEEN_KEY,
  PERSONA_COACH_ROOT_ATTR,
  PERSONA_COACH_TARGET_ATTR,
  readPersonaCoachSeen,
  writePersonaCoachSeen,
} from '../../../memory/memoryCoachTypes'
import { PersonaTutorialButton } from '../coach/PersonaTutorialButton'
import { PersonaTutorialModal } from '../coach/PersonaTutorialModal'
import { PERSONA_ANCHOR_EDITOR_COACH_STEPS } from '../coach/personaAnchorEditorCoachSteps'
import { PERSONA_ANCHOR_EDITOR_TUTORIAL } from '../coach/personaAnchorEditorTutorialCopy'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF, playerIdentityProfessionTag } from '../personaRosterDisplay'
import { AnchorRelationPeerPicker } from './AnchorRelationPeerPicker'
import {
  applyAnchorRelationEdit,
  createDraftEdgeFromAnchorToPeer,
  edgesForAnchor,
  listEligiblePeersForNewRelation,
  orientEdgeWithInitiator,
  otherNodeOnEdge,
  relationLabelFromAnchor,
} from './crossBindingEngine'
import type { CrossBindingNode, RelationshipEdge } from './crossBindingTypes'
import type { CrossBindingStore } from './useCrossBindingStore'

type DraftRow = {
  edgeId: string
  edge: RelationshipEdge
  peer: CrossBindingNode
  label: string
  mutual: boolean
  isNew?: boolean
}

function anchorDisplayName(anchor: CrossBindingNode): string {
  return anchor.type === 'user' ? '你' : anchor.label
}

function peerDisplayName(peer: CrossBindingNode): string {
  return peer.type === 'user' ? '你' : peer.label
}

function isCharCharDraftRow(row: DraftRow): boolean {
  return row.edge.sourceType !== 'user' && row.edge.targetType !== 'user'
}

function CoachMutualToggleDemo() {
  return (
    <div
      {...{ [PERSONA_COACH_TARGET_ATTR]: 'anchor-mutual-toggle' }}
      className="mb-3 rounded-2xl border border-dashed border-[#D1D5DB] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
        示例 · 主角 / NPC 之间才有此开关
      </p>
      <label className="flex items-center gap-2.5 text-[12px] text-[#4B5563]">
        <input
          type="checkbox"
          readOnly
          checked
          tabIndex={-1}
          className="size-4 rounded border-[#D1D5DB] accent-[#111827]"
        />
        是否为双向关系
      </label>
      <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
        不勾选 = 单方面认识；勾选 = 互相认识，各自可写不同关系词。
      </p>
    </div>
  )
}

export function AnchorRelationsEditorSheet({
  open,
  anchor,
  store,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  anchor: CrossBindingNode | null
  store: CrossBindingStore
  onClose: () => void
  onSave: (edge: RelationshipEdge) => void | Promise<void>
  onDelete: (edge: RelationshipEdge) => void | Promise<void>
}) {
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)

  const anchorEdges = useMemo(() => {
    if (!anchor) return []
    return edgesForAnchor(anchor, store.edges)
  }, [anchor, store.edges])

  const eligiblePeers = useMemo(() => {
    if (!anchor) return { mains: [], npcs: [] }
    const draftPeerKeys = new Set(drafts.map((r) => `${r.peer.type}:${r.peer.id}`))
    const base = listEligiblePeersForNewRelation(anchor, store.registry, store.edges)
    const dropDrafted = (list: CrossBindingNode[]) =>
      list.filter((n) => !draftPeerKeys.has(`${n.type}:${n.id}`))
    return {
      mains: dropDrafted(base.mains),
      npcs: dropDrafted(base.npcs),
    }
  }, [anchor, drafts, store.edges, store.registry])

  const allowCharCharAdd = anchor?.type === 'main' || anchor?.type === 'npc'
  const canAddRelation =
    allowCharCharAdd && eligiblePeers.mains.length + eligiblePeers.npcs.length > 0

  const mutualCoachRowIndex = useMemo(
    () => drafts.findIndex(isCharCharDraftRow),
    [drafts],
  )
  const relationCoachRowIndex = mutualCoachRowIndex >= 0 ? mutualCoachRowIndex : 0

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback((opts?: { openTutorial?: boolean }) => {
    writePersonaCoachSeen(PERSONA_ANCHOR_EDITOR_COACH_SEEN_KEY)
    setCoachOpen(false)
    setCoachStepIndex(0)
    if (opts?.openTutorial) setTutorialOpen(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setPickerOpen(false)
      setTutorialOpen(false)
      setCoachOpen(false)
      return
    }
    if (!anchor) return
    const rows: DraftRow[] = []
    for (const edge of anchorEdges) {
      const peer = otherNodeOnEdge(edge, anchor.id, store.registry)
      if (!peer) continue
      rows.push({
        edgeId: edge.id,
        edge,
        peer,
        label: relationLabelFromAnchor(edge, anchor.id),
        mutual: edge.isMutual,
      })
    }
    setDrafts(rows)
  }, [anchor, anchorEdges, open, store.registry])

  useEffect(() => {
    if (!open) return
    if (readPersonaCoachSeen(PERSONA_ANCHOR_EDITOR_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 520)
    return () => window.clearTimeout(id)
  }, [open, startLiveCoach])

  if (!open || !anchor) return null

  const profession =
    anchor.type === 'user' ? playerIdentityProfessionTag(anchor.raw as never) : null

  const updateRow = (edgeId: string, patch: Partial<Pick<DraftRow, 'label' | 'mutual'>>) => {
    setDrafts((prev) => prev.map((r) => (r.edgeId === edgeId ? { ...r, ...patch } : r)))
  }

  const handleSaveAll = async () => {
    setBusy(true)
    try {
      for (const row of drafts) {
        const original = row.edge
        const originalLabel = relationLabelFromAnchor(original, anchor.id)
        const labelChanged = row.label.trim() !== originalLabel.trim()
        const mutualChanged = row.mutual !== original.isMutual
        if (!row.isNew && !labelChanged && !mutualChanged) continue
        const charChar =
          row.edge.sourceType !== 'user' && row.edge.targetType !== 'user'
        let patched = applyAnchorRelationEdit(
          original,
          anchor.id,
          row.label.trim() || (charChar ? '认识' : '联系人'),
        )
        patched = { ...patched, isMutual: row.mutual }
        if (charChar && !row.mutual) {
          patched = orientEdgeWithInitiator(patched, anchor.id, store.registry)
        }
        await onSave(patched)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const handlePickPeer = (peer: CrossBindingNode) => {
    if (!anchor) return
    const edge = createDraftEdgeFromAnchorToPeer(anchor, peer)
    setDrafts((prev) => [
      {
        edgeId: edge.id,
        edge,
        peer,
        label: relationLabelFromAnchor(edge, anchor.id),
        mutual: edge.isMutual,
        isNew: true,
      },
      ...prev,
    ])
    setPickerOpen(false)
  }

  const handleDelete = async (row: DraftRow) => {
    if (!window.confirm(`确定解除与「${row.peer.label}」的关系？`)) return
    setBusy(true)
    try {
      await onDelete(row.edge)
      setDrafts((prev) => prev.filter((r) => r.edgeId !== row.edgeId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <AnimatePresence>
      {open ? (
        <motion.div
          {...{ [PERSONA_COACH_ROOT_ATTR]: 'anchor-editor' }}
          className="fixed inset-0 z-[1200] flex flex-col bg-[#F4F4F6]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <header
            className="shrink-0 border-b border-[#E8E8ED] bg-white/90 px-4 backdrop-blur-md"
            style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))', paddingBottom: 12 }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl p-2 text-[#111827] transition-colors hover:bg-[#F7F7F9] disabled:opacity-40"
                aria-label="返回"
              >
                <ArrowLeft className="size-5" />
              </button>
              <PersonaRosterAvatar
                character={anchor.avatar ?? null}
                size={40}
                kind={anchor.type === 'user' ? 'identity' : 'wechat'}
              />
              <div className="min-w-0 flex-1" data-persona-coach="anchor-editor-header">
                <p
                  className="truncate text-[16px] font-medium text-[#111827]"
                  style={{ fontFamily: PERSONA_SERIF }}
                >
                  {anchor.label}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                  关系文字编辑 · {profession || anchor.sublabel?.replace(/[\[\]]/g, '').trim() || '视角'}
                </p>
              </div>
              <PersonaTutorialButton
                compact
                onClick={() => setTutorialOpen(true)}
                coachTarget="anchor-editor-tutorial"
              />
              {allowCharCharAdd ? (
                <button
                  type="button"
                  data-persona-coach="anchor-add-relation"
                  disabled={busy || !canAddRelation}
                  onClick={() => setPickerOpen(true)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-[#111827]/12 bg-white px-3 py-2 text-[12px] font-semibold text-[#111827] transition-colors hover:bg-[#F7F7F9] disabled:opacity-35"
                >
                  <Plus className="size-3.5" />
                  新增
                </button>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {coachOpen && mutualCoachRowIndex < 0 ? <CoachMutualToggleDemo /> : null}
            {drafts.length ? (
              <ul className="m-0 list-none space-y-3 p-0">
                {drafts.map((row, rowIndex) => {
                  const charChar = isCharCharDraftRow(row)
                  return (
                    <li
                      key={row.edgeId}
                      {...(rowIndex === relationCoachRowIndex
                        ? { [PERSONA_COACH_TARGET_ATTR]: 'anchor-relation-row' }
                        : {})}
                      className={`rounded-2xl border bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${
                        row.isNew ? 'border-[#111827]/20 ring-1 ring-[#111827]/8' : 'border-[#EBEBEF]'
                      }`}
                    >
                      {row.isNew ? (
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
                          新建 · 保存后生效
                        </p>
                      ) : null}
                      <div className="flex items-center gap-3">
                        <PersonaRosterAvatar
                          character={row.peer.avatar ?? null}
                          size={38}
                          kind={row.peer.type === 'user' ? 'identity' : 'wechat'}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-[15px] font-medium text-[#111827]"
                            style={{ fontFamily: PERSONA_SERIF }}
                          >
                            {row.peer.label}
                          </p>
                          {row.peer.sublabel ? (
                            <p className="truncate text-[11px] text-[#9CA3AF]">{row.peer.sublabel}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (row.isNew) {
                              setDrafts((prev) => prev.filter((r) => r.edgeId !== row.edgeId))
                              return
                            }
                            void handleDelete(row)
                          }}
                          className="rounded-xl p-2 text-[#EF4444]/70 transition-colors hover:bg-[#FEF2F2] hover:text-[#EF4444] disabled:opacity-40"
                          aria-label={row.isNew ? '移除新建项' : `解除与${row.peer.label}的关系`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="mt-4 border-t border-dashed border-[#ECECF0] pt-4">
                        <label className="block">
                          <p className="text-[13px] leading-snug text-[#374151]">
                            <span className="font-semibold text-[#111827]">
                              「{peerDisplayName(row.peer)}」
                            </span>
                            <span className="text-[#6B7280]"> 是 </span>
                            <span className="font-semibold text-[#111827]">
                              「{anchorDisplayName(anchor)}」
                            </span>
                            <span className="text-[#6B7280]"> 的</span>
                          </p>
                          <p className="mt-1 text-[10px] leading-relaxed text-[#9CA3AF]">
                            {anchorDisplayName(anchor)} → {peerDisplayName(row.peer)}：填写后会显示在两人之间的连线上
                          </p>
                          <input
                            value={row.label}
                            onChange={(e) => updateRow(row.edgeId, { label: e.target.value })}
                            placeholder="如：死敌、恩师、头疼的学生"
                            className="mt-2 w-full rounded-xl border border-transparent bg-[#F7F7F8] px-3 py-2.5 text-[14px] text-[#111827] outline-none transition-colors focus:border-[#111827]/15 focus:bg-white"
                          />
                        </label>

                        {charChar ? (
                          <div
                            className="mt-3 space-y-1"
                            {...(rowIndex === mutualCoachRowIndex
                              ? { [PERSONA_COACH_TARGET_ATTR]: 'anchor-mutual-toggle' }
                              : {})}
                          >
                            <label className="flex items-center gap-2.5 text-[12px] text-[#4B5563]">
                              <input
                                type="checkbox"
                                checked={row.mutual}
                                onChange={(e) => updateRow(row.edgeId, { mutual: e.target.checked })}
                                className="size-4 rounded border-[#D1D5DB] accent-[#111827]"
                              />
                              是否为双向关系
                            </label>
                            <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
                              {row.mutual
                                ? '勾选：双方互相认识，各自可设不同的关系词。'
                                : '不勾选：仅当前角色单方面认识对方（如暗恋），对方不会看到这条关系。'}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
                            用户与角色绑定为双向；对方视角的关系词请在对方卡片中编辑。
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="rounded-2xl bg-white px-5 py-14 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                <p className="text-[15px] font-medium text-[#111827]" style={{ fontFamily: PERSONA_SERIF }}>
                  暂无关系链
                </p>
                <p className="mt-2 text-[12px] text-[#9CA3AF]">
                  点右上角「新增」建立主角↔主角或主角↔NPC关系；也可在「查看关系图谱」中拖拽连线。
                </p>
                {allowCharCharAdd && canAddRelation ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPickerOpen(true)}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                    新增关系
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <footer
            data-persona-coach="anchor-save"
            className="shrink-0 border-t border-[#E8E8ED] bg-white/95 px-4 backdrop-blur-md"
            style={{ paddingTop: 12, paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              type="button"
              disabled={
                busy ||
                !drafts.length ||
                !drafts.some((r) => {
                  if (r.isNew) return true
                  const originalLabel = relationLabelFromAnchor(r.edge, anchor.id)
                  return (
                    r.label.trim() !== originalLabel.trim() || r.mutual !== r.edge.isMutual
                  )
                })
              }
              onClick={() => void handleSaveAll()}
              className="w-full rounded-full bg-[#111827] py-3.5 text-[14px] font-semibold text-white transition-opacity disabled:opacity-35"
            >
              {busy ? '保存中…' : drafts.some((r) => r.isNew) ? '保存（含新建）' : '保存全部更改'}
            </button>
          </footer>

          <AnchorRelationPeerPicker
            open={pickerOpen}
            anchorLabel={anchor.label}
            anchorType={anchor.type}
            mains={eligiblePeers.mains}
            npcs={eligiblePeers.npcs}
            onClose={() => setPickerOpen(false)}
            onPick={handlePickPeer}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>

    <PersonaTutorialModal
      open={tutorialOpen && open}
      onClose={() => setTutorialOpen(false)}
      title={PERSONA_ANCHOR_EDITOR_TUTORIAL.title}
      subtitle={PERSONA_ANCHOR_EDITOR_TUTORIAL.subtitle}
      sections={[...PERSONA_ANCHOR_EDITOR_TUTORIAL.sections]}
      onStartLiveCoach={startLiveCoach}
      zIndex={61250}
    />

    <MemoryCoachPortal
      open={coachOpen && open}
      steps={PERSONA_ANCHOR_EDITOR_COACH_STEPS}
      stepIndex={coachStepIndex}
      onStepChange={setCoachStepIndex}
      onSkip={() => finishCoach()}
      onComplete={(opts) => finishCoach(opts)}
      scopeRoot="anchor-editor"
      layoutEpoch={`${drafts.length}-${mutualCoachRowIndex}-${coachStepIndex}`}
      zIndex={61200}
      coachTargetAttr={PERSONA_COACH_TARGET_ATTR}
      coachRootAttr={PERSONA_COACH_ROOT_ATTR}
    />
    </>
  )
}
