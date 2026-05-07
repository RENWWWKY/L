/** 思维溯源：一轮模型回复所加载的上下文矩阵（与注入逻辑对齐） */
export type MemoryTraceData = {
  lastReply: string
  charName: string
  contextMatrix: {
    baseDirectives: {
      /** 兼容旧版：简短标签；新版以 personaDetail 全文为准 */
      persona: string[]
      /** 与人设编辑一致的完整档案正文（含体态、简介、开场白等） */
      personaDetail: string
      worldBackground: string
      /** 角色卡上启用的世界书条目拼接正文（与模型注入 `buildWorldBookText` 同源） */
      characterWorldBook: string
      /** 档案室条目：当前场景下生效的条目标题+正文（无注入前言与条目尾注；筛选规则与 `buildWorldbookContext` 一致） */
      globalWorldbook: string
      /** @deprecated 旧版仅标题胶囊；无 globalWorldbook 时可回退展示 */
      worldbooks: Array<{ type: 'global' | 'personal'; title: string }>
    }
    recentContext: {
      activeSessionMessages: number
      unsummarizedOfflinePlots: Array<{ date: string; snippet: string }>
      unsummarizedChats: Array<{ type: 'private' | 'group'; source: string; snippet: string }>
    }
    deepMemory: {
      keywordHits: Array<{ keyword: string; content: string }>
      vectorRetrievals: Array<{ relevanceScore: number; content: string }>
    }
  }
}

/** IndexedDB `phoneKv` 键：上次成功发布的思维溯源（刷新后恢复） */
export const WECHAT_MEMORY_TRACE_KV_KEY = 'wechat-memory-trace-last-v1'

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asNum(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** 从持久化 JSON 恢复；结构不符时返回 null */
export function parseMemoryTraceData(raw: unknown): MemoryTraceData | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const lastReply = asStr(o.lastReply)
  const charName = asStr(o.charName)
  const cm = o.contextMatrix
  if (!cm || typeof cm !== 'object') return null
  const cmo = cm as Record<string, unknown>

  const bd = cmo.baseDirectives
  if (!bd || typeof bd !== 'object') return null
  const bdo = bd as Record<string, unknown>
  const persona = Array.isArray(bdo.persona) ? bdo.persona.map((x) => asStr(x)).filter(Boolean) : []
  const personaDetail = asStr(bdo.personaDetail)
  const worldBackground = asStr(bdo.worldBackground)
  const characterWorldBook = asStr(bdo.characterWorldBook)
  const globalWorldbook = asStr(bdo.globalWorldbook)
  const wbRaw = bdo.worldbooks
  const worldbooks: MemoryTraceData['contextMatrix']['baseDirectives']['worldbooks'] = []
  if (Array.isArray(wbRaw)) {
    for (const x of wbRaw) {
      if (!x || typeof x !== 'object') continue
      const w = x as Record<string, unknown>
      const t = w.type === 'global' || w.type === 'personal' ? w.type : 'global'
      const title = asStr(w.title)
      if (title) worldbooks.push({ type: t, title })
    }
  }

  const rc = cmo.recentContext
  if (!rc || typeof rc !== 'object') return null
  const rco = rc as Record<string, unknown>
  const activeSessionMessages = asNum(rco.activeSessionMessages, 0)
  const unsummarizedOfflinePlots: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedOfflinePlots'] = []
  if (Array.isArray(rco.unsummarizedOfflinePlots)) {
    for (const x of rco.unsummarizedOfflinePlots) {
      if (!x || typeof x !== 'object') continue
      const u = x as Record<string, unknown>
      unsummarizedOfflinePlots.push({ date: asStr(u.date, '—'), snippet: asStr(u.snippet) })
    }
  }
  const unsummarizedChats: MemoryTraceData['contextMatrix']['recentContext']['unsummarizedChats'] = []
  if (Array.isArray(rco.unsummarizedChats)) {
    for (const x of rco.unsummarizedChats) {
      if (!x || typeof x !== 'object') continue
      const u = x as Record<string, unknown>
      const typ = u.type === 'group' ? 'group' : 'private'
      unsummarizedChats.push({ type: typ, source: asStr(u.source), snippet: asStr(u.snippet) })
    }
  }

  const dm = cmo.deepMemory
  if (!dm || typeof dm !== 'object') return null
  const dmo = dm as Record<string, unknown>
  const keywordHits: MemoryTraceData['contextMatrix']['deepMemory']['keywordHits'] = []
  if (Array.isArray(dmo.keywordHits)) {
    for (const x of dmo.keywordHits) {
      if (!x || typeof x !== 'object') continue
      const k = x as Record<string, unknown>
      keywordHits.push({ keyword: asStr(k.keyword), content: asStr(k.content) })
    }
  }
  const vectorRetrievals: MemoryTraceData['contextMatrix']['deepMemory']['vectorRetrievals'] = []
  if (Array.isArray(dmo.vectorRetrievals)) {
    for (const x of dmo.vectorRetrievals) {
      if (!x || typeof x !== 'object') continue
      const v = x as Record<string, unknown>
      const relevanceScore = asNum(v.relevanceScore, 0)
      vectorRetrievals.push({ relevanceScore, content: asStr(v.content) })
    }
  }

  return {
    lastReply,
    charName: charName || '角色',
    contextMatrix: {
      baseDirectives: {
        persona,
        personaDetail,
        worldBackground,
        characterWorldBook,
        globalWorldbook,
        worldbooks,
      },
      recentContext: {
        activeSessionMessages,
        unsummarizedOfflinePlots,
        unsummarizedChats,
      },
      deepMemory: { keywordHits, vectorRetrievals },
    },
  }
}
