import { buildImageGenCompositionLifeFeelCotBlock } from './imageGenCompositionLifeFeelCot'
import {
  CHARACTER_MEDIA_SELFIE_PREFIX_TEMPLATE,
  hasCharacterMediaSelfiePrefix,
} from './characterMediaSelfiePrefix'

const IMAGE_PROMPT_ENGLISH_ONLY_RULE = `
- **语言（硬性）**：\`[图片]\` 行**必须全英文** comma-separated SD tags，**直接**发往生图 API；**禁止中文**（不要指望客户端二次翻译）。NSFW/亲密画面也用英文解剖词：labia, clitoris, vaginal opening, nipples, bare chest 等。
`.trim()

const IMAGE_PROMPT_CONCRETE_VISUAL_RULE = `
- **写实视觉 tag（硬性）**：每个逗号块必须是相机能直接拍到的**具体像素**——唇色、眉形、视线方向、泪光、发丝、衣领、皮肤泛红、肢体角度、光源颜色；禁止心理与气氛。
- **禁止心理/抽象/不可拍 tag**：不敢、羞耻、顺从、局促、委屈、脆弱、慵懒、温顺、暧昧、气质、神情…；眼神湿漉漉、眼底柔光、空气中燥热呼吸感、被咬得有些红肿（改写成可见的 lip slightly red / swollen lip edge）；禁止「充满…感」「似乎」「好像」、禁止空气/氛围/呼吸/张力类词。
- **情绪→可见写法（须这样写）**：slightly red lips, tears glistening in eyes, furrowed brows, messy silver hair, guilty gaze looking to the left, gaze averted to the side, light blush on cheeks, lips slightly pursed, shoulders hunched inward。
- **禁止**：散文长句、因果链（because/so）、元描述（a photo of…, cinematic mood）。
`.trim()

const IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE = `
- **后置·俯仰↔背景（仅当画面含 own hand / 低头看脚边 / 仰视天空 等要素时适用；纯拍他人/空镜勿写 POV 套话）**：
  - 写了 **looking down / high angle looking down / 俯视 / 低头看** → 镜头朝下，**正下方**必须是地面/脚边：wet sand at feet, floor tiles, pavement, tide foam on sand, bedsheets 等。
  - **禁止** 与俯视同写 horizon, skyline, sea waves, beach background, sunset over ocean, soft focus on horizon, lens flare on horizon —— 这些是**平视远景**，会误导成**第三人称站海滩拍远景**。
  - 海边牵手·俯视·十指相扣：\`own left hand, partner's slightly smaller right hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, each hand exactly 5 fingers including thumb, ten distinct fingertips, anatomically correct hands, no missing fingers, no extra fingers, wet beach sand directly below, warm golden light on sand grains, no horizon in frame\`
  - 海边牵手·俯视·手心相牵：\`own left hand, partner's slightly smaller right hand, palm-to-palm hold, palms pressed gently together, fingers not interlaced, each hand exactly 5 fingers including thumb, ten distinct fingertips, anatomically correct hands, no missing fingers, no extra fingers, wet beach sand directly below, no horizon in frame\`
  - **平视远景** 才写 horizon / waves；**不要**与脚下 sand/floor 同写。
- **仰角↔背景**：
  - 写了 **looking up / 仰视 / 抬头看** → 画面主体是**头顶上方**：sky, clouds, ceiling, tree canopy, building facade, neon sign overhead 等。
  - **禁止** 与仰视同写 floor tiles, pavement, wet sand at feet, ground at feet, shoes at bottom of frame —— 仰视时**看不到地板**。
  - 例（仰视·天空）：\`sunset sky with orange clouds, building silhouettes at frame edges, no floor visible\`
- **手部（硬性）**：
  - 角色举机拍 → 自己的手 **own hand / own left hand**；对方 **partner's hand**。**禁止** reference character's hand（第三人称主体）。
  - **禁止** user's hand / your hand。
- **双人牵手（硬性）**：
  - 两人牵手 = **两个人的手在画面中央**；举机者 **own hand** 从画面下/左入镜，**partner's hand** 从对侧伸入，**禁止**画成同一人两只手。
  - **手指数量（硬性）**：须写 **each hand exactly 5 fingers including thumb**；双手同框时写 **ten distinct fingertips**；**禁止**缺指/多指/融指/断指（no missing fingers, no extra fingers, no fused fingers）。
  - **十指相扣（硬性）**：须写 **fingers interlaced, interlocked fingers, finger gaps visible between hands**；**禁止**仅写 intertwined / clasped / holding hand / gripping on top（这些只会画成搭握，不是指缝相扣）。
  - 例（十指相扣）：\`own left hand, partner's slightly smaller right hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, each hand exactly 5 fingers including thumb, ten distinct fingertips, anatomically correct hands, no missing fingers, no extra fingers, wet beach sand directly below, warm golden light on sand grains, no horizon in frame\`
  - **手心相牵（硬性）**：须写 **palm-to-palm hold, palms pressed gently together, fingers not interlaced**；**禁止** fingers interlaced / interlocked fingers。
  - 例（手心相牵）：\`own left hand, partner's slightly smaller right hand, palm-to-palm hold, palms pressed gently together, fingers not interlaced, thumbs along outer sides, each hand exactly 5 fingers including thumb, ten distinct fingertips, anatomically correct hands, no missing fingers, no extra fingers, messy white bedsheets directly below, warm soft side light\`
  - 俯视牵手：只写脚下 sand/floor；加 **NOT self-holding**。
`.trim()

const IMAGE_PROMPT_THIRD_PERSON_RULE = `
- **叙述人称（硬性）**：\`[图片]\` 行是写给**生图 API** 的第三人称画面描述，不是角色台词、日记或内心独白。
  - **禁止**第一/第二人称：I, my, me, we, you；中文我/我的/本人/你/您（客户端会尽量替换，但请直接写英文第三人称）。
  - 有形象参考图时用 **reference character**（勿写脸型/发色等固定外貌）。
  - 无参考图时可写 young man / young woman 并简述可见外貌。
`.trim()

const IMAGE_PROMPT_LIGHTING_CONTEXT_RULE = `
- **环境/光线（须贴合本轮场景，禁止套固定模板）**：
  - 从**当前聊天语境**推断光源与色调：浴室→镜前暖白灯/水汽；卧室→台灯或窗光；户外白天→自然日光；阴雨天→灰蒙散射光；夜景→霓虹/路灯；办公室→冷白荧光灯；医院→明亮冷白顶灯。
  - 用 **3～6 个短语**写**与本场景一致**的光线/背景即可；**禁止**无依据地每轮堆同一套词。
  - **禁止照搬**示例或历史成图里的固定套餐（如「低亮度暗环境，局部轮廓光，微弱侧光，虚化暗背景，电影感光影」连写）；每张图的光线/背景应有差异。
  - 写法参考（仅示意，须按场景替换）：午后窗光，白墙柔焦 | 浴室暖黄顶灯，镜面水汽 | 阴雨天灰调，路面霓虹反射 | 日落金色侧逆光，海平线渐变。
`.trim()

const IMAGE_PROMPT_CONCISE_STYLE_RULE = `
- **篇幅与写法（硬性，利于生图 API 稳定过审）**：
  - 用 **comma-separated 英文短 tag** 堆叠画面要素，**禁止**散文式长句、排比、心理独白。
  - 整行 \`[图片]\` 宜 **80～220 英文字符**；面部/神态用 **4～8 个英文 tag**；环境/光线用 **3～6 个英文 tag**。
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${IMAGE_PROMPT_LIGHTING_CONTEXT_RULE}
  - 场景、穿搭、动作各用 **1～3 个 tag**；不要重复同一信息。
`.trim()

const SUBJECT_SELFIE_PREFIX_RULE = `
- **自拍前缀（硬性·自拍/对镜专用）**：\`[图片]\` 行**必须以** \`${CHARACTER_MEDIA_SELFIE_PREFIX_TEMPLATE}\` 开头（who 填当前 {{char}} 真名，勿写占位符）。
- **写法（简）**：前缀后接 **comma-separated 英文 tag**；**第一个 tag 必须是** \`selfie shot\`（前置）或 \`mirror selfie shot\`（对镜）；接着写穿搭、动作、环境、光线、神态等可见 tag。
- **默认距离（硬性）**：普通露脸/晒自拍 → **upper body / arm-length**，写 face、lips、outfit、环境即可；**禁止**默认加 \`close-up face\`、\`extreme close-up\`、怼脸。
- **特写（仅角色明确要拍时）**：只有聊天里明确说怼脸/特写/近一点拍某部位，才写 \`close-up face\` / \`close-up abs\` 等**单一部位** tag；**禁止**露脸 tag 与 \`close-up abs/chest/genitals\` 同写（冲突时宁可都不写 close-up）。
- **禁止**：\`front camera selfie\`、\`POV lens shot\`、\`phone visible\`、\`A close-up front camera selfie of…\` 等长句/机位 meta（**客户端不再自动补全**）；**禁止**在 \`[图片]\` 行写中文外貌块或 The character appearance 块。
`.trim()

const NO_REF_CHARACTER_APPEARANCE_BLOCK_RULE = `
- **外貌注入（硬性·客户端静默处理）**：**禁止**在可见气泡或 \`[图片]\` 行中写 \`The character appearance:\` 外貌块；客户端会自动注入形象特征，你**只写**英文场景 tag（无参考图时在 tag 里写 1boy/1girl + 必要英文外貌词即可）。
`.trim()

const SUBJECT_FRONT_SELFIE_TEMPLATE =
  '[wx-selfie|who={{char}}] selfie shot, grey t-shirt, bedroom, soft morning light, lips slightly pursed, light blush on cheeks'

const SUBJECT_MIRROR_SELFIE_TEMPLATE =
  '[wx-selfie|who={{char}}] mirror selfie shot, lifting grey t-shirt, midriff visible, bathroom mirror, warm overhead light'

const SUBJECT_MIRROR_SELFIE_NO_REF_EXAMPLE = SUBJECT_MIRROR_SELFIE_TEMPLATE

const SELFIE_EXPRESSION_WRITING_GUIDE = `
  - **神态**：用 **3～6 个可见 tag**（lips slightly pursed, light blush on cheeks, gaze averted downward）；**禁止**心理/气质词。
  - **禁止示例**：moist eyes, dreamy gaze, shy and obedient, vulnerable aura, hot breath in the air, timid expression, feeling ashamed。
${IMAGE_PROMPT_LIGHTING_CONTEXT_RULE}
  - **动作/穿搭**：lifting shirt, grey t-shirt, peace sign 等 comma tag；**禁止** holding phone / phone visible。
`.trim()

const SELFIE_CLIENT_CAMERA_RULE = `
- **自拍 tag（简）**：只写 \`selfie shot\` / \`mirror selfie shot\` + 穿搭/环境/光线/神态；**默认 upper body**，**禁止**无依据加 close-up / 怼脸。
- **特写**：仅当角色**明确**要拍特写时才加 \`close-up 部位\`；露脸自拍**禁止**再写 \`close-up abs/chest/genitals\` 等部位特写（冲突时宁可不加）。
- **前置 vs 对镜**：浴室/试衣镜 → \`mirror selfie shot\`；床上/户外普通自拍 → \`selfie shot\` + upper body。**禁止**混写两种机位 tag；**禁止** front camera / POV lens / phone visible。
- **镜像校正**：有形象参考图且补充**未**写「自拍角度参考」时，成图后客户端自动水平镜像；参考图本身已是自拍角度请在形象特征补充里注明以免二次翻转。
`.trim()

const SELFIE_APPEARANCE_BAN_WITH_REF =
  '**禁止写** The character appearance 块及固定脸型/发色/瞳色（由形象参考图锁定）。'

const SELFIE_EXAMPLE_FRONT_WITH_REFERENCE = SUBJECT_FRONT_SELFIE_TEMPLATE

const SELFIE_EXAMPLE_MIRROR_WITH_REFERENCE = SUBJECT_MIRROR_SELFIE_TEMPLATE

const SELFIE_EXAMPLE_WITHOUT_REFERENCE = SUBJECT_MIRROR_SELFIE_NO_REF_EXAMPLE

const SELFIE_RULE_WITH_REFERENCE = `
- **自拍/对镜（少数）**：仅当明确晒脸/前置/对镜。客户端已配置**形象参考图**；${SELFIE_APPEARANCE_BAN_WITH_REF}
${SUBJECT_SELFIE_PREFIX_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_CLIENT_CAMERA_RULE}
  - 模板（前置·勿照搬）：${SELFIE_EXAMPLE_FRONT_WITH_REFERENCE}
  - 模板（对镜·勿照搬）：${SELFIE_EXAMPLE_MIRROR_WITH_REFERENCE}
`.trim()

const SELFIE_RULE_WITHOUT_REFERENCE = `
- **自拍/对镜（少数）**：仅当明确晒脸/前置/对镜；须 wx-selfie 前缀 + \`selfie shot\` / \`mirror selfie shot\` 英文 tag。
${SUBJECT_SELFIE_PREFIX_RULE}
${NO_REF_CHARACTER_APPEARANCE_BLOCK_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_CLIENT_CAMERA_RULE}
  - 模板（对镜·勿照搬）：${SELFIE_EXAMPLE_WITHOUT_REFERENCE}
`.trim()

/** 聊天 `[图片]` 协议用的自拍规则（含 markdown 示例行） */
export function buildChatSelfieImageGenRule(hasAppearanceReference: boolean): string {
  if (hasAppearanceReference) {
    return `- **自拍/对镜（少数）**：仅当语境明确是晒脸/前置/对镜。客户端已配置**形象参考图**（可多张）；${SELFIE_APPEARANCE_BAN_WITH_REF}
${SUBJECT_SELFIE_PREFIX_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_CLIENT_CAMERA_RULE}
- 模板（前置·勿照搬）：\`[图片]${SELFIE_EXAMPLE_FRONT_WITH_REFERENCE}\`
- 模板（对镜·勿照搬）：\`[图片]${SELFIE_EXAMPLE_MIRROR_WITH_REFERENCE}\``
  }
  return `- **自拍/对镜（少数）**：须 \`${CHARACTER_MEDIA_SELFIE_PREFIX_TEMPLATE}\` + 以 \`selfie shot\` / \`mirror selfie shot\` 开头的英文 tag；**禁止**写 The character appearance 外貌块（客户端自动注入）。
${SUBJECT_SELFIE_PREFIX_RULE}
${NO_REF_CHARACTER_APPEARANCE_BLOCK_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_CLIENT_CAMERA_RULE}
- 模板（对镜·勿照搬）：\`[图片]${SELFIE_EXAMPLE_WITHOUT_REFERENCE}\``
}

export function buildCharacterMediaImageDescriptionRules(
  hasAppearanceReference: boolean,
  options?: { injectCompositionLifeFeelCot?: boolean },
): string {
  const selfieRule = hasAppearanceReference ? SELFIE_RULE_WITH_REFERENCE : SELFIE_RULE_WITHOUT_REFERENCE
  const compositionCotBlock =
    options?.injectCompositionLifeFeelCot !== false
      ? `\n\n${buildImageGenCompositionLifeFeelCotBlock()}`
      : ''
  return `
# 配图描述视角（硬性）
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_THIRD_PERSON_RULE}
${IMAGE_PROMPT_CONCISE_STYLE_RULE}
- **非自拍（默认·直接画面）**：\`[图片]\` 行**只写成片画面**（主体、环境、光线）；**禁止** first-person POV / eye level / rear camera / looking down/up 等机位 meta tag（**客户端不再自动补全**）。露己身肢体时写 own hand / sneakers at bottom 等**画面要素**即可。
  - **① 空镜/风景** → 可无肢体入镜。
  - **② 露肢体** → own shoulders, arms, hands, thighs, legs, feet 等按画面需要写入；**不是** front camera selfie、**不是** mirror selfie、**不是** third-person full-body portrait。
  - 例（空镜）：\`rainy street after rain, neon reflected on wet pavement, overcast scattered light, road surface reflections\`
  - 例（俯视·脚）：\`orange cat crouching on floor tiles, white sneakers and jeans cuffs at bottom of frame, afternoon sunlight, warm tile reflection\`
  - 例（十指相扣）：\`own left hand, partner's slightly smaller right hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, each hand exactly 5 fingers including thumb, ten distinct fingertips, anatomically correct hands, no missing fingers, no extra fingers, wet beach sand directly below, warm golden light on sand grains, no horizon in frame\`
  - 例（手心相牵）：\`own left hand, partner's slightly smaller right hand, palm-to-palm hold, palms pressed gently together, fingers not interlaced, thumbs along outer sides, each hand exactly 5 fingers including thumb, ten distinct fingertips, anatomically correct hands, no missing fingers, no extra fingers, messy white bedsheets directly below\`
  - 例（比耶+海）：\`peace sign hand at bottom-right of frame, sunset horizon over sea, golden rim side backlight\`
- **后置·拍他人（成品照）**：主体写被拍的人（young woman / 1girl 等）；**只写画面内容**；**禁止** POV/eye level/rear camera 套话；**禁止** phone visible / hands holding phone / viewfinder / 第三人称「某人正在举机拍照」。
  - 例（游艇·拍女生）：\`young woman in black swimsuit sitting on yacht deck cushion, turquoise sea and sky behind her, bright midday sunlight, subject centered in frame\`
${IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE}
${selfieRule}
- 每张配图 prompt 须描述**不同**画面/角度/主体；**不要**写风格词。${compositionCotBlock}
`.trim()
}

/** @deprecated 使用 buildCharacterMediaImageDescriptionRules */
export const CHARACTER_MEDIA_IMAGE_DESCRIPTION_RULES =
  buildCharacterMediaImageDescriptionRules(false)

/** 供微信私聊配图协议复用：光线须贴合场景，禁止套固定模板 */
export {
  IMAGE_PROMPT_LIGHTING_CONTEXT_RULE,
  IMAGE_PROMPT_ENGLISH_ONLY_RULE,
  IMAGE_PROMPT_CONCRETE_VISUAL_RULE,
  IMAGE_PROMPT_POV_ANGLE_BACKGROUND_RULE,
}

/** front camera selfie 不再自动补 POV lens；wx-selfie 前缀自拍跳过 */
export function ensureFrontCameraSelfiePovLensTag(prompt: string): string {
  return prompt.trim()
}

/** 发往生图 API 前：统一措辞；不再自动改写为 POV/前置 meta tag */
export function normalizeCharacterImageGenPromptForApi(prompt: string): string {
  let s = prompt.trim()
  if (!s) return s
  if (hasCharacterMediaSelfiePrefix(s)) return s.replace(/\s+/g, ' ').trim()
  s = s.replace(/参考图角色/g, 'reference character')
  s = s.replace(/我的/g, "character's ")
  s = s.replace(/本人/g, 'character')
  s = s.replace(/(^|[，。；、\s])我($|[，。；、\s])/g, '$1character$2')
  return s.replace(/\s+/g, ' ').trim()
}

export function buildCharacterMomentImagePromptRules(
  isAnimeStyle: boolean,
  hasAppearanceReference = false,
  options?: { injectCompositionLifeFeelCot?: boolean },
): string {
  const styleNote = isAnimeStyle
    ? '二次元风格 prompt 禁止 photorealistic、realistic photo、DSLR、3d render。'
    : '写实/插画风格以用户配置为准，prompt 里勿写风格词。'
  return `${buildCharacterMediaImageDescriptionRules(hasAppearanceReference, options)}\n- ${styleNote}`
}
