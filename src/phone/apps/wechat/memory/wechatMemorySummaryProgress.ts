import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import type { WeChatPersonaContact } from '../../../types'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory, GroupChatRow } from '../newFriendsPersona/types'
import {
  findAccountById,
  isSecondaryWechatAccountInBundle,
  loadAccountsBundle,
  resolveAccountSessionIdentityId,
} from '../wechatAccountPersistence'
import type { WechatAccountsBundle } from '../wechatAccountTypes'
import { resolveActivePrivateChatSessionPlayerIdentityId } from '../wechatCharacterPlayerIdentity'
import {
  groupMemoryBucketCharacterId,
  resolveGroupWeChatStorageConversationKey,
  resolvePrivateWeChatStorageConversationKey,
} from '../wechatConversationKey'
import { resolveCharacterAvatarUrl } from '../../../utils/characterAvatarUrl'
import {
  resolveAutoSummaryIntervalForCharacter,
  resolveGlobalAutoSummaryInterval,
} from './memoryAutoSummaryInterval'

export type MemoryProgressAccountScope = 'main' | 'sub'

export type MemoryProgressAccountContext = {
  accountId: string
  sessionPlayerIdentityId: string
  lineLabel: string
  contacts: WeChatContactRow[]
}

export type WechatMemorySummaryProgressRow = {
  charId: string
  displayName: string
  avatarUrl?: string
  accountLineLabel?: string
  conversationKey: string
  wechatAccountId: string
  sessionPlayerIdentityId: string
  interval: number
  roundsSinceLastSummary: number
  roundsUntilNext: number
  autoSummaryEnabled: boolean
  hasPendingChat: boolean
  memoryCount: number
}

export type WechatGroupMemorySummaryProgressRow = {
  groupId: string
  displayName: string
  avatarUrl?: string
  accountLineLabel?: string
  conversationKey: string
  wechatAccountId: string
  sessionPlayerIdentityId: string
  interval: number
  roundsSinceLastSummary: number
  roundsUntilNext: number
  autoSummaryEnabled: boolean
  hasPendingChat: boolean
  memoryCount: number
  memberCount: number
}

export function computeWechatRoundsUntilNextSummary(
  interval: number,
  roundsSinceLastSummary: number,
): number {
  const step = Math.max(1, Math.floor(interval))
  const prev = Math.max(0, Math.floor(roundsSinceLastSummary))
  return Math.max(0, step - prev)
}

export function mapPersonaContactsToProgressRows(contacts: WeChatPersonaContact[]): WeChatContactRow[] {
  return contacts
    .filter((c) => c.characterId?.trim())
    .map((c) => ({
      id: c.characterId.trim(),
      remarkName: c.remarkName?.trim() || '未命名',
      avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || undefined,
      isStarred: c.isStarred,
    }))
    .sort((a, b) => a.remarkName.localeCompare(b.remarkName, 'zh-CN'))
}

/** 按主号 / 小号解析要展示进度的一或多个微信马甲 */
export function resolveMemoryProgressAccounts(
  bundle: WechatAccountsBundle | null,
  scope: MemoryProgressAccountScope,
): MemoryProgressAccountContext[] {
  if (!bundle?.accounts.length) return []

  if (scope === 'main') {
    const primary = bundle.accounts[0]!
    return [
      {
        accountId: primary.accountId.trim(),
        sessionPlayerIdentityId: resolveAccountSessionIdentityId(primary),
        lineLabel: primary.nickname.trim() || '主号',
        contacts: mapPersonaContactsToProgressRows(primary.personaContacts),
      },
    ]
  }

  const subs = bundle.accounts.slice(1)
  return subs.map((acc) => ({
    accountId: acc.accountId.trim(),
    sessionPlayerIdentityId: resolveAccountSessionIdentityId(acc),
    lineLabel: acc.nickname.trim() || acc.wechatId.trim() || '小号',
    contacts: mapPersonaContactsToProgressRows(acc.personaContacts),
  }))
}

export function bundleHasSecondaryWechatAccounts(bundle: WechatAccountsBundle | null): boolean {
  return (bundle?.accounts.length ?? 0) > 1
}

export async function resolveMemoryProgressAccountsForScope(
  scope: MemoryProgressAccountScope,
  fallbackContacts: WeChatContactRow[],
  currentWechatAccountId?: string | null,
): Promise<MemoryProgressAccountContext[]> {
  const bundle = await loadAccountsBundle()
  const resolved = resolveMemoryProgressAccounts(bundle, scope)
  if (resolved.length) return resolved

  const acc = currentWechatAccountId?.trim() || bundle?.currentAccountId?.trim() || ''
  const account = acc && bundle ? findAccountById(bundle, acc) : null
  const sessionPlayerIdentityId = account
    ? resolveAccountSessionIdentityId(account)
    : (await personaDb.getCurrentIdentityId()).trim() || '__none__'

  return [
    {
      accountId: acc,
      sessionPlayerIdentityId,
      lineLabel: account?.nickname.trim() || '当前微信',
      contacts: fallbackContacts.filter((c) => c.id?.trim()),
    },
  ]
}

export async function loadWechatMemorySummaryProgress(params: {
  contacts: WeChatContactRow[]
  wechatAccountId: string
  sessionPlayerIdentityId: string
  accountLineLabel?: string
  memoriesByChar?: Map<string, readonly CharacterMemory[]>
}): Promise<WechatMemorySummaryProgressRow[]> {
  const settings = await personaDb.getMemorySettings()
  const autoSummaryEnabled = settings.autoSummaryEnabled !== false
  const roundMap = settings.aiRoundCountByConversation ?? {}
  const summaryCursorMap = settings.summaryCursorTimestampByConversation ?? {}

  const wechatAccountId = params.wechatAccountId.trim() || null
  const appHint = params.sessionPlayerIdentityId.trim() || null

  const uniqueContacts = params.contacts.filter((c) => c.id?.trim())
  const out: WechatMemorySummaryProgressRow[] = []
  const accountLineLabel = params.accountLineLabel?.trim() || undefined

  for (const contact of uniqueContacts) {
    const charId = contact.id.trim()
    let displayName = contact.remarkName?.trim() || '未命名'
    try {
      const chRow = await personaDb.getCharacter(charId).catch(() => null)
      displayName = chRow?.name?.trim() || contact.remarkName?.trim() || '未命名'
      const sessionPid = await resolveActivePrivateChatSessionPlayerIdentityId({
        characterId: charId,
        wechatAccountId,
        appPlayerIdentityId: appHint,
      })
      const conversationKey = resolvePrivateWeChatStorageConversationKey(
        charId,
        wechatAccountId,
        sessionPid,
      )
      const roundsSinceLastSummary = roundMap[conversationKey] ?? 0
      const charInterval = resolveAutoSummaryIntervalForCharacter(settings, charId)
      const roundsUntilNext = computeWechatRoundsUntilNextSummary(charInterval, roundsSinceLastSummary)

      const chatCursor = summaryCursorMap[conversationKey]
      const chatFromTs = (typeof chatCursor === 'number' && chatCursor >= 0 ? chatCursor : 0) + 1
      const chatIndex = await personaDb.listWeChatMessagesForSearchIndex(conversationKey)
      const hasPendingChat = chatIndex.some((m) => {
        const ts = typeof m.timestamp === 'number' && Number.isFinite(m.timestamp) ? m.timestamp : 0
        return ts >= chatFromTs
      })

      const memList = params.memoriesByChar?.get(charId)
      const memoryCount = Array.isArray(memList)
        ? memList.filter((m) => m.memoryScope !== 'linked' && m.memoryScope !== 'group').length
        : 0

      out.push({
        charId,
        displayName,
        avatarUrl: contact.avatarUrl,
        accountLineLabel,
        conversationKey,
        wechatAccountId: wechatAccountId ?? '',
        sessionPlayerIdentityId: sessionPid,
        interval: charInterval,
        roundsSinceLastSummary,
        roundsUntilNext,
        autoSummaryEnabled,
        hasPendingChat,
        memoryCount,
      })
    } catch (err) {
      console.warn('[wechat-memory-progress] row failed', charId, err)
      const fallbackInterval = resolveAutoSummaryIntervalForCharacter(settings, charId)
      out.push({
        charId,
        displayName,
        avatarUrl: contact.avatarUrl,
        accountLineLabel,
        conversationKey: '',
        wechatAccountId: wechatAccountId ?? '',
        sessionPlayerIdentityId: appHint ?? '',
        interval: fallbackInterval,
        roundsSinceLastSummary: 0,
        roundsUntilNext: fallbackInterval,
        autoSummaryEnabled,
        hasPendingChat: false,
        memoryCount: Array.isArray(params.memoriesByChar?.get(charId))
          ? params.memoriesByChar!.get(charId)!.filter((m) => m.memoryScope !== 'linked' && m.memoryScope !== 'group')
              .length
          : 0,
      })
    }
  }

  sortPrivateProgressRows(out)
  return out
}

export async function loadWechatGroupMemorySummaryProgress(params: {
  wechatAccountId: string
  sessionPlayerIdentityId: string
  accountLineLabel?: string
  memoriesByGroupBucket?: Map<string, readonly CharacterMemory[]>
}): Promise<WechatGroupMemorySummaryProgressRow[]> {
  const settings = await personaDb.getMemorySettings()
  const interval = resolveGlobalAutoSummaryInterval(settings)
  const autoSummaryEnabled = settings.autoSummaryEnabled !== false
  const roundMap = settings.aiRoundCountByConversation ?? {}
  const summaryCursorMap = settings.summaryCursorTimestampByConversation ?? {}

  const wechatAccountId = params.wechatAccountId.trim()
  const sessionPid = params.sessionPlayerIdentityId.trim()
  const accountLineLabel = params.accountLineLabel?.trim() || undefined
  if (!sessionPid) return []

  const groups = await personaDb.listGroupChatsForPlayerIdentity(sessionPid)
  const out: WechatGroupMemorySummaryProgressRow[] = []

  for (const group of groups) {
    out.push(await buildGroupProgressRow(group, {
      wechatAccountId,
      sessionPid,
      accountLineLabel,
      interval,
      autoSummaryEnabled,
      roundMap,
      summaryCursorMap,
      memoriesByGroupBucket: params.memoriesByGroupBucket,
    }))
  }

  sortGroupProgressRows(out)
  return out
}

async function buildGroupProgressRow(
  group: GroupChatRow,
  ctx: {
    wechatAccountId: string
    sessionPid: string
    accountLineLabel?: string
    interval: number
    autoSummaryEnabled: boolean
    roundMap: Record<string, number>
    summaryCursorMap: Record<string, number>
    memoriesByGroupBucket?: Map<string, readonly CharacterMemory[]>
  },
): Promise<WechatGroupMemorySummaryProgressRow> {
  const groupId = group.id.trim()
  const displayName = String(group.remark ?? group.name ?? '').trim() || `群 ${groupId.slice(0, 6)}`
  try {
    const conversationKey = resolveGroupWeChatStorageConversationKey(
      groupId,
      ctx.wechatAccountId,
      ctx.sessionPid,
    )
    const roundsSinceLastSummary = ctx.roundMap[conversationKey] ?? 0
    const roundsUntilNext = computeWechatRoundsUntilNextSummary(ctx.interval, roundsSinceLastSummary)

    const chatCursor = ctx.summaryCursorMap[conversationKey]
    const chatFromTs = (typeof chatCursor === 'number' && chatCursor >= 0 ? chatCursor : 0) + 1
    const chatIndex = await personaDb.listWeChatMessagesForSearchIndex(conversationKey)
    const hasPendingChat = chatIndex.some((m) => {
      const ts = typeof m.timestamp === 'number' && Number.isFinite(m.timestamp) ? m.timestamp : 0
      return ts >= chatFromTs
    })

    const bucketId = groupMemoryBucketCharacterId(groupId)
    const memList = ctx.memoriesByGroupBucket?.get(bucketId)
    const memoryCount = Array.isArray(memList)
      ? memList.filter((m) => m.memoryScope === 'group').length
      : 0

    return {
      groupId,
      displayName,
      avatarUrl: group.avatar?.trim() || undefined,
      accountLineLabel: ctx.accountLineLabel,
      conversationKey,
      wechatAccountId: ctx.wechatAccountId,
      sessionPlayerIdentityId: ctx.sessionPid,
      interval: ctx.interval,
      roundsSinceLastSummary,
      roundsUntilNext,
      autoSummaryEnabled: ctx.autoSummaryEnabled,
      hasPendingChat,
      memoryCount,
      memberCount: group.members.length,
    }
  } catch (err) {
    console.warn('[wechat-memory-progress] group row failed', groupId, err)
    return {
      groupId,
      displayName,
      avatarUrl: group.avatar?.trim() || undefined,
      accountLineLabel: ctx.accountLineLabel,
      conversationKey: '',
      wechatAccountId: ctx.wechatAccountId,
      sessionPlayerIdentityId: ctx.sessionPid,
      interval: ctx.interval,
      roundsSinceLastSummary: 0,
      roundsUntilNext: ctx.interval,
      autoSummaryEnabled: ctx.autoSummaryEnabled,
      hasPendingChat: false,
      memoryCount: 0,
      memberCount: group.members.length,
    }
  }
}

function sortPrivateProgressRows(rows: WechatMemorySummaryProgressRow[]) {
  rows.sort((a, b) => {
    if (a.roundsUntilNext !== b.roundsUntilNext) return a.roundsUntilNext - b.roundsUntilNext
    const aPending = a.hasPendingChat
    const bPending = b.hasPendingChat
    if (aPending !== bPending) return aPending ? -1 : 1
    const line = (a.accountLineLabel ?? '').localeCompare(b.accountLineLabel ?? '', 'zh-CN')
    if (line !== 0) return line
    return a.displayName.localeCompare(b.displayName, 'zh-CN')
  })
}

function sortGroupProgressRows(rows: WechatGroupMemorySummaryProgressRow[]) {
  rows.sort((a, b) => {
    if (a.roundsUntilNext !== b.roundsUntilNext) return a.roundsUntilNext - b.roundsUntilNext
    if (a.hasPendingChat !== b.hasPendingChat) return a.hasPendingChat ? -1 : 1
    const line = (a.accountLineLabel ?? '').localeCompare(b.accountLineLabel ?? '', 'zh-CN')
    if (line !== 0) return line
    return a.displayName.localeCompare(b.displayName, 'zh-CN')
  })
}

/** 当前马甲是否副号（供进度页默认选中主/小号 Tab） */
export async function resolveDefaultMemoryProgressAccountScope(
  currentWechatAccountId?: string | null,
): Promise<MemoryProgressAccountScope> {
  const bundle = await loadAccountsBundle()
  if (!bundle?.accounts.length) return 'main'
  if (isSecondaryWechatAccountInBundle(bundle, currentWechatAccountId)) return 'sub'
  return 'main'
}
