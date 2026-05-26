import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import type {
  MemoryTraceData,
  MemoryTraceLineRelation,
  MemoryTraceMemoryBucket,
} from './memoryTraceTypes'
import { lineRelationUiLabel } from './wechatMemoryLineScope'

export type { MemoryTraceData } from './memoryTraceTypes'

const PLATINUM = '#D4AF37'
const INK = '#1C1C1E'
const SHEET_SPRING = { type: 'spring' as const, damping: 38, stiffness: 380 }

type AccordionId = 'sample' | 'wbAfter' | 'core' | 'cursor' | 'deep'

function pct(score: number): string {
  return `${Math.round(score * 1000) / 10}%`
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
  const [expanded, setExpanded] = useState<AccordionId | null>(null)
  const matrix = data?.contextMatrix

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setExpanded(null), 0)
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
                    expanded={expanded === 'sample'}
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

                  {data.worldBookAfterChat ? (
                    <AccordionRow
                      titleEn="POST-CHAT LAYER"
                      titleZh="尾声延展（世界书）"
                      expanded={expanded === 'wbAfter'}
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
                              data.worldBookAfterChat.parsedPatches.length
                                ? 'bg-amber-50 text-amber-900'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            模型 JSON：{data.worldBookAfterChat.parsedPatches.length ? `解析到 ${data.worldBookAfterChat.parsedPatches.length} 条` : '无'}
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
                              补丁明细（写库前旧文 ↔ 模型提交的替换后正文）
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
                      </div>
                    </AccordionRow>
                  ) : null}

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
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                          仅展示注入模型的剧情正文摘录；节选规则与禁止编造等说明仅写入 prompt，不在此重复。
                        </p>
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
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                          仅展示各线未总结聊天原文；分线阅读规则仅注入模型，不在此重复展示。
                        </p>
                        <ul className="mt-2 space-y-3">
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
                      <p className="text-[11px] leading-relaxed text-neutral-500">
                        每条长期记忆标注来源微信账号与扮演马甲；「当前微信线」相对本窗口会话，「其它微信线」勿默认对方已知。
                        「关联记忆」来自主角线下约会剧情，仅在与该人脉私聊时可能召回。
                      </p>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">Keyword Hits · 关键词命中</p>
                        {matrix.deepMemory.keywordHits.length === 0 ? (
                          <p className="mt-2 text-[12px] text-neutral-400">本轮未命中关键词或始终触发条目</p>
                        ) : null}
                        <ul className="mt-2 space-y-3">
                          {matrix.deepMemory.keywordHits.map((row, i) => (
                            <li key={i} className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                              <LineScopeBadge
                                sourceLineLabel={row.sourceLineLabel}
                                lineRelation={row.lineRelation}
                                memoryBucket={row.memoryBucket}
                              />
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
                        {matrix.deepMemory.vectorRetrievals.length === 0 ? (
                          <p className="mt-2 text-[12px] text-neutral-400">本轮未召回向量相近条目（或未开启语义召回）</p>
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
