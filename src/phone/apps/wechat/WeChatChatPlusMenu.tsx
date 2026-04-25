/**
 * 微信风格聊天加号扩展菜单：2 页 × 8 格（2 行 4 列），横向滑动分页 + 指示器。
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  Clock,
  CreditCard,
  EyeOff,
  Gift,
  Heart,
  Image,
  MapPin,
  Music,
  PhoneCall,
  Play,
  RotateCcw,
  Smartphone,
  Star,
  Terminal,
} from 'lucide-react'

import { Pressable } from '../../components/Pressable'

/** 菜单总高度（含分页点），与 ChatRoom 挤压聊天区一致 */
export const PLUS_MENU_HEIGHT_PX = 240

export type WeChatPlusActionId =
  | 'photo'
  | 'camera'
  | 'call'
  | 'location'
  | 'redpacket'
  | 'transfer'
  | 'affection_pay'
  | 'favorite'
  | 'contact'
  | 'music'
  | 'heart_words'
  | 'read_ignore'
  | 'retry_reply'
  | 'busy'
  | 'continue_reply'
  | 'console_logs'
  | 'check_phone'

const PAGE1: { id: WeChatPlusActionId; label: string; Icon: LucideIcon }[] = [
  { id: 'photo', label: '照片', Icon: Image },
  { id: 'camera', label: '拍摄', Icon: Camera },
  { id: 'call', label: '音视频通话', Icon: PhoneCall },
  { id: 'location', label: '位置', Icon: MapPin },
  { id: 'redpacket', label: '红包', Icon: Gift },
  { id: 'transfer', label: '转账', Icon: CreditCard },
  { id: 'affection_pay', label: '亲情卡支付', Icon: Heart },
  { id: 'favorite', label: '收藏', Icon: Star },
]

const PAGE2: { id: WeChatPlusActionId; label: string; Icon: LucideIcon }[] = [
  { id: 'music', label: '音乐', Icon: Music },
  { id: 'heart_words', label: '心语', Icon: Heart },
  { id: 'read_ignore', label: '已读不回', Icon: EyeOff },
  { id: 'retry_reply', label: '重新回复', Icon: RotateCcw },
  { id: 'busy', label: '表示忙碌', Icon: Clock },
  { id: 'continue_reply', label: '继续回复', Icon: Play },
  { id: 'console_logs', label: '控制台', Icon: Terminal },
  { id: 'check_phone', label: '查手机', Icon: Smartphone },
]

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 }

function RedPacketIcon({ size = 24 }: { size?: number }) {
  // 极简红包：矩形 + 上半部分 V 字（你指定的样式）
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-black"
    >
      <path d="M6.5 4.5h11A2 2 0 0 1 19.5 6.5v13A2 2 0 0 1 17.5 21.5h-11A2 2 0 0 1 4.5 19.5v-13A2 2 0 0 1 6.5 4.5Z" />
      {/* 上半部分 V 字 */}
      <path d="M8 8.2l4 3.8 4-3.8" />
    </svg>
  )
}

function TransferArrowsIcon({ size = 24 }: { size?: number }) {
  // 极简转账：两个对向箭头
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-black"
    >
      <path d="M6 8h11" />
      <path d="M14.5 5.5 17 8l-2.5 2.5" />
      <path d="M18 16H7" />
      <path d="M9.5 13.5 7 16l2.5 2.5" />
    </svg>
  )
}

function PlusMenuGridCell({
  label,
  Icon,
  onPress,
  suppressClickRef,
  actionId,
}: {
  label: string
  Icon: LucideIcon
  onPress: () => void
  suppressClickRef: React.MutableRefObject<boolean>
  actionId: WeChatPlusActionId
}) {
  return (
    <Pressable
      type="button"
      onClick={() => {
        if (suppressClickRef.current) return
        onPress()
      }}
      className="flex w-full flex-col items-center justify-start rounded-lg bg-transparent p-0 outline-none"
    >
      <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[12px] bg-[#f5f5f5] transition-colors duration-100 active:bg-[#e5e5e5]">
        {actionId === 'redpacket' ? (
          <RedPacketIcon size={24} />
        ) : actionId === 'transfer' ? (
          <TransferArrowsIcon size={24} />
        ) : (
          <Icon size={24} strokeWidth={2} className="text-black" aria-hidden />
        )}
      </div>
      <p className="mt-2 text-center text-[12px] leading-none text-black">{label}</p>
    </Pressable>
  )
}

function PlusMenuPage({
  children,
  widthPx,
}: {
  children: ReactNode
  widthPx: number
}) {
  return (
    <div
      className="grid shrink-0 grid-cols-4 gap-x-4 gap-y-3 px-6 pt-4"
      style={{ width: widthPx || '100%' }}
    >
      {children}
    </div>
  )
}

function PageDots({
  total,
  active,
  onPick,
}: {
  total: number
  active: number
  onPick: (i: number) => void
}) {
  return (
    <div className="flex justify-center gap-2 pb-2 pt-1">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`第 ${i + 1} 页`}
          aria-current={i === active ? 'true' : undefined}
          className="h-1.5 w-1.5 rounded-full p-0 transition-colors duration-200"
          style={{ backgroundColor: i === active ? '#000000' : '#d4d4d4' }}
          onClick={() => onPick(i)}
        />
      ))}
    </div>
  )
}

export function WeChatChatPlusMenuPanel({ onAction }: { onAction: (id: WeChatPlusActionId) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(0)
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  pageRef.current = page
  const x = useMotionValue(0)
  const draggingRef = useRef(false)
  const startClientXRef = useRef(0)
  const startXRef = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const movedRef = useRef(false)
  const DRAG_THRESHOLD_PX = 7
  /** 松手时以该页为起点做翻页判定（避免仅用 x 中点误判） */
  const dragStartPageRef = useRef(0)
  /** 最近几次指针采样，用于快速轻扫（fling）翻页 */
  const pointerSamplesRef = useRef<Array<{ t: number; clientX: number }>>([])

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const apply = () => {
      const w = el.offsetWidth
      setVw(w)
      if (w) x.set(-pageRef.current * w)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [x])

  const snapTo = useCallback(
    (p: number) => {
      const w = vw
      if (!w) return
      const clamped = Math.max(0, Math.min(1, p))
      setPage(clamped)
      void animate(x, -clamped * w, SPRING)
    },
    [vw, x],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (!vw) return
    pointerIdRef.current = e.pointerId
    draggingRef.current = false
    movedRef.current = false
    suppressClickRef.current = false
    startClientXRef.current = e.clientX
    startXRef.current = x.get()
    dragStartPageRef.current = pageRef.current
    pointerSamplesRef.current = [{ t: performance.now(), clientX: e.clientX }]
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const dx = e.clientX - startClientXRef.current
    if (!vw) return
    if (!draggingRef.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      draggingRef.current = true
      movedRef.current = true
      suppressClickRef.current = true
      try {
        ;(viewportRef.current as HTMLElement | null)?.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const now = performance.now()
    const samples = pointerSamplesRef.current
    samples.push({ t: now, clientX: e.clientX })
    if (samples.length > 6) samples.splice(0, samples.length - 6)

    let next = startXRef.current + dx
    const min = -vw
    const max = 0
    const rubber = 0.22
    if (next > max) next = max + (next - max) * rubber
    else if (next < min) next = min + (next - min) * rubber
    x.set(next)
  }

  const endDrag = () => {
    if (!vw) return
    draggingRef.current = false
    const cur = x.get()
    const w = vw
    // 旧逻辑用 -w/2 作为分界，必须拖过约 50% 才翻页，手感很硬；改为「位移比例 + 快速轻扫速度」双通道。
    const COMMIT_RATIO = 0.22
    const FLING_PX_PER_SEC = 520
    const samples = pointerSamplesRef.current
    let vx = 0
    // 用最后一段位移算速度，避免整段慢拖把平均速度拉没
    if (samples.length >= 2) {
      const a = samples[samples.length - 2]!
      const b = samples[samples.length - 1]!
      const dt = Math.max(1, b.t - a.t)
      vx = ((b.clientX - a.clientX) / dt) * 1000
    }
    const startPage = dragStartPageRef.current
    let nextPage = startPage
    if (startPage === 0) {
      if (cur <= -COMMIT_RATIO * w || vx < -FLING_PX_PER_SEC) nextPage = 1
    } else {
      if (cur >= -(1 - COMMIT_RATIO) * w || vx > FLING_PX_PER_SEC) nextPage = 0
    }
    snapTo(nextPage)
    pointerSamplesRef.current = []
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current == null || pointerIdRef.current !== e.pointerId) return
    pointerIdRef.current = null
    if (draggingRef.current) {
      try {
        ;(viewportRef.current as HTMLElement | null)?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      endDrag()
      // 防止拖动结束后的 click 触发：保留一帧再放开
      requestAnimationFrame(() => {
        suppressClickRef.current = false
        movedRef.current = false
      })
      return
    }
    // 纯点击：允许按钮正常触发
  }

  return (
    <div
      ref={viewportRef}
      className="w-full max-w-full min-w-0 select-none overflow-hidden bg-white"
      style={{ height: PLUS_MENU_HEIGHT_PX }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="h-[calc(100%-24px)] w-full max-w-full cursor-grab touch-pan-x active:cursor-grabbing" role="presentation">
        <motion.div
          className="flex h-full min-w-0"
          style={{ x, width: vw > 0 ? vw * 2 : undefined }}
        >
          {vw > 0 ? (
            <>
              <PlusMenuPage widthPx={vw}>
                {PAGE1.map((it) => (
                  <PlusMenuGridCell
                    key={it.id}
                    label={it.label}
                    Icon={it.Icon}
                    onPress={() => onAction(it.id)}
                    suppressClickRef={suppressClickRef}
                    actionId={it.id}
                  />
                ))}
              </PlusMenuPage>
              <PlusMenuPage widthPx={vw}>
                {PAGE2.map((it) => (
                  <PlusMenuGridCell
                    key={it.id}
                    label={it.label}
                    Icon={it.Icon}
                    onPress={() => onAction(it.id)}
                    suppressClickRef={suppressClickRef}
                    actionId={it.id}
                  />
                ))}
              </PlusMenuPage>
            </>
          ) : null}
        </motion.div>
      </div>
      <PageDots total={2} active={page} onPick={(i) => snapTo(i)} />
    </div>
  )
}
