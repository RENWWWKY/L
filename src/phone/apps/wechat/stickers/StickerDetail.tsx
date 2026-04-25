import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { Plus, MoreHorizontal } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import type { StickerGroup, StickerItem } from './stickerStore'
import { StickerUploadSheet } from './StickerUploadSheet'

type Props = {
  group: StickerGroup
  allGroups: StickerGroup[]
  readonly?: boolean
  onReorder: (items: StickerItem[]) => void
  onDelete: (itemId: string) => void
  onUpdateDescription: (itemId: string, description: string) => void
  onMove: (itemId: string, toGroupId: string) => void
  onAddSticker: (payload: { url: string; description: string }) => Promise<void> | void
}

export function StickerDetail({
  group,
  allGroups,
  readonly = false,
  onReorder,
  onDelete,
  onUpdateDescription,
  onMove,
  onAddSticker,
}: Props) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [menuItem, setMenuItem] = useState<StickerItem | null>(null)
  const [descDraft, setDescDraft] = useState('')
  const longPressTimerRef = useRef<number | null>(null)

  const moveTargets = useMemo(() => allGroups.filter((g) => g.id !== group.id && !g.readonly), [allGroups, group.id])

  const openMenu = (item: StickerItem) => {
    setMenuItem(item)
    setDescDraft(item.description)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pb-2 pt-3">
        <p className="text-[11px] tracking-[0.22em] text-gray-700">COLLECTIONS</p>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h3 className="text-[22px] font-semibold text-black">{group.name}</h3>
            <p className="text-[12px] text-gray-700">{group.items.length} 张表情</p>
          </div>
          {readonly ? (
            <span className="rounded-full border border-white/60 bg-white/34 px-4 py-2 text-[12px] text-gray-700 backdrop-blur-[8px]">
              只读预览
            </span>
          ) : (
            <Pressable type="button" onClick={() => setUploadOpen(true)} className="rounded-full border border-white/60 bg-white/34 px-4 py-2 text-[12px] text-gray-900 backdrop-blur-[8px]">
              添加
            </Pressable>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {group.items.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-white/50 bg-white/28 p-8 text-center backdrop-blur-[12px] shadow-sm">
            <p className="text-[13px] text-gray-800">你的表情包仓库还是空的。</p>
            <Pressable type="button" onClick={() => setUploadOpen(true)} disabled={readonly} className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-white/60 bg-white/38 px-4 text-[12px] text-gray-900 backdrop-blur-[8px] disabled:cursor-not-allowed disabled:opacity-60">
              + 添加第一张表情
            </Pressable>
          </div>
        ) : readonly ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {group.items.map((item) => (
              <motion.div key={item.id} layout className="group relative overflow-hidden rounded-[16px] border border-white/45 bg-white/30 backdrop-blur-[12px] shadow-sm">
                <div className="aspect-square bg-white/20">
                  <img src={item.url} alt="" className="h-full w-full object-contain" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={group.items}
            onReorder={onReorder}
            className="mt-3 grid grid-cols-3 gap-2"
          >
            {group.items.map((item) => (
              <Reorder.Item key={item.id} value={item} className="list-none">
                <motion.div
                  layout
                  className="group relative overflow-hidden rounded-[16px] border border-white/45 bg-white/30 backdrop-blur-[12px] shadow-sm"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    openMenu(item)
                  }}
                  onPointerDown={() => {
                    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
                    longPressTimerRef.current = window.setTimeout(() => openMenu(item), 420)
                  }}
                  onPointerUp={() => {
                    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
                  }}
                >
                  <div className="aspect-square bg-white/20">
                    <img src={item.url} alt="" className="h-full w-full object-contain" />
                  </div>
                  <Pressable
                    type="button"
                    onClick={() => openMenu(item)}
                    className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-white/85 text-gray-700 group-hover:flex"
                  >
                    <MoreHorizontal className="size-4" />
                  </Pressable>
                </motion.div>
              </Reorder.Item>
            ))}
            <Pressable
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex aspect-square items-center justify-center rounded-[16px] border border-dashed border-white/55 bg-white/24 text-white backdrop-blur-[10px] shadow-sm"
            >
              <Plus className="size-6" />
            </Pressable>
          </Reorder.Group>
        )}
      </div>

      <StickerUploadSheet
        open={uploadOpen && !readonly}
        onClose={() => setUploadOpen(false)}
        onSave={onAddSticker}
      />

      <AnimatePresence>
        {menuItem ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[190] flex flex-col justify-end bg-black/35">
            <Pressable type="button" className="min-h-0 flex-1" onClick={() => setMenuItem(null)}>
              <span className="sr-only">关闭</span>
            </Pressable>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-t-[24px] border-t border-[#eee] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4"
            >
              <p className="text-[11px] tracking-[0.2em] text-gray-500">AI DESCRIPTION</p>
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                className="mt-2 h-20 w-full resize-none rounded-[12px] border border-[#eee] px-3 py-2 text-[13px] outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Pressable
                  type="button"
                  onClick={() => {
                    onUpdateDescription(menuItem.id, descDraft)
                    setMenuItem(null)
                  }}
                  className="rounded-full border border-black bg-black px-4 py-2 text-[12px] text-white"
                >
                  保存描述
                </Pressable>
                <Pressable
                  type="button"
                  onClick={() => {
                    onDelete(menuItem.id)
                    setMenuItem(null)
                  }}
                  className="rounded-full border border-[#eee] bg-white px-4 py-2 text-[12px] text-gray-700"
                >
                  删除
                </Pressable>
                {moveTargets.map((g) => (
                  <Pressable
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onMove(menuItem.id, g.id)
                      setMenuItem(null)
                    }}
                    className="rounded-full border border-[#eee] bg-white px-3 py-2 text-[11px] text-gray-700"
                  >
                    移动到 {g.name}
                  </Pressable>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

