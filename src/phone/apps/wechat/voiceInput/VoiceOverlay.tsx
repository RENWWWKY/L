import { motion } from 'framer-motion'
import { Languages, Trash2 } from 'lucide-react'
import { AudioVisualizer } from './AudioVisualizer'

export type VoiceGestureZone = 'send' | 'cancel' | 'toText'

export function VoiceOverlay({
  open,
  activeZone,
  durationSec,
  thumbOrigin,
}: {
  open: boolean
  activeZone: VoiceGestureZone
  durationSec: number
  thumbOrigin: { x: number; y: number } | null
}) {
  if (!open) return null
  const tone = activeZone === 'cancel' ? 'cancel' : activeZone === 'toText' ? 'toText' : 'default'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center backdrop-blur-sm bg-black/10"
    >
      <motion.div
        initial={{ y: 18, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 10, scale: 0.99, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-[280px] rounded-[28px] bg-white px-4 py-4 shadow-xl"
      >
        <div className="text-center text-[13px] text-[#6b7280]">松开发送，上滑可取消或转文字</div>
        <div className="mt-1 text-center text-[12px] text-[#9ca3af]">录音 {Math.max(1, durationSec)}"</div>
        <AudioVisualizer active={open} tone={tone} />
      </motion.div>

      <div className="absolute inset-x-0 bottom-[180px] mx-auto flex w-[260px] justify-between">
        <motion.div
          animate={{ scale: activeZone === 'cancel' ? 1.14 : 1, opacity: activeZone === 'cancel' ? 1 : 0.62 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md"
        >
          <Trash2 size={22} color="#8b5d5d" />
        </motion.div>
        <motion.div
          animate={{ scale: activeZone === 'toText' ? 1.14 : 1, opacity: activeZone === 'toText' ? 1 : 0.62 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-md"
        >
          <Languages size={22} color="#D4AF37" />
        </motion.div>
      </div>
      {thumbOrigin ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.55, scale: 1 }}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]"
          style={{ left: thumbOrigin.x, top: thumbOrigin.y }}
        />
      ) : null}
    </motion.div>
  )
}
