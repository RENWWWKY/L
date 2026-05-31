import { useCallback, useEffect, useMemo, useState } from 'react'

import { sendMusicSyncInvite } from '../../phone/apps/wechat/musicSync/sendMusicSyncInvite'
import { useMusicStore } from '../../stores/useMusicStore'
import { InviteListenerDrawer } from './InviteListenerDrawer'
import { ListenTogetherActionToast } from './ListenTogetherActionToast'
import { activeLyricIndex } from './listenLyricParse'
import {
  formatProgressTimes,
  ListenTogetherFullscreenPlayer,
} from './ListenTogetherFullscreenPlayer'
import { ListenTogetherSongActionDrawer } from './ListenTogetherSongActionDrawer'
import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import { hydrateNeteaseListenSession } from './neteaseListenSession'
import type { NeteaseSongItem } from './neteaseMusicApi'
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
  const [cookieReady, setCookieReady] = useState(false)
  const [commentsSong, setCommentsSong] = useState<NeteaseSongItem | null>(null)
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
  } = useListenTogetherPlayer()

  const neteaseLoggedIn = Boolean(neteaseCookie.trim())
  const { data: neteaseProfile } = useNeteaseProfile(neteaseCookie, cookieReady && neteaseLoggedIn)
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
      setCookieReady(true)
    })
  }, [])

  useEffect(() => {
    if (!open) {
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
        onBack={closeComments}
        className="!z-[10020]"
      />
    </>
  )
}
