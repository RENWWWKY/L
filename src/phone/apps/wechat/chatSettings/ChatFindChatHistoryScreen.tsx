import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'

import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatMessageSearchIndexRow } from '../newFriendsPersona/types'
import { useWeChatCurrentTime } from '../time/useWeChatCurrentTime'
import { ChatSearchResultRow } from './ChatSearchResultRow'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function localDateKey(y: number, monthIndex: number, day: number): string {
  return `${y}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

type MainTab = 'date' | 'content'

type DayCellKind =
  | 'padding'
  | 'future'
  | 'beforeFirst'
  | 'noChat'
  | 'hasChat'
  | 'selected'

function CalendarDayCell({
  label,
  kind,
  showTodayDot,
  onPress,
}: {
  label: string | number
  kind: DayCellKind
  showTodayDot: boolean
  onPress: () => void
}) {
  const isPad = kind === 'padding'
  if (isPad) {
    return <div className="aspect-square w-full" aria-hidden />
  }

  const interactive = kind === 'hasChat'
  const selected = kind === 'selected'
  const base =
    'flex aspect-square w-full flex-col items-center justify-center rounded-[8px] text-[15px] transition-[background,color,opacity] duration-200 ease-out'

  let cls = base

  if (selected) {
    cls += ' bg-black font-medium text-white'
  } else if (kind === 'future') {
    cls += ' cursor-default text-[#cccccc]'
  } else if (kind === 'beforeFirst' || kind === 'noChat') {
    cls += ' cursor-default text-[#999999]'
  } else if (kind === 'hasChat') {
    cls += ' cursor-pointer font-medium text-black hover:bg-[#f0f0f0]'
  }

  const content = (
    <>
      <span>{label}</span>
      {showTodayDot && !selected ? (
        <span className="mt-0.5 block h-1 w-1 shrink-0 rounded-full bg-black" aria-hidden />
      ) : (
        <span className="mt-0.5 block h-1 w-1 shrink-0 rounded-full bg-transparent" aria-hidden />
      )}
    </>
  )

  if (interactive) {
    return (
      <Pressable type="button" onClick={onPress} className={cls}>
        {content}
      </Pressable>
    )
  }

  return (
    <div className={cls} aria-hidden={kind === 'future'}>
      {content}
    </div>
  )
}

export type ChatFindChatHistoryScreenProps = {
  conversationKey: string
  peerCharacterId: string
  peerDisplayName: string
  peerAvatarUrl?: string
  onBack: () => void
  onJumpToChatMessage: (messageId: string) => void
}

export function ChatFindChatHistoryScreen({
  conversationKey,
  peerCharacterId,
  peerDisplayName,
  peerAvatarUrl,
  onBack,
  onJumpToChatMessage,
}: ChatFindChatHistoryScreenProps) {
  const { currentTimeMs } = useWeChatCurrentTime({ characterId: peerCharacterId })
  const [mainTab, setMainTab] = useState<MainTab>('date')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<WeChatMessageSearchIndexRow[]>([])
  const [indexBust, setIndexBust] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchRunIdRef = useRef(0)
  const searchIndexCacheRef = useRef<Map<string, WeChatMessageSearchIndexRow[]>>(new Map())
  const workerRef = useRef<Worker | null>(null)

  const [meta, setMeta] = useState<{ minTimestamp: number | null; dateSet: Set<string> } | null>(null)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date(currentTimeMs).getFullYear())
  const [viewMonth0, setViewMonth0] = useState(() => new Date(currentTimeMs).getMonth())

  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    try {
      const w = new Worker(new URL('./chatSearch.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = w
      return () => {
        w.terminate()
        workerRef.current = null
      }
    } catch {
      workerRef.current = null
      return undefined
    }
  }, [])

  useEffect(() => {
    const on = () => {
      searchIndexCacheRef.current.delete(conversationKey)
      setIndexBust((b) => b + 1)
    }
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [conversationKey])

  useEffect(() => {
    if (mainTab !== 'content') return
    const el = searchInputRef.current
    if (!el) return
    window.setTimeout(() => el.focus(), 0)
  }, [mainTab])

  useEffect(() => {
    const q = debouncedQuery.trim()
    const runId = ++searchRunIdRef.current
    if (!q) {
      setSearchLoading(false)
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    void (async () => {
      let rows = searchIndexCacheRef.current.get(conversationKey)
      if (!rows) {
        rows = await personaDb.listWeChatMessagesForSearchIndex(conversationKey)
        searchIndexCacheRef.current.set(conversationKey, rows)
      }
      if (searchRunIdRef.current !== runId) return

      const w = workerRef.current
      let matches: Array<{ id: string; timestamp: number }> = []

      if (w) {
        try {
          matches = await new Promise((resolve, reject) => {
            const onMsg = (e: MessageEvent<{ matches: typeof matches }>) => {
              w.removeEventListener('message', onMsg)
              w.removeEventListener('error', onErr)
              resolve(e.data.matches ?? [])
            }
            const onErr = () => {
              w.removeEventListener('message', onMsg)
              w.removeEventListener('error', onErr)
              reject(new Error('worker'))
            }
            w.addEventListener('message', onMsg)
            w.addEventListener('error', onErr, { once: true })
            w.postMessage({
              rows: rows!.map((r) => ({ id: r.id, content: r.content, timestamp: r.timestamp })),
              keyword: q,
            })
          })
        } catch {
          const res = await personaDb.searchWeChatConversationMessagesByKeyword(conversationKey, q)
          if (searchRunIdRef.current !== runId) return
          setSearchResults(res)
          setSearchLoading(false)
          return
        }
      } else {
        const res = await personaDb.searchWeChatConversationMessagesByKeyword(conversationKey, q)
        if (searchRunIdRef.current !== runId) return
        setSearchResults(res)
        setSearchLoading(false)
        return
      }

      if (searchRunIdRef.current !== runId) return
      const byId = new Map(rows!.map((r) => [r.id, r]))
      const full: WeChatMessageSearchIndexRow[] = []
      for (const m of matches) {
        const row = byId.get(m.id)
        if (row) full.push(row)
      }
      setSearchResults(full)
      setSearchLoading(false)
    })()
  }, [debouncedQuery, conversationKey, indexBust])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { minTimestamp, dateKeys } = await personaDb.getWeChatConversationCalendarMeta(conversationKey, currentTimeMs)
      if (cancelled) return
      setMeta({ minTimestamp, dateSet: new Set(dateKeys) })
    })()
    return () => {
      cancelled = true
    }
  }, [conversationKey, currentTimeMs])

  const today = useMemo(() => {
    const n = new Date(currentTimeMs)
    return localDateKey(n.getFullYear(), n.getMonth(), n.getDate())
  }, [currentTimeMs])

  const minMonthStart = useMemo(() => {
    if (meta?.minTimestamp == null) return startOfMonth(new Date(currentTimeMs))
    return startOfMonth(new Date(meta.minTimestamp))
  }, [meta?.minTimestamp, currentTimeMs])

  const maxMonthStart = useMemo(() => startOfMonth(new Date(currentTimeMs)), [currentTimeMs])

  const canPrevMonth = useMemo(() => {
    const cur = new Date(viewYear, viewMonth0, 1)
    return cur > minMonthStart
  }, [viewYear, viewMonth0, minMonthStart])

  const canNextMonth = useMemo(() => {
    const cur = new Date(viewYear, viewMonth0, 1)
    return cur < maxMonthStart
  }, [viewYear, viewMonth0, maxMonthStart])

  useEffect(() => {
    if (!meta) return
    const cur = new Date(viewYear, viewMonth0, 1)
    if (cur < minMonthStart) {
      setViewYear(minMonthStart.getFullYear())
      setViewMonth0(minMonthStart.getMonth())
    } else if (cur > maxMonthStart) {
      setViewYear(maxMonthStart.getFullYear())
      setViewMonth0(maxMonthStart.getMonth())
    }
  }, [meta, minMonthStart, maxMonthStart, viewYear, viewMonth0])

  const goPrevMonth = useCallback(() => {
    if (!canPrevMonth) return
    setViewMonth0((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }, [canPrevMonth])

  const goNextMonth = useCallback(() => {
    if (!canNextMonth) return
    setViewMonth0((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }, [canNextMonth])

  const onDayClick = useCallback(
    async (dateKey: string) => {
      if (!meta?.dateSet.has(dateKey)) return
      setSelectedDateKey(dateKey)
      const first = await personaDb.getFirstWeChatMessageOnLocalDateKey(conversationKey, dateKey)
      if (!first) return
      onJumpToChatMessage(first.id)
    },
    [conversationKey, meta?.dateSet, onJumpToChatMessage],
  )

  const firstChatDateKey = useMemo(() => {
    if (meta?.minTimestamp == null) return null
    const d = new Date(meta.minTimestamp)
    return localDateKey(d.getFullYear(), d.getMonth(), d.getDate())
  }, [meta?.minTimestamp])

  const gridCells = useMemo(() => {
    const y = viewYear
    const m0 = viewMonth0
    const first = new Date(y, m0, 1)
    const daysInMonth = new Date(y, m0 + 1, 0).getDate()
    const mondayBased = (first.getDay() + 6) % 7
    const cells: Array<{
      key: string
      day?: number
      dateKey?: string
      kind: DayCellKind
      showTodayDot: boolean
    }> = []

    for (let i = 0; i < mondayBased; i += 1) {
      cells.push({ key: `p-${i}`, kind: 'padding', showTodayDot: false })
    }

    const now = new Date(currentTimeMs)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = localDateKey(y, m0, day)
      const dayStart = new Date(y, m0, day).getTime()
      const isFuture = dayStart > endOfToday
      const hasChat = meta?.dateSet.has(dateKey) ?? false
      const beforeFirst = firstChatDateKey != null && dateKey < firstChatDateKey && !isFuture
      const isToday = dateKey === today
      const sel = selectedDateKey === dateKey

      let kind: DayCellKind
      if (isFuture) kind = 'future'
      else if (beforeFirst) kind = 'beforeFirst'
      else if (sel) kind = 'selected'
      else if (hasChat) kind = 'hasChat'
      else kind = 'noChat'

      const showTodayDot = isToday && hasChat && !sel

      cells.push({
        key: dateKey,
        day,
        dateKey,
        kind,
        showTodayDot,
      })
    }

    return cells
  }, [viewYear, viewMonth0, meta?.dateSet, firstChatDateKey, today, selectedDateKey])

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientX
    if (end == null) return
    const dx = end - start
    if (dx > 60) goPrevMonth()
    else if (dx < -60) goNextMonth()
  }

  const titleText = `${viewYear}年${viewMonth0 + 1}月`

  const showSearchClear = query.length > 0
  const contentKeyword = debouncedQuery.trim()

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#f5f5f5] [&::-webkit-scrollbar]:w-0 [scrollbar-width:none]"
      style={{ boxSizing: 'border-box' }}
    >
      <header
        className="shrink-0 border-b px-4 pb-3"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          borderColor: '#e5e5e5',
          background: '#f5f5f5',
        }}
      >
        <div className="flex w-full items-center">
          <Pressable
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity duration-200 ease-out"
          >
            <ArrowLeft className="size-5 text-black" strokeWidth={2} />
          </Pressable>
          <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">查找聊天记录</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-0 [scrollbar-width:none]">
        {/* 搜索栏 */}
        <div
          className="mx-4 mt-4 rounded-[12px] bg-white px-3 py-3 transition-shadow duration-200 ease-out"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-[#666666]" strokeWidth={1.75} aria-hidden />
            <input
              ref={searchInputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="搜索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-black outline-none placeholder:text-[#999999]"
            />
            {showSearchClear ? (
              <Pressable
                type="button"
                aria-label="清空"
                onClick={() => setQuery('')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity duration-200 ease-out"
              >
                <X className="size-4 text-[#666666]" strokeWidth={2} />
              </Pressable>
            ) : null}
          </div>
        </div>

        {/* 分段：按日期 / 按内容 */}
        <div
          className="mx-4 mt-3 flex gap-1 rounded-[12px] bg-white p-1 transition-shadow duration-200 ease-out"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <Pressable
            type="button"
            onClick={() => setMainTab('date')}
            className={`flex-1 rounded-[8px] py-2 text-center text-[15px] font-medium transition-[background,color] duration-200 ease-out ${
              mainTab === 'date' ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            按日期查找
          </Pressable>
          <Pressable
            type="button"
            onClick={() => setMainTab('content')}
            className={`flex-1 rounded-[8px] py-2 text-center text-[15px] font-medium transition-[background,color] duration-200 ease-out ${
              mainTab === 'content' ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            按内容搜索
          </Pressable>
        </div>

        {mainTab === 'date' ? (
          <>
            <div
              className="mx-4 mt-3 rounded-[12px] bg-white px-5 py-5 transition-shadow duration-200 ease-out"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div className="mb-4 flex items-center justify-between">
                <Pressable
                  type="button"
                  aria-label="上月"
                  disabled={!canPrevMonth}
                  onClick={goPrevMonth}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft
                    className="size-5"
                    strokeWidth={2}
                    style={{ color: canPrevMonth ? '#000000' : '#999999' }}
                  />
                </Pressable>
                <p className="text-[16px] font-semibold text-black">{titleText}</p>
                <Pressable
                  type="button"
                  aria-label="下月"
                  disabled={!canNextMonth}
                  onClick={goNextMonth}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronRight
                    className="size-5"
                    strokeWidth={2}
                    style={{ color: canNextMonth ? '#000000' : '#999999' }}
                  />
                </Pressable>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WEEK_LABELS.map((w) => (
                  <div key={w} className="py-2 text-center text-[14px] text-[#666666]">
                    {w}
                  </div>
                ))}
                {gridCells.map((c) => {
                  if (c.kind === 'padding') {
                    return <CalendarDayCell key={c.key} label="" kind="padding" showTodayDot={false} onPress={() => {}} />
                  }
                  const dk = c.dateKey!
                  return (
                    <CalendarDayCell
                      key={c.key}
                      label={c.day!}
                      kind={c.kind}
                      showTodayDot={c.showTodayDot}
                      onPress={() => void onDayClick(dk)}
                    />
                  )
                })}
              </div>
            </div>

            <p className="mx-4 mt-5 px-1 pb-5 text-center text-[14px] leading-relaxed text-[#999999]">
              点击日期跳转至当天聊天记录
            </p>
          </>
        ) : (
          <div className="mx-4 mt-3 pb-6">
            {!contentKeyword ? (
              <div className="flex flex-col items-center px-4 pt-10">
                <p className="text-center text-[15px] text-[#666666]">输入关键词搜索聊天记录</p>
              </div>
            ) : searchLoading ? (
              <div className="flex flex-col items-center px-4 pt-6">
                <Loader2 className="size-6 animate-spin text-[#666666]" strokeWidth={1.75} aria-hidden />
                <p className="mt-4 text-[14px] text-[#666666]">搜索中...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center px-4 pt-6">
                <Search className="size-12 text-[#999999]" strokeWidth={1.25} aria-hidden />
                <p className="mt-4 text-[16px] text-[#666666]">未找到相关聊天记录</p>
                <p className="mt-2 text-[14px] text-[#999999]">试试其他关键词</p>
              </div>
            ) : (
              <div
                className="overflow-hidden rounded-[12px] bg-white transition-shadow duration-200 ease-out"
                style={{
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  maxHeight: 'min(72vh, 640px)',
                  contain: 'content',
                }}
              >
                <div className="max-h-[min(72vh,640px)] overflow-y-auto overscroll-y-contain [&::-webkit-scrollbar]:w-0 [scrollbar-width:none]">
                  {searchResults.map((row, i) => (
                    <ChatSearchResultRow
                      key={row.id}
                      row={row}
                      keyword={contentKeyword}
                      peerDisplayName={peerDisplayName}
                      peerAvatarUrl={peerAvatarUrl}
                      currentTimeMs={currentTimeMs}
                      isLast={i === searchResults.length - 1}
                      onPick={onJumpToChatMessage}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
