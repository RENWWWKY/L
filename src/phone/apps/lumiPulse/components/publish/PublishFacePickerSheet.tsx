import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { X } from 'lucide-react'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_SHEET_SPRING } from '../../constants'
import { getWeiboFaceUrl, PULSE_WEIBO_FACE_PICKER } from '../../pulseWeiboFace'

/** 全宽表情面板：8 列网格，可连续点选不自动关闭 */
export function PublishFacePickerSheet({
  onPick,
  onClose,
}: {
  onPick: (token: string) => void
  onClose: () => void
}) {
  const faces = useMemo(
    () =>
      PULSE_WEIBO_FACE_PICKER.map((name) => ({
        name,
        url: getWeiboFaceUrl(name),
      })).filter((f) => f.url),
    [],
  )

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1270] bg-black/20 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="关闭"
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1280] flex max-h-[72vh] flex-col overflow-hidden rounded-t-[24px] bg-white/98 shadow-[0_-12px_48px_rgba(0,0,0,0.1)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.03] px-5 py-3.5">
          <p className="text-[13px] font-medium text-[#1C1C1E]">微博表情</p>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="grid grid-cols-8 gap-1">
            {faces.map((face) => (
              <Pressable
                key={face.name}
                type="button"
                title={`[${face.name}]`}
                onClick={() => onPick(`[${face.name}]`)}
                className="flex aspect-square items-center justify-center rounded-xl active:bg-[#F0F0EF]"
              >
                <img
                  src={face.url}
                  alt={face.name}
                  className="size-[28px] object-contain"
                  draggable={false}
                />
              </Pressable>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}
