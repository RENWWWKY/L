import { personaDb } from './newFriendsPersona/idb'
import {
  parseMemoryTraceData,
  WECHAT_MEMORY_TRACE_KV_KEY,
  type MemoryTraceData,
} from './memoryTraceTypes'

let lastTrace: MemoryTraceData | null = null
const listeners = new Set<() => void>()

export function getLastMemoryTrace(): MemoryTraceData | null {
  return lastTrace
}

export function setLastMemoryTrace(data: MemoryTraceData | null): void {
  lastTrace = data
  listeners.forEach((fn) => fn())
  if (typeof window === 'undefined') return
  void (async () => {
    try {
      if (data) {
        await personaDb.setPhoneKv(WECHAT_MEMORY_TRACE_KV_KEY, data)
      } else {
        await personaDb.runWithIndexedTrashSuspended(async () => {
          await personaDb.deletePhoneKv(WECHAT_MEMORY_TRACE_KV_KEY)
        })
      }
    } catch {
      // 配额或 IDB 失败时不阻断聊天
    }
  })()
}

/** 进入微信时从 IndexedDB 恢复上次发布的溯源（与 {@link setLastMemoryTrace} 成对） */
export async function hydrateMemoryTraceFromIndexedDb(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const raw = await personaDb.getPhoneKv(WECHAT_MEMORY_TRACE_KV_KEY)
    const parsed = parseMemoryTraceData(raw)
    if (parsed) {
      lastTrace = parsed
      listeners.forEach((fn) => fn())
    }
  } catch {
    // ignore
  }
}

export function subscribeLastMemoryTrace(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}
