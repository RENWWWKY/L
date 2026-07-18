import type { ReactNode } from 'react'
import {
  formatLocalEmbeddingByteHint,
  type LocalEmbeddingDownloadProgress,
} from './localEmbeddingDownloadProgress'
import { MemoryApiModeCapsule, type MemoryApiMode } from './MemoryApiModeCapsule'
import { MemoryEmbeddingProviderCapsule } from './MemoryEmbeddingProviderCapsule'
import { MemoryEngineSoftSwitch } from './MemoryEngineSoftSwitch'
import { MemoryLocalEmbeddingModelPicker } from './MemoryLocalEmbeddingModelPicker'
import type { MemoryEmbeddingProviderMode } from './memoryEmbeddingProvider'
import { getLocalEmbeddingModelOption } from './memoryEmbeddingConstants'
import {
  buildLocalEmbeddingModelConfigProbeUrl,
} from './localEmbeddingRemoteHost'
import type { ConnectionStatus, VectorAPIConfig } from './memoryEngineConfigTypes'
import { VectorBridgeConfig } from './VectorBridgeConfig'
import type { EmbeddingPullSource } from './vectorEmbeddingPullSource'

function EngineCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
      {title ? <h3 className="text-[16px] font-semibold tracking-tight text-gray-900">{title}</h3> : null}
      <div className={title ? 'mt-4 space-y-4' : 'space-y-4'}>{children}</div>
    </div>
  )
}

function ConfigBlock({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-100/90 bg-gray-50/70 px-4 py-3.5">
      <div className={`flex items-start gap-4 ${children ? 'mb-3' : ''}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900">{title}</p>
          {description ? (
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

function LocalModelDownloadProgressBar({
  progress,
  downloading,
}: {
  progress: LocalEmbeddingDownloadProgress | null
  downloading: boolean
}) {
  if (!downloading) return null

  const label = progress?.label ?? '等待 Worker 进度…'
  const percent = progress?.percent
  const byteHint = formatLocalEmbeddingByteHint(progress?.loadedBytes, progress?.totalBytes)

  return (
    <div className="mt-3" role="status" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-right tabular-nums text-gray-700">
          {percent != null ? `${percent}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gray-900 transition-[width] duration-150 ease-out"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      {byteHint ? <p className="mt-1 text-[10px] tabular-nums text-gray-400">{byteHint}</p> : null}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  on,
  onToggle,
  disabled,
}: {
  label: string
  description?: string
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-gray-900">{label}</p>
        {description ? (
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{description}</p>
        ) : null}
      </div>
      <MemoryEngineSoftSwitch on={on} onToggle={onToggle} disabled={disabled} />
    </div>
  )
}

export function MemoryVectorRecallConfig({
  vectorRecallEnabled,
  onToggleVectorRecall,
  embeddingProviderMode,
  onEmbeddingProviderModeChange,
  localEmbeddingModelId,
  onLocalEmbeddingModelChange,
  localModelDownloaded,
  localModelDownloading,
  localModelDownloadProgress,
  localModelDownloadError,
  onLocalModelDownload,
  vectorDedicatedApiEnabled,
  onVectorApiModeChange,
  vectorConfig,
  onVectorConfigChange,
  onVectorFieldsBlur,
  hasSavedEmbeddingKey,
  connectionStatus,
  onConnectionStatusChange,
  onTestConnection,
  embeddingPullSource,
  embeddingModelDraft,
  onEmbeddingModelChange,
  embeddingModelList,
  embeddingModelsLoading,
  modelsPullMsg,
  onPullEmbeddingModels,
  embeddingModelDropdownOpen,
  onEmbeddingModelDropdownToggle,
}: {
  vectorRecallEnabled: boolean
  onToggleVectorRecall: () => void
  embeddingProviderMode: MemoryEmbeddingProviderMode
  onEmbeddingProviderModeChange: (mode: MemoryEmbeddingProviderMode) => void
  localEmbeddingModelId: string
  onLocalEmbeddingModelChange: (modelId: string) => void
  localModelDownloaded: boolean
  localModelDownloading: boolean
  localModelDownloadProgress: LocalEmbeddingDownloadProgress | null
  localModelDownloadError: string | null
  onLocalModelDownload: (force: boolean) => void
  vectorDedicatedApiEnabled: boolean
  onVectorApiModeChange: (mode: MemoryApiMode) => void
  vectorConfig: VectorAPIConfig
  onVectorConfigChange: (patch: Partial<VectorAPIConfig>) => void
  onVectorFieldsBlur: () => void
  hasSavedEmbeddingKey: boolean
  connectionStatus: ConnectionStatus
  onConnectionStatusChange: (s: ConnectionStatus) => void
  onTestConnection: (cfg: VectorAPIConfig) => Promise<ConnectionStatus>
  embeddingPullSource: EmbeddingPullSource | null
  embeddingModelDraft: string
  onEmbeddingModelChange: (modelId: string) => void
  embeddingModelList: string[]
  embeddingModelsLoading: boolean
  modelsPullMsg: { ok: boolean; text: string } | null
  onPullEmbeddingModels: () => void
  embeddingModelDropdownOpen: boolean
  onEmbeddingModelDropdownToggle: () => void
}) {
  const showLocalSection = embeddingProviderMode !== 'api'
  const showApiSection = embeddingProviderMode !== 'local'
  const localModelMeta = getLocalEmbeddingModelOption(localEmbeddingModelId)
  const localModelProbeUrl = buildLocalEmbeddingModelConfigProbeUrl(localEmbeddingModelId)

  return (
    <div className="space-y-4">
      <EngineCard title="语义向量召回">
        <div data-memory-coach="vector-recall">
          <ToggleRow
            label="开启语义召回"
            description="根据最近聊天内容，语义检索相关长期记忆并注入 prompt"
            on={vectorRecallEnabled}
            onToggle={onToggleVectorRecall}
          />
        </div>

        {vectorRecallEnabled ? (
          <>
            <ConfigBlock
              title="向量计算"
              description={
                embeddingProviderMode === 'auto'
                  ? '优先使用浏览器本地模型；本地不可用时自动回落到 API'
                  : embeddingProviderMode === 'local'
                    ? '全部向量计算在浏览器内完成，不调用 API'
                    : '全部向量计算走 embedding 接口'
              }
            >
              <div data-memory-coach="embedding-provider">
                <MemoryEmbeddingProviderCapsule
                  value={embeddingProviderMode}
                  onChange={onEmbeddingProviderModeChange}
                />
              </div>
            </ConfigBlock>

            {showLocalSection ? (
              <ConfigBlock
                title="本地模型"
                description="从预设列表选择，首次使用需下载到浏览器缓存；GitHub Pages / Worker 线路请先开梯子"
              >
                <MemoryLocalEmbeddingModelPicker
                  value={localEmbeddingModelId}
                  disabled={localModelDownloading}
                  onChange={onLocalEmbeddingModelChange}
                />
                <p className="mt-2 text-[10px] text-gray-400">{localModelMeta.id}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {localModelDownloaded ? (
                    <span className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      已下载
                    </span>
                  ) : (
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500">
                      未下载
                    </span>
                  )}
                  <a
                    href={localModelProbeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-amber-300/90 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-950 transition-colors hover:bg-amber-100/70"
                  >
                    打开梯子下载
                  </a>
                  <button
                    type="button"
                    disabled={localModelDownloading}
                    onClick={() => onLocalModelDownload(localModelDownloaded)}
                    className={`ml-auto rounded-full border px-4 py-1.5 text-[12px] font-medium transition-colors ${
                      localModelDownloading
                        ? 'cursor-wait border-gray-200 bg-gray-50 text-gray-400'
                        : 'border-gray-900 bg-white text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {localModelDownloading
                      ? '下载中…'
                      : localModelDownloaded
                        ? '重新下载'
                        : '下载模型'}
                  </button>
                </div>
                <LocalModelDownloadProgressBar
                  progress={localModelDownloadProgress}
                  downloading={localModelDownloading}
                />
                {localModelDownloadError ? (
                  <p className="mt-2 text-[11px] text-red-500">{localModelDownloadError}</p>
                ) : null}
              </ConfigBlock>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-gray-400">
            关闭后不再做语义检索，仅保留关键词与「始终注入」类记忆。
          </p>
        )}
      </EngineCard>

      {vectorRecallEnabled && showApiSection ? (
        <EngineCard title={vectorDedicatedApiEnabled ? '向量专用接口' : '向量 API 回落'}>
          <div data-memory-coach="extra-api">
            <MemoryApiModeCapsule
              value={vectorDedicatedApiEnabled ? 'dedicated' : 'main'}
              onChange={onVectorApiModeChange}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              {embeddingProviderMode === 'auto'
                ? '本地模型失败时使用此接口；也可在此选择 embedding 模型'
                : vectorDedicatedApiEnabled
                  ? '填写专用 embedding 网关地址与密钥'
                  : '沿用聊天主接口的地址与密钥'}
            </p>
          </div>

          <div data-memory-coach="vector-model" className="mt-4">
            <VectorBridgeConfig
              embedded
              mode={vectorDedicatedApiEnabled ? 'dedicated' : 'main'}
              config={vectorDedicatedApiEnabled ? vectorConfig : undefined}
              onConfigChange={vectorDedicatedApiEnabled ? onVectorConfigChange : undefined}
              onVectorFieldsBlur={vectorDedicatedApiEnabled ? onVectorFieldsBlur : undefined}
              hasSavedKey={vectorDedicatedApiEnabled ? hasSavedEmbeddingKey : undefined}
              connectionStatus={vectorDedicatedApiEnabled ? connectionStatus : undefined}
              onConnectionStatusChange={vectorDedicatedApiEnabled ? onConnectionStatusChange : undefined}
              onTestConnection={vectorDedicatedApiEnabled ? onTestConnection : undefined}
              pullSource={embeddingPullSource}
              embeddingModelDraft={embeddingModelDraft}
              onEmbeddingModelChange={onEmbeddingModelChange}
              embeddingModelList={embeddingModelList}
              embeddingModelsLoading={embeddingModelsLoading}
              modelsPullMsg={modelsPullMsg}
              onPullModels={onPullEmbeddingModels}
              embeddingModelDropdownOpen={embeddingModelDropdownOpen}
              onEmbeddingModelDropdownToggle={onEmbeddingModelDropdownToggle}
            />
          </div>
        </EngineCard>
      ) : null}
    </div>
  )
}
