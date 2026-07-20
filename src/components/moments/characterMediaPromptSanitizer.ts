import { normalizeCharacterImageGenPromptForApi } from './momentCharacterImageRules'
import {
  CHARACTER_MEDIA_SELFIE_PREFIX_RE,
  hasCharacterMediaSelfiePrefix,
  stripCharacterMediaSelfiePrefix,
} from './characterMediaSelfiePrefix'
import {
  isCharacterMediaCharacterFaceVisiblePrompt,
  isCharacterMediaDualHandHoldingPrompt,
  isCharacterMediaDualPersonIntimatePrompt,
  isCharacterMediaFingerInterlockPrompt,
  isCharacterMediaFirstPersonBodyPrompt,
  isCharacterMediaFrontCameraSelfiePrompt,
  isCharacterMediaHandFocusPrompt,
  isCharacterMediaMirrorSelfiePrompt,
  isCharacterMediaPalmToPalmHoldingPrompt,
  isCharacterMediaPhotographingOthersPrompt,
  isCharacterMediaSelfiePrompt,
} from './momentsImagePromptEnhancer'

const PROMPT_PART_BAN_RE =
  /^(?:8k|4k|超清|高清|最佳画质|masterpiece|ultra[\s-]?detailed|best quality|highres)$/i

const PROMPT_PART_TRIM_RE =
  /(?:稍微|轻轻|微微|略微|颇|较为|稍稍|隐约|正在|试图|已经|接下来|将要|气氛安静|画面唯美|充满张力|细节拉满|seemingly|vaguely|slightly(?=\s+(?:ashamed|timid|shy))|apparently)/i

/** 心理/抽象/不可拍 tag（整块剔除） */
const ABSTRACT_PSYCHOLOGY_PART_RE =
  /不敢|羞耻|顺从|局促|委屈|脆弱|慵懒|温顺|暧昧|气质|神情|眼底柔光|眼神湿漉漉|湿漉漉|呼吸感|燥热|被咬|有些红肿|充满.{0,4}感|心里|内心|似乎|好像|气氛|氛围|张力|情感连接|emotional connection|dare not|ashamed|obedient|timid|vulnerable|dreamy gaze|moist eyes|wet gaze|hot breath|breathing sense|feeling of|sense of tension|psychological|emotional atmosphere|cinematic mood|aura of/i

/** 易被模型照搬的固定氛围套餐（出现多个时客户端会剔除） */
const GENERIC_LIGHTING_TEMPLATE_PARTS = [
  '低亮度暗环境',
  '局部轮廓光',
  '微弱侧光',
  '虚化暗背景',
  '电影感光影',
] as const

function stripGenericLightingTemplate(parts: string[]): string[] {
  const hits = parts.filter((part) =>
    GENERIC_LIGHTING_TEMPLATE_PARTS.some((cliche) => part.includes(cliche)),
  )
  if (hits.length < 3) return parts
  return parts.filter(
    (part) => !GENERIC_LIGHTING_TEMPLATE_PARTS.some((cliche) => part.includes(cliche)),
  )
}

const FRONT_SELFIE_MIRROR_CUE_PART_RE =
  /镜子|镜面|镜中|镜前|对镜|化妆镜|穿衣镜|全身镜|浴室镜|墙面.*(?:镜|反光)|反光.*(?:镜|墙|墙面)|镜面反光|玻璃倒影|mirror|reflection in mirror|vanity mirror|makeup mirror/i

/** 前置摄像头自拍里「举着手机」等描述会误导生图模型画成对镜自拍 */
const FRONT_SELFIE_PHONE_VISIBLE_PART_RE =
  /举着?手机|举手机|拿着手机|手机入镜|手机在镜|手机对准|一手举手机|phone visible|holding smartphone|holding phone toward/i

/** 后置/第一视角拍他人时：手机、取景框、双手举机等「正在拍摄」元构图 */
const REAR_POV_PHONE_META_PART_RE =
  /举着?手机|拿着手机|手机入镜|手机在画|手机对准|双手|两手|phone screen|viewfinder|camera app|camera interface|shutter button|smartphone in foreground|hands holding phone|holding smartphone|phone visible|taking photo|photographing|正在拍|拍照中|取景框|相机界面/i

const FRONT_SELFIE_PHONE_VISIBLE_INLINE_RE =
  /另一只手(?:正|在|别扭地)?(?:举着?|拿着)?手机(?:拍(?:照|相)?)?/g

const FRONT_SELFIE_PHONE_VISIBLE_INLINE_RE_2 =
  /(?:^|[，。；、\s])?(?:一只|另一|一)手(?:正|在|别扭地)?(?:举着?|拿着)?手机(?:拍(?:镜|照|相)?)?/g

const FRONT_SELFIE_PHONE_VISIBLE_INLINE_RE_3 = /(?:举着?|拿着)手机(?:拍(?:镜|照|相)?)?/g

/** 前置摄像头自拍 prompt：剔除会触发对镜构图的手机可见描述（中文） */
export function stripFrontSelfieMirrorCuePhrases(prompt: string): string {
  if (!isCharacterMediaFrontCameraSelfiePrompt(prompt)) return prompt
  let s = prompt.trim()
  s = s.replace(FRONT_SELFIE_PHONE_VISIBLE_INLINE_RE, '')
  s = s.replace(FRONT_SELFIE_PHONE_VISIBLE_INLINE_RE_2, '')
  if (!isCharacterMediaMirrorSelfiePrompt(s)) {
    s = s.replace(FRONT_SELFIE_PHONE_VISIBLE_INLINE_RE_3, '')
  }
  s = s.replace(/手机在镜中可见/g, '')
  s = s.replace(/镜前(?:暖白)?灯/g, '台灯')
  s = s.replace(/镜面水汽/g, '')
  return s.replace(/[，,]{2,}/g, '，').replace(/^[，,\s]+|[，,\s]+$/g, '').trim()
}

function dropFrontSelfieMirrorCueParts(parts: string[], original: string): string[] {
  if (!isCharacterMediaFrontCameraSelfiePrompt(original)) return parts
  return parts.filter((part) => !FRONT_SELFIE_MIRROR_CUE_PART_RE.test(part))
}

function dropFrontSelfiePhoneVisibleParts(parts: string[], original: string): string[] {
  if (!isCharacterMediaFrontCameraSelfiePrompt(original)) return parts
  return parts.filter((part) => !FRONT_SELFIE_PHONE_VISIBLE_PART_RE.test(part))
}

const AUTO_INJECTED_POV_OR_PHONE_PART_RE =
  /first[- ]person POV|first person POV|POV lens(?: shot)?|front[- ]facing|front camera(?: selfie)?|smartphone POV|smartphone selfie|smartphone lens|phone camera|rear camera|handheld snapshot|viewer IS the|authentic first-person|natural eye-level smartphone|immersive handheld|viewfinder|camera UI|shutter button|phone screen|phone visible|smartphone visible|smartphone in (?:frame|foreground|hand)|holding smartphone|holding phone toward|picture-in-picture|画中画|手机框|取景框|前置摄像头|第一人称|第一视角|后置摄像头|随手拍/i
/** 后置/自拍：剔除 POV/机位/手机镜头 meta tag（客户端不再自动补全，LLM 误写也去掉） */
const REAR_CAMERA_POV_META_PART_RE =
  /^(?:first[- ]person POV|first person POV|eye level|rear camera|POV lens(?: shot)?|handheld snapshot|smartphone POV|authentic first-person|natural eye-level|looking down|looking up|high angle looking down|low angle looking up|slight high angle(?: looking down)?|第一人称(?:视角)?|第一视角|平视|俯视|仰视|后置摄像头|随手拍)$/i

function shouldDropDirectScenePovMeta(original: string): boolean {
  if (isCharacterMediaFrontCameraSelfiePrompt(original) || isCharacterMediaMirrorSelfiePrompt(original)) {
    return false
  }
  if (hasCharacterMediaSelfiePrefix(original)) return false
  if (isCharacterMediaPhotographingOthersPrompt(original)) return true
  if (isCharacterMediaFirstPersonBodyPrompt(original)) return false
  return /风景|街景|窗外|夜景|城市|landscape|scenery|street|horizon|sunset|海|湖|山|路|公园|雨后|霓虹|空镜|no human body parts/i.test(
    original,
  )
}

function dropDirectScenePovMetaParts(parts: string[], original: string): string[] {
  if (!shouldDropDirectScenePovMeta(original)) return parts
  return parts.filter((part) => !REAR_CAMERA_POV_META_PART_RE.test(part.trim()))
}

function dropRearPovPhoneMetaParts(parts: string[], original: string): string[] {
  if (isCharacterMediaFrontCameraSelfiePrompt(original) || isCharacterMediaMirrorSelfiePrompt(original)) {
    return parts
  }
  if (!FIRST_PERSON_POV_RE.test(original) && !isCharacterMediaPhotographingOthersPrompt(original)) {
    return parts
  }
  return parts.filter((part) => !REAR_POV_PHONE_META_PART_RE.test(part))
}

function dropAutoInjectedPovOrPhoneParts(parts: string[]): string[] {
  return parts.filter((part) => !AUTO_INJECTED_POV_OR_PHONE_PART_RE.test(part.trim()))
}

function ensurePhotographOthersDirectViewParts(parts: string[], _original: string): string[] {
  return parts
}

/** 英文 prompt：剔除前置摄像头自拍中的 mirror/phone-visible 误导词 */
export function stripFrontSelfieMirrorCueEnglish(prompt: string, inferencePrompt: string): string {
  if (hasCharacterMediaSelfiePrefix(inferencePrompt)) return prompt.trim()
  if (!isCharacterMediaFrontCameraSelfiePrompt(inferencePrompt)) return prompt
  let s = prompt
  const englishPatterns: RegExp[] = [
    /\bother hand holding smartphone\b/gi,
    /\bone hand holding smartphone\b/gi,
    /\bholding smartphone toward mirror\b/gi,
    /\bholding phone toward mirror\b/gi,
    /\bphone visible in mirror\b/gi,
    /\bsmartphone visible in (?:mirror|reflection|frame)\b/gi,
    /\bholding smartphone\b/gi,
    /\bholding phone\b/gi,
    /\bphone visible\b/gi,
    /\bsmartphone in hand\b/gi,
    /\bmirror reflection\b/gi,
    /\bmirror selfie\b/gi,
    /\bin mirror reflection\b/gi,
    /\bvanity mirror\b/gi,
    /\bmakeup mirror\b/gi,
    /\bbathroom mirror\b/gi,
    /\bwall mirror\b/gi,
    /\breflective (?:wall|tile|glass|surface)\b/gi,
    /\bglossy wall reflection\b/gi,
    /\breflected duplicate face\b/gi,
  ]
  for (const re of englishPatterns) {
    s = s.replace(re, '')
  }
  if (FIRST_PERSON_POV_RE.test(inferencePrompt) && !isCharacterMediaMirrorSelfiePrompt(inferencePrompt)) {
    const rearMetaPatterns: RegExp[] = [
      /\bhands holding (?:a )?smartphone\b/gi,
      /\btwo hands holding phone\b/gi,
      /\bphone screen showing\b/gi,
      /\bcamera app interface\b/gi,
      /\bviewfinder overlay\b/gi,
      /\bshutter button\b/gi,
      /\btaking (?:a )?photo of\b/gi,
      /\bphotographing with smartphone\b/gi,
      /\bsmartphone in foreground\b/gi,
    ]
    for (const re of rearMetaPatterns) {
      s = s.replace(re, '')
    }
  }
  return s.replace(/,\s*,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').replace(/\s+/g, ' ').trim()
}

function dropAbstractPsychologyParts(parts: string[]): string[] {
  return parts.filter((part) => !ABSTRACT_PSYCHOLOGY_PART_RE.test(part))
}

const FIRST_PERSON_POV_RE = /first-person POV|first person POV|第一人称|第一视角/i
const DOWNWARD_POV_RE =
  /looking down|high angle looking down|slight high angle(?: looking down)?|俯视|低头|俯拍|略俯视/i
const UPWARD_POV_RE =
  /looking up|low angle looking up|仰视|抬头看|抬头/i
const DISTANT_SCENIC_PART_RE =
  /\b(?:horizon|skyline|seascape|panoramic(?: view)?|ocean view|distant (?:sea|ocean|waves)|soft focus on horizon|lens flare on horizon|sunset over (?:sea|ocean)|beach background|gentle sea waves|sea waves|waves rolling|rolling waves)\b/i
const GROUND_SURFACE_PART_RE =
  /wet sand|sand (?:grains|at feet|beneath|directly below)|floor tiles|pavement|ground (?:below|beneath|at feet)|tide foam|shallow (?:water|foam) on sand|directly below|at (?:my )?feet|bedsheets|tiles beneath|shoes at bottom|sneakers at bottom|jeans cuffs at bottom/i

/** first-person POV 举机者手部措辞：reference character's hand → own hand */
export function fixFirstPersonPovHandOwnership(prompt: string): string {
  if (!FIRST_PERSON_POV_RE.test(prompt)) return prompt
  let s = prompt
  s = s.replace(
    /\breference character(?:'s|s)?\s+((?:(?:mechanical|metallic|metal|left|right)\s+)*hand)\b/gi,
    'own $1',
  )
  s = s.replace(
    /\buser(?:'s|s)?\s+((?:(?:soft|delicate|small|smaller)\s+)*hand)\b/gi,
    "partner's $1",
  )
  s = s.replace(
    /\byour\s+((?:(?:soft|delicate|small|smaller)\s+)*hand)\b/gi,
    "partner's $1",
  )
  return s.replace(/\s+/g, ' ').trim()
}

function dropDistantScenicPartsForDownwardPov(parts: string[], original: string): string[] {
  if (!FIRST_PERSON_POV_RE.test(original) || !DOWNWARD_POV_RE.test(original)) return parts
  const filtered = parts.filter((part) => !DISTANT_SCENIC_PART_RE.test(part))
  const hadBeach = /beach|sand|sea|ocean|tide|shore|日落|沙滩|海/i.test(original)
  const hasGround = filtered.some((p) => GROUND_SURFACE_PART_RE.test(p))
  if (hadBeach && !hasGround) {
    filtered.push(
      'wet beach sand directly below',
      'warm golden light on sand grains',
      'no horizon in frame',
    )
  } else if (!hasGround && /holding hand|intertwined|fingers intertwined|牵手|握(?:着|住).*手/i.test(original)) {
    filtered.push('ground surface directly below hands', 'no horizon in frame')
  }
  return filtered
}

function dropGroundPartsForUpwardPov(parts: string[], original: string): string[] {
  if (!FIRST_PERSON_POV_RE.test(original) || !UPWARD_POV_RE.test(original)) return parts
  return parts.filter((part) => !GROUND_SURFACE_PART_RE.test(part))
}

const VAGUE_INTERLOCK_PART_RE =
  /\b(?:intertwined|holding hand|hand in hand|clasped(?: together)?|hands clasped|gripping (?:on top|partner)|palm[- ]over[- ]palm|simple (?:hand )?hold|firmly holding)\b/i

const FINGER_INTERLOCK_CANONICAL = 'fingers interlaced, joints clearly visible'

/** 手心相牵（掌心相对、手指不交叉） */
const PALM_TO_PALM_CANONICAL =
  'palm-to-palm hold, palms pressed gently together, fingers not interlaced, thumbs resting along outer sides'

/** 手指数量与手形硬规范（防缺指/多指/融指） */
const HAND_ANATOMY_CANONICAL =
  'each hand has exactly 5 fingers including thumb, ten distinct fingertips when both hands shown, anatomically correct human hands, correct finger count, clear finger separation, natural finger joints, no missing fingers, no extra fingers, no fused fingers, no truncated fingers, no deformed fingers'

/** 十指相扣：替换模糊 intertwined/clasped，补全交叉扣入 tag */
export function fixFingerInterlockPromptParts(parts: string[], original: string): string[] {
  if (!isCharacterMediaFingerInterlockPrompt(original)) return parts
  const merged = parts.filter((part) => !VAGUE_INTERLOCK_PART_RE.test(part))
  const blob = merged.join(', ').toLowerCase()
  if (!/fingers interlaced|interlocked fingers/i.test(blob)) {
    merged.push(FINGER_INTERLOCK_CANONICAL)
  }
  return merged
}

/** 手心相牵：补全掌心相对 tag，去掉十指交叉词 */
export function fixPalmToPalmHoldingPromptParts(parts: string[], original: string): string[] {
  if (!isCharacterMediaPalmToPalmHoldingPrompt(original)) return parts
  const merged = parts.filter(
    (part) =>
      !/\bfingers interlaced\b|\binterlocked fingers\b|\bfinger gaps visible\b|\bfinger slots\b|\bfingers intertwined\b/i.test(
        part,
      ),
  )
  const blob = merged.join(', ').toLowerCase()
  if (!/palm-to-palm|palms pressed|fingers not interlaced/i.test(blob)) {
    merged.push(PALM_TO_PALM_CANONICAL)
  }
  if (!blob.includes('not fingers interlaced') && !/fingers not interlaced/i.test(blob)) {
    merged.push('NOT fingers interlaced', 'NOT interlocked fingers')
  }
  return merged
}

/** 手部特写：补手指数量规范；十指相扣按模版，不堆手指数量 */
export function ensureHandAnatomyPromptParts(parts: string[], original: string): string[] {
  if (!isCharacterMediaHandFocusPrompt(original) && !isCharacterMediaDualHandHoldingPrompt(original)) {
    return parts
  }
  // 十指相扣：按用户模版，不再注入手指数量硬规范
  if (isCharacterMediaFingerInterlockPrompt(original)) return parts
  const blob = parts.join(', ').toLowerCase()
  if (/exactly 5 fingers|ten distinct fingertips|no missing fingers|anatomically correct human hands/i.test(blob)) {
    return parts
  }
  return [...parts, HAND_ANATOMY_CANONICAL]
}

const DUAL_HAND_CLARITY_TAGS = [
  'two separate people',
  'partner hand reaches from upper-right',
  'own hand enters from lower-left',
  'NOT self-holding',
  'NOT single body with two different arms',
] as const

/** 不露脸牵手特写：强调两只手，避免 “two separate people” 被画成双人半身 */
const DUAL_HAND_ONLY_CLARITY_TAGS = [
  'two separate hands from two people',
  'only hands and forearms in frame',
  'partner hand reaches from upper-right',
  'own hand enters from lower-left',
  'NOT self-holding',
  'NOT single body with two different arms',
  'NOT two people sitting',
  'NOT upper bodies visible',
] as const

function dropMisleadingCloseUpForDualIntimate(parts: string[], original: string): string[] {
  if (!isCharacterMediaDualPersonIntimatePrompt(original) || hasCharacterMediaSelfiePrefix(original)) {
    return parts
  }
  // 牵手/不露脸特写需要保留 close-up，不能当成「双人半身」误删
  if (
    !isCharacterMediaCharacterFaceVisiblePrompt(original) &&
    (isCharacterMediaDualHandHoldingPrompt(original) ||
      isCharacterMediaFingerInterlockPrompt(original) ||
      /\bno faces?\b|不露脸|手部特写|双手特写/i.test(original))
  ) {
    return parts
  }
  return parts.filter(
    (part) => !/\bclose-up\b|特写|怼脸|face fills (?:most of )?frame|extreme close-up|headshot|portrait only/i.test(part.trim()),
  )
}

const SELFIE_FACE_VISIBLE_RE =
  /\b(?:face|lips|eyes|cheeks|blush|gaze|smile|grin|pout|looking at camera|parted lips|averted gaze|eyebrows|chin|nose|forehead|collarbone in frame)\b|露脸|面部|脸颊|嘴唇|眼神|微嘟|抿嘴/i

const SELFIE_EXPLICIT_CLOSEUP_INTENT_RE =
  /\b(?:extreme close-up|face fills (?:most of )?frame|怼脸|极近(?:距离)?|贴近镜头|想(?:要)?(?:拍)?特写|这个部位|部位特写)\b|特写(?:脸|面部|这个|某部位|某处|下面|那里)/i

const SELFIE_CLOSEUP_TAG_RE =
  /\bclose-up\b|特写|怼脸|extreme close-up|face fills (?:most of )?frame|facial close-up|medium close-up|\bclose-up on\b/i

const SELFIE_FACE_CLOSEUP_TAG_RE =
  /\bclose-up\s+face\b|extreme close-up(?:\s+face)?|facial close-up|face fills (?:most of )?frame|怼脸|极近距离/i

const SELFIE_BODY_CLOSEUP_TAG_RE =
  /\bclose-up\s+(?:abs|ab|chest|torso|genitals|crotch|nipples|waist|hips|butt|ass|thighs|legs|feet|hands|midriff|belly|stomach)\b|\bclose-up on\b/i

/** 自拍：默认常规距离；仅保留角色明确要特写的 tag；露脸时剔除部位特写避免冲突 */
function sanitizeSelfieCloseUpParts(parts: string[], original: string): string[] {
  const isSelfie =
    hasCharacterMediaSelfiePrefix(original) ||
    isCharacterMediaSelfiePrompt(original) ||
    isCharacterMediaMirrorSelfiePrompt(original)
  if (!isSelfie) return parts

  const explicitIntent = SELFIE_EXPLICIT_CLOSEUP_INTENT_RE.test(original)
  const hasFaceVisible = SELFIE_FACE_VISIBLE_RE.test(original)

  return parts
    .map((part) => {
      let t = part.trim()
      if (!t) return t
      if (!SELFIE_CLOSEUP_TAG_RE.test(t)) return t
      if (hasFaceVisible && SELFIE_BODY_CLOSEUP_TAG_RE.test(t)) return ''
      if (SELFIE_FACE_CLOSEUP_TAG_RE.test(t) && !explicitIntent) return ''
      if (SELFIE_BODY_CLOSEUP_TAG_RE.test(t) && !explicitIntent && hasFaceVisible) return ''
      if (/^(?:close-up|close up|特写)$/i.test(t) && !explicitIntent) return ''
      if (/\bclose-up\b|特写|怼脸|extreme close-up|facial close-up|medium close-up/i.test(t) && !explicitIntent) {
        if (SELFIE_BODY_CLOSEUP_TAG_RE.test(t) && !hasFaceVisible) return t
        return ''
      }
      return t
    })
    .filter(Boolean)
}

function ensureDualHandHoldingClarity(parts: string[], original: string): string[] {
  if (!isCharacterMediaDualHandHoldingPrompt(original)) {
    return parts
  }
  const handsOnlyNoFace =
    !isCharacterMediaCharacterFaceVisiblePrompt(original) ||
    /\bno faces?\b|不露脸|手部特写|双手特写/i.test(original)
  const tags = handsOnlyNoFace ? DUAL_HAND_ONLY_CLARITY_TAGS : DUAL_HAND_CLARITY_TAGS
  // 不露脸时去掉易被画成双人半身的 “two separate people”
  const stripped = handsOnlyNoFace
    ? parts.filter((part) => !/^two separate people$/i.test(part.trim()))
    : [...parts]
  // 非第一人称牵手也清理误导词；补充方向 tag 仅在第一人称时追加
  if (!FIRST_PERSON_POV_RE.test(original) && !handsOnlyNoFace) {
    return stripped
  }
  if (!FIRST_PERSON_POV_RE.test(original) && handsOnlyNoFace) {
    const next = [...stripped]
    const blob = next.join(', ').toLowerCase()
    for (const tag of [
      'two separate hands from two people',
      'only hands and forearms in frame',
      'NOT two people sitting',
      'NOT upper bodies visible',
    ] as const) {
      if (!blob.includes(tag.toLowerCase())) next.push(tag)
    }
    return next
  }
  const next = [...stripped]
  const nextBlob = next.join(', ').toLowerCase()
  for (const tag of tags) {
    if (!nextBlob.includes(tag.toLowerCase())) next.push(tag)
  }
  return next
}

function sanitizeCharacterMediaImagePromptParts(parts: string[], original: string): string[] {
  let cleaned = parts
  cleaned = stripGenericLightingTemplate(cleaned)
  cleaned = dropAbstractPsychologyParts(cleaned)
  cleaned = dropDistantScenicPartsForDownwardPov(cleaned, original)
  cleaned = dropGroundPartsForUpwardPov(cleaned, original)
  cleaned = dropMisleadingCloseUpForDualIntimate(cleaned, original)
  cleaned = sanitizeSelfieCloseUpParts(cleaned, original)
  cleaned = ensureDualHandHoldingClarity(cleaned, original)
  cleaned = fixFingerInterlockPromptParts(cleaned, original)
  cleaned = fixPalmToPalmHoldingPromptParts(cleaned, original)
  cleaned = ensureHandAnatomyPromptParts(cleaned, original)
  cleaned = dropFrontSelfiePhoneVisibleParts(cleaned, original)
  cleaned = dropRearPovPhoneMetaParts(cleaned, original)
  cleaned = dropAutoInjectedPovOrPhoneParts(cleaned)
  cleaned = dropDirectScenePovMetaParts(cleaned, original)
  cleaned = dropFrontSelfieMirrorCueParts(cleaned, original)
  cleaned = ensurePhotographOthersDirectViewParts(cleaned, original)
  return cleaned
}

/** 发往生图 API 前：清洗 `[图片]` 行噪声 tag */
export function sanitizeCharacterMediaImagePrompt(prompt: string): string {
  let s = normalizeCharacterImageGenPromptForApi(prompt)
  if (!s) return s

  let selfiePrefix = ''
  if (hasCharacterMediaSelfiePrefix(s)) {
    const prefixMatch = CHARACTER_MEDIA_SELFIE_PREFIX_RE.exec(s)
    selfiePrefix = prefixMatch?.[0]?.trim() ?? ''
    s = stripCharacterMediaSelfiePrefix(s)
  }

  s = stripCharacterMediaAppearanceBlockFromPrompt(s)
  s = s.replace(/十指相扣|十指交扣|指缝相扣/g, 'fingers interlaced, joints clearly visible')
  s = s.replace(
    /手心相牵|掌心相贴|掌心相对|手心相握|掌心相握/g,
    'palm-to-palm hold, palms pressed gently together, fingers not interlaced',
  )
  s = fixFirstPersonPovHandOwnership(s)
  s = stripFrontSelfieMirrorCuePhrases(s)

  let parts = s
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(PROMPT_PART_TRIM_RE, '').trim())
    .filter((part) => part && !PROMPT_PART_BAN_RE.test(part))

  parts = sanitizeCharacterMediaImagePromptParts(parts, s)

  s = parts.join(', ')
  s = s.replace(/\s+/g, ' ').replace(/,{2,}/g, ',').trim()

  if (selfiePrefix) return `${selfiePrefix} ${s}`.trim()
  return s
}

const APPEARANCE_BLOCK_RE = /\s*The character appearance\s*:[\s\S]*$/i
const WECHAT_IMAGE_GEN_LINE_RE = /^\[图片\]\s*(.+)$/i

/** 模型误把外貌块单独成行（非 `[图片]` 行） */
export function isCharacterMediaOrphanAppearanceLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t || WECHAT_IMAGE_GEN_LINE_RE.test(t)) return false
  return /^The character appearance\s*:/i.test(t)
}

/** 从生图 prompt 去掉 LLM 误写的外貌块（客户端会静默注入） */
export function stripCharacterMediaAppearanceBlockFromPrompt(prompt: string): string {
  let s = String(prompt ?? '').trim()
  if (!s) return s
  s = s.replace(APPEARANCE_BLOCK_RE, '')
  return s.replace(/\s+/g, ' ').trim()
}

/** 清洗单条气泡：丢弃 orphan 外貌块；`[图片]` 行去掉末尾外貌块 */
export function sanitizeCharacterMediaImageGenBubbleText(text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  if (isCharacterMediaOrphanAppearanceLine(t)) return null
  const m = WECHAT_IMAGE_GEN_LINE_RE.exec(t)
  if (m) {
    const scene = stripCharacterMediaAppearanceBlockFromPrompt(m[1]!.trim())
    return scene ? `[图片]${scene}` : null
  }
  return t
}

export function sanitizeCharacterMediaImageGenBubbles(bubbles: string[]): string[] {
  return bubbles
    .map((b) => sanitizeCharacterMediaImageGenBubbleText(String(b ?? '')))
    .filter((t): t is string => Boolean(t))
}
const APPEARANCE_INJECTION_RES: RegExp[] = [
  /,\s*character appearance traits\s*:[\s\S]*$/i,
  /,\s*mandatory character identity traits from user reference notes[\s\S]*$/i,
  /,\s*character design traits from reference notes for visible parts only\s*:[\s\S]*$/i,
  /,\s*consistent character appearance\s*:[\s\S]*$/i,
  /,\s*subject must be (?:male|female)[\s\S]*$/i,
]

/** 控制台/调试：仅展示英文场景 prompt，隐藏外貌块与后台注入 tag */
export function formatCharacterMediaImagePromptForConsoleLog(prompt: string): string {
  let s = String(prompt ?? '').trim()
  if (!s) return s
  if (hasCharacterMediaSelfiePrefix(s)) s = stripCharacterMediaSelfiePrefix(s)
  s = s.replace(APPEARANCE_BLOCK_RE, '')
  for (const re of APPEARANCE_INJECTION_RES) {
    s = s.replace(re, '')
  }
  s = s.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/g, '')
  s = s.replace(/\*\s*\*\*[^*]*\*\*\s*:/g, '')
  s = s.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^,\s*|\s*,$/g, '').trim()
  return s
}

/** 控制台：格式化气泡；隐藏 orphan 外貌块与 `[图片]` 内外貌特征 */
export function formatWeChatBubbleForAiConsoleLog(line: string): string {
  const trimmed = String(line ?? '').trim()
  if (!trimmed) return trimmed
  if (isCharacterMediaOrphanAppearanceLine(trimmed)) return '(hidden appearance)'
  return formatCharacterImageGenLineForConsoleLog(trimmed)
}

/** 控制台：格式化整条 `[图片]` 行（保留前缀，隐藏外貌特征） */
export function formatCharacterImageGenLineForConsoleLog(line: string): string {
  const trimmed = String(line ?? '').trim()
  const m = /^\[图片\]\s*(.+)$/.exec(trimmed)
  if (!m) return trimmed
  const scene = formatCharacterMediaImagePromptForConsoleLog(m[1]!.trim())
  return scene ? `[图片] ${scene}` : '[图片]'
}
