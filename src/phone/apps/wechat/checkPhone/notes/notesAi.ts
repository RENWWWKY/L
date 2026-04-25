import type { ApiConfig } from '../../../api/types'
import { openAiCompatibleChat, type OpenAiCompatibleMessage } from '../../newFriendsPersona/ai'
import { personaDb } from '../../newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../../newFriendsPersona/types'
import { loadOfflineDatingPlotsPromptBlock } from '../../dating/loadOfflineDatingPlotsForWechatPrompt'
import { formatWorldBackgroundForPrompt } from '../../newFriendsPersona/worldBackgroundFormat'
import { buildSystemContent } from '../../wechatChatAi'
import type { PrivateMemo } from './memoTypes'

const NOTES_SYNC_SYSTEM_APPENDIX = `
---
【任务：同步角色手机里的私密备忘录】
你现在要扮演该角色本人，基于“现有备忘录”做增删改同步，必须贴合：
- 角色档案/世界书
- 长期记忆
- 线上对话与线下剧情上下文

输出要求：
1) 仅输出 JSON 对象，不要 Markdown，不要解释。
2) 输出格式必须为：
{
  "add": [Memo, ...],
  "update": [Memo, ...],
  "deleteIds": ["id1","id2"]
}
3) Memo 结构必须符合：
{
  "id": "m_xxx",
  "title": "标题",
  "date": "YYYY-MM-DD hh:mm A",
  "paperStyle": "solid|lined|grid",
  "paperColor": "#FAFAFA",
  "blocks": [
    { "type":"h1","content":"..." },
    { "type":"text","content":"..." },
    { "type":"text","modifiers":["bold|italic|underline|strikethrough|highlight-yellow|highlight-blue|highlight-pink"],"color":"#D946EF","content":"..." },
    { "type":"voice","duration":"00:12","transcript":"..." },
    { "type":"file","fileType":"pdf|doc|docx|txt|other","fileName":"...","size":"2.4 MB" },
    { "type":"image","url":"https://images.unsplash.com/...","caption":"..." }
  ]
}
4) 每条 Memo 至少包含 4 个 blocks，且至少有 1 条 text。
5) 内容偏向必须明显体现，语气要像角色私密记录，不要写成客服说明。
6) 不要编造与既有记忆明显冲突的人设行为。
7) add + update 的总数尽量接近用户要求条数；允许少量 deleteIds（0~2）制造“活体变化”。
8) 对于“谁给谁发红包/转账/礼物”等方向性事件，必须严格以角色视角复述：
   - 角色是第一人称“我”，玩家是“你”。
   - 不允许把“角色给玩家”写反成“玩家给角色”。
   - 若来源信息存在“给你买热可可”“我给你发了红包”等表述，备忘录必须保持同一方向。
9) 富文本请适度使用彩色正文：至少 1 段 text 带 color 字段（示例：#D946EF、#2563EB、#DC2626、#0F766E），不要全是纯黑文字。
10) 设备归属与偷窥视角硬约束（高优先）：
   - 当前内容是“用户正在查看角色手机里的私密备忘录”，不是角色在查看用户手机。
   - 允许写角色的主观情绪、占有欲、吃醋、查岗冲动等，但不得把行为写成“我去翻你的手机/我在查你的通讯录/我查看了你的微信记录”这类直接窥探用户设备的叙述，除非上游记忆中已明确发生且必须复盘。
   - 优先写角色自己的经历、观察、聊天后心境、对关系的判断与计划，不要把“查手机”行为本身写成主线。
11) 对话方向硬约束（高优先）：
   - 你会收到“最近聊天方向锚点”，其中每条都标明发送者：
     - [角色→用户] 表示“角色发给用户”
     - [用户→角色] 表示“用户发给角色”
   - 备忘录里涉及“谁叫谁某个称呼/谁在哄谁/谁先道歉”等事件时，必须严格按发送者方向复述，禁止反写。
   - 例如：若锚点显示 [角色→用户] 卫三岁，那么只能理解为“角色叫用户卫三岁”，不能写成“用户叫角色卫三岁”。
12) 动作施动方/承受方不可反转（最高优先）：
   - 备忘录是“角色自己的私密记录”，固定代入：角色=“我”；用户=“你”（或第三人称“他/她”，但不能把“我”和“你/他/她”对调）。
   - 对下列高风险动作必须做方向校验，严禁写反：安慰、道歉、称呼、邀约、送礼、发红包/转账、捏肩/抱抱等肢体关怀动作。
   - 若锚点是 [角色→用户] “要不要我给你捏肩”，只能写成“我说要给你捏肩/我想给你捏肩”，禁止写成“你让我给你捏肩”或“我被你要求捏肩”。
   - 若信息不足以确定施动方，不要擅自补因果；应写成中性表述（例如“我们聊到捏肩这件事”），避免方向性编造。
`.trim()

function stripFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function normalizeMemo(raw: any, idx: number): PrivateMemo {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fallbackDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())} ${now.getHours() >= 12 ? 'PM' : 'AM'}`
  const paperStyle = raw?.paperStyle === 'lined' || raw?.paperStyle === 'grid' ? raw.paperStyle : 'solid'
  const paperColor = typeof raw?.paperColor === 'string' && raw.paperColor.trim() ? raw.paperColor.trim() : '#FAFAFA'
  const blocks = withFallbackTextColor(Array.isArray(raw?.blocks) ? raw.blocks : [], idx)
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : `m_${Date.now()}_${idx}`,
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim() : `未命名备忘录 ${idx + 1}`,
    date: typeof raw?.date === 'string' && raw.date.trim() ? raw.date.trim() : fallbackDate,
    paperStyle,
    paperColor,
    blocks,
  }
}

function sanitizeColor(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const c = v.trim()
  if (!c) return undefined
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(c)) return c
  if (/^rgb(a)?\(\s*[\d.\s,%]+\)$/.test(c)) return c
  if (/^[a-zA-Z]+$/.test(c)) return c
  return undefined
}

function withFallbackTextColor(blocks: any[], seed: number): any[] {
  const palette = ['#D946EF', '#2563EB', '#DC2626', '#0F766E']
  const cloned = blocks.map((b) => (b && typeof b === 'object' ? { ...b } : b))
  const textIndexes: number[] = []
  let hasColoredText = false

  for (let i = 0; i < cloned.length; i += 1) {
    const block = cloned[i]
    if (!block || typeof block !== 'object' || block.type !== 'text') continue
    textIndexes.push(i)
    const color = sanitizeColor(block.color)
    if (color) {
      block.color = color
      hasColoredText = true
    } else {
      delete block.color
    }
  }

  if (!hasColoredText && textIndexes.length > 0) {
    const pickTextIdx = textIndexes[Math.abs(seed) % textIndexes.length]
    const pickColor = palette[Math.abs(seed) % palette.length]
    const target = cloned[pickTextIdx]
    if (target && typeof target === 'object') target.color = pickColor
  }
  return cloned
}

export type NotesSyncResult = {
  add: PrivateMemo[]
  update: PrivateMemo[]
  deleteIds: string[]
}

export async function syncPrivateMemosWithAi(params: {
  apiConfig: ApiConfig | null
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  count: number
  bias: string
  currentNotes: PrivateMemo[]
}): Promise<NotesSyncResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const cid = params.characterId.trim()
  const piid = params.playerIdentityId.trim()
  const character = cid ? ((await personaDb.getCharacter(cid)) as Character | null) : null
  const playerIdentity =
    piid && piid !== '__none__' ? ((await personaDb.getPlayerIdentity(piid)) as PlayerIdentity | null) : null
  const memoryNotes = (await personaDb.formatCharacterMemoriesForPrompt(cid)).trim() || undefined

  let worldBackgroundPrompt: string | undefined
  if (character?.worldBackgroundId?.trim()) {
    const bg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
    const block = formatWorldBackgroundForPrompt(bg)
    if (block.trim()) worldBackgroundPrompt = block
  }

  const promptMode = params.useLumiProjectAssistantPrompt ? 'lumi-assistant' : 'persona'
  const offlineDatingPlotsContext =
    promptMode === 'persona' && cid ? await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null) : ''

  const baseSystem = buildSystemContent({
    character,
    playerIdentity,
    playerDisplayName: params.playerDisplayName.trim() || '朋友',
    promptMode,
    longTermMemoryNotes: memoryNotes,
    worldBackgroundPrompt,
    offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
  })

  const recentChatRows = cid ? await personaDb.listWeChatChatMessagesRecentByCharacter({ characterId: cid, limit: 60 }) : []
  const recentChatDirectionAnchors = recentChatRows
    .slice(-40)
    .map((m) => {
      const text = String(m.content || '').replace(/\s+/g, ' ').trim()
      if (!text) return null
      const dir = m.type === 'character' ? '[角色→用户]' : '[用户→角色]'
      return `${dir} ${text}`
    })
    .filter((x): x is string => !!x)
    .join('\n')

  const count = Math.min(10, Math.max(1, Math.round(params.count)))
  const currentJson = JSON.stringify(params.currentNotes, null, 2)
  const userTask = `请同步备忘录。期望变化条数：${count}。内容偏向：${params.bias.trim() || '情绪、关系与日常观察'}。

【现有备忘录（可作为 update/delete 依据）】
${currentJson}

【最近聊天方向锚点（严格按箭头方向理解称呼归属）】
${recentChatDirectionAnchors || '（暂无）'}`

  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: `${baseSystem}\n\n${NOTES_SYNC_SYSTEM_APPENDIX}` },
    { role: 'user', content: userTask },
  ]
  const raw = await openAiCompatibleChat(cfg, messages, { temperature: 0.82, max_tokens: 3200 })
  const parsed = JSON.parse(stripFence(raw))
  if (!parsed || typeof parsed !== 'object') throw new Error('AI 返回格式异常')
  const add = Array.isArray((parsed as any).add) ? (parsed as any).add.slice(0, count).map((it: any, idx: number) => normalizeMemo(it, idx)) : []
  const update = Array.isArray((parsed as any).update)
    ? (parsed as any).update.slice(0, Math.max(1, count)).map((it: any, idx: number) => normalizeMemo(it, idx + 20))
    : []
  const deleteIds = Array.isArray((parsed as any).deleteIds)
    ? (parsed as any).deleteIds
        .map((x: unknown) => String(x ?? '').trim())
        .filter(Boolean)
        .slice(0, 2)
    : []
  return { add, update, deleteIds }
}

