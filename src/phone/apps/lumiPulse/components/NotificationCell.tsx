import type { LucideIcon } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS } from '../constants'

export function NotificationCell({
  label,
  Icon,
  tintBg,
  iconColor,
  unread,
  onPress,
}: {
  label: string
  Icon: LucideIcon
  tintBg: string
  iconColor: string
  unread?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      type="button"
      onClick={onPress}
      className="relative flex flex-1 flex-col items-center gap-2 rounded-2xl bg-white px-2 py-4 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
    >
      <div
        className="relative flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: tintBg }}
      >
        <Icon className="size-5" strokeWidth={1.4} style={{ color: iconColor }} />
        {unread ? (
          <span
            className="absolute right-0 top-0 size-2 rounded-full ring-2 ring-white"
            style={{ backgroundColor: PULSE_COLORS.dustyRose }}
          />
        ) : null}
      </div>
      <span className="text-[12px] text-[#1C1C1E]">{label}</span>
    </Pressable>
  )
}
