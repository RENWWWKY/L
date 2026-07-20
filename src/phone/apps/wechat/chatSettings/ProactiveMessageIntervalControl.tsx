import { useCallback, useEffect, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import {
  formatProactiveMessageIntervalLabel,
  pickDisplayUnitForSeconds,
  PROACTIVE_MESSAGE_INTERVAL_UNITS,
  PROACTIVE_MESSAGE_NUMBER_FONT,
  PROACTIVE_MESSAGE_PRESETS,
  resolveProactiveMessageIntervalSeconds,
  secondsToUnitValue,
  type ProactiveMessageIntervalUnit,
  unitValueToSeconds,
} from '../proactivePrivateMessageTypes'

const numStyle = { fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT } as const

function formatUnitDraft(value: number): string {
  if (!Number.isFinite(value)) return ''
  // 去掉多余尾零，便于编辑（如 1.0 → 1）
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}

export function ProactiveMessageIntervalControl({
  savedIntervalSeconds,
  scheduleSaved,
  onSave,
  saving = false,
}: {
  /** 已落库的间隔（秒） */
  savedIntervalSeconds: number
  /** 是否已至少保存过一次（保存后才会开始倒计时/调度） */
  scheduleSaved: boolean
  onSave: (seconds: number) => void | Promise<void>
  saving?: boolean
}) {
  const storedSeconds = resolveProactiveMessageIntervalSeconds({
    proactiveMessageIntervalSeconds: savedIntervalSeconds,
  })

  const [draftSeconds, setDraftSeconds] = useState(storedSeconds)
  const [unit, setUnit] = useState<ProactiveMessageIntervalUnit>(() =>
    pickDisplayUnitForSeconds(storedSeconds),
  )
  const [draftInput, setDraftInput] = useState(() =>
    formatUnitDraft(secondsToUnitValue(storedSeconds, unit)),
  )

  useEffect(() => {
    setDraftSeconds(storedSeconds)
    const nextUnit = pickDisplayUnitForSeconds(storedSeconds)
    setUnit(nextUnit)
    setDraftInput(formatUnitDraft(secondsToUnitValue(storedSeconds, nextUnit)))
  }, [storedSeconds])

  const dirty = draftSeconds !== storedSeconds
  const draftLabel = formatProactiveMessageIntervalLabel(draftSeconds)
  const savedLabel = formatProactiveMessageIntervalLabel(storedSeconds)

  /** 预设等：可按秒数自动挑选展示单位 */
  const applyDraftSeconds = useCallback((nextSeconds: number, preferUnit?: ProactiveMessageIntervalUnit) => {
    const clamped = resolveProactiveMessageIntervalSeconds({
      proactiveMessageIntervalSeconds: nextSeconds,
    })
    setDraftSeconds(clamped)
    const nextUnit = preferUnit ?? pickDisplayUnitForSeconds(clamped)
    setUnit(nextUnit)
    setDraftInput(formatUnitDraft(secondsToUnitValue(clamped, nextUnit)))
  }, [])

  const onUnitChange = (nextUnit: ProactiveMessageIntervalUnit) => {
    let seconds = draftSeconds
    let display = secondsToUnitValue(seconds, nextUnit)
    // 从「秒」切到分/时若不足 1 个单位，抬到 1，避免立刻被钳回秒并看起来像选不了
    if (nextUnit !== 'second' && display < 1) {
      display = 1
      seconds = unitValueToSeconds(1, nextUnit)
      setDraftSeconds(
        resolveProactiveMessageIntervalSeconds({ proactiveMessageIntervalSeconds: seconds }),
      )
    }
    setUnit(nextUnit)
    setDraftInput(formatUnitDraft(display))
  }

  const parseDraftInput = useCallback((): number | null => {
    const raw = draftInput.trim()
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return n
  }, [draftInput])

  /** 失焦结算时保留用户当前选的单位，不要按秒数自动改回「秒」 */
  const syncDraftValueToSeconds = useCallback(() => {
    const n = parseDraftInput()
    if (n == null) {
      setDraftInput(formatUnitDraft(secondsToUnitValue(draftSeconds, unit)))
      return
    }
    const clamped = resolveProactiveMessageIntervalSeconds({
      proactiveMessageIntervalSeconds: unitValueToSeconds(n, unit),
    })
    setDraftSeconds(clamped)
    setDraftInput(formatUnitDraft(secondsToUnitValue(clamped, unit)))
  }, [draftSeconds, parseDraftInput, unit])

  const presetActive = PROACTIVE_MESSAGE_PRESETS.find((p) => p.seconds === draftSeconds)?.id

  const handleSave = () => {
    const n = parseDraftInput()
    const next = n == null ? draftSeconds : unitValueToSeconds(n, unit)
    void onSave(resolveProactiveMessageIntervalSeconds({ proactiveMessageIntervalSeconds: next }))
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-black" style={numStyle}>
          {dirty ? `待保存：${draftLabel}` : savedLabel}
        </span>
        {scheduleSaved ? (
          <span className="text-[11px] text-[#8e8e8e]">
            已保存 {savedLabel}
            {dirty ? ' · 修改未生效' : ' · 再次保存将重置倒计时'}
          </span>
        ) : (
          <span className="text-[11px] text-[#8e8e8e]">保存后间隔才会生效并开始倒计时</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {PROACTIVE_MESSAGE_PRESETS.map((preset) => {
          const active = presetActive === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyDraftSeconds(preset.seconds)}
              className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                active
                  ? 'bg-black text-white'
                  : 'border border-[#e5e5e5] bg-[#f7f7f7] text-[#333333]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2">
          <input
            type="text"
            inputMode="decimal"
            value={draftInput}
            onChange={(e) => {
              const raw = e.target.value
              // 允许清空后重输；仅拦非法字符
              if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                setDraftInput(raw)
              }
            }}
            onBlur={syncDraftValueToSeconds}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                syncDraftValueToSeconds()
              }
            }}
            className="min-w-0 w-full border-0 bg-transparent text-[18px] text-black outline-none"
            style={numStyle}
            aria-label="主动消息间隔数值"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PROACTIVE_MESSAGE_INTERVAL_UNITS.map((u) => {
            const active = unit === u.id
            return (
              <button
                key={u.id}
                type="button"
                // 避免点击单位时输入框先 blur 把单位钳回「秒」
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUnitChange(u.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                  active ? 'bg-black text-white' : 'bg-[#f2f2f2] text-[#666666]'
                }`}
              >
                {u.label}
              </button>
            )
          })}
        </div>
      </div>

      <Pressable
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-3 flex h-10 w-full items-center justify-center rounded-[10px] bg-black text-[14px] font-medium text-white transition-opacity active:opacity-90 disabled:opacity-50"
      >
        {saving ? '保存中…' : '保存间隔'}
      </Pressable>

      <p className="mt-2 text-[11px] text-[#8e8e8e]">
        最短间隔 <span style={numStyle}>30</span> 秒；保存后立即按新间隔重新计时。角色会结合上下文主动发消息，避免重复上一轮内容。
      </p>
    </div>
  )
}
