import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useState } from 'react'

import type { InviteableContact } from './useInviteableWeChatContacts'
import { useInviteableWeChatContacts } from './useInviteableWeChatContacts'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (contact: InviteableContact) => void | Promise<void>
  sending?: boolean
}

/** 底部毛玻璃抽屉：单选微信通讯录联系人发送共听邀约 */
export function InviteListenerDrawer({ open, onClose, onConfirm, sending = false }: Props) {
  const { contacts, loading } = useInviteableWeChatContacts(open)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = contacts.find((c) => c.id === selectedId) ?? null

  const handleClose = () => {
    if (sending) return
    setSelectedId(null)
    onClose()
  }

  const handleConfirm = async () => {
    if (!selected || sending) return
    await onConfirm(selected)
    setSelectedId(null)
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[10020] bg-black/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-listener-title"
            className="fixed inset-x-0 bottom-0 z-[10021] max-h-[72vh] overflow-hidden rounded-t-[24px] border border-white/60 bg-white/85 shadow-[0_-8px_40px_rgba(45,36,34,0.12)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-200/80" />
            <div className="border-b border-stone-100/80 px-5 pb-3 pt-4">
              <h2 id="invite-listener-title" className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                INVITE LISTENER | 寻觅共鸣者
              </h2>
            </div>

            <div className="max-h-[calc(72vh-140px)] overflow-y-auto px-3 py-2">
              {loading ? (
                <p className="py-8 text-center text-[13px] text-stone-400">加载通讯录…</p>
              ) : contacts.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-stone-400">暂无可邀请的联系人</p>
              ) : (
                <ul className="space-y-0.5">
                  {contacts.map((c) => {
                    const active = selectedId === c.id
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-rose-50/50' : 'hover:bg-stone-50/80'
                          }`}
                        >
                          <div
                            className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-stone-100 ${
                              active ? 'shadow-[0_0_0_3px_rgba(255,192,203,0.35)]' : ''
                            }`}
                          >
                            {c.avatarUrl ? (
                              <img
                                src={c.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-rose-50 to-stone-100" />
                            )}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-[15px] text-[#1A1A1A]">{c.remarkName}</span>
                          {active ? (
                            <Check className="size-4 shrink-0 text-rose-400" strokeWidth={2} aria-hidden />
                          ) : (
                            <span className="w-4 shrink-0" aria-hidden />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-stone-100/80 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                disabled={!selected || sending}
                onClick={() => void handleConfirm()}
                className="w-full rounded-full bg-[#1A1A1A] py-3.5 text-[14px] font-medium tracking-wide text-white transition-opacity disabled:opacity-40"
              >
                {sending ? '发送中…' : '发送邀约 (Send Invitation)'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
