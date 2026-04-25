import { useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useStickerStore } from './stickerStore'

type Props = {
  onPick: (payload: { url: string; description: string }) => void
}

export function StickerPickerPanel({ onPick }: Props) {
  const { groups } = useStickerStore()
  const [activeGroupId, setActiveGroupId] = useState<string | null>(groups[0]?.id ?? null)
  const active = useMemo(() => groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null, [groups, activeGroupId])

  if (!groups.length) {
    return (
      <div className="mb-2 rounded-[12px] border border-[#eee] bg-white px-3 py-3 text-center text-[12px] text-gray-500">
        还没有表情包。请先去「我-表情」创建分组并上传表情。
      </div>
    )
  }

  return (
    <div className="mb-2 rounded-[12px] border border-[#eee] bg-white p-2 shadow-sm">
      <div className="mb-2 flex gap-2 overflow-x-auto">
        {groups.map((g) => (
          <Pressable
            key={g.id}
            type="button"
            onClick={() => setActiveGroupId(g.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] ${active?.id === g.id ? 'border-black bg-black text-white' : 'border-[#eee] bg-white text-gray-700'}`}
          >
            {g.name}
          </Pressable>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {(active?.items ?? []).slice(0, 30).map((item) => (
          <Pressable
            key={item.id}
            type="button"
            onClick={() => onPick({ url: item.url, description: item.description })}
            className="overflow-hidden rounded-[10px] border border-[#eee] bg-[#fafafa]"
          >
            <div className="aspect-square">
              <img src={item.url} alt="" className="h-full w-full object-contain" />
            </div>
          </Pressable>
        ))}
      </div>
    </div>
  )
}

