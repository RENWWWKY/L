import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../wechat/newFriendsPersona/idb'
import { createEmptyApiConfig, createEmptyPreset } from './mock'
import { SILICONFLOW_ASR_DEFAULT_BASE_URL } from '../wechat/voiceCall/siliconflowAsr'
import type { ApiConfig, ApiPreset, ApiStore, SubApiType } from './types'

const STORAGE_KEY = 'ai-api-presets-v1'

function normalizeApiConfig(raw: unknown): ApiConfig {
  const r = (raw ?? {}) as Partial<ApiConfig>
  const modelList = Array.isArray(r.modelList) ? r.modelList.filter((x): x is string => typeof x === 'string') : []
  return {
    apiUrl: typeof r.apiUrl === 'string' ? r.apiUrl : '',
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : '',
    modelId: typeof r.modelId === 'string' ? r.modelId : '',
    modelList,
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
    return { presets, currentPresetId }
  } catch {
    return { presets: [], currentPresetId: '' }
  }
}

type Ctx = {
  presets: ApiPreset[]
  currentPresetId: string
  currentPreset: ApiPreset | null
  setCurrentPresetId: (id: string) => void
  createPreset: () => ApiPreset
  upsertPreset: (preset: ApiPreset) => void
  deletePreset: (id: string) => void
  getResolvedConfig: (subType?: SubApiType) => ApiConfig | null
  isSubApiEnabled: (subType: SubApiType) => boolean
}

const ApiSettingsContext = createContext<Ctx | null>(null)

export function ApiSettingsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ApiStore>({ presets: [], currentPresetId: '' })
  const [apiHydrated, setApiHydrated] = useState(false)

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

  useEffect(() => {
    if (!apiHydrated) return
    void (async () => {
      try {
        await personaDb.setPhoneKv(STORAGE_KEY, store)
      } catch (e) {
        console.warn('API 设置写入 IndexedDB 失败:', e)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
      } catch {
        // 配额不足时仍以 IndexedDB 为准
      }
    })()
  }, [store, apiHydrated])

  const presets = store.presets
  const currentPreset = useMemo(
    () => presets.find((p) => p.id === store.currentPresetId) ?? null,
    [presets, store.currentPresetId],
  )

  const setCurrentPresetId = useCallback((id: string) => {
    setStore((s) => ({ ...s, currentPresetId: id }))
  }, [])

  const createPreset = useCallback(() => createEmptyPreset(), [])

  const upsertPreset = useCallback((preset: ApiPreset) => {
    setStore((s) => {
      const exists = s.presets.some((p) => p.id === preset.id)
      const next = exists ? s.presets.map((p) => (p.id === preset.id ? preset : p)) : [preset, ...s.presets]
      const currentPresetId = s.currentPresetId || preset.id
      return { ...s, presets: next, currentPresetId }
    })
  }, [])

  const deletePreset = useCallback((id: string) => {
    setStore((s) => {
      const nextPresets = s.presets.filter((p) => p.id !== id)
      const nextCurrent = s.currentPresetId === id ? nextPresets[0]?.id ?? '' : s.currentPresetId
      return { ...s, presets: nextPresets, currentPresetId: nextCurrent }
    })
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

  const value: Ctx = {
    presets,
    currentPresetId: store.currentPresetId,
    currentPreset,
    setCurrentPresetId,
    createPreset,
    upsertPreset,
    deletePreset,
    getResolvedConfig,
    isSubApiEnabled,
  }

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

