import TextareaAutosize from 'react-textarea-autosize'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Eye } from 'lucide-react'
import { useState } from 'react'

import { MomentsSerifNumericText } from './ArchiveTimelineDateColumn'
import { SettingsMechanismAccordion } from './SettingsMechanismAccordion'
import {
  CUSTOM_ENGAGEMENT_SLIDER_SECTIONS,
  DEFAULT_USER_MOMENT_ENGAGEMENT_RULES,
  USER_MOMENT_ENGAGEMENT_PRESET_OPTIONS,
  describeCustomEngagementHeat,
  describeCustomSliderEffect,
  getEngagementPresetMetricRows,
  patchCustomEngagementSliderValue,
  readCustomEngagementSliderValue,
  type CustomEngagementHeatTone,
  type CustomEngagementSliderGuide,
  type EngagementPresetMetricRow,
  type UserMomentEngagementPresetId,
  type UserMomentEngagementRulesSettings,
} from './userMomentEngagementRules'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'

const ENGAGEMENT_SLIDER_CLASS =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#E5E7EB] accent-[#111827] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#111827]'

function EngagementMetricsEyeButton({
  open,
  onToggle,
}: {
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={open ? '收起比例' : '查看比例'}
      aria-pressed={open}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D1D5DB] ${
        open ? 'text-[#6B7280]' : 'text-[#9CA3AF] hover:text-[#6B7280]'
      }`}
    >
      <Eye className="size-3.5" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

function EngagementCustomSliderGuideRow({
  guide,
  rules,
  onPatch,
}: {
  guide: CustomEngagementSliderGuide
  rules: UserMomentEngagementRulesSettings
  onPatch: (patch: Partial<UserMomentEngagementRulesSettings>) => void
}) {
  const value = readCustomEngagementSliderValue(rules, guide)

  return (
    <EngagementSliderRow
      id={`user-moment-engagement-${guide.id}`}
      label={guide.label}
      hint={guide.hint}
      lowLabel={guide.lowLabel}
      highLabel={guide.highLabel}
      effectText={describeCustomSliderEffect(guide.id, value)}
      value={value}
      min={guide.min}
      max={guide.max}
      step={guide.step}
      valueLabel={guide.formatValueLabel(value)}
      onChange={(next) => onPatch(patchCustomEngagementSliderValue(guide, next))}
    />
  )
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
  lowLabel,
  highLabel,
  effectText,
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
  lowLabel?: string
  highLabel?: string
  effectText?: string
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
          <MomentsSerifNumericText text={valueLabel} />
        </span>
      </div>
      <div className="mt-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3">
        {lowLabel || highLabel ? (
          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[#9CA3AF]">
            <span>{lowLabel ?? ''}</span>
            <span>{highLabel ?? ''}</span>
          </div>
        ) : null}
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
        {effectText ? (
          <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">{effectText}</p>
        ) : null}
      </div>
    </div>
  )
}

const CUSTOM_HEAT_TONE_STYLES: Record<
  CustomEngagementHeatTone,
  { badge: string; bar: string }
> = {
  quiet: {
    badge: 'bg-[#EEF2FF] text-[#4338CA]',
    bar: 'from-[#CBD5E1] to-[#94A3B8]',
  },
  soft: {
    badge: 'bg-[#F3F4F6] text-[#6B7280]',
    bar: 'from-[#D1D5DB] to-[#9CA3AF]',
  },
  balanced: {
    badge: 'bg-[#ECFDF5] text-[#047857]',
    bar: 'from-[#A7F3D0] to-[#34D399]',
  },
  lively: {
    badge: 'bg-[#FFF7ED] text-[#C2410C]',
    bar: 'from-[#FDBA74] to-[#F97316]',
  },
  hot: {
    badge: 'bg-[#FEF2F2] text-[#B91C1C]',
    bar: 'from-[#FCA5A5] to-[#EF4444]',
  },
}

function CustomEngagementHeatBanner({
  settings,
}: {
  settings: UserMomentEngagementRulesSettings
}) {
  const heat = describeCustomEngagementHeat(settings)
  const toneStyle = CUSTOM_HEAT_TONE_STYLES[heat.tone]

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#374151]">整体感受</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{heat.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneStyle.badge}`}
        >
          {heat.label}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${toneStyle.bar}`}
          style={{ width: `${heat.heatPercent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[11px] leading-relaxed text-[#9CA3AF]">
        <p>
          <MomentsSerifNumericText text={heat.compareText} />
        </p>
        <p>{heat.viewedText}</p>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#9CA3AF]">
        想更冷清：优先降低「参与与关系」「单条上限」；想更热闹：往右拖。浏览足迹只影响「看过」，不直接加赞评。
      </p>
    </div>
  )
}

function EngagementPresetMetricsPanel({
  rows,
  title = '比例与上限',
  className = 'mt-3',
}: {
  rows: EngagementPresetMetricRow[]
  title?: string
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
        {title}
      </p>
      <dl className="mt-2 divide-y divide-[#F3F4F6]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <dt className="min-w-0">
              <p className="text-[12px] font-medium text-[#374151]">{row.label}</p>
              {row.hint ? (
                <p className="mt-0.5 text-[10px] leading-relaxed text-[#9CA3AF]">{row.hint}</p>
              ) : null}
            </dt>
            <dd className="shrink-0 text-[12px] font-semibold tabular-nums text-[#111827]">
              <MomentsSerifNumericText text={row.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function MomentsUserEngagementRulesPanel() {
  const { settings, patchSettings } = useMomentsSettingsStore()
  const rules = settings.userMomentEngagement ?? DEFAULT_USER_MOMENT_ENGAGEMENT_RULES
  const isCustom = rules.presetId === 'custom'
  const [expanded, setExpanded] = useState(true)
  const [metricsOpenPresetId, setMetricsOpenPresetId] = useState<UserMomentEngagementPresetId | null>(
    null,
  )

  const toggleMetrics = (presetId: UserMomentEngagementPresetId) => {
    setMetricsOpenPresetId((current) => (current === presetId ? null : presetId))
  }

  const patchRules = (patch: Partial<UserMomentEngagementRulesSettings>) => {
    patchSettings({
      userMomentEngagement: {
        ...rules,
        ...patch,
      },
    })
  }

  const customMetricRows = isCustom ? getEngagementPresetMetricRows('custom', rules) : []

  const selectPreset = (id: UserMomentEngagementPresetId) => {
    patchRules({ presetId: id })
    if (id !== 'custom') {
      setMetricsOpenPresetId((current) => (current === id ? current : null))
    } else {
      setMetricsOpenPresetId(null)
    }
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
              {selectedMeta ? (
                <>
                  {' — '}
                  <MomentsSerifNumericText text={selectedMeta.summary} />
                </>
              ) : null}
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
                  const isCustomPreset = preset.id === 'custom'
                  const metricsOpen = !isCustomPreset && metricsOpenPresetId === preset.id
                  const metricRows = isCustomPreset
                    ? []
                    : getEngagementPresetMetricRows(preset.id)
                  return (
                    <div key={preset.id}>
                      <button
                        type="button"
                        onClick={() => selectPreset(preset.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors outline-none ${
                          active
                            ? 'border-2 border-[#111827] bg-white text-[#111827]'
                            : 'border-[#E5E7EB] bg-[#FAFAFA] text-[#374151] hover:border-[#D1D5DB]'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-0.5">
                            <span className="text-[14px] font-semibold">{preset.title}</span>
                            {!isCustomPreset ? (
                              <EngagementMetricsEyeButton
                                open={metricsOpen}
                                onToggle={() => toggleMetrics(preset.id)}
                              />
                            ) : null}
                          </div>
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
                          <MomentsSerifNumericText text={preset.summary} />
                        </p>
                      </button>
                      {metricsOpen ? (
                        <EngagementPresetMetricsPanel rows={metricRows} />
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {selectedMeta && !isCustom ? (
                <p className="mt-4 rounded-2xl bg-[#F9FAFB] px-4 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  当前：<span className="font-medium text-[#374151]">{selectedMeta.title}</span> —{' '}
                  <MomentsSerifNumericText text={selectedMeta.summary} />
                </p>
              ) : null}

              {isCustom ? (
                <div className="mt-5 space-y-5 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
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

                  <div>
                    <p className="text-[13px] font-medium text-[#374151]">微调参数</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                      下方每一项与「当前生效比例」一一对应，拖动即可直接调整。
                    </p>
                    <div className="mt-3">
                      <CustomEngagementHeatBanner settings={rules} />
                    </div>
                    <div className="mt-4 space-y-5">
                      {CUSTOM_ENGAGEMENT_SLIDER_SECTIONS.map((section) => (
                        <div key={section.title}>
                          <p className="text-[12px] font-semibold text-[#374151]">{section.title}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#9CA3AF]">
                            {section.description}
                          </p>
                          <div className="mt-3 space-y-4">
                            {section.guides.map((guide) => (
                              <EngagementCustomSliderGuideRow
                                key={guide.id}
                                guide={guide}
                                rules={rules}
                                onPatch={patchRules}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <EngagementPresetMetricsPanel
                    rows={customMetricRows}
                    title="当前生效比例"
                    className="mt-0 border-[#E5E7EB] bg-[#F9FAFB]"
                  />
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
