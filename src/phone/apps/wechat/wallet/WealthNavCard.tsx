import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'

function miniPath(values: number[]) {
  if (values.length < 2) return ''
  const w = 130
  const h = 44
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const step = w / Math.max(1, values.length - 1)
  return values
    .map((v, i) => {
      const x = i * step
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function WealthNavCard({
  onOpen,
  trend = [18, 20, 19, 24, 22, 26, 30, 31],
}: {
  onOpen: () => void
  trend?: number[]
}) {
  const d = miniPath(trend)

  return (
    <Pressable
      type="button"
      onClick={onOpen}
      className="group relative mt-8 overflow-hidden rounded-[30px] border border-white/60 bg-white/40 px-5 py-5 text-left shadow-[0_16px_34px_rgba(0,0,0,0.08)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] transition-transform active:scale-[0.99]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.8), transparent 52%)' }} />
      <div className="relative z-[1] flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.26em] text-gray-400">LUMI WEALTH</p>
          <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-black">专属理财</h3>
          <p className="mt-1 text-[12px] text-gray-500">Private Banking Experience</p>
        </div>

        <div className="relative w-[140px] shrink-0">
          <svg viewBox="0 0 130 44" className="h-[44px] w-full opacity-90" aria-hidden>
            <motion.path
              d={d}
              fill="none"
              stroke="#111111"
              strokeWidth="1.4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            />
          </svg>
          <ChevronRight className="absolute -right-1 top-1/2 size-4 -translate-y-1/2 text-gray-500 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Pressable>
  )
}

