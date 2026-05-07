/** 本地回收站：删除的 IndexedDB 数据快照（非云端） */
export type IndexedTrashKind =
  | 'wechat-message'
  | 'wechat-conversation'
  | 'character-memory'
  | 'friend-request'
  | 'phone-kv'
  | 'world-background'
  | 'group-chat'
  | 'character-soft'
  | 'character-full'
  | 'player-identity'
  | 'npc-only'

export type IndexedTrashEntry = {
  id: string
  kind: IndexedTrashKind
  title: string
  summary: string
  deletedAt: number
  /** 超过此时间未恢复则物理清除 */
  expiresAt: number
  payload: unknown
  /** 列表展示：对方/群显示名（避免标题里出现裸 characterId） */
  peerDisplayName?: string
  /** 列表展示：微信头像或群头像 URL */
  peerAvatarUrl?: string
}
