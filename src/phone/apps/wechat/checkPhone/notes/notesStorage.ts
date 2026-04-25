import { personaDb } from '../../newFriendsPersona/idb'
import type { PrivateMemo } from './memoTypes'

const NOTES_KV_PREFIX = 'checkPhone.notes.v1:'

export type NotesState = {
  notes: PrivateMemo[]
  deleted: PrivateMemo[]
}

function notesKey(characterId: string) {
  return `${NOTES_KV_PREFIX}${String(characterId || 'unknown').trim()}`
}

export async function loadNotesState(characterId: string): Promise<NotesState> {
  const raw = await personaDb.getPhoneKv(notesKey(characterId))
  if (Array.isArray(raw)) {
    return { notes: raw as PrivateMemo[], deleted: [] }
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Partial<NotesState>
    return {
      notes: Array.isArray(rec.notes) ? rec.notes : [],
      deleted: Array.isArray(rec.deleted) ? rec.deleted.slice(-5) : [],
    }
  }
  return { notes: [], deleted: [] }
}

export async function saveNotesState(characterId: string, state: NotesState): Promise<void> {
  const normalized: NotesState = {
    notes: Array.isArray(state.notes) ? state.notes : [],
    deleted: Array.isArray(state.deleted) ? state.deleted.slice(-5) : [],
  }
  await personaDb.setPhoneKv(notesKey(characterId), normalized)
}

