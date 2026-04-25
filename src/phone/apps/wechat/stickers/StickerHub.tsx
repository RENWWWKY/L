import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

import { Pressable } from '../../../components/Pressable'
import type { StickerGroup } from './stickerStore'

type Props = {
  groups: StickerGroup[]
  onCreate: () => void
  onOpenGroup: (groupId: string) => void
  onRequestDeleteGroup: (group: StickerGroup) => void
}

export function StickerHub({ groups, onCreate, onOpenGroup, onRequestDeleteGroup }: Props) {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 pb-6 pt-3">
      <p className="text-[12px] text-gray-500">管理你的视觉语料，帮助 AI 更好理解情绪。</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Pressable
          type="button"
          onClick={onCreate}
          className="flex aspect-[0.92] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/55 bg-white/24 text-black backdrop-blur-[10px] shadow-sm"
        >
          <Plus className="size-6" />
          <p className="mt-2 text-[12px]">+ New Collection</p>
        </Pressable>

        {groups.map((g) => (
          <motion.div key={g.id} layout>
            <div className="w-full overflow-hidden rounded-[22px] border border-white/45 bg-white/30 text-left backdrop-blur-[12px] shadow-sm">
              <Pressable
                type="button"
                onClick={() => onOpenGroup(g.id)}
                className="w-full"
              >
                <div className="aspect-[1.05] bg-white/20">
                  {g.coverUrl ? <img src={g.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[12px] text-gray-100">No Cover</div>}
                </div>
                <div className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[15px] font-medium text-gray-950">{g.name}</p>
                    {g.readonly ? (
                      <span className="shrink-0 rounded-full border border-white/55 bg-white/40 px-1.5 py-0.5 text-[10px] text-gray-800">
                        默认
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-700">{g.items.length} expressions</p>
                </div>
              </Pressable>
              {!g.readonly ? (
                <div className="flex justify-end px-3 pb-3">
                  <Pressable
                    type="button"
                    onClick={() => onRequestDeleteGroup(g)}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-white/60 bg-white/35 px-3 text-[11px] text-gray-800 backdrop-blur-[8px]"
                  >
                    删除分组
                  </Pressable>
                </div>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-white/50 bg-white/28 px-5 py-6 text-center backdrop-blur-[12px] shadow-sm">
          <p className="text-[13px] text-gray-800">你的表情包仓库还是空的。</p>
          <p className="mt-1 text-[12px] text-gray-700">先创建一个分组，开始整理你的情绪表达素材。</p>
        </div>
      ) : null}
    </div>
  )
}

