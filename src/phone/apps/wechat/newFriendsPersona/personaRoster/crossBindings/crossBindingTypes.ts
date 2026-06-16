import type { Character, PlayerIdentity } from '../../types'

export type CrossBindingNodeType = 'user' | 'main' | 'npc'

export type CrossBindingSubTabId = 'user' | 'main' | 'npc'

export const CROSS_BINDING_SUB_TABS: ReadonlyArray<{
  id: CrossBindingSubTabId
  en: string
  zh: string
}> = [
  { id: 'user', en: 'USER', zh: '用户视角' },
  { id: 'main', en: 'MAIN', zh: '主角视角' },
  { id: 'npc', en: 'NPC', zh: '次要/NPC' },
] as const

/** 有向关系的一端：关系词、称呼与双方看法 */
export type RelationshipDirectionDraft = {
  relation: string
  fromCallsTo: string
  fromPerspective: string
  toPerspective: string
}

/** 图谱连线编辑时的双向草稿（source→target / target→source） */
export type RelationshipEdgeDrafts = {
  forward: RelationshipDirectionDraft
  reverse?: RelationshipDirectionDraft
}

/** 列表与拓扑图共享的关系边（含双向各自的关系词） */
export interface RelationshipEdge {
  id: string
  sourceId: string
  targetId: string
  sourceType: CrossBindingNodeType
  targetType: CrossBindingNodeType
  /** source → target：target 是 source 的「关系词」 */
  forwardRelationLabel: string
  /** target → source：source 是 target 的「关系词」（双向时有值） */
  reverseRelationLabel?: string
  forwardRelId: string
  reverseRelId?: string
  /** true：双方互相认识；false：仅 source 单方面认识 target */
  isMutual: boolean
}

export type CrossBindingNode = {
  id: string
  type: CrossBindingNodeType
  label: string
  sublabel?: string
  avatar?: Pick<Character, 'avatarUrl' | 'mbti'>
  professionTag?: string | null
  raw: PlayerIdentity | Character
}

export type CrossBindingPerspectiveCard = {
  anchor: CrossBindingNode
  edges: RelationshipEdge[]
}

/** 关系图谱画布布局快照（节点坐标 + 视口平移/缩放） */
export type CrossBindingGraphLayoutSnapshot = {
  positions: Record<string, { x: number; y: number }>
  viewportPan: { x: number; y: number }
  viewportZoom: number
}

/** IndexedDB：按视角锚点持久化的关系图谱布局 */
export type CrossBindingGraphLayoutRecord = CrossBindingGraphLayoutSnapshot & {
  id: string
  anchorType: CrossBindingNodeType
  anchorId: string
  updatedAt: number
}
