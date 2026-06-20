import { AnimatePresence, motion } from 'framer-motion'
import {
  OFFICIAL_COMMUNITY_JOIN_HINT,
  OFFICIAL_DISCORD_COMMUNITY_ID,
} from '../userSystem/officialCommunity'

type EntryNoticeModalProps = {
  open: boolean
  ageConfirmed: boolean
  riskConfirmed: boolean
  onToggleAge: (checked: boolean) => void
  onToggleRisk: (checked: boolean) => void
  onConfirm: () => void
}

export function EntryNoticeModal({
  open,
  ageConfirmed,
  riskConfirmed,
  onToggleAge,
  onToggleRisk,
  onConfirm,
}: EntryNoticeModalProps) {
  const canConfirm = ageConfirmed && riskConfirmed

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center px-5 py-6 sm:px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-label="使用前说明"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <motion.div
            className="relative w-full max-w-[560px] rounded-[20px] border border-black/10 bg-[#FFFFFF] p-5 text-[#1C1C1E] shadow-[0_24px_60px_rgba(28,28,30,0.18)] sm:p-6"
            initial={{ y: 14, scale: 0.985, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.99, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="mb-3 text-center text-[13px] font-medium uppercase tracking-[0.35em] text-[#D4AF37]"
              style={{ fontFamily: '"Didot", "Optima", "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              NOTICE
            </div>
            <h2 className="text-center text-[20px] font-semibold sm:text-[22px]">使用前说明</h2>

            <div className="mt-4 space-y-3 text-[14px] leading-7 text-[#1C1C1E]/85 sm:text-[15px]">
              <p>
                本项目始终免费。若你通过倒卖链接等渠道付费获得访问，请知悉该收费行为与项目作者无关。
              </p>
              <p className="font-medium text-[#D92D20]">
                请勿购买或传播倒卖链接；若发现相关情况，请前往官方 Discord 社区或 QQ 群反馈举报。
                {OFFICIAL_DISCORD_COMMUNITY_ID ? (
                  <>
                    {' '}
                    社区 ID：<strong>{OFFICIAL_DISCORD_COMMUNITY_ID}</strong>。
                  </>
                ) : null}
                {OFFICIAL_COMMUNITY_JOIN_HINT}
              </p>
              <p>请妥善保管账号与密码，勿向他人泄露，避免账号被盗用。</p>
              <p>你必须年满 18 周岁方可继续使用。</p>
              <p>
                项目内聊天内容主要由 AI 生成，仅供参考与体验，请你自行判断其真实性、合理性与适用性。
              </p>
              <p>因使用聊天内容产生的任何影响与后果，需由你本人自行承担。</p>
            </div>

            <div className="mt-5 space-y-3 rounded-[14px] border border-black/8 bg-[#F9FAFB] p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#D4AF37]"
                  checked={ageConfirmed}
                  onChange={(e) => onToggleAge(e.target.checked)}
                />
                <span className="text-[13px] leading-6 text-[#1C1C1E]/80 sm:text-[14px]">我已年满 18 周岁。</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#D4AF37]"
                  checked={riskConfirmed}
                  onChange={(e) => onToggleRisk(e.target.checked)}
                />
                <span className="text-[13px] leading-6 text-[#1C1C1E]/80 sm:text-[14px]">
                  我已知悉 AI 内容需自行判断，并愿意自行承担相关影响和后果。
                </span>
              </label>
            </div>

            <button
              type="button"
              className="mt-5 h-11 w-full rounded-[14px] text-[14px] font-medium transition sm:text-[15px]"
              style={
                canConfirm
                  ? {
                      background: '#1C1C1E',
                      color: '#FFFFFF',
                      boxShadow: '0 12px 30px rgba(28,28,30,0.2)',
                    }
                  : {
                      background: 'rgba(28,28,30,0.12)',
                      color: 'rgba(28,28,30,0.45)',
                    }
              }
              disabled={!canConfirm}
              onClick={onConfirm}
            >
              我已阅读并同意继续
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
