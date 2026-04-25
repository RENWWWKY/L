import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatTimeConfig } from '../newFriendsPersona/types'
import { formatWeChatChatTimestamp, normalizeWeChatTimeConfig, parseDateTimeLocalValue, toDateTimeLocalValue } from '../time/wechatTimeUtils'
import { useWeChatCurrentTime } from '../time/useWeChatCurrentTime'

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out" style={{ left: on ? 26 : 4 }} />
    </button>
  )
}

function multiplierText(multiplier: number) {
  return `1 : ${Math.round(multiplier)}`
}

function TimeUnsavedDialog({
  open,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1260] flex items-center justify-center bg-black/30 px-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="w-full max-w-[360px] rounded-[16px] border border-[#e5e5e5] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.12)]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-5 pb-4 pt-5 text-center">
          <h2 className="text-[16px] font-semibold text-[#111111]">未保存修改</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#666666]">你有未保存的时间设置，确定要退出吗？未保存的内容将会丢失。</p>
        </div>
        <div className="grid grid-cols-3 border-t border-[#e5e5e5]">
          <Pressable type="button" className="h-12 text-[14px] text-[#111111] active:bg-[#f5f5f5]" onClick={onCancel}>取消</Pressable>
          <Pressable type="button" className="h-12 border-l border-[#e5e5e5] text-[14px] text-[#666666] active:bg-[#f5f5f5]" onClick={onDiscard}>不保存退出</Pressable>
          <Pressable type="button" className="h-12 border-l border-[#e5e5e5] bg-black text-[14px] text-white active:opacity-90" onClick={onSave}>保存并退出</Pressable>
        </div>
      </div>
    </div>
  )
}

export function ChatTimeSettingsScreen({
  open,
  characterId,
  peerDisplayName,
  onClose,
}: {
  open: boolean
  characterId: string
  peerDisplayName: string
  onClose: () => void
}) {
  const { currentTimeMs } = useWeChatCurrentTime({ characterId })
  const [form, setForm] = useState<WeChatTimeConfig>(() => normalizeWeChatTimeConfig())
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    const [gs, row] = await Promise.all([personaDb.getGlobalSettings(), personaDb.getCharacterTimeSettings(characterId)])
    const config = normalizeWeChatTimeConfig(row?.config ?? gs.globalTimeConfig)
    setForm(config)
    setSavedSnapshot(JSON.stringify(config))
  }, [characterId])

  useEffect(() => {
    if (!open) return
    void load()
  }, [load, open])

  const dirty = savedSnapshot !== JSON.stringify(normalizeWeChatTimeConfig(form))

  const save = useCallback(async () => {
    const next = normalizeWeChatTimeConfig(form)
    await personaDb.putCharacterTimeSettings({ characterId, config: next })
    setSavedSnapshot(JSON.stringify(next))
  }, [characterId, form])

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    onClose()
  }, [dirty, onClose])

  const handleSaveAndExit = useCallback(async () => {
    await save()
    setConfirmOpen(false)
    onClose()
  }, [onClose, save])

  const previewMessageTime = useMemo(() => currentTimeMs - 8 * 24 * 60 * 60 * 1000, [currentTimeMs])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div className="fixed inset-0 z-[1230] bg-black/22" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={requestClose} />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-[1240] mx-auto w-full max-w-[560px] rounded-t-[24px] border border-[#e5e5e5] bg-[#f9f9f9] shadow-[0_-12px_48px_rgba(0,0,0,0.12)]"
            style={{ maxHeight: '92vh' }}
          >
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex shrink-0 items-center border-b border-[#e5e5e5] px-4 pb-3 pt-4">
                <Pressable type="button" aria-label="返回" onClick={requestClose} className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-70">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                </Pressable>
                <div className="min-w-0 flex-1 px-2 text-center">
                  <h2 className="truncate text-[17px] font-semibold text-[#111111]">{peerDisplayName} 的时间设置</h2>
                  <p className="mt-1 text-[12px] text-[#888888]">仅当前角色生效</p>
                </div>
                <div className="w-10 shrink-0" />
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[16px] font-medium text-[#111111]">使用自定义时间</p>
                        <p className="mt-1 text-[13px] text-[#888888]">关闭后该角色回退为系统时间</p>
                      </div>
                      <WxSwitch on={form.mode === 'custom'} onToggle={() => setForm((prev) => ({ ...prev, mode: prev.mode === 'custom' ? 'system' : 'custom', customAnchorRealTime: Date.now() }))} />
                    </div>
                  </section>

                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="rounded-[10px] bg-[#f9f9f9] px-3 py-3">
                      <p className="text-[12px] uppercase tracking-[0.08em] text-[#888888]">当前角色时间</p>
                      <p className="mt-1 text-[20px] font-semibold text-[#111111]">{new Date(currentTimeMs).toLocaleString('zh-CN', { hour12: false })}</p>
                    </div>
                    <div className={`mt-4 ${form.mode === 'custom' ? '' : 'pointer-events-none opacity-45'}`}>
                      <label className="block text-[14px] text-[#333333]">
                        <span>设定当前时间</span>
                        <input
                          type="datetime-local"
                          value={toDateTimeLocalValue(form.customBaseTime)}
                          onChange={(e) => setForm((prev) => ({ ...prev, mode: 'custom', customBaseTime: parseDateTimeLocalValue(e.target.value), customAnchorRealTime: Date.now() }))}
                          className="mt-2 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#111111] outline-none"
                        />
                      </label>
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[14px] text-[#333333]">时间流速</span>
                          <span className="text-[13px] text-[#888888]">{multiplierText(form.timeMultiplier)}</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={240}
                          value={Math.round(form.timeMultiplier)}
                          onChange={(e) => setForm((prev) => ({ ...prev, mode: 'custom', timeMultiplier: Math.max(1, Number(e.target.value) || 1), customBaseTime: currentTimeMs, customAnchorRealTime: Date.now() }))}
                          className="mt-2 w-full accent-black"
                        />
                        <input
                          type="number"
                          min={1}
                          max={86400}
                          step={1}
                          value={Math.round(form.timeMultiplier)}
                          onChange={(e) => setForm((prev) => ({ ...prev, mode: 'custom', timeMultiplier: Math.max(1, Number(e.target.value) || 1), customBaseTime: currentTimeMs, customAnchorRealTime: Date.now() }))}
                          className="mt-3 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#111111] outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <p className="text-[14px] font-medium text-[#111111]">时间戳预览</p>
                    <div className="mt-3 flex justify-center">
                      <span className="text-[12px] text-[#999999]">{formatWeChatChatTimestamp(previewMessageTime, currentTimeMs)}</span>
                    </div>
                  </section>
                </div>
              </div>

              <div className="shrink-0 border-t border-[#e5e5e5] bg-white px-4 pb-4 pt-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}>
                <Pressable type="button" onClick={() => void save()} className="flex h-11 w-full items-center justify-center rounded-[12px] bg-black text-[15px] font-medium text-white transition-opacity active:opacity-90">
                  保存
                </Pressable>
              </div>
            </div>
          </motion.div>

          <TimeUnsavedDialog
            open={confirmOpen}
            onCancel={() => setConfirmOpen(false)}
            onDiscard={() => {
              setConfirmOpen(false)
              onClose()
            }}
            onSave={() => void handleSaveAndExit()}
          />
        </>
      ) : null}
    </AnimatePresence>
  )
}
