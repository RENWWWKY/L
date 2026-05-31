/** 系统协议内建的语音每轮触发概率（见 wechatReplyOutputPrompt） */
export const VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT = 30
/** 聊天信息页未定制时，表情包 slider 的展示默认值（协议本身无固定百分比） */
export const STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT = 40

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

/** UI 展示用：未定制时语音 30%、表情包 40 */
export function displayRoundTriggerPercent(stored: number | undefined, kind: 'voice' | 'sticker'): number {
  if (stored !== undefined) return stored
  return kind === 'voice' ? VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT : STICKER_UI_DEFAULT_ROUND_TRIGGER_PERCENT
}

export function isRoundTriggerCustomized(stored: number | undefined): boolean {
  return stored !== undefined
}

/** 本会话已定制概率时：按百分比决定本轮是否允许至少一条语音/表情包 */
export function rollRoundMediaTriggerAllowed(storedPercent: number | undefined): boolean {
  if (storedPercent === undefined) return true
  if (storedPercent <= 0) return false
  if (storedPercent >= 100) return true
  return Math.random() * 100 < storedPercent
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
}): string {
  const sticker = params.stickerRoundTriggerPercent
  const voice = params.voiceRoundTriggerPercent
  if (sticker === undefined && voice === undefined) return ''

  const lines: string[] = [
    '---------------------',
    '【本会话发送概率（用户在聊天信息中设定 · 优先于上文通用频率）】',
    '「每轮」指你方每一次完整回复；下列百分比表示该轮回复中**至少出现 1 条**对应类型消息的目标概率。',
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
        '- **语音消息**：概率 **100%**，每轮回复**须**包含至少 1 条 `[语音]` 行（可多条但勿机械刷屏）。',
      )
    } else {
      lines.push(
        `- **语音消息**：每轮约 **${voice}%** 概率包含至少 1 条 \`[语音]\` 行；约 **${100 - voice}%** 轮次只用文字。用户明确要求信息点时仍优先文字承载关键信息。`,
      )
    }
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
