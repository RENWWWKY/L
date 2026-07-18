import type { WeChatImageMime, Gender } from './newFriendsPersona/types'
import { buildWeChatPrivateChatImageGenEnhancementBlock } from './wechatPrivateChatImageGenPrompt'

export type CharacterImageGenPromptScope = 'private_chat' | 'default'

/**
 * 解析角色 `[图片]` 行。
 * 现行协议：通俗中文画面描述（占位）；旧档可能仍是英文 tags。
 * `prompt` 与 `description` 同值，兼容旧调用。
 */
export function parseCharacterImageGenLine(line: string): { description: string; prompt: string } | null {
  const t = String(line ?? '')
    .trim()
    .replace(/^\uFEFF+/, '')
    .replace(/^[\u200B-\u200D\uFEFF]+/, '')
    .trim()
  const m = /^\[图片\]\s*(.+)$/.exec(t)
  if (!m) return null
  const description = m[1]!.trim()
  if (!description) return null
  return { description, prompt: description }
}

/** 是否更像旧版英文生图 tag（可直接当 prompt），而非给用户看的中文占位 */
export function looksLikeEnglishImageGenTags(text: string): boolean {
  const raw = String(text ?? '').trim()
  if (!raw) return false
  const body = raw.replace(/^\[wx-selfie\|[^\]]*\]\s*/i, '').trim()
  if (!body) return false
  const cjk = (body.match(/[\u4e00-\u9fff]/g) || []).length
  const asciiLetters = (body.match(/[a-zA-Z]/g) || []).length
  if (cjk >= 4 && cjk >= asciiLetters * 0.35) return false
  if (asciiLetters >= 24 && cjk <= 2) return true
  if (/,\s*[a-z]/i.test(body) && asciiLetters > Math.max(8, cjk * 3)) return true
  return false
}

function parseDataUrlParts(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  return { mime: m[1]!.trim(), base64: m[2]!.trim() }
}

function normalizeWeChatImageMime(mime: string): WeChatImageMime | null {
  const lower = mime.toLowerCase()
  if (lower === 'image/jpeg' || lower === 'image/jpg') return 'image/jpeg'
  if (lower === 'image/png') return 'image/png'
  if (lower === 'image/gif') return 'image/gif'
  if (lower === 'image/webp') return 'image/webp'
  return null
}

export function imageGenDataUrlToPayload(dataUrl: string): { base64: string; mime: WeChatImageMime } {
  const parsed = parseDataUrlParts(dataUrl)
  if (!parsed?.base64) {
    const hint = /^https?:\/\//i.test(dataUrl.trim())
      ? '生图返回外链但未转成 base64'
      : '生图结果不是有效的 data URL'
    throw new Error(`${hint}（invalid_image_data_url）`)
  }
  const mime = normalizeWeChatImageMime(parsed.mime) ?? 'image/png'
  if (parsed.base64.length < 64) throw new Error('image_payload_too_small')
  return { base64: parsed.base64, mime }
}

/** 从模型输出中移除 `[图片]` 行 */
export function stripCharacterImageGenLinesFromBubbles(bubbles: string[]): string[] {
  return bubbles
    .map((b) =>
      String(b ?? '')
        .split('\n')
        .filter((line) => !parseCharacterImageGenLine(line.trim()))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
}

/** 保留前 maxCount 条 `[图片]` 行，其余移除 */
export function limitCharacterImageGenLinesFromBubbles(bubbles: string[], maxCount: number): string[] {
  const cap = Math.max(0, Math.round(maxCount))
  if (cap <= 0) return stripCharacterImageGenLinesFromBubbles(bubbles)
  let used = 0
  return bubbles
    .map((b) => {
      const kept: string[] = []
      for (const line of String(b ?? '').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (parseCharacterImageGenLine(trimmed)) {
          if (used >= cap) continue
          used += 1
        }
        kept.push(line)
      }
      return kept.join('\n').trim()
    })
    .filter(Boolean)
}

export function buildCharacterImageGenPromptBlock(
  styleHint?: string,
  options?: {
    hasAppearanceReference?: boolean
    appearanceHint?: string
    scope?: CharacterImageGenPromptScope
    /** @deprecated 中文占位协议下不再注入英文构图 COT；保留兼容 */
    injectCompositionLifeFeelCot?: boolean
    /** @deprecated 已取消发图门槛；保留字段兼容旧调用 */
    imageRoundAllowed?: boolean
    /** 用户本轮明确要求发图 */
    userExplicitCharacterImageRequest?: boolean
    /** @deprecated 英文姿势库改在点生成时推演；保留兼容 */
    chatContextTail?: string
    characterGender?: Gender | null
    playerGender?: Gender | null
  },
): string {
  const userExplicit = options?.userExplicitCharacterImageRequest === true
  const styleName = styleHint?.trim() || '用户已配置'
  const privateChat = options?.scope === 'private_chat'
  const privateEnhancement = privateChat ? `\n\n${buildWeChatPrivateChatImageGenEnhancementBlock()}` : ''

  return `---------------------
【角色发送 AI 配图（已启用${privateChat ? ' · 私聊增强' : ''}${userExplicit ? ' · 用户要求' : ''}）】
---------------------
**默认纯文字回复**。可按场景语境**适量**发 \`[图片]\`（分享随手拍 / 晒物 / 展示场景 / 用户要看图等）；**禁止**每轮都发，**禁止**用配图替代道歉、解释、边界与严肃信息。

■ 双层说明（硬性）
- \`[图片]\` 行 = **给用户看的通俗中文画面描述**（占位）；客户端先展示这段文字，用户点确认后**另推**英文生图提示词。
- **禁止**在 \`[图片]\` 行写英文 SD tag / comma-separated tags / masterpiece / 8k；画风「${styleName}」由客户端自动拼接。

■ 输出格式（硬性）
- 单独占一行，且该行**只能**是：\`[图片]通俗中文画面描述\`
- 像跟人说话：谁在哪、干什么、拿着什么、自拍还是街拍；例：\`[图片]对镜自拍，一只手拿草莓牛奶，另一只手比耶\`
- 例（空镜）：\`[图片]雨后霓虹映在湿路面上，灰蒙蒙的散光\`
- 例（拍他人）：\`[图片]游艇甲板上穿黑泳衣的女孩坐着，身后碧蓝海水，大晴天\`
- 例（晒物）：\`[图片]桌上半杯咖啡，咖啡店内景，窗外灰蒙蒙\`
- 自拍/对镜用中文写明即可；默认半身，仅明确怼脸时才写脸部特写。
- **禁止**写 The character appearance 外貌块；外貌由客户端参考图处理。

■ 频率与场景（硬性）
- **大多数轮次 = 0 条 \`[图片]\`**；不要每轮都发，不要用图片刷屏替代正文。
- 仅在轻松、日常、**明确在分享/展示**时使用；争吵、冷战、正式通知、对方明显需要被认真对待时**必须纯文字**。
- 若当前不适合发图，**只输出文字行**，不要输出 \`[图片]\` 行；也**不要**写「发过去了」等假装已发。

■ 与表情包区分
- \`[表情包]引用名\` 仅用于**表情包库**资源；**实拍/场景/物品**类请用 \`[图片]描述\`，不要用表情包行冒充。

■ 禁止假发图（硬性）
- 凡口头写「发过去了」「拍好了」「传给你了」「给你发了」等，**同一轮回复中必须**有对应 \`[图片]\` 行；否则客户端**不会**出图。
- **没有** \`[图片]\` 行时，禁止写已发送/已拍好类措辞；应继续文字说明，或直接输出 \`[图片]\` 行。${privateEnhancement}`
}

/** 统计气泡中的 `[图片]` 行数（独立行或气泡内换行） */
export function countCharacterImageGenLinesInBubbles(bubbles: string[]): number {
  let n = 0
  for (const b of bubbles) {
    for (const line of String(b ?? '').split('\n')) {
      if (parseCharacterImageGenLine(line.trim())) n += 1
    }
  }
  return n
}

const CHARACTER_FAKE_SENT_IMAGE_RE =
  /(?:发过去了|发给你了|发给你啦|拍好了|传过去了|图发你了|照片发你了|给你发了|已发送|发你(?:了|啦)?)/u

/** 模型口头声称已发图，但输出中无 `[图片]` 行 */
export function characterOutputClaimsSentImageWithoutLine(bubbles: string[]): boolean {
  if (bubbles.some((b) => parseCharacterImageGenLine(String(b).trim()))) return false
  return bubbles.some((b) => {
    const t = String(b ?? '').trim()
    if (!t || /^\[表情包\]/.test(t)) return false
    return CHARACTER_FAKE_SENT_IMAGE_RE.test(t)
  })
}

export function buildCharacterImageFakeSendRetryBias(): string {
  return `[系统纠错] 你上一轮口头写了「发过去了/拍好了」等，但**缺少** \`[图片]通俗中文画面描述\` 行，客户端**不会**出图。
请立刻补发：单独占一行 \`[图片]…\`（与上一轮口头承诺一致的中文画面，如 \`[图片]卧室对镜自拍，半身，比耶\`），可保留原有文字气泡；**禁止**再次假装已发而无 \`[图片]\` 行；**禁止**写英文 SD tag。`
}

export function mergeCharacterImageRetryBubbles(original: string[], retry: string[]): string[] {
  const imageLines: string[] = []
  for (const b of retry) {
    for (const line of String(b ?? '').split('\n')) {
      const trimmed = line.trim()
      if (parseCharacterImageGenLine(trimmed)) imageLines.push(trimmed)
    }
  }
  if (!imageLines.length) return original

  const fakeIdx = original.findIndex((b) => {
    const t = String(b ?? '').trim()
    return t && !/^\[表情包\]/.test(t) && CHARACTER_FAKE_SENT_IMAGE_RE.test(t)
  })
  if (fakeIdx >= 0) {
    return [...original.slice(0, fakeIdx), ...imageLines, ...original.slice(fakeIdx)]
  }
  return [...imageLines, ...original]
}
