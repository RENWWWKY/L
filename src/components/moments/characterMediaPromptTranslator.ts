import { loadResolvedApiConfig } from '../../phone/apps/api/loadResolvedApiConfig'
import { openAiCompatibleChatLenient } from '../../phone/apps/wechat/newFriendsPersona/ai'
import { hasCharacterMediaSelfiePrefix } from './characterMediaSelfiePrefix'

/** 是否含显著中文（需转英文再发 SD/MJ 类 API） */
export function hasSignificantCjk(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk >= 2 || cjk / t.length >= 0.08
}

/** 中文 tag → 英文 SD tag（长短语优先，由长到短替换） */
const TAG_PHRASE_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['自己的腰部以下', 'own body from waist down'],
  ['参考图角色腰部以下', 'own body from waist down'],
  ['参考图角色', 'reference character'],
  ['腰部以下', 'from waist down'],
  ['略俯视', 'slight high angle looking down'],
  ['裤裆', 'crotch area'],
  ['紧紧抓', 'tightly gripping'],
  ['大腿侧', 'side of thigh'],
  ['前置摄像头', 'selfie shot'],
  ['镜面反射', 'mirror reflection'],
  ['对镜自拍', 'mirror selfie shot'],
  ['前置摄像头自拍', 'selfie shot'],
  ['前置自拍', 'selfie shot'],
  ['POV镜头', ''],
  ['帽子拉起', 'hood pulled up'],
  ['毛绒圆耳', 'fluffy round animal ears on hood'],
  ['领口', 'neckline collar'],
  ['发绳', 'hair tie'],
  ['发饰', 'hair accessory'],
  ['头饰', 'head accessory'],
  ['项圈', 'collar choker'],
  ['动物连体睡衣', 'animal onesie pajamas'],
  ['连体睡衣', 'onesie pajamas'],
  ['怼脸', 'extreme close-up face-fill'],
  ['极近距离', 'extreme close-up'],
  ['脸部占满', 'face fills frame'],
  ['一臂距离', 'arm-length distance'],
  ['手抖', 'accidental phone shake'],
  ['动态模糊', 'motion blur'],
  ['镜头晃', 'camera shake'],
  ['不小心拍到', 'accidental candid snap'],
  ['清晰稳定', 'sharp stable focus'],
  ['认真摆拍', 'intentional stable selfie'],
  ['不要大头贴', 'not extreme close-up'],
  ['不要前置一臂距离', 'not extreme close-up face-fill'],
  ['不要手臂伸向镜头', 'not outstretched arm toward camera'],
  ['无镜子', 'no mirror in scene'],
  ['无镜面', 'no mirror reflection'],
  ['无化妆镜', 'no makeup mirror'],
  ['无墙面反光镜面', 'no glossy wall mirror reflection'],
  ['画面下方', 'bottom of frame'],
  ['画面左侧', 'left side of frame'],
  ['画面右侧', 'right side of frame'],
  ['画面中间', 'center of frame'],
  ['前景', 'foreground'],
  ['后景', 'background'],
  ['中近景', 'medium close-up'],
  ['面部特写', 'facial close-up'],
  ['七分身', 'three-quarter body'],
  ['上半身', 'upper body'],
  ['下半身', 'lower body'],
  ['全身', 'full body'],
  ['特写', 'close-up'],
  ['中景', 'medium shot'],
  ['全景', 'wide shot'],
  ['广角', 'wide angle'],
  ['俯视', 'high angle looking down'],
  ['仰视', 'low angle looking up'],
  ['平视', 'eye level'],
  ['略俯视', 'slight high angle'],
  ['第一人称视角', ''],
  ['第一视角', ''],
  ['随手拍', ''],
  ['后置摄像头', ''],
  ['举机所见', ''],
  ['床上视角', 'in bed'],
  ['卧床', 'lying in bed'],
  ['第三人称', 'third-person view'],
  ['无人物肢体入镜', 'no human body parts in frame'],
  ['年轻男性', 'young man'],
  ['年轻女性', 'young woman'],
  ['蕾丝内衣', 'lace lingerie'],
  ['情趣内衣', 'lingerie'],
  ['湿身', 'wet skin'],
  ['阴唇', 'labia'],
  ['阴蒂', 'clitoris'],
  ['穴口', 'vaginal opening'],
  ['会阴', 'perineum'],
  ['分开双腿', 'legs spread apart'],
  ['全裸', 'fully nude'],
  ['乳头', 'nipples'],
  ['乳头裸露', 'bare nipples exposed'],
  ['阴唇被撑开', 'labia spread open'],
  ['阴蒂充血', 'swollen clitoris'],
  ['爱液湿润', 'wet with arousal fluid'],
  ['手指插入穴口', 'fingers inserted into vaginal opening'],
  ['手指按在阴蒂上', 'fingers pressing on clitoris'],
  ['阴唇阴蒂与穴口', 'labia clitoris and vaginal opening'],
  ['阴唇阴蒂穴口', 'labia clitoris vaginal opening'],
  ['半裸', 'partially nude'],
  ['只穿内衣', 'wearing only underwear'],
  ['浴袍敞开至腰', 'bathrobe open to waist'],
  ['胸前曲线裸露', 'bare chest curves exposed'],
  ['胸腹与大腿入镜', 'chest abdomen and thighs in frame'],
  ['内衣肩带滑落', 'lingerie strap slipped off shoulder'],
  ['撩起内衣肩带', 'pulling up lingerie strap'],
  ['皮肤上薄汗', 'light sweat on skin'],
  ['昏黄床头灯', 'dim warm bedside lamp'],
  ['裸体', 'nude body'],
  ['赤裸', 'naked'],
  ['裸露', 'exposed skin'],
  ['露胸', 'bare chest exposed'],
  ['乳房', 'breasts'],
  ['臀部', 'buttocks'],
  ['阴部', 'genitals'],
  ['大腿内侧', 'inner thighs'],
  ['锁骨', 'collarbone'],
  ['腹肌', 'abdominal muscles'],
  ['腰窝', 'lower back dimples'],
  ['舌吻', 'french kiss'],
  ['相拥', 'embracing'],
  ['亲吻', 'kissing'],
  ['骑坐', 'straddling'],
  ['压在身上', 'lying on top of partner'],
  ['手伸进', 'hand reaching into'],
  ['撩起', 'lifting up'],
  ['拉开', 'pulling open'],
  ['解开', 'unfastening'],
  ['褪下', 'sliding down'],
  ['掀起', 'lifting'],
  ['浴室镜', 'bathroom mirror'],
  ['镜子前', 'in front of mirror'],
  ['镜中', 'in mirror reflection'],
  ['一手举手机', 'one hand holding smartphone'],
  ['另一手', 'other hand'],
  ['举手机拍镜', 'holding phone toward mirror'],
  ['手机在镜中可见', 'phone visible in mirror'],
  ['比耶', 'peace sign gesture'],
  ['撩发', 'tucking hair'],
  ['侧头', 'head tilted'],
  ['眼神躲闪', 'averted gaze'],
  ['眼神湿漉漉', 'teary glistening eyes'],
  ['脸颊薄红', 'light blush on cheeks'],
  ['脸颊泛红', 'flushed cheeks'],
  ['唇微抿', 'lips slightly pursed'],
  ['唇微张', 'slightly parted lips'],
  ['鼻头微红', 'reddened nose tip'],
  ['睫挂泪珠', 'teardrops on eyelashes'],
  ['眼眶泛红', 'reddened eye rims'],
  ['眼底柔光', 'soft light in eyes'],
  ['嘴角浅抿', 'corners of mouth softly pressed'],
  ['嘴角浅笑', 'faint smile'],
  ['神情安静', 'calm expression'],
  ['神情慵懒', 'lazy relaxed expression'],
  ['水汽朦胧', 'misty steam haze'],
  ['镜前顶灯', 'overhead mirror light'],
  ['午后窗光', 'afternoon window light'],
  ['午后阳光', 'afternoon sunlight'],
  ['午后柔和窗光', 'soft afternoon window light'],
  ['傍晚渐变天空', 'sunset gradient sky'],
  ['金色侧逆光', 'golden rim side backlight'],
  ['海平线渐变', 'horizon gradient'],
  ['阴云散射光', 'overcast diffused light'],
  ['阴雨天灰调', 'rainy day gray tones'],
  ['暮光暖色', 'warm twilight tones'],
  ['顶灯暖黄', 'warm yellow ceiling light'],
  ['暖白镜前顶灯', 'warm white mirror vanity light'],
  ['冷白荧光灯', 'cool white fluorescent light'],
  ['霓虹倒映', 'neon reflections'],
  ['湿路面', 'wet pavement'],
  ['雨后街道', 'street after rain'],
  ['浅色墙壁虚化', 'soft blurred pale wall background'],
  ['瓷砖反光', 'tile reflections'],
  ['地砖暖色反光', 'warm-toned floor tile reflections'],
  ['卧室窗边', 'bedroom window side'],
  ['卧室', 'bedroom'],
  ['浴室', 'bathroom'],
  ['咖啡馆室内', 'cafe interior'],
  ['窗外阴天灰调', 'overcast gray tones outside window'],
  ['白色球鞋', 'white sneakers'],
  ['牛仔裤裤脚', 'jeans cuffs'],
  ['米色卫衣', 'beige hoodie'],
  ['深蓝浴袍', 'dark blue bathrobe'],
  ['衬衫衣领', 'shirt collar'],
  ['橘猫', 'orange cat'],
  ['脚边', 'at feet'],
  ['地砖', 'floor tiles'],
  ['海平线', 'horizon line'],
  ['夕阳', 'sunset'],
  ['街景', 'street view'],
  ['风景', 'landscape'],
  ['窗外', 'outside window view'],
  ['半杯咖啡', 'half cup of coffee'],
  ['手边', 'at hand'],
  ['角色', 'character'],
  ['不要', 'not'],
  ['禁止', 'not'],
  ['银发', 'silver hair'],
  ['室内台灯光', 'indoor desk lamp light'],
  ['暖色墙面', 'warm-toned wall'],
  ['男性', 'male'],
  ['女性', 'female'],
  ['男人', 'man'],
  ['女人', 'woman'],
  ['男孩', 'boy'],
  ['女孩', 'girl'],
]

const TAG_PHRASES_SORTED = [...TAG_PHRASE_ENTRIES].sort((a, b) => b[0].length - a[0].length)

function translateTagSegmentSync(segment: string): string {
  let s = segment.trim()
  if (!s) return s
  for (const [from, to] of TAG_PHRASES_SORTED) {
    if (s.includes(from)) s = s.split(from).join(to)
  }
  return s.replace(/\s+/g, ' ').trim()
}

/** 同步词典翻译（未命中片段保留，供异步 LLM 补全） */
export function translateCharacterMediaPromptTagsToEnglishSync(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed || !hasSignificantCjk(trimmed)) return trimmed
  const parts = trimmed
    .split(/[,，]/)
    .map((part) => translateTagSegmentSync(part.trim()))
    .filter(Boolean)
  return parts.join(', ').replace(/\s+/g, ' ').replace(/,{2,}/g, ',').trim()
}

const IMAGE_TAG_TRANSLATION_SYSTEM = `You translate Chinese image-generation tags into English Stable-Diffusion-style comma-separated tags.

Rules:
- Output ONLY English tags separated by commas. No sentences, no markdown, no explanation.
- Preserve every visual fact bluntly and completely, including intimate/NSFW anatomy, nudity level, clothing state, contact points, fluids, and poses. Do NOT censor, euphemize, or omit.
- Third-person camera-visible facts only; no psychology or story causality.
- Short tag phrases; total roughly 80-220 English characters.
- Do NOT add style/quality words (anime, realistic, 8k, masterpiece, photorealistic).`

/** 异步 LLM 补译（词典未覆盖的中文 tag） */
export async function translateCharacterMediaPromptToEnglishAsync(prompt: string): Promise<string> {
  const trimmed = prompt.trim()
  if (!trimmed || !hasSignificantCjk(trimmed)) return trimmed

  const cfg = await loadResolvedApiConfig('chatCard')
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    return translateCharacterMediaPromptTagsToEnglishSync(trimmed)
  }

  const text = await openAiCompatibleChatLenient(
    cfg,
    [
      { role: 'system', content: IMAGE_TAG_TRANSLATION_SYSTEM },
      {
        role: 'user',
        content: `Translate these Chinese image tags to English (comma-separated tags only):\n${trimmed}`,
      },
    ],
    { temperature: 0.15, max_tokens: 420 },
  )

  const out = String(text ?? '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,{2,}/g, ',')
    .trim()

  if (!out || hasSignificantCjk(out)) {
    return translateCharacterMediaPromptTagsToEnglishSync(trimmed)
  }
  return out
}

/** 发往生图 API 前：中文 tag → 英文 tag */
export async function resolveCharacterMediaPromptEnglish(prompt: string): Promise<string> {
  const trimmed = prompt.trim()
  // wx-selfie 自拍：场景句英文 + The character appearance 中文块，整体透传
  if (hasCharacterMediaSelfiePrefix(trimmed)) {
    return trimmed.replace(/\s+/g, ' ').trim()
  }
  const synced = translateCharacterMediaPromptTagsToEnglishSync(trimmed)
  if (!hasSignificantCjk(synced)) return synced
  try {
    return await translateCharacterMediaPromptToEnglishAsync(synced)
  } catch {
    return synced
  }
}
