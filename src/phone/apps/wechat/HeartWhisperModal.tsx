import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../components/Pressable'
import type { HeartWhisper } from './newFriendsPersona/types'

function WhisperField({
  en,
  zh,
  value,
}: {
  en: string
  zh: string
  value: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-[#4a4a4a]">{en}</span>
        <span className="text-[10px] text-[#9a9a9a]">{zh}</span>
      </div>
      <p className="text-[14px] leading-6 text-[#111111]">{value || '-'}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-24 animate-pulse rounded bg-[#f1f1f1]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="h-3 w-20 animate-pulse rounded bg-[#f1f1f1]" />
          <div className="h-5 w-full animate-pulse rounded bg-[#f6f6f6]" />
          <div className="h-3 w-20 animate-pulse rounded bg-[#f1f1f1]" />
          <div className="h-5 w-full animate-pulse rounded bg-[#f6f6f6]" />
          <div className="h-3 w-20 animate-pulse rounded bg-[#f1f1f1]" />
          <div className="h-5 w-full animate-pulse rounded bg-[#f6f6f6]" />
        </div>
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-[#f1f1f1]" />
          <div className="h-24 w-full animate-pulse rounded bg-[#f6f6f6]" />
          <div className="h-3 w-28 animate-pulse rounded bg-[#f1f1f1]" />
          <div className="h-20 w-full animate-pulse rounded bg-[#f6f6f6]" />
        </div>
      </div>
    </div>
  )
}

export function HeartWhisperModal({
  open,
  loading,
  data,
  onClose,
  onGenerate,
}: {
  open: boolean
  loading: boolean
  data: HeartWhisper | null
  onClose: () => void
  onGenerate: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="heart-whisper-mask"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-[#f5f5f5]/65 px-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            key="heart-whisper-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full max-h-[82vh] w-full max-w-[760px] flex-col rounded-[18px] border border-[#eaeaea] bg-white px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.09)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[0.12em] text-black">INNER VOICE</h2>
                <p className="mt-1 text-[12px] text-[#8e8e8e]">心语</p>
              </div>
              <div className="flex items-center gap-2">
                <Pressable
                  type="button"
                  onClick={onGenerate}
                  className="rounded-[10px] border border-black px-3 py-1.5 text-[12px] font-medium tracking-wide text-black transition-colors hover:bg-black hover:text-white"
                >
                  {loading ? '生成中...' : '生成/刷新'}
                </Pressable>
                <Pressable type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e5e5] text-[#555]">
                  <span className="text-[15px] leading-none">X</span>
                </Pressable>
              </div>
            </div>

            <div className="mt-3 border-t border-[#eeeeee]" />

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="text-right">
                <span className="text-[12px] tabular-nums text-[#8c8c8c]">{data?.timestamp || '--'}</span>
              </div>

              <div className="mt-4">
                {loading ? (
                  <Skeleton />
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-5">
                      <WhisperField en="LOCATION" zh="所在地点" value={data?.location ?? ''} />
                      <WhisperField en="OUTFIT" zh="着装" value={data?.outfit ?? ''} />
                      <WhisperField en="ACTION" zh="动作姿态" value={data?.action ?? ''} />
                    </div>
                    <div className="space-y-5">
                      <WhisperField en="INNER THOUGHTS" zh="内心独白" value={data?.innerThoughts ?? ''} />
                      <div className="border-t border-dashed border-[#eeeeee]" />
                      <WhisperField en="IMPRESSION ON USER" zh="对你的看法" value={data?.userImpression ?? ''} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
