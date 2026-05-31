import { motion } from 'framer-motion'
import { Music2 } from 'lucide-react'
import { useId } from 'react'

type RoseAuraOrbVisualProps = {
  cover?: string
  isPlaying: boolean
  edgeHidden: boolean
  snapSide: 'left' | 'right'
  onReveal?: () => void
}

/** 贴边三角标签尺寸（与 FloatingMusicOrb 定位共用） */
export const ORB_PEEK_W = 28
export const ORB_PEEK_H = 56

/** 贴边隐藏时露出的圆角三角小角 */
function OrbPeekTab({ snapSide }: { snapSide: 'left' | 'right' }) {
  const gradId = useId().replace(/:/g, '')
  const flip = snapSide === 'left'

  return (
    <svg
      width={ORB_PEEK_W}
      height={ORB_PEEK_H}
      viewBox={`0 0 ${ORB_PEEK_W} ${ORB_PEEK_H}`}
      fill="none"
      aria-hidden
      className="drop-shadow-[0_2px_12px_rgba(255,192,203,0.4)]"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8FA" />
          <stop offset="55%" stopColor="#FFF0F3" />
          <stop offset="100%" stopColor="#FFE4E8" />
        </linearGradient>
      </defs>
      <path
        d="M28 7C28 4.8 26.3 3.6 24.4 4.6L6.7 20.6C4.1 22.8 4.1 25.6 6.7 27.7L24.4 43.8C26.3 44.8 28 43.5 28 41.3V7Z"
        fill={`url(#${gradId})`}
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 28L12.9 24.3C11.8 23.5 11.8 22.3 12.9 21.5L18.5 17.8"
        stroke="rgba(232,160,174,0.8)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RoseAuraOrbVisual({
  cover,
  isPlaying,
  edgeHidden,
  snapSide,
}: RoseAuraOrbVisualProps) {
  if (edgeHidden) {
    return <OrbPeekTab snapSide={snapSide} />
  }

  return (
    <>
      {/* 晨露星轨光晕 */}
      <span
        className="pointer-events-none absolute -inset-1.5 rounded-full bg-[#FFE4E8]/25 shadow-[0_0_20px_rgba(255,192,203,0.4)] backdrop-blur-sm"
        aria-hidden
      />

      {/* 轨上铂金光点 */}
      {isPlaying ? (
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          {[0, 120, 240].map((deg) => {
            const rad = (deg * Math.PI) / 180
            const r = 26
            return (
              <span
                key={deg}
                className="absolute h-1 w-1 rounded-full bg-gradient-to-br from-stone-200 to-rose-200 shadow-[0_0_6px_rgba(255,255,255,0.95)]"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${Math.sin(rad) * r}px), calc(-50% + ${-Math.cos(rad) * r}px))`,
                }}
              />
            )
          })}
        </motion.div>
      ) : null}

      {/* 核心唱片 */}
      <motion.div
        className="absolute inset-[4px] overflow-hidden rounded-full ring-1 ring-white/80"
        animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
        transition={
          isPlaying ? { duration: 14, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }
        }
      >
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FFF0F3] to-stone-100">
            <Music2 className="size-5 text-rose-300/80" strokeWidth={1.5} />
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent" />
      </motion.div>

      <span
        className="pointer-events-none absolute inset-[3px] rounded-full ring-1 ring-rose-100/60"
        aria-hidden
      />
    </>
  )
}
