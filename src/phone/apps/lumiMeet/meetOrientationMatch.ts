import { MEET_ORIENTATION_LABEL_ZH } from './meetMatchCriteria'
import type { MeetOrientationPreference, RadarFilters } from './meetTypes'

const HOMO_RE = /同性恋|同性(?![恋向])|男同|女同|拉拉|gay|lesbian|homo(?![\w])|queer(?!\s*\/)/i
const HETERO_RE = /异性恋|异性(?![恋向])|hetero|straight|直(?:男|女)?(?!\s*播)/i
const BI_PAN_RE = /双性恋|双性|泛性恋|泛性|\bbi\b|\bpan\b/i
const ACE_RE = /无性恋|无性(?![恋向])|\bace\b/i
const ARO_RE = /无浪漫|无恋|aromantic|\baro\b/i
const DEMI_RE = /半性恋|半浪漫|demi/i
const QUEER_FLUID_RE = /酷儿|流动|探索中|queer|fluid/i
const POLY_RE = /开放关系|多边|合意|poly|enm/i

const ORIENTATION_FIELD_SAMPLES: Record<MeetOrientationPreference, string> = {
  hetero: '异性恋 (Hetero)',
  homo: '同性恋 (Homo)',
  bi_pan: '双性恋 / 泛性恋',
  ace: '无性恋谱系',
  aro: '无浪漫倾向谱系',
  demi: '半性恋 / 半浪漫',
  queer_fluid: '酷儿 / 探索中',
  poly_open: '开放关系（合意）',
}

/** 从角色对外取向字段 + 由来叙事推断其落在哪些筛选标签上 */
export function classifyNpcOrientationTags(
  orientation: string,
  orientationOrigin?: string,
): Set<MeetOrientationPreference> {
  const text = `${orientation ?? ''} ${orientationOrigin ?? ''}`.trim()
  const tags = new Set<MeetOrientationPreference>()
  if (!text) return tags

  if (BI_PAN_RE.test(text)) tags.add('bi_pan')
  if (ACE_RE.test(text)) tags.add('ace')
  if (ARO_RE.test(text)) tags.add('aro')
  if (DEMI_RE.test(text)) tags.add('demi')
  if (QUEER_FLUID_RE.test(text)) tags.add('queer_fluid')
  if (POLY_RE.test(text)) tags.add('poly_open')

  const hasBi = BI_PAN_RE.test(text)
  const hasHomo = HOMO_RE.test(text) && !hasBi
  const hasHetero = HETERO_RE.test(text)
  if (hasHomo) tags.add('homo')
  if (hasHetero) tags.add('hetero')

  if (!tags.size) {
    if (/保密|未填|不便透露/.test(text)) {
      tags.add('queer_fluid')
    }
  }
  return tags
}

export function npcMatchesOrientationPreferences(
  orientation: string,
  prefs: MeetOrientationPreference[],
  orientationOrigin?: string,
): boolean {
  if (!prefs.length) return true
  const tags = classifyNpcOrientationTags(orientation, orientationOrigin)
  if (!tags.size) return false
  return prefs.some((p) => tags.has(p))
}

/** 多选时在勾选列表内轮换「本轮目标取向」，避免每次都落到 prefs[0]。 */
export function pickOrientationPreferenceForRound(
  prefs: MeetOrientationPreference[],
  roundSeed = 0,
): MeetOrientationPreference | null {
  if (!prefs.length) return null
  const idx = Math.abs(Math.floor(roundSeed)) % prefs.length
  return prefs[idx] ?? prefs[0] ?? null
}

/** 生成时指定顶层 orientation 字段的推荐写法（提高命中率） */
export function pickOrientationFieldExample(prefs: MeetOrientationPreference[], roundSeed = 0): string {
  if (!prefs.length) return ORIENTATION_FIELD_SAMPLES.bi_pan
  const target = pickOrientationPreferenceForRound(prefs, roundSeed)
  if (!target) return ORIENTATION_FIELD_SAMPLES.bi_pan
  return ORIENTATION_FIELD_SAMPLES[target] ?? '双性恋'
}

export function formatOrientationFieldExamples(prefs: MeetOrientationPreference[]): string {
  return prefs.map((p) => `「${ORIENTATION_FIELD_SAMPLES[p]}」`).join('、')
}

/** 用户**仅**勾选异性恋且限定目标性别时，提示模型对齐性别与取向 */
export function buildGenderOrientationAlignmentHint(filters: RadarFilters): string {
  const prefs = filters.orientationPreferences
  if (prefs.length !== 1 || prefs[0] !== 'hetero') return ''

  if (filters.gender === 'male') {
    return '【性别·取向对齐】用户寻觅目标性别为**男**，且**仅**接受异性恋设定：生成角色 gender 应为**女**，顶层 orientation 须明确为**异性恋**（勿写成同性恋）。'
  }
  if (filters.gender === 'female') {
    return '【性别·取向对齐】用户寻觅目标性别为**女**，且**仅**接受异性恋设定：生成角色 gender 应为**男**，顶层 orientation 须明确为**异性恋**（勿写成同性恋）。'
  }
  return '【取向对齐】用户**仅**接受异性恋设定：顶层 orientation 字段须明确写出「异性恋」，comprehensive.psyche.orientationOrigin 与之一致，**禁止**默认写成同性恋。'
}

/** 注入 AI：比旧版更硬的取向约束 */
export function buildEncounterOrientationCriteriaBlock(
  filters: RadarFilters,
  opts?: { orientationRoundSeed?: number },
): string {
  const prefs = filters.orientationPreferences
  if (!prefs.length) {
    return '【性取向匹配】用户未限定取向标签；你可自由设定合法合规的取向表述，但仍须与 gender、叙事一致。'
  }

  const roundSeed = opts?.orientationRoundSeed ?? 0
  const labels = prefs.map((k) => MEET_ORIENTATION_LABEL_ZH[k]).join('、')
  const roundTarget = pickOrientationPreferenceForRound(prefs, roundSeed)
  const example = pickOrientationFieldExample(prefs, roundSeed)
  const onlyHetero = prefs.length === 1 && prefs[0] === 'hetero'
  const allowsHomo = prefs.includes('homo')
  const multi = prefs.length > 1

  const lines = [
    `【性取向匹配 · 硬性】用户勾选接受的取向类型：${labels}（生成结果须**至少命中其一**）。`,
  ]

  if (multi && roundTarget) {
    lines.push(
      `用户勾选了**多种**取向；**本轮**请写成「${MEET_ORIENTATION_LABEL_ZH[roundTarget]}」相容的人设（顶层 orientation 示例：${example}）。`,
      `完整可选范围：${formatOrientationFieldExamples(prefs)}。勿长期只写列表第一项；多轮匹配应能呈现勾选范围内的不同取向。`,
    )
  } else {
    lines.push(
      `顶层 JSON 字段 orientation 须用中文主标签明确写出（示例格式：${example}），且 comprehensive.psyche.orientationOrigin 须与 orientation **同一套认同**，禁止矛盾。`,
    )
  }

  lines.push(
    `**禁止**输出与用户勾选完全不相容的取向（例：用户未勾选同性恋时，不得把 orientation 写成同性恋 / 同性吸引为主）。`,
  )

  if (onlyHetero) {
    lines.push(
      '本轮用户**仅**接受异性恋：orientation 必须体现异性恋，由来叙事须写对异性心动/吸引，**不得**写成同性恋、不得用「对同性心动」作主叙述。',
    )
  } else if (!allowsHomo) {
    lines.push('用户**未**勾选同性恋：不要把 orientation 默认写成同性恋；须从用户已勾选类型中写实。')
  }

  const align = buildGenderOrientationAlignmentHint(filters)
  if (align) lines.push(align)
  return lines.join('\n')
}
