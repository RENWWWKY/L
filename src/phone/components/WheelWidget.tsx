import { motion } from 'framer-motion'
import { useEffect, useMemo, useState, type PointerEventHandler } from 'react'
import { Pressable } from './Pressable'
import { WheelModal } from './WheelModal'
import { useCustomization } from '../CustomizationContext'
import { useLongPress } from '../hooks/useLongPress'

const STORAGE_KEY = 'lumi-decision-wheel-options-v1'

const DEFAULT_OPTIONS = [
  '吃日料',
  '找他聊天',
  '直接睡觉',
  '散步吹风',
  '看一部电影',
  '发条朋友圈',
  '继续工作',
  '什么都不做',
]

type Props = {
  isEditMode?: boolean
  isActiveDrag?: boolean
  isLongPressPrimed?: boolean
  disableOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  registerNode?: (node: HTMLDivElement | null) => void
  onStartDrag?: PointerEventHandler<HTMLButtonElement>
  onLongPressStartDrag?: (event: React.PointerEvent<HTMLElement>) => void
}

export function WheelWidget({
  isEditMode = false,
  isActiveDrag = false,
  isLongPressPrimed = false,
  disableOpen = false,
  open,
  onOpenChange,
  registerNode,
  onStartDrag,
  onLongPressStartDrag,
}: Props) {
  const { state } = useCustomization()
  const { theme, ui } = state
  const [localOpen, setLocalOpen] = useState(false)
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS)
  const isEdgeAndroid = useMemo(() => {
    if (typeof window === 'undefined') return false
    const ua = window.navigator.userAgent.toLowerCase()
    return ua.includes('android') && (ua.includes('edga') || ua.includes('edge'))
  }, [])
  const isLowEndDevice = useMemo(() => {
    if (typeof window === 'undefined' || !isEdgeAndroid) return false
    const nav = window.navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }
    const lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4
    const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4
    const saveData = Boolean(nav.connection?.saveData)
    return lowCpu || lowMemory || saveData
  }, [isEdgeAndroid])
  const useStaticFallback = ui.forceStaticCompass || (isEdgeAndroid && isLowEndDevice)
  const longPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: (event) => onLongPressStartDrag?.(event),
  })

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const next = DEFAULT_OPTIONS.map((fallback, index) => {
        const value = typeof parsed[index] === 'string' ? parsed[index].trim() : ''
        return value || fallback
      })
      setOptions(next)
    } catch {
      // ignore local corruption
    }
  }, [])

  const updateOptions = (next: string[]) => {
    const normalized = DEFAULT_OPTIONS.map((fallback, index) => next[index]?.trim() || fallback)
    setOptions(normalized)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    } catch {
      // ignore quota errors
    }
  }

  const previewOptions = useMemo(() => options.slice(0, 4), [options])
  const modalOpen = open ?? localOpen

  const setModalOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next)
    else setLocalOpen(next)
  }

  return (
    <>
      <section
        data-wheel-widget="true"
        className="relative h-full w-full"
      >
        <motion.div
          ref={registerNode}
          className="h-full w-full"
          animate={
            isEditMode && !isActiveDrag && !useStaticFallback
              ? {
                  y: [-1.2, 1.8, -1.2],
                  rotate: [-0.4, 0.5, -0.35],
                }
              : {
                  y: 0,
                  rotate: 0,
                  scale: isLongPressPrimed && !useStaticFallback ? 1.03 : 1,
                }
          }
          transition={
            isEditMode && !isActiveDrag && !useStaticFallback
              ? { duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              : { duration: 0.18, ease: 'easeOut' }
          }
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <Pressable
            onClick={() => {
              if (!isEditMode && !disableOpen) setModalOpen(true)
            }}
            className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border p-3 text-left shadow-[0_20px_36px_rgba(15,23,42,0.12)]"
            style={{
              background: useStaticFallback
                ? 'rgba(250,250,251,0.96)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(248,249,251,0.6))',
              borderColor: useStaticFallback ? 'rgba(226,232,240,0.9)' : 'rgba(255,255,255,0.7)',
              boxShadow: useStaticFallback ? '0 6px 14px rgba(15,23,42,0.08)' : undefined,
              backdropFilter: useStaticFallback ? 'none' : 'blur(22px) saturate(1.08)',
              WebkitBackdropFilter: useStaticFallback ? 'none' : 'blur(22px) saturate(1.08)',
              opacity: isActiveDrag ? 0.04 : 1,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              touchAction: 'none',
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={isEditMode ? onStartDrag : longPressHandlers.onPointerDown}
            onPointerMove={!isEditMode ? longPressHandlers.onPointerMove : undefined}
            onPointerUp={!isEditMode ? longPressHandlers.onPointerUp : undefined}
            onPointerCancel={!isEditMode ? longPressHandlers.onPointerCancel : undefined}
            onPointerLeave={!isEditMode ? longPressHandlers.onPointerLeave : undefined}
          >
            <p
              className="text-[10px] italic tracking-[0.22em]"
              style={{ color: theme.textMuted }}
            >
              Destiny Compass
            </p>

            <div className="relative mt-3 flex flex-1 items-center justify-center">
              <div
                className="pointer-events-none absolute top-0 h-0 w-0"
                style={{
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: '12px solid #D4AF37',
                  filter: useStaticFallback ? 'none' : 'drop-shadow(0 4px 8px rgba(212,175,55,0.22))',
                }}
              />
              <div
                className="relative aspect-square w-[80%] max-w-[132px] rounded-full border border-white/80 bg-white/70 p-2"
                style={{
                  background: useStaticFallback ? 'rgba(255,255,255,0.95)' : undefined,
                  borderColor: useStaticFallback ? 'rgba(226,232,240,0.95)' : undefined,
                }}
              >
                <div
                  className="absolute inset-[10%] rounded-full"
                  style={{
                    background:
                      useStaticFallback
                        ? 'rgba(246,248,250,1)'
                        : 'conic-gradient(from -90deg, rgba(255,255,255,0.98) 0deg 45deg, rgba(244,246,248,0.94) 45deg 90deg, rgba(255,255,255,0.98) 90deg 135deg, rgba(244,246,248,0.94) 135deg 180deg, rgba(255,255,255,0.98) 180deg 225deg, rgba(244,246,248,0.94) 225deg 270deg, rgba(255,255,255,0.98) 270deg 315deg, rgba(244,246,248,0.94) 315deg 360deg)',
                    border: '1px solid rgba(229,231,235,0.95)',
                  }}
                />
                <div className="absolute inset-[24%] rounded-full border border-[#E5E7EB] bg-white/80" />
                <div className="absolute inset-0">
                  {previewOptions.map((label, index) => {
                    const angle = -90 + index * 90
                    return (
                      <span
                        key={`wheel-preview-${label}-${index}`}
                        className="absolute left-1/2 top-1/2 text-[9px] tracking-[0.08em]"
                        style={{
                          color: theme.text,
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-34px) rotate(${-angle}deg)`,
                          transformOrigin: 'center',
                        }}
                      >
                        {label.slice(0, 4)}
                      </span>
                    )
                  })}
                </div>
                <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15" />
              </div>
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div>
                <p className="text-[12px]" style={{ color: theme.text }}>
                  决策罗盘
                </p>
                <p className="mt-0.5 text-[10px]" style={{ color: theme.textMuted }}>
                  点击展开命运指针
                </p>
              </div>
              <span className="text-[10px] tracking-[0.18em]" style={{ color: '#D4AF37' }}>
                8 WAYS
              </span>
            </div>
          </Pressable>
        </motion.div>
      </section>

      <WheelModal
        open={modalOpen}
        options={options}
        theme={theme}
        onClose={() => setModalOpen(false)}
        onChangeOptions={updateOptions}
      />
    </>
  )
}
