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
  /** 自定义：熟人进入 AI 候选比例 0～100 */
  customCloseAiParticipationPercent?: number
  /** 自定义：冷淡关系进入 AI 候选比例 0～100 */
  customDistantAiParticipationPercent?: number
  /** 自定义：保底点赞概率（熟人）0～100 */
  customFallbackLikeClosePercent?: number
  /** 自定义：保底点赞概率（被 @）0～100 */
  customFallbackLikeMentionedPercent?: number
  /** 自定义：单条动态最多点赞人数 0～30 */
  customMaxLikeCount?: number
  /** 自定义：单条动态最多首评条数 0～20 */
  customMaxFirstComments?: number
  /** 自定义：单条动态最多评区接话条数 0～10 */
  customMaxThreadReplies?: number
}

export type ResolvedUserMomentEngagementRules = {
  presetId: UserMomentEngagementPresetId
  maxAiCharacters: number
  /** 熟人进入 AI 候选的比例 0～100（静悄悄会低于 100） */
  closeAiSamplePercent: number
  normalAiSamplePercent: number
  distantAiSamplePercent: number
  fallbackLikePercentClose: number
  fallbackLikePercentNormal: number
  fallbackLikePercentMentioned: number
  silentViewedPercent: number
  /** 单条动态最多首评（无 replyToCharId）条数 */
  maxFirstComments: number
  /** 单条动态最多评区接话（有 replyToCharId）条数；0 表示不生成接话 */
  maxThreadReplies: number
  /** 单条动态最多点赞人数 */
  maxLikeCount: number
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
    summary: '熟人约 38% · 一般 4%；至多 3 赞 / 2 首评 / 无接话。',
  },
  {
    id: 'natural',
    title: '自然',
    subtitle: 'Balanced',
    summary: '熟人约 85% 会动、一般关系约 32%；至多 6 赞 / 4 首评 / 2 接话。',
  },
  {
    id: 'lively',
    title: '热闹',
    subtitle: 'Lively',
    summary: '熟人几乎全动、一般关系约 68%；至多 11 赞 / 7 首评 / 4 接话。',
  },
  {
    id: 'overflow',
    title: '超热闹',
    subtitle: 'Very active',
    summary: '一般关系约 92%、冷淡关系也有机会；至多 18 赞 / 12 首评 / 6 接话。',
  },
  {
    id: 'custom',
    title: '自定义',
    subtitle: 'Custom',
    summary: '逐项微调参与比例、保底点赞与单条赞/评/接话上限；底部实时预览生效结果。',
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

function clampCount(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(min, Math.min(max, Math.round(n)))
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
    maxAiCharacters: 3,
    closeAiSamplePercent: 38,
    normalAiSamplePercent: 4,
    distantAiSamplePercent: 0,
    fallbackLikePercentClose: 28,
    fallbackLikePercentNormal: 0,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 52,
    maxFirstComments: 2,
    maxThreadReplies: 0,
    maxLikeCount: 3,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 静悄悄】',
      '- **整体极克制**：默认不互动；多数角色应输出 {"interactions":[]}。',
      '- 仅极熟或 @ 你的人**可能**点赞；评论极少，能赞就不评。',
      '- **禁止**评区接话、多人互怼、群聊式刷屏；这条圈应像安静的朋友圈。',
    ].join('\n'),
  },
  natural: {
    maxAiCharacters: 10,
    closeAiSamplePercent: 85,
    normalAiSamplePercent: 32,
    distantAiSamplePercent: 0,
    fallbackLikePercentClose: 78,
    fallbackLikePercentNormal: 28,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 68,
    maxFirstComments: 4,
    maxThreadReplies: 2,
    maxLikeCount: 6,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 自然】',
      '- 熟人多半会点赞；关系一般者见特别有意思/有意义的内容也可能评。',
      '- 不必全员互动，评区偶尔有一两句接话即可，别像群聊。',
    ].join('\n'),
  },
  lively: {
    maxAiCharacters: 16,
    closeAiSamplePercent: 100,
    normalAiSamplePercent: 68,
    distantAiSamplePercent: 10,
    fallbackLikePercentClose: 100,
    fallbackLikePercentNormal: 58,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 82,
    maxFirstComments: 7,
    maxThreadReplies: 4,
    maxLikeCount: 11,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 热闹】',
      '- 互动偏活跃：熟人几乎都会点赞，有槽点/共鸣就 comment。',
      '- 不要全员只点赞；至少应有多人短评，评区像真实热闹朋友圈。',
      '- 关系一般者也更容易随手赞或留一句。',
    ].join('\n'),
  },
  overflow: {
    maxAiCharacters: 24,
    closeAiSamplePercent: 100,
    normalAiSamplePercent: 92,
    distantAiSamplePercent: 32,
    fallbackLikePercentClose: 100,
    fallbackLikePercentNormal: 85,
    fallbackLikePercentMentioned: 100,
    silentViewedPercent: 96,
    maxFirstComments: 12,
    maxThreadReplies: 6,
    maxLikeCount: 18,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 超热闹】',
      '- 高互动：评区要有人说话，**禁止全员只点赞**。',
      '- 关系非冷淡的角色中，约半数应留 comment（而不只是 like）；熟人、@ 你的人几乎必评。',
      '- 有正文或配图时，至少多人短评接话；可 like+comment，不要只点赞就走。',
      '- 即使关系一般，内容有趣/好看/有话题时也应留一句，像人气很旺的朋友圈。',
    ].join('\n'),
  },
}

export type EngagementPresetMetricRow = {
  label: string
  value: string
  hint?: string
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatCount(value: number, unit = '条'): string {
  if (value <= 0) return '不生成'
  return `至多 ${value} ${unit}`
}

/** 将已解析规则转为 UI 可展示的比例/上限条目 */
export function buildEngagementPresetMetricRows(
  rules: ResolvedUserMomentEngagementRules,
): EngagementPresetMetricRow[] {
  const rows: EngagementPresetMetricRow[] = [
    {
      label: 'AI 互动候选上限',
      value: `${rules.maxAiCharacters} 人`,
      hint: '单条动态最多调用 AI 判断互动的角色数',
    },
    {
      label: '熟人进入 AI 候选',
      value: formatPercent(rules.closeAiSamplePercent),
      hint: '恋人、闺蜜、常私聊等关系',
    },
    {
      label: '一般关系进入 AI 候选',
      value: formatPercent(rules.normalAiSamplePercent),
    },
    {
      label: '冷淡关系进入 AI 候选',
      value: formatPercent(rules.distantAiSamplePercent),
      hint: '敌对、冷战等；0% 表示默认跳过',
    },
    {
      label: '保底点赞 · 熟人',
      value: formatPercent(rules.fallbackLikePercentClose),
      hint: 'AI 未产出互动时的补赞概率',
    },
    {
      label: '保底点赞 · 一般关系',
      value: formatPercent(rules.fallbackLikePercentNormal),
    },
    {
      label: '保底点赞 · 被 @',
      value: formatPercent(rules.fallbackLikePercentMentioned),
    },
    {
      label: '静默浏览足迹',
      value: formatPercent(rules.silentViewedPercent),
      hint: '未点赞/评论的角色补「看过」的概率',
    },
    {
      label: '单条最多点赞',
      value: formatCount(rules.maxLikeCount, '人'),
    },
    {
      label: '单条最多首评',
      value: formatCount(rules.maxFirstComments, '条'),
      hint: '直接评用户朋友圈的一级评论',
    },
    {
      label: '单条最多接话',
      value: formatCount(rules.maxThreadReplies, '条'),
      hint: '角色之间互评的二级回复',
    },
  ]

  const minComments = minimumCommentCountForEngagementPreset(rules.presetId)
  if (minComments > 0) {
    rows.push({
      label: '评论保底补全',
      value: `至少 ${minComments} 条首评`,
      hint: 'AI 评论不足时系统会再补跑',
    })
  }

  return rows
}

export function getEngagementPresetMetricRows(
  presetId: UserMomentEngagementPresetId,
  settings?: UserMomentEngagementRulesSettings | null,
): EngagementPresetMetricRow[] {
  const resolved = resolveUserMomentEngagementRules(
    presetId === 'custom'
      ? (settings ?? DEFAULT_USER_MOMENT_ENGAGEMENT_RULES)
      : { ...DEFAULT_USER_MOMENT_ENGAGEMENT_RULES, presetId },
  )
  return buildEngagementPresetMetricRows(resolved)
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
    customCloseAiParticipationPercent: clampPercent(o.customCloseAiParticipationPercent, 85),
    customDistantAiParticipationPercent: clampPercent(o.customDistantAiParticipationPercent, 25),
    customFallbackLikeClosePercent: clampPercent(o.customFallbackLikeClosePercent, 85),
    customFallbackLikeMentionedPercent: clampPercent(o.customFallbackLikeMentionedPercent, 100),
    customMaxLikeCount: clampCount(o.customMaxLikeCount, 1, 30, 12),
    customMaxFirstComments: clampCount(o.customMaxFirstComments, 0, 20, 8),
    customMaxThreadReplies: clampCount(o.customMaxThreadReplies, 0, 10, 3),
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
  const closeAiSamplePercent = clampPercent(normalized.customCloseAiParticipationPercent, 85)
  const distantAiSamplePercent = clampPercent(normalized.customDistantAiParticipationPercent, 25)
  const fallbackLikePercentClose = clampPercent(normalized.customFallbackLikeClosePercent, 85)
  const fallbackLikePercentMentioned = clampPercent(normalized.customFallbackLikeMentionedPercent, 100)
  const maxLikeCount = clampCount(normalized.customMaxLikeCount, 1, 30, 12)
  const maxFirstComments = clampCount(normalized.customMaxFirstComments, 0, 20, 8)
  const maxThreadReplies = clampCount(normalized.customMaxThreadReplies, 0, 10, 3)

  const customPromptAppendix = normalized.customPrompt
    ? ['【用户自定义互动法则】', normalized.customPrompt].join('\n')
    : ''

  return {
    presetId: 'custom',
    maxAiCharacters: maxAi,
    closeAiSamplePercent,
    normalAiSamplePercent: aiPercent,
    distantAiSamplePercent,
    fallbackLikePercentClose,
    fallbackLikePercentNormal: fallbackNormal,
    fallbackLikePercentMentioned,
    silentViewedPercent: viewedPercent,
    maxFirstComments,
    maxThreadReplies,
    maxLikeCount,
    aiIntensityPrompt: [
      '【朋友圈互动频度 · 自定义】',
      `- 一般关系 AI 候选约 ${aiPercent}%，熟人 ${closeAiSamplePercent}%，冷淡 ${distantAiSamplePercent}%。`,
      `- 保底点赞：一般 ${fallbackNormal}/100，熟人 ${fallbackLikePercentClose}/100，被 @ ${fallbackLikePercentMentioned}/100。`,
      `- 单条上限：AI ${maxAi} 人，点赞 ${maxLikeCount}，首评 ${maxFirstComments}，接话 ${maxThreadReplies}；浏览足迹 ${viewedPercent}%。`,
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

export function isLowEngagementPreset(
  presetId: UserMomentEngagementPresetId | undefined,
): boolean {
  return presetId === 'quiet'
}

/** 高互动预设下，单条动态至少应有的首评数量（不足时补跑 AI） */
export function minimumCommentCountForEngagementPreset(
  presetId: UserMomentEngagementPresetId | undefined,
): number {
  if (presetId === 'overflow') return 3
  if (presetId === 'lively') return 2
  return 0
}

export type CustomEngagementSliderId =
  | 'maxAiCharacters'
  | 'closeParticipation'
  | 'participation'
  | 'distantParticipation'
  | 'fallbackLikeClose'
  | 'fallbackLike'
  | 'fallbackLikeMentioned'
  | 'viewedFootprint'
  | 'maxLikeCount'
  | 'maxFirstComments'
  | 'maxThreadReplies'

export type CustomEngagementSettingKey =
  | 'customMaxAiCharacters'
  | 'customCloseAiParticipationPercent'
  | 'customAiParticipationPercent'
  | 'customDistantAiParticipationPercent'
  | 'customFallbackLikeClosePercent'
  | 'customFallbackLikePercent'
  | 'customFallbackLikeMentionedPercent'
  | 'customViewedFootprintPercent'
  | 'customMaxLikeCount'
  | 'customMaxFirstComments'
  | 'customMaxThreadReplies'

export const CUSTOM_ENGAGEMENT_SLIDER_DEFAULTS: Record<CustomEngagementSettingKey, number> = {
  customMaxAiCharacters: 18,
  customCloseAiParticipationPercent: 85,
  customAiParticipationPercent: 70,
  customDistantAiParticipationPercent: 25,
  customFallbackLikeClosePercent: 85,
  customFallbackLikePercent: 60,
  customFallbackLikeMentionedPercent: 100,
  customViewedFootprintPercent: 80,
  customMaxLikeCount: 12,
  customMaxFirstComments: 8,
  customMaxThreadReplies: 3,
}

export type CustomEngagementHeatTone = 'quiet' | 'soft' | 'balanced' | 'lively' | 'hot'

export type CustomEngagementSliderGuide = {
  id: CustomEngagementSliderId
  label: string
  hint: string
  lowLabel: string
  highLabel: string
  min: number
  max: number
  step?: number
  valueKind: 'percent' | 'count'
  valueKey: CustomEngagementSettingKey
  formatValueLabel: (value: number) => string
}

export type CustomEngagementSliderSection = {
  title: string
  description: string
  guides: CustomEngagementSliderGuide[]
}

export const CUSTOM_ENGAGEMENT_SLIDER_SECTIONS: CustomEngagementSliderSection[] = [
  {
    title: '参与与关系',
    description: '决定哪些关系的好友会进入 AI 互动候选。',
    guides: [
      {
        id: 'maxAiCharacters',
        label: 'AI 互动候选上限',
        hint: '单条动态最多调用 AI 判断互动的角色数。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 1,
        max: 30,
        valueKind: 'count',
        valueKey: 'customMaxAiCharacters',
        formatValueLabel: (value) => `${value} 人`,
      },
      {
        id: 'closeParticipation',
        label: '熟人进入 AI 候选',
        hint: '恋人、闺蜜、常私聊等关系进入候选的比例。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customCloseAiParticipationPercent',
        formatValueLabel: (value) => `${value}%`,
      },
      {
        id: 'participation',
        label: '一般关系进入 AI 候选',
        hint: '关系一般的好友进入「要不要点赞/评论」候选的概率。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customAiParticipationPercent',
        formatValueLabel: (value) => `${value}%`,
      },
      {
        id: 'distantParticipation',
        label: '冷淡关系进入 AI 候选',
        hint: '敌对、冷战等关系；0% 表示默认跳过 AI。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customDistantAiParticipationPercent',
        formatValueLabel: (value) => `${value}%`,
      },
    ],
  },
  {
    title: '保底与围观',
    description: 'AI 没产出互动时的补赞，以及「看过」围观记录。',
    guides: [
      {
        id: 'fallbackLikeClose',
        label: '保底点赞 · 熟人',
        hint: 'AI 未产出互动时，熟人被系统补赞的概率。',
        lowLabel: '← 更少补赞',
        highLabel: '更多补赞 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customFallbackLikeClosePercent',
        formatValueLabel: (value) => `${value}%`,
      },
      {
        id: 'fallbackLike',
        label: '保底点赞 · 一般关系',
        hint: 'AI 未产出互动时，关系一般好友被补赞的概率。',
        lowLabel: '← 更少补赞',
        highLabel: '更多补赞 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customFallbackLikePercent',
        formatValueLabel: (value) => `${value}%`,
      },
      {
        id: 'fallbackLikeMentioned',
        label: '保底点赞 · 被 @',
        hint: '被提醒谁看的好友，AI 失手时被补赞的概率。',
        lowLabel: '← 更少补赞',
        highLabel: '更多补赞 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customFallbackLikeMentionedPercent',
        formatValueLabel: (value) => `${value}%`,
      },
      {
        id: 'viewedFootprint',
        label: '静默浏览足迹',
        hint: '只影响「看过」记录，不直接增加赞/评。',
        lowLabel: '← 更少围观',
        highLabel: '更多围观 →',
        min: 0,
        max: 100,
        valueKind: 'percent',
        valueKey: 'customViewedFootprintPercent',
        formatValueLabel: (value) => `${value}%`,
      },
    ],
  },
  {
    title: '单条上限',
    description: '硬性裁剪单条动态的点赞、首评与评区接话数量。',
    guides: [
      {
        id: 'maxLikeCount',
        label: '单条最多点赞',
        hint: '超出后会按关系优先级保留最重要的点赞。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 1,
        max: 30,
        valueKind: 'count',
        valueKey: 'customMaxLikeCount',
        formatValueLabel: (value) => `${value} 人`,
      },
      {
        id: 'maxFirstComments',
        label: '单条最多首评',
        hint: '直接评用户朋友圈的一级评论条数上限。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 0,
        max: 20,
        valueKind: 'count',
        valueKey: 'customMaxFirstComments',
        formatValueLabel: (value) => (value <= 0 ? '不生成' : `${value} 条`),
      },
      {
        id: 'maxThreadReplies',
        label: '单条最多接话',
        hint: '角色之间互评的二级回复；0 表示不生成评区接话。',
        lowLabel: '← 更冷清',
        highLabel: '更热闹 →',
        min: 0,
        max: 10,
        valueKind: 'count',
        valueKey: 'customMaxThreadReplies',
        formatValueLabel: (value) => (value <= 0 ? '不生成' : `${value} 条`),
      },
    ],
  },
]

/** @deprecated 使用 CUSTOM_ENGAGEMENT_SLIDER_SECTIONS */
export const CUSTOM_ENGAGEMENT_SLIDER_GUIDES: CustomEngagementSliderGuide[] =
  CUSTOM_ENGAGEMENT_SLIDER_SECTIONS.flatMap((section) => section.guides)

export function readCustomEngagementSliderValue(
  rules: UserMomentEngagementRulesSettings,
  guide: CustomEngagementSliderGuide,
): number {
  const raw = rules[guide.valueKey]
  const fallback = CUSTOM_ENGAGEMENT_SLIDER_DEFAULTS[guide.valueKey]
  if (guide.valueKind === 'count') {
    if (guide.valueKey === 'customMaxAiCharacters') {
      return clampMaxAi(typeof raw === 'number' ? raw : fallback, fallback)
    }
    return clampCount(typeof raw === 'number' ? raw : fallback, guide.min, guide.max, fallback)
  }
  return clampPercent(typeof raw === 'number' ? raw : fallback, fallback)
}

export function patchCustomEngagementSliderValue(
  guide: CustomEngagementSliderGuide,
  next: number,
): Partial<UserMomentEngagementRulesSettings> {
  const fallback = CUSTOM_ENGAGEMENT_SLIDER_DEFAULTS[guide.valueKey]
  if (guide.valueKind === 'count') {
    if (guide.valueKey === 'customMaxAiCharacters') {
      return { customMaxAiCharacters: clampMaxAi(next, fallback) }
    }
    return {
      [guide.valueKey]: clampCount(next, guide.min, guide.max, fallback),
    } as Partial<UserMomentEngagementRulesSettings>
  }
  return {
    [guide.valueKey]: clampPercent(next, fallback),
  } as Partial<UserMomentEngagementRulesSettings>
}

function pickBandText(value: number, bands: ReadonlyArray<{ max: number; text: string }>): string {
  for (const band of bands) {
    if (value <= band.max) return band.text
  }
  return bands[bands.length - 1]?.text ?? ''
}

/** 单个滑块当前档位的人话说明（往左/往右会怎样） */
export function describeCustomSliderEffect(
  sliderId: CustomEngagementSliderId,
  value: number,
): string {
  const v = Number.isFinite(value) ? value : 0

  switch (sliderId) {
    case 'maxAiCharacters':
      return pickBandText(v, [
        { max: 4, text: '现在：单条圈最多只有极少数角色会动，非常克制。' },
        { max: 8, text: '现在：互动人数上限偏低，整体偏冷清。' },
        { max: 14, text: '现在：中等规模，可出现若干人点赞/评论。' },
        { max: 20, text: '现在：上限较高，更容易出现多人同时互动。' },
        { max: 30, text: '现在：接近上限，单条圈可能相当热闹甚至像小型评区。' },
      ])
    case 'closeParticipation':
      return pickBandText(v, [
        { max: 20, text: '现在：熟人很少进候选，恋人/闺蜜也可能经常不动。' },
        { max: 45, text: '现在：熟人参与偏克制；往右拖密友更常出现。' },
        { max: 70, text: '现在：熟人多半会认真考虑互动。' },
        { max: 100, text: '现在：熟人几乎都会进入候选，亲密圈很活跃。' },
      ])
    case 'participation':
      return pickBandText(v, [
        { max: 12, text: '现在：一般好友几乎不进候选，圈下多半只有极少数人会动。' },
        { max: 28, text: '现在：参与面偏窄，整体偏安静；往右拖会更常出现点赞/评论。' },
        { max: 45, text: '现在：中等参与，部分好友会根据内容决定要不要互动。' },
        { max: 65, text: '现在：参与面较广，更容易出现多人同时互动。' },
        { max: 100, text: '现在：大多数一般好友都会认真考虑互动，整体偏热闹。' },
      ])
    case 'distantParticipation':
      return pickBandText(v, [
        { max: 0, text: '现在：冷淡关系默认不参与，最克制。' },
        { max: 12, text: '现在：极少数冷淡关系可能破例动一下。' },
        { max: 28, text: '现在：少量冷淡关系会进入候选。' },
        { max: 100, text: '现在：冷淡关系也较常进入候选，整体偏闹。' },
      ])
    case 'fallbackLikeClose':
      return pickBandText(v, [
        { max: 20, text: '现在：熟人几乎不补赞，亲密好友也可能只围观。' },
        { max: 45, text: '现在：熟人补赞偏少。' },
        { max: 70, text: '现在：熟人较常会补赞。' },
        { max: 100, text: '现在：熟人几乎必补赞，很难看到亲密圈全静。' },
      ])
    case 'fallbackLike':
      return pickBandText(v, [
        { max: 15, text: '现在：几乎不补赞，AI 不互动就真的静悄悄。' },
        { max: 35, text: '现在：补赞很少，偶尔才会多出零星点赞。' },
        { max: 55, text: '现在：中等补赞，AI 失手时仍可能看到成片点赞。' },
        { max: 75, text: '现在：补赞偏积极，更容易凑出一排点赞。' },
        { max: 100, text: '现在：补赞很强，即使 AI 保守也常会有人点赞。' },
      ])
    case 'fallbackLikeMentioned':
      return pickBandText(v, [
        { max: 0, text: '现在：被 @ 也不会被系统补赞。' },
        { max: 20, text: '现在：被 @ 也可能完全无反应。' },
        { max: 50, text: '现在：被 @ 时有一半左右机会被补赞。' },
        { max: 100, text: '现在：被 @ 几乎一定会被补赞或互动。' },
      ])
    case 'viewedFootprint':
      return pickBandText(v, [
        { max: 25, text: '现在：「看过」记录很少，圈下观感较空；这不等于更冷清的赞评。' },
        { max: 50, text: '现在：少量围观痕迹；往右拖会有更多人留下浏览记录。' },
        { max: 75, text: '现在：中等围观感，未互动角色也常会显示看过。' },
        { max: 100, text: '现在：围观痕迹很多，像不少人都路过了你的圈。' },
      ])
    case 'maxLikeCount':
      return pickBandText(v, [
        { max: 4, text: '现在：点赞上限很低，圈下很克制。' },
        { max: 10, text: '现在：中等点赞规模。' },
        { max: 30, text: '现在：可出现很长一排点赞。' },
      ])
    case 'maxFirstComments':
      return pickBandText(v, [
        { max: 0, text: '现在：不允许首评，只有点赞/浏览。' },
        { max: 3, text: '现在：首评很少，评区偏静。' },
        { max: 8, text: '现在：中等评论量。' },
        { max: 20, text: '现在：首评很多，评区会较热闹。' },
      ])
    case 'maxThreadReplies':
      return pickBandText(v, [
        { max: 0, text: '现在：不生成角色互评接话，评区只有一级评论。' },
        { max: 2, text: '现在：偶尔有一两句接话。' },
        { max: 5, text: '现在：评区会有若干接话。' },
        { max: 10, text: '现在：接话较多，可能像小型讨论串。' },
      ])
    default:
      return ''
  }
}

function computeEngagementHeatVector(rules: ResolvedUserMomentEngagementRules): number[] {
  return [
    rules.normalAiSamplePercent,
    rules.fallbackLikePercentNormal,
    (rules.maxAiCharacters / 30) * 100,
    (rules.maxLikeCount / 18) * 100,
    (rules.maxFirstComments / 12) * 100,
    (rules.maxThreadReplies / 6) * 100,
  ]
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

function vectorDistance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/** 自定义档整体热度感受 + 与内置档位的接近程度 */
export function describeCustomEngagementHeat(
  settings: UserMomentEngagementRulesSettings,
): {
  tone: CustomEngagementHeatTone
  label: string
  description: string
  compareText: string
  viewedText: string
  heatPercent: number
} {
  const resolved = resolveUserMomentEngagementRules({
    ...settings,
    presetId: 'custom',
  })
  const vector = computeEngagementHeatVector(resolved)
  const heatPercent = Math.round(average(vector))

  const presetEntries = USER_MOMENT_ENGAGEMENT_PRESET_OPTIONS.filter(
    (p) => p.id !== 'custom',
  ) as Array<{ id: Exclude<UserMomentEngagementPresetId, 'custom'>; title: string }>

  let nearestTitle = '自然'
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const preset of presetEntries) {
    const presetRules = resolveUserMomentEngagementRules({
      ...DEFAULT_USER_MOMENT_ENGAGEMENT_RULES,
      presetId: preset.id,
    })
    const distance = vectorDistance(vector, computeEngagementHeatVector(presetRules))
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestTitle = preset.title
    }
  }

  let tone: CustomEngagementHeatTone
  let label: string
  let description: string

  if (heatPercent <= 22) {
    tone = 'quiet'
    label = '偏冷清'
    description = '赞评都很少，适合不想被刷屏时使用。'
  } else if (heatPercent <= 38) {
    tone = 'soft'
    label = '略安静'
    description = '偶尔有人点赞，评论不多，整体比较克制。'
  } else if (heatPercent <= 58) {
    tone = 'balanced'
    label = '接近自然'
    description = '熟人常会动，一般好友看内容决定，不算吵也不算冷。'
  } else if (heatPercent <= 76) {
    tone = 'lively'
    label = '偏热闹'
    description = '更容易出现多人点赞和短评，评区会有接话。'
  } else {
    tone = 'hot'
    label = '很热闹'
    description = '单条圈互动面很广，接近人气很旺的朋友圈。'
  }

  const viewedPercent = resolved.silentViewedPercent
  const viewedText =
    viewedPercent <= 30
      ? '围观感偏低：「看过」记录较少。'
      : viewedPercent <= 60
        ? '围观感适中：未互动者也可能留下少量浏览痕迹。'
        : '围观感偏高：即使不赞不评，也常能看到有人「看过」。'

  return {
    tone,
    label,
    description,
    compareText: `综合热度约 ${heatPercent}/100，整体接近内置档位「${nearestTitle}」。`,
    viewedText,
    heatPercent,
  }
}
