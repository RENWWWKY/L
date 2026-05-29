import { personaDb } from '../../idb'
import type { Character, PlayerIdentity, Relationship } from '../../types'
import { uid } from '../../utils'
import { formatPlayerIdentityDisplayName } from '../../../wechatCharacterPlayerIdentity'
import { playerIdentityProfessionTag } from '../personaRosterDisplay'
import { boundMainCharId, isMainCharacter } from '../personaRosterTypes'
import type {
  CrossBindingNode,
  CrossBindingNodeType,
  CrossBindingPerspectiveCard,
  CrossBindingSubTabId,
  RelationshipEdge,
} from './crossBindingTypes'

export function nodeKey(type: CrossBindingNodeType, id: string): string {
  return `${type}:${id.trim()}`
}

export function parseNodeKey(key: string): { type: CrossBindingNodeType; id: string } | null {
  const [type, ...rest] = key.split(':')
  const id = rest.join(':').trim()
  if ((type === 'user' || type === 'main' || type === 'npc') && id) return { type, id }
  return null
}

export function buildCrossBindingRegistry(params: {
  identityList: PlayerIdentity[]
  mainCharacters: Character[]
  npcCharacters: Character[]
  identityNameById: Record<string, string>
}): Map<string, CrossBindingNode> {
  const map = new Map<string, CrossBindingNode>()
  for (const u of params.identityList) {
    const id = u.id.trim()
    if (!id) continue
    map.set(nodeKey('user', id), {
      id,
      type: 'user',
      label: params.identityNameById[id] || formatPlayerIdentityDisplayName(u, id),
      sublabel: u.wechatNickname?.trim() ? `@${u.wechatNickname.trim()}` : undefined,
      avatar: u,
      professionTag: playerIdentityProfessionTag(u),
      raw: u,
    })
  }
  for (const c of params.mainCharacters) {
    const id = c.id.trim()
    if (!id) continue
    map.set(nodeKey('main', id), {
      id,
      type: 'main',
      label: c.name?.trim() || '未命名',
      sublabel: c.identity?.trim() ? `[ ${c.identity.trim()} ]` : undefined,
      avatar: c,
      raw: c,
    })
  }
  for (const c of params.npcCharacters) {
    const id = c.id.trim()
    if (!id) continue
    map.set(nodeKey('npc', id), {
      id,
      type: 'npc',
      label: c.name?.trim() || '未命名',
      sublabel: c.identity?.trim() ? `[ ${c.identity.trim()} ]` : undefined,
      avatar: c,
      raw: c,
    })
  }
  return map
}

function resolveNodeType(id: string, registry: Map<string, CrossBindingNode>): CrossBindingNodeType | null {
  for (const t of ['user', 'main', 'npc'] as const) {
    if (registry.has(nodeKey(t, id))) return t
  }
  return null
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::')
}

export type PlayerNetworkLinkLabels = {
  relationYouToThem: string
  relationThemToYou: string
}

const DEFAULT_PI_RELATION = '联系人'

function pickPiRelationLabel(dbRel?: string, networkRel?: string): string {
  const network = networkRel?.trim()
  const db = dbRel?.trim()
  if (network && (!db || db === DEFAULT_PI_RELATION)) return network
  if (db) return db
  return network || DEFAULT_PI_RELATION
}

export async function loadPlayerNetworkLinkLabelMap(
  mainCharacters: Character[],
  npcCharacters: Character[],
): Promise<Map<string, PlayerNetworkLinkLabels>> {
  const map = new Map<string, PlayerNetworkLinkLabels>()
  const roots = new Set<string>()
  for (const c of mainCharacters) {
    const id = c.id.trim()
    if (id) roots.add(id)
  }
  for (const c of npcCharacters) {
    const rootId = boundMainCharId(c)
    if (rootId) roots.add(rootId)
  }
  for (const rootId of roots) {
    const links = await personaDb.getPlayerNetworkLinks(rootId)
    for (const link of links) {
      const cid = link.characterId.trim()
      if (!cid) continue
      map.set(cid, {
        relationYouToThem: link.relationYouToThem,
        relationThemToYou: link.relationThemToYou,
      })
    }
  }
  return map
}

async function syncPlayerNetworkLinkLabels(
  charId: string,
  relationYouToThem: string,
  relationThemToYou: string,
  registry: Map<string, CrossBindingNode>,
): Promise<void> {
  const node = registry.get(nodeKey('main', charId)) ?? registry.get(nodeKey('npc', charId))
  const raw = node?.raw as Character | undefined
  if (!raw) return
  const rootId = boundMainCharId(raw) || charId
  const links = await personaDb.getPlayerNetworkLinks(rootId)
  const idx = links.findIndex((l) => l.characterId === charId)
  if (idx < 0) return
  const next = [...links]
  next[idx] = { ...next[idx], relationYouToThem, relationThemToYou }
  await personaDb.putPlayerNetworkLinks(rootId, next)
}

export function relationLabelFromAnchor(edge: RelationshipEdge, anchorId: string): string {
  const involvesUser = edge.sourceType === 'user' || edge.targetType === 'user'
  const fallback = involvesUser ? DEFAULT_PI_RELATION : '认识'
  if (edge.sourceId === anchorId) {
    return edge.forwardRelationLabel.trim() || fallback
  }
  if (edge.targetId === anchorId) {
    return edge.reverseRelationLabel?.trim() || edge.forwardRelationLabel.trim() || fallback
  }
  return edge.forwardRelationLabel.trim() || fallback
}

export function graphRelationLabel(edge: RelationshipEdge, focusNodeKey: string | null): string {
  if (!focusNodeKey) return edge.forwardRelationLabel.trim() || '关系'
  const parsed = parseNodeKey(focusNodeKey)
  if (!parsed) return edge.forwardRelationLabel.trim() || '关系'
  return relationLabelFromAnchor(edge, parsed.id)
}

export function applyAnchorRelationEdit(
  edge: RelationshipEdge,
  anchorId: string,
  label: string,
): RelationshipEdge {
  const trimmed = label.trim() || '认识'
  if (edge.sourceId === anchorId) {
    return { ...edge, forwardRelationLabel: trimmed }
  }
  if (edge.targetId === anchorId) {
    return { ...edge, reverseRelationLabel: trimmed }
  }
  return { ...edge, forwardRelationLabel: trimmed }
}

export function relationshipsToEdges(
  relationships: Relationship[],
  registry: Map<string, CrossBindingNode>,
  playerLinkLabels: Map<string, PlayerNetworkLinkLabels> = new Map(),
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = []
  const piRelsByPair = new Map<string, Relationship[]>()
  const charRelsByPair = new Map<string, Relationship[]>()

  for (const r of relationships) {
    const fromType = resolveNodeType(r.fromCharacterId, registry)
    const toType = resolveNodeType(r.toCharacterId, registry)
    if (!fromType || !toType) continue

    if (r.isPlayerIdentity) {
      const pk = pairKey(r.fromCharacterId, r.toCharacterId)
      const list = piRelsByPair.get(pk) ?? []
      list.push(r)
      piRelsByPair.set(pk, list)
      continue
    }

    const pk = pairKey(r.fromCharacterId, r.toCharacterId)
    const list = charRelsByPair.get(pk) ?? []
    list.push(r)
    charRelsByPair.set(pk, list)
  }

  for (const rels of piRelsByPair.values()) {
    const userToChar = rels.find((r) => resolveNodeType(r.fromCharacterId, registry) === 'user')
    const charToUser = rels.find((r) => resolveNodeType(r.fromCharacterId, registry) !== 'user')
    const seed = userToChar ?? charToUser
    if (!seed) continue
    const fromType = resolveNodeType(seed.fromCharacterId, registry)
    const userId = fromType === 'user' ? seed.fromCharacterId : seed.toCharacterId
    const charId = fromType === 'user' ? seed.toCharacterId : seed.fromCharacterId
    const charType = fromType === 'user' ? resolveNodeType(seed.toCharacterId, registry)! : fromType!
    const network = playerLinkLabels.get(charId)
    edges.push({
      id: `pi-${pairKey(userId, charId)}`,
      sourceId: userId,
      targetId: charId,
      sourceType: 'user',
      targetType: charType,
      forwardRelationLabel: pickPiRelationLabel(userToChar?.relation, network?.relationYouToThem),
      reverseRelationLabel: pickPiRelationLabel(charToUser?.relation, network?.relationThemToYou),
      forwardRelId: userToChar?.id ?? `rel-pi-${userId}-${charId}-a`,
      reverseRelId: charToUser?.id ?? `rel-pi-${userId}-${charId}-b`,
      isMutual: true,
    })
  }

  for (const rels of charRelsByPair.values()) {
    const primary = rels[0]
    if (!primary) continue
    const reverse = rels.find(
      (r) =>
        r.fromCharacterId === primary.toCharacterId &&
        r.toCharacterId === primary.fromCharacterId,
    )
    const fromType = resolveNodeType(primary.fromCharacterId, registry)
    const toType = resolveNodeType(primary.toCharacterId, registry)
    if (!fromType || !toType) continue
    edges.push({
      id: primary.id,
      sourceId: primary.fromCharacterId,
      targetId: primary.toCharacterId,
      sourceType: fromType,
      targetType: toType,
      forwardRelationLabel: primary.relation?.trim() || '认识',
      reverseRelationLabel: reverse?.relation?.trim() || undefined,
      forwardRelId: primary.id,
      reverseRelId: reverse?.id,
      isMutual: !!reverse,
    })
  }

  return edges
}

async function deleteCharacterPairRelationships(charIdA: string, charIdB: string): Promise<void> {
  const all = await personaDb.listAllRelationships()
  const toDelete = all.filter(
    (r) =>
      !r.isPlayerIdentity &&
      ((r.fromCharacterId === charIdA && r.toCharacterId === charIdB) ||
        (r.fromCharacterId === charIdB && r.toCharacterId === charIdA)),
  )
  for (const r of toDelete) {
    await personaDb.deleteRelationshipById(r.id)
  }
}

export function edgeVisibleToAnchor(edge: RelationshipEdge, anchorId: string): boolean {
  if (edge.sourceId === anchorId) return true
  if (edge.targetId === anchorId) return edge.isMutual
  return false
}

/** 聚焦视角下应完整显示的头像（中心 + 与其有可见关系绑定的节点） */
export function neighborNodeKeysForGraphFocus(
  focusKey: string | null,
  edges: RelationshipEdge[],
): Set<string> | null {
  if (!focusKey) return null
  const parsed = parseNodeKey(focusKey)
  if (!parsed) return new Set([focusKey])
  const anchorId = parsed.id
  const keys = new Set<string>([focusKey])
  for (const edge of edges) {
    const involves = edge.sourceId === anchorId || edge.targetId === anchorId
    if (!involves || !edgeVisibleToAnchor(edge, anchorId)) continue
    keys.add(nodeKey(edge.sourceType, edge.sourceId))
    keys.add(nodeKey(edge.targetType, edge.targetId))
  }
  return keys
}

export function hasReverseCharacterRelationship(
  allRels: ReadonlyArray<Relationship>,
  r: Relationship,
): boolean {
  const from = r.fromCharacterId.trim()
  const to = r.toCharacterId.trim()
  return allRels.some(
    (x) =>
      !x.isPlayerIdentity &&
      x.fromCharacterId === to &&
      x.toCharacterId === from,
  )
}

/** 角色↔角色边从 focus 视角是否应注入聊天 prompt（与 edgeVisibleToAnchor 一致；圈内旁观仅见双向边） */
export function characterRelVisibleInChatPrompt(
  r: Relationship,
  focusId: string,
  allRels: ReadonlyArray<Relationship>,
): boolean {
  if (r.isPlayerIdentity) return false
  const focus = focusId.trim()
  const mutual = hasReverseCharacterRelationship(allRels, r)
  if (r.fromCharacterId === focus) return true
  if (r.toCharacterId === focus) return mutual
  return mutual
}

/** 单向关系时以当前视角角色为发起方（source），对方为被连线方（target） */
export function orientEdgeWithInitiator(
  edge: RelationshipEdge,
  initiatorId: string,
  registry: Map<string, CrossBindingNode>,
): RelationshipEdge {
  if (edge.isMutual) return edge
  if (edge.sourceId === initiatorId) {
    return { ...edge, reverseRelationLabel: undefined, reverseRelId: undefined }
  }
  const peerId = edge.sourceId
  const initiatorNode =
    registry.get(nodeKey('user', initiatorId)) ??
    registry.get(nodeKey('main', initiatorId)) ??
    registry.get(nodeKey('npc', initiatorId))
  const peerNode =
    registry.get(nodeKey('user', peerId)) ??
    registry.get(nodeKey('main', peerId)) ??
    registry.get(nodeKey('npc', peerId))
  if (!initiatorNode || !peerNode) return edge
  return {
    ...edge,
    sourceId: initiatorId,
    targetId: peerId,
    sourceType: initiatorNode.type,
    targetType: peerNode.type,
    forwardRelationLabel: relationLabelFromAnchor(edge, initiatorId),
    reverseRelationLabel: undefined,
    forwardRelId: edge.reverseRelId ?? edge.forwardRelId,
    reverseRelId: undefined,
    isMutual: false,
  }
}

export function edgesForAnchor(
  anchor: CrossBindingNode,
  edges: RelationshipEdge[],
): RelationshipEdge[] {
  return edges.filter((e) => edgeVisibleToAnchor(e, anchor.id))
}

export function otherNodeOnEdge(edge: RelationshipEdge, anchorId: string, registry: Map<string, CrossBindingNode>): CrossBindingNode | null {
  const otherId = edge.sourceId === anchorId ? edge.targetId : edge.sourceId
  const otherType = edge.sourceId === anchorId ? edge.targetType : edge.sourceType
  return registry.get(nodeKey(otherType, otherId)) ?? null
}

export function buildPerspectiveCards(
  subTab: CrossBindingSubTabId,
  registry: Map<string, CrossBindingNode>,
  edges: RelationshipEdge[],
): CrossBindingPerspectiveCard[] {
  const type: CrossBindingNodeType = subTab === 'user' ? 'user' : subTab === 'main' ? 'main' : 'npc'
  const anchors = [...registry.values()].filter((n) => n.type === type)
  anchors.sort((a, b) => a.label.localeCompare(b.label, 'zh'))
  return anchors.map((anchor) => ({
    anchor,
    edges: edgesForAnchor(anchor, edges),
  }))
}

export async function persistRelationshipEdge(
  edge: RelationshipEdge,
  registry: Map<string, CrossBindingNode>,
): Promise<void> {
  const forwardLabel = edge.forwardRelationLabel.trim() || '认识'
  const reverseLabel = edge.isMutual ? edge.reverseRelationLabel?.trim() || forwardLabel : forwardLabel

  const involvesUser = edge.sourceType === 'user' || edge.targetType === 'user'
  if (involvesUser) {
    const userId = edge.sourceType === 'user' ? edge.sourceId : edge.targetId
    const charId = edge.sourceType === 'user' ? edge.targetId : edge.sourceId
    const piForward = edge.forwardRelationLabel.trim() || DEFAULT_PI_RELATION
    const piReverse = edge.reverseRelationLabel?.trim() || piForward

    const all = await personaDb.listAllRelationships()
    const existingA = all.find((r) => r.id === `rel-pi-${userId}-${charId}-a`)
    const existingB = all.find((r) => r.id === `rel-pi-${userId}-${charId}-b`)

    await personaDb.bulkPutRelationships([
      {
        id: `rel-pi-${userId}-${charId}-a`,
        fromCharacterId: userId,
        toCharacterId: charId,
        relation: piForward,
        fromPerspective: existingA?.fromPerspective ?? '',
        toPerspective: existingA?.toPerspective ?? '',
        fromCallsTo: existingA?.fromCallsTo ?? '',
        isPlayerIdentity: true,
      },
      {
        id: `rel-pi-${userId}-${charId}-b`,
        fromCharacterId: charId,
        toCharacterId: userId,
        relation: piReverse,
        fromPerspective: existingB?.fromPerspective ?? '',
        toPerspective: existingB?.toPerspective ?? '',
        fromCallsTo: existingB?.fromCallsTo ?? '',
        isPlayerIdentity: true,
      },
    ])
    await syncPlayerNetworkLinkLabels(charId, piForward, piReverse, registry)
    return
  }

  const all = await personaDb.listAllRelationships()
  const existingForward = all.find((r) => r.id === edge.forwardRelId)
  const existingReverse = edge.reverseRelId ? all.find((r) => r.id === edge.reverseRelId) : undefined

  const forward: Relationship = {
    id: edge.forwardRelId || uid('rel'),
    fromCharacterId: edge.sourceId,
    toCharacterId: edge.targetId,
    relation: forwardLabel,
    fromPerspective: existingForward?.fromPerspective ?? '',
    toPerspective: existingForward?.toPerspective ?? '',
    fromCallsTo: existingForward?.fromCallsTo ?? '',
    isPlayerIdentity: false,
  }
  await personaDb.putRelationship(forward)
  if (edge.isMutual) {
    const reverseId = edge.reverseRelId ?? `rel-${edge.targetId}-${edge.sourceId}-rev`
    await personaDb.putRelationship({
      id: reverseId,
      fromCharacterId: edge.targetId,
      toCharacterId: edge.sourceId,
      relation: reverseLabel,
      fromPerspective: existingReverse?.fromPerspective ?? '',
      toPerspective: existingReverse?.toPerspective ?? '',
      fromCallsTo: existingReverse?.fromCallsTo ?? '',
      isPlayerIdentity: false,
    })
  } else {
    for (const r of all) {
      if (
        !r.isPlayerIdentity &&
        r.fromCharacterId === edge.targetId &&
        r.toCharacterId === edge.sourceId
      ) {
        await personaDb.deleteRelationshipById(r.id)
      }
    }
  }
}

export function findEdgeBetweenNodes(
  edges: RelationshipEdge[],
  anchor: CrossBindingNode,
  peer: CrossBindingNode,
): RelationshipEdge | undefined {
  return edges.find(
    (edge) =>
      (edge.sourceId === anchor.id &&
        edge.targetId === peer.id &&
        edge.sourceType === anchor.type &&
        edge.targetType === peer.type) ||
      (edge.sourceId === peer.id &&
        edge.targetId === anchor.id &&
        edge.sourceType === peer.type &&
        edge.targetType === anchor.type),
  )
}

export type EligibleRelationPeers = {
  mains: CrossBindingNode[]
  npcs: CrossBindingNode[]
}

/**
 * 主角 / NPC 视角下可新建、且尚未连线的对象（仅角色间关系）。
 * - 主角：其它主角 + NPC（主角↔主角、主角↔NPC）
 * - NPC：仅主要角色（主角↔NPC，不含 NPC↔NPC、不含用户身份）
 */
export function listEligiblePeersForNewRelation(
  anchor: CrossBindingNode,
  registry: Map<string, CrossBindingNode>,
  edges: RelationshipEdge[],
): EligibleRelationPeers {
  const mains: CrossBindingNode[] = []
  const npcs: CrossBindingNode[] = []
  if (anchor.type !== 'main' && anchor.type !== 'npc') {
    return { mains, npcs }
  }

  for (const node of registry.values()) {
    if (node.id === anchor.id && node.type === anchor.type) continue
    if (findEdgeBetweenNodes(edges, anchor, node)) continue
    if (node.type === 'user') continue

    if (anchor.type === 'npc') {
      if (node.type === 'main') mains.push(node)
      continue
    }
    if (node.type === 'main') mains.push(node)
    else if (node.type === 'npc') npcs.push(node)
  }

  const byLabel = (a: CrossBindingNode, b: CrossBindingNode) =>
    a.label.localeCompare(b.label, 'zh')
  mains.sort(byLabel)
  npcs.sort(byLabel)
  return { mains, npcs }
}

export function createDraftEdgeFromAnchorToPeer(
  anchor: CrossBindingNode,
  peer: CrossBindingNode,
): RelationshipEdge {
  const involvesUser = anchor.type === 'user' || peer.type === 'user'
  if (involvesUser) {
    const userNode = anchor.type === 'user' ? anchor : peer
    const charNode = anchor.type === 'user' ? peer : anchor
    const userId = userNode.id
    const charId = charNode.id
    return {
      id: `pi-${pairKey(userId, charId)}`,
      sourceId: userId,
      targetId: charId,
      sourceType: 'user',
      targetType: charNode.type,
      forwardRelationLabel: DEFAULT_PI_RELATION,
      reverseRelationLabel: DEFAULT_PI_RELATION,
      forwardRelId: `rel-pi-${userId}-${charId}-a`,
      reverseRelId: `rel-pi-${userId}-${charId}-b`,
      isMutual: true,
    }
  }
  const relId = uid('rel')
  return {
    id: relId,
    sourceId: anchor.id,
    targetId: peer.id,
    sourceType: anchor.type,
    targetType: peer.type,
    forwardRelationLabel: '认识',
    forwardRelId: relId,
    isMutual: false,
  }
}

export async function deleteRelationshipEdge(edge: RelationshipEdge): Promise<void> {
  if (edge.sourceType === 'user' || edge.targetType === 'user') {
    const userId = edge.sourceType === 'user' ? edge.sourceId : edge.targetId
    const charId = edge.sourceType === 'user' ? edge.targetId : edge.sourceId
    await personaDb.deletePlayerIdentityBinding(userId, charId)
    const full = await personaDb.getCharacter(charId)
    if (full?.playerIdentityId === userId) {
      await personaDb.upsertCharacter({ ...full, playerIdentityId: undefined, updatedAt: Date.now() })
    }
    return
  }
  await deleteCharacterPairRelationships(edge.sourceId, edge.targetId)
}

export function inferNodeTypeFromCharacter(c: Character): CrossBindingNodeType {
  if (boundMainCharId(c)) return 'npc'
  if (isMainCharacter(c)) return 'main'
  return 'main'
}
