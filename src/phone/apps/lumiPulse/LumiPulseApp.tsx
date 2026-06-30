import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { PULSE_COLORS } from './constants'
import { consumePendingPulsePostId } from './lumiPulseNavigation'
import { PostDetail } from './PostDetail'
import { PulseAuthGuard } from './PulseAuthGuard'
import { PulseDiscover } from './PulseDiscover'
import { PulseHomeFeed } from './PulseHomeFeed'
import { PulseInbox } from './PulseInbox'
import { PulseProfile } from './PulseProfile'
import { PulseTabBar } from './PulseTabBar'
import type { PulseTab, PulseTrendingTopic } from './pulseTypes'
import {
  usePulseDiscoverPosts,
  usePulseDmThreads,
  usePulseInteractions,
  usePulseProfileStats,
} from './pulseStoreSelectors'
import { usePulsePovOptions } from './usePulsePovOptions'
import { usePulseStore } from './usePulseStore'

export function LumiPulseApp({ onBack }: { onBack: () => void }) {
  const { state, themeStyle } = useCustomization()
  const pageStyle = state.appPageStyles.weibo

  const { hydrated, currentAccountId, options } = usePulsePovOptions()
  const bindAccount = usePulseStore((s) => s.bindAccount)
  const currentPOVId = usePulseStore((s) => s.currentPOVId)
  const setCurrentPOVId = usePulseStore((s) => s.setCurrentPOVId)
  const publishPost = usePulseStore((s) => s.publishPost)
  const posts = usePulseDiscoverPosts()
  const profileStats = usePulseProfileStats(currentPOVId)
  const interactions = usePulseInteractions()
  const dmThreads = usePulseDmThreads()

  const [tab, setTab] = useState<PulseTab>('home')
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const activePov = useMemo(
    () => options.find((o) => o.povId === currentPOVId) ?? null,
    [currentPOVId, options],
  )

  const openPost = useMemo(() => {
    if (!openPostId) return null
    return posts.find((p) => p.id === openPostId) ?? null
  }, [posts, openPostId])

  const inboxUnread = useMemo(
    () =>
      interactions.some((i) => !i.read) || dmThreads.some((t) => t.unread > 0),
    [interactions, dmThreads],
  )

  useEffect(() => {
    void bindAccount(currentAccountId)
  }, [bindAccount, currentAccountId])

  useEffect(() => {
    const pending = consumePendingPulsePostId()
    if (pending) setOpenPostId(pending)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  const showToast = useCallback((msg: string) => setToast(msg), [])

  const handleTrendingTopic = useCallback(
    (topic: PulseTrendingTopic) => {
      if (!currentPOVId || !activePov) return
      publishPost({
        authorPovId: currentPOVId,
        authorName: activePov.label,
        authorAvatarUrl: activePov.avatarUrl,
        content: `${topic.title}\n${topic.excerpt ?? ''}`.trim(),
        trendingTopicId: topic.id,
        verified: true,
      })
      setTab('home')
      showToast('已从热搜发布动态')
    },
    [activePov, currentPOVId, publishPost, showToast],
  )

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFC] text-[13px] text-neutral-400">
        载入脉冲…
      </div>
    )
  }

  if (!currentPOVId || !activePov) {
    return (
      <div
        className="flex h-full min-h-0 flex-col bg-[#FCFCFC]"
        data-phone-page="app"
        data-app-id="weibo"
        style={{ ...themeStyle, fontFamily: 'var(--phone-font)' }}
      >
        <PulseAuthGuard options={options} onSelect={setCurrentPOVId} />
      </div>
    )
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-[#FCFCFC]"
      data-phone-page="app"
      data-app-id="weibo"
      style={{
        ...themeStyle,
        backgroundColor: pageStyle?.pageBg ?? PULSE_COLORS.bg,
        fontFamily: 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
          backgroundColor: 'rgba(252,252,252,0.92)',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full opacity-70"
          aria-label="返回桌面"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M14 6L8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Pressable>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14px] font-medium tracking-[0.04em] text-[#1C1C1E]">
            Lumi Pulse
          </h1>
          <p className="truncate text-[10px] text-neutral-400">{activePov.label}</p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'home' ? (
          <PulseHomeFeed
            currentPovId={currentPOVId}
            authorName={activePov.label}
            authorAvatarUrl={activePov.avatarUrl}
            onOpenPost={setOpenPostId}
          />
        ) : tab === 'discover' ? (
          <PulseDiscover
            povName={activePov.label}
            currentPovId={currentPOVId}
            onOpenTopic={handleTrendingTopic}
          />
        ) : tab === 'inbox' ? (
          <PulseInbox povName={activePov.label} currentPovId={currentPOVId} />
        ) : (
          <PulseProfile
            displayName={activePov.label}
            avatarUrl={activePov.avatarUrl}
            stats={profileStats}
            currentPovId={currentPOVId}
            povOptions={options}
            onSwitchPov={setCurrentPOVId}
            onOpenPost={setOpenPostId}
          />
        )}
      </main>

      {!openPostId ? (
        <PulseTabBar active={tab} onChange={setTab} inboxUnread={inboxUnread} />
      ) : null}

      <AnimatePresence>
        {openPost ? (
          <PostDetail
            post={openPost}
            currentPovId={currentPOVId}
            authorLabel={activePov.label}
            onBack={() => setOpenPostId(null)}
            onToast={showToast}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-14 z-[1400] flex justify-center px-6"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <div
              className="rounded-full px-4 py-2 text-[11px] tracking-[0.04em] text-white backdrop-blur-md"
              style={{ backgroundColor: 'rgba(28,28,30,0.9)' }}
            >
              {toast}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
