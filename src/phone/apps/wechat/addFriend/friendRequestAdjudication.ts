import type { FriendRequest } from '../newFriendsPersona/friendRequestTypes'
import { personaDb, emitWeChatStorageChanged } from '../newFriendsPersona/idb'
import { resolveAccountScopedPrivateConversationKey } from '../wechatAccountPrivateChatStorage'
import {
  splitFriendRequestReplyLines,
  stripFriendRequestDecisionBlock,
  type FriendRequestDecision,
  type FriendRequestDecisionParsed,
} from './friendRequestDecisionParse'
import { buildMeetFriendRequestAdjudicationBias } from '../../lumiMeet/meetFriendRequestContext'
import { isUserInitiatedFriendRequestSource } from './submitUserOutgoingFriendRequest'
import { resolveOutgoingFriendRequestPlayerIdentityId } from '../wechatCharacterPlayerIdentity'
import { sanitizeFriendRequestPlainText } from './friendRequestPlainText'
import { inferFriendRequestDecisionFromCharacterText } from './friendRequestVerbalDecisionInfer'
import { FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS } from '../wechatFriendRequestPrivatePromptPack'

export function buildUserInitiatedFriendRequestAdjudicationBias(): string {
  return (
    `${FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS}\n\n` +
    '【系统裁决·对方加你为好友】对方已通过「添加朋友」向你发来验证申请。你必须结合人设、关系与当前验证对话作出是否通过的决定。\n' +
    '【验证人身份·硬性】当前发言人=**申请加你的这位**微信联系人；验证句里「某某推的」「顾社长推的」= **第三人（推荐人）**把 TA 介绍给你，**不是**说申请人本人就是社长/推荐人。\n' +
    '禁止把申请人当成档案主绑定玩家；禁止「社长大人亲自加我」「你居然亲自来加」「社长大人！！」等把推荐人/主绑定身份安在申请人身上的台词。\n' +
    'post_accept_greeting：不知真名时禁止用微信主页昵称直呼；若验证写「我是落日邮递员」可谨慎承接该**验证自称**，不得用档案主绑定真名或「社长大人」。\n' +
    '禁止编造「我刚跟某某说要加你」「某某甩名片是因为我去求他」——除非本验证对话里确有其事。\n' +
    '输出硬性规则：\n' +
    '1) 在全部输出的最开头（任何口语之前）严格输出：\n' +
    '<friend_request_response>\n' +
    '  <decision>accept</decision>\n' +
    '  <post_accept_greeting>\n' +
    '    通过好友后的打招呼第一句\n' +
    '    可选第二句\n' +
    '  </post_accept_greeting>\n' +
    '</friend_request_response>\n' +
    '- decision 仅 accept 或 decline（小写英文）。\n' +
    '- accept 时 post_accept_greeting 必填 1~3 行（每行一条短句），表示**已成为好友后**在本会话继续发的开场白，语气自然、贴合人设，与验证回复区分开；decline 时 post_accept_greeting 必须为空标签对。\n' +
    '- post_accept_greeting **禁止**：换号加我、突然换号、昵称撞车、跟某某撞昵称、你是不是小号/马甲。\n' +
    '- 禁止省略 XML、禁止由系统代写任何固定话术；缺任一必填段将导致无法完成加好友流程。\n' +
    '2) XML 之后**可选**写 0~2 行口语验证回复（每行一条）；无必要可只输出 XML。禁止 Markdown、禁止括号动作描写。\n' +
    '3) accept：若写口语可表示已通过；decline：若写口语则礼貌婉拒。勿展开日常私聊。\n' +
    '4) **本回合唯一任务**就是输出完整 <friend_request_response>；禁止只聊遇见临时会话、禁止只寒暄不写 XML。'
  )
}

function friendRequestGapBeforeBubbleMs(currentSegmentLength: number, isFirst: boolean): number {
  if (isFirst) return 0
  const chars = Math.max(1, currentSegmentLength)
  return Math.min(25000, Math.ceil(chars / 5) * 1000)
}

/** 裁决写入气泡时的间隔上限，避免验证页长时间无 UI 更新 */
function friendRequestAdjudicationGapMs(currentSegmentLength: number, isFirst: boolean): number {
  return Math.min(1800, friendRequestGapBeforeBubbleMs(currentSegmentLength, isFirst))
}

const DECISION_ONLY_RETRY_BIAS =
  '【补裁决·硬性】你已发过验证口语回复，但系统未收到裁决 XML。本回合**禁止**重复口语、禁止日常私聊，**仅**输出完整 <friend_request_response> 块（含 decision 与 post_accept_greeting）。第一行必须是 <friend_request_response>。'

const DECISION_ONLY_RETRY_BIAS_FINAL =
  '【最终补裁决·最高优先级】此前回合仍未收到合法裁决 XML。本回合**只能**输出一个 <friend_request_response> 块，不得输出任何其它文字。decision 必填 accept 或 decline；accept 时 post_accept_greeting 必填 1~3 行。'

const MAX_USER_INITIATED_DECISION_ROUNDS = 3

export type FriendRequestAiReplyResult = {
  bubbles: string[]
  nickname: string
  rawText?: string
}

export const FRIEND_REQUEST_ADJUDICATION_INCOMPLETE_ERROR =
  '对方已回复验证消息，但未完成好友裁决（缺少 accept/decline）。请点「重新请求对方处理」。'

const DEFAULT_POST_ACCEPT_GREETING = '你好呀，已通过你的好友申请～'

function resolvePostAcceptGreetingLines(
  parsed: FriendRequestDecisionParsed,
  verbalFallback: string[],
): string[] {
  const fromXml = parsed.postAcceptGreetingLines
    .map((x) => sanitizeFriendRequestPlainText(x))
    .filter(Boolean)
    .slice(0, 3)
  if (fromXml.length) return fromXml
  const fromVerbal = verbalFallback
    .map((x) => sanitizeFriendRequestPlainText(x))
    .filter(Boolean)
    .slice(0, 3)
  if (fromVerbal.length) return fromVerbal
  return [DEFAULT_POST_ACCEPT_GREETING]
}

export type RunCharacterFriendRequestAdjudicationParams = {
  requestId: string
  playerIdentityId: string
  wechatAccountId?: string | null
  /** 微信「我」页资料；遇见转微信时用于承接提示（非 PlayerIdentity 卡） */
  wechatHomeProfile?: { displayName: string; signature?: string }
  buildFriendRequestAiReply: (params: {
    characterId: string
    messages: FriendRequest['messages']
    replyBias?: string
    contactDeletionCount?: number
    sessionPlayerIdentityId?: string
  }) => Promise<FriendRequestAiReplyResult>
  /** 与 WeChatApp.resolveNewFriendRequest 一致；accept 时返回 friendRequestAcceptedAtMs */
  applyResolution: (requestId: string, action: 'accepted' | 'declined') => Promise<number | undefined>
}

/** 好友通过后：在「以上为验证消息」分割线之下写入角色打招呼 */
export async function appendPostAcceptFriendGreetingMessages(params: {
  characterId: string
  playerIdentityId: string
  wechatAccountId?: string | null
  greetingLines: string[]
  acceptedAtMs: number
  nickname: string
}): Promise<void> {
  const lines = params.greetingLines.map((x) => sanitizeFriendRequestPlainText(x)).filter(Boolean).slice(0, 3)
  if (!lines.length) return

  const sessionPid = params.playerIdentityId.trim() || '__none__'
  const convKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: params.wechatAccountId,
    characterId: params.characterId,
    appSessionPlayerIdentityId: sessionPid,
  })
  const nick = params.nickname?.trim() || params.characterId

  /** 时间戳须按写出顺序单调递增；勿用单条 gap 直接当偏移（后一条 gap 更小时会排到前一条下面）。 */
  let ts = params.acceptedAtMs + 1
  for (let i = 0; i < lines.length; i += 1) {
    const seg = lines[i]!
    if (i > 0) {
      const gap = friendRequestAdjudicationGapMs(seg.length, false)
      if (gap > 0) await new Promise<void>((r) => window.setTimeout(r, gap))
      ts = Math.max(ts + Math.max(gap, 80), Date.now())
    }
    await personaDb.appendWeChatChatMessage({
      id: `fr-greet-${ts}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      characterId: params.characterId,
      playerIdentityId: sessionPid,
      type: 'character',
      content: seg,
      timestamp: ts,
      isRead: false,
      conversationKey: convKey,
      notifyPeerTitle: nick,
    })
    emitWeChatStorageChanged()
  }
  await personaDb.markWeChatConversationUnread(convKey)
  emitWeChatStorageChanged()
}

export async function loadFriendRequestMessagesForAdjudication(params: {
  requestId: string
  characterId: string
  playerIdentityId: string
  wechatAccountId?: string | null
  verificationEpochMs: number
  /** 仅纳入 timestamp ≤ 该值的消息（用户主动申请冻结验证对话） */
  maxTimestampMs?: number
}): Promise<FriendRequest['messages']> {
  const sessionPid = params.playerIdentityId.trim() || '__none__'
  const convKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: params.wechatAccountId,
    characterId: params.characterId,
    appSessionPlayerIdentityId: sessionPid,
  })
  const recent = await personaDb.listWeChatChatMessagesRecent({ conversationKey: convKey, limit: 200 })
  const maxTs =
    typeof params.maxTimestampMs === 'number' && Number.isFinite(params.maxTimestampMs)
      ? params.maxTimestampMs
      : null
  return recent
    .filter((m) => m.timestamp >= params.verificationEpochMs)
    .filter((m) => maxTs == null || m.timestamp <= maxTs)
    .filter((m) => !m.images?.length && !m.redPacket && !m.transfer && !m.callStatus && !m.replyTo)
    .map((m) => ({
      id: m.id,
      sender: (m.type === 'character' ? 'character' : 'user') as 'character' | 'user',
      content: sanitizeFriendRequestPlainText(m.content),
      timestamp: String(m.timestamp),
      timestampMs: m.timestamp,
    }))
    .filter((m) => m.content.length > 0)
}

/**
 * 角色侧回复验证消息；若为用户发起的申请则解析 accept/decline 并回调 applyResolution。
 * 验证回复、裁决与通过后打招呼均仅使用模型输出，不做本地文案兜底。
 */
export async function runCharacterFriendRequestAdjudication(
  params: RunCharacterFriendRequestAdjudicationParams,
): Promise<FriendRequestDecision | null> {
  const frRow = await personaDb.getFriendRequestById(params.requestId)
  if (!frRow || frRow.status !== 'pending') return null

  const chForBind = await personaDb.getCharacter(frRow.characterId)
  const sessionPlayerId =
    resolveOutgoingFriendRequestPlayerIdentityId(chForBind, frRow.playerIdentityId) ||
    params.playerIdentityId.trim()
  if (!sessionPlayerId || sessionPlayerId === '__none__') return null

  const userInitiated = isUserInitiatedFriendRequestSource(frRow.source)
  const verificationEpochMs = frRow.verificationEpochMs ?? frRow.createdAt
  const adjudicationCutoffMs = userInitiated
    ? (frRow.adjudicationCutoffMs ?? frRow.verificationEpochMs ?? verificationEpochMs)
    : undefined
  let messages = await loadFriendRequestMessagesForAdjudication({
    requestId: params.requestId,
    characterId: frRow.characterId,
    playerIdentityId: sessionPlayerId,
    wechatAccountId: params.wechatAccountId,
    verificationEpochMs,
    maxTimestampMs: adjudicationCutoffMs,
  })

  const sessionPid = sessionPlayerId
  const convKey = await resolveAccountScopedPrivateConversationKey({
    wechatAccountId: params.wechatAccountId,
    characterId: frRow.characterId,
    appSessionPlayerIdentityId: sessionPid,
  })

  const nickFromRow = async () => {
    const ch = await personaDb.getCharacter(frRow.characterId)
    return ch?.remark?.trim() || ch?.wechatNickname?.trim() || ch?.name || frRow.characterId
  }

  const applyParsedDecision = async (
    parsed: FriendRequestDecisionParsed,
    nick: string,
    verbalFallback: string[],
  ): Promise<FriendRequestDecision | null> => {
    if (parsed.decision === 'accept') {
      const greetLines = resolvePostAcceptGreetingLines(parsed, verbalFallback)
      if (!parsed.postAcceptGreetingLines.filter((x) => sanitizeFriendRequestPlainText(x)).length) {
        console.warn('[friend-request] adjudicate: accept without XML greeting; using verbal fallback', {
          requestId: params.requestId,
          fallbackCount: greetLines.length,
        })
      }
      const acceptedAtMs = await params.applyResolution(params.requestId, 'accepted')
      if (typeof acceptedAtMs === 'number' && Number.isFinite(acceptedAtMs) && acceptedAtMs > 0) {
        await appendPostAcceptFriendGreetingMessages({
          characterId: frRow.characterId,
          playerIdentityId: sessionPlayerId,
          wechatAccountId: params.wechatAccountId,
          greetingLines: greetLines,
          acceptedAtMs,
          nickname: nick,
        })
      }
    } else {
      await params.applyResolution(params.requestId, 'declined')
    }
    const latest = await personaDb.getFriendRequestById(params.requestId)
    if (latest?.adjudicationLastError) {
      await personaDb.upsertFriendRequest({ ...latest, adjudicationLastError: '', updatedAt: Date.now() })
      emitWeChatStorageChanged()
    }
    return parsed.decision
  }

  if (userInitiated) {
    const charJoined = messages
      .filter((m) => m.sender === 'character')
      .map((m) => m.content)
      .join('\n')
    const fromExisting = stripFriendRequestDecisionBlock(charJoined)
    if (fromExisting.parsed?.decision) {
      return applyParsedDecision(fromExisting.parsed, await nickFromRow(), [])
    }
  }

  const last = messages[messages.length - 1]
  let startDecisionOnly = false
  if (!last || last.sender !== 'user') {
    if (userInitiated && messages.some((m) => m.sender === 'character')) {
      startDecisionOnly = true
    } else {
      console.warn('[friend-request] adjudicate skipped: last message is not from user', {
        requestId: params.requestId,
        messageCount: messages.length,
      })
      return null
    }
  }

  const meetBias = userInitiated
    ? await buildMeetFriendRequestAdjudicationBias(frRow, params.wechatHomeProfile)
    : ''
  const userOnlyMessages = messages.filter((m) => m.sender === 'user')

  const runAiRound = async (opts: {
    decisionOnly: boolean
    finalAttempt?: boolean
  }): Promise<{
    ai: FriendRequestAiReplyResult
    parsed: FriendRequestDecisionParsed | null
    aiTexts: string[]
  }> => {
    const replyBias = [
      userInitiated ? buildUserInitiatedFriendRequestAdjudicationBias() : undefined,
      meetBias,
      opts.decisionOnly
        ? opts.finalAttempt
          ? DECISION_ONLY_RETRY_BIAS_FINAL
          : DECISION_ONLY_RETRY_BIAS
        : undefined,
    ]
      .filter(Boolean)
      .join('\n\n')
    const ai = await params.buildFriendRequestAiReply({
      characterId: frRow.characterId,
      messages: opts.decisionOnly ? userOnlyMessages : messages,
      replyBias: replyBias || undefined,
      sessionPlayerIdentityId: sessionPlayerId,
    })
    const bubbleText = ai.bubbles
      .map((x) => String(x || '').trim())
      .filter((x) => x.length > 0)
      .join('\n')
    const rawJoined = (ai.rawText?.trim() || bubbleText).trim()
    const { parsed, bodyForBubbles } = stripFriendRequestDecisionBlock(rawJoined)
    const seenLine = new Set<string>()
    const aiTexts = splitFriendRequestReplyLines(
      bodyForBubbles,
      parsed?.postAcceptGreetingLines ?? [],
    )
      .map((x) => sanitizeFriendRequestPlainText(x))
      .filter(Boolean)
      .filter((line) => {
        const key = line.toLowerCase()
        if (seenLine.has(key)) return false
        seenLine.add(key)
        return true
      })
    return { ai, parsed: parsed ?? null, aiTexts }
  }

  const appendVerbalBubbles = async (aiTexts: string[], nick: string) => {
    const lines = aiTexts
      .map((x) => sanitizeFriendRequestPlainText(x))
      .filter(Boolean)
    if (!lines.length) return
    const recent = await personaDb.listWeChatChatMessagesRecent({ conversationKey: convKey, limit: 16 })
    const existingChar = new Set(
      recent
        .filter((m) => m.type === 'character')
        .map((m) => sanitizeFriendRequestPlainText(m.content))
        .filter(Boolean),
    )
    const toWrite = lines.filter((line) => !existingChar.has(line))
    if (!toWrite.length) return
    const baseTs = Date.now()
    for (let i = 0; i < toWrite.length; i += 1) {
      const seg = toWrite[i]!
      const gap = friendRequestAdjudicationGapMs(seg.length, i === 0)
      if (gap > 0) await new Promise<void>((r) => window.setTimeout(r, gap))
      await personaDb.appendWeChatChatMessage({
        id: `fr-ai-${baseTs}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        characterId: frRow.characterId,
        playerIdentityId: sessionPid,
        type: 'character',
        content: seg,
        timestamp: Date.now(),
        isRead: false,
        conversationKey: convKey,
        notifyPeerTitle: nick,
      })
      emitWeChatStorageChanged()
    }
    await personaDb.markWeChatConversationReadToLatest(convKey)
    emitWeChatStorageChanged()
  }

  const parseDecisionFromStoredCharacterText = async (): Promise<FriendRequestDecisionParsed | null> => {
    const recent = await loadFriendRequestMessagesForAdjudication({
      requestId: params.requestId,
      characterId: frRow.characterId,
      playerIdentityId: sessionPlayerId,
      wechatAccountId: params.wechatAccountId,
      verificationEpochMs,
      maxTimestampMs: adjudicationCutoffMs,
    })
    const charJoined = recent
      .filter((m) => m.sender === 'character')
      .map((m) => m.content)
      .join('\n')
    return stripFriendRequestDecisionBlock(charJoined).parsed
  }

  let nick = ''
  let parsed: FriendRequestDecisionParsed | null = null
  let verbalFallback: string[] = []

  try {
    const first = await runAiRound({ decisionOnly: startDecisionOnly })
    nick = first.ai.nickname?.trim() || (await nickFromRow())
    parsed = first.parsed
    verbalFallback = [...first.aiTexts]
    if (!startDecisionOnly) {
      await appendVerbalBubbles(first.aiTexts, nick)
    }

    if (userInitiated && !parsed?.decision) {
      parsed = await parseDecisionFromStoredCharacterText()
    }

    for (let round = 1; userInitiated && !parsed?.decision && round < MAX_USER_INITIATED_DECISION_ROUNDS; round += 1) {
      const retry = await runAiRound({
        decisionOnly: true,
        finalAttempt: round >= MAX_USER_INITIATED_DECISION_ROUNDS - 1,
      })
      nick = retry.ai.nickname?.trim() || nick
      parsed = retry.parsed ?? (await parseDecisionFromStoredCharacterText())
      if (retry.aiTexts.length) verbalFallback = [...retry.aiTexts]
    }

    if (userInitiated && !parsed?.decision) {
      const recentChar = (
        await loadFriendRequestMessagesForAdjudication({
          requestId: params.requestId,
          characterId: frRow.characterId,
          playerIdentityId: sessionPlayerId,
          wechatAccountId: params.wechatAccountId,
          verificationEpochMs,
          maxTimestampMs: adjudicationCutoffMs,
        })
      )
        .filter((m) => m.sender === 'character')
        .map((m) => m.content)
      const inferred = inferFriendRequestDecisionFromCharacterText([
        ...verbalFallback,
        ...recentChar,
      ])
      if (inferred) {
        console.warn('[friend-request] adjudicate: XML missing; applying verbal decision fallback', {
          requestId: params.requestId,
          inferred,
        })
        parsed = {
          decision: inferred,
          postAcceptGreetingLines:
            inferred === 'accept' ? resolvePostAcceptGreetingLines(
                { decision: 'accept', postAcceptGreetingLines: [] },
                verbalFallback,
              ) : [],
        }
      }
    }
  } catch (e) {
    console.warn('[friend-request] buildFriendRequestAiReply failed', e)
    throw e
  }

  if (userInitiated) {
    if (!parsed?.decision) {
      console.warn('[friend-request] adjudicate: missing or invalid <decision> in model XML', {
        requestId: params.requestId,
      })
      const latest = await personaDb.getFriendRequestById(params.requestId)
      if (latest?.status === 'pending') {
        await personaDb.upsertFriendRequest({
          ...latest,
          adjudicationLastError: FRIEND_REQUEST_ADJUDICATION_INCOMPLETE_ERROR,
          updatedAt: Date.now(),
        })
        emitWeChatStorageChanged()
      }
      return null
    }
    return applyParsedDecision(parsed, nick, verbalFallback)
  }

  return parsed?.decision ?? null
}
