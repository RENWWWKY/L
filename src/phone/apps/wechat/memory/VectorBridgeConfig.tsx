import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { MemoryModelIdText } from './MemoryModelIdText'
import { Pressable } from '../../../components/Pressable'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { MemoryEngineSoftField, MemoryEngineSoftInput } from './MemoryEngineSoftField'
import type { ConnectionStatus, VectorAPIConfig } from './memoryEngineConfigTypes'
import { isVectorConfigReadyForPing } from './memoryEngineConfigTypes'
import type { EmbeddingPullSource } from './vectorEmbeddingPullSource'

const STATUS_COPY: Record<
  ConnectionStatus,
  { text: string; showDot: boolean; dotPulse: boolean; dotClass: string }
> = {
  idle: { text: '', showDot: false, dotPulse: false, dotClass: 'bg-gray-300' },
  pinging: { text: '正在连一下，稍等…', showDot: true, dotPulse: true, dotClass: 'bg-gray-900' },
  connected: { text: '连上了，可以拉模型、开语义召回', showDot: true, dotPulse: false, dotClass: 'bg-gray-900' },
  failed: { text: '没连上，检查地址和密钥是否正确', showDot: true, dotPulse: false, dotClass: 'bg-red-900/40' },
}

function ConnectionStatusLine({ status }: { status: ConnectionStatus }) {
  const meta = STATUS_COPY[status]
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={status}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex min-w-0 flex-1 items-center gap-2 text-[11px] leading-relaxed text-gray-600"
      >
        {meta.showDot ? (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClass} ${
              meta.dotPulse ? 'animate-pulse' : ''
            }`}
            aria-hidden
          />
        ) : null}
        <span>{meta.text}</span>
      </motion.p>
    </AnimatePresence>
  )
}

export async function mockVectorBridgePing(
  config: VectorAPIConfig,
  hasSavedKey: boolean,
): Promise<ConnectionStatus> {
  await new Promise((r) => setTimeout(r, 2000))
  if (!isVectorConfigReadyForPing(config, hasSavedKey)) return 'failed'
  return 'connected'
}

function VectorEmbeddingModelSection({
  mode,
  pullSource,
  disabled,
  embeddingModelDraft,
  onEmbeddingModelChange,
  embeddingModelList,
  embeddingModelsLoading,
  modelsPullMsg,
  onPullModels,
  embeddingModelDropdownOpen,
  onEmbeddingModelDropdownToggle,
}: {
  mode: 'dedicated' | 'main'
  pullSource: EmbeddingPullSource | null
  disabled?: boolean
  embeddingModelDraft: string
  onEmbeddingModelChange: (modelId: string) => void
  embeddingModelList: string[]
  embeddingModelsLoading: boolean
  modelsPullMsg: { ok: boolean; text: string } | null
  onPullModels: () => void
  embeddingModelDropdownOpen: boolean
  onEmbeddingModelDropdownToggle: () => void
}) {
  const pullHint = useMemo(() => {
    if (!pullSource) {
      return mode === 'main'
        ? '请先在全局配置里填好聊天 API，才能拉模型列表。'
        : '请先在下面填好向量专用地址和密钥，才能拉模型列表。'
    }
    return pullSource.label
  }, [pullSource, mode])

  const canPull = Boolean(pullSource) && !disabled

  return (
    <div className={mode === 'dedicated' ? 'mt-6 border-t border-gray-100/80 pt-5' : ''}>
      {!pullSource ? (
        <div className="rounded-2xl bg-amber-50/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900/70">
          {pullHint}
        </div>
      ) : null}

      <Pressable
        type="button"
        disabled={!canPull || embeddingModelsLoading}
        onClick={onPullModels}
        className="mt-3 w-full rounded-full bg-gray-100 px-4 py-2.5 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-200/80 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {embeddingModelsLoading ? '正在拉列表…' : '拉取可用模型列表'}
      </Pressable>

      {modelsPullMsg ? (
        <p
          className={`mt-2 text-[11px] leading-relaxed ${modelsPullMsg.ok ? 'text-gray-600' : 'text-red-800/70'}`}
          role="status"
        >
          {modelsPullMsg.text}
        </p>
      ) : null}

      <div className="mt-3">
        <InlineDropdown
          label="选择向量模型"
          valueText={
            embeddingModelDraft.trim() ? (
              <MemoryModelIdText text={embeddingModelDraft.trim()} />
            ) : embeddingModelList.length ? (
              <MemoryModelIdText text={embeddingModelList[0] || '请选一个'} />
            ) : (
              '请先拉取模型列表'
            )
          }
          open={embeddingModelDropdownOpen}
          disabled={!embeddingModelList.length || disabled}
          onToggle={onEmbeddingModelDropdownToggle}
        >
          <div className="flex flex-col gap-2 px-3 py-2">
            {embeddingModelList.map((m) => {
              const active = m === (embeddingModelDraft.trim() || embeddingModelList[0] || '')
              return (
                <button
                  key={m}
                  type="button"
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    active ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => onEmbeddingModelChange(m)}
                >
                  <MemoryModelIdText text={m} className="break-all" />
                </button>
              )
            })}
          </div>
        </InlineDropdown>
      </div>
    </div>
  )
}

export function VectorBridgeConfig({
  mode = 'dedicated',
  config,
  onConfigChange,
  hasSavedKey,
  connectionStatus,
  onConnectionStatusChange,
  onTestConnection,
  disabled,
  pullSource,
  embeddingModelDraft,
  onEmbeddingModelChange,
  embeddingModelList,
  embeddingModelsLoading,
  modelsPullMsg,
  onPullModels,
  embeddingModelDropdownOpen,
  onEmbeddingModelDropdownToggle,
  onVectorFieldsBlur,
}: {
  mode?: 'dedicated' | 'main'
  config?: VectorAPIConfig
  onConfigChange?: (patch: Partial<VectorAPIConfig>) => void
  hasSavedKey?: boolean
  connectionStatus?: ConnectionStatus
  onConnectionStatusChange?: (s: ConnectionStatus) => void
  onTestConnection?: (config: VectorAPIConfig) => Promise<ConnectionStatus>
  disabled?: boolean
  pullSource: EmbeddingPullSource | null
  embeddingModelDraft: string
  onEmbeddingModelChange: (modelId: string) => void
  embeddingModelList: string[]
  embeddingModelsLoading: boolean
  modelsPullMsg: { ok: boolean; text: string } | null
  onPullModels: () => void
  embeddingModelDropdownOpen: boolean
  onEmbeddingModelDropdownToggle: () => void
  /** 专用接口地址 / 记忆库名称失焦时写入本机 */
  onVectorFieldsBlur?: () => void
}) {
  const [keyVisible, setKeyVisible] = useState(false)

  const handleTestConnection = useCallback(async () => {
    if (!config || !onConnectionStatusChange || connectionStatus === 'pinging') return
    onConnectionStatusChange('pinging')
    const started = Date.now()
    try {
      const next = onTestConnection
        ? await onTestConnection(config)
        : await mockVectorBridgePing(config, hasSavedKey ?? false)
      const remain = 2000 - (Date.now() - started)
      if (remain > 0) await new Promise((r) => setTimeout(r, remain))
      onConnectionStatusChange(next)
    } catch {
      const remain = 2000 - (Date.now() - started)
      if (remain > 0) await new Promise((r) => setTimeout(r, remain))
      onConnectionStatusChange('failed')
    }
  }, [config, connectionStatus, hasSavedKey, onConnectionStatusChange, onTestConnection])

  const pinging = connectionStatus === 'pinging'

  const modelSectionProps = {
    mode,
    pullSource,
    disabled,
    embeddingModelDraft,
    onEmbeddingModelChange,
    embeddingModelList,
    embeddingModelsLoading,
    modelsPullMsg,
    onPullModels,
    embeddingModelDropdownOpen,
    onEmbeddingModelDropdownToggle,
  }

  if (mode === 'main') {
    return (
      <div
        className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]"
        style={{ opacity: disabled ? 0.55 : 1 }}
      >
        <h3 className="text-[17px] font-semibold tracking-tight text-gray-900">向量模型</h3>
        <div className="mt-4">
          <VectorEmbeddingModelSection {...modelSectionProps} />
        </div>
      </div>
    )
  }

  if (!config || !onConfigChange) return null

  return (
    <div
      className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]"
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <h3 className="text-[17px] font-semibold tracking-tight text-gray-900">向量接口与模型</h3>

      <div className="mt-5 space-y-4">
        <MemoryEngineSoftField label="接口地址">
          <MemoryEngineSoftInput
            value={config.endpoint}
            onChange={(v) => onConfigChange({ endpoint: v })}
            onBlur={onVectorFieldsBlur}
            placeholder="例如 https://你的网关/v1"
            disabled={disabled}
          />
        </MemoryEngineSoftField>

        <MemoryEngineSoftField label="密钥">
          <div className="flex items-stretch gap-2">
            <div className="min-w-0 flex-1 rounded-2xl bg-gray-50 px-4 py-3 transition-colors focus-within:bg-gray-100">
              <input
                type={keyVisible ? 'text' : 'password'}
                value={config.apiKey}
                disabled={disabled}
                onChange={(e) => onConfigChange({ apiKey: e.target.value })}
                onBlur={onVectorFieldsBlur}
                placeholder={hasSavedKey ? '已保存过密钥，输入新内容可覆盖' : '请输入密钥'}
                className="w-full border-0 bg-transparent text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setKeyVisible((v) => !v)}
              className="flex h-[46px] w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40"
              aria-label={keyVisible ? '隐藏密钥' : '显示密钥'}
            >
              {keyVisible ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
            </button>
          </div>
        </MemoryEngineSoftField>

        <MemoryEngineSoftField label="记忆库名称">
          <MemoryEngineSoftInput
            value={config.collection}
            onChange={(v) => onConfigChange({ collection: v })}
            onBlur={onVectorFieldsBlur}
            placeholder="没有专用向量库可留空"
            disabled={disabled}
          />
        </MemoryEngineSoftField>
      </div>

      {onConnectionStatusChange && connectionStatus ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <motion.button
            type="button"
            disabled={disabled || pinging}
            onClick={() => void handleTestConnection()}
            whileTap={disabled || pinging ? undefined : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            className="shrink-0 rounded-full bg-gray-900 px-5 py-2.5 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pinging ? '测试中…' : '测试连通'}
          </motion.button>
          {connectionStatus !== 'idle' ? <ConnectionStatusLine status={connectionStatus} /> : null}
        </div>
      ) : null}

      <VectorEmbeddingModelSection {...modelSectionProps} />
    </div>
  )
}
