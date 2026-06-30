/** 开发态渲染探针：localStorage `wx-chat-render-probe=1` 或 URL `?wxChatRenderProbe=1` 开启 */
export function isChatRenderProbeEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem('wx-chat-render-probe') === '1') return true
  } catch {
    /* ignore */
  }
  try {
    return new URLSearchParams(window.location.search).get('wxChatRenderProbe') === '1'
  } catch {
    return false
  }
}

export function probeChatRender(component: string): void {
  if (!isChatRenderProbeEnabled()) return
  console.log(`[wx-chat-render] ${component}`)
}

type DepBag = Record<string, unknown>

const depProbeStore = new Map<string, DepBag>()

/** 探针开启时：记录 useMemo/useCallback 依赖变更项（便于定位 messagesView 为何失效） */
export function probeMemoDeps(label: string, deps: DepBag): void {
  if (!isChatRenderProbeEnabled()) return
  const prev = depProbeStore.get(label)
  if (!prev) {
    depProbeStore.set(label, deps)
    return
  }
  const changed: string[] = []
  for (const key of Object.keys(deps)) {
    if (!Object.is(prev[key], deps[key])) changed.push(key)
  }
  if (changed.length > 0) {
    console.log(`[wx-chat-render] ${label} deps:`, changed.join(', '))
  }
  depProbeStore.set(label, deps)
}
