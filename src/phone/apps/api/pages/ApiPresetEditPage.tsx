import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useApiSettings } from '../ApiSettingsContext'
import { apiTheme } from '../theme'
import { ApiConfigBlock } from '../components/ApiConfigBlock'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ToggleSwitch } from '../components/ToggleSwitch'
import { TopNav } from '../components/TopNav'
import type { ApiPreset, SubApiType } from '../types'

const SUB_META: Record<SubApiType, { title: string; desc: string }> = {
  xinyu: { title: '心语', desc: '用于生成约会心语内容' },
  chatCard: { title: '聊天记录卡片', desc: '用于生成聊天记录卡片文案' },
  danmaku: { title: '弹幕', desc: '用于生成弹幕内容' },
  voiceAsr: { title: '语音识别', desc: '用于语音通话长按麦克风转文字（模型：FunAudioLLM/SenseVoiceSmall）' },
}

function clonePreset(p: ApiPreset): ApiPreset {
  return JSON.parse(JSON.stringify(p)) as ApiPreset
}

export function ApiPresetEditPage() {
  const nav = useNavigate()
  const { id } = useParams()
  const { presets, upsertPreset, createPreset } = useApiSettings()

  const initialPreset = useMemo(() => {
    if (id === 'new') return null
    if (!id) return null
    return presets.find((p) => p.id === id) ?? null
  }, [id, presets])

  const [draft, setDraft] = useState<ApiPreset>(() => {
    if (initialPreset) return clonePreset(initialPreset)
    const p = createPreset()
    return p
  })
  const [dirty, setDirty] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [voiceAsrCollapsed, setVoiceAsrCollapsed] = useState(false)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (initialPreset) setDraft(clonePreset(initialPreset))
  }, [initialPreset])

  const title = initialPreset ? '编辑预设' : '新建预设'

  const setField = <K extends keyof ApiPreset>(k: K, v: ApiPreset[K]) => {
    setDirty(true)
    setDraft((s) => ({ ...s, [k]: v, updatedAt: Date.now() }))
  }

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1400)
  }

  const validate = (): string | null => {
    if (!draft.name.trim()) return '请填写预设名称'
    if (!draft.main.apiUrl.trim()) return '请填写主接口 API URL'
    if (!draft.main.apiKey.trim()) return '请填写主接口 API Key'
    return null
  }

  const save = () => {
    const err = validate()
    if (err) {
      showToast(err)
      return
    }
    upsertPreset({ ...draft, updatedAt: Date.now() })
    setDirty(false)
    setSaveOk(true)
  }

  const askBack = () => {
    if (dirty) setConfirmLeave(true)
    else nav('/')
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden" style={{ background: apiTheme.bg, fontFamily: apiTheme.font }}>
      <TopNav
        title={title}
        onBack={askBack}
        right={
          <button
            type="button"
            onClick={save}
            className="rounded-lg px-2 py-1 text-[16px] font-semibold transition-all duration-200 ease-out hover:opacity-80"
            style={{ color: apiTheme.accent }}
          >
            保存
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(20px+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-4 mt-4 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
          <p className="text-[14px]" style={{ color: apiTheme.subText }}>
            预设名称
          </p>
          <input
            value={draft.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="给预设起个名字（如：我的GPT-4o）"
            className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-[16px] outline-none transition-all duration-200 ease-out"
            style={{ border: `1px solid ${apiTheme.border}`, color: apiTheme.text }}
            onFocus={(e) => (e.currentTarget.style.borderColor = apiTheme.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = apiTheme.border)}
          />
        </div>

        <ApiConfigBlock
          title="主接口（全局默认）"
          config={draft.main}
          onChange={(next) => setField('main', next)}
          showTest
        />

        <p className="mx-4 mt-6 text-[16px] font-semibold" style={{ color: apiTheme.text }}>
          副接口（可选，优先使用）
        </p>

        {(Object.keys(SUB_META) as SubApiType[]).map((k) => {
          const meta = SUB_META[k]
          const sub = draft.sub[k]
          return (
            <div key={k} className="mx-4 mt-3 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold" style={{ color: apiTheme.text }}>
                    {meta.title}
                  </p>
                  <p className="mt-1 text-[14px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
                    {meta.desc}
                  </p>
                </div>
                {k !== 'voiceAsr' ? (
                  <div className="flex items-center gap-2">
                    <p className="text-[12px]" style={{ color: apiTheme.subText }}>
                      使用主接口
                    </p>
                    <ToggleSwitch
                      checked={sub.useMainApi}
                      onChange={(v) => {
                        setDirty(true)
                        setDraft((s) => ({
                          ...s,
                          updatedAt: Date.now(),
                          sub: { ...s.sub, [k]: { ...s.sub[k], useMainApi: v, apiConfig: v ? s.sub[k].apiConfig : s.sub[k].apiConfig } },
                        }))
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-[12px]" style={{ color: apiTheme.subText }}>
                      开启语音识别
                    </p>
                    <ToggleSwitch
                      checked={!!sub.enabled}
                      onChange={(v) => {
                        setDirty(true)
                        setDraft((s) => ({
                          ...s,
                          updatedAt: Date.now(),
                          sub: { ...s.sub, [k]: { ...s.sub[k], enabled: v, useMainApi: false } },
                        }))
                      }}
                    />
                    <button
                      type="button"
                      aria-label={voiceAsrCollapsed ? '展开语音识别配置' : '收起语音识别配置'}
                      className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md"
                      onClick={() => setVoiceAsrCollapsed((v) => !v)}
                      style={{ color: apiTheme.subText }}
                    >
                      <ChevronDown
                        className={`size-4 transition-transform duration-200 ${voiceAsrCollapsed ? 'rotate-0' : 'rotate-180'}`}
                        strokeWidth={1.8}
                      />
                    </button>
                  </div>
                )}
              </div>

              {(k === 'voiceAsr' ? !voiceAsrCollapsed : true) && (k === 'voiceAsr' || !sub.useMainApi) ? (
                <div className="mt-4">
                  <ApiConfigBlock
                    title="独立配置"
                    config={sub.apiConfig}
                    onChange={(next) => {
                      setDirty(true)
                      setDraft((s) => ({
                        ...s,
                        updatedAt: Date.now(),
                        sub: {
                          ...s.sub,
                          [k]: {
                            ...s.sub[k],
                            enabled: typeof s.sub[k].enabled === 'boolean' ? s.sub[k].enabled : true,
                            useMainApi: k === 'voiceAsr' ? false : s.sub[k].useMainApi,
                            apiConfig: next,
                          },
                        },
                      }))
                    }}
                    showTest={k !== 'voiceAsr'}
                    mode={k === 'voiceAsr' ? 'asr' : 'full'}
                    footer={
                      k === 'voiceAsr' ? (
                        <div
                          className="rounded-xl px-4 py-3 text-[12px]"
                          style={{ border: `1px solid ${apiTheme.border}`, background: '#fff', color: apiTheme.subText }}
                        >
                          语音识别 Key 获取：{' '}
                          <a
                            href="https://account.siliconflow.cn/zh/login?redirect=https%3A%2F%2Fcloud.siliconflow.cn%2Fme%2Fmodels%3F"
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: apiTheme.accent, textDecoration: 'underline' }}
                          >
                            硅基流动控制台
                          </a>
                        </div>
                      ) : null
                    }
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="未保存的修改"
        message="你有未保存的修改，确定要返回吗？"
        confirmText="放弃修改"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false)
          nav('/')
        }}
      />

      <ConfirmDialog
        open={saveOk}
        title="保存成功"
        message="预设已保存。"
        confirmText="返回"
        cancelText="继续编辑"
        onCancel={() => setSaveOk(false)}
        onConfirm={() => {
          setSaveOk(false)
          nav('/')
        }}
      />

      {toast ? (
        <div className="pointer-events-none absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl bg-white px-4 py-2 text-[13px]" style={{ boxShadow: apiTheme.shadow, color: apiTheme.text }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}

