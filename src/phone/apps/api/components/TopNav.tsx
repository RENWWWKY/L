import { ArrowLeft } from 'lucide-react'
import { apiTheme } from '../theme'

export function TopNav({
  title,
  onBack,
  right,
}: {
  title: string
  onBack: () => void
  right?: React.ReactNode
}) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between bg-white px-4"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingBottom: 12,
        fontFamily: apiTheme.font,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg p-2 transition-all duration-200 ease-out"
        style={{ color: apiTheme.text }}
      >
        <ArrowLeft className="size-5" />
      </button>
      <p className="text-[18px] font-bold" style={{ color: apiTheme.text }}>
        {title}
      </p>
      <div className="min-w-[44px] text-right">{right}</div>
    </div>
  )
}

