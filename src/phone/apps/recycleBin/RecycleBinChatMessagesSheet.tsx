import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { WeChatChatMessage } from '../wechat/newFriendsPersona/types'
import {
  formatTrashMessageBody,
  formatTrashMessageTime,
  senderLabelForTrashMessage,
} from './trashChatPayload'

const PANEL_SPRING = { type: 'spring' as const, damping: 34, stiffness: 320 }

type Props = {
  open: boolean
  title: string
  isGroup: boolean
  messages: WeChatChatMessage[]
  onClose: () => void
}

/** 回收站已删聊天记录：柔和简约的居中面板 */
export function RecycleBinChatMessagesSheet({ open, title, isGroup, messages, onClose }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/35 backdrop-blur-[6px]"
            aria-label="关闭"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="trash-chat-detail-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={PANEL_SPRING}
            className="relative flex max-h-[min(85vh,640px)] w-full max-w-[400px] flex-col overflow-hidden rounded-[22px] border border-stone-200/90 bg-[#fafaf9] shadow-[0_24px_48px_-12px_rgba(28,25,23,0.18),0_0_0_1px_rgba(255,255,255,0.6)_inset]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200/70 bg-gradient-to-b from-white to-stone-50/80 px-4 pb-3 pt-3.5">
              <div className="min-w-0 flex-1 pr-1 pt-0.5">
                <p id="trash-chat-detail-title" className="truncate text-[15px] font-medium tracking-tight text-stone-800">
                  {title}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-stone-500">
                  删除前快照 · 共 {messages.length} 条
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200/70 text-stone-600 transition-colors hover:bg-stone-300/80 hover:text-stone-800 active:scale-[0.97]"
                aria-label="关闭"
              >
                <X className="size-[17px]" strokeWidth={2} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f4f2]/90 px-3 py-3 [scrollbar-width:thin] [scrollbar-color:rgba(168,162,158,0.5)_transparent]">
              {messages.length === 0 ? (
                <p className="py-12 text-center text-[13px] text-stone-500">没有可展示的消息记录</p>
              ) : (
                <ul className="mx-auto flex max-w-[340px] flex-col gap-3.5 pb-3 pt-1">
                  {messages.map((m) => {
                    const self = m.type === 'player'
                    const label = senderLabelForTrashMessage(m, isGroup)
                    const body = formatTrashMessageBody(m)
                    return (
                      <li
                        key={m.id}
                        className={`flex w-full flex-col gap-1 ${self ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex max-w-[92%] flex-col gap-1">
                          <div
                            className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] text-stone-500 ${self ? 'justify-end' : 'justify-start'}`}
                          >
                            <span className="font-medium text-stone-600">{label}</span>
                            <span className="tabular-nums text-stone-400">{formatTrashMessageTime(m.timestamp)}</span>
                          </div>
                          <div
                            className={`rounded-[14px] px-3 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm ${
                              self
                                ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-white/95'
                                : 'border border-stone-200/90 bg-white text-stone-800'
                            }`}
                          >
                            {body}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
