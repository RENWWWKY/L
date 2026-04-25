import { Mars, Venus } from 'lucide-react'

export type ContactProfileGenderUi = 'male' | 'female' | 'private'

type GenderBadgeIconProps = {
  size?: number
  className?: string
}

/** 男：极简细线 Mars */
export function ContactProfileMaleGenderIcon({ size = 15, className }: GenderBadgeIconProps) {
  return <Mars size={size} strokeWidth={1.7} className={className ?? 'shrink-0 text-[#666666]'} aria-hidden />
}

/** 女：极简细线 Venus */
export function ContactProfileFemaleGenderIcon({ size = 15, className }: GenderBadgeIconProps) {
  return <Venus size={size} strokeWidth={1.7} className={className ?? 'shrink-0 text-[#666666]'} aria-hidden />
}

export function ContactProfileGenderGlyph({ kind }: { kind: ContactProfileGenderUi }) {
  if (kind === 'male') return <ContactProfileMaleGenderIcon />
  if (kind === 'female') return <ContactProfileFemaleGenderIcon />
  return (
    <span className="shrink-0 text-[13px] text-[#8e8e8e]" title="保密" aria-label="保密">
      保密
    </span>
  )
}
