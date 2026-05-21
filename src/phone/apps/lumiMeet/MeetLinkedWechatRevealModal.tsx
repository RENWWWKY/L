import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

import { Pressable } from '../../components/Pressable'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'

export type MeetLinkedWechatRevealModalProps = {
  open: boolean
  /** 对方真实姓名（已解析后的展示串） */
  peerRealName: string
  wechatId: string
  onClose: () => void
  onCopy: () => void
}

/** 已缔结契约后：再次点开工具栏按钮，查看并复制对方微信号 */
export function MeetLinkedWechatRevealModalPortal({
  open,
  peerRealName,
  wechatId,
  onClose,
  onCopy,
}: MeetLinkedWechatRevealModalProps) {
  const el = getLumiMeetPortalTarget()
  if (!el) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="meet-linked-wechat"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meet-linked-wechat-title"
          className="fixed inset-0 z-[365] flex items-center justify-center bg-black/25 px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="w-full max-w-[min(340px,92vw)] overflow-hidden rounded-[18px] border-[0.5px] border-[#e8e4dc] bg-white/90 p-6 shadow-[0_28px_90px_rgba(22,18,14,0.14)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="meet-linked-wechat-title" className="text-center text-[13px] font-medium tracking-[0.12em] text-[#b8973a]">
              对方微信
            </p>
            <p className="mt-2 text-center text-[14px] text-[#6e6860]">{peerRealName}</p>
            <p className="mt-2 text-center text-[11px] leading-relaxed tracking-[0.04em] text-[#9a9590]">
              尚未自动加入通讯录。复制后到微信搜索添加，或到「新的朋友」处理对方验证。
            </p>
            <Pressable
              type="button"
              onClick={() => {
                onCopy()
              }}
              className="mt-5 w-full rounded-[14px] border border-[#f0ebe3] bg-[#faf9f7] px-4 py-3 text-left transition-colors active:bg-[#f3efe8]"
              aria-label="点击复制微信号"
            >
              <p className="text-[10px] tracking-[0.14em] text-[#9a9590]">对方微信 · 点击复制</p>
              <p className="mt-1 break-all font-mono text-[15px] leading-snug tracking-[0.06em] text-[#1a1918]">{wechatId}</p>
            </Pressable>
            <div className="mt-6 flex gap-3">
              <Pressable
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border-[0.5px] border-[#e0dcd4] bg-[#f4f2ee] py-3 text-[13px] tracking-[0.06em] text-[#6b6459] transition-colors hover:bg-[#ebe8e2]"
              >
                关闭
              </Pressable>
              <Pressable
                type="button"
                onClick={() => {
                  onCopy()
                }}
                className="flex-1 rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] py-3 text-[13px] tracking-[0.08em] text-[#f7f4ef] transition-opacity hover:opacity-95"
              >
                复制微信号
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
