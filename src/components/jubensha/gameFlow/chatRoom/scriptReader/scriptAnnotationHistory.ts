import type { ScriptAnnotationStore } from './scriptAnnotationTypes'

export const ANNOTATION_HISTORY_MAX = 50

export function cloneAnnotationStore(store: ScriptAnnotationStore): ScriptAnnotationStore {
  return JSON.parse(JSON.stringify(store)) as ScriptAnnotationStore
}

export function annotationStoresEqual(a: ScriptAnnotationStore, b: ScriptAnnotationStore): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
