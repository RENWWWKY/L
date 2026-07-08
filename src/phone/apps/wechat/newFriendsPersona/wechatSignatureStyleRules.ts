/**
 * 微信「个性签名」生成风格：人设 AI / 遇见九维 / 批量补全微信资料 / 私聊改签名共用。
 * 目标：像个人名片/座右铭一样的稳定装饰，而非每轮随手改的喊话或打工人模板。
 */

/** 私聊改签名指令与批量补全时的硬上限 */
export const WECHAT_SIGNATURE_DISPLAY_MAX = 22

/** 角色主动改签名冷却（毫秒）：非用户明确要求时，间隔内忽略改签名指令 */
export const WECHAT_SIGNATURE_CHANGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

/** 人设 JSON 生成允许的上限（展示前仍会 clamp） */
export const WECHAT_SIGNATURE_GENERATE_MAX = 28

/** 离线/缺省兜底池：口语、留白，禁止从长档案截断 */
export const WECHAT_SIGNATURE_FALLBACK_POOL = [
  '会好 迟早',
  '随心即满分',
  '答案在明天',
  '不计划太多反而能勇敢冒险',
  '听喜欢的歌 吹傍晚的风',
  '人生嘛 捂住耳朵做自己才快乐',
  '慢热 熟了会好聊很多',
  '橙黄橘绿时',
  '零碎的岛屿终会遇到海',
] as const

const STYLE_EXAMPLES = [
  '橙黄橘绿时',
  '会好 迟早',
  '随心即满分',
  '答案在明天',
  '生活本就应该五颜六色',
  '零碎的岛屿终会遇到海',
  '独处 是一场美丽的消耗',
  '翻篇是一种超能力',
  '自由就是不再寻求认可',
  '我与世界 就是帧帧瞬间',
  '不计划太多反而能勇敢冒险',
  '路虽远 行则将至',
  'Everything wins',
  '要自由 且随性的活着',
  '听喜欢的歌 吹傍晚的风 看太阳缓缓落下',
  '妈野 人生是矿工',
] as const

const ANTI_PATTERNS = [
  '打工人/职场模板：下班了别找我、勿扰、搬砖、摸鱼、加班中、消息晚点回、已读不回、打工牛马',
  '鸡汤口号：热爱生活 / 做最好的自己 / 温柔且坚定 / 向阳而生 / 未来可期 / 今天也要加油',
  '对特定人喊话/挑衅/点名：某个小子、下次别被我逮到、你小子等着、@某人、出来挨打、渣男退散',
  '对读者命令：别… / 请… / 你要… / 记得喝水 / 照顾好自己',
  '赛博堆词：404、频段、波长、像素、光合作用、云端',
  'AI 文艺腔：劫灰、暗处的光、等你读懂我的隐喻、绝弦、青柠气泡水式长比喻',
  '把职业、MBTI、人设标签写进签名（如「INTJ 的日常」「某医生的值班日」）',
  '网址、引流、无意义符号堆叠',
  '与 motto 座右铭雷同或互相复制',
  '把私聊剧情台词、吵架喊话、临时心情当成签名（签名应像名片装饰，长期稳定）',
] as const

/** 对特定人喊话/挑衅式签名（恋人甜蜜署名除外见 LOVER_SIGNATURE_HINT） */
const SHOUTOUT_SIGNATURE_REGEXES: RegExp[] = [
  /某个.{0,12}(小子|家伙|人|玩意|臭)/,
  /下次.{0,10}(别|不要|可别|再).{0,10}(逮|抓|遇到|让我)/,
  /别被我.{0,8}(逮|抓|遇到)/,
  /(你|那|这).{0,6}(小子|家伙).{0,16}(别|等着|下次|给我)/,
  /给我等着/,
  /走着瞧/,
  /有本事.{0,8}来/,
  /@.{2,16}/,
  /出来(挨打|单挑|对线|算账)/,
  /渣男|渣女/,
  /退散/,
  /逮到/,
]

/** 模型常输出的「人机模板签名」——命中则降级为 fallback */
const TEMPLATE_SIGNATURE_REGEXES: RegExp[] = [
  /下班/,
  /别找(我|人)?/,
  /别烦(我|人)?/,
  /勿扰/,
  /摸鱼/,
  /搬砖/,
  /打工人/,
  /打工牛马/,
  /加班/,
  /上班中/,
  /工作(ing|中)/i,
  /已读不回/,
  /消息.{0,6}回/,
  /看到就回/,
  /人间清醒/,
  /热爱生活/,
  /做最?好的自己/,
  /温柔且?坚定/,
  /向阳而生/,
  /未来可期/,
  /今天也要加油/,
  /又是元气/,
  /加油鸭/,
  /记得喝水/,
  /照顾好自己/,
  /别熬夜/,
  /的小世界$/,
  /的日常$/,
  /的小宇宙/,
  /努力生活/,
  /好好生活/,
  /活着就好/,
]

export function pickWechatSignatureFallback(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return WECHAT_SIGNATURE_FALLBACK_POOL[h % WECHAT_SIGNATURE_FALLBACK_POOL.length]!
}

export function looksLikeTemplateWechatSignature(raw: string): boolean {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t || t === '—' || t === '-') return true
  return TEMPLATE_SIGNATURE_REGEXES.some((re) => re.test(t))
}

/** 喊话/挑衅/对特定人放狠话式签名（恋人甜蜜署名如「某某5201314」不在此列） */
export function looksLikeShoutoutWechatSignature(raw: string): boolean {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (SHOUTOUT_SIGNATURE_REGEXES.some((re) => re.test(t))) return true
  return false
}

export function coerceWechatSignature(
  raw: string,
  seed: string,
  maxChars = WECHAT_SIGNATURE_DISPLAY_MAX,
): string {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const clipped = t.length > maxChars ? t.slice(0, maxChars) : t
  if (!clipped || looksLikeTemplateWechatSignature(clipped)) {
    return pickWechatSignatureFallback(seed).slice(0, maxChars)
  }
  return clipped
}

export function buildWechatSignatureAiRulesBlock(options?: {
  topLevelField?: string
  comprehensivePath?: string
  maxChars?: number
}): string {
  const top = options?.topLevelField ?? 'wechatSignature'
  const nested = options?.comprehensivePath ?? 'comprehensive.base.wechatSignature'
  const max = options?.maxChars ?? WECHAT_SIGNATURE_GENERATE_MAX
  const examples = STYLE_EXAMPLES.map((s) => `「${s}」`).join('、')

  return `【微信个性签名 · ${top} / ${nested}】
- **是什么**：微信资料里那一行极短文案，像**个人名片/座右铭式装饰**——稳定、耐看、代表自我；**不是** bio/档案概括、**不是**对某人喊话、**不是**把私聊台词抄上来。
- **长度**：优先 4～15 字（含标点/空格）；最长不超过 ${max} 字；一句话，不换行，不加序号。
- **两处须完全一致**：顶层 ${top} 与 ${nested} 写**同一句**。
- **气质**：可含蓄、留白、意象、古诗一句、中英短碎片；像会长期挂在主页上的签名，**不是**每几天就换的碎碎念。
- **贴合人设**：须与年龄、性格一致；可含蓄折射身份，但**禁止**打工模板与对特定人放狠话。
- **禁止**：${ANTI_PATTERNS.join('；')}。
- **风格参考（只学气质，照搬任一句视为严重违规，必须原创）**：${examples}。`
}

/** 批量「贴人设」微信资料生成器用的 signature 字段说明（JSON 键名为 signature） */
export function buildWechatProfileSignatureRulesBlock(maxChars = WECHAT_SIGNATURE_DISPLAY_MAX): string {
  const core = buildWechatSignatureAiRulesBlock({ maxChars })
  return core
    .replace(
      /【微信个性签名 · wechatSignature \/ comprehensive\.base\.wechatSignature】/,
      '【微信 signature 字段】',
    )
    .replace(
      '- **两处须完全一致**：顶层 wechatSignature 与 comprehensive.base.wechatSignature 写**同一句**。',
      '- 输出到 JSON 的 **signature** 字段（单字符串，禁止候选/编号/多版本）。',
    )
}

/** 私聊中角色主动改签名时的短规则（appendix 用） */
export function buildWechatSignatureChatUpdateRulesBlock(
  maxChars = WECHAT_SIGNATURE_DISPLAY_MAX,
): string {
  return `■ 个性签名写法（≤${maxChars} 字 · **宜长期稳定**）
- **定位**：像**个人名片/座右铭装饰**，挂在朋友圈主页封面下；多数人**几个月甚至更久**才换一次，**默认保持现状**。
- **允许写什么**：含蓄自我态度、意象留白、古诗/歌词碎片、中英短句、极简生活信条。
- **恋人关系例外**：确认恋爱后**偶尔**可换成含对方昵称/署名的甜蜜短句（如「某某5201314」「❤️某某」），仍须克制、不油腻，**不要每轮都改**。
- **严禁喊话式**：对特定人放狠话、挑衅、剧情台词（如「某个小子，下次别被我逮到」「你小子给我等着」）；严禁 @某人、指名骂战、把吵架原话当签名。
- **严禁**打工人模板：下班了别找我、勿扰、搬砖、摸鱼、加班中、打工人、已读不回等。
- **严禁**鸡汤口号、对读者命令（别…/请…）、把职业/MBTI 标签写进签名。
- **何时才改**：用户明确要求；或关系里程碑（如表白成功→恋人署名）；或你确信原签名已严重不合人设。**无充分理由不要输出改签名指令**。`
}

