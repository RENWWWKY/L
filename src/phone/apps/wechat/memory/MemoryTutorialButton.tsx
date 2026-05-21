import { BookOpen } from 'lucide-react'

export function MemoryTutorialButton({
  onClick,
  compact,
  'data-memory-coach': coachTarget,
}: {
  onClick: () => void
  compact?: boolean
  'data-memory-coach'?: string
}) {
  const coachAttr = coachTarget?.trim()
  return (
    <button
      type="button"
      {...(coachAttr ? { 'data-memory-coach': coachAttr } : {})}
      onClick={onClick}
      className={
        compact
          ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100/90 text-gray-800 transition-colors hover:bg-gray-200/70'
          : 'flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-gray-800 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-colors hover:bg-gray-50'
      }
      aria-label="记忆档案馆教程"
    >
      <BookOpen className={compact ? 'size-4' : 'size-3.5'} strokeWidth={1.5} aria-hidden />
      {!compact ? <span className="text-[12px] font-medium tracking-wide">教程</span> : null}
    </button>
  )
}
