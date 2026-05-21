export type MemoryCoachStep = {
  target: string | null
  title: string
  body: string
  centered?: boolean
  isOutro?: boolean
}

export const MEMORY_COACH_TARGET_ATTR = 'data-memory-coach'
export const MEMORY_COACH_ROOT_ATTR = 'data-memory-coach-root'

export function memoryCoachTargetSelector(id: string): string {
  return `[${MEMORY_COACH_TARGET_ATTR}="${id}"]`
}

/** 在指定容器内查找高亮目标，避免编辑页与档案馆两个「教程」按钮串台 */
export function memoryCoachScopedTargetSelector(scopeRoot: string, targetId: string): string {
  return `[${MEMORY_COACH_ROOT_ATTR}="${scopeRoot}"] ${memoryCoachTargetSelector(targetId)}`
}

export const MEMORY_ARCHIVE_COACH_SEEN_KEY = 'memory-archive-coach-completed-v1'
export const MEMORY_EDITOR_COACH_SEEN_KEY = 'memory-editor-coach-completed-v1'
export const MEMORY_ENGINE_COACH_SEEN_KEY = 'memory-engine-coach-completed-v1'

export function readMemoryCoachSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeMemoryCoachSeen(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}
