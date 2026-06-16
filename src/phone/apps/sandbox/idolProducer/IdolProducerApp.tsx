import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Building2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import { useCustomization } from '../../../CustomizationContext'
import type { AgentTab } from './agentTypes'
import './agentRose.css'
import { ArtistChatRoom } from './components/ArtistChatRoom'
import { FloatingStatDeltaLayer } from './components/FloatingStatDelta'
import { ArtistManagerTab } from './tabs/ArtistManagerTab'
import { OperationsTab } from './tabs/OperationsTab'
import { StoryModeTab } from './tabs/StoryModeTab'
import { useAgentStore } from './useAgentStore'

const TABS: { id: AgentTab; label: string; Icon: typeof BookOpen }[] = [
  { id: 'story', label: '主线剧情', Icon: BookOpen },
  { id: 'artists', label: '旗下艺人', Icon: Users },
  { id: 'operations', label: '运营中心', Icon: Building2 },
]

export function IdolProducerApp({ onBack }: { onBack: () => void }) {
  const { themeStyle } = useCustomization()
  const [tab, setTab] = useState<AgentTab>('story')
  const [chatArtistId, setChatArtistId] = useState<string | null>(null)
  const hydrate = useAgentStore((s) => s.hydrate)
  const hydrated = useAgentStore((s) => s.hydrated)
  const artists = useAgentStore((s) => s.artists)
  const chatArtist = useMemo(
    () => (chatArtistId ? artists.find((a) => a.id === chatArtistId) : null),
    [artists, chatArtistId],
  )

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div
      className="agent-rose-root relative flex h-full min-h-0 flex-col bg-[#fff5f7]"
      data-phone-page="app"
      data-app-id="idol-producer"
      style={{
        ...themeStyle,
        backgroundColor: '#fff5f7',
        fontFamily: 'var(--phone-font)',
        color: '#2d2422',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
          backgroundColor: 'rgba(255,245,247,0.92)',
          borderBottom: '1px solid rgba(251,207,232,0.45)',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-600"
          aria-label="返回幻境引擎"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-rose-400">幻境应用 · 官方内置</p>
          <h1 className="agent-serif truncate text-[17px] font-semibold text-stone-800">金牌经纪人模拟器</h1>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!hydrated ? (
          <div className="flex h-full items-center justify-center text-stone-500 text-[14px]">载入中…</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === 'story' ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'story' ? 12 : -12 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex flex-col"
            >
              {tab === 'story' && <StoryModeTab />}
              {tab === 'artists' && (
                <ArtistManagerTab onOpenChat={(id) => setChatArtistId(id)} />
              )}
              {tab === 'operations' && <OperationsTab />}
            </motion.div>
          </AnimatePresence>
        )}
        <FloatingStatDeltaLayer />

        <AnimatePresence>
          {chatArtist ? (
            <motion.div
              key="artist-chat-room"
              className="absolute inset-0 z-[90] flex min-h-0 flex-col bg-[#ededed]"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <ArtistChatRoom artist={chatArtist} onBack={() => setChatArtistId(null)} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <nav className="agent-glass-nav shrink-0 px-2 pb-[max(8px,env(safe-area-inset-bottom,0px))] pt-2">
        <div className="flex justify-around">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <Pressable
                key={id}
                onClick={() => setTab(id)}
                className="relative flex flex-col items-center gap-0.5 px-4 py-1"
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all ${
                    active ? 'agent-tab-glow bg-rose-100 text-rose-500' : 'text-stone-500'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                </span>
                <span
                  className={`text-[11px] ${active ? 'font-semibold text-rose-500' : 'text-stone-500'}`}
                >
                  {label}
                </span>
              </Pressable>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
