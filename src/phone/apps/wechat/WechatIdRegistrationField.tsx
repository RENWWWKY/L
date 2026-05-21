import { Dices } from 'lucide-react'
import { useCallback, type FocusEvent } from 'react'
import { isWechatIdValid, normalizeWechatIdInput } from './wechatProfileTypes'
import { useWechatAsciiFieldInput } from './wechatAsciiFieldInput'

type Props = {
  value: string
  onChange: (next: string) => void
  onFocus?: (el: HTMLElement | null) => void
  onRandom: () => void
}

/** 注册页微信号：逐字输入，仅拦截非法字符；骰子独立于输入框避免误触 */
export function WechatIdRegistrationField({ value, onChange, onFocus, onRandom }: Props) {
  const field = useWechatAsciiFieldInput({
    value,
    onChange,
    normalize: normalizeWechatIdInput,
    maxLen: 20,
    blockInvalidKeys: true,
  })

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      field.onFocus(e)
      onFocus?.(e.currentTarget)
    },
    [field, onFocus],
  )

  const showHint = value.length > 0 && !isWechatIdValid(value)

  return (
    <label className="block">
      <span className="text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
        WECHAT ID <span className="text-[#D1D5DB]">|</span>{' '}
        <span className="normal-case tracking-normal">微信号</span>
      </span>
      <div className="relative mt-3 border-b border-[#E5E7EB] transition-colors focus-within:border-black">
        <input
          ref={field.inputRef}
          type="text"
          name="wx-reg-id-field"
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
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="latin"
          enterKeyHint="done"
          data-1p-ignore
          data-lpignore="true"
          className="w-full border-0 bg-transparent py-2.5 pr-10 font-mono text-[16px] tracking-[0.03em] text-[#111827] outline-none ring-0 placeholder:text-[#D1D5DB]"
          placeholder="例如 lumi2024"
        />
        <button
          type="button"
          title="随机微信号"
          aria-label="随机微信号"
          onClick={onRandom}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#9CA3AF] transition-colors hover:text-[#111827] active:scale-95"
        >
          <Dices className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      {showHint ? <p className="mt-2 text-[11px] text-[#9CA3AF]">至少 4 位，仅字母与数字</p> : null}
    </label>
  )
}
