import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MemoryEntry } from './memoryArchiveTypes'
import { isMeetOnlyMemoryEntry } from './memoryArchiveAccountScope'
import { ARCHIVE_INK, ARCHIVE_SERIF } from './memoryArchiveTheme'
import { isMomentMemoryEntry, MomentMemoryArchiveCard } from './MomentMemoryArchiveCard'
import { parseMemorySourcePrefix } from './memorySourceBadges'

const EXPAND_EASE = [0.22, 1, 0.36, 1] as const

function stopPointerBubble(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

function formatArchiveTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 微信账号来源线（遇见记忆仅用场景标签，不展示来源线） */
function MemoryAccountSourceLine({ lineLabel }: { lineLabel?: string }) {
  const detail = lineLabel?.trim()
  if (!detail || detail === '遇见') return null
  return (
    <span
      className="inline-flex max-w-[min(100%,220px)] items-center whitespace-nowrap text-[11px] leading-none text-gray-600"
      title={detail}
      aria-label={`来源 ${detail}`}
    >
      <span className="min-w-0 truncate font-medium text-gray-700">{detail}</span>
    </span>
  )
}

import { MEMORY_SCENE_CHIP_CLASS, memorySceneFilterLabel } from './memorySceneChipStyles'

export function MemoryCloudCard({
  entry,
  hideCharacterLabel = false,
  onEdit,
  onDelete,
}: {
  entry: MemoryEntry
  hideCharacterLabel?: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)

  const bodyText = entry.content.trim() || '—'
  const displayText =
    parseMemorySourcePrefix(entry.contentExpanded?.trim() || bodyText).body.trim() ||
    bodyText ||
    '—'
  const momentMemory = isMomentMemoryEntry(entry)

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

  const toggleExpanded = useCallback(() => {
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
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ${
                  MEMORY_SCENE_CHIP_CLASS[tag] ?? 'bg-gray-50 text-gray-500'
                }`}
              >
                {memorySceneFilterLabel(tag)}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isMeetOnlyMemoryEntry(entry) ? (
              <MemoryAccountSourceLine lineLabel={entry.sourceLineLabel} />
            ) : null}
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
          aria-expanded={expanded}
        >
          {!hideCharacterLabel || entry.groupDisplayName ? (
            <p className="text-[10px] tracking-[0.14em] text-gray-400">
              {!hideCharacterLabel ? (
                <>
                  {entry.charDisplayName}
                  {entry.groupDisplayName ? ` · ${entry.groupDisplayName}` : ''}
                </>
              ) : (
                entry.groupDisplayName
              )}
            </p>
          ) : null}

          {momentMemory ? (
            <MomentMemoryArchiveCard entry={entry} expanded={expanded} />
          ) : (
            <>
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
            </>
          )}

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
