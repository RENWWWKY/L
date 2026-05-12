import { motion } from 'framer-motion'
import { useMemo } from 'react'

type Props = {
  /** 寻觅进行中：环缓慢差速旋转 + 铂金光点呼吸 */
  scanning: boolean
  /** 揭幕：环对齐后扩散消散 */
  revealBurst: boolean
  /** 外径 px */
  size?: number
}

/** 共鸣星轨 · 同心细环 */
export function ResonanceRings({ scanning, revealBurst, size = 240 }: Props) {
  const rings = useMemo(() => [0, 1, 2, 3], [])
  const gap = size / (rings.length + 2)

  const dotsPerRing = useMemo(
    () =>
      rings.map((i) => {
        const count = 4 + i
        return Array.from({ length: count }, (_, j) => ({
          deg: (360 / count) * j + i * 17,
          delay: j * 0.12 + i * 0.08,
        }))
      }),
    [rings],
  )

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {rings.map((i) => {
        const dim = size - gap * (i + 1)
        return (
          <motion.div
            key={i}
            className="absolute flex items-center justify-center rounded-full border-[0.5px] border-gray-200 bg-transparent"
            style={{
              width: dim,
              height: dim,
              boxSizing: 'border-box',
            }}
            animate={
              revealBurst
                ? { scale: 1.55, opacity: 0 }
                : scanning
                  ? { rotate: i % 2 === 0 ? 360 : -360 }
                  : { rotate: 0, scale: 1, opacity: 1 }
            }
            transition={
              revealBurst
                ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
                : scanning
                  ? {
                      rotate: { repeat: Infinity, ease: 'linear', duration: 38 + i * 14 },
                    }
                  : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {dotsPerRing[i]?.map((d, di) => (
              <motion.span
                key={di}
                className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#D4AF37]"
                style={{
                  left: '50%',
                  top: '50%',
                  marginLeft: -2,
                  marginTop: -2,
                  transform: `rotate(${d.deg}deg) translateY(${-dim / 2 + 2}px)`,
                  filter: scanning ? 'blur(2px)' : 'blur(1px)',
                  boxShadow: scanning ? '0 0 10px rgba(212,175,55,0.45)' : 'none',
                }}
                animate={
                  scanning
                    ? { opacity: [0.15, 0.95, 0.2], scale: [0.85, 1.15, 0.9] }
                    : { opacity: 0.25, scale: 1 }
                }
                transition={{
                  duration: 2.6 + d.delay,
                  repeat: scanning ? Infinity : 0,
                  ease: 'easeInOut',
                  delay: d.delay,
                }}
              />
            ))}
          </motion.div>
        )
      })}

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center"
        style={{ zIndex: 4 }}
      >
        <p
          className={`font-serif text-[11px] font-light italic leading-snug text-[#9a928a] transition-opacity duration-500 ${
            scanning || revealBurst ? 'opacity-25' : 'opacity-100'
          }`}
          style={{ fontFamily: "'Songti SC', 'Noto Serif SC', Georgia, serif" }}
        >
          Awaiting Resonance...
          <span className="mt-1 block text-[10px] text-[#b5aea4]">等待共鸣</span>
        </p>
      </div>
    </div>
  )
}
