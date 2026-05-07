import type {
  Character,
  CharacterMemory,
  PlayerNetworkLink,
  Relationship,
  WeChatChatMessage,
} from '../wechat/newFriendsPersona/types'
import type { ChatConversationSettingsRow, CharacterDanmakuSettingsRow, NetworkGraphViewRecord } from '../wechat/newFriendsPersona/types'
import type { IndexedTrashEntry } from './indexedTrashTypes'

const WECHAT_DATING_ARCHIVES_KV_KEY = 'wechat-dating-archives-v1'

export type PersonaDbTrashSource = {
  listNpcsFor: (id: string) => Promise<Character[]>
  getCharacter: (id: string) => Promise<Character | null>
  listWeChatChatMessagesByCharacterIds: (ids: string[]) => Promise<WeChatChatMessage[]>
  listAllRelationships: () => Promise<Relationship[]>
  listAllCharacterMemories: () => Promise<CharacterMemory[]>
  getPhoneKv: (key: string) => Promise<unknown | null>
  listAllChatConversationSettings: () => Promise<ChatConversationSettingsRow[]>
  getCharacterDanmakuSettings: (characterId: string) => Promise<CharacterDanmakuSettingsRow | null>
  listAllNetworkGraphViews: () => Promise<NetworkGraphViewRecord[]>
  getRawPlayerLinksRow: (
    rootCharacterId: string,
  ) => Promise<{ rootCharacterId: string; links: PlayerNetworkLink[]; updatedAt: number } | null>
}

export type CharacterFullTrashPayload = {
  rootCharacterId: string
  characters: Character[]
  relationships: Relationship[]
  messages: WeChatChatMessage[]
  memories: CharacterMemory[]
  datingArchiveEntry: unknown | null
  conversationSettings: ChatConversationSettingsRow[]
  danmakuRows: CharacterDanmakuSettingsRow[]
  graphViews: NetworkGraphViewRecord[]
  playerLinksRow: { rootCharacterId: string; links: PlayerNetworkLink[]; updatedAt: number } | null
}

export async function buildCharacterFullTrashArchive(
  db: PersonaDbTrashSource,
  rootId: string,
): Promise<Omit<IndexedTrashEntry, 'id' | 'deletedAt' | 'expiresAt'> | null> {
  const id = rootId.trim()
  if (!id) return null
  const npcs = await db.listNpcsFor(id)
  const idsToRemove = new Set<string>([id, ...npcs.map((n) => n.id)])

  const characters: Character[] = []
  for (const cid of idsToRemove) {
    const c = await db.getCharacter(cid)
    if (c) characters.push(c)
  }
  const messages = await db.listWeChatChatMessagesByCharacterIds([...idsToRemove])
  const allRels = await db.listAllRelationships()
  const relationships = allRels.filter((r) => idsToRemove.has(r.fromCharacterId) || idsToRemove.has(r.toCharacterId))
  const allMem = await db.listAllCharacterMemories()
  const memories = allMem.filter((m) => idsToRemove.has(m.characterId))

  const datingRaw = await db.getPhoneKv(WECHAT_DATING_ARCHIVES_KV_KEY)
  let datingArchiveEntry: unknown | null = null
  if (datingRaw && typeof datingRaw === 'object' && !Array.isArray(datingRaw)) {
    const arch = datingRaw as Record<string, unknown>
    datingArchiveEntry = arch[id] ?? null
  }

  const allConv = await db.listAllChatConversationSettings()
  const conversationSettings = allConv.filter((row) => idsToRemove.has(row.peerCharacterId))

  const danmakuRows: CharacterDanmakuSettingsRow[] = []
  for (const cid of idsToRemove) {
    const d = await db.getCharacterDanmakuSettings(cid)
    if (d) danmakuRows.push(d)
  }

  const allGv = await db.listAllNetworkGraphViews()
  const graphViews = allGv.filter(
    (row) => row.rootCharacterId === id || idsToRemove.has(row.perspectiveCharacterId),
  )

  const playerLinksRow = await db.getRawPlayerLinksRow(id)

  const label = characters.find((c) => c.id === id)?.name?.trim() || id
  const summary = `${characters.length} 个角色档案 · ${messages.length} 条消息 · ${memories.length} 条记忆`

  const payload: CharacterFullTrashPayload = {
    rootCharacterId: id,
    characters,
    relationships,
    messages,
    memories,
    datingArchiveEntry,
    conversationSettings,
    danmakuRows,
    graphViews,
    playerLinksRow,
  }

  return {
    kind: 'character-full',
    title: `删除角色「${label}」`,
    summary,
    payload,
  }
}
