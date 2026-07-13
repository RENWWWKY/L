/**
 * 估算微信私聊 system 提示词各模块字符数与 token（粗算）。
 * 运行: node scripts/measure-wechat-prompt-tokens.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(root, '..', 'src')

function read(file) {
  return fs.readFileSync(path.join(src, file), 'utf8')
}

function extractTemplateLiteral(source, opener) {
  const start = source.indexOf(opener)
  if (start < 0) throw new Error(`missing opener: ${opener}`)
  let i = start + opener.length
  let content = ''
  while (i < source.length) {
    const ch = source[i]
    if (ch === '`' && source[i - 1] !== '\\') break
    content += ch
    i++
  }
  return content
}

function estTokens(chars) {
  return Math.round(chars / 0.6)
}

const chatPrompt = read('phone/apps/wechat/wechatChatPrompt.ts')
const replyPrompt = read('phone/apps/wechat/wechatReplyOutputPrompt.ts')
const forward = read('phone/apps/wechat/chatHistory/wechatForwardHistorySituation.ts')
const profileImg = read('phone/apps/wechat/wechatCharacterProfileImageApply.ts')
const profileUpd = read('phone/apps/wechat/wechatCharacterProfileUpdateApply.ts')
const momentPub = read('phone/apps/wechat/wechatCharacterMomentPublishApply.ts')
const momentSong = read('phone/apps/wechat/wechatCharacterMomentSongShareApply.ts')
const momentPin = read('phone/apps/wechat/wechatCharacterMomentPinApply.ts')
const stickerRules = read('phone/apps/wechat/stickers/stickerPromptRules.ts')
const takeout = read('phone/apps/wechat/takeout/takeoutOrderShareAiDirective.ts')
const pulse = read('phone/apps/wechat/pulse/pulseShareAiDirective.ts')
const loreArchive = read('phone/worldbook/loreArchiveBuiltinPresets.ts')

const roleplay = extractTemplateLiteral(chatPrompt, 'export const WECHAT_ROLEPLAY_SYSTEM_PROMPT = `')
const lumiOverride = extractTemplateLiteral(replyPrompt, 'export const LUMI_SYSTEM_OVERRIDE_APPENDIX = `')
const outputTemplate = extractTemplateLiteral(replyPrompt, 'const WECHAT_REPLY_OUTPUT_APPENDIX_TEMPLATE = `')
const cotTemplate = extractTemplateLiteral(replyPrompt, 'const WECHAT_THINKING_CHAIN_APPENDIX_TEMPLATE = `')
const favorCot = extractTemplateLiteral(replyPrompt, 'export const FAVORABILITY_SYSTEM_COT_APPENDIX = `')
const relTextureBody = extractTemplateLiteral(replyPrompt, 'const RELATIONSHIP_TEXTURE_COT_BODY = `')
const relTextureCotRaw = extractTemplateLiteral(replyPrompt, 'export const RELATIONSHIP_TEXTURE_COT_APPENDIX = `')
const relTextureCot = relTextureCotRaw.replace(/\$\{RELATIONSHIP_TEXTURE_COT_BODY\}/g, relTextureBody)
const freeWill = extractTemplateLiteral(replyPrompt, 'export const CHARACTER_FREE_WILL_ILLUSION_APPENDIX = `')
const lumiLove = extractTemplateLiteral(replyPrompt, 'export const LUMI_DOCTRINE_OF_LOVE_APPENDIX = `')
const emotionEngine = extractTemplateLiteral(replyPrompt, 'export const CHARACTER_EMOTION_CONFESSION_ENGINE_APPENDIX = `')
const forwardAppendix = extractTemplateLiteral(forward, 'export const WECHAT_FORWARD_HISTORY_FORGER_APPENDIX = `')
const profileImgAppendix = extractTemplateLiteral(profileImg, 'export const WECHAT_CHARACTER_PROFILE_IMAGE_APPLY_APPENDIX = `')
const profileUpdAppendix = extractTemplateLiteral(profileUpd, 'export const WECHAT_CHARACTER_PROFILE_UPDATE_APPENDIX = `')
const momentPubAppendix = extractTemplateLiteral(momentPub, 'export const WECHAT_CHARACTER_MOMENT_PUBLISH_APPENDIX = `')
const momentSongAppendix = extractTemplateLiteral(momentSong, 'export const WECHAT_CHARACTER_MOMENT_SONG_SHARE_APPENDIX = `')
const momentPinAppendix = extractTemplateLiteral(momentPin, 'export const WECHAT_CHARACTER_MOMENT_PIN_APPENDIX = `')
const stickerConservative = extractTemplateLiteral(stickerRules, 'export const WECHAT_STICKER_SEND_CONSERVATIVE_RULE = `')
const stickerSemantics = extractTemplateLiteral(stickerRules, 'export const WECHAT_STICKER_DESCRIPTION_SEMANTICS_RULE = `')

// takeout/pulse blocks are functions - extract return template if simple
function extractFunctionReturnTemplate(source, fnName) {
  const fnStart = source.indexOf(`export function ${fnName}`)
  if (fnStart < 0) return ''
  const slice = source.slice(fnStart, fnStart + 4000)
  const ret = slice.match(/return `([\s\S]*?)`\.trim\(\)/)
  return ret ? ret[1] : ''
}

const takeoutBlock = extractFunctionReturnTemplate(takeout, 'buildWeChatTakeoutOrderOutputBlock')
const pulseBlock = extractFunctionReturnTemplate(pulse, 'buildWeChatPulseShareOutputBlock')

// 恋爱预设默认全开：两段都注入
const romanceSections = `${lumiLove}\n\n${emotionEngine}`

// 恋爱 CoT steps（默认全开：两步内化指针，非全文复述）
const romanceCotSteps = [
  '- 第五步：内化「Lumi 高质量爱情观」（条文已在输出协议注入；只做内化校准，**禁止**复述条文）',
  '- 第六步：内化「情感破冰与告白引擎」（条文已在输出协议注入；校准是否应推进告白/关系确认，**禁止**复述条文）',
].join('\n')

const outputAppendix =
  outputTemplate
    .replace('{{ROMANCE_SECTIONS}}', romanceSections ? `\n${romanceSections}\n` : '')
    .replace('{{TAKEOUT_ORDER_SECTION}}', takeoutBlock)
    .replace('{{PULSE_SHARE_SECTION}}', pulseBlock)
    .trim() +
  '\n\n' +
  stickerConservative +
  '\n\n' +
  stickerSemantics

// CoT 模板在源码里是带 ${VAR} 插值的 template literal；按展开后长度估算
const cotAppendix = cotTemplate
  .replace('{{ROMANCE_COT_STEPS}}', romanceCotSteps ? `${romanceCotSteps}\n` : '')
  .replace(/\$\{RELATIONSHIP_TEXTURE_COT_APPENDIX\}/g, relTextureCot)
  .replace(/\$\{FAVORABILITY_SYSTEM_COT_APPENDIX\}/g, favorCot)
  .replace(/\$\{CHARACTER_FREE_WILL_ILLUSION_APPENDIX\}/g, freeWill)

const selfServiceNoCot = [
  outputAppendix,
  forwardAppendix,
  profileImgAppendix,
  profileUpdAppendix,
  momentPubAppendix,
  momentSongAppendix,
  momentPinAppendix,
].join('\n\n')

const parts = {
  'WECHAT_ROLEPLAY_SYSTEM_PROMPT': roleplay,
  'LUMI_SYSTEM_OVERRIDE_APPENDIX': lumiOverride,
  '输出协议（含恋爱预设+贴纸规则）': outputAppendix,
  'CoT 整块（后台思维链）': cotAppendix,
  '自服务附录合计（无 CoT）': selfServiceNoCot,
}

const baselineNoCot = roleplay.length + lumiOverride.length + selfServiceNoCot.length
const baselineWithCot = baselineNoCot + cotAppendix.length

console.log('=== 微信私聊 system 固定底座（无角色卡/记忆/世界书/历史/transcript）===\n')
for (const [name, text] of Object.entries(parts)) {
  console.log(name)
  console.log(`  字符: ${text.length.toLocaleString()}  |  估算 token: ~${estTokens(text.length).toLocaleString()}\n`)
}

console.log('--- 汇总（关 CoT 开关时）---')
console.log(`固定 system 底座: ${baselineNoCot.toLocaleString()} 字  ≈ ${estTokens(baselineNoCot).toLocaleString()} token`)
console.log(`若开启 CoT:       ${baselineWithCot.toLocaleString()} 字  ≈ ${estTokens(baselineWithCot).toLocaleString()} token`)
console.log(`CoT 节省:         ${cotAppendix.length.toLocaleString()} 字  ≈ ${estTokens(cotAppendix.length).toLocaleString()} token`)
console.log('\n说明：')
console.log('- token 按中文为主粗算（约 0.6 字/token）；不同模型分词会有 ±10～20% 偏差。')
console.log('- 实际每轮还会叠加：角色卡、世界书、长期记忆、未总结片段、贴纸目录、媒体频率等，常见再 +3k～15k token。')
console.log('- 对话历史 transcript 另计，随轮次增长。')
