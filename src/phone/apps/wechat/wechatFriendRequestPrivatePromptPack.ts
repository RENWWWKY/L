import type { ApiConfig } from '../api/types'
import type { ChatTranscriptTurn } from './wechatChatAi'
import { formatUnsummarizedMeetChatBlock } from '../lumiMeet/meetMemoryPromptBlocks'
import { isMeetSyncedCharacter } from '../lumiMeet/meetUserProfileSnapshot'
import { loadMeetEncounterMemoriesPromptBlock } from '../lumiMeet/meetWechatSyncOnFriendLinked'
import { loadOfflineDatingPlotsPromptBlock } from './dating/loadOfflineDatingPlotsForWechatPrompt'
import { personaDb } from './newFriendsPersona/idb'
import { WECHAT_LUMI_PEER_CHARACTER_ID } from './wechatConversationKey'
import {
  WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY,
  WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
  wrapStrangerContactLongTermMemoryBlock,
} from './wechatAltAccountPrompt'
import {
  normalizeMemoryPromptLineScope,
  wrapUnsummarizedPrivateBlockWithLineLabel,
} from './wechatMemoryLineScope'
import type { UserAccount } from './wechatAccountTypes'
import {
  buildMemoryRelevanceHaystack,
  formatUnsummarizedPrivateChatBlock,
} from './wechatMemoryPromptBlocks'

/**
 * 「新朋友-验证申请」侧模型注入：与 ChatRoom 私聊 persona 轮次对齐——
 * 关键词长期记忆、未总结私聊/群摘录、群聊近期摘录、线下剧情块。
 * 人设 / 世界背景 / 档案室（chatMemberIds + globalWechatPlate）仍由 requestWeChatPeerReplyBubbles 侧拼装。
 */

/** 好友申请栏：不知真名时禁止用微信昵称/档案名直呼（仅验证消息内亲口自称可谨慎承接）。 */
export const FRIEND_REQUEST_ADDRESSING_RULES = [
  '【好友申请 · 称呼铁则（最高优先级）】',
  '你**不知**对方真实姓名。系统提供的微信昵称、个性签名**仅**用于辨认「这是一条好友申请」，**禁止**在台词里用微信昵称直呼对方（禁止「Aurora好呀」「XX在吗」等）。',
  '默认用「你」；可试探「怎么称呼你？」「你是……？」；禁止用档案主绑定真名/职务/旧亲昵称呼。',
  '仅当对方在**本栏验证消息**里明确写「叫我XX」「我是XX」时，可**谨慎**用该 XX 承接一句——仍不等于已核实真名；**禁止**照搬微信主页昵称（可能与验证自称不一致）。',
  'post_accept_greeting 同样遵守：禁止用微信昵称或系统资料名开场；可泛泛招呼或承接验证句，勿「XX好呀」式直呼。',
].join('\n')

/** 好友申请栏专用：角色默认不把申请人当作已知的档案主绑定 / 它号旧识（一律注入）。 */
export const FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS = [
  '【好友申请 · 默认陌生人（最高优先级）】',
  '当前在「新朋友-验证申请」栏，**不是**已通过好友后的私聊。',
  '你**默认不认识**正在申请加你的这位：对方是谁只能来自本栏验证消息；微信昵称/签名仅供界面辨认，**不得**当作已知的称呼依据。',
  '**禁止**假定对方 = 人设档案主绑定玩家、其它微信线上的旧识、换号来的熟人；禁止「除了你还能是谁」「你居然亲自来加」。',
  '禁止用主绑定称呼/职务（社长、档案真名、旧亲昵称呼等）称呼当前申请人。',
  '对方写「我是某昵称」「某某推的」→ 仅作本栏自述；「某某」= 推荐人（第三人），**不是**申请人本人就是某某。',
  '本栏**禁止**凭长期记忆、它号私聊摘录、线下剧情「认出」申请人；仅可维持你自己的人设口癖与**你自己**已确立的客观日程。',
  'post_accept_greeting：按**刚通过的新微信联系人**写 1~3 句，可试探/礼貌/保持距离，不得当作老友上线。',
  '仅当对方在**本栏**多轮亲口承认身份后，后续私聊才可逐步相认；本栏仍须先完成验证或裁决。',
  FRIEND_REQUEST_ADDRESSING_RULES,
  WECHAT_STRANGER_CONTACT_CAUSALITY_RULES,
  '系统不向模型注入「玩家身份」卡；禁止「你真的是【昵称】本人吗」式发问。',
  WECHAT_CHARACTER_SELF_NARRATIVE_CONSISTENCY,
].join('\n')

/** @deprecated 请用 {@link FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS}；保留别名供旧调用。 */
export function buildFriendRequestDualAccountAwarenessBias(_params?: {
  homeOnly?: boolean
  hasAltAccountLink?: boolean
}): string {
  return FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS
}

export async function buildFriendRequestPrivatePromptPack(params: {
  characterId: string
  conversationKey: string
  sessionPlayerIdentityId: string
  apiConfig: ApiConfig | null
  transcript: ChatTranscriptTurn[]
  biasTextForMemoryHaystack: string
  /** 多马甲：注入其它微信号上该角色的未总结私聊（不依赖通讯录是否已同步） */
  crossAccountContext?: {
    currentAccountId: string
    allAccounts: UserAccount[]
  }
}): Promise<{
  memory: string
  unsPrivate: string
  unsGroup: string
  recentGroupChatsReference: string
  offlineDatingPlotsContext: string
  meetEncounterMemoriesContext: string
  unsMeet: string
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
      meetEncounterMemoriesContext: '',
      unsMeet: '',
    }
  }

  const chRow = await personaDb.getCharacter(cid)
  const fromMeet = isMeetSyncedCharacter(cid, chRow?.worldBooks)
  /** 好友申请栏：一律按陌生人处理记忆/摘录，不注入它号私聊，避免模型「认出」申请人。 */
  const strangerMemoryGuard = true
  const apiOk = params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null

  const lineScope = normalizeMemoryPromptLineScope(
    params.crossAccountContext?.currentAccountId,
    sid,
  )

  const [meetEncounterMemoriesContext, unsMeet, unsPrivateRaw] = await Promise.all([
    fromMeet ? loadMeetEncounterMemoriesPromptBlock(cid) : Promise.resolve(''),
    fromMeet
      ? formatUnsummarizedMeetChatBlock({ characterId: cid, maxMessages: 120, maxChars: 3200 })
      : Promise.resolve(''),
    formatUnsummarizedPrivateChatBlock({
      conversationKey: ck,
      maxMessages: 100,
      maxChars: 3200,
    }),
  ])

  const scopeForWrap =
    lineScope ??
    normalizeMemoryPromptLineScope(params.crossAccountContext?.currentAccountId, sid)
  const unsPrivateCurrent =
    unsPrivateRaw.trim() && scopeForWrap
      ? await wrapUnsummarizedPrivateBlockWithLineLabel(unsPrivateRaw, scopeForWrap, 'current')
      : unsPrivateRaw.trim()
  const unsPrivateMerged = unsPrivateCurrent

  const hayFull = buildMemoryRelevanceHaystack([
    ...params.transcript.slice(-32).map((t) => t.text),
    params.biasTextForMemoryHaystack,
    fromMeet ? String(meetEncounterMemoriesContext ?? '').trim().slice(0, 2800) : '',
    fromMeet ? String(unsMeet ?? '').trim().slice(0, 2800) : '',
    unsPrivateMerged.slice(0, 4800),
  ])
  const { formatCharacterMemoriesForPromptInjection } = await import(
    './memory/formatCharacterMemoriesForPromptInjection'
  )
  let memory = await formatCharacterMemoriesForPromptInjection(cid, hayFull, {
    apiConfig: apiOk,
    lineScope: (lineScope ?? scopeForWrap) ?? undefined,
  })
  memory = memory.trim()
  if (strangerMemoryGuard && memory && !memory.includes('分线阅读')) {
    memory = wrapStrangerContactLongTermMemoryBlock(memory)
  }

  return {
    memory,
    unsPrivate: unsPrivateMerged.trim(),
    unsGroup: '',
    recentGroupChatsReference: '',
    offlineDatingPlotsContext: '',
    meetEncounterMemoriesContext: fromMeet ? String(meetEncounterMemoriesContext ?? '').trim() : '',
    unsMeet: fromMeet ? String(unsMeet ?? '').trim() : '',
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
    `【语境来源】可结合本栏验证对话、长期记忆（勿据此「认出」申请人身份）、本线未总结私聊摘录，含蓄承接删好友前发生过的事；勿凭空捏造专名，勿把申请人当成档案主绑定/它号旧识。`,
  ].join('\n')
}
