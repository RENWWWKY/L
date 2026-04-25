import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatGlobalSettingsRow, WeChatTimeConfig } from '../newFriendsPersona/types'
import { useWeChatCurrentTime } from '../time/useWeChatCurrentTime'
import {
  formatWeChatChatTimestamp,
  normalizeWeChatTimeConfig,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../time/wechatTimeUtils'

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out" style={{ left: on ? 26 : 4 }} />
    </button>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="w-full rounded-[12px] border border-[#e5e5e5] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">{children}</div>
}

function multiplierText(multiplier: number) {
  if (Math.abs(multiplier - Math.round(multiplier)) < 0.001) return `1 : ${Math.round(multiplier)}`
  return `1 : ${multiplier.toFixed(2)}`
}

export function WeChatTimeSettingsScreen({ onBack }: { onBack: () => void }) {
  const [gs, setGs] = useState<WeChatGlobalSettingsRow | null>(null)
  const { currentTimeMs } = useWeChatCurrentTime()

  const load = useCallback(async () => {
    const row = await personaDb.getGlobalSettings()
    setGs(row)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onChange = () => void load()
    window.addEventListener('wechat-storage-changed', onChange)
    return () => window.removeEventListener('wechat-storage-changed', onChange)
  }, [load])

  const config = useMemo(() => normalizeWeChatTimeConfig(gs?.globalTimeConfig), [gs?.globalTimeConfig])
  const saveConfig = useCallback(
    async (next: WeChatTimeConfig) => {
      await personaDb.putGlobalSettings({ globalTimeConfig: normalizeWeChatTimeConfig(next) })
      await load()
    },
    [load],
  )

  const previewMessageTime = useMemo(() => currentTimeMs - 2 * 24 * 60 * 60 * 1000, [currentTimeMs])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f9f9f9]">
      <header className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f9f9f9] px-3 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity active:opacity-70">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Pressable>
        <h1 className="min-w-0 flex-1 text-center text-[18px] font-semibold text-[#000000]">时间同步</h1>
        <div className="w-10 shrink-0" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[16px] font-medium text-[#111111]">使用自定义时间</p>
                <p className="mt-1 text-[13px] text-[#888888]">关闭后聊天时间戳回到系统本地时间</p>
              </div>
              <WxSwitch
                on={config.mode === 'custom'}
                onToggle={() =>
                  void saveConfig({
                    ...config,
                    mode: config.mode === 'custom' ? 'system' : 'custom',
                    customAnchorRealTime: Date.now(),
                  })
                }
              />
            </div>
          </Card>

          <Card>
            <div className="space-y-3">
              <div className="rounded-[10px] bg-[#f9f9f9] px-3 py-3">
                <p className="text-[12px] uppercase tracking-[0.08em] text-[#888888]">当前应用时间</p>
                <p className="mt-1 text-[20px] font-semibold text-[#111111]">{formatWeChatChatTimestamp(currentTimeMs, currentTimeMs)}</p>
                <p className="mt-1 text-[13px] text-[#888888]">{new Date(currentTimeMs).toLocaleString('zh-CN', { hour12: false })}</p>
              </div>
              <div className={`${config.mode === 'custom' ? '' : 'pointer-events-none opacity-45'}`}>
                <label className="block text-[14px] text-[#333333]">
                  <span>设定当前时间</span>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocalValue(config.customBaseTime)}
                    onChange={(e) =>
                      void saveConfig({
                        ...config,
                        mode: 'custom',
                        customBaseTime: parseDateTimeLocalValue(e.target.value),
                        customAnchorRealTime: Date.now(),
                      })
                    }
                    className="mt-2 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#111111] outline-none"
                  />
                </label>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] text-[#333333]">时间流速</span>
                    <span className="text-[13px] text-[#888888]">{multiplierText(config.timeMultiplier)}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={240}
                    value={Math.round(config.timeMultiplier)}
                    onChange={(e) =>
                      void saveConfig({
                        ...config,
                        mode: 'custom',
                        timeMultiplier: Math.max(1, Number(e.target.value) || 1),
                        customBaseTime: currentTimeMs,
                        customAnchorRealTime: Date.now(),
                      })
                    }
                    className="mt-2 w-full accent-black"
                  />
                  <input
                    type="number"
                    min={1}
                    max={86400}
                    step={1}
                    value={Math.round(config.timeMultiplier)}
                    onChange={(e) =>
                      void saveConfig({
                        ...config,
                        mode: 'custom',
                        timeMultiplier: Math.max(1, Number(e.target.value) || 1),
                        customBaseTime: currentTimeMs,
                        customAnchorRealTime: Date.now(),
                      })
                    }
                    className="mt-3 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#111111] outline-none"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[14px] font-medium text-[#111111]">时间戳预览</p>
            <div className="mt-3 flex justify-center">
              <span className="text-[12px] text-[#999999]">{formatWeChatChatTimestamp(previewMessageTime, currentTimeMs)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
