import { CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { MemoryFeatureHelpModal } from './MemoryFeatureHelpModal'
import type { MemoryFeatureHelpBlock } from './memoryFeatureHelpTypes'

export function MemoryFeatureHelpButton({
  featureTitle,
  blocks,
  zIndex = 56000,
}: {
  featureTitle: string
  blocks: MemoryFeatureHelpBlock[]
  zIndex?: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-95"
        aria-label={`${featureTitle}功能说明`}
      >
        <CircleHelp className="size-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      <MemoryFeatureHelpModal
        open={open}
        onClose={() => setOpen(false)}
        title={featureTitle}
        blocks={blocks}
        zIndex={zIndex}
      />
    </>
  )
}
