import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, MoreHorizontal, Pencil, Sparkles, Trash2, User, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MemoryEntry, MemorySourceIdentity } from './memoryArchiveTypes'
import { ARCHIVE_INK, ARCHIVE_SERIF } from './memoryArchiveTheme'

const LONG_PRESS_MS = 480
const EXPAND_EASE = [0.22, 1, 0.36, 1] as const

function stopPointerBubble(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

function formatArchiveTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MEMORY_SOURCE_GLYPH: Record<
  MemorySourceIdentity,
  { Icon: typeof User; short: string; title: string }
> = {
  main_wechat: {
    Icon: User,
    short: '主号',
    title: '来源：主微信身份（与顶部「主身份」筛选一致）',
  },
  sub_wechat: {
    Icon: UserRound,
    short: '小号',
    title: '来源：伪装小号 / 副微信账号（与顶部「伪装小号」筛选一致）',
  },
  lumi_meet: {
    Icon: Sparkles,
    short: '遇见',
    title: '来源：Lumi Meet 邂逅（与顶部「Lumi Meet」筛选一致）',
  },
}

/** 横向：主号/小号/遇见 + 微信昵称 · 身份名 */
function MemorySourceLine({
  identity,
  lineLabel,
}: {
  identity: MemorySourceIdentity
  lineLabel?: string
}) {
  const { Icon, short, title } = MEMORY_SOURCE_GLYPH[identity]
  const detail = lineLabel?.trim()
  return (
    <span
      className="inline-flex max-w-[min(100%,220px)] items-center gap-1 whitespace-nowrap text-[11px] leading-none text-gray-600"
      title={detail ? `${title}：${detail}` : title}
      aria-label={detail ? `来源 ${short} · ${detail}` : title}
    >
      <Icon className="size-3 shrink-0 text-gray-400" strokeWidth={1.25} aria-hidden />
      <span className="shrink-0 font-medium text-gray-500">{short}</span>
      {detail ? (
        <>
          <span className="shrink-0 text-gray-300" aria-hidden>
            ·
          </span>
          <span className="min-w-0 truncate font-medium text-gray-700">{detail}</span>
        </>
      ) : null}
    </span>
  )
}

export function MemoryCloudCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)

  const bodyText = entry.content.trim() || '—'
  const displayText = (entry.contentExpanded?.trim() || bodyText) || '—'

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const closeActions = useCallback(() => {
    setActionsOpen(false)
    setConfirmDelete(false)
  }, [])

  const toggleActions = useCallback(() => {
    setActionsOpen((v) => {
      if (v) setConfirmDelete(false)
      return !v
    })
  }, [])

  const startLongPress = useCallback(() => {
    longPressFired.current = false
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setActionsOpen(true)
    }, LONG_PRESS_MS)
  }, [clearLongPress])

  const toggleExpanded = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    setExpanded((v) => !v)
  }, [])

  useEffect(() => {
    if (!actionsOpen) return
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (menuWrapRef.current?.contains(target)) return
      closeActions()
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [actionsOpen, closeActions])

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      window.setTimeout(() => setConfirmDelete(false), 3200)
      return
    }
    setConfirmDelete(false)
    setActionsOpen(false)
    onDelete()
  }

  const handleEdit = () => {
    onEdit()
    closeActions()
  }

  const primaryTags = entry.tags.length ? entry.tags : (['私聊'] as const)

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: EXPAND_EASE }}
      className={`relative mb-5 overflow-visible rounded-[24px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-shadow duration-300 ${
        expanded ? 'shadow-[0_12px_40px_rgba(0,0,0,0.05)]' : ''
      }`}
    >
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {primaryTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-medium tracking-wider text-gray-500"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MemorySourceLine
              identity={entry.sourceIdentity}
              lineLabel={entry.sourceLineLabel}
            />
            <div
              ref={menuWrapRef}
              className="relative z-30"
              onPointerDown={stopPointerBubble}
              onClick={stopPointerBubble}
            >
              <button
                type="button"
                onClick={toggleActions}
                className={`flex h-9 w-9 touch-manipulation items-center justify-center rounded-full transition-colors ${
                  actionsOpen
                    ? 'bg-gray-100 text-gray-700'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
                aria-label={actionsOpen ? '收起操作' : '更多操作'}
                aria-expanded={actionsOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal className="size-[18px]" strokeWidth={1.35} />
              </button>

              <AnimatePresence initial={false}>
                {actionsOpen ? (
                  <motion.div
                    key="actions-menu"
                    role="menu"
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: EXPAND_EASE }}
                    className="absolute right-0 top-full z-40 mt-1.5 min-w-[132px] origin-top-right overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleEdit}
                      className="flex w-full touch-manipulation items-center gap-2.5 px-4 py-3 text-left text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100"
                    >
                      <Pencil className="size-3.5 shrink-0 text-gray-500" strokeWidth={1.35} />
                      编辑
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDelete}
                      className="flex w-full touch-manipulation items-center gap-2.5 px-4 py-3 text-left text-[13px] font-medium transition-colors hover:bg-gray-50 active:bg-gray-100"
                      style={{
                        color: confirmDelete ? '#FFFFFF' : ARCHIVE_INK,
                        background: confirmDelete ? ARCHIVE_INK : undefined,
                      }}
                    >
                      <Trash2
                        className={`size-3.5 shrink-0 ${confirmDelete ? 'text-white' : 'text-gray-500'}`}
                        strokeWidth={1.35}
                      />
                      {confirmDelete ? '确认删除' : '删除'}
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-3 w-full touch-manipulation text-left"
          onClick={toggleExpanded}
          onPointerDown={(e) => {
            stopPointerBubble(e)
            startLongPress()
          }}
          onPointerUp={(e) => {
            stopPointerBubble(e)
            clearLongPress()
          }}
          onPointerLeave={(e) => {
            stopPointerBubble(e)
            clearLongPress()
          }}
          onPointerCancel={(e) => {
            stopPointerBubble(e)
            clearLongPress()
          }}
          aria-expanded={expanded}
        >
          <p className="text-[10px] tracking-[0.14em] text-gray-400">
            {entry.charDisplayName}
            {entry.groupDisplayName ? ` · ${entry.groupDisplayName}` : ''}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {expanded ? (
              <motion.p
                key="full"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.24, ease: EXPAND_EASE }}
                className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-gray-800"
                style={{ fontFamily: ARCHIVE_SERIF }}
              >
                {displayText}
              </motion.p>
            ) : (
              <motion.p
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-gray-600"
                style={{ fontFamily: ARCHIVE_SERIF }}
              >
                {displayText}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] tracking-wider text-gray-300">
              {expanded ? '点击收起' : '点击展开全文'}
            </span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 text-gray-400"
              aria-hidden
            >
              <ChevronDown className="size-4" strokeWidth={1.5} />
            </motion.span>
          </div>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EXPAND_EASE }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-1">
              {entry.userBindingLabels?.length ? (
                <div className="mb-4 rounded-2xl bg-gray-50/90 px-3.5 py-3">
                  <p className="text-[10px] tracking-[0.14em] text-gray-400">{'{{user}}'} 占位绑定</p>
                  <ul className="mt-2 space-y-1.5">
                    {entry.userBindingLabels.map((lbl, i) => (
                      <li
                        key={`${i}-${lbl}`}
                        className="text-[12px] leading-relaxed text-gray-700"
                      >
                        <span className="font-mono text-[10px] text-gray-400">#{i + 1}</span>{' '}
                        {lbl}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                {entry.triggerType === 'always' ? (
                  <p className="text-[11px] italic tracking-wide text-gray-800/80">
                    Always Active <span className="text-gray-400 not-italic">（始终共振）</span>
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] tracking-wider text-gray-400">Trigger</span>
                    {(entry.triggerKeywords ?? []).length ? (
                      (entry.triggerKeywords ?? []).slice(0, 6).map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full bg-gray-100/90 px-3 py-1 text-[11px] text-gray-500"
                        >
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-gray-100/90 px-3 py-1 text-[11px] text-gray-400">
                        未设置关键词
                      </span>
                    )}
                  </div>
                )}
              </div>

              <time className="mt-4 block text-[10px] tracking-wide text-gray-300">
                {formatArchiveTime(entry.timestamp)}
              </time>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed-meta"
            initial={false}
            className="px-6 pb-5 pt-0"
          >
            <time className="block text-[10px] tracking-wide text-gray-300">
              {formatArchiveTime(entry.timestamp)}
            </time>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}
