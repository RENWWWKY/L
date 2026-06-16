import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import {
  edgeFromRelationshipDrafts,
  loadRelationshipEdgeDrafts,
  nodeKey,
  orientEdgeWithInitiator,
  otherNodeOnEdge,
} from './crossBindingEngine'
import type {
  CrossBindingNode,
  RelationshipDirectionDraft,
  RelationshipEdge,
  RelationshipEdgeDrafts,
} from './crossBindingTypes'
import { RelationshipRow } from './RelationshipRow'

function resolveRegistryNode(
  registry: Map<string, CrossBindingNode>,
  id: string,
): CrossBindingNode | null {
  return (
    registry.get(nodeKey('user', id)) ??
    registry.get(nodeKey('main', id)) ??
    registry.get(nodeKey('npc', id)) ??
    null
  )
}

/** 去重后的连线表单：关系词 / 看法 / 称呼各填一次 */
type PairEdgeForm = {
  sourceToTargetRel: string
  targetToSourceRel: string
  sourceCallsTarget: string
  targetCallsSource: string
  sourceViewOfTarget: string
  targetViewOfSource: string
}

function emptyPairForm(): PairEdgeForm {
  return {
    sourceToTargetRel: '',
    targetToSourceRel: '',
    sourceCallsTarget: '',
    targetCallsSource: '',
    sourceViewOfTarget: '',
    targetViewOfSource: '',
  }
}

function pairFormFromDrafts(
  forward: RelationshipDirectionDraft,
  reverse?: RelationshipDirectionDraft,
): PairEdgeForm {
  return {
    sourceToTargetRel: forward.relation,
    targetToSourceRel: reverse?.relation ?? forward.relation,
    sourceCallsTarget: forward.fromCallsTo,
    targetCallsSource: reverse?.fromCallsTo ?? '',
    sourceViewOfTarget: forward.fromPerspective,
    targetViewOfSource: forward.toPerspective || reverse?.fromPerspective || '',
  }
}

function draftsFromPairForm(form: PairEdgeForm, mutual: boolean): RelationshipEdgeDrafts {
  const forward: RelationshipDirectionDraft = {
    relation: form.sourceToTargetRel.trim(),
    fromCallsTo: form.sourceCallsTarget.trim(),
    fromPerspective: form.sourceViewOfTarget.trim(),
    toPerspective: form.targetViewOfSource.trim(),
  }
  if (!mutual) {
    return { forward }
  }
  return {
    forward,
    reverse: {
      relation: form.targetToSourceRel.trim(),
      fromCallsTo: form.targetCallsSource.trim(),
      fromPerspective: form.targetViewOfSource.trim(),
      toPerspective: form.sourceViewOfTarget.trim(),
    },
  }
}

const fieldInputClass =
  'mt-1.5 w-full rounded-xl border border-transparent bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none focus:border-[#111827]/15'
const sectionClass = 'rounded-xl border border-[#F0F0F3] bg-[#FAFAFB] p-3'
function FormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className={sectionClass}>
      <div className="border-b border-[#E5E7EB] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-1 shrink-0 rounded-full bg-[#111827]" aria-hidden />
          <p className="text-[14px] font-semibold tracking-wide text-[#111827]">{title}</p>
        </div>
        {hint ? (
          <p className="mt-1.5 pl-3 text-[11px] leading-relaxed text-[#9CA3AF]">{hint}</p>
        ) : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function nodeDisplayName(node: CrossBindingNode): string {
  return node.type === 'user' ? '你' : node.label
}

function PersonChip({ node, name }: { node: CrossBindingNode; name: string }) {
  return (
    <span className="inline-flex max-w-[46%] items-center gap-1.5 rounded-full border border-[#ECECF0] bg-white py-0.5 pl-0.5 pr-2">
      <PersonaRosterAvatar
        character={node.avatar ?? null}
        size={22}
        kind={node.type === 'user' ? 'identity' : 'wechat'}
      />
      <span
        className="truncate text-[11px] font-medium text-[#374151]"
        style={{ fontFamily: PERSONA_SERIF }}
      >
        {name}
      </span>
    </span>
  )
}

function RelationWordFieldLabel({
  viewer,
  viewerName,
  subject,
  subjectName,
}: {
  viewer: CrossBindingNode
  viewerName: string
  subject: CrossBindingNode
  subjectName: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] leading-snug text-[#374151]">
        <span className="font-semibold text-[#111827]">「{subjectName}」</span>
        <span className="text-[#6B7280]"> 是 </span>
        <span className="font-semibold text-[#111827]">「{viewerName}」</span>
        <span className="text-[#6B7280]"> 的</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PersonChip node={viewer} name={viewerName} />
        <span className="text-[11px] font-medium text-[#9CA3AF]">→</span>
        <PersonChip node={subject} name={subjectName} />
        <span className="text-[10px] text-[#9CA3AF]">（连线上显示此关系词）</span>
      </div>
    </div>
  )
}

function DirectionLabel({
  from,
  fromName,
  to,
  toName,
  suffix,
}: {
  from: CrossBindingNode
  fromName: string
  to: CrossBindingNode
  toName: string
  suffix?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PersonChip node={from} name={fromName} />
      <span className="text-[12px] text-[#9CA3AF]">→</span>
      <PersonChip node={to} name={toName} />
      {suffix ? <span className="text-[10px] text-[#9CA3AF]">{suffix}</span> : null}
    </div>
  )
}

function ViewLabel({
  viewer,
  viewerName,
  subject,
  subjectName,
}: {
  viewer: CrossBindingNode
  viewerName: string
  subject: CrossBindingNode
  subjectName: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PersonChip node={viewer} name={viewerName} />
      <span className="text-[11px] font-medium text-[#9CA3AF]">看</span>
      <PersonChip node={subject} name={subjectName} />
    </div>
  )
}

/** 图谱拖拽新建/编辑单条关系时的轻量弹层 */
export function RelationEditorSheet({
  open,
  edge,
  anchorId,
  registry,
  onClose,
  onSave,
  onDelete,
  isNew = false,
}: {
  open: boolean
  edge: RelationshipEdge | null
  anchorId: string | null
  registry: Map<string, CrossBindingNode>
  onClose: () => void
  onSave: (edge: RelationshipEdge, drafts?: RelationshipEdgeDrafts) => void | Promise<void>
  onDelete: (edge: RelationshipEdge) => void | Promise<void>
  /** 图谱连线新建时尚未入库 */
  isNew?: boolean
}) {
  const [form, setForm] = useState<PairEdgeForm>(emptyPairForm)
  const [mutual, setMutual] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  const patchForm = (patch: Partial<PairEdgeForm>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    if (!edge || !anchorId || !open) return
    setMutual(edge.isMutual)
    let cancelled = false
    setLoadingDrafts(true)
    void loadRelationshipEdgeDrafts(edge, registry)
      .then((drafts) => {
        if (cancelled) return
        setForm(pairFormFromDrafts(drafts.forward, drafts.reverse))
      })
      .finally(() => {
        if (!cancelled) setLoadingDrafts(false)
      })
    return () => {
      cancelled = true
    }
  }, [anchorId, edge, open, registry])

  const connectionPreview = useMemo(() => {
    if (!edge || !anchorId) return null
    const anchorNode = resolveRegistryNode(registry, anchorId)
    const peerNode = anchorNode ? otherNodeOnEdge(edge, anchorId, registry) : null
    if (anchorNode && peerNode) {
      return { anchor: anchorNode, peer: peerNode }
    }
    const sourceNode = registry.get(nodeKey(edge.sourceType, edge.sourceId))
    const targetNode = registry.get(nodeKey(edge.targetType, edge.targetId))
    if (sourceNode && targetNode) {
      return { anchor: sourceNode, peer: targetNode }
    }
    return null
  }, [anchorId, edge, registry])

  const endpoints = useMemo(() => {
    if (!edge) return null
    const sourceNode = registry.get(nodeKey(edge.sourceType, edge.sourceId))
    const targetNode = registry.get(nodeKey(edge.targetType, edge.targetId))
    if (!sourceNode || !targetNode) return null
    return {
      sourceNode,
      targetNode,
      sourceName: nodeDisplayName(sourceNode),
      targetName: nodeDisplayName(targetNode),
    }
  }, [edge, registry])

  const displayEdge = useMemo(() => {
    if (!edge) return edge
    return edgeFromRelationshipDrafts({ ...edge, isMutual: mutual }, draftsFromPairForm(form, mutual))
  }, [edge, form, mutual])

  if (!open || !edge || !anchorId) return null

  const charChar = edge.sourceType !== 'user' && edge.targetType !== 'user'
  const involvesUser = edge.sourceType === 'user' || edge.targetType === 'user'
  const showBidirectional = involvesUser || mutual
  const sourceName = endpoints?.sourceName ?? '起点'
  const targetName = endpoints?.targetName ?? '终点'
  const sourceNode = endpoints?.sourceNode
  const targetNode = endpoints?.targetNode
  const canSave = showBidirectional
    ? form.sourceToTargetRel.trim() && (!mutual || form.targetToSourceRel.trim())
    : form.sourceToTargetRel.trim()

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[1300] bg-black/20 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[1301] flex max-h-[min(88vh,720px)] flex-col overflow-hidden rounded-[22px] border border-[#EBEBEF] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#F0F0F3] px-4 py-3">
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">
                  {isNew ? '新建关系' : '编辑关系'}
                </p>
                <p className="text-[10px] text-[#9CA3AF]">
                  图谱连线 · {showBidirectional ? '双向关系' : '单向关系'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-[#6B7280] hover:bg-[#F7F7F9]"
                aria-label="关闭"
              >
                <X className="size-4" />
              </button>
            </div>

            {connectionPreview && displayEdge ? (
              <div className="shrink-0 border-b border-[#F0F0F3] px-2 py-3">
                <RelationshipRow
                  anchor={connectionPreview.anchor}
                  edge={displayEdge}
                  peer={connectionPreview.peer}
                />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loadingDrafts ? (
                <p className="py-6 text-center text-[12px] text-[#9CA3AF]">加载关系详情…</p>
              ) : (
                <div className="space-y-4">
                  <FormSection
                    title="关系词"
                    hint="箭头 A→B 表示：B 是 A 的什么关系，填写后会显示在两人之间的连线上。"
                  >
                    {sourceNode && targetNode ? (
                      <>
                        <label className="block">
                          <RelationWordFieldLabel
                            viewer={sourceNode}
                            viewerName={sourceName}
                            subject={targetNode}
                            subjectName={targetName}
                          />
                          <input
                            value={form.sourceToTargetRel}
                            onChange={(e) => patchForm({ sourceToTargetRel: e.target.value })}
                            placeholder="如：暗恋对象、死敌、上司"
                            className={fieldInputClass}
                          />
                        </label>
                        {showBidirectional ? (
                          <label className="block">
                            <RelationWordFieldLabel
                              viewer={targetNode}
                              viewerName={targetName}
                              subject={sourceNode}
                              subjectName={sourceName}
                            />
                            <input
                              value={form.targetToSourceRel}
                              onChange={(e) => patchForm({ targetToSourceRel: e.target.value })}
                              placeholder="可与上方不同，体现各自视角"
                              className={fieldInputClass}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </FormSection>

                  <FormSection title="看法">
                    {sourceNode && targetNode ? (
                      <>
                        <label className="block">
                          <ViewLabel
                            viewer={sourceNode}
                            viewerName={sourceName}
                            subject={targetNode}
                            subjectName={targetName}
                          />
                          <textarea
                            value={form.sourceViewOfTarget}
                            onChange={(e) => patchForm({ sourceViewOfTarget: e.target.value })}
                            rows={2}
                            placeholder="填写一方对另一方的看法…"
                            className={`${fieldInputClass} resize-y`}
                          />
                        </label>
                        {showBidirectional ? (
                          <label className="block">
                            <ViewLabel
                              viewer={targetNode}
                              viewerName={targetName}
                              subject={sourceNode}
                              subjectName={sourceName}
                            />
                            <textarea
                              value={form.targetViewOfSource}
                              onChange={(e) => patchForm({ targetViewOfSource: e.target.value })}
                              rows={2}
                              placeholder="填写另一方对一方的看法…"
                              className={`${fieldInputClass} resize-y`}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </FormSection>

                  <FormSection title="称呼">
                    {sourceNode && targetNode ? (
                      <>
                        <label className="block">
                          <DirectionLabel
                            from={sourceNode}
                            fromName={sourceName}
                            to={targetNode}
                            toName={targetName}
                            suffix="如何称呼"
                          />
                          <input
                            value={form.sourceCallsTarget}
                            onChange={(e) => patchForm({ sourceCallsTarget: e.target.value })}
                            placeholder="如：师兄、全名、外号…"
                            className={fieldInputClass}
                          />
                        </label>
                        {showBidirectional ? (
                          <label className="block">
                            <DirectionLabel
                              from={targetNode}
                              fromName={targetName}
                              to={sourceNode}
                              toName={sourceName}
                              suffix="如何称呼"
                            />
                            <input
                              value={form.targetCallsSource}
                              onChange={(e) => patchForm({ targetCallsSource: e.target.value })}
                              placeholder="如：小名、职称、外号…"
                              className={fieldInputClass}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </FormSection>

                  {charChar ? (
                    <div className="space-y-1 px-0.5">
                      <label className="flex items-center gap-2 text-[12px] text-[#4B5563]">
                        <input
                          type="checkbox"
                          checked={mutual}
                          onChange={(e) => setMutual(e.target.checked)}
                          className="size-4 rounded accent-[#111827]"
                        />
                        是否为双向关系
                      </label>
                      <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
                        {mutual
                          ? '双方互相认识，可分别填写关系词、称呼与看法。'
                          : '仅连线发起方认识对方；对方不会看到此关系。'}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex shrink-0 gap-2 border-t border-[#F0F0F3] px-4 py-3">
              {!isNew ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      try {
                        await onDelete(edge)
                        onClose()
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                  className="flex-1 rounded-full border border-[#EF4444]/25 py-2.5 text-[13px] font-medium text-[#EF4444]"
                >
                  解除
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="flex-1 rounded-full border border-[#E5E7EB] py-2.5 text-[13px] font-medium text-[#374151]"
                >
                  取消
                </button>
              )}
              <button
                type="button"
                disabled={busy || loadingDrafts || !canSave}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      const drafts = draftsFromPairForm(form, mutual)
                      let finalEdge = edgeFromRelationshipDrafts({ ...edge, isMutual: mutual }, drafts)
                      if (charChar && !mutual) {
                        finalEdge = orientEdgeWithInitiator(finalEdge, anchorId, registry)
                      }
                      await onSave(finalEdge, drafts)
                      onClose()
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
                className="flex-1 rounded-full bg-[#111827] py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                {isNew ? '创建' : '保存'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
