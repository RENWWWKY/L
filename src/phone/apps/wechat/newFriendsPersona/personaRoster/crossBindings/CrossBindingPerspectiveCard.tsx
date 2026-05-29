import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { PERSONA_COACH_TARGET_ATTR } from '../../../memory/memoryCoachTypes'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF, playerIdentityProfessionTag } from '../personaRosterDisplay'
import { otherNodeOnEdge } from './crossBindingEngine'
import { RelationshipRow } from './RelationshipRow'
import type { CrossBindingStore } from './useCrossBindingStore'
import type { CrossBindingNode, RelationshipEdge } from './crossBindingTypes'

export function CrossBindingPerspectiveCard({
  anchor,
  edges,
  store,
  onOpenTextEditor,
  onOpenGraph,
  coachMarkers,
}: {
  anchor: CrossBindingNode
  edges: RelationshipEdge[]
  store: CrossBindingStore
  onOpenTextEditor: (anchor: CrossBindingNode) => void
  onOpenGraph: (anchor: CrossBindingNode) => void
  coachMarkers?: { card?: string; graph?: string; text?: string }
}) {
  const [expanded, setExpanded] = useState(false)
  const profession =
    anchor.type === 'user' ? playerIdentityProfessionTag(anchor.raw as never) : null

  return (
    <article
      {...(coachMarkers?.card ? { [PERSONA_COACH_TARGET_ATTR]: coachMarkers.card } : {})}
      className="rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)]"
    >
      <header
        className={`flex items-center gap-3 ${expanded ? 'border-b border-dashed border-[#E5E7EB]/80 pb-3' : ''}`}
      >
        <PersonaRosterAvatar
          character={anchor.avatar ?? null}
          size={44}
          kind={anchor.type === 'user' ? 'identity' : 'wechat'}
        />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[16px] font-medium text-[#111827]"
            style={{ fontFamily: PERSONA_SERIF }}
          >
            {anchor.label}
            {profession ? (
              <span className="ml-2 text-[11px] font-normal text-[#9CA3AF]">[ {profession} ]</span>
            ) : null}
          </p>
          {anchor.sublabel ? (
            <p className="truncate text-[11px] text-[#9CA3AF]">{anchor.sublabel}</p>
          ) : null}
          {!expanded ? (
            <p className="mt-1 text-[11px] text-[#C4C4C4]">
              {edges.length ? `${edges.length} 条关系 · 点击展开查看` : '暂无关系 · 点击展开'}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 flex items-start gap-1.5">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                {...(coachMarkers?.graph ? { [PERSONA_COACH_TARGET_ATTR]: coachMarkers.graph } : {})}
                onClick={() => onOpenGraph(anchor)}
                className="rounded-full border border-[#1C1C1E]/10 bg-[#F7F7F9] px-2.5 py-1 text-[10px] font-medium text-[#111827] transition-colors hover:bg-[#EFEFEF]"
              >
                查看关系图谱
              </button>
              <button
                type="button"
                {...(coachMarkers?.text ? { [PERSONA_COACH_TARGET_ATTR]: coachMarkers.text } : {})}
                onClick={() => onOpenTextEditor(anchor)}
                className="rounded-full border border-[#1C1C1E]/10 bg-white px-2.5 py-1 text-[10px] font-medium text-[#111827] transition-colors hover:bg-[#F7F7F9]"
              >
                编辑关系
              </button>
            </div>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF]">
              {edges.length} 链
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? '收起关系列表' : '展开关系列表'}
            className="rounded-xl p-2 text-[#6B7280] transition-colors hover:bg-[#F7F7F9]"
          >
            <ChevronDown
              className={`size-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          </button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {edges.length ? (
              <ul className="mt-3 space-y-2 list-none p-0 m-0">
                {edges.map((edge) => {
                  const peer = otherNodeOnEdge(edge, anchor.id, store.registry)
                  if (!peer) return null
                  return (
                    <li key={edge.id}>
                      <RelationshipRow anchor={anchor} edge={edge} peer={peer} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[12px] text-[#9CA3AF]">暂无 outward 关系链</p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  )
}
