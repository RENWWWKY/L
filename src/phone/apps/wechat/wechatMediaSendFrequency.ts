/** 系统协议内建的语音每轮触发概率（见 wechatReplyOutputPrompt） */
export const VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT = 30
/** 聊天信息页未定制时，表情包 slider 的展示默认值（协议本身无固定百分比） */
export const STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT = 40
/** 聊天信息页未定制时，微信经典黄脸每轮触发概率 */
export const CLASSIC_EMOJI_DEFAULT_ROUND_TRIGGER_PERCENT = 0
/** @deprecated 使用 {@link CLASSIC_EMOJI_DEFAULT_ROUND_TRIGGER_PERCENT} */
export const CLASSIC_EMOJI_UI_DEFAULT_ROUND_TRIGGER_PERCENT = CLASSIC_EMOJI_DEFAULT_ROUND_TRIGGER_PERCENT
/** 聊天信息页未定制时，角色 AI 配图每轮触发概率的默认值 */
export const IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT = 0
/** 每次发图张数下限 / 上限 */
export const IMAGE_ROUND_COUNT_MIN_LIMIT = 1
export const IMAGE_ROUND_COUNT_MAX_LIMIT = 9
export const IMAGE_DEFAULT_ROUND_COUNT_MIN = 1
export const IMAGE_DEFAULT_ROUND_COUNT_MAX = 1

export type ImageRoundCountRange = { min: number; max: number }

export function clampRoundTriggerPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * 从 DB 读取：undefined = 未定制（语音走协议 30%，表情包走协议语境规则）。
 * 兼容旧版 default / low / never 字符串。
 */
export function parseStoredRoundTriggerPercent(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampRoundTriggerPercent(raw)
  }
  if (raw === 'never') return 0
  if (raw === 'low') return 8
  if (raw === 'default') return undefined
  return undefined
}

/** UI 展示用：未定制时语音 30%、表情包 40、黄脸 0、AI 配图 0 */
export function displayRoundTriggerPercent(
  stored: number | undefined,
  kind: 'voice' | 'sticker' | 'image' | 'classicEmoji',
): number {
  if (stored !== undefined) return stored
  if (kind === 'image') return IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT
  if (kind === 'voice') return VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT
  if (kind === 'classicEmoji') return CLASSIC_EMOJI_DEFAULT_ROUND_TRIGGER_PERCENT
  return STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT
}

/** 私聊黄脸：未存储定制值时默认 0% */
export function resolveEffectiveClassicEmojiRoundTriggerPercent(stored: number | undefined): number {
  return stored !== undefined ? clampRoundTriggerPercent(stored) : CLASSIC_EMOJI_DEFAULT_ROUND_TRIGGER_PERCENT
}

/** 私聊每轮是否允许出现经典黄脸 inline token */
export function rollClassicEmojiRoundTriggerAllowed(storedPercent: number | undefined): boolean {
  const effective = resolveEffectiveClassicEmojiRoundTriggerPercent(storedPercent)
  if (effective <= 0) return false
  if (effective >= 100) return true
  return Math.random() * 100 < effective
}

/** 客户端剥离文字行内经典黄脸（0% 或本轮骰子未命中时） */
export function shouldStripClassicEmojiTokensThisRound(
  roomType: 'private' | 'group',
  storedPercent: number | undefined,
  roundAllowed: boolean,
): boolean {
  if (roomType === 'group') return false
  if (resolveEffectiveClassicEmojiRoundTriggerPercent(storedPercent) <= 0) return true
  return !roundAllowed
}

export type StickerTargetedEntryMap = Record<string, number>

/** 规范化字符串列表（去重、去空）；空数组视为「未设置」 */
export function normalizeStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const s = String(item ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out.length ? out : undefined
}

/** 写入存储用：array 输入始终返回 string[]（可为 []，表示已清空） */
export function coerceStringListForStorage(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const s = String(item ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** 从 DB 读取：字段为 array 时返回 string[]（含 []）；否则 undefined = 从未设置 */
export function parseStoredStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return coerceStringListForStorage(raw) ?? []
}

/** 规范化定向 GIF 表情包条目：去空 key、概率 clamp 0–100；空对象视为「未设置」 */
export function normalizeStickerTargetedEntries(raw: unknown): StickerTargetedEntryMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: StickerTargetedEntryMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const ref = String(key ?? '').trim()
    if (!ref) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out[ref] = clampRoundTriggerPercent(value)
  }
  return Object.keys(out).length ? out : undefined
}

/** 写入存储用：object 输入始终返回 map（可为 {}，表示已清空） */
export function coerceStickerTargetedEntriesForStorage(raw: unknown): StickerTargetedEntryMap | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: StickerTargetedEntryMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const ref = String(key ?? '').trim()
    if (!ref) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out[ref] = clampRoundTriggerPercent(value)
  }
  return out
}

/** 从 DB 读取：字段为 object 时返回 map（含 {}）；否则 undefined = 从未设置 */
export function parseStoredStickerTargetedEntries(raw: unknown): StickerTargetedEntryMap | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return coerceStickerTargetedEntriesForStorage(raw) ?? {}
}

export function isStickerTargetedModeEnabled(raw: unknown): boolean {
  return raw === true
}

export function countStickerTargetedEntries(entries: StickerTargetedEntryMap | undefined): number {
  return entries ? Object.keys(entries).length : 0
}

export function countStickerTargetedGroups(groups: string[] | undefined): number {
  return groups?.length ?? 0
}

export function countStickerBannedRefs(refs: string[] | undefined): number {
  return refs?.length ?? 0
}

export function countClassicEmojiBannedNames(names: string[] | undefined): number {
  return names?.length ?? 0
}

/** 单条定向 GIF 的有效选用概率（未单独设置时用 UI 默认值） */
export function effectiveStickerTargetedPercent(
  ref: string,
  targeted: StickerTargetedEntryMap | undefined,
): number {
  const stored = targeted?.[ref]
  return stored !== undefined ? stored : STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT
}

/** 分组内可发表情的统一/混合概率展示 */
export function resolveStickerGroupTargetedPercent(
  refs: string[],
  bannedRefs: Set<string>,
  targeted: StickerTargetedEntryMap | undefined,
): { percent: number; mixed: boolean } {
  const allowed = refs.filter((r) => !bannedRefs.has(r))
  if (!allowed.length) {
    return { percent: STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT, mixed: false }
  }
  const percents = allowed.map((r) => effectiveStickerTargetedPercent(r, targeted))
  const first = percents[0]!
  const mixed = percents.some((p) => p !== first)
  if (!mixed) return { percent: first, mixed: false }
  const avg = Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length)
  return { percent: avg, mixed: true }
}

/** 批量设置分组内未禁止表情的选用概率 */
export function applyStickerGroupTargetedPercent(
  refs: string[],
  bannedRefs: Set<string>,
  targeted: StickerTargetedEntryMap | undefined,
  percent: number,
): StickerTargetedEntryMap {
  const next = { ...(targeted ?? {}) }
  const clamped = clampRoundTriggerPercent(percent)
  for (const ref of refs) {
    if (bannedRefs.has(ref)) continue
    next[ref] = clamped
  }
  return next
}

/** 旧版仅 ref 白名单时，从目录反推已勾选分组 */
export function inferStickerTargetedGroupsFromEntries(
  entries: StickerTargetedEntryMap | undefined,
  catalog: Array<{ ref: string; groupTag: string }>,
): string[] {
  if (!entries || !Object.keys(entries).length) return []
  const groups = new Set<string>()
  for (const ref of Object.keys(entries)) {
    const hit = catalog.find((e) => e.ref === ref)
    if (hit?.groupTag) groups.add(hit.groupTag)
  }
  return [...groups]
}

export function isStickerRefAllowedInSession(
  ref: string,
  groupTag: string | undefined,
  targetedModeEnabled: boolean | undefined,
  enabledGroups: string[] | undefined,
  targetedEntries: StickerTargetedEntryMap | undefined,
  bannedRefs: string[] | undefined,
): boolean {
  const normalizedRef = String(ref ?? '').trim()
  if (!normalizedRef) return false
  const banned = new Set((bannedRefs ?? []).map((r) => r.trim()).filter(Boolean))
  if (banned.has(normalizedRef)) return false

  if (!targetedModeEnabled) return true

  const groups = enabledGroups ?? []
  const entries = targetedEntries ?? {}
  const entryPct = entries[normalizedRef]
  if (entryPct === 0) return false

  if (groups.length > 0) {
    const tag = String(groupTag ?? '').trim()
    if (!tag || !groups.includes(tag)) return false
    if (typeof entryPct === 'number') return entryPct > 0
    return true
  }

  if (normalizedRef in entries) return entries[normalizedRef]! > 0
  return false
}

export function isClassicEmojiNameAllowed(name: string, bannedNames: string[] | undefined): boolean {
  const n = String(name ?? '').trim()
  if (!n) return false
  const banned = new Set((bannedNames ?? []).map((x) => x.trim()).filter(Boolean))
  return !banned.has(n)
}

/** 从角色文字气泡中移除本会话禁止的经典黄脸 token */
export function stripBannedClassicEmojiTokens(text: string, bannedNames: string[] | undefined): string {
  if (!bannedNames?.length || !text) return text
  const banned = new Set(bannedNames.map((x) => x.trim()).filter(Boolean))
  if (!banned.size) return text
  return text.replace(/\[([^\[\]\n]{1,24})\]/g, (full, name: string) => {
    if (banned.has(String(name).trim())) return ''
    return full
  })
}

export function buildStickerTargetedRulesPromptBlock(
  targetedModeEnabled: boolean | undefined,
  enabledGroups: string[] | undefined,
  targetedEntries: StickerTargetedEntryMap | undefined,
  bannedRefs: string[] | undefined,
): string {
  if (!targetedModeEnabled) {
    const banned = (bannedRefs ?? []).filter(Boolean)
    if (!banned.length) return ''
    return `---------------------
【GIF 表情包 · 永久禁止（本会话）】
---------------------
下列引用名**永久禁止**输出（即使用户发表情包也不要回发这些）：
${banned.map((ref) => `- \`[表情包]${ref}\``).join('\n')}
`
  }

  const groups = enabledGroups ?? []
  const entries = targetedEntries ?? {}
  const banned = (bannedRefs ?? []).filter(Boolean)

  if (!groups.length && !Object.keys(entries).length) {
    return `---------------------
【定向 GIF 表情包（本会话）】
---------------------
用户在「聊天信息 → 表情包发送概率 → 定向 GIF」中已开启限制，但**未勾选任何分组**。
本轮 **禁止** 输出任何 \`[表情包]\` 行；仅可用文字与微信经典黄脸（若未另行禁止）。
`
  }

  const lines: string[] = [
    '---------------------',
    '【定向 GIF 表情包（本会话）】',
    '---------------------',
    '用户在聊天信息中已勾选允许的分组；**禁止** 使用未勾选分组内的引用名。',
  ]

  if (groups.length) {
    lines.push(`**已勾选分组**：${groups.join('、')}`)
  }

  const entryLines = Object.keys(entries)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((ref) => {
      const pct = entries[ref]!
      if (pct <= 0) return `- \`[表情包]${ref}\` — **禁止**（概率 0%）`
      if (pct >= 100) return `- \`[表情包]${ref}\` — 允许（概率 100%，贴脸时优先）`
      return `- \`[表情包]${ref}\` — 允许（选用概率约 ${pct}%）`
    })
  if (entryLines.length) {
    lines.push('**条目选用概率（在该轮已允许发 GIF 时生效）**：')
    lines.push(...entryLines)
  }

  if (banned.length) {
    lines.push('**下列引用名永久禁止（即使分组已勾选也不发）**：')
    lines.push(...banned.map((ref) => `- \`[表情包]${ref}\``))
  }

  lines.push('贴脸优先；无合适条目则只发文字。')
  return `${lines.join('\n')}\n`
}

export function buildClassicEmojiBanPromptBlock(bannedNames: string[] | undefined): string {
  const banned = (bannedNames ?? []).map((x) => x.trim()).filter(Boolean)
  if (!banned.length) return ''
  return `---------------------
【微信经典黄脸 · 永久禁止（本会话）】
---------------------
用户在聊天信息中已禁止下列经典黄脸；**不要**在文字行内写对应 token：
${banned.map((name) => `- \`[${name}]\``).join('\n')}
`
}

/** AI 配图：未存储时视为 0% */
export function resolveEffectiveImageRoundTriggerPercent(stored: number | undefined): number {
  return stored !== undefined ? clampRoundTriggerPercent(stored) : IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT
}

export function clampImageRoundCount(n: number): number {
  return Math.max(IMAGE_ROUND_COUNT_MIN_LIMIT, Math.min(IMAGE_ROUND_COUNT_MAX_LIMIT, Math.round(n)))
}

export function parseStoredImageRoundCountRange(
  minRaw: unknown,
  maxRaw: unknown,
): ImageRoundCountRange {
  const hasMin = typeof minRaw === 'number' && Number.isFinite(minRaw)
  const hasMax = typeof maxRaw === 'number' && Number.isFinite(maxRaw)
  let min = hasMin ? clampImageRoundCount(minRaw) : IMAGE_DEFAULT_ROUND_COUNT_MIN
  let max = hasMax ? clampImageRoundCount(maxRaw) : IMAGE_DEFAULT_ROUND_COUNT_MAX
  if (min > max) {
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    min = lo
    max = hi
  }
  return { min, max }
}

export function isImageRoundCountRangeCustomized(minRaw: unknown, maxRaw: unknown): boolean {
  return (
    (typeof minRaw === 'number' && Number.isFinite(minRaw)) ||
    (typeof maxRaw === 'number' && Number.isFinite(maxRaw))
  )
}

/** 本轮允许发图时，在 [min,max] 内随机抽目标张数 */
export function drawRoundImageCount(range: ImageRoundCountRange): number {
  if (range.min >= range.max) return range.min
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1))
}

export function formatImageRoundCountRangeLabel(range: ImageRoundCountRange): string {
  if (range.min === range.max) return `${range.min} 张`
  return `${range.min}～${range.max} 张`
}

function buildImageRoundCountPromptLine(range: ImageRoundCountRange, target?: number): string {
  const rangeLabel = formatImageRoundCountRangeLabel(range)
  if (typeof target === 'number' && target > 0) {
    return `- **AI 配图张数（仅当本轮确实要发图时）**：上限 **${rangeLabel}**（每条 \`[图片]\` 行 = 1 张）；若本轮决定发图，请输出 **${target}** 条 \`[图片]\` 行，不要超过 ${range.max} 条；若语境不适合发图则 **0 条**。`
  }
  return `- **AI 配图张数（仅当本轮确实要发图时）**：上限 **${rangeLabel}**（每条 \`[图片]\` 行 = 1 张）；不要超过 ${range.max} 条；不适合发图则 **0 条**。`
}

export function isRoundTriggerCustomized(stored: number | undefined): boolean {
  return stored !== undefined
}

/** 每轮回复请求前掷骰结果（注入 prompt + 客户端拦截共用） */
export type RoundMediaTriggerDecisions = {
  stickerAllowed?: boolean
  voiceAllowed?: boolean
  classicEmojiAllowed?: boolean
  imageAllowed?: boolean
}

/** 本会话已定制 GIF / 语音 / 黄脸概率时：每轮回复前各掷一次骰 */
export function rollRoundMediaTriggerDecisions(params: {
  stickerRoundTriggerPercent?: number
  voiceRoundTriggerPercent?: number
  classicEmojiRoundTriggerPercent?: number
}): Pick<RoundMediaTriggerDecisions, 'stickerAllowed' | 'voiceAllowed' | 'classicEmojiAllowed'> {
  return {
    stickerAllowed: rollRoundMediaTriggerAllowed(params.stickerRoundTriggerPercent),
    voiceAllowed: rollRoundMediaTriggerAllowed(params.voiceRoundTriggerPercent),
    classicEmojiAllowed: rollClassicEmojiRoundTriggerAllowed(params.classicEmojiRoundTriggerPercent),
  }
}

/** 本会话已定制概率时：按百分比决定本轮回复是否允许出现语音/表情包（非条数上限） */
export function rollRoundMediaTriggerAllowed(storedPercent: number | undefined): boolean {
  if (storedPercent === undefined) return true
  if (storedPercent <= 0) return false
  if (storedPercent >= 100) return true
  return Math.random() * 100 < storedPercent
}

/** AI 配图：未定制时默认 0%；用户明确要求发图时由调用方 bypass，勿用本函数 */
export function rollImageRoundTriggerAllowed(storedPercent: number | undefined): boolean {
  const percent = resolveEffectiveImageRoundTriggerPercent(storedPercent)
  if (percent <= 0) return false
  if (percent >= 100) return true
  return Math.random() * 100 < percent
}

/**
 * 模型已输出 `[图片]` 行时，是否放行并真实生图（可绕过本轮概率骰子未命中）。
 * - 用户本轮明确要求发图 → 始终放行；
 * - 发图概率 > 0 → 模型既已输出则放行；
 * - 发图概率 = 0 且非用户要求 → 不放行，后处理会剔除。
 */
export function shouldHonorModelCharacterImageLinesDespiteProbability(
  imageRoundTriggerPercent: number | undefined,
  userExplicitRequest: boolean,
): boolean {
  if (userExplicitRequest) return true
  return resolveEffectiveImageRoundTriggerPercent(imageRoundTriggerPercent) > 0
}

const STICKER_CATALOG_SUPPRESSED_BY_USER = `---------------------
【表情包资源】
---------------------
当前会话在「聊天信息」中已设为 **不发表情包**（含 \`[表情包]引用名\` 独立行）。
请忽略系统其它位置若出现的「可选用表情包」说明；本轮仅用**纯文字**气泡回复，**不要**输出以 \`[表情包]\` 开头的行。
用户若发来表情包图片，可按情境接话，但你方**不要回发**表情包行。
`

export function buildMediaSendFrequencyPromptBlock(params: {
  stickerRoundTriggerPercent?: number
  voiceRoundTriggerPercent?: number
  classicEmojiRoundTriggerPercent?: number
  /** 私聊：未存储黄脸概率时仍注入默认 0% 规则 */
  applyClassicEmojiDefault?: boolean
  /** 已启用角色 AI 配图时注入 */
  imageRoundTriggerPercent?: number
  imageRoundCountMin?: number
  imageRoundCountMax?: number
  /** 本轮已抽中的目标张数（仅当允许发图时传入） */
  imageRoundCountTarget?: number
  userExplicitCharacterImageRequest?: boolean
  /** 私聊：本轮概率骰是否命中；群聊不传（无逐轮门槛） */
  imageRoundAllowed?: boolean
}): string {
  const sticker = params.stickerRoundTriggerPercent
  const voice = params.voiceRoundTriggerPercent
  const classicEmoji =
    params.classicEmojiRoundTriggerPercent !== undefined
      ? clampRoundTriggerPercent(params.classicEmojiRoundTriggerPercent)
      : params.applyClassicEmojiDefault
        ? CLASSIC_EMOJI_DEFAULT_ROUND_TRIGGER_PERCENT
        : undefined
  const imagePercent =
    params.imageRoundTriggerPercent !== undefined
      ? resolveEffectiveImageRoundTriggerPercent(params.imageRoundTriggerPercent)
      : undefined
  const hasImageSection = imagePercent !== undefined
  const imageCountRange = hasImageSection
    ? parseStoredImageRoundCountRange(params.imageRoundCountMin, params.imageRoundCountMax)
    : null
  if (sticker === undefined && voice === undefined && classicEmoji === undefined && !hasImageSection) return ''

  const lines: string[] = [
    '---------------------',
    '【本会话发送概率（用户在聊天信息中设定 · 优先于上文通用频率）】',
    '「每轮」指你方每一次完整回复。下列百分比表示：**该轮回复里会不会出现**对应类型消息（门槛概率，不是条数上限）。',
    '一旦该轮「允许/应发」某类型，同一轮内可发**多条**（如多行 `[语音]` 与文字穿插），仍须贴合语境，禁止机械刷屏。',
  ]

  if (sticker !== undefined) {
    if (sticker <= 0) {
      lines.push(
        '- **表情包**：概率 **0%**，**禁止**输出任何以 `[表情包]` 开头的行；即使用户发表情包，也只用文字接话。',
      )
    } else if (sticker >= 100) {
      lines.push(
        '- **表情包**：概率 **100%**，每轮回复**宜**包含至少 1 条 `[表情包]` 行——**仍须**在目录中找到**贴脸**条目；若无合适表情则**只发文字**，禁止乱选凑数。',
      )
    } else {
      lines.push(
        `- **表情包**：每轮约 **${sticker}%** 概率包含至少 1 条 \`[表情包]\` 行（其余轮次 **0 条**）；约 **${100 - sticker}%** 轮次不发。**即使该轮「允许发」**，也须贴脸才发；无合适条目则只文字，禁止乱选。`,
      )
    }
  }

  if (voice !== undefined) {
    if (voice <= 0) {
      lines.push(
        '- **语音消息**：概率 **0%**，**禁止**输出任何以 `[语音]` 开头的行；即使用户发语音或要求「用语音说」，也改用**文字**回复。',
      )
    } else if (voice >= 100) {
      lines.push(
        '- **语音消息**：概率 **100%**，该轮回复**须**包含语音（至少 1 行 `[语音]`）；**可多条** `[语音]` 与文字穿插混排，勿机械刷屏。',
      )
    } else {
      lines.push(
        `- **语音消息**：约 **${voice}%** 的回复轮次会出现语音（至少 1 行 \`[语音]\`）；约 **${100 - voice}%** 轮次纯文字。一旦该轮发语音，**可多条** \`[语音]\` 与文字交替，不限 1 条。用户明确要求信息点时仍优先文字承载关键信息。`,
      )
    }
  }

  if (classicEmoji !== undefined) {
    if (classicEmoji <= 0) {
      lines.push(
        '- **微信经典黄脸**：概率 **0%**，**禁止**在文字行内写 `[呲牙]` `[OK]` 等经典黄脸 token；本轮仅用纯文字（仍可发 GIF `[表情包]` 行，若上文允许）。',
      )
    } else if (classicEmoji >= 100) {
      lines.push(
        '- **微信经典黄脸**：概率 **100%**，每轮回复**宜**在至少一行文字内含 1 个经典黄脸 token（混排或单独一行均可）；仍须贴脸，严肃场景可纯文字。',
      )
    } else {
      lines.push(
        `- **微信经典黄脸**：每轮约 **${classicEmoji}%** 概率在回复中出现经典黄脸 inline token（约 **${100 - classicEmoji}%** 轮次不写）；一旦写则仍须贴脸，勿机械刷屏。`,
      )
    }
  }

  if (imagePercent !== undefined && imageCountRange) {
    if (params.userExplicitCharacterImageRequest) {
      lines.push(
        '- **AI 配图（\`[图片]\` 行）**：用户本轮**已明确要求**发图/照片/自拍——**完全无视**本会话发图概率设置；本轮**须**至少输出 1 条 \`[图片]\` 行（仍须贴合语境；确实不宜发图时只用文字婉拒，**禁止**口头假装已发）。',
      )
      lines.push(buildImageRoundCountPromptLine(imageCountRange, params.imageRoundCountTarget))
    } else if (imagePercent <= 0) {
      lines.push(
        `- **AI 配图（\`[图片]\` 行）**：概率 **0%**，本轮**禁止**输出任何 \`[图片]\` 行；**唯一例外**：用户本轮**直接要求**你发图/照片/自拍时，须按张数规则发图。不要自发、不要顺带、不要「顺手」发图。`,
      )
    } else if (params.imageRoundAllowed === false) {
      lines.push(
        `- **AI 配图（\`[图片]\` 行）**：会话发图概率 **${imagePercent}%**，**本轮未命中**——**禁止**输出任何 \`[图片]\` 行。仅用**纯文字**回复；不要分享随手拍、不要晒物、不要配图烘托气氛。用户**直接要求**发图时不受此限制。`,
      )
    } else if (params.imageRoundAllowed === true) {
      if (imagePercent >= 100) {
        lines.push(
          '- **AI 配图（\`[图片]\` 行）**：概率 **100%**，本轮**允许**发图——**仍须**有分享/展示类语境才输出 \`[图片]\` 行；纯文字聊天、问答、安慰、斗嘴、解释、承诺等**禁止**配图；无合适画面则只发文字。',
        )
      } else {
        lines.push(
          `- **AI 配图（\`[图片]\` 行）**：会话发图概率 **${imagePercent}%**，**本轮已命中允许**——**可以**发图，但**绝大多数轮次仍应纯文字**；仅当对话里确实在分享照片、晒物、展示场景、或视觉内容本身就是回复重点时，才输出 \`[图片]\` 行。情绪安慰、争吵和解、日常问答、纯闲聊**不要**配图。`,
        )
      }
      lines.push(buildImageRoundCountPromptLine(imageCountRange, params.imageRoundCountTarget))
    } else if (imagePercent >= 100) {
      lines.push(
        '- **AI 配图（\`[图片]\` 行）**：概率 **100%**，每轮回复**宜**在确有分享/展示语境时包含 \`[图片]\` 行；无合适画面则只发文字，禁止无意义刷屏。',
      )
      lines.push(buildImageRoundCountPromptLine(imageCountRange, params.imageRoundCountTarget))
    } else {
      lines.push(
        `- **AI 配图（\`[图片]\` 行）**：会话发图概率约 **${imagePercent}%**（非每轮必发）。**默认纯文字**；仅在有分享/展示类语境或用户直接要求时才考虑 \`[图片]\` 行。`,
      )
      lines.push(buildImageRoundCountPromptLine(imageCountRange, params.imageRoundCountTarget))
    }
  }

  return `${lines.join('\n')}\n`
}

export function resolveStickerCatalogPromptBlockForSession(
  loreForbidsSticker: boolean,
  stickerRoundTriggerPercent: number | undefined,
  buildCatalog: () => string,
  stickerTargetedModeEnabled?: boolean,
  enabledGroups?: string[],
  targetedEntries?: StickerTargetedEntryMap,
  bannedRefs?: string[],
): string {
  if (stickerRoundTriggerPercent !== undefined && stickerRoundTriggerPercent <= 0) {
    return STICKER_CATALOG_SUPPRESSED_BY_USER
  }
  if (
    stickerTargetedModeEnabled &&
    !(enabledGroups?.length ?? 0) &&
    !countStickerTargetedEntries(targetedEntries)
  ) {
    return `---------------------
【表情包资源】
---------------------
当前会话在「聊天信息 → 表情包发送概率 → 定向 GIF」中已开启限制，但**未勾选任何分组**。
请忽略其它位置的 GIF 表情包目录；本轮 **禁止** 输出 \`[表情包]\` 行。
`
  }
  if (loreForbidsSticker) {
    return `---------------------
【表情包资源】
---------------------
当前会话的「档案与世界书」已声明 **禁止发送表情包**（含客户端单独成行的 \`[表情包]引用名\`）。
请忽略系统其它位置若出现的「可选用表情包」说明；本轮仅用**纯文字**气泡回复，**不要**输出以 \`[表情包]\` 开头的行。
用户若发来表情包图片，可按情境接话，但你方**不要回发**表情包行。
`
  }
  const catalog = buildCatalog()
  const targetedBlock = buildStickerTargetedRulesPromptBlock(
    stickerTargetedModeEnabled,
    enabledGroups,
    targetedEntries,
    bannedRefs,
  )
  return targetedBlock ? `${catalog}\n\n${targetedBlock}` : catalog
}

/**
 * 客户端拦截表情包气泡：仅当会话设为 0%（完全禁止）时丢弃。
 * 大于 0% 时概率只写入提示词引导模型，**不在模型已输出 `[表情包]` 行后再掷骰静默丢弃**（否则控制台有解析、界面无气泡）。
 */
export function shouldSuppressCharacterStickerLine(
  roomType: 'private' | 'group',
  stickerRoundTriggerPercent: number | undefined,
  _roundAllowed?: boolean,
  userExplicitStickerRequest = false,
  stickerTargetedModeEnabled?: boolean,
  enabledGroups?: string[],
  targetedEntries?: StickerTargetedEntryMap,
  bannedRefs?: string[],
  stickerRef?: string,
  stickerGroupTag?: string,
): boolean {
  if (userExplicitStickerRequest) return false
  if (roomType !== 'private') return false
  if (stickerRoundTriggerPercent !== undefined && stickerRoundTriggerPercent <= 0) return true
  const ref = String(stickerRef ?? '').trim()
  if (!ref) return true
  return !isStickerRefAllowedInSession(
    ref,
    stickerGroupTag,
    stickerTargetedModeEnabled,
    enabledGroups,
    targetedEntries,
    bannedRefs,
  )
}

export function shouldSuppressCharacterVoiceLine(
  roomType: 'private' | 'group',
  voiceRoundTriggerPercent: number | undefined,
  roundAllowed: boolean,
): boolean {
  if (roomType !== 'private' || voiceRoundTriggerPercent === undefined) return false
  if (voiceRoundTriggerPercent <= 0) return true
  return !roundAllowed
}

export function shouldSuppressCharacterImageLine(
  roomType: 'private' | 'group',
  imageRoundTriggerPercent: number | undefined,
  roundAllowed: boolean,
  userExplicitRequest: boolean,
  emittedCount: number,
  imageCountMinRaw: unknown,
  imageCountMaxRaw: unknown,
  imageCountTarget?: number,
): boolean {
  if (roomType !== 'private') return true
  const range = parseStoredImageRoundCountRange(imageCountMinRaw, imageCountMaxRaw)
  const cap =
    typeof imageCountTarget === 'number' && imageCountTarget > 0
      ? Math.min(range.max, imageCountTarget)
      : range.max
  if (emittedCount >= cap) return true
  if (userExplicitRequest || roundAllowed) return false
  const percent = resolveEffectiveImageRoundTriggerPercent(imageRoundTriggerPercent)
  if (percent <= 0) return true
  return !roundAllowed
}

const IMAGE_GEN_QUOTA_COOLDOWN_MS = 120_000

let imageGenQuotaBlockedUntilMs = 0

/** 429 / 额度用尽 / 频率限制：命中后短时不再请求生图 API，避免连续打穿中转站 */
export function markImageGenQuotaOrRateLimitBlocked(
  err?: unknown,
  cooldownMs = IMAGE_GEN_QUOTA_COOLDOWN_MS,
): void {
  if (err !== undefined && !isImageGenThrottleOrQuotaError(err)) return
  imageGenQuotaBlockedUntilMs = Date.now() + cooldownMs
}

export function isImageGenQuotaOrRateLimitBlocked(): boolean {
  return Date.now() < imageGenQuotaBlockedUntilMs
}

export function isImageGenThrottleOrQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /429|过于频繁|rate limit|too many requests|throttl|no available image quota|no available.*quota|image quota|quota exceeded|exceeded.*quota|额度|配额|用量超限/i.test(
    msg,
  )
}

export function isImageGenRateLimitError(err: unknown): boolean {
  return isImageGenThrottleOrQuotaError(err)
}
