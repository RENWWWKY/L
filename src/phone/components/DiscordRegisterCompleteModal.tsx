import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { getDeviceFingerprint, getPublicIp } from '../userSystem/deviceFingerprint'
import { registerWithDiscord } from '../userSystem/userSystemApi'
import { AccountNumericText, accountNumStyle } from '../userSystem/AccountNum'

const accountInputNumStyle = {
  fontFamily: accountNumStyle.fontFamily,
  fontVariantNumeric: accountNumStyle.fontVariantNumeric,
} as const

export type DiscordRegisterPending = {
  registerToken: string
  discordId: string
  discordHandle?: string
  discordDisplayName?: string
  discordUsername: string
  fromUnregisteredLogin?: boolean
}

type Props = {
  open: boolean
  pending: DiscordRegisterPending | null
  themeTokens: {
    card: string
    label: string
    muted: string
    input: string
    primaryBtn: string
    errorBox: string
    infoBox?: string
  }
  onClose: () => void
  onSuccess: (credentials: { username: string; password: string }) => void
}

export function DiscordRegisterCompleteModal({
  open,
  pending,
  themeTokens: t,
  onClose,
  onSuccess,
}: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [qq, setQq] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!pending) return
    setError('')
    if (!username.trim() || !password) {
      setError('请填写账号与密码')
      return
    }
    if (password !== password2) {
      setError('两次密码不一致')
      return
    }
    setSubmitting(true)
    try {
      const fp = await getDeviceFingerprint()
      const ip = await getPublicIp()
      const r = await registerWithDiscord({
        registerToken: pending.registerToken,
        username: username.trim(),
        password,
        qq: qq.trim(),
        publicIp: ip,
        deviceId: fp.deviceId,
        deviceType: fp.deviceType,
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      onSuccess({ username: username.trim(), password })
    } finally {
      setSubmitting(false)
    }
  }, [pending, username, password, password2, qq, onSuccess])

  const inputCls = `h-10 w-full rounded-[10px] border px-3 text-[14px] outline-none focus:border-[#4F46E5] ${t.input}`

  return (
    <AnimatePresence>
      {open && pending ? (
        <motion.div
          className="fixed inset-0 z-[10002] flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            className={`relative w-full max-w-md rounded-[18px] border p-5 shadow-xl ${t.card}`}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="完善注册信息"
          >
            <h3 className="text-[17px] font-semibold">
              {pending.fromUnregisteredLogin ? 'Discord 账号尚未注册' : 'Discord 授权成功'}
            </h3>
            {pending.fromUnregisteredLogin ? (
              <p className={`mt-2 rounded-[10px] border px-3 py-2.5 text-[13px] leading-6 ${t.infoBox ?? t.muted}`}>
                当前 Discord 账号尚未注册 Lumi，已自动为你打开注册信息填写面板。请设置账号与密码完成注册。
              </p>
            ) : (
              <p className={`mt-2 text-[13px] leading-6 ${t.muted}`}>
                请设置 Lumi 账号与密码。QQ 号可选填，但将作为找回账密的重要信息，建议填写。
              </p>
            )}

            <div className={`mt-3 rounded-[12px] border px-3 py-2.5 text-[13px] ${t.input}`}>
              <p className={`text-[12px] ${t.label}`}>Discord 用户名</p>
              <p className="mt-0.5 font-medium">
                {pending.discordHandle || pending.discordUsername || '—'}
              </p>
              {pending.discordDisplayName &&
              pending.discordHandle &&
              pending.discordDisplayName !== pending.discordHandle ? (
                <>
                  <p className={`mt-2 text-[12px] ${t.label}`}>Discord 显示昵称</p>
                  <p className="mt-0.5 font-medium">{pending.discordDisplayName}</p>
                </>
              ) : null}
              <p className={`mt-2 text-[12px] ${t.label}`}>Discord 数字 ID</p>
              <p className="mt-0.5 break-all font-medium">
                <AccountNumericText text={pending.discordId} className="text-[13px]" />
              </p>
            </div>

            {error ? (
              <div className={`mt-3 rounded-[10px] border px-3 py-2 text-[13px] ${t.errorBox}`}>{error}</div>
            ) : null}

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={`mb-1 block text-[12px] ${t.label}`}>账号</span>
                <input
                  className={inputCls}
                  style={accountInputNumStyle}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className={`mb-1 block text-[12px] ${t.label}`}>密码</span>
                <input
                  type="password"
                  className={inputCls}
                  style={accountInputNumStyle}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className={`mb-1 block text-[12px] ${t.label}`}>确认密码</span>
                <input
                  type="password"
                  className={inputCls}
                  style={accountInputNumStyle}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className={`mb-1 block text-[12px] ${t.label}`}>QQ（选填）</span>
                <input
                  className={inputCls}
                  style={accountInputNumStyle}
                  inputMode="numeric"
                  value={qq}
                  onChange={(e) => setQq(e.target.value)}
                  placeholder="建议填写，便于找回账密"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className={`h-11 flex-1 rounded-[12px] border text-[14px] ${t.input}`}
                disabled={submitting}
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                className={`h-11 flex-1 rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? '注册中…' : '完成注册'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export const DISCORD_REGISTER_PENDING_KEY = 'us_discord_register_pending'

function parseDiscordRegisterPending(raw: string): DiscordRegisterPending | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DiscordRegisterPending>
    if (!parsed.registerToken?.trim() || !parsed.discordId?.trim()) return null
    return {
      registerToken: parsed.registerToken.trim(),
      discordId: parsed.discordId.trim(),
      discordHandle: parsed.discordHandle?.trim() || '',
      discordDisplayName: parsed.discordDisplayName?.trim() || parsed.discordUsername?.trim() || '',
      discordUsername: parsed.discordUsername?.trim() || parsed.discordDisplayName?.trim() || '',
      fromUnregisteredLogin: parsed.fromUnregisteredLogin === true,
    }
  } catch {
    return null
  }
}

export function storeDiscordRegisterPending(payload: DiscordRegisterPending): void {
  const raw = JSON.stringify(payload)
  try {
    sessionStorage.setItem(DISCORD_REGISTER_PENDING_KEY, raw)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(DISCORD_REGISTER_PENDING_KEY, raw)
  } catch {
    /* ignore */
  }
}

export function readDiscordRegisterPending(): DiscordRegisterPending | null {
  for (const store of [sessionStorage, localStorage] as const) {
    try {
      const raw = store.getItem(DISCORD_REGISTER_PENDING_KEY)
      if (!raw) continue
      const parsed = parseDiscordRegisterPending(raw)
      if (parsed) return parsed
    } catch {
      /* ignore */
    }
  }
  return null
}

export function clearDiscordRegisterPending(): void {
  for (const store of [sessionStorage, localStorage] as const) {
    try {
      store.removeItem(DISCORD_REGISTER_PENDING_KEY)
    } catch {
      /* ignore */
    }
  }
}
