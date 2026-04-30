import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useMemo, useState } from 'react'

import walletBg from '../../../../../image/钱包页背景图.png'
import { Pressable } from '../../../components/Pressable'
import { CreateGroupModal } from './CreateGroupModal'
import { StickerDetail } from './StickerDetail'
import { StickerHub } from './StickerHub'
import { type StickerGroup, useStickerStore } from './stickerStore'

type Props = {
  onBack?: () => void
}

export function StickerCenterPage({ onBack }: Props) {
  const store = useStickerStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<StickerGroup | null>(null)

  const activeGroup = useMemo(() => store.groups.find((g) => g.id === activeGroupId) ?? null, [store.groups, activeGroupId])

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <img src={walletBg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none" />

      <header
        className="relative z-[20] border-b border-white/35 bg-white/28 px-4 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="relative flex h-12 items-center justify-center">
          <Pressable
            type="button"
            onClick={() => {
              if (activeGroup) {
                setActiveGroupId(null)
                return
              }
              onBack?.()
            }}
            className="absolute left-0 inline-flex h-9 items-center justify-center rounded-full border border-white/50 bg-white/35 px-3 text-[12px] text-gray-800 backdrop-blur-[10px]"
          >
            <ChevronLeft className="mr-1 size-4" />
            返回
          </Pressable>
          <h2 className="text-[17px] font-semibold text-black">
            {activeGroup ? activeGroup.name : '表情包中心'}
          </h2>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!activeGroup ? (
          <motion.div key="hub" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }} className="relative min-h-0 flex-1">
            <StickerHub
              groups={store.groups}
              onCreate={() => setCreateOpen(true)}
              onOpenGroup={(id) => setActiveGroupId(id)}
              onRequestDeleteGroup={(g) => {
                if (g.readonly) return
                setPendingDeleteGroup(g)
              }}
            />
          </motion.div>
        ) : (
          <motion.div key={`detail-${activeGroup.id}`} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }} className="relative min-h-0 flex-1">
            <StickerDetail
              group={activeGroup}
              allGroups={store.groups}
              readonly={!!activeGroup.readonly}
              onAddSticker={async ({ url, description }) => {
                store.addSticker(activeGroup.id, { url, description })
              }}
              onDelete={(itemId) => store.deleteSticker(activeGroup.id, itemId)}
              onMove={(itemId, toGroupId) => store.moveSticker(activeGroup.id, toGroupId, itemId)}
              onReorder={(items) => store.reorderItems(activeGroup.id, items)}
              onUpdateDescription={(itemId, description) => store.updateStickerDescription(activeGroup.id, itemId, description)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async ({ name, coverUrl }) => {
          const g = store.createGroup(name, coverUrl)
          if (g) setActiveGroupId(g.id)
        }}
      />

      <AnimatePresence>
        {pendingDeleteGroup ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[180] flex items-end justify-center bg-black/30 p-4"
          >
            <Pressable type="button" className="absolute inset-0" onClick={() => setPendingDeleteGroup(null)}>
              <span className="sr-only">关闭</span>
            </Pressable>
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="relative z-[1] w-full max-w-[560px] rounded-[22px] border border-[#eee] bg-white px-5 py-5 shadow-sm"
            >
              <p className="text-[11px] tracking-[0.2em] text-gray-500">DELETE COLLECTION</p>
              <h3 className="mt-2 text-[20px] font-semibold text-black">确认删除分组？</h3>
              <p className="mt-1 text-[13px] text-gray-600">
                将删除「{pendingDeleteGroup.name}」及其全部表情，此操作不可撤销。
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Pressable
                  type="button"
                  onClick={() => setPendingDeleteGroup(null)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[#eee] bg-white px-4 text-[12px] text-gray-700"
                >
                  取消
                </Pressable>
                <Pressable
                  type="button"
                  onClick={() => {
                    store.deleteGroup(pendingDeleteGroup.id)
                    if (activeGroupId === pendingDeleteGroup.id) setActiveGroupId(null)
                    setPendingDeleteGroup(null)
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black bg-black px-4 text-[12px] font-medium text-white"
                >
                  确认删除
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

