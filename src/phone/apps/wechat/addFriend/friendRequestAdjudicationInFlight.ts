/** 跨模块共享：避免同一 requestId 并发多次 AI 裁决导致卡死 */

const inFlight = new Map<string, Promise<unknown>>()

export function isFriendRequestAdjudicationInFlight(requestId: string): boolean {
  return inFlight.has(requestId.trim())
}

export function registerFriendRequestAdjudicationJob(
  requestId: string,
  job: Promise<unknown>,
): void {
  const id = requestId.trim()
  if (!id) return
  inFlight.set(id, job)
  void job.finally(() => {
    if (inFlight.get(id) === job) inFlight.delete(id)
  })
}

export async function waitFriendRequestAdjudicationIdle(
  requestId: string,
  maxMs = 8000,
): Promise<void> {
  const id = requestId.trim()
  const existing = inFlight.get(id)
  if (!existing) return
  await Promise.race([
    existing.catch(() => undefined),
    new Promise<void>((r) => window.setTimeout(r, maxMs)),
  ])
}
