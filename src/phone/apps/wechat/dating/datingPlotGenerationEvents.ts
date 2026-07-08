/** 线下约会剧情后台生成：进行中计数 + 完成/失败全局提示 */

export const DATING_PLOT_GENERATION_COMPLETE_EVENT = 'dating-plot-generation-complete'
export const DATING_PLOT_GENERATION_ERROR_EVENT = 'dating-plot-generation-error'

export type DatingPlotGenerationCompleteDetail = {
  characterId: string
  characterName: string
  linkedNpcNames: string[]
  /** 开启配图但未成功展示时的提示（如解析失败、CORS 等） */
  plotImageWarning?: string
}

export type DatingPlotGenerationErrorDetail = {
  characterId: string
  characterName: string
  message: string
}

const pendingByChar = new Map<string, number>()
const contentHintChars = new Set<string>()
const genListeners = new Set<() => void>()
const contentHintListeners = new Set<() => void>()

function emitGenChange() {
  for (const fn of genListeners) fn()
}

function emitContentHintChange() {
  for (const fn of contentHintListeners) fn()
}

export function subscribeDatingPlotGeneration(onStoreChange: () => void): () => void {
  genListeners.add(onStoreChange)
  return () => genListeners.delete(onStoreChange)
}

/** 剧情正文已写入 feed 前：底部「后台生成中」提示 */
export function subscribeDatingPlotContentHint(onStoreChange: () => void): () => void {
  contentHintListeners.add(onStoreChange)
  return () => contentHintListeners.delete(onStoreChange)
}

export function isDatingPlotContentHintActive(characterId: string): boolean {
  const id = characterId.trim()
  if (!id) return false
  return contentHintChars.has(id)
}

export function isDatingPlotGenerating(characterId: string): boolean {
  const id = characterId.trim()
  if (!id) return false
  return (pendingByChar.get(id) ?? 0) > 0
}

export function getDatingPlotGeneratingSnapshot(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of pendingByChar) {
    if (v > 0) out[k] = v
  }
  return out
}

export function beginDatingPlotGeneration(characterId: string): void {
  const id = characterId.trim()
  if (!id) return
  pendingByChar.set(id, (pendingByChar.get(id) ?? 0) + 1)
  emitGenChange()
}

export function endDatingPlotGeneration(characterId: string): void {
  const id = characterId.trim()
  if (!id) return
  const next = (pendingByChar.get(id) ?? 1) - 1
  if (next <= 0) pendingByChar.delete(id)
  else pendingByChar.set(id, next)
  emitGenChange()
}

export function beginDatingPlotContentHint(characterId: string): void {
  const id = characterId.trim()
  if (!id) return
  contentHintChars.add(id)
  emitContentHintChange()
}

/** 剧情正文已展示或任务失败时调用；可重复调用。 */
export function endDatingPlotContentHint(characterId: string): void {
  const id = characterId.trim()
  if (!id) return
  if (!contentHintChars.delete(id)) return
  emitContentHintChange()
}

export function dispatchDatingPlotGenerationComplete(detail: DatingPlotGenerationCompleteDetail) {
  if (typeof window === 'undefined') return
  const name = detail.characterName.trim()
  if (!name) return
  window.dispatchEvent(
    new CustomEvent<DatingPlotGenerationCompleteDetail>(DATING_PLOT_GENERATION_COMPLETE_EVENT, {
      detail: {
        characterId: detail.characterId.trim(),
        characterName: name,
        linkedNpcNames: (detail.linkedNpcNames ?? []).map((n) => String(n).trim()).filter(Boolean),
        plotImageWarning: detail.plotImageWarning?.trim() || undefined,
      },
    }),
  )
}

export function dispatchDatingPlotGenerationError(detail: DatingPlotGenerationErrorDetail) {
  if (typeof window === 'undefined') return
  const msg = detail.message.trim()
  if (!msg) return
  window.dispatchEvent(
    new CustomEvent<DatingPlotGenerationErrorDetail>(DATING_PLOT_GENERATION_ERROR_EVENT, {
      detail: {
        characterId: detail.characterId.trim(),
        characterName: detail.characterName.trim() || '约会角色',
        message: msg,
      },
    }),
  )
}
