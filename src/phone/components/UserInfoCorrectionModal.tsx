import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { fetchUserProfile, logoutUser, submitUserInfoCorrection } from '../userSystem/userSystemApi'
import { DISCORD_SNOWFLAKE_HINT, isDiscordSnowflakeId } from '../userSystem/discordId'
import type { UserLoginStatus } from '../userSystem/types'

const CORRECTION_DEADLINE_MS = 48 * 60 * 60 * 1000

function formatCorrectionDeadlineHint(requestedAt?: string): string {
  if (!requestedAt?.trim()) return '请在 48 小时内完成更正，逾期账号将自动封禁'
  const normalized = requestedAt.trim().replace(' ', 'T')
  const start = new Date(`${normalized}+08:00`).getTime()
  if (Number.isNaN(start)) return '请在 48 小时内完成更正，逾期账号将自动封禁'
  const remainMs = start + CORRECTION_DEADLINE_MS - Date.now()
  if (remainMs <= 0) return '更正期限已过，请尽快提交；若仍无法进入请重新登录'
  const remainHours = Math.max(1, Math.ceil(remainMs / (60 * 60 * 1000)))
  return `请在 48 小时内完成更正（剩余约 ${remainHours} 小时），逾期账号将自动封禁`
}

type Props = {
  open: boolean
  status: UserLoginStatus
  onCorrected: (status: UserLoginStatus) => void
  onLogout?: () => void
}

export function UserInfoCorrectionModal({ open, status, onCorrected, onLogout }: Props) {
  const [qq, setQq] = useState('')
  const [dcId, setDcId] = useState('')
  const [inquiryImages, setInquiryImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const deadlineHint = formatCorrectionDeadlineHint(status.correctionRequestedAt)

  useEffect(() => {
    if (!open) return
    setError('')
    setInfo('')
    setPreviewImage(null)
    let cancelled = false
    void fetchUserProfile().then((profile) => {
      if (cancelled || !profile) return
      setQq(profile.qq)
      setDcId(profile.dcId)
      setInquiryImages(profile.auditInquiryImages?.length ? profile.auditInquiryImages : (status.auditInquiryImages ?? []))
    })
    return () => {
      cancelled = true
    }
  }, [open, status.auditRejectReason, status.auditInquiryImages])

  const handleSubmit = useCallback(async () => {
    setError('')
    setInfo('')
    if (!qq.trim() || !dcId.trim()) {
      setError('请填写完整的 QQ 号与 Discord ID')
      return
    }
    if (!isDiscordSnowflakeId(dcId)) {
      setError(DISCORD_SNOWFLAKE_HINT)
      return
    }
    setLoading(true)
    try {
      const r = await submitUserInfoCorrection({ qq: qq.trim(), dcId: dcId.trim() })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setInfo(r.message)
      onCorrected(r.status)
    } finally {
      setLoading(false)
    }
  }, [qq, dcId, onCorrected])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10002] flex items-center justify-center px-4 py-6 sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="更正账号信息"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />
          <motion.div
            className="relative flex max-h-[min(90vh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] border border-black/10 bg-white text-[#1C1C1E] shadow-[0_24px_60px_rgba(28,28,30,0.2)]"
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="shrink-0 border-b border-black/8 px-5 py-4 sm:px-6">
              <h2 className="text-center text-[18px] font-semibold sm:text-[20px]">请更正账号信息</h2>
              <p className="mt-1 text-center text-[12px] leading-5 text-[#1C1C1E]/55 sm:text-[13px]">
                管理员审核时发现信息有误，更正并提交前无法继续使用 Lumi
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="mb-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] leading-5 text-[#B91C1C]">
                {deadlineHint}
              </div>
              {status.auditRejectReason ? (
                <div className="mb-3 rounded-[10px] border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2.5">
                  <p className="text-[12px] font-medium text-[#B45309]">管理员说明</p>
                  <p className="mt-1 text-[13px] leading-6 text-[#92400E]">{status.auditRejectReason}</p>
                </div>
              ) : null}

              {inquiryImages.length ? (
                <div className="mb-3">
                  <p className="mb-2 text-[12px] font-medium text-[#1C1C1E]/55">证据截图</p>
                  <div className="grid grid-cols-3 gap-2">
                    {inquiryImages.map((src, index) => (
                      <button
                        key={`${index}-${src.slice(0, 24)}`}
                        type="button"
                        className="overflow-hidden rounded-[10px] border border-black/10"
                        onClick={() => setPreviewImage(src)}
                      >
                        <img
                          src={src}
                          alt={`证据截图 ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="mb-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
                  {error}
                </div>
              ) : null}

              {info ? (
                <div className="mb-3 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[13px] text-[#166534]">
                  {info}
                </div>
              ) : null}

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] text-[#1C1C1E]/55">QQ 号</span>
                  <input
                    className="h-10 w-full rounded-[10px] border border-black/10 bg-[#FAFAFA] px-3 text-[14px] outline-none focus:border-[#4F46E5]"
                    value={qq}
                    onChange={(e) => setQq(e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] text-[#1C1C1E]/55">Discord 数字 ID</span>
                  <input
                    className="h-10 w-full rounded-[10px] border border-black/10 bg-[#FAFAFA] px-3 text-[14px] outline-none focus:border-[#4F46E5]"
                    value={dcId}
                    onChange={(e) => setDcId(e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] leading-4 text-[#1C1C1E]/45">{DISCORD_SNOWFLAKE_HINT}</p>
                </label>
                <button
                  type="button"
                  className="mt-2 h-11 w-full rounded-[12px] bg-[#1C1C1E] text-[14px] font-medium text-white disabled:opacity-50"
                  disabled={loading}
                  onClick={() => void handleSubmit()}
                >
                  {loading ? '提交中…' : '提交更正'}
                </button>
                <button
                  type="button"
                  className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                  onClick={() => {
                    void logoutUser().finally(() => onLogout?.())
                  }}
                >
                  切换账号 / 重新登录
                </button>
              </div>
            </div>
          </motion.div>

          {previewImage ? (
            <button
              type="button"
              className="absolute inset-0 z-[10003] flex items-center justify-center bg-black/75 p-4"
              onClick={() => setPreviewImage(null)}
              aria-label="关闭截图预览"
            >
              <img
                src={previewImage}
                alt="证据截图放大预览"
                className="max-h-[85vh] max-w-full rounded-[12px] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
