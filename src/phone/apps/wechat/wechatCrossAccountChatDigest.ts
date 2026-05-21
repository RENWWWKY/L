import type { UserAccount } from './wechatAccountTypes'
import { resolveAccountSessionIdentityId } from './wechatAccountPersistence'
import {
  getCharacterBoundPlayerIdentityId,
  resolvePrivateChatPromptPlayerIdentityId,
} from './wechatCharacterPlayerIdentity'
import { personaDb } from './newFriendsPersona/idb'
import {
  isWechatAccountPrivateConversationKey,
  parsePrivateWeChatConversationCharacterAndSession,
  parseWechatAccountPrivateConversationKey,
  resolvePrivateWeChatStorageConversationKey,
} from './wechatConversationKey'
import { WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES } from './wechatAltAccountPrompt'
import type { MemoryPromptLineScope } from './wechatMemoryLineScope'
import {
  formatMemorySourceLineLabelFromConversationKey,
  formatPlayerLineScopeLabel,
} from './wechatMemoryLineScope'
import { WECHAT_MEMORY_LINE_SCOPE_RULES } from './wechatMemoryLineScopeRules'
import { WECHAT_NON_PRIMARY_SPEAKER_IRON_RULES } from './wechatAltAccountPrompt'
import { formatUnsummarizedPrivateChatBlock } from './wechatMemoryPromptBlocks'

/** 跨马甲注入：尽量覆盖「刚聊完、尚未总结」的最近上下文 */
const CROSS_ACCOUNT_MAX_MESSAGES = 120
const CROSS_ACCOUNT_MAX_CHARS = 3600

export type CrossAccountDigestSection = {
  wechatAccountId: string
  accountLabel: string
  conversationKey: string
}

/**
 * 发现「其它微信马甲」上与同一角色的私聊存储键（不依赖通讯录是否已同步该角色）。
 */
export async function discoverOtherAccountPrivateConversationKeys(params: {
  characterId: string
  currentAccountId: string
  currentConversationKey: string
  allAccounts: UserAccount[]
}): Promise<CrossAccountDigestSection[]> {
  const cid = params.characterId.trim()
  const curAcc = params.currentAccountId.trim()
  const curCk = params.currentConversationKey.trim()
  if (!cid || !curAcc || params.allAccounts.length <= 1) return []

  const accountById = new Map(params.allAccounts.map((a) => [a.accountId, a]))
  const keySet = new Set<string>()
  const out: CrossAccountDigestSection[] = []

  const pushKey = (key: string, accId: string) => {
    const k = key.trim()
    const aid = accId.trim()
    if (!k || !aid || k === curCk || keySet.has(k) || aid === curAcc) return
    keySet.add(k)
    const acc = accountById.get(aid)
    const label = acc
      ? `${acc.wechatId}（${acc.nickname?.trim() || aid}）`
      : aid
    out.push({ wechatAccountId: aid, accountLabel: label, conversationKey: k })
  }

  const allKeys = await personaDb.listDistinctWeChatConversationKeysFromMessages()
  for (const raw of allKeys) {
    const k = raw.trim()
    if (!k) continue
    const scoped = parseWechatAccountPrivateConversationKey(k)
    if (scoped?.characterId === cid && scoped.wechatAccountId !== curAcc) {
      pushKey(k, scoped.wechatAccountId)
      continue
    }
    if (isWechatAccountPrivateConversationKey(k)) continue
    const legacy = parsePrivateWeChatConversationCharacterAndSession(k)
    if (legacy?.characterId === cid) {
      const primary = params.allAccounts[0]
      if (primary && primary.accountId !== curAcc) {
        pushKey(k, primary.accountId)
      }
    }
  }

  const ch = await personaDb.getCharacter(cid)
  const bound = getCharacterBoundPlayerIdentityId(ch)

  for (const acc of params.allAccounts) {
    if (acc.accountId === curAcc) continue
    const sessionCandidates = new Set<string>()
    const slot = resolveAccountSessionIdentityId(acc).trim()
    if (slot) sessionCandidates.add(slot)
    const base = acc.baseIdentityId?.trim()
    if (base) sessionCandidates.add(base)
    if (bound) sessionCandidates.add(bound)
    sessionCandidates.add('__none__')

    for (const pid of sessionCandidates) {
      pushKey(resolvePrivateWeChatStorageConversationKey(cid, acc.accountId, pid), acc.accountId)
    }
    const promptPid = resolvePrivateChatPromptPlayerIdentityId(
      ch,
      slot || base || bound || '__none__',
    )
    if (promptPid) {
      pushKey(
        resolvePrivateWeChatStorageConversationKey(cid, acc.accountId, promptPid),
        acc.accountId,
      )
    }
  }

  return out
}

async function buildCrossAccountPrivateExcerptBlocks(params: {
  characterId: string
  currentAccountId: string
  currentConversationKey: string
  allAccounts: UserAccount[]
  currentScope?: MemoryPromptLineScope | null
}): Promise<string[]> {
  const sections = await discoverOtherAccountPrivateConversationKeys(params)
  if (!sections.length) return []

  const currentLabel = params.currentScope
    ? await formatPlayerLineScopeLabel(params.currentScope)
    : null

  const blocks: string[] = []
  for (const sec of sections) {
    const block = await formatUnsummarizedPrivateChatBlock({
      conversationKey: sec.conversationKey,
      maxMessages: CROSS_ACCOUNT_MAX_MESSAGES,
      maxChars: CROSS_ACCOUNT_MAX_CHARS,
    })
    if (!block.trim()) continue
    const lineLabel = parseWechatAccountPrivateConversationKey(sec.conversationKey)
      ? await formatMemorySourceLineLabelFromConversationKey(sec.conversationKey)
      : sec.accountLabel
    const sameAsCurrent =
      currentLabel &&
      lineLabel.trim().toLowerCase() === currentLabel.trim().toLowerCase()
    const contrast = sameAsCurrent
      ? '（与当前窗口同标注的存储键，仍视为**其它会话线**，勿与当前发言人混为一谈）'
      : currentLabel
        ? `（摘录发言人 = **${lineLabel}**，≠ 本窗口 **${currentLabel}**）`
        : ''
    blocks.push(
      `【其它微信线 · ${lineLabel} · 未总结私聊摘录 · 勿默认当前这位已听过】${contrast}\n${block.trim()}`,
    )
  }
  return blocks
}

export type CrossAccountPrivateDigestResult = {
  /** 拼进模型 prompt 的完整版（含分线铁则） */
  injection: string
  /** 思维溯源「游标上下文」：仅各马甲未总结聊天摘录 */
  traceExcerpts: string
}

async function wrapCrossAccountBlocksForInjection(
  blocks: string[],
  params: {
    currentScope?: MemoryPromptLineScope | null
    strangerLine?: boolean
  },
): Promise<string> {
  if (!blocks.length) return ''
  const currentLabel = params.currentScope
    ? await formatPlayerLineScopeLabel(params.currentScope)
    : null
  const intro: string[] = [
    '【其它微信号 · 未总结私聊摘录 · 分线参考】',
    currentLabel
      ? `**再次确认**：本窗口当前发言人 = **${currentLabel}**。下列每一块均来自**其它**微信账号或扮演身份，块内 user 侧「我」**不是** ${currentLabel}。`
      : '以下来自**其它微信账号 / 其它扮演身份**上与同一角色的私聊（非当前窗口发言人）。',
  ]
  if (params.strangerLine) {
    intro.push(WECHAT_NON_PRIMARY_SPEAKER_IRON_RULES)
  }
  intro.push(
    WECHAT_MEMORY_LINE_SCOPE_RULES,
    WECHAT_CROSS_ACCOUNT_OBJECTIVE_FACTS_RULES,
    '',
    blocks.join('\n\n'),
    '',
    '（↑ 勿默认当前这位已听过其它线上的私密叙述；可保持你自己日程/承诺一致。）',
  )
  return intro.join('\n')
}

/** 一次拉取：模型注入完整版 + 思维溯源摘录版 */
export async function buildCrossAccountPrivateChatDigests(params: {
  characterId: string
  currentAccountId: string
  currentConversationKey: string
  allAccounts: UserAccount[]
  currentScope?: MemoryPromptLineScope | null
  strangerLine?: boolean
}): Promise<CrossAccountPrivateDigestResult> {
  const curAcc = params.currentAccountId.trim()
  if (!curAcc || params.allAccounts.length <= 1) {
    return { injection: '', traceExcerpts: '' }
  }
  const blocks = await buildCrossAccountPrivateExcerptBlocks(params)
  if (!blocks.length) return { injection: '', traceExcerpts: '' }
  const injection = await wrapCrossAccountBlocksForInjection(blocks, params)
  return { injection, traceExcerpts: blocks.join('\n\n') }
}

/** @deprecated 优先使用 {@link buildCrossAccountPrivateChatDigests} */
export async function formatCrossAccountPrivateChatDigestsForOtherAccounts(params: {
  characterId: string
  currentAccountId: string
  currentConversationKey: string
  allAccounts: UserAccount[]
  currentScope?: MemoryPromptLineScope | null
  strangerLine?: boolean
}): Promise<string> {
  return (await buildCrossAccountPrivateChatDigests(params)).injection
}
