import type { JubenshaScript } from '../types'

import type { DeckRoleCard } from './gameFlowTypes'
import { resolveRoleScriptCover } from './roleScriptCovers'

const TAROT_POOL: { tarotLabel: string; tarotLabelZh: string; totem: string }[] = [
  { tarotLabel: 'Ⅰ. The Fool', tarotLabelZh: '愚者', totem: '◇' },
  { tarotLabel: 'Ⅱ. The Empress', tarotLabelZh: '女皇', totem: '☽' },
  { tarotLabel: 'Ⅲ. The High Priestess', tarotLabelZh: '女祭司', totem: '☾' },
  { tarotLabel: 'Ⅳ. The Emperor', tarotLabelZh: '皇帝', totem: '△' },
  { tarotLabel: 'Ⅴ. The Hierophant', tarotLabelZh: '教皇', totem: '⊕' },
  { tarotLabel: 'Ⅵ. The Lovers', tarotLabelZh: '恋人', totem: '∞' },
  { tarotLabel: 'Ⅶ. The Chariot', tarotLabelZh: '战车', totem: '▣' },
  { tarotLabel: 'Ⅷ. Justice', tarotLabelZh: '正义', totem: '⚖' },
]

function derivePublicIdentity(blurb: string): string {
  const trimmed = blurb.trim()
  const comma = trimmed.indexOf('，')
  if (comma > 0 && comma < 24) return trimmed.slice(0, comma)
  const dot = trimmed.indexOf('。')
  if (dot > 0 && dot < 24) return trimmed.slice(0, dot)
  return trimmed.length > 22 ? `${trimmed.slice(0, 20)}…` : trimmed
}

export function buildRoleDeck(script: JubenshaScript): DeckRoleCard[] {
  return script.roles.map((role, index) => {
    const archetype = TAROT_POOL[index % TAROT_POOL.length]
    return {
      id: `${script.id}-deck-${index}`,
      tarotLabel: archetype.tarotLabel,
      tarotLabelZh: archetype.tarotLabelZh,
      totem: archetype.totem,
      role,
      coverImageUrl: resolveRoleScriptCover(script.id, role.name, role.roleScriptCoverUrl),
      publicIdentity: role.publicIdentity ?? derivePublicIdentity(role.blurb),
    }
  })
}
