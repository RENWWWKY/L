import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, QrCode, RefreshCw, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { isLocalNcmMode, isPhoneLoginSupported } from './neteaseApiClient'
import { useNeteasePhoneLogin } from './useNeteasePhoneLogin'
import { useNeteaseQrLogin } from './useNeteaseQrLogin'

type LoginMode = 'qr' | 'phone'

type NeteaseQrLoginModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function NeteaseQrLoginModal({
  open,
  onClose,
  onSuccess,
}: NeteaseQrLoginModalProps) {
  const [mode, setMode] = useState<LoginMode>('qr')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [useCaptchaLogin, setUseCaptchaLogin] = useState(false)

  const qrActive = open && mode === 'qr'
  const { phase, qr, error, refresh, statusText } = useNeteaseQrLogin(qrActive)
  const {
    phase: phonePhase,
    error: phoneError,
    captchaSent,
    reset: resetPhoneLogin,
    sendCaptcha,
    login: loginByPhone,
    busy: phoneBusy,
  } = useNeteasePhoneLogin()

  const phoneSupported = isPhoneLoginSupported()

  useEffect(() => {
    if (!open) {
      setMode('qr')
      setPhone('')
      setPassword('')
      setCaptcha('')
      setUseCaptchaLogin(false)
      resetPhoneLogin()
    }
  }, [open, resetPhoneLogin])

  useEffect(() => {
    if (phase === 'success' || phonePhase === 'success') onSuccess?.()
  }, [phase, phonePhase, onSuccess])

  const qrSrc =
    qr?.qrimg ||
    (qr?.qrurl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qr.qrurl)}`
      : null)

  const handlePhoneLogin = () => {
    void loginByPhone({
      phone,
      password: useCaptchaLogin ? undefined : password,
      captcha: useCaptchaLogin ? captcha : undefined,
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-stone-900/40 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-labelledby="netease-login-title"
            className="w-full max-w-[360px] rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(120,113,108,0.2)]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="netease-login-title" className="text-[17px] font-medium text-stone-800">
                  连接网易云音乐
                </h2>
                <p className="mt-1 text-[12px] text-stone-400">
                  {mode === 'qr' ? statusText : '使用网易账号登录后同步歌单与资料'}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-4 flex rounded-full bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setMode('qr')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition-colors ${
                  mode === 'qr' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
                }`}
              >
                <QrCode className="size-3.5" strokeWidth={1.75} />
                扫码登录
              </button>
              <button
                type="button"
                onClick={() => setMode('phone')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition-colors ${
                  mode === 'phone' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
                }`}
              >
                <Smartphone className="size-3.5" strokeWidth={1.75} />
                手机号
              </button>
            </div>

            {mode === 'qr' ? (
              <div className="flex flex-col items-center">
                <div className="relative flex h-[220px] w-[220px] items-center justify-center rounded-2xl bg-stone-50 ring-1 ring-stone-100">
                  {phase === 'loading' ? (
                    <Loader2 className="size-8 animate-spin text-rose-300" />
                  ) : phase === 'error' ? (
                    <div className="px-4 text-center">
                      <p className="text-[13px] leading-relaxed text-stone-600">{error}</p>
                    </div>
                  ) : qrSrc ? (
                    <img
                      src={qrSrc}
                      alt="网易云登录二维码"
                      className="h-[200px] w-[200px] rounded-xl object-contain"
                    />
                  ) : (
                    <p className="px-4 text-center text-[12px] text-stone-400">
                      {error ?? '无法显示二维码'}
                    </p>
                  )}
                  {phase === 'scanned' ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[2px]">
                      <p className="text-[13px] font-medium text-rose-400">请在 App 内确认</p>
                    </div>
                  ) : null}
                </div>

                {(phase === 'expired' || phase === 'error') && (
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-4 py-2 text-[13px] text-rose-500"
                  >
                    <RefreshCw className="size-3.5" />
                    刷新二维码
                  </button>
                )}

                {phase === 'success' ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 w-full rounded-full bg-stone-800 py-2.5 text-[14px] text-white"
                  >
                    完成
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {!phoneSupported ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                    手机号登录需配置{' '}
                    <span className="font-medium">VITE_NETEASE_API_MODE=ncm</span> 并指向
                    NeteaseCloudMusicApi；若走 Worker，请在 Cloudflare 配置{' '}
                    <span className="font-medium">NETEASE_UPSTREAM</span>。
                  </p>
                ) : null}

                <label className="block">
                  <span className="mb-1 block text-[12px] text-stone-500">手机号</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="11 位手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[14px] text-stone-800 outline-none ring-rose-200 focus:border-rose-300 focus:ring-2"
                  />
                </label>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-stone-500">登录方式</span>
                  <div className="flex rounded-lg bg-stone-100 p-0.5 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setUseCaptchaLogin(false)}
                      className={`rounded-md px-2.5 py-1 ${
                        !useCaptchaLogin ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
                      }`}
                    >
                      密码
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseCaptchaLogin(true)}
                      className={`rounded-md px-2.5 py-1 ${
                        useCaptchaLogin ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
                      }`}
                    >
                      验证码
                    </button>
                  </div>
                </div>

                {useCaptchaLogin ? (
                  <div className="flex gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-[12px] text-stone-500">短信验证码</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6 位验证码"
                        value={captcha}
                        onChange={(e) => setCaptcha(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[14px] text-stone-800 outline-none ring-rose-200 focus:border-rose-300 focus:ring-2"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={phoneBusy || phone.length < 11}
                      onClick={() => void sendCaptcha(phone)}
                      className="mt-[22px] shrink-0 rounded-xl bg-stone-100 px-3 py-2.5 text-[12px] text-stone-700 disabled:opacity-50"
                    >
                      {phonePhase === 'sending'
                        ? '发送中…'
                        : captchaSent
                          ? '重新发送'
                          : '获取验证码'}
                    </button>
                  </div>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-[12px] text-stone-500">密码</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="网易云账号密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-[14px] text-stone-800 outline-none ring-rose-200 focus:border-rose-300 focus:ring-2"
                    />
                  </label>
                )}

                {phoneError ? (
                  <p className="text-[12px] leading-relaxed text-rose-500">{phoneError}</p>
                ) : null}

                {captchaSent && useCaptchaLogin ? (
                  <p className="text-[11px] text-stone-400">验证码已发送，请查收短信</p>
                ) : null}

                {!isLocalNcmMode() && phoneSupported ? (
                  <p className="text-[11px] leading-relaxed text-stone-400">
                    当前经 Worker 转发登录请求，请确保已配置国内 API 上游。
                  </p>
                ) : null}

                {phonePhase === 'success' ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-full bg-stone-800 py-2.5 text-[14px] text-white"
                  >
                    完成
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      phoneBusy ||
                      !phoneSupported ||
                      phone.length < 11 ||
                      (useCaptchaLogin ? captcha.length < 4 : password.length < 1)
                    }
                    onClick={handlePhoneLogin}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-500 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
                  >
                    {phonePhase === 'logging' ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        登录中…
                      </>
                    ) : (
                      '登录'
                    )}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
