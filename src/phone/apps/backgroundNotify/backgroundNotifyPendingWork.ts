/** 后台是否仍有「可能触发通知」的进行中任务（AI 输入中 / 延时露出队列） */
export type BackgroundNotifyPendingSnapshot = {
  wechatTyping: boolean
  wechatRevealPending: boolean
}

let snapshot: BackgroundNotifyPendingSnapshot = {
  wechatTyping: false,
  wechatRevealPending: false,
}

const listeners = new Set<(next: BackgroundNotifyPendingSnapshot) => void>()

function emit(): void {
  for (const fn of listeners) fn(snapshot)
}

export function getBackgroundNotifyPendingSnapshot(): BackgroundNotifyPendingSnapshot {
  return snapshot
}

export function hasBackgroundNotifyPendingWork(): boolean {
  return snapshot.wechatTyping || snapshot.wechatRevealPending
}

export function setBackgroundNotifyPendingWork(
  patch: Partial<BackgroundNotifyPendingSnapshot>,
): void {
  const next = { ...snapshot, ...patch }
  if (
    next.wechatTyping === snapshot.wechatTyping &&
    next.wechatRevealPending === snapshot.wechatRevealPending
  ) {
    return
  }
  snapshot = next
  emit()
}

export function subscribeBackgroundNotifyPendingWork(
  listener: (next: BackgroundNotifyPendingSnapshot) => void,
): () => void {
  listeners.add(listener)
  listener(snapshot)
  return () => listeners.delete(listener)
}
