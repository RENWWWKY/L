/**
 * Lumi 转账持久化：localStorage + 时间戳驱动 24h 自动退还（不依赖定时器持久化）。
 */

export type LumiTransferStatus = 'pending' | 'accepted' | 'returned'

export interface LumiTransferRecord {
  id: string
  amount: number
  remark?: string
  senderId: string
  receiverId: string
  status: LumiTransferStatus
  createdAt: number
  expiresAt: number
  acceptedAt?: number
  conversationKey: string
  messageId: string
}

const LS_KEY = 'wechat-lumi-transfers-v1'

function readAll(): LumiTransferRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is LumiTransferRecord => isRecord(x))
  } catch {
    return []
  }
}

function isRecord(x: unknown): x is LumiTransferRecord {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.amount === 'number' &&
    typeof r.senderId === 'string' &&
    typeof r.receiverId === 'string' &&
    (r.status === 'pending' || r.status === 'accepted' || r.status === 'returned') &&
    typeof r.createdAt === 'number' &&
    typeof r.expiresAt === 'number' &&
    typeof r.conversationKey === 'string' &&
    typeof r.messageId === 'string'
  )
}

function writeAll(list: LumiTransferRecord[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
  emitLumiTransferChanged()
}

export function emitLumiTransferChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('lumi-transfer-changed'))
}

/** 将仍 pending 且已过期的记录标记为 returned */
export function evaluateExpiredTransfers(getCurrentTime: () => number): void {
  const now = getCurrentTime()
  const list = readAll()
  let changed = false
  for (const t of list) {
    if (t.status === 'pending' && now >= t.expiresAt) {
      t.status = 'returned'
      changed = true
    }
  }
  if (changed) writeAll(list)
}

export function getLumiTransferFresh(id: string, getCurrentTime: () => number): LumiTransferRecord | null {
  const tid = id.trim()
  if (!tid) return null
  evaluateExpiredTransfers(getCurrentTime)
  return readAll().find((x) => x.id === tid) ?? null
}

export function upsertLumiTransfer(record: LumiTransferRecord): void {
  const list = readAll()
  const i = list.findIndex((x) => x.id === record.id)
  if (i >= 0) list[i] = record
  else list.push(record)
  writeAll(list)
}

export function acceptLumiTransfer(transferId: string, getCurrentTime: () => number): boolean {
  evaluateExpiredTransfers(getCurrentTime)
  const list = readAll()
  const t = list.find((x) => x.id === transferId.trim())
  if (!t || t.status !== 'pending') return false
  t.status = 'accepted'
  t.acceptedAt = getCurrentTime()
  writeAll(list)
  return true
}

/** 收款方主动退还/拒收（pending 才允许） */
export function returnLumiTransfer(transferId: string, getCurrentTime: () => number): boolean {
  evaluateExpiredTransfers(getCurrentTime)
  const list = readAll()
  const t = list.find((x) => x.id === transferId.trim())
  if (!t || t.status !== 'pending') return false
  t.status = 'returned'
  writeAll(list)
  return true
}

export function listLumiTransfersForPlayer(playerIdentityId: string): LumiTransferRecord[] {
  const pid = playerIdentityId.trim()
  if (!pid) return []
  return readAll().filter((x) => x.senderId === pid || x.receiverId === pid)
}
