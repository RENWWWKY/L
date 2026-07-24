/**
 * 按 conversationKey 暂存对方消息逐条露出队列（模块级全局）。
 * - 切会话 / 离开聊天页：未露出 job 入暂存，回该会话后可续跑 UI 动画
 * - 非当前 live 会话：后台按间隔 persist，多角色可并行落库（不依赖 ChatRoom 挂载）
 */

import { computeRevealDelayMs, type RevealDelayMessage } from './computeRevealDelayMs'

type StashJobLike = {
  revealCallbackOnly?: boolean
  revealCallbackDelayMs?: number
  msg?: RevealDelayMessage
  beforeReveal?: () => void
  persist?: () => void
  afterReveal?: () => void
}

const stashedJobsByKey = new Map<string, unknown[]>()
const stashListeners = new Set<() => void>()
/** 由 wechatConversationAiPipeline 注入，避免循环依赖 */
let externalPipelineNotify: (() => void) | null = null
/** 当前 ChatRoom 正在驱动 UI 露出的会话（仅一个）；该 key 不做后台 drain，避免双轨 */
let liveRevealConversationKey = ''
const backgroundDrainTimers = new Map<string, number>()

function normKey(conversationKey: string): string {
  return conversationKey.trim()
}

export function setOpponentRevealStoreExternalNotify(fn: (() => void) | null): void {
  externalPipelineNotify = fn
}

function notifyStashListeners(): void {
  for (const fn of stashListeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
  try {
    externalPipelineNotify?.()
  } catch {
    /* ignore */
  }
}

function resolveStashJobDelayMs(job: unknown): number {
  const j = job as StashJobLike
  if (j.revealCallbackOnly) return Math.max(0, j.revealCallbackDelayMs ?? 0)
  if (j.msg) return computeRevealDelayMs(j.msg)
  return 480
}

function persistStashJob(job: unknown): void {
  const j = job as StashJobLike
  try {
    j.beforeReveal?.()
  } catch {
    /* ignore */
  }
  if (!j.revealCallbackOnly) {
    try {
      j.persist?.()
    } catch {
      /* ignore */
    }
  }
  try {
    j.afterReveal?.()
  } catch {
    /* ignore */
  }
}

function cancelBackgroundDrain(conversationKey: string): void {
  const k = normKey(conversationKey)
  if (!k) return
  const tid = backgroundDrainTimers.get(k)
  if (tid == null) return
  window.clearTimeout(tid)
  backgroundDrainTimers.delete(k)
}

function scheduleBackgroundDrain(conversationKey: string): void {
  const k = normKey(conversationKey)
  if (!k) return
  if (k === liveRevealConversationKey) {
    cancelBackgroundDrain(k)
    return
  }
  if (backgroundDrainTimers.has(k)) return
  const jobs = stashedJobsByKey.get(k)
  if (!jobs?.length) return

  const head = jobs[0]
  const delay = resolveStashJobDelayMs(head)
  const tid = window.setTimeout(() => {
    backgroundDrainTimers.delete(k)
    if (k === liveRevealConversationKey) return
    const list = stashedJobsByKey.get(k)
    if (!list?.length) return
    const job = list.shift()
    if (list.length === 0) stashedJobsByKey.delete(k)
    else stashedJobsByKey.set(k, list)
    if (job != null) persistStashJob(job)
    notifyStashListeners()
    scheduleBackgroundDrain(k)
  }, delay)
  backgroundDrainTimers.set(k, tid)
}

function kickAllBackgroundDrains(): void {
  for (const k of stashedJobsByKey.keys()) {
    if (k !== liveRevealConversationKey) scheduleBackgroundDrain(k)
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

/** 当前由 ChatRoom 本地 timer 驱动 UI 的会话；切走后其它会话可后台并行落库 */
export function setOpponentRevealLiveConversation(conversationKey: string | null): void {
  const next = normKey(conversationKey ?? '')
  if (liveRevealConversationKey === next) return
  const prev = liveRevealConversationKey
  liveRevealConversationKey = next
  if (prev) scheduleBackgroundDrain(prev)
  if (next) cancelBackgroundDrain(next)
  kickAllBackgroundDrains()
}

export function getOpponentRevealLiveConversation(): string {
  return liveRevealConversationKey
}

export function stashOpponentRevealJobs<T>(conversationKey: string, jobs: readonly T[]): void {
  const k = normKey(conversationKey)
  if (!k || jobs.length === 0) return
  const prev = (stashedJobsByKey.get(k) ?? []) as T[]
  stashedJobsByKey.set(k, [...prev, ...jobs])
  notifyStashListeners()
  if (k !== liveRevealConversationKey) scheduleBackgroundDrain(k)
}

/** 取出并清空指定会话的暂存队列（交给当前 ChatRoom 实例续跑） */
export function takeStashedOpponentRevealJobs<T>(conversationKey: string): T[] {
  const k = normKey(conversationKey)
  if (!k) return []
  cancelBackgroundDrain(k)
  const jobs = (stashedJobsByKey.get(k) ?? []) as T[]
  if (jobs.length > 0) stashedJobsByKey.delete(k)
  if (jobs.length > 0) notifyStashListeners()
  return jobs
}

export function clearStashedOpponentRevealJobs(conversationKey: string): void {
  const k = normKey(conversationKey)
  if (!k) return
  cancelBackgroundDrain(k)
  if (stashedJobsByKey.delete(k)) notifyStashListeners()
}
