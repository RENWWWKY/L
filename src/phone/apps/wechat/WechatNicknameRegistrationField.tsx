import { Dices } from 'lucide-react'
import { useCallback, type ChangeEvent, type FocusEvent } from 'react'

const MAX_LEN = 32

function normalizeNicknameInput(raw: string): string {
  return String(raw ?? '').slice(0, MAX_LEN)
}

type Props = {
  value: string
  onChange: (next: string) => void
  onFocus?: (el: HTMLElement | null) => void
  onRandom: () => void
}

/** 注册页微信昵称：支持手填；输入框右侧骰子随机 */
export function WechatNicknameRegistrationField({ value, onChange, onFocus, onRandom }: Props) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(normalizeNicknameInput(e.target.value))
    },
    [onChange],
  )

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      onFocus?.(e.currentTarget)
    },
    [onFocus],
  )

  return (
    <label className="block">
      <span className="text-[9px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
        NICKNAME <span className="text-[#D1D5DB]">|</span>{' '}
        <span className="normal-case tracking-normal">微信昵称</span>
      </span>
      <div className="relative mt-3 border-b border-[#E5E7EB] transition-colors focus-within:border-black">
        <input
          type="text"
          name="wx-reg-nickname-field"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          autoComplete="nickname"
          maxLength={MAX_LEN}
          className="w-full border-0 bg-transparent py-2.5 pr-10 text-[16px] text-[#111827] outline-none ring-0 placeholder:text-[#D1D5DB]"
          placeholder="你的昵称"
        />
        <button
          type="button"
          title="随机昵称"
          aria-label="随机昵称"
          onClick={onRandom}
          className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#9CA3AF] transition-colors hover:text-[#111827] active:scale-95"
        >
          <Dices className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </label>
  )
}
