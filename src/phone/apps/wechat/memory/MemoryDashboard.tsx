import { motion } from 'framer-motion'
import { useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { MemorySourceLegendStrip } from './memorySourceBadges'
import { GroupMemoryList } from './GroupMemoryList'
import { PrivateMemoryList } from './PrivateMemoryList'

type Tab = 'private' | 'group'

export function MemoryDashboard({
  contacts,
  playerIdentityId,
  playerDisplayName,
  playerAvatarUrl,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string
  playerDisplayName: string
  playerAvatarUrl?: string
}) {
  const [tab, setTab] = useState<Tab>('private')

  return (
    <div className="flex w-full flex-col bg-white pb-6">
      <header className="shrink-0 px-4 pb-1 pt-4 text-center">
        <h1 className="text-[11px] font-light uppercase tracking-[0.42em] text-neutral-950">Memory Archive</h1>
      </header>

      <div className="relative mx-6 mb-3 mt-4 flex justify-center gap-10 border-b border-neutral-100">
        {(['private', 'group'] as const).map((t) => {
          const label = t === 'private' ? '私人对白' : '群像印记'
          const sub = t === 'private' ? 'Private' : 'Group'
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="relative pb-3 text-[13px] transition-colors duration-200"
            >
              <span className={active ? 'font-medium text-neutral-950' : 'font-normal text-neutral-400'}>
                {label}
              </span>
              <span
                className={`mt-0.5 block text-[10px] tracking-[0.2em] ${active ? 'text-neutral-500' : 'text-neutral-300'}`}
              >
                {sub}
              </span>
              {active ? (
                <motion.div
                  layoutId="memory-archive-tab-line"
                  className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-neutral-950"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <MemorySourceLegendStrip className="mt-1 px-4 pb-2" />

      <div className="w-full">
        {tab === 'private' ? (
          <PrivateMemoryList contacts={contacts} />
        ) : (
          <GroupMemoryList
            playerIdentityId={playerIdentityId}
            playerDisplayName={playerDisplayName}
            playerAvatarUrl={playerAvatarUrl}
          />
        )}
      </div>
    </div>
  )
}
