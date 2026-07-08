import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Params = {
  enabled?: boolean
  ms?: number
  /** 超过该位移视为滚动/拖动，取消长按 */
  moveThresholdPx?: number
  onLongPress: (e: PointerEvent) => void
  /** 短按（未触发长按、未明显移动） */
  onTap?: (e: PointerEvent) => void
}

type BindHandlers = {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: () => void
  onPointerLeave: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

/**
 * 微信式长按：500ms 触发；按下期间可做轻微缩放反馈；移动/抬起/取消则终止。
 * 统一用 PointerEvent，兼容 touch / mouse。
 */
export function useLongPress({
  enabled = true,
  ms = 500,
  moveThresholdPx = 10,
  onLongPress,
  onTap,
}: Params) {
  const timerRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const pressingRef = useRef(false)
  const firedRef = useRef(false)
  const [pressing, setPressing] = useState(false)

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
    pressingRef.current = false
    firedRef.current = false
    setPressing(false)
  }, [])

  useEffect(() => clear, [clear])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button != null && e.button !== 0) return
      const ne = e.nativeEvent
      pressingRef.current = true
      firedRef.current = false
      setPressing(enabled)
      startRef.current = { x: ne.clientX, y: ne.clientY, pointerId: ne.pointerId }
      ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(ne.pointerId)
      if (!enabled) return
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        if (!pressingRef.current || firedRef.current) return
        firedRef.current = true
        if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([50])
          } catch {
            /* ignore unsupported environments */
          }
        }
        onLongPress(ne)
        // 触发后不再维持按压态缩放
        pressingRef.current = false
        setPressing(false)
      }, ms)
    },
    [enabled, ms, onLongPress],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const st = startRef.current
      if (!st) return
      const ne = e.nativeEvent
      if (ne.pointerId !== st.pointerId) return
      const dx = ne.clientX - st.x
      const dy = ne.clientY - st.y
      if (dx * dx + dy * dy >= moveThresholdPx * moveThresholdPx) {
        clear()
      }
    },
    [moveThresholdPx, clear],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const st = startRef.current
      const ne = e.nativeEvent
      if (onTap && st && !firedRef.current && pressingRef.current && ne.pointerId === st.pointerId) {
        const dx = ne.clientX - st.x
        const dy = ne.clientY - st.y
        if (dx * dx + dy * dy < moveThresholdPx * moveThresholdPx) {
          onTap(ne)
        }
      }
      clear()
    },
    [clear, moveThresholdPx, onTap],
  )
  const onPointerCancel = useCallback(() => clear(), [clear])
  const onPointerLeave = useCallback(() => clear(), [clear])

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // 移动端/长按可能触发系统菜单；这里阻止，保持微信一致体验
      if (!enabled) return
      e.preventDefault()
    },
    [enabled],
  )

  const bind = useMemo<BindHandlers>(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onContextMenu,
    }),
    [onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onContextMenu],
  )

  return { bind, pressing }
}

export const useWeChatLongPress = useLongPress

