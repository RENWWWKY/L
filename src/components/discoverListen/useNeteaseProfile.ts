import { useCallback, useEffect, useState } from 'react'

import {
  getCachedNeteaseProfile,
  saveCachedNeteaseProfile,
} from './listenTogetherPersistence'
import {
  fetchNeteaseProfile,
  normalizeNeteaseProfileBundle,
  type NeteaseProfileBundle,
} from './neteaseProfileApi'

export type RefetchNeteaseProfileOptions = {
  /** 跳过 IndexedDB 缓存，强制请求网易云 */
  force?: boolean
}

export function useNeteaseProfile(cookie: string, enabled = true) {
  const [data, setData] = useState<NeteaseProfileBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const refetch = useCallback(
    async (options?: RefetchNeteaseProfileOptions) => {
      if (!enabled || !cookie.trim()) {
        setData(null)
        setError(null)
        setLoading(false)
        setFromCache(false)
        return
      }

      if (!options?.force) {
        const cached = await getCachedNeteaseProfile()
        if (cached?.profile) {
          setData(normalizeNeteaseProfileBundle(cached.profile))
          setError(null)
          setFromCache(true)
          setLoading(false)
          return
        }
      }

      setFromCache(false)
      setLoading(true)
      setError(null)
      try {
        const profile = normalizeNeteaseProfileBundle(await fetchNeteaseProfile(cookie))
        setData(profile)
        await saveCachedNeteaseProfile(profile)
      } catch (e) {
        setData(null)
        setError(e instanceof Error ? e.message : '加载资料失败')
      } finally {
        setLoading(false)
      }
    },
    [cookie, enabled],
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, fromCache, refetch }
}
