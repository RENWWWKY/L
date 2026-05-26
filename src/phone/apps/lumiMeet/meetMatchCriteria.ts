import { buildEncounterOrientationCriteriaBlock } from './meetOrientationMatch'
import type { MeetMatchIntention, MeetOrientationPreference, RadarFilters } from './meetTypes'

/** 与 `MeetOrientationPreference` 一一对应，供筛选 UI / AI 提示 / 迁移白名单复用 */
export const MEET_ORIENTATION_OPTIONS: { id: MeetOrientationPreference; zh: string; en: string }[] = [
  { id: 'hetero', zh: '异性恋', en: 'Heterosexual' },
  { id: 'homo', zh: '同性恋', en: 'Homosexual' },
  { id: 'bi_pan', zh: '双性恋 / 泛性恋', en: 'Bi / Pan' },
  { id: 'ace', zh: '无性恋谱系', en: 'Ace spectrum' },
  { id: 'aro', zh: '无浪漫倾向谱系', en: 'Aro spectrum' },
  { id: 'demi', zh: '半性恋 / 半浪漫', en: 'Demi' },
  { id: 'queer_fluid', zh: '酷儿 / 流动 / 探索中', en: 'Queer / fluid' },
  { id: 'poly_open', zh: '开放关系 / 多边（合意）', en: 'ENM / poly' },
]

export const MEET_ORIENTATION_PREFERENCE_IDS: MeetOrientationPreference[] = MEET_ORIENTATION_OPTIONS.map((o) => o.id)

export const MEET_ORIENTATION_LABEL_ZH: Record<MeetOrientationPreference, string> = {
  hetero: '异性恋',
  homo: '同性恋',
  bi_pan: '双性恋 / 泛性恋',
  ace: '无性恋谱系',
  aro: '无浪漫倾向谱系',
  demi: '半性恋 / 半浪漫',
  queer_fluid: '酷儿 / 流动 / 探索中',
  poly_open: '开放关系 / 多边（合意）',
}

/** 筛选面板「说明」用：每个标签的通俗释义（非医学诊断；尊重多元用语） */
export const MEET_ORIENTATION_HELP_ZH: Record<MeetOrientationPreference, string> = {
  hetero:
    '在浪漫或性吸引上，主要指向与自身性别不同的对象；日常语境里常被称作「直」。勾选表示你愿意匹配到自我认同为异性恋倾向的角色设定。',
  homo:
    '在浪漫或性吸引上，主要指向与自身性别相同的对象（如男同、女同等）。勾选表示接受生成人设的对外取向落在同性恋谱系内。',
  bi_pan:
    '双性恋：可对不止一种性别产生吸引。泛性恋：吸引常与人格、气质等相关，而不强调性别二分标签。二者在现实中用语因人而异，此处合并为一类筛选标签。',
  ace:
    '无性恋谱系（Ace）：部分人无或极少性吸引，或与浪漫吸引不同步；也有人仅有浪漫吸引而几乎无性吸引。勾选表示接受人设体现谱系内的某一种真实体验。',
  aro:
    '无浪漫倾向谱系（Aro）：浪漫吸引很弱、罕见或难以指向他人；与「有没有性吸引」相互独立，组合方式很多。勾选表示接受人设带有无浪漫或弱浪漫倾向的设定。',
  demi:
    '半性恋 / 半浪漫（Demi）：往往在与人建立较深信任或情感纽带之后，才逐渐产生性吸引或浪漫吸引。勾选表示接受此类节奏的人设描写。',
  queer_fluid:
    '酷儿：可作伞式自我认同。流动：取向或标签随人生阶段变化。探索中：仍在寻找合适表述。勾选表示接受人设取向表述较灵活、未必固定单一标签。',
  poly_open:
    '在**所有相关方知情同意**的前提下，认同或实践开放关系、多伴侣（道德非一夫一妻制，ENM）等结构。勾选仅表示筛选相容设定；**绝不**等同于隐瞒或欺骗。',
}

const INTENT_LABEL: Record<MeetMatchIntention, string> = {
  romance: '寻找浪漫',
  platonic: '纯粹友谊',
  soulmate: '灵魂共鸣',
  casual: '闲聊搭子',
}

/** 由勾选意向推导 legacy purpose（写入持久化，兼容旧提示片段） */
export function meetIntentionsToPurpose(intents: MeetMatchIntention[]): RadarFilters['purpose'] {
  if (!intents.length) return 'love'
  if (intents.includes('romance') || intents.includes('soulmate')) return 'love'
  if (intents.includes('platonic')) return 'friend'
  return 'buddy'
}

/** 旧 purpose → 默认意向列表（迁移用） */
export function legacyPurposeToMeetIntentions(p: RadarFilters['purpose']): MeetMatchIntention[] {
  if (p === 'love') return ['romance']
  if (p === 'friend') return ['platonic']
  return ['casual']
}

/** 注入 AI 用户消息的「寻觅法则」硬约束块 */
export function buildEncounterAiCriteriaBlock(
  filters: RadarFilters,
  opts?: { orientationRoundSeed?: number },
): string {
  const intents =
    filters.meetIntentions.length > 0 ? filters.meetIntentions : legacyPurposeToMeetIntentions(filters.purpose)
  const intentZh = intents.map((k) => INTENT_LABEL[k]).join('；')

  const oriBlock = buildEncounterOrientationCriteriaBlock(filters, {
    orientationRoundSeed: opts?.orientationRoundSeed,
  })

  const kw = filters.keywords.trim()
  const vibe = kw ? `【氛围关键词】${kw}` : ''

  return [
    `【年龄硬约束】角色真实年龄必须在 ${filters.ageMin}–${filters.ageMax} 岁之间（不得超出；须在 comprehensive / persona / 自述中一致）。`,
    oriBlock,
    `【交友意向】用户勾选：${intentZh}。捏人时动机与相处预期须与上述意向整体相容，禁止生成明显违背的用户人设。`,
    vibe,
  ]
    .filter(Boolean)
    .join('\n')
}

/** 离线兜底：在年龄区间内取确定性年龄 */
export function pickOfflineAgeYears(seed: string, ageMin: number, ageMax: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const span = Math.max(0, ageMax - ageMin)
  if (span <= 0) return Math.max(18, Math.min(99, ageMin))
  return ageMin + (h >>> 0) % (span + 1)
}
