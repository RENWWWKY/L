import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

const SERIF =
  '"Cormorant Garamond", "Noto Serif SC", "STSong", "STKaiti", "Georgia", "Times New Roman", serif'

type Props = {
  open: boolean
  loading?: boolean
  onCancel: () => void
  onConfirmErase: () => void
}

export function DeleteAccountModal({ open, loading, onCancel, onConfirmErase }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="erase-identity-title"
          className="fixed inset-0 z-[380] flex items-center justify-center bg-black/60 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          onClick={onCancel}
        >
          <motion.div
            className="w-full max-w-[min(340px,92vw)] rounded-[18px] bg-white px-6 py-7 shadow-[0_28px_90px_rgba(0,0,0,0.2)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="erase-identity-title"
              className="text-center text-[9px] font-medium uppercase tracking-[0.38em] text-[#9CA3AF]"
            >
              ERASE IDENTITY
            </p>
            <p className="mt-2 text-center text-[15px] font-medium text-[#111827]" style={{ fontFamily: SERIF }}>
              抹除身份档案
            </p>
            <p
              className="mt-5 text-center text-[13px] font-light italic leading-relaxed text-[#6B7280]"
              style={{ fontFamily: SERIF }}
            >
              此操作将不可逆地抹除本机微信账号下的全部数据：通讯记录、玩家身份、角色人设、记忆档案、遇见邂逅与绑定关系。您确定要彻底离开吗？
            </p>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="flex-1 rounded-full bg-[#111827] py-3.5 text-[13px] font-medium tracking-[0.06em] text-white transition-opacity hover:opacity-95 disabled:opacity-60"
              >
                暂不离开 (Cancel)
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirmErase}
                className="flex-1 rounded-full py-3.5 text-[13px] font-light tracking-[0.04em] text-[#9CA3AF] transition-colors hover:text-[#111827] disabled:opacity-50"
              >
                {loading ? '…' : '确认抹除 (Erase)'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
