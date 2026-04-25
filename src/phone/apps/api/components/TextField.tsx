import { apiTheme } from '../theme'

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  right,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'password'
  right?: React.ReactNode
}) {
  return (
    <label className="block">
      <p className="text-[14px]" style={{ color: apiTheme.subText }}>
        {label}
      </p>
      <div className="relative mt-2">
        <input
          value={value}
          type={type}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-white px-4 py-3 text-[16px] outline-none transition-all duration-200 ease-out"
          style={{
            border: `1px solid ${apiTheme.border}`,
            color: apiTheme.text,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = apiTheme.accent
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = apiTheme.border
          }}
        />
        {right ? <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div> : null}
      </div>
    </label>
  )
}

