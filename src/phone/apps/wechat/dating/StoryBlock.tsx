import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { getAiPlotVersionSlices, getAiVersionArrays } from './plotVersions'
import { splitDatingAssistantOutput } from './plotCoT'
import { PlotRichParagraph } from './plotRichText'
import type { BranchOption, PlotItem } from './types'

export type BranchChoicesSlot = {
  loading: boolean
  options: BranchOption[]
  onPick: (o: BranchOption) => void
}

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 12

function stripVnVoiceParamsPayload(raw: string): string {
  const source = String(raw || '')
  if (!source.trim()) return ''
  const startMatch = /【\s*VN语音参数\s*】/u.exec(source)
  let cleaned = source
  if (startMatch && startMatch.index >= 0) {
    const start = startMatch.index
    const endRegex = /【\s*VN语音参数结束\s*】/gu
    endRegex.lastIndex = start + startMatch[0].length
    const endMatch = endRegex.exec(source)
    const end = endMatch ? endMatch.index : -1
    cleaned = source.slice(0, start) + (end >= 0 ? source.slice(end + endMatch![0].length) : '')
  }
  return cleaned
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** 禁止系统文本圈选 / iOS 长按「拷贝·查询·翻译」浮条，仅保留自定义长按菜单 */
const suppressSystemTextUi: {
  className: string
  style: CSSProperties
  onContextMenu: (e: MouseEvent) => void
} = {
  className:
    'cursor-default select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-user-select:none]',
  style: {
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  },
  onContextMenu: (e) => e.preventDefault(),
}

function countPlotCharsExcludePunctuation(text: string): number {
  let n = 0
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch)) n += 1
    else if (/[A-Za-z0-9]/.test(ch)) n += 1
  }
  return n
}

function TypewriterShimmer() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 4), 420)
    return () => window.clearInterval(id)
  }, [])
  const dots = '.'.repeat(tick + 1)
  return (
    <motion.div
      className="min-h-[4.5rem] rounded-xl bg-stone-50/90 px-3 py-3 text-[14px] leading-relaxed text-stone-400"
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <span className="font-medium text-stone-500">正在重新生成</span>
      <span className="tabular-nums">{dots.padEnd(3, '\u00a0')}</span>
    </motion.div>
  )
}

type Props = {
  plot: PlotItem
  isRegenerating: boolean
  interactionLocked?: boolean
  /** 是否允许「重新回复」（由父级根据是否为列表最后一条 AI 决定） */
  canRegenerate?: boolean
  onSaveBodyEdit: (body: string) => void
  onRegenerate?: () => void
  onDelete?: () => void
  onVersionChange?: (nextIndex: number) => void
  /** 末条 AI 卡内折叠：剧情分支选项 */
  branchChoices?: BranchChoicesSlot
}

export function StoryBlock({
  plot,
  isRegenerating,
  interactionLocked,
  canRegenerate,
  onSaveBodyEdit,
  onRegenerate,
  onDelete,
  onVersionChange,
  branchChoices,
}: Props) {
  const aiSplit = useMemo(() => {
    if (plot.type !== 'ai') return { thinkingText: '', displayBody: plot.content }
    const stored = plot.logicPass?.trim()
    const sp = splitDatingAssistantOutput(plot.content)
    const thinkingText = (stored || sp.logicPass || plot.planSummary?.trim() || sp.planSummary || '').trim()
    const displayBody = stripVnVoiceParamsPayload(stored ? plot.content : sp.content)
    return { thinkingText, displayBody }
  }, [plot])

  const versionInfo = useMemo(() => {
    if (plot.type !== 'ai') return { total: 1, index: 0, hasPager: false }
    const { versions, currentVersionIndex } = getAiVersionArrays(plot)
    return {
      total: versions.length,
      index: currentVersionIndex,
      hasPager: versions.length > 1,
    }
  }, [plot])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [ctxOpen, setCtxOpen] = useState(false)
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [pressing, setPressing] = useState(false)
  const pressTimer = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const displayBodyForCopy = plot.type === 'ai' ? aiSplit.displayBody : plot.content

  useEffect(() => {
    if (!editing) {
      const b = plot.type === 'ai' ? getAiPlotVersionSlices(plot).body : plot.content
      setDraft(b)
    }
  }, [plot, editing])

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const clearPress = useCallback(() => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    startRef.current = null
    setPressing(false)
  }, [])

  const openContextMenu = useCallback(() => {
    const el = cardRef.current
    const rect = el?.getBoundingClientRect()
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const y = rect ? rect.bottom + 6 : window.innerHeight / 2
    setCtxPos({ x, y })
    setCtxOpen(true)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || isRegenerating || interactionLocked || ctxOpen) return
    if (e.button !== 0) return
    startRef.current = { x: e.clientX, y: e.clientY }
    setPressing(true)
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      startRef.current = null
      setPressing(false)
      openContextMenu()
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current || pressTimer.current == null) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearPress()
  }

  const onTouchMoveCancel = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (!t || !startRef.current || pressTimer.current == null) return
    const dx = t.clientX - startRef.current.x
    const dy = t.clientY - startRef.current.y
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearPress()
  }

  const endPointer = () => clearPress()

  const commitEdit = () => {
    onSaveBodyEdit(draft.trimEnd())
    setEditing(false)
    setCtxOpen(false)
  }

  const cancelEdit = () => {
    const b = plot.type === 'ai' ? getAiPlotVersionSlices(plot).body : plot.content
    setDraft(b)
    setEditing(false)
  }

  const bodyChars = countPlotCharsExcludePunctuation(plot.type === 'ai' ? aiSplit.displayBody : plot.content)

  const versionPager =
    plot.type === 'ai' && versionInfo.hasPager && onVersionChange && !editing && !isRegenerating ? (
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] tabular-nums text-stone-300/95 transition-colors hover:text-stone-400">
        <button
          type="button"
          aria-label="上一版本"
          disabled={versionInfo.index <= 0}
          onClick={(e) => {
            e.stopPropagation()
            onVersionChange(versionInfo.index - 1)
          }}
          className="rounded-md p-1 text-stone-300 transition-colors hover:bg-stone-100/80 hover:text-stone-500 disabled:opacity-25"
        >
          <ChevronLeft className="size-3.5" strokeWidth={1.75} />
        </button>
        <span className="min-w-[2.75rem] text-center font-medium tracking-tight text-stone-400/90">
          {versionInfo.index + 1} / {versionInfo.total}
        </span>
        <button
          type="button"
          aria-label="下一版本"
          disabled={versionInfo.index >= versionInfo.total - 1}
          onClick={(e) => {
            e.stopPropagation()
            onVersionChange(versionInfo.index + 1)
          }}
          className="rounded-md p-1 text-stone-300 transition-colors hover:bg-stone-100/80 hover:text-stone-500 disabled:opacity-25"
        >
          <ChevronRight className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    ) : null

  const menuLayer =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {ctxOpen ? (
              <>
                <motion.div
                  key="ctx-bg"
                  role="presentation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-stone-900/[0.03]"
                  onClick={() => setCtxOpen(false)}
                />
                <motion.div
                  key="ctx-menu"
                  role="menu"
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  style={{
                    position: 'fixed',
                    left: Math.min(window.innerWidth - 168, Math.max(12, ctxPos.x - 84)),
                    top: Math.min(window.innerHeight - 220, ctxPos.y),
                    zIndex: 70,
                  }}
                  className="w-[168px] overflow-hidden rounded-2xl border border-white/70 bg-white/75 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.1)] backdrop-blur-xl"
                >
                  <button
                    type="button"
                    className="flex w-full px-3.5 py-2.5 text-left text-[13px] text-stone-700 transition-colors hover:bg-white/60"
                    onClick={() => {
                      void navigator.clipboard?.writeText(displayBodyForCopy)
                      setCtxOpen(false)
                    }}
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    className="flex w-full px-3.5 py-2.5 text-left text-[13px] text-stone-700 transition-colors hover:bg-white/60"
                    onClick={() => {
                      setCtxOpen(false)
                      setEditing(true)
                    }}
                  >
                    编辑内容
                  </button>
                  {canRegenerate && onRegenerate ? (
                    <button
                      type="button"
                      className="flex w-full px-3.5 py-2.5 text-left text-[13px] text-stone-700 transition-colors hover:bg-white/60 disabled:opacity-40"
                      disabled={interactionLocked || isRegenerating}
                      onClick={() => {
                        setCtxOpen(false)
                        onRegenerate()
                      }}
                    >
                      重新回复
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="flex w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50/80"
                      onClick={() => {
                        setCtxOpen(false)
                        if (window.confirm('确定删除这条剧情？')) onDelete()
                      }}
                    >
                      删除
                    </button>
                  ) : null}
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null

  if (plot.type === 'player') {
    return (
      <>
        <motion.div layout className="group relative mb-5" transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
        <motion.div
          ref={cardRef}
          animate={{ scale: pressing && !editing ? 0.98 : 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 38 }}
          className="relative"
        >
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl bg-white/90 p-1 shadow-[0_0_0_1px_rgba(120,113,108,0.12),0_8px_28px_rgba(0,0,0,0.06)] ring-2 ring-stone-200/50"
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border-0 bg-transparent px-3 py-2.5 text-[16px] leading-[1.8] text-sky-950 outline-none"
                />
                <div className="flex justify-end gap-2 px-2 pb-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg px-2.5 py-1 text-[12px] text-stone-500 hover:bg-stone-100"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="rounded-lg bg-stone-900 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-stone-800"
                  >
                    保存
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onTouchMove={onTouchMoveCancel}
                onPointerUp={endPointer}
                onPointerLeave={endPointer}
                onPointerCancel={endPointer}
                onContextMenu={suppressSystemTextUi.onContextMenu}
                style={suppressSystemTextUi.style}
                className={`rounded-xl border border-sky-200 bg-sky-50/75 px-3 py-2 text-[16px] leading-[1.8] text-sky-900 transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(14,165,233,0.08)] ${suppressSystemTextUi.className}`}
              >
                <span className="mr-2 inline-block rounded-md bg-sky-600 px-2 py-0.5 text-[12px] font-medium text-white">我</span>
                <PlotRichParagraph content={plot.content} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {!editing ? (
          <p className="mt-1 text-right text-[10px] text-stone-300/90 opacity-0 transition-opacity group-hover:opacity-100">长按菜单</p>
        ) : null}
      </motion.div>
        {menuLayer}
      </>
    )
  }

  const { thinkingText, displayBody } = aiSplit

  return (
    <>
    <motion.div layout className="group relative mb-5" transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
      {thinkingText ? (
        <details className="mb-2 rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-1.5">
          <summary
            onContextMenu={suppressSystemTextUi.onContextMenu}
            className="cursor-pointer select-none touch-manipulation list-none text-[12px] text-[#6b7280] [-webkit-touch-callout:none] [-webkit-user-select:none] [&::-webkit-details-marker]:hidden"
            style={suppressSystemTextUi.style}
          >
            Lumi思维链（点击展开/收起）
          </summary>
          <pre
            onContextMenu={suppressSystemTextUi.onContextMenu}
            className="mt-1 max-h-[min(40vh,280px)] overflow-y-auto whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-[#4b5563] select-none [-webkit-touch-callout:none] [-webkit-user-select:none]"
            style={suppressSystemTextUi.style}
          >
            {thinkingText}
          </pre>
        </details>
      ) : null}

      <motion.div
        ref={cardRef}
        animate={{ scale: pressing && !editing && !isRegenerating ? 0.98 : 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 38 }}
        className="relative"
      >
        <div className="relative">
          <AnimatePresence mode="wait">
            {isRegenerating ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TypewriterShimmer />
              </motion.div>
            ) : editing ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl bg-white/92 p-1 shadow-[0_0_0_1px_rgba(120,113,108,0.12),0_10px_32px_rgba(0,0,0,0.07)] ring-2 ring-stone-200/55"
              >
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-lg border-0 bg-transparent px-3 py-2.5 text-[16px] leading-[1.85] text-stone-900 outline-none"
                />
                <div className="flex justify-end gap-2 px-2 pb-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg px-2.5 py-1 text-[12px] text-stone-500 hover:bg-stone-100"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="rounded-lg bg-stone-900 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-stone-800"
                  >
                    保存
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`view-${versionInfo.index}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onTouchMove={onTouchMoveCancel}
                onPointerUp={endPointer}
                onPointerLeave={endPointer}
                onPointerCancel={endPointer}
                onContextMenu={suppressSystemTextUi.onContextMenu}
                style={suppressSystemTextUi.style}
                className={`rounded-xl pr-2 text-[16px] font-normal leading-[1.85] text-[#262626] transition-shadow duration-200 hover:shadow-[0_6px_22px_rgba(0,0,0,0.04)] ${suppressSystemTextUi.className}`}
              >
                <PlotRichParagraph content={displayBody} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {versionPager}
      </motion.div>

      {branchChoices ? (
        <details className="mt-2 rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-1.5">
          <summary
            onContextMenu={suppressSystemTextUi.onContextMenu}
            className="cursor-pointer select-none touch-manipulation list-none text-[12px] text-[#6b7280] [-webkit-touch-callout:none] [-webkit-user-select:none] [&::-webkit-details-marker]:hidden"
            style={suppressSystemTextUi.style}
          >
            剧情分支（点击展开/收起）
          </summary>
          <div className="mt-2 max-h-[min(48vh,320px)] space-y-2 overflow-y-auto pb-1">
            {branchChoices.loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-stone-100 bg-stone-100/80 px-4 py-3"
                >
                  <div className="h-3 w-16 rounded bg-stone-200/90" />
                  <div className="mt-2 h-3 w-full rounded bg-stone-200/70" />
                  <div className="mt-1.5 h-3 w-[82%] rounded bg-stone-200/50" />
                </div>
              ))
            ) : (
              branchChoices.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => branchChoices.onPick(o)}
                  className="w-full rounded-xl bg-white px-4 py-3 text-left shadow-sm transition-all duration-200 hover:bg-stone-50"
                >
                  {o.styleLabel ? (
                    <span className="mb-1 block text-[11px] font-medium text-stone-400">{o.styleLabel}</span>
                  ) : null}
                  <span className="text-[15px] leading-relaxed text-[#262626]">{o.content}</span>
                </button>
              ))
            )}
          </div>
        </details>
      ) : null}

      {!isRegenerating ? (
        <p className="mt-1 text-right text-[10px] tabular-nums leading-none text-stone-400/75">
          约 {bodyChars} 字（不含标点）
          {!editing ? <span className="ml-2 text-stone-300/90 opacity-0 group-hover:opacity-100">· 长按菜单</span> : null}
        </p>
      ) : null}
    </motion.div>
    {menuLayer}
    </>
  )
}
