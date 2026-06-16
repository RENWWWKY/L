import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { InviteableContact } from './useInviteableWeChatContacts'
import { useInviteableWeChatContacts } from './useInviteableWeChatContacts'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (contacts: InviteableContact[]) => void | Promise<void>
  sending?: boolean
}

/** 底部抽屉：多选微信通讯录联系人，分享听一听评论 */
export function ShareCommentContactsDrawer({ open, onClose, onConfirm, sending = false }: Props) {
  const { contacts, loading } = useInviteableWeChatContacts(open)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) setSelectedIds(new Set())
  }, [open])

  const selectedCount = selectedIds.size

  const handleClose = () => {
    if (sending) return
    setSelectedIds(new Set())
    onClose()
  }

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = async () => {
    if (selectedCount === 0 || sending) return
    const picked = contacts.filter((c) => selectedIds.has(c.id))
    await onConfirm(picked)
    setSelectedIds(new Set())
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[10030] bg-black/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-comment-title"
            className="fixed inset-x-0 bottom-0 z-[10031] max-h-[72vh] overflow-hidden rounded-t-[24px] border border-white/60 bg-white/85 shadow-[0_-8px_40px_rgba(45,36,34,0.12)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-200/80" />
            <div className="border-b border-stone-100/80 px-5 pb-3 pt-4">
              <h2
                id="share-comment-title"
                className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400"
              >
                SHARE COMMENT | 分享评论给好友
              </h2>
              <p className="mt-1 text-center text-[12px] text-stone-500">可多选通讯录好友</p>
            </div>

            <div className="max-h-[calc(72vh-156px)] overflow-y-auto px-3 py-2">
              {loading ? (
                <p className="py-8 text-center text-[13px] text-stone-400">加载通讯录…</p>
              ) : contacts.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-stone-400">暂无可分享的联系人</p>
              ) : (
                <ul className="space-y-0.5">
                  {contacts.map((c) => {
                    const active = selectedIds.has(c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-rose-50/50' : 'hover:bg-stone-50/80'
                          }`}
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              active
                                ? 'border-rose-400 bg-rose-400 text-white'
                                : 'border-stone-200 bg-white'
                            }`}
                          >
                            {active ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : null}
                          </div>
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
                          <span className="min-w-0 flex-1 truncate text-[15px] text-[#1A1A1A]">
                            {c.remarkName}
                          </span>
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
                disabled={selectedCount === 0 || sending}
                onClick={() => void handleConfirm()}
                className="w-full rounded-full bg-[#1A1A1A] py-3.5 text-[14px] font-medium tracking-wide text-white transition-opacity disabled:opacity-40"
              >
                {sending
                  ? '发送中…'
                  : selectedCount > 0
                    ? `分享给 ${selectedCount} 位好友`
                    : '选择好友后发送'}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
