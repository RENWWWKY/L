import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import type {
  MemoryTraceData,
  MemoryTraceLineRelation,
  MemoryTraceMemoryBucket,
} from './memoryTraceTypes'
import { lineRelationUiLabel } from './wechatMemoryLineScope'
import { MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS } from './memory/memorySummaryRetention'
import { stripUnsummarizedOnlineTimestampsForDisplay } from './memoryTraceDisplaySanitize'

export type { MemoryTraceData } from './memoryTraceTypes'

const PLATINUM = '#D4AF37'
const INK = '#1C1C1E'
const SHEET_SPRING = { type: 'spring' as const, damping: 38, stiffness: 380 }

type AccordionId =
  | 'sample'
  | 'wbAfter'
  | 'network'
  | 'core'
  | 'cursor'
  | 'deep'
  | 'timeline'
  | 'todos'

function pct(score: number): string {
  return `${Math.round(score * 1000) / 10}%`
}

function storyTimelineInjectBadge(row: {
  injectKind: 'state' | 'recent' | 'vector'
  label?: string
  isHistorical?: boolean
}) {
  const kindLabel =
    row.injectKind === 'vector' ? '标题召回' : row.injectKind === 'recent' ? '近端固定' : '合并快照'
  const title = row.label?.trim()
  const showTitle =
    !!title && title !== kindLabel && title !== '向量命中' && title !== '近端固定'
  const kindClass =
    row.injectKind === 'vector'
      ? 'bg-emerald-100/70 text-emerald-900'
      : row.injectKind === 'recent'
        ? 'bg-amber-100/70 text-amber-900'
        : 'bg-neutral-200/80 text-neutral-700'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showTitle ? (
        <span className="text-[12px] font-semibold leading-snug text-neutral-800">{title}</span>
      ) : null}
      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${kindClass}`}>{kindLabel}</span>
      {row.isHistorical ? (
        <span className="rounded-md bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">
          历史
        </span>
      ) : null}
    </div>
  )
}

function embeddingModeLabel(mode: 'api' | 'local' | 'auto'): string {
  if (mode === 'local') return '本地向量'
  if (mode === 'api') return 'API 向量'
  return '自动'
}

function InjectionSummaryBar(props: { summary: NonNullable<MemoryTraceData['injectionSummary']> }) {
  const s = props.summary
  const chip = (label: string, active: boolean, tone: 'gold' | 'green' | 'muted' | 'amber' = 'muted') => {
    const styles =
      tone === 'green'
        ? 'bg-emerald-50 text-emerald-800'
        : tone === 'gold'
          ? 'bg-amber-50/90 text-amber-900'
          : tone === 'amber'
            ? 'bg-orange-50 text-orange-900'
            : active
              ? 'bg-neutral-100 text-neutral-700'
              : 'bg-neutral-50 text-neutral-400'
    return (
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${styles}`}>
        {label}
      </span>
    )
  }
  return (
    <div className="rounded-2xl border border-neutral-100 bg-gradient-to-b from-neutral-50/90 to-white p-4 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-neutral-400">INJECTION · 本轮记忆注入</p>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
        与 system prompt 注入顺序对齐：长期记忆 → 剧情时间轴 / 待办事项 → 未总结摘录 → 语义召回。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chip(`关键词 ${s.keywordHitCount}`, s.keywordHitCount > 0, s.keywordHitCount > 0 ? 'gold' : 'muted')}
        {chip(`长期向量 ${s.longTermVectorCount}`, s.longTermVectorCount > 0, s.longTermVectorCount > 0 ? 'gold' : 'muted')}
        {chip(`时间轴`, s.storyTimelineInjected, s.storyTimelineInjected ? 'green' : 'muted')}
        {chip('待办事项', s.todoLedgerInjected === true, s.todoLedgerInjected === true ? 'green' : 'muted')}
        {chip(`未总结私聊`, s.unsummarizedPrivateInjected, s.unsummarizedPrivateInjected ? 'green' : 'muted')}
        {chip(`未总结群聊`, s.unsummarizedGroupInjected, s.unsummarizedGroupInjected ? 'green' : 'muted')}
        {chip(`未总结线下`, s.unsummarizedOfflineInjected, s.unsummarizedOfflineInjected ? 'green' : 'muted')}
        {chip(embeddingModeLabel(s.embeddingProviderMode), true, 'muted')}
        {s.privateRecentRoundsOmitted
          ? chip('私聊最近6轮：已省略', true, 'amber')
          : null}
        {s.offlineRecentRoundsOmitted
          ? chip('线下最近6轮：已省略', true, 'amber')
          : null}
        {s.meetRecentRoundsOmitted ? chip('遇见最近6轮：已省略', true, 'amber') : null}
      </div>
    </div>
  )
}

function MemoryBucketBadge(props: { memoryBucket?: MemoryTraceMemoryBucket }) {
  const bucket = props.memoryBucket
  if (!bucket) return null
  const isLinked = bucket === 'linked'
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{
        background: isLinked ? 'rgba(99,102,241,0.12)' : 'rgba(212,175,55,0.1)',
        color: isLinked ? '#4338ca' : '#8B6914',
      }}
    >
      {isLinked ? '关联记忆' : '角色记忆'}
    </span>
  )
}

function LineScopeBadge(props: {
  sourceLineLabel?: string
  lineRelation?: MemoryTraceLineRelation
  memoryBucket?: MemoryTraceMemoryBucket
}) {
  const label = props.sourceLineLabel?.trim()
  const rel = props.lineRelation
  if (!label && !rel) return null
  const relText = rel ? lineRelationUiLabel(rel) : ''
  const isCurrent = rel === 'current'
  const isOther = rel === 'other'
  return (
    <p className="mb-1 flex flex-wrap items-center gap-1.5">
      <MemoryBucketBadge memoryBucket={props.memoryBucket} />
      {relText ? (
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
          style={{
            background: isCurrent ? 'rgba(212,175,55,0.14)' : isOther ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)',
            color: isCurrent ? '#8B6914' : '#525252',
          }}
        >
          {relText}
        </span>
      ) : null}
      {label ? (
        <span className="text-[10px] font-medium text-neutral-500">马甲 · {label}</span>
      ) : null}
    </p>
  )
}

function AccordionRow(props: {
  titleEn: string
  titleZh: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={props.onToggle}
        className="flex w-full items-center justify-between gap-3 py-4 text-left outline-none transition-colors hover:bg-neutral-50/80"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-neutral-400">{props.titleEn}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold" style={{ color: INK }}>
              {props.titleZh}
            </p>
            {props.badge}
          </div>
        </div>
        <motion.span animate={{ rotate: props.expanded ? 180 : 0 }} transition={{ duration: 0.28 }}>
          <ChevronDown className="size-5 shrink-0 text-neutral-400" strokeWidth={1.5} aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {props.expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 pt-0">{props.children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export type MemoryTraceModalProps = {
  open: boolean
  onClose: () => void
  /** null：尚无记录（未生成过 AI 回复或尚未从本地恢复） */
  data?: MemoryTraceData | null
}

export function MemoryTraceModal({ open, onClose, data }: MemoryTraceModalProps) {
  const [expanded, setExpanded] = useState<Set<AccordionId>>(() => new Set())
  const matrix = data?.contextMatrix

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      setExpanded(data ? new Set<AccordionId>(['deep', 'timeline']) : new Set())
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, data])

  const toggleAccordion = (id: AccordionId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isExpanded = (id: AccordionId) => expanded.has(id)

  const storyTimelineInjected =
    matrix?.storyTimeline?.injected === true && matrix.storyTimeline.promptExcerpt.trim().length > 0
  const todoLedgerInjected =
    matrix?.todoLedger?.injected === true && matrix.todoLedger.promptExcerpt.trim().length > 0

  const injectedOfflinePlotRows = useMemo(
    () => (matrix?.recentContext.unsummarizedOfflinePlots ?? []).filter((row) => row.snippet.trim()),
    [matrix?.recentContext.unsummarizedOfflinePlots],
  )

  const blockVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: { staggerChildren: 0.07, delayChildren: 0.06 },
      },
    }),
    [],
  )

  const itemVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: 12 },
      show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
    }),
    [],
  )

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            aria-label="关闭"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-trace-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            className="relative mx-auto flex max-h-[88vh] w-full max-w-[520px] flex-col rounded-t-[22px] border border-neutral-200/80 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            style={{ color: INK }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
              <div>
                <p id="memory-trace-title" className="text-[11px] font-medium uppercase tracking-[0.32em] text-neutral-400">
                  TRACE MATRIX
                </p>
                <p className="mt-1 text-[17px] font-semibold tracking-tight">思维溯源</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-white transition-transform active:scale-95"
                aria-label="关闭面板"
              >
                <X className="size-[18px] text-neutral-500" strokeWidth={1.75} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-2 [scrollbar-width:thin]">
              {!data ? (
                <div className="flex flex-col items-center justify-center px-2 py-16 text-center">
                  <p className="text-[15px] font-semibold text-neutral-800">暂无思维溯源记录</p>
                  <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-neutral-500">
                    在私聊、群聊或约会剧情中成功生成角色 AI 回复后，会在此展示当轮注入的记忆、时间轴、未总结摘录与语义召回摘要。数据会写入本地
                    IndexedDB，刷新页面后仍会显示<strong className="font-medium text-neutral-700">上一条</strong>记录。
                  </p>
                </div>
              ) : null}
              {data && matrix ? (
              <motion.div variants={blockVariants} initial="hidden" animate="show" className="flex flex-col gap-5 pt-3">
                {data.injectionSummary ? (
                  <motion.div variants={itemVariants}>
                    <InjectionSummaryBar summary={data.injectionSummary} />
                  </motion.div>
                ) : null}

                {data.worldBookAfterChat == null ? (
                  <motion.section
                    variants={itemVariants}
                    className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-4 text-[13px] leading-relaxed text-neutral-500"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-neutral-400">POST-CHAT · 尾声延展</p>
                    <p className="mt-2 font-semibold text-neutral-700">「尾声延展」溯源</p>
                    <p className="mt-2">
                      这条思维溯源是<strong className="font-medium text-neutral-700">在客户端加入「尾声延展」与补丁记录之前</strong>
                      保存到本地的，所以没有「注入快照 / 模型补丁 / 替换前后对照」。再让角色或约会<strong className="font-medium text-neutral-700">任意生成一轮新 AI 回复</strong>
                      后，新记录会带完整板块。
                    </p>
                  </motion.section>
                ) : null}

                <motion.div variants={itemVariants} className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                  <AccordionRow
                    titleEn="TARGET SAMPLE"
                    titleZh="样本锚定 · 最新回复切片"
                    expanded={isExpanded('sample')}
                    onToggle={() => toggleAccordion('sample')}
                  >
                    <div className="px-1">
                      <div className="rounded-xl bg-neutral-50/80 p-4" style={{ borderLeft: `2px solid ${PLATINUM}80` }}>
                        <p className="text-[12px] text-neutral-500">
                          角色 <span className="font-medium text-neutral-700">{data.charName}</span>
                        </p>
                        <p className="mt-3 font-serif text-[16px] italic leading-relaxed text-neutral-900">{data.lastReply}</p>
                      </div>
                    </div>
                  </AccordionRow>

                  <AccordionRow
                    titleEn="DEEP MEMORY"
                    titleZh="深度记忆 · 关键词 + 向量"
                    expanded={isExpanded('deep')}
                    onToggle={() => toggleAccordion('deep')}
                  >
                    <div className="space-y-5 px-1">
                      <p className="text-[11px] leading-relaxed text-neutral-500">
                        长期记忆：关键词命中与向量语义召回。
                      </p>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">Keyword Hits · 关键词命中</p>
                        {matrix.deepMemory.keywordHits.length === 0 ? (
                          <p className="mt-2 text-[12px] text-neutral-400">本轮未命中关键词或始终触发条目</p>
                        ) : null}
                        <ul className="mt-2 space-y-3">
                          {matrix.deepMemory.keywordHits.map((row, i) => (
                            <li
                              key={i}
                              className="flex gap-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <LineScopeBadge
                                  sourceLineLabel={row.sourceLineLabel}
                                  lineRelation={row.lineRelation}
                                  memoryBucket={row.memoryBucket}
                                />
                                <p className="font-mono text-[11px] font-semibold tracking-wide" style={{ color: PLATINUM }}>
                                  {row.keyword}
                                </p>
                                <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">{row.content}</p>
                              </div>
                              {row.relevanceScore != null ? (
                                <span
                                  className="shrink-0 font-mono text-[10px] font-medium tabular-nums"
                                  style={{ color: PLATINUM }}
                                >
                                  Match: {pct(row.relevanceScore)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">Long-term Vector · 长期记忆向量</p>
                        {matrix.deepMemory.vectorRetrievals.length === 0 ? (
                          <p className="mt-2 text-[12px] text-neutral-400">本轮未召回长期记忆向量条目</p>
                        ) : null}
                        <ul className="mt-2 space-y-3">
                          {matrix.deepMemory.vectorRetrievals.map((row, i) => (
                            <li
                              key={i}
                              className="flex gap-3 rounded-lg border border-neutral-100 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                            >
                              <div className="min-w-0 flex-1">
                                <LineScopeBadge
                                  sourceLineLabel={row.sourceLineLabel}
                                  lineRelation={row.lineRelation}
                                  memoryBucket={row.memoryBucket}
                                />
                                <p className="text-[12px] leading-relaxed text-neutral-600">{row.content}</p>
                              </div>
                              <span
                                className="shrink-0 font-mono text-[10px] font-medium tabular-nums"
                                style={{ color: PLATINUM }}
                              >
                                Match: {pct(row.relevanceScore)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </AccordionRow>

                  <AccordionRow
                    titleEn="STORY TIMELINE"
                    titleZh="剧情时间轴"
                    expanded={isExpanded('timeline')}
                    onToggle={() => toggleAccordion('timeline')}
                    badge={
                      storyTimelineInjected ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">已注入</span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">暂无</span>
                      )
                    }
                  >
                    <div className="px-1">
                      <p className="text-[12px] leading-relaxed text-neutral-600">
                        由自动总结维护的结构化时空 / 在场人物 / 未收伏笔；承接剧情时优先对照本块。
                        每条摘要行头为「摘要标题 · 近端固定」或「摘要标题 · 相似 xx%」；锚点公历日早于当前剧情日的行会带「历史」标记与正文内【时效·已发生】横幅。
                      </p>
                      {storyTimelineInjected ? (
                        matrix.storyTimeline!.rows?.length ? (
                          <ul className="mt-3 space-y-3">
                            {matrix.storyTimeline!.rows!.map((row, i) => (
                              <li
                                key={i}
                                className={`rounded-xl border p-3 ${
                                  row.injectKind === 'vector'
                                    ? 'border-emerald-100/80 bg-emerald-50/30'
                                    : row.injectKind === 'recent'
                                      ? 'border-amber-100/80 bg-amber-50/30'
                                      : 'border-neutral-100 bg-neutral-50/50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="min-w-0 flex-1">
                                    {storyTimelineInjectBadge(row)}
                                    <pre className="mt-2 max-h-[min(32vh,280px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-neutral-800 [scrollbar-width:thin]">
                                      {row.content}
                                    </pre>
                                  </div>
                                  {row.relevanceScore != null ? (
                                    <span className="shrink-0 font-mono text-[10px] font-medium tabular-nums text-emerald-800">
                                      sim {pct(row.relevanceScore)}
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <pre className="mt-3 max-h-[min(44vh,440px)] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-amber-100/80 bg-amber-50/30 p-3 font-sans text-[12px] leading-relaxed text-neutral-800 [scrollbar-width:thin]">
                            {matrix.storyTimeline!.promptExcerpt}
                          </pre>
                        )
                      ) : null}
                    </div>
                  </AccordionRow>

                  <AccordionRow
                    titleEn="TODO LEDGER"
                    titleZh="待办事项"
                    expanded={isExpanded('todos')}
                    onToggle={() => toggleAccordion('todos')}
                    badge={
                      todoLedgerInjected ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          已注入 · 未完 {matrix?.todoLedger?.openCount ?? 0}
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                          暂无
                        </span>
                      )
                    }
                  >
                    <div className="px-1">
                      <p className="text-[12px] leading-relaxed text-neutral-600">
                        与 system prompt【当前状态】中的【待办】/【已完成事项】同源；线上回复后模型可判断完成、删除或新增。承接剧情时勿把已完成事项再当成未完义务。
                      </p>
                      {todoLedgerInjected ? (
                        <pre className="mt-3 max-h-[min(44vh,440px)] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-amber-100/80 bg-amber-50/30 p-3 font-sans text-[12px] leading-relaxed text-neutral-800 [scrollbar-width:thin]">
                          {matrix!.todoLedger!.promptExcerpt}
                        </pre>
                      ) : (
                        <p className="mt-3 text-[12px] text-neutral-400">本轮未注入待办台账（台账为空或尚未建立）。</p>
                      )}
                    </div>
                  </AccordionRow>

                  <AccordionRow
                    titleEn="ACTIVE CONTEXT"
                    titleZh="游标上下文 · 未总结摘录"
                    expanded={isExpanded('cursor')}
                    onToggle={() => toggleAccordion('cursor')}
                  >
                    <div className="space-y-4 px-1">
                      <p className="text-[12px] text-neutral-600">
                        当前会话载入近期消息{' '}
                        <span className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: PLATINUM }}>
                          {matrix.recentContext.activeSessionMessages}
                        </span>{' '}
                        条（滑动窗口；与下方「尚未总结」块并列服务于本轮推理）
                      </p>
                      {injectedOfflinePlotRows.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">本轮注入 · 线下剧情（最近 {MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS} 轮 AI）</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                          与 prompt 一致：游标后最近 {MEMORY_UNSUMMARIZED_OFFLINE_INJECT_AI_ROUNDS} 轮 AI 剧情及其间玩家输入以原文注入（优先于上方近端摘要）；此处逐条展示 AI 回复。更早未总结段由剧情时间轴近端摘要 / 长期记忆 / 语义召回承接。
                        </p>
                        <ul className="mt-2 space-y-3">
                          {injectedOfflinePlotRows.map((row, i) => (
                            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-neutral-700">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-400 animate-pulse" aria-hidden />
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{row.date}</p>
                                <p className="mt-1">{row.snippet}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      ) : null}
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">尚未总结 · 私聊与群聊摘录</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                          仅展示各线未总结聊天原文；分线阅读规则仅注入模型，不在此重复展示。
                        </p>
                        <ul className="mt-2 space-y-3">
                          {matrix.recentContext.unsummarizedChats.length === 0 ? (
                            <li className="text-[12px] text-neutral-400">（无尚未总结聊天摘录）</li>
                          ) : null}
                          {matrix.recentContext.unsummarizedChats.map((row, i) => (
                            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-neutral-700">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-400 animate-pulse" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <LineScopeBadge
                                  sourceLineLabel={row.sourceLineLabel}
                                  lineRelation={row.lineRelation}
                                />
                                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-800">
                                  {row.type === 'group' ? `群聊 · ${row.source}` : row.source || '私聊摘录'}
                                </p>
                                <pre className="mt-1 whitespace-pre-wrap font-sans text-[12px] text-neutral-600">
                                  {stripUnsummarizedOnlineTimestampsForDisplay(row.snippet)}
                                </pre>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </AccordionRow>

                  {data.networkRelationships ? (
                    <AccordionRow
                      titleEn="NETWORK RELATIONS"
                      titleZh="人脉关系与看法"
                      expanded={isExpanded('network')}
                      onToggle={() => toggleAccordion('network')}
                    >
                      <div className="space-y-4 px-1">
                        <p className="text-[12px] leading-relaxed text-neutral-600">
                          本轮私聊注入的圈内角色↔角色关系、双方看法与称呼，以及玩家↔圈内人、玩家身份↔本角色绑定边。与发给模型的 system 块同源。
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          视角角色：
                          <span className="font-semibold text-neutral-800">
                            {data.networkRelationships?.focusCharacterName}
                          </span>
                          {' · '}
                          人脉根：
                          <span className="font-semibold text-neutral-800">
                            {data.networkRelationships?.rootCharacterName}
                          </span>
                        </p>

                        {(data.networkRelationships?.involvingFocus?.length ?? 0) > 0 ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              与你直接相关 · 角色↔角色
                            </p>
                            <ul className="mt-2 space-y-2">
                              {data.networkRelationships!.involvingFocus.map((row, i) => (
                                <li
                                  key={`f-${row.fromName}-${row.toName}-${i}`}
                                  className="rounded-lg border border-amber-100/80 bg-amber-50/40 p-3 text-[12px] leading-relaxed text-neutral-800"
                                >
                                  <p className="font-semibold">
                                    {row.fromName} —「{row.relation}」→ {row.toName}
                                    {row.fromCallsTo ? (
                                      <span className="font-normal text-neutral-600">
                                        {' '}
                                        · {row.fromName}称{row.toName}「{row.fromCallsTo}」
                                      </span>
                                    ) : null}
                                  </p>
                                  {row.fromPerspective ? (
                                    <p className="mt-1 text-neutral-600">
                                      {row.fromName}看：{row.fromPerspective}
                                    </p>
                                  ) : null}
                                  {row.toPerspective ? (
                                    <p className="mt-0.5 text-neutral-600">
                                      {row.toName}看：{row.toPerspective}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {(data.networkRelationships?.otherInClique?.length ?? 0) > 0 ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              圈内其他人际 · 角色↔角色
                            </p>
                            <ul className="mt-2 space-y-2">
                              {data.networkRelationships!.otherInClique.map((row, i) => (
                                <li
                                  key={`o-${row.fromName}-${row.toName}-${i}`}
                                  className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 text-[12px] leading-relaxed text-neutral-700"
                                >
                                  <p className="font-semibold">
                                    {row.fromName} —「{row.relation}」→ {row.toName}
                                    {row.fromCallsTo ? (
                                      <span className="font-normal text-neutral-600">
                                        {' '}
                                        · {row.fromName}称{row.toName}「{row.fromCallsTo}」
                                      </span>
                                    ) : null}
                                  </p>
                                  {(row.fromPerspective || row.toPerspective) && (
                                    <p className="mt-1 text-neutral-600">
                                      {[row.fromPerspective && `${row.fromName}看：${row.fromPerspective}`, row.toPerspective && `${row.toName}看：${row.toPerspective}`]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {(data.networkRelationships?.playerLinks?.length ?? 0) > 0 ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              玩家与圈内角色
                            </p>
                            <ul className="mt-2 space-y-2">
                              {data.networkRelationships!.playerLinks.map((row, i) => (
                                <li
                                  key={`pl-${row.targetName}-${i}`}
                                  className="rounded-lg border border-neutral-100 bg-white p-3 text-[12px] text-neutral-700"
                                >
                                  <p className="font-semibold">
                                    「{row.targetName}」
                                    {row.isFocusCharacter ? (
                                      <span className="ml-1.5 text-[10px] font-semibold text-amber-800/90">
                                        当前角色对玩家
                                      </span>
                                    ) : null}
                                  </p>
                                  <ul className="mt-1.5 space-y-0.5 text-neutral-600">
                                    {row.relationThemToYou ? <li>TA对你的关系：{row.relationThemToYou}</li> : null}
                                    {row.theySeeYou ? <li>TA怎么看你：{row.theySeeYou}</li> : null}
                                    {row.relationYouToThem ? <li>你对TA的关系：{row.relationYouToThem}</li> : null}
                                    {row.youSeeThem ? <li>你怎么看TA：{row.youSeeThem}</li> : null}
                                    {row.theyCallYou ? <li>TA称呼你：{row.theyCallYou}</li> : null}
                                    {row.youCallThem ? <li>你称呼TA：{row.youCallThem}</li> : null}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {(data.networkRelationships?.identityEdges?.length ?? 0) > 0 ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              玩家身份 ↔ 本角色
                            </p>
                            <ul className="mt-2 space-y-2">
                              {data.networkRelationships!.identityEdges.map((row, i) => (
                                <li
                                  key={`id-${row.identityName}-${i}`}
                                  className="rounded-lg border border-indigo-100/80 bg-indigo-50/30 p-3 text-[12px] text-neutral-800"
                                >
                                  <span className="rounded-md bg-indigo-100/60 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900/80">
                                    {row.scopeLabel}
                                  </span>
                                  <p className="mt-1.5 font-semibold">「{row.identityName}」—「{row.relation}」</p>
                                  <p className="mt-1 text-neutral-600">{row.summary}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {data.networkRelationships?.promptExcerpt?.trim() ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              注入全文（与模型一致）
                            </p>
                            <pre className="mt-2 max-h-[min(40vh,400px)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 font-sans text-[12px] leading-relaxed text-neutral-700 [scrollbar-width:thin]">
                              {data.networkRelationships.promptExcerpt}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </AccordionRow>
                  ) : null}

                  <AccordionRow
                    titleEn="CORE DIRECTIVES"
                    titleZh="核心基底"
                    expanded={isExpanded('core')}
                    onToggle={() => toggleAccordion('core')}
                  >
                    <div className="space-y-4 px-1">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">人设档案（完整注入）</p>
                        {matrix.baseDirectives.personaDetail?.trim() ? (
                          <pre className="mt-2 max-h-[min(52vh,520px)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 font-sans text-[12px] leading-relaxed text-neutral-700 [scrollbar-width:thin]">
                            {matrix.baseDirectives.personaDetail}
                          </pre>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {matrix.baseDirectives.persona.map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[12px] text-neutral-700"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">世界背景</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{matrix.baseDirectives.worldBackground}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">人设绑定世界书</p>
                        <p className="mt-1 text-[12px] text-neutral-500">
                          角色卡上启用的世界书与各条目正文（与聊天模型注入同源；此处展示全文）
                        </p>
                        <pre className="mt-2 max-h-[min(40vh,420px)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 font-sans text-[12px] leading-relaxed text-neutral-700 [scrollbar-width:thin]">
                          {matrix.baseDirectives.characterWorldBook?.trim() || '（无）'}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">全局世界书</p>
                        <p className="mt-1 text-[12px] text-neutral-500">
                          档案室在当前场景下生效的条目：仅条目标题与正文（不含对话注入用的前言与内置尾注）
                        </p>
                        <pre className="mt-2 max-h-[min(48vh,480px)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 font-sans text-[12px] leading-relaxed text-neutral-700 [scrollbar-width:thin]">
                          {matrix.baseDirectives.globalWorldbook?.trim() || '（无）'}
                        </pre>
                        {!matrix.baseDirectives.globalWorldbook?.trim() && matrix.baseDirectives.worldbooks.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-[11px] text-neutral-400">旧版记录·仅标题</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {matrix.baseDirectives.worldbooks.map((wb, i) => (
                                <span
                                  key={`${wb.title}-${i}`}
                                  className="rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide"
                                  style={{
                                    borderColor: `${PLATINUM}55`,
                                    color: INK,
                                    background: 'rgba(212,175,55,0.06)',
                                  }}
                                >
                                  {wb.type === 'global' ? '[全局]' : '[专属]'} {wb.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </AccordionRow>

                  {data.worldBookAfterChat ? (
                    <AccordionRow
                      titleEn="POST-CHAT LAYER"
                      titleZh="尾声延展（世界书）"
                      expanded={isExpanded('wbAfter')}
                      onToggle={() => toggleAccordion('wbAfter')}
                    >
                      <div className="space-y-4 px-1 text-[13px] leading-relaxed text-neutral-700">
                        <div className="flex flex-wrap gap-2 text-[12px]">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-medium ${
                              data.worldBookAfterChat.protocolInPrompt
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            快照注入：{data.worldBookAfterChat.protocolInPrompt ? '已进本轮 system' : '未启用（无尾声延展条目）'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-medium ${
                              data.worldBookAfterChat.patchOutputRulesIncluded
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            覆盖协议说明：{data.worldBookAfterChat.patchOutputRulesIncluded ? '已附带' : '未附带'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-medium ${
                              (data.worldBookAfterChat.parsedPatches.length ||
                                (data.worldBookAfterChat.autoSummaryPatches?.length ?? 0) > 0)
                                ? 'bg-amber-50 text-amber-900'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            模型 JSON：
                            {data.worldBookAfterChat.parsedPatches.length
                              ? `本轮回复 ${data.worldBookAfterChat.parsedPatches.length} 条`
                              : (data.worldBookAfterChat.autoSummaryPatches?.length ?? 0) > 0
                                ? '本轮无 · 自动总结已补'
                                : '无'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-medium ${
                              data.worldBookAfterChat.appliedToDb ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            写库：{data.worldBookAfterChat.appliedToDb ? '至少一条已写入人设' : '未写入或内容未变'}
                          </span>
                        </div>
                        {data.worldBookAfterChat.modelOmittedPatchBlock ? (
                          <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-950">
                            本轮已向模型要求「有变化则输出 ---WB_AFTER_PATCH---」，但<strong className="font-semibold">未解析到有效补丁</strong>（可能模型未输出、JSON 格式不符，或仅声明无实质字段）。
                          </p>
                        ) : null}
                        {data.worldBookAfterChat.injectedSnapshotEntries?.length ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              注入快照（尾声延展条目）
                            </p>
                            <ul className="mt-2 space-y-3">
                              {data.worldBookAfterChat.injectedSnapshotEntries.map((entry, i) => (
                                <li
                                  key={`${entry.characterId ?? 'char'}-${entry.bookName}-${entry.itemName}-${i}`}
                                  className="rounded-lg border border-neutral-100 bg-neutral-50/80 p-3 shadow-sm"
                                >
                                  <p className="text-[13px] font-semibold text-neutral-800">
                                    {entry.characterName}
                                    <span className="mx-1.5 font-normal text-neutral-400">·</span>
                                    {entry.bookName && entry.itemName
                                      ? `「${entry.bookName}」·「${entry.itemName}」`
                                      : entry.itemName || entry.bookName || '世界书条目'}
                                  </p>
                                  <pre className="mt-2 max-h-[min(28vh,280px)] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-neutral-100 bg-white/90 p-2.5 font-sans text-[12px] leading-relaxed text-neutral-700 [scrollbar-width:thin]">
                                    {entry.content.trim() ? entry.content : '（条目正文为空）'}
                                  </pre>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : data.worldBookAfterChat.protocolInPrompt ? (
                          <p className="text-[12px] text-neutral-500">本轮已注入尾声延展条目，但未记录结构化快照（请在新回合后查看）。</p>
                        ) : (
                          <p className="text-[12px] text-neutral-500">本轮 system 未包含「尾声延展」条目正文快照。</p>
                        )}
                        {data.worldBookAfterChat.parsedPatches.length ? (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              补丁明细（本轮聊天 inline · 写库前旧文 ↔ 模型提交的替换后正文）
                            </p>
                            <ul className="mt-2 space-y-4">
                              {data.worldBookAfterChat.parsedPatches.map((row, i) => (
                                <li key={`${row.worldBookId}-${row.itemId}-${i}`} className="rounded-lg border border-neutral-100 bg-white p-3 shadow-sm">
                                  <p className="text-[13px] font-semibold text-neutral-800">
                                    {row.bookName && row.itemName
                                      ? `「${row.bookName}」·「${row.itemName}」`
                                      : '世界书条目'}
                                    {row.characterId ? (
                                      <span className="ml-2 font-mono text-[10px] font-normal text-neutral-500">
                                        characterId={row.characterId}
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="mt-1 font-mono text-[10px] text-neutral-500">
                                    worldBookId={row.worldBookId} · itemId={row.itemId}
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    <p className="text-[11px] font-medium text-neutral-500">替换前（写库前快照）</p>
                                    <pre className="max-h-[min(24vh,240px)] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-neutral-100 bg-stone-50/90 p-2.5 font-sans text-[12px] leading-relaxed text-neutral-800 [scrollbar-width:thin]">
                                      {row.previousContent.trim() ? row.previousContent : '（未在人设中找到对应条目，或 id 不一致；无法展示旧文）'}
                                    </pre>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    <p className="text-[11px] font-medium text-emerald-800/90">替换后（模型提交 · 与写库一致）</p>
                                    <pre className="max-h-[min(32vh,320px)] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-emerald-100/80 bg-emerald-50/40 p-2.5 font-sans text-[12px] leading-relaxed text-neutral-900 [scrollbar-width:thin]">
                                      {row.newContentFull.trim() || '（空）'}
                                    </pre>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {(data.worldBookAfterChat.autoSummaryPatches?.length ?? 0) > 0 ? (
                          <div>
                            <p className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-[12px] text-sky-950">
                              下列补丁在<strong className="font-semibold">自动总结或每轮尾声同步</strong>阶段写入（额外请求或总结 JSON / 尾段 JSON 内的 epilogue_patches），已同步到本溯源；上方「注入快照」亦已更新为写库后正文。
                            </p>
                            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
                              补丁明细（自动总结 · 写库前旧文 ↔ 替换后正文）
                            </p>
                            <ul className="mt-2 space-y-4">
                              {data.worldBookAfterChat.autoSummaryPatches!.map((row, i) => (
                                <li
                                  key={`auto-${row.worldBookId}-${row.itemId}-${i}`}
                                  className="rounded-lg border border-sky-100 bg-white p-3 shadow-sm"
                                >
                                  <p className="text-[13px] font-semibold text-neutral-800">
                                    {row.bookName && row.itemName
                                      ? `「${row.bookName}」·「${row.itemName}」`
                                      : '世界书条目'}
                                  </p>
                                  <p className="mt-1 font-mono text-[10px] text-neutral-500">
                                    worldBookId={row.worldBookId} · itemId={row.itemId}
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    <p className="text-[11px] font-medium text-neutral-500">替换前</p>
                                    <pre className="max-h-[min(24vh,240px)] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-neutral-100 bg-stone-50/90 p-2.5 font-sans text-[12px] leading-relaxed text-neutral-800 [scrollbar-width:thin]">
                                      {row.previousContent.trim() ? row.previousContent : '（无法展示旧文）'}
                                    </pre>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    <p className="text-[11px] font-medium text-emerald-800/90">替换后（已写库）</p>
                                    <pre className="max-h-[min(32vh,320px)] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-emerald-100/80 bg-emerald-50/40 p-2.5 font-sans text-[12px] leading-relaxed text-neutral-900 [scrollbar-width:thin]">
                                      {row.newContentFull.trim() || '（空）'}
                                    </pre>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </AccordionRow>
                  ) : null}
                </motion.div>
              </motion.div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
