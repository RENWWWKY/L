import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Terminal, Trash2, X } from 'lucide-react'

import type { ConsoleLog, LogType } from './consoleLogger'
import { formatTs, logConsole } from './consoleLogger'
import {
  composeStoryTimelineCalendarAnchorLabel,
  formatGregorianStoryDayFromMs,
} from './memory/storyTimelineTypes'
import { personaDb } from './newFriendsPersona/idb'
import {
  formatStoryTimeClockFromMs,
  syncStoryTimelineNowFromOnlineClock,
} from './time/applyOnlineChatTimeFusion'
import { useWeChatCurrentTime } from './time/useWeChatCurrentTime'
import { useConsoleLogs, useConsoleLogger } from './useConsoleLogger'

type Filter = 'all' | LogType

function typeLabel(t: LogType): string {
  if (t === 'frontend') return '前端'
  if (t === 'backend') return '后端'
  if (t === 'indexeddb') return 'IndexedDB'
  if (t === 'ai') return 'AI调用'
  return '错误'
}

function typeStyle(t: LogType): { bg: string; fg: string; border: string } {
  if (t === 'error') return { bg: '#ff3b30', fg: '#ffffff', border: 'rgba(255,59,48,0.35)' }
  return { bg: '#111111', fg: '#ffffff', border: 'rgba(0,0,0,0.12)' }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function formatSystemClockLabel(ms: number): string {
  const d = new Date(ms)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function WeChatConsoleFloatingPanel({
  open,
  onClose,
  /** 当前私聊角色：用于读取剧情时间轴锚点 */
  characterId,
}: {
  open: boolean
  onClose: () => void
  characterId?: string | null
}) {
  const { clear } = useConsoleLogger()
  const all = useConsoleLogs()
  const [filter, setFilter] = useState<Filter>('all')
  const [minimized, setMinimized] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [storyTimeLabel, setStoryTimeLabel] = useState<string>('')
  const cid = characterId?.trim() || ''
  const { currentTimeMs, getCurrentTimeMs } = useWeChatCurrentTime({
    characterId: cid || null,
    liveTick: open && !minimized,
  })
  const systemTimeLabel = formatSystemClockLabel(currentTimeMs)

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 320, h: 260 })
  const lastRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pid: number; sx: number; sy: number; bx: number; by: number } | null>(null)
  const resizeRef = useRef<{ pid: number; sx: number; sy: number; bw: number; bh: number } | null>(null)

  const limits = useMemo(() => {
    const vw = window.innerWidth || 390
    const vh = window.innerHeight || 740
    return {
      minW: 200,
      minH: 150,
      maxW: Math.max(200, vw - 32),
      maxH: Math.max(150, vh - 200),
      vw,
      vh,
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const vw = window.innerWidth || 390
    const vh = window.innerHeight || 740
    const w = clamp(size.w, 200, Math.max(200, vw - 32))
    const h = clamp(size.h, 150, Math.max(150, vh - 200))
    const x = clamp(pos.x || (vw - w - 16), 16, vw - w - 16)
    const y = clamp(pos.y || (vh - h - 120 - 16), 16, vh - h - 120 - 16)
    setSize({ w, h })
    setPos({ x, y })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const logs = useMemo(() => {
    if (filter === 'all') return all
    return all.filter((l) => l.type === filter)
  }, [all, filter])

  useEffect(() => {
    if (!open || minimized || !autoScroll) return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs.length, open, minimized, autoScroll])

  useEffect(() => {
    if (!open) return
    logConsole('frontend', '控制台浮窗打开')
    return () => logConsole('frontend', '控制台浮窗关闭')
  }, [open])

  useEffect(() => {
    if (!open || minimized) return
    let cancelled = false
    const loadStory = async () => {
      if (!cid) {
        if (!cancelled) setStoryTimeLabel('')
        return
      }
      try {
        const liveMs = getCurrentTimeMs()
        const synced = await syncStoryTimelineNowFromOnlineClock({
          characterId: cid,
          liveTimeMs: liveMs,
        })
        if (cancelled) return
        if (synced.storyLabel.trim()) {
          setStoryTimeLabel(synced.storyLabel.trim())
          return
        }
        const st = await personaDb.getStoryTimelineState(cid)
        if (cancelled) return
        const stored =
          composeStoryTimelineCalendarAnchorLabel({
            story_day: st?.currentStoryDay,
            story_time: st?.currentStoryTime,
          }).trim() ||
          (st?.currentStoryDay?.trim()
            ? st.currentStoryTime?.trim()
              ? `${st.currentStoryDay.trim()} ${st.currentStoryTime.trim()}`
              : st.currentStoryDay.trim()
            : '')
        // 有剧情日但未写入成功时，用流动时钟推演展示（不落库）
        if (stored && st?.currentStoryDay?.trim()) {
          const liveLabel = composeStoryTimelineCalendarAnchorLabel({
            story_day: formatGregorianStoryDayFromMs(liveMs),
            story_time: formatStoryTimeClockFromMs(liveMs),
          }).trim()
          setStoryTimeLabel(liveLabel || stored)
          return
        }
        setStoryTimeLabel(stored)
      } catch {
        if (!cancelled) setStoryTimeLabel('')
      }
    }
    void loadStory()
    const timer = window.setInterval(() => void loadStory(), 4000)
    const onStorage = () => void loadStory()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [open, minimized, cid, getCurrentTimeMs])

  useEffect(() => {
    if (!open || minimized) return
    logConsole(
      'frontend',
      `双时间｜系统 ${formatSystemClockLabel(getCurrentTimeMs())}｜剧情 ${storyTimeLabel || '（未设定）'}${cid ? `｜角色 ${cid.slice(0, 12)}` : ''}`,
    )
    // 仅在打开或剧情标签变化时打一条，避免刷屏
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, minimized, storyTimeLabel, cid])

  const beginDrag = useCallback((e: React.PointerEvent) => {
    if (minimized) return
    dragRef.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, bx: pos.x, by: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [minimized, pos.x, pos.y])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const st = dragRef.current
    if (!st || st.pid !== e.pointerId) return
    const dx = e.clientX - st.sx
    const dy = e.clientY - st.sy
    const x = clamp(st.bx + dx, 16, limits.vw - size.w - 16)
    const y = clamp(st.by + dy, 16, limits.vh - size.h - 120 - 16)
    setPos({ x, y })
  }, [limits.vh, limits.vw, size.h, size.w])

  const endDrag = useCallback((e: React.PointerEvent) => {
    const st = dragRef.current
    if (!st || st.pid !== e.pointerId) return
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const beginResize = useCallback((e: React.PointerEvent) => {
    if (minimized) return
    resizeRef.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, bw: size.w, bh: size.h }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [minimized, size.h, size.w])

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    const st = resizeRef.current
    if (!st || st.pid !== e.pointerId) return
    const dx = e.clientX - st.sx
    const dy = e.clientY - st.sy
    const w = clamp(st.bw + dx, limits.minW, Math.min(limits.maxW, limits.vw - pos.x - 16))
    const h = clamp(st.bh + dy, limits.minH, Math.min(limits.maxH, limits.vh - pos.y - 120 - 16))
    setSize({ w, h })
  }, [limits.maxH, limits.maxW, limits.minH, limits.minW, limits.vh, limits.vw, pos.x, pos.y])

  const endResize = useCallback((e: React.PointerEvent) => {
    const st = resizeRef.current
    if (!st || st.pid !== e.pointerId) return
    resizeRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'frontend', label: '前端' },
    { id: 'backend', label: '后端' },
    { id: 'indexeddb', label: 'IndexedDB' },
    { id: 'ai', label: 'AI调用' },
    { id: 'error', label: '错误' },
  ]

  if (!open) return null

  if (minimized) {
    return (
      <motion.button
        type="button"
        className="fixed z-[270] flex h-11 w-11 items-center justify-center rounded-full bg-black shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
        style={{
          right: 16,
          bottom: 96,
        }}
        initial={{ scale: 0.85, opacity: 0, x: 20, y: 20 }}
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        aria-label="展开控制台日志"
        onClick={() => {
          const last = lastRectRef.current
          if (last) {
            setPos({ x: last.x, y: last.y })
            setSize({ w: last.w, h: last.h })
          }
          setMinimized(false)
        }}
      >
        <Terminal size={16} strokeWidth={2} className="text-white" aria-hidden />
      </motion.button>
    )
  }

  return (
    <motion.div
      className="fixed z-[270] flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.10)]"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      initial={{ opacity: 0, x: 20, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20, y: 20 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* 顶部栏（可拖拽） */}
      <div
        className="flex h-11 shrink-0 items-center justify-between bg-[#f5f5f5] px-3"
        onPointerDown={beginDrag}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: 'none', cursor: 'grab' }}
      >
        <p className="text-[14px] font-semibold text-black">控制台日志</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="清空"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              clear()
              logConsole('frontend', '控制台日志已清空')
            }}
          >
            <Trash2 size={16} strokeWidth={2} className="text-black" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="最小化"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              lastRectRef.current = { x: pos.x, y: pos.y, w: size.w, h: size.h }
              setMinimized(true)
            }}
          >
            <Minus size={16} strokeWidth={2} className="text-black" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            onClick={(e) => {
              e.stopPropagation()
              lastRectRef.current = null
              setMinimized(false)
              onClose()
            }}
          >
            <X size={16} strokeWidth={2} className="text-black" aria-hidden />
          </button>
        </div>
      </div>

      {/* 双时间：系统墙钟 vs 剧情锚点 */}
      <div className="shrink-0 border-b border-black/[0.06] bg-[#f8f8f8] px-3 py-1.5 font-mono text-[11px] leading-relaxed text-[#222]">
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-white" style={{ background: '#555' }}>
            系统
          </span>
          <span className="min-w-0 break-all">{systemTimeLabel}</span>
        </div>
        <div className="mt-1 flex items-start gap-1.5">
          <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-white" style={{ background: '#1a7f4b' }}>
            剧情
          </span>
          <span className="min-w-0 break-all text-[#1a7f4b]">
            {cid
              ? storyTimeLabel || '（该角色尚未设定剧情日）'
              : '（请进入角色私聊后查看）'}
          </span>
        </div>
      </div>

      {/* 过滤栏 */}
      <div className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => {
          const active = filter === f.id
          const isErr = f.id === 'error'
          return (
            <button
              key={f.id}
              type="button"
              className="shrink-0 rounded-[8px] px-3 py-1 text-[12px] font-medium"
              style={
                active
                  ? { background: '#000000', color: '#ffffff' }
                  : {
                      background: '#ffffff',
                      color: isErr ? '#ff3b30' : '#000000',
                      border: `1px solid ${isErr ? 'rgba(255,59,48,0.35)' : 'rgba(0,0,0,0.08)'}`,
                    }
              }
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* 日志区 */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa] px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onClick={() => setAutoScroll((v) => !v)}
        style={{ touchAction: 'pan-y' }}
      >
        {logs.length === 0 ? (
          <p className="px-2 py-2 text-[12px] text-[#888888]">暂无日志</p>
        ) : (
          logs.map((l: ConsoleLog) => {
            const st = typeStyle(l.type)
            return (
              <div key={l.id} className="my-1 rounded-[8px] bg-white p-2 font-mono text-[12px] text-black">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#666666]">{formatTs(l.timestamp)}</span>
                  <span
                    className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {typeLabel(l.type)}
                  </span>
                  {l.type === 'error' ? <span className="text-[10px] text-[#ff3b30]">!</span> : null}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words" style={{ color: l.type === 'error' ? '#ff3b30' : '#000000' }}>
                  {l.content}
                </div>
              </div>
            )
          })
        )}
        <div className="h-8" />
      </div>

      {/* 右下角缩放手柄 */}
      <div
        className="absolute bottom-0 right-0 h-6 w-6"
        onPointerDown={beginResize}
        onPointerMove={onResizeMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        style={{ touchAction: 'none', cursor: 'nwse-resize' }}
        aria-label="缩放"
        role="presentation"
      >
        <div
          className="absolute bottom-1 right-1 h-3 w-3 rounded-[3px]"
          style={{ borderRight: '2px solid rgba(0,0,0,0.25)', borderBottom: '2px solid rgba(0,0,0,0.25)' }}
          aria-hidden
        />
      </div>
    </motion.div>
  )
}

