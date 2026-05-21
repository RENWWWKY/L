import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
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
} from './memoryEngineCoachSteps'
import { MEMORY_ENGINE_TUTORIAL_SECTIONS } from './memoryEngineTutorialCopy'
import { MemoryEngineSoftSwitch } from './MemoryEngineSoftSwitch'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import type { ConnectionStatus, VectorAPIConfig } from './memoryEngineConfigTypes'
import { vectorConfigFromDraft } from './memoryEngineConfigTypes'
import { VectorBridgeConfig } from './VectorBridgeConfig'
import { resolveEmbeddingPullSource } from './vectorEmbeddingPullSource'

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
  title: string
  children: ReactNode
  headerAction?: ReactNode
}) {
  return (
    <div className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[16px] font-semibold tracking-tight text-gray-900">{title}</h3>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  hint,
  control,
}: {
  label: string
  hint?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-gray-900">{label}</p>
        {hint ? <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{hint}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function MemoryEngineConfig({ loading }: { loading?: boolean }) {
  const chatApiConfig = useCurrentApiConfig('chatCard')

  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [autoSummaryDefaultTrigger, setAutoSummaryDefaultTrigger] =
    useState<CharacterMemoryTriggerMode>('keyword')
  const [intervalN, setIntervalN] = useState(10)
  const [linkedMemoryAutoSummaryEnabled, setLinkedMemoryAutoSummaryEnabled] = useState(true)
  const [datingAutoSummaryEnabled, setDatingAutoSummaryEnabled] = useState(true)
  const [linkedMemExplainExpanded, setLinkedMemExplainExpanded] = useState(false)
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
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)

  const reload = useCallback(async () => {
    const settings = await personaDb.getMemorySettings()
    setAutoSummaryEnabled(settings.autoSummaryEnabled !== false)
    setAutoSummaryDefaultTrigger(
      settings.autoSummaryDefaultMemoryTriggerMode === 'always' ? 'always' : 'keyword',
    )
    setIntervalN(settings.autoSummaryInterval)
    setLinkedMemoryAutoSummaryEnabled(settings.linkedMemoryAutoSummaryEnabled !== false)
    setDatingAutoSummaryEnabled(settings.datingAutoSummaryEnabled !== false)
    setVectorRecallEnabled(settings.memoryVectorRecallEnabled !== false)
    setVectorDedicatedApiEnabled(settings.memoryEmbeddingUseDedicatedApi === true)
    setVectorConfig({
      endpoint: settings.memoryEmbeddingApiUrl?.trim() || '',
      apiKey: '',
      collection: settings.memoryVectorCollection?.trim() || '',
    })
    setHasSavedEmbeddingKey(Boolean(settings.memoryEmbeddingApiKey?.trim()))
    setEmbeddingModelDraft(settings.memoryEmbeddingModelId?.trim() || '')
    setSavedSettings(settings)
    setConnectionStatus('idle')
  }, [])

  const pullSource = useMemo(
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

  const patchVector = (patch: Partial<VectorAPIConfig>) => {
    setVectorConfig((prev) => ({ ...prev, ...patch }))
    setConnectionStatus('idle')
  }

  const commitInterval = async (raw: number) => {
    const n = Math.max(1, Math.min(100, Math.floor(Number.isFinite(raw) ? raw : 10)))
    setIntervalN(n)
    await personaDb.putMemorySettings({ autoSummaryInterval: n })
  }

  const toggleAutoSummary = async () => {
    const next = !autoSummaryEnabled
    setAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ autoSummaryEnabled: next })
  }

  const toggleLinkedMemoryAutoSummary = async () => {
    const next = !linkedMemoryAutoSummaryEnabled
    setLinkedMemoryAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ linkedMemoryAutoSummaryEnabled: next })
  }

  const toggleDatingAutoSummary = async () => {
    const next = !datingAutoSummaryEnabled
    setDatingAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ datingAutoSummaryEnabled: next })
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

  const toggleVectorDedicatedApi = async () => {
    const next = !vectorDedicatedApiEnabled
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

  const saveAllMemorySettings = async () => {
    setSaveMsg(null)
    setSaveBusy(true)
    try {
      const n = Math.max(1, Math.min(100, Math.floor(Number.isFinite(intervalN) ? intervalN : 10)))
      const v = vectorConfigFromDraft(vectorConfig)
      const keyTyped = v.apiKey
      await personaDb.putMemorySettings({
        autoSummaryEnabled,
        autoSummaryInterval: n,
        autoSummaryDefaultMemoryTriggerMode: autoSummaryDefaultTrigger,
        linkedMemoryAutoSummaryEnabled,
        datingAutoSummaryEnabled,
        memoryVectorRecallEnabled: vectorRecallEnabled,
        memoryEmbeddingUseDedicatedApi: vectorDedicatedApiEnabled,
        ...(vectorRecallEnabled
          ? {
              memoryEmbeddingModelId: embeddingModelDraft.trim()
                ? embeddingModelDraft.trim().slice(0, 120)
                : undefined,
            }
          : {}),
        ...(vectorDedicatedApiEnabled
          ? {
              memoryEmbeddingApiUrl: v.endpoint ? v.endpoint.slice(0, 512) : undefined,
              memoryVectorCollection: v.collection ? v.collection.slice(0, 128) : undefined,
              ...(keyTyped ? { memoryEmbeddingApiKey: keyTyped.slice(0, 2048) } : {}),
            }
          : {}),
      })
      setIntervalN(n)
      if (keyTyped) {
        setVectorConfig((prev) => ({ ...prev, apiKey: '' }))
        setHasSavedEmbeddingKey(true)
      }
      await reload()
      setSaveMsg({ ok: true, text: '已保存到本机（IndexedDB · memorySettings）' })
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaveBusy(false)
    }
  }

  if (loading) {
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
      className="mx-auto max-w-xl space-y-5 px-4 py-5"
      style={{ background: ARCHIVE_BG, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}
    >
      <EngineCard
        title="自动总结与关联"
        headerAction={
          <MemoryTutorialButton
            compact
            onClick={() => setTutorialOpen(true)}
            coachTarget="engine-tutorial"
          />
        }
      >
        <div data-memory-coach="auto-summary">
          <SettingRow
            label="自动总结"
            hint="聊满一定轮数后，把对话提炼成长期记忆"
            control={<MemoryEngineSoftSwitch on={autoSummaryEnabled} onToggle={() => void toggleAutoSummary()} />}
          />
        </div>
        <div data-memory-coach="summary-interval">
          <SettingRow
            label="总结间隔"
            hint="与该角色聊满 N 轮 AI 回复后触发合并总结"
            control={
              <div className="rounded-2xl bg-gray-50 px-3 py-2 transition-colors focus-within:bg-gray-100">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={intervalN}
                  disabled={!autoSummaryEnabled}
                  onChange={(e) => setIntervalN(Number(e.target.value))}
                  onBlur={() => void commitInterval(intervalN)}
                  className="w-14 border-0 bg-transparent text-center text-[15px] font-medium text-gray-900 outline-none disabled:opacity-40"
                  aria-label="自动总结间隔轮数"
                />
              </div>
            }
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2" data-memory-coach="trigger-mode">
          {(['keyword', 'always'] as const).map((mode) => {
            const active = autoSummaryDefaultTrigger === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => void commitAutoSummaryDefaultTrigger(mode)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                  active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {mode === 'keyword' ? '关键词' : '始终'}
              </button>
            )
          })}
        </div>
        <div data-memory-coach="linked-summary">
          <SettingRow
            label="关联记忆总结"
            hint="约会推剧情时，给人脉配角顺带记关联记忆"
            control={
            <MemoryEngineSoftSwitch
              on={linkedMemoryAutoSummaryEnabled}
              onToggle={() => void toggleLinkedMemoryAutoSummary()}
            />
          }
          />
        </div>
        <div data-memory-coach="dating-summary">
          <SettingRow
            label="约会推剧情时自动记记忆"
            hint="关闭后仅聊满总结间隔轮数才跑合并总结"
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
        <button
          type="button"
          onClick={() => setLinkedMemExplainExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-left text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-100"
          aria-expanded={linkedMemExplainExpanded}
        >
          <span>{linkedMemExplainExpanded ? '收起说明' : '关联记忆是什么？'}</span>
          <ChevronDown
            className={`size-4 shrink-0 text-gray-400 transition-transform duration-200 ${
              linkedMemExplainExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
        <AnimatePresence initial={false}>
          {linkedMemExplainExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 rounded-2xl bg-gray-50 px-4 py-3 text-[11px] leading-relaxed text-gray-600">
                <p>主角约会推进时，系统可为人脉配角记一条「关联记忆」，便于之后私聊接上剧情。</p>
                <p>关闭后不再自动写入关联条；微信私聊按下方间隔总结不受影响。</p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div data-memory-coach="vector-recall">
          <SettingRow
            label="语义向量召回"
            hint="按聊天语义从长期记忆中再召回相近条目"
            control={<MemoryEngineSoftSwitch on={vectorRecallEnabled} onToggle={() => void toggleVectorRecall()} />}
          />
        </div>
        {vectorRecallEnabled ? (
          <div data-memory-coach="extra-api">
            <SettingRow
              label="额外接口"
            hint="开启后使用单独的向量化地址与密钥；关闭则沿用聊天主接口"
            control={
              <MemoryEngineSoftSwitch
                on={vectorDedicatedApiEnabled}
                onToggle={() => void toggleVectorDedicatedApi()}
              />
            }
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
          hasSavedKey={vectorDedicatedApiEnabled ? hasSavedEmbeddingKey : undefined}
          connectionStatus={vectorDedicatedApiEnabled ? connectionStatus : undefined}
          onConnectionStatusChange={vectorDedicatedApiEnabled ? setConnectionStatus : undefined}
          onTestConnection={vectorDedicatedApiEnabled ? runRealEmbeddingTest : undefined}
          pullSource={pullSource}
          embeddingModelDraft={embeddingModelDraft}
          onEmbeddingModelChange={(m) => {
            setEmbeddingModelDraft(m)
            setEmbeddingModelDropdownOpen(false)
            void personaDb.putMemorySettings({ memoryEmbeddingModelId: m })
          }}
          embeddingModelList={embeddingModelList}
          embeddingModelsLoading={embeddingModelsLoading}
          modelsPullMsg={modelsPullMsg}
          onPullModels={() => void pullEmbeddingModels()}
          embeddingModelDropdownOpen={embeddingModelDropdownOpen}
          onEmbeddingModelDropdownToggle={() => setEmbeddingModelDropdownOpen((v) => !v)}
          defaultModelHint={DEFAULT_MEMORY_EMBEDDING_MODEL}
          />
        </div>
      ) : null}

      <div
        data-memory-coach="save-settings"
        className="rounded-[24px] bg-white px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)]"
      >
        <motion.button
          type="button"
          disabled={saveBusy}
          onClick={() => {
            if (vectorRecallEnabled && vectorDedicatedApiEnabled) void commitVectorFields()
            void saveAllMemorySettings()
          }}
          whileTap={saveBusy ? undefined : { scale: 0.98 }}
          className="flex w-full items-center justify-center rounded-full bg-gray-900 py-3.5 text-[13px] font-semibold tracking-wide text-white transition-opacity disabled:opacity-40"
        >
          {saveBusy ? '保存中…' : '写入档案库'}
        </motion.button>
        {saveMsg ? (
          <p
            className={`mt-2 text-center text-[11px] ${saveMsg.ok ? 'text-gray-600' : 'text-red-800/70'}`}
            role="status"
          >
            {saveMsg.text}
          </p>
        ) : null}
        <p className="mt-2 text-center text-[10px] text-gray-400">
          {vectorRecallEnabled && vectorDedicatedApiEnabled
            ? pullSource
              ? '保存后向量请求将使用你在上面填写的专用接口。'
              : '请先在下方的向量配置里填好专用地址和密钥。'
            : vectorRecallEnabled
              ? pullSource
                ? '未开启额外接口时，向量召回使用聊天主接口；可在上方拉取并选择向量模型。'
                : '未开启额外接口时，请先在全局配置里填好聊天 API，再拉取向量模型。'
              : '自动总结与关联设置会立即生效；向量相关项在开启语义召回后可配置。'}
        </p>
      </div>

      <MemoryTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="记忆配置 · 怎么用"
        subtitle="自动总结、向量召回与保存"
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
        layoutEpoch={`${vectorRecallEnabled}-${vectorDedicatedApiEnabled}-${vectorRecallEnabled && vectorDedicatedApiEnabled ? 'dedicated' : 'main'}`}
        zIndex={54000}
      />
    </div>
  )
}
