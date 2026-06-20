import { AnimatePresence, motion } from 'framer-motion'
import { Copy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getDeviceFingerprint, getPublicIp } from '../userSystem/deviceFingerprint'
import {
  clearAuth,
  getAuthToken,
  getStoredUsername,
  loginUser,
  logoutUser,
} from '../userSystem/userSystemApi'
import { isUserActivated, type UserAccountTab, type UserLoginStatus } from '../userSystem/types'

type Props = {
  open: boolean
  statusOnly?: boolean
  initialStatus?: UserLoginStatus | null
  banNotice?: string | null
  sessionKickedNotice?: string | null
  authVerifyError?: string | null
  onAuthed: (status: UserLoginStatus) => void
  onRetryAuthVerify?: () => void
  onOpenAccount: (tab?: UserAccountTab) => void
}

export function UserSystemAuthModal({
  open,
  statusOnly,
  initialStatus,
  banNotice,
  sessionKickedNotice,
  authVerifyError,
  onAuthed,
  onRetryAuthVerify,
  onOpenAccount,
}: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<UserLoginStatus | null>(initialStatus ?? null)
  const [currentDeviceId, setCurrentDeviceId] = useState('')
  const [currentDeviceType, setCurrentDeviceType] = useState<'mobile' | 'desktop'>('desktop')

  useEffect(() => {
    if (initialStatus) setStatus(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    if (!open) return
    setUsername(getStoredUsername())
    let cancelled = false
    void getDeviceFingerprint().then((fp) => {
      if (cancelled) return
      setCurrentDeviceId(fp.deviceId)
      setCurrentDeviceType(fp.deviceType)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (banNotice || sessionKickedNotice || authVerifyError) setError('')
  }, [banNotice, sessionKickedNotice, authVerifyError])

  const showStatusPanel = statusOnly || (status != null && !isUserActivated(status))

  const handleLogin = useCallback(async () => {
    setError('')
    if (!username.trim() || !password) {
      setError('请填写账号和密码')
      return
    }
    setLoading(true)
    try {
      const fp = await getDeviceFingerprint()
      const ip = await getPublicIp()
      const r = await loginUser(username.trim(), password, {
        publicIp: ip,
        deviceId: fp.deviceId,
        deviceType: fp.deviceType,
      }, { lumiEntry: true })
      if (!r.ok) {
        setError(r.error)
        if (r.banned) clearAuth()
        return
      }
      setStatus(r.status)
      if (isUserActivated(r.status)) onAuthed(r.status)
    } finally {
      setLoading(false)
    }
  }, [username, password, onAuthed])

  const copyDeviceId = useCallback(async () => {
    if (!currentDeviceId) return
    try {
      await navigator.clipboard.writeText(currentDeviceId)
    } catch {
      /* ignore */
    }
  }, [currentDeviceId])

  const storedName = getStoredUsername()

  const handleApplyUnban = useCallback(() => {
    onOpenAccount('unban')
  }, [onOpenAccount])

  const verifyOnly = !!authVerifyError && !!getAuthToken()

  const bannedMessage =
    showStatusPanel && status?.banStatus === 'banned'
      ? `账号已封禁${status.banReason ? `：${status.banReason}` : ''}`
      : !showStatusPanel && (banNotice || (/封禁/.test(error) ? error : ''))
        ? (banNotice || error)
        : null

  const plainError = error && !/封禁/.test(error) ? error : ''

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10001] flex items-center justify-center px-4 py-6 sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="账号登录"
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" />
          <motion.div
            className="relative flex max-h-[min(90vh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] border border-black/10 bg-white text-[#1C1C1E] shadow-[0_24px_60px_rgba(28,28,30,0.2)]"
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="shrink-0 border-b border-black/8 px-5 py-4 sm:px-6">
              <h2 className="text-center text-[18px] font-semibold sm:text-[20px]">账号登录</h2>
              <p className="mt-1 text-center text-[12px] leading-5 text-[#1C1C1E]/55 sm:text-[13px]">
                登录账号密码后即可进入 Lumi
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {authVerifyError && !showStatusPanel ? (
                <div className="mb-3 rounded-[10px] border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2.5">
                  <p className="text-[13px] leading-6 text-[#B45309]">{authVerifyError}</p>
                  {onRetryAuthVerify ? (
                    <button
                      type="button"
                      className="mt-2 h-9 w-full rounded-[10px] bg-[#1C1C1E] text-[13px] font-medium text-white active:opacity-80"
                      onClick={onRetryAuthVerify}
                    >
                      重新验证账号状态
                    </button>
                  ) : null}
                </div>
              ) : null}
              {sessionKickedNotice && !showStatusPanel ? (
                <div className="mb-3 rounded-[10px] border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[13px] leading-6 text-[#B45309]">
                  {sessionKickedNotice}
                </div>
              ) : null}
              {bannedMessage && !showStatusPanel ? (
                <div className="mb-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5">
                  <p className="text-[13px] leading-6 text-[#B91C1C]">{bannedMessage}</p>
                  <button
                    type="button"
                    className="mt-2 h-9 w-full rounded-[10px] bg-[#1C1C1E] text-[13px] font-medium text-white active:opacity-80"
                    onClick={handleApplyUnban}
                  >
                    申请解封
                  </button>
                </div>
              ) : null}
              {plainError ? (
                <div className="mb-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]">
                  {plainError}
                </div>
              ) : null}

              {showStatusPanel && status ? (
                <div className="space-y-4">
                  <div className="rounded-[14px] border border-black/8 bg-[#F9FAFB] p-4 text-center">
                    <p className="text-[14px] font-medium">{storedName || status.username}</p>
                    <p className="mt-2 text-[13px] leading-6 text-[#1C1C1E]/75">
                      {status.auditStatus === 'rejected' &&
                        `审核未通过${status.auditRejectReason ? `：${status.auditRejectReason}` : ''}`}
                      {status.banStatus === 'banned' &&
                        `账号已封禁${status.banReason ? `：${status.banReason}` : ''}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`h-10 w-full rounded-[12px] text-[14px] font-medium active:opacity-80 ${
                      status.banStatus === 'banned'
                        ? 'bg-[#1C1C1E] text-white'
                        : 'bg-[#4F46E5] text-white'
                    }`}
                    onClick={() => onOpenAccount(status.banStatus === 'banned' ? 'unban' : 'overview')}
                  >
                    {status.banStatus === 'banned' ? '申请解封' : '前往账号中心'}
                  </button>
                  <button
                    type="button"
                    className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                    onClick={() => {
                      void logoutUser().finally(() => setStatus(null))
                    }}
                  >
                    切换账号 / 重新登录
                  </button>
                </div>
              ) : verifyOnly ? null : (
                <div className="space-y-3">
                  {currentDeviceId ? (
                    <div className="rounded-[10px] border border-black/8 bg-[#F9FAFB] px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[12px] text-[#1C1C1E]/55">
                            当前设备码
                            <span className="ml-1.5 text-[#1C1C1E]/40">
                              ({currentDeviceType === 'mobile' ? '手机' : '电脑'}浏览器)
                            </span>
                          </p>
                          <p
                            className="mt-1 break-all text-[12px] leading-5 text-[#1C1C1E]/80"
                            style={{ fontFamily: 'var(--phone-num-font, ui-monospace, monospace)' }}
                          >
                            {currentDeviceId}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-black/10 bg-white px-2 py-1 text-[11px] text-[#1C1C1E]/70 active:opacity-80"
                          onClick={() => void copyDeviceId()}
                          aria-label="复制当前设备码"
                        >
                          <Copy className="size-3" />
                          复制
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-4 text-[#1C1C1E]/45">
                        每个浏览器独立生成，用于单浏览器登录限制
                      </p>
                    </div>
                  ) : null}
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#1C1C1E]/55">账号</span>
                    <input
                      className="h-10 w-full rounded-[10px] border border-black/10 bg-[#FAFAFA] px-3 text-[14px] outline-none focus:border-[#4F46E5]"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-[#1C1C1E]/55">密码</span>
                    <input
                      type="password"
                      className="h-10 w-full rounded-[10px] border border-black/10 bg-[#FAFAFA] px-3 text-[14px] outline-none focus:border-[#4F46E5]"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                  <button
                    type="button"
                    className="mt-2 h-11 w-full rounded-[12px] bg-[#1C1C1E] text-[14px] font-medium text-white disabled:opacity-50"
                    disabled={loading}
                    onClick={() => void handleLogin()}
                  >
                    {loading ? '登录中…' : '登录'}
                  </button>
                  <button
                    type="button"
                    className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                    onClick={() => onOpenAccount('auth')}
                  >
                    注册账号
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
