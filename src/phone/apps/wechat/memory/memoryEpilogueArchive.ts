import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { personaDb } from '../newFriendsPersona/idb'
import {
  hasChatAfterWorldBookItems,
  listChatAfterWorldBookItems,
} from '../newFriendsPersona/worldBookAfterPatch'
import { loadDatingPlotsFromKv } from '../unifiedMemoryAutoSummary'
import type { MemoryCharacterRosterItem } from './memoryArchiveTypes'

export type EpilogueArchiveEntry = {
  worldBookId: string
  itemId: string
  bookName: string
  itemName: string
  contentRaw: string
  contentDisplay: string
  contentPreviousRaw?: string
  contentPreviousDisplay?: string
}

export type EpilogueArchiveRosterItem = MemoryCharacterRosterItem & {
  entryCount: number
  lastUpdatedAt: number
}

function resolveDisplayName(
  charId: string,
  charNameById: Map<string, string>,
  contactByCharId: Map<string, WeChatContactRow>,
): { displayName: string; wechatRemarkName?: string; avatarUrl?: string } {
  const contact = contactByCharId.get(charId)
  const realName = charNameById.get(charId)?.trim()
  const remark = contact?.remarkName?.trim()
  const displayName = realName || remark || charId.slice(0, 8)
  return {
    displayName,
    ...(remark && realName && remark !== realName ? { wechatRemarkName: remark } : {}),
    ...(contact?.avatarUrl ? { avatarUrl: contact.avatarUrl } : {}),
  }
}

/** 记忆档案馆 · 尾声延展：按角色聚合 roster */
export async function buildEpilogueArchiveRoster(params: {
  contacts: WeChatContactRow[]
}): Promise<EpilogueArchiveRosterItem[]> {
  const chars = await personaDb.listCharacters()
  const charNameById = new Map<string, string>()
  for (const c of chars) {
    const id = c.id?.trim()
    const name = c.name?.trim() || c.wechatNickname?.trim()
    if (id && name) charNameById.set(id, name)
  }

  const contactByCharId = new Map<string, WeChatContactRow>()
  for (const c of params.contacts) {
    const id = c.id?.trim()
    if (id) contactByCharId.set(id, c)
  }

  const items: EpilogueArchiveRosterItem[] = []
  for (const ch of chars) {
    const charId = ch.id?.trim()
    if (!charId || !hasChatAfterWorldBookItems(ch)) continue
    const hasCharacter = charNameById.has(charId)
    const hasContact = contactByCharId.has(charId)
    if (!hasCharacter && !hasContact) continue

    const entries = listChatAfterWorldBookItems(ch)
    if (!entries.length) continue

    const { displayName, wechatRemarkName, avatarUrl } = resolveDisplayName(
      charId,
      charNameById,
      contactByCharId,
    )

    items.push({
      charId,
      displayName,
      wechatRemarkName,
      avatarUrl,
      memoryCount: entries.length,
      entryCount: entries.length,
      sceneTags: [],
      hasLinked: false,
      hasOwn: true,
      lastUpdatedAt: ch.updatedAt ?? 0,
    })
  }

  items.sort(
    (a, b) => b.lastUpdatedAt - a.lastUpdatedAt || a.displayName.localeCompare(b.displayName, 'zh'),
  )
  return items
}

export async function loadEpilogueArchiveForCharacter(characterId: string): Promise<EpilogueArchiveEntry[]> {
  const cid = characterId.trim()
  if (!cid) return []
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return []
  const rows = listChatAfterWorldBookItems(ch)
  const out: EpilogueArchiveEntry[] = []
  for (const row of rows) {
    const prevRaw = row.contentPrevious?.trim() ?? ''
    const [contentDisplay, itemNameDisplay, bookNameDisplay, contentPreviousDisplay] = await Promise.all([
      personaDb.expandStoryTimelineTextForDisplay(cid, row.content),
      personaDb.expandStoryTimelineTextForDisplay(cid, row.itemName),
      personaDb.expandStoryTimelineTextForDisplay(cid, row.bookName),
      prevRaw ? personaDb.expandStoryTimelineTextForDisplay(cid, prevRaw) : Promise.resolve(''),
    ])
    out.push({
      worldBookId: row.worldBookId,
      itemId: row.itemId,
      bookName: bookNameDisplay.trim() || row.bookName,
      itemName: itemNameDisplay.trim() || row.itemName,
      contentRaw: row.content,
      contentDisplay,
      ...(prevRaw
        ? {
            contentPreviousRaw: prevRaw,
            contentPreviousDisplay: contentPreviousDisplay.trim() || prevRaw,
          }
        : {}),
    })
  }
  return out
}

/** 手动对齐：尽力取最近一条 AI 私聊或约会剧情正文 */
export async function gatherLatestRoundBodyForEpilogue(characterId: string): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''

  try {
    const chatRows = await personaDb.listWeChatChatMessagesRecentByCharacter({
      characterId: cid,
      limit: 16,
    })
    for (let i = chatRows.length - 1; i >= 0; i--) {
      const m = chatRows[i]
      if (m?.type === 'character') {
        const text = String(m.content ?? '').trim()
        if (text.length >= 8) return text
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const plots = await loadDatingPlotsFromKv(cid)
    for (let i = plots.length - 1; i >= 0; i--) {
      const p = plots[i]
      if (!p) continue
      const text = String(p.content ?? '').trim()
      if (text.length >= 8) return text
    }
  } catch {
    /* ignore */
  }

  return ''
}
