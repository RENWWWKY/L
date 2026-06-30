import type { AppSlot } from '../../types'

let pendingPostId: string | null = null

export function openLumiPulseApp(opts?: { postId?: string }) {
  if (opts?.postId?.trim()) pendingPostId = opts.postId.trim()
  window.dispatchEvent(new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'weibo' } }))
}

export function consumePendingPulsePostId(): string | null {
  const id = pendingPostId
  pendingPostId = null
  return id
}
