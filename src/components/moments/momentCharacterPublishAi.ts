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
import {
  buildCharacterMomentMusicPostPrompt,
  CHARACTER_MOMENT_MUSIC_POST_JSON_HINT,
} from './momentAttachedMusic'
import { MOMENT_BODY_LENGTH_HINT, MOMENT_IMAGE_COUNT_PROMPT } from './momentContentLimits'
import { MOMENT_LOCATION_PROMPT_HINT } from './momentLocationUtils'
import { buildCharacterMediaImageDescriptionRules } from './momentCharacterImageRules'
import { characterHasAppearanceReference } from '../../phone/apps/wechat/characterAppearanceImageGen'
import { MOMENT_TEXT_OUTPUT_HINT } from './momentTextSanitize'
import {
  buildCharacterMomentPrivacyPromptSection,
  CHARACTER_MOMENT_PRIVACY_JSON_HINT,
  CHARACTER_MOMENT_PRIVACY_RULES,
} from './momentCharacterPrivacyAi'
import type { MomentContactRef } from './newMomentTypes'
import {
  normalizeCharacterMomentAiDraft,
  PUBLISHER_SELF_COMMENT_JSON_HINT,
  PUBLISHER_SELF_COMMENT_PROMPT_RULES,
  type CharacterMomentAiDraft,
} from './momentCharacterPublishTypes'

const CHARACTER_MOMENT_TASK_APPENDIX_BASE = `
---
【朋友圈发文任务】
你是一个极具「活人感」和「网感」的真实人类。你现在正拿着手机，准备在微信朋友圈发布一条动态。你必须完全忘记自己是一个 AI 模型，绝对代入你当前的【角色人设】。

# Content Rules (绝对的活人感准则)
1. **拒绝「人机味」与日记体**：不要写「今天我做了什么，我感到很高兴」。真人发朋友圈是情绪的瞬间宣泄。
2. **符合人设语气**：傲娇/高冷型日常可短；公告、小作文、爆瓜类可写长（须分段换行）。
3. **隐晦的情感拉扯**：若与用户暧昧或冷战，可夹带私货、指桑骂槐，写只有你们俩能看懂的暗语。
4. 配图 prompt 只写画面内容（英文 SD/MJ 风格），**禁止写风格词**；每张描述不同局部/角度。

{{IMAGE_DESCRIPTION_RULES}}

${MOMENT_IMAGE_COUNT_PROMPT}

# Post Types
- mixed：文字+图片（images 数组 1~9 张均可）
- text：纯文字
- image：纯图片（content 留空）
- music：分享歌曲（必填 attachedMusic；content 可选配文）

# Output Format (严格返回 JSON，严禁 Markdown 与额外解释)
{"postType":"text"|"image"|"mixed"|"music","content":"...","location":null,"images":["prompt1","prompt2"],"isPinned":false,${CHARACTER_MOMENT_MUSIC_POST_JSON_HINT},${PUBLISHER_SELF_COMMENT_JSON_HINT},${CHARACTER_MOMENT_PRIVACY_JSON_HINT}}

{{MUSIC_POST_PROMPT}}

${PUBLISHER_SELF_COMMENT_PROMPT_RULES}

# Pin Decision (isPinned · 角色自行决定)
可选字段 isPinned（布尔）：是否把本条设为朋友圈置顶。
- 默认 false；日常碎碎念、随手拍、情绪发泄、无关紧要的内容**不要**置顶。
- 仅当本条对你而言**特别重要、有纪念意义、代表人设内核、里程碑、郑重声明、精选代表作**等，且贴合你这个人会「愿意挂在主页给别人看」的心态时，才设为 true。
- 是否置顶完全取决于你的人设与性格：有的人几乎从不置顶，有的人爱把得意之作置顶；傲娇型可能嘴上随便但私下置顶了重磅内容。
- 用户没有要求置顶时，你也应**自行判断**；**禁止**每条都置顶。

# Mention User（mentionUser · 默认 false）
- mentionUser 默认 false；**禁止**日常发文、主动发文、only_user 钓鱼动态设为 true。
- 仅当用户私聊明确要求 @你 / 提醒你看，或本条是极少数必须立刻引起用户注意的重磅动态时才 true。
- only_user 与 mentionUser 不要同时使用。

${MOMENT_LOCATION_PROMPT_HINT}

${MOMENT_TEXT_OUTPUT_HINT}

${MOMENT_BODY_LENGTH_HINT}
`.trim()

function buildCharacterMomentTaskAppendix(
  musicLocaleHint?: string,
  hasAppearanceReference = false,
): string {
  const musicPostPrompt = buildCharacterMomentMusicPostPrompt(musicLocaleHint)
  return CHARACTER_MOMENT_TASK_APPENDIX_BASE.replace('{{MUSIC_POST_PROMPT}}', musicPostPrompt).replace(
    '{{IMAGE_DESCRIPTION_RULES}}',
    buildCharacterMediaImageDescriptionRules(hasAppearanceReference),
  )
}

function formatCurrentMomentContext(): string {
  const now = new Date()
  const hour = now.getHours()
  const period =
    hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${period}${hour}点`
}

function truncateNotes(text: string, max = 900): string {
  const t = text.trim()
  if (!t) return '（暂无近期私聊摘要）'
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export async function generateCharacterMomentPost(params: {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  characterDisplayName: string
  momentContacts?: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  /** 私聊指令附带的方向提示（主题/情绪等） */
  chatRequestHint?: string
  /** 是否由用户在本轮私聊中明确要求发朋友圈 */
  triggeredByUserRequest?: boolean
  /** 主动发布：分享歌曲语种占比 prompt（不传则用默认华语优先） */
  musicShareLanguageRatioPrompt?: string
  /** 主动发布：向用户听歌偏好靠拢 prompt */
  musicShareUserTastePrompt?: string
}): Promise<CharacterMomentAiDraft> {
  const cfg = params.wechatCtx.apiConfig
  assertMomentsChatApiConfigured(cfg)

  const pack = await buildAnonymousQaPersonaPromptPack({
    characterId: params.characterId,
    wechatCtx: params.wechatCtx,
    relevanceHaystack: '朋友圈 动态 情绪 日常',
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

  const chatHint = params.chatRequestHint?.trim()
  const requestBlock = params.triggeredByUserRequest
    ? [
        '【私聊触发 · 用户请你发朋友圈】',
        chatHint
          ? `- 用户本轮的要求/方向：${chatHint}`
          : '- 用户刚在私聊中请你发一条朋友圈；结合本轮对话语境与你的人设意愿撰写。',
        '- 先已在私聊里口语回应；本条是实际要发布的动态正文。',
        '- 是否置顶由你根据内容重要性与人设自行决定（见 isPinned 规则），用户未要求置顶。',
        '- 若用户明确要求「提醒你看 / @你 / 让你看这条」，将 mentionUser 设为 true；否则 mentionUser 必须为 false。',
        '- only_user（仅用户可见）与 mentionUser（@提醒）是两套机制：仅你可见的动态不要设 mentionUser。',
      ].join('\n')
    : chatHint
      ? `【发文方向提示】${chatHint}`
      : ''

  const userTask = [
    '# Context',
    `- 当前时间与天气：${formatCurrentMomentContext()}（可自拟天气，贴合情绪即可）`,
    `- 与用户的关系/近期私聊摘要（**仅作人设与语气参考**；勿把私聊另起话题写进正文或 publisherSelfComments，除非本条朋友圈就是在说同一件事）：${truncateNotes(pack.unsummarizedPrivateNotes)}`,
    `- 用户称呼：${params.wechatCtx.playerDisplayName.trim() || '朋友'}`,
    '',
    locationPromptBlock,
    '',
    privacyPrompt,
    '',
    ...(requestBlock ? [requestBlock, ''] : []),
    '请根据当下心情，以你的角色身份发一条朋友圈。是否附带 location 由你自行决定，非必要填 null；若附带须自拟符合世界观的真实地名，且遵守上方市级锚点规则。只输出一个 JSON 对象。',
  ].join('\n')

  const proactiveMusicShareLocaleHint = [
    params.musicShareLanguageRatioPrompt,
    params.musicShareUserTastePrompt,
  ]
    .filter(Boolean)
    .join('\n\n')

  const raw = await requestMomentsModelJsonText(
    cfg as ApiConfig,
    [
      {
        role: 'system',
        content: `${system}\n\n${buildCharacterMomentTaskAppendix(
          proactiveMusicShareLocaleHint || undefined,
          characterHasAppearanceReference(pack.character),
        )}\n\n${CHARACTER_MOMENT_PRIVACY_RULES}`,
      },
      { role: 'user', content: userTask },
    ],
    { temperature: 0.92 },
  )
  const payload = parseMomentsModelJsonPayload(raw)
  const draft = normalizeCharacterMomentAiDraft(payload, params.characterId)
  throwIfMomentModelJsonInvalid(raw, draft)
  return {
    ...draft,
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
