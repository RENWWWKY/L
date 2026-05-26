import type { ScriptAnnotationStore, ScriptStickyNote } from './scriptAnnotationTypes'

const EMPTY: ScriptAnnotationStore = { notes: [], marks: [], persistStickyNotes: false }

export function scriptAnnotationStorageKey(scriptId: string, roleId: string): string {
  return `jbs-script-annotations-v1-${scriptId}-${roleId}`
}

function normalizeStickyNote(raw: unknown): ScriptStickyNote | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const pageId = typeof o.pageId === 'string' ? o.pageId.trim() : ''
  if (!id || !pageId) return null
  const x = typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : 28
  const y = typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : 22
  const width = typeof o.width === 'number' && o.width > 40 ? o.width : 152
  const height = typeof o.height === 'number' && o.height > 40 ? o.height : 96
  const text = typeof o.text === 'string' ? o.text : ''
  const opaque = typeof o.opaque === 'boolean' ? o.opaque : false
  return { id, pageId, x, y, width, height, text, opaque }
}

export function loadScriptAnnotations(scriptId: string, roleId: string): ScriptAnnotationStore {
  try {
    const raw = sessionStorage.getItem(scriptAnnotationStorageKey(scriptId, roleId))
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<ScriptAnnotationStore>
    const notes: ScriptStickyNote[] = []
    if (Array.isArray(parsed.notes)) {
      for (const item of parsed.notes) {
        const n = normalizeStickyNote(item)
        if (n) notes.push(n)
      }
    }
    return {
      notes,
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      persistStickyNotes: parsed.persistStickyNotes === true,
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveScriptAnnotations(
  scriptId: string,
  roleId: string,
  store: ScriptAnnotationStore,
): void {
  try {
    sessionStorage.setItem(scriptAnnotationStorageKey(scriptId, roleId), JSON.stringify(store))
  } catch {
    // quota / private mode
  }
}
