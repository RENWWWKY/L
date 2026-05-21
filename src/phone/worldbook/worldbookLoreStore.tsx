/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import {
  normalizeArchiveEntryPartial,
  type LoreArchiveStoreShapeV2,
  type LoreArchiveStoreShapeV3,
  type LoreEntry,
} from './loreArchiveTypes'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../apps/wechat/newFriendsPersona/idb'

export const LUMI_LORE_ARCHIVE_KV_KEY = 'lumi-lore-archive-v1'

type Snap = { entries: LoreEntry[]; hydrated: boolean }

let snap: Snap = { entries: [], hydrated: false }
const listeners = new Set<() => void>()
let persistTimer: ReturnType<typeof setTimeout> | null = null

function emit() {
  listeners.forEach((l) => l())
}

/** v1 / 无 version 字段时的法则条目 */
function parseLegacyLoreFlat(raw: unknown): LoreEntry[] {
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as Record<string, unknown>).entries
  if (!Array.isArray(arr)) return []
  const out: LoreEntry[] = []
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id.trim() : ''
    if (!id) continue
    const hasNewShape = o.plateScope != null || o.characterScope != null
    if (hasNewShape) {
      const e = normalizeArchiveEntryPartial(o as Record<string, unknown>)
      if (e) out.push(e)
      continue
    }
    const isGlobal = o.isGlobal === true
    const targetIds = Array.isArray(o.targetIds)
      ? o.targetIds.map((x) => String(x ?? '').trim()).filter(Boolean)
      : []
    out.push({
      id,
      title: typeof o.title === 'string' ? o.title : '',
      content: typeof o.content === 'string' ? o.content : '',
      enabled: true,
      plateScope: { mode: 'all' },
      characterScope: isGlobal ? { mode: 'all' } : { mode: 'characters', ids: targetIds },
      updatedAt: typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : Date.now(),
    })
  }
  return out
}

function parseArchiveEntriesArray(raw: unknown): LoreEntry[] {
  if (!Array.isArray(raw)) return []
  const out: LoreEntry[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const e = normalizeArchiveEntryPartial(it as Record<string, unknown>)
    if (e) out.push(e)
  }
  return out
}

function migrateV2ToUnified(v2: LoreArchiveStoreShapeV2): LoreEntry[] {
  const out: LoreEntry[] = []
  for (const e of v2.entries) {
    out.push({
      id: e.id,
      title: e.title,
      content: e.content,
      enabled: true,
      plateScope: { mode: 'all' },
      characterScope: e.isGlobal ? { mode: 'all' } : { mode: 'characters', ids: e.targetIds ?? [] },
      updatedAt: e.updatedAt,
    })
  }
  for (const wb of v2.wechat?.worldBooks ?? []) {
    for (const it of wb.items ?? []) {
      out.push({
        id: `${wb.id}::${it.id}`,
        title: `${wb.name}｜${it.name}`,
        content: typeof it.content === 'string' ? it.content : '',
        enabled: wb.enabled !== false && it.enabled !== false,
        plateScope: wb.scope,
        characterScope: { mode: 'all' },
        updatedAt: Math.max(wb.updatedAt ?? 0, it.updatedAt ?? 0) || Date.now(),
      })
    }
  }
  return out
}

function parseStore(raw: unknown): LoreEntry[] {
  if (!raw || typeof raw !== 'object') return []
  const rec = raw as Record<string, unknown>
  const ver = rec.version

  if (ver === 3) {
    const v3 = rec as LoreArchiveStoreShapeV3
    return parseArchiveEntriesArray(v3.entries)
  }

  if (ver === 2) {
    return migrateV2ToUnified(rec as unknown as LoreArchiveStoreShapeV2)
  }

  return parseLegacyLoreFlat(raw)
}

function schedulePersist() {
  if (persistTimer != null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const payload: LoreArchiveStoreShapeV3 = {
      version: 3,
      entries: snap.entries,
      weibo: { _reserved: true },
    }
    void personaDb.setPhoneKv(LUMI_LORE_ARCHIVE_KV_KEY, payload).catch(() => {})
    try {
      localStorage.setItem(LUMI_LORE_ARCHIVE_KV_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, 520)
}

export function getWorldbookLoreEntriesSnapshot(): LoreEntry[] {
  return snap.entries
}

export function subscribeWorldbookLore(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnap(): Snap {
  return snap
}

export function upsertLoreEntry(entry: LoreEntry) {
  const next = [...snap.entries.filter((e) => e.id !== entry.id), entry].sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  )
  snap = { ...snap, entries: next }
  emit()
  schedulePersist()
}

export function removeLoreEntry(id: string) {
  const tid = String(id || '').trim()
  if (!tid) return
  const next = snap.entries.filter((e) => e.id !== tid)
  snap = { ...snap, entries: next }
  emit()
  schedulePersist()
}

/** 微信深度注销：清空档案室内存并删除持久化键（由 {@link LUMI_LORE_ARCHIVE_KV_KEY} 承载） */
export function resetWorldbookLoreArchiveAfterWeChatErase(): void {
  snap = { entries: [], hydrated: true }
  emit()
  void personaDb.deletePhoneKv(LUMI_LORE_ARCHIVE_KV_KEY).catch(() => {})
  try {
    localStorage.removeItem(LUMI_LORE_ARCHIVE_KV_KEY)
  } catch {
    // ignore
  }
}

export function WorldbookLoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const raw = await pullPhoneKvWithLocalStorageLegacy(LUMI_LORE_ARCHIVE_KV_KEY, [LUMI_LORE_ARCHIVE_KV_KEY])
        if (cancelled) return
        const entries = parseStore(raw)
        snap = { entries, hydrated: true }
        emit()
        schedulePersist()
      } catch {
        if (!cancelled) {
          snap = { ...snap, hydrated: true }
          emit()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return children
}

export function useWorldbookStore() {
  const state = useSyncExternalStore(subscribeWorldbookLore, getSnap, getSnap)
  return useMemo(
    () => ({
      hydrated: state.hydrated,
      entries: state.entries,
      upsertEntry: upsertLoreEntry,
      removeEntry: removeLoreEntry,
    }),
    [state.entries, state.hydrated],
  )
}
