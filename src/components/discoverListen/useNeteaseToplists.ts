import { useCallback, useEffect, useState } from 'react'

import { getCachedToplists, saveCachedToplists } from './listenTogetherPageCache'
import { isLocalNcmMode } from './neteaseApiClient'
import { fetchFeaturedToplistCharts, type NeteaseToplistChart } from './neteaseToplistApi'

export function useNeteaseToplists(cookie: string, refreshKey = 0) {
  const [charts, setCharts] = useState<NeteaseToplistChart[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (refresh = false) => {
    if (!refresh) {
      const cached = await getCachedToplists()
      if (cached && cached.length > 0) {
        setCharts(cached)
        setError(null)
        setLoading(false)
        return
      }
    }

    if (!isLocalNcmMode()) {
      setCharts([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const list = await fetchFeaturedToplistCharts(cookie, 6)
      setCharts(list)
      if (list.length === 0) {
        setError('暂无排行榜数据')
      } else {
        await saveCachedToplists(list)
      }
    } catch (e) {
      if (!refresh) {
        const cached = await getCachedToplists()
        if (cached && cached.length > 0) {
          setCharts(cached)
          setError(null)
          return
        }
      }
      setCharts([])
      setError(e instanceof Error ? e.message : '加载排行榜失败')
    } finally {
      setLoading(false)
    }
  }, [cookie])

  useEffect(() => {
    void refetch(refreshKey > 0)
  }, [refetch, refreshKey])

  return { charts, loading, error, refetch }
}
