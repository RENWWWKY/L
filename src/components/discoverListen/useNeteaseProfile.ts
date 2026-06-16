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
  /** 已有资料时在后台刷新，不显示全页 loading */
  silent?: boolean
}

export function useNeteaseProfile(cookie: string, enabled = true) {
  const [data, setData] = useState<NeteaseProfileBundle | null>(null)
  const [loading, setLoading] = useState(enabled)
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
          const normalized = normalizeNeteaseProfileBundle(cached.profile)
          setData(normalized)
          setError(null)
          setFromCache(true)
          setLoading(false)

          const listenEmpty =
            normalized.user.listenHours === 0 && normalized.user.listenSongs === 0
          if (listenEmpty) {
            void refetch({ force: true, silent: true })
          }
          return
        }
      }

      setFromCache(false)
      if (!options?.silent) {
        setLoading(true)
      }
      setError(null)
      try {
        const profile = normalizeNeteaseProfileBundle(await fetchNeteaseProfile(cookie))
        setData(profile)
        await saveCachedNeteaseProfile(profile)
      } catch (e) {
        const cached = await getCachedNeteaseProfile()
        if (cached?.profile && !options?.force) {
          setData(normalizeNeteaseProfileBundle(cached.profile))
          setFromCache(true)
          setError(null)
          return
        }
        setData(null)
        setError(e instanceof Error ? e.message : '加载资料失败')
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    [cookie, enabled],
  )

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, fromCache, refetch }
}
