export type UserMomentEngagementPresetId =
  | 'quiet'
  | 'natural'
  | 'lively'
  | 'overflow'
  | 'custom'

export type UserMomentEngagementRulesSettings = {
  presetId: UserMomentEngagementPresetId
  /** 自定义模式：追加到角色互动 AI 任务说明 */
  customPrompt: string
  /** 自定义：可见名单好友进入互动候选的比例 0～100 */
  customAiParticipationPercent?: number
  /** 自定义：保底点赞概率（关系一般角色）0～100 */
  customFallbackLikePercent?: number
  /** 自定义：未互动角色补浏览足迹比例 0～100 */
  customViewedFootprintPercent?: number
  /** 自定义：单条动态最多互动人数 */
  customMaxAiCharacters?: number
}

export type ResolvedUserMomentEngagementRules = {
  presetId: UserMomentEngagementPresetId
  maxAiCharacters: number
  normalAiSamplePercent: number
  distantAiSamplePercent: number
  fallbackLikePercentClose: number
  fallbackLikePercentNormal: number
  fallbackLikePercentMentioned: number
  silentViewedPercent: number
  aiIntensityPrompt: string
  customPromptAppendix: string
}

export const DEFAULT_USER_MOMENT_ENGAGEMENT_RULES: UserMomentEngagementRulesSettings = {
  presetId: 'natural',
  customPrompt: '',
}

export const USER_MOMENT_ENGAGEMENT_PRESET_OPTIONS: {
  id: UserMomentEngagementPresetId
  title: string
  subtitle: string
  summary: string
}[] = [
  {
    id: 'quiet',
    title: '静悄悄',
    subtitle: 'Low activity',
    summary: '仅少数熟人会点赞，多数人只留浏览足迹；适合不想被刷屏时。',
  },
  {
    id: 'natural',
    title: '自然',
    subtitle: 'Balanced',
    summary: '熟人常互动，一般关系见有意思的内容也会评；默认推荐。',
  },
  {
    id: 'lively',
    title: '热闹',
    subtitle: 'Lively',
    summary: '更多角色会点赞或短评，互动更密、更有人气。',
  },
  {
    id: 'overflow',
    title: '超热闹',
    subtitle: 'Very active',
    summary: '几乎全员都会有所反应，连关系偏淡的角色也更易冒泡。',
  },
  {
    id: 'custom',
    title: '自定义',
    subtitle: 'Custom',
    summary: '自己写互动法则，并可微调列表好友参与比例、最多互动人数与保底点赞强度。',
  },
]

function clampPercent(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

function clampMaxAi(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(1, Math.min(30, Math.round(n)))
}

function hashPercent(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return h % 100
}

/** 稳定抽样：同一角色 id 在同一百分比下结果一致 */
export function sampleByEngagementPercent(charId: string, percent: number, salt = ''): boolean {
  if (percent >= 100) return true
  if (percent <= 0) return false
  return hashPercent(`${charId}:${salt}`) < percent
}

const PRESET_RESOLVED: Record<
  Exclude<UserMomentEngagementPresetId, 'custom'>,
  Omit<ResolvedUserMomentEngagementRules, 'presetId' | 'customPromptAppendix'>
> = {
  quiet: {
    maxAiCharacters: 8,
    normalAiSamplePercent: 22,
    distantAiSamplePercent: 0,
    fallbackLikePercentClose: 75,
    fallbackLikePercentNormal: 12,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 50,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 静悄悄】',
      '- 整体偏克制：多数角色可以完全不互动；仅极熟或 @ 你的人更可能点赞。',
      '- 评论更少，能点赞就不必长评；别让人刷圈像群聊现场。',
    ].join('\n'),
  },
  natural: {
    maxAiCharacters: 20,
    normalAiSamplePercent: 100,
    distantAiSamplePercent: 0,
    fallbackLikePercentClose: 100,
    fallbackLikePercentNormal: 68,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 100,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 自然】',
      '- 熟人多半会点赞；关系一般者见特别有意思/有意义的内容也会评。',
      '- 不必全员互动，但别对好内容集体装死。',
    ].join('\n'),
  },
  lively: {
    maxAiCharacters: 22,
    normalAiSamplePercent: 100,
    distantAiSamplePercent: 18,
    fallbackLikePercentClose: 100,
    fallbackLikePercentNormal: 88,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 100,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 热闹】',
      '- 互动偏活跃：熟人几乎都会点赞，有槽点/共鸣就 comment。',
      '- 不要全员只点赞；至少应有多人短评，评区像真实热闹朋友圈。',
      '- 关系一般者也更容易随手赞或留一句。',
    ].join('\n'),
  },
  overflow: {
    maxAiCharacters: 28,
    normalAiSamplePercent: 100,
    distantAiSamplePercent: 42,
    fallbackLikePercentClose: 100,
    fallbackLikePercentNormal: 96,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 100,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 超热闹】',
      '- 高互动：评区要有人说话，**禁止全员只点赞**。',
      '- 关系非冷淡的角色中，约半数应留 comment（而不只是 like）；熟人、@ 你的人几乎必评。',
      '- 有正文或配图时，至少多人短评接话；可 like+comment，不要只点赞就走。',
      '- 即使关系一般，内容有趣/好看/有话题时也应留一句，像人气很旺的朋友圈。',
    ].join('\n'),
  },
}

export function normalizeUserMomentEngagementRules(
  raw: unknown,
): UserMomentEngagementRulesSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_USER_MOMENT_ENGAGEMENT_RULES }
  const o = raw as Record<string, unknown>
  const presetRaw = o.presetId
  const presetId: UserMomentEngagementPresetId =
    presetRaw === 'quiet' ||
    presetRaw === 'natural' ||
    presetRaw === 'lively' ||
    presetRaw === 'overflow' ||
    presetRaw === 'custom'
      ? presetRaw
      : DEFAULT_USER_MOMENT_ENGAGEMENT_RULES.presetId

  return {
    presetId,
    customPrompt: typeof o.customPrompt === 'string' ? o.customPrompt.trim() : '',
    customAiParticipationPercent: clampPercent(o.customAiParticipationPercent, 70),
    customFallbackLikePercent: clampPercent(o.customFallbackLikePercent, 60),
    customViewedFootprintPercent: clampPercent(o.customViewedFootprintPercent, 80),
    customMaxAiCharacters: clampMaxAi(o.customMaxAiCharacters, 18),
  }
}

export function resolveUserMomentEngagementRules(
  settings: UserMomentEngagementRulesSettings | null | undefined,
): ResolvedUserMomentEngagementRules {
  const normalized = normalizeUserMomentEngagementRules(settings ?? DEFAULT_USER_MOMENT_ENGAGEMENT_RULES)

  if (normalized.presetId !== 'custom') {
    const base = PRESET_RESOLVED[normalized.presetId]
    return {
      presetId: normalized.presetId,
      ...base,
      customPromptAppendix: '',
    }
  }

  const aiPercent = clampPercent(normalized.customAiParticipationPercent, 70)
  const fallbackNormal = clampPercent(normalized.customFallbackLikePercent, 60)
  const viewedPercent = clampPercent(normalized.customViewedFootprintPercent, 80)
  const maxAi = clampMaxAi(normalized.customMaxAiCharacters, 18)

  const customPromptAppendix = normalized.customPrompt
    ? ['【用户自定义互动法则】', normalized.customPrompt].join('\n')
    : ''

  return {
    presetId: 'custom',
    maxAiCharacters: maxAi,
    normalAiSamplePercent: aiPercent,
    distantAiSamplePercent: Math.max(0, Math.round(aiPercent * 0.35)),
    fallbackLikePercentClose: Math.min(100, fallbackNormal + 25),
    fallbackLikePercentNormal: fallbackNormal,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: viewedPercent,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 自定义】',
      `- 用户期望可见名单里约 ${aiPercent}% 的好友会认真考虑互动（由你按人设与关系执行）。`,
      `- 保底点赞强度约 ${fallbackNormal}/100；未互动者浏览足迹约 ${viewedPercent}%。`,
      customPromptAppendix,
    ]
      .filter(Boolean)
      .join('\n'),
    customPromptAppendix,
  }
}

export function buildUserMomentEngagementRulesPromptAppendix(
  rules: ResolvedUserMomentEngagementRules,
): string {
  const parts = [rules.aiIntensityPrompt]
  if (rules.customPromptAppendix && rules.presetId !== 'custom') {
    parts.push(rules.customPromptAppendix)
  }
  return parts.filter(Boolean).join('\n\n')
}

export function isHighCommentEngagementPreset(
  presetId: UserMomentEngagementPresetId | undefined,
): boolean {
  return presetId === 'overflow' || presetId === 'lively'
}

/** 高互动预设下，单条动态至少应有的首评数量（不足时补跑 AI） */
export function minimumCommentCountForEngagementPreset(
  presetId: UserMomentEngagementPresetId | undefined,
): number {
  if (presetId === 'overflow') return 3
  if (presetId === 'lively') return 2
  return 0
}
