import { useCallback, useEffect, useState } from 'react'

import { fetchLikedSongIds, setNeteaseSongLiked } from './neteaseMusicApi'
import { clearPlaylistCache } from './playlistTracksCache'

export function useNeteaseLikedSongs(
  cookie: string,
  uid: number | undefined,
  likedPlaylistId?: number,
) {
  const [likedIds, setLikedIds] = useState<Set<number>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    if (!cookie.trim() || !uid) {
      setLikedIds(new Set())
      return
    }
    setLoading(true)
    try {
      const ids = await fetchLikedSongIds(cookie, uid)
      setLikedIds(new Set(ids))
    } catch {
      /* 保留已有集合 */
    } finally {
      setLoading(false)
    }
  }, [cookie, uid])

  useEffect(() => {
    void reload()
  }, [reload])

  const isLiked = useCallback(
    (songId: number | undefined | null) => {
      if (!songId) return false
      return likedIds.has(songId)
    },
    [likedIds],
  )

  const toggleLike = useCallback(
    async (songId: number) => {
      if (!cookie.trim() || !songId) return false

      const wasLiked = likedIds.has(songId)
      const nextLiked = !wasLiked

      setTogglingId(songId)
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (nextLiked) next.add(songId)
        else next.delete(songId)
        return next
      })

      try {
        await setNeteaseSongLiked(cookie, songId, nextLiked)
        if (likedPlaylistId) {
          await clearPlaylistCache(likedPlaylistId)
        }
        return true
      } catch {
        setLikedIds((prev) => {
          const next = new Set(prev)
          if (wasLiked) next.add(songId)
          else next.delete(songId)
          return next
        })
        return false
      } finally {
        setTogglingId(null)
      }
    },
    [cookie, likedIds, likedPlaylistId],
  )

  return {
    likedIds,
    loading,
    togglingId,
    isLiked,
    toggleLike,
    reloadLikedIds: reload,
  }
}
