import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
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
import type { EncounterNPC, MeetPublicProfile, RadarFilters, SquarePostStyle } from './meetTypes'
import {
  buildEncounterAiCriteriaBlock,
  legacyPurposeToMeetIntentions,
  meetIntentionsToPurpose,
} from './meetMatchCriteria'
import { pickMeetAvatar, resolveMeetAvatarNpcGenderLabel, type MeetAvatarExclusion } from './meetAvatarPool'
import {
  MEET_MBTI_SIXTEEN,
  MEET_NINE_DIMENSION_JSON_SCHEMA,
  rollMeetMbtiAnchoredByKeywords,
} from './meetPersonaPrompt'
import { prepareMeetNpcReplyForParsing } from './meetEvaluationParse'
import type { MeetReplyEvaluation } from './meetEvaluationParse'
import { parseMeetNpcReplyBubbles } from './lumiMeetReplyParse'

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
4) 本轮准备拆成几条气泡、每条大概说什么
5) 自检：有无油腻、说教、把多句硬塞进一条的倾向；有无中二夸张或三观跑偏

硬性规则：
- 对用户最终可见的正文里禁止出现 evaluation、thinking、禁止 Markdown、禁止括号动作描写。
- 口语化、短句为主；像真人连发几条微信，而不是一篇小作文。
- 对白与直接引语一律用英文半角双引号 "..."；不要用中文直角引号包裹台词。

【输出格式】
- 每条气泡单独占一行；优先多行短句，不要把整段长文写在同一行。
- 若需交换微信，只在其中一行自然写出微信号（如：加我微信吧：Lm_xxx）。
`.trim()

const MEET_EVALUATION_APPENDIX = `
---------------------
【系统指令：动态情感判定】
---------------------
请根据用户上一句话与本轮语境输出 XML（前端会剥离隐藏；勿在标签外复述这些规则）：
<evaluation>
  <affection_change>+3</affection_change>
  <proactive_swap>false</proactive_swap>
  <swap_instruction>一句口语附言，可为空</swap_instruction>
  <swap_confirm>false</swap_confirm>
</evaluation>
- affection_change：整数，约 -5 到 +5，表示本轮好感波动。
- proactive_swap：若你认为气氛已到、希望主动提出互换联络方式，填 true。
- swap_instruction：互换联络时的附言提示（例如 "我加你了，通过一下。"）；可为空。
- swap_confirm：仅当双方已在语境中明确同意互换联络方式时填 true（多数回合应为 false）。
`.trim()

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

function randomWxId(seed: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  let s = 'Lm_'
  for (let i = 0; i < 7; i++) {
    h = Math.imul(h ^ i, 16777619)
    s += alphabet[Math.abs(h) % alphabet.length]!
  }
  return s
}

/** 邂逅新人设未配置 API 或模型请求/解析失败时抛出；不再使用本地随机人设兜底。 */
export class MeetEncounterGenerationError extends Error {
  readonly code: 'api_required' | 'api_failed'

  constructor(code: 'api_required' | 'api_failed', message?: string) {
    const fallback =
      code === 'api_required'
        ? '须先在 API 设置中填写请求地址与密钥后再寻觅新人。'
        : '邂逅人设生成失败，请检查网络、密钥与模型是否支持 JSON 输出后重试。'
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
  const criteriaBlock = buildEncounterAiCriteriaBlock(params.filters)

  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    throw new MeetEncounterGenerationError('api_required')
  }

  const sys = `你是交友 App 遇见的九维立体人格生成引擎。写的是当代都市里**可信、三观正、行为合法**的人物：职业从 system SCHEMA 中的**八大谱系**（霸总精英、白领精英、文艺、娱乐圈、体制内、小众酷感、市井创业、合法反差）与**日常接地气工种**里择一写清，忌二游式夸张；**MBTI 与职业无任何对应关系**，禁止按类型 "配职业"，MBTI 只体现在 core 与 "工作场合习惯" 描写里。
硬性文风：comprehensive.core.mbti 须庄重克制，**禁止** "自测闹着玩"、"闹着玩" 等消解质感的措辞；可写 "仅供参考"、"与职业无对应" 之类中性说明。
性别一致：gender 与男/女须与 comprehensive.base 的外貌与称谓气质一致，禁止性别栏写女性却把人写成男性向外貌。
取向叙事：顶层 orientation 与 comprehensive.psyche.orientationOrigin 必须指向同一套自我认同（由来可曲折或平淡），禁止二者互相矛盾。${MEET_NINE_DIMENSION_JSON_SCHEMA}`
  const userNick = params.meetProfile.displayName?.trim() || '（未填昵称）'
  const mbtiRoll = rollMeetMbtiAnchoredByKeywords(kw)
  const user = [
    `筛选：想找${genderPref}；目的侧重：${purpose}。${kw ? `性格关键词：${kw}。` : ''}`,
    criteriaBlock,
    `当前滑动用户展示昵称（仅供你理解语境，勿写入 comprehensive/persona 正文替代占位符）：${userNick}`,
    `用户公开资料摘要：${params.profileHint.slice(0, 520)}`,
    `【姓名与网名】comprehensive 内第三人称档案（尤其 base.info、base.physiology）叙述本人时只用 realName 与 base.realName 的汉字全称，禁止用 nickname 作主语或当代称。`,
    `口语化、具体、少抽象词；人设健康合常识。职业可从 SCHEMA 八大谱系或日常工种里选，须写具体业务细节。占位与对方规则以 system 内 SCHEMA 为准（fetish/contrast 恋爱向客观陈述勿写 {{user}}）；年龄/生日/身高体重/座右铭的硬约束以 SCHEMA 末段「与人脉 AI 基础信息对齐」小节为准。`,
    `【本轮硬性】comprehensive.core.mbti 必须以四字母 "${mbtiRoll}" 为唯一类型标签（可紧接中文逗号+一句大白话；禁止再写另一组四字母类型；禁止把 ISTJ/INTJ 当默认值偷换）。`,
    `【气质-MBTI 对齐】性格关键词：${kw || '（未填）'}。本轮锚定类型为 ${mbtiRoll}：core.mbti 的一句话侧写、surface、trueSelf、daily.speech 必须与 "${mbtiRoll}" 及关键词气质一致；禁止写成外向热情却套用冷淡表述，反之亦然。`,
    `【取向叙事】comprehensive.psyche.orientationOrigin 须单独成段，写清取向认同的由来（可与顶层 orientation 简短标签呼应）；允许生来稳定、亦允许经历过错位再澄清；禁止与 orientation 矛盾。`,
    `【匹配裁判】顶层必须输出布尔字段 mutualSpark（true/false，不要引号字符串）：在已写好人设的前提下，若用户凭上述资料向你生成的 NPC 表达心动，NPC 是否愿意正向接住、形成双向心动的起手。须与人设一致；缺该字段或类型错误视为生成失败。`,
  ].join('\n')

  try {
    const raw = await openAiCompatibleChat(cfg, [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.86, max_tokens: 5200 })
    const j = JSON.parse(stripCodeFence(raw)) as Record<string, unknown>
    const nickname = typeof j.nickname === 'string' ? j.nickname.trim().slice(0, 8) : '未命名'
    const genderRaw = typeof j.gender === 'string' ? j.gender.trim() : '其他'
    const orientation = typeof j.orientation === 'string' ? j.orientation.trim().slice(0, 28) : '保密'
    let persona = typeof j.persona === 'string' ? j.persona.trim().slice(0, 360) : ''
    const wechatId =
      typeof j.wechatId === 'string' && /^Lm_[A-Za-z0-9_]{4,16}$/.test(j.wechatId.trim())
        ? j.wechatId.trim()
        : randomWxId(nickname + Date.now())
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
      const sigFix = isMeetProfilePlaceholder(comprehensivePersona.base.wechatSignature)
        ? deriveMeetWechatSignatureFromPersona(withVitals)
        : comprehensivePersona.base.wechatSignature
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
    return {
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
刚刚你与用户**互相心动**，临时会话已开启，**用户还没有发过任何消息**。你要以该角色口吻**主动发出开场打招呼**（像连发几条微信）：口语、短句、贴合人设；可略带轻松或矜持，**禁止**机械复述 "匹配成功了"、"系统提示" 等元话术，**禁止** Markdown、禁止括号动作描写。

人设与九维侧写（须遵守，禁止 OOC 成万能舔狗）：
${personaBlock}

${MEET_CHAT_COT_APPENDIX}

thinking 内第 2 点可改为：当前会话为空、用户尚未发言，开场如何自然不尴尬。
若自然语境里愿意顺带提可加微信，可写一行微信号（可用：${params.npc.wechatId || '（暂无）'}），不要每句都撩。`

  const up = params.userProfile
  const user = `用户展示昵称：${up.displayName || '未填'}
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
用户昵称：${params.userProfile.displayName || '未填写'}
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
}): Promise<{ replies: string[]; evaluation: MeetReplyEvaluation | null }> {
  const cfg = params.apiConfig
  const lastUser = [...params.transcript].reverse().find((m) => m.role === 'user')
  const promptCtx = params.transcript.slice(-14).map((m) => `${m.role === 'user' ? '用户' : 'NPC'}：${m.content}`)
  const swapHint =
    params.encounterSwapStatus && params.encounterSwapStatus !== 'none'
      ? `\n当前联络互换状态（仅供你理解语境）：${params.encounterSwapStatus}。若状态为 user_requested，请在口语回复中自然收尾并可将 swap_confirm 设为 true；若为 swapped 则勿再重复索要微信号。`
      : ''
  const resonance = Math.max(0, Math.min(100, Math.round(Number(params.resonanceScore ?? 18))))
  const resonanceLine = `【当前情感共鸣刻度】${resonance}/100：数值偏低时保持礼貌与适度距离；中等时自然有来有往；偏高时可略松弛亲近，但必须符合人设、尊重边界，禁止油腻、操控或越界臆断。`

  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    return {
      replies: lastUser?.content?.includes('你好')
        ? [`嗨，我是${params.npc.nickname}。`, '临时会话先聊聊也行。', '我不急着要答案。']
        : [`嗯，我在听。`, `${params.npc.nickname}这边信号还行。`, '你想聊轻松点的还是认真点的？'],
      evaluation: null,
    }
  }

  const personaBlock = buildMeetNpcDigestForModel(
    params.npc,
    resolveMeetCharUserNames(params.npc.nickname, params.userProfile),
  )

  const sys = `你在交友 App 遇见的临时会话里扮演对方角色 ${params.npc.nickname}。
人设与九维侧写（须严格遵守，禁止 OOC 成 "万能暖男/舔狗"）；口吻像都市里正常成年人，三观正、尊重边界，禁止极端、操控或违法暗示。
${personaBlock}

${MEET_CHAT_COT_APPENDIX}

${MEET_EVALUATION_APPENDIX}

补充：若关系升温到可交换微信，在自然语境里写出微信号（可用：${params.npc.wechatId || '（暂无）'}），不要每句都撩。`
  const user = `用户资料：${params.userProfile.displayName}｜${params.userProfile.intent}｜${params.userProfile.bio.slice(0, 200)}
${resonanceLine}
最近对话：
${promptCtx.join('\n')}
请按协议输出：先 <evaluation>，再 <thinking>，再多条气泡正文（每行一条）。${swapHint}`

  try {
    const raw = await openAiCompatibleChat(cfg, [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ], { temperature: 0.72, max_tokens: 1200 })
    const prep = prepareMeetNpcReplyForParsing(raw)
    const bubbles = parseMeetNpcReplyBubbles(prep.bodyForBubbles)
    if (bubbles.length) return { replies: bubbles.map((s) => s.slice(0, 600)), evaluation: prep.evaluation }
    return { replies: ['……我刚在想怎么说，稍等我一下。'], evaluation: prep.evaluation }
  } catch {
    return aiMeetChatReply({ ...params, apiConfig: null })
  }
}

/** 写入通讯录后：尾声延展条目——须基于临时会话由模型总结，并写明对用户的当前态度（单段正文，不含 XML） */
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
  const transcriptText = lines.join('\n').slice(-12000)
  const hasTranscript = transcriptText.trim().length > 0

  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim()) {
    if (!hasTranscript) {
      return `${params.npc.nickname}与用户尚未在临时会话里深聊；当前态度：礼貌、保留观察，愿意在通讯录里接上后再慢慢了解对方，不急于下判断。`
    }
    return `${params.npc.nickname}仍记得这段临时会话里对方的大致节奏与措辞。会话小结：交流偏短或信息有限，印象尚在成形。对用户的当前态度：保持礼貌与适度距离，愿意在微信里把话说清楚，但不急于定义关系；具体观感待私聊里再印证。`
  }

  const sys = `你是角色「${params.npc.nickname}」本人，正在为档案法则撰写一条「尾声延展」内向独白（写入世界书、绑定你这个人设 id）。
用户已将你加入镜像微信通讯录，你们在 App「遇见」里的临时会话已告一段落（可能已在会话中互换过微信号，也可能仅由用户手动同步联络方式）。

【写作任务】你必须先基于下方「临时会话摘录」做忠实于语境的把握，再输出一段连贯的第一人称正文（约 220–420 字），整段须自然融合以下两块内容，禁止用小标题、禁止列表符号、禁止 Markdown/XML：
1）会话小结：用你自己的口吻概括这场临时会话里实际发生过什么、气氛与节奏如何（须扣住摘录中的具体说法或话题，禁止泛泛编造未出现的情节；若摘录极短则如实写「聊得还浅、印象仍在拼凑」）。
2）对用户的当前态度与看法：明确写出此刻你对 TA 的信任远近、好感或疏离、是否愿意继续接触、有无顾虑或边界（须与人设及上文小结一致，禁止 OOC 成无条件倒贴或无端敌意）。

文风：当代都市口语感、具体、克制；三观正、尊重边界；禁止输出任何标签行或标题。`
  const user = `【用户侧公开资料】展示昵称：${params.userProfile.displayName || '未填'}；意向：${params.userProfile.intent}；取向：${params.userProfile.orientation}
简介摘抄：${params.userProfile.bio.slice(0, 360)}

【临时会话摘录】由旧到新；你必须据此写「小结 + 对 TA 的当前态度」，无摘录或几乎为空时须在正文里如实说明「会话尚浅」并给出与之匹配的谨慎态度。
${hasTranscript ? transcriptText : '（无有效对话摘录。）'}

【硬性自检】输出前自问：①小结是否贴摘录？②态度句是否直接回答「我现在怎么看 TA、愿不愿意往下聊」？若任一为否，重写后再输出正文。`

  try {
    const raw = await openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.68, max_tokens: 900 },
    )
    const t = String(raw ?? '')
      .replace(/<[^>]{1,20}>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return t.slice(0, 1600) || aiMeetEncounterEpilogueLore({ ...params, apiConfig: null })
  } catch {
    return aiMeetEncounterEpilogueLore({ ...params, apiConfig: null })
  }
}
