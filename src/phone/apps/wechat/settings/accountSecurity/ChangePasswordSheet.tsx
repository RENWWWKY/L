import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, X } from 'lucide-react'
import { useCallback, useId, useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { useWechatAsciiFieldInput } from '../../wechatAsciiFieldInput'
import {
  isWechatPasswordValid,
  normalizeWechatPasswordInput,
  wechatPasswordsMatch,
} from '../../wechatProfileTypes'
import type { UpdateWechatPasswordResult } from '../../useWechatStore'

const SERIF =
  '"Cormorant Garamond", "Noto Serif SC", "STSong", "STKaiti", "Georgia", "Times New Roman", serif'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (params: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => Promise<UpdateWechatPasswordResult>
  onSuccess: () => void
}

function PasswordUnderlineField({
  labelEn,
  labelZh,
  value,
  onChange,
  visible,
  onToggleVisible,
  inputName,
}: {
  labelEn: string
  labelZh: string
  value: string
  onChange: (v: string) => void
  visible: boolean
  onToggleVisible: () => void
  inputName: string
}) {
  const inputId = useId()
  const field = useWechatAsciiFieldInput({
    value,
    onChange,
    normalize: normalizeWechatPasswordInput,
    maxLen: 32,
    blockInvalidKeys: true,
    useAutofillGuard: false,
  })

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
      <span className="text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
        {labelEn} <span className="text-[#D1D5DB]">|</span>{' '}
        <span className="normal-case tracking-normal">{labelZh}</span>
      </span>
      <div className="relative mt-3">
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
          onFocus={field.onFocus}
          onBlur={field.onBlur}
          readOnly={field.autofillGuard}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="latin"
          enterKeyHint="done"
          data-1p-ignore
          data-lpignore="true"
          className="w-full border-0 border-b border-[#E5E7EB] bg-transparent py-2.5 pr-10 font-mono text-[15px] tracking-[0.03em] text-[#111827] outline-none ring-0 transition-colors focus:border-black"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleVisible}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] transition-colors hover:text-[#111827]"
          aria-label={visible ? '隐藏密码' : '显示密码'}
        >
          {visible ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
        </button>
      </div>
    </label>
  )
}

export function ChangePasswordSheet({ open, onClose, onSubmit, onSuccess }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setShow({ current: false, next: false, confirm: false })
    setError(null)
    setLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    if (loading) return
    reset()
    onClose()
  }, [loading, onClose, reset])

  const canSubmit =
    current.length > 0 &&
    isWechatPasswordValid(next) &&
    wechatPasswordsMatch(next, confirm) &&
    !loading

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    const res = await onSubmit({
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    })
    setLoading(false)
    if (!res.ok) {
      if (res.reason === 'wrong-current') setError('当前密码不正确')
      else if (res.reason === 'invalid-new') setError('新密码至少 6 位，仅支持大小写字母与数字')
      else if (res.reason === 'mismatch') setError('两次新密码输入不一致')
      else setError('无法更新，请稍后重试')
      return
    }
    reset()
    onSuccess()
    onClose()
  }, [canSubmit, confirm, current, next, onClose, onSubmit, onSuccess, reset])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[340] bg-black/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            className="fixed inset-x-0 bottom-0 z-[350] max-h-[min(88vh,640px)] overflow-hidden rounded-t-[22px] border-t border-[#E5E7EB]/80 bg-white/90 shadow-[0_-24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          >
            <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
              <div>
                <p
                  id="change-password-title"
                  className="text-[9px] font-medium uppercase tracking-[0.36em] text-[#9CA3AF]"
                >
                  Update Key
                </p>
                <p className="mt-1 text-[17px] font-medium text-[#111827]" style={{ fontFamily: SERIF }}>
                  修改密码
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-[#9CA3AF] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
              >
                <X className="size-5" strokeWidth={1.5} />
              </button>
            </div>

            <motion.div className="overflow-y-auto px-5 py-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="space-y-8">
                <PasswordUnderlineField
                  labelEn="CURRENT"
                  labelZh="旧密码"
                  value={current}
                  onChange={setCurrent}
                  visible={show.current}
                  onToggleVisible={() => setShow((s) => ({ ...s, current: !s.current }))}
                  inputName="wx-change-password-current"
                />
                <PasswordUnderlineField
                  labelEn="NEW"
                  labelZh="新密码"
                  value={next}
                  onChange={setNext}
                  visible={show.next}
                  onToggleVisible={() => setShow((s) => ({ ...s, next: !s.next }))}
                  inputName="wx-change-password-new"
                />
                <PasswordUnderlineField
                  labelEn="CONFIRM"
                  labelZh="确认新密码"
                  value={confirm}
                  onChange={setConfirm}
                  visible={show.confirm}
                  onToggleVisible={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                  inputName="wx-change-password-confirm"
                />
              </div>
              {error ? <p className="mt-4 text-[11px] text-[#6B7280]">{error}</p> : null}

              <Pressable
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                className={`mt-8 flex w-full items-center justify-center rounded-full py-4 text-[14px] font-medium tracking-[0.08em] transition-all ${
                  canSubmit ? 'bg-[#111827] text-white' : 'cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]'
                }`}
              >
                {loading ? (
                  <span className="size-4 animate-spin rounded-full border border-white/30 border-t-white" />
                ) : (
                  '更新密钥 (Update Key)'
                )}
              </Pressable>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
