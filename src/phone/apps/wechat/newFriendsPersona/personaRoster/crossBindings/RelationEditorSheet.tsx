import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  applyAnchorRelationEdit,
  nodeKey,
  orientEdgeWithInitiator,
  otherNodeOnEdge,
  relationLabelFromAnchor,
} from './crossBindingEngine'
import type { CrossBindingNode, RelationshipEdge } from './crossBindingTypes'
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
  onSave: (edge: RelationshipEdge) => void | Promise<void>
  onDelete: (edge: RelationshipEdge) => void | Promise<void>
  /** 图谱连线新建时尚未入库 */
  isNew?: boolean
}) {
  const [label, setLabel] = useState('')
  const [mutual, setMutual] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!edge || !anchorId) return
    setLabel(relationLabelFromAnchor(edge, anchorId))
    setMutual(edge.isMutual)
  }, [anchorId, edge])

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

  const displayEdge = useMemo(() => {
    if (!edge || !anchorId) return edge
    const trimmed = label.trim()
    if (!trimmed) return edge
    return applyAnchorRelationEdit(edge, anchorId, trimmed)
  }, [anchorId, edge, label])

  if (!open || !edge || !anchorId) return null

  const charChar = edge.sourceType !== 'user' && edge.targetType !== 'user'

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
            className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[1301] overflow-hidden rounded-[22px] border border-[#EBEBEF] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-[#F0F0F3] px-4 py-3">
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">
                  {isNew ? '新建关系' : '编辑关系'}
                </p>
                <p className="text-[10px] text-[#9CA3AF]">图谱连线 · 单条关系</p>
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
              <div className="border-b border-[#F0F0F3] px-2 py-3">
                <RelationshipRow
                  anchor={connectionPreview.anchor}
                  edge={displayEdge}
                  peer={connectionPreview.peer}
                />
              </div>
            ) : null}

            <div className="px-4 py-4">
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">
                  关系词
                </span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="如：暗恋对象、死敌、上司"
                  className="mt-2 w-full rounded-xl border border-transparent bg-[#F7F7F8] px-3 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#111827]/15 focus:bg-white"
                />
              </label>

              {charChar ? (
                <div className="space-y-1">
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
                      ? '双方互相认识，可各自设置关系词。'
                      : '仅连线发起方认识对方；对方不会看到此关系。'}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 border-t border-[#F0F0F3] px-4 py-3">
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
                disabled={busy || !label.trim()}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      const patched = applyAnchorRelationEdit(edge, anchorId, label.trim())
                      let finalEdge: RelationshipEdge = { ...patched, isMutual: mutual }
                      if (charChar && !mutual) {
                        finalEdge = orientEdgeWithInitiator(finalEdge, anchorId, registry)
                      }
                      await onSave(finalEdge)
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
