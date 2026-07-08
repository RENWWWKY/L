import { getPollinationsStylePreset, resolveStylePrefix } from './pollinationsPresets'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

const PERSON_HINT =
  /\b(person|people|portrait|face|selfie|girl|boy|man|woman|character|human|male|female|student|boyfriend|girlfriend|couple)\b/i

const ANIME_STYLE_HINT = /\banime\b|illustration|2d|cel shading|二次元/i

function isAnimeStyle(settings: MomentsImageGenSettings, combinedPrompt: string): boolean {
  if (ANIME_STYLE_HINT.test(combinedPrompt)) return true
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
  /\b(selfie|self[\s-]?portrait|mirror selfie|front camera)\b|自拍|对镜|前置摄像头|镜面自拍/i

const MIRROR_SELFIE_HINT =
  /\b(mirror selfie|mirror shot|in front of (?:a )?mirror|bathroom mirror|reflection in mirror|mirror reflection)\b|对镜|镜面|镜子前|浴室镜|全身镜|镜中|镜面反射|镜子里/i

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
  return /前置摄像头自拍|前置自拍|前置摄像头|front[-\s]?facing|front camera/i.test(prompt.trim())
}

/** 第一视角随手拍（后置摄像头·非前置摄像头自拍/对镜）——非自拍 prompt 的默认路径 */
export function isCharacterMediaHandheldFirstPersonPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  return !isCharacterMediaSelfiePrompt(p) && !isCharacterMediaMirrorSelfiePrompt(p)
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

/** 是否应把形象参考图送进 img2img/edits（自拍锁脸；非自拍仅锁画风见 referenceStyleOnly） */
export function isCharacterMediaReferenceImagePrompt(prompt: string): boolean {
  return isCharacterMediaSelfiePrompt(prompt) || isCharacterMediaMirrorSelfiePrompt(prompt)
}

/** @deprecated 使用 isCharacterMediaSelfiePrompt */
export const isCharacterChatSelfiePrompt = isCharacterMediaSelfiePrompt

const CHARACTER_MEDIA_POV_LANDSCAPE_SUFFIX =
  'authentic first-person smartphone POV from photographer standing or sitting height, camera tilt matches subject (horizontal eye-level for landscapes and street views, upward for sky and tall architecture, downward only for ground-level subjects), immersive handheld snapshot, photographer body parts are optional and only when the scene naturally includes them (feet or pant cuffs at bottom edge when looking down, hand or fingers at frame edge for peace sign or wave gesture, otherwise pure scenic view with no visible limbs), NOT third-person view, NOT aerial drone shot, NOT surveillance CCTV angle, NOT studio backdrop'

const CHARACTER_MEDIA_FRONT_SELFIE_SUFFIX =
  'front-facing smartphone selfie POV lens shot, viewer IS the phone front camera lens POV looking at subject face, subjective POV camera angle, subject looking directly into camera lens, smartphone body NOT visible in frame, direct face-to-lens only, NOT mirror selfie, NOT mirror reflection, NOT any mirror in scene, NOT reflective glass, NOT third-person shot of character holding phone toward mirror, NOT studio headshot'

const CHARACTER_MEDIA_FRONT_SELFIE_ANTI_MIRROR_SUFFIX =
  'NO mirror of any kind, NO wall mirror, NO bathroom mirror, NO vanity mirror, NO makeup mirror, NO dressing mirror, NO full-length mirror, NO mirror reflection, NO reflected duplicate face, NO glossy wall mirror reflection, NO reflective tile wall selfie, NO glass reflection showing character holding phone, NO phone visible in composition, NO character holding smartphone toward reflective surface, matte non-reflective background only, direct front-camera lens POV only'

function inferFrontSelfieDistanceSuffix(prompt: string): string {
  const p = prompt.trim()
  if (/怼脸|极近|贴近镜头|脸部占满|face fill|extreme close|close-up face|超近距离/i.test(p)) {
    return 'extreme close-up front camera selfie, face fills most of frame, neckline collar hood hat headband or head accessories still visible at bottom or side edges of frame, outfit and head decoration must be described, phone very close to face, slight wide-angle front camera distortion acceptable'
  }
  if (/一臂距离|arm-length|arm length|上半身|半身|胸像|medium close/i.test(p)) {
    return 'arm-length front camera selfie at maximum distance, upper body and face together in frame, natural handheld angle'
  }
  return 'front camera selfie at natural handheld distance between close-up and arm-length, face clearly visible'
}

function inferFrontSelfieMotionSuffix(prompt: string): string {
  const p = prompt.trim()
  if (/认真|刻意|摆拍|稳定|清晰|仔细地|精心|正式/i.test(p)) {
    return 'sharp focus, stable handheld, NO motion blur, intentional clean selfie'
  }
  if (/手抖|不小心|动态模糊|镜头晃|晃了一下|motion blur|camera shake|shake blur|模糊感|拍糊/i.test(p)) {
    return 'slight motion blur from accidental phone shake, candid unstable handheld feel, soft directional blur on face or background edges, imperfect snap'
  }
  return ''
}

const CHARACTER_MEDIA_MIRROR_SELFIE_SUFFIX =
  'mirror reflection composition, third-person view of character standing before mirror, character holding smartphone toward mirror with phone visible in reflection, upper body and face together in mirror frame, natural mirror selfie, NOT front camera arm-length POV, NOT outstretched arm reaching toward viewer, NOT hand entering frame from bottom corner, NOT first-person handheld selfie perspective, NOT selfie stick angle, NOT fish-eye distortion'

const CHARACTER_MEDIA_FIRST_PERSON_BODY_SUFFIX =
  'strict subjective first-person POV smartphone rear camera, character holding phone and photographing from their own viewpoint, viewer IS the character NOT an external photographer, own body parts visible exactly as phone angle dictates (hands arms shoulders thighs legs feet may enter frame), NO third-person external observer camera, NO full-body portrait composed by outside photographer, NOT mirror reflection, NOT front-facing selfie arm-length face camera, NOT studio photoshoot, NOT CCTV NOT drone establishing shot, immersive handheld POV snapshot'

function inferCharacterMediaFirstPersonBodyTiltSuffix(prompt: string): string {
  const p = prompt.trim()
  if (
    /holding hand|intertwined|fingers intertwined|握(?:着|住).*手|牵(?:着|住).*手|十指|partner.{0,16}hand|own (?:left |right )?hand/i.test(
      p,
    )
  ) {
    if (/looking down|high angle looking down|slight high angle|俯视|低头|略俯视/i.test(p)) {
      if (isCharacterMediaFingerInterlockPrompt(p)) {
        return 'high-angle first-person POV looking straight down at two interlaced hands with fingers woven together at center, finger gaps and knuckles clearly visible, wet sand or floor tiles directly beneath hands, warm light on ground surface, NO horizon, NO distant sea waves, NO skyline, NOT palm clasp'
      }
      return 'high-angle first-person POV looking straight down at two people holding hands at center, wet sand or floor tiles directly beneath hands, warm light on ground surface, NO horizon, NO distant sea waves, NO skyline'
    }
    return 'first-person POV with own hand and partner hand visible in lower or center frame, scenic background only at eye level not when looking down, NOT third-person full body shot'
  }
  if (
    /腰部以下|腰部|裤裆|裆部|裆|大腿|腹股沟|略俯视|低头|卧床|躺在床上|床面|lap|crotch|groin|waist|below waist|thighs|bulge|own body/i.test(
      p,
    )
  ) {
    return 'phone camera tilted downward looking at own lap thighs and lower torso from above, high-angle first-person POV, own hands arms gripping fabric at thigh may enter frame, shoulders may edge into top of frame if phone held close, messy bedsheets around legs, face usually out of frame when looking down unless prompt asks for chin, NO third-person front-facing seated portrait, NO external camera showing full head-to-toe body'
  }
  if (/比耶|耶|peace sign|剪刀手|手势|手指.*(?:入镜|边缘|抓|握)/.test(p)) {
    return 'first-person smartphone POV with own hand or fingers entering frame edge, scenic or body background beyond hand, NOT third-person portrait, NOT full-body external shot'
  }
  return inferCharacterMediaPovTiltSuffix(p)
}

function inferCharacterMediaPovTiltSuffix(prompt: string): string {
  const p = prompt.trim()
  const lower = p.toLowerCase()

  if (/比耶|耶|peace sign|v sign|v-sign|剪刀手|手势|招手|waving hand|hand gesture|手指.*(?:入镜|边缘|画[面框])|举.*手/.test(p)) {
    return 'first-person smartphone POV with photographer own hand or fingers entering frame edge making casual peace sign or wave gesture, scenic background beyond hand, NOT third-person portrait, NOT full-body shot'
  }

  if (
    /脚下|地面|低头|俯拍|俯视|floor|ground|at (my )?feet|pavement|sidewalk|looking down|below|裤脚|裤腿|鞋尖|裙角|台阶/.test(p) ||
    /(?:脚边|脚下|地面).{0,8}(?:猫|狗)/.test(p)
  ) {
    if (/裤脚|裤腿|鞋尖|球鞋|拖鞋|sneaker|toes|pant legs|cuffs|skirt hem|我的.*(?:鞋|裤|裙)/.test(p)) {
      return 'downward tilted phone camera toward ground-level subject, photographer own shoes or pant cuffs visible at bottom edge as in casual over-the-feet phone snap'
    }
    return 'downward tilted phone camera toward ground-level subject, natural downward phone tilt, no forced feet or legs unless prompt explicitly mentions them'
  }

  if (/天空|抬头|仰视|sky|ceiling|looking up|building top|树梢|树冠|高楼|招牌|clouds|sunset sky|星空|星轨|月亮/.test(lower)) {
    return 'upward tilted phone camera from standing height, sky architecture or canopy fills frame, no feet legs or hands in frame, immersive looking-up snapshot'
  }

  if (/桌面|桌|咖啡|键盘|书|饭|餐|手边|lap|膝盖|食物|奶茶|杯/.test(p)) {
    return 'slightly downward seated or standing phone POV toward table-level subject, hands or sleeves may optionally edge into frame'
  }

  if (
    /风景|街景|窗外|夜景|城市|lake|mountain|landscape|scenery|street|horizon|sunset|海|湖|山|路|林荫|建筑|天际线|江|河|公园|雪|雨/.test(
      p,
    )
  ) {
    return 'natural eye-level smartphone POV, scenery fills frame horizontally, no visible photographer body parts, handheld snapshot realism, NOT drone NOT CCTV NOT third-person'
  }

  return 'natural eye-level or context-appropriate first-person smartphone POV from standing or sitting height, body parts only when scene naturally includes them, NOT third-person NOT drone'
}

const REFERENCE_MATCH_STYLE_SUFFIX =
  'match the exact art style, rendering technique, line quality, color palette and illustration medium of the reference image, consistent character design language, same level of stylization as reference, preserve reference outfit and accessories unless scene explicitly changes clothes, do NOT switch to photorealistic or CGI if reference is illustrated, do NOT use a different art style from reference'

const REFERENCE_STYLE_ONLY_COMPOSITION_GUARD =
  'do NOT copy reference image third-person composition, standing pose, or full-body portrait framing, match art style and color palette only'

const DATING_PLOT_CINEMATIC_SUFFIX =
  'third-person cinematic camera, external observer viewpoint, film still frame, movie scene composition, professional cinematography, dramatic natural staging, environmental storytelling, NOT first-person POV, NOT smartphone selfie, NOT handheld phone snapshot, NOT viewer-as-character POV, NOT phone camera in frame, NOT mirror selfie, NOT rear-camera casual snap'

const DATING_PLOT_REFERENCE_COMPOSITION_GUARD =
  'preserve third-person cinematic staging with character visible in scene, match reference character identity and art style, do NOT convert to first-person POV or smartphone snapshot'

const CHARACTER_MEDIA_DUAL_HAND_HOLDING_SUFFIX =
  'two separate people holding hands, photographer own hand and forearm enter from lower-left bottom of frame, partner separate human hand and forearm reach from upper-right across center, both hands meet at center, clearly two different individuals, NOT one person holding own hands, NOT single body with prosthetic arm and human arm on same torso, NOT both arms attached to same pair of legs at bottom, only photographer legs or feet visible at bottom edge, partner body out of frame except hand and partial forearm'

const CHARACTER_MEDIA_FINGER_INTERLOCK_SUFFIX =
  'fingers interlaced with partner fingers, interlocked fingers woven between each other, each finger visible in gaps between partner fingers, finger-lock grip with knuckles aligned, close-up detail on interlaced finger slots, NOT palm-over-palm clasp, NOT one hand gripping on top of the other hand, NOT loose hand hold without finger weave, NOT fingers merely touching side by side'

/** 十指相扣 / 手指交叉扣入（区别于普通搭握牵手） */
export function isCharacterMediaFingerInterlockPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  return /十指相扣|十指交扣|指缝相扣|fingers interlaced|fingers interlocked|interlocked fingers|finger.?lock|interlaced fingers|fingers intertwined|finger gaps visible|finger slots/i.test(
    p,
  )
}

/** 双人牵手 POV（非自己牵自己） */
export function isCharacterMediaDualHandHoldingPrompt(prompt: string): boolean {
  const p = prompt.trim()
  if (!p) return false
  if (isCharacterMediaFingerInterlockPrompt(p)) return true
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

/** 自拍有参考图时自动跟随参考图画风；也可在设置里显式选「跟随参考形象图」 */
export function isReferenceMatchStyle(settings: MomentsImageGenSettings, hasReferenceImage?: boolean): boolean {
  if (hasReferenceImage) return true
  return settings.stylePrefixMode === 'preset' && settings.stylePresetId === 'reference_match'
}

function inferCharacterMediaShotScaleSuffix(prompt: string): string {
  const p = prompt.trim()
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

/** 角色私聊/群聊/朋友圈：①第一视角随手拍（默认）②前置摄像头自拍 ③对镜自拍 */
export function buildCharacterMediaImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
  options?: { hasReferenceImage?: boolean; inferencePrompt?: string },
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed
  const inferFrom = options?.inferencePrompt?.trim() || trimmed

  const hasReference = options?.hasReferenceImage === true
  const useReferenceStyle = isReferenceMatchStyle(settings, hasReference)
  const stylePrefix = useReferenceStyle ? '' : resolveStylePrefix(settings)
  const withStyle = stylePrefix ? `${stylePrefix}${trimmed}`.trim() : trimmed
  const anime = !useReferenceStyle && isAnimeStyle(settings, withStyle)

  if (isCharacterMediaSelfiePrompt(inferFrom)) {
    if (isCharacterMediaMirrorSelfiePrompt(inferFrom)) {
      const parts = [withStyle, CHARACTER_MEDIA_MIRROR_SELFIE_SUFFIX]
      const shotSuffix = inferCharacterMediaShotScaleSuffix(inferFrom)
      if (shotSuffix) parts.push(shotSuffix)
      if (useReferenceStyle) parts.push(REFERENCE_MATCH_STYLE_SUFFIX)
      else if (anime && !/not photorealistic/i.test(withStyle)) parts.push(ANIME_ANTI_REALISTIC)
      if (!hasReference) parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
      return parts.join(', ')
    }
    const parts = [
      withStyle,
      CHARACTER_MEDIA_FRONT_SELFIE_SUFFIX,
      CHARACTER_MEDIA_FRONT_SELFIE_ANTI_MIRROR_SUFFIX,
      inferFrontSelfieDistanceSuffix(inferFrom),
    ]
    const motionSuffix = inferFrontSelfieMotionSuffix(inferFrom)
    if (motionSuffix) parts.push(motionSuffix)
    const shotSuffix = inferCharacterMediaShotScaleSuffix(inferFrom)
    if (shotSuffix) parts.push(shotSuffix)
    appendCharacterMediaReferenceStyleParts(parts, useReferenceStyle, hasReference, inferFrom)
    if (!useReferenceStyle || !hasReference) {
      if (anime && !/not photorealistic/i.test(withStyle)) {
        parts.push(ANIME_ANTI_REALISTIC)
      }
      if (!hasReference) {
        parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
      }
    }
    return parts.join(', ')
  }

  if (isCharacterMediaFirstPersonBodyPrompt(inferFrom)) {
    const parts = [
      withStyle,
      CHARACTER_MEDIA_FIRST_PERSON_BODY_SUFFIX,
      inferCharacterMediaFirstPersonBodyTiltSuffix(inferFrom),
    ]
    if (isCharacterMediaDualHandHoldingPrompt(inferFrom)) {
      parts.push(CHARACTER_MEDIA_DUAL_HAND_HOLDING_SUFFIX)
      if (isCharacterMediaFingerInterlockPrompt(inferFrom)) {
        parts.push(CHARACTER_MEDIA_FINGER_INTERLOCK_SUFFIX)
      }
    }
    const shotSuffix = inferCharacterMediaShotScaleSuffix(inferFrom)
    if (shotSuffix) parts.push(shotSuffix)
    appendCharacterMediaReferenceStyleParts(parts, useReferenceStyle, hasReference, inferFrom)
    if (!useReferenceStyle || !hasReference) {
      if (anime && !/not photorealistic/i.test(withStyle)) {
        parts.push(ANIME_ANTI_REALISTIC)
      }
      if (!hasReference && /脸|面部|眼神|唇|五官|face|eyes|lips/i.test(inferFrom)) {
        parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
      }
    }
    return parts.join(', ')
  }

  const parts = [withStyle, CHARACTER_MEDIA_POV_LANDSCAPE_SUFFIX, inferCharacterMediaPovTiltSuffix(inferFrom)]
  const shotSuffix = inferCharacterMediaShotScaleSuffix(inferFrom)
  if (shotSuffix) parts.push(shotSuffix)
  appendCharacterMediaReferenceStyleParts(parts, useReferenceStyle, hasReference, inferFrom)
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
  if (settings.stylePrefixMode === 'custom') {
    const custom = settings.customStylePrefix.trim()
    return custom ? `自定义（${custom.slice(0, 48)}）` : '自定义'
  }
  return getPollinationsStylePreset(settings.stylePresetId)?.labelZh ?? '写实摄影'
}

/** 角色配图（私聊/群聊/朋友圈）：有形象参考图时告知模型画风由参考图决定 */
export function resolveCharacterMediaImageStyleHint(
  settings: MomentsImageGenSettings,
  hasAppearanceReference?: boolean,
): string {
  if (hasAppearanceReference) return '跟随参考形象图（有参考图时自动生效）'
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
