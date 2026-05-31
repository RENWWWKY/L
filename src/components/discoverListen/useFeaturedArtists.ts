import { useCallback, useEffect, useState } from 'react'

import { getCachedFeaturedArtists, saveCachedFeaturedArtists } from './listenTogetherPageCache'
import { fetchTopNeteaseArtists, type NeteaseArtistItem } from './neteaseMusicApi'
import { isLocalNcmMode } from './neteaseApiClient'

export function useFeaturedArtists(cookie: string, refreshKey = 0) {
  const [artists, setArtists] = useState<NeteaseArtistItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (refresh = false) => {
    if (!isLocalNcmMode()) {
      setArtists([])
      setError(null)
      setLoading(false)
      return
    }

    if (!refresh) {
      const cached = await getCachedFeaturedArtists()
      if (cached && cached.length > 0) {
        setArtists(cached)
        setError(null)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      const list = await fetchTopNeteaseArtists(cookie, 1, 12)
      setArtists(list)
      if (list.length === 0) {
        setError('暂无歌手数据')
      } else {
        await saveCachedFeaturedArtists(list)
      }
    } catch (e) {
      if (!refresh) {
        const cached = await getCachedFeaturedArtists()
        if (cached && cached.length > 0) {
          setArtists(cached)
          setError(null)
          return
        }
      }
      setArtists([])
      setError(e instanceof Error ? e.message : '加载歌手失败')
    } finally {
      setLoading(false)
    }
  }, [cookie])

  useEffect(() => {
    void refetch(refreshKey > 0)
  }, [refetch, refreshKey])

  return { artists, loading, error, refetch }
}
