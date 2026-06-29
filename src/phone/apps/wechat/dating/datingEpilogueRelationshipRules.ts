import type { PlotItem } from './types'
import type { Character } from '../newFriendsPersona/types'
import {
  getWorldBookAfterItemContent,
  listChatAfterWorldBookItems,
  type WorldBookAfterPatch,
} from '../newFriendsPersona/worldBookAfterPatch'

const COLD_RELATIONSHIP_MARKERS: RegExp[] = [
  /冷漠/,
  /疏离/,
  /冷淡/,
  /公事/,
  /上下级/,
  /专业距离/,
  /观察(者|视角)/,
  /试探/,
  /保持距离/,
  /公事公办/,
  /只(看|关注)结果/,
  /分量极轻|分量.*(很)?轻/,
  /普通(的)?新人/,
  /尚未.*(爱上|动心|在意)/,
  /职场汇报/,
  /训(诫|话|斥)/,
]

const ROMANTIC_ESCALATION_MARKERS: RegExp[] = [
  /暧昧/,
  /想念/,
  /思念/,
  /心动/,
  /惦念/,
  /挂念/,
  /边界.*模糊/,
  /占有(欲|感)/,
  /主动.*(非工作|找话题|发消息)/,
  /非工作.*(话题|联系|沟通)/,
  /分量.*(上升|加重)/,
  /私密空间/,
  /越界/,
  /关系.*(升温|拉近|突破)/,
  /因.*未收到.*消息/,
  /等.*消息/,
  /频繁.*手机/,
  /软化/,
  /亲近/,
  /恋人/,
  /喜欢(上|了)/,
]

const USER_CLOSENESS_MARKERS: RegExp[] = [
  /吻/,
  /抱/,
  /暧昧/,
  /喜欢/,
  /心动/,
  /撩/,
  /靠近/,
  /牵手/,
  /表白/,
  /想你/,
  /想念/,
  /约会/,
  /吃醋/,
]

export function countAiPlotsInDatingHistory(history: ReadonlyArray<Pick<PlotItem, 'type'>>): number {
  return history.filter((p) => p.type === 'ai').length
}

export function isEarlyDatingPlotRound(history: ReadonlyArray<Pick<PlotItem, 'type'>>): boolean {
  return countAiPlotsInDatingHistory(history) <= 1
}

function textLooksColdRelationship(text: string): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return COLD_RELATIONSHIP_MARKERS.some((re) => re.test(t))
}

function textLooksRomanticEscalation(text: string): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return ROMANTIC_ESCALATION_MARKERS.some((re) => re.test(t))
}

function userOrPlotInitiatedCloseness(userText?: string, plotBody?: string): boolean {
  const combined = `${String(userText ?? '')}\n${String(plotBody ?? '')}`.trim()
  if (!combined) return false
  return USER_CLOSENESS_MARKERS.some((re) => re.test(combined))
}

/** 线下剧情：尾声延展 + 线上聊天 = 当前关系基准（硬约束，高于「写好看」） */
export function buildDatingEpilogueRelationshipBaselineBlock(
  character: Character | null | undefined,
  opts: {
    historyPlotCount: number
    hasOnlineWechatFacts: boolean
    userText?: string
  },
): string {
  const rows = character ? listChatAfterWorldBookItems(character) : []
  const early = opts.historyPlotCount <= 1
  const epilogueLines = rows.length
    ? rows.map((r) => `- 「${r.itemName}」：${r.content.slice(0, 420)}`).join('\n')
    : '（无尾声延展条目；仍以约会对象世界书与线上聊天事实为准）'

  const earlyRoundRule = early
    ? `【首轮 / 早期线下·关系跨级禁令（最高优先级）】
- 这是**第 ${opts.historyPlotCount + 1} 段** AI 线下剧情：用户**未必**主动拉近关系；**禁止**因换到线下场景就把关系写成暧昧、心动、私人越界、想念、主动非工作搭讪、边界模糊。
- **禁止**「线上冷淡公事、线下忽然暧昧」；**禁止**角色单方面脑补用户、擅自软化称呼或肢体距离。
- 若用户本轮无输入或仅为工作/日常推进，关系温度须**维持**尾声延展与线上一致，最多允许**极轻微**、有明确事件支撑的波动（如多一句公事提醒），**不得**跨级。\n`
    : `【关系推进节奏】关系升温须由**玩家当轮言行**或**线上已聊定事实**支撑；禁止无动因跨级。\n`

  const onlineRule = opts.hasOnlineWechatFacts
    ? `- 上方「尚未总结·私聊」为**同一角色**的微信原文：其**态度、称呼、距离感**是线下当轮关系温度的**硬上限参考**（冷淡训话式线上 → 线下不得改写成暧昧互动，除非用户当轮明确打破）。\n`
    : ''

  return `【关系基准铁律 · 尾声延展 = 当前关系态（高于自行发挥）】
下列 priority=after「尾声延展」条目描述的是**此刻** ${character?.name?.trim() || '约会对象'} 对 {{user}} 的**当前**态度、称呼、边界与内心分量——与线上聊天一致，**不是**「将来可能怎样」的许愿条。
- 本轮正文须**先落在此基准之内**再推进；**禁止**为写戏剧冲突擅自把「冷漠/上下级/公事公办/观察视角」写成「暧昧/想念/私人越界/心动」。
- 若条目写专业距离、冷淡、分量轻、只谈工作：**本段对白与距离感须同温**；不得出现主动非工作话题、等消息、私家车暧昧、边界突破等，除非用户当轮输入或线上事实已明确支撑。
${onlineRule}${earlyRoundRule}【当前尾声延展快照（须遵守）】
${epilogueLines}
`.trim()
}

/** 线下专用：比私聊更严的尾声补丁输出规则 */
export function buildDatingWorldBookAfterPatchOutputAppendix(opts?: { isEarlyRound?: boolean }): string {
  const early = opts?.isEarlyRound
    ? `- **首轮/早期线下**：若尾声仍写冷淡/上下级/公事距离，**禁止**在本轮 patches 里改写成暧昧、想念、心动、边界模糊、非工作主动——除非正文里**已发生**且**由玩家主动**的明确拉近（非角色单方面脑补）。无则 **patches=[]**。\n`
    : ''
  return `
---------------------
【同一回复内追加：尾声延展·世界书覆盖 JSON（仅在有变更时输出）】
在你写完**全部**剧情正文之后：若且仅当**正文里已发生、且可持续**的关系/态度变化，与某一「尾声延展」条目**不一致**，才输出分隔行：
---WB_AFTER_PATCH---
分隔行下一行起输出**恰好一个** JSON 对象（可用 \`\`\`json 围栏），结构：{ "patches": [{ "worldBookId", "itemId", "newContent" }] }

【线下剧情 · 补丁铁律（严于私聊）】
- **禁止**「正文 OOC 升温 → 用 patches 把尾声改成暧昧来圆」；补丁须**忠实反映正文已写事实**，不是替 OOC 洗白。
- **禁止**无玩家主动、无线上事实支撑，就把「冷漠/公事/上下级」条目改成「想念/暧昧/边界模糊/分量上升」。
- 单轮最多**小幅**更新（称呼略松、多一条公事外的观察等）；**禁止**一轮内从冷淡跳到暧昧/恋人向。
${early}- 无实质、可持续、与条目矛盾的变化 → **不要**输出 ---WB_AFTER_PATCH---。
- 仅可改 priority=after 且已列出的 worldBookId/itemId；禁止编造 id。
---------------------
`.trim()
}

/** 客户端兜底：拦下模型擅自把冷淡尾声改成暧昧 */
export function filterDatingWorldBookAfterPatches(
  patches: WorldBookAfterPatch[],
  character: Character,
  opts: {
    historyPlotCount: number
    plotBody: string
    userText?: string
  },
): WorldBookAfterPatch[] {
  if (!patches.length) return []
  const early = opts.historyPlotCount <= 1
  const userCloseness = userOrPlotInitiatedCloseness(opts.userText, opts.plotBody)

  return patches.filter((p) => {
    const before = getWorldBookAfterItemContent(character, p.worldBookId, p.itemId)
    if (before === null) return false
    const after = String(p.newContent ?? '').trim()
    if (!after || before.trim() === after) return false

    const wasCold = textLooksColdRelationship(before)
    const nowRomantic = textLooksRomanticEscalation(after)
    if (wasCold && nowRomantic && !userCloseness) return false
    if (early && wasCold && nowRomantic) return false
    return true
  })
}

/** 每轮尾声判断 API 用的线下补充规则 */
export function buildDatingEpiloguePerRoundSyncExtraRules(opts?: {
  isEarlyRound?: boolean
  hasOnlineWechatFacts?: boolean
}): string {
  const parts = [
    '【线下剧情 · 尾声判断补充（最高优先级）】',
    '- 补丁须与**本轮正文已写事实**一致；禁止根据「可能发展」臆造暧昧。',
    '- 若快照条目为冷淡/上下级/公事距离，而本轮正文**并未**出现玩家主动拉近或明确双向暧昧，**必须 patches=[]**。',
    '- 禁止把线上仍冷淡、本轮也无升温的正文，解读成「可持续暧昧化」而去改条目。',
  ]
  if (opts?.isEarlyRound) {
    parts.push('- **首轮/早期线下**：尤其禁止把冷淡条目改成想念/心动/边界模糊/非工作主动。')
  }
  if (opts?.hasOnlineWechatFacts) {
    parts.push('- 须与「尚未总结·私聊」中的态度/距离一致；线上公事冷淡则尾声不得改写成暧昧。')
  }
  return parts.join('\n')
}
