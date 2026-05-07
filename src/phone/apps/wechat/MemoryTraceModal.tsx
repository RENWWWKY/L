import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import type { MemoryTraceData } from './memoryTraceTypes'

export type { MemoryTraceData } from './memoryTraceTypes'

const PLATINUM = '#D4AF37'
const INK = '#1C1C1E'
const SHEET_SPRING = { type: 'spring' as const, damping: 38, stiffness: 380 }

type AccordionId = 'core' | 'cursor' | 'deep'

function pct(score: number): string {
  return `${Math.round(score * 1000) / 10}%`
}

function AccordionRow(props: {
  titleEn: string
  titleZh: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={props.onToggle}
        className="flex w-full items-center justify-between gap-3 py-4 text-left outline-none transition-colors hover:bg-neutral-50/80"
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-neutral-400">{props.titleEn}</p>
          <p className="mt-1 text-[15px] font-semibold" style={{ color: INK }}>
            {props.titleZh}
          </p>
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
  const [expanded, setExpanded] = useState<AccordionId | null>('core')
  const matrix = data?.contextMatrix

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setExpanded(data ? 'core' : null), 0)
    return () => window.clearTimeout(t)
  }, [open, data])

  const toggleAccordion = (id: AccordionId) => {
    setExpanded((prev) => (prev === id ? null : id))
  }

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
                    在私聊、群聊或约会剧情中成功生成角色 AI 回复后，会在此展示当轮注入的人设、世界书、上下文与记忆检索摘要。数据会写入本地
                    IndexedDB，刷新页面后仍会显示<strong className="font-medium text-neutral-700">上一条</strong>记录。
                  </p>
                </div>
              ) : null}
              {data && matrix ? (
              <motion.div variants={blockVariants} initial="hidden" animate="show" className="flex flex-col gap-5 pt-3">
                {/* Block A */}
                <motion.section variants={itemVariants} className="rounded-xl bg-neutral-50/80 p-4" style={{ borderLeft: `2px solid ${PLATINUM}80` }}>
                  <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-neutral-400">TARGET SAMPLE · 样本锚定</p>
                  <p className="mt-2 text-[12px] text-neutral-500">
                    角色 <span className="font-medium text-neutral-700">{data.charName}</span> · 最新回复切片
                  </p>
                  <p className="mt-3 font-serif text-[16px] italic leading-relaxed text-neutral-900">
                    {data.lastReply}
                  </p>
                </motion.section>

                {/* Accordion B–D */}
                <motion.div variants={itemVariants} className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                  <AccordionRow
                    titleEn="CORE DIRECTIVES"
                    titleZh="核心基底"
                    expanded={expanded === 'core'}
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

                  <AccordionRow
                    titleEn="ACTIVE CONTEXT"
                    titleZh="游标上下文"
                    expanded={expanded === 'cursor'}
                    onToggle={() => toggleAccordion('cursor')}
                  >
                    <div className="space-y-4 px-1">
                      <p className="text-[12px] text-neutral-600">
                        当前会话载入近期消息{' '}
                        <span className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: PLATINUM }}>
                          {matrix.recentContext.activeSessionMessages}
                        </span>{' '}
                        条（滑动窗口；与「未总结」块并列服务于本轮推理）
                      </p>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">尚未总结 · 线下剧情</p>
                        <ul className="mt-2 space-y-3">
                          {matrix.recentContext.unsummarizedOfflinePlots.map((row, i) => (
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
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">尚未总结 · 私聊与群聊摘录</p>
                        <ul className="mt-2 space-y-3">
                          {matrix.recentContext.unsummarizedChats.map((row, i) => (
                            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-neutral-700">
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-400 animate-pulse" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-800">
                                  {row.type === 'group' ? `From Group: ${row.source}` : `From Private: ${row.source}`}
                                </p>
                                <pre className="mt-1 whitespace-pre-wrap font-sans text-[12px] text-neutral-600">{row.snippet}</pre>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </AccordionRow>

                  <AccordionRow
                    titleEn="DEEP MEMORY"
                    titleZh="深度记忆检索"
                    expanded={expanded === 'deep'}
                    onToggle={() => toggleAccordion('deep')}
                  >
                    <div className="space-y-5 px-1">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">Keyword Hits · 关键词命中</p>
                        <ul className="mt-2 space-y-3">
                          {matrix.deepMemory.keywordHits.map((row, i) => (
                            <li key={i} className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                              <p className="font-mono text-[11px] font-semibold tracking-wide" style={{ color: PLATINUM }}>
                                {row.keyword}
                              </p>
                              <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">{row.content}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">Vector Search · 向量检索</p>
                        <ul className="mt-2 space-y-3">
                          {matrix.deepMemory.vectorRetrievals.map((row, i) => (
                            <li
                              key={i}
                              className="flex gap-3 rounded-lg border border-neutral-100 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                            >
                              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-neutral-600">{row.content}</p>
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
