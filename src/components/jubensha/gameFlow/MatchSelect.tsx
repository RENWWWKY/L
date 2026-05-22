import { motion } from 'framer-motion'

export type MatchSelectProps = {
  scriptTitle: string
  onBlindMatch: () => void
  onInviteLocked: () => void
}

export function MatchSelect({ scriptTitle, onBlindMatch, onInviteLocked }: MatchSelectProps) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
    >
      <motion.p
        className="jbs-font-serif jbs-gf-text-muted mb-10 max-w-[280px] text-center text-[11px] tracking-[0.2em]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        《{scriptTitle}》· 入局前厅
      </motion.p>

      <div className="flex w-full max-w-[340px] flex-col items-center gap-5">
        <motion.button
          type="button"
          onClick={onBlindMatch}
          className="jbs-gf-btn-fate jbs-font-serif text-[13px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45 }}
          whileTap={{ scale: 0.98 }}
        >
          命运盲抽
          <span className="jbs-gf-btn-fate-sub">Match with Strangers</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={onInviteLocked}
          className="jbs-gf-btn-fate jbs-gf-btn-invite jbs-font-serif relative text-[13px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.45 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="flex items-center justify-center gap-3">
            邀约旧识
            <span className="jbs-font-serif text-[8px] italic tracking-normal text-[#1a1a1a]/30">
              *Function locked*
            </span>
          </span>
          <span className="jbs-gf-btn-fate-sub">Invite Contacts</span>
        </motion.button>
      </div>
    </motion.div>
  )
}
