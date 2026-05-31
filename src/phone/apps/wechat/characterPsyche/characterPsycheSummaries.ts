import type { CharacterPsychePageId, CharacterPsycheState } from './characterPsycheTypes'

export type CharacterPsychePageSummaries = Record<CharacterPsychePageId, string>

export type CharacterPsycheSummaryContext = {
  /** 角色档案全名（非通讯录备注） */
  characterFullName: string
  /** 最近一条用户文本消息（已截断） */
  lastUserQuote?: string
}

function clipQuote(raw: string | undefined, max = 32): string | undefined {
  const t = raw?.trim()
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function who(name: string): string {
  const n = name.trim()
  return n || 'TA'
}

/** 第二人称侧写：因为你…，{全名}… */
function withYouQuote(
  name: string,
  quote: string | undefined,
  tailWithName: string,
  fallbackWithName: string,
): string {
  const q = clipQuote(quote)
  const char = who(name)
  if (q) return `因为你一句话「${q}」，${char}${tailWithName}`
  return `你还没留下新的话头，${char}${fallbackWithName}`
}

function dominantEmotion(state: CharacterPsycheState): { label: string; high: boolean } {
  const rows = [
    { v: state.mood, high: '心情明显上扬', low: '情绪有些沉' },
    { v: state.heartbeat, high: '有些心动', low: '心动反应偏淡' },
    { v: state.security, high: '安全感比较足', low: '安全感仍在摇摆' },
    { v: state.trust, high: '对你信任度很高', low: '对你仍带着试探' },
    { v: state.calmness, high: '整体很冷静', low: '思绪略乱、冷静值偏低' },
  ]
  let pick = rows[0]!
  let score = Math.abs(pick.v - 50)
  for (const r of rows.slice(1)) {
    const s = Math.abs(r.v - 50)
    if (s > score) {
      pick = r
      score = s
    }
  }
  return { label: pick.v >= 55 ? pick.high : pick.low, high: pick.v >= 55 }
}

function buildEmotionSummary(state: CharacterPsycheState, name: string, quote?: string): string {
  const { label } = dominantEmotion(state)
  if (state.heartbeat >= 72) {
    return withYouQuote(name, quote, `觉得${label}，心跳也比刚才更明显了一点`, '还在回味你们刚才的对话余温')
  }
  if (state.mood <= 35) {
    return withYouQuote(name, quote, `觉得${label}，但心情似乎松动了一些`, '暂时把话头压住，等你再靠近一步')
  }
  if (state.trust <= 40) {
    return withYouQuote(name, quote, `觉得${label}，对你的戒备好像卸下了一角`, '仍用礼貌的距离观察你的下一句话')
  }
  return withYouQuote(name, quote, `觉得${label}，情绪曲线被你的话轻轻拨动了一下`, '整体还算平稳，没有明显波动')
}

function buildDarknessSummary(state: CharacterPsycheState, name: string, quote?: string): string {
  const top = [
    { v: state.jealousy, high: '醋意偏高，暗流有些明显', mid: '有一点不易察觉的酸', low: '醋意不算重' },
    { v: state.possessiveness, high: '占有欲正顶在阈值边缘', mid: '占有欲在缓慢抬头', low: '占有欲克制得不错' },
    { v: state.disgust, high: '厌恶感未完全消退', mid: '些许抵触仍在', low: '厌恶感很低' },
    { v: state.rebellion, high: '叛逆因子比较活跃', mid: '偶尔想唱反调', low: '叛逆值不高' },
  ].sort((a, b) => b.v - a.v)[0]!

  const trait = top.v >= 70 ? top.high : top.v >= 45 ? top.mid : top.low

  if (state.jealousy >= 68) {
    return withYouQuote(name, quote, `${trait}，但酸意反而被压下去了一点`, '仍在用沉默消化这份不平衡')
  }
  if (state.possessiveness >= 68) {
    return withYouQuote(name, quote, `${trait}，独占的冲动似乎被安抚了`, '仍想确认自己在你这里的顺位')
  }
  if (state.disgust >= 55) {
    return withYouQuote(name, quote, `${trait}，对你的抵触没有继续加深`, '还需要更多行动来修复印象')
  }
  return withYouQuote(name, quote, `${trait}，羁绊面被你的语气牵了一下`, '危险特质暂时维持现状')
}

function buildVitalsSummary(state: CharacterPsycheState, name: string, quote?: string): string {
  const hunger = 100 - state.satiety
  const fatigue = state.sleepiness
  const heat = state.arousal
  const weak = 100 - state.health

  const ranked = [
    { score: hunger, kind: 'hunger' as const },
    { score: fatigue, kind: 'fatigue' as const },
    { score: heat, kind: 'heat' as const },
    { score: weak, kind: 'weak' as const },
  ].sort((a, b) => b.score - a.score)

  const top = ranked[0]!

  if (top.kind === 'hunger' && state.satiety <= 45) {
    const intensity = state.satiety <= 25 ? '非常饥饿' : '有些饿'
    return withYouQuote(name, quote, `${intensity}，倒也没觉得那么饿了`, '仍觉得肚子空着，需要找点东西垫一口')
  }
  if (top.kind === 'fatigue' && state.sleepiness >= 58) {
    const intensity = state.sleepiness >= 78 ? '非常困倦' : '有些犯困'
    return withYouQuote(name, quote, `${intensity}，眼皮好像没那么沉了`, '仍靠意志力撑着陪你聊下去')
  }
  if (top.kind === 'heat' && state.arousal >= 58) {
    const intensity = state.arousal >= 78 ? '燥热明显' : '身体有些发热'
    return withYouQuote(name, quote, `${intensity}，呼吸稍微平复了一些`, '仍在用克制维持表面的从容')
  }
  if (top.kind === 'weak' && state.health <= 45) {
    const intensity = state.health <= 28 ? '状态欠佳' : '身体略有些虚'
    return withYouQuote(name, quote, `${intensity}，精神似乎好了一点`, '仍需要休息，不宜再硬撑')
  }

  return withYouQuote(name, quote, '生理体征整体平稳，身体状态被你的话轻轻带偏了一点', '各项读数都在常轨附近')
}

export function buildCharacterPsychePageSummaries(
  state: CharacterPsycheState,
  ctx: CharacterPsycheSummaryContext,
): CharacterPsychePageSummaries {
  const quote = clipQuote(ctx.lastUserQuote)
  const name = ctx.characterFullName
  return {
    emotion: buildEmotionSummary(state, name, quote),
    darkness: buildDarknessSummary(state, name, quote),
    vitals: buildVitalsSummary(state, name, quote),
  }
}

export function mergeCharacterPsycheSummaries(
  state: CharacterPsycheState,
  ctx: CharacterPsycheSummaryContext,
): CharacterPsychePageSummaries {
  const generated = buildCharacterPsychePageSummaries(state, ctx)
  const saved = state.summaries
  if (!saved) return generated
  return {
    emotion: saved.emotion?.trim() || generated.emotion,
    darkness: saved.darkness?.trim() || generated.darkness,
    vitals: saved.vitals?.trim() || generated.vitals,
  }
}

export function extractLastUserQuoteFromChatTexts(texts: string[]): string | undefined {
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const raw = texts[i]?.trim()
    if (!raw) continue
    if (raw.startsWith('[表情包]')) continue
    if (raw === '[图片]' || raw === '[语音]' || raw.startsWith('[系统]')) continue
    return raw
  }
  return undefined
}
