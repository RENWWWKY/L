import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ListenCommentAuthor } from './ListenCommentComposer'
import {
  LISTEN_TOGETHER_OPEN_COMMENTS_EVENT,
  type ListenTogetherCommentsOpenDetail,
} from './listenTogetherCommentNavigation'
import { ListenTogetherActionToast } from './ListenTogetherActionToast'
import { ListenTogetherPlaylistCommentsPage } from './ListenTogetherPlaylistCommentsPage'
import { ListenTogetherSongCommentsPage } from './ListenTogetherSongCommentsPage'
import { hydrateNeteaseListenSession } from './neteaseListenSession'
import type { NeteaseSongItem } from './neteaseMusicApi'
import { useNeteaseProfile } from './useNeteaseProfile'

type SongCommentsTarget = NeteaseSongItem

type PlaylistCommentsTarget = {
  id: number
  title: string
  cover: string
  commentCount?: number
}

/** 全局评论区叠层：微信评论分享卡等入口可直接唤起，无需先进入发现页 */
export function ListenTogetherCommentsOverlayHost() {
  const [neteaseCookie, setNeteaseCookie] = useState('')
  const [cookieReady, setCookieReady] = useState(false)
  const [songTarget, setSongTarget] = useState<SongCommentsTarget | null>(null)
  const [playlistTarget, setPlaylistTarget] = useState<PlaylistCommentsTarget | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const neteaseLoggedIn = Boolean(neteaseCookie.trim())
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

  useEffect(() => {
    void hydrateNeteaseListenSession().then((session) => {
      setNeteaseCookie(session.cookie)
      setCookieReady(true)
    })
  }, [])

  const openFromDetail = useCallback((detail: ListenTogetherCommentsOpenDetail) => {
    if (detail.targetType === 'playlist') {
      setSongTarget(null)
      setPlaylistTarget({
        id: detail.targetId,
        title: detail.targetTitle,
        cover: detail.targetCover ?? '',
      })
      return
    }
    setPlaylistTarget(null)
    setSongTarget({
      id: detail.targetId,
      name: detail.targetTitle,
      artist: detail.targetArtist?.trim() || '',
      cover: detail.targetCover ?? '',
    })
  }, [])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ListenTogetherCommentsOpenDetail>).detail
      if (!detail?.targetId) return
      openFromDetail(detail)
    }
    window.addEventListener(LISTEN_TOGETHER_OPEN_COMMENTS_EVENT, onOpen as EventListener)
    return () => window.removeEventListener(LISTEN_TOGETHER_OPEN_COMMENTS_EVENT, onOpen as EventListener)
  }, [openFromDetail])

  const closeAll = useCallback(() => {
    setSongTarget(null)
    setPlaylistTarget(null)
  }, [])

  return (
    <>
      <ListenTogetherSongCommentsPage
        open={songTarget !== null}
        song={songTarget}
        cookie={neteaseCookie}
        author={commentAuthor}
        onBack={closeAll}
        onRequireLogin={() => setToast('请先登录网易云账号')}
        className="!z-[10030]"
      />
      <ListenTogetherPlaylistCommentsPage
        open={playlistTarget !== null}
        playlist={
          playlistTarget
            ? { ...playlistTarget, commentCount: playlistTarget.commentCount ?? 0 }
            : null
        }
        cookie={neteaseCookie}
        author={commentAuthor}
        onBack={closeAll}
        onRequireLogin={() => setToast('请先登录网易云账号')}
        className="!z-[10030]"
      />
      <ListenTogetherActionToast message={toast} onClear={() => setToast(null)} />
    </>
  )
}
