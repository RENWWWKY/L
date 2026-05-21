import type { ReactNode } from 'react'

export function MemoryEngineSoftField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.22em] uppercase text-gray-400">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function MemoryEngineSoftInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  disabled,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: 'text' | 'password'
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl bg-gray-50 px-4 py-3 transition-colors focus-within:bg-gray-100 ${className}`}
    >
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-[14px] text-gray-900 outline-none placeholder:italic placeholder:text-gray-400"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
    </div>
  )
}
