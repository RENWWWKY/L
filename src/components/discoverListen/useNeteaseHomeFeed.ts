import { useCallback, useEffect, useState } from 'react'

import { getCachedHomeFeed, saveCachedHomeFeed } from './listenTogetherPageCache'
import { fetchNeteaseHomeFeed, type NeteaseHomeFeed } from './neteaseHomeApi'
import { isLocalNcmMode } from './neteaseApiClient'

export function useNeteaseHomeFeed(cookie: string, refreshKey = 0) {
  const [data, setData] = useState<NeteaseHomeFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(
    async (refresh = false) => {
      if (!refresh) {
        const cached = await getCachedHomeFeed()
        if (cached) {
          setData(cached)
          setError(
            cached.sections.length === 0 && cached.banners.length === 0
              ? '暂无首页推荐'
              : null,
          )
          setLoading(false)
          return
        }
      }

      if (!isLocalNcmMode()) {
        setData(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const feed = await fetchNeteaseHomeFeed(cookie, { refresh })
        setData(feed)
        if (feed.sections.length === 0 && feed.banners.length === 0) {
          setError('暂无首页推荐')
        } else {
          await saveCachedHomeFeed(feed)
        }
      } catch (e) {
        if (!refresh) {
          const cached = await getCachedHomeFeed()
          if (cached) {
            setData(cached)
            setError(null)
            return
          }
        }
        setData(null)
        setError(e instanceof Error ? e.message : '加载首页推荐失败')
      } finally {
        setLoading(false)
      }
    },
    [cookie],
  )

  useEffect(() => {
    void refetch(refreshKey > 0)
  }, [refetch, refreshKey])

  return { data, loading, error, refetch }
}
