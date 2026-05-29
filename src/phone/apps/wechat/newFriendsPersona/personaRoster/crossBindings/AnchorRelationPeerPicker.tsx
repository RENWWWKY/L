import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import type { CrossBindingNode, CrossBindingNodeType } from './crossBindingTypes'

function pickerHint(anchorType: CrossBindingNodeType): string {
  if (anchorType === 'main') return '主角↔主角 或 主角↔NPC'
  if (anchorType === 'npc') return '主角↔NPC（仅可选主要角色）'
  return ''
}

function PeerRow({ node, onPick }: { node: CrossBindingNode; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#EBEBEF] bg-white px-3 py-3 text-left transition-colors hover:border-[#111827]/12 hover:bg-[#FAFAFB]"
    >
      <PersonaRosterAvatar
        character={node.avatar ?? null}
        size={40}
        kind={node.type === 'user' ? 'identity' : 'wechat'}
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[15px] font-medium text-[#111827]"
          style={{ fontFamily: PERSONA_SERIF }}
        >
          {node.label}
        </p>
        {node.sublabel ? (
          <p className="truncate text-[11px] text-[#9CA3AF]">{node.sublabel}</p>
        ) : null}
      </div>
      <span className="shrink-0 rounded-full bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-white">
        选择
      </span>
    </button>
  )
}

function PeerSection({
  title,
  nodes,
  onPick,
}: {
  title: string
  nodes: CrossBindingNode[]
  onPick: (node: CrossBindingNode) => void
}) {
  if (!nodes.length) return null
  return (
    <div className="space-y-2">
      <p className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#9CA3AF]">
        {title}
      </p>
      <ul className="m-0 list-none space-y-2 p-0">
        {nodes.map((node) => (
          <li key={`${node.type}:${node.id}`}>
            <PeerRow node={node} onPick={() => onPick(node)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AnchorRelationPeerPicker({
  open,
  anchorLabel,
  anchorType,
  mains,
  npcs,
  onClose,
  onPick,
}: {
  open: boolean
  anchorLabel: string
  anchorType: CrossBindingNodeType
  mains: CrossBindingNode[]
  npcs: CrossBindingNode[]
  onClose: () => void
  onPick: (peer: CrossBindingNode) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { mains, npcs }
    const match = (n: CrossBindingNode) =>
      n.label.toLowerCase().includes(q) ||
      (n.sublabel?.toLowerCase().includes(q) ?? false)
    return {
      mains: mains.filter(match),
      npcs: npcs.filter(match),
    }
  }, [mains, npcs, query])

  const total = filtered.mains.length + filtered.npcs.length
  const showNpcSection = anchorType === 'main'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1210] flex flex-col bg-[#F4F4F6]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
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
                className="rounded-xl p-2 text-[#111827] transition-colors hover:bg-[#F7F7F9]"
                aria-label="关闭"
              >
                <X className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[16px] font-medium text-[#111827]"
                  style={{ fontFamily: PERSONA_SERIF }}
                >
                  选择关系对象
                </p>
                <p className="text-[10px] text-[#9CA3AF]">
                  为「{anchorLabel}」新增关系 · {pickerHint(anchorType)}
                </p>
              </div>
            </div>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索姓名或身份标签"
                className="w-full rounded-xl border border-transparent bg-[#F7F7F8] py-2.5 pl-9 pr-3 text-[14px] text-[#111827] outline-none focus:border-[#111827]/15 focus:bg-white"
              />
            </label>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {total ? (
              <div className="space-y-5">
                <PeerSection title="主要角色" nodes={filtered.mains} onPick={onPick} />
                {showNpcSection ? (
                  <PeerSection title="次要 / NPC" nodes={filtered.npcs} onPick={onPick} />
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl bg-white px-5 py-14 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                <p className="text-[15px] font-medium text-[#111827]" style={{ fontFamily: PERSONA_SERIF }}>
                  {query.trim() ? '无匹配角色' : '暂无可选对象'}
                </p>
                <p className="mt-2 text-[12px] text-[#9CA3AF]">
                  {query.trim()
                    ? '换个关键词试试'
                    : '已与名册内全部角色建立关系，或请先在其它 Tab 创建角色。'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
