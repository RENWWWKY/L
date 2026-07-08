type Props = {
  checked: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
}

/** 线下约会页统一胶囊滑块（柔和黑白） */
export function DatingCapsuleSwitch({ checked, onToggle, disabled = false, className = '' }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#262626]' : 'bg-stone-200/90'
      } ${disabled ? 'cursor-not-allowed opacity-45' : 'active:opacity-80'} ${className}`}
    >
      <span
        className={`inline-block size-[18px] rounded-full border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-out ${
          checked ? 'translate-x-[19px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
