import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
const STICKER_CHANGED_EVENT = 'wechat-sticker-storage-changed'
const DEFAULT_GROUP_ID_1 = 'default-sticker-pack-1'
const DEFAULT_GROUP_ID_2 = 'default-sticker-pack-2'
const READONLY_GROUP_IDS = new Set([DEFAULT_GROUP_ID_1, DEFAULT_GROUP_ID_2])

const defaultPack1Modules = import.meta.glob('../../../../../image/默认表情包1/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const defaultPack2Modules = import.meta.glob('../../../../../image/默认表情包2/*.{png,jpg,jpeg,webp,gif}', {
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
    name: '默认表情包 1',
    coverUrl: buildDefaultItems(defaultPack1Modules, 'df1')[0]?.url ?? '',
    items: buildDefaultItems(defaultPack1Modules, 'df1'),
    createdAt: 0,
    readonly: true,
  },
  {
    id: DEFAULT_GROUP_ID_2,
    name: '默认表情包 2',
    coverUrl: buildDefaultItems(defaultPack2Modules, 'df2')[0]?.url ?? '',
    items: buildDefaultItems(defaultPack2Modules, 'df2'),
    createdAt: 0,
    readonly: true,
  },
].filter((g) => g.items.length > 0)

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

function readState(): StickerState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<StickerState>
    return {
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    }
  } catch {
    return DEFAULT_STATE
  }
}

/** 角色发图 / 校验模型输出 URL：仅允许资源库内地址（含默认包与用户表情包中心） */
export function getKnownStickerUrlSet(): Set<string> {
  const state = readState()
  const s = new Set<string>()
  for (const g of [...DEFAULT_GROUPS, ...state.groups]) {
    for (const it of g.items) {
      const u = it.url.trim()
      if (u) s.add(u)
    }
  }
  return s
}

/**
 * 拼入微信单聊 system，供模型选用合法表情包 URL。
 * 行数与总长封顶，避免撑爆上下文。
 */
export function buildStickerCatalogPromptBlock(maxLines = 96, maxChars = 9500): string {
  const state = readState()
  const lines: string[] = []
  for (const g of [...DEFAULT_GROUPS, ...state.groups]) {
    const tag = g.readonly ? `${g.name}·默认` : g.name
    for (const it of g.items) {
      const desc = (it.description || '未命名').replace(/\s+/g, ' ').trim().slice(0, 40)
      const u = it.url.trim()
      if (!u) continue
      lines.push(`- 「${tag}」${desc} → ${u}`)
      if (lines.length >= maxLines) break
    }
    if (lines.length >= maxLines) break
  }
  if (!lines.length) {
    return `---------------------\n【表情包资源】\n---------------------\n当前库中无可用表情条目。请勿输出 [表情包] 行；用户发图仍按「表情包消息」规则接话即可。\n`
  }
  let body = lines.join('\n')
  if (body.length > maxChars) body = `${body.slice(0, maxChars)}\n…（目录过长已截断，请只用上方已列出的 URL）`
  return `---------------------\n【表情包资源（仅允许使用下列完整 URL）】\n---------------------\n${body}\n`
}

function writeState(next: StickerState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
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
    const onChanged = () => {
      const next = readState()
      stateRef.current = next
      setState(next)
    }
    window.addEventListener(STICKER_CHANGED_EVENT, onChanged)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener(STICKER_CHANGED_EVENT, onChanged)
      window.removeEventListener('storage', onChanged)
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

  const groups = useMemo(() => [...DEFAULT_GROUPS, ...state.groups], [state.groups])

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

