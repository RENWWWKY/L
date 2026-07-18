import { listenPlainNumStyle } from '../../../../components/discoverListen/listenTogetherTypography'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchEmbeddingModels, fetchModels } from '../../api/apiSim'
import type { ApiConfig } from '../../api/types'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import { DEFAULT_MEMORY_EMBEDDING_MODEL } from './memoryEmbeddingApi'
import {
  downloadLocalEmbeddingModelManual,
  getLocalEmbeddingDownloadRecord,
  type LocalEmbeddingDownloadProgress,
} from './localEmbeddingClient'
import {
  formatLocalEmbeddingDownloadError,
  probeLocalEmbeddingDownloadChannel,
} from './localEmbeddingRemoteHost'
import { DEFAULT_LOCAL_EMBEDDING_MODEL, normalizeLocalEmbeddingModelId } from './memoryEmbeddingConstants'
import {
  testMemoryEmbeddingConnectionUnified,
  type MemoryEmbeddingProviderMode,
} from './memoryEmbeddingProvider'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import {
  ARCHIVE_SOURCE_OFFLINE_LABEL,
  ARCHIVE_SOURCE_ONLINE_LABEL,
  ARCHIVE_SOURCE_SECTION_OFFLINE,
  ARCHIVE_SOURCE_SECTION_ONLINE,
} from './memoryArchiveSourceLabels'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import {
  MEMORY_ENGINE_COACH_SEEN_KEY,
  MEMORY_HUB_COACH_SEEN_KEY,
  readMemoryCoachSeen,
  writeMemoryCoachSeen,
} from './memoryCoachTypes'
import {
  MEMORY_ENGINE_COACH_STEPS,
  MEMORY_ENGINE_OPEN_TUTORIAL_EVENT,
  MEMORY_ENGINE_START_COACH_EVENT,
  memoryEngineCoachTargetSubTab,
} from './memoryEngineCoachSteps'
import { MEMORY_ENGINE_TUTORIAL_SECTIONS } from './memoryEngineTutorialCopy'
import { MemoryEngineSoftSwitch } from './MemoryEngineSoftSwitch'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import type { ConnectionStatus, SummaryAPIConfig, VectorAPIConfig } from './memoryEngineConfigTypes'
import { summaryConfigFromDraft } from './memoryEngineConfigTypes'
import { MemoryApiModeCapsule, type MemoryApiMode } from './MemoryApiModeCapsule'
import { MemorySummaryApiConfig } from './MemorySummaryApiConfig'
import { testMemorySummaryConnection } from './memorySummaryApi'
import { resolveSummaryPullSource } from './memorySummaryPullSource'
import { testMemoryTimelineSummaryConnection } from './memoryTimelineSummaryApi'
import { resolveTimelineSummaryPullSource } from './memoryTimelineSummaryPullSource'
import { MemoryVectorRecallConfig } from './MemoryVectorRecallConfig'
import { resolveEmbeddingPullSource } from './vectorEmbeddingPullSource'
import type { AutoSummaryIntervalScope } from './memoryAutoSummaryInterval'
import {
  loadAutoSummaryIntervalCharacterCandidates,
  normalizeAutoSummaryInterval,
} from './memoryAutoSummaryInterval'
import { MemoryIntervalScopeCapsule } from './MemoryIntervalScopeCapsule'
import {
  buildMemoryPerCharacterIntervalRows,
  MemoryPerCharacterIntervalList,
} from './MemoryPerCharacterIntervalList'
import type { Character } from '../newFriendsPersona/types'

function ConfigSourceIntro({
  chipClass,
  label,
  title,
  body,
  bullets,
}: {
  chipClass: string
  label: string
  title: string
  body: string
  bullets?: string[]
}) {
  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={chipClass}>{label}</span>
        <p className="text-[13px] font-semibold text-gray-900">{title}</p>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-gray-600">{body}</p>
      {bullets?.length ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-gray-500">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function EngineCard({
  title,
  children,
  headerAction,
}: {
  title?: string
  children: ReactNode
  headerAction?: ReactNode
}) {
  return (
    <div className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
      {title ? (
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-[16px] font-semibold tracking-tight text-gray-900">{title}</h3>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      ) : null}
      <div className={title ? 'mt-4 space-y-4' : 'space-y-4'}>{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  hint,
  control,
  labelExtra,
}: {
  label: string
  hint?: string
  control: ReactNode
  /** 标题右侧（如 ? 说明按钮） */
  labelExtra?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[14px] font-medium text-gray-900">{label}</p>
          {labelExtra}
        </div>
        {hint ? <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{hint}</p> : null}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}


type MemoryConfigSubTab = 'summary' | 'summary-model' | 'timeline-model' | 'vector'

const MEMORY_CONFIG_SUB_TABS: ReadonlyArray<{ id: MemoryConfigSubTab; label: string }> = [
  { id: 'summary', label: '自动总结' },
  { id: 'summary-model', label: '线上总结' },
  { id: 'timeline-model', label: '线下摘要' },
  { id: 'vector', label: '向量召回' },
]

function ConfigSubTabNav({
  value,
  onChange,
}: {
  value: MemoryConfigSubTab
  onChange: (tab: MemoryConfigSubTab) => void
}) {
  return (
    <nav
      className="grid w-full grid-cols-4 gap-1 rounded-full bg-gray-100/80 p-1"
      aria-label="记忆配置分类"
      role="tablist"
    >
      {MEMORY_CONFIG_SUB_TABS.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative min-w-0 rounded-full px-2 py-2 text-center text-[12px] transition-colors ${
              active ? 'font-semibold text-gray-900' : 'font-normal text-gray-500'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="memory-config-subtab-slider"
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function MemoryEngineConfig({
  loading,
  currentWechatAccountId,
  coachActive = true,
}: {
  loading?: boolean
  currentWechatAccountId?: string
  /** 仅当前 Tab 可见时允许自动/展示高亮引导，避免与记忆管理引导叠层 */
  coachActive?: boolean
}) {
  const chatApiConfig = useCurrentApiConfig('chatCard')

  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [intervalDraft, setIntervalDraft] = useState('10')
  const [intervalScope, setIntervalScope] = useState<AutoSummaryIntervalScope>('global')
  const [characterRows, setCharacterRows] = useState<Character[]>([])
  const [perCharIntervalDrafts, setPerCharIntervalDrafts] = useState<Record<string, string>>({})
  const [summaryDedicatedApiEnabled, setSummaryDedicatedApiEnabled] = useState(false)
  const [summaryConfig, setSummaryConfig] = useState<SummaryAPIConfig>({ endpoint: '', apiKey: '' })
  const [hasSavedSummaryKey, setHasSavedSummaryKey] = useState(false)
  const [summaryConnectionStatus, setSummaryConnectionStatus] = useState<ConnectionStatus>('idle')
  const [summaryModelDraft, setSummaryModelDraft] = useState('')
  const [summaryModelList, setSummaryModelList] = useState<string[]>([])
  const [summaryModelDropdownOpen, setSummaryModelDropdownOpen] = useState(false)
  const [summaryModelsLoading, setSummaryModelsLoading] = useState(false)
  const [summaryModelsPullMsg, setSummaryModelsPullMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [timelineDedicatedApiEnabled, setTimelineDedicatedApiEnabled] = useState(false)
  const [timelineConfig, setTimelineConfig] = useState<SummaryAPIConfig>({ endpoint: '', apiKey: '' })
  const [hasSavedTimelineKey, setHasSavedTimelineKey] = useState(false)
  const [timelineConnectionStatus, setTimelineConnectionStatus] = useState<ConnectionStatus>('idle')
  const [timelineModelDraft, setTimelineModelDraft] = useState('')
  const [timelineModelList, setTimelineModelList] = useState<string[]>([])
  const [timelineModelDropdownOpen, setTimelineModelDropdownOpen] = useState(false)
  const [timelineModelsLoading, setTimelineModelsLoading] = useState(false)
  const [timelineModelsPullMsg, setTimelineModelsPullMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [vectorRecallEnabled, setVectorRecallEnabled] = useState(true)
  const [embeddingProviderMode, setEmbeddingProviderMode] = useState<MemoryEmbeddingProviderMode>('auto')
  const [localEmbeddingModelId, setLocalEmbeddingModelId] = useState(DEFAULT_LOCAL_EMBEDDING_MODEL)
  const [localModelDownloaded, setLocalModelDownloaded] = useState(false)
  const [localModelDownloading, setLocalModelDownloading] = useState(false)
  const [localModelDownloadProgress, setLocalModelDownloadProgress] =
    useState<LocalEmbeddingDownloadProgress | null>(null)
  const [localModelDownloadError, setLocalModelDownloadError] = useState<string | null>(null)
  const [vectorDedicatedApiEnabled, setVectorDedicatedApiEnabled] = useState(false)
  const [vectorConfig, setVectorConfig] = useState<VectorAPIConfig>({
    endpoint: '',
    apiKey: '',
    collection: '',
  })
  const [hasSavedEmbeddingKey, setHasSavedEmbeddingKey] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [embeddingModelDraft, setEmbeddingModelDraft] = useState('')
  const [embeddingModelList, setEmbeddingModelList] = useState<string[]>([])
  const [embeddingModelDropdownOpen, setEmbeddingModelDropdownOpen] = useState(false)
  const [embeddingModelsLoading, setEmbeddingModelsLoading] = useState(false)
  const [modelsPullMsg, setModelsPullMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savedSettings, setSavedSettings] = useState<Awaited<ReturnType<typeof personaDb.getMemorySettings>> | null>(
    null,
  )
  const [configHydrated, setConfigHydrated] = useState(false)
  const [configLoadError, setConfigLoadError] = useState<string | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [configSubTab, setConfigSubTab] = useState<MemoryConfigSubTab>('summary')

  const reload = useCallback(async () => {
    setConfigLoadError(null)
    try {
      const settings = await personaDb.getMemorySettings()
      const savedModel = settings.memoryEmbeddingModelId?.trim() || ''
      setAutoSummaryEnabled(settings.autoSummaryEnabled !== false)
      setIntervalDraft(String(settings.autoSummaryInterval))
      setIntervalScope(settings.autoSummaryIntervalScope === 'per_character' ? 'per_character' : 'global')
      setSummaryDedicatedApiEnabled(settings.memorySummaryUseDedicatedApi === true)
      setSummaryConfig({
        endpoint: settings.memorySummaryApiUrl?.trim() || '',
        apiKey: '',
      })
      setHasSavedSummaryKey(Boolean(settings.memorySummaryApiKey?.trim()))
      const savedSummaryModel = settings.memorySummaryModelId?.trim() || ''
      setSummaryModelDraft(savedSummaryModel)
      setSummaryModelList((prev) => {
        if (!savedSummaryModel) return prev
        if (prev.includes(savedSummaryModel)) return prev
        return [savedSummaryModel, ...prev]
      })
      setSummaryConnectionStatus('idle')
      const savedTimelineModel = settings.memoryTimelineSummaryModelId?.trim() || ''
      setTimelineDedicatedApiEnabled(settings.memoryTimelineSummaryUseDedicatedApi === true)
      setTimelineConfig({
        endpoint: settings.memoryTimelineSummaryApiUrl?.trim() || '',
        apiKey: '',
      })
      setHasSavedTimelineKey(Boolean(settings.memoryTimelineSummaryApiKey?.trim()))
      setTimelineModelDraft(savedTimelineModel)
      setTimelineModelList((prev) => {
        if (!savedTimelineModel) return prev
        if (prev.includes(savedTimelineModel)) return prev
        return [savedTimelineModel, ...prev]
      })
      setTimelineConnectionStatus('idle')
      setVectorRecallEnabled(settings.memoryVectorRecallEnabled !== false)
      setEmbeddingProviderMode(
        settings.memoryEmbeddingProviderMode === 'api' ||
          settings.memoryEmbeddingProviderMode === 'local' ||
          settings.memoryEmbeddingProviderMode === 'auto'
          ? settings.memoryEmbeddingProviderMode
          : 'auto',
      )
      setLocalEmbeddingModelId(
        normalizeLocalEmbeddingModelId(settings.memoryLocalEmbeddingModelId),
      )
      setVectorDedicatedApiEnabled(settings.memoryEmbeddingUseDedicatedApi === true)
      setVectorConfig({
        endpoint: settings.memoryEmbeddingApiUrl?.trim() || '',
        apiKey: '',
        collection: settings.memoryVectorCollection?.trim() || '',
      })
      setHasSavedEmbeddingKey(Boolean(settings.memoryEmbeddingApiKey?.trim()))
      setEmbeddingModelDraft(savedModel)
      setEmbeddingModelList((prev) => {
        if (!savedModel) return prev
        if (prev.includes(savedModel)) return prev
        return [savedModel, ...prev]
      })
      setSavedSettings(settings)
      setConnectionStatus('idle')

      try {
        const chars = await loadAutoSummaryIntervalCharacterCandidates(currentWechatAccountId)
        setCharacterRows(chars)
        setPerCharIntervalDrafts({})
      } catch (charErr) {
        console.warn('[memory-engine-config] load character interval candidates failed', charErr)
        setCharacterRows([])
        setPerCharIntervalDrafts({})
      }
    } catch (e) {
      console.warn('[memory-engine-config] reload failed', e)
      setConfigLoadError(
        e instanceof Error
          ? e.message
          : '读取本地记忆配置失败。请刷新页面；若刚导入备份，请先在数据中心尝试「自动恢复」。',
      )
    } finally {
      setConfigHydrated(true)
    }
  }, [currentWechatAccountId])

  const embeddingPullSource = useMemo(
    () =>
      resolveEmbeddingPullSource({
        draft: vectorConfig,
        saved: savedSettings ?? { memoryEmbeddingApiUrl: undefined, memoryEmbeddingApiKey: undefined },
        hasSavedDedicatedKey: hasSavedEmbeddingKey,
        useDedicatedApi: vectorDedicatedApiEnabled,
        chatApi: chatApiConfig,
      }),
    [vectorConfig, savedSettings, hasSavedEmbeddingKey, vectorDedicatedApiEnabled, chatApiConfig],
  )

  const summaryPullSource = useMemo(
    () =>
      resolveSummaryPullSource({
        draft: summaryConfig,
        saved: savedSettings ?? { memorySummaryApiUrl: undefined, memorySummaryApiKey: undefined },
        hasSavedDedicatedKey: hasSavedSummaryKey,
        useDedicatedApi: summaryDedicatedApiEnabled,
        chatApi: chatApiConfig,
      }),
    [summaryConfig, savedSettings, hasSavedSummaryKey, summaryDedicatedApiEnabled, chatApiConfig],
  )

  const timelinePullSource = useMemo(
    () =>
      resolveTimelineSummaryPullSource({
        draft: timelineConfig,
        saved: savedSettings ?? {
          memoryTimelineSummaryApiUrl: undefined,
          memoryTimelineSummaryApiKey: undefined,
        },
        hasSavedDedicatedKey: hasSavedTimelineKey,
        useDedicatedApi: timelineDedicatedApiEnabled,
        chatApi: chatApiConfig,
      }),
    [timelineConfig, savedSettings, hasSavedTimelineKey, timelineDedicatedApiEnabled, chatApiConfig],
  )

  useEffect(() => {
    let alive = true
    const watchdog = window.setTimeout(() => {
      if (!alive) return
      setConfigLoadError(
        (prev) =>
          prev ??
          '读取本地记忆配置超时。请完全刷新页面；若刚导入备份，请先在数据中心执行「尝试自动恢复」。',
      )
      setConfigHydrated(true)
    }, 12000)
    void reload().finally(() => {
      if (alive) window.clearTimeout(watchdog)
    })
    return () => {
      alive = false
      window.clearTimeout(watchdog)
    }
  }, [reload])

  useEffect(() => {
    const onEvt = () => void reload()
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])

  useEffect(() => {
    if (!embeddingModelList.length) setEmbeddingModelDropdownOpen(false)
  }, [embeddingModelList.length])

  useEffect(() => {
    if (!summaryModelList.length) setSummaryModelDropdownOpen(false)
  }, [summaryModelList.length])

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback((opts?: { openTutorial?: boolean }) => {
    writeMemoryCoachSeen(MEMORY_ENGINE_COACH_SEEN_KEY)
    setCoachOpen(false)
    setCoachStepIndex(0)
    if (opts?.openTutorial) setTutorialOpen(true)
  }, [])

  useEffect(() => {
    if (!coachActive) {
      setCoachOpen(false)
      setCoachStepIndex(0)
      return
    }
    if (loading) return
    if (!readMemoryCoachSeen(MEMORY_HUB_COACH_SEEN_KEY)) return
    if (readMemoryCoachSeen(MEMORY_ENGINE_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 640)
    return () => window.clearTimeout(id)
  }, [loading, startLiveCoach, coachActive])

  useEffect(() => {
    const onStart = () => startLiveCoach()
    const onOpenTutorial = () => setTutorialOpen(true)
    window.addEventListener(MEMORY_ENGINE_START_COACH_EVENT, onStart)
    window.addEventListener(MEMORY_ENGINE_OPEN_TUTORIAL_EVENT, onOpenTutorial)
    return () => {
      window.removeEventListener(MEMORY_ENGINE_START_COACH_EVENT, onStart)
      window.removeEventListener(MEMORY_ENGINE_OPEN_TUTORIAL_EVENT, onOpenTutorial)
    }
  }, [startLiveCoach])

  useEffect(() => {
    if (!coachOpen) return
    const step = MEMORY_ENGINE_COACH_STEPS[coachStepIndex]
    const tab = memoryEngineCoachTargetSubTab(step?.target ?? null)
    if (tab) setConfigSubTab(tab)
  }, [coachOpen, coachStepIndex])

  useEffect(() => {
    if (!configHydrated) return
    let cancelled = false
    void (async () => {
      const model = localEmbeddingModelId
      const record = await getLocalEmbeddingDownloadRecord(model)
      if (!cancelled) {
        setLocalModelDownloaded(!!record)
        setLocalModelDownloadError(null)
        setLocalModelDownloadProgress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [configHydrated, localEmbeddingModelId])

  const runLocalModelDownload = useCallback(
    async (force = false) => {
      const model = localEmbeddingModelId
      setLocalModelDownloading(true)
      setLocalModelDownloadProgress(null)
      setLocalModelDownloadError(null)
      try {
        await probeLocalEmbeddingDownloadChannel(model)
        await downloadLocalEmbeddingModelManual(
          model,
          (p) => {
            setLocalModelDownloadProgress(p)
          },
          { force },
        )
        setLocalModelDownloaded(true)
        setLocalModelDownloadProgress(null)
      } catch (e) {
        setLocalModelDownloadError(formatLocalEmbeddingDownloadError(e instanceof Error ? e.message : String(e)))
        if (force) setLocalModelDownloaded(false)
      } finally {
        setLocalModelDownloading(false)
      }
    },
    [localEmbeddingModelId],
  )

  const setLocalEmbeddingModelPersist = async (modelId: string) => {
    const normalized = normalizeLocalEmbeddingModelId(modelId)
    setLocalEmbeddingModelId(normalized)
    setLocalModelDownloadError(null)
    setLocalModelDownloadProgress(null)
    await personaDb.putMemorySettings({ memoryLocalEmbeddingModelId: normalized })
    setSavedSettings(await personaDb.getMemorySettings())
    const record = await getLocalEmbeddingDownloadRecord(normalized)
    setLocalModelDownloaded(!!record)
  }

  const patchSummary = (patch: Partial<SummaryAPIConfig>) => {
    setSummaryConfig((prev) => ({ ...prev, ...patch }))
    setSummaryConnectionStatus('idle')
  }

  const commitSummaryFields = async () => {
    if (!summaryDedicatedApiEnabled) return
    const v = summaryConfigFromDraft(summaryConfig)
    const keyTyped = v.apiKey
    await personaDb.putMemorySettings({
      memorySummaryApiUrl: v.endpoint ? v.endpoint.slice(0, 512) : undefined,
      ...(keyTyped ? { memorySummaryApiKey: keyTyped.slice(0, 2048) } : {}),
    })
    if (keyTyped) {
      setSummaryConfig((prev) => ({ ...prev, apiKey: '' }))
      setHasSavedSummaryKey(true)
    }
    const fresh = await personaDb.getMemorySettings()
    setSavedSettings(fresh)
  }

  const patchTimeline = (patch: Partial<SummaryAPIConfig>) => {
    setTimelineConfig((prev) => ({ ...prev, ...patch }))
    setTimelineConnectionStatus('idle')
  }

  const commitTimelineFields = async () => {
    if (!timelineDedicatedApiEnabled) return
    const v = summaryConfigFromDraft(timelineConfig)
    const keyTyped = v.apiKey
    await personaDb.putMemorySettings({
      memoryTimelineSummaryApiUrl: v.endpoint ? v.endpoint.slice(0, 512) : undefined,
      ...(keyTyped ? { memoryTimelineSummaryApiKey: keyTyped.slice(0, 2048) } : {}),
    })
    if (keyTyped) {
      setTimelineConfig((prev) => ({ ...prev, apiKey: '' }))
      setHasSavedTimelineKey(true)
    }
    const fresh = await personaDb.getMemorySettings()
    setSavedSettings(fresh)
  }

  const patchVector = (patch: Partial<VectorAPIConfig>) => {
    setVectorConfig((prev) => ({ ...prev, ...patch }))
    setConnectionStatus('idle')
  }

  const commitInterval = async (raw: string | number) => {
    const n = normalizeAutoSummaryInterval(typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10))
    setIntervalDraft(String(n))
    await personaDb.putMemorySettings({ autoSummaryInterval: n })
  }

  const commitIntervalScope = async (scope: AutoSummaryIntervalScope) => {
    setIntervalScope(scope)
    await personaDb.putMemorySettings({ autoSummaryIntervalScope: scope })
    const fresh = await personaDb.getMemorySettings()
    setSavedSettings(fresh)
  }

  const perCharacterIntervalRows = useMemo(
    () =>
      buildMemoryPerCharacterIntervalRows(
        characterRows,
        savedSettings?.autoSummaryIntervalByCharacterId ?? {},
        normalizeAutoSummaryInterval(parseInt(intervalDraft, 10) || savedSettings?.autoSummaryInterval || 10),
        perCharIntervalDrafts,
      ),
    [characterRows, savedSettings, intervalDraft, perCharIntervalDrafts],
  )

  const commitCharacterInterval = async (charId: string, raw: string) => {
    const globalFallback = normalizeAutoSummaryInterval(
      parseInt(intervalDraft, 10) || savedSettings?.autoSummaryInterval || 10,
    )
    const n = normalizeAutoSummaryInterval(parseInt(String(raw).trim(), 10), globalFallback)
    setPerCharIntervalDrafts((prev) => ({ ...prev, [charId]: String(n) }))
    const prevMap = savedSettings?.autoSummaryIntervalByCharacterId ?? {}
    const nextMap = { ...prevMap, [charId]: n }
    await personaDb.putMemorySettings({ autoSummaryIntervalByCharacterId: nextMap })
    const fresh = await personaDb.getMemorySettings()
    setSavedSettings(fresh)
  }

  const toggleAutoSummary = async () => {
    const next = !autoSummaryEnabled
    setAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ autoSummaryEnabled: next })
  }

  const setSummaryApiMode = async (mode: MemoryApiMode) => {
    const next = mode === 'dedicated'
    if (next === summaryDedicatedApiEnabled) return
    setSummaryDedicatedApiEnabled(next)
    setSummaryModelDropdownOpen(false)
    setSummaryConnectionStatus('idle')
    await personaDb.putMemorySettings({ memorySummaryUseDedicatedApi: next })
  }

  const setTimelineApiMode = async (mode: MemoryApiMode) => {
    const next = mode === 'dedicated'
    if (next === timelineDedicatedApiEnabled) return
    setTimelineDedicatedApiEnabled(next)
    setTimelineModelDropdownOpen(false)
    setTimelineConnectionStatus('idle')
    await personaDb.putMemorySettings({ memoryTimelineSummaryUseDedicatedApi: next })
  }

  const toggleVectorRecall = async () => {
    const next = !vectorRecallEnabled
    setVectorRecallEnabled(next)
    setEmbeddingModelDropdownOpen(false)
    await personaDb.putMemorySettings({ memoryVectorRecallEnabled: next })
  }

  const setVectorApiMode = async (mode: MemoryApiMode) => {
    const next = mode === 'dedicated'
    if (next === vectorDedicatedApiEnabled) return
    setVectorDedicatedApiEnabled(next)
    setEmbeddingModelDropdownOpen(false)
    setConnectionStatus('idle')
    await personaDb.putMemorySettings({ memoryEmbeddingUseDedicatedApi: next })
  }

  const commitVectorFields = async () => {
    if (!vectorDedicatedApiEnabled) return
    const url = vectorConfig.endpoint.trim()
    const coll = vectorConfig.collection.trim()
    const keyTyped = vectorConfig.apiKey.trim()
    await personaDb.putMemorySettings({
      memoryEmbeddingApiUrl: url ? url.slice(0, 512) : undefined,
      memoryVectorCollection: coll ? coll.slice(0, 128) : undefined,
      ...(keyTyped ? { memoryEmbeddingApiKey: keyTyped.slice(0, 2048) } : {}),
    })
    if (keyTyped) {
      setVectorConfig((v) => ({ ...v, apiKey: '' }))
      setHasSavedEmbeddingKey(true)
    }
    const fresh = await personaDb.getMemorySettings()
    setSavedSettings(fresh)
  }

  const pullEmbeddingModels = async () => {
    setModelsPullMsg(null)
    setEmbeddingModelsLoading(true)
    try {
      const s = savedSettings ?? (await personaDb.getMemorySettings())
      const source = resolveEmbeddingPullSource({
        draft: vectorConfig,
        saved: s,
        hasSavedDedicatedKey: hasSavedEmbeddingKey,
        useDedicatedApi: vectorDedicatedApiEnabled,
        chatApi: chatApiConfig,
      })
      if (!source?.apiUrl || !source.apiKey) {
        setModelsPullMsg({
          ok: false,
          text: vectorDedicatedApiEnabled
            ? '还缺地址或密钥：请在下面填好向量专用接口。'
            : '还缺地址或密钥：请先在全局里配好聊天 API。',
        })
        return
      }
      const cfg: ApiConfig = {
        apiUrl: source.apiUrl,
        apiKey: source.apiKey,
        modelId: '',
        modelList: [],
      }
      const res = await fetchEmbeddingModels(cfg)
      if (!res.ok) {
        setModelsPullMsg({ ok: false, text: res.error })
        return
      }
      const picked = res.models
      setEmbeddingModelList(picked)
      const savedModel = (await personaDb.getMemorySettings()).memoryEmbeddingModelId?.trim() || ''
      const draft = embeddingModelDraft.trim()
      const preferred = draft || savedModel
      let nextId = preferred && picked.includes(preferred) ? preferred : ''
      if (!nextId && picked.includes(DEFAULT_MEMORY_EMBEDDING_MODEL)) nextId = DEFAULT_MEMORY_EMBEDDING_MODEL
      if (!nextId && picked.length) nextId = picked[0] || ''
      if (nextId) {
        setEmbeddingModelDraft(nextId)
        await personaDb.putMemorySettings({ memoryEmbeddingModelId: nextId })
      }
      const via =
        source.kind === 'dedicated' ? '你填的向量专用接口' : '当前聊天主接口'
      setModelsPullMsg({
        ok: true,
        text: picked.length
          ? `已从${via}筛出 ${picked.length} 个 embedding 模型（不含聊天模型）`
          : `接口有响应，但未筛到 embedding 模型；请换专用向量接口，或确认网关 /models 是否标注 embedding`,
      })
    } finally {
      setEmbeddingModelsLoading(false)
    }
  }

  const pullSummaryModels = async () => {
    setSummaryModelsPullMsg(null)
    setSummaryModelsLoading(true)
    try {
      const s = savedSettings ?? (await personaDb.getMemorySettings())
      const source = resolveSummaryPullSource({
        draft: summaryConfig,
        saved: s,
        hasSavedDedicatedKey: hasSavedSummaryKey,
        useDedicatedApi: summaryDedicatedApiEnabled,
        chatApi: chatApiConfig,
      })
      if (!source?.apiUrl || !source.apiKey) {
        setSummaryModelsPullMsg({
          ok: false,
          text: summaryDedicatedApiEnabled
            ? '还缺地址或密钥：请在下面填好线上总结专用接口。'
            : '还缺地址或密钥：请先在全局里配好聊天 API。',
        })
        return
      }
      const cfg: ApiConfig = {
        apiUrl: source.apiUrl,
        apiKey: source.apiKey,
        modelId: '',
        modelList: [],
      }
      const res = await fetchModels(cfg)
      if (!res.ok) {
        setSummaryModelsPullMsg({ ok: false, text: res.error })
        return
      }
      const picked = Array.from(new Set(res.models)).sort((a, b) => a.localeCompare(b))
      setSummaryModelList(picked)
      const savedModel = (await personaDb.getMemorySettings()).memorySummaryModelId?.trim() || ''
      const draft = summaryModelDraft.trim()
      const chatDefault = chatApiConfig?.modelId?.trim() || ''
      const preferred = draft || savedModel
      let nextId = preferred && picked.includes(preferred) ? preferred : ''
      if (!nextId && summaryDedicatedApiEnabled && picked.length) nextId = picked[0] || ''
      if (nextId) {
        setSummaryModelDraft(nextId)
        await personaDb.putMemorySettings({ memorySummaryModelId: nextId })
      } else if (!summaryDedicatedApiEnabled && !draft) {
        await personaDb.putMemorySettings({ memorySummaryModelId: undefined })
      }
      const via = source.kind === 'dedicated' ? '线上总结专用接口' : '聊天主接口'
      setSummaryModelsPullMsg({
        ok: true,
        text: picked.length
          ? `已从${via}拉到 ${picked.length} 个可用模型`
          : `接口有响应，但未返回模型列表`,
      })
      if (!summaryDedicatedApiEnabled && !draft && chatDefault) {
        setSummaryModelsPullMsg({
          ok: true,
          text: `已拉取 ${picked.length} 个模型；未单独指定时将跟随聊天主模型（${chatDefault}）`,
        })
      }
    } finally {
      setSummaryModelsLoading(false)
    }
  }

  const pullTimelineModels = async () => {
    setTimelineModelsPullMsg(null)
    setTimelineModelsLoading(true)
    try {
      const s = savedSettings ?? (await personaDb.getMemorySettings())
      const source = resolveTimelineSummaryPullSource({
        draft: timelineConfig,
        saved: s,
        hasSavedDedicatedKey: hasSavedTimelineKey,
        useDedicatedApi: timelineDedicatedApiEnabled,
        chatApi: chatApiConfig,
      })
      if (!source?.apiUrl || !source.apiKey) {
        setTimelineModelsPullMsg({
          ok: false,
          text: timelineDedicatedApiEnabled
            ? '还缺地址或密钥：请在下面填好线下摘要专用接口。'
            : '还缺地址或密钥：请先在全局里配好聊天 API。',
        })
        return
      }
      const cfg: ApiConfig = {
        apiUrl: source.apiUrl,
        apiKey: source.apiKey,
        modelId: '',
        modelList: [],
      }
      const res = await fetchModels(cfg)
      if (!res.ok) {
        setTimelineModelsPullMsg({ ok: false, text: res.error })
        return
      }
      const picked = Array.from(new Set(res.models)).sort((a, b) => a.localeCompare(b))
      setTimelineModelList(picked)
      const savedModel = (await personaDb.getMemorySettings()).memoryTimelineSummaryModelId?.trim() || ''
      const draft = timelineModelDraft.trim()
      const chatDefault = chatApiConfig?.modelId?.trim() || ''
      const preferred = draft || savedModel
      let nextId = preferred && picked.includes(preferred) ? preferred : ''
      if (!nextId && timelineDedicatedApiEnabled && picked.length) nextId = picked[0] || ''
      if (nextId) {
        setTimelineModelDraft(nextId)
        await personaDb.putMemorySettings({ memoryTimelineSummaryModelId: nextId })
      } else if (!timelineDedicatedApiEnabled && !draft) {
        await personaDb.putMemorySettings({ memoryTimelineSummaryModelId: undefined })
      }
      const via = source.kind === 'dedicated' ? '线下摘要专用接口' : '聊天主接口'
      setTimelineModelsPullMsg({
        ok: true,
        text: picked.length
          ? `已从${via}拉到 ${picked.length} 个可用模型`
          : `接口有响应，但未返回模型列表`,
      })
      if (!timelineDedicatedApiEnabled && !draft && chatDefault) {
        setTimelineModelsPullMsg({
          ok: true,
          text: `已拉取 ${picked.length} 个模型；未单独指定时将跟随聊天主模型（${chatDefault}）`,
        })
      }
    } finally {
      setTimelineModelsLoading(false)
    }
  }

  const runRealSummaryTest = async (cfg: SummaryAPIConfig): Promise<ConnectionStatus> => {
    const s = await personaDb.getMemorySettings()
    const url = cfg.endpoint.trim() || s.memorySummaryApiUrl?.trim() || ''
    const key = cfg.apiKey.trim() || s.memorySummaryApiKey?.trim() || ''
    if (!url || !key) return 'failed'
    const r = await testMemorySummaryConnection({ apiUrl: url, apiKey: key })
    return r.ok ? 'connected' : 'failed'
  }

  const runRealTimelineTest = async (cfg: SummaryAPIConfig): Promise<ConnectionStatus> => {
    const s = await personaDb.getMemorySettings()
    const url = cfg.endpoint.trim() || s.memoryTimelineSummaryApiUrl?.trim() || ''
    const key = cfg.apiKey.trim() || s.memoryTimelineSummaryApiKey?.trim() || ''
    if (!url || !key) return 'failed'
    const r = await testMemoryTimelineSummaryConnection({ apiUrl: url, apiKey: key })
    return r.ok ? 'connected' : 'failed'
  }

  const runRealEmbeddingTest = async (cfg: VectorAPIConfig): Promise<ConnectionStatus> => {
    const s = await personaDb.getMemorySettings()
    const model =
      embeddingModelDraft.trim() || s.memoryEmbeddingModelId?.trim() || DEFAULT_MEMORY_EMBEDDING_MODEL
    const r = await testMemoryEmbeddingConnectionUnified(
      {
        ...s,
        memoryEmbeddingProviderMode: embeddingProviderMode,
        memoryLocalEmbeddingModelId: localEmbeddingModelId,
        memoryEmbeddingUseDedicatedApi: vectorDedicatedApiEnabled,
        memoryEmbeddingApiUrl: cfg.endpoint.trim() || s.memoryEmbeddingApiUrl,
        memoryEmbeddingApiKey: cfg.apiKey.trim() || s.memoryEmbeddingApiKey,
      },
      chatApiConfig?.apiUrl?.trim() && chatApiConfig?.apiKey?.trim() ? chatApiConfig : null,
      model,
    )
    return r.ok ? 'connected' : 'failed'
  }

  const setEmbeddingProviderModePersist = async (mode: MemoryEmbeddingProviderMode) => {
    setEmbeddingProviderMode(mode)
    await personaDb.putMemorySettings({ memoryEmbeddingProviderMode: mode })
    setSavedSettings(await personaDb.getMemorySettings())
  }

  const chatDefaultModelHint = chatApiConfig?.modelId?.trim() || ''

  if (loading || !configHydrated) {
    return (
      <div
        className="flex min-h-[200px] items-center justify-center text-[13px] text-gray-400"
        style={{ background: ARCHIVE_BG }}
      >
        加载配置…
      </div>
    )
  }

  return (
    <div
      data-memory-coach-root="memory-engine"
      className="mx-auto flex max-w-xl flex-col px-4 py-5"
      style={{ background: ARCHIVE_BG, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-2 px-4 pb-2 pt-1"
        style={{ background: ARCHIVE_BG }}
      >
        <div className="min-w-0 flex-1" data-memory-coach="config-subtabs">
          <ConfigSubTabNav value={configSubTab} onChange={setConfigSubTab} />
        </div>
        <MemoryTutorialButton
          compact
          onClick={() => setTutorialOpen(true)}
          coachTarget="engine-tutorial"
        />
      </div>

      <div className="flex-1 space-y-5">
        {configLoadError ? (
          <div
            className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[13px] leading-relaxed text-amber-950"
            role="alert"
          >
            <p className="font-semibold">配置未能完整加载</p>
            <p className="mt-1">{configLoadError}</p>
            <button
              type="button"
              className="mt-3 rounded-full border border-amber-300/80 bg-white px-4 py-1.5 text-[12px] font-semibold text-amber-950"
              onClick={() => void reload()}
            >
              重试
            </button>
          </div>
        ) : null}
        <div
          className={configSubTab === 'summary' ? 'space-y-5' : 'hidden'}
          aria-hidden={configSubTab !== 'summary'}
        >
          <EngineCard>
        <div data-memory-coach="auto-summary">
          <SettingRow
            label="自动总结"
            hint={
              autoSummaryEnabled
                ? '开启后：微信私聊 / 群聊 / 遇见按下方间隔写 prose 长期记忆（关键词触发召回）；线下约会每轮写摘要表并同步尾声判断；相关人脉配角自动收到关联摘要。'
                : '关闭后不再自动写入；仍可在「角色总结」手动刻录 prose，或在「线上总结进度」手动总结。'
            }
            control={<MemoryEngineSoftSwitch on={autoSummaryEnabled} onToggle={() => void toggleAutoSummary()} />}
          />
        </div>
        <div data-memory-coach="summary-interval" className="space-y-3">
          <p className="text-[13px] font-medium text-gray-800">线上总结间隔</p>
          <p className="text-[12px] leading-relaxed text-gray-500">
            仅微信私聊、群聊与遇见临时会话：每满 N 轮 AI 回复合并一次 prose 长期记忆；游标后的消息仍以原文注入聊天。
            线下约会走「每轮写摘要表」，不计入此处计轮。
          </p>
          <MemoryIntervalScopeCapsule
            value={intervalScope}
            onChange={(scope) => void commitIntervalScope(scope)}
            disabled={!autoSummaryEnabled}
          />
          {intervalScope === 'global' ? (
            <SettingRow
              label="每满 N 轮 AI 回复"
              hint="作用于私聊、群聊与遇见；线下约会每轮写摘要表，不受此项影响且不计入「线上总结进度」。"
              control={
                <div className="rounded-2xl bg-gray-50 px-3 py-2 transition-colors focus-within:bg-gray-100">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={intervalDraft}
                    disabled={!autoSummaryEnabled}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
                      setIntervalDraft(digits)
                    }}
                    onBlur={() => void commitInterval(intervalDraft)}
                    className="w-10 min-w-[1.5ch] border-0 bg-transparent text-center text-[15px] font-medium text-gray-900 outline-none disabled:opacity-40"
                    style={listenPlainNumStyle}
                    aria-label="自动总结间隔轮数"
                  />
                </div>
              }
            />
          ) : (
            <MemoryPerCharacterIntervalList
              rows={perCharacterIntervalRows}
              disabled={!autoSummaryEnabled}
              onIntervalDraftChange={(charId, draft) =>
                setPerCharIntervalDrafts((prev) => ({ ...prev, [charId]: draft }))
              }
              onIntervalCommit={(charId, draft) => void commitCharacterInterval(charId, draft)}
            />
          )}
        </div>
          </EngineCard>
        </div>

        <div
          className={configSubTab === 'summary-model' ? 'space-y-5' : 'hidden'}
          aria-hidden={configSubTab !== 'summary-model'}
        >
          <EngineCard title="接口与模型">
            <ConfigSourceIntro
              chipClass={ARCHIVE_SOURCE_SECTION_ONLINE}
              label={ARCHIVE_SOURCE_ONLINE_LABEL}
              title="prose 长期记忆"
              body="用于微信私聊、群聊、遇见的自动总结，以及手动刻录。按下方间隔把多轮 AI 对话合并写入长期记忆 prose，展示在档案馆「角色总结」的线上区块。"
              bullets={[
                '与「线下摘要」独立：此处只负责 prose，不写按轮摘要表',
                '可选聊天主接口，或单独配置线上总结专用副接口与模型',
              ]}
            />
        <div data-memory-coach="summary-api">
          <p className="mb-2 text-[11px] font-medium text-gray-500">接口来源</p>
          <MemoryApiModeCapsule
            value={summaryDedicatedApiEnabled ? 'dedicated' : 'main'}
            onChange={(mode) => void setSummaryApiMode(mode)}
            disabled={!autoSummaryEnabled}
            aria-label="线上总结接口来源"
          />
        </div>
        <MemorySummaryApiConfig
          mode={summaryDedicatedApiEnabled ? 'dedicated' : 'main'}
          config={summaryDedicatedApiEnabled ? summaryConfig : undefined}
          onConfigChange={summaryDedicatedApiEnabled ? patchSummary : undefined}
          onSummaryFieldsBlur={summaryDedicatedApiEnabled ? () => void commitSummaryFields() : undefined}
          hasSavedKey={summaryDedicatedApiEnabled ? hasSavedSummaryKey : undefined}
          connectionStatus={summaryDedicatedApiEnabled ? summaryConnectionStatus : undefined}
          onConnectionStatusChange={summaryDedicatedApiEnabled ? setSummaryConnectionStatus : undefined}
          onTestConnection={summaryDedicatedApiEnabled ? runRealSummaryTest : undefined}
          pullSource={summaryPullSource}
          disabled={!autoSummaryEnabled}
          summaryModelDraft={summaryModelDraft}
          onSummaryModelChange={(m) => {
            setSummaryModelDraft(m)
            setSummaryModelDropdownOpen(false)
            setSummaryModelList((prev) => (m && !prev.includes(m) ? [m, ...prev] : prev))
            void personaDb.putMemorySettings({
              memorySummaryModelId: m ? m.slice(0, 120) : undefined,
            })
          }}
          summaryModelList={summaryModelList}
          summaryModelsLoading={summaryModelsLoading}
          modelsPullMsg={summaryModelsPullMsg}
          onPullModels={() => void pullSummaryModels()}
          summaryModelDropdownOpen={summaryModelDropdownOpen}
          onSummaryModelDropdownToggle={() => setSummaryModelDropdownOpen((v) => !v)}
          chatDefaultModelHint={chatDefaultModelHint}
        />
          </EngineCard>
        </div>

        <div
          className={configSubTab === 'timeline-model' ? 'space-y-5' : 'hidden'}
          aria-hidden={configSubTab !== 'timeline-model'}
        >
          <EngineCard title="接口与模型">
            <ConfigSourceIntro
              chipClass={ARCHIVE_SOURCE_SECTION_OFFLINE}
              label={ARCHIVE_SOURCE_OFFLINE_LABEL}
              title="按轮剧情摘要表"
              body="用于约会 / 私聊每轮写入的剧情时间轴：摘要行、状态锚点、关联配角摘要等，展示在档案馆「角色总结」的线下区块。"
              bullets={[
                '主模型 JSON 自带 timeline 时直接落库；未带时会用此处接口单独补救',
                '不计入「线上总结进度」计轮；与 prose 长期记忆分轨存储',
                '可选聊天主接口，或单独配置线下摘要专用副接口与模型',
              ]}
            />
            <div data-memory-coach="timeline-api">
              <p className="mb-2 text-[11px] font-medium text-gray-500">接口来源</p>
              <MemoryApiModeCapsule
                value={timelineDedicatedApiEnabled ? 'dedicated' : 'main'}
                onChange={(mode) => void setTimelineApiMode(mode)}
                disabled={!autoSummaryEnabled}
                aria-label="线下摘要接口来源"
              />
            </div>
            <MemorySummaryApiConfig
              variant="timeline"
              mode={timelineDedicatedApiEnabled ? 'dedicated' : 'main'}
              config={timelineDedicatedApiEnabled ? timelineConfig : undefined}
              onConfigChange={timelineDedicatedApiEnabled ? patchTimeline : undefined}
              onSummaryFieldsBlur={timelineDedicatedApiEnabled ? () => void commitTimelineFields() : undefined}
              hasSavedKey={timelineDedicatedApiEnabled ? hasSavedTimelineKey : undefined}
              connectionStatus={timelineDedicatedApiEnabled ? timelineConnectionStatus : undefined}
              onConnectionStatusChange={timelineDedicatedApiEnabled ? setTimelineConnectionStatus : undefined}
              onTestConnection={timelineDedicatedApiEnabled ? runRealTimelineTest : undefined}
              pullSource={timelinePullSource}
              disabled={!autoSummaryEnabled}
              summaryModelDraft={timelineModelDraft}
              onSummaryModelChange={(m) => {
                setTimelineModelDraft(m)
                setTimelineModelDropdownOpen(false)
                setTimelineModelList((prev) => (m && !prev.includes(m) ? [m, ...prev] : prev))
                void personaDb.putMemorySettings({
                  memoryTimelineSummaryModelId: m ? m.slice(0, 120) : undefined,
                })
              }}
              summaryModelList={timelineModelList}
              summaryModelsLoading={timelineModelsLoading}
              modelsPullMsg={timelineModelsPullMsg}
              onPullModels={() => void pullTimelineModels()}
              summaryModelDropdownOpen={timelineModelDropdownOpen}
              onSummaryModelDropdownToggle={() => setTimelineModelDropdownOpen((v) => !v)}
              chatDefaultModelHint={chatDefaultModelHint}
            />
          </EngineCard>
        </div>

        <div
          className={configSubTab === 'vector' ? '' : 'hidden'}
          aria-hidden={configSubTab !== 'vector'}
        >
          <MemoryVectorRecallConfig
            vectorRecallEnabled={vectorRecallEnabled}
            onToggleVectorRecall={() => void toggleVectorRecall()}
            embeddingProviderMode={embeddingProviderMode}
            onEmbeddingProviderModeChange={(mode) => void setEmbeddingProviderModePersist(mode)}
            localEmbeddingModelId={localEmbeddingModelId}
            onLocalEmbeddingModelChange={(modelId) => void setLocalEmbeddingModelPersist(modelId)}
            localModelDownloaded={localModelDownloaded}
            localModelDownloading={localModelDownloading}
            localModelDownloadProgress={localModelDownloadProgress}
            localModelDownloadError={localModelDownloadError}
            onLocalModelDownload={(force) => void runLocalModelDownload(force)}
            vectorDedicatedApiEnabled={vectorDedicatedApiEnabled}
            onVectorApiModeChange={(mode) => void setVectorApiMode(mode)}
            vectorConfig={vectorConfig}
            onVectorConfigChange={patchVector}
            onVectorFieldsBlur={() => void commitVectorFields()}
            hasSavedEmbeddingKey={hasSavedEmbeddingKey}
            connectionStatus={connectionStatus}
            onConnectionStatusChange={setConnectionStatus}
            onTestConnection={runRealEmbeddingTest}
            embeddingPullSource={embeddingPullSource}
            embeddingModelDraft={embeddingModelDraft}
            onEmbeddingModelChange={(m) => {
              setEmbeddingModelDraft(m)
              setEmbeddingModelDropdownOpen(false)
              setEmbeddingModelList((prev) => (prev.includes(m) ? prev : [m, ...prev]))
              void (async () => {
                await personaDb.putMemorySettings({ memoryEmbeddingModelId: m })
                setSavedSettings(await personaDb.getMemorySettings())
              })()
            }}
            embeddingModelList={embeddingModelList}
            embeddingModelsLoading={embeddingModelsLoading}
            modelsPullMsg={modelsPullMsg}
            onPullEmbeddingModels={() => void pullEmbeddingModels()}
            embeddingModelDropdownOpen={embeddingModelDropdownOpen}
            onEmbeddingModelDropdownToggle={() => setEmbeddingModelDropdownOpen((v) => !v)}
          />
        </div>
      </div>

      <MemoryTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="记忆配置 · 怎么用"
        subtitle="自动记记忆 · 微信与约会分开设 · 按意思找记忆"
        sections={MEMORY_ENGINE_TUTORIAL_SECTIONS}
        onStartLiveCoach={startLiveCoach}
        zIndex={55000}
      />

      <MemoryCoachPortal
        open={coachOpen && coachActive}
        steps={MEMORY_ENGINE_COACH_STEPS}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        scopeRoot="memory-engine"
        layoutEpoch={`${configSubTab}-${vectorRecallEnabled}-${embeddingProviderMode}-${vectorDedicatedApiEnabled}-${vectorRecallEnabled && vectorDedicatedApiEnabled ? 'dedicated' : 'main'}`}
        zIndex={54000}
      />
    </div>
  )
}
