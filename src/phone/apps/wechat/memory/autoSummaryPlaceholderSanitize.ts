/**
 * 自动总结入库前：把模型仍写出的档案显示名/昵称替换为 {{user}}/{{char}}/{{archive_char}}/{{id:…}}，
 * 避免正文落库为纯汉字专名（提示词无法 100% 约束时由程序兜底）。
 * 仅替换「已知人设/身份」上的称呼串；不处理手动编辑的正文。
 */

import { personaDb } from '../newFriendsPersona/idb'
import type { Character, GroupChatRow, PlayerIdentity } from '../newFriendsPersona/types'
import type { WorldBookUserInsertContext } from '../charUserPlaceholders'
import {
  attachMemoryUserPlaceholderBindings,
  type SanitizedMemoryBody,
} from '../memoryUserPlaceholderBindings'
import { WECHAT_GROUP_BOT_CHARACTER_ID, WECHAT_GROUP_USER_CHAR_ID } from '../wechatConversationKey'
import { normalizeMemorySummaryBodyAfterModel } from './memorySummaryContentNormalize'

const MIN_TOKEN_LEN = 2

function displayTokensForCharacter(ch: Character | PlayerIdentity | null | undefined): string[] {
  if (!ch) return []
  const out: string[] = []
  for (const k of ['name', 'wechatNickname', 'remark'] as const) {
    const t = String((ch as Character)[k] ?? '').trim()
    if (t.length >= MIN_TOKEN_LEN) out.push(t)
  }
  return [...new Set(out)]
}

/** 不破坏已有 {{…}} 块内的文本 */
function replaceOutsidePlaceholders(content: string, token: string, replacement: string): string {
  if (!token || token.length < MIN_TOKEN_LEN || !content) return content
  if (!content.includes(token)) return content
  const parts = content.split(/(\{\{[^}]+\}\})/g)
  return parts
    .map((seg, idx) => {
      if (idx % 2 === 1) return seg
      return seg.split(token).join(replacement)
    })
    .join('')
}

function mergeRules(ordered: Array<{ token: string; ph: string }>): Array<{ token: string; ph: string }> {
  const m = new Map<string, string>()
  for (const r of ordered) {
    const t = r.token.trim()
    if (t.length < MIN_TOKEN_LEN) continue
    if (!m.has(t)) m.set(t, r.ph)
  }
  return [...m.entries()]
    .map(([token, ph]) => ({ token, ph }))
    .sort((a, b) => b.token.length - a.token.length)
}

function applyRules(body: string, rules: Array<{ token: string; ph: string }>): string {
  let s = body
  for (const { token, ph } of rules) {
    s = replaceOutsidePlaceholders(s, token, ph)
  }
  return s
}

function pushCharRules(out: Array<{ token: string; ph: string }>, ch: Character | PlayerIdentity | null, ph: string) {
  for (const t of displayTokensForCharacter(ch)) out.push({ token: t, ph })
}

async function loadPlayerIdentityForPeer(peerCharacterId: string): Promise<PlayerIdentity | null> {
  try {
    const row = await personaDb.getCharacter(peerCharacterId.trim())
    const pid = row?.playerIdentityId?.trim()
    if (pid && pid !== '__none__') {
      const iden = await personaDb.getPlayerIdentity(pid)
      if (iden) return iden
    }
    return await personaDb.getCurrentIdentity()
  } catch {
    return null
  }
}

/** 合并总结 primary：挂在当前私聊/约会对象 cid 下 */
export async function sanitizeUnifiedPrimaryMemoryBody(
  body: string,
  peerCharacterId: string,
  archiveRootId: string,
  userBindCtx?: WorldBookUserInsertContext | null,
): Promise<SanitizedMemoryBody> {
  const peer = peerCharacterId.trim()
  const arch = (archiveRootId.trim() || peer).trim()
  if (!peer || !String(body ?? '').trim()) {
    return { content: body, userPlaceholderBindings: [] }
  }

  let text = normalizeMemorySummaryBodyAfterModel(body)

  const ordered: Array<{ token: string; ph: string }> = []
  if (userBindCtx) {
    const dn = userBindCtx.displayName?.trim()
    if (dn.length >= MIN_TOKEN_LEN) ordered.push({ token: dn, ph: '{{user}}' })
  } else {
    pushCharRules(ordered, await loadPlayerIdentityForPeer(peer), '{{user}}')
  }
  pushCharRules(ordered, await personaDb.getCharacter(peer), '{{char}}')
  if (arch && arch !== peer) {
    pushCharRules(ordered, await personaDb.getCharacter(arch), '{{archive_char}}')
  }
  let npcs: Character[] = []
  try {
    npcs = await personaDb.listNpcsFor(arch)
  } catch {
    npcs = []
  }
  for (const n of npcs) {
    const nid = n.id.trim()
    if (!nid || nid === peer) continue
    pushCharRules(ordered, n, `{{id:${nid}}}`)
  }
  const content = applyRules(text, mergeRules(ordered))
  return attachMemoryUserPlaceholderBindings({ content, userPlaceholderBindings: [] }, userBindCtx ?? null)
}

/** 关联记忆 linked：挂在人脉 NPC，存档根为 linkedFrom */
export async function sanitizeUnifiedLinkedMemoryBody(
  body: string,
  linkedNpcId: string,
  archiveRootId: string,
  datingPeerCharacterId: string,
  userBindCtx?: WorldBookUserInsertContext | null,
): Promise<SanitizedMemoryBody> {
  const npc = linkedNpcId.trim()
  const arch = archiveRootId.trim()
  const peer = datingPeerCharacterId.trim()
  if (!npc || !String(body ?? '').trim()) {
    return { content: body, userPlaceholderBindings: [] }
  }

  let text = normalizeMemorySummaryBodyAfterModel(body)

  const ordered: Array<{ token: string; ph: string }> = []
  if (userBindCtx) {
    const dn = userBindCtx.displayName?.trim()
    if (dn.length >= MIN_TOKEN_LEN) ordered.push({ token: dn, ph: '{{user}}' })
  } else {
    pushCharRules(ordered, await loadPlayerIdentityForPeer(peer), '{{user}}')
  }
  pushCharRules(ordered, await personaDb.getCharacter(npc), '{{char}}')
  if (arch) pushCharRules(ordered, await personaDb.getCharacter(arch), '{{archive_char}}')

  let npcs: Character[] = []
  try {
    npcs = await personaDb.listNpcsFor(arch || npc)
  } catch {
    npcs = []
  }
  for (const n of npcs) {
    const nid = n.id.trim()
    if (!nid || nid === npc) continue
    pushCharRules(ordered, n, `{{id:${nid}}}`)
  }
  if (peer && peer !== npc && peer !== arch) {
    pushCharRules(ordered, await personaDb.getCharacter(peer), `{{id:${peer}}}`)
  }
  const content = applyRules(text, mergeRules(ordered))
  return attachMemoryUserPlaceholderBindings({ content, userPlaceholderBindings: [] }, userBindCtx ?? null)
}

/** 群聊总结：他人一律 {{id:…}}，玩家 {{user}} */
export async function sanitizeGroupMemorySummaryBody(
  body: string,
  group: GroupChatRow | null,
  playerIdentityId: string,
  userBindCtx?: WorldBookUserInsertContext | null,
): Promise<SanitizedMemoryBody> {
  if (!String(body ?? '').trim() || !group?.members?.length) {
    return { content: body, userPlaceholderBindings: [] }
  }

  let text = normalizeMemorySummaryBodyAfterModel(body)

  const ordered: Array<{ token: string; ph: string }> = []
  if (userBindCtx) {
    const dn = userBindCtx.displayName?.trim()
    if (dn.length >= MIN_TOKEN_LEN) ordered.push({ token: dn, ph: '{{user}}' })
  } else {
    const pid = playerIdentityId.trim()
    let userIden: PlayerIdentity | null = null
    if (pid) {
      try {
        userIden = await personaDb.getPlayerIdentity(pid)
      } catch {
        userIden = null
      }
    }
    if (!userIden) {
      try {
        userIden = await personaDb.getCurrentIdentity()
      } catch {
        userIden = null
      }
    }
    pushCharRules(ordered, userIden, '{{user}}')
  }

  for (const mem of group.members) {
    const cid = mem.charId.trim()
    if (!cid || cid === WECHAT_GROUP_USER_CHAR_ID || cid === WECHAT_GROUP_BOT_CHARACTER_ID) continue
    let ch: Character | null = null
    try {
      ch = await personaDb.getCharacter(cid)
    } catch {
      ch = null
    }
    const gn = (mem.groupNickname || '').trim()
    if (gn.length >= MIN_TOKEN_LEN) ordered.push({ token: gn, ph: `{{id:${cid}}}` })
    pushCharRules(ordered, ch, `{{id:${cid}}}`)
  }
  const content = applyRules(text, mergeRules(ordered))
  return attachMemoryUserPlaceholderBindings({ content, userPlaceholderBindings: [] }, userBindCtx ?? null)
}

/** 仅私聊摘录总结（如好友申请）：玩家 + 对方人设 */
export async function sanitizePrivateMemorySummaryBody(
  body: string,
  peerCharacterId: string,
  userBindCtx?: WorldBookUserInsertContext | null,
): Promise<SanitizedMemoryBody> {
  const peer = peerCharacterId.trim()
  if (!peer || !String(body ?? '').trim()) {
    return { content: body, userPlaceholderBindings: [] }
  }
  let text = normalizeMemorySummaryBodyAfterModel(body)
  const ordered: Array<{ token: string; ph: string }> = []
  if (userBindCtx) {
    const dn = userBindCtx.displayName?.trim()
    if (dn.length >= MIN_TOKEN_LEN) ordered.push({ token: dn, ph: '{{user}}' })
  } else {
    pushCharRules(ordered, await loadPlayerIdentityForPeer(peer), '{{user}}')
  }
  pushCharRules(ordered, await personaDb.getCharacter(peer), '{{char}}')
  const content = applyRules(text, mergeRules(ordered))
  return attachMemoryUserPlaceholderBindings({ content, userPlaceholderBindings: [] }, userBindCtx ?? null)
}
