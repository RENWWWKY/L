import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'

/**
 * 音视频通话 ActionSheet：本次只处理「语音通话」。
 */
export function VoiceCallActionSheet({
  open,
  onClose,
  onChooseVoice,
}: {
  open: boolean
  onClose: () => void
  onChooseVoice: () => void
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="vc-sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[260] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(6px)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-t-[18px] bg-white px-3 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-3"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="rounded-[14px] border border-[#ededed] bg-white">
              <Pressable
                type="button"
                onClick={() => {
                  onClose()
                  onChooseVoice()
                }}
                className="flex w-full items-center justify-center py-4 text-[16px] font-medium text-[#1c1c1e] active:bg-[#f5f5f7]"
              >
                语音通话
              </Pressable>
              <div className="h-px w-full bg-[#efefef]" />
              <Pressable
                type="button"
                onClick={() => {
                  // 预留：视频通话后续开发
                  onClose()
                }}
                className="flex w-full items-center justify-center py-4 text-[16px] text-[#1c1c1e]/55 active:bg-[#f5f5f7]"
              >
                视频通话（开发中）
              </Pressable>
            </div>

            <Pressable
              type="button"
              onClick={onClose}
              className="mt-3 flex w-full items-center justify-center rounded-[14px] border border-[#ededed] bg-white py-4 text-[16px] font-medium text-[#1c1c1e] active:bg-[#f5f5f7]"
            >
              取消
            </Pressable>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

