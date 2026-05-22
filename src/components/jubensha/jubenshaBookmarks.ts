import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'jubensha-hall-v2'

type Stored = {
  bookmarkedScriptIds?: string[]
}

let bookmarkedIds: string[] = loadFromStorage()
const listeners = new Set<() => void>()

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Stored
    return Array.isArray(parsed.bookmarkedScriptIds) ? parsed.bookmarkedScriptIds : []
  } catch {
    return []
  }
}

function persist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const prev: Stored = raw ? (JSON.parse(raw) as Stored) : {}
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...prev, bookmarkedScriptIds: bookmarkedIds }),
    )
  } catch {
    // ignore
  }
}

function emit() {
  for (const l of listeners) l()
}

export function getBookmarkedScriptIds(): string[] {
  return bookmarkedIds
}

export function isScriptBookmarked(scriptId: string): boolean {
  return bookmarkedIds.includes(scriptId)
}

export function toggleScriptBookmark(scriptId: string): boolean {
  const next = bookmarkedIds.includes(scriptId)
    ? bookmarkedIds.filter((id) => id !== scriptId)
    : [...bookmarkedIds, scriptId]
  bookmarkedIds = next
  persist()
  emit()
  return !next
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function useJubenshaBookmarks() {
  const ids = useSyncExternalStore(subscribe, getBookmarkedScriptIds, getBookmarkedScriptIds)
  return {
    bookmarkedIds: ids,
    isBookmarked: isScriptBookmarked,
    toggleBookmark: toggleScriptBookmark,
  }
}
