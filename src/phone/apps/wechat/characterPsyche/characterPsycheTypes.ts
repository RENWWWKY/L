/**
 * 角色体征与心理监视面板 — 数据字典
 * 数值域均为 0–100；relationshipDef 为自然语言关系侧写。
 */
export interface CharacterPsycheState {
  /** 对用户好感度（0–100） */
  affection: number
  /** 关系描述，如「若即若离的暧昧」 */
  relationshipDef: string

  // —— 分页 1: 情绪与心理 (EMOTIONAL DYNAMICS) ——
  /** 心情值 */
  mood: number
  /** 心动值 */
  heartbeat: number
  /** 安全感 */
  security: number
  /** 信任值 */
  trust: number
  /** 冷静值 */
  calmness: number

  // —— 分页 2: 危险与羁绊 (DARK TRAITS) ——
  /** 占有欲 */
  possessiveness: number
  /** 醋意值 */
  jealousy: number
  /** 厌恶值 */
  disgust: number
  /** 叛逆值 */
  rebellion: number

  // —— 分页 3: 生理体征 (VITAL SIGNS) ——
  /** 健康值 */
  health: number
  /** 饱腹值 */
  satiety: number
  /** 困倦值 */
  sleepiness: number
  /** 燥热值 */
  arousal: number

  /** 三页底部侧写总结（可由 AI 写入；缺省时客户端按数值生成） */
  summaries?: Partial<Record<CharacterPsychePageId, string>>
}

export type CharacterPsycheMetricKey = Exclude<
  keyof CharacterPsycheState,
  'relationshipDef' | 'summaries'
>

export type CharacterPsychePageId = 'emotion' | 'darkness' | 'vitals'

export type CharacterPsycheMetricDef = {
  key: CharacterPsycheMetricKey
  en: string
  zh: string
}

export type CharacterPsychePageDef = {
  id: CharacterPsychePageId
  tabIndex: string
  tabEn: string
  tabZh: string
  metrics: CharacterPsycheMetricDef[]
}

/** 三页翻页仪表盘配置 */
export const CHARACTER_PSYCHE_PAGES: CharacterPsychePageDef[] = [
  {
    id: 'emotion',
    tabIndex: '01',
    tabEn: 'EMOTION',
    tabZh: '情绪与心理',
    metrics: [
      { key: 'mood', en: 'MOOD', zh: '心情值' },
      { key: 'heartbeat', en: 'HEARTBEAT', zh: '心动值' },
      { key: 'security', en: 'SECURITY', zh: '安全感' },
      { key: 'trust', en: 'TRUST', zh: '信任值' },
      { key: 'calmness', en: 'CALMNESS', zh: '冷静值' },
    ],
  },
  {
    id: 'darkness',
    tabIndex: '02',
    tabEn: 'DARKNESS',
    tabZh: '危险与羁绊',
    metrics: [
      { key: 'possessiveness', en: 'POSSESS', zh: '占有欲' },
      { key: 'jealousy', en: 'JEALOUSY', zh: '醋意值' },
      { key: 'disgust', en: 'DISGUST', zh: '厌恶值' },
      { key: 'rebellion', en: 'REBELLION', zh: '叛逆值' },
    ],
  },
  {
    id: 'vitals',
    tabIndex: '03',
    tabEn: 'VITALS',
    tabZh: '生理体征',
    metrics: [
      { key: 'health', en: 'HEALTH', zh: '健康值' },
      { key: 'satiety', en: 'SATIETY', zh: '饱腹值' },
      { key: 'sleepiness', en: 'SLEEP', zh: '困倦值' },
      { key: 'arousal', en: 'AROUSAL', zh: '燥热值' },
    ],
  },
]

export type CharacterPsycheSnapshotRow = {
  conversationCharacterId: string
  playerIdentityId: string
  state: CharacterPsycheState
  /** 上一轮 AI 生成时的数值快照（用于对比箭头） */
  previousMetrics?: CharacterPsycheMetricsSnapshot | null
  updatedAt: number
}

/** 可对比的纯数值快照（不含 relationshipDef / summaries） */
export type CharacterPsycheMetricsSnapshot = Record<CharacterPsycheMetricKey, number>

export function extractCharacterPsycheMetrics(state: CharacterPsycheState): CharacterPsycheMetricsSnapshot {
  return {
    affection: clampPct(state.affection),
    mood: clampPct(state.mood),
    heartbeat: clampPct(state.heartbeat),
    security: clampPct(state.security),
    trust: clampPct(state.trust),
    calmness: clampPct(state.calmness),
    possessiveness: clampPct(state.possessiveness),
    jealousy: clampPct(state.jealousy),
    disgust: clampPct(state.disgust),
    rebellion: clampPct(state.rebellion),
    health: clampPct(state.health),
    satiety: clampPct(state.satiety),
    sleepiness: clampPct(state.sleepiness),
    arousal: clampPct(state.arousal),
  }
}

function normalizeMetricsSnapshot(input: unknown): CharacterPsycheMetricsSnapshot | null {
  if (!input || typeof input !== 'object') return null
  return extractCharacterPsycheMetrics(normalizeCharacterPsycheState(input))
}

/** 相对上一轮的变化量；无上一轮或差值为 0 时返回 null */
export function psycheMetricDelta(current: number, previous: number | undefined): number | null {
  if (previous === undefined || !Number.isFinite(previous)) return null
  const d = clampPct(current) - clampPct(previous)
  return d === 0 ? null : d
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** 根据好感度判定「目前关系」文案（与人脉关系表无关） */
export function relationshipDefFromAffection(affection: number): string {
  const a = clampPct(affection)
  if (a < 20) return '礼貌疏离，仍带防备'
  if (a < 40) return '偶有认可，保持距离'
  if (a < 60) return '轻微好感，若即若离'
  if (a < 80) return '显著在意，亲密尚需契机'
  return '心意渐明，关系更近一步'
}

export function applyAffectionDerivedRelationship(state: CharacterPsycheState): CharacterPsycheState {
  return {
    ...state,
    relationshipDef: relationshipDefFromAffection(state.affection),
  }
}

export function normalizeCharacterPsycheState(input: unknown, fallbackRel = '若即若离的试探'): CharacterPsycheState {
  const r = (input ?? {}) as Partial<CharacterPsycheState> & {
    summaries?: Partial<Record<CharacterPsychePageId, unknown>>
  }
  const summariesRaw = r.summaries
  const summaries =
    summariesRaw && typeof summariesRaw === 'object'
      ? {
          emotion: typeof summariesRaw.emotion === 'string' ? summariesRaw.emotion.trim() : undefined,
          darkness: typeof summariesRaw.darkness === 'string' ? summariesRaw.darkness.trim() : undefined,
          vitals: typeof summariesRaw.vitals === 'string' ? summariesRaw.vitals.trim() : undefined,
        }
      : undefined
  const out: CharacterPsycheState = {
    affection: clampPct(Number(r.affection)),
    relationshipDef: typeof r.relationshipDef === 'string' && r.relationshipDef.trim() ? r.relationshipDef.trim() : fallbackRel,
    mood: clampPct(Number(r.mood)),
    heartbeat: clampPct(Number(r.heartbeat)),
    security: clampPct(Number(r.security)),
    trust: clampPct(Number(r.trust)),
    calmness: clampPct(Number(r.calmness)),
    possessiveness: clampPct(Number(r.possessiveness)),
    jealousy: clampPct(Number(r.jealousy)),
    disgust: clampPct(Number(r.disgust)),
    rebellion: clampPct(Number(r.rebellion)),
    health: clampPct(Number(r.health)),
    satiety: clampPct(Number(r.satiety)),
    sleepiness: clampPct(Number(r.sleepiness)),
    arousal: clampPct(Number(r.arousal)),
    summaries,
  }
  return applyAffectionDerivedRelationship(out)
}

export function normalizeCharacterPsycheSnapshotRow(input: unknown): CharacterPsycheSnapshotRow | null {
  if (!input || typeof input !== 'object') return null
  const r = input as Partial<CharacterPsycheSnapshotRow> & { previousMetrics?: unknown }
  const cid = typeof r.conversationCharacterId === 'string' ? r.conversationCharacterId.trim() : ''
  const pid = typeof r.playerIdentityId === 'string' ? r.playerIdentityId.trim() : ''
  if (!cid || !pid) return null
  const previousMetrics = normalizeMetricsSnapshot(r.previousMetrics)
  return {
    conversationCharacterId: cid,
    playerIdentityId: pid,
    state: normalizeCharacterPsycheState(r.state),
    previousMetrics,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now(),
  }
}
