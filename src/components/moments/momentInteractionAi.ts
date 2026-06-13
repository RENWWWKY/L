import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'
import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import type { ApiConfig } from '../../phone/apps/api/types'

import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import { clampMomentInteractionDelay, MOMENT_INTERACTION_DELAY_MAX_SECONDS } from './momentInteractionTiming'
import { generatePersonaBoundUserMomentInteractions } from './momentUserInteractionAi'
import { supplementUserMomentCharacterThreads } from './momentUserMomentPublishThreadAi'
import type { ResolvedUserMomentEngagementRules } from './userMomentEngagementRules'
import {
  buildUserMomentEngagementRulesPromptAppendix,
} from './userMomentEngagementRules'
import { trimEngagementDraftsToPresetLimits } from './momentEngagementAudience'
import {
  buildMomentCharacterRelationshipPromptBlock,
  loadMomentRelationships,
} from './momentRelationshipGraph'
import { assertMomentsChatApiConfigured, isMomentsChatApiConfigured } from './momentsChatApiReady'
import { MOMENT_TEXT_OUTPUT_HINT, sanitizeMomentText } from './momentTextSanitize'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import { runMomentsVisionChat } from './momentVisionChat'

function extractInteractionsArray(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  if (Array.isArray(o.interactions)) return o.interactions as unknown[]
  return null
}

function normalizeDraft(
  raw: unknown,
  allowedCharIds: Set<string>,
): AiMomentInteractionDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const charId = typeof o.charId === 'string' ? o.charId.trim() : ''
  if (!charId || !allowedCharIds.has(charId)) return null

  const typeRaw = o.type
  const type =
    typeRaw === 'like' || typeRaw === 'comment' ? typeRaw : null
  if (!type) return null

  const delayRaw = Number(o.delaySeconds)
  const delaySeconds = Number.isFinite(delayRaw)
    ? clampMomentInteractionDelay(delayRaw)
    : 90

  if (type === 'comment') {
    const content = sanitizeMomentText(typeof o.content === 'string' ? o.content : '')
    if (!content) return null
    const replyToCharId =
      typeof o.replyToCharId === 'string' && allowedCharIds.has(o.replyToCharId.trim())
        ? o.replyToCharId.trim()
        : undefined
    return { charId, type, content: content.slice(0, 280), delaySeconds, replyToCharId }
  }

  return { charId, type, delaySeconds }
}

function buildSystemPrompt(
  allowed: AllowedMomentCharacter[],
  mentioned: AllowedMomentCharacter[],
  withCharacterContexts: boolean,
  relationshipBlock = '',
  engagementRules?: ResolvedUserMomentEngagementRules,
): string {
  const roster = allowed.map((c) => `${c.charId}（${c.displayName}）`).join('、')
  const typeUnion = '"like"|"comment"'
  const mentionBlock = mentioned.length
    ? `\n\n【提醒谁看 · 被 @ 的角色】
${mentioned.map((c) => `- ${c.displayName}（${c.charId}）`).join('\n')}
这些角色**一定知道**用户这条朋友圈提到了自己（会刷到/收到提醒感）。
**禁止**因被 @ 就强行点赞/评论；须结合人设、与用户当前关系、是否在冷战/赌气/闹矛盾等。
关系冷淡/冷战/赌气时：仅 type=viewed（若允许）或不输出该角色任何互动，**不要**违心点赞评论。
关系正常/亲密时：可 like/comment，仍须符合性格。`
    : ''

  const engagementBlock = engagementRules
    ? `\n\n${buildUserMomentEngagementRulesPromptAppendix(engagementRules)}`
    : ''

  return `你是虚拟社交网络中的「朋友圈互动编排器」。
必须仅输出一个 JSON 对象，不要 Markdown，不要解释。
JSON 结构：
{"interactions":[{"charId":"角色ID","type":${typeUnion},"content":"仅评论需要","delaySeconds":数字,"dwellSeconds":"仅viewed","replyToCharId":"可选，回复某角色的 comment 时填其 charId"}]}

规则：
1. charId 必须来自允许名单，严禁编造 ID 或名字。
2. 不需要每个角色都互动；**关系熟、常聊天的角色**多半会点赞或随手评；关系一般者见内容特别有意思/有意义/有争议时也可能互动；明显冷淡或敌对者可仅浏览不留言。
3. delaySeconds 为「刷到朋友圈后」的秒数，范围约 ${15}～${MOMENT_INTERACTION_DELAY_MAX_SECONDS}（10 分钟内），**须错落有致**（如 18 秒、52 秒、2 分 10 秒、6 分钟），勿整分钟或等差递增；同一角色须连贯：先 like（或 viewed），comment 仅比同角色 like 大 8～15 秒（模拟打字），禁止同角色 like 与 comment 相差超过 30 秒。
4. 评论须符合各角色性格（傲娇、高冷、温柔等），简短自然。
5. **评区可多级接话**：comment 可以是一级（直接评用户朋友圈），也可以是二级回复（replyToCharId 填被回复角色的 charId，对方须在同批 interactions 里已有 comment）。角色之间可互怼、接话、补充，像真实朋友圈评区。**一级评论默认对用户说**，文中「你/给你/您」指发朋友圈的用户；回复某角色时勿把其对用户的「给你」误解为在说你。
6. **互称规则**：若下方提供了角色人脉关系，回复/提及其他角色时必须使用其中的「当面称呼」；禁止与关系矛盾的称谓（母子不可互称学姐学长等）。${
    withCharacterContexts
      ? '\n7. 下方各角色区块含与该用户的**近期私聊与长期记忆**：评论须据此反应，像真人刷到熟人朋友圈，可接梗、关心、吐槽或暧昧，勿写与人设/关系无关的客套。\n8. 若某角色标注「私聊未回但发朋友圈」，可在 comment 中自然调侃（如有空发朋友圈没空回消息）；须贴合人设，勿机械模板；关系冷淡或严肃时可略过。\n9. 严禁在 JSON 里写 displayName，只写 charId。'
      : '\n7. 严禁在 JSON 里写 displayName，只写 charId。'
  }${mentionBlock}

${relationshipBlock ? `\n${relationshipBlock}\n` : ''}${engagementBlock}${MOMENT_TEXT_OUTPUT_HINT}`
    .concat(`\n\n允许的角色名单：${roster || '（无）'}`)
}

function resolveMomentInteractionApiConfig(
  apiConfig: ApiConfig | null,
  wechatCtx: AnonymousQaWechatContext | null,
): ApiConfig {
  const fromCtx = wechatCtx?.apiConfig
  if (isMomentsChatApiConfigured(fromCtx)) return fromCtx as ApiConfig
  assertMomentsChatApiConfigured(apiConfig)
  return apiConfig as ApiConfig
}

function hasAiLikeOrCommentDrafts(drafts: AiMomentInteractionDraft[]): boolean {
  return drafts.some((d) => d.type === 'like' || d.type === 'comment')
}

async function generateBatchOrchestratorMomentInteractions(params: {
  cfg: ApiConfig
  momentContent: string
  imageCount: number
  momentImages?: string[]
  allowedCharacters: AllowedMomentCharacter[]
  mentionedCharacters: AllowedMomentCharacter[]
  allowedCharIds: Set<string>
  engagementRules?: ResolvedUserMomentEngagementRules
}): Promise<AiMomentInteractionDraft[]> {
  const relationships = await loadMomentRelationships()
  const relationshipBlock = buildMomentCharacterRelationshipPromptBlock(
    params.allowedCharacters,
    relationships,
  )

  const mentionLines = params.mentionedCharacters.length
    ? `\n被用户「提醒谁看」@ 的角色：${params.mentionedCharacters.map((c) => c.displayName).join('、')}`
    : ''
  const userTask = [
    '【系统任务：朋友圈动态互动模拟】',
    `用户刚刚发布了一条朋友圈。内容：${params.momentContent.trim() || '（无文字）'}`,
    `配图数：${params.imageCount}`,
    `能看到这条动态的角色：${params.allowedCharacters.map((c) => c.displayName).join('、')}${mentionLines}`,
    '请模拟点赞/评论，返回 JSON。评论可以是一级，也可用 replyToCharId 回复其他角色的 comment 形成接话。被 @ 的角色须知晓被提及；关系熟的角色多半会互动，关系一般者见特别有意思/有意义的内容也会点赞或短评。',
  ].join('\n\n')

  const raw = await runMomentsVisionChat(params.cfg, {
    system: buildSystemPrompt(
      params.allowedCharacters,
      params.mentionedCharacters,
      false,
      relationshipBlock,
      params.engagementRules,
    ),
    userText: userTask,
    momentImages: params.momentImages,
    temperature: 0.78,
    max_tokens: 1200,
  })
  const payload = parseModelJsonPayload(raw)
  const rows = extractInteractionsArray(payload)
  if (!rows?.length) return []

  const out: AiMomentInteractionDraft[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const draft = normalizeDraft(row, params.allowedCharIds)
    if (!draft) continue
    const key = `${draft.charId}:${draft.type}:${draft.content ?? ''}:${draft.dwellSeconds ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(draft)
    if (out.length >= 12) break
  }
  return out
}

export function countAiEngagementDrafts(drafts: AiMomentInteractionDraft[]): number {
  return drafts.filter((d) => d.type === 'like' || d.type === 'comment').length
}

export async function generateMomentInteractions(params: {
  apiConfig: ApiConfig | null
  momentContent: string
  imageCount: number
  momentImages?: string[]
  allowedCharacters: AllowedMomentCharacter[]
  mentionedCharacters?: AllowedMomentCharacter[]
  /** 用户朋友圈：注入各角色私聊/长期记忆与「未回私聊却发朋友圈」情境 */
  wechatCtx?: AnonymousQaWechatContext | null
  momentPublishedAt?: number
  engagementRules?: ResolvedUserMomentEngagementRules
}): Promise<AiMomentInteractionDraft[]> {
  const {
    apiConfig,
    momentContent,
    imageCount,
    momentImages,
    allowedCharacters,
    mentionedCharacters = [],
    wechatCtx = null,
    momentPublishedAt,
    engagementRules,
  } = params
  if (!allowedCharacters.length) return []

  const cfg = resolveMomentInteractionApiConfig(apiConfig, wechatCtx)
  const allowedCharIds = new Set(allowedCharacters.map((c) => c.charId))
  const publishedAt = momentPublishedAt ?? Date.now()
  const canUsePersonaPath = !!wechatCtx

  if (canUsePersonaPath) {
    let baseDrafts: AiMomentInteractionDraft[] = []
    try {
      baseDrafts = await generatePersonaBoundUserMomentInteractions({
        wechatCtx,
        momentContent,
        imageCount,
        momentImages,
        allowedCharacters,
        mentionedCharacterIds: new Set(mentionedCharacters.map((c) => c.charId)),
        momentPublishedAt: publishedAt,
        engagementRules,
      })
    } catch (err) {
      console.error('[momentInteractionAi] persona-bound engagement failed', err)
    }

    if (!hasAiLikeOrCommentDrafts(baseDrafts)) {
      try {
        const batchDrafts = await generateBatchOrchestratorMomentInteractions({
          cfg,
          momentContent,
          imageCount,
          momentImages,
          allowedCharacters,
          mentionedCharacters,
          allowedCharIds,
          engagementRules,
        })
        if (hasAiLikeOrCommentDrafts(batchDrafts)) {
          console.warn('[momentInteractionAi] persona path empty; used batch orchestrator fallback')
          baseDrafts = batchDrafts
        }
      } catch (err) {
        console.error('[momentInteractionAi] batch orchestrator fallback failed', err)
      }
    }

    try {
      const threadDrafts = await supplementUserMomentCharacterThreads({
        wechatCtx,
        momentContent,
        momentImages,
        imageCount,
        allowedCharacters,
        baseDrafts,
        userDisplayName: wechatCtx.playerDisplayName.trim() || '用户',
        engagementRules,
      })
      const combined =
        threadDrafts.length > 0 ? [...baseDrafts, ...threadDrafts] : baseDrafts
      if (engagementRules) {
        const relationships = await loadMomentRelationships()
        return trimEngagementDraftsToPresetLimits(combined, {
          engagementRules,
          mentionedCharacterIds: new Set(mentionedCharacters.map((c) => c.charId)),
          playerIdentityId: wechatCtx.playerIdentityId,
          relationships,
        })
      }
      return combined
    } catch {
      // 接话失败时仍保留首评
    }
    return baseDrafts
  }

  return generateBatchOrchestratorMomentInteractions({
    cfg,
    momentContent,
    imageCount,
    momentImages,
    allowedCharacters,
    mentionedCharacters,
    allowedCharIds,
    engagementRules,
  })
}
