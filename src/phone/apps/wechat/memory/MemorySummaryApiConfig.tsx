import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { MemoryModelIdText } from './MemoryModelIdText'
import { Pressable } from '../../../components/Pressable'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { MemoryEngineSoftField, MemoryEngineSoftInput } from './MemoryEngineSoftField'
import type { ConnectionStatus, SummaryAPIConfig } from './memoryEngineConfigTypes'
import { isSummaryConfigReadyForPing } from './memoryEngineConfigTypes'
import type { SummaryPullSource } from './memorySummaryPullSource'
import type { TimelineSummaryPullSource } from './memoryTimelineSummaryPullSource'

export type MemorySummaryApiConfigVariant = 'summary' | 'timeline'

const VARIANT_COPY: Record<
  MemorySummaryApiConfigVariant,
  {
    sectionTitle: string
    modelDropdownLabel: string
    pullHintMain: string
    pullHintDedicated: string
    endpointPlaceholder: string
    keyPlaceholderSaved: string
    keyPlaceholderEmpty: string
  }
> = {
  summary: {
    sectionTitle: '线上总结模型',
    modelDropdownLabel: '线上总结所用模型',
    pullHintMain: '线上总结将沿用全局聊天 API。请先在全局配置里填好聊天 API，才能拉模型列表。',
    pullHintDedicated: '线上总结将使用专用副接口。请先在下面填好专用地址和密钥，才能拉模型列表。',
    endpointPlaceholder: '例如 https://你的网关/v1',
    keyPlaceholderSaved: '已保存过密钥，输入新内容可覆盖',
    keyPlaceholderEmpty: '请输入密钥',
  },
  timeline: {
    sectionTitle: '线下摘要模型',
    modelDropdownLabel: '线下摘要所用模型',
    pullHintMain: '线下摘要将沿用全局聊天 API。请先在全局配置里填好聊天 API，才能拉模型列表。',
    pullHintDedicated: '线下摘要将使用专用副接口。请先在下面填好专用地址和密钥，才能拉模型列表。',
    endpointPlaceholder: '例如 https://你的网关/v1',
    keyPlaceholderSaved: '已保存过密钥，输入新内容可覆盖',
    keyPlaceholderEmpty: '请输入密钥',
  },
}

const STATUS_COPY: Record<
  ConnectionStatus,
  { text: string; showDot: boolean; dotPulse: boolean; dotClass: string }
> = {
  idle: { text: '', showDot: false, dotPulse: false, dotClass: 'bg-gray-300' },
  pinging: { text: '正在连一下，稍等…', showDot: true, dotPulse: true, dotClass: 'bg-gray-900' },
  connected: { text: '连上了，可以拉模型', showDot: true, dotPulse: false, dotClass: 'bg-gray-900' },
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

function SummaryModelSection({
  mode,
  pullSource,
  disabled,
  summaryModelDraft,
  onSummaryModelChange,
  summaryModelList,
  summaryModelsLoading,
  modelsPullMsg,
  onPullModels,
  summaryModelDropdownOpen,
  onSummaryModelDropdownToggle,
  chatDefaultModelHint,
  sectionTitle = '总结模型',
  modelDropdownLabel = '当前总结模型',
  pullHintMain = '请先在全局配置里填好聊天 API，才能拉模型列表。',
  pullHintDedicated = '请先在下面填好总结专用地址和密钥，才能拉模型列表。',
}: {
  mode: 'dedicated' | 'main'
  pullSource: SummaryPullSource | TimelineSummaryPullSource | null
  disabled?: boolean
  summaryModelDraft: string
  onSummaryModelChange: (modelId: string) => void
  summaryModelList: string[]
  summaryModelsLoading: boolean
  modelsPullMsg: { ok: boolean; text: string } | null
  onPullModels: () => void
  summaryModelDropdownOpen: boolean
  onSummaryModelDropdownToggle: () => void
  chatDefaultModelHint?: string
  sectionTitle?: string
  modelDropdownLabel?: string
  pullHintMain?: string
  pullHintDedicated?: string
}) {
  const pullHint = useMemo(() => {
    if (!pullSource) {
      return mode === 'main' ? pullHintMain : pullHintDedicated
    }
    return pullSource.label
  }, [pullSource, mode, pullHintMain, pullHintDedicated])

  const canPull = Boolean(pullSource) && !disabled
  const modelOptions = useMemo(() => {
    const base = summaryModelList.slice()
    if (mode === 'main') return ['__chat_default__', ...base]
    return base
  }, [mode, summaryModelList])

  const modelLabel = (id: string) => {
    if (id === '__chat_default__') {
      return chatDefaultModelHint?.trim()
        ? `跟随聊天主模型（${chatDefaultModelHint.trim()}）`
        : '跟随聊天主模型'
    }
    return id
  }

  return (
    <div className={mode === 'dedicated' ? 'mt-6 border-t border-gray-100/80 pt-5' : 'mt-4'}>
      <p className="text-[14px] font-medium text-gray-900">{sectionTitle}</p>

      {!pullSource ? (
        <div className="mt-3 rounded-2xl bg-amber-50/80 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900/70">
          {pullHint}
        </div>
      ) : null}

      <Pressable
        type="button"
        disabled={!canPull || summaryModelsLoading}
        onClick={onPullModels}
        className="mt-3 w-full rounded-full bg-gray-900 py-2.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
      >
        {summaryModelsLoading ? '拉取中…' : '拉取可用模型'}
      </Pressable>

      {modelsPullMsg ? (
        <p
          className={`mt-2 text-[11px] leading-relaxed ${modelsPullMsg.ok ? 'text-gray-600' : 'text-red-800/70'}`}
        >
          {modelsPullMsg.text}
        </p>
      ) : null}

      {modelOptions.length ? (
        <div className="mt-4">
          <InlineDropdown
            label={modelDropdownLabel}
            valueText={
              summaryModelDraft.trim() ? (
                <MemoryModelIdText text={summaryModelDraft.trim()} />
              ) : mode === 'main' ? (
                <MemoryModelIdText text={modelLabel('__chat_default__')} />
              ) : modelOptions[0] ? (
                <MemoryModelIdText text={modelLabel(modelOptions[0]!)} />
              ) : (
                '请先拉取模型列表'
              )
            }
            open={summaryModelDropdownOpen}
            disabled={!modelOptions.length || disabled}
            onToggle={onSummaryModelDropdownToggle}
          >
            <div className="flex flex-col gap-2 px-3 py-2">
              {modelOptions.map((id) => {
                const active =
                  id === '__chat_default__'
                    ? !summaryModelDraft.trim()
                    : id === summaryModelDraft.trim()
                return (
                  <button
                    key={id}
                    type="button"
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                      active ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      onSummaryModelChange(id === '__chat_default__' ? '' : id)
                      onSummaryModelDropdownToggle()
                    }}
                  >
                    <MemoryModelIdText text={modelLabel(id)} className="break-all" />
                  </button>
                )
              })}
            </div>
          </InlineDropdown>
        </div>
      ) : null}
    </div>
  )
}

export function MemorySummaryApiConfig({
  mode = 'main',
  config,
  onConfigChange,
  hasSavedKey,
  connectionStatus,
  onConnectionStatusChange,
  onTestConnection,
  disabled,
  pullSource,
  summaryModelDraft,
  onSummaryModelChange,
  summaryModelList,
  summaryModelsLoading,
  modelsPullMsg,
  onPullModels,
  summaryModelDropdownOpen,
  onSummaryModelDropdownToggle,
  chatDefaultModelHint,
  onSummaryFieldsBlur,
  variant = 'summary',
}: {
  mode?: 'dedicated' | 'main'
  config?: SummaryAPIConfig
  onConfigChange?: (patch: Partial<SummaryAPIConfig>) => void
  hasSavedKey?: boolean
  connectionStatus?: ConnectionStatus
  onConnectionStatusChange?: (s: ConnectionStatus) => void
  onTestConnection?: (config: SummaryAPIConfig) => Promise<ConnectionStatus>
  disabled?: boolean
  pullSource: SummaryPullSource | TimelineSummaryPullSource | null
  summaryModelDraft: string
  onSummaryModelChange: (modelId: string) => void
  summaryModelList: string[]
  summaryModelsLoading: boolean
  modelsPullMsg: { ok: boolean; text: string } | null
  onPullModels: () => void
  summaryModelDropdownOpen: boolean
  onSummaryModelDropdownToggle: () => void
  chatDefaultModelHint?: string
  onSummaryFieldsBlur?: () => void
  variant?: MemorySummaryApiConfigVariant
}) {
  const [keyVisible, setKeyVisible] = useState(false)
  const copy = VARIANT_COPY[variant]

  const handleTestConnection = useCallback(async () => {
    if (!config || !onConnectionStatusChange || connectionStatus === 'pinging') return
    onConnectionStatusChange('pinging')
    const started = Date.now()
    try {
      const next = onTestConnection
        ? await onTestConnection(config)
        : 'failed'
      const remain = 1200 - (Date.now() - started)
      if (remain > 0) await new Promise((r) => setTimeout(r, remain))
      onConnectionStatusChange(next)
    } catch {
      const remain = 1200 - (Date.now() - started)
      if (remain > 0) await new Promise((r) => setTimeout(r, remain))
      onConnectionStatusChange('failed')
    }
  }, [config, connectionStatus, hasSavedKey, onConnectionStatusChange, onTestConnection])

  const pinging = connectionStatus === 'pinging'

  const modelSectionProps = {
    mode,
    pullSource,
    disabled,
    summaryModelDraft,
    onSummaryModelChange,
    summaryModelList,
    summaryModelsLoading,
    modelsPullMsg,
    onPullModels,
    summaryModelDropdownOpen,
    onSummaryModelDropdownToggle,
    chatDefaultModelHint,
    sectionTitle: copy.sectionTitle,
    modelDropdownLabel: copy.modelDropdownLabel,
    pullHintMain: copy.pullHintMain,
    pullHintDedicated: copy.pullHintDedicated,
  }

  if (mode === 'main') {
    return (
      <div style={{ opacity: disabled ? 0.55 : 1 }}>
        <SummaryModelSection {...modelSectionProps} />
      </div>
    )
  }

  if (!config || !onConfigChange) return null

  return (
    <div style={{ opacity: disabled ? 0.55 : 1 }}>
      <div className="mt-4 space-y-4">
        <MemoryEngineSoftField label="接口地址">
          <MemoryEngineSoftInput
            value={config.endpoint}
            onChange={(v) => onConfigChange({ endpoint: v })}
            onBlur={onSummaryFieldsBlur}
            placeholder={copy.endpointPlaceholder}
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
                onBlur={onSummaryFieldsBlur}
                placeholder={hasSavedKey ? copy.keyPlaceholderSaved : copy.keyPlaceholderEmpty}
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
              {keyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </MemoryEngineSoftField>

        {onConnectionStatusChange && connectionStatus ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {connectionStatus !== 'idle' ? <ConnectionStatusLine status={connectionStatus} /> : <span className="min-w-0 flex-1" />}
            <Pressable
              type="button"
              disabled={disabled || pinging || !isSummaryConfigReadyForPing(config, hasSavedKey ?? false)}
              onClick={() => void handleTestConnection()}
              className="shrink-0 rounded-full border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              {pinging ? '测试中…' : '测试连通'}
            </Pressable>
          </div>
        ) : null}
      </div>

      <SummaryModelSection {...modelSectionProps} />
    </div>
  )
}
