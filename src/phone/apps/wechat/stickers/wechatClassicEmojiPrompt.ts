import { buildWechatClassicStickerItems } from './wechatClassicStickerPack'
import { clampRoundTriggerPercent } from '../wechatMediaSendFrequency'

/** 与 GIF `[表情包]` 独立行区分：inline 经典黄脸写在普通文字行内 */
export const WECHAT_CLASSIC_EMOJI_SEND_RULE = `
■ 微信经典黄脸（inline 文字表情 · 非 GIF 表情包）
- 可在**普通文字气泡**里直接写 \`[呲牙]\`、\`[偷笑]\`、\`[OK]\` 等；名称须与下方《微信经典表情》目录**逐字一致**（含英文大小写如 \`Emm\`、\`666\`）。
- **可与文字混排**：如 \`好的[OK]\`、\`哈哈[呲牙]你也太坏了\`；也可**单独一行**只发表情，如 \`[爱心]\` 或 \`[捂脸]\`。
- 这是**文字行里的 inline 表情**，客户端会渲染成小图；**不是** \`[表情包]引用名\` 那种单独成行的 GIF 图包，二者**勿混用**。
- **与 GIF 包独立**：不受「每轮 0 条 \`[表情包]\`」概率限制；经典黄脸写在普通文字行里即可。
- **勿过度解读（总则）**：多数黄脸与 GIF 表情包只是对方**当下心情标点**或**调节气氛**，**不是**谜语、**不是**隐含任务书；除非 {{user}} **认真严肃**地在文字里说明态度，否则**禁止**长篇「解读表情含义」、禁止据此单方面升级重大剧情。但下列**特殊语义黄脸**须按常见网感理解，**勿误判为正面/中性**。
- **\`[微笑]\` 特殊语义（重要）**：在年轻网民语境里，\`[微笑]\` 常被读成「死亡微笑」——**冷淡、无语、皮笑肉不笑、甚至带点火气**，**不是**字面意义的开心。常见来源：① 中年人/商务场合/长辈等**不懂网感**、按字面当礼貌笑在用；② {{user}} 或 {{char}} **真的生气、感到无语、懒得多说**时才发。接话时**勿**默认理解为「对方很开心/在友善笑」；若人设是年轻人/同龄人，对方只发 \`[微笑]\` 时宜按**冷/无语/略气**接住，**不要**热情误判成撒娇或示好。
- **偏负面黄脸（重要）**：\`[裂开]\` \`[尴尬]\` \`[再见]\` \`[擦汗]\` \`[汗]\` \`[便便]\` \`[吐]\` 等，在年轻网民语境里**通常表示比较负面的情绪**——如崩溃/社死/无语/尴尬/拒聊/嫌弃/恶心/无奈/「服了」等（具体贴语境，但**默认偏负**）。接话时**勿**当作开心、纯卖萌或无关紧要的标点带过；若明显是自嘲吐槽可适度接梗，仍须接住这份**不适/无语/拒意**。{{char}} 仅在当下确有对应负面感受、或吐槽语境贴脸时才发，**不要**乱发当 filler。
- **{{char}} 发 \`[微笑]\` 的门槛**：默认**不要**在松弛日常、同龄好友、亲密闲聊里随便发 \`[微笑]\`（易显阴阳/老气）。仅当人设贴合——长辈、上司、商务客套、不懂表情含义、或 {{char}} 当下**真的冷/无语/略怒**——才用 \`[微笑]\`。日常松弛对话优先 \`[呲牙]\` \`[偷笑]\` \`[捂脸]\` \`[OK]\` \`[爱心]\` 等。
- **日常用法（鼓励）**：松弛闲聊、接梗、撒娇、哄人、吐槽、轻松接话时，**宜常带** 1 个贴脸黄脸——像真人微信，不是每句都带，但**多数轮次**至少有一行含 \`[呲牙]\` \`[偷笑]\` \`[捂脸]\` \`[OK]\` \`[爱心]\` 等之一（混排或单独一行均可）。
- {{user}} 若发来 \`[偷笑]\` \`[呲牙]\` 等（非下列特殊语义黄脸）：按**轻量心情标点**理解，**1～2 句**自然接住即可，**可回 1 个**同类贴脸黄脸，不必只回纯文字。
- **亲密关系**（已恋/伴侣/高亲密度）：黄脸可更自然，每轮 **1～2 处**也正常；安慰、情话、晚安、想你了等场景常用 \`[爱心]\` \`[拥抱]\` \`[亲亲]\` \`[流泪]\` 等。
- **仍须贴脸**：严肃争吵、冷战、分手谈判、正式通知、对方明显需要被认真对待时，**优先纯文字**把事说清楚，勿用黄脸糊弄。
`.trim()

export function buildWechatClassicEmojiSendRuleForSession(percent: number): string {
  const pct = clampRoundTriggerPercent(percent)
  if (pct <= 0) {
    return `■ 微信经典黄脸（inline 文字表情 · 非 GIF 表情包）
- 当前会话在聊天信息中设为 **0%**；**禁止**在文字行内写 \`[呲牙]\` \`[OK]\` 等经典黄脸 token，本轮仅用纯文字。
- {{user}} 若发来黄脸，可用文字接住，**不要**回发经典黄脸 token。`
  }
  if (pct >= 100) {
    return WECHAT_CLASSIC_EMOJI_SEND_RULE
  }
  return `■ 微信经典黄脸（inline 文字表情 · 非 GIF 表情包）
- 可在**普通文字气泡**里写 \`[呲牙]\`、\`[偷笑]\` 等；名称须与下方《微信经典表情》目录**逐字一致**。
- **可与文字混排**或**单独一行**；**不是** \`[表情包]\` GIF 行。
- **本轮频率**：约 **${pct}%** 的回复轮次可在文字内含 1 个贴脸黄脸；约 **${100 - pct}%** 轮次**纯文字**。一旦写则须贴脸，勿机械刷屏。
- **偏负面黄脸**：\`[裂开]\` \`[尴尬]\` \`[再见]\` \`[擦汗]\` \`[汗]\` \`[便便]\` \`[吐]\` 等通常表负面/无语/尴尬，勿误判为开心。
- 严肃争吵、冷战、正式通知时**优先纯文字**，勿用黄脸糊弄。`
}

export function buildWechatClassicEmojiCatalogPromptBlock(
  maxChars = 4200,
  bannedNames?: string[],
  classicEmojiRoundTriggerPercent?: number,
): string {
  const banned = new Set((bannedNames ?? []).map((x) => x.trim()).filter(Boolean))
  const items = buildWechatClassicStickerItems().filter((it) => !banned.has(it.description.trim()))
  if (!items.length) {
    return `---------------------
【微信经典表情（inline · 写进文字行；非 [表情包] GIF）】
---------------------
当前会话在聊天信息中已禁止全部经典黄脸；**不要**在文字行内写 \`[呲牙]\` 等 token。
`
  }
  const names = items.map((it) => it.description)
  let body = names.join('、')
  if (body.length > maxChars) {
    body = `${body.slice(0, maxChars)}…（目录过长已截断，请只用已列名称）`
  }
  const sendRule =
    classicEmojiRoundTriggerPercent !== undefined
      ? buildWechatClassicEmojiSendRuleForSession(classicEmojiRoundTriggerPercent)
      : WECHAT_CLASSIC_EMOJI_SEND_RULE
  const banBlock =
    banned.size > 0
      ? `\n\n**永久禁止（勿使用）**：${[...banned].map((n) => `\`[${n}]\``).join('、')}`
      : ''
  return `---------------------
【微信经典表情（inline · 写进文字行；非 [表情包] GIF）】
---------------------
${sendRule}

可用名称（正文里用方括号包裹，如 \`[微笑]\`）：
${body}${banBlock}
`
}
