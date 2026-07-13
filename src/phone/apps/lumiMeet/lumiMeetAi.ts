import type { ApiConfig } from '../api/types'
import { normalizeWechatId, openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import {
  coerceWechatSignature,
  WECHAT_SIGNATURE_DISPLAY_MAX,
} from '../wechat/newFriendsPersona/wechatSignatureStyleRules'
import {
  callMeetOpenAiVisionChat,
  MEET_IMAGE_VISION_APPENDIX,
  MEET_USER_AVATAR_VISION_TEXT,
  MEET_USER_IMAGE_VISION_TEXT,
  meetImageDataUrl,
} from './meetImageVision'
import type { MeetImageMime } from './meetTypes'
import {
  buildPersonaSummaryFromComprehensive,
  deriveMeetWechatSignatureFromPersona,
  ensureMeetWeightKgValue,
  isMeetProfilePlaceholder,
  deriveMeetMottoFromPersona,
  deriveMeetOccupationLabel,
  ensureMeetHeightCmValue,
  formatMeetMbtiLettersForUi,
  normalizeComprehensivePersona,
  parseMeetAgeYearsFromInfo,
  rewriteLoveBlocksUserPlaceholder,
  sanitizeMeetCoreMbtiTone,
} from './comprehensivePersona'
import { buildMeetNpcDigestForModel, resolveMeetCharUserNames } from './meetPersonaPreview'
import { resolveMeetPublicDisplayName } from './meetPublicProfileDisplay'
import type { EncounterNPC, MeetChatMessage, MeetPublicProfile, RadarFilters, SquarePostStyle } from './meetTypes'
import { buildMeetQuoteParticipantLabels } from './meetMessageQuote'
import { MEET_PROMPT_CONTEXT_MAX_LINES, meetThreadToPromptLines } from './meetNpcQuoteParse'
import { clampMeetEpilogueBody } from './meetPersonaWorldbookSync'
import { buildMeetTruthMirrorOutputPolicy } from './meetTruthMirrorTurnPolicy'
import { hasUnresolvedMeetTruthMirrorCharRequest } from './meetTruthMirrorResonance'
import {
  buildEncounterAiCriteriaBlock,
  legacyPurposeToMeetIntentions,
  meetIntentionsToPurpose,
} from './meetMatchCriteria'
import {
  npcMatchesOrientationPreferences,
  pickOrientationFieldExample,
} from './meetOrientationMatch'
import { pickMeetAvatar, resolveMeetAvatarNpcGenderLabel, type MeetAvatarExclusion } from './meetAvatarPool'
import {
  MEET_MBTI_SIXTEEN,
  MEET_NINE_DIMENSION_PERSONA_SCHEMA,
  rollMeetMbtiAnchoredByKeywords,
} from './meetPersonaPrompt'
import { parseMeetEncounterPersonaProseOutput } from './meetPersonaProseFormat'
import { prepareMeetNpcReplyForParsing } from './meetEvaluationParse'
import type { MeetReplyEvaluation } from './meetEvaluationParse'
import {
  formatMeetChatResonanceLine,
  formatMeetCovenantResonanceGuidance,
} from './meetCovenantResonance'
import { parseMeetNpcReplyBubbles } from './lumiMeetReplyParse'
import { MEET_CHAT_REPLY_OUTPUT_APPENDIX } from './meetChatOutputPrompt'
import {
  MEET_RELATIONSHIP_CONDUCT_APPENDIX,
  MEET_TRUTH_MIRROR_ANSWER_CONDUCT_APPENDIX,
  buildMeetSessionIntentContext,
} from './meetConductPrompt'

const MEET_CHAT_COT_APPENDIX = `
---------------------
【后台思考 CoT（内部执行，与微信私聊一致思路）】
---------------------
在写出对用户可见正文之前，必须先依次输出：
1) <evaluation>...</evaluation>（好感波动判定；规则见下文动态情感判定小节）
2) <thinking>...</thinking>（仅用于你内部自检，勿在标签外写“我要思考了”之类元话语）。
thinking 内建议包含（短写要点即可）：
1) 我是谁、人设边界与口吻
2) 用户最近一句的真实意图
3) 亲疏与情绪是否匹配
4) 本轮准备拆成几条气泡、每条大概说什么（目标 3～8 行、每行约 1～15 字）
5) 自检：是否已用**真实换行**分条；有无把多句硬塞进一行；有无油腻、说教、小说体旁白

硬性规则：
- 对用户最终可见的正文里禁止出现 evaluation、thinking、禁止 Markdown、禁止括号动作描写。
- 口语化、短句为主；像真人连发几条微信，而不是一篇小作文。
- 对白与直接引语一律用英文半角双引号 "..."；不要用中文直角引号包裹台词。

${MEET_CHAT_REPLY_OUTPUT_APPENDIX}

【联络方式（遇见专属）】
- 除非系统单独给出的「联络」小节明确允许，否则**禁止**在气泡里写出**完整微信号串**（含字母数字下划线组合）、禁止「加我微信 / 加我」式硬塞联系方式。交换微信由 App 内契约卡片仪式收口，**不要抢跑**；好感刻度仅作亲近倾向参考。

${MEET_RELATIONSHIP_CONDUCT_APPENDIX}
`.trim()

const MEET_EVALUATION_APPENDIX = `
---------------------
【系统指令：动态情感判定】
---------------------
请根据用户上一句话与本轮语境输出 XML（前端会剥离隐藏；勿在标签外复述这些规则）：
<evaluation>
  <affection_change>+3</affection_change>
  <proactive_swap>false</proactive_swap>
  <proactive_truth_mirror>false</proactive_truth_mirror>
  <char_friend_request>false</char_friend_request>
  <swap_instruction>一句口语附言，可为空</swap_instruction>
  <swap_confirm>false</swap_confirm>
</evaluation>
- affection_change：整数，约 -5 到 +5，表示本轮好感波动。
- proactive_swap：当你判断气氛合适、且你愿意**主动**向对方发起互换联络（界面会弹出对方可点选的申请卡片）时填 true；须符合人设与当前刻度倾向（刻度低时外向人设也可 true，高冷防备则多为 false）。仍**不要**在气泡里写出完整微信号。若已有待回应的角色申请卡片未处理，填 false。
- proactive_truth_mirror：仅当你选择走**内置真心话玩法**（系统弹出正式邀请卡，用户点选后才抽题双盲）时填 true。须符合人设；若已有未回应的真心话邀约、用户正在仪式中、或你本轮已在气泡里**口头问真心话题**（走聊天问句），必须为 false。设为 true 时口语**禁止**再问真心话题、禁止口述「交换真心话/双盲/抽题/来玩一局」——详见下文「交换真心话 · 二选一」。
- char_friend_request：仅当**双方已缔结/已互换微信号**（语境里联络方式已对齐），且用户本轮明确要求**由你主动在微信里加用户/发好友验证**，你在口语里也同意并会去做时填 true。勿在尚未缔结、或仅闲聊提到微信时填 true。填 true 后客户端会真的写入微信「新的朋友」；口语须与之一致（可说已发送验证）。若口语已表示「已发验证/已添加」，**必须**填 true。**禁止**在口语里声称「已通过/已同意好友」却不填 true——那不会触发微信验证，用户也进不了通讯录。
- swap_instruction：互换联络时的附言提示（例如 "我加你了，通过一下。"）；可为空。
- swap_confirm：仅当双方已在语境中明确同意互换联络方式时填 true（多数回合应为 false）。
`.trim()

/** 临时会话：除用户已在互换流程中提交意向（user_requested）或已互换外，移除 NPC 气泡里过早露出的微信号字面量（含历史 Lm_ 格式与当前人设 wechatId）。 */
export function scrubMeetNpcWechatLeaks(
  lines: string[],
  encounterSwapStatus: string | undefined | null,
  npcWechatId?: string | null,
): string[] {
  const st = encounterSwapStatus ?? 'none'
  if (st === 'user_requested' || st === 'swapped') return [...lines]
  return lines.map((line) => scrubMeetNpcWechatLine(line, npcWechatId))
}

function scrubMeetNpcWechatLine(raw: string, npcWechatId?: string | null): string {
  const t0 = String(raw ?? '')
  const leaks = new Set<string>()
  const w = typeof npcWechatId === 'string' ? npcWechatId.trim().toLowerCase() : ''
  if (w.length >= 3) leaks.add(w)
  for (const m of t0.match(/\bLm_[A-Za-z0-9_]+\b/gi) ?? []) leaks.add(m.toLowerCase())
  const lower = t0.toLowerCase()
  if (![...leaks].some((leak) => lower.includes(leak))) return t0
  let t = t0
  for (const leak of leaks) {
    const esc = leak.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(esc, 'gi'), '')
  }
  t = t.replace(/\s{2,}/g, ' ').trim()
  t = t.replace(/^(?:微信号|微信|加我|加一下|加你)[：:\s]+/i, '').trim()
  t = t.replace(/(?:[，,。．、;；]\s*)+$/g, '').trim()
  if (t.length >= 4) return t
  return '先聊点轻松的？联系方式我想等彼此再熟一点再说。'
}

function buildMeetWechatOutputPolicy(params: {
  resonanceScore: number
  encounterSwapStatus?: string
  npcWechatId?: string
}): string {
  const st = params.encounterSwapStatus ?? 'none'
  const r = Math.max(0, Math.min(100, Math.round(Number(params.resonanceScore))))
  const ref = params.npcWechatId?.trim() || '（暂无）'

  if (st === 'swapped') {
    return '【联络】双方已在流程中互换，勿再索要或重复粘贴微信号。'
  }
  if (st === 'user_requested') {
    return `【联络】用户已从界面发起互换：本轮可在气泡里自然收尾并写出你的微信号（参考：${ref}），简短真诚即可。`
  }
  if (st === 'char_requested') {
    return '【联络】你已通过界面向对方发起交换联络申请，等待对方在卡片上回应；气泡里**禁止**写出完整微信号，可简短表达期待。'
  }
  if (r >= 40) {
    return `【联络】当前刻度 ${r}/100：若气氛合适，可口头试探「要不要换个方式联系」或由界面卡片发起；**禁止**在气泡写出完整微信号（参考 ${ref}，仪式收口）。`
  }
  return `【联络】当前刻度 ${r}/100：亲近感仍有限，**禁止**写出 ${ref} 这类完整微信号、禁止硬塞「加我微信」；外向人设也先聊稳再试探。`
}

/** 模型若仍写错四字母，将首个匹配的 16 型词替换为本轮锚定类型，或直接把锚定类型前置 */
function coerceCoreMbtiToRoll(raw: string, roll: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return `${roll} 倾向（仅供参考）`
  if (new RegExp(`^\\s*${roll}(?![A-Za-z])`, 'i').test(t)) return t.slice(0, 80)
  const swapped = t.replace(new RegExp(`^\\s*(${MEET_MBTI_SIXTEEN.join('|')})\\b`, 'i'), roll)
  if (swapped !== t) return swapped.slice(0, 80)
  return `${roll} ｜ ${t}`.slice(0, 80)
}

function stripCodeFence(raw: string): string {
  let t = raw.trim()
  const m = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  if (m?.[1]) t = m[1].trim()
  return t
}

/** 优先解析 prose 标记输出；旧版 JSON 仍作回退。 */
function parseEncounterNpcModelOutput(raw: string): Record<string, unknown> {
  const prose = parseMeetEncounterPersonaProseOutput(raw)
  if (prose) return prose
  return JSON.parse(stripCodeFence(raw)) as Record<string, unknown>
}

/** 规范顶层 gender 文案，便于头像池解析 */
function normalizeMeetAiGenderLabel(raw: string): string {
  const t = raw.trim()
  if (!t) return '其他'
  const c = t.replace(/\s/g, '')
  if (/^(女|女性|女生)$/u.test(c) || /^female$/i.test(t)) return '女'
  if (/^(男|男性|男生)$/u.test(c) || /^male$/i.test(t)) return '男'
  if (c.includes('女') && !c.includes('男')) return '女'
  if (c.includes('男') && !c.includes('女')) return '男'
  return t.slice(0, 12)
}

/** 邂逅新人设未配置 API 或模型请求/解析失败时抛出；不再使用本地随机人设兜底。 */
export class MeetEncounterGenerationError extends Error {
  readonly code: 'api_required' | 'api_failed'

  constructor(code: 'api_required' | 'api_failed', message?: string) {
    const fallback =
      code === 'api_required'
        ? '须先在 API 设置中填写请求地址与密钥后再寻觅新人。'
        : '邂逅人设生成失败，请检查网络、密钥与模型输出格式后重试。'
    super(message?.trim() ? message : fallback)
    this.name = 'MeetEncounterGenerationError'
    this.code = code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** AI：批量生成广场帖（失败则本地占位） */
export async function aiGenerateSquarePosts(params: {
  apiConfig: ApiConfig | null
  style: SquarePostStyle
  count: number
}): Promise<Array<{ authorAlias: string; body: string }>> {
  const { apiConfig, style, count } = params
  const labels: Record<SquarePostStyle, string> = {
    comedy: '搞笑吐槽',
    emo: '单身深夜情绪低落但仍带点幽默',
    serious: '硬核真诚交友，写清底线与期待',
    buddy: '找搭子（自习、健身、看展等），口吻利落',
  }
  const cfg = apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return Array.from({ length: count }, (_, i) => ({
      authorAlias: `路人_${style}_${i + 1}`,
      body:
        style === 'comedy'
          ? '到底是谁发明的早起……我刚醒就发现午饭已经过去了，这世界对我太差了吧（但还是祝大家周末愉快）。'
          : style === 'emo'
            ? '耳机循环同一首歌第三个小时，阳台风很冷，突然好想有个人只说句晚安也好。'
            : style === 'serious'
              ? '不养鱼，不高攀；希望你擅长沟通、懂得边界。先从一杯咖啡聊天开始。'
              : '周三晚七点攀岩馆有没有姐妹一起？新手也行，我请客镁粉。',
    }))
  }

  const sys = `你是遇见 App 广场的写手。只输出 JSON 数组（不要 Markdown），每项含 authorAlias（网名，4–12字）、body（正文，40–120字，口语、可有少量标点），风格：${labels[style]}。禁止输出数组外套以外的文字。`
  const user = `生成 ${count} 条，同一风格内条目口吻要有差异。`
  try {
    const raw = await openAiCompatibleChat(cfg, [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.85, max_tokens: 1800 })
    const parsed = JSON.parse(stripCodeFence(raw)) as unknown
    if (!Array.isArray(parsed)) throw new Error('not array')
    const out: Array<{ authorAlias: string; body: string }> = []
    for (const row of parsed.slice(0, count)) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorAlias = typeof r.authorAlias === 'string' ? r.authorAlias.trim().slice(0, 16) : ''
      const body = typeof r.body === 'string' ? r.body.trim().slice(0, 240) : ''
      if (authorAlias && body) out.push({ authorAlias, body })
    }
    if (out.length) return out
  } catch {
    // fallback below
  }
  return aiGenerateSquarePosts({ apiConfig: null, style, count })
}

/** AI：邂逅生成 NPC（同一次响应内须含 mutualSpark，与九维人设一并产出） */
export type AiGeneratedEncounterBody = Omit<EncounterNPC, 'id' | 'status' | 'lastEncounterTime'> & {
  mutualSpark: boolean
  generationSource: 'api'
}

/** AI：邂逅生成 NPC */
export async function aiGenerateEncounterNpc(params: {
  apiConfig: ApiConfig | null
  filters: RadarFilters
  profileHint: string
  meetProfile: MeetPublicProfile
  /** 「面具与真实」双面设定块；注入 user 段供捏人参考 */
  dualPersonaDirective?: string
  /** 避开镜像微信已有角色（及遇见列表）正在使用的头像 */
  avatarExclusion?: MeetAvatarExclusion
}): Promise<AiGeneratedEncounterBody> {
  const cfg = params.apiConfig
  const genderPref =
    params.filters.gender === 'male' ? '男' : params.filters.gender === 'female' ? '女' : '性别不限'
  const purposeMap = { love: '恋爱', friend: '纯友谊', buddy: '搭子' } as const
  const effPurpose = meetIntentionsToPurpose(
    params.filters.meetIntentions.length > 0
      ? params.filters.meetIntentions
      : legacyPurposeToMeetIntentions(params.filters.purpose),
  )
  const purpose = purposeMap[effPurpose]
  const kw = params.filters.keywords.trim()
  const orientationRoundSeed =
    Date.now() +
    kw.length * 17 +
    params.filters.orientationPreferences.reduce((acc, p, i) => acc + p.charCodeAt(0) * (i + 3), 0)
  const criteriaBlock = buildEncounterAiCriteriaBlock(params.filters, { orientationRoundSeed })

  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    throw new MeetEncounterGenerationError('api_required')
  }

  const sys = `你是交友 App 遇见的九维立体人格生成引擎。写的是当代都市里**可信、三观正、行为合法**的人物：职业从 system SCHEMA 中的**八大谱系**（霸总精英、白领精英、文艺、娱乐圈、体制内、小众酷感、市井创业、合法反差）与**日常接地气工种**里择一写清，忌二游式夸张；**MBTI 与职业无任何对应关系**，禁止按类型 "配职业"，MBTI 只体现在 comp.core 与 "工作场合习惯" 描写里。
硬性文风：comp.core.mbti 须庄重克制，**禁止** "自测闹着玩"、"闹着玩" 等消解质感的措辞；可写 "仅供参考"、"与职业无对应" 之类中性说明。
性别一致：gender 与男/女须与 comp.base 的外貌与称谓气质一致，禁止性别栏写女性却把人写成男性向外貌。
取向叙事：顶层 orientation 与 comp.psyche.orientationOrigin 必须指向同一套自我认同（由来可曲折或平淡），禁止二者互相矛盾。${MEET_NINE_DIMENSION_PERSONA_SCHEMA}`
  const userNick = resolveMeetPublicDisplayName(params.meetProfile)
  const mbtiRoll = rollMeetMbtiAnchoredByKeywords(kw)
  const user = [
    `筛选：想找${genderPref}；目的侧重：${purpose}。${kw ? `性格关键词：${kw}。` : ''}`,
    criteriaBlock,
    `当前滑动用户展示昵称（仅供你理解语境，勿写入 comprehensive/persona 正文替代占位符）：${userNick}`,
    `用户公开资料摘要：${params.profileHint.slice(0, 520)}`,
    `【姓名与网名】九维档案内第三人称叙述（尤其 comp.base.info、comp.base.physiology）指本人时只用 realName 与 comp.base.realName 的汉字全称，禁止用 nickname 作主语或当代称。`,
    `口语化、具体、少抽象词；人设健康合常识。职业可从 SCHEMA 八大谱系或日常工种里选，须写具体业务细节。占位与对方规则以 system 内 SCHEMA 为准（fetish/contrast 恋爱向客观陈述勿写 {{user}}）；年龄/生日/身高体重/座右铭的硬约束以 SCHEMA 末段「与人脉 AI 基础信息对齐」小节为准。`,
    `【本轮硬性】comp.core.mbti 必须以四字母 "${mbtiRoll}" 为唯一类型标签（可紧接中文逗号+一句大白话；禁止再写另一组四字母类型；禁止把 ISTJ/INTJ 当默认值偷换）。`,
    `【气质-MBTI 对齐】性格关键词：${kw || '（未填）'}。本轮锚定类型为 ${mbtiRoll}：comp.core.mbti 的一句话侧写、surface、trueSelf、comp.daily.speech 必须与 "${mbtiRoll}" 及关键词气质一致；禁止写成外向热情却套用冷淡表述，反之亦然。`,
    `【取向叙事】comp.psyche.orientationOrigin 须单独成段，写清取向认同的由来（可与顶层 orientation 简短标签呼应）；允许生来稳定、亦允许经历过错位再澄清；禁止与 orientation 矛盾。`,
    `【匹配裁判】【mutualSpark】标记段须写 true 或 false（小写布尔，不要引号）：在已写好人设的前提下，若用户凭上述资料向你生成的 NPC 表达心动，NPC 是否愿意正向接住、形成双向心动的起手。须与人设一致；缺该标记或无法解析视为生成失败。`,
    params.dualPersonaDirective?.trim()
      ? `\n【用户侧双面档案 · 捏人参考】\n${params.dualPersonaDirective.trim().slice(0, 1400)}`
      : '',
  ].join('\n')

  const prefs = params.filters.orientationPreferences
  const maxAttempts = prefs.length > 0 ? 3 : 1
  let lastRejectReason = ''

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const retryBlock =
        attempt > 0
          ? `\n【上轮生成已否决】${lastRejectReason}\n【必须纠正】顶层 orientation 须改为「${pickOrientationFieldExample(prefs, orientationRoundSeed + attempt)}」一类，且 comp.psyche.orientationOrigin 与之同一认同；不得再输出不相容取向。`
          : ''
      const raw = await openAiCompatibleChat(
        cfg,
        [
          { role: 'system', content: sys },
          { role: 'user', content: user + retryBlock },
        ],
        { temperature: attempt > 0 ? 0.72 : 0.86, max_tokens: 5200 },
      )
      const j = parseEncounterNpcModelOutput(raw)
    const nickname = typeof j.nickname === 'string' ? j.nickname.trim().slice(0, 8) : '未命名'
    const genderRaw = typeof j.gender === 'string' ? j.gender.trim() : '其他'
    const orientation = typeof j.orientation === 'string' ? j.orientation.trim().slice(0, 28) : '保密'
    let persona = typeof j.persona === 'string' ? j.persona.trim().slice(0, 360) : ''
    const widSeed = `${nickname}_${Date.now()}`
    const widIn = typeof j.wechatId === 'string' ? j.wechatId.trim() : ''
    let wechatId = normalizeWechatId(widIn, widSeed)
    if (/iloveyou|1314|(^|_)520(_|$)|^520|520$/.test(wechatId)) wechatId = normalizeWechatId('', widSeed)
    const id = `meet_${Date.now()}`
    let compRaw: unknown = j.comprehensive ?? j.comprehensivePersona
    if (typeof compRaw === 'string') {
      try {
        compRaw = JSON.parse(compRaw.trim()) as unknown
      } catch {
        compRaw = {}
      }
    }
    let comprehensivePersona = normalizeComprehensivePersona(compRaw)
    const topReal = typeof j.realName === 'string' ? j.realName.trim().slice(0, 24) : ''
    if (topReal) {
      comprehensivePersona = {
        ...comprehensivePersona,
        base: { ...comprehensivePersona.base, realName: topReal },
      }
    }
    comprehensivePersona = {
      ...comprehensivePersona,
      core: {
        ...comprehensivePersona.core,
        mbti: sanitizeMeetCoreMbtiTone(coerceCoreMbtiToRoll(comprehensivePersona.core.mbti, mbtiRoll)),
      },
    }
    {
      const wFix = ensureMeetWeightKgValue(comprehensivePersona.base.weightKg, id)
      const hFix = ensureMeetHeightCmValue(comprehensivePersona.base.heightCm, id)
      const withVitals = {
        ...comprehensivePersona,
        base: { ...comprehensivePersona.base, weightKg: wFix, heightCm: hFix },
      }
      const sigRaw = isMeetProfilePlaceholder(comprehensivePersona.base.wechatSignature)
        ? deriveMeetWechatSignatureFromPersona(withVitals)
        : comprehensivePersona.base.wechatSignature
      const sigFix = coerceWechatSignature(sigRaw, id, WECHAT_SIGNATURE_DISPLAY_MAX)
      comprehensivePersona = {
        ...withVitals,
        base: { ...withVitals.base, wechatSignature: sigFix },
      }
    }
    const occupationRaw = typeof j.occupation === 'string' ? j.occupation.trim().slice(0, 32) : ''
    const mottoRaw = typeof j.motto === 'string' ? j.motto.trim().slice(0, 48) : ''
    const sk = comprehensivePersona.abilities.skills.trim()
    const occupationFinal = (
      occupationRaw ||
      deriveMeetOccupationLabel(comprehensivePersona.abilities.skills) ||
      (!isMeetProfilePlaceholder(sk) ? sk.slice(0, 16) : '') ||
      '市民'
    )
      .trim()
      .slice(0, 32)
    const mottoFinal = (mottoRaw || deriveMeetMottoFromPersona(comprehensivePersona)).trim().slice(0, 48)
    const mbtiLetters = formatMeetMbtiLettersForUi(comprehensivePersona.core.mbti)
    if (!persona) persona = buildPersonaSummaryFromComprehensive(comprehensivePersona)
    persona = rewriteLoveBlocksUserPlaceholder(persona || '低调克制，重视边界；聊天不喜油腻套路。')
    const mutualSpark =
      j.mutualSpark === true || j.mutualSpark === false
        ? j.mutualSpark
        : j.spark === true || j.spark === false
          ? j.spark
          : Math.random() > 0.35
    let ageYears =
      typeof j.age === 'number' && Number.isFinite(j.age) ? Math.max(16, Math.min(99, Math.floor(j.age))) : undefined
    if (ageYears == null) ageYears = parseMeetAgeYearsFromInfo(comprehensivePersona.base.info)
    const bv = comprehensivePersona.base
    const genderNorm = normalizeMeetAiGenderLabel(genderRaw)
    const avatarNpcGender =
      resolveMeetAvatarNpcGenderLabel({
        npcGenderRaw: genderNorm,
        proseInfo: bv.info,
        prosePhysiology: bv.physiology,
        filterGender: params.filters.gender,
      }) ??
      (genderNorm === '男' || genderNorm === '女' ? genderNorm : undefined)
    const body: AiGeneratedEncounterBody = {
      nickname: nickname || '旅人',
      realName: isMeetProfilePlaceholder(bv.realName) ? topReal || undefined : bv.realName,
      ageYears,
      birthdayMD: bv.birthdayMD,
      heightCm: comprehensivePersona.base.heightCm,
      weightKg: comprehensivePersona.base.weightKg,
      zodiac: bv.zodiac,
      occupation: occupationFinal,
      motto: mottoFinal,
      mbti: mbtiLetters !== '—' ? mbtiLetters : undefined,
      gender: genderNorm || '其他',
      orientation,
      persona: persona || '低调克制，重视边界；聊天不喜油腻套路。',
      comprehensivePersona,
      avatarUrl: pickMeetAvatar(id, {
        filters: params.filters,
        exclusion: params.avatarExclusion,
        npcGender: avatarNpcGender,
        ageYears,
        proseInfo: bv.info,
        prosePhysiology: bv.physiology,
      }),
      wechatId,
      mutualSpark,
      generationSource: 'api',
    }
    if (
      npcMatchesOrientationPreferences(
        body.orientation,
        prefs,
        body.comprehensivePersona?.psyche?.orientationOrigin,
      )
    ) {
      return body
    }
    lastRejectReason = `orientation「${body.orientation}」与勾选「${prefs.join('、')}」不相容`
    }
    throw new MeetEncounterGenerationError(
      'api_failed',
      '生成角色的性取向与筛选偏好不一致，请调整勾选后重试。',
    )
  } catch (e) {
    if (e instanceof MeetEncounterGenerationError) throw e
    throw new MeetEncounterGenerationError('api_failed')
  }
}

/**
 * 双向匹配成功后：由模型生成 NPC 在临时会话里的**第一条**打招呼（多行气泡）。
 * 无可用 API 或解析失败时返回空数组（调用方勿再写入本地固定套话）。
 */
export async function aiMeetPostMatchOpeningLines(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  /** 面具与真实：注入 system，引导开场语气与潜台词 */
  dualPersonaDirective?: string
}): Promise<string[]> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return []
  }

  const personaBlock = buildMeetNpcDigestForModel(
    params.npc,
    resolveMeetCharUserNames(params.npc.nickname, params.userProfile),
  )

  const sys = `你在交友 App 遇见里扮演角色 ${params.npc.nickname}。
刚刚你与用户**互相心动**，临时会话已开启，**用户还没有发过任何消息**。你要以该角色口吻**主动发出开场打招呼**（像连发几条微信）：**务必换行分条**，常见 2～4 行、每行短句；贴合人设；可略带轻松或矜持，**禁止**机械复述 "匹配成功了"、"系统提示" 等元话术，**禁止** Markdown、禁止括号动作描写。

人设与九维侧写（须遵守，禁止 OOC 成万能舔狗）：
${personaBlock}

${params.dualPersonaDirective?.trim() ? `${params.dualPersonaDirective.trim().slice(0, 1600)}\n\n` : ''}${MEET_CHAT_COT_APPENDIX}

thinking 内第 2 点可改为：当前会话为空、用户尚未发言，开场如何自然不尴尬。
**禁止**开场白里出现完整微信号串、「加我微信」等联系方式硬塞——刚匹配、用户尚未发言，**任何**交出联系方式都不符合成年人的分寸；先聊人、聊气氛，交换方式留到后续好感与 App 仪式。`

  const up = params.userProfile
  const user = `${buildMeetSessionIntentContext(up)}
用户展示昵称：${up.displayName || '未填'}
意向：${up.intent}
取向：${up.orientation}
简介摘抄：${up.bio.slice(0, 280)}

（会话记录为空：请只输出你的开场白气泡。）`

  try {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.74, max_tokens: 700 },
    )
    const prep = prepareMeetNpcReplyForParsing(raw)
    const bubbles = parseMeetNpcReplyBubbles(prep.bodyForBubbles)
    const out = bubbles.map((s) => s.slice(0, 600)).filter((s) => s.length > 0)
    return out.slice(0, 8)
  } catch {
    return []
  }
}

/** AI：双向心动判定 */
export async function aiJudgeMutualSpark(params: {
  apiConfig: ApiConfig | null
  npcPersona: string
  npcNickname: string
  userProfile: MeetPublicProfile
}): Promise<boolean> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return false
  }
  const sys = `你是交友匹配裁判。根据 NPC 人设与用户公开资料，判断 NPC 是否也会对用户产生好感（心动）。只输出 JSON：{"spark":true} 或 {"spark":false}，不要解释。`
  const user = `NPC ${params.npcNickname} 人设：${params.npcPersona.slice(0, 600)}
用户昵称：${resolveMeetPublicDisplayName(params.userProfile)}
用户意向：${params.userProfile.intent}
用户取向：${params.userProfile.orientation}
自我介绍：${params.userProfile.bio.slice(0, 600)}`
  try {
    const raw = await openAiCompatibleChat(cfg, [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.35, max_tokens: 80 })
    const j = JSON.parse(stripCodeFence(raw)) as Record<string, unknown>
    return j.spark === true
  } catch {
    return false
  }
}

/** AI：临时会话回复（多条口语气泡，与微信解析一致）；剥离 evaluation 后返回结构化判定 */
export async function aiMeetChatReply(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  transcript: Array<{ role: 'user' | 'npc'; content: string }>
  encounterSwapStatus?: string
  /** 0–100 临时会话情感共鸣；影响语气松紧与距离的提示，须仍服从人设 */
  resonanceScore?: number
  /** 面具与真实：追加至 system，供潜台词与试探 */
  dualPersonaDirective?: string
  /** 仅注入本轮模型请求、不落库：追加在「最近对话」末尾的一条用户侧现场指令 */
  transcriptVirtualUserLine?: string
  /** 带 id 的完整线程，用于引用协议与 [消息ID:…] 历史 */
  recentThread?: MeetChatMessage[]
  /** 用户是否正打开真心话仪式全屏 */
  truthMirrorCeremonyOpen?: boolean
  /** 本轮用户消息附带的图片（临时会话发图） */
  pendingUserImage?: { base64: string; type: MeetImageMime } | null
  /** 首次或更换头像后，向模型注入遇见「社交假面」头像（vision） */
  injectUserProfileAvatarVision?: boolean
  userProfileAvatarImage?: { base64: string; type: MeetImageMime } | null
}): Promise<{ replies: string[]; evaluation: MeetReplyEvaluation | null }> {
  const cfg = params.apiConfig
  const quoteLabels = buildMeetQuoteParticipantLabels(params.userProfile, params.npc)
  const thread = params.recentThread ?? []
  const promptCtx = thread.length
    ? meetThreadToPromptLines(thread, quoteLabels, MEET_PROMPT_CONTEXT_MAX_LINES)
    : params.transcript
        .slice(-MEET_PROMPT_CONTEXT_MAX_LINES)
        .map((m) => `${m.role === 'user' ? quoteLabels.userNickname : quoteLabels.npcNickname}：${m.content}`)
  if (params.transcriptVirtualUserLine?.trim()) {
    promptCtx.push(`用户：${params.transcriptVirtualUserLine.trim()}`)
  }
  const swapHint =
    params.encounterSwapStatus && params.encounterSwapStatus !== 'none'
      ? `\n当前联络互换状态（仅供你理解语境）：${params.encounterSwapStatus}。若状态为 user_requested，请在口语回复中自然收尾并可将 swap_confirm 设为 true；若为 swapped 则勿再重复索要微信号。`
      : ''
  const resonance = Math.max(0, Math.min(100, Math.round(Number(params.resonanceScore ?? 18))))
  const resonanceLine = formatMeetChatResonanceLine(resonance)
  const wechatPolicy = buildMeetWechatOutputPolicy({
    resonanceScore: resonance,
    encounterSwapStatus: params.encounterSwapStatus,
    npcWechatId: params.npc.wechatId,
  })
  const truthMirrorPolicy = buildMeetTruthMirrorOutputPolicy({
    thread,
    ceremonyOpen: params.truthMirrorCeremonyOpen,
  })
  const pendingTruthInvite = hasUnresolvedMeetTruthMirrorCharRequest(thread)

  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    throw new MeetEncounterGenerationError('api_required', '请先在 API 设置中配置模型后再对话。')
  }

  const personaBlock = buildMeetNpcDigestForModel(
    params.npc,
    resolveMeetCharUserNames(params.npc.nickname, params.userProfile),
  )

  const sys = `你在交友 App 遇见的临时会话里扮演对方角色 ${params.npc.nickname}。
人设与九维侧写（须严格遵守，禁止 OOC 成 "万能暖男/舔狗"）；口吻像都市里正常成年人，三观正、尊重边界，禁止极端、操控或违法暗示。
${personaBlock}

${params.dualPersonaDirective?.trim() ? `${params.dualPersonaDirective.trim().slice(0, 1800)}\n\n` : ''}${MEET_CHAT_COT_APPENDIX}

${MEET_EVALUATION_APPENDIX}

${wechatPolicy}

${truthMirrorPolicy}

${MEET_IMAGE_VISION_APPENDIX}`
  const user = `${buildMeetSessionIntentContext(params.userProfile)}
用户资料：${resolveMeetPublicDisplayName(params.userProfile)}｜${params.userProfile.intent}｜${params.userProfile.bio.slice(0, 200)}
${resonanceLine}
最近对话（由旧到新；含口语气泡与【缔结契约/交换真心话/盲盒】等系统叙述，须通读后再接话，勿无视上文）：
${promptCtx.join('\n') || '（尚无记录。）'}
${pendingTruthInvite ? '\n【硬性】已有待回应的真心话邀请卡 → evaluation 中 proactive_truth_mirror 必须为 false。\n' : ''}
请按协议输出：先 <evaluation>，再 <thinking>，再多条气泡正文。
**硬性**：thinking 结束后每条气泡**单独占一行**（真换行，不要整段一行）；日常约 3～8 行、每行约 1～15 字，像微信连发。${swapHint}`

  const useVision =
    !!params.pendingUserImage?.base64?.trim() ||
    (!!params.injectUserProfileAvatarVision && !!params.userProfileAvatarImage?.base64?.trim())

  try {
    let raw: string
    if (useVision) {
      const history = params.transcript.map((t) => ({
        role: (t.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.content,
      }))
      const visionMessages: unknown[] = [{ role: 'system', content: sys }, ...history]
      if (params.injectUserProfileAvatarVision && params.userProfileAvatarImage?.base64?.trim()) {
        const av = params.userProfileAvatarImage
        visionMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: MEET_USER_AVATAR_VISION_TEXT },
            {
              type: 'image_url',
              image_url: { url: meetImageDataUrl(av.type, av.base64) },
            },
          ],
        })
      }
      if (params.pendingUserImage?.base64?.trim()) {
        const img = params.pendingUserImage
        const cap = params.transcript[params.transcript.length - 1]?.content?.trim()
        const hint = cap && cap !== '（发送了一张图片）' ? `${MEET_USER_IMAGE_VISION_TEXT}\n${cap}` : MEET_USER_IMAGE_VISION_TEXT
        visionMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: hint },
            {
              type: 'image_url',
              image_url: { url: meetImageDataUrl(img.type, img.base64) },
            },
          ],
        })
      }
      visionMessages.push({ role: 'user', content: user })
      raw = await callMeetOpenAiVisionChat(cfg, visionMessages, { temperature: 0.72, max_tokens: 1400 })
    } else {
      raw = await openAiCompatibleChat(cfg, [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ], { temperature: 0.72, max_tokens: 1400 })
    }
    const prep = prepareMeetNpcReplyForParsing(raw)
    let evaluation = prep.evaluation
    if (evaluation && (pendingTruthInvite || params.truthMirrorCeremonyOpen)) {
      evaluation = { ...evaluation, proactiveTruthMirror: false }
    }
    const bubbles = parseMeetNpcReplyBubbles(prep.bodyForBubbles)
    if (!bubbles.length) {
      throw new MeetEncounterGenerationError('api_failed', '模型未返回有效回复，请重试。')
    }
    return { replies: bubbles.map((s) => s.slice(0, 600)), evaluation }
  } catch (e) {
    if (e instanceof MeetEncounterGenerationError) throw e
    throw new MeetEncounterGenerationError('api_failed', '临时会话回复失败，请检查网络与模型后重试。')
  }
}

/** 结业同步：仅在已入通讯录之后调用；约百字、第三人称档案体，正文须含字面量 `{{char}}` / `{{user}}`（与九维世界书条目一致），见 `syncMeetEpilogueAfterContactsAdded`。 */
export async function aiMeetEncounterEpilogueLore(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  transcript: Array<{ role: 'user' | 'npc'; content: string }>
}): Promise<string> {
  const cfg = params.apiConfig
  const lines = params.transcript
    .filter((m) => m.content.trim())
    .map((m) => `${m.role === 'user' ? '用户' : params.npc.nickname}：${m.content.trim()}`)
  const transcriptText = lines.join('\n').slice(-8000)
  const hasTranscript = transcriptText.trim().length > 0

  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    if (!hasTranscript) {
      return '{{char}}与{{user}}在遇见临时会话中尚未深聊；双方已交换微信联系方式，现阶段以礼貌与观察为主，私聊中再逐步了解。'
    }
    return '{{char}}与{{user}}的临时会话篇幅较短、信息有限；气氛偏克制。双方已加微信，{{char}}对{{user}}暂持分寸感与保留，愿在私聊中续接话题、不急于定性关系。'
  }

  const sys = `你是「人设世界书」编辑助理，正在为档案条目撰写**尾声延展**正文。当前人设代号为「${params.npc.nickname}」（仅作你内部理解；**成稿中不得写该网名或任何真实姓名汉字**，一律用占位符）。

【文体】与九维分册一致：**第三人称档案体**，客观、克制；**禁止**角色第一人称（不得出现：我、咱、本人、在下等）；**禁止**用「你」称呼对方。

【占位符硬性要求】成稿中须多次、自然地出现字面字符串 **{{char}}**（指本档案人设）与 **{{user}}**（指绑定的玩家身份），二者均须以英文花括号原样输出；不得用 TA/对方/此人 等代词完全顶替而不出现占位符；至少各出现 2 次。

【长度】单段连续正文，**90–115 个汉字**（须写完整句并在句号处收束；勿短于 85、勿超过 120），无小标题、无列表、无 Markdown/XML。

【内容】融合：①对下方摘录的极简归纳（须有据；摘录极短则写「会话尚浅、信息有限」）；②{{char}} 对 {{user}} 的当前态度：信任远近、是否愿意继续接触、边界与顾虑（须与摘录与人设气质一致，禁止无条件倒贴或无端敌意）。
【分寸】第三人称档案体；禁止土味情话式抒情、禁止未熟先定性为恋人；恋爱向意向仅体现为「愿意继续了解、持保留或欣赏」，勿写成告白体。`

  const user = `【摘录仅供你理解语境；成稿勿复述长句】
【用户侧公开资料】展示昵称：${resolveMeetPublicDisplayName(params.userProfile)}；意向：${params.userProfile.intent}；取向：${params.userProfile.orientation}
简介摘抄：${params.userProfile.bio.slice(0, 240)}

【临时会话摘录】由旧到新：
${hasTranscript ? transcriptText : '（无有效对话摘录。）'}

【自检】是否第三人称且无「我」？是否含字面量 {{char}}、{{user}} 且字数合规？否则重写后只输出正文。`

  try {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.5, max_tokens: 280 },
    )
    const t = String(raw ?? '')
      .replace(/<[^>]{1,20}>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const clamped = clampMeetEpilogueBody(t)
    return clamped || aiMeetEncounterEpilogueLore({ ...params, apiConfig: null })
  } catch {
    return aiMeetEncounterEpilogueLore({ ...params, apiConfig: null })
  }
}

/**
 * 角色在遇见缔结后**主动**发起微信好友验证：生成独立一行「验证打招呼」。
 * 不得照搬临时会话口播；与 adjudication 回复、通过后打招呼为不同场景。
 */
export async function aiMeetCharOutgoingFriendRequestGreeting(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  /** 对方本次验证绑定的微信身份展示名 */
  peerWeChatDisplayName: string
}): Promise<string> {
  const charNick = params.npc.nickname.trim() || '我'
  const meetNick = resolveMeetPublicDisplayName(params.userProfile)
  const wxNick = params.peerWeChatDisplayName.trim() || meetNick || '你'

  const fallback =
    wxNick && wxNick !== charNick
      ? `你好呀～${wxNick}！我是刚刚在遇见里的${charNick}`
      : `你好～我是遇见里的${charNick}，通过一下呀`

  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return fallback.slice(0, 80)
  }

  const personaBlock = buildMeetNpcDigestForModel(
    params.npc,
    resolveMeetCharUserNames(params.npc.nickname, params.userProfile),
  )

  const sys = `你是角色「${charNick}」。你与对方在交友 App「遇见」里已约定互换微信，现在由你**主动**在真实微信向对方发送「添加好友时的验证消息」（一行备注式打招呼，不是私聊续聊）。
${personaBlock}

【必须遵守】
1. 只输出**一行**中文，约 12～45 字，口语自然、贴合人设，可带 1 个语气词。
2. 让对方认出你来自「遇见」：须提遇见/刚刚在遇见里/遇见 App 等，并带上你在遇见里的称呼「${charNick}」。
3. 可自然称呼对方微信名「${wxNick}」；遇见档案展示名「${meetNick || '（未填）'}」仅作参考。
4. **禁止**复述、拼接、改写遇见临时会话里已出现的原句（例如会话里的调侃、口令、表情包描述、微信号梗等）；这是**新写的加好友申请备注**。
5. 禁止 XML/标签/列表/引号包裹；禁止空泛「通过一下」「我是${charNick}」式模板，除非极贴合人设。
6. 禁止土味情话、禁止「处对象吗」式越界；像正常人加好友备注，轻松认出遇见即可。
【风格参考，勿照抄】「你好～我是刚刚遇见里不喜欢吃香菜那个！」「嗨，${wxNick}，遇见那边刚聊过的～」`

  const user = `请写一行微信好友验证打招呼。`

  try {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.78, max_tokens: 96 },
    )
    const line = String(raw ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^["'「『]|["'」』]$/g, '')
      .replace(/\r?\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return line.slice(0, 100) || fallback.slice(0, 80)
  } catch {
    return fallback.slice(0, 80)
  }
}

/** 交换真心话：双盲封印后，角色对同一题目的独立真心作答（不读取用户答案；仅正文，约 50 汉字；不落 evaluation） */
export async function aiMeetTruthMirrorCharAnswer(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  transcript: Array<{ role: 'user' | 'npc'; content: string }>
  question: string
  dualPersonaDirective?: string
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return '……我已落笔。翻牌时你自会看见。'
  }

  const personaBlock = buildMeetNpcDigestForModel(
    params.npc,
    resolveMeetCharUserNames(params.npc.nickname, params.userProfile),
  )
  const ctx = params.transcript
    .slice(-14)
    .map((m) => `${m.role === 'user' ? '用户' : 'NPC'}：${m.content}`)
    .join('\n')

  const sys = `你在交友 App「遇见」临时会话中扮演角色 ${params.npc.nickname}。
须严格遵守人设（含表里反差、阴暗面与克制感的伪装），表达可冷酷、深情、戏谑或偏执，须合法、尊重边界，拒绝操控与越界恐怖化描写。
${personaBlock}
${params.dualPersonaDirective?.trim() ? params.dualPersonaDirective.trim().slice(0, 1600) : ''}

${MEET_RELATIONSHIP_CONDUCT_APPENDIX}

${MEET_TRUTH_MIRROR_ANSWER_CONDUCT_APPENDIX}

【本轮仅输出一句真心话作答】
- 只输出作答正文：不要引号包裹全句、不要前后缀、不要解释、不要 Markdown、不要分段。
- 语义长度控制在约 50 个汉字以内（标点尽量少）。
- 你在双盲仪式中**与用户面对同一道题目各自书写**；此刻你仍不知道用户写了什么，也**禁止**根据臆测去回应、复述或点评用户可能的内容。
- 你必须像该题只问你一人那样，用第一人称给出你对题目本身的真心作答；可结合人设与你们此前的聊天氛围，但**不得**写成对用户上一句或用户密封稿的接话、安慰或反驳。`

  const user = `${buildMeetSessionIntentContext(params.userProfile)}
此前对话摘录（由旧到新，仅供语气与关系感衔接；可能为空）：
${ctx || '（尚无可摘录。）'}

本轮真心话题目（请独自作答这一题，当作它只向你一人发问）：
${params.question}

请结合你的真实人设，写出你对**该题目本身**的真心话：平实、具体、真诚，约 50 字以内；禁止土味情话与对眼前用户的告白式拐弯。只输出答案正文。`

  try {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.78, max_tokens: 160 },
    )
    const flat = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    const clipped = [...flat].slice(0, 52).join('')
    return clipped || '……我不再往下写了。'
  } catch {
    return '……笔停在这里。你当作没问。'
  }
}

/** 缔结契约：用户发起交换联络方式后，NPC 输出 XML 判定 + 口语正文（无 evaluation 流程） */
export async function aiMeetContractCovenantReply(params: {
  apiConfig: ApiConfig | null
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  transcript: Array<{ role: 'user' | 'npc'; content: string }>
  resonanceScore: number
  dualPersonaDirective?: string
}): Promise<string> {
  const cfg = params.apiConfig
  const fallback =
    '<contract_response>\n  <decision>reject</decision>\n  <action_type>none</action_type>\n</contract_response>\n现在就要微信？我觉得我们还没熟到那一步。'
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return fallback
  }

  const personaBlock = buildMeetNpcDigestForModel(
    params.npc,
    resolveMeetCharUserNames(params.npc.nickname, params.userProfile),
  )
  const ctx = params.transcript
    .slice(-16)
    .map((m) => `${m.role === 'user' ? '用户' : 'NPC'}：${m.content}`)
    .join('\n')
  const r = Math.max(0, Math.min(100, Math.round(Number(params.resonanceScore))))
  const resonanceGuide = formatMeetCovenantResonanceGuidance(r)

  const sys = `你在交友 App「遇见」临时会话中扮演角色 ${params.npc.nickname}。
须严格遵守人设（含表里反差、防备心、社交距离与占有欲等），表达须合法、尊重边界，禁止操控、威胁或违法暗示。
${personaBlock}
${params.dualPersonaDirective?.trim() ? params.dualPersonaDirective.trim().slice(0, 1600) : ''}

${MEET_RELATIONSHIP_CONDUCT_APPENDIX}

【系统级事件】用户刚刚通过界面，向你发起「互换联络方式（微信）」的契约确认。

请结合当前聊天语境、你对用户的态度，以及下列刻度与人设裁量：
${resonanceGuide}
- agree 表示：**叙事层面双方都已获知彼此的微信号**（产品与剧本假定互换已成功对齐）；请在口语里自然收尾。
  · 正文禁止写成单方话术：例如「只有我给了你微信号」「把你的号单独发给我了」「我刚把你的微信号抄下来了」等——互换完成即代表彼此已知对方微信号，无需强调单向递交。
  · **禁止**编造「此刻已在真实微信里点了添加好友 / 发出了验证消息」——好友申请是否发生、谁先开口，留给**后续对话再演变**，本轮契约不承担即时好友请求剧情。

【输出硬性规则】
1) 必须在你的全部输出**最开头**（任何口语、标点之前）严格输出下列 XML 块（层级固定）：
<contract_response>
  <decision>agree</decision>
  <action_type>char_add_user</action_type>
</contract_response>
- decision：agree / reject（小写英文）。
- action_type：char_add_user / user_add_char / none（小写英文）。
- reject → action_type 必须为 none。
- agree 时 action_type **仅标注叙事取向**：后续在微信语境里你**更倾向于**谁先开口发起添加——倾向由你先发起 → char_add_user；倾向让对方先添加你 → user_add_char。**不等于**客户端此刻替你发出好友请求或写入验证消息。
2) XML 块之后写口语正文；可多行短句；禁止 Markdown、禁止括号动作描写、禁止重复整段 XML。
3) agree 且需在叙事里给出可加微信号（尤其 user_add_char）：口语里写出可信微信号（字母数字下划线，4–20 位）；契约块必须追加一行：<wechat_id>与口语完全一致</wechat_id>（标签名固定）；与人设已有 wechatId 冲突时以本轮口语为准。
4) agree 且 action_type 为 char_add_user：仍建议在契约块写出 <wechat_id>…</wechat_id>（若口语未点名可由人设归档占位），便于界面展示复制；口语侧重态度与收尾，不必复述「我要去加你了」之类即刻动作承诺。`

  const user = `此前对话摘录（由旧到新；可能为空）：
${ctx || '（尚无可摘录。）'}

请输出：先完整 XML 块，再写你的回复正文。`

  try {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.82, max_tokens: 520 },
    )
    const t = String(raw ?? '').trim()
    return t || fallback
  } catch {
    return fallback
  }
}
