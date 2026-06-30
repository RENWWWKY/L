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
 * 对方消息出队引擎：回调经 ref 持有，effect 不因父组件重绘而反复清 timer。
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

  const processOneJob = useCallback((): 'continue' | 'done' => {
    const job = jobsRef.current.shift()
    if (!job) {
      syncPendingQueueRef.current()
      onQueueActiveRef.current?.(false)
      return 'done'
    }
    if (!isJobLiveRef.current(job)) {
      persistOnlyRef.current(job)
      if (jobsRef.current.length === 0) {
        syncPendingQueueRef.current()
        onQueueActiveRef.current?.(false)
      }
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
    if (jobsRef.current.length === 0) onQueueActiveRef.current?.(false)
    return 'done'
  }, [jobsRef])

  const pendingHeadId =
    pendingQueue[0] && typeof pendingQueue[0] === 'object' && pendingQueue[0] !== null && 'id' in pendingQueue[0]
      ? String((pendingQueue[0] as { id: string }).id)
      : null

  useEffect(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (jobsRef.current.length === 0) {
      processingRef.current = false
      return
    }

    if (processingRef.current) return

    const head = jobsRef.current[0]
    if (!head) return

    onQueueActiveRef.current?.(true)
    const delay = resolveDelay(head)
    processingRef.current = true

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      processingRef.current = false
      let steps = 0
      while (steps < 8) {
        const result = processOneJob()
        steps += 1
        if (result !== 'continue') break
        if (jobsRef.current.length === 0) break
      }
    }, delay)

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      processingRef.current = false
    }
  }, [pendingQueue.length, pendingHeadId, jobsRef, timerRef, processOneJob, resolveDelay])

  const kick = useCallback(() => {
    if (timerRef.current != null || jobsRef.current.length === 0) return
    syncPendingQueueRef.current()
  }, [jobsRef, timerRef])

  return { kick }
}
