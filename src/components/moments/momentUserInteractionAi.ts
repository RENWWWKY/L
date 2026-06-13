import type { ApiConfig } from '../../phone/apps/api/types'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'
import type { WeChatChatMessage } from '../../phone/apps/wechat/newFriendsPersona/types'
import { materializeSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'

import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import {
  assignOrganicCharacterAnchors,
  clampMomentInteractionDelay,
} from './momentInteractionTiming'
import { detectUserGhostedChatButPostedMoment } from './momentUserInteractionContext'
import { assertMomentsChatApiConfigured, isMomentsChatApiConfigured } from './momentsChatApiReady'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import {
  buildMomentEngagementTierPromptBlock,
  inferMomentEngagementTier,
  injectFallbackCommentDrafts,
  selectCharactersForMomentEngagement,
  type MomentEngagementTier,
} from './momentEngagementAudience'
import { loadMomentRelationships } from './momentRelationshipGraph'
import type { ResolvedUserMomentEngagementRules } from './userMomentEngagementRules'
import {
  isHighCommentEngagementPreset,
  minimumCommentCountForEngagementPreset,
} from './userMomentEngagementRules'
import { finalizeMomentInteractionDrafts } from './momentVisitorFootprints'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import { runMomentsVisionChat } from './momentVisionChat'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'

const ENGAGEMENT_AI_CONCURRENCY = 4

function momentHasCommentableContent(momentContent: string, imageCount: number): boolean {
  return momentContent.trim().length > 0 || imageCount > 0
}

function draftsHaveComment(drafts: AiMomentInteractionDraft[]): boolean {
  return drafts.some((d) => d.type === 'comment' && d.content?.trim())
}

function mergeDraftsPreferringComments(
  base: AiMomentInteractionDraft[],
  extra: AiMomentInteractionDraft[],
): AiMomentInteractionDraft[] {
  if (!extra.length) return base
  const out = [...base]
  const hasLike = out.some((d) => d.type === 'like')
  for (const d of extra) {
    if (d.type === 'comment' && d.content?.trim()) {
      out.push(d)
      continue
    }
    if (d.type === 'like' && !hasLike) out.push(d)
  }
  return out.slice(0, 2)
}

function collectCommentAuthorIds(drafts: AiMomentInteractionDraft[]): Set<string> {
  const ids = new Set<string>()
  for (const d of drafts) {
    if (d.type === 'comment' && d.content?.trim()) ids.add(d.charId.trim())
  }
  return ids
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return []
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

const USER_MOMENT_INTERACTION_TASK = `
---
【朋友圈评论任务 · 最高优先级】
你正在以**本角色本人**对用户朋友圈做出反应（点赞 / 评论 / 浏览），不是在当第三方「互动编排器」。
- 评论即你在微信朋友圈下的真实留言：语气、句式、长短、口癖、emoji 习惯须与 system 中【近期私聊】里**你（角色）说过的话**一致。
- 私聊里克制、短句、少感叹 → 评论里也须如此；**禁止**突然变萌宠网红体、客服体、翻译腔。
- **禁止**因角色名/昵称含「狗/猫」等就写「帮你咬他」「哇太乖了」式模板，除非私聊里你本就这种说话方式。
- comment 最多 1～2 句，像真人随手评，不要戏精表演。
- comment **必须**承接上方朋友圈正文的具体内容/情绪（如用户说困→关心睡觉、调侃熬夜等），**禁止**「看到了」「收到」「不错哦」等空话。
- 若 system 中【人脉关系】写明你如何称呼其他角色，评区提到对方时必须用该称呼，禁止臆造「学姐/学长」等与关系不符的叫法。
- 只输出 JSON，不要 Markdown。
${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

function buildUserMomentInteractionSystemTask(
  engagementRules?: ResolvedUserMomentEngagementRules,
): string {
  if (isHighCommentEngagementPreset(engagementRules?.presetId)) {
    return `${USER_MOMENT_INTERACTION_TASK}
- 【高互动频度】关系非冷淡时**不要只点赞**：优先输出 comment，或 like+comment；禁止全员沉默或全员只赞。`
  }
  return `${USER_MOMENT_INTERACTION_TASK}
- 可 0 条互动；不必勉强。`
}

function formatRecentPrivateChatToneAnchor(messages: WeChatChatMessage[], limit = 10): string {
  const sorted = [...messages].filter((m) => !m.isRecalled).sort((a, b) => a.timestamp - b.timestamp)
  const tail = sorted.slice(-limit)
  if (!tail.length) return ''
  const lines = tail.map((m) => {
    const who = m.type === 'character' ? '你（角色）' : '用户'
    const text = m.content?.trim().slice(0, 160) || '（非文字消息）'
    return `${who}：${text}`
  })
  return [
    '【近期私聊原文（评论语气须与此一致，尤其模仿「你（角色）」的说话方式）】',
    ...lines,
  ].join('\n')
}

function buildSingleCharacterInteractionTask(params: {
  playerDisplayName: string
  momentContent: string
  imageCount: number
  mentioned: boolean
  engagementTier: MomentEngagementTier
  ghostTease: ReturnType<typeof detectUserGhostedChatButPostedMoment>
  privateChatToneAnchor: string
  engagementRules?: ResolvedUserMomentEngagementRules
  commentOnly?: boolean
}): string {
  const mentionLine = params.mentioned
    ? '\n- 用户在这条朋友圈里 @ 提醒了你；你知晓被提及，但互动深浅仍须符合关系与人设。'
    : ''
  const ghostLine = params.ghostTease
    ? `\n- 【情境】用户约 ${params.ghostTease.gapHours} 小时未回你私聊却发了这条圈；若符合人设，可在 comment 里轻调侃「有空发朋友圈没空回消息」，勿机械模板。`
    : ''
  const tierLine = buildMomentEngagementTierPromptBlock(
    params.engagementTier,
    params.mentioned,
    params.engagementRules,
  )

  return [
    `【任务】你（本角色）看到 ${params.playerDisplayName.trim() || '用户'} 刚发的朋友圈，决定是否点赞/评论`,
    `【朋友圈正文 · 评论必须回应这里】${params.momentContent.trim() || '（无文字）'}`,
    `配图数：${params.imageCount}${mentionLine}${ghostLine}`,
    params.privateChatToneAnchor,
    '',
    tierLine,
    '',
    '输出 JSON：{"interactions":[{"type":"like"|"comment","content":"仅comment需要","delaySeconds":数字}]}',
    params.commentOnly
      ? '【强制】必须输出至少 1 条 type=comment，直接回应正文；可同时 like，但禁止只点赞。'
      : isHighCommentEngagementPreset(params.engagementRules?.presetId)
        ? '可 0～2 条；高互动模式下优先 comment 或 like+comment，**不要只点赞**；有 comment 时须回应正文。'
        : '可 0～2 条；有 comment 时须回应正文具体内容。',
    'delaySeconds 15～600（10 分钟内），**每条须明显错开**（可 20 秒、1 分半、4 分钟等，勿整分钟机械递增）。',
    '禁止 type=viewed；静默浏览由系统另行记录，你只需决定要不要点赞/评论。',
  ]
    .filter(Boolean)
    .join('\n')
}

function parseSingleCharacterInteractions(
  payload: unknown,
  charId: string,
): AiMomentInteractionDraft[] {
  const rows = (() => {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return null
    const o = payload as Record<string, unknown>
    if (Array.isArray(o.interactions)) return o.interactions as unknown[]
    return null
  })()
  if (!rows?.length) return []

  const out: AiMomentInteractionDraft[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const typeRaw = o.type
    const type =
      typeRaw === 'like' || typeRaw === 'comment' ? typeRaw : null
    if (!type) continue

    const delayRaw = Number(o.delaySeconds)
    const delaySeconds = Number.isFinite(delayRaw)
      ? clampMomentInteractionDelay(delayRaw)
      : assignOrganicCharacterAnchors([charId]).get(charId) ?? 45

    if (type === 'comment') {
      const content = sanitizeMomentText(typeof o.content === 'string' ? o.content : '')
      if (!content) continue
      out.push({ charId, type, content: content.slice(0, 280), delaySeconds })
      continue
    }
    out.push({ charId, type, delaySeconds })
    if (out.length >= 2) break
  }
  return out
}

function parseInteractionRaw(raw: string, charId: string): AiMomentInteractionDraft[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const payload = parseModelJsonPayload(trimmed)
  if (!payload) return []
  return parseSingleCharacterInteractions(payload, charId)
}

async function loadPrivateChatMessages(conversationKey: string): Promise<WeChatChatMessage[]> {
  const key = conversationKey.trim()
  if (!key) return []
  try {
    return await personaDb.listWeChatChatMessagesByConversationKey(key)
  } catch {
    return []
  }
}

async function generatePersonaBoundInteractionForCharacter(params: {
  cfg: ApiConfig
  wechatCtx: AnonymousQaWechatContext
  character: AllowedMomentCharacter
  momentContent: string
  momentImages?: string[]
  imageCount: number
  momentPublishedAt: number
  mentioned: boolean
  relationships: ReadonlyArray<Relationship>
  engagementRules?: ResolvedUserMomentEngagementRules
  commentOnly?: boolean
}): Promise<AiMomentInteractionDraft[]> {
  const haystack = [params.momentContent.trim(), '朋友圈 动态 互动 评论'].filter(Boolean).join('\n')
  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.character.charId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: haystack,
    disableMemoryVectorRecall: true,
  })
  if (!pack.character) return []

  const messages = await loadPrivateChatMessages(pack.conversationKey)
  const ghostTease = detectUserGhostedChatButPostedMoment(messages, params.momentPublishedAt)
  const privateChatToneAnchor = formatRecentPrivateChatToneAnchor(messages)
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const recentPrivateMessageCount = messages.filter(
    (m) => !m.isRecalled && params.momentPublishedAt - m.timestamp <= weekMs,
  ).length
  const engagementTier = inferMomentEngagementTier(
    params.character.charId,
    params.wechatCtx.playerIdentityId,
    params.relationships,
    recentPrivateMessageCount,
  )

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: params.wechatCtx.playerIdentityId,
  })

  const systemBase = await materializeSystemContent({
    character: pack.character,
    playerIdentity: pack.playerIdentity,
    playerDisplayName: params.wechatCtx.playerDisplayName.trim() || '朋友',
    promptMode: 'persona',
    longTermMemoryNotes: pack.longTermMemoryNotes || undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
    unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes || undefined,
    unsummarizedGroupNotes: pack.unsummarizedGroupNotes || undefined,
    meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
    unsummarizedMeetNotes: pack.unsMeet?.trim() || undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds: [params.character.charId],
    globalWechatPlate: 'private_chat',
  })

  const system = `${systemBase}\n\n${buildUserMomentInteractionSystemTask(params.engagementRules)}`

  const userTask = buildSingleCharacterInteractionTask({
    playerDisplayName: params.wechatCtx.playerDisplayName,
    momentContent: params.momentContent,
    imageCount: params.imageCount,
    mentioned: params.mentioned,
    engagementTier,
    ghostTease,
    privateChatToneAnchor,
    engagementRules: params.engagementRules,
    commentOnly: params.commentOnly,
  })

  const runOnce = async (retryNote?: string) => {
    const raw = await runMomentsVisionChat(params.cfg, {
      system,
      userText: retryNote ? `${userTask}\n\n${retryNote}` : userTask,
      momentImages: params.momentImages,
      temperature: retryNote ? 0.75 : 0.88,
      max_tokens: 680,
    })
    return parseInteractionRaw(raw, params.character.charId)
  }

  let drafts = await runOnce()
  if (!drafts.length && engagementTier === 'close') {
    drafts = await runOnce(
      '你与用户关系很熟，刷朋友圈通常至少会点赞；请输出包含 like 或简短 comment 的有效 JSON。',
    )
  }
  if (!drafts.length) {
    drafts = await runOnce(
      '上次输出无效。请仅输出 JSON；若有 comment，必须直接回应朋友圈正文（禁止「看到了」「收到」等空话）。',
    )
  }

  const highComment = isHighCommentEngagementPreset(params.engagementRules?.presetId)
  const canComment =
    momentHasCommentableContent(params.momentContent, params.imageCount) &&
    (engagementTier !== 'distant' || params.mentioned)

  if (
    highComment &&
    canComment &&
    !draftsHaveComment(drafts) &&
    (params.commentOnly || engagementTier === 'close' || params.mentioned || engagementTier === 'normal')
  ) {
    const commentPush = await runOnce(
      params.commentOnly
        ? '【强制评论】你必须输出至少一条 type=comment，直接回应朋友圈正文；可同时 like，但禁止只点赞不说话。'
        : '【互动频度偏高】请不要只点赞：在 JSON 中至少包含一条 type=comment（可保留 like），comment 须回应正文具体内容。',
    )
    drafts = mergeDraftsPreferringComments(drafts, commentPush)
  }

  if (params.commentOnly) {
    return drafts.filter((d) => d.type === 'comment' && d.content?.trim()).slice(0, 1)
  }

  return drafts
}

async function supplementUserMomentEngagementComments(params: {
  drafts: AiMomentInteractionDraft[]
  allowed: AllowedMomentCharacter[]
  engagementTargets: AllowedMomentCharacter[]
  mentionedIds: Set<string>
  relationships: ReadonlyArray<Relationship>
  wechatCtx: AnonymousQaWechatContext
  cfg: ApiConfig
  momentContent: string
  momentImages?: string[]
  imageCount: number
  momentPublishedAt: number
  engagementRules?: ResolvedUserMomentEngagementRules
}): Promise<AiMomentInteractionDraft[]> {
  const minComments = minimumCommentCountForEngagementPreset(params.engagementRules?.presetId)
  if (minComments <= 0) return params.drafts
  if (!momentHasCommentableContent(params.momentContent, params.imageCount)) return params.drafts

  const commentAuthors = collectCommentAuthorIds(params.drafts)
  let commentCount = commentAuthors.size
  if (commentCount >= minComments) return params.drafts

  const candidatePool = params.engagementTargets.length
    ? params.engagementTargets
    : params.allowed

  type Candidate = { character: AllowedMomentCharacter; score: number }
  const candidates: Candidate[] = []

  for (const character of candidatePool) {
    const id = character.charId.trim()
    if (!id || commentAuthors.has(id)) continue
    const mentioned = params.mentionedIds.has(id)
    const tier = inferMomentEngagementTier(
      id,
      params.wechatCtx.playerIdentityId,
      params.relationships,
      0,
    )
    if (tier === 'distant' && !mentioned) continue
    let score = tier === 'close' ? 3 : tier === 'normal' ? 2 : 1
    if (mentioned) score += 4
    candidates.push({ character, score })
  }

  candidates.sort((a, b) => b.score - a.score)

  const out = [...params.drafts]
  for (const { character } of candidates) {
    if (commentCount >= minComments) break
    try {
      const extra = await generatePersonaBoundInteractionForCharacter({
        cfg: params.cfg,
        wechatCtx: params.wechatCtx,
        character,
        momentContent: params.momentContent,
        momentImages: params.momentImages,
        imageCount: params.imageCount,
        momentPublishedAt: params.momentPublishedAt,
        mentioned: params.mentionedIds.has(character.charId.trim()),
        relationships: params.relationships,
        engagementRules: params.engagementRules,
        commentOnly: true,
      })
      for (const d of extra) {
        if (d.type !== 'comment' || !d.content?.trim()) continue
        out.push(d)
        commentAuthors.add(d.charId.trim())
        commentCount += 1
        break
      }
    } catch (err) {
      console.error(
        `[momentUserInteractionAi] comment supplement failed charId=${character.charId}`,
        err,
      )
    }
  }

  return out
}

/** 按角色人设分别生成对用户朋友圈的点赞/评论（与私聊同一套 system 注入） */
export async function generatePersonaBoundUserMomentInteractions(params: {
  wechatCtx: AnonymousQaWechatContext
  momentContent: string
  imageCount: number
  momentImages?: string[]
  allowedCharacters: AllowedMomentCharacter[]
  mentionedCharacterIds?: Set<string>
  momentPublishedAt: number
  engagementRules?: ResolvedUserMomentEngagementRules
}): Promise<AiMomentInteractionDraft[]> {
  const cfg = params.wechatCtx.apiConfig
  assertMomentsChatApiConfigured(cfg)

  const mentionedIds = params.mentionedCharacterIds ?? new Set<string>()
  const relationships = await loadMomentRelationships()
  const engagementTargets = selectCharactersForMomentEngagement({
    allowed: params.allowedCharacters,
    mentionedCharacterIds: mentionedIds,
    relationships,
    playerIdentityId: params.wechatCtx.playerIdentityId,
    engagementRules: params.engagementRules,
  })
  const aiTargets =
    engagementTargets.length > 0
      ? engagementTargets
      : params.allowedCharacters.slice(0, params.engagementRules?.maxAiCharacters ?? 20)

  const rows = await mapWithConcurrency(
    aiTargets,
    ENGAGEMENT_AI_CONCURRENCY,
    async (character) => {
      try {
        return await generatePersonaBoundInteractionForCharacter({
          cfg: cfg as ApiConfig,
          wechatCtx: params.wechatCtx,
          character,
          momentContent: params.momentContent,
          momentImages: params.momentImages,
          imageCount: params.imageCount,
          momentPublishedAt: params.momentPublishedAt,
          mentioned: mentionedIds.has(character.charId.trim()),
          relationships,
          engagementRules: params.engagementRules,
        })
      } catch (err) {
        console.error(
          `[momentUserInteractionAi] engagement failed charId=${character.charId}`,
          err,
        )
        return []
      }
    },
  )
  const baseDrafts = rows.flat()
  return baseDrafts
}

/** 保底点赞/浏览之后，再为高互动预设补评论（避免只有赞无评） */
export async function finalizeUserMomentEngagementDrafts(params: {
  drafts: AiMomentInteractionDraft[]
  allowed: AllowedMomentCharacter[]
  mentionedCharacterIds: Set<string>
  playerIdentityId?: string | null
  relationships: ReadonlyArray<Relationship>
  engagementRules?: ResolvedUserMomentEngagementRules
  wechatCtx: AnonymousQaWechatContext | null
  momentContent: string
  momentImages?: string[]
  imageCount: number
  momentPublishedAt: number
}): Promise<AiMomentInteractionDraft[]> {
  const next = finalizeMomentInteractionDrafts(params.drafts, params.allowed, {
    playerIdentityId: params.playerIdentityId,
    mentionedCharacterIds: params.mentionedCharacterIds,
    relationships: params.relationships,
    engagementRules: params.engagementRules,
  })

  const applyFallbackComments = (drafts: AiMomentInteractionDraft[]) =>
    injectFallbackCommentDrafts(drafts, params.allowed, {
      momentContent: params.momentContent,
      imageCount: params.imageCount,
      playerIdentityId: params.playerIdentityId,
      mentionedCharacterIds: params.mentionedCharacterIds,
      relationships: params.relationships,
      engagementRules: params.engagementRules,
    })

  if (!params.wechatCtx || !isMomentsChatApiConfigured(params.wechatCtx.apiConfig)) {
    return applyFallbackComments(next)
  }

  const cfg = params.wechatCtx.apiConfig as ApiConfig
  const relationships = params.relationships.length
    ? params.relationships
    : await loadMomentRelationships()
  const engagementTargets = selectCharactersForMomentEngagement({
    allowed: params.allowed,
    mentionedCharacterIds: params.mentionedCharacterIds,
    relationships,
    playerIdentityId: params.wechatCtx.playerIdentityId,
    engagementRules: params.engagementRules,
  })

  let supplemented = next
  try {
    supplemented = await supplementUserMomentEngagementComments({
      drafts: next,
      allowed: params.allowed,
      engagementTargets,
      mentionedIds: params.mentionedCharacterIds,
      relationships,
      wechatCtx: params.wechatCtx,
      cfg,
      momentContent: params.momentContent,
      momentImages: params.momentImages,
      imageCount: params.imageCount,
      momentPublishedAt: params.momentPublishedAt,
      engagementRules: params.engagementRules,
    })
  } catch (err) {
    console.error('[momentUserInteractionAi] supplement comments failed', err)
  }

  return applyFallbackComments(supplemented)
}
