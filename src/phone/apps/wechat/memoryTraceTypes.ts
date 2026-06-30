/** 单条「尾声延展」补丁在溯源中的展示（写库前从人设解析旧文，写库后正文为模型提交的 newContent；priority=after） */
export type MemoryTraceWorldBookAfterPatchRow = {
  characterId?: string
  worldBookId: string
  itemId: string
  /** 解析到的世界书名称（写库前自人设） */
  bookName?: string
  /** 解析到的条目名称 */
  itemName?: string
  /** 写库前该条目正文（未匹配到条目时为空） */
  previousContent: string
  /** 模型提交的替换后正文（与写库一致，过长时发布端已截断） */
  newContentFull: string
}

/** 单条「尾声延展」注入快照（思维溯源 UI；不含协议类提示词正文） */
export type MemoryTraceWorldBookAfterInjectedEntry = {
  characterId?: string
  characterName: string
  bookName: string
  itemName: string
  content: string
}

/** 思维溯源：本回合「尾声延展」世界书快照是否进 prompt、模型是否回传覆盖 JSON、是否写库 */
export type MemoryTraceWorldBookAfterChat = {
  /** 已向模型注入「尾声延展」可变条目快照（在场角色有已启用的 priority=after 条目） */
  protocolInPrompt: boolean
  /** @deprecated 仅存旧溯源；UI 请用 {@link injectedSnapshotEntries} */
  injectedDynamicSection: string
  /** 注入模型的尾声延展条目快照（占位符已展开；不含本地协议说明） */
  injectedSnapshotEntries?: MemoryTraceWorldBookAfterInjectedEntry[]
  /** 是否附带 ---WB_AFTER_PATCH--- 输出说明 */
  patchOutputRulesIncluded: boolean
  /** 从模型输出解析到的补丁 + 写库前旧正文对照 */
  parsedPatches: MemoryTraceWorldBookAfterPatchRow[]
  /** 至少一条补丁成功写入人设库 */
  appliedToDb: boolean
  /** 已要求输出补丁协议，但解析结果为空（模型未输出或 JSON 无效） */
  modelOmittedPatchBlock: boolean
  /** 自动总结阶段（非本轮聊天 inline）写入的补丁 */
  autoSummaryPatches?: MemoryTraceWorldBookAfterPatchRow[]
}

/** 相对当前私聊会话：记忆/摘录来自哪条微信线+扮演马甲 */
export type MemoryTraceLineRelation = 'current' | 'other' | 'unlabeled'

/** 长期记忆分轨：角色自有 vs 线下关联（人脉 NPC） */
export type MemoryTraceMemoryBucket = 'own' | 'linked'

export type MemoryTraceLineScopedMeta = {
  sourceLineLabel: string
  lineRelation: MemoryTraceLineRelation
}

/** 思维溯源：人脉圈内角色↔角色关系边 */
export type MemoryTraceNetworkCharEdge = {
  fromName: string
  toName: string
  relation: string
  fromCallsTo?: string
  fromPerspective: string
  toPerspective: string
  involvesFocus: boolean
}

/** 思维溯源：玩家↔圈内角色（人脉 · 玩家视角配置） */
export type MemoryTraceNetworkPlayerLink = {
  targetName: string
  isFocusCharacter: boolean
  relationThemToYou?: string
  theySeeYou?: string
  relationYouToThem?: string
  youSeeThem?: string
  theyCallYou?: string
  youCallThem?: string
}

/** 思维溯源：玩家身份↔当前角色绑定边 */
export type MemoryTraceNetworkIdentityEdge = {
  scopeLabel: string
  identityName: string
  relation: string
  summary: string
}

/** 本轮注入模型的人脉关系与看法（与 `loadPrivateChatNetworkRelationshipsBlock` 同源） */
export type MemoryTraceNetworkRelationships = {
  injected: boolean
  focusCharacterName: string
  rootCharacterName: string
  involvingFocus: MemoryTraceNetworkCharEdge[]
  otherInClique: MemoryTraceNetworkCharEdge[]
  playerLinks: MemoryTraceNetworkPlayerLink[]
  identityEdges: MemoryTraceNetworkIdentityEdge[]
  /** 占位符已展开、与 system 注入一致的全文 */
  promptExcerpt: string
}

/** 本轮 system 记忆注入摘要（顶部 chips） */
export type MemoryTraceInjectionSummary = {
  /** 长期记忆关键词命中条数 */
  keywordHitCount: number
  /** 长期记忆向量召回条数 */
  longTermVectorCount: number
  /** 已总结片段语义召回条数 */
  contextVectorRecallCount: number
  /** 是否注入剧情时间轴块 */
  storyTimelineInjected: boolean
  /** 未总结私聊是否注入 */
  unsummarizedPrivateInjected: boolean
  /** 未总结群聊是否注入 */
  unsummarizedGroupInjected: boolean
  /** 未总结线下 plot 是否注入 */
  unsummarizedOfflineInjected: boolean
  /** 语义召回是否启用（设置项） */
  contextVectorRecallEnabled: boolean
  /** 向量 provider：api / local / auto */
  embeddingProviderMode: 'api' | 'local' | 'auto'
  /** 最近 N 轮参考：因未总结块已足够而省略 */
  privateRecentRoundsOmitted: boolean
  offlineRecentRoundsOmitted: boolean
  meetRecentRoundsOmitted: boolean
}

/** 剧情时间轴注入块 */
export type MemoryTraceStoryTimelineInjectRow = {
  injectKind: 'state' | 'recent' | 'vector'
  label: string
  content: string
  relevanceScore?: number
  isHistorical?: boolean
}

/** 剧情时间轴注入块 */
export type MemoryTraceStoryTimeline = {
  injected: boolean
  /** 与 prompt 注入一致的格式化正文 */
  promptExcerpt: string
  /** 逐条摘要带来源标签（与 prompt 注入对齐） */
  rows?: MemoryTraceStoryTimelineInjectRow[]
}

export type MemoryTraceContextVectorRecall = {
  relevanceScore: number
  content: string
  sourceKind: 'private_chat' | 'offline_plot' | 'meet_chat'
}

/** 「最近 N 轮参考」注入状态（与 dedupe 逻辑对齐） */
export type MemoryTraceRecentRoundRef = {
  channel: 'private' | 'offline' | 'meet'
  label: string
  injected: boolean
  omittedBecauseUnsummarized: boolean
  snippet: string
}

/** 思维溯源：一轮模型回复所加载的上下文矩阵（与注入逻辑对齐） */
export type MemoryTraceData = {
  lastReply: string
  charName: string
  /** 可选：旧持久化记录无此字段 */
  injectionSummary?: MemoryTraceInjectionSummary | null
  /** 可选：旧持久化记录无此字段 */
  worldBookAfterChat?: MemoryTraceWorldBookAfterChat | null
  /** 可选：旧持久化记录无此字段 */
  networkRelationships?: MemoryTraceNetworkRelationships | null
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
    /** 可选：剧情时间轴（Phase 1） */
    storyTimeline?: MemoryTraceStoryTimeline | null
    recentContext: {
      activeSessionMessages: number
      unsummarizedOfflinePlots: Array<{ date: string; snippet: string }>
      unsummarizedChats: Array<{
        type: 'private' | 'group'
        source: string
        snippet: string
        sourceLineLabel?: string
        lineRelation?: MemoryTraceLineRelation
      }>
      /** 可选：最近 N 轮参考注入 / 省略状态 */
      recentRoundRefs?: MemoryTraceRecentRoundRef[]
    }
    deepMemory: {
      keywordHits: Array<{
        keyword: string
        content: string
        /** 关键词语义确认分数（向量可用且非「始终触发」时） */
        relevanceScore?: number
        sourceLineLabel?: string
        lineRelation?: MemoryTraceLineRelation
        /** 可选：旧持久化无此字段时视为自有记忆 */
        memoryBucket?: MemoryTraceMemoryBucket
      }>
      vectorRetrievals: Array<{
        relevanceScore: number
        content: string
        sourceLineLabel?: string
        lineRelation?: MemoryTraceLineRelation
        memoryBucket?: MemoryTraceMemoryBucket
      }>
      /** 可选：已总结片段语义召回 */
      contextVectorRecalls?: MemoryTraceContextVectorRecall[]
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

function parseMemoryTracePatchRows(raw: unknown): MemoryTraceWorldBookAfterPatchRow[] {
  const out: MemoryTraceWorldBookAfterPatchRow[] = []
  if (!Array.isArray(raw)) return out
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const p = x as Record<string, unknown>
    const cid = p.characterId != null ? asStr(p.characterId).trim() : ''
    out.push({
      characterId: cid || undefined,
      worldBookId: asStr(p.worldBookId),
      itemId: asStr(p.itemId),
      bookName: asStr(p.bookName) || undefined,
      itemName: asStr(p.itemName) || undefined,
      previousContent: asStr(p.previousContent),
      newContentFull: asStr(p.newContentFull) || asStr(p.newContentPreview),
    })
  }
  return out
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
      const relRaw = u.lineRelation
      const lineRelation: MemoryTraceLineRelation | undefined =
        relRaw === 'current' || relRaw === 'other' || relRaw === 'unlabeled' ? relRaw : undefined
      unsummarizedChats.push({
        type: typ,
        source: asStr(u.source),
        snippet: asStr(u.snippet),
        sourceLineLabel: asStr(u.sourceLineLabel) || undefined,
        lineRelation,
      })
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
      const kRel = k.lineRelation
      const kLineRel: MemoryTraceLineRelation | undefined =
        kRel === 'current' || kRel === 'other' || kRel === 'unlabeled' ? kRel : undefined
      const kBucket = k.memoryBucket
      const kMemBucket: MemoryTraceMemoryBucket | undefined =
        kBucket === 'own' || kBucket === 'linked' ? kBucket : undefined
      keywordHits.push({
        keyword: asStr(k.keyword),
        content: asStr(k.content),
        relevanceScore: typeof k.relevanceScore === 'number' && Number.isFinite(k.relevanceScore) ? k.relevanceScore : undefined,
        sourceLineLabel: asStr(k.sourceLineLabel) || undefined,
        lineRelation: kLineRel,
        memoryBucket: kMemBucket,
      })
    }
  }
  const vectorRetrievals: MemoryTraceData['contextMatrix']['deepMemory']['vectorRetrievals'] = []
  if (Array.isArray(dmo.vectorRetrievals)) {
    for (const x of dmo.vectorRetrievals) {
      if (!x || typeof x !== 'object') continue
      const v = x as Record<string, unknown>
      const relevanceScore = asNum(v.relevanceScore, 0)
      const vRel = v.lineRelation
      const vLineRel: MemoryTraceLineRelation | undefined =
        vRel === 'current' || vRel === 'other' || vRel === 'unlabeled' ? vRel : undefined
      const vBucket = v.memoryBucket
      const vMemBucket: MemoryTraceMemoryBucket | undefined =
        vBucket === 'own' || vBucket === 'linked' ? vBucket : undefined
      vectorRetrievals.push({
        relevanceScore,
        content: asStr(v.content),
        sourceLineLabel: asStr(v.sourceLineLabel) || undefined,
        lineRelation: vLineRel,
        memoryBucket: vMemBucket,
      })
    }
  }

  let worldBookAfterChat: MemoryTraceWorldBookAfterChat | null | undefined
  const wba = o.worldBookAfterChat
  if (wba && typeof wba === 'object') {
    const w = wba as Record<string, unknown>
    const parsedPatches = parseMemoryTracePatchRows(w.parsedPatches)
    const injectedSnapshotEntries: MemoryTraceWorldBookAfterInjectedEntry[] = []
    const inj = w.injectedSnapshotEntries
    if (Array.isArray(inj)) {
      for (const x of inj) {
        if (!x || typeof x !== 'object') continue
        const e = x as Record<string, unknown>
        const characterName = asStr(e.characterName).trim()
        const itemName = asStr(e.itemName).trim()
        const content = asStr(e.content)
        if (!characterName && !itemName && !content.trim()) continue
        const eid = e.characterId != null ? asStr(e.characterId).trim() : ''
        injectedSnapshotEntries.push({
          characterId: eid || undefined,
          characterName: characterName || '角色',
          bookName: asStr(e.bookName).trim() || '世界书',
          itemName: itemName || '条目',
          content,
        })
      }
    }
    worldBookAfterChat = {
      protocolInPrompt: Boolean(w.protocolInPrompt),
      injectedDynamicSection: asStr(w.injectedDynamicSection),
      injectedSnapshotEntries: injectedSnapshotEntries.length ? injectedSnapshotEntries : undefined,
      patchOutputRulesIncluded: Boolean(w.patchOutputRulesIncluded),
      parsedPatches,
      appliedToDb: Boolean(w.appliedToDb),
      modelOmittedPatchBlock: Boolean(w.modelOmittedPatchBlock),
      autoSummaryPatches: parseMemoryTracePatchRows(w.autoSummaryPatches),
    }
  }

  let networkRelationships: MemoryTraceNetworkRelationships | null | undefined
  const nr = o.networkRelationships
  if (nr && typeof nr === 'object') {
    const nro = nr as Record<string, unknown>
    const parseCharEdges = (arr: unknown): MemoryTraceNetworkCharEdge[] => {
      const out: MemoryTraceNetworkCharEdge[] = []
      if (!Array.isArray(arr)) return out
      for (const x of arr) {
        if (!x || typeof x !== 'object') continue
        const e = x as Record<string, unknown>
        const fromName = asStr(e.fromName).trim()
        const toName = asStr(e.toName).trim()
        if (!fromName || !toName) continue
        out.push({
          fromName,
          toName,
          relation: asStr(e.relation, '关系'),
          fromCallsTo: asStr(e.fromCallsTo) || undefined,
          fromPerspective: asStr(e.fromPerspective),
          toPerspective: asStr(e.toPerspective),
          involvesFocus: Boolean(e.involvesFocus),
        })
      }
      return out
    }
    const parsePlayerLinks = (arr: unknown): MemoryTraceNetworkPlayerLink[] => {
      const out: MemoryTraceNetworkPlayerLink[] = []
      if (!Array.isArray(arr)) return out
      for (const x of arr) {
        if (!x || typeof x !== 'object') continue
        const e = x as Record<string, unknown>
        const targetName = asStr(e.targetName).trim()
        if (!targetName) continue
        out.push({
          targetName,
          isFocusCharacter: Boolean(e.isFocusCharacter),
          relationThemToYou: asStr(e.relationThemToYou) || undefined,
          theySeeYou: asStr(e.theySeeYou) || undefined,
          relationYouToThem: asStr(e.relationYouToThem) || undefined,
          youSeeThem: asStr(e.youSeeThem) || undefined,
          theyCallYou: asStr(e.theyCallYou) || undefined,
          youCallThem: asStr(e.youCallThem) || undefined,
        })
      }
      return out
    }
    const parseIdentityEdges = (arr: unknown): MemoryTraceNetworkIdentityEdge[] => {
      const out: MemoryTraceNetworkIdentityEdge[] = []
      if (!Array.isArray(arr)) return out
      for (const x of arr) {
        if (!x || typeof x !== 'object') continue
        const e = x as Record<string, unknown>
        const identityName = asStr(e.identityName).trim()
        if (!identityName) continue
        out.push({
          scopeLabel: asStr(e.scopeLabel, '玩家身份'),
          identityName,
          relation: asStr(e.relation, '关系'),
          summary: asStr(e.summary),
        })
      }
      return out
    }
    networkRelationships = {
      injected: Boolean(nro.injected),
      focusCharacterName: asStr(nro.focusCharacterName, '你'),
      rootCharacterName: asStr(nro.rootCharacterName, '档案主角'),
      involvingFocus: parseCharEdges(nro.involvingFocus),
      otherInClique: parseCharEdges(nro.otherInClique),
      playerLinks: parsePlayerLinks(nro.playerLinks),
      identityEdges: parseIdentityEdges(nro.identityEdges),
      promptExcerpt: asStr(nro.promptExcerpt),
    }
  }

  let injectionSummary: MemoryTraceInjectionSummary | null | undefined
  const isRaw = o.injectionSummary
  if (isRaw && typeof isRaw === 'object') {
    const s = isRaw as Record<string, unknown>
    const modeRaw = s.embeddingProviderMode
    const mode: MemoryTraceInjectionSummary['embeddingProviderMode'] =
      modeRaw === 'api' || modeRaw === 'local' || modeRaw === 'auto' ? modeRaw : 'auto'
    injectionSummary = {
      keywordHitCount: asNum(s.keywordHitCount, 0),
      longTermVectorCount: asNum(s.longTermVectorCount, 0),
      contextVectorRecallCount: asNum(s.contextVectorRecallCount, 0),
      storyTimelineInjected: Boolean(s.storyTimelineInjected),
      unsummarizedPrivateInjected: Boolean(s.unsummarizedPrivateInjected),
      unsummarizedGroupInjected: Boolean(s.unsummarizedGroupInjected),
      unsummarizedOfflineInjected: Boolean(s.unsummarizedOfflineInjected),
      contextVectorRecallEnabled: Boolean(s.contextVectorRecallEnabled),
      embeddingProviderMode: mode,
      privateRecentRoundsOmitted: Boolean(s.privateRecentRoundsOmitted),
      offlineRecentRoundsOmitted: Boolean(s.offlineRecentRoundsOmitted),
      meetRecentRoundsOmitted: Boolean(s.meetRecentRoundsOmitted),
    }
  }

  let storyTimeline: MemoryTraceStoryTimeline | null | undefined
  const st = cmo.storyTimeline
  if (st && typeof st === 'object') {
    const sto = st as Record<string, unknown>
    const rowsRaw = sto.rows
    const rows: MemoryTraceStoryTimelineInjectRow[] = []
    if (Array.isArray(rowsRaw)) {
      for (const x of rowsRaw) {
        if (!x || typeof x !== 'object') continue
        const r = x as Record<string, unknown>
        const kindRaw = r.injectKind
        const injectKind: MemoryTraceStoryTimelineInjectRow['injectKind'] =
          kindRaw === 'vector' || kindRaw === 'state' ? kindRaw : 'recent'
        rows.push({
          injectKind,
          label: asStr(r.label),
          content: asStr(r.content),
          ...(typeof r.relevanceScore === 'number' && Number.isFinite(r.relevanceScore)
            ? { relevanceScore: r.relevanceScore }
            : {}),
          ...(r.isHistorical === true ? { isHistorical: true } : {}),
        })
      }
    }
    storyTimeline = {
      injected: Boolean(sto.injected),
      promptExcerpt: asStr(sto.promptExcerpt),
      ...(rows.length ? { rows } : {}),
    }
  }

  const recentRoundRefs: MemoryTraceRecentRoundRef[] = []
  const rrr = rco.recentRoundRefs
  if (Array.isArray(rrr)) {
    for (const x of rrr) {
      if (!x || typeof x !== 'object') continue
      const r = x as Record<string, unknown>
      const chRaw = r.channel
      const channel: MemoryTraceRecentRoundRef['channel'] =
        chRaw === 'offline' || chRaw === 'meet' ? chRaw : 'private'
      recentRoundRefs.push({
        channel,
        label: asStr(r.label),
        injected: Boolean(r.injected),
        omittedBecauseUnsummarized: Boolean(r.omittedBecauseUnsummarized),
        snippet: asStr(r.snippet),
      })
    }
  }

  const contextVectorRecalls: MemoryTraceContextVectorRecall[] = []
  const cvr = dmo.contextVectorRecalls
  if (Array.isArray(cvr)) {
    for (const x of cvr) {
      if (!x || typeof x !== 'object') continue
      const v = x as Record<string, unknown>
      const skRaw = v.sourceKind
      const sourceKind: MemoryTraceContextVectorRecall['sourceKind'] =
        skRaw === 'offline_plot' || skRaw === 'meet_chat' ? skRaw : 'private_chat'
      contextVectorRecalls.push({
        relevanceScore: asNum(v.relevanceScore, 0),
        content: asStr(v.content),
        sourceKind,
      })
    }
  }

  return {
    lastReply,
    charName: charName || '角色',
    injectionSummary,
    worldBookAfterChat,
    networkRelationships,
    contextMatrix: {
      baseDirectives: {
        persona,
        personaDetail,
        worldBackground,
        characterWorldBook,
        globalWorldbook,
        worldbooks,
      },
      storyTimeline,
      recentContext: {
        activeSessionMessages,
        unsummarizedOfflinePlots,
        unsummarizedChats,
        recentRoundRefs: recentRoundRefs.length ? recentRoundRefs : undefined,
      },
      deepMemory: {
        keywordHits,
        vectorRetrievals,
        contextVectorRecalls: contextVectorRecalls.length ? contextVectorRecalls : undefined,
      },
    },
  }
}
