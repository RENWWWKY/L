import type { ApiConfig } from '../../phone/apps/api/types'
import { loadPrivateChatNetworkRelationshipsBlock } from '../../phone/apps/wechat/networkRelationshipsPrompt'
import { buildSystemContent } from '../../phone/apps/wechat/wechatChatAi'
import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import {
  parseMomentsModelJsonPayload,
  requestMomentsModelJsonText,
  throwIfMomentModelJsonInvalid,
} from './momentsChatJsonAi'
import {
  buildCharacterLocationPromptBlock,
  detectRelocationSignalsInContext,
  enforceCharacterLocationConsistency,
  resolveCharacterLocationAnchor,
} from './momentCharacterLocationAnchor'
import { MOMENT_LOCATION_PROMPT_HINT } from './momentLocationUtils'
import { buildHistoricalTextLengthHint } from './momentContentLimits'
import { buildCharacterMediaImageDescriptionRules } from './momentCharacterImageRules'
import { characterHasAppearanceReference } from '../../phone/apps/wechat/characterAppearanceImageGen'
import { MOMENT_IMAGE_COUNT_PROMPT } from './momentContentLimits'
import { MOMENT_TEXT_OUTPUT_HINT } from './momentTextSanitize'
import {
  buildCharacterMomentPrivacyPromptSection,
  CHARACTER_MOMENT_PRIVACY_JSON_HINT,
  CHARACTER_MOMENT_PRIVACY_RULES,
} from './momentCharacterPrivacyAi'
import type { CharacterMomentPostType } from './momentCharacterPublishTypes'
import {
  normalizeCharacterMomentAiDraft,
  PUBLISHER_SELF_COMMENT_JSON_HINT,
  PUBLISHER_SELF_COMMENT_PROMPT_RULES,
  type CharacterMomentAiDraft,
} from './momentCharacterPublishTypes'
import {
  CHARACTER_MOMENT_MUSIC_POST_JSON_HINT,
  CHARACTER_MOMENT_MUSIC_POST_PROMPT,
  CHARACTER_MOMENT_MUSIC_LOCALE_HINT,
} from './momentAttachedMusic'
import type { InstantGenContentTypeChoice } from './momentInstantGenContentTypes'
import { buildInstantGenContentTypePromptBlock } from './momentInstantGenContentTypes'
import type { InstantGenPostTypeChoice } from './momentInstantGenTypes'
import { instantGenChoiceToPostType } from './momentInstantGenTypes'
import type { MomentContactRef } from './newMomentTypes'
import {
  buildPriorHistoricalSummariesBlock,
  formatHistoricalMomentContext,
} from './momentHistoricalGenUtils'

const HISTORICAL_MOMENT_TASK_APPENDIX = `
---
【历史朋友圈补全任务】
你是一个极具「活人感」和「网感」的真实人类。你现在正拿着手机，准备在微信朋友圈**回溯发布**一条过去某个时刻的动态。你必须完全忘记自己是一个 AI 模型，绝对代入你当前的【角色人设】。

# Historical Rules（历史回溯准则）
1. **假定发帖时刻**由用户给定；语气、季节感、热点、生活状态须贴合该日期，**禁止**提及该时刻之后才会发生的事。
2. **与已生成列表区分**：本批次已生成的动态主题/措辞/情绪不得重复。
3. **拒绝「人机味」与日记体**：真人朋友圈多为短句、留白、一两句吐槽；不是流水账汇报，**禁止**条条写成长段抒情。
4. **字数须服从用户给定的本条目标**；宁可短，不要超标。
5. 配图 prompt 只写画面内容（英文 SD/MJ 风格），**禁止写风格词**；每张描述不同局部/角度。

{{IMAGE_DESCRIPTION_RULES}}

${MOMENT_IMAGE_COUNT_PROMPT}

# Post Types
- mixed：文字+图片（images 数组 1~9 张均可）
- text：纯文字
- image：纯图片（content 留空）
- music：分享歌曲（必填 attachedMusic；content 可选配文；禁止 images）

# Output Format (严格返回 JSON，严禁 Markdown 与额外解释)
{"postType":"text"|"image"|"mixed"|"music","content":"...","location":null,"images":["prompt1","prompt2"],${CHARACTER_MOMENT_MUSIC_POST_JSON_HINT},${PUBLISHER_SELF_COMMENT_JSON_HINT},${CHARACTER_MOMENT_PRIVACY_JSON_HINT}}

${CHARACTER_MOMENT_MUSIC_POST_PROMPT}

${PUBLISHER_SELF_COMMENT_PROMPT_RULES}

${MOMENT_LOCATION_PROMPT_HINT}

${MOMENT_TEXT_OUTPUT_HINT}
`.trim()

function truncateNotes(text: string, max = 900): string {
  const t = text.trim()
  if (!t) return '（暂无近期私聊摘要）'
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export async function generateHistoricalCharacterMomentPost(params: {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  characterDisplayName: string
  momentContacts?: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  timestampMs: number
  postType: InstantGenPostTypeChoice
  contentType: InstantGenContentTypeChoice
  customContentDirection?: string
  textLengthMin: number
  textLengthMax: number
  itemTextLengthTarget: number
  priorSummaries?: string[]
  /** 本条将设为个人相册置顶 */
  isPinnedIntent?: boolean
}): Promise<CharacterMomentAiDraft> {
  const cfg = params.wechatCtx.apiConfig
  assertMomentsChatApiConfigured(cfg)

  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.characterId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: '朋友圈 动态 情绪 日常 回忆',
  })
  if (!pack.character) {
    throw new Error('未找到该角色人设，请确认通讯录已绑定角色')
  }

  const locationAnchor = await resolveCharacterLocationAnchor({
    accountId: params.wechatCtx.wechatAccountId,
    characterId: params.characterId,
  })
  const relocationAllowed = detectRelocationSignalsInContext(
    pack.longTermMemoryNotes,
    pack.unsummarizedPrivateNotes,
    pack.offlineDatingPlotsContext,
    pack.meetEncounterMemoriesContext,
  )
  const locationPromptBlock = buildCharacterLocationPromptBlock({
    ...locationAnchor,
    relocationAllowed,
  })

  const networkRelationshipsBlock = await loadPrivateChatNetworkRelationshipsBlock({
    character: pack.character,
    sessionPlayerIdentityId: params.wechatCtx.playerIdentityId,
  })

  const system = buildSystemContent({
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
    unsummarizedMeetNotes: pack.unsMeet || undefined,
    networkRelationshipsBlock: networkRelationshipsBlock || undefined,
    chatMemberIds: [params.characterId],
  })

  const privacyPrompt = buildCharacterMomentPrivacyPromptSection({
    publisherCharacterId: params.characterId,
    momentContacts: params.momentContacts ?? [],
    playerDisplayName: params.wechatCtx.playerDisplayName,
    blockedCharacterIds: params.blockedCharacterIds,
  })

  const forcedPostType = instantGenChoiceToPostType(params.postType)
  const contentTypeBlock = buildInstantGenContentTypePromptBlock(
    params.contentType,
    params.customContentDirection,
  )
  const textLengthHint = buildHistoricalTextLengthHint(
    params.textLengthMin,
    params.textLengthMax,
    params.itemTextLengthTarget,
    params.isPinnedIntent,
  )
  const priorBlock = buildPriorHistoricalSummariesBlock(params.priorSummaries ?? [])
  const pinnedBlock = params.isPinnedIntent
    ? '【置顶动态】本条生成后将设为个人相册置顶。请写成更具代表性、愿意长期展示给人看的「名片式」动态：可偏重要通知、代表作品、人设宣言、难忘纪念、精选生活等，质量与完成度应高于普通碎碎念。'
    : ''

  const userTask = [
    '# Context',
    `- 假定发帖时刻：${formatHistoricalMomentContext(params.timestampMs)}（须严格按该时刻的生活状态与情绪撰写）`,
    `- 与用户的关系/近期私聊摘要（**仅作人设与语气参考**；勿把私聊另起话题写进正文或 publisherSelfComments，除非本条朋友圈就是在说同一件事；勿写穿越未来信息）：${truncateNotes(pack.unsummarizedPrivateNotes)}`,
    `- 用户称呼：${params.wechatCtx.playerDisplayName.trim() || '朋友'}`,
    '',
    locationPromptBlock,
    '',
    privacyPrompt,
    '',
    `【载体形式 · 必须遵循】本条 postType 必须为 "${forcedPostType}"（text=纯文字，mixed=图文，image=纯图片，music=分享歌曲）。`,
    forcedPostType === 'music'
      ? `【分享歌曲】必填 attachedMusic（网易云真实歌名+歌手）；content 可选配文；禁止 images/imagePrompts。\n${CHARACTER_MOMENT_MUSIC_LOCALE_HINT}`
      : '',
    contentTypeBlock,
    textLengthHint,
    ...(pinnedBlock ? [pinnedBlock] : []),
    '【本批次已生成动态（勿重复主题/措辞）】',
    priorBlock,
    '',
    '请根据上述假定时刻，以你的角色身份发一条历史朋友圈。是否附带 location 由你自行决定，非必要填 null；若附带须自拟符合世界观的真实地名，且遵守上方市级锚点规则。只输出一个 JSON 对象。',
  ].join('\n')

  const raw = await requestMomentsModelJsonText(
    cfg as ApiConfig,
    [
      {
        role: 'system',
        content: `${system}\n\n${HISTORICAL_MOMENT_TASK_APPENDIX.replace(
          '{{IMAGE_DESCRIPTION_RULES}}',
          buildCharacterMediaImageDescriptionRules(characterHasAppearanceReference(pack.character)),
        )}\n\n${CHARACTER_MOMENT_PRIVACY_RULES}`,
      },
      { role: 'user', content: userTask },
    ],
    { temperature: 0.9 },
  )
  const payload = parseMomentsModelJsonPayload(raw)
  const draft = normalizeCharacterMomentAiDraft(payload, params.characterId)
  throwIfMomentModelJsonInvalid(raw, draft)

  const normalizedPostType: CharacterMomentPostType = forcedPostType
  let postType = draft.postType
  if (normalizedPostType === 'text') {
    postType = 'text'
  } else if (normalizedPostType === 'image') {
    postType = draft.images.length ? 'image' : 'text'
  } else {
    postType = draft.images.length || draft.content.trim() ? 'mixed' : 'text'
  }

  return {
    ...draft,
    postType,
    location: enforceCharacterLocationConsistency({
      location: draft.location,
      anchorCity: locationAnchor.anchorCity,
      contextTexts: [
        pack.longTermMemoryNotes,
        pack.unsummarizedPrivateNotes,
        pack.offlineDatingPlotsContext,
        pack.meetEncounterMemoriesContext,
      ],
      postContent: draft.content,
    }),
  }
}
