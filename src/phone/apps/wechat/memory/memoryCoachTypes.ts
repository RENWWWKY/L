export type MemoryCoachStep = {
  target: string | null
  title: string
  body: string
  centered?: boolean
  isOutro?: boolean
  /** 说明卡片优先放在高亮区域上方或下方，避免挡住目标 */
  cardPlacement?: 'auto' | 'above' | 'below'
}

export const MEMORY_COACH_TARGET_ATTR = 'data-memory-coach'
export const MEMORY_COACH_ROOT_ATTR = 'data-memory-coach-root'

export function memoryCoachTargetSelector(id: string): string {
  return `[${MEMORY_COACH_TARGET_ATTR}="${id}"]`
}

/** 在指定容器内查找高亮目标，避免编辑页与档案馆两个「教程」按钮串台 */
export function memoryCoachScopedTargetSelector(
  scopeRoot: string,
  targetId: string,
  rootAttr = MEMORY_COACH_ROOT_ATTR,
  targetAttr = MEMORY_COACH_TARGET_ATTR,
): string {
  return `[${rootAttr}="${scopeRoot}"] [${targetAttr}="${targetId}"]`
}

export const PERSONA_COACH_TARGET_ATTR = 'data-persona-coach'
export const PERSONA_COACH_ROOT_ATTR = 'data-persona-coach-root'

export const PERSONA_RELATIONS_COACH_SEEN_KEY = 'persona-relations-coach-seen-v1'
export const PERSONA_ANCHOR_EDITOR_COACH_SEEN_KEY = 'persona-anchor-editor-coach-seen-v1'
export const PERSONA_GRAPH_COACH_SEEN_KEY = 'persona-graph-coach-seen-v1'

export function readPersonaCoachSeen(key: string): boolean {
  return readMemoryCoachSeen(key)
}

export function writePersonaCoachSeen(key: string): void {
  writeMemoryCoachSeen(key)
}

export const MEMORY_HUB_COACH_SEEN_KEY = 'memory-hub-coach-completed-v1'
export const MEMORY_ARCHIVE_COACH_SEEN_KEY = 'memory-archive-coach-completed-v3'
/** 进入某位角色的总结详情页（线上/线下/待办） */
export const MEMORY_ARCHIVE_DETAIL_COACH_SEEN_KEY = 'memory-archive-detail-coach-completed-v2'
export const MEMORY_PROGRESS_COACH_SEEN_KEY = 'memory-progress-coach-completed-v1'
export const MEMORY_RETRY_COACH_SEEN_KEY = 'memory-retry-coach-completed-v1'
export const MEMORY_EPILOGUE_COACH_SEEN_KEY = 'memory-epilogue-coach-completed-v1'
export const MEMORY_EDITOR_COACH_SEEN_KEY = 'memory-editor-coach-completed-v1'
export const MEMORY_ENGINE_COACH_SEEN_KEY = 'memory-engine-coach-completed-v2'

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
