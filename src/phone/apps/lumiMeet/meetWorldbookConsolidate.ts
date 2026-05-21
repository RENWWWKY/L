import type { WorldBook } from '../wechat/newFriendsPersona/types'

function isMeetTruthMirrorWorldBookId(characterId: string, worldBookId: string): boolean {
  return worldBookId === `meet-wb-${characterId.trim()}-vol12`
}

function isMeetSyncedWorldBookId(characterId: string, worldBookId: string): boolean {
  const p = `meet-wb-${characterId.trim()}`
  if (worldBookId === p) return true
  if (isMeetTruthMirrorWorldBookId(characterId, worldBookId)) return false
  return worldBookId.startsWith(`${p}-vol`)
}

function worldBookRichness(wb: WorldBook): number {
  const items = wb.items ?? []
  let score = items.length * 3
  for (const it of items) {
    const body = String(it.content ?? '').replace(/\u200b/g, '').trim()
    if (body && body !== '（尚无归档）' && body !== '（档案待补全）') score += 12
    if (String(it.name ?? '').trim()) score += 1
  }
  return score
}

function isEmptyMeetShellBook(characterId: string, wb: WorldBook): boolean {
  const cid = characterId.trim()
  if (!cid) return false
  const isMeetVol =
    isMeetSyncedWorldBookId(cid, wb.id) || isMeetTruthMirrorWorldBookId(cid, wb.id)
  if (!isMeetVol) return false
  const items = wb.items ?? []
  if (items.length === 0) return true
  return items.every((it) => {
    const body = String(it.content ?? '').replace(/\u200b/g, '').trim()
    return !body || body === '（尚无归档）' || body === '（档案待补全）'
  })
}

/** 人设 worldBooks 是否存在重复 id（遇见同步曾写入空 vol11/vol12 壳层导致） */
export function worldBooksHaveDuplicateIds(worldBooks: WorldBook[]): boolean {
  const ids = worldBooks.map((w) => w.id)
  return new Set(ids).size !== ids.length
}

/**
 * 合并重复世界书 id（保留条目更充实的一册），并剔除空的遇见 vol11/vol12 壳层。
 * 写入人设库或打开编辑页前应调用一次，修复历史存档。
 */
export function consolidateMeetCharacterWorldBooks(
  characterId: string,
  worldBooks: WorldBook[],
): WorldBook[] {
  const cid = characterId.trim()
  if (!cid || !worldBooks.length) return worldBooks

  const order: string[] = []
  const byId = new Map<string, WorldBook>()
  for (const wb of worldBooks) {
    const prev = byId.get(wb.id)
    if (!prev) {
      byId.set(wb.id, wb)
      order.push(wb.id)
      continue
    }
    byId.set(wb.id, worldBookRichness(wb) >= worldBookRichness(prev) ? wb : prev)
  }

  const out: WorldBook[] = []
  for (const id of order) {
    const wb = byId.get(id)!
    if (isEmptyMeetShellBook(cid, wb)) continue
    out.push(wb)
  }
  return out
}

export function meetWorldbooksNeedConsolidation(characterId: string, worldBooks: WorldBook[]): boolean {
  if (worldBooksHaveDuplicateIds(worldBooks)) return true
  const consolidated = consolidateMeetCharacterWorldBooks(characterId, worldBooks)
  return consolidated.length !== worldBooks.length
}
