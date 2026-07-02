import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'

import {
  WECHAT_CLASSIC_GROUP_ID,
} from './wechatClassicStickerPack'

export interface StickerItem {
  id: string
  url: string
  description: string // 传给 AI 的关键字段
  createdAt: number
}

export interface StickerGroup {
  id: string
  name: string
  coverUrl: string
  items: StickerItem[]
  createdAt: number
  readonly?: boolean
}

type StickerState = {
  groups: StickerGroup[]
}

const STORAGE_KEY = 'wechat-sticker-center-v1'
const STICKER_DB_KEY = 'wechat-sticker-center-v2'
const STICKER_CHANGED_EVENT = 'wechat-sticker-storage-changed'
const DEFAULT_GROUP_ID_1 = 'default-sticker-pack-1'
const DEFAULT_GROUP_ID_2 = 'default-sticker-pack-2'
const DEFAULT_GROUP_ID_3 = 'default-sticker-pack-3'
const DEFAULT_GROUP_ID_4 = 'default-sticker-pack-4'
const READONLY_GROUP_IDS = new Set([
  WECHAT_CLASSIC_GROUP_ID,
  DEFAULT_GROUP_ID_1,
  DEFAULT_GROUP_ID_2,
  DEFAULT_GROUP_ID_3,
  DEFAULT_GROUP_ID_4,
])

const defaultPack1Modules = import.meta.glob('../../../../../image/默认表情包1/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const defaultPack2Modules = import.meta.glob('../../../../../image/默认表情包2/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const defaultPack3Modules = import.meta.glob('../../../../../image/蒜皮宝宝表情包/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const defaultPack4Modules = import.meta.glob('../../../../../image/月薪喵表情包/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function fileLabelFromPath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  const fileName = normalized.split('/').pop() ?? ''
  return fileName.replace(/\.[^.]+$/, '').trim() || '未命名表情'
}

function buildDefaultItems(modules: Record<string, string>, idPrefix: string): StickerItem[] {
  const keys = Object.keys(modules).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return keys.map((k, idx) => ({
    id: `${idPrefix}-${idx + 1}`,
    url: modules[k],
    description: fileLabelFromPath(k),
    createdAt: 0,
  }))
}

const DEFAULT_GROUPS: StickerGroup[] = [
  {
    id: DEFAULT_GROUP_ID_1,
    name: '这狗',
    coverUrl: buildDefaultItems(defaultPack1Modules, 'df1')[0]?.url ?? '',
    items: buildDefaultItems(defaultPack1Modules, 'df1'),
    createdAt: 0,
    readonly: true,
  },
  {
    id: DEFAULT_GROUP_ID_2,
    name: '杂混抽象',
    coverUrl: buildDefaultItems(defaultPack2Modules, 'df2')[0]?.url ?? '',
    items: buildDefaultItems(defaultPack2Modules, 'df2'),
    createdAt: 0,
    readonly: true,
  },
  {
    id: DEFAULT_GROUP_ID_3,
    name: '蒜皮宝宝',
    coverUrl: buildDefaultItems(defaultPack3Modules, 'df3')[0]?.url ?? '',
    items: buildDefaultItems(defaultPack3Modules, 'df3'),
    createdAt: 0,
    readonly: true,
  },
  {
    id: DEFAULT_GROUP_ID_4,
    name: '月薪喵',
    coverUrl: buildDefaultItems(defaultPack4Modules, 'df4')[0]?.url ?? '',
    items: buildDefaultItems(defaultPack4Modules, 'df4'),
    createdAt: 0,
    readonly: true,
  },
].filter((g) => !!g && g.items.length > 0)

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emitChanged() {
  try {
    window.dispatchEvent(new Event(STICKER_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

const DEFAULT_STATE: StickerState = {
  groups: [],
}

let memoryState: StickerState = DEFAULT_STATE
let isHydrating = false
let hydrationPromise: Promise<StickerState> | null = null
let persistQueue: Promise<void> = Promise.resolve()

function normalizeState(input: unknown): StickerState {
  const parsed = input as Partial<StickerState> | null | undefined
  return {
    groups: Array.isArray(parsed?.groups) ? parsed!.groups : [],
  }
}

function readState(): StickerState {
  return memoryState
}

async function readLocalStorageBackup(): Promise<StickerState> {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return normalizeState(JSON.parse(raw))
  } catch {
    return DEFAULT_STATE
  }
}

async function hydrateStateFromDb(): Promise<StickerState> {
  if (typeof window === 'undefined') return DEFAULT_STATE
  if (hydrationPromise) return hydrationPromise
  hydrationPromise = (async () => {
    if (isHydrating) return memoryState
    isHydrating = true
    try {
      const fromDb = normalizeState(await personaDb.getPhoneKv(STICKER_DB_KEY))
      if (fromDb.groups.length > 0) {
        memoryState = fromDb
        return fromDb
      }
      const fallback = await readLocalStorageBackup()
      if (fallback.groups.length > 0) {
        memoryState = fallback
        await personaDb.setPhoneKv(STICKER_DB_KEY, fallback)
      } else {
        memoryState = fromDb
      }
      return memoryState
    } catch {
      const fallback = await readLocalStorageBackup()
      memoryState = fallback
      return fallback
    } finally {
      isHydrating = false
      hydrationPromise = null
    }
  })()
  return hydrationPromise
}

if (typeof window !== 'undefined') {
  void hydrateStateFromDb().then(() => {
    emitChanged()
  })
}

/** 角色发图 / 校验模型输出 URL：仅允许资源库内地址（含默认包与用户表情包中心） */
export function getKnownStickerUrlSet(): Set<string> {
  const s = new Set<string>()
  for (const g of allStickerGroups()) {
    for (const it of g.items) {
      const u = it.url.trim()
      if (u) s.add(u)
    }
  }
  return s
}

function decodeURIComponentSafe(s: string): string {
  const t = String(s ?? '').trim()
  if (!t) return ''
  try {
    return decodeURIComponent(t)
  } catch {
    return t
  }
}

function fileBasenameNoExtFromUrlOrPath(input: string): string {
  const decoded = decodeURIComponentSafe(input.replaceAll('\\', '/'))
  const seg = decoded.split('/').pop() ?? decoded
  return seg.replace(/\.[^.]+$/i, '').trim()
}

/** 与 ChatRoom 内校验逻辑一致：尝试把模型输出的路径变体归一到资源库里的 url */
export function resolveKnownStickerUrl(rawUrl: string): string | null {
  const set = getKnownStickerUrlSet()
  if (!set.size) return null
  const src = String(rawUrl || '').trim()
  if (!src) return null
  const candidates = [
    src,
    src.replace(/^\/+/, ''),
    `/${src.replace(/^\/+/, '')}`,
    src.replace(/^\/?Lumi-Phone\/image\//i, 'Phone/image/'),
    src.replace(/^\/?Phone\/image\//i, 'Lumi-Phone/image/'),
    decodeURIComponentSafe(src),
  ]
  for (const c of candidates) {
    const x = c.trim()
    if (x && set.has(x)) return x
  }
  return null
}

import {
  WECHAT_STICKER_DESCRIPTION_SEMANTICS_RULE,
  WECHAT_STICKER_SEND_CONSERVATIVE_RULE,
} from './stickerPromptRules'

export type StickerCatalogEntry = {
  url: string
  /** 展示给模型的一行「引用名」，须原样用于 `[表情包]引用名` */
  ref: string
  description: string
  groupName: string
  groupTag: string
  /** 用户在「表情包中心」自建分组（非默认只读包） */
  isUserCustom: boolean
}

function allStickerGroups(): StickerGroup[] {
  const state = readState()
  /** 自定义分组优先：注入 AI 目录与解析匹配时，避免被默认大包截断 */
  return [...state.groups, ...DEFAULT_GROUPS].filter((g) => g.id !== WECHAT_CLASSIC_GROUP_ID)
}

/** 发 AI 请求 / 解析角色 `[表情包]` 行前须 await，确保自定义包已从 IndexedDB 载入 */
export function ensureStickerStoreHydrated(): Promise<void> {
  return hydrateStateFromDb().then(() => undefined)
}

/**
 * 生成每条表情的稳定引用名：默认用「描述」；若全局重名则用「分组名/描述」。
 */
export function getStickerCatalogEntries(): StickerCatalogEntry[] {
  const rows: Array<{ g: StickerGroup; it: StickerItem; desc: string }> = []
  for (const g of allStickerGroups()) {
    for (const it of g.items) {
      const desc = (it.description || '未命名').replace(/\s+/g, ' ').trim().slice(0, 40) || '未命名'
      rows.push({ g, it, desc })
    }
  }
  const norm = (s: string) => s.trim()
  const descCount = new Map<string, number>()
  for (const r of rows) {
    const k = norm(r.desc)
    descCount.set(k, (descCount.get(k) ?? 0) + 1)
  }
  return rows.map(({ g, it, desc }) => {
    const groupTag = g.readonly ? `${g.name}·默认` : g.name
    const ref = (descCount.get(norm(desc)) ?? 0) > 1 ? `${g.name}/${desc}` : desc
    return {
      url: it.url.trim(),
      ref,
      description: desc,
      groupName: g.name,
      groupTag,
      isUserCustom: !g.readonly,
    }
  })
}

function buildStickerCatalogLines(
  entries: StickerCatalogEntry[],
  maxLines: number,
  maxChars: number,
): string[] {
  const custom = entries.filter((e) => e.isUserCustom && e.url)
  const builtin = entries.filter((e) => !e.isUserCustom && e.url)
  const lines: string[] = []
  let chars = 0
  const push = (e: StickerCatalogEntry) => {
    const line = `- 「${e.groupTag}」${e.description} → 发送时单独一行输出：[表情包]${e.ref}`
    if (lines.length >= maxLines) return
    if (chars + line.length > maxChars && lines.length > 0) return
    lines.push(line)
    chars += line.length + 1
  }
  for (const e of custom) push(e)
  for (const e of builtin) push(e)
  return lines
}

/**
 * 将模型输出的 `[表情包]` 行载荷解析为资源库中的真实 url。
 * 优先支持「引用名」（与《表情包资源》中 ref 一致）；兼容旧版完整 URL / Phone 路径等。
 */
function stripLeadingStickerLabelGarbage(s: string): string {
  let t = s.trim()
  for (let k = 0; k < 4; k += 1) {
    const next = t
      // 常见误写：emoji： / emoji: / 全角冒号 U+FF1A、兼容 U+FE55 U+2236
      .replace(/^(?:emoji|emotes?|stickers?)\s*[:：﹕∶]\s*/i, '')
      .replace(/^(?:表情|表情包)\s*[:：﹕∶]\s*/, '')
      .trim()
    if (next === t) break
    t = next
  }
  return t
}

/**
 * 模型可能用非常规冒号（不在 [:：﹕∶] 里）写「emoji︰爷…」，正则剥不掉；从首汉字起截断可恢复资源库匹配。
 * 仅处理 emoji / sticker 前缀，避免误伤以「emotion…」开头的合法引用名。
 */
function stripLatinLabelNoiseBeforeFirstHan(s: string): string {
  const t = s.trim()
  if (!t) return t
  if (!/^emoji/i.test(t) && !/^sticker/i.test(t)) return t
  const i = t.search(/[\u4E00-\u9FFF]/)
  if (i <= 0) return t
  return t.slice(i).trim()
}

/** 目录名与模型输出：NFKC、去零宽、统一括号形态，减少「只错一张」的字符级不一致 */
function normalizeStickerLabel(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveStickerCatalogRefForUrl(url: string): string | null {
  const u = String(url ?? '').trim()
  if (!u) return null
  for (const e of getStickerCatalogEntries()) {
    if (e.url === u) return e.ref
  }
  return null
}

export function extractStickerRefFromContent(content: string): string | null {
  const t = String(content ?? '').trim()
  if (!t.startsWith('[表情包]')) return null
  const payload = t.slice('[表情包]'.length).trim()
  if (!payload) return null
  const hit = resolveStickerCatalogMatch(payload)
  return hit?.ref ?? payload
}

export function resolveStickerCatalogMatch(rawInput: string): { url: string; ref: string } | null {
  const url = resolveStickerOutputRef(rawInput)
  if (!url) return null
  const catalogRef = resolveStickerCatalogRefForUrl(url)
  const ref = catalogRef || normalizeStickerLabel(rawInput) || String(rawInput ?? '').trim()
  if (!ref) return null
  return { url, ref }
}

export function resolveStickerOutputRef(rawInput: string): string | null {
  let ref = String(rawInput ?? '').trim().replace(/^['"`「」]+|['"`」]+$/g, '').trim()
  ref = ref.normalize('NFKC')
  ref = stripLeadingStickerLabelGarbage(ref)
  ref = stripLatinLabelNoiseBeforeFirstHan(ref)
  // 去掉模型缀在**末尾**的句号等。**不要**去掉结尾的「）」——引用名里常有「（无语流汗）」一类括号，误删会导致永远匹配不到目录
  ref = ref.replace(/[，。！？!?,、；;:：》】]+$/g, '').trim()
  if (!ref) return null

  const urlHit = resolveKnownStickerUrl(ref)
  if (urlHit) return urlHit

  const decoded = decodeURIComponentSafe(ref)
  if (decoded !== ref) {
    const u2 = resolveKnownStickerUrl(decoded)
    if (u2) return u2
  }

  const entries = getStickerCatalogEntries()
  for (const e of entries) {
    if (e.ref === ref || e.ref === decoded) return e.url
  }
  for (const e of entries) {
    if (e.description === ref || e.description === decoded) return e.url
  }

  const normRef = normalizeStickerLabel(ref)
  const normDecoded = normalizeStickerLabel(decoded)
  for (const e of entries) {
    const nr = normalizeStickerLabel(e.ref)
    if (nr && (nr === normRef || nr === normDecoded)) return e.url
  }
  for (const e of entries) {
    const nd = normalizeStickerLabel(e.description)
    if (nd && (nd === normRef || nd === normDecoded)) return e.url
  }

  const slash = ref.indexOf('/')
  if (slash > 0) {
    const gname = ref.slice(0, slash).trim()
    const d = ref.slice(slash + 1).trim()
    const hit = entries.find(
      (e) =>
        (e.groupName === gname && e.description === d) ||
        (normalizeStickerLabel(e.groupName) === normalizeStickerLabel(gname) &&
          normalizeStickerLabel(e.description) === normalizeStickerLabel(d)),
    )
    if (hit) return hit.url
  }

  const stem = fileBasenameNoExtFromUrlOrPath(ref)
  const stemLoose = stem.replace(/-[A-Za-z0-9]{4,}$/i, '').trim()
  if (stem || stemLoose) {
    for (const e of entries) {
      const d = e.description.trim()
      if (!d) continue
      if (stem === d || stemLoose === d || stem.startsWith(d) || stemLoose.startsWith(d)) return e.url
    }
  }
  return null
}

/** 角色侧：单行 `[表情包]引用名` 或兼容旧版 `[表情包]URL/路径`（须能解析到表情包资源库） */
export function parseCharacterStickerLine(line: string): { url: string; ref: string } | null {
  const t = String(line ?? '')
    .trim()
    .replace(/^\uFEFF+/, '')
    .replace(/^[\u200B-\u200D\uFEFF]+/, '')
    .trim()
  const m = /^\[表情包\]\s*(.+)$/.exec(t)
  if (!m) return null
  const raw = m[1]!.trim().replace(/^['"`「」]+|['"`」]+$/g, '').trim()
  if (!raw) return null
  return resolveStickerCatalogMatch(raw)
}

/**
 * 拼入微信单聊 system，供模型选用合法表情包（用「引用名」输出，避免长路径/URL 被截断或抄错）。
 * 行数与总长封顶，避免撑爆上下文。
 */
export function buildStickerCatalogPromptBlock(
  maxLines = 96,
  maxChars = 9500,
  options?: {
    targetedModeEnabled?: boolean
    enabledGroups?: string[]
    targetedEntries?: import('../wechatMediaSendFrequency').StickerTargetedEntryMap
    bannedRefs?: string[]
  },
): string {
  let entries = getStickerCatalogEntries()
  const banned = new Set((options?.bannedRefs ?? []).map((r) => r.trim()).filter(Boolean))
  entries = entries.filter((e) => !banned.has(e.ref))
  if (options?.targetedModeEnabled) {
    const groups = new Set(options.enabledGroups ?? [])
    const legacyEntries = options.targetedEntries ?? {}
    const hasGroups = groups.size > 0
    entries = entries.filter((e) => {
      if (hasGroups) {
        if (!groups.has(e.groupTag)) return false
        const pct = legacyEntries[e.ref]
        if (pct === 0) return false
        return true
      }
      return e.ref in legacyEntries && legacyEntries[e.ref]! > 0
    })
  }
  const lines = buildStickerCatalogLines(entries, maxLines, maxChars)
  if (!lines.length) {
    return `---------------------\n【表情包资源】\n---------------------\n当前库中无可用表情条目。请勿输出 [表情包] 行；用户发图仍按「表情包消息」规则接话即可。\n`
  }
  let body = lines.join('\n')
  const customCount = entries.filter((e) => e.isUserCustom && e.url).length
  const builtinCount = entries.filter((e) => !e.isUserCustom && e.url).length
  const truncated =
    lines.length < customCount + builtinCount
      ? '\n…（目录过长已截断：已优先保留用户在「表情包中心」自建分组；请只用上方已列出的引用名）'
      : ''
  if (body.length > maxChars) body = `${body.slice(0, maxChars)}${truncated || '\n…（目录过长已截断，请只用上方已列出的引用名）'}`
  else if (truncated) body = `${body}${truncated}`
  return `---------------------\n【表情包资源（含默认包与用户自建分组；选用须贴脸，默认不发）】\n---------------------\n${WECHAT_STICKER_SEND_CONSERVATIVE_RULE}\n\n${WECHAT_STICKER_DESCRIPTION_SEMANTICS_RULE}\n\n${body}\n`
}

function writeState(next: StickerState) {
  memoryState = next
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(async () => {
      await personaDb.setPhoneKv(STICKER_DB_KEY, next)
    })
    .catch(() => {
      // ignore
    })
  emitChanged()
}

export function useStickerStore() {
  const [state, setState] = useState<StickerState>(() => readState())
  const stateRef = useRef(state)
  const lastCreateRef = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    void hydrateStateFromDb().then((next) => {
      stateRef.current = next
      setState(next)
      emitChanged()
    })

    const onChanged = () => {
      const next = readState()
      stateRef.current = next
      setState(next)
    }
    window.addEventListener(STICKER_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(STICKER_CHANGED_EVENT, onChanged)
    }
  }, [])

  const update = useCallback((fn: (prev: StickerState) => StickerState) => {
    // 避免把副作用放进 setState updater（React 严格模式下可能被调用两次）
    const next = fn(stateRef.current)
    stateRef.current = next
    writeState(next)
    setState(next)
  }, [])

  const createGroup = useCallback((name: string, coverUrl: string) => {
    const trimmed = name.trim()
    const normalizedCover = coverUrl.trim()
    if (!trimmed) return null
    const dedupeKey = `${trimmed}@@${normalizedCover}`
    const now = Date.now()
    const recent = lastCreateRef.current
    if (recent && recent.key === dedupeKey && now - recent.at < 1500) {
      const existed = stateRef.current.groups.find((g) => g.name === trimmed && g.coverUrl === normalizedCover)
      return existed ?? null
    }
    lastCreateRef.current = { key: dedupeKey, at: now }
    const id = uid('stg')
    const group: StickerGroup = {
      id,
      name: trimmed,
      coverUrl: normalizedCover,
      items: [],
      createdAt: now,
    }
    update((prev) => ({ ...prev, groups: [group, ...prev.groups] }))
    return group
  }, [update])

  const addSticker = useCallback((groupId: string, input: { url: string; description: string }) => {
    if (READONLY_GROUP_IDS.has(groupId)) return null
    const url = input.url.trim()
    const description = input.description.trim()
    if (!url) return null
    const item: StickerItem = {
      id: uid('sti'),
      url,
      description,
      createdAt: Date.now(),
    }
    update((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, items: [item, ...g.items] } : g)),
    }))
    return item
  }, [update])

  const updateStickerDescription = useCallback((groupId: string, itemId: string, description: string) => {
    if (READONLY_GROUP_IDS.has(groupId)) return
    update((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, description: description.trim() } : it)) }
          : g,
      ),
    }))
  }, [update])

  const deleteSticker = useCallback((groupId: string, itemId: string) => {
    if (READONLY_GROUP_IDS.has(groupId)) return
    update((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, items: g.items.filter((x) => x.id !== itemId) } : g)),
    }))
  }, [update])

  const moveSticker = useCallback((fromGroupId: string, toGroupId: string, itemId: string) => {
    if (READONLY_GROUP_IDS.has(fromGroupId) || READONLY_GROUP_IDS.has(toGroupId)) return
    if (fromGroupId === toGroupId) return
    update((prev) => {
      const from = prev.groups.find((g) => g.id === fromGroupId)
      const item = from?.items.find((x) => x.id === itemId)
      if (!item) return prev
      return {
        ...prev,
        groups: prev.groups.map((g) => {
          if (g.id === fromGroupId) return { ...g, items: g.items.filter((x) => x.id !== itemId) }
          if (g.id === toGroupId) return { ...g, items: [item, ...g.items] }
          return g
        }),
      }
    })
  }, [update])

  const reorderItems = useCallback((groupId: string, nextItems: StickerItem[]) => {
    if (READONLY_GROUP_IDS.has(groupId)) return
    update((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, items: nextItems } : g)),
    }))
  }, [update])

  const setGroupCover = useCallback((groupId: string, coverUrl: string) => {
    if (READONLY_GROUP_IDS.has(groupId)) return
    update((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, coverUrl: coverUrl.trim() } : g)),
    }))
  }, [update])

  const deleteGroup = useCallback((groupId: string) => {
    if (READONLY_GROUP_IDS.has(groupId)) return
    update((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
    }))
  }, [update])

  const groups = useMemo(
    () => [...DEFAULT_GROUPS, ...state.groups].filter((g) => g.id !== WECHAT_CLASSIC_GROUP_ID),
    [state.groups],
  )

  return {
    groups,
    createGroup,
    addSticker,
    updateStickerDescription,
    deleteSticker,
    moveSticker,
    reorderItems,
    setGroupCover,
    deleteGroup,
  }
}

