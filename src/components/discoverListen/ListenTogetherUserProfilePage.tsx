import { motion } from 'framer-motion'
import { ArrowLeft, Heart, Loader2, Music2, RefreshCw, User } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ListenNum, ListenNumericText } from './ListenNum'
import { listenNumClass, listenNumStatClass } from './listenTogetherTypography'
import {
  fetchNeteaseUserProfileById,
  type NeteaseProfileBundle,
} from './neteaseProfileApi'
import {
  ListenTogetherFollowListPage,
  type ListenTogetherFollowListTarget,
} from './ListenTogetherFollowListPage'
import type { NeteaseArtistItem } from './neteaseMusicApi'
import type { PlaylistOpenInfo, UserDetailInfo } from './listenTogetherProfileTypes'

export type { UserDetailInfo } from './listenTogetherProfileTypes'

export type ListenTogetherUserProfilePageProps = {
  user: UserDetailInfo
  cookie: string
  sessionActive?: boolean
  onBack: () => void
  onRequireLogin?: () => void
  onOpenPlaylist?: (playlist: PlaylistOpenInfo) => void
  onOpenArtist?: (artist: NeteaseArtistItem) => void
  onOpenUser?: (user: UserDetailInfo) => void
  contentBottomInset?: string
  className?: string
}

type ProfileTab = 'created' | 'saved'

function AvatarCornerBadges({ vipLabel, isVip }: { vipLabel: string; isVip: boolean }) {
  return (
    <div className="absolute -bottom-0.5 -right-0.5 z-10 max-w-[88px]">
      <span
        className={`inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none shadow-md ring-2 ring-white ${
          isVip
            ? 'bg-gradient-to-r from-rose-400 to-red-400 text-white'
            : 'bg-stone-100 text-stone-500'
        }`}
        title={vipLabel}
      >
        {isVip ? <ListenNumericText text={vipLabel} /> : '非会员'}
      </span>
    </div>
  )
}

function PlaylistCard({
  title,
  count,
  cover,
  onClick,
}: {
  title: string
  count: number
  cover: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-2xl bg-white/80 text-left shadow-[0_8px_30px_rgba(120,113,108,0.08)] ring-1 ring-stone-100/80 transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300">
            <Music2 className="size-8 text-stone-400/80" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-stone-900/10 transition-colors group-hover:bg-stone-900/20" />
      </div>
      <div className="px-2.5 py-2.5">
        <p className="line-clamp-1 text-[13px] font-medium text-stone-800">
          <ListenNumericText text={title} />
        </p>
        <p className={`mt-0.5 text-[11px] text-stone-400 ${listenNumClass}`}>
          <ListenNum>{count.toLocaleString()}</ListenNum> 首
        </p>
      </div>
    </button>
  )
}

export function ListenTogetherUserProfilePage({
  user,
  cookie,
  sessionActive = true,
  onBack,
  onRequireLogin,
  onOpenPlaylist,
  onOpenArtist,
  onOpenUser,
  contentBottomInset,
  className = '',
}: ListenTogetherUserProfilePageProps) {
  const [profileTab, setProfileTab] = useState<ProfileTab>('created')
  const [profile, setProfile] = useState<NeteaseProfileBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [followListTarget, setFollowListTarget] = useState<ListenTogetherFollowListTarget | null>(
    null,
  )
  const onRequireLoginRef = useRef(onRequireLogin)
  onRequireLoginRef.current = onRequireLogin

  const loadProfile = useCallback(
    async (force = false) => {
      if (!cookie.trim()) {
        onRequireLoginRef.current?.()
        return
      }
      if (force) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const bundle = await fetchNeteaseUserProfileById(cookie, user.userId)
        setProfile(bundle)
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [cookie, user.userId],
  )

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const displayUser = profile?.user
  const nickname = displayUser?.nickname ?? user.nickname
  const avatar = displayUser?.avatar ?? user.avatar
  const vip = displayUser?.vip
  const following = displayUser?.following ?? 0
  const followers = displayUser?.followers ?? 0
  const neteaseLevel = displayUser?.neteaseLevel ?? 0
  const listenSongs = displayUser?.listenSongs ?? 0

  const listenStat =
    listenSongs > 0
      ? { value: listenSongs.toLocaleString(), suffix: '首' as const }
      : { value: '0', suffix: '首' as const }

  const musicAssets = profile
    ? {
        likedSongs: profile.likedSongs,
        createdPlaylists: profile.createdPlaylists,
        savedPlaylists: profile.savedPlaylists,
      }
    : {
        likedSongs: { id: 0, title: '我喜欢的音乐', count: 0, cover: '' },
        createdPlaylists: [],
        savedPlaylists: [],
      }

  const activePlaylists =
    profileTab === 'created' ? musicAssets.createdPlaylists : musicAssets.savedPlaylists

  const likedCover = musicAssets.likedSongs.cover || null

  const openFollowList = (listKind: 'following' | 'followers') => {
    if (!sessionActive) {
      onRequireLogin?.()
      return
    }
    setFollowListTarget({
      listKind,
      subject: {
        type: 'user',
        userId: user.userId,
        title: nickname,
      },
    })
  }

  const handleOpenArtist = useCallback(
    (artist: NeteaseArtistItem) => {
      setFollowListTarget(null)
      onOpenArtist?.(artist)
    },
    [onOpenArtist],
  )

  const handleOpenUser = useCallback(
    (next: UserDetailInfo) => {
      setFollowListTarget(null)
      onOpenUser?.(next)
    },
    [onOpenUser],
  )

  const bottomPad = contentBottomInset ?? 'max(16px, env(safe-area-inset-bottom))'

  return (
    <div className={`flex h-full min-h-0 flex-col bg-stone-50 ${className}`}>
      <div
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBottom: bottomPad }}
      >
        <section className="relative overflow-hidden bg-gradient-to-b from-rose-100/50 to-stone-50 px-4 pb-8 pt-[max(16px,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-stone-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="刷新"
            title="刷新用户资料"
            onClick={() => void loadProfile(true)}
            disabled={refreshing || loading}
            className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-stone-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-rose-500 disabled:opacity-60"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
          </button>
          <div
            className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-rose-200/30 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-center pt-6">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt={nickname}
                  className="h-[88px] w-[88px] rounded-full object-cover bg-white shadow-[0_12px_40px_rgba(120,113,108,0.15)] ring-4 ring-white/60"
                />
              ) : (
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-stone-200/80 shadow-[0_12px_40px_rgba(120,113,108,0.12)] ring-4 ring-white/60">
                  <User className="size-10 text-stone-400" strokeWidth={1.5} aria-hidden />
                </div>
              )}
              {vip && !loading ? (
                <AvatarCornerBadges vipLabel={vip.vipLabel} isVip={vip.isVip} />
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <h1 className="text-[22px] font-medium tracking-wide text-stone-800">
                <ListenNumericText text={nickname} />
              </h1>
            </div>
            <p className="mt-1 text-[11px] tracking-[0.2em] text-stone-400">网易云用户</p>
            {loading ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                加载中…
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 text-center text-[11px] text-rose-400">{error}</p>
            ) : null}

            <div className="mt-8 grid w-full max-w-[360px] grid-cols-4 gap-1">
              {(
                [
                  { label: '关注', value: following.toLocaleString(), suffix: '' },
                  { label: '粉丝', value: followers.toLocaleString(), suffix: '' },
                  { label: '累计听歌', value: listenStat.value, suffix: listenStat.suffix },
                  {
                    label: '听歌等级',
                    value: neteaseLevel > 0 ? `Lv.${neteaseLevel}` : '—',
                    suffix: '',
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.label !== '关注' && item.label !== '粉丝'}
                  onClick={() => {
                    if (item.label === '关注') openFollowList('following')
                    if (item.label === '粉丝') openFollowList('followers')
                  }}
                  className={`text-center ${
                    item.label === '关注' || item.label === '粉丝'
                      ? 'rounded-xl px-1 py-1 transition-colors hover:bg-white/60 active:scale-[0.98]'
                      : ''
                  }`}
                >
                  <p className={`${listenNumStatClass} text-[15px] text-stone-800 sm:text-base`}>
                    {item.label === '听歌等级' ? (
                      <ListenNumericText text={item.value} />
                    ) : (
                      <ListenNum>{item.value}</ListenNum>
                    )}
                    {item.suffix ? (
                      <span className="ml-0.5 text-[11px] font-normal text-stone-500 sm:text-xs">
                        {item.suffix}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[10px] text-stone-400 sm:text-xs">{item.label}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="space-y-8 px-4 pb-8">
          <section className="space-y-4" aria-label="音乐资产">
            <button
              type="button"
              onClick={() => {
                if (!sessionActive) {
                  onRequireLogin?.()
                  return
                }
                const liked = musicAssets.likedSongs
                if (liked.id) {
                  onOpenPlaylist?.({
                    id: liked.id,
                    title: liked.title || '我喜欢的音乐',
                    cover: liked.cover,
                    count: liked.count,
                  })
                }
              }}
              disabled={!musicAssets.likedSongs.id}
              className="flex w-full overflow-hidden rounded-2xl bg-white/80 text-left shadow-[0_12px_40px_rgba(120,113,108,0.1)] ring-1 ring-stone-100/80 transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center bg-stone-100">
                {likedCover ? (
                  <img src={likedCover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Heart className="size-8 text-stone-300" strokeWidth={1.5} />
                )}
                <div className="absolute inset-0 bg-stone-900/10" />
                <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-400 shadow-sm">
                  <Heart className="size-3.5 fill-current" strokeWidth={0} />
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                <p className="text-[16px] font-medium text-stone-800">我喜欢的音乐</p>
                <p className={`mt-1 text-[13px] text-stone-400 ${listenNumClass}`}>
                  {musicAssets.likedSongs.id ? (
                    <>
                      <ListenNum>{musicAssets.likedSongs.count.toLocaleString()}</ListenNum> 首
                    </>
                  ) : (
                    '暂无或不可见'
                  )}
                </p>
              </div>
            </button>

            <div>
              <div className="mb-4 flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    { id: 'created' as const, label: '创建的歌单' },
                    { id: 'saved' as const, label: '收藏的歌单' },
                  ]
                ).map((tab) => {
                  const active = profileTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProfileTab(tab.id)}
                      className={`relative shrink-0 pb-1 text-[14px] font-medium transition-colors ${
                        active ? 'text-stone-800' : 'text-stone-400'
                      }`}
                    >
                      {tab.label}
                      {active ? (
                        <motion.span
                          layoutId="user-profile-playlist-tab"
                          className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-rose-300"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <motion.div
                key={profileTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="grid grid-cols-2 gap-3">
                  {activePlaylists.length === 0 ? (
                    <p className="col-span-2 py-8 text-center text-[13px] text-stone-400">
                      {loading ? '加载中…' : '暂无歌单'}
                    </p>
                  ) : (
                    activePlaylists.map((pl) => (
                      <PlaylistCard
                        key={pl.id}
                        title={pl.title}
                        count={pl.count}
                        cover={pl.cover}
                        onClick={() => {
                          if (!sessionActive) {
                            onRequireLogin?.()
                            return
                          }
                          if (pl.id) {
                            onOpenPlaylist?.({
                              id: pl.id,
                              title: pl.title,
                              cover: pl.cover,
                              count: pl.count,
                            })
                          }
                        }}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          </section>
        </div>
      </div>

      <ListenTogetherFollowListPage
        open={followListTarget !== null}
        target={followListTarget}
        cookie={cookie}
        onBack={() => setFollowListTarget(null)}
        onOpenArtist={handleOpenArtist}
        onOpenUser={handleOpenUser}
        onRequireLogin={onRequireLogin}
        className="!z-[120]"
      />
    </div>
  )
}
