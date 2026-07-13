import { hasCharacterMediaSelfiePrefix } from '../../../components/moments/characterMediaSelfiePrefix'
import { isCharacterMediaSelfiePrompt } from '../../../components/moments/momentsImagePromptEnhancer'

const INTIMATE_ENGLISH =
  /\b(nsfw|nude|naked|topless|bottomless|sex\b|fellatio|blowjob|missionary|cowgirl|doggy|doggystyle|sex from behind|handjob|footjob|paizuri|tribadism|cunnilingus|vaginal|penis|pussy|labia|clitoris|vaginal opening|nipples?\b|bare chest|spread legs|spread pussy|cum\b|facial|exhibitionism|lingerie|underwear|panties|erection|intercourse|orgasm|masturbat|deepthroat|paizuri|spooning|prone bone|suspended congress|girl on top|boy on top|clothed female nude male|yaoi|yuri|boys love|girls love|2boys?|2girls?|anal|scissoring)\b/i

const INTIMATE_CHINESE =
  /裸体|全裸|半裸|赤裸|露点|走光|做爱|性交|口交|后入|女上位|骑乘|正常位|传教士|乳交|手交|足交|腿交|颜射|自慰|射精|内裤|文胸|胸罩|乳头|阴唇|阴蒂|小穴|私处|肉棒|丁丁|床照|掀开|脱下|舔|深喉|口爆|掰|抠|骑脸|睡奸|轮奸|前后夹击|百合|女同|男同|耽美|扶她|足控|涩|色图|黄图|发骚|湿身|情趣|蕾丝/i

const INTIMATE_ANATOMY_ENGLISH =
  /\b(labia|clitoris|vaginal opening|genitals|areola|pubic|breasts out|breasts grab|nipples visible)\b/i

const CASUAL_ONLY_HINT =
  /^(?:selfie shot|mirror selfie shot)?[,\s]*(rainy street|coffee|sunset horizon|peace sign|风景|美食|咖啡|奶茶|天空|街景|猫|狗|office desk|keyboard)/i

/** 是否应走 NSFW 姿势库注入（日常自拍/风景/美食不触发） */
export function isCharacterMediaNsfwImageScene(params: {
  imagePrompt: string
  chatContextTail?: string
}): boolean {
  const prompt = String(params.imagePrompt ?? '').trim()
  const context = String(params.chatContextTail ?? '').trim()
  const combined = [prompt, context].filter(Boolean).join('\n')
  if (!combined) return false

  const intimate =
    INTIMATE_ENGLISH.test(combined) ||
    INTIMATE_CHINESE.test(combined) ||
    INTIMATE_ANATOMY_ENGLISH.test(combined)

  if (!intimate) return false

  if (
    CASUAL_ONLY_HINT.test(prompt) &&
    !INTIMATE_ANATOMY_ENGLISH.test(prompt) &&
    !INTIMATE_CHINESE.test(prompt)
  ) {
    return false
  }

  if (isCharacterMediaSelfiePrompt(prompt) && hasCharacterMediaSelfiePrefix(prompt)) {
    const body = prompt.replace(/^\[wx-selfie\|[^\]]*]\s*/i, '').trim()
    if (/^selfie shot,\s*(grey t-shirt|bedroom|soft morning)/i.test(body) && !intimate) {
      return false
    }
  }

  return true
}
