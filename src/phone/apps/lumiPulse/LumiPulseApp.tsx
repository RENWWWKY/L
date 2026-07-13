import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { PULSE_COLORS, PULSE_TAB_SPRING } from './constants'
import { ForwardSheet } from './ForwardSheet'
import { consumePendingPulsePostId } from './lumiPulseNavigation'
import { PostDetail } from './PostDetail'
import { PulseAuthGuard } from './PulseAuthGuard'
import { PulseDiscover } from './PulseDiscover'
import { PulseHomeFeed } from './PulseHomeFeed'
import { PulseInbox } from './PulseInbox'
import { PulseProfile } from './PulseProfile'
import { PulseNumericText } from './components/PulseNum'
import { PulseTabBar } from './PulseTabBar'
import type { PulseTab, PulseTrendingTopic } from './pulseTypes'
import {
  usePulseDiscoverPosts,
  usePulseDmThreads,
  usePulseInteractions,
  usePulseProfileStats,
} from './pulseStoreSelectors'
import { usePulsePovOptions } from './usePulsePovOptions'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulseStore } from './usePulseStore'

export function LumiPulseApp({
  onBack,
  backTarget = 'desktop',
  className = '',
}: {
  onBack: () => void
  /** desktop：返回手机桌面；discover：返回微信发现列表 */
  backTarget?: 'desktop' | 'discover'
  className?: string
}) {
  return <LumiPulseAppContent onBack={onBack} backTarget={backTarget} className={className} />
}

function LumiPulseAppContent({
  onBack,
  backTarget,
  className,
}: {
  onBack: () => void
  backTarget: 'desktop' | 'discover'
  className?: string
}) {
  const { state, themeStyle } = useCustomization()
  const pageStyle = state.appPageStyles.weibo

  const { hydrated, currentAccountId, options } = usePulsePovOptions()
  const { playerPovId, displayName: playerName, avatarUrl: playerAvatarUrl } = usePulsePlayerAccount()
  const bindAccount = usePulseStore((s) => s.bindAccount)
  const currentWorldId = usePulseStore((s) => s.currentPOVId)
  const setCurrentWorldId = usePulseStore((s) => s.setCurrentPOVId)
  const publishPost = usePulseStore((s) => s.publishPost)
  const posts = usePulseDiscoverPosts()
  const profileStats = usePulseProfileStats(playerPovId)
  const interactions = usePulseInteractions()
  const dmThreads = usePulseDmThreads()

  const [tab, setTab] = useState<PulseTab>('home')
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [forwardPostId, setForwardPostId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const prevWorldRef = useRef<string | null>(null)

  const activeWorld = useMemo(
    () => options.find((o) => o.povId === currentWorldId) ?? null,
    [currentWorldId, options],
  )

  const openPost = useMemo(() => {
    if (!openPostId) return null
    return posts.find((p) => p.id === openPostId) ?? null
  }, [posts, openPostId])

  const forwardPost = useMemo(() => {
    if (!forwardPostId) return null
    return posts.find((p) => p.id === forwardPostId) ?? null
  }, [posts, forwardPostId])

  const handleRepostPost = useCallback((postId: string) => {
    setForwardPostId(postId)
  }, [])

  const inboxUnread = useMemo(
    () =>
      interactions.some((i) => !i.read) || dmThreads.some((t) => t.unread > 0),
    [interactions, dmThreads],
  )

  useEffect(() => {
    void bindAccount(currentAccountId)
  }, [bindAccount, currentAccountId])

  /** 切换世界时关闭跨世界的动态详情（首次进入世界不清空） */
  useEffect(() => {
    const prev = prevWorldRef.current
    prevWorldRef.current = currentWorldId
    if (prev && currentWorldId && prev !== currentWorldId) {
      setOpenPostId(null)
    }
  }, [currentWorldId])

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
      if (!currentWorldId || !playerPovId) return
      publishPost({
        authorPovId: playerPovId,
        authorName: playerName,
        authorAvatarUrl: playerAvatarUrl,
        content: `${topic.title}\n${topic.excerpt ?? ''}`.trim(),
        trendingTopicId: topic.id,
        verified: false,
      })
      setTab('home')
      showToast('已从热搜发布动态')
    },
    [currentWorldId, playerAvatarUrl, playerName, playerPovId, publishPost, showToast],
  )

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFC] text-[13px] text-neutral-400">
        载入脉冲…
      </div>
    )
  }

  if (!playerPovId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFC] px-8 text-center text-[13px] leading-relaxed text-neutral-400">
        请先登录微信账号后再使用微博广场
      </div>
    )
  }

  if (!currentWorldId || !activeWorld) {
    return (
      <div
        className={`flex h-full min-h-0 flex-col bg-[#FCFCFC] ${className}`}
        data-phone-page="app"
        data-app-id="weibo"
        style={{ ...themeStyle, fontFamily: 'var(--phone-font)' }}
      >
        <PulseAuthGuard
          options={options}
          onSelect={setCurrentWorldId}
          onBack={onBack}
          backLabel={backTarget === 'discover' ? '返回发现' : '返回主页'}
          playerName={playerName}
        />
      </div>
    )
  }

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col bg-[#FCFCFC] ${className}`}
      data-phone-page="app"
      data-app-id="weibo"
      style={{
        ...themeStyle,
        backgroundColor: pageStyle?.pageBg ?? PULSE_COLORS.bg,
        fontFamily: 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-1"
        style={{
          paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
          backgroundColor: 'rgba(252,252,252,0.88)',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full opacity-60"
          aria-label={backTarget === 'discover' ? '返回发现' : '返回桌面'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M14 6L8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Pressable>
        <p className="min-w-0 flex-1 truncate text-[11px] tracking-[0.08em] text-neutral-400">
          {activeWorld.worldName} · {playerName}
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={PULSE_TAB_SPRING}
          >
            {tab === 'home' ? (
              <PulseHomeFeed
                currentPlayerPovId={playerPovId}
                authorName={playerName}
                authorAvatarUrl={playerAvatarUrl}
                povOptions={options}
                onOpenPost={setOpenPostId}
                onRepostPost={handleRepostPost}
              />
            ) : tab === 'discover' ? (
              <PulseDiscover
                povName={activeWorld.label}
                currentWorldId={currentWorldId}
                onOpenTopic={handleTrendingTopic}
              />
            ) : tab === 'inbox' ? (
              <PulseInbox povName={activeWorld.label} currentPlayerPovId={playerPovId} />
            ) : (
              <PulseProfile
                displayName={playerName}
                avatarUrl={playerAvatarUrl}
                stats={profileStats}
                currentPlayerPovId={playerPovId}
                currentWorldId={currentWorldId}
                povOptions={options}
                onSwitchWorld={setCurrentWorldId}
                onOpenPost={setOpenPostId}
                onRepostPost={handleRepostPost}
                onToast={showToast}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {!openPostId ? (
        <PulseTabBar active={tab} onChange={setTab} inboxUnread={inboxUnread} />
      ) : null}

      <AnimatePresence>
        {openPost ? (
          <PostDetail
            post={openPost}
            currentPlayerPovId={playerPovId}
            authorLabel={playerName}
            authorAvatarUrl={playerAvatarUrl}
            onBack={() => setOpenPostId(null)}
            onToast={showToast}
            onRepost={() => handleRepostPost(openPost.id)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {forwardPost ? (
          <ForwardSheet
            post={forwardPost}
            onClose={() => setForwardPostId(null)}
            onSent={() => {
              setForwardPostId(null)
              showToast('已发送给微信好友')
            }}
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
              <PulseNumericText text={toast} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
