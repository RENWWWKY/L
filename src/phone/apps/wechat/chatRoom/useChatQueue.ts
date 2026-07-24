import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'

import { computeRevealDelayMs } from './computeRevealDelayMs'

export type ChatQueueJob<TMsg> = {
  msg: TMsg
  revealCallbackOnly?: boolean
  revealCallbackDelayMs?: number
}

export type UseChatQueueOptions<TMsg, TJob extends ChatQueueJob<TMsg>> = {
  pendingQueue: TMsg[]
  jobsRef: MutableRefObject<TJob[]>
  timerRef: MutableRefObject<number | null>
  isJobLive: (job: TJob) => boolean
  getDelayMs?: (job: TJob) => number
  processCallbackOnly: (job: TJob) => void
  processReveal: (job: TJob) => void
  persistOnly: (job: TJob) => void
  syncPendingQueue: () => void
  onQueueActive?: (active: boolean) => void
}

/**
 * 对方消息出队引擎：回调经 ref 持有，避免父组件重绘反复清 timer。
 * 每条露出后在 timeout 内自行续排下一条，不依赖 pendingQueue 浅比较；
 * 调度 effect 也不在依赖变更时清掉正在跑的 timer（仅卸载时清理）。
 */
export function useChatQueue<TMsg, TJob extends ChatQueueJob<TMsg>>({
  pendingQueue,
  jobsRef,
  timerRef,
  isJobLive,
  getDelayMs,
  processCallbackOnly,
  processReveal,
  persistOnly,
  syncPendingQueue,
  onQueueActive,
}: UseChatQueueOptions<TMsg, TJob>) {
  const processingRef = useRef(false)
  const isJobLiveRef = useRef(isJobLive)
  const getDelayMsRef = useRef(getDelayMs)
  const processCallbackOnlyRef = useRef(processCallbackOnly)
  const processRevealRef = useRef(processReveal)
  const persistOnlyRef = useRef(persistOnly)
  const syncPendingQueueRef = useRef(syncPendingQueue)
  const onQueueActiveRef = useRef(onQueueActive)

  isJobLiveRef.current = isJobLive
  getDelayMsRef.current = getDelayMs
  processCallbackOnlyRef.current = processCallbackOnly
  processRevealRef.current = processReveal
  persistOnlyRef.current = persistOnly
  syncPendingQueueRef.current = syncPendingQueue
  onQueueActiveRef.current = onQueueActive

  const resolveDelay = useCallback((job: TJob) => {
    const fn = getDelayMsRef.current
    if (fn) return fn(job)
    if (job.revealCallbackOnly) return Math.max(0, job.revealCallbackDelayMs ?? 0)
    return computeRevealDelayMs(job.msg as Parameters<typeof computeRevealDelayMs>[0])
  }, [])

  const processOneJob = useCallback((): 'continue' | 'await-delay' | 'empty' => {
    const job = jobsRef.current.shift()
    if (!job) {
      syncPendingQueueRef.current()
      onQueueActiveRef.current?.(false)
      return 'empty'
    }
    if (!isJobLiveRef.current(job)) {
      persistOnlyRef.current(job)
      syncPendingQueueRef.current()
      if (jobsRef.current.length === 0) onQueueActiveRef.current?.(false)
      return 'continue'
    }
    if (job.revealCallbackOnly) {
      processCallbackOnlyRef.current(job)
      syncPendingQueueRef.current()
      if (jobsRef.current.length === 0) onQueueActiveRef.current?.(false)
      return 'continue'
    }
    processRevealRef.current(job)
    syncPendingQueueRef.current()
    if (jobsRef.current.length === 0) {
      onQueueActiveRef.current?.(false)
      return 'empty'
    }
    return 'await-delay'
  }, [jobsRef])

  const scheduleDrainRef = useRef<() => void>(() => {})

  /** 外部 clearTimeout 后须复位，否则 processingRef 永久 true，kick/schedule 全部空转 */
  const resetDrainState = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    processingRef.current = false
  }, [timerRef])

  const scheduleDrain = useCallback(() => {
    if (timerRef.current != null) return
    /** 外部只清了 timer、未复位 processing 时，允许重新调度 */
    if (processingRef.current) processingRef.current = false
    if (jobsRef.current.length === 0) {
      processingRef.current = false
      return
    }

    const head = jobsRef.current[0]
    if (!head) return

    onQueueActiveRef.current?.(true)
    const delay = resolveDelay(head)
    processingRef.current = true
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      processingRef.current = false
      let steps = 0
      while (steps < 12) {
        const result = processOneJob()
        steps += 1
        if (result === 'continue') continue
        if (result === 'await-delay') {
          scheduleDrainRef.current()
          return
        }
        return
      }
      if (jobsRef.current.length > 0) scheduleDrainRef.current()
    }, delay)
  }, [jobsRef, processOneJob, resolveDelay, timerRef])

  scheduleDrainRef.current = scheduleDrain

  const pendingHeadId =
    pendingQueue[0] && typeof pendingQueue[0] === 'object' && pendingQueue[0] !== null && 'id' in pendingQueue[0]
      ? String((pendingQueue[0] as { id: string }).id)
      : null

  // 仅在队列指纹变化时尝试启动；不要清掉已在跑的 timer（否则会中断逐条露出）
  useEffect(() => {
    scheduleDrain()
  }, [pendingQueue.length, pendingHeadId, scheduleDrain])

  // 仅卸载时清 timer
  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      processingRef.current = false
    }
  }, [timerRef])

  const kick = useCallback(() => {
    if (timerRef.current != null) return
    if (processingRef.current) processingRef.current = false
    if (jobsRef.current.length === 0) return
    syncPendingQueueRef.current()
    scheduleDrainRef.current()
  }, [jobsRef, timerRef])

  return { kick, resetDrainState }
}
