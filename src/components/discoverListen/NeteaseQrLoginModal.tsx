import { Loader2, Smartphone, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { isLocalNcmMode, isPhoneLoginSupported } from './neteaseApiClient'
import { useNeteasePhoneLogin } from './useNeteasePhoneLogin'

type NeteaseQrLoginModalProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  onGuestEnter?: () => void
  isGuestMode?: boolean
}

export function NeteaseQrLoginModal({
  open,
  onClose,
  onSuccess,
  onGuestEnter,
  isGuestMode = false,
}: NeteaseQrLoginModalProps) {
  const [phone, setPhone] = useState('')
  const [captcha, setCaptcha] = useState('')

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
      setPhone('')
      setCaptcha('')
      resetPhoneLogin()
    }
  }, [open, resetPhoneLogin])

  useEffect(() => {
    if (phonePhase === 'success') onSuccess?.()
  }, [phonePhase, onSuccess])

  const handlePhoneLogin = () => {
    void loginByPhone({ phone, captcha })
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
                  使用手机号与短信验证码登录，同步歌单与资料
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

            <div className="space-y-3">
              {!phoneSupported ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                  手机号登录需配置{' '}
                  <span className="font-medium">VITE_NETEASE_API_MODE=ncm</span> 并指向
                  NeteaseCloudMusicApi。
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

              {phoneError ? (
                <p className="text-[12px] leading-relaxed text-rose-500">{phoneError}</p>
              ) : null}

              {captchaSent ? (
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
                    phoneBusy || !phoneSupported || phone.length < 11 || captcha.length < 4
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
                    <>
                      <Smartphone className="size-4" strokeWidth={1.75} />
                      登录
                    </>
                  )}
                </button>
              )}
            </div>

            {!isGuestMode && onGuestEnter ? (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={onGuestEnter}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-stone-50 py-2.5 text-[14px] font-medium text-stone-700 transition-colors hover:bg-stone-100"
                >
                  <UserRound className="size-4" strokeWidth={1.75} />
                  游客进入
                </button>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-400">
                  无需网易账号，可搜索、播放公开歌曲与歌单；个人歌单与红心需登录后同步
                </p>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
