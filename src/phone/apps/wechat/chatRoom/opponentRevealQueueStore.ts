/**
 * 按 conversationKey 暂存对方消息逐条露出队列。
 * 切换会话 / 离开聊天页时勿立刻 persist 全量气泡，回聊天室后仍按间隔逐条露出。
 */

const stashedJobsByKey = new Map<string, unknown[]>()
const stashListeners = new Set<() => void>()

function normKey(conversationKey: string): string {
  return conversationKey.trim()
}

function notifyStashListeners(): void {
  for (const fn of stashListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

export function subscribeOpponentRevealQueueStore(listener: () => void): () => void {
  stashListeners.add(listener)
  return () => {
    stashListeners.delete(listener)
  }
}

export function getStashedOpponentRevealJobCount(conversationKey: string): number {
  const k = normKey(conversationKey)
  if (!k) return 0
  return stashedJobsByKey.get(k)?.length ?? 0
}

export function hasStashedOpponentRevealJobs(conversationKey: string): boolean {
  return getStashedOpponentRevealJobCount(conversationKey) > 0
}

export function stashOpponentRevealJobs<T>(conversationKey: string, jobs: readonly T[]): void {
  const k = normKey(conversationKey)
  if (!k || jobs.length === 0) return
  const prev = (stashedJobsByKey.get(k) ?? []) as T[]
  stashedJobsByKey.set(k, [...prev, ...jobs])
  notifyStashListeners()
}

/** 取出并清空指定会话的暂存队列（交给当前 ChatRoom 实例续跑） */
export function takeStashedOpponentRevealJobs<T>(conversationKey: string): T[] {
  const k = normKey(conversationKey)
  if (!k) return []
  const jobs = (stashedJobsByKey.get(k) ?? []) as T[]
  if (jobs.length > 0) stashedJobsByKey.delete(k)
  if (jobs.length > 0) notifyStashListeners()
  return jobs
}

export function clearStashedOpponentRevealJobs(conversationKey: string): void {
  const k = normKey(conversationKey)
  if (!k) return
  if (stashedJobsByKey.delete(k)) notifyStashListeners()
}
