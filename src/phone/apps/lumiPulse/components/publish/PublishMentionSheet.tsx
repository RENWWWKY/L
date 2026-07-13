import { motion } from 'framer-motion'
import { X } from 'lucide-react'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_SHEET_SPRING } from '../../constants'

export type PublishMentionCandidate = {
  name: string
  avatarUrl?: string
  subtitle?: string
}

export function PublishMentionSheet({
  candidates,
  onPick,
  onClose,
}: {
  candidates: PublishMentionCandidate[]
  onPick: (name: string) => void
  onClose: () => void
}) {
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
        className="fixed inset-x-0 bottom-0 z-[1280] max-h-[62vh] overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_-12px_48px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-[13px] font-medium text-[#1C1C1E]">@ 艾特</p>
          <Pressable type="button" onClick={onClose} className="text-neutral-400" aria-label="关闭">
            <X className="size-5" strokeWidth={1.5} />
          </Pressable>
        </div>
        <div className="max-h-[48vh] overflow-y-auto px-3 pb-4">
          {candidates.length ? (
            candidates.map((row) => (
              <Pressable
                key={row.name}
                type="button"
                onClick={() => onPick(row.name)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:bg-[#F5F5F4]"
              >
                <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[#F0F0EF]">
                  {row.avatarUrl ? (
                    <img src={row.avatarUrl} alt="" className="size-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[13px] text-neutral-400">
                      {row.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[#1C1C1E]">{row.name}</p>
                  {row.subtitle ? (
                    <p className="truncate text-[11px] text-neutral-400">{row.subtitle}</p>
                  ) : null}
                </div>
              </Pressable>
            ))
          ) : (
            <p className="px-4 py-10 text-center text-[13px] text-neutral-400">暂无可艾特的角色</p>
          )}
        </div>
      </motion.div>
    </>
  )
}
