import { motion } from 'framer-motion'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import {
  ARCHIVE_SOURCE_OFFLINE_LABEL,
  ARCHIVE_SOURCE_ONLINE_LABEL,
  ARCHIVE_SOURCE_TODOS_LABEL,
} from './memoryArchiveSourceLabels'

export type MemoryCharacterSourceTab = 'online' | 'offline' | 'todos'

export function MemoryCharacterSourceTabNav({
  value,
  onChange,
  onlineCount,
  offlineCount,
  todoCount,
}: {
  value: MemoryCharacterSourceTab
  onChange: (tab: MemoryCharacterSourceTab) => void
  onlineCount: number
  offlineCount: number
  todoCount: number
}) {
  const tabs: ReadonlyArray<{ id: MemoryCharacterSourceTab; label: string; count: number }> = [
    { id: 'online', label: ARCHIVE_SOURCE_ONLINE_LABEL, count: onlineCount },
    { id: 'offline', label: ARCHIVE_SOURCE_OFFLINE_LABEL, count: offlineCount },
    { id: 'todos', label: ARCHIVE_SOURCE_TODOS_LABEL, count: todoCount },
  ]

  return (
    <nav
      data-memory-coach="detail-source-tabs"
      className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
      role="tablist"
      aria-label="角色总结来源"
    >
      {tabs.map((tab) => {
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative min-h-[42px] rounded-xl px-1.5 py-2 text-center transition-colors ${
              active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {active ? (
              <motion.span
                layoutId="memory-character-source-tab"
                className="absolute inset-0 rounded-xl bg-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                aria-hidden
              />
            ) : null}
            <span className="relative z-[1] flex flex-col items-center gap-0.5">
              <span
                className={`text-[11px] leading-tight sm:text-[12px] ${
                  active ? 'font-semibold text-white' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
              <span
                className={`text-[10px] tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}
              >
                <ListenNumericText
                  text={tab.id === 'todos' ? `${tab.count} 项` : `${tab.count} 条`}
                />
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
