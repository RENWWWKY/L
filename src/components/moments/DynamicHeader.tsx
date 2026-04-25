import { ArrowLeft, Camera } from 'lucide-react'
import { motion } from 'framer-motion'

type DynamicHeaderProps = {
  opacity: number
  onBack?: () => void
  goToPublish?: () => void
}

export function DynamicHeader({ opacity, onBack, goToPublish }: DynamicHeaderProps) {
  return (
    <div
      className="pointer-events-none sticky inset-x-0 top-0 z-30 h-0"
      style={{ opacity }}
    >
      <div
        className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between gap-2 border-b px-3 pb-2"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          borderColor: 'var(--wx-border, rgba(0,0,0,0.08))',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
        >
          <ArrowLeft className="size-4" />
        </motion.button>
        <div className="flex min-h-[36px] min-w-0 flex-1 items-center justify-center px-1">
          <h1 className="truncate text-center text-[17px] font-semibold tracking-[0.2px] text-[#111827]">朋友圈</h1>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={goToPublish}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
        >
          <Camera className="size-4" />
        </motion.button>
      </div>
    </div>
  )
}
