import { useCallback, useMemo } from 'react'

import { useWeChatCurrentTime } from './useWeChatCurrentTime'

type Options = { characterId?: string | null }

/**
 * 全局「当前时间」来源：与自定义微信时间 / 系统时间一致，供转账 24h 倒计时等业务使用。
 * 返回 `getCurrentTime()`，值为毫秒时间戳（与 `Date.now()` 一致）。
 */
export function useGlobalTime(options?: Options) {
  const { getCurrentTimeMs } = useWeChatCurrentTime(options)
  const getCurrentTime = useCallback(() => getCurrentTimeMs(), [getCurrentTimeMs])
  return useMemo(() => ({ getCurrentTime, getCurrentTimeMs }), [getCurrentTime, getCurrentTimeMs])
}
