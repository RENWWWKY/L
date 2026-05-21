import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Plus } from 'lucide-react'
import {
  ContactProfileFemaleGenderIcon,
  ContactProfileMaleGenderIcon,
} from './ContactProfileGenderIcons'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { compressAvatarDataUrl, MAX_AVATAR_DATA_URL_LEN } from './avatarCompress'
import {
  getDefaultWechatRegistrationAvatar,
  isPlausibleAvatarUrl,
  normalizeAvatarUrlInput,
} from './wechatDefaultAvatars'
import { pickRandomWechatNickname } from './wechatNicknameRandomPool'
import { pickRandomWechatId } from './wechatIdRandomPool'
const formCollapseExit = {
  opacity: 0,
  y: 20,
  transition: { type: 'spring' as const, damping: 32, stiffness: 88, mass: 1.05 },
}
import { WechatIdRegistrationField } from './WechatIdRegistrationField'
import { WechatNicknameRegistrationField } from './WechatNicknameRegistrationField'
import { WechatPasswordRegistrationBlock } from './WechatPasswordRegistrationBlock'
import { useWechatStore } from './useWechatStore'
import {
  isWechatIdValid,
  isWechatPasswordValid,
  isWechatProfileComplete,
  normalizeWechatPasswordInput,
  wechatPasswordsMatch,
  type WechatProfile,
} from './wechatProfileTypes'

const stagger = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

type GenderOption = NonNullable<WechatProfile['gender']>

const GENDER_OPTIONS: { value: GenderOption; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'hidden', label: '隐藏' },
]

function RegistrationGenderIcon({
  value,
  active,
}: {
  value: GenderOption
  active: boolean
}) {
  const className = active ? 'shrink-0 text-white' : 'shrink-0 text-[#111827]'
  if (value === 'male') return <ContactProfileMaleGenderIcon size={18} className={className} />
  if (value === 'female') return <ContactProfileFemaleGenderIcon size={18} className={className} />
  return <EyeOff size={18} strokeWidth={1.7} className={className} aria-hidden />
}

type Props = {
  onBack?: () => void
  /** 从切换账号页添加新马甲 */
  mode?: 'initial' | 'add-account'
  onAccountAdded?: () => void
}

/** 表单收束后写入档案，交由 AuthGuard 播放欢迎无缝转场 */
const SUBMIT_COLLAPSE_MS = 520 as const

export function WeChatRegistration({ onBack, mode = 'initial', onAccountAdded }: Props) {
  const { completeRegistration, addAccountFromRegistration } = useWechatStore()
  const fileInputId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const submitTimerRef = useRef<number | null>(null)

  const [avatarUrl, setAvatarUrl] = useState(getDefaultWechatRegistrationAvatar)
  const [avatarUrlDraft, setAvatarUrlDraft] = useState('')
  const [avatarUrlError, setAvatarUrlError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [wechatId, setWechatId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [gender, setGender] = useState<GenderOption | undefined>(undefined)
  const [signature, setSignature] = useState('')
  const [showForm, setShowForm] = useState(true)
  const [buttonCollapsed, setButtonCollapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const passwordOk = isWechatPasswordValid(password)
  const confirmOk = wechatPasswordsMatch(password, confirmPassword)

  const canSubmit =
    nickname.trim().length > 0 &&
    isWechatIdValid(wechatId) &&
    passwordOk &&
    confirmOk &&
    !submitting &&
    showForm

  useEffect(() => {
    return () => {
      if (submitTimerRef.current != null) window.clearTimeout(submitTimerRef.current)
    }
  }, [])

  const scrollFieldIntoView = useCallback((el: HTMLElement | null) => {
    if (!el) return
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [])

  const onPickFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      void (async () => {
        try {
          const next = await compressAvatarDataUrl(src, MAX_AVATAR_DATA_URL_LEN)
          setAvatarUrl(next)
        } catch {
          setAvatarUrl(src)
        }
      })()
    }
    reader.readAsDataURL(file)
  }, [])

  const onRandomNickname = useCallback(() => {
    setNickname(pickRandomWechatNickname())
  }, [])

  const onRandomWechatId = useCallback(() => {
    setWechatId(pickRandomWechatId())
  }, [])

  const applyAvatarUrl = useCallback(() => {
    const next = normalizeAvatarUrlInput(avatarUrlDraft)
    if (!next) {
      setAvatarUrlError(null)
      return
    }
    if (!isPlausibleAvatarUrl(next)) {
      setAvatarUrlError('请输入有效的图片 URL（http/https）或 data:image')
      return
    }
    setAvatarUrlError(null)
    setAvatarUrl(next)
  }, [avatarUrlDraft])

  const handleCreate = useCallback(() => {
    if (!canSubmit) return
    setSubmitting(true)
    const resolvedAvatar = avatarUrl.trim() || getDefaultWechatRegistrationAvatar()
    const draft: WechatProfile = {
      avatarUrl: resolvedAvatar,
      nickname: nickname.trim(),
      wechatId: wechatId.trim(),
      password: normalizeWechatPasswordInput(password),
      gender,
      signature: signature.trim() || undefined,
    }
    if (!isWechatProfileComplete(draft)) {
      setSubmitting(false)
      return
    }

    setButtonCollapsed(true)
    setShowForm(false)

    if (submitTimerRef.current != null) window.clearTimeout(submitTimerRef.current)
    submitTimerRef.current = window.setTimeout(() => {
      submitTimerRef.current = null
      const done =
        mode === 'add-account'
          ? addAccountFromRegistration(draft).then(() => onAccountAdded?.())
          : completeRegistration(draft)
      void done.finally(() => setSubmitting(false))
    }, SUBMIT_COLLAPSE_MS)
  }, [
    addAccountFromRegistration,
    avatarUrl,
    canSubmit,
    completeRegistration,
    gender,
    mode,
    nickname,
    onAccountAdded,
    password,
    signature,
    wechatId,
  ])

  return (
    <motion.div
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white text-[#111827]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 1 }}
            exit={formCollapseExit}
          >
            <motion.div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-36 pt-[max(5rem,env(safe-area-inset-top,0px))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <motion.header
                className="text-center"
                custom={0}
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-[#9CA3AF]">
                  INITIALIZE PROFILE
                </p>
                <h1 className="mt-4 text-[22px] font-medium tracking-[0.04em] text-[#111827]">
                  {mode === 'add-account' ? '铸造新的马甲' : '创建你的微信身份'}
                </h1>
              </motion.header>

              <motion.div
                className="mt-14 flex flex-col items-center"
                custom={1}
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById(fileInputId)?.click()}
                  className="group relative flex size-24 items-center justify-center overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F9FAFB] transition-colors hover:border-[#D1D5DB]"
                  aria-label="本地上传头像"
                >
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                    <Plus className="size-5 stroke-[1.5] text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                </button>
                <p className="mt-3 text-center text-[10px] tracking-[0.02em] text-[#9CA3AF]">
                  Tap to upload (点击本地上传)
                </p>

                <div className="mt-6 w-full max-w-xs space-y-2">
                  <p className="text-center text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
                    AVATAR URL <span className="text-[#D1D5DB]">|</span>{' '}
                    <span className="normal-case tracking-normal">头像链接</span>
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={avatarUrlDraft}
                      onChange={(e) => {
                        setAvatarUrlDraft(e.target.value)
                        if (avatarUrlError) setAvatarUrlError(null)
                      }}
                      onBlur={applyAvatarUrl}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyAvatarUrl()
                        }
                      }}
                      placeholder="https://..."
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="min-w-0 flex-1 border-0 border-b border-[#E5E7EB] bg-transparent px-0 py-2 text-[13px] text-[#111827] outline-none ring-0 transition-colors placeholder:text-[#D1D5DB] focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={applyAvatarUrl}
                      className="shrink-0 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[11px] text-[#111827] transition-colors hover:border-[#111827]"
                    >
                      应用
                    </button>
                  </div>
                  {avatarUrlError ? (
                    <p className="text-center text-[11px] text-[#6B7280]">{avatarUrlError}</p>
                  ) : (
                    <p className="text-center text-[10px] text-[#9CA3AF]">
                      支持 http(s) 图片链接；留空则使用默认头像
                    </p>
                  )}
                </div>

                <div className="mt-8 w-full max-w-md space-y-8">
                  <motion.div custom={0} variants={stagger} initial="hidden" animate="show">
                    <p className="text-center text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
                      GENDER <span className="text-[#D1D5DB]">|</span>{' '}
                      <span className="normal-case tracking-normal text-[#9CA3AF]">性别</span>
                    </p>
                    <div className="mt-4 flex justify-center gap-3">
                      {GENDER_OPTIONS.map((opt) => {
                        const active = gender === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-label={opt.label}
                            title={opt.label}
                            onClick={() => setGender(active ? undefined : opt.value)}
                            className={`flex size-11 items-center justify-center rounded-full transition-all duration-200 ${
                              active
                                ? 'bg-[#111827] text-white'
                                : 'border border-[#E5E7EB] bg-white text-[#111827]'
                            }`}
                          >
                            <RegistrationGenderIcon value={opt.value} active={active} />
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                  <UnderlineTextarea
                    labelEn="SIGNATURE"
                    labelZh="个性签名"
                    value={signature}
                    onChange={setSignature}
                    onFocus={scrollFieldIntoView}
                    placeholder="Write something about yourself..."
                    maxLength={120}
                  />
                </div>
              </motion.div>

              <motion.div
                className="mx-auto mt-12 max-w-md space-y-8"
                custom={2}
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                <p className="text-[9px] font-medium uppercase tracking-[0.32em] text-[#9CA3AF]">
                  REQUIRED
                </p>
                <WechatNicknameRegistrationField
                  value={nickname}
                  onChange={setNickname}
                  onFocus={scrollFieldIntoView}
                  onRandom={onRandomNickname}
                />
                <WechatIdRegistrationField
                  value={wechatId}
                  onChange={setWechatId}
                  onFocus={scrollFieldIntoView}
                  onRandom={onRandomWechatId}
                />
                <WechatPasswordRegistrationBlock
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={setPassword}
                  onConfirmChange={setConfirmPassword}
                  onFocus={scrollFieldIntoView}
                />
              </motion.div>
            </motion.div>

            <motion.div
              className="shrink-0 border-t border-[#F3F4F6] bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-4"
              custom={3}
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="mb-3 w-full text-center text-[12px] text-[#9CA3AF] transition-colors hover:text-[#111827]"
                >
                  返回桌面
                </button>
              ) : null}
              <motion.button
                type="button"
                disabled={!canSubmit}
                onClick={handleCreate}
                layout
                className={`relative mx-auto flex items-center justify-center overflow-hidden transition-colors duration-300 ${
                  buttonCollapsed
                    ? 'size-3 rounded-full bg-[#111827]'
                    : `w-full rounded-full py-4 text-[15px] font-medium tracking-[0.06em] ${
                        canSubmit
                          ? 'bg-black text-white hover:scale-[1.02] active:scale-[0.99]'
                          : 'cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]'
                      }`
                }`}
                animate={
                  buttonCollapsed
                    ? { width: 12, height: 12, borderRadius: 9999 }
                    : { width: '100%', height: 'auto', borderRadius: 9999 }
                }
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                whileTap={canSubmit && !buttonCollapsed ? { scale: 0.98 } : undefined}
              >
                <motion.span
                  animate={{ opacity: buttonCollapsed ? 0 : 1 }}
                  transition={{ duration: 0.12 }}
                  className={buttonCollapsed ? 'sr-only' : ''}
                >
                  确认创建 (Create Identity)
                </motion.span>
              </motion.button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {buttonCollapsed ? (
          <motion.div
            key="submit-dot"
            className="pointer-events-none absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 z-[55] size-3 -translate-x-1/2 rounded-full bg-[#111827]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
          />
        ) : null}
      </AnimatePresence>

    </motion.div>
  )
}

export function UnderlineField({
  labelEn,
  labelZh,
  value,
  onChange,
  onFocus,
  hint,
  maxLength,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  trailing,
  type = 'text',
}: {
  labelEn: string
  labelZh: string
  value: string
  onChange: (v: string) => void
  onFocus?: (el: HTMLElement | null) => void
  hint?: string
  maxLength?: number
  autoComplete?: string
  autoCapitalize?: string
  autoCorrect?: string
  spellCheck?: boolean
  trailing?: ReactNode
  type?: 'text' | 'password'
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
        {labelEn} <span className="text-[#D1D5DB]">|</span>{' '}
        <span className="normal-case tracking-normal">{labelZh}</span>
      </span>
      <motion.div className="relative mt-3">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => onFocus?.(e.currentTarget)}
          maxLength={maxLength}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
          className={`w-full border-0 border-b border-[#E5E7EB] bg-transparent py-2.5 text-[16px] text-[#111827] outline-none ring-0 transition-colors placeholder:text-[#D1D5DB] focus:border-black focus:outline-none focus:ring-0 ${
            trailing ? 'pr-11 pl-0 font-mono tracking-[0.03em]' : 'px-0'
          } ${type === 'password' ? 'font-mono tracking-[0.06em]' : ''}`}
        />
        {trailing ? <div className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </motion.div>
      {hint ? <p className="mt-2 text-[11px] text-[#9CA3AF]">{hint}</p> : null}
    </label>
  )
}

function UnderlineTextarea({
  labelEn,
  labelZh,
  value,
  onChange,
  onFocus,
  placeholder,
  maxLength,
}: {
  labelEn: string
  labelZh: string
  value: string
  onChange: (v: string) => void
  onFocus?: (el: HTMLElement | null) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
        {labelEn} <span className="text-[#D1D5DB]">|</span>{' '}
        <span className="normal-case tracking-normal">{labelZh}</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => onFocus?.(e.currentTarget)}
        rows={2}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-3 w-full resize-none border-0 border-b border-[#E5E7EB] bg-transparent px-0 py-2.5 text-[15px] italic text-[#111827] outline-none ring-0 transition-colors placeholder:text-[#D1D5DB] focus:border-black focus:outline-none focus:ring-0"
        style={{ fieldSizing: 'content' } as CSSProperties}
      />
    </label>
  )
}
