import { useCallback, useEffect, useState } from 'react'
import { MemoryEngineSoftSwitch } from '../wechat/memory/MemoryEngineSoftSwitch'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  resolveMeetAutoSummaryEnabled,
  resolveMeetAutoSummaryInterval,
} from './meetMemorySummarySettings'

function clampInterval(n: number): number {
  if (!Number.isFinite(n)) return 10
  return Math.max(1, Math.min(100, Math.floor(n)))
}

export function MeetMemorySummarySettingsCard() {
  const [hydrated, setHydrated] = useState(false)
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [intervalN, setIntervalN] = useState(10)

  const reload = useCallback(async () => {
    const settings = await personaDb.getMemorySettings()
    setAutoSummaryEnabled(resolveMeetAutoSummaryEnabled(settings))
    setIntervalN(resolveMeetAutoSummaryInterval(settings))
    setHydrated(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const on = () => void reload()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [reload])

  const toggleAutoSummary = async () => {
    const next = !autoSummaryEnabled
    setAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ meetAutoSummaryEnabled: next })
  }

  const commitInterval = async (raw: number) => {
    const n = clampInterval(raw)
    setIntervalN(n)
    await personaDb.putMemorySettings({ meetAutoSummaryInterval: n })
  }

  if (!hydrated) {
    return (
      <div className="mx-4 mt-4 rounded-[14px] border border-black/[0.06] bg-white/70 px-4 py-3 text-center text-[12px] font-light text-[#b0aba3]">
        正在读取记忆总结设置…
      </div>
    )
  }

  return (
    <section
      aria-label="遇见自动总结设置"
      className="mx-4 mt-4 rounded-[14px] border border-black/[0.06] bg-white/85 px-4 py-3.5 shadow-[0_8px_28px_rgba(22,18,14,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-elegant-serif text-[14px] tracking-[0.06em] text-[#2c2a26]">自动总结</p>
          <p className="mt-1 text-[11px] font-light leading-relaxed text-[#8a847b]">
            与微信记忆引擎设置独立；写入的长期记忆仍共用同一库。
          </p>
        </div>
        <MemoryEngineSoftSwitch
          on={autoSummaryEnabled}
          onToggle={() => void toggleAutoSummary()}
          aria-label="遇见自动总结开关"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.05] pt-3">
        <div>
          <p className="text-[13px] font-light text-[#5c574f]">总结间隔</p>
          <p className="mt-0.5 text-[11px] font-light text-[#a8a39c]">每满 N 轮 NPC 文字回复触发一次</p>
        </div>
        <div
          className={`rounded-xl border px-3 py-1.5 transition-colors ${
            autoSummaryEnabled
              ? 'border-[#D4AF37]/35 bg-[#faf9f7] focus-within:border-[#D4AF37]/55'
              : 'border-black/[0.06] bg-[#f5f3ef] opacity-50'
          }`}
        >
          <input
            type="number"
            min={1}
            max={100}
            value={intervalN}
            disabled={!autoSummaryEnabled}
            onChange={(e) => setIntervalN(Number(e.target.value))}
            onBlur={() => void commitInterval(intervalN)}
            className="w-12 border-0 bg-transparent text-center text-[15px] font-medium text-[#2c2a26] outline-none disabled:cursor-not-allowed"
            aria-label="遇见自动总结间隔轮数"
          />
        </div>
      </div>
    </section>
  )
}
