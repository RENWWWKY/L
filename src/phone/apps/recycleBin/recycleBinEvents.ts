export const INDEXED_TRASH_RETENTION_MS = 5 * 24 * 60 * 60 * 1000

export const INDEXED_TRASH_CHANGED_EVENT = 'indexed-trash-changed'

export function emitIndexedTrashChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(INDEXED_TRASH_CHANGED_EVENT))
}
