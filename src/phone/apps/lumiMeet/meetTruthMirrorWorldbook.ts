import { personaDb, emitWeChatStorageChanged } from '../wechat/newFriendsPersona/idb'
import type { WorldBook, WorldBookItem } from '../wechat/newFriendsPersona/types'
import type { Character } from '../wechat/newFriendsPersona/types'
import { getWorldbookLoreEntriesSnapshot, removeLoreEntry } from '../../worldbook/worldbookLoreStore'
import type { MeetTruthMirrorRecordPayload } from './meetTypes'
import { consolidateMeetCharacterWorldBooks } from './meetWorldbookConsolidate'
import { rewriteMeetWorldbookNamesToPlaceholders } from './meetWorldbookPlaceholders'

/** 与旧版档案室条目 id 对应，仅用于迁移清理 */
export function getMeetTruthMirrorLoreEntryId(characterId: string): string {
  return `meet-truth-mirror-log-${characterId.trim()}`
}

export const MEET_TRUTH_MIRROR_WORLD_BOOK_TITLE = '12 TRUTH | 交换真心话纪要'

export function getMeetTruthMirrorWorldBookId(characterId: string): string {
  return `meet-wb-${characterId.trim()}-vol12`
}

export function isMeetTruthMirrorWorldBookId(characterId: string, worldBookId: string): boolean {
  return worldBookId === getMeetTruthMirrorWorldBookId(characterId)
}

const TRUTH_SECTION_SEP = '\n\n---\n\n'
const MAX_TRUTH_SECTIONS = 48
const MAX_TRUTH_FIELD_CHARS = 1600

function clampTruthField(s: string): string {
  const t = String(s ?? '').trim()
  if (!t) return ''
  const arr = Array.from(t)
  if (arr.length <= MAX_TRUTH_FIELD_CHARS) return t
  return `${arr.slice(0, MAX_TRUTH_FIELD_CHARS - 1).join('')}…`
}

function trimTruthMirrorSections(merged: string): string {
  const t = merged.trim()
  if (!t) return ''
  const parts = t.split(TRUTH_SECTION_SEP).filter(Boolean)
  if (parts.length <= MAX_TRUTH_SECTIONS) return parts.join(TRUTH_SECTION_SEP)
  return parts.slice(-MAX_TRUTH_SECTIONS).join(TRUTH_SECTION_SEP)
}

function mkTruthMirrorItem(npcId: string, nickname: string, content: string, now: number): WorldBookItem {
  return {
    id: `meet-wb-${npcId.trim()}-vol12-item01`,
    name: '交换真心话归档',
    enabled: true,
    priority: 'before',
    keywords: `真心话 ${nickname} 双盲 TRUTH`,
    content: content.trim() || '（尚无归档）',
    updatedAt: now,
    collapsed: false,
  }
}

export function buildMeetTruthMirrorWorldBook(
  npcId: string,
  nickname: string,
  content: string,
  now: number,
): WorldBook {
  return {
    id: getMeetTruthMirrorWorldBookId(npcId),
    name: MEET_TRUTH_MIRROR_WORLD_BOOK_TITLE,
    enabled: true,
    collapsed: false,
    items: [mkTruthMirrorItem(npcId, nickname, content, now)],
  }
}

/** 从角色人设世界书读取真心话纪要正文 */
export function readMeetTruthMirrorContentFromCharacterWorldBooks(
  worldBooks: WorldBook[] | undefined,
  characterId: string,
): string {
  const wb = worldBooks?.find((w) => w.id === getMeetTruthMirrorWorldBookId(characterId))
  const item = wb?.items?.find((it) => it.enabled !== false) ?? wb?.items?.[0]
  return String(item?.content ?? '').trim()
}

function migrateTruthMirrorFromLoreArchive(characterId: string): string {
  const loreId = getMeetTruthMirrorLoreEntryId(characterId)
  const prev = getWorldbookLoreEntriesSnapshot().find((e) => e.id === loreId)?.content?.trim() ?? ''
  if (prev) removeLoreEntry(loreId)
  return prev
}

/**
 * 将一次「交换真心话」结果追加到该角色的人设世界书 vol12（不进全局档案室）。
 */
export async function appendMeetTruthMirrorToCharacterWorldbook(params: {
  characterId: string
  charNickname: string
  charRealName?: string | null
  playerDisplayName?: string
  record: MeetTruthMirrorRecordPayload
}): Promise<void> {
  const cid = params.characterId.trim()
  if (!cid) return
  const q = clampTruthField(params.record.question)
  const ua = clampTruthField(params.record.userAnswer)
  const na = clampTruthField(params.record.npcAnswer)
  if (!q && !ua && !na) return

  const ts = new Date().toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
  const rawSection = [
    `## 交换真心话 · ${ts}`,
    q ? `**题目**：${q}` : '',
    na ? `**{{char}} 的真心**：${na}` : '',
    ua ? `**{{user}} 的真心**：${ua}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const sectionRewritten = rewriteMeetWorldbookNamesToPlaceholders(rawSection, {
    nickname: params.charNickname,
    realName: params.charRealName,
    userDisplayName: params.playerDisplayName,
  })

  const now = Date.now()
  let ch = await personaDb.getCharacter(cid)
  const loreMigrated = migrateTruthMirrorFromLoreArchive(cid)
  const fromWb = readMeetTruthMirrorContentFromCharacterWorldBooks(ch?.worldBooks, cid)
  const prevParts = [loreMigrated, fromWb].filter(Boolean)
  const prev = prevParts.join(TRUTH_SECTION_SEP)
  const merged = prev ? `${prev}${TRUTH_SECTION_SEP}${sectionRewritten}` : sectionRewritten
  const content = trimTruthMirrorSections(merged)
  const vol12 = buildMeetTruthMirrorWorldBook(cid, params.charNickname, content, now)

  if (!ch) {
    const legal = (params.charRealName ?? params.charNickname).trim() || params.charNickname
    const stub: Character = {
      id: cid,
      createdAt: now,
      updatedAt: now,
      name: legal,
      gender: 'other',
      age: 24,
      birthdayMD: '06-15',
      zodiac: '',
      identity: '市民',
      bio: '',
      wechatNickname: params.charNickname,
      worldBooks: [vol12],
      worldBackgroundEnabled: true,
      remark: params.charNickname,
    }
    await personaDb.upsertCharacter(stub)
  } else {
    const rest = (ch.worldBooks ?? []).filter((w) => w.id !== vol12.id)
    const worldBooks = consolidateMeetCharacterWorldBooks(cid, [...rest, vol12])
    await personaDb.upsertCharacter({ ...ch, worldBooks, updatedAt: now })
  }
  emitWeChatStorageChanged()
}

/** 清除该角色人设库中的真心话分册（并清理旧档案室条目） */
export async function removeMeetTruthMirrorWorldbookForCharacter(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return
  removeLoreEntry(getMeetTruthMirrorLoreEntryId(cid))
  const ch = await personaDb.getCharacter(cid)
  if (!ch?.worldBooks?.length) return
  const wbId = getMeetTruthMirrorWorldBookId(cid)
  const rest = ch.worldBooks.filter((w) => w.id !== wbId)
  if (rest.length === ch.worldBooks.length) return
  await personaDb.upsertCharacter({ ...ch, worldBooks: rest, updatedAt: Date.now() })
  emitWeChatStorageChanged()
}
