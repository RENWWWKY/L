import type { ReactNode } from 'react'
import { Pressable } from '../../../components/Pressable'

export function AppIcon({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col items-center justify-start rounded-xl bg-transparent p-0 outline-none"
    >
      <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[16px] border border-white/15 bg-white/[0.04] shadow-[0_10px_30px_rgba(0,0,0,0.55)] transition-transform duration-150 group-active:scale-[0.98]">
        {icon}
      </div>
      <div className="mt-2 max-w-[70px] truncate text-center text-[12px] leading-none text-white/80">
        {label}
      </div>
    </Pressable>
  )
}

