import { motion } from 'framer-motion'

export type NewFriendsTabId = 'received' | 'sent'

const LINE_LAYOUT_ID = 'new-friends-twin-tab-line'

const TABS: { id: NewFriendsTabId; zh: string; en: string }[] = [
  { id: 'received', zh: '收到的验证', en: 'RECEIVED' },
  { id: 'sent', zh: '发出的申请', en: 'SENT' },
]

export function NewFriendsTwinTabs({
  active,
  onChange,
}: {
  active: NewFriendsTabId
  onChange: (id: NewFriendsTabId) => void
}) {
  return (
    <nav
      aria-label="新的朋友分区"
      className="flex justify-center border-b border-[#E5E7EB]/80 bg-white px-4"
      style={{ borderBottomWidth: '0.5px' }}
    >
      <motion.div layout className="flex gap-8">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className="relative py-4 text-center transition-colors duration-200"
            >
              <span
                className={`block text-[13px] tracking-tight ${
                  isActive ? 'font-semibold text-[#000000]' : 'font-normal text-[#9CA3AF]'
                }`}
              >
                {tab.zh}
              </span>
              <span
                className={`mt-0.5 block text-[8px] font-medium uppercase tracking-[0.2em] ${
                  isActive ? 'text-[#1C1C1E]/70' : 'text-[#9CA3AF]/80'
                }`}
              >
                {tab.en}
              </span>
              {isActive ? (
                <motion.span
                  layoutId={LINE_LAYOUT_ID}
                  className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-[#000000]"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </motion.div>
    </nav>
  )
}
