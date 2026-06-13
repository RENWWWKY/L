import TextareaAutosize from 'react-textarea-autosize'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { SettingsMechanismAccordion } from './SettingsMechanismAccordion'
import {
  DEFAULT_USER_MOMENT_ENGAGEMENT_RULES,
  USER_MOMENT_ENGAGEMENT_PRESET_OPTIONS,
  type UserMomentEngagementPresetId,
  type UserMomentEngagementRulesSettings,
} from './userMomentEngagementRules'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'

const ENGAGEMENT_SLIDER_CLASS =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E5E7EB] accent-[#111827] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827]'

function clampPercentValue(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(100, Math.round(value)))
}

function clampMaxInteractValue(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(30, Math.round(value)))
}

function EngagementSliderRow({
  id,
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  valueLabel,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  valueLabel: string
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="text-[12px] font-medium text-[#374151]">
            {label}
          </label>
          {hint ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#9CA3AF]">{hint}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#111827]">
          {valueLabel}
        </span>
      </div>
      <div className="mt-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={ENGAGEMENT_SLIDER_CLASS}
        />
      </div>
    </div>
  )
}

export function MomentsUserEngagementRulesPanel() {
  const { settings, patchSettings } = useMomentsSettingsStore()
  const rules = settings.userMomentEngagement ?? DEFAULT_USER_MOMENT_ENGAGEMENT_RULES
  const isCustom = rules.presetId === 'custom'
  const [expanded, setExpanded] = useState(true)

  const patchRules = (patch: Partial<UserMomentEngagementRulesSettings>) => {
    patchSettings({
      userMomentEngagement: {
        ...rules,
        ...patch,
      },
    })
  }

  const selectPreset = (id: UserMomentEngagementPresetId) => {
    patchRules({ presetId: id })
  }

  const selectedMeta = USER_MOMENT_ENGAGEMENT_PRESET_OPTIONS.find((p) => p.id === rules.presetId)
  const collapsedSummary = selectedMeta?.title ?? '未选择'

  return (
    <section className="rounded-3xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-5 py-6 text-left outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">
            USER POST ENGAGEMENT
          </p>
          <h2 className="mt-1 text-[16px] font-semibold tracking-[0.01em] text-[#111827]">
            用户朋友圈互动规则
          </h2>
          {!expanded ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[#6B7280]">
              当前档位：
              <span className="font-medium text-[#374151]">{collapsedSummary}</span>
              {selectedMeta ? ` — ${selectedMeta.summary}` : null}
            </p>
          ) : (
            <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF]">
              仅影响<strong className="font-medium text-[#6B7280]">你本人发出</strong>
              的朋友圈：角色点赞、评论与浏览记录的频繁程度。
            </p>
          )}
        </div>
        <span
          className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <ChevronDown className="size-4" strokeWidth={1.75} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="engagement-rules-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 pt-0">
              <SettingsMechanismAccordion
                triggerLabel="点击阅读底层原理 (View Mechanism)"
                body="发布用户动态后，系统会按可见名单与人脉关系挑选好友参与互动，并为未互动的好友补浏览足迹。此处调节的是「有多少人会动、动到什么程度」，不会改动角色主动发圈（见「主动发布」页）。"
              />

              <div className="mt-5 space-y-2">
                {USER_MOMENT_ENGAGEMENT_PRESET_OPTIONS.map((preset) => {
                  const active = rules.presetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors outline-none ${
                        active
                          ? 'border-2 border-[#111827] bg-white text-[#111827]'
                          : 'border-[#E5E7EB] bg-[#FAFAFA] text-[#374151] hover:border-[#D1D5DB]'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] font-semibold">{preset.title}</span>
                        <span
                          className={`text-[10px] uppercase tracking-[0.16em] ${
                            active ? 'text-[#6B7280]' : 'text-[#9CA3AF]'
                          }`}
                        >
                          {preset.subtitle}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-[12px] leading-relaxed ${
                          active ? 'text-[#374151]' : 'text-[#6B7280]'
                        }`}
                      >
                        {preset.summary}
                      </p>
                    </button>
                  )
                })}
              </div>

              {selectedMeta && !isCustom ? (
                <p className="mt-4 rounded-2xl bg-[#F9FAFB] px-4 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  当前：<span className="font-medium text-[#374151]">{selectedMeta.title}</span> —{' '}
                  {selectedMeta.summary}
                </p>
              ) : null}

              {isCustom ? (
                <div className="mt-5 space-y-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
                  <div>
                    <label
                      className="text-[13px] font-medium text-[#374151]"
                      htmlFor="user-moment-engagement-custom"
                    >
                      自定义互动法则
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                      用自然语言描述你希望角色如何反应，例如「只有闺蜜和恋人会评论，其他人最多点赞」「搞笑内容才评，日常只浏览」。
                    </p>
                    <TextareaAutosize
                      id="user-moment-engagement-custom"
                      minRows={4}
                      maxRows={10}
                      value={rules.customPrompt}
                      onChange={(e) => patchRules({ customPrompt: e.target.value })}
                      placeholder="例：熟人必赞；一般朋友见有趣内容才评；整体别太吵，别全员围观。"
                      className="mt-2 w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#111827] outline-none focus:border-[#9CA3AF]"
                    />
                  </div>

                  <div className="space-y-4">
                    <EngagementSliderRow
                      id="user-moment-engagement-participation"
                      label="列表好友参与比例"
                      hint="本条动态可见名单里，有多少好友会进入互动候选。"
                      value={rules.customAiParticipationPercent ?? 70}
                      min={0}
                      max={100}
                      valueLabel={`${rules.customAiParticipationPercent ?? 70}%`}
                      onChange={(value) =>
                        patchRules({
                          customAiParticipationPercent: clampPercentValue(value, 70),
                        })
                      }
                    />
                    <EngagementSliderRow
                      id="user-moment-engagement-fallback-like"
                      label="保底点赞强度"
                      value={rules.customFallbackLikePercent ?? 60}
                      min={0}
                      max={100}
                      valueLabel={`${rules.customFallbackLikePercent ?? 60}%`}
                      onChange={(value) =>
                        patchRules({
                          customFallbackLikePercent: clampPercentValue(value, 60),
                        })
                      }
                    />
                    <EngagementSliderRow
                      id="user-moment-engagement-viewed"
                      label="浏览足迹比例"
                      value={rules.customViewedFootprintPercent ?? 80}
                      min={0}
                      max={100}
                      valueLabel={`${rules.customViewedFootprintPercent ?? 80}%`}
                      onChange={(value) =>
                        patchRules({
                          customViewedFootprintPercent: clampPercentValue(value, 80),
                        })
                      }
                    />
                    <EngagementSliderRow
                      id="user-moment-engagement-max-interact"
                      label="最多互动人数"
                      hint="单条动态里，点赞、评论或浏览等互动最多来自多少人。"
                      value={rules.customMaxAiCharacters ?? 18}
                      min={1}
                      max={30}
                      valueLabel={`${rules.customMaxAiCharacters ?? 18} 人`}
                      onChange={(value) =>
                        patchRules({
                          customMaxAiCharacters: clampMaxInteractValue(value, 18),
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
