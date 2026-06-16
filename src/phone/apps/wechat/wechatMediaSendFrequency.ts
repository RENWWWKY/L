/** 系统协议内建的语音每轮触发概率（见 wechatReplyOutputPrompt） */
export const VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT = 30
/** 聊天信息页未定制时，表情包 slider 的展示默认值（协议本身无固定百分比） */
export const STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT = 40
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

/** UI 展示用：未定制时语音 30%、表情包 40、AI 配图 0 */
export function displayRoundTriggerPercent(
  stored: number | undefined,
  kind: 'voice' | 'sticker' | 'image',
): number {
  if (stored !== undefined) return stored
  if (kind === 'image') return IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT
  return kind === 'voice' ? VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT : STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT
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
    return `- **AI 配图张数**：每次发图 **${rangeLabel}**（每条 \`[图片]\` 行 = 1 张）；**本轮目标 ${target} 张**，请输出恰好 ${target} 条 \`[图片]\` 行，不要超过 ${range.max} 条。`
  }
  return `- **AI 配图张数**：每次发图 **${rangeLabel}**（每条 \`[图片]\` 行 = 1 张）；不要超过 ${range.max} 条。`
}

export function isRoundTriggerCustomized(stored: number | undefined): boolean {
  return stored !== undefined
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
  /** 已启用角色 AI 配图时注入 */
  imageRoundTriggerPercent?: number
  imageRoundCountMin?: number
  imageRoundCountMax?: number
  /** 本轮已抽中的目标张数（仅当允许发图时传入） */
  imageRoundCountTarget?: number
  userExplicitCharacterImageRequest?: boolean
}): string {
  const sticker = params.stickerRoundTriggerPercent
  const voice = params.voiceRoundTriggerPercent
  const imagePercent =
    params.imageRoundTriggerPercent !== undefined
      ? resolveEffectiveImageRoundTriggerPercent(params.imageRoundTriggerPercent)
      : undefined
  const hasImageSection = imagePercent !== undefined
  const imageCountRange = hasImageSection
    ? parseStoredImageRoundCountRange(params.imageRoundCountMin, params.imageRoundCountMax)
    : null
  if (sticker === undefined && voice === undefined && !hasImageSection) return ''

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
        '- **表情包**：概率 **100%**，每轮回复**须**包含至少 1 条 `[表情包]` 行（仍须贴合语境，禁止无意义刷屏）。',
      )
    } else {
      lines.push(
        `- **表情包**：每轮约 **${sticker}%** 概率包含至少 1 条 \`[表情包]\` 行（其余轮次 **0 条**）；约 **${100 - sticker}%** 轮次不发。仍须贴合语境，禁止用表情包替代道歉/严肃信息。`,
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

  if (imagePercent !== undefined && imageCountRange) {
    if (params.userExplicitCharacterImageRequest) {
      lines.push(
        '- **AI 配图（\`[图片]\` 行）**：用户本轮**已明确要求**你发图——若你愿意可输出 \`[图片]\` 行，**不受**下列概率限制；不愿则只文字婉拒。',
      )
    }
    if (imagePercent <= 0) {
      lines.push(
        `- **AI 配图（\`[图片]\` 行）**：概率 **0%**，**禁止**输出任何 \`[图片]\` 行；**例外**：用户本轮**直接要求**你发图/照片/自拍时，若你愿意可按张数规则发图。`,
      )
    } else if (imagePercent >= 100) {
      lines.push(
        '- **AI 配图（\`[图片]\` 行）**：概率 **100%**，每轮回复**须**包含至少 1 条 \`[图片]\` 行（仍须贴合语境，禁止无意义刷屏）。',
      )
    } else {
      lines.push(
        `- **AI 配图（\`[图片]\` 行）**：每轮约 **${imagePercent}%** 概率包含至少 1 条 \`[图片]\` 行；约 **${100 - imagePercent}%** 轮次不发。用户**直接要求**发图时不受此概率限制。`,
      )
    }
    lines.push(buildImageRoundCountPromptLine(imageCountRange, params.imageRoundCountTarget))
  }

  return `${lines.join('\n')}\n`
}

export function resolveStickerCatalogPromptBlockForSession(
  loreForbidsSticker: boolean,
  stickerRoundTriggerPercent: number | undefined,
  buildCatalog: () => string,
): string {
  if (stickerRoundTriggerPercent !== undefined && stickerRoundTriggerPercent <= 0) {
    return STICKER_CATALOG_SUPPRESSED_BY_USER
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
  return buildCatalog()
}

export function shouldSuppressCharacterStickerLine(
  roomType: 'private' | 'group',
  stickerRoundTriggerPercent: number | undefined,
  roundAllowed: boolean,
): boolean {
  if (roomType !== 'private' || stickerRoundTriggerPercent === undefined) return false
  if (stickerRoundTriggerPercent <= 0) return true
  return !roundAllowed
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
): boolean {
  if (roomType !== 'private') return true
  const range = parseStoredImageRoundCountRange(imageCountMinRaw, imageCountMaxRaw)
  if (emittedCount >= range.max) return true
  if (userExplicitRequest) return false
  const percent = resolveEffectiveImageRoundTriggerPercent(imageRoundTriggerPercent)
  if (percent <= 0) return true
  return !roundAllowed
}
