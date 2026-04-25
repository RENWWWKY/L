import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bold, Eraser, Highlighter, Italic, Minus, Plus, Redo2, Strikethrough, Underline, Undo2 } from 'lucide-react'

import type { ApiConfig } from '../api/types'
import type { ScheduleTable, TableCell, TableCellStyle } from '../newFriendsPersona/types'
import { cloneScheduleTemplate, SCHEDULE_TEMPLATE_DAILY, SCHEDULE_TEMPLATE_STUDENT } from './scheduleTemplates'
import { requestScheduleTableFromAi } from '../wechatChatAi'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#111111',
  sub: '#666666',
  faint: '#9b9b9b',
  border: '#e5e5e5',
}

function defaultEmptySchedule(): ScheduleTable {
  const now = Date.now()
  const makeStyle = (): TableCellStyle => ({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    highlight: false,
    align: 'left',
  })
  const cell = (content = ''): TableCell => ({ content, style: makeStyle(), colspan: 1, rowspan: 1 })
  return {
    id: `t-${now}`,
    name: '日程表',
    headers: ['列1', '列2', '列3'],
    rows: [
      [cell(), cell(), cell()],
      [cell(), cell(), cell()],
      [cell(), cell(), cell()],
    ],
    columnWidths: [96, 96, 96],
    rowHeights: [44, 44, 44],
    style: { headerStyle: 'dark', borderStyle: 'solid', rowHeight: 'normal' },
    createdAt: now,
    updatedAt: Date.now(),
  }
}

function clampMin1(n: number) {
  return Math.max(1, Math.floor(n))
}

/** 按下后移动超过该距离视为滚动/拖拽，不触发单击选中、不进入长按框选 */
const SCHEDULE_TAP_SLOP_PX = 18
/** 长按触发框选（略加长，减少与滑动的误触） */
const SCHEDULE_LONG_PRESS_MS = 520

function sanitizeTable(t: ScheduleTable): ScheduleTable {
  const now = Date.now()
  const baseStyle: TableCellStyle = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    highlight: false,
    align: 'left',
  }
  const toCell = (raw: any): TableCell => {
    if (raw && typeof raw === 'object' && typeof raw.content === 'string') {
      const s = raw.style ?? {}
      const align = s.align === 'center' || s.align === 'right' ? s.align : 'left'
      return {
        content: String(raw.content ?? ''),
        style: {
          bold: !!s.bold,
          italic: !!s.italic,
          underline: !!s.underline,
          strikethrough: !!s.strikethrough,
          highlight: !!s.highlight,
          align,
        },
        colspan: typeof raw.colspan === 'number' && Number.isFinite(raw.colspan) ? Math.max(1, Math.floor(raw.colspan)) : 1,
        rowspan: typeof raw.rowspan === 'number' && Number.isFinite(raw.rowspan) ? Math.max(1, Math.floor(raw.rowspan)) : 1,
      }
    }
    // 兼容：字符串
    return { content: String(raw ?? ''), style: { ...baseStyle }, colspan: 1, rowspan: 1 }
  }

  const headers = Array.isArray(t.headers) ? t.headers.map((x) => String(x ?? '').trim()) : []
  const cols = clampMin1(headers.length || 1)
  const safeHeaders = headers.length ? headers.slice(0, cols) : new Array(cols).fill('')

  const rowsRaw = Array.isArray(t.rows) ? t.rows : []
  const safeRows: TableCell[][] = rowsRaw
    .filter((r) => Array.isArray(r))
    .map((r) => (r as any[]).slice(0, cols).map(toCell))
    .map((r) => {
      const out = [...r]
      while (out.length < cols) out.push(toCell(''))
      return out
    })

  const styleIn = t.style ?? { headerStyle: 'dark', borderStyle: 'solid', rowHeight: 'normal' }
  const style = {
    headerStyle: styleIn.headerStyle === 'light' || styleIn.headerStyle === 'none' ? styleIn.headerStyle : 'dark',
    borderStyle: styleIn.borderStyle === 'dashed' || styleIn.borderStyle === 'none' ? styleIn.borderStyle : 'solid',
    rowHeight: styleIn.rowHeight === 'compact' || styleIn.rowHeight === 'loose' ? styleIn.rowHeight : 'normal',
  } as const

  const id = String((t as any).id ?? '').trim() || `t-${now}`
  const createdAt = typeof (t as any).createdAt === 'number' ? (t as any).createdAt : now
  const updatedAt = typeof (t as any).updatedAt === 'number' ? (t as any).updatedAt : now
  const columnWidthsIn = Array.isArray((t as any).columnWidths) ? ((t as any).columnWidths as any[]) : []
  const columnWidths = columnWidthsIn
    .map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(300, Math.max(50, Math.floor(x))) : 96))
    .slice(0, cols)
  while (columnWidths.length < cols) columnWidths.push(96)
  const rowHeightsIn = Array.isArray((t as any).rowHeights) ? ((t as any).rowHeights as any[]) : []
  const rowHeights = rowHeightsIn
    .map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(300, Math.max(44, Math.floor(x))) : 44))
    .slice(0, safeRows.length)
  while (rowHeights.length < safeRows.length) rowHeights.push(44)

  const minRows = safeRows.length ? safeRows : [[toCell('')]]
  if (!minRows.length) minRows.push([toCell('')])

  return {
    id,
    name: String(t.name ?? '').trim().slice(0, 40) || '日程表',
    headers: safeHeaders,
    rows: minRows,
    columnWidths,
    rowHeights: rowHeights.length ? rowHeights : new Array(minRows.length).fill(44),
    style,
    createdAt,
    updatedAt,
  }
}

function rowHeightPx(mode: ScheduleTable['style']['rowHeight']): number {
  if (mode === 'compact') return 38
  if (mode === 'loose') return 56
  return 46
}

function headerBg(mode: ScheduleTable['style']['headerStyle']): { bg: string; color: string } {
  if (mode === 'none') return { bg: '#ffffff', color: '#111111' }
  if (mode === 'light') return { bg: '#f2f2f2', color: '#111111' }
  return { bg: '#111111', color: '#ffffff' }
}

function borderCss(mode: ScheduleTable['style']['borderStyle']): string {
  if (mode === 'none') return 'none'
  if (mode === 'dashed') return `1px dashed ${COLORS.border}`
  return `1px solid ${COLORS.border}`
}

// 富文本改为“结构化样式”，避免移动端 contentEditable 的 IME/选区 bug

function buildCellKey(r: number, c: number) {
  return `${r}-${c}`
}

function parseCellKey(k: string): { r: number; c: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(k)
  if (!m) return null
  return { r: parseInt(m[1]!, 10), c: parseInt(m[2]!, 10) }
}

function rangeRect(a: { r: number; c: number }, b: { r: number; c: number }) {
  const r0 = Math.min(a.r, b.r)
  const r1 = Math.max(a.r, b.r)
  const c0 = Math.min(a.c, b.c)
  const c1 = Math.max(a.c, b.c)
  return { r0, r1, c0, c1 }
}

function inRect(rc: { r: number; c: number }, rect: { r0: number; r1: number; c0: number; c1: number }) {
  return rc.r >= rect.r0 && rc.r <= rect.r1 && rc.c >= rect.c0 && rc.c <= rect.c1
}

function spanCoversCell(anchor: { r: number; c: number; rowspan: number; colspan: number }, cell: { r: number; c: number }): boolean {
  return (
    cell.r >= anchor.r &&
    cell.r < anchor.r + Math.max(1, anchor.rowspan) &&
    cell.c >= anchor.c &&
    cell.c < anchor.c + Math.max(1, anchor.colspan)
  )
}

export function ScheduleEditorScreen({
  open,
  title = '日程表',
  apiConfig,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  title?: string
  apiConfig: ApiConfig | null
  initial?: ScheduleTable | null
  onClose: () => void
  onSave: (next: ScheduleTable) => Promise<void> | void
}) {
  const titleId = useId()
  const [table, setTable] = useState<ScheduleTable>(sanitizeTable(initial ?? defaultEmptySchedule()))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [aiOpen, setAiOpen] = useState(false)
  const [aiDraft, setAiDraft] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const focusCellKeyRef = useRef<string | null>(null)
  const [focused, setFocused] = useState<{ r: number; c: number } | null>(null)
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const selectingRef = useRef(false)
  const longPressTimerRef = useRef<number | null>(null)
  const selectAnchorRef = useRef<{ r: number; c: number } | null>(null)
  const lastOverRef = useRef<{ r: number; c: number } | null>(null)
  const cellRefs = useRef(new Map<string, HTMLDivElement>())
  const gridRef = useRef<HTMLDivElement | null>(null)
  /** 区分滑动与点击：超过 slop 则取消单击与长按定时器 */
  const gestureIsScrollRef = useRef(false)
  const pendingCellDownRef = useRef<{ r: number; c: number; x: number; y: number; pointerId: number } | null>(null)
  const pendingPointerCleanupRef = useRef<(() => void) | null>(null)

  // ---- Undo / Redo（最多 20 步）----
  const undoPastRef = useRef<ScheduleTable[]>([])
  const undoFutureRef = useRef<ScheduleTable[]>([])
  const [undoTick, setUndoTick] = useState(0)
  const MAX_UNDO = 20

  const canUndo = undoPastRef.current.length > 0
  const canRedo = undoFutureRef.current.length > 0

  const pushUndo = (prev: ScheduleTable) => {
    // 入栈时丢弃 redo 分支
    undoFutureRef.current = []
    undoPastRef.current = [...undoPastRef.current, prev].slice(-MAX_UNDO)
    setUndoTick((x) => x + 1)
  }

  const setTableWithUndo = (updater: (prev: ScheduleTable) => ScheduleTable) => {
    setTable((prev) => {
      const next = updater(prev)
      // 仅当数据确实变化时入栈（浅比较 updatedAt 足够防抖：我们每次变更都会改 updatedAt）
      if (next !== prev) pushUndo(prev)
      return next
    })
    setDirty(true)
  }

  const undo = () => {
    const past = undoPastRef.current
    if (!past.length) return
    const prev = past[past.length - 1]!
    undoPastRef.current = past.slice(0, -1)
    undoFutureRef.current = [table, ...undoFutureRef.current].slice(0, MAX_UNDO)
    setEditing(null)
    focusCellKeyRef.current = null
    setTable(prev)
    setDirty(true)
    setUndoTick((x) => x + 1)
  }

  const redo = () => {
    const fut = undoFutureRef.current
    if (!fut.length) return
    const next = fut[0]!
    undoFutureRef.current = fut.slice(1)
    undoPastRef.current = [...undoPastRef.current, table].slice(-MAX_UNDO)
    setEditing(null)
    focusCellKeyRef.current = null
    setTable(next)
    setDirty(true)
    setUndoTick((x) => x + 1)
  }

  useEffect(() => {
    if (open) {
      setTable(sanitizeTable(initial ?? defaultEmptySchedule()))
      setDirty(false)
      setSaving(false)
      setToast(null)
      setAiOpen(false)
      setAiDraft('')
      setAiLoading(false)
      undoPastRef.current = []
      undoFutureRef.current = []
      setUndoTick((x) => x + 1)
    }
  }, [open, initial])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (open) return
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    const fn = pendingPointerCleanupRef.current
    if (fn) {
      pendingPointerCleanupRef.current = null
      fn()
    }
    selectingRef.current = false
    selectAnchorRef.current = null
    lastOverRef.current = null
    pendingCellDownRef.current = null
  }, [open])

  const cols = table.headers.length
  const headerVisual = headerBg(table.style.headerStyle)
  const border = borderCss(table.style.borderStyle)
  const cellH = rowHeightPx(table.style.rowHeight)

  const canClose = !saving && !aiLoading

  const askClose = () => {
    if (!canClose) return
    if (dirty) {
      const ok = window.confirm('日程表还没保存，确定要离开吗？')
      if (!ok) return
    }
    onClose()
  }

  const saveNow = async () => {
    if (saving) return
    setSaving(true)
    try {
      const next = { ...sanitizeTable(table), updatedAt: Date.now() }
      await onSave(next)
      setDirty(false)
      setToast('已保存')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败'
      setToast(msg.slice(0, 80))
    } finally {
      setSaving(false)
    }
  }

  const applyTemplate = (t: ScheduleTable) => {
    setTableWithUndo(() => sanitizeTable(cloneScheduleTemplate(t)))
    setToast('已加载模板')
  }

  const insertRowBelow = (rowIndex: number) => {
    setTableWithUndo((prev) => {
      const emptyCell = (content = ''): TableCell => ({
        content,
        style: { bold: false, italic: false, underline: false, strikethrough: false, highlight: false, align: 'left' },
        colspan: 1,
        rowspan: 1,
      })
      const rows = prev.rows.map((rr) => rr.map((c) => ({ ...c, style: { ...c.style } })))
      rows.splice(rowIndex + 1, 0, new Array(prev.headers.length).fill(0).map(() => emptyCell('')))
      const rowHeights = [...prev.rowHeights]
      rowHeights.splice(rowIndex + 1, 0, 44)
      return { ...prev, rows, rowHeights, updatedAt: Date.now() }
    })
  }

  const deleteRow = (rowIndex: number) => {
    setTableWithUndo((prev) => {
      if (prev.rows.length <= 1) return prev
      const rows = prev.rows.filter((_, i) => i !== rowIndex).map((rr) => rr.map((c) => ({ ...c, style: { ...c.style } })))
      const rowHeights = prev.rowHeights.filter((_, i) => i !== rowIndex)
      return { ...prev, rows, rowHeights, updatedAt: Date.now() }
    })
  }

  const insertColRight = (colIndex: number) => {
    setTableWithUndo((prev) => {
      const headers = [...prev.headers]
      headers.splice(colIndex + 1, 0, `列${headers.length + 1}`)
      const emptyCell: TableCell = {
        content: '',
        style: { bold: false, italic: false, underline: false, strikethrough: false, highlight: false, align: 'left' },
        colspan: 1,
        rowspan: 1,
      }
      const rows = prev.rows.map((r) => {
        const next = r.map((c) => ({ ...c, style: { ...c.style } }))
        next.splice(colIndex + 1, 0, { ...emptyCell, style: { ...emptyCell.style } })
        return next
      })
      const columnWidths = [...prev.columnWidths]
      columnWidths.splice(colIndex + 1, 0, 96)
      return { ...prev, headers, rows, columnWidths, updatedAt: Date.now() }
    })
  }

  const deleteCol = (colIndex: number) => {
    setTableWithUndo((prev) => {
      if (prev.headers.length <= 1) return prev
      const headers = prev.headers.filter((_, i) => i !== colIndex)
      const rows = prev.rows.map((r) => r.filter((_, i) => i !== colIndex).map((c) => ({ ...c, colspan: 1, rowspan: 1, style: { ...c.style } })))
      const columnWidths = prev.columnWidths.filter((_, i) => i !== colIndex)
      return { ...prev, headers, rows, columnWidths, updatedAt: Date.now() }
    })
  }

  const setHeaderText = (colIndex: number, text: string) => {
    setTableWithUndo((prev) => {
      const headers = [...prev.headers]
      headers[colIndex] = text
      return { ...prev, headers, updatedAt: Date.now() }
    })
  }

  const setCellContent = (rowIndex: number, colIndex: number, content: string) => {
    setTableWithUndo((prev) => {
      const rows = prev.rows.map((r) => r.map((c) => ({ ...c, style: { ...c.style } })))
      const cell = rows[rowIndex]?.[colIndex]
      if (!cell) return prev
      cell.content = content
      return { ...prev, rows, updatedAt: Date.now() }
    })
  }

  const setStyle = (patch: Partial<ScheduleTable['style']>) => {
    setTableWithUndo((prev) => ({ ...prev, style: { ...prev.style, ...patch }, updatedAt: Date.now() }))
  }

  const canFormat = selectedKeys.size > 0

  const onToolbar = (action: 'bold' | 'italic' | 'underline' | 'strike' | 'highlight' | 'clear') => {
    const keys = [...selectedKeys]
    if (!keys.length) return
    setTableWithUndo((prev) => {
      const rows = prev.rows.map((r) => r.map((c) => ({ ...c, style: { ...c.style } })))
      for (const k of keys) {
        const rc = parseCellKey(k)
        if (!rc) continue
        const cell = rows[rc.r]?.[rc.c]
        if (!cell) continue
        if (action === 'bold') cell.style.bold = !cell.style.bold
        if (action === 'italic') cell.style.italic = !cell.style.italic
        if (action === 'underline') cell.style.underline = !cell.style.underline
        if (action === 'strike') cell.style.strikethrough = !cell.style.strikethrough
        if (action === 'highlight') cell.style.highlight = !cell.style.highlight
        if (action === 'clear') {
          cell.style.bold = false
          cell.style.italic = false
          cell.style.underline = false
          cell.style.strikethrough = false
          cell.style.highlight = false
          cell.style.align = 'left'
        }
      }
      return { ...prev, rows, updatedAt: Date.now() }
    })
  }

  const normalizeRowsForAi = useMemo(() => {
    // 给 AI 的表格：纯文本
    return {
      headers: table.headers.map((h) => String(h ?? '').trim()),
      rows: table.rows.map((r) => r.map((c) => String(c?.content ?? '').trim())),
    }
  }, [table.headers, table.rows])

  const selectionRect = useMemo(() => {
    const keys = [...selectedKeys]
    if (!keys.length) return null
    const parsed = keys.map(parseCellKey).filter(Boolean) as Array<{ r: number; c: number }>
    if (!parsed.length) return null
    let r0 = parsed[0]!.r
    let r1 = parsed[0]!.r
    let c0 = parsed[0]!.c
    let c1 = parsed[0]!.c
    for (const p of parsed) {
      r0 = Math.min(r0, p.r)
      r1 = Math.max(r1, p.r)
      c0 = Math.min(c0, p.c)
      c1 = Math.max(c1, p.c)
    }
    return { r0, r1, c0, c1 }
  }, [selectedKeys])

  const canMerge = !!selectionRect && (selectionRect.r0 !== selectionRect.r1 || selectionRect.c0 !== selectionRect.c1)
  const canSplit =
    !!focused &&
    (() => {
      const cell = table.rows[focused.r]?.[focused.c]
      return !!cell && (cell.colspan > 1 || cell.rowspan > 1)
    })()

  const mergeSelection = () => {
    if (!selectionRect) return
    const { r0, r1, c0, c1 } = selectionRect
    const rowSpan = r1 - r0 + 1
    const colSpan = c1 - c0 + 1
    if (rowSpan <= 1 && colSpan <= 1) return
    setTable((prev) => {
      const rows = prev.rows.map((rr) => rr.map((c) => ({ ...c, style: { ...c.style } })))
      // 先清理选择区域内所有现有 span（避免交叉）
      for (let rr = r0; rr <= r1; rr += 1) {
        for (let cc = c0; cc <= c1; cc += 1) {
          const cell = rows[rr]?.[cc]
          if (!cell) continue
          cell.colspan = 1
          cell.rowspan = 1
        }
      }
      const anchor = rows[r0]?.[c0]
      if (anchor) {
        anchor.colspan = colSpan
        anchor.rowspan = rowSpan
      }
      return { ...prev, rows, updatedAt: Date.now() }
    })
    setDirty(true)
    setToast('已合并')
  }

  const splitFocused = () => {
    if (!focused) return
    setTable((prev) => {
      const rows = prev.rows.map((rr) => rr.map((c) => ({ ...c, style: { ...c.style } })))
      const cell = rows[focused.r]?.[focused.c]
      if (!cell) return prev
      const rs = Math.max(1, cell.rowspan)
      const cs = Math.max(1, cell.colspan)
      if (rs <= 1 && cs <= 1) return prev
      cell.rowspan = 1
      cell.colspan = 1
      return { ...prev, rows, updatedAt: Date.now() }
    })
    setDirty(true)
    setToast('已拆分')
  }

  const selectSingle = (r: number, c: number) => {
    const k = buildCellKey(r, c)
    setFocused({ r, c })
    setSelectedKeys(new Set([k]))
  }

  const endLongPress = () => {
    selectingRef.current = false
    selectAnchorRef.current = null
    lastOverRef.current = null
  }

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const detachPendingPointerWindowListeners = () => {
    const fn = pendingPointerCleanupRef.current
    if (fn) {
      pendingPointerCleanupRef.current = null
      fn()
    }
  }

  const attachPendingPointerWindowListeners = (pointerId: number, r: number, c: number, x: number, y: number) => {
    detachPendingPointerWindowListeners()
    gestureIsScrollRef.current = false
    pendingCellDownRef.current = { r, c, x, y, pointerId }
    const slop2 = SCHEDULE_TAP_SLOP_PX * SCHEDULE_TAP_SLOP_PX

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (selectingRef.current) return
      const dx = e.clientX - x
      const dy = e.clientY - y
      if (dx * dx + dy * dy > slop2) {
        gestureIsScrollRef.current = true
        clearLongPressTimer()
      }
    }

    const onUpOrCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      clearLongPressTimer()
      if (selectingRef.current) {
        endLongPress()
      } else if (!gestureIsScrollRef.current && pendingCellDownRef.current) {
        const p = pendingCellDownRef.current
        selectSingle(p.r, p.c)
      }
      pendingCellDownRef.current = null
      detachPendingPointerWindowListeners()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUpOrCancel)
    window.addEventListener('pointercancel', onUpOrCancel)
    pendingPointerCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUpOrCancel)
      window.removeEventListener('pointercancel', onUpOrCancel)
    }
  }

  const beginLongPress = (r: number, c: number, pointerId: number) => {
    if (gestureIsScrollRef.current) return
    detachPendingPointerWindowListeners()
    selectingRef.current = true
    selectAnchorRef.current = { r, c }
    lastOverRef.current = { r, c }
    const rect = rangeRect({ r, c }, { r, c })
    const next = new Set<string>()
    for (let rr = rect.r0; rr <= rect.r1; rr += 1) {
      for (let cc = rect.c0; cc <= rect.c1; cc += 1) next.add(buildCellKey(rr, cc))
    }
    setSelectedKeys(next)
    setFocused({ r, c })
    setEditing(null)
    focusCellKeyRef.current = null
    try {
      gridRef.current?.setPointerCapture?.(pointerId)
    } catch {
      // ignore
    }
  }

  const updateLongPressRect = (r: number, c: number) => {
    if (!selectingRef.current) return
    const anchor = selectAnchorRef.current
    if (!anchor) return
    const rect = rangeRect(anchor, { r, c })
    const next = new Set<string>()
    for (let rr = rect.r0; rr <= rect.r1; rr += 1) {
      for (let cc = rect.c0; cc <= rect.c1; cc += 1) next.add(buildCellKey(rr, cc))
    }
    setSelectedKeys(next)
    lastOverRef.current = { r, c }
  }

  const pickCellFromPoint = (clientX: number, clientY: number): { r: number; c: number } | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const cellEl = el?.closest?.('[data-schedule-cell="1"]') as HTMLElement | null
    if (!cellEl) return null
    const r = Number(cellEl.dataset.r)
    const c = Number(cellEl.dataset.c)
    if (!Number.isFinite(r) || !Number.isFinite(c)) return null
    return { r: Math.max(0, Math.floor(r)), c: Math.max(0, Math.floor(c)) }
  }

  const runAiGenerate = async () => {
    const prompt = aiDraft.trim()
    if (!prompt) {
      setToast('请先描述需求')
      return
    }
    if (!apiConfig?.apiUrl?.trim() || !apiConfig.apiKey?.trim() || !apiConfig.modelId?.trim()) {
      setToast('未配置 AI API')
      return
    }
    setAiLoading(true)
    try {
      const next = await requestScheduleTableFromAi({
        apiConfig,
        userRequirement: prompt,
      })
      setTableWithUndo((prev) => {
        const cloned = sanitizeTable({
          ...prev,
          headers: next.headers,
          // 将 AI 结果写入 TableCell.content，保留现有样式/宽高
          rows: next.rows.map((r) =>
            r.slice(0, next.headers.length).map((txt) => ({
              content: String(txt ?? ''),
              style: { bold: false, italic: false, underline: false, strikethrough: false, highlight: false, align: 'left' as const },
              colspan: 1,
              rowspan: 1,
            })),
          ),
          updatedAt: Date.now(),
        } as any)
        // 对齐列宽/行高长度
        const cols = cloned.headers.length
        const rowsN = cloned.rows.length
        const columnWidths = [...(cloned.columnWidths ?? [])].slice(0, cols)
        while (columnWidths.length < cols) columnWidths.push(96)
        const rowHeights = [...(cloned.rowHeights ?? [])].slice(0, rowsN)
        while (rowHeights.length < rowsN) rowHeights.push(44)
        return { ...cloned, columnWidths, rowHeights, updatedAt: Date.now() }
      })
      setAiOpen(false)
      setToast('已生成')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败'
      setToast(msg.slice(0, 80))
    } finally {
      setAiLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1300] flex" role="presentation">
      <div
        className="absolute inset-0 z-0 bg-black/40"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) askClose()
        }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 ml-auto flex h-full w-full max-w-[520px] flex-col border-l bg-white"
        style={{ borderColor: COLORS.border, background: COLORS.bg }}
        initial={{ x: 520 }}
        animate={{ x: 0 }}
        exit={{ x: 520 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 顶部栏 */}
        <div
          className="flex items-center gap-2 border-b bg-white px-4"
          style={{
            borderColor: COLORS.border,
            paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
            paddingBottom: 10,
          }}
        >
          <button
            type="button"
            onClick={askClose}
            className="rounded-[10px] px-3 py-2 text-[13px] transition-colors hover:bg-[#f5f5f5]"
            style={{ color: COLORS.text }}
            disabled={!canClose}
          >
            返回
          </button>
          <p id={titleId} className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold" style={{ color: COLORS.text }}>
            {title}
          </p>
          <button
            type="button"
            onClick={() => void saveNow()}
            className="rounded-[10px] bg-black px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#111]"
            disabled={saving}
          >
            {saving ? '保存中' : '保存'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* 模板选择 */}
          <div className="rounded-[12px] border bg-white p-4" style={{ borderColor: COLORS.border }}>
            <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
              模板
            </p>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: COLORS.sub }}>
              选择模板会覆盖下方表格内容，加载后可随意修改，不影响原模板。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => applyTemplate(SCHEDULE_TEMPLATE_STUDENT)}
                className="rounded-[12px] border bg-white px-3 py-3 text-left transition-colors hover:bg-[#fafafa]"
                style={{ borderColor: COLORS.border }}
              >
                <p className="text-[13px] font-semibold" style={{ color: COLORS.text }}>
                  学生课程表
                </p>
                <p className="mt-1 text-[11px]" style={{ color: COLORS.faint }}>
                  周一到周日 · 多节次
                </p>
              </button>
              <button
                type="button"
                onClick={() => applyTemplate(SCHEDULE_TEMPLATE_DAILY)}
                className="rounded-[12px] border bg-white px-3 py-3 text-left transition-colors hover:bg-[#fafafa]"
                style={{ borderColor: COLORS.border }}
              >
                <p className="text-[13px] font-semibold" style={{ color: COLORS.text }}>
                  日常日程表
                </p>
                <p className="mt-1 text-[11px]" style={{ color: COLORS.faint }}>
                  时间段 · 一周安排
                </p>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setTable(defaultEmptySchedule())
                setDirty(true)
                setToast('已创建空白表格')
              }}
              className="mt-3 w-full rounded-[12px] border bg-white py-3 text-[13px] font-semibold transition-colors hover:bg-[#fafafa]"
              style={{ borderColor: COLORS.border, color: COLORS.text }}
            >
              自定义空白表格
            </button>
          </div>

          {/* 外观 */}
          <div className="mt-3 rounded-[12px] border bg-white p-4" style={{ borderColor: COLORS.border }}>
            <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
              外观
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'dark', label: '表头深灰' },
                  { key: 'light', label: '表头浅灰' },
                  { key: 'none', label: '表头无底' },
                ] as const
              ).map((x) => {
                const on = table.style.headerStyle === x.key
                return (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => setStyle({ headerStyle: x.key })}
                    className="rounded-[12px] border px-3 py-2 text-[12px] transition-colors"
                    style={{
                      borderColor: COLORS.border,
                      background: on ? '#111111' : '#ffffff',
                      color: on ? '#ffffff' : COLORS.text,
                    }}
                  >
                    {x.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'solid', label: '实线边框' },
                  { key: 'dashed', label: '虚线边框' },
                  { key: 'none', label: '无边框' },
                ] as const
              ).map((x) => {
                const on = table.style.borderStyle === x.key
                return (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => setStyle({ borderStyle: x.key })}
                    className="rounded-[12px] border px-3 py-2 text-[12px] transition-colors"
                    style={{
                      borderColor: COLORS.border,
                      background: on ? '#111111' : '#ffffff',
                      color: on ? '#ffffff' : COLORS.text,
                    }}
                  >
                    {x.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'compact', label: '行高紧凑' },
                  { key: 'normal', label: '行高正常' },
                  { key: 'loose', label: '行高宽松' },
                ] as const
              ).map((x) => {
                const on = table.style.rowHeight === x.key
                return (
                  <button
                    key={x.key}
                    type="button"
                    onClick={() => setStyle({ rowHeight: x.key })}
                    className="rounded-[12px] border px-3 py-2 text-[12px] transition-colors"
                    style={{
                      borderColor: COLORS.border,
                      background: on ? '#111111' : '#ffffff',
                      color: on ? '#ffffff' : COLORS.text,
                    }}
                  >
                    {x.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 工具栏 */}
          <div
            className="mt-3 rounded-[12px] border bg-white p-3"
            style={{ borderColor: COLORS.border }}
            onMouseDownCapture={(e) => {
              // 编辑态时点击工具栏不要让 textarea 失焦
              if (editing) e.preventDefault()
            }}
            onPointerDownCapture={(e) => {
              if (editing) e.preventDefault()
            }}
          >
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                disabled={!canUndo}
                onClick={undo}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                className="flex shrink-0 items-center gap-1 rounded-[10px] border px-3 py-2 text-[12px] transition-colors disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
                aria-label="撤销"
              >
                <Undo2 className="size-4" />
                撤销
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={redo}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                className="flex shrink-0 items-center gap-1 rounded-[10px] border px-3 py-2 text-[12px] transition-colors disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
                aria-label="重做"
              >
                <Redo2 className="size-4" />
                重做
              </button>

              {(
                [
                  { id: 'bold', icon: <Bold className="size-4" />, label: '粗体' },
                  { id: 'italic', icon: <Italic className="size-4" />, label: '斜体' },
                  { id: 'underline', icon: <Underline className="size-4" />, label: '下划线' },
                  { id: 'strike', icon: <Strikethrough className="size-4" />, label: '删除线' },
                  { id: 'highlight', icon: <Highlighter className="size-4" />, label: '高亮' },
                  { id: 'clear', icon: <Eraser className="size-4" />, label: '清除格式' },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={!canFormat}
                  onClick={() => onToolbar(b.id)}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  className="flex shrink-0 items-center gap-1 rounded-[10px] border px-3 py-2 text-[12px] transition-colors disabled:opacity-50"
                  style={{ borderColor: COLORS.border, color: COLORS.text }}
                >
                  {b.icon}
                  {b.label}
                </button>
              ))}
              <div className="h-6 w-px bg-[#e5e5e5]" />
              <button
                type="button"
                disabled={!canMerge}
                onClick={mergeSelection}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                className="flex shrink-0 items-center gap-1 rounded-[10px] border px-3 py-2 text-[12px] transition-colors disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
              >
                合并
              </button>
              <button
                type="button"
                disabled={!canSplit}
                onClick={splitFocused}
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                className="flex shrink-0 items-center gap-1 rounded-[10px] border px-3 py-2 text-[12px] transition-colors disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
              >
                拆分
              </button>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: COLORS.faint }}>
              轻点松手选中（略滑动视为滚动）；双击编辑；长按约半秒后拖动可框选多格（用于合并）。
            </p>
          </div>

          {/* 表格编辑 */}
          <div className="mt-3 rounded-[12px] border bg-white p-3" style={{ borderColor: COLORS.border }}>
            {/* 行列操作（移到表格上方，不占用表格格子） */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="mr-auto text-[12px]" style={{ color: COLORS.sub }}>
                {focused ? `当前：第 ${focused.r + 1} 行 · 第 ${focused.c + 1} 列` : '当前：未选中单元格'}
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[10px] border bg-white px-3 py-2 text-[12px] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
                onClick={() => insertRowBelow(focused?.r ?? table.rows.length - 1)}
              >
                <Plus className="size-3.5" /> 在下方插入行
              </button>
              <button
                type="button"
                disabled={table.rows.length <= 1 || !focused}
                className="inline-flex items-center gap-1 rounded-[10px] border bg-white px-3 py-2 text-[12px] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
                onClick={() => {
                  if (!focused) return
                  deleteRow(focused.r)
                  setFocused(null)
                  focusCellKeyRef.current = null
                }}
              >
                <Minus className="size-3.5" /> 删除当前行
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[10px] border bg-white px-3 py-2 text-[12px] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
                onClick={() => insertColRight(focused?.c ?? table.headers.length - 1)}
              >
                <Plus className="size-3.5" /> 在右侧插入列
              </button>
              <button
                type="button"
                disabled={table.headers.length <= 1 || !focused}
                className="inline-flex items-center gap-1 rounded-[10px] border bg-white px-3 py-2 text-[12px] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
                onClick={() => {
                  if (!focused) return
                  deleteCol(focused.c)
                  setFocused(null)
                  focusCellKeyRef.current = null
                }}
              >
                <Minus className="size-3.5" /> 删除当前列
              </button>
            </div>

            <div className="overflow-x-auto pb-1">
              <div style={{ minWidth: cols * 120 }}>
                {/* 表头 */}
                <div className="flex">
                  {table.headers.map((h, c) => (
                    <div
                      key={`h-${c}`}
                      className="relative shrink-0"
                      style={{
                        width: 120,
                        height: cellH,
                        borderRight: c === cols - 1 ? 'none' : border,
                        borderBottom: border,
                        background: headerVisual.bg,
                        color: headerVisual.color,
                      }}
                    >
                      <input
                        value={h}
                        onChange={(e) => setHeaderText(c, e.target.value)}
                        onFocus={() => {
                          focusCellKeyRef.current = null
                          setFocused(null)
                        }}
                        className="h-full w-full bg-transparent px-2 py-2 text-center text-[12px] outline-none"
                        style={{ color: headerVisual.color }}
                        inputMode="text"
                      />
                    </div>
                  ))}
                </div>

                {/* 行 */}
                <div
                  className="relative select-none"
                  ref={gridRef}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, 120px)`,
                    gridAutoRows: `${cellH}px`,
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    // 允许纵向/横向交给外层 overflow 滚动；长按框选开始后再在 move 里 preventDefault
                    touchAction: 'pan-x pan-y',
                  }}
                  onPointerMove={(e) => {
                    if (!selectingRef.current) return
                    const got = pickCellFromPoint(e.clientX, e.clientY)
                    if (!got) return
                    const last = lastOverRef.current
                    if (last && last.r === got.r && last.c === got.c) return
                    updateLongPressRect(got.r, got.c)
                    e.preventDefault()
                  }}
                  onPointerUp={() => {
                    clearLongPressTimer()
                    if (selectingRef.current) endLongPress()
                  }}
                  onPointerCancel={() => {
                    clearLongPressTimer()
                    if (selectingRef.current) endLongPress()
                  }}
                  onPointerLeave={() => {
                    if (selectingRef.current) endLongPress()
                  }}
                >
                  {table.rows.map((row, r) =>
                    row.map((cell, c) => {
                      // 被 rowspan/colspan 覆盖的格子跳过（非锚点）
                      const coveredByOther = (() => {
                        for (let rr = 0; rr < table.rows.length; rr += 1) {
                          for (let cc = 0; cc < table.headers.length; cc += 1) {
                            const cell = table.rows[rr]?.[cc]
                            if (!cell) continue
                            if (rr === r && cc === c) continue
                            if ((cell.rowspan > 1 || cell.colspan > 1) && spanCoversCell({ r: rr, c: cc, rowspan: cell.rowspan, colspan: cell.colspan }, { r, c })) {
                              return { r: rr, c: cc }
                            }
                          }
                        }
                        return null
                      })()
                      if (coveredByOther) return null
                      const spanCell = table.rows[r]?.[c]
                      const span =
                        spanCell && (spanCell.rowspan > 1 || spanCell.colspan > 1)
                          ? { rowSpan: spanCell.rowspan, colSpan: spanCell.colspan }
                          : null
                      const k = buildCellKey(r, c)
                      const isSelected = selectedKeys.has(k)
                      const isEditing = !!editing && editing.r === r && editing.c === c
                      const borderColor = isSelected ? '#111111' : COLORS.border
                      const outline = isSelected ? '2px solid #111111' : '1px solid transparent'
                      const z = isSelected ? 5 : 1
                      return (
                        <div
                          key={`g-${r}-${c}`}
                          className="bg-white"
                          data-schedule-cell="1"
                          data-r={r}
                          data-c={c}
                          style={{
                            gridColumn: `${c + 1} / span ${span?.colSpan ?? 1}`,
                            gridRow: `${r + 1} / span ${span?.rowSpan ?? 1}`,
                            borderRight: border,
                            borderBottom: border,
                            borderLeft: border,
                            borderTop: border,
                            borderColor,
                            position: 'relative',
                            zIndex: z,
                          }}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return
                            if (isEditing) return
                            clearLongPressTimer()
                            setEditing(null)
                            focusCellKeyRef.current = null
                            // 滑动超过 SCHEDULE_TAP_SLOP_PX 视为滚动，松手不选中；长按进入框选后再 capture
                            attachPendingPointerWindowListeners(e.pointerId, r, c, e.clientX, e.clientY)
                            longPressTimerRef.current = window.setTimeout(() => {
                              longPressTimerRef.current = null
                              if (gestureIsScrollRef.current) return
                              beginLongPress(r, c, e.pointerId)
                            }, SCHEDULE_LONG_PRESS_MS)
                          }}
                          onDoubleClick={() => {
                            // 双击进入编辑（呼出键盘）
                            setEditing({ r, c })
                            setFocused({ r, c })
                            setSelectedKeys(new Set([k]))
                            // 关键：移动端必须在用户手势链路内 focus，异步 focus 常被系统拦截导致不弹键盘
                            const el = cellRefs.current.get(k) as any
                            // React setState 是异步的：此刻 DOM 仍可能是 readOnly=true。
                            // 若 readOnly 未解除，移动端常出现“有光标但键盘不弹”。
                            try {
                              if (el) {
                                el.readOnly = false
                                el.removeAttribute?.('readonly')
                                el.style.pointerEvents = 'auto'
                              }
                            } catch {
                              // ignore
                            }
                            el?.focus?.()
                          }}
                        >
                          {/* 始终渲染 textarea：非编辑态只读 + 不接收指针；双击时可在同一手势内直接 focus 弹键盘 */}
                          <textarea
                            ref={(el) => {
                              if (!el) cellRefs.current.delete(k)
                              else cellRefs.current.set(k, el as any)
                            }}
                            readOnly={!isEditing}
                            value={String(cell?.content ?? '')}
                            onChange={(e) => setCellContent(r, c, e.target.value)}
                            className="h-full w-full resize-none bg-transparent px-2 py-2 text-[14px] leading-snug outline-none"
                            style={{
                              fontWeight: cell?.style?.bold ? 700 : 400,
                              fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                              textDecoration: `${cell?.style?.underline ? 'underline' : ''} ${cell?.style?.strikethrough ? 'line-through' : ''}`.trim() || 'none',
                              background: cell?.style?.highlight ? '#e5e5e5' : 'transparent',
                              textAlign: cell?.style?.align ?? 'left',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: '#000000',
                              pointerEvents: isEditing ? 'auto' : 'none',
                            }}
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab') {
                                e.preventDefault()
                                const dir = e.shiftKey ? -1 : 1
                                const nextC0 = c + dir
                                const nextC = nextC0 < 0 ? cols - 1 : nextC0 >= cols ? 0 : nextC0
                                const nextR =
                                  nextC0 < 0 ? Math.max(0, r - 1) : nextC0 >= cols ? Math.min(table.rows.length - 1, r + 1) : r
                                const nk = buildCellKey(nextR, nextC)
                                setEditing({ r: nextR, c: nextC })
                                setFocused({ r: nextR, c: nextC })
                                setSelectedKeys(new Set([nk]))
                                const el = cellRefs.current.get(nk) as any
                                el?.focus?.()
                              }
                            }}
                            onBlur={() => {
                              setEditing(null)
                              focusCellKeyRef.current = null
                            }}
                          />
                          {isSelected ? (
                            <div
                              aria-hidden
                              style={{
                                position: 'absolute',
                                inset: -1,
                                border: outline,
                                borderRadius: 6,
                                pointerEvents: 'none',
                              }}
                            />
                          ) : null}
                        </div>
                      )
                    }),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI 生成 */}
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="mt-3 w-full rounded-[12px] bg-black py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#111] disabled:opacity-60"
            disabled={aiLoading}
          >
            {aiLoading ? '生成中…' : 'AI生成表格'}
          </button>

          {/* 隐藏：给开发者/调试的最小上下文 */}
          <div className="mt-2 text-[11px]" style={{ color: COLORS.faint }}>
            当前列数 {cols} · 行数 {table.rows.length}
          </div>
        </div>

        {/* toast（需要盖过底部 AI 面板等浮层） */}
        {toast ? (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-[12px] bg-black/80 px-3 py-2 text-[12px] text-white">
            {toast}
          </div>
        ) : null}

        {/* AI generating modal */}
        <AnimatePresence>
          {aiLoading ? (
            <motion.div
              className="absolute inset-0 z-[60] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/40" />
              <motion.div
                className="relative w-[88%] max-w-[360px] rounded-[16px] border bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                style={{ borderColor: COLORS.border }}
                initial={{ scale: 0.96, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.98, y: 8 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                role="alertdialog"
                aria-modal="true"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 shrink-0 animate-spin rounded-full border-[3px] border-[#e5e5e5] border-t-[#111111]"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
                      正在生成表格…
                    </p>
                    <p className="mt-1 text-[12px]" style={{ color: COLORS.sub }}>
                      请稍等，生成完成会自动替换当前表格
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* AI bottom sheet */}
        <AnimatePresence>
          {aiOpen ? (
            <motion.div
              className="absolute inset-0 z-[40] flex items-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/30"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget && !aiLoading) setAiOpen(false)
                }}
              />
              <motion.div
                className="relative w-full rounded-t-[16px] border-t bg-white p-4"
                style={{ borderColor: COLORS.border }}
                initial={{ y: 320 }}
                animate={{ y: 0 }}
                exit={{ y: 320 }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <p className="text-[14px] font-semibold" style={{ color: COLORS.text }}>
                  AI生成表格
                </p>
                <p className="mt-1 text-[12px] leading-relaxed" style={{ color: COLORS.sub }}>
                  描述你想要的日程表，例如：帮我生成一个大学生课程表，周一到周五上午有课，下午没课。
                </p>
                <textarea
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  className="mt-3 h-24 w-full resize-none rounded-[12px] border px-3 py-2 text-[13px] outline-none"
                  style={{ borderColor: COLORS.border, color: COLORS.text }}
                  placeholder="请输入你的需求…"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiOpen(false)}
                    className="flex-1 rounded-[12px] border bg-white py-3 text-[13px] font-semibold transition-colors hover:bg-[#fafafa]"
                    style={{ borderColor: COLORS.border, color: COLORS.text }}
                    disabled={aiLoading}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAiGenerate()}
                    className="flex-1 rounded-[12px] bg-black py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#111] disabled:opacity-60"
                    disabled={aiLoading}
                  >
                    {aiLoading ? '生成中…' : '生成'}
                  </button>
                </div>
                <div className="mt-3 rounded-[12px] border bg-[#fafafa] p-3" style={{ borderColor: COLORS.border }}>
                  <p className="text-[11px]" style={{ color: COLORS.faint }}>
                    生成会替换当前表格内容；外观设置会保留。
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: COLORS.faint }}>
                    当前表格（供参考）：{JSON.stringify(normalizeRowsForAi).slice(0, 120)}…
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

