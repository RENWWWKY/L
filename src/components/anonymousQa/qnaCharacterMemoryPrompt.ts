import type { ApiConfig } from '../../phone/apps/api/types'
import type { OpenAiCompatibleMessage } from '../../phone/apps/wechat/newFriendsPersona/ai'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import { buildCharacterCard, buildSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import {
  buildAnonymousQaPersonaPromptPack,
  resolveDirectedQnaPlayerNameFromPack,
  type AnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from './buildAnonymousQaPersonaContext'
import {
  DIRECTED_COMMENT_DRAMA_RULES,
  DIRECTED_QUESTION_ANONYMITY_PREMISE,
  DIRECTED_QUESTION_ASKER_LABEL,
} from './qnaDirectedPlayerDisplay'

export function apiReadyForQna(cfg: ApiConfig | null): cfg is ApiConfig {
  return !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim())
}

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function formatSpeakerMemoryBlock(remarkName: string, pack: AnonymousQaPersonaPromptPack): string {
  const chunks: string[] = []
  if (pack.longTermMemoryNotes.trim()) {
    chunks.push(`【长期记忆】\n${clip(pack.longTermMemoryNotes, 2200)}`)
  }
  if (pack.unsummarizedPrivateNotes.trim()) {
    chunks.push(`【尚未总结的私聊】\n${clip(pack.unsummarizedPrivateNotes, 1600)}`)
  }
  if (pack.unsummarizedGroupNotes.trim()) {
    chunks.push(`【尚未总结的群聊】\n${clip(pack.unsummarizedGroupNotes, 1200)}`)
  }
  if (pack.offlineDatingPlotsContext.trim()) {
    chunks.push(`【线下剧情】\n${clip(pack.offlineDatingPlotsContext, 1200)}`)
  }
  if (pack.meetEncounterMemoriesContext.trim()) {
    chunks.push(`【遇见承接】\n${clip(pack.meetEncounterMemoriesContext, 800)}`)
  }
  if (pack.unsMeet.trim()) {
    chunks.push(`【尚未总结的遇见会话】\n${clip(pack.unsMeet, 800)}`)
  }
  if (!chunks.length) {
    chunks.push('（暂无额外记忆片段，仅依人设与人脉关系发挥）')
  }
  return [
    `---`,
    `【评论区发言者 · ${remarkName} · 记忆参考（与微信私聊同源；写该角色台词时必须贴合本节，禁止与其它角色串台）】`,
    chunks.join('\n\n'),
  ].join('\n')
}

export type QnaSpeakerRef = { characterId: string; remarkName: string }

/**
 * 单次请求：在答主 system 后追加各羁绊角色各自的记忆块（答主本人已在主 system 中，可跳过）。
 */
export async function buildBoundCharactersMemorySupplement(params: {
  wechatCtx: AnonymousQaWechatContext
  relevanceHaystack: string
  speakers: QnaSpeakerRef[]
  skipCharacterIds?: string[]
  extraChatMemberIds?: string[]
  maxCharsTotal?: number
  /** 定向提问场景：记忆仅供人设参考，不得据此认定提问者/评论者身份 */
  directedQna?: boolean
}): Promise<string> {
  const skip = new Set((params.skipCharacterIds ?? []).map((id) => id.trim()).filter(Boolean))
  const maxTotal = params.maxCharsTotal ?? 10_000
  const blocks: string[] = []

  for (const sp of params.speakers) {
    const cid = sp.characterId.trim()
    if (!cid || skip.has(cid)) continue

    const pack = await buildAnonymousQaPersonaPromptPack({
      characterId: cid,
      wechatCtx: params.wechatCtx,
      relevanceHaystack: params.relevanceHaystack,
    })
    if (!pack.character) continue

    blocks.push(formatSpeakerMemoryBlock(sp.remarkName.trim() || pack.character.name, pack))
    if (blocks.join('\n').length >= maxTotal) break
  }

  if (!blocks.length) return ''

  const intro = params.directedQna
    ? `【评论区多角色记忆参考】\n写某角色发言前必须先对照其对应记忆节。\n${DIRECTED_QUESTION_ANONYMITY_PREMISE}\n${DIRECTED_COMMENT_DRAMA_RULES}`
    : '【评论区多角色记忆参考】\n写某角色发言前，必须先对照其对应记忆节；玩家称呼统一用身份档案名。'
  let joined = `\n\n---\n${intro}\n\n${blocks.join('\n\n')}`
  if (joined.length > maxTotal) {
    joined = clip(joined, maxTotal)
  }
  return joined
}

/** 答主主 system + 各羁绊记忆补充，用于一次请求生成全部回复 */
export async function buildQnaDirectedMergedSystemPrompt(params: {
  authorCharacterId: string
  authorRemarkName: string
  boundSpeakers: QnaSpeakerRef[]
  wechatCtx: AnonymousQaWechatContext
  relevanceHaystack: string
  playerDisplayNameFallback?: string
  extraChatMemberIds?: string[]
}): Promise<{
  system: string
  playerDisplayName: string
} | null> {
  const authorId = params.authorCharacterId.trim()
  const extraIds = [
    authorId,
    ...params.boundSpeakers.map((s) => s.characterId),
    ...(params.extraChatMemberIds ?? []),
  ].filter(Boolean)

  const built = await buildQnaCharacterSystemPrompt({
    characterId: authorId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.relevanceHaystack,
    playerDisplayNameFallback: params.playerDisplayNameFallback,
    extraChatMemberIds: [...new Set(extraIds)],
    hideQuestionAsker: true,
  })
  if (!built) return null

  const supplement = await buildBoundCharactersMemorySupplement({
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.relevanceHaystack,
    speakers: params.boundSpeakers,
    skipCharacterIds: [authorId],
    extraChatMemberIds: [...new Set(extraIds)],
    directedQna: true,
  })

  return {
    system: `${built.system}\n\n${DIRECTED_QUESTION_ANONYMITY_PREMISE}\n\n${DIRECTED_COMMENT_DRAMA_RULES}${supplement}`,
    playerDisplayName: built.playerDisplayName,
  }
}

/** 单角色 · 与微信私聊相同的 system */
export async function buildQnaCharacterSystemPrompt(params: {
  characterId: string
  wechatCtx: AnonymousQaWechatContext
  relevanceHaystack: string
  playerDisplayNameFallback?: string
  extraChatMemberIds?: string[]
  /** 定向提问：system 不注入玩家身份档案，提问者对角色不可识别 */
  hideQuestionAsker?: boolean
}): Promise<{
  system: string
  pack: AnonymousQaPersonaPromptPack
  playerDisplayName: string
} | null> {
  const cid = params.characterId.trim()
  if (!cid) return null

  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: cid,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.relevanceHaystack,
  })
  if (!pack.character) return null

  const hideAsker = params.hideQuestionAsker === true
  const playerDisplayName = hideAsker
    ? DIRECTED_QUESTION_ASKER_LABEL
    : resolveDirectedQnaPlayerNameFromPack(
        pack,
        params.wechatCtx,
        params.playerDisplayNameFallback,
      )

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: pack.sessionPlayerIdentityId,
  })

  const memberIds = [
    cid,
    ...(params.extraChatMemberIds ?? []).map((id) => id.trim()).filter(Boolean),
  ]
  const chatMemberIds = [...new Set(memberIds)]

  const system = buildSystemContent({
    character: pack.character,
    playerIdentity: hideAsker ? null : pack.playerIdentity,
    playerDisplayName,
    promptMode: 'persona',
    longTermMemoryNotes: pack.longTermMemoryNotes || undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
    unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes || undefined,
    unsummarizedGroupNotes: pack.unsummarizedGroupNotes || undefined,
    meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
    unsummarizedMeetNotes: pack.unsMeet || undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds,
  })

  return { system, pack, playerDisplayName }
}

const INTERACTION_JSON_SYSTEM = `你是「匿问我答」定向提问详情页的评论区脚本生成器（不是微信私聊）。
唯一任务：根据用户给出的【场景】【人脉】【多角色记忆参考】，输出一个合法 JSON 对象。
硬性要求：
- 只输出 JSON 本体，禁止 Markdown 代码块、禁止任何解释或前后缀；
- 根对象必须包含 replies 数组（3~4 条）；
- 每条含 id、authorName、authorType（character 或 author）、replyToName、content、delayInSeconds；
- 写谁的发言必须对照该角色在【记忆参考】中的条目，禁止串台、禁止 OOC；
- 定向提问的发起人对所有角色身份保密，不得认定或直呼提问者，只能含糊猜测；
- 允许羁绊因人设关系在回复中形成修罗场式互怼，但必须 OOC-free。`

/**
 * 评论区互动专用：不用微信扮演 system（避免模型改回聊天口吻），记忆与人脉放在 user 里。
 */
export async function buildQnaDirectedInteractionMessages(params: {
  authorCharacterId: string
  authorRemarkName: string
  boundSpeakers: QnaSpeakerRef[]
  wechatCtx: AnonymousQaWechatContext
  relevanceHaystack: string
  userTaskBody: string
  formatAppendix: string
  playerDisplayNameFallback?: string
  /** 评论区：@ 玩家用微信昵称；匿名时不注入身份档案 */
  playerWechatNickname?: string
  userCommentAnonymous?: boolean
}): Promise<{
  messages: OpenAiCompatibleMessage[]
  playerWechatNickname: string
  playerIdentityName?: string
  userCommentAnonymous: boolean
} | null> {
  const authorId = params.authorCharacterId.trim()
  const extraIds = [
    authorId,
    ...params.boundSpeakers.map((s) => s.characterId),
  ].filter(Boolean)

  const built = await buildQnaCharacterSystemPrompt({
    characterId: authorId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.relevanceHaystack,
    playerDisplayNameFallback: params.playerDisplayNameFallback,
    extraChatMemberIds: [...new Set(extraIds)],
  })
  if (!built?.pack.character) return null

  const allSpeakers: QnaSpeakerRef[] = [
    { characterId: authorId, remarkName: params.authorRemarkName.trim() || built.pack.character.name },
    ...params.boundSpeakers,
  ]

  const memorySupplement = await buildBoundCharactersMemorySupplement({
    wechatCtx: params.wechatCtx,
    relevanceHaystack: params.relevanceHaystack,
    speakers: allSpeakers,
    extraChatMemberIds: [...new Set(extraIds)],
    maxCharsTotal: 12_000,
    directedQna: true,
  })

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: built.pack.character,
    sessionPlayerIdentityId: built.pack.sessionPlayerIdentityId,
  })

  const authorCard = clip(buildCharacterCard(built.pack.character), 1200)
  const wxNick =
    params.playerWechatNickname?.trim() ||
    params.wechatCtx.playerDisplayName?.trim() ||
    params.playerDisplayNameFallback?.trim() ||
    '我'
  const anonymous = params.userCommentAnonymous === true
  const playerIdentityBlock =
    !anonymous && built.pack.playerIdentity
      ? clip(buildCharacterCard(built.pack.playerIdentity), 900)
      : ''

  const playerHeader = anonymous
    ? `【评论区玩家展示名】匿名（本条评论已匿名：禁止在 replyToName 或正文中写微信昵称/身份档案姓名；可凭口吻猜测，不得点破真名）`
    : `【评论区@玩家须用微信昵称】${wxNick}（禁止用身份档案姓名作 replyToName；该评论者不一定是定向提问发起人）`

  const userContent = [
    DIRECTED_QUESTION_ANONYMITY_PREMISE,
    playerHeader,
    playerIdentityBlock
      ? `【评论者身份档案 · 仅供理解本条评论语境；禁止据此认定其就是提问发起人；replyToName 仍必须用微信昵称】\n${playerIdentityBlock}`
      : '',
    `【答主档案摘要】\n${authorCard}`,
    networkRelationshipsBlock?.trim()
      ? `【答主人脉关系】\n${clip(networkRelationshipsBlock, 3500)}`
      : '',
    memorySupplement,
    params.userTaskBody.trim(),
    params.formatAppendix.trim(),
    DIRECTED_COMMENT_DRAMA_RULES,
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    playerWechatNickname: wxNick,
    playerIdentityName: anonymous ? undefined : built.playerDisplayName,
    userCommentAnonymous: anonymous,
    messages: [
      { role: 'system', content: INTERACTION_JSON_SYSTEM },
      { role: 'user', content: userContent },
    ],
  }
}
