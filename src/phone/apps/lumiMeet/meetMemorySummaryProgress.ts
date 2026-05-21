import { personaDb } from '../wechat/newFriendsPersona/idb'
import { loadMeetPersisted } from './meetPersistLoad'
import { resolveMeetAutoSummaryConversationKey } from './meetMemoryRoundFinalize'
import { findMeetWechatAccount, listMeetSelectableWechatAccounts } from './meetWechatAccountPool'

export type MeetMemorySummaryProgressRow = {
  charId: string
  displayName: string
  conversationKey: string
  interval: number
  /** 距上次总结以来已完成的 NPC 回复轮数（未达阈值前） */
  roundsSinceLastSummary: number
  /** 距离下一次自动总结还需的 NPC 回复轮数 */
  roundsUntilNext: number
  autoSummaryEnabled: boolean
  /** 临时会话中仍有游标后的未总结消息 */
  hasPendingMeetTranscript: boolean
  meetMemoryCount: number
}

export function computeRoundsUntilNextSummary(
  interval: number,
  roundsSinceLastSummary: number,
): number {
  const step = Math.max(1, Math.floor(interval))
  const prev = Math.max(0, Math.floor(roundsSinceLastSummary))
  return Math.max(0, step - prev)
}

export async function loadMeetMemorySummaryProgress(params: {
  rows: Array<{ charId: string; nickname: string }>
  meetProfileBaseWeChatIdentityId?: string | null
  meetProfileContactWechatId?: string | null
  memoriesByChar?: Map<string, readonly unknown[]>
}): Promise<MeetMemorySummaryProgressRow[]> {
  const identityHint = params.meetProfileBaseWeChatIdentityId
  const settings = await personaDb.getMemorySettings()
  const interval = Math.max(1, Math.floor(settings.autoSummaryInterval))
  const autoSummaryEnabled = settings.autoSummaryEnabled !== false
  const roundMap = settings.aiRoundCountByConversation ?? {}

  let boundAcc = ''
  const contactWx = params.meetProfileContactWechatId?.trim()
  if (contactWx) {
    const accounts = await listMeetSelectableWechatAccounts()
    boundAcc = findMeetWechatAccount(accounts, contactWx)?.accountId?.trim() || ''
  }

  const meet = await loadMeetPersisted()
  const unique = [...new Set(params.rows.map((r) => r.charId.trim()).filter(Boolean))]

  const out: MeetMemorySummaryProgressRow[] = []
  for (const charId of unique) {
    const row = params.rows.find((r) => r.charId.trim() === charId)
    const displayName = row?.nickname.trim() || '未命名'
    try {
      const conversationKey = await resolveMeetAutoSummaryConversationKey(
        charId,
        identityHint,
        boundAcc || null,
      )
      const roundsSinceLastSummary = roundMap[conversationKey] ?? 0
      const roundsUntilNext = computeRoundsUntilNextSummary(interval, roundsSinceLastSummary)

      const meetCursor = await personaDb.getMeetSummaryCursorTimestamp(charId)
      const meetFromTs = (meetCursor ?? 0) + 1
      const thread = meet?.chatThreads[charId] ?? []
      const hasPendingMeetTranscript = thread.some((m) => {
        const ts = typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : 1
        return ts > meetFromTs
      })

      const memList = params.memoriesByChar?.get(charId)
      const meetMemoryCount = Array.isArray(memList) ? memList.length : 0

      out.push({
        charId,
        displayName,
        conversationKey,
        interval,
        roundsSinceLastSummary,
        roundsUntilNext,
        autoSummaryEnabled,
        hasPendingMeetTranscript,
        meetMemoryCount,
      })
    } catch (err) {
      console.warn('[meet-progress] row failed', charId, err)
      out.push({
        charId,
        displayName,
        conversationKey: '',
        interval,
        roundsSinceLastSummary: 0,
        roundsUntilNext: interval,
        autoSummaryEnabled,
        hasPendingMeetTranscript: false,
        meetMemoryCount: Array.isArray(params.memoriesByChar?.get(charId))
          ? params.memoriesByChar!.get(charId)!.length
          : 0,
      })
    }
  }

  out.sort((a, b) => {
    if (a.roundsUntilNext !== b.roundsUntilNext) return a.roundsUntilNext - b.roundsUntilNext
    if (a.hasPendingMeetTranscript !== b.hasPendingMeetTranscript) {
      return a.hasPendingMeetTranscript ? -1 : 1
    }
    return a.displayName.localeCompare(b.displayName, 'zh-CN')
  })

  return out
}
