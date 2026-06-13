import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import { assignOrganicCharacterAnchors } from './momentInteractionTiming'
import {
  minimumCommentCountForEngagementPreset,
  sampleByEngagementPercent,
  type ResolvedUserMomentEngagementRules,
  type UserMomentEngagementPresetId,
} from './userMomentEngagementRules'

export type MomentEngagementTier = 'close' | 'normal' | 'distant'

const CLOSE_RELATION_HINTS = [
  '恋人',
  '爱人',
  '男友',
  '女友',
  '老公',
  '老婆',
  '未婚',
  '夫妻',
  '情侣',
  '闺蜜',
  '死党',
  '挚友',
  '好朋友',
  '好友',
  '密友',
  '发小',
  '青梅竹马',
  '亲密',
  '宝贝',
  '宝宝',
  '竹马',
  '青梅',
  '兄弟',
  '姐妹',
  '搭子',
]

const DISTANT_RELATION_HINTS = [
  '冷战',
  '陌生',
  '仇人',
  '敌对',
  '拉黑',
  '冷淡',
  '决裂',
  '分手',
  '绝交',
  '疏远',
  '形同陌路',
  '不想理',
  '讨厌',
]

function collectPlayerRelationshipText(
  charId: string,
  playerIdentityId: string | null | undefined,
  relationships: ReadonlyArray<Relationship>,
): string {
  const cid = charId.trim()
  const pid = playerIdentityId?.trim()
  if (!cid || !pid || pid === '__none__') return ''

  const chunks: string[] = []
  for (const r of relationships) {
    if (!r.isPlayerIdentity) continue
    const from = r.fromCharacterId.trim()
    const to = r.toCharacterId.trim()
    if (from === cid && to === pid) {
      chunks.push(r.relation, r.fromPerspective, r.toPerspective, r.fromCallsTo)
    }
    if (from === pid && to === cid) {
      chunks.push(r.relation, r.toPerspective, r.fromPerspective)
    }
  }
  return chunks.join(' ')
}

function includesHint(text: string, hints: readonly string[]): boolean {
  const lower = text.toLowerCase()
  return hints.some((hint) => lower.includes(hint.toLowerCase()))
}

/** 根据玩家↔角色人脉与近期私聊热度，推断刷圈互动倾向 */
export function inferMomentEngagementTier(
  charId: string,
  playerIdentityId: string | null | undefined,
  relationships: ReadonlyArray<Relationship>,
  recentPrivateMessageCount = 0,
): MomentEngagementTier {
  const relText = collectPlayerRelationshipText(charId, playerIdentityId, relationships)

  if (relText && includesHint(relText, DISTANT_RELATION_HINTS)) return 'distant'
  if (recentPrivateMessageCount >= 4) return 'close'
  if (relText && includesHint(relText, CLOSE_RELATION_HINTS)) return 'close'
  if (recentPrivateMessageCount >= 2) return 'normal'
  if (!relText.trim()) return 'normal'
  return 'normal'
}

const DEFAULT_MAX_ENGAGEMENT_AI_CALLS = 20

function resolveMaxAiCharacters(rules?: ResolvedUserMomentEngagementRules): number {
  return rules?.maxAiCharacters ?? DEFAULT_MAX_ENGAGEMENT_AI_CALLS
}

function shouldFallbackLike(
  tier: MomentEngagementTier,
  isMentioned: boolean,
  charId: string,
  rules?: ResolvedUserMomentEngagementRules,
): boolean {
  if (isMentioned) {
    const percent = rules?.fallbackLikePercentMentioned ?? 100
    return sampleByEngagementPercent(charId, percent, 'fallback-mention')
  }
  if (tier === 'close') {
    const percent = rules?.fallbackLikePercentClose ?? 100
    return sampleByEngagementPercent(charId, percent, 'fallback-close')
  }
  if (tier === 'normal') {
    const percent = rules?.fallbackLikePercentNormal ?? 68
    return sampleByEngagementPercent(charId, percent, 'fallback-normal')
  }
  return false
}

/**
 * AI 全失败时的保底：熟人/被 @ 的角色至少点赞，关系一般者按稳定比例补赞。
 * 避免 finalize 后只剩 viewed 浏览记录。
 */
export function injectFallbackEngagementDrafts(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
  params: {
    playerIdentityId?: string | null
    mentionedCharacterIds?: ReadonlySet<string>
    relationships: ReadonlyArray<Relationship>
    engagementRules?: ResolvedUserMomentEngagementRules
  },
): AiMomentInteractionDraft[] {
  const engaged = new Set<string>()
  for (const d of drafts) {
    if (d.type !== 'like' && d.type !== 'comment') continue
    const id = d.charId.trim()
    if (id) engaged.add(id)
  }

  const mentioned = params.mentionedCharacterIds ?? new Set<string>()
  const out = [...drafts]
  const fallbackCharIds: string[] = []

  for (const c of allowed) {
    const id = c.charId.trim()
    if (!id || engaged.has(id)) continue

    const tier = inferMomentEngagementTier(
      id,
      params.playerIdentityId,
      params.relationships,
      0,
    )
    const isMentioned = mentioned.has(id)

    if (tier === 'distant' && !isMentioned) continue

    if (!shouldFallbackLike(tier, isMentioned, id, params.engagementRules)) continue
    fallbackCharIds.push(id)
  }

  const anchors = assignOrganicCharacterAnchors(fallbackCharIds.sort((a, b) => a.localeCompare(b)))
  for (const id of fallbackCharIds) {
    out.push({
      charId: id,
      type: 'like',
      delaySeconds: anchors.get(id) ?? 30,
    })
    engaged.add(id)
  }

  return out
}

function hashCharSeed(charId: string, salt: string): number {
  let h = 0
  for (let i = 0; i < charId.length; i += 1) {
    h = (h * 31 + charId.charCodeAt(i)) >>> 0
  }
  for (let i = 0; i < salt.length; i += 1) {
    h = (h * 17 + salt.charCodeAt(i)) >>> 0
  }
  return h
}

function buildTemplateFallbackComment(
  momentContent: string,
  imageCount: number,
  charId: string,
): string {
  const seed = hashCharSeed(charId, 'fallback-comment')
  const text = momentContent.trim()
  if (text.length > 0) {
    const snippet = text.slice(0, 20).replace(/\s+/g, ' ')
    const options = [
      snippet.length >= 3 ? `${snippet}${text.length > 20 ? '…' : ''}` : null,
      '哈哈哈哈',
      '可以可以',
      '有点东西',
      '笑死',
      '这条不错',
      '学到了',
    ].filter(Boolean) as string[]
    return options[seed % options.length]!
  }
  if (imageCount > 0) {
    const options = ['图不错', '好看', '这构图可以', '存了']
    return options[seed % options.length]!
  }
  return '👍'
}

function momentHasCommentableContent(momentContent: string, imageCount: number): boolean {
  return momentContent.trim().length > 0 || imageCount > 0
}

/**
 * AI 评论补全仍不足时，为高互动预设注入短评保底（避免只有赞无评）。
 */
export function injectFallbackCommentDrafts(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
  params: {
    momentContent: string
    imageCount: number
    playerIdentityId?: string | null
    mentionedCharacterIds?: ReadonlySet<string>
    relationships: ReadonlyArray<Relationship>
    engagementRules?: ResolvedUserMomentEngagementRules
  },
): AiMomentInteractionDraft[] {
  const presetId = params.engagementRules?.presetId as UserMomentEngagementPresetId | undefined
  const minComments = minimumCommentCountForEngagementPreset(presetId)
  if (minComments <= 0) return drafts
  if (!momentHasCommentableContent(params.momentContent, params.imageCount)) return drafts

  const commentAuthors = new Set<string>()
  for (const d of drafts) {
    if (d.type === 'comment' && d.content?.trim()) commentAuthors.add(d.charId.trim())
  }
  if (commentAuthors.size >= minComments) return drafts

  const mentioned = params.mentionedCharacterIds ?? new Set<string>()
  type Candidate = { character: AllowedMomentCharacter; score: number; likeDelay?: number }
  const candidates: Candidate[] = []

  for (const character of allowed) {
    const id = character.charId.trim()
    if (!id || commentAuthors.has(id)) continue
    const mentionedChar = mentioned.has(id)
    const tier = inferMomentEngagementTier(
      id,
      params.playerIdentityId,
      params.relationships,
      0,
    )
    if (tier === 'distant' && !mentionedChar) continue
    const likeDraft = drafts.find((d) => d.charId.trim() === id && d.type === 'like')
    let score = tier === 'close' ? 3 : tier === 'normal' ? 2 : 1
    if (mentionedChar) score += 4
    if (likeDraft) score += 2
    candidates.push({
      character,
      score,
      likeDelay: likeDraft?.delaySeconds,
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  const out = [...drafts]
  const anchors = assignOrganicCharacterAnchors(
    candidates.map((c) => c.character.charId.trim()).sort((a, b) => a.localeCompare(b)),
  )

  for (const { character, likeDelay } of candidates) {
    if (commentAuthors.size >= minComments) break
    const id = character.charId.trim()
    const content = buildTemplateFallbackComment(
      params.momentContent,
      params.imageCount,
      id,
    )
    const baseDelay = likeDelay != null ? likeDelay + 12 : anchors.get(id) ?? 48
    out.push({
      charId: character.charId,
      type: 'comment',
      content,
      delaySeconds: baseDelay,
    })
    commentAuthors.add(id)
  }

  return out
}

/**
 * 按关系筛选会调用 AI 的角色：@ 必参与；关系熟的全参与；关系一般也参与（由模型按内容决定互动深浅）；
 * 仅明显冷淡/敌对关系跳过 AI（仍可能有静默浏览足迹）。
 */
export function selectCharactersForMomentEngagement(params: {
  allowed: AllowedMomentCharacter[]
  mentionedCharacterIds: ReadonlySet<string>
  relationships: ReadonlyArray<Relationship>
  playerIdentityId?: string | null
  recentPrivateMessageCountByCharId?: ReadonlyMap<string, number>
  engagementRules?: ResolvedUserMomentEngagementRules
}): AllowedMomentCharacter[] {
  const {
    allowed,
    mentionedCharacterIds,
    relationships,
    playerIdentityId,
    recentPrivateMessageCountByCharId,
    engagementRules,
  } = params

  const maxAi = resolveMaxAiCharacters(engagementRules)
  const normalSample = engagementRules?.normalAiSamplePercent ?? 100
  const distantSample = engagementRules?.distantAiSamplePercent ?? 0

  const mentioned: AllowedMomentCharacter[] = []
  const close: AllowedMomentCharacter[] = []
  const normal: AllowedMomentCharacter[] = []
  const distant: AllowedMomentCharacter[] = []
  const seen = new Set<string>()

  const pushUnique = (list: AllowedMomentCharacter[], c: AllowedMomentCharacter) => {
    const id = c.charId.trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    list.push(c)
  }

  for (const c of allowed) {
    const id = c.charId.trim()
    if (!id) continue
    if (mentionedCharacterIds.has(id)) {
      pushUnique(mentioned, c)
      continue
    }

    const recentCount = recentPrivateMessageCountByCharId?.get(id) ?? 0
    const tier = inferMomentEngagementTier(id, playerIdentityId, relationships, recentCount)
    if (tier === 'distant') {
      if (distantSample > 0 && sampleByEngagementPercent(id, distantSample, 'ai-distant')) {
        pushUnique(distant, c)
      }
      continue
    }
    if (tier === 'close') pushUnique(close, c)
    else if (sampleByEngagementPercent(id, normalSample, 'ai-normal')) pushUnique(normal, c)
  }

  const out: AllowedMomentCharacter[] = []
  for (const c of mentioned) pushUnique(out, c)
  for (const c of close) pushUnique(out, c)
  for (const c of distant) {
    if (out.length >= maxAi) break
    pushUnique(out, c)
  }
  for (const c of normal) {
    if (out.length >= maxAi) break
    pushUnique(out, c)
  }

  return out
}

export function buildMomentEngagementTierPromptBlock(
  tier: MomentEngagementTier,
  mentioned: boolean,
  engagementRules?: ResolvedUserMomentEngagementRules,
): string {
  const intensity = engagementRules?.aiIntensityPrompt?.trim()
  const intensityBlock = intensity ? `\n${intensity}` : ''
  const overflowMode = engagementRules?.presetId === 'overflow'
  const livelyMode = engagementRules?.presetId === 'lively'
  const highCommentMode = overflowMode || livelyMode

  if (mentioned) {
    const mentionExtra = highCommentMode
      ? ' 被 @ 时**优先 comment**（可 like+comment），不要只点赞。'
      : ''
    return `- 用户 @ 提醒了你：你知晓被提及；关系熟则多半会互动，关系淡也至少考虑点赞。${mentionExtra}${intensityBlock}`
  }
  if (tier === 'close') {
    return [
      '- 【关系】你和用户很熟、常联络：刷到熟人圈**大概率会点赞**；有话想说就 comment 1～2 句，像真人随手评，不要表演。',
      overflowMode
        ? '- 【超热闹】熟人请优先 like+comment，不要只点赞；这条圈评区应有人接话。'
        : livelyMode
          ? '- 【热闹】熟人多半会评论，别只点赞。'
          : '- 除非在冷战/赌气且人设会已读不回，否则不要对熟人圈完全无反应。',
      intensityBlock,
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (tier === 'distant') {
    return [
      '- 【关系】当前与用户关系冷淡或敌对：默认不点赞不评论；仅当内容与你强相关且人设会破例时才互动。',
      overflowMode
        ? '- 【超热闹例外】若内容与你有关、有槽点，仍可短评一句，勿只点赞。'
        : '',
      intensityBlock,
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    '- 【关系】与用户关系一般：平淡日常可 {"interactions":[]}；',
    highCommentMode
      ? '- 【高互动】有正文/配图时更倾向 comment 或 like+comment，**不要全员只点赞**；看见值得回应的内容应留一句。'
      : '- 若内容**特别有意义、有趣、好笑、有争议、触动你、与你有关**，可以 like 或短评；别对好内容也完全冷漠。',
    '- 不是每条都要评，但看见值得回应的内容应像真人一样伸手点赞或留一句。',
    intensityBlock,
  ]
    .filter(Boolean)
    .join('\n')
}
