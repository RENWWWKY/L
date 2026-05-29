import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import { relationLabelFromAnchor } from './crossBindingEngine'
import type { CrossBindingNode, RelationshipEdge } from './crossBindingTypes'

function NodeMini({ node, align }: { node: CrossBindingNode; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <PersonaRosterAvatar
        character={node.avatar ?? null}
        size={36}
        kind={node.type === 'user' ? 'identity' : 'wechat'}
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-medium text-[#111827]"
          style={{ fontFamily: PERSONA_SERIF }}
        >
          {node.label}
        </p>
        {node.sublabel ? (
          <p className="truncate text-[10px] text-[#9CA3AF]">{node.sublabel}</p>
        ) : null}
      </div>
    </div>
  )
}

export function RelationshipRow({
  anchor,
  edge,
  peer,
}: {
  anchor: CrossBindingNode
  edge: RelationshipEdge
  peer: CrossBindingNode
}) {
  const left = anchor
  const right = peer
  const label = relationLabelFromAnchor(edge, anchor.id)

  return (
    <div className="flex w-full items-center gap-2 rounded-2xl bg-[#FAFAFB]/90 px-2 py-3">
      <div className="min-w-0 flex-[2]">
        <NodeMini node={left} align="left" />
      </div>

      <div className="flex min-w-0 flex-[3] flex-col items-center px-1">
        <div className="h-px w-full border-t border-dashed border-[#D1D5DB]" />
        <span className="-mt-2.5 whitespace-nowrap rounded-full border border-gray-100 bg-white px-2 py-0.5 text-[10px] text-[#374151] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {label || '未命名关系'}
        </span>
        {edge.isMutual ? (
          <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#9CA3AF]">互相认识</span>
        ) : (
          <span className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[#C4C4C4]">单方面认识</span>
        )}
      </div>

      <div className="min-w-0 flex-[2]">
        <NodeMini node={right} align="right" />
      </div>
    </div>
  )
}
