import { getPollinationsStylePreset, resolveStylePrefix } from './pollinationsPresets'
import { resolveCommonExtraPositivePrompt, resolveProviderPromptSettings } from './imageGenProviderPromptSettings'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'
import { modelSupportsReferenceImageUploadFromSettings } from './imageGenModelCapabilities'
import { hasCharacterMediaSelfiePrefix } from './characterMediaSelfiePrefix'

const PERSON_HINT =
  /\b(person|people|portrait|face|selfie|girl|boy|man|woman|character|human|male|female|student|boyfriend|girlfriend|couple)\b/i

const ANIME_STYLE_HINT = /\banime\b|illustration|2d|cel shading|二次元/i

function isAnimeStyle(settings: MomentsImageGenSettings, combinedPrompt: string): boolean {
  if (ANIME_STYLE_HINT.test(combinedPrompt)) return true
  const extraPositive = resolveCommonExtraPositivePrompt(
    resolveProviderPromptSettings(settings).common,
  )
  if (extraPositive && ANIME_STYLE_HINT.test(extraPositive)) return true
  if (settings.stylePrefixMode === 'preset') {
    const preset = getPollinationsStylePreset(settings.stylePresetId)
    if (preset?.id === 'anime') return true
  }
  if (settings.stylePrefixMode === 'custom') {
    return ANIME_STYLE_HINT.test(settings.customStylePrefix)
  }
  return false
}

function hasPersonSubject(prompt: string): boolean {
  return PERSON_HINT.test(prompt) || /人|脸|肖像|自拍|男生|女生|少年|少女|青年/.test(prompt)
}

const ANIME_FACE_SUFFIX =
  'beautiful anime face, detailed expressive eyes, delicate facial features, well-proportioned face, attractive, clean linework, NOT ugly, NOT deformed face, NOT bad anatomy'

const REALISTIC_FACE_SUFFIX =
  'beautiful face, detailed facial features, symmetrical face, clear eyes, natural skin texture, attractive, NOT ugly, NOT deformed face, NOT bad anatomy'

const ANIME_ANTI_REALISTIC =
  'NOT photorealistic, NOT realistic photo, NOT DSLR, NOT 3d render, NOT hyperrealistic'

const SELFIE_HINT =
  /\b(?:selfie shot|mirror selfie shot|selfie|self[\s-]?portrait|mirror selfie|front camera)\b|\[wx-selfie\||\[SUBJECT:PERSON_ACTION|自拍|对镜|前置摄像头|镜面自拍/i

const MIRROR_SELFIE_HINT =
  /\b(?:mirror selfie shot|mirror selfie|mirror shot|in front of (?:a )?mirror|bathroom mirror|reflection in mirror|mirror reflection)\b|对镜|镜面|镜子前|浴室镜|全身镜|镜中|镜面反射|镜子里/i

/** 角色私聊/群聊/朋友圈：模型描述是否为自拍（含人物正脸/对镜） */
export function isCharacterMediaSelfiePrompt(prompt: string): boolean {
  return SELFIE_HINT.test(prompt.trim())
}

/** 对镜自拍（镜面反射构图，非前置一臂距离） */
export function isCharacterMediaMirrorSelfiePrompt(prompt: string): boolean {
  return MIRROR_SELFIE_HINT.test(prompt.trim())
}

/** 前置摄像头自拍（非对镜） */
export function isCharacterMediaFrontCameraSelfiePrompt(prompt: string): boolean {
  if (!isCharacterMediaSelfiePrompt(prompt)) return false
  if (isCharacterMediaMirrorSelfiePrompt(prompt)) return false
  const p = prompt.trim()
  if (hasCharacterMediaSelfiePrefix(p) && /\bselfie shot\b/i.test(p)) return true
  return /前置摄像头自拍|前置自拍|前置摄像头|front[-\s]?facing|front camera/i.test(p)
}

/** 第一视角随手拍（后置摄像头·非前置摄像头自拍/对镜）——非自拍 prompt 的默认路径 */
export function isCharacterMediaHandheldFirstPersonPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  return !isCharacterMediaSelfiePrompt(p) && !isCharacterMediaMirrorSelfiePrompt(p)
}

const OTHER_PERSON_SUBJECT_RE =
  /\b(?:young woman|young man|1girl|1boy|woman|man|girl|boy|female|male|stranger|passerby|friend|partner|colleague|woman in|man in|sitting on|standing on|leaning on|swimsuit|bikini|one-piece|dress)\b|女生|男生|女人|男人|少女|青年女|青年男|陌生人|朋友|对方|泳衣|比基尼/i

/** 第一视角 rear camera 拍他人/他物主体（成品照视角，非「正在举机拍摄」） */
export function isCharacterMediaPhotographingOthersPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaSelfiePrompt(p)) return false
  if (isCharacterMediaMirrorSelfiePrompt(p)) return false
  if (isCharacterMediaFirstPersonBodyPrompt(p)) return false
  if (!OTHER_PERSON_SUBJECT_RE.test(p)) return false
  if (SCENIC_ONLY_HINT.test(p) && isCharacterMediaFirstPersonBodyPrompt(p)) return false
  if (SCENIC_ONLY_HINT.test(p) && !OTHER_PERSON_SUBJECT_RE.test(p)) return false
  return true
}

const SCENIC_ONLY_HINT =
  /风景|街景|窗外|夜景|城市|landscape|scenery|street|horizon|sunset|海(?!报)|湖|山|路|林荫|天际线|江|河|公园|雨后街道|霓虹倒映|无人物肢体入镜|no human body parts in frame/i

/** 第一视角且画面含角色自身肢体/身体（非纯风景空镜） */
export function isCharacterMediaFirstPersonBodyPrompt(prompt: string): boolean {
  if (isCharacterMediaSelfiePrompt(prompt)) return false
  const p = prompt.trim()
  const bodyVisible =
    /第一人称视角|第一视角|随手拍|后置|first-person POV|first person POV|rear camera|handheld snapshot|自己的(?:手|臂|手臂|肩|腿|脚|胸|腹|背|脸|身体|指尖|锁骨|大腿|小腿|腰|臀|裆|裤裆|唇)|角色.{0,8}(?:手|臂|手臂|肩|腿|脚|脸|胸|腹|背|锁骨|身体|指尖|大腿|小腿|腰|臀|裆)|own (?:left |right )?(?:mechanical |metallic |metal )?hand|partner(?:'s|s)? hand|holding hand|intertwined|fingers intertwined|低头看(?:自己|手|腿|胸|床)|卧床|躺在床上|床上的视角|腰部以下|略俯视|画面.{0,8}(?:手|臂|手臂|肩|腿|脚|脸|胸|腹|背|锁骨|指尖|大腿|小腿|肩|阴唇|阴蒂|穴口)|比耶|剪刀手|手势|裤脚|鞋尖|裙角|袖口|手指.*(?:入镜|边缘|插入|按在|抓|握)|半裸|全裸|内衣|浴袍|睡衣|连体睡衣|阴唇|阴蒂|穴口|乳头|会阴|lingerie|bare (?:chest|legs|skin|nipples)/i.test(
      p,
    )
  if (!bodyVisible) return false
  if (SCENIC_ONLY_HINT.test(p) && !/自己的|角色.{0,6}(?:手|腿|脸|胸|身体)|first-person POV/i.test(p)) {
    return false
  }
  return true
}

/** 需锁角色形象（外貌摘要/性别等）：自拍、对镜、第一视角露肢体 */
export function isCharacterMediaAppearanceLockPrompt(prompt: string): boolean {
  return isCharacterMediaSelfiePrompt(prompt) || isCharacterMediaFirstPersonBodyPrompt(prompt)
}

/** 画面需呈现该角色自身形象（注入形象特征补充 / 外貌 tag） */
export function isCharacterMediaCharacterAppearanceNeededPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaPhotographingOthersPrompt(p)) return false
  if (isCharacterMediaAppearanceLockPrompt(p)) return true
  if (isCharacterMediaMirrorSelfiePrompt(p)) return true
  if (/\breference character\b/i.test(p)) return true
  if (/The character appearance:/i.test(p)) return true
  if (hasCharacterMediaSelfiePrefix(p)) return true
  if (
    isCharacterMediaHandheldFirstPersonPrompt(p) &&
    SCENIC_ONLY_HINT.test(p) &&
    !isCharacterMediaFirstPersonBodyPrompt(p)
  ) {
    return false
  }
  return false
}

/** 是否应把形象参考图送进 img2img/edits（自拍/对镜 → 锁脸身份） */
export function isCharacterMediaReferenceImagePrompt(prompt: string): boolean {
  return isCharacterMediaSelfiePrompt(prompt) || isCharacterMediaMirrorSelfiePrompt(prompt)
}

/** 明确不露脸 / 脸不入镜 */
const EXPLICIT_NO_FACE_RE =
  /\bno faces?\s+visible\b|\bno face(?:s)? in frame\b|\bface not (?:in frame|visible)\b|\bfaceless\b|\bwithout (?:a )?face\b|\bhands? only\b|\bonly (?:two )?hands?\b|\bonly fingers?\b|不露脸|无脸(?:入镜|可见)?|看不到脸|脸不入镜|不要(?:露|出现)?脸|面部不入镜|画面中无脸/i

/** 脸部/头面部特征（入镜强信号） */
const FACE_FEATURE_RE =
  /\b(?:face|faces|facial|headshot|portrait|close-up face|extreme close-up face|face fills|looking (?:at|into)|gaze|eyes?|eyelashes?|lips?|mouth|jaw|chin|cheek(?:s|bones?)?|forehead|nose|blush|expression|smile|smiling|head and shoulders)\b|正脸|侧脸|面部|脸部|五官|表情|眼睛|睫毛|嘴唇|下颌|脸颊|额头|鼻|微笑|肖像|胸像|怼脸|面部特写/i

/** 半身/上半身等通常含脸的景别 */
const UPPER_BODY_WITH_FACE_RE =
  /\b(?:upper body|from (?:the )?chest up|chest-up|waist-up|medium (?:close-?up|shot)|half[\s-]?body|three-quarter|from (?:the )?shoulders? up)\b|半身|上半身|七分身|腰部以上|胸口以上|肩部以上|中近景|中景/i

/** 腰部以下 / 下半身特写（默认不露脸） */
const WAIST_DOWN_NO_FACE_RE =
  /\b(?:waist[\s-]?down|from waist down|below waist|lower (?:torso|body)|hips? and thighs?|crotch|genital)\b|腰部以下|下半身特写|裤裆|大腿根/i

/** 仅手足等肢体特写（无头脸词时视为不露脸） */
const EXTREMITY_CLOSEUP_RE =
  /\b(?:two hands?|both hands?|hands? holding|holding (?:each other|hands?)|hand close-up|close-up of (?:the )?hands?|fingers?(?: only)?|knuckles?|fingertips?|own (?:left |right )?hand|partner(?:'s|s)? hand|bare (?:feet|foot|legs?|arms?)|feet only|legs? only)\b|双手|两只手|牵手|握手|手指特写|指节|指尖|自己的手|对方的手|仅(?:手|脚|腿)|只有手/i

/** 单人身体部位特写（锁骨/腹肌/手腕等，非双人、非露脸） */
const SOLO_BODY_PART_CLOSEUP_RE =
  /\b(?:close[\s-]?up|extreme close-up).{0,48}(?:abs|ab|collarbone|clavicle|wrists?|forearms?|navel|midriff|belly|stomach|chest|pecs?|nipples?|thighs?|calves?|ankles?|shoulders?|neck|back|hips?|waist|abs line)\b|\b(?:abs|ab|collarbone|clavicle|wrists?|forearms?|navel|midriff|belly|stomach|chest|pecs?|thighs?|calves?|ankles?|shoulders?|neck).{0,24}(?:close[\s-]?up|extreme close-up)\b|(?:close[\s-]?up|特写).{0,12}(?:锁骨|腹肌|手腕|小臂|肚脐|人鱼线|马甲线|肩线|后背|大腿|脚踝)|(?:锁骨|腹肌|手腕|小臂|肚脐|人鱼线|马甲线|肩线|后背|大腿|脚踝).{0,12}(?:close[\s-]?up|特写)|锁骨特写|腹肌特写|手腕特写|小臂特写|肚脐特写|肩线特写|后背特写|大腿特写|脚踝特写/i

/**
 * 画面中角色脸部是否入镜。
 * 用于决定是否上传形象参考图：不露脸（牵手特写、腰部以下、空镜等）一律不传，避免模型从脸部参考图抄出五官。
 */
export function isCharacterMediaCharacterFaceVisiblePrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false

  if (EXPLICIT_NO_FACE_RE.test(p)) return false

  if (isCharacterMediaSelfiePrompt(p) || isCharacterMediaMirrorSelfiePrompt(p)) return true

  const hasFaceFeature = FACE_FEATURE_RE.test(p)
  const hasUpperBody = UPPER_BODY_WITH_FACE_RE.test(p)

  if (isCharacterMediaFingerInterlockPrompt(p) || isCharacterMediaDualHandHoldingPrompt(p)) {
    return hasFaceFeature || hasUpperBody
  }

  if (WAIST_DOWN_NO_FACE_RE.test(p) && !hasFaceFeature && !hasUpperBody) return false

  if (EXTREMITY_CLOSEUP_RE.test(p) && !hasFaceFeature && !hasUpperBody) return false

  // 单人部位特写（锁骨/腹肌/手腕等）：默认不露脸
  if (SOLO_BODY_PART_CLOSEUP_RE.test(p) && !hasFaceFeature && !hasUpperBody) return false

  if (
    SCENIC_ONLY_HINT.test(p) &&
    !isCharacterMediaFirstPersonBodyPrompt(p) &&
    !OTHER_PERSON_SUBJECT_RE.test(p) &&
    !hasFaceFeature
  ) {
    return false
  }

  if (hasFaceFeature || hasUpperBody) return true

  if (/\breference character\b/i.test(p)) return true

  if (isCharacterMediaCharacterAppearanceNeededPrompt(p)) {
    if (isCharacterMediaFirstPersonBodyPrompt(p) && !hasFaceFeature && !hasUpperBody) {
      // 第一视角只露肢体、未写头脸 → 不传参考图
      if (
        /(?:手|臂|手臂|肩|腿|脚|胸|腹|背|锁骨|指尖|大腿|小腿|腰|臀|裆|hand|arm|leg|foot|chest|shoulder|knuckle|finger|collarbone|abs|wrist)/i.test(
          p,
        ) &&
        !/(?:脸|面|头|五官|表情|眼|唇|face|head|eyes?|lips?|jaw|chin|cheek)/i.test(p)
      ) {
        return false
      }
    }
    return true
  }

  return false
}

/** @deprecated 使用 isCharacterMediaSelfiePrompt */
export const isCharacterChatSelfiePrompt = isCharacterMediaSelfiePrompt

const REFERENCE_MATCH_STYLE_SUFFIX =
  'match the exact art style, rendering technique, line quality, color palette and illustration medium of the reference image, consistent character design language, same level of stylization as reference, preserve reference outfit and accessories unless scene explicitly changes clothes, do NOT switch to photorealistic or CGI if reference is illustrated, do NOT use a different art style from reference'

const REFERENCE_STYLE_ONLY_COMPOSITION_GUARD =
  'do NOT copy reference image third-person composition, standing pose, or full-body portrait framing, match art style and color palette only'

const DATING_PLOT_CINEMATIC_SUFFIX =
  'third-person cinematic camera, external observer viewpoint, film still frame, movie scene composition, professional cinematography, dramatic natural staging, environmental storytelling, NOT first-person POV, NOT smartphone selfie, NOT handheld phone snapshot, NOT viewer-as-character POV, NOT phone camera in frame, NOT mirror selfie, NOT rear-camera casual snap'

const DATING_PLOT_REFERENCE_COMPOSITION_GUARD =
  'preserve third-person cinematic staging with character visible in scene, match reference character identity and art style, do NOT convert to first-person POV or smartphone snapshot'

const CHARACTER_MEDIA_DUAL_PERSON_INTIMATE_RE =
  /\b(?:1girl,\s*1boy|1boy,\s*1girl|2girls?|2boys?|two people|couple|both (?:faces|people)|partner(?:'s|s)? (?:face|body|hand|head)|between (?:her|his) legs|on top of (?:her|him)|missionary|cowgirl|doggy|fellatio|cunnilingus|handjob|sex\b|making out)\b|两人|双人|同框|两位|对方.{0,12}(?:脸|身体|手|头)|腿间|身上|骑在|面对面/i

/** 亲密双人同框（须全景/中景，禁单人特写） */
export function isCharacterMediaDualPersonIntimatePrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaDualHandHoldingPrompt(p)) return true
  if (!CHARACTER_MEDIA_DUAL_PERSON_INTIMATE_RE.test(p)) return false
  const soloOnly =
    /\b(?:solo|masturbat|only (?:her|him|one person)|selfie shot|mirror selfie shot)\b|单人|独自|自慰|只有(?:她|他)/i.test(
      p,
    )
  return !soloOnly
}

/** 十指相扣 / 手指交叉扣入（区别于普通搭握牵手） */
export function isCharacterMediaFingerInterlockPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  return /十指相扣|十指交扣|指缝相扣|fingers interlaced|fingers interlocked|interlocked fingers|finger.?lock|interlaced fingers|fingers intertwined|finger gaps visible|finger slots/i.test(
    p,
  )
}

/** 手心相牵 / 掌心相对（手指不交叉；与十指相扣互斥） */
export function isCharacterMediaPalmToPalmHoldingPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaFingerInterlockPrompt(p)) return false
  return /手心相牵|掌心相贴|掌心相对|手心相握|掌心相握|轻轻牵着手|palms? (?:pressed|touching)(?: gently)? together|palm[- ]to[- ]palm|palm clasp|holding hands palm|simple palm hold|fingers not interlaced/i.test(
    p,
  )
}

/** 双人牵手 POV（非自己牵自己） */
export function isCharacterMediaDualHandHoldingPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaFingerInterlockPrompt(p)) return true
  if (isCharacterMediaPalmToPalmHoldingPrompt(p)) return true
  return (
    /holding hand|intertwined|牵(?:着|住).*手|握(?:着|住).*手|十指|partner.{0,20}hand/i.test(p) &&
    /own (?:left |right )?(?:mechanical |metallic |metal )?hand|partner|对方|两人|双人|two (?:people|persons|separate)/i.test(
      p,
    )
  )
}

function appendCharacterMediaReferenceStyleParts(
  parts: string[],
  useReferenceStyle: boolean,
  hasReference: boolean,
  inferFrom: string,
): void {
  if (!useReferenceStyle || !hasReference) return
  parts.push(REFERENCE_MATCH_STYLE_SUFFIX)
  if (!isCharacterMediaReferenceImagePrompt(inferFrom)) {
    parts.push(REFERENCE_STYLE_ONLY_COMPOSITION_GUARD)
  }
}

/** 自拍有参考图且模型支持传图时自动跟随参考图画风；也可在设置里显式选「跟随参考形象图」 */
export function isReferenceMatchStyle(
  settings: MomentsImageGenSettings,
  hasReferenceImage?: boolean,
): boolean {
  const refUploadSupported = modelSupportsReferenceImageUploadFromSettings(settings)
  if (hasReferenceImage && refUploadSupported) return true
  return settings.stylePrefixMode === 'preset' && settings.stylePresetId === 'reference_match'
}

function inferCharacterMediaShotScaleSuffix(prompt: string): string {
  const p = prompt.trim()
  if (isCharacterMediaDualPersonIntimatePrompt(p) && !isCharacterMediaSelfiePrompt(p)) {
    if (/全景|wide shot|远景|panoramic|full scene/i.test(p)) {
      return 'wide shot, both people and environment visible in frame, subjects proportionally smaller, no extreme facial micro-detail, NOT single person portrait'
    }
    if (/特写|close[\s-]?up|face fill|怼脸/i.test(p)) {
      return 'medium shot, both people or POV subject and partner body visible together, upper body to full body framing, NOT single face close-up, NOT one person headshot'
    }
    return 'medium shot, intimate two-person framing with clear subject separation, upper body or three-quarter body visible, NOT single person close-up portrait'
  }
  if (/特写|面部特写|close[\s-]?up|face focus|怼脸/i.test(p)) {
    return 'close-up shot, face and upper chest fill frame, shallow depth of field, minimal background detail, no full body'
  }
  if (/全景|wide shot|全身|远景/i.test(p)) {
    return 'wide shot, environment visible, subject proportionally smaller in frame, no extreme facial micro-detail like eyelash pores'
  }
  if (/中近景|medium close|胸像/i.test(p)) {
    return 'medium close-up, chest-up framing, moderate background blur'
  }
  if (/中景|medium shot|半身|七分身|50mm|35mm/i.test(p)) {
    return 'medium shot, waist-up or knee-up framing, balanced subject and background detail'
  }
  if (/腰部以下|below waist|from waist down|裤裆|大腿根|lower torso/i.test(p)) {
    return 'frame focused on waist-down body parts as seen from own phone angle, lower torso hips thighs hands in frame, shoulders or forearms may appear at frame edges, face usually not in frame when looking down unless prompt mentions chin or jaw'
  }
  return ''
}

const CHARACTER_MEDIA_DUAL_INTIMATE_COMPOSITION_GUARD =
  'medium shot, two people visible together in frame, full body or three-quarter body framing, both characters visible, NOT single person close-up, NOT one face filling entire frame'

/** 纯牵手/十指特写：禁止套用双人半身同框护栏 */
const HANDS_ONLY_NO_FACE_COMPOSITION_GUARD =
  'extreme close-up of hands only, hands and fingers fill most of frame, no faces, no heads, no upper bodies, no torsos, crop at wrists or forearms, NOT medium shot, NOT two people sitting, NOT full figures visible'

/** 手部好看：纤细、骨节分明；并禁止手毛（仅当用户外貌补充未写手部形态时作为默认） */
const HAND_AESTHETIC_GUARD =
  'elegant slender fingers, refined hands, well-defined knuckles, delicate bone structure, smooth soft skin on hands, clean manicured look, hairless hands, no hand hair, no finger hair, no arm hair on hands or wrists, NOT hairy hands, NOT dense hair on fingers'

/** 手指数量与手形硬规范（始终注入手部特写，与用户好看手文案无关） */
const HAND_ANATOMY_GUARD =
  'each hand has exactly 5 fingers including thumb, ten distinct fingertips when both hands shown, anatomically correct human hands, correct finger count, clear finger separation, natural finger joints, no missing fingers, no extra fingers, no fused fingers, no truncated fingers, no deformed fingers'

/** 十指相扣构图补强 */
const FINGER_INTERLOCK_STYLE_GUARD =
  'fingers tightly interlaced alternating from both hands, visible gaps between crossed fingers, NOT palm-to-palm clasp'

/** 手心相牵构图补强 */
const PALM_TO_PALM_STYLE_GUARD =
  'palm-to-palm hold, palms flat against each other, fingers extended together not crossed, thumbs along outer sides, NOT fingers interlaced'

/** 用户外貌补充里已写手部形态/肤质/手毛等 → 自动默认让位 */
const USER_HAND_APPEARANCE_PRIORITY_RE =
  /纤细|修长|骨节|分明|好看的手|漂亮的手|手好看|粗糙|宽厚|厚实|粗壮|粗大|偏粗|偏细|有力|有茧|大手|小手|柔嫩|细腻|手毛|体毛|多毛|无毛|光滑|青筋|手背|手型|手掌|手心|slender fingers|elegant (?:hands|fingers)|well-defined knuckles|hairy hands|hairless hands|delicate (?:hands|fingers)|refined hands|veiny|bony hands|soft hands|rough hands|large hands|small hands|manicured|手指修长|指节分明|手背青筋|宽阔的手|瘦削的手/i

const HAND_MENTION_RE = /\b(?:hands?|fingers?|knuckles?|fingertips?|wrists?|palms?)\b|手|指|腕|指节|指尖|手掌|手心|手背/i

const HAND_JEWELRY_ONLY_RE =
  /戒指|指环|手表|手链|手镯|尾戒|ring(?:s)?|watch(?:es)?|bracelet(?:s)?|美甲|指甲油|nail polish/i

/**
 * 外貌参考文字是否已含用户手部形态描述（饰品-only 不算）。
 * 有则自动「好看手/无手毛」默认让位，以用户文案为最高优先级。
 */
export function appearanceTextHasUserHandAppearancePriority(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (USER_HAND_APPEARANCE_PRIORITY_RE.test(t)) return true

  for (const clause of t
    .split(/[\n；;。！？!?]+|,(?![^()]*\))|，/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!HAND_MENTION_RE.test(clause)) continue
    // 仅饰品（戴戒指等）不抢占默认手部美化
    if (HAND_JEWELRY_ONLY_RE.test(clause) && !USER_HAND_APPEARANCE_PRIORITY_RE.test(clause)) continue
    return true
  }
  return false
}

/** 单人身体部位特写：只出该部位，禁止半身/人脸 */
const SOLO_BODY_PART_COMPOSITION_GUARD =
  'body-part close-up only, the named body part fills most of the frame, no face, no head, no full-body or half-body portrait, NOT medium shot of a whole person, NOT two people in frame'

function isCharacterMediaHandsOnlyNoFaceComposition(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaCharacterFaceVisiblePrompt(p)) return false
  // 必须与手/十指相关，不能仅因写了 no faces 就当成手部特写（避免腹肌/锁骨被改成 hands only）
  return (
    isCharacterMediaFingerInterlockPrompt(p) ||
    isCharacterMediaDualHandHoldingPrompt(p) ||
    (EXTREMITY_CLOSEUP_RE.test(p) &&
      /\b(?:hands?|fingers?|knuckles?|wrist)|手|指|指节|手腕/i.test(p))
  )
}

/** 画面以手/指/腕为主（牵手、十指、手部特写） */
export function isCharacterMediaHandFocusPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaFingerInterlockPrompt(p) || isCharacterMediaDualHandHoldingPrompt(p)) return true
  if (isCharacterMediaHandsOnlyNoFaceComposition(p)) return true
  return (
    /\b(?:hands?|fingers?|knuckles?|fingertips?|wrists?)\b.{0,24}(?:close[\s-]?up|extreme close-up)|(?:close[\s-]?up|extreme close-up).{0,24}\b(?:hands?|fingers?|knuckles?|wrists?)\b|手部特写|手指特写|手腕特写|指节|十指/i.test(
      p,
    )
  )
}

/** 单人锁骨/腹肌/手腕等部位特写（非双人亲密） */
export function isCharacterMediaSoloBodyPartCloseupPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaDualPersonIntimatePrompt(p)) return false
  if (isCharacterMediaSelfiePrompt(p) || isCharacterMediaMirrorSelfiePrompt(p)) return false
  if (isCharacterMediaCharacterFaceVisiblePrompt(p)) return false
  return SOLO_BODY_PART_CLOSEUP_RE.test(p) || EXTREMITY_CLOSEUP_RE.test(p)
}

function appendCharacterMediaDualIntimateCompositionGuard(
  parts: string[],
  inferFrom: string,
): void {
  if (!isCharacterMediaDualPersonIntimatePrompt(inferFrom) || isCharacterMediaSelfiePrompt(inferFrom)) {
    return
  }
  // 牵手/不露脸特写：不要注入「两人半身同框」，否则会盖掉 close-up + no faces
  if (isCharacterMediaHandsOnlyNoFaceComposition(inferFrom)) {
    const blob = parts.join(', ').toLowerCase()
    if (!/hands? only|no faces|no heads|extreme close-up of hands/i.test(blob)) {
      parts.push(HANDS_ONLY_NO_FACE_COMPOSITION_GUARD)
    }
    return
  }
  const blob = parts.join(', ').toLowerCase()
  if (
    /wide shot|medium shot|full body|two people visible|both (?:people|characters) visible|three-quarter body/i.test(
      blob,
    )
  ) {
    return
  }
  parts.push(CHARACTER_MEDIA_DUAL_INTIMATE_COMPOSITION_GUARD)
}

function appendCharacterMediaSoloBodyPartCompositionGuard(
  parts: string[],
  inferFrom: string,
): void {
  if (!isCharacterMediaSoloBodyPartCloseupPrompt(inferFrom)) return
  if (isCharacterMediaHandsOnlyNoFaceComposition(inferFrom)) return
  const blob = parts.join(', ').toLowerCase()
  if (/body-part close-up only|named body part fills|no full-body or half-body/i.test(blob)) return
  parts.push(SOLO_BODY_PART_COMPOSITION_GUARD)
}

function appendCharacterMediaHandAestheticGuard(
  parts: string[],
  inferFrom: string,
  appearanceText?: string,
): void {
  if (!isCharacterMediaHandFocusPrompt(inferFrom)) return
  const blob = parts.join(', ').toLowerCase()

  // 手指数量/手形：始终注入（防缺指乱指）
  if (!/exactly 5 fingers|ten distinct fingertips|no missing fingers|anatomically correct human hands/i.test(blob)) {
    parts.push(HAND_ANATOMY_GUARD)
  }

  if (isCharacterMediaFingerInterlockPrompt(inferFrom)) {
    if (!/alternating from both hands|visible gaps between crossed fingers/i.test(blob)) {
      parts.push(FINGER_INTERLOCK_STYLE_GUARD)
    }
  } else if (isCharacterMediaPalmToPalmHoldingPrompt(inferFrom)) {
    if (!/palms flat against each other|fingers extended together not crossed/i.test(blob)) {
      parts.push(PALM_TO_PALM_STYLE_GUARD)
    }
  }

  // 用户外貌参考已写手部形态 → 好看手/无手毛默认让位
  if (appearanceTextHasUserHandAppearancePriority(appearanceText ?? '')) return
  if (/hairless hands|no hand hair|elegant slender fingers|well-defined knuckles/i.test(blob)) return
  parts.push(HAND_AESTHETIC_GUARD)
}

/** 角色私聊/群聊/朋友圈：仅拼接风格前缀 + 模型/用户 tag；不再自动注入 POV/机位/手机镜头后缀 */
export function buildCharacterMediaImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
  options?: {
    hasReferenceImage?: boolean
    inferencePrompt?: string
    /** 形象特征补充 / 外貌关键词；含手部形态时压过默认手部美化 */
    appearanceText?: string
  },
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed
  const inferFrom = options?.inferencePrompt?.trim() || trimmed

  const hasReference = options?.hasReferenceImage === true
  const useReferenceStyle = isReferenceMatchStyle(settings, hasReference)
  const stylePrefix = useReferenceStyle ? '' : resolveStylePrefix(settings)
  const withStyle = stylePrefix ? `${stylePrefix}${trimmed}`.trim() : trimmed
  const anime = !useReferenceStyle && isAnimeStyle(settings, withStyle)

  const parts = [withStyle]
  appendCharacterMediaReferenceStyleParts(parts, useReferenceStyle, hasReference, inferFrom)
  appendCharacterMediaDualIntimateCompositionGuard(parts, inferFrom)
  appendCharacterMediaSoloBodyPartCompositionGuard(parts, inferFrom)
  appendCharacterMediaHandAestheticGuard(parts, inferFrom, options?.appearanceText)
  if (!useReferenceStyle || !hasReference) {
    if (anime && !/not photorealistic/i.test(withStyle)) {
      parts.push(ANIME_ANTI_REALISTIC)
    }
  }
  return parts.join(', ')
}

/** 线下约会剧情配图：固定第三人称电影镜头，禁止 POV/自拍 */
export function buildDatingPlotImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
  options?: { hasReferenceImage?: boolean },
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed

  const hasReference = options?.hasReferenceImage === true
  const useReferenceStyle = isReferenceMatchStyle(settings, hasReference)
  const stylePrefix = useReferenceStyle ? '' : resolveStylePrefix(settings)
  const withStyle = stylePrefix ? `${stylePrefix}${trimmed}`.trim() : trimmed
  const anime = !useReferenceStyle && isAnimeStyle(settings, withStyle)

  const parts = [withStyle, DATING_PLOT_CINEMATIC_SUFFIX]
  const shotSuffix = inferCharacterMediaShotScaleSuffix(trimmed)
  if (shotSuffix && !/waist-down body parts as seen from own phone/i.test(shotSuffix)) {
    parts.push(shotSuffix.replace(/from own phone angle/gi, 'from external camera'))
  } else if (!/wide shot|medium shot|two-thirds|half body|full body|cinematic/i.test(trimmed)) {
    parts.push('medium shot, two-thirds body framing, cinematic depth of field')
  }
  if (useReferenceStyle && hasReference) {
    parts.push(REFERENCE_MATCH_STYLE_SUFFIX, DATING_PLOT_REFERENCE_COMPOSITION_GUARD)
  } else if (hasReference) {
    parts.push(DATING_PLOT_REFERENCE_COMPOSITION_GUARD)
  }
  if (!useReferenceStyle || !hasReference) {
    if (anime && !/not photorealistic/i.test(withStyle)) {
      parts.push(ANIME_ANTI_REALISTIC)
    }
    if (!hasReference && /脸|面部|眼神|唇|五官|face|eyes|lips|reference character|1boy|1girl/i.test(trimmed)) {
      parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
    }
  }
  return parts.join(', ')
}

/** @deprecated 使用 buildCharacterMediaImagePrompt */
export const buildCharacterChatImagePrompt = buildCharacterMediaImagePrompt

export function resolveImageStyleHint(settings: MomentsImageGenSettings): string {
  const extraPositive = resolveCommonExtraPositivePrompt(
    resolveProviderPromptSettings(settings).common,
  ).trim()
  if (extraPositive) {
    return `正面提示词（${extraPositive.slice(0, 48)}${extraPositive.length > 48 ? '…' : ''}）`
  }
  if (settings.stylePrefixMode === 'custom') {
    const custom = settings.customStylePrefix.trim()
    return custom ? `自定义（${custom.slice(0, 48)}）` : '自定义'
  }
  return getPollinationsStylePreset(settings.stylePresetId)?.labelZh ?? '写实摄影'
}

/** 角色配图（私聊/群聊/朋友圈）：有形象参考图且模型支持传图时告知画风由参考图决定 */
export function resolveCharacterMediaImageStyleHint(
  settings: MomentsImageGenSettings,
  hasAppearanceReference?: boolean,
): string {
  const refSupported = modelSupportsReferenceImageUploadFromSettings(settings)
  if (hasAppearanceReference && refSupported) {
    return '跟随参考形象图（当前模型支持传参考图）'
  }
  if (hasAppearanceReference && !refSupported) {
    return `${resolveImageStyleHint(settings)}（参考图不会传至当前模型，仅作档案）`
  }
  return resolveImageStyleHint(settings)
}

export function enhanceMomentsImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed

  const parts = [trimmed]
  const anime = isAnimeStyle(settings, trimmed)

  if (anime && !/not photorealistic/i.test(trimmed)) {
    parts.push(ANIME_ANTI_REALISTIC)
  }

  if (hasPersonSubject(trimmed)) {
    parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
  }

  return parts.join(', ')
}

export function buildMomentsImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
  options?: { skipStylePrefix?: boolean },
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed

  const stylePrefix = options?.skipStylePrefix ? '' : resolveStylePrefix(settings)
  const withStyle = stylePrefix ? `${stylePrefix}${trimmed}`.trim() : trimmed
  return enhanceMomentsImagePrompt(withStyle, settings)
}
