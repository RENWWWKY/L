import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckSquare,
  Copy,
  Edit,
  Languages,
  Share,
  Star,
  Trash2,
} from 'lucide-react'

import { Pressable } from '../../components/Pressable'

export type WeChatMessageActionId =
  | 'copy'
  | 'forward'
  | 'favorite'
  | 'delete'
  | 'multiSelect'
  | 'quote'
  | 'translate'
  | 'edit'

type Action = {
  id: WeChatMessageActionId
  label: string
  Icon: React.ComponentType<{ size?: number; color?: string }>
}

function QuoteRightSvg({ size = 20, color = '#000000' }: { size?: number; color?: string }) {
  // 右双引号：用实心图形，避免字体差异；比例贴近微信操作面板的“引用”图标
  const s = Math.max(14, Math.min(28, size))
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M8.2 6.5c-2.1 1.6-3.4 3.7-3.7 6.4-.2 1.7.1 3.1.9 4.1.8 1.1 1.9 1.6 3.2 1.6 1 0 1.9-.3 2.6-1 .7-.7 1-1.6 1-2.7 0-1-.3-1.9-1-2.6-.6-.7-1.5-1-2.6-1h-.4c.2-1.4.9-2.6 2.1-3.6.2-.2.2-.5 0-.7l-.8-.9c-.1-.2-.4-.2-.6-.1Zm9.6 0c-2.1 1.6-3.4 3.7-3.7 6.4-.2 1.7.1 3.1.9 4.1.8 1.1 1.9 1.6 3.2 1.6 1 0 1.9-.3 2.6-1 .7-.7 1-1.6 1-2.7 0-1-.3-1.9-1-2.6-.6-.7-1.5-1-2.6-1h-.4c.2-1.4.9-2.6 2.1-3.6.2-.2.2-.5 0-.7l-.8-.9c-.1-.2-.4-.2-.6-.1Z"
        fill={color}
      />
    </svg>
  )
}

const ACTIONS: Action[] = [
  { id: 'copy', label: '复制', Icon: Copy },
  { id: 'forward', label: '转发', Icon: Share },
  { id: 'favorite', label: '收藏', Icon: Star },
  { id: 'delete', label: '删除', Icon: Trash2 },
  { id: 'multiSelect', label: '多选', Icon: CheckSquare },
  { id: 'quote', label: '引用', Icon: QuoteRightSvg },
  { id: 'translate', label: '翻译', Icon: Languages },
  { id: 'edit', label: '编辑', Icon: Edit },
]

export type PanelAnchor = {
  rect: DOMRect
  preferBelow: boolean
}

export function WeChatMessageActionPanel({
  open,
  anchor,
  onAction,
}: {
  open: boolean
  anchor: PanelAnchor | null
  onAction: (id: WeChatMessageActionId) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelSize, setPanelSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const el = panelRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      setPanelSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const style = useMemo(() => {
    if (!open || !anchor) return { display: 'none' as const }
    const r = anchor.rect
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 16
    const gap = 10
    const w = panelSize.w || 188
    const h = panelSize.h || 240
    const leftRaw = r.left + r.width / 2 - w / 2
    const left = Math.min(vw - margin - w, Math.max(margin, leftRaw))
    const topRaw = anchor.preferBelow ? r.bottom + gap : r.top - gap - h
    const top = Math.min(vh - margin - h, Math.max(margin, topRaw))
    return {
      position: 'fixed' as const,
      left,
      top,
      zIndex: 1190,
      transformOrigin: anchor.preferBelow ? 'center top' : 'center bottom',
    }
  }, [open, anchor, panelSize])

  if (!open || !anchor) return null

  return createPortal(
    <div style={style}>
      <div
        ref={panelRef}
        className="max-w-[calc(100vw-32px)] min-w-[188px] rounded-2xl border border-[#e5e5e5] bg-white/96 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          animation: 'wxActionPanelIn 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <style>{`@keyframes wxActionPanelIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        <div className="grid grid-cols-4 gap-1">
          {ACTIONS.map(({ id, label, Icon }) => {
            return (
              <Pressable
                key={id}
                type="button"
                className="flex h-[44px] min-w-0 flex-col items-center justify-center rounded-[10px] px-2 transition-colors duration-150 ease-out hover:bg-[#f5f5f5] active:bg-[#f5f5f5]"
                onClick={() => onAction(id)}
              >
                <Icon size={id === 'quote' ? 20 : 18} color="#000000" aria-hidden />
                <span className="mt-1 text-[12px] leading-none text-black">{label}</span>
              </Pressable>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

