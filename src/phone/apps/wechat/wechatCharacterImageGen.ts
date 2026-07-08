import type { WeChatImageMime } from './newFriendsPersona/types'
import { buildImageGenCompositionLifeFeelCotBlock } from '../../../components/moments/imageGenCompositionLifeFeelCot'
import { buildChatSelfieImageGenRule, IMAGE_PROMPT_CONCRETE_VISUAL_RULE, IMAGE_PROMPT_ENGLISH_ONLY_RULE, IMAGE_PROMPT_LIGHTING_CONTEXT_RULE, IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE } from '../../../components/moments/momentCharacterImageRules'
import { buildWeChatPrivateChatImageGenEnhancementBlock } from './wechatPrivateChatImageGenPrompt'

export type CharacterImageGenPromptScope = 'private_chat' | 'default'
export function parseCharacterImageGenLine(line: string): { prompt: string } | null {
  const t = String(line ?? '')
    .trim()
    .replace(/^\uFEFF+/, '')
    .replace(/^[\u200B-\u200D\uFEFF]+/, '')
    .trim()
  const m = /^\[图片\]\s*(.+)$/.exec(t)
  if (!m) return null
  const prompt = m[1]!.trim()
  if (!prompt) return null
  return { prompt }
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

/** 概率未命中时从模型输出中移除 `[图片]` 行 */
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
    /** 无参考图时注入角色外貌 DNA，引导模型写 1boy/1girl + 外貌 tag */
    appearanceHint?: string
    scope?: CharacterImageGenPromptScope
    /** 本轮允许/需要生图时注入构图与生活感思维链；普通文字轮不传 */
    injectCompositionLifeFeelCot?: boolean
  },
): string {
  const styleName = styleHint?.trim() || '用户已配置'
  const hasRef = options?.hasAppearanceReference === true
  const appearanceHint = options?.appearanceHint?.trim() ?? ''
  const privateChat = options?.scope === 'private_chat'
  const selfieRule = buildChatSelfieImageGenRule(hasRef)
  const privateEnhancement = privateChat
    ? `\n\n${buildWeChatPrivateChatImageGenEnhancementBlock({
        hasAppearanceReference: hasRef,
        appearanceHint,
      })}`
    : ''
  const compositionCotBlock = options?.injectCompositionLifeFeelCot
    ? `\n\n${buildImageGenCompositionLifeFeelCotBlock()}`
    : ''
  const noRefAppearanceRule = !hasRef
    ? appearanceHint
      ? `\n- **无形象参考图（硬性）**：**禁止**写 reference character / 参考图角色；角色出镜时须用 **1boy** 或 **1girl**（按档案性别）并拆解为英文外貌 tag。档案外貌 DNA（须写入 \`[图片]\` 行，可摘要为英文 tag，勿整句中文照搬）：${appearanceHint}`
      : `\n- **无形象参考图（硬性）**：**禁止** reference character / 参考图角色；角色出镜时须写 **1boy/1girl** + 发色/发型/肤色/体型/穿搭等可见外貌英文 tag。`
    : ''

  return `---------------------
【角色发送 AI 配图（已启用${privateChat ? ' · 私聊增强' : ''}）】
---------------------
你**可以**在合适语境下单独发一条**图片消息**（例如分享随手拍、晒物、发梗图式实拍），让对话更生动；但图片**不能替代**该说的道歉、解释、边界与严肃信息。

■ 输出格式（硬性）
- 单独占一行，且该行**只能**是：\`[图片]English comma-separated visual tags\`
- **第三人称客观画面**：写给生图 API，**禁止** I/my/me/you；${hasRef ? '有参考图时用 **reference character**（勿写固定脸型/发色）。' : '**无参考图**：**禁止** reference character；须写 **1boy/1girl** + 外貌 tag。'}
${noRefAppearanceRule}
- **精简英文 tag 风（硬性）**：comma-separated 英文短 tag；整行宜 80～220 英文字符；**禁止**散文长句。
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${IMAGE_PROMPT_LIGHTING_CONTEXT_RULE}
- **只写视觉事实**：每个 tag 必须能直接画出来；**禁止**心理/气氛/因果/元描述（a photo of…, cinematic mood, hot breath in the air）。
- **禁止写风格词**：画风由客户端按「${styleName}」**自动拼接**；\`[图片]\` 行里**不要** anime, realistic, 8k, masterpiece 等。

■ 视角（硬性·三选一，禁止混写）
${IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE}
- **① first-person POV 随手拍（默认·最多）**：rear camera，**不是** front camera selfie，不写 mirror / front camera / arm-length distance。可写 own shoulders, arms, hands, thighs, legs, feet；**禁止** third-person full-body portrait、禁止 reference character 整人出镜（露肢体用 own …）。
- 示例（俯视+脚）：\`[图片]first-person POV, high angle looking down, orange cat on floor tiles, white sneakers and jeans cuffs at bottom of frame, afternoon sunlight, warm tile reflection\`
- **first-person POV·双人牵手**：须 **two separate people**；**own hand** 从下/左入镜，**partner's hand** 从对侧伸入。
- **十指相扣**：须 **fingers interlaced, interlocked fingers, finger gaps visible**；**禁** intertwined / clasped / gripping on top。
- 示例（俯视·十指相扣）：\`[图片]first-person POV, high angle looking down, own mechanical metallic left hand, partner's delicate smaller hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, two separate people, wet beach sand directly below, warm golden light on sand grains, no horizon in frame, NOT self-holding, NOT palm clasp\`
- 示例（平视·空镜）：\`[图片]first-person POV, eye level, rainy street, neon reflected on wet pavement, overcast scattered light, no human body parts in frame\`
- 示例（平视·比耶+海）：\`[图片]first-person POV, eye level, peace sign, hand entering bottom-right of frame, sunset horizon over sea, golden rim side backlight\`
- 示例（卧床）：\`[图片]first-person POV, lying in bed, looking down at own hands and messy bedsheets, morning light through curtain gap, warm soft light\`
- 示例（桌台）：\`[图片]first-person POV, slight high angle looking down, half cup of coffee on table, cafe interior, warm yellow ceiling light, overcast gray outside window\`
- **② front camera selfie（少数）**：见下节；须写 **front camera selfie, POV lens shot**；距离 **extreme close-up（最近）～ arm-length distance（最远）**；怼脸也须写上衣领口与头饰；**禁止** mirror / phone visible；可写 motion blur / sharp stable focus。
- **③ mirror selfie（少数）**：见下节；须写 mirror selfie / mirror reflection。
${selfieRule}
${privateChat ? `\n■ 景别与多人（私聊）\n- close-up / facial → 禁复杂背景与全身；wide shot / full body → 禁睫毛级微观细节。\n- ≥2 人：每人写清 left/center/right of frame。${hasRef ? `\n\n■ 亲密/NSFW 示例（私聊·全英文·须贴合语境，禁止照搬）\n- close-up genitals: \`[图片]close-up, reference character fully nude, legs spread apart, labia and clitoris clearly visible, vaginal opening slightly parted, warm side light, messy bedsheets\`\n- first-person POV genitals: \`[图片]first-person POV, slight high angle looking down, lying in bed, own body from waist down, labia clitoris vaginal opening centered, own fingers pressing on clitoris, dim warm bedside lamp\`\n- mirror genitals: \`[图片]bathroom mirror selfie, mirror reflection, reference character crouching, labia clitoris vaginal opening in mirror, one hand holding phone toward mirror, misty steam haze\`` : `\n\n■ 亲密/NSFW 示例（私聊·无参考图·全英文·须贴合语境，禁止照搬）\n- close-up genitals: \`[图片]close-up, 1girl, fully nude, legs spread apart, labia and clitoris clearly visible, vaginal opening slightly parted, warm side light, messy bedsheets\`\n- first-person POV genitals: \`[图片]first-person POV, slight high angle looking down, lying in bed, own body from waist down, labia clitoris vaginal opening centered, own fingers pressing on clitoris, dim warm bedside lamp\`\n- mirror genitals: \`[图片]bathroom mirror selfie, mirror reflection, 1girl crouching, labia clitoris vaginal opening in mirror, one hand holding phone toward mirror, misty steam haze\``}` : ''}

■ 频率与场景
- 允许一轮 **0 条**；不要每轮都发，也不要用图片刷屏替代正文。
- 仅在轻松、日常、分享类语境使用；争吵、冷战、正式通知、对方明显需要被认真对待时**优先用文字**。
- 若当前不适合发图，请**只输出文字行**，不要输出 \`[图片]\` 行。

■ 与表情包区分
- \`[表情包]引用名\` 仅用于**表情包库**资源；**实拍/场景/物品**类请用 \`[图片]描述\`，不要用表情包行冒充。

■ 禁止假发图（硬性）
- 凡口头写「发过去了」「拍好了」「传给你了」「给你发了」等，**同一轮回复中必须**有对应 \`[图片]\` 行；否则客户端**不会**出图。
- **没有** \`[图片]\` 行时，禁止写已发送/已拍好类措辞；应继续文字说明，或直接输出 \`[图片]\` 行。${privateEnhancement}${compositionCotBlock}`
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
  return `[系统纠错] 你上一轮口头写了「发过去了/拍好了」等，但**缺少** \`[图片]画面描述\` 行，客户端**不会**生图。
请立刻补发：单独占一行 \`[图片]…\`（与上一轮口头承诺一致的画面，如 front camera selfie, POV lens shot），可保留原有文字气泡；**禁止**再次假装已发而无 \`[图片]\` 行。`
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
