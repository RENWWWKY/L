/**
 * 遇见九维人设生成 · 带标记纯文本输出（比 JSON 更稳，解析失败率更低）。
 */

export const MEET_PERSONA_PROSE_MARKERS = [
  'nickname',
  'realName',
  'age',
  'gender',
  'orientation',
  'wechatId',
  'mutualSpark',
  'occupation',
  'motto',
  'persona',
  'comp.base.info',
  'comp.base.physiology',
  'comp.base.realName',
  'comp.base.birthdayMD',
  'comp.base.heightCm',
  'comp.base.weightKg',
  'comp.base.zodiac',
  'comp.base.wechatSignature',
  'comp.core.mbti',
  'comp.core.surface',
  'comp.core.trueSelf',
  'comp.core.values',
  'comp.core.flaws',
  'comp.psyche.background',
  'comp.psyche.shadow',
  'comp.psyche.emotionalPattern',
  'comp.psyche.orientationOrigin',
  'comp.abilities.skills',
  'comp.abilities.hobbies',
  'comp.abilities.socialMode',
  'comp.fetish.preference',
  'comp.fetish.sensory',
  'comp.fetish.dynamic',
  'comp.fetish.jealousy',
  'comp.fetish.intimateSpeech',
  'comp.relations.family',
  'comp.relations.friends',
  'comp.relations.enemies',
  'comp.contrast.beforeLove',
  'comp.contrast.afterLove',
  'comp.contrast.conflict',
  'comp.daily.speech',
  'comp.daily.habits',
  'comp.daily.money',
  'comp.daily.quirks',
  'comp.arc.secrets',
  'comp.arc.goal',
  'comp.arc.contrastMoe',
] as const

export type MeetPersonaProseMarker = (typeof MEET_PERSONA_PROSE_MARKERS)[number]

export const MEET_NINE_DIMENSION_PROSE_OUTPUT_RULE = `
【输出格式】只输出下列带【标记】的段落（须逐行保留标记名），禁止 JSON、禁止 markdown 代码围栏、禁止标记段之外的解释或思维链。
每个【标记】独占一行，下一行起写正文；多行正文写到下一个【标记】前为止。下列标记**全部必填**（正文可短，但不可省略标记行）。

${MEET_PERSONA_PROSE_MARKERS.map((m) => `【${m}】`).join('\n')}

【标记填写说明】
- nickname / realName / gender / orientation / wechatId / occupation / motto / persona：单行或短段中文 prose。
- age：仅写整数（16–99）。
- mutualSpark：仅写 true 或 false（小写，不要引号）。
- comp.* 各段：中文 prose；comp.base.info 开头须含「××岁。」且数字与 age 一致；comp.base.birthdayMD 写 MM-DD；comp.base.heightCm / weightKg 写纯数字。
- 禁止把 comprehensive 再包一层 JSON；所有九维叶子字段只用上述 comp.* 标记输出。
`.trim()

function stripModelFences(raw: string): string {
  let t = String(raw ?? '').trim()
  const m = /^```(?:json|markdown|text)?\s*([\s\S]*?)```$/m.exec(t)
  if (m?.[1]) t = m[1].trim()
  return t
    .replace(/^```(?:json|markdown|text)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

export function looksLikeMeetPersonaProseOutput(raw: string): boolean {
  const t = stripModelFences(raw)
  if (!t) return false
  if (/^[\s{[]/.test(t) && /"comprehensive"|"nickname"\s*:/.test(t)) return false
  return /【nickname】/.test(t) && /【comp\.base\.info】/.test(t)
}

export function parseMeetPersonaProseSections(raw: string): Map<string, string> {
  const text = stripModelFences(raw)
  const sections = new Map<string, string>()
  if (!text) return sections

  const re = /【([^】\n]+)】\s*\n?([\s\S]*?)(?=\n【[^】\n]+】|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const key = m[1]!.trim()
    const body = m[2]!.trim()
    if (key) sections.set(key, body)
  }
  return sections
}

function section(sections: Map<string, string>, key: MeetPersonaProseMarker | string): string {
  return sections.get(key)?.trim() ?? ''
}

function parseMutualSpark(raw: string): boolean | undefined {
  const t = raw.trim().toLowerCase()
  if (!t) return undefined
  if (t === 'true' || t === '是' || t === 'yes' || t === '1') return true
  if (t === 'false' || t === '否' || t === 'no' || t === '0') return false
  return undefined
}

function parseAge(raw: string): number | undefined {
  const m = /(\d{1,2})/.exec(raw.trim())
  if (!m) return undefined
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 16 || n > 99) return undefined
  return n
}

function buildComprehensiveFromSections(sections: Map<string, string>): Record<string, unknown> {
  return {
    base: {
      info: section(sections, 'comp.base.info'),
      physiology: section(sections, 'comp.base.physiology'),
      realName: section(sections, 'comp.base.realName'),
      birthdayMD: section(sections, 'comp.base.birthdayMD'),
      heightCm: section(sections, 'comp.base.heightCm'),
      weightKg: section(sections, 'comp.base.weightKg'),
      zodiac: section(sections, 'comp.base.zodiac'),
      wechatSignature: section(sections, 'comp.base.wechatSignature'),
    },
    core: {
      mbti: section(sections, 'comp.core.mbti'),
      surface: section(sections, 'comp.core.surface'),
      trueSelf: section(sections, 'comp.core.trueSelf'),
      values: section(sections, 'comp.core.values'),
      flaws: section(sections, 'comp.core.flaws'),
    },
    psyche: {
      background: section(sections, 'comp.psyche.background'),
      shadow: section(sections, 'comp.psyche.shadow'),
      emotionalPattern: section(sections, 'comp.psyche.emotionalPattern'),
      orientationOrigin: section(sections, 'comp.psyche.orientationOrigin'),
    },
    abilities: {
      skills: section(sections, 'comp.abilities.skills'),
      hobbies: section(sections, 'comp.abilities.hobbies'),
      socialMode: section(sections, 'comp.abilities.socialMode'),
    },
    fetish: {
      preference: section(sections, 'comp.fetish.preference'),
      sensory: section(sections, 'comp.fetish.sensory'),
      dynamic: section(sections, 'comp.fetish.dynamic'),
      jealousy: section(sections, 'comp.fetish.jealousy'),
      intimateSpeech: section(sections, 'comp.fetish.intimateSpeech'),
    },
    relations: {
      family: section(sections, 'comp.relations.family'),
      friends: section(sections, 'comp.relations.friends'),
      enemies: section(sections, 'comp.relations.enemies'),
    },
    contrast: {
      beforeLove: section(sections, 'comp.contrast.beforeLove'),
      afterLove: section(sections, 'comp.contrast.afterLove'),
      conflict: section(sections, 'comp.contrast.conflict'),
    },
    daily: {
      speech: section(sections, 'comp.daily.speech'),
      habits: section(sections, 'comp.daily.habits'),
      money: section(sections, 'comp.daily.money'),
      quirks: section(sections, 'comp.daily.quirks'),
    },
    arc: {
      secrets: section(sections, 'comp.arc.secrets'),
      goal: section(sections, 'comp.arc.goal'),
      contrastMoe: section(sections, 'comp.arc.contrastMoe'),
    },
  }
}

/** 解析 prose 人设输出；无效时返回 null（由调用方回退 JSON）。 */
export function parseMeetEncounterPersonaProseOutput(raw: string): Record<string, unknown> | null {
  if (!looksLikeMeetPersonaProseOutput(raw)) return null
  const sections = parseMeetPersonaProseSections(raw)
  const nickname = section(sections, 'nickname')
  const compInfo = section(sections, 'comp.base.info')
  if (!nickname && !compInfo) return null

  const mutualSpark = parseMutualSpark(section(sections, 'mutualSpark'))
  const age = parseAge(section(sections, 'age'))

  const out: Record<string, unknown> = {
    ...(nickname ? { nickname } : {}),
    ...(section(sections, 'realName') ? { realName: section(sections, 'realName') } : {}),
    ...(age != null ? { age } : {}),
    ...(section(sections, 'gender') ? { gender: section(sections, 'gender') } : {}),
    ...(section(sections, 'orientation') ? { orientation: section(sections, 'orientation') } : {}),
    ...(section(sections, 'wechatId') ? { wechatId: section(sections, 'wechatId') } : {}),
    ...(mutualSpark != null ? { mutualSpark } : {}),
    ...(section(sections, 'occupation') ? { occupation: section(sections, 'occupation') } : {}),
    ...(section(sections, 'motto') ? { motto: section(sections, 'motto') } : {}),
    ...(section(sections, 'persona') ? { persona: section(sections, 'persona') } : {}),
    comprehensive: buildComprehensiveFromSections(sections),
  }
  return out
}
