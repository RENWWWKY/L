import { motion } from 'framer-motion'

import { NoteList } from './NoteList'
import type { PrivateMemo } from './memoTypes'

export function NotesDashboard({
  tab,
  notes,
  deleted,
  onSwitchTab,
  onOpen,
}: {
  tab: 'notes' | 'deleted'
  notes: PrivateMemo[]
  deleted: PrivateMemo[]
  onSwitchTab: (tab: 'notes' | 'deleted') => void
  onOpen: (memo: PrivateMemo) => void
}) {
  const isDeleted = tab === 'deleted'
  return (
    <div>
      <div className="px-4 pt-3">
        <div className="inline-flex rounded-full border border-gray-200 bg-[#fcfcfc] p-1">
          <button
            type="button"
            className={`rounded-full px-4 py-1.5 text-[12px] transition ${
              !isDeleted ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
            }`}
            onClick={() => onSwitchTab('notes')}
          >
            我的备忘录
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-1.5 text-[12px] transition ${
              isDeleted ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
            }`}
            onClick={() => onSwitchTab('deleted')}
          >
            已删除
          </button>
        </div>
      </div>
      <motion.div
        key={tab}
        initial={{ opacity: 0.4, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
      >
        <NoteList
          notes={isDeleted ? deleted : notes}
          onOpen={onOpen}
          muted={isDeleted}
          emptyHint={isDeleted ? '已删除列表为空。' : '暂无备忘录，点击 ✨ AI Generate 创建。'}
        />
      </motion.div>
    </div>
  )
}

