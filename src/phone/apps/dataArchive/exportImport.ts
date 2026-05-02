import { ARCHIVE_KIND, ARCHIVE_VERSION } from './constants'
import {
  dumpWeChatPersonaIndexedDbSnapshot,
  restoreWeChatPersonaIndexedDbSnapshot,
} from './scanWeChatPersonaIndexedDb'

export type LumiCloudArchive = {
  kind: typeof ARCHIVE_KIND
  /** 1：仅 localStorage；2：含 wechatIndexedDb */
  version: 1 | 2
  exportedAt: number
  localStorage: Record<string, string | null>
  wechatIndexedDb?: {
    dbName: string
    dbVersion: number
    stores: Record<string, unknown[]>
  }
  meta: { generator: string; note?: string }
}

export function collectLocalStorageSnapshot(): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (typeof localStorage === 'undefined') return out
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key) continue
    out[key] = localStorage.getItem(key)
  }
  return out
}

/** 默认归档主文件名（不含 .lumi） */
export function defaultLumiArchiveBaseName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Lumi_Archive_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

function sanitizeUserArchiveBaseName(input: string): string {
  let t = input.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim()
  t = t.replace(/\.lumi$/i, '')
  t = t.replace(/^\.+/, '').replace(/\.+$/g, '').trim()
  if (t.length > 100) t = t.slice(0, 100)
  return t
}

/** 生成安全下载文件名，始终带 .lumi 后缀 */
export function buildLumiArchiveDownloadFilename(userLabel: string | null | undefined): string {
  const cleaned = sanitizeUserArchiveBaseName(userLabel ?? '')
  const base = cleaned || defaultLumiArchiveBaseName()
  return `${base}.lumi`
}

export async function exportDataToFile(options?: {
  /** 用户自定义主文件名，可不含后缀；非法字符会替换为下划线 */
  displayName?: string | null
}): Promise<{ blob: Blob; filename: string }> {
  const idbSnap = await dumpWeChatPersonaIndexedDbSnapshot()
  const payload: LumiCloudArchive = {
    kind: ARCHIVE_KIND,
    version: ARCHIVE_VERSION,
    exportedAt: Date.now(),
    localStorage: collectLocalStorageSnapshot(),
    ...(idbSnap ? { wechatIndexedDb: idbSnap } : {}),
    meta: {
      generator: 'Lumi Phone · Data Archive',
      note: idbSnap
        ? '含 localStorage 与当前已接入的 IndexedDB 全表快照。'
        : '含 localStorage；未发现已接入的 IndexedDB（若尚未产生索引数据则属正常）。',
    },
  }
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const filename = buildLumiArchiveDownloadFilename(options?.displayName)
  return { blob, filename }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2500)
}

export type ImportArchiveResult = { keysRestored: number; indexedDbRestored: boolean }

/**
 * 从 .lumi / .json 恢复。v1 仅 localStorage；v2 另写回归档内附带的 IndexedDB 主库（须本机已有对应库结构）。
 */
export async function importDataFromFile(text: string): Promise<ImportArchiveResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('文件不是有效的 JSON，无法解析。')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('归档格式无效（根节点须为对象）。')
  const o = parsed as Record<string, unknown>
  if (o.kind !== ARCHIVE_KIND) throw new Error('不是 Lumi 数据中心归档文件（缺少识别标记）。')
  const ver = Number(o.version)
  if (ver !== 1 && ver !== 2) throw new Error(`不支持的归档版本：${String(o.version)}（支持 1 或 2）。`)

  let indexedDbRestored = false
  if (ver >= 2) {
    const idb = o.wechatIndexedDb
    if (idb && typeof idb === 'object' && !Array.isArray(idb)) {
      const stores = (idb as Record<string, unknown>).stores
      if (stores && typeof stores === 'object' && !Array.isArray(stores)) {
        await restoreWeChatPersonaIndexedDbSnapshot(stores as Record<string, unknown[]>)
        indexedDbRestored = true
      }
    }
  }

  const snap = o.localStorage
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
    throw new Error('归档中缺少 localStorage 快照。')
  }
  const entries = Object.entries(snap as Record<string, unknown>)
  let n = 0
  for (const [k, v] of entries) {
    if (typeof k !== 'string' || !k.trim()) continue
    if (v === null || v === undefined) {
      localStorage.removeItem(k)
    } else if (typeof v === 'string') {
      localStorage.setItem(k, v)
    } else {
      localStorage.setItem(k, JSON.stringify(v))
    }
    n += 1
  }
  return { keysRestored: n, indexedDbRestored }
}
