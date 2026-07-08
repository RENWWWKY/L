/**
 * 内置固定提示词 token 估算（不含角色人设/世界书/记忆/历史/当轮输入）
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const r = (p) => readFileSync(join(root, p), 'utf8')

function tok(t) {
  const cjk = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length
  return Math.ceil(cjk / 1.45 + (t.length - cjk) / 3.8)
}

function extractBacktickBlock(code, marker) {
  const i = code.indexOf(marker)
  if (i < 0) return ''
  const start = i + marker.length
  let depth = 0
  let j = start
  while (j < code.length) {
    if (code[j] === '\\') {
      j += 2
      continue
    }
    if (code[j] === '`') {
      if (depth === 0) depth = 1
      else return code.slice(start, j)
    }
    j++
  }
  return code.slice(start)
}

function extractExportTpl(code, name) {
  return extractBacktickBlock(code, `export const ${name} = \``) || extractBacktickBlock(code, `const ${name} = \``)
}

function extractBetween(code, startMarker, endMarker) {
  const i = code.indexOf(startMarker)
  if (i < 0) return ''
  const j = code.indexOf(endMarker, i + startMarker.length)
  return code.slice(i + startMarker.length, j < 0 ? code.length : j)
}

function sumSectionConsts(code) {
  const re = /const SECTION_[A-Z0-9_]+ = (?:String\.raw)?`([\s\S]*?)`(?:\.trim\(\))?/g
  let total = ''
  let m
  while ((m = re.exec(code))) total += m[1] + '\n\n'
  return total.replace(/\{\{user\}\}/g, '玩家').replace(/\bBruce\b/g, 'Lumi').replace(/馆长Bruce/g, '馆长Lumi')
}

function grabConcatRule(code, name) {
  const re = new RegExp(`const ${name} =\\s*([\\s\\S]*?)(?=\\n  const \\w+)`)
  const block = code.match(re)?.[1] ?? ''
  return [...block.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)]
    .map((m) => m[1].replace(/\\`/g, '`').replace(/\$\{[^}]+\}/g, 'X'))
    .join('')
}

// ── 线上 ──
const reply = r('src/phone/apps/wechat/wechatReplyOutputPrompt.ts')
const chatPrompt = r('src/phone/apps/wechat/wechatChatPrompt.ts')
const chatAi = r('src/phone/apps/wechat/wechatChatAi.ts')

const roleplay = extractBetween(chatPrompt, 'export const WECHAT_ROLEPLAY_SYSTEM_PROMPT = `', '`')
const ov = extractExportTpl(reply, 'LUMI_SYSTEM_OVERRIDE_APPENDIX')
const love = extractExportTpl(reply, 'LUMI_DOCTRINE_OF_LOVE_APPENDIX')
const conf = extractExportTpl(reply, 'CHARACTER_EMOTION_CONFESSION_ENGINE_APPENDIX')
const fav = extractExportTpl(reply, 'FAVORABILITY_SYSTEM_COT_APPENDIX')
const fw = extractExportTpl(reply, 'CHARACTER_FREE_WILL_ILLUSION_APPENDIX')
const relBody = extractExportTpl(reply, 'RELATIONSHIP_TEXTURE_COT_BODY')
const relOnline = extractExportTpl(reply, 'RELATIONSHIP_TEXTURE_COT_APPENDIX').replace('${RELATIONSHIP_TEXTURE_COT_BODY}', relBody)
const relOffline = extractExportTpl(reply, 'RELATIONSHIP_TEXTURE_COT_OFFLINE_APPENDIX').replace('${RELATIONSHIP_TEXTURE_COT_BODY}', relBody)

const replyTpl = extractExportTpl(reply, 'WECHAT_REPLY_OUTPUT_APPENDIX_TEMPLATE')
const takeout = r('src/phone/apps/takeout/tasteTakeoutAiCatalog.ts').match(/return `\n([\s\S]*?)`\.trim\(\)/)?.[1] ?? ''
const pulse = r('src/phone/apps/wechat/pulse/pulseShareAiDirective.ts').match(/return `\n([\s\S]*?)`\.trim\(\)/)?.[1] ?? ''
const romanceOnline = `【Lumi高质量爱情观】\n${love}\n\n【{{char}} 情感破冰与告白演绎引擎】\n${conf}`
const replyFull = replyTpl
  .replace('{{ROMANCE_SECTIONS}}', `\n${romanceOnline}\n`)
  .replace('{{TAKEOUT_ORDER_SECTION}}', takeout ? `\n${takeout}\n` : '')
  .replace('{{PULSE_SHARE_SECTION}}', pulse ? `\n${pulse}\n` : '')

const thinkTpl = extractExportTpl(reply, 'WECHAT_THINKING_CHAIN_APPENDIX_TEMPLATE')
const romanceCot = `【Lumi高质量爱情观·思维链步骤】\n${love}\n\n【情感破冰与告白·思维链步骤】\n${conf}`
const thinking = thinkTpl
  .replace('${LUMI_SYSTEM_OVERRIDE_APPENDIX}', ov)
  .replace('${RELATIONSHIP_TEXTURE_COT_APPENDIX}', relOnline)
  .replace('${FAVORABILITY_SYSTEM_COT_APPENDIX}', fav)
  .replace('${CHARACTER_FREE_WILL_ILLUSION_APPENDIX}', fw)
  .replace('{{ROMANCE_COT_STEPS}}', `\n${romanceCot}\n`)

const forward = extractExportTpl(r('src/phone/apps/wechat/chatHistory/wechatForwardHistorySituation.ts'), 'WECHAT_FORWARD_HISTORY_FORGER_APPENDIX')
const recall = extractBacktickBlock(chatAi, 'const WECHAT_CHARACTER_RECALL_GUIDE = `\n').replace(/`\.trim\(\)$/, '') ||
  extractBetween(chatAi, 'const WECHAT_CHARACTER_RECALL_GUIDE = `\n', '`.trim()')
const stickerRules =
  extractExportTpl(r('src/phone/apps/wechat/stickers/stickerPromptRules.ts'), 'WECHAT_STICKER_SEND_CONSERVATIVE_RULE') +
  '\n\n' +
  extractExportTpl(r('src/phone/apps/wechat/stickers/stickerPromptRules.ts'), 'WECHAT_STICKER_DESCRIPTION_SEMANTICS_RULE')
const prof = ['wechatCharacterProfileImageApply.ts', 'wechatCharacterProfileUpdateApply.ts', 'wechatCharacterMomentPublishApply.ts', 'wechatCharacterMomentSongShareApply.ts', 'wechatCharacterMomentPinApply.ts']
  .map((f) => r('src/phone/apps/wechat/' + f).match(/APPENDIX = `\n([\s\S]*?)`\.trim\(\)/)?.[1] ?? '')
  .join('\n\n')

const peerLine =
  '\n\n---\n【会话对方】对方的微信资料名或备注可能显示为：朋友。请用自然称呼，不要机械重复全名除非语境需要。\n对方发来的内容里出现的「我」「我的」，默认指朋友本人正在自述——不要把那些事当成角色自己的遭遇来接续叙述。\n【技术席位说明】在本请求的消息列表里：role 为 user 的条目即该真人已发送内容；role 为 assistant 的条目即你（对方角色）已发送过的历史。你本轮只生成新的 assistant 侧回复。禁止身份倒错、禁止替该真人续写其下一句台词。\n'
const memFence = '\n\n---\n【长期记忆适用边界】下方【长期记忆】条目**仅**锚定当前会话对象人设 id；**禁止**把其中事实套用到未在场的其他联系人，**禁止**引用与本会话对象无关的他人记忆（防串台）。\n'

const outputAppendix = [replyFull, stickerRules, forward, thinking, prof].join('\n\n')
const onlineCore = [roleplay, ov, memFence, peerLine, recall, outputAppendix].join('\n\n')
const stickerCatalogCap = 9500 + 4200
const onlineTypical = onlineCore + '\n' + '·'.repeat(stickerCatalogCap)

// ── 线下 system ──
const datingRules = r('src/phone/apps/wechat/dating/lumiThinkingChainRules.ts')
const supplement = extractExportTpl(datingRules, 'LUMI_OFFLINE_SUPPLEMENT_COT_BOOK')
const offlineExpr = extractExportTpl(r('src/phone/apps/wechat/dating/offlineDatingExpressionRules.ts'), 'OFFLINE_DATING_EXPRESSION_AND_DEMEANOR_RULES')
const prose = extractExportTpl(r('src/phone/apps/wechat/proseForbiddenLexiconPrompt.ts'), 'PROSE_FORBIDDEN_LEXICON_PROMPT')
const shell = extractExportTpl(datingRules, 'DATING_LUMI_SYSTEM_SHELL')
const unified = extractExportTpl(r('src/phone/apps/wechat/dating/lumiOfflineWritingRulebook.ts'), 'LUMI_UNIFIED_STYLE_ATMOSPHERE_BOOK')
const commonBook = extractExportTpl(datingRules, 'LUMI_COMMON_WRITING_ISSUES_SELF_CORRECTION_BOOK')
const cogBook = extractExportTpl(datingRules, 'LUMI_OFFLINE_COGNITIVE_LIMIT_RULES_BOOK')
const richOs = extractExportTpl(r('src/phone/apps/wechat/dating/offlineDatingRichInnerOsAppendix.ts'), 'OFFLINE_DATING_RICH_INNER_OS_APPENDIX')
const scanCount = r('src/phone/apps/wechat/proseForbiddenLexiconPrompt.ts').match(/PROSE_FORBIDDEN_SCAN_TERM_COUNT = (\d+)/)?.[1] ?? '0'
const offlineRomance = [
  `【Lumi高质量爱情观】\n以下规则为本轮恋爱互动与情感表达的**核心总纲**；须在思维链中先对照自检，再决定正文对白、动作、心理与亲密度：\n${love}`,
  `【{{char}} 情感破冰与告白演绎引擎】\n以下规则为本轮情感推进与告白演绎的**硬性约束**；须在思维链中先校准是否触发破冰/告白/关系确认，再决定正文对白、动作、心理与亲密度：\n${conf}`,
  `【线下约会·多内心 OS 描写引擎】\n以下规则为本轮线下约会内心 OS 的**硬性约束**；须在思维链中先规划 OS 分布与字数，再写正文；**覆盖**默认 OS 篇幅规则（单条不少于 40 汉字）：\n${richOs}`,
].join('\n\n')

const booksRaw = datingRules.split(/\r?\n/).slice(231, 341).join('\n')
let books = booksRaw
  .replace('${LUMI_UNIFIED_STYLE_ATMOSPHERE_BOOK}', unified)
  .replace('${LUMI_COMMON_WRITING_ISSUES_SELF_CORRECTION_BOOK}', commonBook)
  .replace('${LUMI_OFFLINE_COGNITIVE_LIMIT_RULES_BOOK}', cogBook)
  .replace('${LUMI_OFFLINE_SUPPLEMENT_COT_BOOK}', supplement)
  .replace('{{OFFLINE_ROMANCE_SECTIONS}}', `\n${offlineRomance}\n`)
  .replace('${RELATIONSHIP_TEXTURE_COT_OFFLINE_APPENDIX}', relOffline)
  .replace('${CHARACTER_FREE_WILL_ILLUSION_APPENDIX}', fw)
  .replace('${FAVORABILITY_SYSTEM_COT_APPENDIX}', fav)
  .replace('${PROSE_FORBIDDEN_SCAN_TERM_COUNT}', scanCount)
for (const k of ['LUMI_NSFW_PRECHECK_COT_BOOK', 'LUMI_INTIMACY_DETAILING_COT_BOOK', 'LUMI_NSFW_STRUCTURE_COT_BOOK', 'LUMI_NARRATIVE_GUIDANCE_BOOK']) {
  books = books.replace('${' + k + '}', extractExportTpl(datingRules, k))
}

const styleCode = r('src/phone/apps/wechat/dating/datingStylePrompt.ts')
const styleAppend = buildDatingStyleSystemAppendDefault(styleCode)
const charUser = buildDatingCharUserDirective('角色', '玩家')
const memNote = '【长期记忆】本轮**不要求**在回复末尾输出合并记忆 JSON；请专注剧情正文。记忆由客户端在落库后后台处理。\n'

const datingSystem = [charUser, shell, ov, offlineExpr, books, styleAppend, memNote, prose].join('\n\n')

function buildDatingStyleSystemAppendDefault(code) {
  const stylePrompt = code.match(/DEFAULT_STYLE_PROMPT = \[([\s\S]*?)\]\.join\(' '\)/)?.[1]?.replace(/'/g, '').replace(/\s+/g, ' ').trim() ?? ''
  const ref = code.match(/DEFAULT_REFERENCE_SNIPPET = \[([\s\S]*?)\]\.join\('\\n'\)/)?.[1]?.replace(/'/g, '\n').trim() ?? ''
  return `\n\n【文风参考源】本轮未检测到用户自定义文风配置：默认采用「汪曾祺式现实白描」与内置示例片段进行模仿。\n\n【写作风格约束】\n接下来请推进剧情。请严格遵循以下文风：${stylePrompt}\n\n【参考笔触学习】\n你可以参考以下文本的笔触和行文节奏进行模仿；并尽量让输出在句式密度、标点节奏与用词习惯上与之一致：\n"""${ref}"""`
}

function buildDatingCharUserDirective(c, u) {
  return (
    `【指称约定（最高优先级）】\n` +
    `- 「约会对象 / 当前人设」=「${c}」；「玩家」= 该人设绑定的玩家身份「${u}」。\n` +
    `- 人设侧世界书、档案室条目中出现的「{{char}}」「{{user}}」已替换为「${c}」「${u}」；其中**写在与「${u}」绑定的一侧**的校内职务、社团职级、远近关系等，**一律视为对玩家的有效设定**，与「用户身份卡」摘要**互补**——身份卡未逐字写的条目项**不得**当成「不存在」，也**禁止**因叙事常以「${c}」为描写重心，就把条目中赋予「${u}」的职务或上级身份改写到「${c}」头上。\n` +
    `- 「用户身份卡」及**玩家身份专属**世界书：专述玩家本体档案；勿把其中条目与「${c}」的人设条目混写、对调。\n` +
    `- 正文输出请直接写真实姓名或语境下合理称呼。\n\n`
  )
}

// ── 线下 user（典型：角色视角·第三人称·不抢话·无玩家输入·普通模式）──
const datingCtx = r('src/phone/apps/wechat/dating/DatingContext.tsx')
const userReaction = buildUserReactionBlock(false, false, '用户', '角色', false)
const STYLE_HINT =
  '旁白直写；对白只能用双引号"..."；内心OS：**仅**用一对英文半角 ** 包裹**一整句**可读心思（与界面渲染一致）；**禁止**星号内只有「我……」「我…」占位；**禁止**在 ** 外单独缀一行「我……」；上帝视角时旁白用他/她写约会对象与 NPC，他人心念/视线指向玩家须用「你」勿用身份卡姓名；OS 内「我」仍指约会对象且须语义连贯，勿在 OS 里写第三人称评价串戏。' +
  '对白口吻与微信私聊同角色对齐：口语短句、活人感；对白里勿用（）堆神态。'

const targetChars = 500
const minBody = Math.max(55, Math.round(targetChars * 0.88))
const maxBody = Math.round(targetChars * 1.18)
const lengthRule =
  `【篇幅·请严格遵守】「正文」=<thinking> 之后输出的剧情部分；**正文字数**按其中**汉字**估算（对白里的汉字计入；不含 <thinking> 内文字；不要用纯标点、空格或同义排比硬凑）。` +
  `用户目标 ${targetChars} 字 → **请把正文控制在约 ${minBody}～${maxBody} 字区间内**。**若你预估会低于 ${minBody}，必须增写 1～4 句带新信息的对白或可见动作后再收束**；若明显超过 ${maxBody} 可删无效氛围句。补足字数禁止靠堆砌感官或重复同义句。\n` +
  `【思维链·速度】\`<thinking>\` 内全文建议 **≤ 900 汉字**（含【】标题）；各分册各 **1～3 句** 即可；【Lumi终检单】22 项可 **每项一行**（「无」须带半句理由）。**禁止**在思维链里写数千字长文——会极慢且易超出接口上限。`

const userRulesNormal = [
  '本轮模式：角色视角：允许自然对白互动，但保持克制真实，不油腻；**线上微信聊天已说定内容为既定事实**，线下须服从（见【线上聊天事实铁律】），不得把已聊事实当新料对用户重复宣布。',
  '人称要求：以下一段以第三人称叙事为主（他/她/他们），像镜头旁观。',
  lengthRule,
  grabConcatRule(datingCtx, 'antiFluffRule'),
  grabConcatRule(datingCtx, 'dialogueDrivenPlotRule').replace(/X/g, '角色'),
  grabConcatRule(datingCtx, 'npcRealNameRule'),
  grabConcatRule(datingCtx, 'normalPlotFormatRule'),
  grabConcatRule(datingCtx, 'plotEmotionalDirectionRule'),
  grabConcatRule(datingCtx, 'plotAntiEchoRule'),
  userReaction,
  STYLE_HINT,
  '请续写下一段剧情。',
].filter((x) => x.length > 40).join('\n\n')

function buildUserReactionBlock(auto, god, user, peer, vn) {
  if (god) return ''
  if (auto) return ''
  const vnLine = vn ? `- VN：**禁止** \`【对白】${user}：\` / \`【对白】你：\` 等玩家说话人行；玩家台词仅存在于历史「玩家输入」，本轮 AI 正文只写 ${peer}/NPC 侧。\n` : ''
  return (
    `【当轮抢话开关：关】\n` +
    `不抢话模式（**须遵守**）：\n` +
    `- **禁止**代写玩家（我/${user}）当轮任何**新**动作、神态、选择或说出口的对白；玩家本轮行为**仅**以界面「玩家输入/导演指令」为准，你只写 ${peer}/NPC 的感知、对白与反应。\n` +
    `- **禁止**正文出现玩家说出口的引号对白：包括「你说…」「你问…」「你低声道…」+ 引号台词；禁止 \`${user}：…\`、\`你：…\` 作玩家台词；**禁止**把玩家输入原句改写法再放进引号。\n` +
    `- **允许**：${peer} 与 NPC 在对白里称呼、质问、回应玩家（那是**角色**的对白，不是玩家对白）。\n` +
    `- 旁白中的「你」**禁止**描写玩家当轮新发起的动作/开口（如「你伸手…」「你开口说…」）；只写 ${peer} 侧等待、观察、抢先开口等。\n` +
    `- 「对白占比≥55%」**只统计** ${peer}/NPC 的引号对白；**禁止**为凑占比编造玩家引号对白。\n` +
    vnLine +
    `思维链【代写边界卡】须写明：抢话=关，正文不含玩家新引号对白/新动作。\n`
  )
}

// VN 格式块：按行号截取（模板内含嵌套反引号，无法用简单正则）
const dcLines = datingCtx.split(/\r?\n/)
const vnFormatStatic = dcLines.slice(1559, 1605).join('\n').replace(/\$\{[^}]+\}/g, '')
const vnCont = grabConcatRule(datingCtx, 'vnContinuityRule').replace(/DATING_AI_PLOT_HISTORY_MAX/g, 'N')

const userRulesVn = [
  ...userRulesNormal.split('\n\n').filter((x) => !x.startsWith('本轮模式：')),
  '本轮模式：角色视角（VN）。',
  vnFormatStatic,
  vnCont,
].join('\n\n')

const offlineNormal = datingSystem + '\n\n' + userRulesNormal
const offlineVn = datingSystem + '\n\n' + userRulesVn

const show = (label, text) => console.log(`${label.padEnd(26)} ${String(text.length).padStart(7)} 字  ~${String(tok(text)).padStart(6)} tok`)

console.log('=== 微信私聊 · 人设 · 普通一轮（档案预设全开）===')
console.log('不含：角色档案/世界书、记忆、时间/日程、链接预览、历史、当轮输入\n')
show('扮演铁则', roleplay)
show('Lumi Override', ov)
show('输出协议+表情规则', replyFull + '\n\n' + stickerRules)
show('后台思维链 CoT', thinking)
show('能力附录', prof)
show('席位/记忆边界/撤回', peerLine + memFence + recall)
show('【线上核心】', onlineCore)
show('【线上+表情目录上限】', onlineTypical)

console.log('\n=== 约会页 · 普通剧情（第三人称·不抢话·默认500字）===')
console.log('不含：角色档案/世界书/档案室、记忆/历史、玩家输入\n')
show('system·思维链分册', books)
show('system·禁词表', prose)
show('system·文风/指称/壳', datingSystem.replace(books, ''))
show('system·合计', datingSystem)
show('user·当轮规则', userRulesNormal)
show('【线下普通 合计】', offlineNormal)

console.log('\n=== 约会页 · VN 叠加 ===')
show('VN 格式块(静态骨架)', vnFormatStatic)
show('VN 连续规则', vnCont)
show('【线下 VN 合计】', offlineVn)

console.log('\n════════ 汇总 ════════')
console.log(`线上（不含表情目录）  ~${tok(onlineCore).toLocaleString()} token`)
console.log(`线上（含表情目录上限）~${tok(onlineTypical).toLocaleString()} token`)
console.log(`线下·普通            ~${tok(offlineNormal).toLocaleString()} token`)
console.log(`线下·VN              ~${tok(offlineVn).toLocaleString()} token`)
console.log('\n注：token 粗估 CJK÷1.45 + 其余÷3.8；表情目录按硬上限 9500+4200 字。')
console.log('VN 格式块未含 buildVnBackground/Bgm/Atmosphere 动态块，实际 VN 可能再 +1～3k token。')
