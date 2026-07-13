import type { WeChatImageMime, Gender } from './newFriendsPersona/types'
import { buildImageGenCompositionLifeFeelCotBlock } from '../../../components/moments/imageGenCompositionLifeFeelCot'
import { buildChatSelfieImageGenRule, IMAGE_PROMPT_CONCRETE_VISUAL_RULE, IMAGE_PROMPT_ENGLISH_ONLY_RULE, IMAGE_PROMPT_LIGHTING_CONTEXT_RULE, IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE } from '../../../components/moments/momentCharacterImageRules'
import { buildWeChatPrivateChatImageGenEnhancementBlock } from './wechatPrivateChatImageGenPrompt'
import { buildWeChatNsfwPoseLibraryPromptBlock } from './nsfwPoseLibrary/buildWeChatNsfwPoseLibraryPromptBlock'

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
    /** 私聊：本轮概率已命中允许发图 */
    imageRoundAllowed?: boolean
    /** 用户本轮明确要求发图 */
    userExplicitCharacterImageRequest?: boolean
    /** 近期聊天上下文，用于亲密场景姿势库按需召回 */
    chatContextTail?: string
    characterGender?: Gender | null
    playerGender?: Gender | null
  },
): string {
  const roundAllowed = options?.imageRoundAllowed === true
  const userExplicit = options?.userExplicitCharacterImageRequest === true
  if (options?.imageRoundAllowed === false && !userExplicit) {
    return `---------------------
【角色 AI 配图（已启用 · 本轮禁止发图）】
---------------------
客户端已开启角色 AI 配图，但**本轮禁止**输出 \`[图片]\` 行（发图概率未命中，且用户未要求）。
- **仅用文字**回复；日常聊天、问答、安慰、斗嘴、解释、承诺、吐槽等都**不要**配图。
- **禁止**写「发过去了」「拍好了」「传给你了」「给你发了」等假装已发图的措辞。
- **禁止**输出任何 \`[图片]\` 行。`
  }

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
  const poseLibraryBlock = options?.chatContextTail?.trim()
    ? buildWeChatNsfwPoseLibraryPromptBlock({
        chatContextTail: options.chatContextTail,
        characterGender: options.characterGender,
        playerGender: options.playerGender,
      })
    : ''
  const poseLibraryAppendix = poseLibraryBlock ? `\n\n${poseLibraryBlock}` : ''
  const noRefAppearanceRule = !hasRef
    ? appearanceHint
      ? `\n- **无形象参考图（硬性）**：**禁止** reference character / 参考图角色；**禁止**写 \`The character appearance:\` 外貌块（客户端自动注入）。\`[图片]\` 行只写英文 tag，必要时含 1boy/1girl + 英文外貌词。`
      : `\n- **无形象参考图（硬性）**：**禁止** reference character / 参考图角色；**禁止**写 The character appearance 外貌块；\`[图片]\` 行写 1boy/1girl + 英文外貌 tag。`
    : ''

  return `---------------------
【角色发送 AI 配图（已启用${privateChat ? ' · 私聊增强' : ''}${userExplicit ? ' · 用户要求' : roundAllowed ? ' · 本轮允许' : ''}）】
---------------------
**默认纯文字回复**。\`[图片]\` 仅在确有「分享随手拍 / 晒物 / 展示场景 / 用户要看图」等语境时使用；**禁止**用配图替代道歉、解释、边界与严肃信息，**禁止**每轮都发图。

■ 输出格式（硬性）
- 单独占一行，且该行**只能**是：\`[图片]English comma-separated visual tags\`
- **第三人称客观画面**：写给生图 API，**禁止** I/my/me/you；${hasRef ? '有参考图时用 **reference character**（勿写固定脸型/发色）。' : '**无参考图**：**禁止** reference character；须写 **1boy/1girl** + 外貌 tag。'}
${noRefAppearanceRule}
- **精简英文 tag 风（硬性）**：非自拍/对镜时 comma-separated 英文短 tag，整行宜 80～220 英文字符。**自拍/对镜**：须 \`[wx-selfie|who={{char}}]\` + 以 \`selfie shot\` 或 \`mirror selfie shot\` 开头的英文 tag（见下节）；**禁止**写 The character appearance 外貌块。
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${IMAGE_PROMPT_LIGHTING_CONTEXT_RULE}
- **只写视觉事实**：每个 tag 必须能直接画出来；**禁止**心理/气氛/因果/元描述（a photo of…, cinematic mood, hot breath in the air）。
- **禁止写风格词**：画风由客户端按「${styleName}」**自动拼接**；\`[图片]\` 行里**不要** anime, realistic, 8k, masterpiece 等。

■ 视角（硬性·三选一，禁止混写）
- **后置摄像头·直接画面（默认·最多）**：\`[图片]\` 行**只写画面里有什么**（主体、环境、光线、构图），**禁止**写 first-person POV / eye level / rear camera / POV / looking down / looking up 等机位 meta tag（**客户端不再自动补全**）。
  - 可被写进画面的内容：人物、物件、环境、光线；若 naturally 露出己方鞋尖/手指/比耶手，当作**画面要素**写（如 white sneakers at bottom of frame / peace sign hand at frame edge），**不要**用 POV 套话开头。
  - 示例（空镜）：\`[图片]rainy street after rain, neon reflected on wet pavement, overcast scattered light, road surface reflections\`
  - 示例（拍他人）：\`[图片]young woman in black swimsuit sitting on yacht deck cushion, turquoise sea and sky behind her, bright midday sunlight, subject centered in frame\`
  - 示例（俯视+脚）：\`[图片]orange cat on floor tiles, white sneakers and jeans cuffs at bottom of frame, afternoon sunlight, warm tile reflection\`
  - 示例（比耶+海）：\`[图片]peace sign hand at bottom-right of frame, sunset horizon over sea, golden rim side backlight\`
  - 示例（卧床）：\`[图片]own hands and messy bedsheets, morning light through curtain gap, warm soft light\`
  - 示例（桌台）：\`[图片]half cup of coffee on table, cafe interior, warm yellow ceiling light, overcast gray outside window\`
- **后置·双人亲密同框（硬性）**：须 **medium shot / wide shot**；只写被拍方主体 + **own hand / forearm** 从画缘入镜（可选）；**禁止**单人 close-up / 怼脸 / headshot；**禁止** phone visible / holding phone。
- **后置·双人牵手（画面要素写法）**：须 **two separate people**；**own hand** 与 **partner's hand** 写进画面；**禁止** POV/eye level 套话开头。
  - **十指相扣**：须 **fingers interlaced, interlocked fingers, finger gaps visible**；**禁** intertwined / clasped / gripping on top。
  - 示例：\`[图片]own mechanical metallic left hand, partner's delicate smaller hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, wet beach sand directly below, warm golden light on sand grains, no horizon in frame, two separate people, NOT self-holding, NOT palm clasp\`
${IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE}
- **② 前置自拍（少数）**：见下节；行首须 \`[wx-selfie|who={{char}}]\`，第一个 tag 为 **selfie shot**；**默认 upper body**，仅角色明确怼脸/特写时才加 close-up face。
- **③ 对镜自拍（少数）**：见下节；行首须 \`[wx-selfie|who={{char}}]\`，第一个 tag 为 **mirror selfie shot**。
${selfieRule}
${privateChat ? `\n■ 景别与多人（私聊）\n- 自拍默认 upper body；仅角色明确怼脸/特写时才 close-up face。\n- close-up / facial → 禁复杂背景与全身；wide shot / full body → 禁睫毛级微观细节。\n- ≥2 人：每人写清 left/center/right of frame。\n- **双人亲密同框（硬性）**：须 medium shot / wide shot；只写被拍方画面 + 可选 own hand/forearm 从画外入镜；**禁止**单人 close-up / 怼脸 / headshot / face fills frame / phone visible。${hasRef ? `\n\n■ 亲密/NSFW 示例（私聊·全英文·须贴合语境，禁止照搬）\n- dual intimate: \`[图片]reference character lying on white sheets, legs spread, labia and clitoris visible, 1boy face partially visible between her thighs, medium shot, bedroom, warm side light, messy bedsheets\`\n- partner medium shot: \`[图片]young woman on bed, upper body and face visible, black lace lingerie, medium shot, warm bedside lamp\`\n- close-up genitals solo: \`[图片]close-up, reference character fully nude, legs spread apart, labia and clitoris clearly visible, vaginal opening slightly parted, warm side light, messy bedsheets\`\n- waist-down scene: \`[图片]lying in bed, own body from waist down, labia clitoris vaginal opening centered, own fingers pressing on clitoris, dim warm bedside lamp\`\n- mirror genitals: \`[图片][wx-selfie|who={{char}}] mirror selfie shot, close-up genitals, crouching, bathroom mirror, labia clitoris vaginal opening in frame, misty steam haze\`` : `\n\n■ 亲密/NSFW 示例（私聊·无参考图·须贴合语境，禁止照搬）\n- dual intimate: \`[图片]1girl lying on white sheets, legs spread, labia and clitoris visible, 1boy face partially visible between her thighs, medium shot, bedroom, warm side light, messy bedsheets\`\n- partner medium shot: \`[图片]young woman on bed, upper body and face visible, black lace lingerie, medium shot, warm bedside lamp\`\n- close-up genitals solo: \`[图片]close-up, 1girl, fully nude, legs spread apart, labia and clitoris clearly visible, vaginal opening slightly parted, warm side light, messy bedsheets\`\n- waist-down scene: \`[图片]lying in bed, own body from waist down, labia clitoris vaginal opening centered, own fingers pressing on clitoris, dim warm bedside lamp\`\n- mirror genitals: \`[图片][wx-selfie|who={{char}}] mirror selfie shot, close-up genitals, crouching, bathroom mirror, labia clitoris vaginal opening in frame, misty steam haze\``}` : ''}

■ 频率与场景（硬性）
- **大多数轮次 = 0 条 \`[图片]\`**；不要每轮都发，不要用图片刷屏替代正文。
- 仅在轻松、日常、**明确在分享/展示**时使用；争吵、冷战、正式通知、对方明显需要被认真对待时**必须纯文字**。
- 若当前不适合发图，**只输出文字行**，不要输出 \`[图片]\` 行；也**不要**写「发过去了」等假装已发。

■ 与表情包区分
- \`[表情包]引用名\` 仅用于**表情包库**资源；**实拍/场景/物品**类请用 \`[图片]描述\`，不要用表情包行冒充。

■ 禁止假发图（硬性）
- 凡口头写「发过去了」「拍好了」「传给你了」「给你发了」等，**同一轮回复中必须**有对应 \`[图片]\` 行；否则客户端**不会**出图。
- **没有** \`[图片]\` 行时，禁止写已发送/已拍好类措辞；应继续文字说明，或直接输出 \`[图片]\` 行。${privateEnhancement}${poseLibraryAppendix}${compositionCotBlock}`
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
请立刻补发：单独占一行 \`[图片]…\`（与上一轮口头承诺一致的画面，如 \`[wx-selfie|who={{char}}] selfie shot, upper body, …\`），可保留原有文字气泡；**禁止**再次假装已发而无 \`[图片]\` 行。`
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
