export function MemoryEngineSoftSwitch({
  on,
  onToggle,
  disabled,
  'aria-label': ariaLabel,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed opacity-40' : ''
      } ${on ? 'bg-gray-900' : 'bg-gray-100'}`}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}
