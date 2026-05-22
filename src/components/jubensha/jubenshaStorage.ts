import { createDefaultPlayRecord, hydrateRecordCompanions } from './mockData'
import type { JubenshaComment, PlayRecord } from './types'

const STORAGE_KEY = 'jubensha-hall-v2'

type Stored = {
  record?: PlayRecord
  extraComments?: Record<string, JubenshaComment[]>
}

export function loadPlayRecord(contactCharacterIds: string[]): PlayRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Stored
      if (parsed.record && typeof parsed.record === 'object') {
        const r = parsed.record as PlayRecord
        return hydrateRecordCompanions(
          {
            ...createDefaultPlayRecord(),
            ...r,
            roleHistory: r.roleHistory ?? createDefaultPlayRecord().roleHistory,
            endingsUnlocked: r.endingsUnlocked ?? r.achievements?.length ?? 0,
          },
          contactCharacterIds,
        )
      }
    }
  } catch {
    // ignore
  }
  return hydrateRecordCompanions(createDefaultPlayRecord(), contactCharacterIds)
}

/** @deprecated */
export const loadJubenshaRecord = loadPlayRecord

export function savePlayRecord(record: PlayRecord) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const prev: Stored = raw ? (JSON.parse(raw) as Stored) : {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, record }))
  } catch {
    // ignore
  }
}

export function loadExtraComments(scriptId: string): JubenshaComment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Stored
    return parsed.extraComments?.[scriptId] ?? []
  } catch {
    return []
  }
}

export function appendComment(scriptId: string, comment: JubenshaComment) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const prev: Stored = raw ? (JSON.parse(raw) as Stored) : {}
    const extra = { ...prev.extraComments }
    extra[scriptId] = [...(extra[scriptId] ?? []), comment]
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, extraComments: extra }))
  } catch {
    // ignore
  }
}
