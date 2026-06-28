import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useInviteableWeChatContacts } from '../../../../components/discoverListen/useInviteableWeChatContacts'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (characterId: string) => void | Promise<void>
  sending?: boolean
}

/** 收藏记忆切片 · 单选联系人转发抽屉 */
export function ShareContactSheet({ open, onClose, onConfirm, sending = false }: Props) {
  const { contacts, loading } = useInviteableWeChatContacts(open, {
    includeLumiAssistant: true,
    includeSelfChat: true,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setSelectedId(null)
  }, [open])

  const handleClose = () => {
    if (sending) return
    setSelectedId(null)
    onClose()
  }

  const handleConfirm = async () => {
    if (!selectedId || sending) return
    await onConfirm(selectedId)
    setSelectedId(null)
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[52000] bg-black/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-record-title"
            className="fixed inset-x-0 bottom-0 z-[52001] max-h-[72vh] overflow-hidden rounded-t-[24px] border border-white/70 bg-white/90 shadow-[0_-8px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-200" />
            <div className="border-b border-gray-100 px-5 pb-3 pt-4">
              <h2
                id="share-record-title"
                className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-gray-400"
              >
                SEND TO | 发送给…
              </h2>
            </div>

            <div className="max-h-[calc(72vh-156px)] overflow-y-auto px-3 py-2">
              {loading ? (
                <p className="py-8 text-center text-[13px] text-gray-400">加载通讯录…</p>
              ) : contacts.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-gray-400">暂无可转发的联系人</p>
              ) : (
                <ul className="space-y-0.5">
                  {contacts.map((c) => {
                    const active = selectedId === c.characterId
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.characterId)}
                          className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                            active ? 'bg-gray-50' : 'hover:bg-gray-50/80'
                          }`}
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-100">
                            {c.avatarUrl ? (
                              <img
                                src={c.avatarUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : null}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-[15px] text-gray-900">{c.remarkName}</span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'
                            }`}
                            aria-hidden
                          >
                            {active ? <Check className="size-3" strokeWidth={2.5} /> : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <AnimatePresence>
              {selectedId ? (
                <motion.div
                  className="border-t border-gray-100 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void handleConfirm()}
                    className="w-full rounded-[14px] bg-gray-900 py-3.5 text-[15px] font-medium tracking-wide text-white transition-opacity disabled:opacity-50"
                  >
                    {sending ? '投递中…' : '确认转发 (Confirm Send)'}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
