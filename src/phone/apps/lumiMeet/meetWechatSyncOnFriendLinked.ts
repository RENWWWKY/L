import type { ApiConfig } from '../api/types'
import { emitWeChatStorageChanged, personaDb } from '../wechat/newFriendsPersona/idb'
import { resolvePrivateWeChatConversationKey } from '../wechat/wechatConversationKey'
import { alignWeChatSummaryCursorAfterMeetImport } from './meetMemoryRoundFinalize'
import { isMeetImportedWeChatMessageId } from './meetMemoryConstants'
import { ensureMeetVol10EpilogueIfNeeded } from './meetEpilogueAfterContactsSync'
import {
  findMeetNpcInPersist,
  isMeetFriendRequestSource,
  loadMeetPersisted,
} from './meetPersistLoad'
import type { EncounterNPC, MeetChatMessage } from './meetTypes'

export type SyncMeetEncounterToWechatParams = {
  apiConfig: ApiConfig | null
  characterId: string
  playerIdentityId: string
  /** 好友申请来源；含「遇见」时即使存档缺 NPC 也尝试同步 */
  friendRequestSource?: string
  /** 微信验证阶段起点（供 UI 分割线等） */
  verificationEpochMs?: number
  npc?: EncounterNPC
  meetThread?: MeetChatMessage[]
}

export type SyncMeetEncounterToWechatResult = {
  synced: boolean
  /** 已从微信库清除的历史「遇见导入」条数 */
  chatPurged: number
  /** 已废弃：记忆改由轮次触发的合并自动总结写入，此处恒为 false */
  memoryWritten: boolean
  meetEarliestTs: number | null
  /** 本次是否新写入了 vol10 结业初印象 */
  vol10EpilogueWritten: boolean
}

function meetThreadTimestampBounds(thread: MeetChatMessage[]): {
  earliestTs: number | null
  maxTs: number | null
} {
  let earliestTs: number | null = null
  let maxTs: number | null = null
  for (const m of thread) {
    const ts = typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : null
    if (ts == null) continue
    if (earliestTs == null || ts < earliestTs) earliestTs = ts
    if (maxTs == null || ts > maxTs) maxTs = ts
  }
  return { earliestTs, maxTs }
}

export async function shouldSyncMeetEncounterToWechat(params: {
  characterId: string
  friendRequestSource?: string
}): Promise<boolean> {
  if (isMeetFriendRequestSource(params.friendRequestSource)) return true
  const meet = await loadMeetPersisted()
  if (!meet) return false
  return !!findMeetNpcInPersist(meet, params.characterId)
}

async function resolveMeetNpcAndThread(params: SyncMeetEncounterToWechatParams): Promise<{
  npc: EncounterNPC
  thread: MeetChatMessage[]
} | null> {
  if (params.npc && params.meetThread) {
    return { npc: params.npc, thread: params.meetThread }
  }
  const meet = await loadMeetPersisted()
  if (!meet) return null
  const npc =
    params.npc ?? findMeetNpcInPersist(meet, params.characterId) ?? null
  if (!npc) {
    if (!isMeetFriendRequestSource(params.friendRequestSource)) return null
    return null
  }
  const thread = params.meetThread ?? meet.chatThreads[npc.id] ?? []
  return { npc, thread }
}

/** 清除曾写入微信 IndexedDB 的遇见临时会话镜像（遇见与微信聊天记录须独立） */
export async function purgeMeetImportedWeChatMessages(params: {
  characterId: string
  playerIdentityId: string
}): Promise<number> {
  const cid = params.characterId.trim()
  const pid = params.playerIdentityId.trim()
  if (!cid || !pid || pid === '__none__') return 0

  const ch = await personaDb.getCharacter(cid)
  const convKey = resolvePrivateWeChatConversationKey(cid, ch, pid)
  const msgs = await personaDb.listWeChatChatMessagesByConversationKey(convKey)
  let purged = 0
  for (const m of msgs) {
    if (!isMeetImportedWeChatMessageId(m.id, cid)) continue
    try {
      await personaDb.deleteWeChatChatMessageById(m.id)
      purged += 1
    } catch {
      // ignore single-row delete failure
    }
  }
  if (purged > 0) emitWeChatStorageChanged()
  return purged
}

/**
 * 遇见加微信 / 好友验证通过后：清理误导入的微信气泡；**不**推进遇见总结游标（未总结片段须进微信上下文与合并总结）。
 * 遇见口播与契约叙述保留在遇见存档；微信侧通过未总结摘录 + 合并自动总结与 `[遇见]` 记忆块承接叙事。
 */
export async function syncMeetEncounterToWechatAfterFriendLinked(
  params: SyncMeetEncounterToWechatParams,
): Promise<SyncMeetEncounterToWechatResult> {
  const cid = params.characterId.trim()
  const pid = params.playerIdentityId.trim()
  if (!cid || !pid || pid === '__none__') {
    return { synced: false, chatPurged: 0, memoryWritten: false, meetEarliestTs: null, vol10EpilogueWritten: false }
  }

  const epoch =
    typeof params.verificationEpochMs === 'number' && Number.isFinite(params.verificationEpochMs)
      ? params.verificationEpochMs
      : Date.now()

  const resolved = await resolveMeetNpcAndThread(params)
  const chatPurged = await purgeMeetImportedWeChatMessages({ characterId: cid, playerIdentityId: pid })

  let earliestTs: number | null = null
  if (resolved) {
    const { thread } = resolved
    const bounds = meetThreadTimestampBounds(thread)
    earliestTs = bounds.earliestTs
    const ch = await personaDb.getCharacter(cid)
    const convKey = resolvePrivateWeChatConversationKey(cid, ch, pid)
    if (bounds.maxTs != null && bounds.maxTs > 0) {
      await alignWeChatSummaryCursorAfterMeetImport({
        characterId: cid,
        conversationKey: convKey,
        maxImportedTimestamp: bounds.maxTs,
      })
    }
  }

  let vol10EpilogueWritten = false
  try {
    vol10EpilogueWritten = await ensureMeetVol10EpilogueIfNeeded({
      apiConfig: params.apiConfig,
      characterId: cid,
      playerIdentityId: pid,
      verificationEpochMs: epoch,
      requireWechatLink: false,
    })
  } catch {
    // 结业稿写入失败不阻断加好友；用户可在灵魂侧写 / 世界书页触发补写
  }

  return {
    synced: chatPurged > 0 || (resolved?.thread.length ?? 0) > 0,
    chatPurged,
    memoryWritten: false,
    meetEarliestTs: earliestTs,
    vol10EpilogueWritten,
  }
}

/** 供私聊 / 验证申请 prompt：已入库的遇见记忆摘录 */
export async function loadMeetEncounterMemoriesPromptBlock(characterId: string): Promise<string> {
  const cid = characterId.trim()
  if (!cid) return ''
  const mems = await personaDb.listCharacterMemoriesForCharacter(cid)
  const meetRows = mems
    .filter(
      (m) =>
        m.memoryScope === 'meet' || m.content.trim().startsWith('[遇见]'),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6)
  if (!meetRows.length) return ''
  const lines = meetRows.map((m) => `- ${m.content.trim().slice(0, 520)}`)
  return `【遇见 App · 已总结长期记忆】\n${lines.join('\n')}`
}

export function resolveUiHideBeforeForMeetImport(params: {
  verificationEpochMs: number
  meetEarliestTs: number | null
}): number | null {
  const epoch = params.verificationEpochMs
  const meetMin = params.meetEarliestTs
  if (meetMin != null && Number.isFinite(meetMin) && meetMin > 0) {
    return Math.max(0, meetMin - 1)
  }
  if (typeof epoch === 'number' && Number.isFinite(epoch) && epoch > 0) {
    return Math.max(0, epoch - 1)
  }
  return null
}
