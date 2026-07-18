import { motion } from 'framer-motion'
import { Check, ChevronDown, ListTodo, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import { Pressable } from '../../../components/Pressable'
import {
  ARCHIVE_SOURCE_OFFLINE_LABEL,
  ARCHIVE_SOURCE_SECTION_OFFLINE,
} from './memoryArchiveSourceLabels'
import {
  ARCHIVE_SOFT_BODY_PANEL,
  ARCHIVE_SOFT_BTN_PRIMARY,
  ARCHIVE_SOFT_BTN_SECONDARY,
  ARCHIVE_SOFT_CARD,
  ARCHIVE_SOFT_CARD_OPEN,
  ARCHIVE_SOFT_SECTION,
  ARCHIVE_SOFT_TEXTAREA,
  archiveSerifTextStyle,
  MEMORY_ARCHIVE_SERIF_CLASS,
} from './memoryArchiveTheme'
import {
  formatStoryTimelineListTimeLabel,
  resolveStoryTimelineRowKeywords,
  resolveStoryTimelineRowTitle,
  storyTimelineRowPreviewLine,
  stripStoryTimelineRowObligationSections,
  stripStoryTimelineTitleLine,
  type StoryTimelinePlotRow,
  type StoryTimelineState,
  type StoryTimelineTodoEntry,
} from './storyTimelineTypes'
import { useDebouncedValue } from './useDebouncedValue'
import { useExpandedStoryTimelineSnapshot } from './useExpandedStoryTimelineSnapshot'

function stopPointerBubble(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

export function StoryTimelineRowCard({
  row,
  index,
  displayText,
  onEdit,
  onDelete,
}: {
  row: StoryTimelinePlotRow
  index: number
  displayText: string
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const storyTimeLabel = formatStoryTimelineListTimeLabel(displayText, row.recordedAt)
  const titleLabel = resolveStoryTimelineRowTitle(row, displayText)
  const keywordLabels = resolveStoryTimelineRowKeywords(row, displayText)

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      window.setTimeout(() => setConfirmDelete(false), 3200)
      return
    }
    setConfirmDelete(false)
    onDelete()
  }

  const previewLine = storyTimelineRowPreviewLine(displayText)
  const bodyDisplayText = stripStoryTimelineTitleLine(displayText)

  return (
    <details
      className={`group overflow-hidden ${ARCHIVE_SOFT_CARD} ${ARCHIVE_SOFT_CARD_OPEN} ${MEMORY_ARCHIVE_SERIF_CLASS}`}
      style={archiveSerifTextStyle}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="border-b border-gray-100 bg-gradient-to-br from-gray-50/95 via-gray-50/40 to-white px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[12px] font-bold tabular-nums text-gray-800"
            >
              {index}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-[17px] font-semibold leading-snug tracking-tight text-gray-900">
                {titleLabel || `摘要 ${index}`}
              </h4>
              {keywordLabels.length ? (
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  {keywordLabels.join(' · ')}
                </p>
              ) : null}
              {storyTimeLabel ? (
                <p className="mt-1 text-[11px] font-medium text-gray-400">
                  <ListenNumericText text={storyTimeLabel} />
                </p>
              ) : null}
              {previewLine ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-500 group-open:hidden">
                  {previewLine}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Pressable
                type="button"
                onPointerDown={stopPointerBubble}
                onClick={(e) => {
                  stopPointerBubble(e)
                  onEdit()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
                aria-label="编辑摘要"
              >
                <Pencil className="size-3.5" strokeWidth={1.75} />
              </Pressable>
              <Pressable
                type="button"
                onPointerDown={stopPointerBubble}
                onClick={(e) => {
                  stopPointerBubble(e)
                  handleDelete()
                }}
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[10px] font-semibold active:bg-gray-100 ${
                  confirmDelete ? 'bg-gray-900 text-white' : 'text-gray-400'
                }`}
                aria-label={confirmDelete ? '再次点击确认删除' : '删除摘要'}
              >
                {confirmDelete ? '确认' : <Trash2 className="size-3.5" strokeWidth={1.75} />}
              </Pressable>
              <ChevronDown
                className="size-4 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                strokeWidth={2}
                aria-hidden
              />
            </div>
          </div>
        </div>
        {previewLine ? (
          <div className="px-4 py-2 group-open:hidden">
            <p className="text-[10px] font-medium text-gray-400">点击展开全文</p>
          </div>
        ) : null}
      </summary>
      <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          摘要正文
        </p>
        <div
          className={`max-h-[min(50vh,360px)] overflow-y-auto whitespace-pre-wrap break-words ${ARCHIVE_SOFT_BODY_PANEL} ${MEMORY_ARCHIVE_SERIF_CLASS}`}
          style={archiveSerifTextStyle}
        >
          {stripStoryTimelineRowObligationSections(bodyDisplayText) || bodyDisplayText}
        </div>
      </div>
    </details>
  )
}

/** 角色详情内 · 待办台账独立 Tab */
export function MemoryTodoLedgerSection({
  characterId,
  state,
  actionBusy,
  actionFeedback,
  onResolveOpen,
  onRemove,
  onAppend,
  onClearLedger,
  onRebuildFromRecent,
  showSectionHeading = true,
}: {
  characterId: string
  state: StoryTimelineState | null
  actionBusy: boolean
  actionFeedback: string
  onResolveOpen: (todoText: string, outcome: 'done' | 'missed') => void
  onRemove: (todoText: string) => void
  onAppend: (todoText: string) => void
  onClearLedger: () => void
  onRebuildFromRecent: () => void
  showSectionHeading?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRebuild, setConfirmRebuild] = useState(false)
  const openTodos = (state?.todos ?? []).filter((t) => t.status === 'open')
  const resolvedTodos = (state?.todos ?? [])
    .filter((t) => t.status === 'resolved')
    .slice(-8)

  return (
    <section data-memory-coach="detail-todos" className={ARCHIVE_SOFT_SECTION}>
      {showSectionHeading ? (
        <div className="mb-2 flex items-center gap-2">
          <ListTodo className="size-4 text-gray-600" strokeWidth={1.75} />
          <h3 className="text-[13px] font-semibold text-gray-900">待办台账</h3>
        </div>
      ) : null}
      <p className="mb-3 text-[12px] leading-relaxed text-gray-500">
        只显示当前最新状态；不写入按轮摘要。可手动清空/追加，或按近况一键重建。
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pressable
          type="button"
          disabled={actionBusy || confirmClear}
          onClick={() => {
            setConfirmClear(true)
            setConfirmRebuild(false)
          }}
          className={ARCHIVE_SOFT_BTN_SECONDARY}
        >
          清空待办
        </Pressable>
        <Pressable
          type="button"
          disabled={actionBusy}
          onClick={() => {
            if (!confirmRebuild) {
              setConfirmRebuild(true)
              setConfirmClear(false)
              window.setTimeout(() => setConfirmRebuild(false), 4000)
              return
            }
            setConfirmRebuild(false)
            onRebuildFromRecent()
          }}
          className={confirmRebuild ? ARCHIVE_SOFT_BTN_PRIMARY : ARCHIVE_SOFT_BTN_SECONDARY}
        >
          {actionBusy ? '处理中…' : confirmRebuild ? '再点确认重建' : '按近况重建'}
        </Pressable>
      </div>
      {confirmClear ? (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-3">
          <p className="mb-3 text-[12px] leading-relaxed text-gray-600">
            将清空全部待办与已完成事项，摘要正文不会改动。确定清空？
          </p>
          <div className="flex flex-wrap gap-2">
            <Pressable
              type="button"
              disabled={actionBusy}
              onClick={() => setConfirmClear(false)}
              className={ARCHIVE_SOFT_BTN_SECONDARY}
            >
              取消
            </Pressable>
            <Pressable
              type="button"
              disabled={actionBusy}
              onClick={() => {
                setConfirmClear(false)
                onClearLedger()
              }}
              className={ARCHIVE_SOFT_BTN_PRIMARY}
            >
              确认清空
            </Pressable>
          </div>
        </div>
      ) : null}
      <p className="mb-3 text-[11px] leading-relaxed text-gray-400">
        「按近况重建」会先清空台账，再读取剧情时间最近的 2 轮模型回复（线上或线下）重新生成未完待办；不会改动线下摘要正文。
      </p>
      {actionFeedback ? (
        <p className="mb-3 text-[12px] leading-relaxed text-gray-600">{actionFeedback}</p>
      ) : null}
      {openTodos.length ? (
        <ul className="mb-3 space-y-2">
          {openTodos.map((t) => (
            <TodoLedgerRow
              key={`open:${t.text}`}
              characterId={characterId}
              todo={t}
              onDone={() => onResolveOpen(t.text, 'done')}
              onMissed={() => onResolveOpen(t.text, 'missed')}
              onRemove={() => onRemove(t.text)}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-3 rounded-xl bg-gray-50 px-3 py-2.5 text-[12px] text-gray-400">暂无未完待办</p>
      )}
      {resolvedTodos.length ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-medium text-gray-400">最近已完成</p>
          <ul className="space-y-1.5">
            {resolvedTodos.map((t) => (
              <ResolvedTodoLedgerRow
                key={`done:${t.text}:${t.resolvedNote ?? ''}`}
                characterId={characterId}
                todo={t}
                onRemove={() => onRemove(t.text)}
              />
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="手动补充一条待办…"
          className="min-w-0 flex-1 rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-[13px] text-gray-800 outline-none placeholder:text-gray-400"
        />
        <Pressable
          type="button"
          disabled={!draft.trim() || actionBusy}
          onClick={() => {
            const t = draft.trim()
            if (!t) return
            onAppend(t)
            setDraft('')
          }}
          className={ARCHIVE_SOFT_BTN_PRIMARY}
        >
          <Plus className="size-3.5" strokeWidth={2} />
          补充
        </Pressable>
      </div>
    </section>
  )
}

function TodoLedgerRow({
  characterId,
  todo,
  onDone,
  onMissed,
  onRemove,
}: {
  characterId: string
  todo: StoryTimelineTodoEntry
  onDone: () => void
  onMissed: () => void
  onRemove: () => void
}) {
  const displayText = useExpandedStoryTimelineSnapshot(characterId, todo.text)
  return (
    <li className="rounded-2xl border border-gray-200/70 bg-gray-50/50 px-3 py-2.5">
      <p className="text-[13px] leading-relaxed text-gray-800">{displayText}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200/60 pt-2 text-[12px]">
        <button type="button" onClick={onDone} className="inline-flex items-center gap-1 font-medium text-emerald-700">
          <Check className="size-3" strokeWidth={2} />
          完成
        </button>
        <button type="button" onClick={onMissed} className="font-medium text-gray-600">
          未兑现
        </button>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-gray-400">
          <Trash2 className="size-3" strokeWidth={2} />
          删除
        </button>
      </div>
    </li>
  )
}

function ResolvedTodoLedgerRow({
  characterId,
  todo,
  onRemove,
}: {
  characterId: string
  todo: StoryTimelineTodoEntry
  onRemove: () => void
}) {
  const raw = String(todo.resolvedNote ?? todo.text).trim()
  const displayText = useExpandedStoryTimelineSnapshot(characterId, raw)
  return (
    <li className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2 text-[12px] leading-relaxed text-gray-600">
      <span className="text-gray-400">
        {todo.outcome === 'missed' ? '未兑现 · ' : todo.outcome === 'cancelled' ? '已取消 · ' : '已完成 · '}
      </span>
      {displayText}
      <button
        type="button"
        onClick={onRemove}
        className="ml-2 text-[11px] text-gray-400 underline decoration-gray-300"
      >
        移除
      </button>
    </li>
  )
}

/** 角色详情内 · 线下摘要区块（不含顶栏角色卡片；待办见独立 Tab） */
export function MemoryStoryTimelineDetailSection({
  rows,
  rowDisplayById,
  onEditRow,
  onDeleteRow,
  alignDraft,
  alignBusy,
  alignFeedback,
  onAlignDraftChange,
  onRunAlign,
  onGatherLatest,
  showSectionHeading = true,
}: {
  rows: StoryTimelinePlotRow[]
  rowDisplayById: Map<string, string>
  onEditRow: (row: StoryTimelinePlotRow) => void
  onDeleteRow: (rowId: string) => void
  alignDraft: string
  alignBusy: boolean
  alignFeedback: string
  onAlignDraftChange: (v: string) => void
  onRunAlign: () => void
  onGatherLatest: () => void
  showSectionHeading?: boolean
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 280)
  const rowsNewestFirst = useMemo(() => [...rows].reverse(), [rows])
  const filteredRowsNewestFirst = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rowsNewestFirst
    return rowsNewestFirst.filter((row) => {
      const display = rowDisplayById.get(row.id) ?? row.rowText
      const title = resolveStoryTimelineRowTitle(row, display)
      const haystack = `${title}\n${display}\n${row.rowText}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [rowsNewestFirst, debouncedSearch, rowDisplayById])

  return (
    <div
      data-memory-coach="detail-offline"
      className={`mx-4 mt-4 ${MEMORY_ARCHIVE_SERIF_CLASS}`}
      style={archiveSerifTextStyle}
    >
      {showSectionHeading ? (
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className={ARCHIVE_SOURCE_SECTION_OFFLINE}>{ARCHIVE_SOURCE_OFFLINE_LABEL}</span>
          <p className="text-[11px] text-gray-400">按轮剧情摘要表 · 约会 / 私聊自动维护</p>
        </div>
      ) : null}

      <section data-memory-coach="detail-offline-manual" className={ARCHIVE_SOFT_SECTION}>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-gray-600" strokeWidth={1.75} />
          <h3 className="text-[13px] font-semibold text-gray-900">手动生成摘要</h3>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-gray-500">
          每轮自动写入失败时，可粘贴本轮剧情 / 私聊正文后在此单独请求摘要并落库（摘要不再写入待办）。
        </p>
        <textarea
          value={alignDraft}
          onChange={(e) => onAlignDraftChange(e.target.value)}
          disabled={alignBusy}
          rows={5}
          placeholder="粘贴本轮 AI 剧情 / 私聊回复正文…"
          className={ARCHIVE_SOFT_TEXTAREA}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Pressable
            type="button"
            disabled={alignBusy}
            onClick={onGatherLatest}
            className={ARCHIVE_SOFT_BTN_SECONDARY}
          >
            采集最近正文
          </Pressable>
          <Pressable
            type="button"
            disabled={alignBusy || alignDraft.trim().length < 8}
            onClick={onRunAlign}
            className={ARCHIVE_SOFT_BTN_PRIMARY}
          >
            {alignBusy ? '生成中…' : '生成并写入'}
          </Pressable>
        </div>
        {alignFeedback ? (
          <p className="mt-3 text-[12px] leading-relaxed text-gray-600">{alignFeedback}</p>
        ) : null}
      </section>

      <section className="mt-5 pb-2">
        <div className="mb-2.5 px-1">
          <h3 className="text-[12px] font-semibold text-gray-500">按轮剧情摘要（新→旧）</h3>
          <p className="mt-0.5 text-[11px] text-gray-400">时间点为剧情内时空，非手机系统时间</p>
        </div>
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-gray-200/70 bg-white px-3.5 py-2.5 shadow-sm">
          <Search className="size-4 shrink-0 text-gray-400" strokeWidth={1.25} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索摘要正文、地点、事件…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-gray-900 outline-none placeholder:text-gray-400"
            spellCheck={false}
          />
        </div>
        {debouncedSearch.trim() && rowsNewestFirst.length ? (
          <p className="mb-2 px-1 text-[11px] text-gray-400">
            <ListenNumericText
              text={`${filteredRowsNewestFirst.length} / ${rowsNewestFirst.length} 条匹配`}
            />
          </p>
        ) : null}
        {rowsNewestFirst.length ? (
          filteredRowsNewestFirst.length ? (
          <ul className="flex flex-col gap-2.5">
            {filteredRowsNewestFirst.map((row, i) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.12) }}
              >
                <StoryTimelineRowCard
                  row={row}
                  index={rows.length - rowsNewestFirst.indexOf(row)}
                  displayText={rowDisplayById.get(row.id) ?? row.rowText}
                  onEdit={() => onEditRow(row)}
                  onDelete={() => onDeleteRow(row.id)}
                />
              </motion.li>
            ))}
          </ul>
          ) : (
            <p className="rounded-[20px] bg-white px-4 py-8 text-center text-[13px] text-gray-400 shadow-sm">
              没有匹配的摘要；试试其它关键词。
            </p>
          )
        ) : (
          <p className="rounded-[20px] bg-white px-4 py-8 text-center text-[13px] text-gray-400 shadow-sm">
            暂无按轮摘要行；可在上方粘贴正文生成，或由约会/私聊 AI 落库后自动出现。
          </p>
        )}
      </section>
    </div>
  )
}

