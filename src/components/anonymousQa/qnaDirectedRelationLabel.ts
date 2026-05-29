import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'
import { resolvePrivateChatNetworkRootId } from '../../phone/apps/wechat/privateChatNetworkNpcPronoun'

/** 评论区只展示关系档位，不拼接称呼（fromCallsTo） */
function formatRelationEdge(edge: Relationship): string {
  return (edge.relation || '').trim() || '圈内羁绊'
}

/** UI 展示：去掉旧数据里「关系 · 称呼」的称呼段，只保留关系 */
export function relationLabelForDisplay(label: string): string {
  const t = label.trim()
  if (!t) return ''
  const beforeCall = t.split('·')[0]?.trim() ?? t
  return beforeCall.split(/[\/|]/)[0]?.trim() || beforeCall
}

/** 答主与围观角色在人脉网中的关系标签（无配置则 undefined） */
export async function resolveRelationLabelBetweenCharacters(
  focusCharacterId: string,
  otherCharacterId: string,
): Promise<string | undefined> {
  const focusId = focusCharacterId.trim()
  const otherId = otherCharacterId.trim()
  if (!focusId || !otherId || focusId === otherId) return undefined

  const focus = await personaDb.getCharacter(focusId)
  if (!focus) return undefined
  const rootId = await resolvePrivateChatNetworkRootId(focus)
  if (!rootId) return undefined

  let rels: Relationship[] = []
  try {
    const npcs = await personaDb.listNpcsFor(rootId)
    const cliqueIds = [...new Set([rootId, focusId, otherId, ...npcs.map((n) => n.id)])]
    rels = await personaDb.listRelationshipsInNetwork(cliqueIds)
  } catch {
    return undefined
  }

  const edge = rels.find(
    (r) =>
      !r.isPlayerIdentity &&
      ((r.fromCharacterId === focusId && r.toCharacterId === otherId) ||
        (r.fromCharacterId === otherId && r.toCharacterId === focusId)),
  )
  if (!edge) return undefined
  return formatRelationEdge(edge)
}

export async function enrichDirectedCommentsWithRelationLabels<
  T extends { authorCharacterId?: string },
>(params: {
  targetCharacterId: string
  comments: T[]
}): Promise<Array<T & { relationLabel?: string }>> {
  const focusId = params.targetCharacterId.trim()
  if (!focusId) return params.comments

  const out: Array<T & { relationLabel?: string }> = []
  for (const c of params.comments) {
    const oid = c.authorCharacterId?.trim()
    if (!oid) {
      out.push({ ...c })
      continue
    }
    const relationLabel = await resolveRelationLabelBetweenCharacters(focusId, oid)
    out.push(relationLabel ? { ...c, relationLabel } : { ...c })
  }
  return out
}
