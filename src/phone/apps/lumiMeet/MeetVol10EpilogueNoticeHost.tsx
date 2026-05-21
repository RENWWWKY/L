import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import {
  MEET_VOL10_EPILOGUE_WRITE_END_EVENT,
  MEET_VOL10_EPILOGUE_WRITE_START_EVENT,
  MEET_VOL10_EPILOGUE_WRITTEN_EVENT,
  type MeetVol10EpilogueNoticeDetail,
} from './meetVol10EpilogueNotice'

/**
 * 全局：加为微信好友后撰写 vol10 结业初印象时的加载层与成功提示。
 */
export function MeetVol10EpilogueNoticeHost() {
  const [writing, setWriting] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [nickname, setNickname] = useState('对方')

  const dismissSuccess = useCallback(() => {
    setSuccessOpen(false)
  }, [])

  useEffect(() => {
    const onStart = (ev: Event) => {
      const d = (ev as CustomEvent<MeetVol10EpilogueNoticeDetail>).detail
      setNickname(d?.characterNickname?.trim() || '对方')
      setSuccessOpen(false)
      setWriting(true)
    }
    const onWritten = (ev: Event) => {
      const d = (ev as CustomEvent<MeetVol10EpilogueNoticeDetail>).detail
      setNickname(d?.characterNickname?.trim() || '对方')
      setWriting(false)
      setSuccessOpen(true)
    }
    const onEnd = () => {
      setWriting(false)
    }
    window.addEventListener(MEET_VOL10_EPILOGUE_WRITE_START_EVENT, onStart)
    window.addEventListener(MEET_VOL10_EPILOGUE_WRITTEN_EVENT, onWritten)
    window.addEventListener(MEET_VOL10_EPILOGUE_WRITE_END_EVENT, onEnd)
    return () => {
      window.removeEventListener(MEET_VOL10_EPILOGUE_WRITE_START_EVENT, onStart)
      window.removeEventListener(MEET_VOL10_EPILOGUE_WRITTEN_EVENT, onWritten)
      window.removeEventListener(MEET_VOL10_EPILOGUE_WRITE_END_EVENT, onEnd)
    }
  }, [])

  return (
    <AnimatePresence>
      {writing ? (
        <motion.div
          key="meet-vol10-writing"
          className="fixed inset-0 z-[1260] flex items-center justify-center bg-black/48 px-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-labelledby="meet-vol10-writing-title"
          aria-live="polite"
        >
          <motion.div
            className="w-full max-w-[min(320px,88vw)] rounded-2xl border border-stone-200/90 bg-white px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.2)]"
            initial={{ scale: 0.96, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
          >
            <motion.div
              className="mx-auto mb-5 size-10 rounded-full border-2 border-stone-200 border-t-stone-800"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            />
            <p id="meet-vol10-writing-title" className="text-[16px] font-semibold text-stone-900">
              正在撰写邂逅结业初印象
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-stone-600">
              根据与「{nickname}」的遇见临时会话，写入人设 vol10「对 TA 的当前态度」…
            </p>
          </motion.div>
        </motion.div>
      ) : null}
      {successOpen ? (
        <motion.div
          key="meet-vol10-success"
          className="fixed inset-0 z-[1260] flex items-center justify-center bg-black/35 px-5 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="meet-vol10-success-title"
        >
          <motion.div
            className="w-full max-w-[min(340px,92vw)] rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-stone-400">遇见 · 结业同步</p>
            <p id="meet-vol10-success-title" className="mt-2 text-[17px] font-semibold tracking-tight text-stone-900">
              初印象已写入世界书
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-stone-600">
              已根据邂逅记录，为「{nickname}」生成约百字的「对 TA 的当前态度」，并写入人设库{' '}
              <span className="font-medium text-stone-800">vol10 尾声延展</span>。可在人设 · 世界书中查看或微调。
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-stone-900 py-3 text-[15px] font-medium text-white transition-colors hover:bg-stone-800 active:scale-[0.99]"
              onClick={dismissSuccess}
            >
              知道了
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
