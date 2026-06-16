import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MemoryModelIdText } from '../../wechat/memory/MemoryModelIdText'
import { InlineDropdown } from '../../wechat/newFriendsPersona/InlineDropdown'
import { apiTheme } from '../theme'
import { fetchModels, testConnectionSim } from '../apiSim'
import type { ApiConfig } from '../types'
import { TextField } from './TextField'

export function ApiConfigBlock({
  title,
  config,
  onChange,
  showTest = true,
  mode = 'full',
  footer,
}: {
  title: string
  config: ApiConfig
  onChange: (next: ApiConfig) => void
  showTest?: boolean
  mode?: 'full' | 'asr'
  footer?: ReactNode
}) {
  const [keyVisible, setKeyVisible] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [modelOpen, setModelOpen] = useState(false)

  useEffect(() => {
    if (!config.modelList.length) setModelOpen(false)
  }, [config.modelList.length])

  const canPullModels = useMemo(() => !!config.apiUrl.trim() && !!config.apiKey.trim(), [config.apiKey, config.apiUrl])

  const pullModels = async () => {
    setTestMsg(null)
    setModelLoading(true)
    const res = await fetchModels(config)
    setModelLoading(false)
    if (!res.ok) {
      setTestMsg({ ok: false, text: res.error })
      return
    }
    const next = { ...config, modelList: res.models, modelId: config.modelId || res.models[0] || '' }
    onChange(next)
    setTestMsg({ ok: true, text: '模型拉取成功' })
  }

  const testConn = async () => {
    setTestMsg(null)
    setTestLoading(true)
    const res = await testConnectionSim(config)
    setTestLoading(false)
    if (!res.ok) {
      const next = { ...config, lastTest: { ok: false, message: res.error, at: Date.now() } }
      onChange(next)
      setTestMsg({ ok: false, text: res.error })
      return
    }
    const next = { ...config, lastTest: { ok: true, message: '连接成功', at: Date.now() } }
    onChange(next)
    setTestMsg({ ok: true, text: '连接成功' })
  }

  const asrMode = mode === 'asr'

  const selectedModelLabel = config.modelList.length
    ? (config.modelId || config.modelList[0] || '').trim() || '请选择'
    : '请先拉取模型'

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
      <p className="text-[16px] font-semibold" style={{ color: apiTheme.text }}>
        {title}
      </p>
      <div className="mt-4 space-y-4">
        {!asrMode ? (
          <TextField
            label="API URL"
            value={config.apiUrl}
            onChange={(v) => onChange({ ...config, apiUrl: v })}
            placeholder="https://api.example.com/v1"
          />
        ) : null}

        <TextField
          label="API Key"
          value={config.apiKey}
          onChange={(v) => onChange({ ...config, apiKey: v })}
          placeholder="sk-..."
          type={keyVisible ? 'text' : 'password'}
          right={
            <button
              type="button"
              className="rounded-lg p-2 transition-all duration-200 ease-out hover:opacity-80"
              onClick={() => setKeyVisible((v) => !v)}
              style={{ color: apiTheme.subText }}
              aria-label={keyVisible ? '隐藏 Key' : '显示 Key'}
            >
              {keyVisible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        />

        {!asrMode ? (
          <>
            <button
              type="button"
              onClick={() => void pullModels()}
              disabled={!canPullModels || modelLoading}
              className="w-full rounded-xl px-5 py-3 text-[14px] font-medium text-white transition-all duration-200 ease-out disabled:opacity-60"
              style={{ background: '#8e8e8e' }}
            >
              {modelLoading ? '拉取中...' : '拉取模型'}
            </button>

            <label className="block">
              <span className="text-[12px]" style={{ color: apiTheme.subText }}>
                模型
              </span>
              <div className="mt-2">
                <InlineDropdown
                  label="选择模型"
                  valueText={
                    config.modelList.length ? (
                      <MemoryModelIdText text={selectedModelLabel} />
                    ) : (
                      selectedModelLabel
                    )
                  }
                  open={modelOpen}
                  disabled={!config.modelList.length}
                  onToggle={() => setModelOpen((v) => !v)}
                >
                  <div className="flex flex-col gap-2 px-3 py-2">
                    {config.modelList.map((m) => {
                      const active = m === config.modelId
                      return (
                        <button
                          key={m}
                          type="button"
                          className="w-full rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold transition-all duration-200 ease-out"
                          style={{
                            borderColor: '#e5e5e5',
                            background: active ? '#111827' : '#ffffff',
                            color: active ? '#ffffff' : '#000000',
                          }}
                          onClick={() => {
                            onChange({ ...config, modelId: m })
                            setModelOpen(false)
                          }}
                        >
                          <MemoryModelIdText text={m} className="break-all" />
                        </button>
                      )
                    })}
                  </div>
                </InlineDropdown>
              </div>
            </label>
          </>
        ) : (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{ border: `1px solid ${apiTheme.border}`, background: '#fff', color: apiTheme.subText }}
          >
            识别模型固定为 `FunAudioLLM/SenseVoiceSmall`，无需手动选择。
          </div>
        )}

        {showTest ? (
          <button
            type="button"
            onClick={() => void testConn()}
            disabled={testLoading}
            className="w-full rounded-xl px-5 py-3 text-[14px] font-medium text-white transition-all duration-200 ease-out disabled:opacity-60"
            style={{ background: apiTheme.accent }}
          >
            {testLoading ? '测试中...' : '测试连接'}
          </button>
        ) : null}

        {testMsg ? (
          <div
            className="rounded-xl px-4 py-3 text-[13px]"
            style={{
              border: `1px solid ${apiTheme.border}`,
              background: '#fff',
              color: testMsg.ok ? apiTheme.text : apiTheme.subText,
            }}
          >
            {testMsg.text}
          </div>
        ) : null}
        {footer ? <div>{footer}</div> : null}
      </div>
    </div>
  )
}

