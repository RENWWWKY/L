import { normalizeCharacterImageGenPromptForApi } from './momentCharacterImageRules'
import {
  isCharacterMediaDualHandHoldingPrompt,
  isCharacterMediaFingerInterlockPrompt,
  isCharacterMediaFrontCameraSelfiePrompt,
  isCharacterMediaMirrorSelfiePrompt,
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

/** 英文 prompt：剔除前置摄像头自拍中的 mirror/phone-visible 误导词 */
export function stripFrontSelfieMirrorCueEnglish(prompt: string, inferencePrompt: string): string {
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

const FINGER_INTERLOCK_CANONICAL =
  'fingers interlaced, interlocked fingers, finger gaps visible between hands'

/** 十指相扣：替换模糊 intertwined/clasped，补全交叉扣入 tag */
export function fixFingerInterlockPromptParts(parts: string[], original: string): string[] {
  if (!isCharacterMediaFingerInterlockPrompt(original)) return parts
  const merged = parts.filter((part) => !VAGUE_INTERLOCK_PART_RE.test(part))
  const blob = merged.join(', ').toLowerCase()
  if (!/fingers interlaced|interlocked fingers|finger gaps visible|finger slots/i.test(blob)) {
    merged.push(FINGER_INTERLOCK_CANONICAL)
  }
  if (!blob.includes('not palm-over-palm clasp')) {
    merged.push('NOT palm-over-palm clasp', 'NOT one hand gripping on top')
  }
  return merged
}

const DUAL_HAND_CLARITY_TAGS = [
  'two separate people',
  'partner hand reaches from upper-right',
  'own hand enters from lower-left',
  'NOT self-holding',
  'NOT single body with two different arms',
] as const

function ensureDualHandHoldingClarity(parts: string[], original: string): string[] {
  if (!FIRST_PERSON_POV_RE.test(original) || !isCharacterMediaDualHandHoldingPrompt(original)) {
    return parts
  }
  const merged = [...parts]
  const blob = merged.join(', ').toLowerCase()
  for (const tag of DUAL_HAND_CLARITY_TAGS) {
    if (!blob.includes(tag.toLowerCase())) merged.push(tag)
  }
  return merged
}

/** 发往生图 API 前：清洗 `[图片]` 行噪声 tag */
export function sanitizeCharacterMediaImagePrompt(prompt: string): string {
  let s = normalizeCharacterImageGenPromptForApi(prompt)
  if (!s) return s
  s = s.replace(/十指相扣|十指交扣|指缝相扣/g, 'fingers interlaced, interlocked fingers, finger gaps visible between hands')
  s = fixFirstPersonPovHandOwnership(s)
  s = stripFrontSelfieMirrorCuePhrases(s)

  let parts = s
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(PROMPT_PART_TRIM_RE, '').trim())
    .filter((part) => part && !PROMPT_PART_BAN_RE.test(part))

  parts = stripGenericLightingTemplate(parts)
  parts = dropAbstractPsychologyParts(parts)
  parts = dropDistantScenicPartsForDownwardPov(parts, s)
  parts = dropGroundPartsForUpwardPov(parts, s)
  parts = ensureDualHandHoldingClarity(parts, s)
  parts = fixFingerInterlockPromptParts(parts, s)
  parts = dropFrontSelfiePhoneVisibleParts(parts, s)
  parts = dropFrontSelfieMirrorCueParts(parts, s)

  s = parts.join(', ')
  return s.replace(/\s+/g, ' ').replace(/,{2,}/g, ',').trim()
}
