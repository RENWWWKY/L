import { Pressable } from './Pressable'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

/** 极简开关，与主题色协调 */
export function SettingToggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: Props) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-[14px] border px-3 py-2.5"
      style={{
        borderColor: 'var(--phone-border)',
        background: 'var(--phone-surface)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium" style={{ color: 'var(--phone-text)' }}>
          {label}
        </p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--phone-text-muted)' }}>
            {description}
          </p>
        ) : null}
      </div>
      <Pressable
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{
          background: checked ? 'var(--phone-text)' : 'var(--phone-surface-muted)',
          boxShadow: 'inset 0 0 0 1px var(--phone-border)',
        }}
      >
        <span
          className="absolute top-0.5 block h-6 w-6 rounded-full shadow-sm transition-[left] duration-200"
          style={{
            left: checked ? 'calc(100% - 1.65rem)' : '0.125rem',
            background: 'var(--phone-surface)',
          }}
        />
      </Pressable>
    </div>
  )
}
