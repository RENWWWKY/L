import { motion } from 'framer-motion'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import { CrossBindingPerspectiveCard } from './CrossBindingPerspectiveCard'
import { buildPerspectiveCards } from './crossBindingEngine'
import type { CrossBindingStore } from './useCrossBindingStore'
import type { CrossBindingNode, CrossBindingSubTabId } from './crossBindingTypes'

export function CrossBindingListMode({
  subTab,
  store,
  onOpenTextEditor,
  onOpenGraph,
}: {
  subTab: CrossBindingSubTabId
  store: CrossBindingStore
  onOpenTextEditor: (anchor: CrossBindingNode) => void
  onOpenGraph: (anchor: CrossBindingNode) => void
}) {
  const cards = buildPerspectiveCards(subTab, store.registry, store.edges)

  if (store.loading && !cards.length) {
    return (
      <p className="py-10 text-center text-[11px] uppercase tracking-[0.2em] text-[#9CA3AF]">
        SYNCING RELATIONS…
      </p>
    )
  }

  if (!cards.length) {
    return (
      <div className="rounded-3xl bg-white px-5 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <p className="text-[15px] font-medium text-[#111827]" style={{ fontFamily: PERSONA_SERIF }}>
          暂无关系节点
        </p>
        <p className="mt-2 text-[12px] text-[#9CA3AF]">请先在其它 Tab 创建角色或身份，再在此建立关系。</p>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {cards.map(({ anchor, edges }, index) => (
        <CrossBindingPerspectiveCard
          key={`${anchor.type}:${anchor.id}`}
          anchor={anchor}
          edges={edges}
          store={store}
          onOpenTextEditor={onOpenTextEditor}
          onOpenGraph={onOpenGraph}
          coachMarkers={
            index === 0
              ? {
                  card: 'sample-perspective-card',
                  graph: 'open-graph',
                  text: 'open-text-edit',
                }
              : undefined
          }
        />
      ))}
    </motion.div>
  )
}
