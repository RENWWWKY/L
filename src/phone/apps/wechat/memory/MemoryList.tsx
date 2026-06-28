import { AnimatePresence, motion } from 'framer-motion'
import type { MemoryEntry } from './memoryArchiveTypes'
import { MemoryCloudCard } from './MemoryCloudCard'
export function MemoryList({
  entries,
  loading,
  emptyHint,
  inCharacterContext = false,
  onEdit,
  onDelete,
}: {
  entries: MemoryEntry[]
  loading: boolean
  emptyHint?: string
  /** 已在某角色详情页内：卡片不再重复显示角色名 */
  inCharacterContext?: boolean
  onEdit: (entry: MemoryEntry) => void
  onDelete: (entry: MemoryEntry) => void
}) {
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[12px] tracking-[0.2em] uppercase text-gray-400"
        >
          Loading archives
        </motion.p>
      </div>
    )
  }

  if (!entries.length) {
    return (
      <motion.div
        data-memory-coach="list"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md px-8 py-24 text-center"
      >
        <p className="text-[15px] font-medium text-gray-800">暂无匹配记忆</p>
        <p className="mt-3 text-[13px] leading-relaxed text-gray-400">
          {emptyHint ??
            '调整检索词、身份源或角色焦点；也可点右上角「+」新建一条记忆刻录。'}
        </p>
      </motion.div>
    )
  }

  return (
    <motion.ul
      data-memory-coach="list"
      layout
      className={`mx-auto flex w-full max-w-xl flex-col ${inCharacterContext ? 'px-4 py-4' : 'px-5 py-6'}`}
    >
      {inCharacterContext && entries.length ? (
        <li className="mb-3 px-1">
          <p className="text-[11px] font-medium tracking-wide text-gray-400">
            记忆列表 · {entries.length} 条
          </p>
        </li>
      ) : null}
      <AnimatePresence mode="popLayout" initial={false}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <MemoryCloudCard
              entry={entry}
              hideCharacterLabel={inCharacterContext}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry)}
            />
          </li>
        ))}
      </AnimatePresence>
    </motion.ul>
  )
}
