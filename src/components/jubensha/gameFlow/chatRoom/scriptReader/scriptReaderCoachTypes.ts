export type ScriptReaderCoachStep = {
  target: string | null
  title: string
  body: string
  centered?: boolean
  isOutro?: boolean
}

export const SCRIPT_COACH_TARGET_ATTR = 'data-script-coach'
export const SCRIPT_COACH_ROOT_ATTR = 'data-script-coach-root'

export function scriptCoachTargetSelector(id: string): string {
  return `[${SCRIPT_COACH_TARGET_ATTR}="${id}"]`
}

export function scriptCoachScopedTargetSelector(scopeRoot: string, targetId: string): string {
  return `[${SCRIPT_COACH_ROOT_ATTR}="${scopeRoot}"] ${scriptCoachTargetSelector(targetId)}`
}

export const SCRIPT_READER_COACH_SEEN_KEY = 'script-reader-annotate-coach-seen-v1'

export function readScriptReaderCoachSeen(): boolean {
  try {
    return localStorage.getItem(SCRIPT_READER_COACH_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeScriptReaderCoachSeen(): void {
  try {
    localStorage.setItem(SCRIPT_READER_COACH_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}
