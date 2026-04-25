export type MirrorWeChatTab = 'chats' | 'contacts' | 'moments' | 'profile'

export type MirrorWeChatContact = {
  id: string
  nickname: string
  remarkName: string
  avatarUrl?: string
  isStarred?: boolean
  blocked?: boolean
  characterId?: string
  /** 额外联系人：与生成同次模型输出，供长期记忆 */
  relationshipNote?: string
  remarkWhy?: string
  messages: Array<{
    from: 'player' | 'character'
    content: string
    timestamp: number
    special?:
      | { kind: 'red_packet'; amountYuan?: number; remark?: string; opened?: boolean }
      | { kind: 'transfer'; transferId?: string; amountYuan?: number; note?: string; status?: 'pending' | 'accepted' | 'returned' }
      | { kind: 'sticker'; label?: string; imageUrl?: string }
      | { kind: 'image'; imageUrl?: string; mime?: string }
  }>
}

export type MirrorWeChatMoment = {
  id: string
  content: string
  visibility: string
  likes: string[]
  comments: Array<{ from: string; content: string }>
}

export type MirrorWeChatBill = {
  id: string
  date: string
  target: string
  amount: number
  remark: string
}

export type MirrorWeChatAffectionCard = {
  id: string
  holder: string
  limit: number
  spent: number
}

export type MirrorWeChatProfile = {
  nickname: string
  avatarUrl?: string
  signature: string
}

export type MirrorWeChatState = {
  profile: MirrorWeChatProfile | null
  contacts: MirrorWeChatContact[]
  moments: MirrorWeChatMoment[]
  bills: MirrorWeChatBill[]
  affectionCards: MirrorWeChatAffectionCard[]
  /** 含 `me`（我页）等与同步 scope 对应的键，便于与 IndexedDB 缓存一致 */
  lastGeneratedAt: Partial<Record<string, number>>
}

export type MirrorWeChatGenerateForm = {
  count: number
  bias: string
  includeBlocked?: boolean
  includeHideFromUser?: boolean
  includeOnlyTaVisible?: boolean
}
