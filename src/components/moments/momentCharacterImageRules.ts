import { buildImageGenCompositionLifeFeelCotBlock } from './imageGenCompositionLifeFeelCot'

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
- **first-person POV·俯角↔背景（硬性）**：
  - 写了 **looking down / high angle looking down / 俯视 / 低头看** → 镜头朝下，**正下方**必须是地面/脚边：wet sand at feet, floor tiles, pavement, tide foam on sand, bedsheets 等。
  - **禁止** 与俯视同写 horizon, skyline, sea waves, beach background, sunset over ocean, soft focus on horizon, lens flare on horizon —— 这些是**平视远景**，会误导成**第三人称站海滩拍远景**。
  - 海边牵手·俯视·十指相扣：\`first-person POV, high angle looking down, own mechanical metallic left hand, partner's delicate smaller hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, wet beach sand directly below, warm golden light on sand grains, no horizon in frame\`
  - **平视远景** 才写 horizon / waves；须 **eye level**，**不要** looking down。
- **first-person POV·仰角↔背景（硬性）**：
  - 写了 **looking up / low angle looking up / 仰视 / 抬头看** → 镜头朝上，画面主体是**头顶上方**：sky, clouds, ceiling, tree canopy, building facade, neon sign overhead 等。
  - **禁止** 与仰视同写 floor tiles, pavement, wet sand at feet, ground at feet, shoes at bottom of frame —— 仰视时**看不到地板**。
  - 例（仰视·天空）：\`first-person POV, low angle looking up, sunset sky with orange clouds, building silhouettes at frame edges, no floor visible\`
- **first-person POV·手部（硬性）**：
  - 角色举机拍 → 自己的手 **own hand / own left hand**；对方 **partner's hand**。**禁止** reference character's hand（第三人称主体）。
  - **禁止** user's hand / your hand。
- **first-person POV·双人牵手（硬性）**：
  - 两人牵手 = **两个人的手在画面中央**；举机者 **own hand** 从画面下/左入镜，**partner's hand** 从对侧伸入，**禁止**画成同一人两只手。
  - **十指相扣（硬性）**：须写 **fingers interlaced, interlocked fingers, finger gaps visible between hands**；**禁止**仅写 intertwined / clasped / holding hand / gripping on top（这些只会画成搭握，不是指缝相扣）。
  - 俯视牵手：只写脚下 sand/floor；加 **two separate people, NOT self-holding**。
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

const SELFIE_EXPRESSION_WRITING_GUIDE = `
  - **面部/神态（自拍重点，英文 tag）**：用 **4～8 个 comma-separated 英文短语** 写唇、眉、眼、颊、视线方向；**必须贴合本轮心情但只写可见特征**。
  - **可写示例**：slightly red lips, tears glistening in eyes, furrowed brows, messy silver hair, guilty gaze looking to the left, light blush on cheeks, lips slightly pursed, gaze averted downward。
  - **禁止示例**：moist eyes, dreamy gaze, shy and obedient, vulnerable aura, hot breath in the air, timid expression, feeling ashamed。
${IMAGE_PROMPT_LIGHTING_CONTEXT_RULE}
  - **动作/穿搭**：各 1～3 英文 tag（head tilted, peace sign, tucking hair, navy bathrobe）；须与下方手部逻辑一致。
`.trim()

const SELFIE_DISTANCE_AND_MOTION_RULE = `
- **front camera selfie·距离（硬性）**：须写 **front camera selfie** + **POV lens shot**；**arm-length distance 是最远、不是必须**。可写 **extreme close-up / face fills frame**（最近），或 **arm-length distance / upper body**（最远）。
- **front camera selfie·怼脸穿搭（硬性）**：extreme close-up 时脸可占满画面，但**仍须**写 **1～3 个**穿搭/头饰英文 tag：hoodie, bathrobe, pajamas, tank top, collar, hood pulled up, hair tie, fluffy animal ears on hood, choker 等；衣领/帽檐/肩线可从画面下缘入镜。
- **front camera selfie·动态感（可选）**：motion blur, accidental phone shake, camera shake → 随手抖；sharp focus, stable handheld → 认真拍。
- **front camera selfie·禁镜（硬性）**：画面里**不得出现任何镜子/镜面**；背景用 matte wall, curtains, bedsheets；勿写 mirror, reflection, glossy wall。
`.trim()

const SELFIE_MODE_MUTUAL_EXCLUSION_RULE = `
- **front camera vs mirror（硬性，二选一）**：
  - **mirror selfie**：须写 mirror selfie / mirror reflection / in front of mirror；手机在镜中可见。**禁止**混写 front camera selfie、extreme close-up、arm reaching toward lens。
  - **front camera selfie**：须写 **front camera selfie** + **POV lens shot**。**禁止** mirror reflection, phone visible in frame, holding phone toward mirror。
  - 浴室/试衣镜语境 → 只选 mirror；床上/户外举机怼脸 → 只选 front camera。
`.trim()

const SELFIE_HAND_AND_MIRROR_RULE = `
- **手部逻辑（硬性，禁止自相矛盾）**：
  - **前置摄像头自拍**：镜头**就是**手机前置摄像头；**禁止**写「举着手机、拿着手机、手机入镜、一手举手机」——手机本体通常**不出画**（在画面外下方/侧面举机）。只写**另一只手**的动作（抓衣角、比耶、撩发）；举机手 implicit，勿描述。
  - **对镜自拍**：画面是**镜面反射**；角色必须**至少一只手举手机**入镜（手机在镜子里可见）。**另一只手**最多做一个简单动作（撩衣、比耶、摸脸）；**禁止**写「某手刻意避开/不出镜」却未交代**哪只手举手机**；**禁止**写手臂伸向镜头/画面下角——对镜没有前置那种「伸臂自拍」视角。
  - 描述左右时写清是**镜面里看到的左右**（镜中画面左侧 = 角色右手），或**干脆不写左右**、只写「一手举手机、另一手撩起浴袍衣襟」，避免左右颠倒。
  - **禁止**同时安排：一手撩衣 + 一手避开镜头 + 未写谁拿手机；**禁止**对镜 prompt 里出现「一臂距离/前置/手臂伸展」。
  - **客户端校正**：有形象参考图且参考补充**未**写明「自拍角度参考」时，自拍/对镜成图后会自动**水平镜像**，以贴近前置摄像头与镜面的真实观感；参考图若本身就是自拍角度，请在形象特征补充里注明「自拍角度参考」以免二次翻转。
`.trim()

const SELFIE_APPEARANCE_BAN_WITH_REF =
  '**禁止写**脸型、五官形状、发型、发色、瞳色、肤色等固定外貌（由形象参考图锁定）。'

const SELFIE_EXAMPLE_FRONT_CLOSE_WITH_REFERENCE =
  'front camera selfie, POV lens shot, extreme close-up, face fills frame, white animal onesie pajamas, hood pulled up, fluffy round ears on hood, black leather choker, fluffy round neckline, slightly pursed lips, light blush on cheeks, gaze averted downward, messy silver hair strands, dim bedroom lamp'

const SELFIE_EXAMPLE_FRONT_ARM_WITH_REFERENCE =
  'front camera selfie, POV lens shot, arm-length distance, upper body, beige hoodie, bedroom window, soft afternoon window light, blurred pale wall, light blush on cheeks, lips slightly pursed, relaxed half-lidded eyes'

const SELFIE_EXAMPLE_FRONT_SHAKE_WITH_REFERENCE =
  'front camera selfie, POV lens shot, extreme close-up, motion blur, accidental phone shake, beige hoodie neckline visible, messy hair, red hair tie, soft blur on face edges, dim bedside lamp'

const SELFIE_EXAMPLE_MIRROR_WITH_REFERENCE =
  'bathroom mirror selfie, mirror reflection, upper body in mirror, misty steam haze, reference character one hand holding phone toward mirror, other hand pulling shirt collar, phone visible in mirror, warm white overhead light, flushed cheeks, averted gaze, lips slightly pursed'

const SELFIE_EXAMPLE_WITHOUT_REFERENCE =
  'front camera selfie, POV lens shot, arm-length distance, upper body, young man, silver hair, beige hoodie, indoor lamp light, warm-toned wall, faint smile, light blush on cheeks'

const SELFIE_RULE_WITH_REFERENCE = `
- **自拍（少数）**：仅当明确晒脸/对镜/front camera selfie。客户端已配置**形象参考图**；${SELFIE_APPEARANCE_BAN_WITH_REF}
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_THIRD_PERSON_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_DISTANCE_AND_MOTION_RULE}
${SELFIE_MODE_MUTUAL_EXCLUSION_RULE}
${SELFIE_HAND_AND_MIRROR_RULE}
  - 例（front·怼脸）：${SELFIE_EXAMPLE_FRONT_CLOSE_WITH_REFERENCE}
  - 例（front·arm-length）：${SELFIE_EXAMPLE_FRONT_ARM_WITH_REFERENCE}
  - 例（front·shake blur）：${SELFIE_EXAMPLE_FRONT_SHAKE_WITH_REFERENCE}
  - 例（mirror）：${SELFIE_EXAMPLE_MIRROR_WITH_REFERENCE}
`.trim()

const SELFIE_RULE_WITHOUT_REFERENCE = `
- **自拍（少数）**：仅当明确晒脸/对镜/front camera selfie；距离从 extreme close-up 到 arm-length（arm-length 为最远）。
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_THIRD_PERSON_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_DISTANCE_AND_MOTION_RULE}
${SELFIE_MODE_MUTUAL_EXCLUSION_RULE}
${SELFIE_HAND_AND_MIRROR_RULE}
  - 无参考图时**另须**写五官与外貌英文 tag 以稳定脸型。
  - 例：${SELFIE_EXAMPLE_WITHOUT_REFERENCE}
`.trim()

/** 聊天 `[图片]` 协议用的自拍规则（含 markdown 示例行） */
export function buildChatSelfieImageGenRule(hasAppearanceReference: boolean): string {
  if (hasAppearanceReference) {
    return `- **自拍（少数）**：仅当语境明确是晒脸/对镜/front camera selfie。客户端已配置**形象参考图**（可多张）；${SELFIE_APPEARANCE_BAN_WITH_REF}
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_THIRD_PERSON_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_DISTANCE_AND_MOTION_RULE}
${SELFIE_MODE_MUTUAL_EXCLUSION_RULE}
${SELFIE_HAND_AND_MIRROR_RULE}
- 示例（front·close-up）：\`[图片]${SELFIE_EXAMPLE_FRONT_CLOSE_WITH_REFERENCE}\`
- 示例（front·arm-length）：\`[图片]${SELFIE_EXAMPLE_FRONT_ARM_WITH_REFERENCE}\`
- 示例（front·motion blur）：\`[图片]${SELFIE_EXAMPLE_FRONT_SHAKE_WITH_REFERENCE}\`
- 示例（mirror）：\`[图片]${SELFIE_EXAMPLE_MIRROR_WITH_REFERENCE}\``
  }
  return `- **自拍（少数）**：仅当语境明确是晒脸/对镜/front camera selfie；距离 extreme close-up～arm-length；须写五官与外貌英文 tag。
${IMAGE_PROMPT_ENGLISH_ONLY_RULE}
${IMAGE_PROMPT_THIRD_PERSON_RULE}
${IMAGE_PROMPT_CONCRETE_VISUAL_RULE}
${SELFIE_EXPRESSION_WRITING_GUIDE}
${SELFIE_DISTANCE_AND_MOTION_RULE}
${SELFIE_MODE_MUTUAL_EXCLUSION_RULE}
${SELFIE_HAND_AND_MIRROR_RULE}
- 示例：\`[图片]${SELFIE_EXAMPLE_WITHOUT_REFERENCE}\``
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
- **非自拍（默认·first-person POV 随手拍）**：角色用手机**后置摄像头** first-person POV 拍镜头所见；勿写 I/my。
  - **① 空镜/风景** → 可无肢体入镜。
  - **② 露肢体** → own shoulders, arms, hands, thighs, legs, feet 等按举机角度入镜；**不是** front camera selfie、**不是** mirror selfie、**不是** third-person full-body portrait。
  - 例（平视·空镜）：\`first-person POV, eye level, rainy street after rain, neon reflected on wet pavement, overcast scattered light, road surface reflections, no human body parts in frame\`
  - 例（俯视·脚）：\`first-person POV, high angle looking down, orange cat crouching on floor tiles, white sneakers and jeans cuffs at bottom of frame, afternoon sunlight, warm tile reflection\`
  - 例（俯视·十指相扣）：\`first-person POV, high angle looking down, own mechanical metallic left hand, partner's delicate smaller hand, fingers interlaced, interlocked fingers, finger gaps visible between hands, wet beach sand directly below, warm golden light on sand grains, no horizon in frame\`
  - 例（平视·比耶+海）：\`first-person POV, eye level, peace sign, hand entering bottom-right of frame, sunset horizon over sea, golden rim side backlight\`
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

/** front camera selfie 须带 POV lens shot（中英自动补全） */
export function ensureFrontCameraSelfiePovLensTag(prompt: string): string {
  const s = prompt.trim()
  if (!s) return s
  const isFront =
    /前置摄像头自拍|前置自拍|front camera selfie/i.test(s)
  if (!isFront) return s
  if (/POV镜头|POV\s*lens/i.test(s)) return s
  if (/前置摄像头自拍|前置自拍/i.test(s)) {
    return s.replace(/(前置摄像头自拍|前置自拍)/, '$1，POV镜头')
  }
  return s.replace(/\bfront camera selfie\b/i, 'front camera selfie, POV lens shot')
}

/** 发往生图 API 前：统一 POV 措辞；中文残留会映射为英文 tag */
export function normalizeCharacterImageGenPromptForApi(prompt: string): string {
  let s = prompt.trim()
  if (!s) return s
  s = s.replace(/第一人称视角|第一视角/g, 'first-person POV')
  s = s.replace(/前置摄像头自拍|前置自拍/g, 'front camera selfie')
  s = s.replace(/参考图角色/g, 'reference character')
  s = s.replace(/自己的/g, 'own ')
  s = ensureFrontCameraSelfiePovLensTag(s)
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
