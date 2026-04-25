import type { MockContact, Question, QnAAnswer } from './types'

const API_STORAGE_KEY = 'ai-api-presets-v1'

export type GeneratorStyle = '情感八卦' | '灵魂拷问' | '奇葩吐槽' | '深度探讨'

export type BatchGenerateParams = {
  style: GeneratorStyle
  count: number
  includeContacts: boolean
  contacts: MockContact[]
}

type ApiConfig = {
  apiUrl: string
  apiKey: string
  modelId: string
}

type GeneratedRow = {
  id: string
  type: 'public' | 'directed'
  isContact: boolean
  authorMask: string
  content: string
  likes: number
  initialComments?: Array<{ author: string; content: string }>
}

type DynamicReplyRow = {
  authorMask: string
  content: string
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? ''
    if (fenced) {
      try {
        return JSON.parse(fenced) as T
      } catch {
        return null
      }
    }
    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (!arrayMatch) return null
    try {
      return JSON.parse(arrayMatch[0]) as T
    } catch {
      return null
    }
  }
}

function pickApiConfig(): ApiConfig | null {
  try {
    const raw = localStorage.getItem(API_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      presets?: Array<{ id?: string; main?: Partial<ApiConfig> }>
      currentPresetId?: string
    }
    const presets = Array.isArray(parsed?.presets) ? parsed.presets : []
    const current =
      presets.find((p) => p?.id === parsed?.currentPresetId) ??
      presets[0]
    const cfg = current?.main
    if (!cfg?.apiUrl?.trim() || !cfg?.modelId?.trim()) return null
    return {
      apiUrl: String(cfg.apiUrl),
      apiKey: String(cfg.apiKey ?? ''),
      modelId: String(cfg.modelId),
    }
  } catch {
    return null
  }
}

function resolveChatUrl(apiUrl: string): string {
  const base = apiUrl.trim().replace(/\/+$/, '')
  if (!base) return ''
  if (base.endsWith('/chat/completions') || base.endsWith('/completions')) return base
  return `${base}/chat/completions`
}

async function callAiJson(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const cfg = pickApiConfig()
  if (!cfg) return null
  const url = resolveChatUrl(cfg.apiUrl)
  if (!url) return null
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey.trim() ? { Authorization: `Bearer ${cfg.apiKey.trim()}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.modelId,
        temperature: 0.9,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return String(data?.choices?.[0]?.message?.content ?? '').trim() || null
  } catch {
    return null
  }
}

function toAnswer(author: string, content: string, like = 0): QnAAnswer {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    authorId: `ai-${Math.random().toString(36).slice(2, 8)}`,
    authorName: author,
    isAnonymous: !author.includes('好友'),
    content,
    likeCount: like,
    dislikeCount: Math.floor(Math.random() * 6),
    replies: [],
  }
}

function fallbackRows(style: GeneratorStyle, count: number, includeContacts: boolean): GeneratedRow[] {
  const seeds: Record<GeneratorStyle, string[]> = {
    情感八卦: ['男朋友总说“随便你”到底在想什么？', '前任突然点赞我三年前朋友圈是几个意思？', '暧昧对象每天晚安但从不约见面要继续吗？'],
    灵魂拷问: ['你最怕被别人知道的真实想法是什么？', '如果人生只能保留一个关系你会选谁？', '你有没有在爱里装过不在意？'],
    奇葩吐槽: ['同事把公司冰箱当自家仓库，这事怎么优雅开口？', '室友凌晨三点背单词还外放音乐，合理吗？', '相亲对象第一次见面带妈妈，你会跑吗？'],
    深度探讨: ['成年人关系里“边界感”到底怎么定义？', '稳定比热烈更重要吗？', '长期关系里坦诚和体面能兼得吗？'],
  }
  const pool = seeds[style]
  return Array.from({ length: count }).map((_, i) => ({
    id: crypto.randomUUID(),
    type: Math.random() > 0.72 ? 'directed' : 'public',
    isContact: includeContacts ? Math.random() > 0.6 : false,
    authorMask: includeContacts && Math.random() > 0.6 ? '你的某位好友' : `匿名网友${i + 1}`,
    content: pool[i % pool.length],
    likes: 10 + Math.floor(Math.random() * 490),
    initialComments: [
      { author: '吃瓜群众A', content: '这个问题有点真实。' },
      { author: '匿名用户', content: '蹲一个后续。' },
    ],
  }))
}

export async function generateQuestionsWithAi(params: BatchGenerateParams): Promise<Question[]> {
  const style = params.style
  const count = Math.max(1, Math.min(10, params.count))
  const includeContacts = params.includeContacts

  const systemPrompt = `# Role
你是一个深谙中文互联网社交生态（知乎、B站、微博、豆瓣、匿名论坛）的互联网社区内容模拟器。你的任务是生成真实、有讨论价值、带争议性或情绪共鸣的匿名提问。

# Generation Parameters
- 风格偏向: ${style}
- 生成数量: ${count}
- 是否包含通讯录好友提问: ${includeContacts ? 'true' : 'false'}

# Content Rules (CRITICAL)
1. 绝不生成日常废话，匿名提问必须是难以启齿、求建议、情绪表达。
2. 公开提问要宏大/有趣/带倾诉欲。
3. 定向提问要尖锐私密且有明确指向。
4. 语气要有网感。

# Output Format
返回纯 JSON 数组，不要 markdown。`

  const userPrompt = `请生成 ${count} 条，字段格式严格为：
[
  {
    "id": "随机UUID",
    "type": "public|directed",
    "isContact": boolean,
    "authorMask": "某匿名网友",
    "content": "提问正文",
    "likes": 10-500数字,
    "initialComments":[{"author":"网友A","content":"..."}]
  }
]`

  const raw = await callAiJson(systemPrompt, userPrompt)
  const rows = raw ? safeParseJson<GeneratedRow[]>(raw) : null
  const data = Array.isArray(rows) && rows.length ? rows.slice(0, count) : fallbackRows(style, count, includeContacts)

  return data.map((row, idx) => {
    const isDirected = row.type === 'directed'
    const contact = params.contacts[(idx + Math.floor(Math.random() * Math.max(1, params.contacts.length))) % Math.max(1, params.contacts.length)]
    const answers = (row.initialComments ?? []).map((c, i) => toAnswer(c.author || `匿名网友${i + 1}`, c.content || '蹲一个后续'))
    return {
      id: row.id || crypto.randomUUID(),
      body: String(row.content ?? '').trim() || '这个问题你会怎么选？',
      visibility: isDirected ? 'directed' : 'public',
      isContact: !!row.isContact,
      authorMask: row.authorMask || (row.isContact ? '你的某位好友' : '匿名网友'),
      targetUserIds: isDirected ? [contact?.id ?? 'self'] : undefined,
      targetDisplayNames: isDirected ? [contact?.remarkName ?? '好友'] : undefined,
      createdAt: Date.now() - Math.floor(Math.random() * 2_400_000),
      askerDisplayName: row.authorMask || '匿名',
      topAnswerSnippet: answers[0]
        ? {
            authorName: answers[0].authorName,
            isAnonymous: answers[0].isAnonymous,
            avatarUrl: answers[0].authorAvatarUrl,
            text: answers[0].content,
            likeCount: typeof row.likes === 'number' ? row.likes : answers[0].likeCount,
          }
        : undefined,
      answers,
      unreadForCurrentUser: isDirected,
    }
  })
}

export async function generateDynamicRepliesWithAi(args: {
  postBody: string
  isContact: boolean
  recentComments: string
  userComment: string
}): Promise<DynamicReplyRow[]> {
  const systemPrompt = `# Role
你是一个由不同性格网民组成的赛博吃瓜群众集合体。

# Context
- 原帖内容: ${args.postBody}
- 原帖是否来自好友: ${args.isContact ? 'true' : 'false'}
- 当前评论区已有内容: ${args.recentComments}
- 用户刚刚发表的回复: ${args.userComment}

# Interaction Rules
生成 1~3 条不同视角跟帖：赞同者/反驳者/吃瓜群众/楼主本人。

# Output Format
返回纯 JSON 数组：
[{"authorMask":"匿名用户","content":"..."}]`

  const raw = await callAiJson(systemPrompt, '请根据规则输出。')
  const rows = raw ? safeParseJson<DynamicReplyRow[]>(raw) : null
  if (Array.isArray(rows) && rows.length) return rows.slice(0, 3)
  return [
    { authorMask: '热心网友', content: '这个角度挺有道理，我赞同。' },
    { authorMask: '匿名用户', content: '只有我觉得可以再观察一下吗？' },
  ].slice(0, 1 + Math.floor(Math.random() * 2))
}

