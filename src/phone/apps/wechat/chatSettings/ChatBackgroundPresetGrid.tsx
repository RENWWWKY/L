import { useMemo } from 'react'

import { Pressable } from '../../../components/Pressable'
import { canonicalPublicImagePath } from '../../../../publicAssetUrl'
import { listWeChatDefaultChatBackgroundPresets } from '../wechatDefaultChatBackgrounds'

export function ChatBackgroundPresetGrid({
  selectedDraft,
  onSelect,
  variant = 'private',
}: {
  selectedDraft: string
  onSelect: (storagePath: string) => void
  variant?: 'private' | 'group'
}) {
  const presets = useMemo(() => listWeChatDefaultChatBackgroundPresets(), [])
  const selectedCanon = canonicalPublicImagePath(selectedDraft.trim())

  if (presets.length === 0) return null

  const titleClass = variant === 'group' ? 'text-[15px] font-medium text-[#111827]' : 'text-[15px] font-medium text-black'
  const labelClass = variant === 'group' ? 'text-[11px] text-[#6B7280]' : 'text-[11px] text-[#8e8e8e]'
  const ringSelected = variant === 'group' ? 'ring-2 ring-[#111827]' : 'ring-2 ring-black'

  return (
    <div className="mt-4">
      <p className={titleClass}>内置背景</p>
      <p className={`mt-1 ${labelClass}`}>点击缩略图选用，再点「应用到当前聊天」即可生效。</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {presets.map((preset) => {
          const selected = selectedCanon === preset.storagePath
          return (
            <Pressable
              key={preset.id}
              type="button"
              aria-label={`选用${preset.label}`}
              aria-pressed={selected}
              onClick={() => onSelect(preset.storagePath)}
              className={`overflow-hidden rounded-[10px] border bg-[#f7f7f7] ${selected ? ringSelected : 'border-[#e5e5e5]'}`}
            >
              <div className="aspect-[9/16] w-full overflow-hidden">
                <img src={preset.previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <p className={`truncate px-1.5 py-1.5 text-center ${labelClass}`}>{preset.label}</p>
            </Pressable>
          )
        })}
      </div>
    </div>
  )
}
