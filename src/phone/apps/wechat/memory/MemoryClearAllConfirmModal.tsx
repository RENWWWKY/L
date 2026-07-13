import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../components/Pressable'
import type { MemoryArchiveClearScope } from './clearCharacterMemoryArchive'

const SCOPE_OPTIONS: ReadonlyArray<{
  id: MemoryArchiveClearScope
  label: string
  hint: string
}> = [
  { id: 'online', label: '仅线上总结', hint: '长期记忆库条目' },
  { id: 'offline', label: '仅线下摘要', hint: '剧情摘要表与状态' },
  { id: 'both', label: '线上 + 线下', hint: '一并清除' },
]

export function MemoryClearAllConfirmModal({
  open,
  characterName,
  onlineCount,
  offlineCount,
  offlineHasState,
  defaultScope = 'both',
  busy,
  onCancel,
  onConfirm,
  zIndex = 56000,
}: {
  open: boolean
  characterName: string
  onlineCount: number
  offlineCount: number
  offlineHasState?: boolean
  defaultScope?: MemoryArchiveClearScope
  busy?: boolean
  onCancel: () => void
  onConfirm: (scope: MemoryArchiveClearScope) => void
  zIndex?: number
}) {
  const [scope, setScope] = useState<MemoryArchiveClearScope>(defaultScope)

  useEffect(() => {
    if (open) setScope(defaultScope)
  }, [open, defaultScope])

  if (typeof document === 'undefined') return null

  const offlineUnits = offlineCount + (offlineHasState ? 1 : 0)
  const scopeWorkCount =
    scope === 'online'
      ? onlineCount
      : scope === 'offline'
        ? offlineUnits
        : onlineCount + offlineUnits

  const scopeDisabled = (id: MemoryArchiveClearScope) => {
    if (id === 'online') return onlineCount <= 0
    if (id === 'offline') return offlineUnits <= 0
    return onlineCount <= 0 && offlineUnits <= 0
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="memory-clear-all"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-clear-all-title"
          className="fixed inset-0 flex items-center justify-center px-5"
          style={{ zIndex, background: 'rgba(17,24,39,0.32)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="w-full max-w-[min(380px,100vw)] overflow-hidden rounded-[24px] bg-white px-5 pb-5 pt-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="memory-clear-all-title" className="text-center text-[17px] font-semibold text-gray-900">
              清空角色记忆？
            </p>
            <p className="mt-3 text-center text-[14px] leading-relaxed text-gray-500">
              将清除「{characterName}」所选范围内的记忆内容（约{' '}
              <span className="font-medium text-gray-700">{scopeWorkCount}</span> 项）。
              删除后会移入桌面「回收站」，保留约 5 天可手动恢复。
            </p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-gray-400">
              同时会把相关聊天 / 剧情标记为已总结，避免自动总结又把内容写回记忆页。
            </p>

            <div className="mt-4 space-y-2" role="radiogroup" aria-label="清除范围">
              {SCOPE_OPTIONS.map((opt) => {
                const disabled = scopeDisabled(opt.id)
                const active = scope === opt.id
                const countLabel =
                  opt.id === 'online'
                    ? `${onlineCount} 条线上`
                    : opt.id === 'offline'
                      ? `${offlineUnits} 项线下`
                      : `${onlineCount + offlineUnits} 项合计`
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={busy || disabled}
                    onClick={() => setScope(opt.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-800 active:bg-gray-50'
                    }`}
                  >
                    <span>
                      <span className={`block text-[14px] font-semibold ${active ? 'text-white' : ''}`}>
                        {opt.label}
                      </span>
                      <span className={`mt-0.5 block text-[11px] ${active ? 'text-white/70' : 'text-gray-400'}`}>
                        {opt.hint} · {countLabel}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        active ? 'border-white bg-white' : 'border-gray-300'
                      }`}
                      aria-hidden
                    >
                      {active ? <span className="h-2.5 w-2.5 rounded-full bg-gray-900" /> : null}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 flex gap-3">
              <Pressable
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-[14px] font-medium text-gray-800 active:bg-gray-50 disabled:opacity-50"
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                disabled={busy || scopeWorkCount <= 0 || scopeDisabled(scope)}
                onClick={() => onConfirm(scope)}
                className="flex-1 rounded-2xl bg-red-600 py-3 text-[14px] font-semibold text-white active:opacity-90 disabled:opacity-50"
              >
                {busy ? '清空中…' : '确认清空'}
              </Pressable>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
