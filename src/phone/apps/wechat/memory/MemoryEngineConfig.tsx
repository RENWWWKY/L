import { listenPlainNumStyle } from '../../../../components/discoverListen/listenTogetherTypography'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchModels } from '../../api/apiSim'
import type { ApiConfig } from '../../api/types'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemoryTriggerMode } from '../newFriendsPersona/types'
import {
  DEFAULT_MEMORY_EMBEDDING_MODEL,
  resolveEmbeddingApiCredentials,
  testMemoryEmbeddingConnection,
} from './memoryEmbeddingApi'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import {
  MEMORY_ENGINE_COACH_SEEN_KEY,
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
import { MemoryFeatureHelpButton } from './MemoryFeatureHelpButton'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import type { ConnectionStatus, SummaryAPIConfig, VectorAPIConfig } from './memoryEngineConfigTypes'
import { summaryConfigFromDraft } from './memoryEngineConfigTypes'
import { MemoryApiModeCapsule, type MemoryApiMode } from './MemoryApiModeCapsule'
import { MemorySummaryApiConfig } from './MemorySummaryApiConfig'
import { testMemorySummaryConnection } from './memorySummaryApi'
import { resolveSummaryPullSource } from './memorySummaryPullSource'
import { VectorBridgeConfig } from './VectorBridgeConfig'
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

function pickEmbeddingModelCandidates(allModels: string[]): string[] {
  const uniq = Array.from(new Set(allModels)).sort((a, b) => a.localeCompare(b))
  const embedLike = uniq.filter((m) =>
    /embed|embedding|text-embedding|bge-|m3e|e5-|ada|voyage|nomic|mxbai|snowflake|qwen.*embed|doubao-embedding|baai\/bge/i.test(
      m,
    ),
  )
  return embedLike.length ? embedLike : uniq
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


type MemoryConfigSubTab = 'summary' | 'summary-model' | 'vector'

const MEMORY_CONFIG_SUB_TABS: ReadonlyArray<{ id: MemoryConfigSubTab; label: string }> = [
  { id: 'summary', label: '自动总结' },
  { id: 'summary-model', label: '总结模型' },
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
      className="grid w-full grid-cols-3 gap-1 rounded-full bg-gray-100/80 p-1"
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

function MemoryTriggerModePicker({
  value,
  disabled,
  onChange,
}: {
  value: CharacterMemoryTriggerMode
  disabled?: boolean
  onChange: (mode: CharacterMemoryTriggerMode) => void
}) {
  const options: { mode: CharacterMemoryTriggerMode; title: string }[] = [
    { mode: 'keyword', title: '关键词' },
    { mode: 'always', title: '始终' },
  ]

  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-gray-50/90 p-1 ${disabled ? 'opacity-50' : ''}`}
      role="radiogroup"
      aria-label="自动总结的类型"
    >
      <div className="grid grid-cols-2 gap-1">
        {options.map((opt) => {
          const active = value === opt.mode
          return (
            <button
              key={opt.mode}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.mode)}
              className={`rounded-xl px-3 py-2.5 text-center transition-all ${
                active
                  ? 'bg-white text-gray-900 shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/80'
                  : 'text-gray-600 hover:bg-white/60'
              }`}
            >
              <span className="block text-[13px] font-semibold">{opt.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MemoryEngineConfig({
  loading,
  currentWechatAccountId,
}: {
  loading?: boolean
  currentWechatAccountId?: string
}) {
  const chatApiConfig = useCurrentApiConfig('chatCard')

  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [autoSummaryDefaultTrigger, setAutoSummaryDefaultTrigger] =
    useState<CharacterMemoryTriggerMode>('keyword')
  const [intervalDraft, setIntervalDraft] = useState('10')
  const [intervalScope, setIntervalScope] = useState<AutoSummaryIntervalScope>('global')
  const [characterRows, setCharacterRows] = useState<Character[]>([])
  const [perCharIntervalDrafts, setPerCharIntervalDrafts] = useState<Record<string, string>>({})
  const [linkedMemoryAutoSummaryEnabled, setLinkedMemoryAutoSummaryEnabled] = useState(true)
  const [datingAutoSummaryEnabled, setDatingAutoSummaryEnabled] = useState(true)
  const [summaryDedicatedApiEnabled, setSummaryDedicatedApiEnabled] = useState(false)
  const [summaryConfig, setSummaryConfig] = useState<SummaryAPIConfig>({ endpoint: '', apiKey: '' })
  const [hasSavedSummaryKey, setHasSavedSummaryKey] = useState(false)
  const [summaryConnectionStatus, setSummaryConnectionStatus] = useState<ConnectionStatus>('idle')
  const [summaryModelDraft, setSummaryModelDraft] = useState('')
  const [summaryModelList, setSummaryModelList] = useState<string[]>([])
  const [summaryModelDropdownOpen, setSummaryModelDropdownOpen] = useState(false)
  const [summaryModelsLoading, setSummaryModelsLoading] = useState(false)
  const [summaryModelsPullMsg, setSummaryModelsPullMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [vectorRecallEnabled, setVectorRecallEnabled] = useState(true)
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
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [configSubTab, setConfigSubTab] = useState<MemoryConfigSubTab>('summary')

  const reload = useCallback(async () => {
    const settings = await personaDb.getMemorySettings()
    const savedModel = settings.memoryEmbeddingModelId?.trim() || ''
    setAutoSummaryEnabled(settings.autoSummaryEnabled !== false)
    setAutoSummaryDefaultTrigger(
      settings.autoSummaryDefaultMemoryTriggerMode === 'always' ? 'always' : 'keyword',
    )
    setIntervalDraft(String(settings.autoSummaryInterval))
    setIntervalScope(settings.autoSummaryIntervalScope === 'per_character' ? 'per_character' : 'global')
    const chars = await loadAutoSummaryIntervalCharacterCandidates(currentWechatAccountId)
    setCharacterRows(chars)
    setPerCharIntervalDrafts({})
    setLinkedMemoryAutoSummaryEnabled(settings.linkedMemoryAutoSummaryEnabled !== false)
    setDatingAutoSummaryEnabled(settings.datingAutoSummaryEnabled !== false)
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
    setVectorRecallEnabled(settings.memoryVectorRecallEnabled !== false)
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
    setConfigHydrated(true)
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

  useEffect(() => {
    void reload()
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
    if (loading) return
    if (readMemoryCoachSeen(MEMORY_ENGINE_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 640)
    return () => window.clearTimeout(id)
  }, [loading, startLiveCoach])

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
    if (!next) {
      setLinkedMemoryAutoSummaryEnabled(false)
      await personaDb.putMemorySettings({
        autoSummaryEnabled: false,
        linkedMemoryAutoSummaryEnabled: false,
      })
      return
    }
    await personaDb.putMemorySettings({ autoSummaryEnabled: true })
  }

  const toggleLinkedMemoryAutoSummary = async () => {
    if (!autoSummaryEnabled) return
    const next = !linkedMemoryAutoSummaryEnabled
    setLinkedMemoryAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ linkedMemoryAutoSummaryEnabled: next })
  }

  const toggleDatingAutoSummary = async () => {
    const next = !datingAutoSummaryEnabled
    setDatingAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ datingAutoSummaryEnabled: next })
  }

  const setSummaryApiMode = async (mode: MemoryApiMode) => {
    const next = mode === 'dedicated'
    if (next === summaryDedicatedApiEnabled) return
    setSummaryDedicatedApiEnabled(next)
    setSummaryModelDropdownOpen(false)
    setSummaryConnectionStatus('idle')
    await personaDb.putMemorySettings({ memorySummaryUseDedicatedApi: next })
  }

  const commitAutoSummaryDefaultTrigger = async (mode: CharacterMemoryTriggerMode) => {
    setAutoSummaryDefaultTrigger(mode)
    await personaDb.putMemorySettings({ autoSummaryDefaultMemoryTriggerMode: mode })
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
      const res = await fetchModels(cfg)
      if (!res.ok) {
        setModelsPullMsg({ ok: false, text: res.error })
        return
      }
      const picked = pickEmbeddingModelCandidates(res.models)
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
          ? `已从${via}拉到 ${picked.length} 个可用模型（已优先筛出名字像 embedding 的）`
          : `接口有响应，但没筛到像向量模型的名字，请换网关或手动确认列表`,
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
            ? '还缺地址或密钥：请在下面填好总结专用接口。'
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
      const via = source.kind === 'dedicated' ? '总结专用接口' : '聊天主接口'
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

  const runRealSummaryTest = async (cfg: SummaryAPIConfig): Promise<ConnectionStatus> => {
    const s = await personaDb.getMemorySettings()
    const url = cfg.endpoint.trim() || s.memorySummaryApiUrl?.trim() || ''
    const key = cfg.apiKey.trim() || s.memorySummaryApiKey?.trim() || ''
    if (!url || !key) return 'failed'
    const r = await testMemorySummaryConnection({ apiUrl: url, apiKey: key })
    return r.ok ? 'connected' : 'failed'
  }

  const runRealEmbeddingTest = async (cfg: VectorAPIConfig): Promise<ConnectionStatus> => {
    const s = await personaDb.getMemorySettings()
    const model =
      embeddingModelDraft.trim() || s.memoryEmbeddingModelId?.trim() || DEFAULT_MEMORY_EMBEDDING_MODEL
    const cred = resolveEmbeddingApiCredentials(
      {
        ...s,
        memoryEmbeddingUseDedicatedApi: vectorDedicatedApiEnabled,
        memoryEmbeddingApiUrl: cfg.endpoint.trim() || s.memoryEmbeddingApiUrl,
        memoryEmbeddingApiKey: cfg.apiKey.trim() || s.memoryEmbeddingApiKey,
      },
      chatApiConfig?.apiUrl?.trim() && chatApiConfig?.apiKey?.trim() ? chatApiConfig : null,
    )
    if (!cred) return 'failed'
    const r = await testMemoryEmbeddingConnection(cred, model)
    return r.ok ? 'connected' : 'failed'
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
        <div className="min-w-0 flex-1">
          <ConfigSubTabNav value={configSubTab} onChange={setConfigSubTab} />
        </div>
        <MemoryTutorialButton
          compact
          onClick={() => setTutorialOpen(true)}
          coachTarget="engine-tutorial"
        />
      </div>

      <div className="flex-1 space-y-5">
        <div
          className={configSubTab === 'summary' ? 'space-y-5' : 'hidden'}
          aria-hidden={configSubTab !== 'summary'}
        >
          <EngineCard>
        <div data-memory-coach="auto-summary">
          <SettingRow
            label="自动总结"
            control={<MemoryEngineSoftSwitch on={autoSummaryEnabled} onToggle={() => void toggleAutoSummary()} />}
          />
        </div>
        <div data-memory-coach="trigger-mode" className="space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-medium text-gray-900">自动总结的类型</p>
            <MemoryFeatureHelpButton
              featureTitle="自动总结的类型"
              blocks={[
                {
                  kind: 'text',
                  text: '自动总结入库的新记忆，默认按此处选择参与聊天召回。',
                },
                {
                  kind: 'bullets',
                  title: '关键词',
                  items: [
                    '仅当上下文命中本条提炼词，或向量召回相近时纳入参考',
                    '更省 token，适合记忆条目较多时',
                  ],
                },
                {
                  kind: 'bullets',
                  title: '始终',
                  items: [
                    '每轮私聊更可能带上本条（仍受条数上限约束）',
                    '适合希望关键记忆长期跟随时',
                  ],
                },
                {
                  kind: 'tip',
                  text: '不论选哪种，入库时仍会保存模型提炼的触发词备份；之后可在记忆编辑里单独修改。',
                },
              ]}
            />
          </div>
          <MemoryTriggerModePicker
            value={autoSummaryDefaultTrigger}
            disabled={!autoSummaryEnabled}
            onChange={(mode) => void commitAutoSummaryDefaultTrigger(mode)}
          />
        </div>
        <div data-memory-coach="summary-interval" className="space-y-3">
          <p className="text-[13px] font-medium text-gray-800">总结间隔</p>
          <MemoryIntervalScopeCapsule
            value={intervalScope}
            onChange={(scope) => void commitIntervalScope(scope)}
            disabled={!autoSummaryEnabled}
          />
          {intervalScope === 'global' ? (
            <SettingRow
              label="每满 N 轮 AI 回复"
              hint="微信私聊与约会剧情（若开启计轮）共用此间隔"
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
        <div data-memory-coach="linked-summary">
          <SettingRow
            label="关联记忆总结"
            labelExtra={
              <MemoryFeatureHelpButton
                featureTitle="关联记忆总结"
                blocks={[
                  {
                    kind: 'text',
                    text: '约会推剧情时，是否给人脉配角自动写入「关联记忆」。',
                  },
                  {
                    kind: 'bullets',
                    title: '开启后',
                    items: [
                      '场景出现人脉配角时，相关片段写入该配角名下',
                      '私聊这位配角时单独注入，不混进主角自己的记忆',
                      '其它未出场角色看不到这些条目',
                    ],
                  },
                  {
                    kind: 'bullets',
                    title: '关闭后',
                    items: [
                      '主角自有约会记忆仍可按间隔写入（需开「约会剧情计入总结轮数」）',
                      '不会再自动给配角写关联条',
                      '配角私聊时通常不知道别处的线下剧情，除非直接聊过或手动刻录',
                    ],
                  },
                  {
                    kind: 'tip',
                    title: '推荐',
                    text: '玩约会 + 人脉网、希望配角能「听说」相关剧情 → 建议开启。只要主角私聊记忆，或担心配角记忆过多 → 可关闭。',
                  },
                ]}
              />
            }
            control={
              <MemoryEngineSoftSwitch
                on={linkedMemoryAutoSummaryEnabled && autoSummaryEnabled}
                disabled={!autoSummaryEnabled}
                onToggle={() => void toggleLinkedMemoryAutoSummary()}
              />
            }
          />
        </div>
        <div data-memory-coach="dating-summary">
          <SettingRow
            label="约会剧情计入总结轮数"
            labelExtra={
              <MemoryFeatureHelpButton
                featureTitle="约会剧情计入总结轮数"
                blocks={[
                  {
                    kind: 'text',
                    text: '与私聊共用「总结间隔」，决定约会 AI 回复是否参与自动总结计轮。',
                  },
                  {
                    kind: 'bullets',
                    title: '开启后',
                    items: [
                      '约会 AI 回复也计轮，满间隔时把微信 + 线下剧情合并入库',
                      '主角自有记忆可涵盖线下约会内容',
                    ],
                  },
                  {
                    kind: 'bullets',
                    title: '关闭后',
                    items: [
                      '只在微信私聊里计轮与总结',
                      '约会剧情不会推进自动总结进度',
                    ],
                  },
                ]}
              />
            }
            control={
              <MemoryEngineSoftSwitch
                on={datingAutoSummaryEnabled && autoSummaryEnabled}
                onToggle={() => {
                  if (!autoSummaryEnabled) return
                  void toggleDatingAutoSummary()
                }}
              />
            }
          />
        </div>
          </EngineCard>
        </div>

        <div
          className={configSubTab === 'summary-model' ? 'space-y-5' : 'hidden'}
          aria-hidden={configSubTab !== 'summary-model'}
        >
          <EngineCard title="总结模型">
        <div data-memory-coach="summary-api">
          <MemoryApiModeCapsule
            layoutId="memory-summary-api-mode"
            value={summaryDedicatedApiEnabled ? 'dedicated' : 'main'}
            onChange={(mode) => void setSummaryApiMode(mode)}
            disabled={!autoSummaryEnabled}
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
          className={configSubTab === 'vector' ? 'space-y-5' : 'hidden'}
          aria-hidden={configSubTab !== 'vector'}
        >
          <EngineCard title="语义向量召回">
        <div data-memory-coach="vector-recall">
          <SettingRow
            label="开启语义召回"
            control={<MemoryEngineSoftSwitch on={vectorRecallEnabled} onToggle={() => void toggleVectorRecall()} />}
          />
        </div>
        {vectorRecallEnabled ? (
          <div data-memory-coach="extra-api">
            <MemoryApiModeCapsule
              layoutId="memory-vector-api-mode"
              value={vectorDedicatedApiEnabled ? 'dedicated' : 'main'}
              onChange={(mode) => void setVectorApiMode(mode)}
            />
          </div>
        ) : null}
          </EngineCard>

          {vectorRecallEnabled ? (
            <div data-memory-coach="vector-model">
              <VectorBridgeConfig
                mode={vectorDedicatedApiEnabled ? 'dedicated' : 'main'}
                config={vectorDedicatedApiEnabled ? vectorConfig : undefined}
                onConfigChange={vectorDedicatedApiEnabled ? patchVector : undefined}
                onVectorFieldsBlur={vectorDedicatedApiEnabled ? () => void commitVectorFields() : undefined}
                hasSavedKey={vectorDedicatedApiEnabled ? hasSavedEmbeddingKey : undefined}
                connectionStatus={vectorDedicatedApiEnabled ? connectionStatus : undefined}
                onConnectionStatusChange={vectorDedicatedApiEnabled ? setConnectionStatus : undefined}
                onTestConnection={vectorDedicatedApiEnabled ? runRealEmbeddingTest : undefined}
                pullSource={embeddingPullSource}
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
                onPullModels={() => void pullEmbeddingModels()}
                embeddingModelDropdownOpen={embeddingModelDropdownOpen}
                onEmbeddingModelDropdownToggle={() => setEmbeddingModelDropdownOpen((v) => !v)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <MemoryTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="记忆配置 · 怎么用"
        subtitle="自动总结、总结模型与向量召回"
        sections={MEMORY_ENGINE_TUTORIAL_SECTIONS}
        onStartLiveCoach={startLiveCoach}
        zIndex={55000}
      />

      <MemoryCoachPortal
        open={coachOpen}
        steps={MEMORY_ENGINE_COACH_STEPS}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        scopeRoot="memory-engine"
        layoutEpoch={`${configSubTab}-${vectorRecallEnabled}-${vectorDedicatedApiEnabled}-${vectorRecallEnabled && vectorDedicatedApiEnabled ? 'dedicated' : 'main'}`}
        zIndex={54000}
      />
    </div>
  )
}
