export type LogType = 'frontend' | 'backend' | 'indexeddb' | 'ai' | 'error'

export type ConsoleLog = {
  id: string
  timestamp: number
  type: LogType
  content: string
}

const MAX_LOGS = 1000
const listeners = new Set<() => void>()
let logs: ConsoleLog[] = []

function emit() {
  listeners.forEach((l) => {
    try {
      l()
    } catch {
      /* ignore */
    }
  })
}

export function getConsoleLogs(): ConsoleLog[] {
  return logs
}

export function clearConsoleLogs() {
  logs = []
  emit()
}

export function logConsole(type: LogType, content: string) {
  const ts = Date.now()
  const line = String(content ?? '').trim()
  const row: ConsoleLog = {
    id: `log-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: ts,
    type,
    content: line,
  }
  logs = logs.length >= MAX_LOGS ? [...logs.slice(logs.length - (MAX_LOGS - 1)), row] : [...logs, row]
  emit()
}

export function subscribeConsoleLogs(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

let installed = false

/** 全局自动采集：错误与 unhandledrejection（仅内存，不落库） */
export function installGlobalConsoleCapture() {
  if (installed) return
  installed = true

  window.addEventListener('error', (e) => {
    const msg = (e as ErrorEvent).message || '未知错误'
    const file = (e as ErrorEvent).filename ? ` @ ${(e as ErrorEvent).filename}` : ''
    const ln = (e as ErrorEvent).lineno ? `:${(e as ErrorEvent).lineno}` : ''
    const col = (e as ErrorEvent).colno ? `:${(e as ErrorEvent).colno}` : ''
    logConsole('error', `${msg}${file}${ln}${col}`)
  })

  window.addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason
    const msg = r instanceof Error ? r.message : String(r ?? 'Promise rejection')
    logConsole('error', `Promise rejection: ${msg}`)
  })
}

export function formatTs(ts: number): string {
  const d = new Date(ts)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const pad3 = (n: number) => String(n).padStart(3, '0')
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}:${pad3(d.getMilliseconds())}`
}

