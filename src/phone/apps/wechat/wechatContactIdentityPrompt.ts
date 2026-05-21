import type { UserAccount } from './wechatAccountTypes'
import { loadAccountsBundle } from './wechatAccountPersistence'
import { personaDb } from './newFriendsPersona/idb'
import type { PlayerIdentityLinkMeta } from './newFriendsPersona/types'
import {
  STRANGER_CONTACT_PHRASE_BAN,
  WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY,
  WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
  WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
  WECHAT_THIRD_PARTY_PSYCHOLOGY_RULES,
} from './wechatAltAccountPrompt'
import {
  formatPlayerIdentityDisplayName,
  getCharacterBoundPlayerIdentityId,
  getCharacterLinkedPlayerIdentityIds,
  shouldUseWechatHomeProfileOnlyForPrivateChat,
} from './wechatCharacterPlayerIdentity'

export function formatWechatAccountLabel(
  bundle: Awaited<ReturnType<typeof loadAccountsBundle>>,
  wechatAccountId: string | null | undefined,
): string {
  const acc = wechatAccountId?.trim()
  if (!acc) return '未标注微信账号'
  const row = bundle?.accounts.find((a) => a.accountId === acc)
  if (!row) return acc
  const nick = row.nickname?.trim() || row.wechatId?.trim() || acc
  const wx = row.wechatId?.trim()
  return wx && wx !== nick ? `${nick}（${wx}）` : nick
}

export function resolvePlayerIdentityWechatAccountId(
  character: {
    playerIdentityId?: string
    linkedPlayerIdentityIds?: string[]
    playerIdentityLinkMeta?: PlayerIdentityLinkMeta[]
  } | null | undefined,
  playerIdentityId: string,
  identityRow?: { wechatAccountId?: string } | null,
): string {
  const pid = playerIdentityId.trim()
  if (!pid) return ''
  const meta = character?.playerIdentityLinkMeta?.find((m) => m.playerIdentityId === pid)
  if (meta?.wechatAccountId?.trim()) return meta.wechatAccountId.trim()
  return identityRow?.wechatAccountId?.trim() || ''
}

/** 私聊是否注入「分线陌生人」身份说明（非主绑定档 / 跨微信账号） */
export async function shouldInjectStrangerContactIdentityPrompt(params: {
  character: { playerIdentityId?: string; linkedPlayerIdentityIds?: string[] } | null | undefined
  sessionPlayerIdentityId: string
  wechatAccountId: string | null | undefined
}): Promise<boolean> {
  const acc = params.wechatAccountId?.trim()
  if (!acc) return false
  const bundle = await loadAccountsBundle()
  const primaryAcc = bundle?.accounts[0]?.accountId?.trim()
  if (primaryAcc && primaryAcc !== acc && (bundle?.accounts.length ?? 0) > 1) return true
  return shouldUseWechatHomeProfileOnlyForPrivateChat({
    character: params.character,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId,
    wechatAccountId: acc,
  })
}

/**
 * 统一私聊/验证向模型说明：当前发言人、本线扮演马甲、档案主绑定分别属于哪个微信账号。
 * 用于避免把账号2 当成账号1 的换号或昵称撞车。
 */
export async function buildWechatPrivateContactIdentityContextBlock(params: {
  characterId: string
  wechatAccountId: string | null | undefined
  currentAccount?: UserAccount | null
  sessionPlayerIdentityId: string
  wechatHomeDisplayName: string
  wechatHomeSignature?: string
}): Promise<string> {
  const cid = params.characterId.trim()
  if (!cid) return ''
  const acc = params.wechatAccountId?.trim()
  const sessionId = params.sessionPlayerIdentityId.trim() || '__none__'
  const bundle = await loadAccountsBundle()
  const ch = await personaDb.getCharacter(cid)
  const primaryId = getCharacterBoundPlayerIdentityId(ch)
  const sessionRow =
    sessionId !== '__none__' ? await personaDb.getPlayerIdentity(sessionId) : null
  const primaryRow = primaryId ? await personaDb.getPlayerIdentity(primaryId) : null

  const sessionAcc = resolvePlayerIdentityWechatAccountId(ch, sessionId, sessionRow)
  const primaryAcc = primaryId ? resolvePlayerIdentityWechatAccountId(ch, primaryId, primaryRow) : ''

  const currentLabel = params.currentAccount
    ? `${params.currentAccount.nickname?.trim() || params.currentAccount.wechatId?.trim() || '当前号'}（${params.currentAccount.wechatId?.trim() || acc || ''}）`
    : formatWechatAccountLabel(bundle, acc)

  const sessionName = formatPlayerIdentityDisplayName(sessionRow, sessionId)
  const primaryName = formatPlayerIdentityDisplayName(primaryRow, primaryId)
  const primaryTitle = primaryRow?.identity?.trim()
  const primaryRef = primaryTitle
    ? `${primaryName}（档案职务/关系：${primaryTitle}；对话中「社长」等若语境指主绑定，即指此人）`
    : primaryName

  const lines: string[] = [
    '【本微信线 · 当前联系人（最高优先级）】',
    `你正在 **${currentLabel}** 上与对方私聊。`,
    `对方在本线微信「我」页展示：昵称「${params.wechatHomeDisplayName.trim() || '（未设置）'}」${
      params.wechatHomeSignature?.trim() ? `；签名「${params.wechatHomeSignature.trim()}」` : ''
    }。`,
    '这是**独立微信联系人**关系，默认**不是**你在其它微信号上认识的那位玩家「换号」或「小号」来访。',
    STRANGER_CONTACT_PHRASE_BAN,
  ]

  if (sessionId !== '__none__') {
    lines.push(
      `本线好友验证/私聊绑定的扮演身份：**${sessionName}**（归属微信 ${formatWechatAccountLabel(bundle, sessionAcc || acc)}）。`,
      '勿把该扮演身份的真名/职务直接当成对方微信昵称；对方是谁以本线微信资料为准。',
    )
  }

  const isPrimaryBindingLine =
    !!primaryId &&
    sessionId !== '__none__' &&
    sessionId === primaryId &&
    (!sessionAcc || !primaryAcc || sessionAcc === primaryAcc || sessionAcc === acc)

  if (isPrimaryBindingLine) {
    lines.push(
      `【本线 = 档案主绑定】当前发言人即 **${primaryName}**（${formatWechatAccountLabel(bundle, sessionAcc || acc)}）。`,
      '长期记忆与未总结摘录若带「当前微信线 · … · 扮演「…」」标题，即指**本线**；带「其它微信线」的条目来自别的账号/马甲，勿默认当前这位已听过。',
    )
  }

  if (primaryId && primaryId !== sessionId) {
    const curNick = params.wechatHomeDisplayName.trim() || '（未设置）'
    const primaryAccRow = primaryAcc ? bundle?.accounts.find((a) => a.accountId === primaryAcc) : null
    const primaryWxNick =
      primaryAccRow?.nickname?.trim() || primaryRow?.wechatNickname?.trim() || '（见主绑定号线资料）'
    const nickContrast =
      curNick.toLowerCase() === primaryWxNick.toLowerCase()
        ? `【昵称分线】当前线与主绑定线微信展示昵称系统记录均为「${curNick}」——仍视为**两个不同微信账号上的不同联系人**，禁止因此认亲或对号。`
        : `【昵称分线·铁证】当前线微信昵称「${curNick}」；主绑定所在线微信昵称「${primaryWxNick}」。**二者不同**，禁止说「微信昵称一样」「又叫${primaryWxNick}」等对号话术。`

    lines.push(
      `角色档案「主绑定」玩家：**${primaryRef}**（归属微信 ${formatWechatAccountLabel(bundle, primaryAcc)}）。`,
      nickContrast,
      `**默认**：当前发言人 ≠ ${primaryName} 本人；**禁止**称当前联系人为「社长大人」或 ${primaryName}，除非对方在本窗口明确承认。`,
      `若对方写「${primaryName}推的」「顾社长推的」= **${primaryName} 作为推荐人**把**当前这位**介绍给你。`,
      `post_accept_greeting / 验证口语：按**新加好友** ${sessionName}（微信「${curNick}」）来写，不是主绑定深夜找您。`,
      WECHAT_THIRD_PARTY_PSYCHOLOGY_RULES,
    )
  }

  if (sessionAcc && primaryAcc && sessionAcc !== primaryAcc) {
    lines.push(
      `**跨账号硬性**：${formatWechatAccountLabel(bundle, sessionAcc)} 与 ${formatWechatAccountLabel(bundle, primaryAcc)} 是**两个微信账号**；禁止默认「换号加我」「昵称跟 ${primaryName} 撞了」。`,
    )
  } else if (acc && primaryAcc && acc !== primaryAcc) {
    lines.push(
      `**跨账号硬性**：当前线 ${formatWechatAccountLabel(bundle, acc)} ≠ 主绑定所在 ${formatWechatAccountLabel(bundle, primaryAcc)}；禁止把两线混为换号。`,
    )
  }

  const linked = getCharacterLinkedPlayerIdentityIds(ch).filter((id) => id !== primaryId && id !== sessionId)
  if (linked.length) {
    const parts: string[] = []
    for (const lid of linked.slice(0, 6)) {
      const row = await personaDb.getPlayerIdentity(lid)
      const la = resolvePlayerIdentityWechatAccountId(ch, lid, row)
      parts.push(`${formatPlayerIdentityDisplayName(row, lid)}→${formatWechatAccountLabel(bundle, la)}`)
    }
    if (parts.length) {
      lines.push(`其它已关联扮演身份（各属不同微信账号，勿与当前发言人划等号）：${parts.join('；')}`)
    }
  }

  lines.push(
    WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
    WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
    WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY,
  )
  return lines.join('\n')
}

/** @deprecated 请用 {@link buildWechatPrivateContactIdentityContextBlock} */
export async function buildCharacterBoundIdentityReferenceForStrangerContact(
  characterId: string,
  ctx?: {
    wechatAccountId?: string | null
    sessionPlayerIdentityId?: string
    wechatHomeDisplayName?: string
    wechatHomeSignature?: string
    currentAccount?: UserAccount | null
  },
): Promise<string> {
  if (!ctx?.wechatAccountId?.trim()) {
    const cid = characterId.trim()
    if (!cid) return ''
    const ch = await personaDb.getCharacter(cid)
    const boundId = getCharacterBoundPlayerIdentityId(ch)
    if (!boundId) return ''
    const pi = await personaDb.getPlayerIdentity(boundId)
    if (!pi) return ''
    const name = pi.name?.trim() || pi.wechatNickname?.trim() || '主绑定玩家'
    const title = pi.identity?.trim() || ''
    const titleLine = title ? `· 档案职务/身份：${title}` : ''
    return [
      '【档案主绑定玩家（推荐人/第三人·非当前发言人）】',
      `你与该角色档案绑定的玩家是：**${name}**${titleLine ? `\n${titleLine}` : ''}`,
      `对方验证消息里「顾社长推的」「某某推的」= **这位熟人（${name}）把当前申请人介绍给你**，不是你向 TA「要名片、念叨要加对方」。`,
      WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
    ].join('\n')
  }
  return buildWechatPrivateContactIdentityContextBlock({
    characterId,
    wechatAccountId: ctx.wechatAccountId,
    currentAccount: ctx.currentAccount,
    sessionPlayerIdentityId: ctx.sessionPlayerIdentityId?.trim() || '__none__',
    wechatHomeDisplayName: ctx.wechatHomeDisplayName?.trim() || '朋友',
    wechatHomeSignature: ctx.wechatHomeSignature,
  })
}
