import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import type { ApiConfig } from '../../api/types'
import type { BranchOption, CharacterInfo } from './types'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const STYLE_ORDER = ['顺水推舟', '趣味性', '转折性', '恶搞性'] as const

type RawBranch = { style?: string; card?: string; director?: string }

function stripJsonFence(s: string): string {
  let t = s.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '')
    t = t.replace(/\s*```$/i, '')
  }
  return t.trim()
}

/** 模型常输出尾随逗号、前后废话或截断；尽量解析出 JSON 数组 */
function parseBranchesJsonArray(raw: string): unknown {
  let t = stripJsonFence(String(raw || '')).trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }
  let parsed = tryParse(t)
  if (parsed != null) return parsed
  t = t.replace(/,\s*([\]}])/g, '$1')
  parsed = tryParse(t)
  if (parsed != null) return parsed
  const i = t.indexOf('[')
  const j = t.lastIndexOf(']')
  if (i >= 0 && j > i) {
    const slice = t.slice(i, j + 1)
    parsed = tryParse(slice) ?? tryParse(slice.replace(/,\s*([\]}])/g, '$1'))
    if (parsed != null) return parsed
  }
  throw new Error('分支 JSON 解析失败：模型未返回合法 JSON 数组（可检查 API 是否截断回复）')
}

function normalizeStyleLabel(s: string): string {
  const t = String(s || '').trim()
  if (!t) return ''
  for (const label of STYLE_ORDER) {
    if (t === label || t.includes(label)) return label
  }
  return t
}

/**
 * 在「剧情分支」开启时，由模型生成 4 条不同走向的分支卡片（卡片文案 + 续写执导）。
 * 非上帝视角：卡片为玩家第一人称；上帝视角：卡片为第三人称旁白一句。
 */
export async function generateDatingBranchesAi(params: {
  character: CharacterInfo
  latestAiPlotBody: string
  tailContext: string
  godPerspective: boolean
  apiConfig: ApiConfig | null
}): Promise<BranchOption[]> {
  const { character, latestAiPlotBody, tailContext, godPerspective, apiConfig } = params
  if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
    await new Promise((r) => window.setTimeout(r, 200))
    return []
  }

  const formatBlock = `【card 内标点与体裁·须与约会主文一致】（**禁止**把整段 card 写成无标记的「纯散文一口气」；该有引号/OS 就必须标出来）
- **对白**（任何人开口）：**仅**用英文半角双引号 "..." 包裹；可一句里多处对白，每处都须带引号。**禁止**用中文弯引号「」充当对白；**禁止**把台词混在旁白里不加引号。
- **内心 OS**（第一人称一闪念）：**仅**用一对英文半角双星号 **...** 包裹整段 OS；OS 须为第一人称「我…」。**禁止**用双星号包裹旁白或动作；无内心则可不写 OS。
- **旁白与动作**：不加引号、不加双星号；与对白/OS 之间用逗号或句号自然衔接。
- 单条 card 总长度控制在 **一到两句**（可含对白+动作+OS 混排，但仍要短），便于玩家点选后塞进输入框。`

  const cardRule = godPerspective
    ? `四条「card」均为**第三人称旁白**为主的一到两句短卡（用他/她/${character.realName} 等），符合上帝视角：写屏外可见动作或信息差；**禁止**写玩家第一人称；**禁止**用「你」使唤读者或指约会对象。
${formatBlock}
- 若写**焦点角色**（通常为 ${character.realName}）的内心一闪念，可用 **我…**；**禁止**写玩家内心。
- 格式示例：他把纸袋往桌角一推，没看我。"你定吧。"**我装得挺像没事，其实早后悔了。**`
    : `四条「card」均为**玩家视角**的一到两句短卡：以玩家将要做的事、说出口的话或心里一闪念为主；**禁止**用第三人称写玩家；**禁止**用「你」指玩家。
${formatBlock}
- 若玩家当场开口，对白**必须**落在英文双引号里；若写玩家心里一句，用 **我…**；若只有动作/决定，可全旁白，但不要通篇无标点地「小说腔糊成一团」。
- 格式示例：我忍不住伸手蹭了蹭他的发旋。"你今天……挺乖的。"**我好像比自己想的还要大胆。**`

  const system = `你是线下约会剧情「分支选项」策划。只输出 **JSON 数组**，不要 Markdown 代码围栏、不要前后解释文字。
数组长度必须为 4，且按顺序对应风格标签（style 字段必须与之一致）：
${STYLE_ORDER.map((s) => `「${s}」`).join('、')}
每项为对象：{"style":"…","card":"分支卡片（中文，一至两句；对白用英文双引号、内心OS用英文双星号，与主剧情格式一致）","director":"给续写模型的简短执导（中文）：说明选此分支后剧情如何承接；可提醒须保留玩家本句中的引号/OS 标记；勿复述 card 原句。"}`

  const user =
    `角色：${character.realName}\n标签：${character.identityTags.join('、') || '无'}\n人设摘要：${character.prompt.slice(0, 800)}\n\n` +
    `【最近剧情摘录】\n${tailContext.slice(0, 2200)}\n\n` +
    `【当前段剧情正文（分支锚点）】\n${latestAiPlotBody.slice(0, 4000)}\n\n` +
    `${cardRule}\n` +
    `「card」须像真人当场会做的事或一闪念：**禁止**反常识的生理-建筑级夸张（如心跳声大得要掀天花板、呼吸震碎玻璃、血液打雷等）；紧张或心动用具体小动作即可。\n` +
    `四条 card 中**至少两条**须明显出现「英文双引号对白」或「双星号内心OS」之一（或两者皆有），避免四条全是干巴巴无对白、无 OS 的纯叙述。\n` +
    `四条 director 应彼此区分：顺水推舟偏顺势温情；趣味性偏轻松梗与反差；转折性偏意外信息与关系张力；恶搞性偏夸张喜感但**不侮辱角色与玩家**、不低俗。`

  const raw = await openAiCompatibleChat(apiConfig as ApiConfig, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], { temperature: 0.82, max_tokens: 6000 })

  const parsed = parseBranchesJsonArray(raw)
  if (!Array.isArray(parsed)) throw new Error('分支须为 JSON 数组')

  const rows = parsed as RawBranch[]
  const byStyle = new Map<string, RawBranch>()
  for (const row of rows) {
    const st = normalizeStyleLabel(String(row?.style || ''))
    if (st) byStyle.set(st, row)
  }

  const out: BranchOption[] = []
  const fallbackDirector = '承接上文情绪与场景，顺势推进一轮互动，保持人设与标点格式。'
  const rowCount = Math.max(rows.length, 1)
  for (const label of STYLE_ORDER) {
    const row = (byStyle.get(label) ??
      rows[out.length] ??
      rows[out.length % rowCount] ??
      {}) as RawBranch
    const card = String(row?.card || '').trim()
    let director = String(row?.director || '').trim()
    if (!director) director = fallbackDirector
    if (!card) continue
    out.push({
      id: uid('br'),
      styleLabel: label,
      content: card,
      nextPrompt: `你是${character.realName}。玩家已选择分支「${label}」：${director}。须自然承接上文与玩家将发送的动作/态度/对白；若玩家句中含英文双引号对白或双星号内心OS，续写须保持同一标点体系、勿把对白/OS糊成无标记散文。保持人设与 system 全局规则。`,
    })
  }
  if (out.length < 4) throw new Error('模型返回的分支不足 4 条')
  return out.slice(0, 4)
}
