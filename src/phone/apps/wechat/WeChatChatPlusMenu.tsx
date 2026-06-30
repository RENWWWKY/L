/**
 * 微信风格聊天加号扩展菜单：2 页 × 8 格（2 行 4 列），横向滑动分页 + 指示器。
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  Clock,
  CreditCard,
  EyeOff,
  Gamepad2,
  Gift,
  Heart,
  Image,
  MapPin,
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
  | 'games'

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
  { id: 'games', label: '游戏', Icon: Gamepad2 },
  { id: 'heart_words', label: '心语', Icon: Heart },
  { id: 'read_ignore', label: '已读不回', Icon: EyeOff },
  { id: 'retry_reply', label: '重新回复', Icon: RotateCcw },
  { id: 'busy', label: '表示忙碌', Icon: Clock },
  { id: 'continue_reply', label: '继续回复', Icon: Play },
  { id: 'console_logs', label: '控制台', Icon: Terminal },
  { id: 'check_phone', label: '查手机', Icon: Smartphone },
]

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
}: {
  children: ReactNode
}) {
  return (
    <div className="grid basis-full shrink-0 snap-start grid-cols-4 gap-x-4 gap-y-3 px-6 pt-4">
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const suppressClickRef = useRef(false)
  const startClientXRef = useRef(0)
  const draggingRef = useRef(false)
  const DRAG_THRESHOLD_PX = 7

  const snapTo = useCallback(
    (p: number) => {
      const clamped = Math.max(0, Math.min(1, p))
      setPage(clamped)
      const el = scrollerRef.current
      if (!el) return
      const w = el.clientWidth
      el.scrollTo({ left: clamped * w, behavior: 'smooth' })
    },
    [],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true
    suppressClickRef.current = false
    startClientXRef.current = e.clientX
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - startClientXRef.current
    if (Math.abs(dx) >= DRAG_THRESHOLD_PX) suppressClickRef.current = true
  }

  const onPointerUp = () => {
    draggingRef.current = false
    requestAnimationFrame(() => {
      suppressClickRef.current = false
    })
  }

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const w = el.clientWidth || 1
    const p = Math.round(el.scrollLeft / w)
    const clamped = Math.max(0, Math.min(1, p))
    setPage(clamped)
  }

  return (
    <div
      className="w-full max-w-full min-w-0 select-none overflow-hidden bg-white"
      style={{ height: PLUS_MENU_HEIGHT_PX }}
    >
      <div
        ref={scrollerRef}
        className="h-[calc(100%-24px)] w-full max-w-full cursor-grab touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none snap-x snap-mandatory active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-x' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onScroll={onScroll}
        role="presentation"
      >
        <div className="flex h-full min-w-0 w-full">
          <PlusMenuPage>
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
          <PlusMenuPage>
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
        </div>
      </div>
      <PageDots total={2} active={page} onPick={(i) => snapTo(i)} />
    </div>
  )
}
