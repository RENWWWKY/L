import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { personaDb } from '../newFriendsPersona/idb'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import { SHARED_RECORD_PLAYER_ORIGIN_ID } from '../favorites/sharedRecordOrigin'
import type { AlbumDisplayItem } from './albumItemTypes'
import { resolveAlbumItemImageUrl } from './resolveAlbumItemImageUrl'

const PLAYER_SOURCE_NAME = '我'

async function resolveSourceName(characterId: string, nameByCharId: Map<string, string>): Promise<string> {
  const id = characterId.trim()
  if (!id || id === SHARED_RECORD_PLAYER_ORIGIN_ID) return PLAYER_SOURCE_NAME
  if (nameByCharId.has(id)) return nameByCharId.get(id)!.trim() || '未命名'
  const canon = (await resolveCanonicalCharacterId(id)) || id
  if (nameByCharId.has(canon)) return nameByCharId.get(canon)!.trim() || '未命名'
  try {
    const ch = await personaDb.getCharacter(canon)
    const name = ch?.name?.trim() || '未命名'
    nameByCharId.set(id, name)
    nameByCharId.set(canon, name)
    return name
  } catch {
    return '未命名'
  }
}

export async function loadAlbumItems(contacts?: readonly WeChatContactRow[]): Promise<AlbumDisplayItem[]> {
  const rows = await personaDb.listWeChatAlbumItems()
  const nameByCharId = new Map<string, string>()
  for (const c of contacts ?? []) {
    const id = c.id.trim()
    if (!id) continue
    nameByCharId.set(id, c.remarkName?.trim() || '未命名')
  }

  const items: AlbumDisplayItem[] = []
  for (const row of rows) {
    const imageUrl = (await resolveAlbumItemImageUrl(row))?.trim()
    if (!imageUrl) continue
    const sourceCharacterId =
      row.senderKind === 'player' ? SHARED_RECORD_PLAYER_ORIGIN_ID : row.characterId.trim()
    const sourceName = await resolveSourceName(sourceCharacterId, nameByCharId)
    const caption = row.caption?.trim() ?? ''
    items.push({
      id: row.id,
      messageId: row.messageId,
      imageUrl,
      sourceName,
      senderKind: row.senderKind,
      timestamp: row.timestamp,
      savedAt: row.savedAt,
      isSticker: caption.startsWith('[表情包]'),
    })
  }
  return items
}
