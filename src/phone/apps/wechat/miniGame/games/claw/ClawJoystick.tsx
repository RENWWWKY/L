import { useCallback, useRef, useState } from 'react'

type JoystickVec = { x: number; y: number }

const RADIUS = 52
const KNOB_R = 22

export function ClawJoystick({
  disabled,
  onChange,
}: {
  disabled?: boolean
  onChange: (vec: JoystickVec) => void
}) {
  const padRef = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState<JoystickVec>({ x: 0, y: 0 })
  const activeRef = useRef(false)

  const emit = useCallback(
    (x: number, y: number) => {
      const len = Math.hypot(x, y)
      const max = RADIUS - KNOB_R
      const nx = len > max ? (x / len) * max : x
      const ny = len > max ? (y / len) * max : y
      setKnob({ x: nx, y: ny })
      onChange({ x: nx / max, y: -ny / max })
    },
    [onChange],
  )

  const reset = useCallback(() => {
    activeRef.current = false
    setKnob({ x: 0, y: 0 })
    onChange({ x: 0, y: 0 })
  }, [onChange])

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return
      const pad = padRef.current
      if (!pad) return
      const rect = pad.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      emit(clientX - cx, clientY - cy)
    },
    [disabled, emit],
  )

  return (
    <div
      ref={padRef}
      className={`relative h-[116px] w-[116px] touch-none select-none rounded-full border border-[#E5E7EB] bg-gradient-to-b from-[#F9FAFB] to-[#F3F4F6] shadow-inner ${
        disabled ? 'opacity-40' : ''
      }`}
      onPointerDown={(e) => {
        if (disabled) return
        activeRef.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        handlePointer(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        if (!activeRef.current || disabled) return
        handlePointer(e.clientX, e.clientY)
      }}
      onPointerUp={(e) => {
        if (!activeRef.current) return
        activeRef.current = false
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        reset()
      }}
      onPointerCancel={reset}
      aria-label="移动摇杆"
      role="slider"
    >
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[10px] text-[#D1D5DB]">
        里
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-[#D1D5DB]">
        外
      </div>
      <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#D1D5DB]">
        左
      </div>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#D1D5DB]">
        右
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[44px] w-[44px] rounded-full bg-gradient-to-b from-[#FF6B73] to-[#FF5159] shadow-md"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}
