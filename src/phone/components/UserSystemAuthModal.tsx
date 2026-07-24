import { AnimatePresence, motion } from 'framer-motion'
import { Copy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getDeviceFingerprint, getPublicIp } from '../userSystem/deviceFingerprint'
import {
  clearAuth,
  getStoredUsername,
  loginUser,
  logoutUser,
} from '../userSystem/userSystemApi'
import { isUserActivated, needsCommunityRole, type UserAccountTab, type UserLoginStatus } from '../userSystem/types'
import { UserAccountRecoverPanel } from './UserAccountRecoverPanel'
import { AuthDivider, DiscordLoginButton } from './DiscordLoginButton'
import { consumeDiscordOAuthError } from '../userSystem/discordOAuthFlow'
import { OFFICIAL_DISCORD_VERIFY_CHANNEL_URL } from '../userSystem/officialCommunity'
import { markDiscordRegisterFromCommunityTroubleshoot } from '../userSystem/discordRegisterFlags'
import { isDiscordOAuthConfigured } from '../userSystem/discordOAuth'

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

type CommunityGuideStep = 'verify' | 'reregister'

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
  const [authMode, setAuthMode] = useState<'login' | 'recover'>('login')
  const [communityGuideStep, setCommunityGuideStep] = useState<CommunityGuideStep>('verify')

  useEffect(() => {
    if (initialStatus) setStatus(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    if (!open) return
    setAuthMode('login')
    setCommunityGuideStep('verify')
    setUsername(getStoredUsername())
    const oauthError = consumeDiscordOAuthError()
    if (oauthError) setError(oauthError)
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
  const communityBlocked = !!status && needsCommunityRole(status)
  const isServiceIssue =
    communityBlocked &&
    (status!.communityVerifyReason === 'discord_unavailable' ||
      status!.communityVerifyReason === 'bot_unauthorized' ||
      status!.communityVerifyReason === 'bot_forbidden')

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
      setCommunityGuideStep('verify')
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
              <h2 className="text-center text-[18px] font-semibold sm:text-[20px]">
                {authMode === 'recover' ? '找回账号' : '账号登录'}
              </h2>
              <p className="mt-1 text-center text-[12px] leading-5 text-[#1C1C1E]/55 sm:text-[13px]">
                {authMode === 'recover'
                  ? '只需填写 QQ 或 Discord ID 其中一项即可找回'
                  : '登录账号密码后即可进入 Lumi'}
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
                      {status.banStatus === 'banned' &&
                        `账号已封禁${status.banReason ? `：${status.banReason}` : ''}`}
                      {status.banStatus !== 'banned' && communityBlocked &&
                        (status.communityVerifyMessage?.trim()
                          || '社区身份组验证未通过。')}
                      {status.banStatus !== 'banned' &&
                        !communityBlocked &&
                        status.auditStatus === 'correction_required' &&
                        `请更正账号信息${status.auditRejectReason ? `：${status.auditRejectReason}` : ''}`}
                      {status.banStatus !== 'banned' &&
                        !communityBlocked &&
                        status.auditStatus === 'rejected' &&
                        `审核未通过${status.auditRejectReason ? `：${status.auditRejectReason}` : ''}`}
                    </p>
                  </div>

                  {communityBlocked && !isServiceIssue ? (
                    <div className="space-y-3 rounded-[14px] border border-[#DDD6FE] bg-[#F5F3FF] px-3.5 py-3 text-left">
                      {communityGuideStep === 'verify' ? (
                        <>
                          <p className="text-[13px] font-medium text-[#4C1D95]">第一步：排查社区验证</p>
                          <p className="text-[12px] leading-5 text-[#5B21B6]/85">
                            请先确认你已在官方 Discord 验证区完成入门验证，并已获得「Lumi」身份组。
                          </p>
                          <button
                            type="button"
                            className="h-10 w-full rounded-[12px] bg-[#4F46E5] text-[14px] font-medium text-white active:opacity-80"
                            onClick={() =>
                              window.open(OFFICIAL_DISCORD_VERIFY_CHANNEL_URL, '_blank', 'noopener,noreferrer')
                            }
                          >
                            前往 Discord 验证区
                          </button>
                          {onRetryAuthVerify ? (
                            <button
                              type="button"
                              className="h-10 w-full rounded-[12px] border border-[#4F46E5]/30 text-[14px] text-[#4F46E5]"
                              onClick={onRetryAuthVerify}
                            >
                              我已完成验证，重新检测
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="h-10 w-full rounded-[12px] border border-black/10 text-[13px] text-[#1C1C1E]/70"
                            onClick={() => setCommunityGuideStep('reregister')}
                          >
                            验证没问题，仍无法进入 →
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-[13px] font-medium text-[#4C1D95]">第二步：Discord 重新授权注册</p>
                          <p className="text-[12px] leading-5 text-[#5B21B6]/85">
                            这种情况较常见于<strong>最初代账密用户</strong>
                            ：当时尚未接入 Discord 授权，自定义填写的信息可能导致身份组识别失败。
                          </p>
                          <p className="text-[12px] leading-5 text-[#5B21B6]/85">
                            可使用 Discord 重新授权注册新的登录账号。若检测到与旧号重复的 QQ / Discord /
                            用户名，会先提示你确认是否回收旧登录账号。
                            <strong className="font-semibold">本浏览器内的小手机玩法数据不会丢失</strong>
                            ，注册登录后可照常继续使用。
                          </p>
                          {isDiscordOAuthConfigured() ? (
                            <DiscordLoginButton
                              intent="register"
                              lumiEntry
                              label="使用 Discord 重新授权注册"
                              buttonClassName="h-10 w-full rounded-[12px] bg-[#5865F2] text-[14px] font-medium text-white"
                              onClickBefore={() => {
                                markDiscordRegisterFromCommunityTroubleshoot()
                                void logoutUser().finally(() => setStatus(null))
                              }}
                              onError={setError}
                            />
                          ) : (
                            <p className="text-[12px] text-[#B91C1C]">未配置 Discord 授权，请联系管理员。</p>
                          )}
                          <button
                            type="button"
                            className="h-10 w-full rounded-[12px] border border-black/10 text-[13px] text-[#1C1C1E]/70"
                            onClick={() => setCommunityGuideStep('verify')}
                          >
                            ← 返回上一步
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {status.banStatus === 'banned' ? (
                    <button
                      type="button"
                      className="h-10 w-full rounded-[12px] bg-[#1C1C1E] text-[14px] font-medium text-white active:opacity-80"
                      onClick={() => onOpenAccount('unban')}
                    >
                      申请解封
                    </button>
                  ) : null}

                  {isServiceIssue ? (
                    <>
                      <button
                        type="button"
                        className="h-10 w-full rounded-[12px] bg-[#4F46E5] text-[14px] font-medium text-white active:opacity-80"
                        onClick={() => onRetryAuthVerify?.()}
                      >
                        重新验证身份组
                      </button>
                      <button
                        type="button"
                        className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                        onClick={() =>
                          window.open(OFFICIAL_DISCORD_VERIFY_CHANNEL_URL, '_blank', 'noopener,noreferrer')
                        }
                      >
                        前往 Discord 验证区
                      </button>
                    </>
                  ) : null}

                  {!communityBlocked && status.banStatus !== 'banned' ? (
                    <button
                      type="button"
                      className="h-10 w-full rounded-[12px] bg-[#4F46E5] text-[14px] font-medium text-white active:opacity-80"
                      onClick={() => onOpenAccount('overview')}
                    >
                      前往账号中心
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                    onClick={() => {
                      void logoutUser().finally(() => {
                        setStatus(null)
                        setCommunityGuideStep('verify')
                      })
                    }}
                  >
                    切换账号 / 重新登录
                  </button>
                </div>
              ) : authMode === 'recover' ? (
                <UserAccountRecoverPanel
                  inputCls="h-10 w-full rounded-[10px] border border-black/10 bg-[#FAFAFA] px-3 text-[14px] outline-none focus:border-[#4F46E5]"
                  primaryBtnCls="bg-[#1C1C1E] text-white"
                  labelCls="text-[#1C1C1E]/55"
                  onBack={() => setAuthMode('login')}
                  onFillLogin={(name, pwd) => {
                    setUsername(name)
                    setPassword(pwd)
                    setAuthMode('login')
                  }}
                />
              ) : (
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
                  <AuthDivider />
                  <DiscordLoginButton intent="login" lumiEntry disabled={loading} onError={setError} />
                  <button
                    type="button"
                    className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                    onClick={() => onOpenAccount('auth')}
                  >
                    注册账号
                  </button>
                  <button
                    type="button"
                    className="h-10 w-full rounded-[12px] border border-black/10 text-[14px] text-[#1C1C1E]/70"
                    onClick={() => setAuthMode('recover')}
                  >
                    忘记密码
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
