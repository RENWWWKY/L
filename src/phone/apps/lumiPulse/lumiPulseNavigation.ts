import type { AppSlot } from '../../types'

export const LUMI_PULSE_NAVIGATE_EVENT = 'lumi-pulse:navigate'

let pendingPostId: string | null = null

export function openLumiPulseApp(opts?: { postId?: string }) {
  if (opts?.postId?.trim()) pendingPostId = opts.postId.trim()
  window.dispatchEvent(new CustomEvent<{ id: AppSlot['id'] }>('phone:open-app', { detail: { id: 'wechat' } }))
  window.dispatchEvent(new CustomEvent(LUMI_PULSE_NAVIGATE_EVENT))
}

export function consumePendingPulsePostId(): string | null {
  const id = pendingPostId
  pendingPostId = null
  return id
}
