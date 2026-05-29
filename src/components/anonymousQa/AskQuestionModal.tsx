import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

import type { MockContact } from './types'

const LETTER_TEXTURE_URL = new URL('../../../image/信封纹理纸.png', import.meta.url).toString()

type AskQuestionModalProps = {
  open: boolean
  onClose: () => void
  contacts: MockContact[]
  onSubmitPublic: (body: string) => void
  /** 定向：为每位好友生成一条独立记录（互不可见） */
  onSubmitDirected: (body: string, targets: MockContact[]) => void
}

export function AskQuestionModal({
  open,
  onClose,
  contacts,
  onSubmitPublic,
  onSubmitDirected,
}: AskQuestionModalProps) {
  const [mode, setMode] = useState<'public' | 'directed'>('public')
  const [body, setBody] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [flyAway, setFlyAway] = useState(false)

  /** 定向提问：仅通讯录好友，不可选自己 */
  const pickableContacts = useMemo(() => contacts.filter((c) => c.id !== 'self'), [contacts])

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = () => {
    const t = body.trim()
    if (!t) return
    if (mode === 'directed' && selectedIds.size === 0) {
      setPickerOpen(true)
      return
    }
    if (mode === 'directed') {
      const targets = pickableContacts.filter((c) => selectedIds.has(c.id))
      onSubmitDirected(t, targets)
      setBody('')
      setSelectedIds(new Set())
      onClose()
      return
    }
    setFlyAway(true)
    window.setTimeout(() => {
      onSubmitPublic(t)
      setFlyAway(false)
      setBody('')
      setSelectedIds(new Set())
      onClose()
    }, 720)
  }

  const selectedContacts = pickableContacts.filter((c) => selectedIds.has(c.id))

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1500] flex flex-col bg-black/40 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
            <span className="text-[10px] tracking-[0.28em] text-white/80">ASK</span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <X className="size-4" />
            </motion.button>
          </div>

          <motion.div
            className="mx-4 mt-2 flex rounded-full border border-white/20 bg-white/10 p-1"
            layout
          >
            {(['public', 'directed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`relative flex-1 rounded-full py-2 text-center text-[12px] font-medium transition-colors ${
                  mode === m ? 'text-[#111827]' : 'text-white/70'
                }`}
              >
                {mode === m ? (
                  <motion.div
                    layoutId="ask-tab"
                    className="absolute inset-0 rounded-full bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                ) : null}
                <span className="relative z-10">{m === 'public' ? '公开提问' : '定向提问'}</span>
                <span className="relative z-10 ml-1 text-[9px] tracking-widest opacity-70">
                  {m === 'public' ? 'PUBLIC' : 'DIRECTED'}
                </span>
              </button>
            ))}
          </motion.div>

          <div className="mx-4 mt-4 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-white/42 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] backdrop-blur-[4px]">
            {mode === 'directed' ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mx-4 mt-4 rounded-xl border border-dashed border-black/15 bg-[#FAFAFA] px-3 py-3 text-left text-[13px] text-[#6B7280]"
              >
                {selectedContacts.length ? (
                  <span className="text-[#111827]">
                    已选 {selectedContacts.length} 位好友（各自收到独立信件）
                  </span>
                ) : (
                  '选择通讯录好友（可多选）'
                )}
              </button>
            ) : null}

            <div
              className="relative mx-4 mt-3 min-h-[200px] flex-1 rounded-xl border border-black/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(255,252,247,0.76), rgba(255,252,247,0.8)), url(${LETTER_TEXTURE_URL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="在此写下你的问题……"
                className="h-full min-h-[180px] w-full resize-none bg-transparent text-[16px] leading-relaxed text-[#111827] outline-none placeholder:text-[#9CA3AF]"
              />
              <motion.div
                className="pointer-events-none absolute right-4 top-4 h-8 w-8 rounded-full border border-black/10 opacity-30"
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <div className="relative p-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleSend}
                className="relative w-full overflow-hidden rounded-2xl bg-[#111827] py-3.5 text-[14px] font-medium text-white"
              >
                寄出信笺
              </motion.button>
              <AnimatePresence>
                {flyAway ? (
                  <motion.div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="h-4 w-4 border-r-2 border-t-2 border-white"
                      style={{ transform: 'rotate(45deg)' }}
                      initial={{ y: 34, x: -10, opacity: 1, scale: 0.95 }}
                      animate={{ y: -360, x: 88, opacity: 0, scale: 0.25 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {pickerOpen ? (
              <motion.div
                className="fixed inset-0 z-[1600] flex items-end justify-center bg-black/35"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPickerOpen(false)}
              >
                <motion.div
                  className="max-h-[56vh] w-full max-w-[560px] rounded-t-3xl bg-white p-4 shadow-xl"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-center text-[13px] font-medium text-[#111827]">选择好友</p>
                  <p className="mt-1 text-center text-[11px] text-[#9CA3AF]">每位好友将单独收到提问，互不可见</p>
                  <ul className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto">
                    {pickableContacts.length === 0 ? (
                      <li className="py-6 text-center text-[13px] text-[#9CA3AF]">通讯录暂无好友</li>
                    ) : null}
                    {pickableContacts.map((c) => {
                      const on = selectedIds.has(c.id)
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => toggleContact(c.id)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                              on ? 'border-[#111827] bg-white' : 'border-black/8 bg-white'
                            }`}
                          >
                            <img src={c.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                            <span className="text-[14px] text-[#111827]">{c.remarkName}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-[#111827] py-3 text-[14px] text-white"
                    onClick={() => setPickerOpen(false)}
                  >
                    完成
                  </button>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
