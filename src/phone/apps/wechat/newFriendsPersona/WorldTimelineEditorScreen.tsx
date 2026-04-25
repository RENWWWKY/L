import { ArrowLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { TimelineEvent, TimelineEventImportance } from './types'
import { formatTimelineEventDate, timelineSortKey } from './types'
import { uid } from './utils'

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate()
}

const C = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
  line: '#000000',
} as const

const cardShadow = '0 1px 3px rgba(0,0,0,0.05)'

type FilterImp = 'all' | TimelineEventImportance

function importanceLabel(i: TimelineEventImportance) {
  if (i === 'critical') return '关键事件'
  if (i === 'important') return '重要事件'
  return '普通事件'
}

function importanceChipStyle(i: TimelineEventImportance): CSSProperties {
  if (i === 'critical') return { background: C.text, color: '#fff' }
  if (i === 'important') return { background: C.sub, color: '#fff' }
  return { background: C.border, color: C.text }
}

export function WorldTimelineEditorScreen({
  timeline,
  onChange,
  onBack,
}: {
  timeline: TimelineEvent[]
  onChange: (next: TimelineEvent[]) => void
  onBack: () => void
}) {
  const [filter, setFilter] = useState<FilterImp>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [eventModal, setEventModal] = useState<
    null | {
      mode: 'add' | 'edit'
      id?: string
      yearStr: string
      month: number | ''
      day: number | ''
      title: string
      importance: TimelineEventImportance
      description: string
    }
  >(null)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const sortedFiltered = useMemo(() => {
    let list = [...timeline]
    if (filter !== 'all') list = list.filter((e) => e.importance === filter)
    // 越靠上越新（日历时间更晚）；同日则后创建的靠上
    list.sort((a, b) => {
      const d = timelineSortKey(b) - timelineSortKey(a)
      if (d !== 0) return d
      return b.createdAt - a.createdAt
    })
    return list
  }, [timeline, filter])

  const openAdd = () => {
    setEventModal({
      mode: 'add',
      yearStr: String(new Date().getFullYear()),
      month: '',
      day: '',
      title: '',
      importance: 'normal',
      description: '',
    })
  }

  const saveEventModal = () => {
    if (!eventModal) return
    const ys = eventModal.yearStr.trim()
    if (!ys) {
      window.alert('请填写年份')
      return
    }
    const year = parseInt(ys, 10)
    if (!Number.isFinite(year)) {
      window.alert('请填写有效年份（可为负数表示公元前）')
      return
    }
    if (eventModal.month === '' && eventModal.day !== '') {
      window.alert('选择日期前请先选择月份')
      return
    }
    let month: number | null = null
    let day: number | null = null
    if (eventModal.month !== '') {
      month = eventModal.month
      if (eventModal.day !== '') {
        const maxD = daysInMonth(year, month)
        day = Math.min(maxD, Math.max(1, eventModal.day))
      }
    }
    if (!eventModal.title.trim()) {
      window.alert('请填写事件标题')
      return
    }
    const timeLabel = formatTimelineEventDate({ year, month, day, time: undefined })
    const now = Date.now()
    if (eventModal.mode === 'add') {
      const ev: TimelineEvent = {
        id: uid('tl'),
        year,
        month,
        day,
        time: timeLabel,
        title: eventModal.title.trim(),
        importance: eventModal.importance,
        description: eventModal.description.trim(),
        createdAt: now,
      }
      onChange([...timeline, ev])
    } else if (eventModal.id) {
      onChange(
        timeline.map((e) =>
          e.id === eventModal.id
            ? {
                ...e,
                year,
                month,
                day,
                time: timeLabel,
                title: eventModal.title.trim(),
                importance: eventModal.importance,
                description: eventModal.description.trim(),
              }
            : e,
        ),
      )
    }
    setEventModal(null)
  }

  const deleteEvent = (id: string) => {
    onChange(timeline.filter((e) => e.id !== id))
    setActionMenuId(null)
    setEventModal(null)
  }

  const toggleExpand = useCallback((id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }))
  }, [])

  const clearLp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    pointerStart.current = null
  }

  const onCardPointerDown = (ev: TimelineEvent, e: React.PointerEvent) => {
    if (e.button !== 0) return
    longPressFired.current = false
    clearLp()
    pointerStart.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      longPressFired.current = true
      setActionMenuId(ev.id)
    }, 500)
  }

  const onCardPointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (Math.hypot(dx, dy) > 10) clearLp()
  }

  const onCardPointerUp = (id: string) => {
    clearLp()
    if (!longPressFired.current) toggleExpand(id)
  }

  const filterBtn = (key: FilterImp, label: string, filled: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out"
      style={
        filled
          ? { background: C.text, color: '#fff' }
          : { border: `1px solid ${C.text}`, background: C.card, color: C.text }
      }
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.bg }}>
      <header
        className="grid shrink-0 grid-cols-[40px_1fr_auto] items-center gap-2 border-b px-4 pb-3"
        style={{
          borderColor: C.border,
          background: C.bg,
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:bg-black/5"
          aria-label="返回"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" style={{ color: C.text }} strokeWidth={2} />
        </button>
        <h1 className="min-w-0 truncate text-center text-[18px] font-bold" style={{ color: C.text }}>
          时间线
        </h1>
        <button
          type="button"
          className="shrink-0 text-[16px] font-semibold transition-opacity duration-200 ease-out hover:opacity-70"
          style={{ color: C.text }}
          onClick={openAdd}
        >
          添加事件
        </button>
      </header>

      <div
        className="mx-4 mt-4 flex shrink-0 flex-wrap gap-2 rounded-[12px] border bg-white p-3"
        style={{ borderColor: C.border, boxShadow: cardShadow }}
      >
        {filterBtn('all', '全部', filter === 'all')}
        {filterBtn('critical', '关键事件', filter === 'critical')}
        {filterBtn('important', '重要事件', filter === 'important')}
        {filterBtn('normal', '普通事件', filter === 'normal')}
      </div>

      <p className="mx-4 mt-2 text-center text-[12px] leading-relaxed" style={{ color: C.faint }}>
        列表自上而下：越靠上越接近现在，越靠下越久远
      </p>

      <div
        className="relative mx-4 mb-4 mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingLeft: 20 }}
      >
        <div
          className="absolute bottom-4 left-[5px] top-3 w-px"
          style={{ background: C.line }}
          aria-hidden
        />

        {sortedFiltered.length === 0 ? (
          <p className="py-12 text-center text-[14px]" style={{ color: C.faint }}>
            暂无事件，点击右上角添加
          </p>
        ) : (
          <div className="space-y-4">
            {sortedFiltered.map((ev) => (
              <div key={ev.id} className="relative">
                <div
                  className="absolute left-[-15px] top-5 size-3 -translate-x-1/2 rounded-full"
                  style={{ background: C.text }}
                  aria-hidden
                />
                <div
                  role="button"
                  tabIndex={0}
                  className="rounded-[12px] border bg-white p-4 transition-all duration-200 ease-out active:bg-black/[0.02]"
                  style={{ borderColor: C.border, boxShadow: cardShadow }}
                  onPointerDown={(e) => onCardPointerDown(ev, e)}
                  onPointerMove={onCardPointerMove}
                  onPointerUp={() => onCardPointerUp(ev.id)}
                  onPointerCancel={clearLp}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleExpand(ev.id)
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px]" style={{ color: C.sub }}>
                      {formatTimelineEventDate(ev)}
                    </span>
                    <span
                      className="rounded-[8px] px-2 py-1 text-[12px] font-medium"
                      style={importanceChipStyle(ev.importance)}
                    >
                      {importanceLabel(ev.importance)}
                    </span>
                  </div>
                  <p className="mt-2 text-[16px] font-semibold" style={{ color: C.text }}>
                    {ev.title}
                  </p>
                  <p
                    className={`mt-2 text-[14px] leading-relaxed ${expanded[ev.id] ? '' : 'line-clamp-3'}`}
                    style={{ color: C.sub }}
                  >
                    {ev.description?.trim() ? ev.description : '（无描述）'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionMenuId ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setActionMenuId(null)}
        >
          <div
            className="w-full max-w-[320px] rounded-[16px] bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-[16px] font-semibold" style={{ color: C.text }}>
              操作
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-[12px] border py-3 text-[14px] font-medium transition-all duration-200 ease-out"
              style={{ borderColor: C.text, color: C.text }}
              onClick={() => {
                const ev = timeline.find((x) => x.id === actionMenuId)
                setActionMenuId(null)
                if (ev) {
                  setEventModal({
                    mode: 'edit',
                    id: ev.id,
                    yearStr: String(ev.year),
                    month: ev.month ?? '',
                    day: ev.day ?? '',
                    title: ev.title,
                    importance: ev.importance,
                    description: ev.description,
                  })
                }
              }}
            >
              编辑
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-[12px] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
              style={{ background: '#ff3b30' }}
              onClick={() => actionMenuId && deleteEvent(actionMenuId)}
            >
              删除
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-[12px] border py-3 text-[14px] transition-all duration-200 ease-out"
              style={{ borderColor: C.border, color: C.sub }}
              onClick={() => setActionMenuId(null)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {eventModal ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="max-h-[90vh] w-full max-w-[400px] overflow-y-auto rounded-[16px] bg-white p-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <p className="text-center text-[18px] font-bold" style={{ color: C.text }}>
              {eventModal.mode === 'add' ? '添加历史事件' : '编辑历史事件'}
            </p>
            <div className="mt-5">
              <span className="text-[12px]" style={{ color: C.sub }}>
                事件日期
              </span>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: C.faint }}>
                年份必填；月、日可选。公元前请填负数年份（如 -221 表示公元前 221 年）。
              </p>
              <label className="mt-3 block">
                <span className="text-[12px]" style={{ color: C.sub }}>
                  年（必填）
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={eventModal.yearStr}
                  onChange={(e) => setEventModal((m) => (m ? { ...m, yearStr: e.target.value } : m))}
                  placeholder="如 2025 或 -221"
                  className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none"
                  style={{ borderColor: C.border, color: C.text }}
                />
              </label>
              <label className="mt-3 block">
                <span className="text-[12px]" style={{ color: C.sub }}>
                  月（可选）
                </span>
                <select
                  value={eventModal.month === '' ? '' : String(eventModal.month)}
                  onChange={(e) => {
                    const v = e.target.value
                    setEventModal((m) => {
                      if (!m) return m
                      if (v === '') return { ...m, month: '', day: '' }
                      const mo = Number(v)
                      return { ...m, month: mo, day: '' }
                    })
                  }}
                  className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none"
                  style={{ borderColor: C.border, color: C.text }}
                >
                  <option value="">不指定</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                    <option key={mo} value={String(mo)}>
                      {mo} 月
                    </option>
                  ))}
                </select>
              </label>
              {eventModal.month !== '' ? (
                <label className="mt-3 block">
                  <span className="text-[12px]" style={{ color: C.sub }}>
                    日（可选）
                  </span>
                  <select
                    value={eventModal.day === '' ? '' : String(eventModal.day)}
                    onChange={(e) => {
                      const v = e.target.value
                      setEventModal((m) => (m ? { ...m, day: v === '' ? '' : Number(v) } : m))
                    }}
                    className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none"
                    style={{ borderColor: C.border, color: C.text }}
                  >
                    <option value="">不指定</option>
                    {(() => {
                      const yParsed = parseInt(eventModal.yearStr.trim(), 10)
                      const ySafe = Number.isFinite(yParsed) ? yParsed : 2024
                      const maxD = daysInMonth(ySafe, eventModal.month as number)
                      return Array.from({ length: maxD }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>
                          {d} 日
                        </option>
                      ))
                    })()}
                  </select>
                </label>
              ) : null}
            </div>
            <label className="mt-3 block">
              <span className="text-[12px]" style={{ color: C.sub }}>
                事件标题
              </span>
              <input
                value={eventModal.title}
                onChange={(e) => setEventModal((m) => (m ? { ...m, title: e.target.value } : m))}
                placeholder="请输入事件标题"
                className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none"
                style={{ borderColor: C.border, color: C.text }}
              />
            </label>
            <div className="mt-3">
              <span className="text-[12px]" style={{ color: C.sub }}>
                重要程度
              </span>
              <div className="mt-2 flex flex-col gap-2">
                {(['normal', 'important', 'critical'] as const).map((imp) => (
                  <label
                    key={imp}
                    className="flex cursor-pointer items-center gap-2 rounded-[12px] border px-3 py-2 transition-all duration-200 ease-out"
                    style={{
                      borderColor: eventModal.importance === imp ? C.text : C.border,
                      background: C.card,
                    }}
                  >
                    <input
                      type="radio"
                      name="wb-tl-imp"
                      checked={eventModal.importance === imp}
                      onChange={() => setEventModal((m) => (m ? { ...m, importance: imp } : m))}
                      className="size-4 accent-black"
                    />
                    <span className="text-[14px]" style={{ color: C.text }}>
                      {importanceLabel(imp)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <label className="mt-3 block">
              <span className="text-[12px]" style={{ color: C.sub }}>
                事件描述
              </span>
              <textarea
                value={eventModal.description}
                onChange={(e) => setEventModal((m) => (m ? { ...m, description: e.target.value } : m))}
                placeholder="请输入事件详细描述"
                rows={5}
                className="mt-1 min-h-[120px] w-full resize-none rounded-[12px] border bg-white px-4 py-3 text-[14px] outline-none"
                style={{ borderColor: C.border, color: C.text }}
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-3 text-[14px] font-medium transition-all duration-200 ease-out"
                style={{ borderColor: C.text, color: C.text }}
                onClick={() => setEventModal(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: C.text }}
                onClick={saveEventModal}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
