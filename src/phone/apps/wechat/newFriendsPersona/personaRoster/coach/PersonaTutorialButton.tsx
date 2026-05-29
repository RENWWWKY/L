import { BookOpen } from 'lucide-react'
import { PERSONA_COACH_TARGET_ATTR } from '../../../memory/memoryCoachTypes'

export function PersonaTutorialButton({
  onClick,
  coachTarget,
  compact,
  label = '教程',
}: {
  onClick: () => void
  coachTarget?: string
  compact?: boolean
  label?: string
}) {
  const coachAttr = coachTarget?.trim()
  return (
    <button
      type="button"
      {...(coachAttr ? { [PERSONA_COACH_TARGET_ATTR]: coachAttr } : {})}
      onClick={onClick}
      className={
        compact
          ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7F7F9] text-[#111827] transition-colors hover:bg-[#EFEFEF]'
          : 'flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#FAFAFB]'
      }
      aria-label="关系管理教程"
    >
      <BookOpen className={compact ? 'size-4' : 'size-3.5'} strokeWidth={1.5} aria-hidden />
      {!compact ? <span className="text-[12px] font-medium tracking-wide">{label}</span> : null}
    </button>
  )
}
