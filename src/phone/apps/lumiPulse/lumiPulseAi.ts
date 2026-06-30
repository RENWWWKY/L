import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import type { PulseComment, PulseDmThread, PulsePost, PulseTrendingTopic } from './pulseTypes'

function extractJsonArray(raw: string): unknown[] | null {
  const t = raw.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const body = fence ? fence[1]!.trim() : t
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function hasApi(cfg: ApiConfig | null | undefined): cfg is ApiConfig {
  return !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim())
}

export async function aiGeneratePulseFeedPosts(params: {
  apiConfig: ApiConfig | null
  viewerName: string
  count?: number
}): Promise<Array<{ authorName: string; content: string }>> {
  const count = Math.min(8, Math.max(3, params.count ?? 5))
  if (!hasApi(params.apiConfig)) {
    return Array.from({ length: count }, (_, i) => ({
      authorName: `网友_${i + 1}`,
      content: '今天风很大，适合把心事吹散一点。你最近好吗？',
    }))
  }

  const sys = `你是 Lumi Pulse 微博广场的 AI 编导。生成 ${count} 条中文网友动态，风格克制、有文学感，禁止 emoji 与微博橙红色调用语。
只输出 JSON 数组：[{"authorName":"网名","content":"正文"}]
正文 40～180 字，像真实社交媒体碎片。`
  const user = `当前浏览者：${params.viewerName}。请生成广场动态。`

  try {
    const raw = await openAiCompatibleChat(
      params.apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.92 },
    )
    const rows = extractJsonArray(raw) ?? []
    const out: Array<{ authorName: string; content: string }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24) || '匿名网友'
      const content = clip(r.content, 400)
      if (content) out.push({ authorName, content })
    }
    if (out.length) return out.slice(0, count)
  } catch {
    // fallback
  }
  return aiGeneratePulseFeedPosts({ apiConfig: null, viewerName: params.viewerName, count })
}

export async function aiGeneratePulseComments(params: {
  apiConfig: ApiConfig | null
  post: Pick<PulsePost, 'authorName' | 'content'>
  count?: number
}): Promise<Array<{ authorName: string; content: string; parentHint?: string }>> {
  const count = Math.min(12, Math.max(4, params.count ?? 6))
  if (!hasApi(params.apiConfig)) {
    return [
      { authorName: '路过的人', content: '懂你。' },
      { authorName: '深夜读者', content: '这条写得真好。', parentHint: '路过的人' },
    ]
  }

  const sys = `你是 Lumi Pulse 评论区 AI。针对一条微博生成 ${count} 条网友评论，可含 1～2 条楼中楼（用 parentHint 写被回复者昵称）。
只输出 JSON：[{"authorName":"昵称","content":"评论","parentHint":"可选"}]
禁止 emoji，语气真实多样。`
  const user = `博主：${params.post.authorName}\n正文：${params.post.content}`

  try {
    const raw = await openAiCompatibleChat(
      params.apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.9 },
    )
    const rows = extractJsonArray(raw) ?? []
    const out: Array<{ authorName: string; content: string; parentHint?: string }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24) || '路人'
      const content = clip(r.content, 280)
      if (!content) continue
      const parentHint = clip(r.parentHint, 24) || undefined
      out.push({ authorName, content, parentHint })
    }
    if (out.length) return out.slice(0, count)
  } catch {
    // fallback
  }
  return aiGeneratePulseComments({ apiConfig: null, post: params.post, count })
}

export async function aiGeneratePulseTrending(params: {
  apiConfig: ApiConfig | null
  povName: string
  povContext?: string
  count?: number
}): Promise<Array<Pick<PulseTrendingTopic, 'title' | 'tag' | 'excerpt'>>> {
  const count = Math.min(10, Math.max(5, params.count ?? 8))
  if (!hasApi(params.apiConfig)) {
    return [
      { title: '# 城市夜跑地图更新 #', tag: '新', excerpt: '本周新增三条滨江路线。' },
      { title: '# 双向暗恋的五个表现 #', tag: '爆', excerpt: '网友总结引发热议。' },
    ]
  }

  const sys = `你是舆论场编导。为中文微博热搜榜生成 ${count} 条词条，可结合角色剧情。
只输出 JSON：[{"title":"# 词条 #","tag":"爆|新|热","excerpt":"一句话导语"}]
禁止 emoji 与艳俗八卦腔，保持杂志感。`
  const user = `当前视角角色：${params.povName}
${params.povContext?.trim() ? `剧情背景：${params.povContext.trim().slice(0, 800)}` : ''}
请生成与 TA 生活可能相关的热搜。`

  try {
    const raw = await openAiCompatibleChat(
      params.apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.88 },
    )
    const rows = extractJsonArray(raw) ?? []
    const out: Array<Pick<PulseTrendingTopic, 'title' | 'tag' | 'excerpt'>> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const title = clip(r.title, 80)
      if (!title) continue
      const tagRaw = clip(r.tag, 4)
      const tag = tagRaw === '爆' || tagRaw === '新' || tagRaw === '热' ? tagRaw : undefined
      const excerpt = clip(r.excerpt, 160) || undefined
      out.push({ title, tag, excerpt })
    }
    if (out.length) return out.slice(0, count)
  } catch {
    // fallback
  }
  return aiGeneratePulseTrending({ apiConfig: null, povName: params.povName, count })
}

export async function aiGeneratePulseDmThreads(params: {
  apiConfig: ApiConfig | null
  povName: string
  threadCount?: number
}): Promise<Array<{ fanName: string; messages: string[] }>> {
  const n = Math.min(5, Math.max(2, params.threadCount ?? 3))
  if (!hasApi(params.apiConfig)) {
    return [
      { fanName: '深夜追星号', messages: ['哥哥你看我！！', '理理我嘛'] },
      { fanName: '匿名质问', messages: ['你刚才那条微博什么意思？', '别装死。'] },
    ]
  }

  const sys = `你是追星/网友私信生成器。为名人 ${params.povName} 生成 ${n} 个私信对话，每对话 3～5 条粉丝或匿名网友消息（狂热、质问、表白、黑粉均可）。
只输出 JSON：[{"fanName":"网名","messages":["..."]}]
禁止 emoji。`

  try {
    const raw = await openAiCompatibleChat(
      params.apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: `目标：${params.povName}` },
      ],
      { temperature: 0.93 },
    )
    const rows = extractJsonArray(raw) ?? []
    const out: Array<{ fanName: string; messages: string[] }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const fanName = clip(r.fanName, 24) || '神秘网友'
      const msgs = Array.isArray(r.messages)
        ? r.messages.map((m) => clip(m, 320)).filter(Boolean)
        : []
      if (msgs.length) out.push({ fanName, messages: msgs.slice(0, 6) })
    }
    if (out.length) return out.slice(0, n)
  } catch {
    // fallback
  }
  return aiGeneratePulseDmThreads({ apiConfig: null, povName: params.povName, threadCount: n })
}

export function nestPulseComments(
  flat: PulseComment[],
): Array<PulseComment & { replies: PulseComment[] }> {
  const roots = flat.filter((c) => !c.parentId)
  const byParent = new Map<string, PulseComment[]>()
  for (const c of flat) {
    if (!c.parentId) continue
    const list = byParent.get(c.parentId) ?? []
    list.push(c)
    byParent.set(c.parentId, list)
  }
  return roots.map((r) => ({
    ...r,
    replies: (byParent.get(r.id) ?? []).sort((a, b) => a.createdAt - b.createdAt),
  }))
}

export function flatToDmThreads(
  rows: Array<{ fanName: string; messages: string[] }>,
): PulseDmThread[] {
  return rows.map((row, threadIndex) => {
    const now = Date.now()
    const messages = row.messages.map((content, i) => ({
      id: `pdm-${now}-${threadIndex}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      fromFan: true,
      content,
      createdAt: now - (row.messages.length - i) * 45_000,
    }))
    const last = messages[messages.length - 1]
    return {
      id: `pth-${now}-${threadIndex}`,
      fanName: row.fanName,
      messages,
      lastMessage: last?.content ?? '',
      lastAt: last?.createdAt ?? now,
      unread: messages.length,
    }
  })
}
