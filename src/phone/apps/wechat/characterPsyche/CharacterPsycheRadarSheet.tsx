import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { Activity, ArrowDown, ArrowUp, X } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import {
  CHARACTER_PSYCHE_PAGES,
  psycheMetricDelta,
  type CharacterPsycheMetricKey,
  type CharacterPsycheMetricsSnapshot,
  type CharacterPsychePageId,
  type CharacterPsycheState,
} from './characterPsycheTypes'
import type { CharacterPsychePageSummaries } from './characterPsycheSummaries'
import { formatCharacterPsycheGeneratedAt } from './characterPsycheStore'

const INK = '#111827'
const MUTED = '#9CA3AF'
const TRACK = '#F3F4F6'
const FILL = '#1C1C1E'
const SHEET_SPRING = { type: 'spring' as const, damping: 34, stiffness: 360 }

const BAR_STAGGER = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
} as const

const BAR_ITEM = {
  hidden: { opacity: 0, x: -6 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
} as const

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function MetricDeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="w-[38px] shrink-0" aria-hidden />
  }
  const up = delta > 0
  return (
    <span
      className="flex w-[38px] shrink-0 items-center justify-end gap-0.5 font-mono text-[9px] tabular-nums leading-none"
      style={{ color: INK }}
      aria-label={up ? `较上一轮上升 ${delta}` : `较上一轮下降 ${Math.abs(delta)}`}
    >
      {up ? <ArrowUp size={10} strokeWidth={2.25} aria-hidden /> : <ArrowDown size={10} strokeWidth={2.25} aria-hidden />}
      <span>{up ? `+${delta}` : String(delta)}</span>
    </span>
  )
}

function PsycheMetricBar({
  label,
  value,
  delta,
  animateFill,
}: {
  label: string
  value: number
  delta: number | null
  animateFill: boolean
}) {
  const pct = clampPct(value)
  return (
    <motion.div variants={BAR_ITEM} className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-[0.44]">
        <p className="truncate text-[11px] tracking-wide text-[#9CA3AF]">{label}</p>
      </div>
      <div className="flex min-w-0 flex-[0.56] items-center gap-1.5">
        <div className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: TRACK }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: FILL }}
            initial={{ width: 0 }}
            animate={{ width: animateFill ? `${pct}%` : 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          />
        </div>
        <span className="w-7 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: MUTED }}>
          {pct}%
        </span>
        <MetricDeltaBadge delta={delta} />
      </div>
    </motion.div>
  )
}

function PsychePagePanel({
  pageIndex,
  activePage,
  state,
  previousMetrics,
  summary,
}: {
  pageIndex: number
  activePage: number
  state: CharacterPsycheState
  previousMetrics: CharacterPsycheMetricsSnapshot | null
  summary: string
}) {
  const page = CHARACTER_PSYCHE_PAGES[pageIndex]
  if (!page) return null
  const animateFill = activePage === pageIndex

  return (
    <div className="flex w-full shrink-0 flex-col px-1">
      <motion.div
        key={`page-${page.id}-${animateFill ? 'on' : 'off'}`}
        variants={BAR_STAGGER}
        initial="hidden"
        animate={animateFill ? 'show' : 'hidden'}
        className="space-y-0.5"
      >
        {page.metrics.map((m) => (
          <PsycheMetricBar
            key={m.key}
            label={m.zh}
            value={state[m.key as CharacterPsycheMetricKey]}
            delta={psycheMetricDelta(state[m.key as CharacterPsycheMetricKey], previousMetrics?.[m.key as CharacterPsycheMetricKey])}
            animateFill={animateFill}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: animateFill ? 1 : 0, y: animateFill ? 0 : 6 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: animateFill ? 0.22 : 0 }}
        className="mt-5 border-t border-[#F3F4F6] pt-4"
      >
        <p className="text-[10px] tracking-wide" style={{ color: MUTED }}>
          状态侧写
        </p>
        <p className="mt-2 font-serif text-[13px] italic leading-relaxed" style={{ color: INK }}>
          {summary}
        </p>
      </motion.div>
    </div>
  )
}

export type CharacterPsycheRadarSheetProps = {
  open: boolean
  onClose: () => void
  loading?: boolean
  generating?: boolean
  generateError?: string | null
  onDismissGenerateError?: () => void
  onGenerate?: () => void
  characterName: string
  avatarUrl?: string
  state: CharacterPsycheState | null
  summaries?: CharacterPsychePageSummaries | null
  previousMetrics?: CharacterPsycheMetricsSnapshot | null
  lastGeneratedAt?: number | null
}

export function CharacterPsycheRadarSheet({
  open,
  onClose,
  loading = false,
  generating = false,
  generateError = null,
  onDismissGenerateError,
  onGenerate,
  characterName,
  avatarUrl,
  state,
  summaries = null,
  previousMetrics = null,
  lastGeneratedAt = null,
}: CharacterPsycheRadarSheetProps) {
  const err = String(generateError ?? '').trim()
  const [activePage, setActivePage] = useState(0)
  const pageCount = CHARACTER_PSYCHE_PAGES.length
  const carouselRef = useRef<HTMLDivElement>(null)
  const [carouselWidth, setCarouselWidth] = useState(0)

  useLayoutEffect(() => {
    if (!open) return
    const el = carouselRef.current
    if (!el) return
    const measure = () => setCarouselWidth(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setActivePage(0), 0)
    return () => window.clearTimeout(t)
  }, [open])

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const threshold = 56
      const vx = info.velocity.x
      const offset = info.offset.x
      if (offset < -threshold || vx < -420) {
        setActivePage((p) => Math.min(pageCount - 1, p + 1))
      } else if (offset > threshold || vx > 420) {
        setActivePage((p) => Math.max(0, p - 1))
      }
    },
    [pageCount],
  )

  const affection = state ? clampPct(state.affection) : 0
  const affectionDelta = state ? psycheMetricDelta(state.affection, previousMetrics?.affection) : null

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1310] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <Pressable
            type="button"
            aria-label="关闭体征监测"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          >
            {null}
          </Pressable>

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="psyche-radar-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            className="relative mx-auto flex h-[75vh] max-h-[75vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[22px] border border-[#F3F4F6] bg-white/95 shadow-[0_-12px_48px_rgba(17,24,39,0.12)] backdrop-blur-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" aria-hidden />
            </div>

            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1">
              <div className="flex items-center gap-2">
                <Activity size={16} strokeWidth={1.75} style={{ color: INK }} aria-hidden />
                <div>
                  <p id="psyche-radar-title" className="text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
                    体征与心理监测
                  </p>
                  {lastGeneratedAt ? (
                    <p className="mt-0.5 text-[10px] tracking-wide" style={{ color: MUTED }}>
                      上次生成 {formatCharacterPsycheGeneratedAt(lastGeneratedAt)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onGenerate ? (
                  <Pressable
                    type="button"
                    onClick={onGenerate}
                    disabled={generating || loading}
                    className="rounded-[10px] border border-[#111827] px-3 py-1.5 text-[12px] font-medium tracking-wide transition-colors disabled:opacity-45"
                    style={{ color: INK }}
                  >
                    {generating ? '生成中…' : '生成状态'}
                  </Pressable>
                ) : null}
                <Pressable
                  type="button"
                  onClick={onClose}
                  aria-label="关闭"
                  className="flex size-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white transition-transform active:scale-95"
                >
                  <X size={16} strokeWidth={1.75} style={{ color: MUTED }} aria-hidden />
                </Pressable>
              </div>
            </div>

            {err ? (
              <div className="mx-5 mb-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5">
                <p className="text-[12px] leading-relaxed" style={{ color: INK }}>
                  {err}
                </p>
                {onDismissGenerateError ? (
                  <Pressable
                    type="button"
                    onClick={onDismissGenerateError}
                    className="mt-2 text-[11px] underline"
                    style={{ color: MUTED }}
                  >
                    知道了
                  </Pressable>
                ) : null}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 [scrollbar-width:thin]">
              {/* Core Profile */}
              <div className="grid grid-cols-3 items-start border-b border-[#F3F4F6] pb-5 pt-1">
                <div aria-hidden />
                <div className="flex flex-col items-center text-center">
                  <div className="size-16 overflow-hidden rounded-full border border-[#F3F4F6] bg-[#F9FAFB] shadow-sm">
                    {avatarUrl?.trim() ? (
                      <img src={avatarUrl.trim()} alt="" className="size-full object-cover" draggable={false} />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[20px] font-light" style={{ color: MUTED }}>
                        {characterName.trim().slice(0, 1) || '?'}
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[17px] font-semibold tracking-tight" style={{ color: INK }}>
                    {characterName.trim() || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-end justify-end gap-1.5">
                    <p className="font-mono text-3xl font-medium tabular-nums leading-none" style={{ color: INK }}>
                      {loading ? '—' : affection}
                    </p>
                    {!loading ? <MetricDeltaBadge delta={affectionDelta} /> : null}
                  </div>
                  <p className="mt-1 text-[10px] tracking-wide" style={{ color: MUTED }}>
                    好感度
                  </p>
                </div>
              </div>

              {/* Pagination Tabs */}
              <div className="mt-5 flex items-center justify-center gap-1 border-b border-[#F3F4F6] pb-3">
                {CHARACTER_PSYCHE_PAGES.map((p, idx) => {
                  const active = idx === activePage
                  return (
                    <Pressable
                      key={p.id}
                      type="button"
                      onClick={() => setActivePage(idx)}
                      className="rounded-md px-2.5 py-1.5 transition-colors"
                      style={{
                        background: active ? '#F9FAFB' : 'transparent',
                      }}
                    >
                      <span
                        className="block text-[11px] font-medium tracking-wide"
                        style={{ color: active ? INK : MUTED }}
                      >
                        {p.tabIndex} {p.tabZh}
                      </span>
                    </Pressable>
                  )
                })}
              </div>

              <div className="mt-2 flex justify-center gap-1.5 pb-3">
                {CHARACTER_PSYCHE_PAGES.map((p, idx) => (
                  <span
                    key={`dot-${p.id}`}
                    className="size-1.5 rounded-full transition-colors"
                    style={{ background: idx === activePage ? INK : '#E5E7EB' }}
                    aria-hidden
                  />
                ))}
              </div>

              {/* Swipeable pages */}
              {loading ? (
                <div className="space-y-4 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-2 w-24 animate-pulse rounded bg-[#F3F4F6]" />
                      <div className="h-1 flex-1 animate-pulse rounded-full bg-[#F3F4F6]" />
                    </div>
                  ))}
                </div>
              ) : state ? (
                <div ref={carouselRef} className="overflow-hidden">
                  <motion.div
                    className="flex touch-pan-y"
                    style={{ width: `${pageCount * 100}%` }}
                    drag="x"
                    dragConstraints={{
                      left: carouselWidth > 0 ? -(pageCount - 1) * carouselWidth : 0,
                      right: 0,
                    }}
                    dragElastic={0.12}
                    onDragEnd={onDragEnd}
                    animate={{ x: `-${(activePage * 100) / pageCount}%` }}
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  >
                    {CHARACTER_PSYCHE_PAGES.map((p, idx) => (
                      <div key={p.id} className="shrink-0" style={{ width: `${100 / pageCount}%` }}>
                        <PsychePagePanel
                          pageIndex={idx}
                          activePage={activePage}
                          state={state}
                          previousMetrics={previousMetrics}
                          summary={summaries?.[p.id as CharacterPsychePageId]?.trim() || '暂无侧写总结。'}
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>
              ) : (
                <p className="py-10 text-center text-[13px]" style={{ color: MUTED }}>
                  暂无体征数据
                </p>
              )}

              <p className="mt-6 text-center text-[10px] tracking-wide" style={{ color: '#D1D5DB' }}>
                左右滑动切换维度
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
