import { personaDb } from '../wechat/newFriendsPersona/idb'
import { listChatAfterWorldBookItems } from '../wechat/newFriendsPersona/worldBookAfterPatch'
import type { Character } from '../wechat/newFriendsPersona/types'

export type LivePersonaSnapshot = {
  characterId: string
  displayName: string
  /** 姓名/身份/简介等基础信息（后台参考，勿直接念出） */
  baseSummary: string
  /** 序言介入摘要（后台参考） */
  prologueSummary: string
  /** 尾声延展摘要（后台参考） */
  epilogueSummary: string
  /** 可念出口的短态度（已清占位符、无条目名） */
  speakableAttitude: string
  /** 可念出口的性格底色短句 */
  speakableTone: string
  /** 兼容旧字段：等同 speakableTone */
  toneHint: string
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/** 把世界书正文收成「能当口语」的短句，去掉条目名与 {{user}}/{{char}} */
export function sanitizePersonaSpeakable(
  raw: string,
  opts?: { charName?: string; userName?: string; max?: number },
): string {
  let t = String(raw ?? '')
  // 去掉「未命名世界书·xxx」这类条目标签
  t = t.replace(/「[^」]*世界书[^」]*」/g, '')
  t = t.replace(/【[^】]*】/g, '')
  t = t.replace(/世界书[「『]?[^」』\s·]*[」』]?[·・]?/g, '')
  // 占位符
  const user = opts?.userName?.trim() || '你'
  const char = opts?.charName?.trim() || '我'
  t = t.replace(/\{\{\s*user\s*\}\}/gi, user)
  t = t.replace(/\{\{\s*char\s*\}\}/gi, char)
  t = t.replace(/\{\{\s*id:[^}]+\}\}/gi, '')
  t = t.replace(/\{\{[^}]+\}\}/g, '')
  // 残留符号
  t = t.replace(/[|｜]/g, '，')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/^[，、；：:\-—\s]+|[，、；：:\-—\s]+$/g, '')
  return clip(t, opts?.max ?? 36)
}

function listPrologueItems(
  character: Character,
): Array<{ bookName: string; itemName: string; content: string }> {
  const out: Array<{ bookName: string; itemName: string; content: string }> = []
  for (const w of character.worldBooks ?? []) {
    if (!w?.enabled) continue
    const bookName = String(w.name ?? '').trim() || '世界书'
    for (const it of w.items ?? []) {
      if (!it?.enabled || it.priority !== 'before') continue
      const body = String(it.content ?? '').trim()
      if (!body) continue
      out.push({
        bookName,
        itemName: String(it.name ?? '').trim() || '条目',
        content: body.slice(0, 360),
      })
    }
  }
  return out
}

function summarizeItems(
  rows: Array<{ bookName: string; itemName: string; content: string }>,
  maxItems: number,
  eachMax: number,
): string {
  return rows
    .slice(0, maxItems)
    .map((r) => `「${r.bookName}·${r.itemName}」${clip(r.content, eachMax)}`)
    .join('；')
}

export function buildLivePersonaSnapshot(
  character: Character,
  opts?: { userName?: string },
): LivePersonaSnapshot {
  const displayName =
    String(character.wechatNickname ?? '').trim() ||
    String(character.name ?? '').trim() ||
    '主播'
  const baseParts = [
    `姓名/昵称：${displayName}`,
    character.identity?.trim() ? `身份：${clip(character.identity, 80)}` : '',
    character.bio?.trim() ? `简介：${clip(character.bio, 120)}` : '',
    character.motto?.trim() ? `座右铭：${clip(character.motto, 60)}` : '',
  ].filter(Boolean)

  const prologue = listPrologueItems(character)
  const epilogue = listChatAfterWorldBookItems(character).map((r) => ({
    bookName: r.bookName,
    itemName: r.itemName,
    content: r.content,
  }))

  const prologueSummary = summarizeItems(prologue, 4, 72)
  const epilogueSummary = summarizeItems(epilogue, 5, 72)

  const speakOpts = { charName: displayName, userName: opts?.userName, max: 34 }
  const speakableAttitude =
    sanitizePersonaSpeakable(epilogue[0]?.content ?? '', speakOpts) ||
    sanitizePersonaSpeakable(character.motto ?? '', speakOpts)
  const speakableTone =
    sanitizePersonaSpeakable(prologue[0]?.content ?? '', speakOpts) ||
    sanitizePersonaSpeakable(character.identity ?? '', { ...speakOpts, max: 28 }) ||
    `${displayName}，话不多`

  return {
    characterId: character.id,
    displayName,
    baseSummary: baseParts.join('；'),
    prologueSummary,
    epilogueSummary,
    speakableAttitude,
    speakableTone,
    toneHint: speakableTone,
  }
}

export async function loadLivePersonaSnapshot(
  characterId: string,
  opts?: { userName?: string },
): Promise<LivePersonaSnapshot | null> {
  const id = characterId.trim()
  if (!id) return null
  try {
    const ch = await personaDb.getCharacter(id)
    if (!ch) return null
    return buildLivePersonaSnapshot(ch, opts)
  } catch {
    return null
  }
}
