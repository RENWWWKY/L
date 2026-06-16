import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { sendMusicSyncInvite } from '../../phone/apps/wechat/musicSync/sendMusicSyncInvite'
import { useMusicStore } from '../../stores/useMusicStore'
import { ListenTogetherMiniPlayerBar, listenOverlayBottomInset } from './ListenTogetherMiniPlayerBar'
import {
  ListenTogetherArtistDetailPage,
  type ArtistDetailInfo,
} from './ListenTogetherArtistDetailPage'
import { ListenTogetherUserProfilePage } from './ListenTogetherUserProfilePage'
import type { UserDetailInfo } from './listenTogetherProfileTypes'
import { ListenTogetherActionToast } from './ListenTogetherActionToast'
import { InviteListenerDrawer } from './InviteListenerDrawer'
import { activeLyricIndex } from './listenLyricParse'
import {
  formatProgressTimes,
  ListenTogetherFullscreenPlayer,
} from './ListenTogetherFullscreenPlayer'
import { ListenTogetherSongActionDrawer } from './ListenTogetherSongActionDrawer'
import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import type { ListenCommentAuthor } from './ListenCommentComposer'
import { hydrateNeteaseListenSession } from './neteaseListenSession'
import {
  resolveSongPrimaryArtist,
  type NeteaseArtistItem,
  type NeteaseSongItem,
} from './neteaseMusicApi'
import { useListenTogetherPlayer } from './useListenTogetherPlayer'
import type { InviteableContact } from './useInviteableWeChatContacts'
import { useNeteaseLikedSongs } from './useNeteaseLikedSongs'
import { useNeteaseProfile } from './useNeteaseProfile'

/** 全局全屏播放页：悬浮球等任意入口直接叠层唤起，不跳转发现 Tab */
export function ListenTogetherFullscreenHost() {
  const open = useMusicStore((s) => s.isListenFullscreenOpen)
  const setListenFullscreenOpen = useMusicStore((s) => s.setListenFullscreenOpen)
  const track = useMusicStore((s) => s.currentTrack)
  const syncListening = useMusicStore((s) => s.syncListening)

  const [neteaseCookie, setNeteaseCookie] = useState('')
  const [isGuestMode, setIsGuestMode] = useState(false)
  const [cookieReady, setCookieReady] = useState(false)
  const [commentsSong, setCommentsSong] = useState<NeteaseSongItem | null>(null)
  const [openArtist, setOpenArtist] = useState<ArtistDetailInfo | null>(null)
  const [openUser, setOpenUser] = useState<UserDetailInfo | null>(null)
  const [resolvingArtist, setResolvingArtist] = useState(false)
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false)
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const {
    nowPlaying: song,
    isPlaying,
    progress,
    currentTimeMs,
    durationMs,
    lyrics,
    playMode,
    canUseHeartMode,
    togglePlay,
    playNext,
    playPrev,
    cyclePlayMode,
    seekTo,
    seekToTimeMs,
    playSong,
  } = useListenTogetherPlayer()

  const neteaseLoggedIn = Boolean(neteaseCookie.trim())
  const listenSessionActive = neteaseLoggedIn || isGuestMode
  const { data: neteaseProfile } = useNeteaseProfile(neteaseCookie, cookieReady && neteaseLoggedIn)
  const commentAuthor = useMemo((): ListenCommentAuthor | undefined => {
    const user = neteaseProfile?.user
    if (!user?.nickname) return undefined
    return {
      nickname: user.nickname,
      avatar: user.avatar,
      userId: user.userId,
    }
  }, [neteaseProfile?.user])
  const {
    isLiked: isNeteaseSongLiked,
    toggleLike: toggleNeteaseSongLike,
    togglingId: likingSongId,
  } = useNeteaseLikedSongs(
    neteaseCookie,
    neteaseProfile?.user.userId,
    neteaseProfile?.likedSongs.id,
  )

  useEffect(() => {
    void hydrateNeteaseListenSession().then((session) => {
      setNeteaseCookie(session.cookie)
      setIsGuestMode(session.isGuest)
      setCookieReady(true)
    })
  }, [])

  useEffect(() => {
    if (open) {
      setOpenArtist(null)
      setOpenUser(null)
    } else {
      setCommentsSong(null)
    }
  }, [open])

  const lyricIndex = useMemo(
    () => activeLyricIndex(lyrics, currentTimeMs, durationMs),
    [lyrics, currentTimeMs, durationMs],
  )

  const fullscreenProgress = useMemo(
    () =>
      formatProgressTimes(progress, Math.max(1, Math.round(durationMs / 1000))),
    [progress, durationMs],
  )

  const companion = syncListening
    ? {
        name: syncListening.companion.name,
        avatar: syncListening.companion.avatar,
        message: '正在与你同频共振',
      }
    : null

  const currentSongLiked = song.songId ? isNeteaseSongLiked(song.songId) : false
  const canInteractWithSong = Boolean(song.songId && song.title !== '暂无播放')

  const openCommentsForNowPlaying = useCallback(() => {
    if (!canInteractWithSong || !song.songId) return
    setCommentsSong({
      id: song.songId,
      name: song.title,
      artist: song.artist,
      cover: song.cover ?? '',
    })
  }, [canInteractWithSong, song.songId, song.title, song.artist, song.cover])

  const closeComments = useCallback(() => {
    setCommentsSong(null)
  }, [])

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
  }, [])

  const playSongFromArtist = useCallback(
    (item: NeteaseSongItem, queue: NeteaseSongItem[]) => {
      const list = queue.length > 0 ? queue : [item]
      void playSong(item, {
        queue: list,
        index: Math.max(0, list.findIndex((t) => t.id === item.id)),
      })
    },
    [playSong],
  )

  const openArtistDetail = useCallback((artist: NeteaseArtistItem) => {
    setListenFullscreenOpen(false)
    setOpenUser(null)
    setOpenArtist({ id: artist.id, name: artist.name, avatar: artist.avatar })
  }, [setListenFullscreenOpen])

  const openUserProfile = useCallback((user: UserDetailInfo) => {
    setListenFullscreenOpen(false)
    setOpenArtist(null)
    setOpenUser({
      userId: user.userId,
      nickname: user.nickname,
      avatar: user.avatar,
    })
  }, [setListenFullscreenOpen])

  const handleOpenArtist = useCallback(async () => {
    const songId = song.songId ?? track?.id
    if (!songId || !canInteractWithSong) {
      showToast('当前歌曲无法跳转歌手页')
      return
    }
    if (!listenSessionActive) {
      showToast('请先登录或进入游客模式')
      return
    }

    const knownArtistId = song.artistId ?? track?.artistId
    if (knownArtistId) {
      setListenFullscreenOpen(false)
      setOpenArtist({
        id: knownArtistId,
        name: song.artist || track?.artist || '歌手',
        avatar: '',
      })
      return
    }

    if (!neteaseCookie.trim()) {
      showToast('请先登录网易云账号')
      return
    }

    setResolvingArtist(true)
    try {
      const resolved = await resolveSongPrimaryArtist(
        neteaseCookie,
        songId,
        song.artist || track?.artist,
      )
      if (!resolved) {
        showToast('未找到该歌手')
        return
      }
      setListenFullscreenOpen(false)
      setOpenArtist(resolved)
    } catch {
      showToast('打开歌手页失败')
    } finally {
      setResolvingArtist(false)
    }
  }, [
    song.songId,
    song.artistId,
    song.artist,
    track,
    canInteractWithSong,
    listenSessionActive,
    neteaseCookie,
    showToast,
    setListenFullscreenOpen,
  ])

  const handleInviteConfirm = useCallback(
    async (contact: InviteableContact) => {
      if (!track || inviteSending) return
      setInviteSending(true)
      try {
        await sendMusicSyncInvite({
          characterId: contact.characterId,
          contactName: contact.remarkName,
          contactAvatar: contact.avatarUrl,
          track,
        })
        useMusicStore.getState().setSyncListening(null)
        setInviteDrawerOpen(false)
        showToast(`已向 ${contact.remarkName} 发送共听邀约`)
      } catch {
        showToast('发送邀约失败，请稍后重试')
      } finally {
        setInviteSending(false)
      }
    },
    [inviteSending, showToast, track],
  )

  const openShareListenTogether = useCallback(() => {
    setInviteDrawerOpen(true)
  }, [])

  if (!track) return null

  const actionSong =
    song.songId && canInteractWithSong
      ? {
          id: song.songId,
          title: song.title,
          artist: song.artist,
        }
      : track.id
        ? {
            id: track.id,
            title: track.title,
            artist: track.artist,
          }
        : null

  return (
    <>
      <ListenTogetherFullscreenPlayer
        open={open}
        onClose={() => setListenFullscreenOpen(false)}
        song={{
          title: track.title,
          artist: track.artist,
          cover: track.cover,
        }}
        lyricLines={lyrics}
        activeLyricIndex={lyricIndex}
        durationMs={durationMs}
        progress={fullscreenProgress}
        isPlaying={isPlaying}
        liked={currentSongLiked}
        likeBusy={Boolean(song.songId && likingSongId === song.songId)}
        companion={companion}
        onTogglePlay={togglePlay}
        onToggleLike={
          neteaseLoggedIn && canInteractWithSong && song.songId
            ? () => {
                void toggleNeteaseSongLike(song.songId!)
              }
            : undefined
        }
        onOpenComments={canInteractWithSong ? openCommentsForNowPlaying : undefined}
        onOpenArtist={canInteractWithSong ? () => void handleOpenArtist() : undefined}
        artistLinkBusy={resolvingArtist}
        playMode={playMode}
        canUseHeartMode={canUseHeartMode}
        onCyclePlayMode={cyclePlayMode}
        onPrev={() => void playPrev()}
        onNext={() => void playNext()}
        onSeek={seekTo}
        onSeekToTimeMs={seekToTimeMs}
        onMore={
          actionSong
            ? () => setActionDrawerOpen(true)
            : () => showToast('当前暂无歌曲信息')
        }
      />

      {actionSong ? (
        <ListenTogetherSongActionDrawer
          open={actionDrawerOpen}
          onClose={() => setActionDrawerOpen(false)}
          song={actionSong}
          neteaseCookie={neteaseCookie}
          neteaseUserId={neteaseProfile?.user.userId}
          onShareListenTogether={openShareListenTogether}
          onToast={showToast}
        />
      ) : null}

      <InviteListenerDrawer
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        onConfirm={handleInviteConfirm}
        sending={inviteSending}
      />

      <ListenTogetherActionToast
        message={toastMessage}
        onClear={() => setToastMessage(null)}
      />

      <ListenTogetherSongCommentsPage
        open={commentsSong !== null}
        song={commentsSong}
        cookie={neteaseCookie}
        author={commentAuthor}
        onBack={closeComments}
        className="!z-[10020]"
      />

      <AnimatePresence>
        {openArtist ? (
          <motion.div
            key={`fullscreen-artist-${openArtist.id}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[10020] mx-auto max-w-[560px] overflow-hidden"
          >
            <ListenTogetherArtistDetailPage
              artist={openArtist}
              cookie={neteaseCookie}
              sessionActive={listenSessionActive}
              commentAuthor={commentAuthor}
              onBack={() => setOpenArtist(null)}
              onRequireLogin={() => showToast('请先登录或进入游客模式')}
              onOpenArtist={openArtistDetail}
              onOpenUser={openUserProfile}
              onPlaySong={playSongFromArtist}
              playingSongId={song.songId ?? track?.id ?? null}
              isPlaying={isPlaying}
              contentBottomInset={listenOverlayBottomInset()}
              className="h-full"
            />
          </motion.div>
        ) : null}
        {openUser ? (
          <motion.div
            key={`fullscreen-user-${openUser.userId}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[10021] mx-auto max-w-[560px] overflow-hidden bg-stone-50"
          >
            <ListenTogetherUserProfilePage
              user={openUser}
              cookie={neteaseCookie}
              sessionActive={listenSessionActive}
              onBack={() => setOpenUser(null)}
              onRequireLogin={() => showToast('请先登录或进入游客模式')}
              onOpenArtist={openArtistDetail}
              onOpenUser={openUserProfile}
              contentBottomInset={listenOverlayBottomInset()}
              className="h-full"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {openArtist || openUser ? (
        <ListenTogetherMiniPlayerBar
          title={song.title || track.title}
          artist={song.artist || track.artist}
          cover={song.cover || track.cover || undefined}
          progress={progress}
          isPlaying={isPlaying}
          bottom="env(safe-area-inset-bottom, 0px)"
          onOpenFullscreen={() => setListenFullscreenOpen(true)}
          onTogglePlay={togglePlay}
          zIndexClass="z-[10025]"
        />
      ) : null}
    </>
  )
}
