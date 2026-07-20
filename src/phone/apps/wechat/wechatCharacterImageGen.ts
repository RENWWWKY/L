import type { WeChatImageMime, Gender } from './newFriendsPersona/types'
import { buildImageGenCompositionLifeFeelCotBlock } from '../../../components/moments/imageGenCompositionLifeFeelCot'
import { buildChatSelfieImageGenRule, IMAGE_PROMPT_CONCRETE_VISUAL_RULE, IMAGE_PROMPT_ENGLISH_ONLY_RULE, IMAGE_PROMPT_LIGHTING_CONTEXT_RULE, IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE } from '../../../components/moments/momentCharacterImageRules'
import { buildWeChatPrivateChatImageGenEnhancementBlock } from './wechatPrivateChatImageGenPrompt'
import { buildWeChatNsfwPoseLibraryPromptBlock } from './nsfwPoseLibrary/buildWeChatNsfwPoseLibraryPromptBlock'

export type CharacterImageGenPromptScope = 'private_chat' | 'default'

/** `[图片]` 行分隔符：左侧中文占位描述，右侧英文生图 tag */
export const CHARACTER_IMAGE_GEN_LINE_SEP = '|||'

/** 是否更像英文生图 tag（旧档兼容） */
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

/**
 * 解析角色 `[图片]` 行。
 * 现行：`[图片]通俗中文画面描述|||english, tags`
 * 旧档：整段英文 tags（description 与 prompt 同值）。
 */
export function parseCharacterImageGenLine(
  line: string,
): { description: string; prompt: string } | null {
  const t = String(line ?? '')
    .trim()
    .replace(/^\uFEFF+/, '')
    .replace(/^[\u200B-\u200D\uFEFF]+/, '')
    .trim()
  const m = /^\[图片\]\s*(.+)$/.exec(t)
  if (!m) return null
  const body = m[1]!.trim()
  if (!body) return null

  const sepIdx = body.indexOf(CHARACTER_IMAGE_GEN_LINE_SEP)
  if (sepIdx >= 0) {
    const description = body.slice(0, sepIdx).trim()
    const prompt = body.slice(sepIdx + CHARACTER_IMAGE_GEN_LINE_SEP.length).trim()
    if (!description && !prompt) return null
    return {
      description: description || prompt,
      prompt: prompt || '',
    }
  }

  if (looksLikeEnglishImageGenTags(body)) {
    return { description: body, prompt: body }
  }
  return { description: body, prompt: '' }
}

/** 气泡占位：优先中文描述；旧档仅有英文 tag 时回退展示 tag */
export function resolveCharacterImageDescriptionForUi(msg: {
  imageDescription?: string | null
  imageGenPrompt?: string | null
}): string | undefined {
  const desc = String(msg.imageDescription ?? '').trim()
  if (desc) return desc
  const prompt = String(msg.imageGenPrompt ?? '').trim()
  return prompt || undefined
}

/** 确认/重试生图：只用右侧英文 tag；旧档 description 若本身是英文 tag 也可作回退 */
export function resolveCharacterImageGenPromptForApi(msg: {
  imageDescription?: string | null
  imageGenPrompt?: string | null
}): string {
  const prompt = String(msg.imageGenPrompt ?? '').trim()
  if (prompt) return prompt
  const desc = String(msg.imageDescription ?? '').trim()
  if (desc && looksLikeEnglishImageGenTags(desc)) return desc
  return ''
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
    /** @deprecated 已取消发图概率门槛；保留兼容 */
    imageRoundAllowed?: boolean
    /** 用户本轮明确要求发图 */
    userExplicitCharacterImageRequest?: boolean
    /** 近期聊天上下文，用于亲密场景姿势库按需召回 */
    chatContextTail?: string
    characterGender?: Gender | null
    playerGender?: Gender | null
  },
): string {
  const userExplicit = options?.userExplicitCharacterImageRequest === true

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
      ? `\n- **无形象参考图（硬性）**：**禁止** reference character；**禁止**写 \`The character appearance:\` 外貌块。右侧英文 tag 必要时含 1boy/1girl + 英文外貌词。`
      : `\n- **无形象参考图（硬性）**：**禁止** reference character；**禁止**写 The character appearance 外貌块；右侧写 1boy/1girl + 英文外貌 tag。`
    : ''

  return `---------------------
【角色发送 AI 配图（已启用${privateChat ? ' · 私聊增强' : ''}${userExplicit ? ' · 用户要求' : ''}）】
---------------------
**默认纯文字回复**。可按场景语境**适量**发 \`[图片]\`（分享随手拍 / 晒物 / 展示场景 / 用户要看图等）；**禁止**每轮都发，**禁止**用配图替代道歉、解释、边界与严肃信息。

■ 双层输出（硬性·同轮一并写出）
- 单独占一行，格式：\`[图片]通俗中文画面描述|||English comma-separated visual tags\`
- **\`|||\` 左侧** = 给用户看的中文占位（谁在哪、干什么；像跟人说话）；客户端气泡只展示左侧。
- **\`|||\` 右侧** = 给生图 API 的英文 tag；用户点确认后**直接**用右侧生图，**禁止**省略右侧、禁止只写左侧。
- 例：\`[图片]对镜自拍，一只手拿草莓牛奶，另一只手比耶|||[wx-selfie|who={{char}}] mirror selfie shot, upper body, holding strawberry milk carton, peace sign, bathroom mirror, warm light\`
- 例（空镜）：\`[图片]雨后霓虹映在湿路面上|||rainy street after rain, neon reflected on wet pavement, overcast scattered light\`
- 例（拍他人）：\`[图片]游艇甲板上穿黑泳衣的女孩坐着，身后碧蓝海水|||young woman in black swimsuit sitting on yacht deck cushion, turquoise sea and sky behind her, bright midday sunlight\`

■ 右侧英文 tag 规则（硬性）
- **第三人称客观画面**：写给生图 API，**禁止** I/my/me/you；${hasRef ? '有参考图时用 **reference character**（勿写固定脸型/发色）。' : '**无参考图**：**禁止** reference character；须写 **1boy/1girl** + 外貌 tag。'}
${noRefAppearanceRule}
- **精简英文 tag 风（硬性）**：非自拍/对镜时 comma-separated 英文短 tag，右侧宜 80～220 英文字符。**自拍/对镜**：须 \`[wx-selfie|who={{char}}]\` + 以 \`selfie shot\` 或 \`mirror selfie shot\` 开头的英文 tag（见下节）；**禁止**写 The character appearance 外貌块。
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${IMAGE_PROMPT_LIGHTING_CONTEXT_RULE}
- **只写视觉事实**：每个 tag 必须能直接画出来；**禁止**心理/气氛/因果/元描述（a photo of…, cinematic mood, hot breath in the air）。
- **禁止写风格词**：画风由客户端按「${styleName}」**自动拼接**；右侧**不要** anime, realistic, 8k, masterpiece 等。

■ 视角（硬性·三选一，禁止混写；以下示例写完整双层行）
- **后置摄像头·直接画面（默认·最多）**：右侧**只写画面里有什么**，**禁止** first-person POV / eye level / rear camera / POV 等机位 meta tag。
  - 示例（俯视+脚）：\`[图片]地板上橘猫，画面下方露出白球鞋|||orange cat on floor tiles, white sneakers and jeans cuffs at bottom of frame, afternoon sunlight\`
  - 示例（晒物）：\`[图片]桌上半杯咖啡，咖啡店内景|||half cup of coffee on table, cafe interior, warm yellow ceiling light\`
- **后置·双人亲密同框（硬性）**：须 **medium shot / wide shot**；只写被拍方主体 + **own hand / forearm** 从画缘入镜（可选）；**禁止**单人 close-up / 怼脸 / headshot；**禁止** phone visible / holding phone。
- **后置·双人牵手**：按模版写画面即可；**背景随拍摄角度变**；**不必**再堆手指数量/指尖/缺指等 tag。
  - **十指相扣**模版（背景/光线可换）：\`[图片]俩人站着十指相扣，镜头往下拍，脚下湿路面，小腿和鞋也入镜|||A close-up photo of hands held together: the hands of two people, their fingers interlaced; the joints are clearly visible. The hands are slender and attractive, with one of them wearing a silver ring on its ring finger. The background is a wet surface; it's night time, dark and gloomy. The view is from a first-person perspective, and the calves and shoes of the two people are also visible in the frame.\`
  - **手心相牵**：palm-to-palm，fingers not interlaced。
${IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE}
- **② 前置自拍（少数）**：右侧行首须 \`[wx-selfie|who={{char}}]\`，第一个 tag 为 **selfie shot**；**默认 upper body**。
- **③ 对镜自拍（少数）**：右侧行首须 \`[wx-selfie|who={{char}}]\`，第一个 tag 为 **mirror selfie shot**。
${selfieRule}
${privateChat ? `\n■ 景别与多人（私聊）\n- 自拍默认 upper body；仅角色明确怼脸/特写时才 close-up face。\n- close-up / facial → 禁复杂背景与全身；wide shot / full body → 禁睫毛级微观细节。\n- ≥2 人：每人写清 left/center/right of frame。\n- **双人亲密同框（硬性）**：须 medium shot / wide shot；**禁止**单人 close-up / 怼脸 / headshot / phone visible。${hasRef ? `\n\n■ 亲密/NSFW 示例（私聊·双层·须贴合语境，禁止照搬）\n- dual intimate: \`[图片]她躺在白床单上双腿分开，他的脸在她大腿之间|||reference character lying on white sheets, legs spread, labia and clitoris visible, 1boy face partially visible between her thighs, medium shot, bedroom, warm side light, messy bedsheets\`\n- close-up: \`[图片]特写下身，双腿分开|||close-up, reference character fully nude, legs spread apart, labia and clitoris clearly visible, vaginal opening slightly parted, warm side light, messy bedsheets\`\n- mirror: \`[图片]浴室对镜蹲着拍下身特写|||[wx-selfie|who={{char}}] mirror selfie shot, close-up genitals, crouching, bathroom mirror, labia clitoris vaginal opening in frame, misty steam haze\`` : `\n\n■ 亲密/NSFW 示例（私聊·无参考图·双层·须贴合语境，禁止照搬）\n- dual intimate: \`[图片]她躺在白床单上双腿分开，他的脸在她大腿之间|||1girl lying on white sheets, legs spread, labia and clitoris visible, 1boy face partially visible between her thighs, medium shot, bedroom, warm side light, messy bedsheets\`\n- close-up: \`[图片]特写下身，双腿分开|||close-up, 1girl, fully nude, legs spread apart, labia and clitoris clearly visible, vaginal opening slightly parted, warm side light, messy bedsheets\`\n- mirror: \`[图片]浴室对镜蹲着拍下身特写|||[wx-selfie|who={{char}}] mirror selfie shot, close-up genitals, crouching, bathroom mirror, labia clitoris vaginal opening in frame, misty steam haze\``}` : ''}

■ 频率与场景（硬性）
- **大多数轮次 = 0 条 \`[图片]\`**；不要每轮都发，不要用图片刷屏替代正文。
- 仅在轻松、日常、**明确在分享/展示**时使用；争吵、冷战、正式通知、对方明显需要被认真对待时**必须纯文字**。
- 若当前不适合发图，**只输出文字行**，不要输出 \`[图片]\` 行；也**不要**写「发过去了」等假装已发。

■ 与表情包区分
- \`[表情包]引用名\` 仅用于**表情包库**资源；**实拍/场景/物品**类请用 \`[图片]中文|||英文\`，不要用表情包行冒充。

■ 禁止假发图（硬性）
- 凡口头写「发过去了」「拍好了」「传给你了」「给你发了」等，**同一轮回复中必须**有对应 \`[图片]\` 行（含 \`|||\` 与右侧英文 tag）；否则客户端**不会**出图。
- **没有** \`[图片]\` 行时，禁止写已发送/已拍好类措辞；应继续文字说明，或直接输出完整双层 \`[图片]\` 行。${privateEnhancement}${poseLibraryAppendix}${compositionCotBlock}`
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

/** 模型口头声称已发图，但输出中无可用的 `[图片]` 行（须有可生图的英文 tag） */
export function characterOutputClaimsSentImageWithoutLine(bubbles: string[]): boolean {
  const hasUsableImageLine = bubbles.some((b) => {
    for (const line of String(b ?? '').split('\n')) {
      const parsed = parseCharacterImageGenLine(line.trim())
      if (!parsed) continue
      if (
        resolveCharacterImageGenPromptForApi({
          imageDescription: parsed.description,
          imageGenPrompt: parsed.prompt,
        })
      ) {
        return true
      }
    }
    return false
  })
  if (hasUsableImageLine) return false
  return bubbles.some((b) => {
    const t = String(b ?? '').trim()
    if (!t || /^\[表情包\]/.test(t)) return false
    return CHARACTER_FAKE_SENT_IMAGE_RE.test(t)
  })
}

export function buildCharacterImageFakeSendRetryBias(): string {
  return `[系统纠错] 你上一轮口头写了「发过去了/拍好了」等，但**缺少**完整 \`[图片]中文描述|||英文tags\` 行，客户端**不会**出图。
请立刻补发：单独占一行 \`[图片]通俗中文|||english tags\`（如 \`[图片]卧室对镜自拍半身比耶|||[wx-selfie|who={{char}}] mirror selfie shot, upper body, peace sign, …\`），可保留原有文字气泡；**禁止**再次假装已发；**禁止**省略 \`|||\` 或右侧英文 tag。`
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
