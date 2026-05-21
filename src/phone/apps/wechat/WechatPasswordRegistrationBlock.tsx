import { Eye, EyeOff, Lock } from 'lucide-react'
import { useCallback, useId, useState, type FocusEvent } from 'react'
import { useWechatAsciiFieldInput } from './wechatAsciiFieldInput'
import { isWechatPasswordValid, normalizeWechatPasswordInput, wechatPasswordsMatch } from './wechatProfileTypes'

type FieldProps = {
  labelEn: string
  labelZh: string
  value: string
  onChange: (v: string) => void
  onFocus?: (el: HTMLElement | null) => void
  visible: boolean
  onToggleVisible: () => void
  autoComplete: 'new-password' | 'off'
  inputName: string
  invalid?: boolean
}

function InsetPasswordField({
  labelEn,
  labelZh,
  value,
  onChange,
  onFocus,
  visible,
  onToggleVisible,
  autoComplete,
  inputName,
  invalid,
}: FieldProps) {
  const inputId = useId()
  const field = useWechatAsciiFieldInput({
    value,
    onChange,
    normalize: normalizeWechatPasswordInput,
    maxLen: 32,
    blockInvalidKeys: true,
    useAutofillGuard: false,
  })

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      field.onFocus(e)
      onFocus?.(e.currentTarget)
    },
    [field, onFocus],
  )

  const handleToggleVisible = useCallback(() => {
    onToggleVisible()
    requestAnimationFrame(() => {
      const el = field.inputRef.current
      el?.focus()
      const len = el?.value.length ?? 0
      el?.setSelectionRange(len, len)
    })
  }, [field.inputRef, onToggleVisible])

  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-[9px] font-medium uppercase tracking-[0.24em] text-[#9CA3AF]">
        {labelEn} <span className="text-[#D1D5DB]">|</span>{' '}
        <span className="normal-case tracking-normal">{labelZh}</span>
      </span>
      <div
        className={`relative mt-2 rounded-xl border bg-white transition-colors ${
          invalid ? 'border-[#111827]/25' : 'border-[#E5E7EB] focus-within:border-[#111827]/40'
        }`}
      >
        <input
          ref={field.inputRef}
          id={inputId}
          name={inputName}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={field.onChange}
          onCompositionStart={field.onCompositionStart}
          onCompositionEnd={field.onCompositionEnd}
          onPaste={field.onPaste}
          onKeyDown={field.onKeyDown}
          onPointerDown={field.onPointerDown}
          onFocus={handleFocus}
          onBlur={field.onBlur}
          readOnly={field.autofillGuard}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="latin"
          enterKeyHint="done"
          data-1p-ignore
          data-lpignore="true"
          className="w-full rounded-xl border-0 bg-transparent py-3 pl-3.5 pr-11 font-mono text-[15px] tracking-[0.03em] text-[#111827] outline-none ring-0 placeholder:text-[#D1D5DB]"
          placeholder="••••••"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleVisible}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#9CA3AF] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
          aria-label={visible ? '隐藏密码' : '显示密码'}
        >
          {visible ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
        </button>
      </div>
    </label>
  )
}

type Props = {
  password: string
  confirmPassword: string
  onPasswordChange: (v: string) => void
  onConfirmChange: (v: string) => void
  onFocus?: (el: HTMLElement | null) => void
}

/** 注册页密码区：与昵称/微信号下划线风格区分，采用内嵌卡片式凭证录入 */
export function WechatPasswordRegistrationBlock({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  onFocus,
}: Props) {
  const [show, setShow] = useState({ password: false, confirm: false })

  const passwordOk = isWechatPasswordValid(password)
  const confirmOk = wechatPasswordsMatch(password, confirmPassword)

  const toggle = useCallback((key: 'password' | 'confirm') => {
    setShow((s) => ({ ...s, [key]: !s[key] }))
  }, [])

  const passwordInvalid = password.length > 0 && !passwordOk
  const confirmInvalid = confirmPassword.length > 0 && !confirmOk

  return (
    <section className="rounded-2xl border border-[#E5E7EB]/70 bg-[#F9FAFB] px-4 py-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full border border-[#E5E7EB] bg-white">
          <Lock className="size-3.5 text-[#111827]" strokeWidth={1.35} aria-hidden />
        </span>
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.32em] text-[#9CA3AF]">ACCESS KEY</p>
          <p className="text-[12px] font-medium text-[#111827]">登录凭证</p>
        </div>
      </div>

      <div className="space-y-4">
        <InsetPasswordField
          labelEn="PASSWORD"
          labelZh="登录密码"
          value={password}
          onChange={onPasswordChange}
          onFocus={onFocus}
          visible={show.password}
          onToggleVisible={() => toggle('password')}
          autoComplete="new-password"
          inputName="wx-reg-password-field"
          invalid={passwordInvalid}
        />
        <div className="h-px bg-[#E5E7EB]/80" aria-hidden />
        <InsetPasswordField
          labelEn="CONFIRM"
          labelZh="确认密码"
          value={confirmPassword}
          onChange={onConfirmChange}
          onFocus={onFocus}
          visible={show.confirm}
          onToggleVisible={() => toggle('confirm')}
          autoComplete="new-password"
          inputName="wx-reg-password-confirm-field"
          invalid={confirmInvalid}
        />
      </div>

      {passwordInvalid ? (
        <p className="mt-3 text-[11px] text-[#6B7280]">至少 6 位，仅支持大小写字母与数字</p>
      ) : confirmInvalid ? (
        <p className="mt-3 text-[11px] text-[#6B7280]">两次输入的密码不一致</p>
      ) : passwordOk && confirmOk ? (
        <p className="mt-3 text-[11px] tracking-[0.04em] text-[#9CA3AF]">凭证已对齐</p>
      ) : null}
    </section>
  )
}
