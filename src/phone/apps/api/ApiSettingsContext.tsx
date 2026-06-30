import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../wechat/newFriendsPersona/idb'
import { createEmptyApiConfig, createEmptyPreset, newPresetId } from './mock'
import { migrateLegacyImageGenIntoStore, normalizeImageGenSettings } from './imageGenPresetUtils'
import {
  API_STORE_STORAGE_KEY,
  createEmptyLinkPreviewSettings,
  mergeApiStoreLinkPreview,
  normalizeLinkPreviewSettings,
} from './linkPreviewSettingsUtils'
import { SILICONFLOW_ASR_DEFAULT_BASE_URL } from '../wechat/voiceCall/siliconflowAsr'
import { normalizeModelPricingMap } from './modelPricingUtils'
import type { ApiConfig, ApiPreset, ApiStore, LinkPreviewSettings, SubApiType } from './types'

const STORAGE_KEY = API_STORE_STORAGE_KEY

function maxPresetUpdatedAt(store: ApiStore): number {
  return store.presets.reduce((max, p) => Math.max(max, p.updatedAt ?? 0), 0)
}

async function persistApiStore(data: ApiStore): Promise<void> {
  try {
    await personaDb.setPhoneKv(STORAGE_KEY, data)
  } catch (e) {
    console.warn('API 设置写入 IndexedDB 失败:', e)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 配额不足时仍以 IndexedDB 为准
  }
}

function normalizeApiConfig(raw: unknown): ApiConfig {
  const r = (raw ?? {}) as Partial<ApiConfig>
  const modelList = Array.isArray(r.modelList) ? r.modelList.filter((x): x is string => typeof x === 'string') : []
  return {
    apiUrl: typeof r.apiUrl === 'string' ? r.apiUrl : '',
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : '',
    modelId: typeof r.modelId === 'string' ? r.modelId : '',
    modelList,
    modelPricingById: normalizeModelPricingMap(r.modelPricingById),
    lastTest:
      r.lastTest && typeof r.lastTest === 'object'
        ? {
            ok: !!(r.lastTest as { ok?: unknown }).ok,
            message: String((r.lastTest as { message?: unknown }).message ?? ''),
            at: Number((r.lastTest as { at?: unknown }).at ?? 0),
          }
        : undefined,
  }
}

function normalizePreset(raw: unknown): ApiPreset | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<ApiPreset>
  const base = createEmptyPreset()
  const subRaw = (r.sub ?? {}) as Partial<
    Record<SubApiType, { enabled?: unknown; useMainApi?: unknown; apiConfig?: unknown }>
  >
  const normalizeSub = (k: SubApiType) => {
    const src = subRaw[k]
    const normalizedApi = normalizeApiConfig(src?.apiConfig ?? createEmptyApiConfig())
    return {
      enabled: typeof src?.enabled === 'boolean' ? src.enabled : true,
      useMainApi: k === 'voiceAsr' ? false : typeof src?.useMainApi === 'boolean' ? src.useMainApi : true,
      apiConfig:
        k === 'voiceAsr'
          ? { ...normalizedApi, apiUrl: normalizedApi.apiUrl.trim() || SILICONFLOW_ASR_DEFAULT_BASE_URL }
          : normalizedApi,
    }
  }
  return {
    ...base,
    id: typeof r.id === 'string' && r.id.trim() ? r.id : base.id,
    name: typeof r.name === 'string' ? r.name : '',
    description: typeof r.description === 'string' ? r.description : '',
    main: normalizeApiConfig(r.main),
    sub: {
      xinyu: normalizeSub('xinyu'),
      chatCard: normalizeSub('chatCard'),
      danmaku: normalizeSub('danmaku'),
      voiceAsr: normalizeSub('voiceAsr'),
    },
    imageGen: normalizeImageGenSettings(r.imageGen),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : base.createdAt,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : base.updatedAt,
  }
}

function parseApiStore(raw: unknown): ApiStore {
  try {
    if (!raw || typeof raw !== 'object') throw new Error('bad')
    const parsed = raw as Partial<ApiStore>
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets.map((p) => normalizePreset(p)).filter((p): p is ApiPreset => !!p)
      : []
    const currentPresetId =
      typeof parsed.currentPresetId === 'string' && presets.some((p) => p.id === parsed.currentPresetId)
        ? parsed.currentPresetId
        : presets[0]?.id ?? ''
    return migrateLegacyImageGenIntoStore({
      presets,
      currentPresetId,
      ...mergeApiStoreLinkPreview(parsed),
    })
  } catch {
    return { presets: [], currentPresetId: '', linkPreview: createEmptyLinkPreviewSettings() }
  }
}

type Ctx = {
  presets: ApiPreset[]
  currentPresetId: string
  currentPreset: ApiPreset | null
  linkPreview: LinkPreviewSettings
  /** IndexedDB / localStorage 是否已加载完成 */
  apiHydrated: boolean
  /** 从持久化存储重新拉取（打开 API 设置页时同步最新数据） */
  reloadFromStorage: () => Promise<void>
  /** 立即将当前内存状态写入 IndexedDB / localStorage（保存预设后调用） */
  flushPersist: () => Promise<void>
  setCurrentPresetId: (id: string) => void
  setLinkPreviewSettings: (next: LinkPreviewSettings | ((prev: LinkPreviewSettings) => LinkPreviewSettings)) => void
  createPreset: () => ApiPreset
  upsertPreset: (preset: ApiPreset) => void
  deletePreset: (id: string) => void
  /** 复制预设为新条目（新 id，名称加「（副本）」），返回新预设 id；失败返回 null */
  duplicatePreset: (sourceId: string) => string | null
  getResolvedConfig: (subType?: SubApiType) => ApiConfig | null
  isSubApiEnabled: (subType: SubApiType) => boolean
}

const ApiSettingsContext = createContext<Ctx | null>(null)

export function ApiSettingsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ApiStore>(() => ({
    presets: [],
    currentPresetId: '',
    linkPreview: createEmptyLinkPreviewSettings(),
  }))
  const [apiHydrated, setApiHydrated] = useState(false)
  const storeRef = useRef(store)
  storeRef.current = store

  const flushPersist = useCallback(async () => {
    await persistApiStore(storeRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
        if (cancelled) return
        if (raw != null) {
          flushSync(() => {
            setStore(parseApiStore(raw))
          })
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setApiHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reloadFromStorage = useCallback(async () => {
    try {
      const raw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
      if (raw == null) return
      const loaded = parseApiStore(raw)
      flushSync(() => {
        setStore((current) => {
          if (maxPresetUpdatedAt(current) > maxPresetUpdatedAt(loaded)) return current
          return loaded
        })
      })
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!apiHydrated) return
    void persistApiStore(store)
  }, [store, apiHydrated])

  const presets = store.presets
  const currentPreset = useMemo(
    () => presets.find((p) => p.id === store.currentPresetId) ?? null,
    [presets, store.currentPresetId],
  )

  const setCurrentPresetId = useCallback((id: string) => {
    let nextStore!: ApiStore
    flushSync(() => {
      setStore((s) => {
        nextStore = { ...s, currentPresetId: id }
        return nextStore
      })
    })
    void persistApiStore(nextStore)
  }, [])

  const setLinkPreviewSettings = useCallback(
    (next: LinkPreviewSettings | ((prev: LinkPreviewSettings) => LinkPreviewSettings)) => {
      let nextStore!: ApiStore
      flushSync(() => {
        setStore((s) => {
          nextStore = {
            ...s,
            linkPreview:
              typeof next === 'function'
                ? next(normalizeLinkPreviewSettings(s.linkPreview))
                : normalizeLinkPreviewSettings(next),
          }
          return nextStore
        })
      })
      void persistApiStore(nextStore)
    },
    [],
  )

  const createPreset = useCallback(() => createEmptyPreset(), [])

  const upsertPreset = useCallback(
    (preset: ApiPreset) => {
      let nextStore!: ApiStore
      flushSync(() => {
        setStore((s) => {
          const exists = s.presets.some((p) => p.id === preset.id)
          const next = exists ? s.presets.map((p) => (p.id === preset.id ? preset : p)) : [preset, ...s.presets]
          const currentPresetId = s.currentPresetId || preset.id
          nextStore = { ...s, presets: next, currentPresetId }
          return nextStore
        })
      })
      void persistApiStore(nextStore)
    },
    [],
  )

  const deletePreset = useCallback((id: string) => {
    let nextStore!: ApiStore
    flushSync(() => {
      setStore((s) => {
        const nextPresets = s.presets.filter((p) => p.id !== id)
        const nextCurrent = s.currentPresetId === id ? nextPresets[0]?.id ?? '' : s.currentPresetId
        nextStore = { ...s, presets: nextPresets, currentPresetId: nextCurrent }
        return nextStore
      })
    })
    void persistApiStore(nextStore)
  }, [])

  const duplicatePreset = useCallback((sourceId: string): string | null => {
    let outId: string | null = null
    let nextStore: ApiStore | null = null
    flushSync(() => {
      setStore((s) => {
        const src = s.presets.find((p) => p.id === sourceId)
        if (!src) return s
        const now = Date.now()
        const clone = JSON.parse(JSON.stringify(src)) as ApiPreset
        clone.id = newPresetId()
        const baseName = src.name.trim() || '未命名预设'
        clone.name = `${baseName}（副本）`
        clone.createdAt = now
        clone.updatedAt = now
        outId = clone.id
        nextStore = { ...s, presets: [clone, ...s.presets], currentPresetId: clone.id }
        return nextStore
      })
    })
    if (nextStore) void persistApiStore(nextStore)
    return outId
  }, [])

  const getResolvedConfig = useCallback(
    (subType?: SubApiType): ApiConfig | null => {
      const preset = currentPreset
      if (!preset) return null
      if (!subType) return preset.main
      const sub = preset.sub[subType]
      if (!sub) return preset.main
      if (!sub.enabled) return null
      if (subType === 'voiceAsr') return sub.apiConfig
      if (sub.useMainApi) return preset.main
      return sub.apiConfig.apiUrl || sub.apiConfig.apiKey || sub.apiConfig.modelId ? sub.apiConfig : preset.main
    },
    [currentPreset],
  )

  const isSubApiEnabled = useCallback(
    (subType: SubApiType): boolean => {
      const preset = currentPreset
      if (!preset) return false
      const sub = preset.sub[subType]
      return !!sub?.enabled
    },
    [currentPreset],
  )

  const value = useMemo(
    (): Ctx => ({
      presets,
      currentPresetId: store.currentPresetId,
      currentPreset,
      linkPreview: normalizeLinkPreviewSettings(store.linkPreview),
      apiHydrated,
      reloadFromStorage,
      flushPersist,
      setCurrentPresetId,
      setLinkPreviewSettings,
      createPreset,
      upsertPreset,
      deletePreset,
      duplicatePreset,
      getResolvedConfig,
      isSubApiEnabled,
    }),
    [
      presets,
      store.currentPresetId,
      currentPreset,
      store.linkPreview,
      apiHydrated,
      reloadFromStorage,
      flushPersist,
      setCurrentPresetId,
      setLinkPreviewSettings,
      createPreset,
      upsertPreset,
      deletePreset,
      duplicatePreset,
      getResolvedConfig,
      isSubApiEnabled,
    ],
  )

  return <ApiSettingsContext.Provider value={value}>{children}</ApiSettingsContext.Provider>
}

export function useApiSettings() {
  const ctx = useContext(ApiSettingsContext)
  if (!ctx) throw new Error('useApiSettings must be used within ApiSettingsProvider')
  return ctx
}

/** 全局调用 Hook：后续生成统一从这里取配置 */
export function useCurrentApiConfig(subType?: SubApiType) {
  const { getResolvedConfig } = useApiSettings()
  return getResolvedConfig(subType)
}

export function useIsSubApiEnabled(subType: SubApiType) {
  const { isSubApiEnabled } = useApiSettings()
  return isSubApiEnabled(subType)
}

