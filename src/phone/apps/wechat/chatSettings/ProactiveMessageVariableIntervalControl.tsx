import { useCallback, useEffect, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import {
  pickDisplayUnitForSeconds,
  PROACTIVE_MESSAGE_INTERVAL_UNITS,
  PROACTIVE_MESSAGE_NUMBER_FONT,
  type ProactiveMessageIntervalUnit,
  secondsToUnitValue,
} from '../proactivePrivateMessageTypes'
import {
  formatProactiveVariableIdleRangeLabel,
  normalizeProactiveVariableIdleBounds,
  PROACTIVE_VARIABLE_IDLE_PRESETS,
  resolveProactiveVariableIdleBounds,
  type ProactiveVariableIdleBounds,
} from '../proactiveVariableInterval'

const numStyle = { fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT } as const

function formatUnitDraft(value: number): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}

function unitValueToVariableSeconds(value: number, unit: ProactiveMessageIntervalUnit): number {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return 1
  if (unit === 'second') return Math.round(v)
  if (unit === 'minute') return Math.round(v * 60)
  return Math.round(v * 3600)
}

type BoundFieldProps = {
  label: string
  seconds: number
  onChange: (seconds: number) => void
}

function BoundField({ label, seconds, onChange }: BoundFieldProps) {
  const [unit, setUnit] = useState<ProactiveMessageIntervalUnit>(() => pickDisplayUnitForSeconds(seconds))
  const [draftInput, setDraftInput] = useState(() =>
    formatUnitDraft(secondsToUnitValue(seconds, unit)),
  )

  useEffect(() => {
    const nextUnit = pickDisplayUnitForSeconds(seconds)
    setUnit(nextUnit)
    setDraftInput(formatUnitDraft(secondsToUnitValue(seconds, nextUnit)))
  }, [seconds])

  const syncToSeconds = useCallback(() => {
    const raw = draftInput.trim()
    if (!raw) {
      setDraftInput(formatUnitDraft(secondsToUnitValue(seconds, unit)))
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      setDraftInput(formatUnitDraft(secondsToUnitValue(seconds, unit)))
      return
    }
    onChange(unitValueToVariableSeconds(n, unit))
  }, [draftInput, onChange, seconds, unit])

  return (
    <div>
      <span className="text-[12px] text-[#666666]">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={draftInput}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
              setDraftInput(raw)
            }
          }}
          onBlur={syncToSeconds}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              syncToSeconds()
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent text-[18px] text-black outline-none"
          style={numStyle}
          aria-label={label}
        />
        <div className="flex shrink-0 gap-1">
          {PROACTIVE_MESSAGE_INTERVAL_UNITS.map((u) => {
            const active = unit === u.id
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setUnit(u.id)
                  setDraftInput(formatUnitDraft(secondsToUnitValue(seconds, u.id)))
                }}
                className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                  active ? 'bg-black text-white' : 'bg-[#f2f2f2] text-[#666666]'
                }`}
              >
                {u.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ProactiveMessageVariableIntervalControl({
  savedBounds,
  scheduleSaved,
  onSave,
  saving = false,
}: {
  savedBounds: ProactiveVariableIdleBounds
  scheduleSaved: boolean
  onSave: (bounds: ProactiveVariableIdleBounds) => void | Promise<void>
  saving?: boolean
}) {
  const [draftBounds, setDraftBounds] = useState(savedBounds)

  useEffect(() => {
    setDraftBounds(savedBounds)
  }, [savedBounds.minSeconds, savedBounds.maxSeconds])

  const dirty =
    draftBounds.minSeconds !== savedBounds.minSeconds ||
    draftBounds.maxSeconds !== savedBounds.maxSeconds

  const draftRangeLabel = formatProactiveVariableIdleRangeLabel({
    proactiveMessageVariableIntervalMinSeconds: draftBounds.minSeconds,
    proactiveMessageVariableIntervalMaxSeconds: draftBounds.maxSeconds,
  })
  const savedRangeLabel = formatProactiveVariableIdleRangeLabel({
    proactiveMessageVariableIntervalMinSeconds: savedBounds.minSeconds,
    proactiveMessageVariableIntervalMaxSeconds: savedBounds.maxSeconds,
  })

  const presetActive = PROACTIVE_VARIABLE_IDLE_PRESETS.find(
    (preset) =>
      preset.minSeconds === draftBounds.minSeconds && preset.maxSeconds === draftBounds.maxSeconds,
  )?.id

  const applyBounds = useCallback((next: ProactiveVariableIdleBounds) => {
    setDraftBounds(normalizeProactiveVariableIdleBounds(next.minSeconds, next.maxSeconds))
  }, [])

  const handleSave = () => {
    void onSave(normalizeProactiveVariableIdleBounds(draftBounds.minSeconds, draftBounds.maxSeconds))
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-black" style={numStyle}>
          {dirty ? `待保存：${draftRangeLabel}` : `随机区间 ${savedRangeLabel}`}
        </span>
        {scheduleSaved ? (
          <span className="text-[11px] text-[#8e8e8e]">
            已保存 {savedRangeLabel}
            {dirty ? ' · 修改未生效' : ' · 每次触达后重新随机'}
          </span>
        ) : (
          <span className="text-[11px] text-[#8e8e8e]">保存后区间才会生效并开始随机倒计时</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {PROACTIVE_VARIABLE_IDLE_PRESETS.map((preset) => {
          const active = presetActive === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                applyBounds({
                  minSeconds: preset.minSeconds,
                  maxSeconds: preset.maxSeconds,
                })
              }
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

      <div className="mt-3 space-y-3">
        <BoundField
          label="最短等待"
          seconds={draftBounds.minSeconds}
          onChange={(minSeconds) =>
            applyBounds({
              minSeconds,
              maxSeconds: draftBounds.maxSeconds,
            })
          }
        />
        <BoundField
          label="最长等待"
          seconds={draftBounds.maxSeconds}
          onChange={(maxSeconds) =>
            applyBounds({
              minSeconds: draftBounds.minSeconds,
              maxSeconds,
            })
          }
        />
      </div>

      <Pressable
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-3 flex h-10 w-full items-center justify-center rounded-[10px] bg-black text-[14px] font-medium text-white transition-opacity active:opacity-90 disabled:opacity-50"
      >
        {saving ? '保存中…' : '保存区间'}
      </Pressable>

      <p className="mt-2 text-[11px] leading-relaxed text-[#8e8e8e]">
        每次主动消息触发后，会在该区间内重新随机下一次等待。角色说忙或开启忙碌后，系统仍会自动拉长到约{' '}
        <span style={numStyle}>5 分钟～2 小时</span>。
      </p>
    </div>
  )
}

export function resolveSavedProactiveVariableIdleBounds(
  row:
    | {
        proactiveMessageVariableIntervalMinSeconds?: number
        proactiveMessageVariableIntervalMaxSeconds?: number
      }
    | null
    | undefined,
): ProactiveVariableIdleBounds {
  return resolveProactiveVariableIdleBounds(row)
}
