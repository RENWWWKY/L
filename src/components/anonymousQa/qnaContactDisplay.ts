import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { Character } from '../../phone/apps/wechat/newFriendsPersona/types'
import { defaultPersonaContactRemarkFromCharacter } from '../../phone/apps/wechat/wechatPersonaContactsSync'
import type { MockContact } from './types'
import { namesMatch } from './qnaThreadReplyRouting'

/** 评论区展示名：与微信通讯录一致（备注优先，无备注则微信昵称） */
export function contactDisplayLabel(c: MockContact): string {
  return c.remarkName.trim() || '未命名'
}

export type QnaContactDisplayIndex = {
  /** characterId → 评论区展示名（备注 / 昵称） */
  displayByCharId: Map<string, string>
  /** 备注、昵称、人设姓名等别名 → characterId */
  aliasToCharId: Map<string, string>
}

function registerAlias(
  index: QnaContactDisplayIndex,
  charId: string,
  display: string,
  alias: string,
) {
  const a = alias.trim()
  if (!a || !charId) return
  if (!index.displayByCharId.has(charId)) {
    index.displayByCharId.set(charId, display.trim() || a)
  }
  index.aliasToCharId.set(a, charId)
}

/** 构建备注/昵称展示索引，并收录人设姓名、微信昵称等别名供匹配与纠错 */
export async function buildQnaContactDisplayIndex(
  contacts: MockContact[],
): Promise<QnaContactDisplayIndex> {
  const index: QnaContactDisplayIndex = {
    displayByCharId: new Map(),
    aliasToCharId: new Map(),
  }

  for (const c of contacts) {
    const cid = c.characterId?.trim()
    if (!cid) continue
    const display = contactDisplayLabel(c)
    registerAlias(index, cid, display, display)

    const ch = (await personaDb.getCharacter(cid)) as Character | null
    if (!ch) continue
    if (ch.name?.trim()) registerAlias(index, cid, display, ch.name)
    if (ch.wechatNickname?.trim()) registerAlias(index, cid, display, ch.wechatNickname)
    if (ch.remark?.trim()) registerAlias(index, cid, display, ch.remark)
    registerAlias(index, cid, display, defaultPersonaContactRemarkFromCharacter(ch))
  }

  return index
}

/** 将 AI 返回的 authorName / replyToName 规范为通讯录展示名 */
export function resolveContactDisplayName(raw: string, index: QnaContactDisplayIndex): string {
  const t = raw.trim()
  if (!t) return ''

  const direct = index.aliasToCharId.get(t)
  if (direct) return index.displayByCharId.get(direct) ?? t

  for (const [alias, cid] of index.aliasToCharId) {
    if (namesMatch(alias, t)) return index.displayByCharId.get(cid) ?? t
  }

  return t
}

export function resolveCharacterIdByDisplayName(
  raw: string,
  index: QnaContactDisplayIndex,
): string | null {
  const display = resolveContactDisplayName(raw, index)
  if (!display) return null
  const direct = index.aliasToCharId.get(display)
  if (direct) return direct
  for (const [alias, cid] of index.aliasToCharId) {
    if (namesMatch(alias, display)) return cid
  }
  return null
}
