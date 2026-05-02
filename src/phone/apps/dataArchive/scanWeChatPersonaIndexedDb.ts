import { WECHAT_PERSONA_DB_NAME } from './constants'
import type { StorageSegment } from './scanLocalStorage'

const te = new TextEncoder()

/** 遍历对象估算序列化体积（含 base64 图片等），遇环引用则不再重复计数 */
function estimateRecordBytes(value: unknown, depth = 0, seen = new WeakSet<object>()): number {
  if (depth > 28) return 8
  if (value === null || value === undefined) return 0
  const t = typeof value
  if (t === 'boolean') return 4
  if (t === 'number') return 8
  if (t === 'bigint') return 16
  if (t === 'string') {
    try {
      return te.encode(value).length
    } catch {
      return value.length * 2
    }
  }
  if (t !== 'object') return 32

  const o = value as object
  if (o instanceof ArrayBuffer) return o.byteLength
  if (ArrayBuffer.isView(o)) return o.byteLength
  if (typeof Blob !== 'undefined' && o instanceof Blob) return o.size

  if (seen.has(o)) return 0
  seen.add(o)

  if (Array.isArray(value)) {
    let sum = 0
    for (const x of value) sum += estimateRecordBytes(x, depth + 1, seen)
    return sum
  }

  if (typeof Date !== 'undefined' && value instanceof Date) return 16

  let sum = 0
  for (const key of Object.keys(value as Record<string, unknown>)) {
    try {
      sum += te.encode(key).length
      sum += estimateRecordBytes((value as Record<string, unknown>)[key], depth + 1, seen)
    } catch {
      sum += 64
    }
  }
  return sum
}

/** 与 `idb.ts` 各 object store 对应的中文归类（同桶内体积相加） */
function idbStoreNameToLabel(storeName: string): string {
  const map: Record<string, string> = {
    chatMessages: '微信 · 聊天记录',
    characters: '微信 · 人设与人设卡',
    friendRequests: '微信 · 新的朋友与申请',
    characterMemories: '微信 · 记忆与 AI 摘要',
    memorySettings: '微信 · 记忆与 AI 摘要',
    relationships: '微信 · 关系与人脉图',
    networkGraphViews: '微信 · 关系与人脉图',
    playerNetworkLinks: '微信 · 关系与人脉图',
    playerIdentities: '微信 · 身份与群聊',
    groupChats: '微信 · 身份与群聊',
    chatConversationSettings: '微信 · 身份与群聊',
    heartWhispers: '微信 · 心语与收藏',
    favorites: '微信 · 心语与收藏',
    chatTheme: '微信 · 主题与世界背景',
    worldBackgrounds: '微信 · 主题与世界背景',
    characterDanmakuSettings: '微信 · 通知与在线状态',
    characterNotificationSettings: '微信 · 通知与在线状态',
    characterBusySettings: '微信 · 通知与在线状态',
    characterTimeSettings: '微信 · 通知与在线状态',
    appConfig: '微信 · 应用配置',
    globalSettings: '微信 · 应用配置',
    phoneKv: 'IndexedDB · 应用共用缓存',
  }
  return map[storeName] ?? `IndexedDB · ${storeName}`
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction error'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function sumStoreBytes(store: IDBObjectStore): Promise<number> {
  return new Promise((resolve, reject) => {
    let sum = 0
    const req = store.openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) {
        resolve(sum)
        return
      }
      sum += estimateRecordBytes(cur.value)
      cur.continue()
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB cursor error'))
  })
}

async function personaDbExists(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  if (typeof indexedDB.databases !== 'function') return true
  try {
    const list = await indexedDB.databases()
    return list.some((d) => d.name === WECHAT_PERSONA_DB_NAME)
  } catch {
    return true
  }
}

function openPersonaDbReadonly(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(WECHAT_PERSONA_DB_NAME)
    req.onerror = () => resolve(null)
    req.onsuccess = () => resolve(req.result)
  })
}

/**
 * 扫描微信人设库 IndexedDB，按 object store 聚合并估算每条记录的体积。
 * 仅只读打开，不触发升级；数据库不存在时返回空。
 */
export async function scanWeChatPersonaIndexedDbSegments(): Promise<{
  segments: StorageSegment[]
  totalBytes: number
}> {
  if (typeof indexedDB === 'undefined') return { segments: [], totalBytes: 0 }

  const exists = await personaDbExists()
  if (!exists) return { segments: [], totalBytes: 0 }

  const db = await openPersonaDbReadonly()
  if (!db) return { segments: [], totalBytes: 0 }

  try {
    const storeNames = [...db.objectStoreNames]
    if (!storeNames.length) return { segments: [], totalBytes: 0 }

    const bucket = new Map<string, number>()
    // 每 store 单独只读事务：避免在单事务内 await 游标导致部分浏览器提前 commit
    for (const sn of storeNames) {
      const tx = db.transaction(sn, 'readonly')
      const bytes = await sumStoreBytes(tx.objectStore(sn))
      await txDone(tx)
      if (bytes <= 0) continue
      const label = idbStoreNameToLabel(sn)
      bucket.set(label, (bucket.get(label) ?? 0) + bytes)
    }

    const total = [...bucket.values()].reduce((a, b) => a + b, 0)
    const segments: StorageSegment[] = [...bucket.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, size]) => ({
        name,
        size,
        percentage: total > 0 ? (size / total) * 100 : 0,
      }))

    return { segments, totalBytes: total }
  } finally {
    db.close()
  }
}

function getAllFromStore(store: IDBObjectStore): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const r = store.getAll()
    r.onsuccess = () => resolve((r.result as unknown[]) ?? [])
    r.onerror = () => reject(r.error ?? new Error('IndexedDB getAll failed'))
  })
}

const IDB_RESTORE_BATCH = 450

/** 导出归档用：拉取微信库全部 object store 记录（体积大时 JSON 会很大） */
export async function dumpWeChatPersonaIndexedDbSnapshot(): Promise<{
  dbName: string
  dbVersion: number
  stores: Record<string, unknown[]>
} | null> {
  if (typeof indexedDB === 'undefined') return null

  const exists = await personaDbExists()
  if (!exists) return null

  const db = await openPersonaDbReadonly()
  if (!db) return null

  try {
    const storeNames = [...db.objectStoreNames]
    if (!storeNames.length) return null

    const stores: Record<string, unknown[]> = {}
    const dbVersion = db.version

    for (const sn of storeNames) {
      const tx = db.transaction(sn, 'readonly')
      const all = await getAllFromStore(tx.objectStore(sn))
      await txDone(tx)
      stores[sn] = all
    }

    return { dbName: WECHAT_PERSONA_DB_NAME, dbVersion, stores }
  } finally {
    db.close()
  }
}

/**
 * 自归档恢复微信库：按当前库中已有 object store 清空并重写。
 * 若本机从未创建过该库，会抛错（需先打开过一次微信）。
 */
export async function restoreWeChatPersonaIndexedDbSnapshot(
  stores: Record<string, unknown[]>,
): Promise<void> {
  if (!stores || typeof stores !== 'object') return

  const db = await openPersonaDbReadonly()
  if (!db) {
    throw new Error('未检测到微信人设数据库。请先在本机打开过一次「微信」，再导入含 IndexedDB 的归档。')
  }

  try {
    const existingStores = [...db.objectStoreNames]
    if (!existingStores.length) {
      throw new Error('微信人设数据库为空结构，无法导入。请先在本机打开过一次「微信」。')
    }

    for (const sn of existingStores) {
      const rows = stores[sn]
      const clearTx = db.transaction(sn, 'readwrite')
      clearTx.objectStore(sn).clear()
      await txDone(clearTx)

      if (!Array.isArray(rows) || rows.length === 0) continue

      for (let i = 0; i < rows.length; i += IDB_RESTORE_BATCH) {
        const chunk = rows.slice(i, i + IDB_RESTORE_BATCH)
        const putTx = db.transaction(sn, 'readwrite')
        const st = putTx.objectStore(sn)
        for (const row of chunk) {
          try {
            st.put(row as object)
          } catch {
            /* 单条损坏则跳过，避免整包失败 */
          }
        }
        await txDone(putTx)
      }
    }
  } finally {
    db.close()
  }
}
