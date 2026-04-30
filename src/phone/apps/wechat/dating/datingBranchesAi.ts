import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import type { ApiConfig } from '../../api/types'
import { DATING_AI_MAX_OUTPUT_TOKENS, type BranchOption, type CharacterInfo } from './types'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const STYLE_ORDER = ['顺水推舟', '趣味性', '转折性', '恶搞性'] as const

type RawBranch = { style?: string; card?: string; director?: string }

function stripJsonFence(s: string): string {
  let t = String(s || '').trim().replace(/^\uFEFF/, '')
  while (t.includes('```')) {
    const start = t.indexOf('```')
    const afterLang = t.indexOf('\n', start)
    const close = t.indexOf('```', afterLang >= 0 ? afterLang + 1 : start + 3)
    if (afterLang < 0 || close < 0) {
      t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      break
    }
    t = t.slice(afterLang + 1, close).trim()
  }
  return t.trim()
}

/** 截断回复：补上未闭合的双引号字符串，并在缺尾 `]` 时轻度收口（尽力而为） */
function tryRepairTruncatedJsonArray(slice: string): string {
  let s = slice.trim()
  if (!s.startsWith('[')) return slice
  let inStr = false
  let esc = false
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (esc) {
      esc = false
      continue
    }
    if (c === '\\' && inStr) {
      esc = true
      continue
    }
    if (c === '"') inStr = !inStr
  }
  if (inStr) s += '"'
  s = s.replace(/,\s*$/u, '')
  const u = s.trimEnd()
  if (!u.endsWith(']') && u.endsWith('}')) s += ']'
  return s
}

/** 模型常输出尾随逗号、前后废话、Markdown 围栏或未转义引号导致截断；尽量解析出 JSON 数组 */
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
    let slice = t.slice(i, j + 1)
    parsed = tryParse(slice) ?? tryParse(slice.replace(/,\s*([\]}])/g, '$1'))
    if (parsed != null) return parsed
    const repaired = tryRepairTruncatedJsonArray(t.slice(i))
    parsed = tryParse(repaired) ?? tryParse(repaired.replace(/,\s*([\]}])/g, '$1'))
    if (parsed != null) return parsed
  }
  if (i >= 0 && j <= i) {
    const repaired = tryRepairTruncatedJsonArray(t.slice(i))
    parsed = tryParse(repaired) ?? tryParse(repaired.replace(/,\s*([\]}])/g, '$1'))
    if (parsed != null) return parsed
  }
  throw new Error('分支 JSON 解析失败：模型未返回合法 JSON 数组（对白请勿在 JSON 内使用英文双引号，请用「」；或接口截断了回复）')
}

function normalizeStyleLabel(s: string): string {
  const t = String(s || '').trim()
  if (!t) return ''
  for (const label of STYLE_ORDER) {
    if (t === label || t.includes(label)) return label
  }
  return t
}

/** 模型崩 JSON 时的占位卡片（对白只用「」，便于主线再接英文引号） */
const BRANCH_FALLBACK_BY_STYLE: Record<(typeof STYLE_ORDER)[number], { card: string; director: string }> = {
  顺水推舟: {
    card: `顺着刚才的气氛，我往他身边挨近一点。「那就……听你的。」**心里其实还有点没底。**`,
    director: '温情承接上一轮情绪，小动作推进距离感，不要陡转冲突。',
  },
  趣味性: {
    card: `我故意拖长尾音看他表情。「你刚才那样——算不算犯规啊？」**有点想逗他又不敢太过。**`,
    director: '轻松反差或小调侃，缓解张力，保留口语短句。',
  },
  转折性: {
    card: `门外忽然传来脚步声，我俩同时一顿。**这时候来人可不妙。**`,
    director: '插入意外信息或第三者动静，抬高悬念但勿狗血夸张。',
  },
  恶搞性: {
    card: `我一把拎起他袖口晃了晃。「行啊，今天还挺会演。」**绷不住想笑。**`,
    director: '夸张喜感但不侮辱人格，可自嘲或假装正经翻车。',
  },
}

function buildFallbackBranchOptions(character: CharacterInfo): BranchOption[] {
  const name = character.realName
  return STYLE_ORDER.map((label) => {
    const fb = BRANCH_FALLBACK_BY_STYLE[label]
    return {
      id: uid('br-fb'),
      styleLabel: label,
      content: fb.card,
      nextPrompt: `你是${name}。玩家已选择分支「${label}」：${fb.director}须自然承接上文与玩家将发送的动作/态度/对白；保持人设与标点格式。`,
    }
  })
}

function materializeBranchRows(character: CharacterInfo, rows: RawBranch[]): BranchOption[] {
  const byStyle = new Map<string, RawBranch>()
  for (const row of rows) {
    const st = normalizeStyleLabel(String(row?.style || ''))
    if (st) byStyle.set(st, row)
  }
  const fallbackDirector = '承接上文情绪与场景，顺势推进一轮互动，保持人设与标点格式。'
  const rowCount = Math.max(rows.length, 1)
  const out: BranchOption[] = []
  let seq = 0
  for (const label of STYLE_ORDER) {
    const row = (byStyle.get(label) ?? rows[seq % rowCount] ?? {}) as RawBranch
    seq += 1
    let card = String(row?.card || '').trim()
    let director = String(row?.director || '').trim()
    if (!director) director = fallbackDirector
    if (!card) {
      const fb = BRANCH_FALLBACK_BY_STYLE[label]
      card = fb.card
      director = fb.director
    }
    out.push({
      id: uid('br'),
      styleLabel: label,
      content: card,
      nextPrompt: `你是${character.realName}。玩家已选择分支「${label}」：${director}。须自然承接上文与玩家将发送的动作/态度/对白；玩家输入中的对白可与主线一致使用英文双引号或「」；内心 OS 保持 **…** 标记。保持人设与 system 全局规则。`,
    })
  }
  return out.slice(0, 4)
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

  const formatBlock = `【card 内标点（写入 JSON 的字符串时的硬性规则）】
- **整条模型回复只能是合法 JSON 数组**，因此 card、director 两个字段的字符串值里：**禁止**出现未转义的英文半角双引号 \`"\`。**对白一律用中文直角引号「…」**（不要用英文 "..." 写在 JSON 值里，否则会截断解析）。
- **内心 OS**：仍用一对英文半角双星号 **...** 包裹**整句可读**心思；**禁止**星号内只有「我……」占位；无内心可不写。**禁止**用双星号包裹大段旁白。
- **旁白与动作**：不加「」、不加 **；与对白/OS 用逗号或句号衔接。
- 单条 card **一到两句**，便于点选后塞进输入框。`

  const cardRule = godPerspective
    ? `四条「card」均为**第三人称旁白**为主的一到两句短卡（用他/她/${character.realName} 等），符合上帝视角：写屏外可见动作或信息差；**禁止**写玩家第一人称；**禁止**用「你」使唤读者或指约会对象。
${formatBlock}
- 若写**焦点角色**（通常为 ${character.realName}）的内心一闪念，用 **完整一句**（我=该角色）；**禁止**写玩家内心。
- 格式示例（注意对白用「」，便于 JSON）：他把纸袋往桌角一推，没看我。「你定吧。」**我装得挺像没事，其实早后悔了。**`
    : `四条「card」均为**玩家视角**的一到两句短卡：以玩家将要做的事、说出口的话或心里一闪念为主；**禁止**用第三人称写玩家；**禁止**用「你」指玩家。
${formatBlock}
- 若玩家当场开口，对白用「…」括起来；若写玩家心里一句，用 **完整一句**；若只有动作/决定，可全旁白。
- 格式示例：我忍不住伸手蹭了蹭他的发旋。「你今天……挺乖的。」**我好像比自己想的还要大胆。**`

  const system = `你是线下约会剧情「分支选项」策划。**只输出合法 UTF-8 JSON 数组**，禁止 Markdown 代码围栏、禁止数组前后的解释文字、禁止注释。
【JSON 语法铁律】style/card/director 为 JSON 字符串时：内部若需要引号，对白只用「」，不要用英文 "；反斜杠按需转义；不要尾随逗号。
数组长度必须为 4，且按顺序对应风格标签（style 字段必须与之一致）：
${STYLE_ORDER.map((s) => `「${s}」`).join('、')}
每项形如：{"style":"顺水推舟","card":"……","director":"……"}；card 内对白用「」、内心 OS 用 **…**。`

  const user =
    `角色：${character.realName}\n标签：${character.identityTags.join('、') || '无'}\n人设摘要：${character.prompt.slice(0, 800)}\n\n` +
    `【最近剧情摘录】\n${tailContext.slice(0, 2200)}\n\n` +
    `【当前段剧情正文（分支锚点）】\n${latestAiPlotBody.slice(0, 3200)}\n\n` +
    `${cardRule}\n` +
    `「card」须像真人当场会做的事或一闪念：**禁止**反常识的生理-建筑级夸张（如心跳声大得要掀天花板、呼吸震碎玻璃、血液打雷等）；紧张或心动用具体小动作即可。\n` +
    `四条 card 中**至少两条**须明显出现「」对白或「双星号内心OS」之一（或两者皆有），避免四条全是干巴巴无对白、无 OS 的纯叙述。\n` +
    `四条 director 应彼此区分：顺水推舟偏顺势温情；趣味性偏轻松梗与反差；转折性偏意外信息与关系张力；恶搞性偏夸张喜感但**不侮辱角色与玩家**、不低俗。\n` +
    `【最后重申】你的整条回复必须以字符 [ 开头、以字符 ] 结尾；中间不要输出思考过程。`

  const messagesBase = { role: 'system' as const, content: system }
  let parsed: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPayload =
      attempt === 0
        ? user
        : `${user}\n\n【纠错重试】上次输出无法解析为 JSON。请严格输出仅包含一个数组：对白只用「」，不要用英文双引号写在字符串里；确保数组闭合。`
    const raw = await openAiCompatibleChat(
      apiConfig as ApiConfig,
      [messagesBase, { role: 'user', content: userPayload }],
      { temperature: attempt === 0 ? 0.52 : 0.35, max_tokens: DATING_AI_MAX_OUTPUT_TOKENS },
    )
    try {
      parsed = parseBranchesJsonArray(raw)
      break
    } catch {
      if (attempt === 1) {
        console.warn('[dating-branches] JSON 解析失败（已两次），使用内置占位分支。原始片段：', raw.trim().slice(0, 400))
        return buildFallbackBranchOptions(character)
      }
    }
  }

  if (!Array.isArray(parsed)) return buildFallbackBranchOptions(character)
  return materializeBranchRows(character, parsed as RawBranch[])
}
