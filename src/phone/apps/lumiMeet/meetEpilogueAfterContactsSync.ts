import type { ApiConfig } from '../api/types'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  resolvePrivateChatSessionPlayerIdentityId,
  resolvePrivateWeChatConversationKey,
} from '../wechat/wechatConversationKey'
import { aiMeetEncounterEpilogueLore } from './lumiMeetAi'
import { meetMessagesToAiTranscript } from './meetEncounterTranscript'
import { removeMeetLoreEntriesForNpcIds } from './meetClearEncounterData'
import { hasMeetVol10GraduatedEpilogue } from './meetNineDimensionWorldBooks'
import { resolveMeetNpcForEpilogue } from './meetResolveNpcForEpilogue'
import { LUMI_MEET_KV_KEY } from './constants'
import {
  advanceMeetSummaryCursorFromThread,
  alignWeChatSummaryCursorAfterMeetImport,
} from './meetMemoryRoundFinalize'
import { findMeetNpcInPersist, loadMeetPersisted } from './meetPersistLoad'
import {
  purgeMeetImportedWeChatMessages,
  resolveUiHideBeforeForMeetImport,
} from './meetWechatSyncOnFriendLinked'
import type { EncounterNPC, LumiMeetPersistedState, MeetChatMessage, MeetPublicProfile } from './meetTypes'
import { resolveMeetPublicDisplayName } from './meetPublicProfileDisplay'
import { isMeetSyncedCharacter } from './meetUserProfileSnapshot'
import {
  emitMeetVol10EpilogueWriteEnd,
  emitMeetVol10EpilogueWriteStart,
  emitMeetVol10EpilogueWritten,
} from './meetVol10EpilogueNotice'
import { patchMeetCharacterVol10Epilogue } from './syncMeetNpcToWechat'

/** 是否已与微信侧建立联系（通讯录 / 缔结 / 互换微信），才允许写入结业初印象 */
export async function hasMeetCharacterWechatLinked(
  characterId: string,
  meet?: LumiMeetPersistedState | null,
): Promise<boolean> {
  const cid = characterId.trim()
  if (!cid) return false
  const state = meet ?? (await loadMeetPersisted())

  if (state) {
    const npc = findMeetNpcInPersist(state, cid)
    if (npc?.status === 'wechat_added') return true
    const swap = state.encounterSwapByNpcId[cid]
    if (swap?.covenantAgreed || swap?.wechatSwapStatus === 'swapped') return true
  }

  try {
    const ch = await personaDb.getCharacter(cid)
    if (!ch || !isMeetSyncedCharacter(cid, ch.worldBooks)) return false
    const pid =
      state?.meetProfile.baseWeChatIdentityId?.trim() || (await personaDb.getCurrentIdentityId()).trim()
    if (pid && pid !== '__none__') {
      const accepted = await personaDb.listFriendRequests({
        playerIdentityId: pid,
        pendingOnly: false,
      })
      if (accepted.some((r) => r.characterId === cid && r.status === 'accepted')) return true
    }
  } catch {
    // ignore
  }
  return false
}

/**
 * 若 vol10 仍为匹配占位稿，则根据遇见临时会话生成结业初印象（幂等：已有真稿则跳过）。
 * 须在已缔结/加微信后调用；微信「新的朋友」通过验证时会自动触发。
 */
export async function ensureMeetVol10EpilogueIfNeeded(params: {
  apiConfig: ApiConfig | null
  characterId: string
  playerIdentityId?: string
  verificationEpochMs?: number
  /** 默认 true：未与微信建立联系时不写，避免仅匹配就生成结业稿 */
  requireWechatLink?: boolean
  suppressVol10Notice?: boolean
}): Promise<boolean> {
  const cid = params.characterId.trim()
  if (!cid) return false

  const ch = await personaDb.getCharacter(cid)
  if (!ch) return false
  if (hasMeetVol10GraduatedEpilogue(cid, ch.worldBooks ?? [])) return false

  const meet = await loadMeetPersisted()
  if (params.requireWechatLink !== false) {
    const linked = await hasMeetCharacterWechatLinked(cid, meet)
    if (!linked) return false
  }

  const resolved = await resolveMeetNpcForEpilogue(cid)
  if (!resolved) return false

  const { npc, userProfile, thread } = resolved
  const transcript = meetMessagesToAiTranscript(thread)
  const pid =
    params.playerIdentityId?.trim() ||
    userProfile.baseWeChatIdentityId?.trim() ||
    (await personaDb.getCurrentIdentityId()).trim()

  await syncMeetEpilogueAfterContactsAdded({
    apiConfig: params.apiConfig,
    npc,
    userProfile: {
      ...userProfile,
      baseWeChatIdentityId: pid && pid !== '__none__' ? pid : userProfile.baseWeChatIdentityId,
    },
    transcript,
    meetThread: thread,
    playerIdentityId: pid || undefined,
    verificationEpochMs: params.verificationEpochMs,
    suppressVol10Notice: params.suppressVol10Notice,
  })

  if (meet) {
    const idx = meet.npcs.findIndex((n) => n.id === cid)
    if (idx >= 0 && meet.npcs[idx]!.status !== 'wechat_added') {
      const next = {
        ...meet,
        npcs: meet.npcs.map((n, i) =>
          i === idx ? { ...n, status: 'wechat_added' as const, lastEncounterTime: Date.now() } : n,
        ),
      }
      await personaDb.setPhoneKv(LUMI_MEET_KV_KEY, next)
    }
  }

  return true
}

/**
 * 须在「人设已写入库且已加入微信通讯录」之后调用：写入人设库 **vol10** 尾声延展（不进全局档案室）。
 */
export async function syncMeetEpilogueAfterContactsAdded(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  transcript: Array<{ role: 'user' | 'npc'; content: string }>
  meetThread?: MeetChatMessage[]
  playerIdentityId?: string
  verificationEpochMs?: number
  /** 为 true 时不弹出全局结业初印象提示（遇见聊天室内自有说明弹窗时使用） */
  suppressVol10Notice?: boolean
}): Promise<void> {
  const cid = params.npc.id.trim()
  const nick = params.npc.nickname?.trim() || params.npc.realName?.trim() || '对方'
  const noticeDetail = { characterId: cid, characterNickname: nick }
  if (!params.suppressVol10Notice) {
    emitMeetVol10EpilogueWriteStart(noticeDetail)
  }
  try {
    const pid =
      params.playerIdentityId?.trim() || (await personaDb.getCurrentIdentityId()).trim()
    const thread = params.meetThread ?? []
    if (cid && pid && pid !== '__none__') {
      const epoch = params.verificationEpochMs ?? Date.now()
      await purgeMeetImportedWeChatMessages({ characterId: cid, playerIdentityId: pid })
      if (thread.length) {
        await advanceMeetSummaryCursorFromThread(cid, thread)
        const maxTs = Math.max(
          ...thread.map((m) => (typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : 0)),
        )
        const earliestTs = Math.min(
          ...thread.map((m) =>
            typeof m.ts === 'number' && Number.isFinite(m.ts) && m.ts > 0 ? m.ts : Number.POSITIVE_INFINITY,
          ),
        )
        const ch = await personaDb.getCharacter(cid)
        const convKey = resolvePrivateWeChatConversationKey(cid, ch, pid)
        if (maxTs > 0) {
          await alignWeChatSummaryCursorAfterMeetImport({
            characterId: cid,
            conversationKey: convKey,
            maxImportedTimestamp: maxTs,
          })
        }
        const sessionPid = resolvePrivateChatSessionPlayerIdentityId(ch, pid)
        const hideBefore = resolveUiHideBeforeForMeetImport({
          verificationEpochMs: epoch,
          meetEarliestTs: Number.isFinite(earliestTs) ? earliestTs : null,
        })
        if (hideBefore != null) {
          await personaDb.upsertChatConversationSettings({
            conversationKey: convKey,
            peerCharacterId: cid,
            playerIdentityId: sessionPid,
            uiOnlyHiddenBeforeTimestamp: hideBefore,
            hiddenFromMessageList: false,
          })
        }
      }
    }
    let lore: string
    try {
      lore = await aiMeetEncounterEpilogueLore({
        apiConfig: params.apiConfig,
        npc: params.npc,
        userProfile: params.userProfile,
        transcript: params.transcript,
      })
    } catch {
      lore =
        '{{char}}与{{user}}已完成遇见临时会话并交换微信联系方式；会话篇幅不长，现场互动以礼貌与试探为主。当前阶段{{char}}对{{user}}持保留观察态度，愿在私聊中延续对话、不急于定义关系。'
    }
    await patchMeetCharacterVol10Epilogue({
      characterId: params.npc.id,
      nickname: params.npc.nickname,
      charRealName: params.npc.realName ?? params.npc.comprehensivePersona?.base.realName,
      playerDisplayName: resolveMeetPublicDisplayName(params.userProfile),
      rawLore: lore,
    })
    removeMeetLoreEntriesForNpcIds([params.npc.id])
    if (!params.suppressVol10Notice) {
      emitMeetVol10EpilogueWritten(noticeDetail)
    }
  } finally {
    if (!params.suppressVol10Notice) {
      emitMeetVol10EpilogueWriteEnd()
    }
  }
}
