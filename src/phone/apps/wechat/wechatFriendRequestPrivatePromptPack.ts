import type { ApiConfig } from '../api/types'
import type { ChatTranscriptTurn } from './wechatChatAi'
import { loadOfflineDatingPlotsPromptBlock } from './dating/loadOfflineDatingPlotsForWechatPrompt'
import { buildNpcGroupChatsRecentDigestForPrivatePrompt } from './groupChatPrivateDigest'
import { personaDb } from './newFriendsPersona/idb'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from './wechatConversationKey'
import { peekPrivateChatGroupAnchorFromDockStaging } from './wechatPrivateGroupAnchorStaging'
import {
  buildMemoryRelevanceHaystack,
  buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt,
  formatUnsummarizedPrivateChatBlock,
} from './wechatMemoryPromptBlocks'

/**
 * 「新朋友-验证申请」侧模型注入：与 ChatRoom 私聊 persona 轮次对齐——
 * 关键词长期记忆、未总结私聊/群摘录、群聊近期摘录、线下剧情块。
 * 人设 / 世界背景 / 档案室（chatMemberIds + globalWechatPlate）仍由 requestWeChatPeerReplyBubbles 侧拼装。
 */
export async function buildFriendRequestPrivatePromptPack(params: {
  characterId: string
  conversationKey: string
  sessionPlayerIdentityId: string
  apiConfig: ApiConfig | null
  transcript: ChatTranscriptTurn[]
  biasTextForMemoryHaystack: string
}): Promise<{
  memory: string
  unsPrivate: string
  unsGroup: string
  recentGroupChatsReference: string
  offlineDatingPlotsContext: string
}> {
  const cid = params.characterId.trim()
  const ck = params.conversationKey.trim()
  const sid = params.sessionPlayerIdentityId.trim()
  if (!cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID || !ck || !sid || sid === '__none__') {
    return {
      memory: '',
      unsPrivate: '',
      unsGroup: '',
      recentGroupChatsReference: '',
      offlineDatingPlotsContext: '',
    }
  }

  const chRow = await personaDb.getCharacter(cid)
  const anchorGroupId =
    peekPrivateChatGroupAnchorFromDockStaging(cid) ?? (await personaDb.getPrivateChatAnchorGroupId(cid, sid))
  const apiOk = params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null

  const [offlineDatingPlotsContext, unsPrivate, unsGroup, recentGroupChatsReference] = await Promise.all([
    loadOfflineDatingPlotsPromptBlock(cid, chRow?.name ?? null),
    formatUnsummarizedPrivateChatBlock({
      conversationKey: ck,
      maxMessages: 100,
      maxChars: 3200,
    }),
    buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt({
      npcCharacterId: cid,
      sessionPlayerIdentityId: sid,
      boundPlayerIdentityId: chRow?.playerIdentityId,
      anchorGroupId,
      maxMessagesPerGroup: 50,
      charCap: 4200,
    }),
    buildNpcGroupChatsRecentDigestForPrivatePrompt({
      npcCharacterId: cid,
      sessionPlayerIdentityId: sid,
      boundPlayerIdentityId: chRow?.playerIdentityId,
      anchorGroupId,
      messageCap: 50,
      charCap: 4500,
    }),
  ])

  const hayFull = buildMemoryRelevanceHaystack([
    ...params.transcript.slice(-32).map((t) => t.text),
    params.biasTextForMemoryHaystack,
    String(offlineDatingPlotsContext ?? '').trim().slice(0, 3600),
    unsPrivate.trim().slice(0, 2400),
    unsGroup.trim().slice(0, 2400),
  ])
  const memory = await personaDb.formatCharacterMemoriesForPromptByRelevance(cid, hayFull, { apiConfig: apiOk })

  return {
    memory: memory.trim(),
    unsPrivate: unsPrivate.trim(),
    unsGroup: unsGroup.trim(),
    recentGroupChatsReference: recentGroupChatsReference.trim(),
    offlineDatingPlotsContext: offlineDatingPlotsContext.trim(),
  }
}

/**
 * 好友验证模型偏向：删除次数 + 提醒模型利用系统提示里已注入的线上/线下材料做动态台词。
 * totalDeletes 为 {@link incrementContactDeletionCount} 返回值（≥1）。
 */
export function buildFriendRequestDeletionOrdinalBias(totalDeletes: number): string {
  const n = Math.max(1, Math.floor(totalDeletes))
  let tier = ''
  if (n === 1) {
    tier = '首次删除后的重新验证：可质问、委屈或试探，但不要空洞复读「你怎么删我」。'
  } else if (n === 2) {
    tier = '第二次：必须明显不同于第一次——带疲惫、无语或「你又来这套」的累积感（仍贴合人设）。'
  } else {
    tier = `第 ${n} 次：情绪应进一步递进（冷处理、麻木、爆发、讥讽等择一人设路线），与第 1、2 次开场必须有反差，禁止套模板。`
  }
  return [
    `【删除次数·本地统计】用户已将你从通讯录删除累计 ${n} 次（每次完成删除流程计一次；数值含当前这一轮之前的全部历史）。`,
    `【台词动态要求】${tier}`,
    `【语境来源】同一条请求的系统提示里已注入：线上微信摘录（含未总结私聊/群）、线下约会剧情、长期记忆等；请综合推断删之前线上与线下大致发生了什么，用含蓄指向承接剧情（勿凭空捏造材料里未出现的专名），使验证气泡像「记得前因后果」的活人。`,
  ].join('\n')
}
