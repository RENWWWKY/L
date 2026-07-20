import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { useCustomization } from '../../../CustomizationContext'
import { phoneNumStyle } from '../../../types'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatTimeConfig } from '../newFriendsPersona/types'
import {
  applyOnlineChatTimeFusion,
  formatStoryTimeClockFromMs,
  isWeChatClockAlignedWithStoryFloor,
  resolveCharacterStoryTimeFloor,
  syncStoryTimelineNowFromOnlineClock,
  type StoryTimeFloorInfo,
} from '../time/applyOnlineChatTimeFusion'
import {
  formatWeChatChatTimestamp,
  isCharacterTimePerceptionEnabled,
  normalizeWeChatTimeConfig,
  parseDateTimeLocalValue,
  resolveWeChatCurrentTimeMs,
  toDateTimeLocalValue,
} from '../time/wechatTimeUtils'
import { useWeChatCurrentTime } from '../time/useWeChatCurrentTime'
import {
  composeStoryTimelineCalendarAnchorLabel,
  formatGregorianStoryDayFromMs,
} from '../memory/storyTimelineTypes'

function WxSwitch({
  on,
  onToggle,
  disabled,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-45"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
      />
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
    <div
      className="fixed inset-0 z-[1260] flex items-center justify-center bg-black/30 px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-[360px] rounded-[16px] border border-[#e5e5e5] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-4 pt-5 text-center">
          <h2 className="text-[16px] font-semibold text-[#111111]">未保存修改</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#666666]">
            你有未保存的时间设置，确定要退出吗？未保存的内容将会丢失。
          </p>
        </div>
        <div className="grid grid-cols-3 border-t border-[#e5e5e5]">
          <Pressable type="button" className="h-12 text-[14px] text-[#111111] active:bg-[#f5f5f5]" onClick={onCancel}>
            取消
          </Pressable>
          <Pressable
            type="button"
            className="h-12 border-l border-[#e5e5e5] text-[14px] text-[#666666] active:bg-[#f5f5f5]"
            onClick={onDiscard}
          >
            不保存退出
          </Pressable>
          <Pressable
            type="button"
            className="h-12 border-l border-[#e5e5e5] bg-black text-[14px] text-white active:opacity-90"
            onClick={onSave}
          >
            保存并退出
          </Pressable>
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
  const { state } = useCustomization()
  const disableTransitions = state.ui.disablePageTransitions
  const { currentTimeMs, reload } = useWeChatCurrentTime({ characterId })
  const [form, setForm] = useState<WeChatTimeConfig>(() => normalizeWeChatTimeConfig())
  const [timePerceptionEnabled, setTimePerceptionEnabled] = useState(true)
  const [storyFloor, setStoryFloor] = useState<StoryTimeFloorInfo>({
    label: '',
    floorMs: null,
    hasFloor: false,
  })
  const [floorHint, setFloorHint] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const lockedByStory = storyFloor.hasFloor && storyFloor.floorMs != null

  const load = useCallback(async () => {
    const cid = characterId.trim()
    if (!cid) return
    const [gs, row, floor] = await Promise.all([
      personaDb.getGlobalSettings(),
      personaDb.getCharacterTimeSettings(cid),
      resolveCharacterStoryTimeFloor(cid),
    ])
    let config = normalizeWeChatTimeConfig(row?.config ?? gs.globalTimeConfig)
    let perception = isCharacterTimePerceptionEnabled(row)
    let hint = ''
    if (floor.hasFloor && floor.floorMs != null) {
      perception = true
      const live = resolveWeChatCurrentTimeMs(config)
      const aligned = isWeChatClockAlignedWithStoryFloor(live, floor.floorMs, config.mode)
      if (!aligned) {
        // 有剧情锚点时，线上「现在」须落在剧情日历上（默认=锚点）；不能拿真实墙钟 Math.max 糊弄
        config = normalizeWeChatTimeConfig({
          ...config,
          mode: 'custom',
          customBaseTime: floor.floorMs,
          customAnchorRealTime: Date.now(),
        })
        await applyOnlineChatTimeFusion({
          characterId: cid,
          chosenTimeMs: floor.floorMs,
          timeMultiplier: config.timeMultiplier,
          timePerceptionEnabled: true,
          mode: 'custom',
        })
        hint = '已按剧情时间点对齐线上当前时间，可再往后调'
        // 推进后 floor 标签可能同步更新
        const nextFloor = await resolveCharacterStoryTimeFloor(cid)
        setStoryFloor(nextFloor.hasFloor ? nextFloor : floor)
      } else if (config.customBaseTime < floor.floorMs) {
        config = normalizeWeChatTimeConfig({
          ...config,
          mode: 'custom',
          customBaseTime: floor.floorMs,
          customAnchorRealTime: Date.now(),
        })
        hint = '不能早于剧情时间点，已钳制到剧情锚点'
        setStoryFloor(floor)
      } else {
        // 线上时钟已流逝：把剧情「现在」推到同一时刻，设置页与 AI 注入一致
        await syncStoryTimelineNowFromOnlineClock({
          characterId: cid,
          liveTimeMs: live,
        })
        const nextFloor = await resolveCharacterStoryTimeFloor(cid)
        setStoryFloor(nextFloor.hasFloor ? nextFloor : floor)
      }
    } else {
      setStoryFloor(floor)
    }
    setForm(config)
    setTimePerceptionEnabled(perception)
    setFloorHint(hint)
    setSavedSnapshot(JSON.stringify({ config, timePerceptionEnabled: perception }))
    void reload()
  }, [characterId, reload])

  useEffect(() => {
    if (!open) return
    void load()
  }, [load, open])

  const dirty =
    savedSnapshot !==
    JSON.stringify({ config: normalizeWeChatTimeConfig(form), timePerceptionEnabled })

  const setChosenTime = useCallback(
    (rawMs: number) => {
      let next = rawMs
      if (lockedByStory && storyFloor.floorMs != null && next < storyFloor.floorMs) {
        next = storyFloor.floorMs
        setFloorHint('不能早于剧情时间点，已钳制到剧情锚点')
      } else {
        setFloorHint('')
      }
      setForm((prev) => ({
        ...prev,
        mode: 'custom',
        customBaseTime: next,
        customAnchorRealTime: Date.now(),
      }))
    },
    [lockedByStory, storyFloor.floorMs],
  )

  const save = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      // 必须用流动中的「现在」作为新基点；若写 form.customBaseTime 会把已流逝的时间拨回保存前的起点
      const liveNow = resolveWeChatCurrentTimeMs(form)
      const result = await applyOnlineChatTimeFusion({
        characterId,
        chosenTimeMs: liveNow,
        timeMultiplier: form.timeMultiplier,
        timePerceptionEnabled: lockedByStory ? true : timePerceptionEnabled,
        mode: lockedByStory ? 'custom' : form.mode,
      })
      if (result.clamped) setFloorHint('不能早于剧情时间点，已钳制到剧情锚点')
      const nextForm = normalizeWeChatTimeConfig({
        mode: lockedByStory || form.mode === 'custom' ? 'custom' : form.mode,
        customBaseTime: result.chosenTimeMs,
        customAnchorRealTime: Date.now(),
        timeMultiplier: form.timeMultiplier,
      })
      const perception = lockedByStory ? true : timePerceptionEnabled
      setForm(nextForm)
      setTimePerceptionEnabled(perception)
      setSavedSnapshot(JSON.stringify({ config: nextForm, timePerceptionEnabled: perception }))
      if (result.advancedStory) {
        setStoryFloor({
          label: result.storyLabel,
          floorMs: result.chosenTimeMs,
          hasFloor: true,
        })
      }
      void reload()
    } finally {
      setSaving(false)
    }
  }, [characterId, form, lockedByStory, reload, saving, timePerceptionEnabled])

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

  // currentTimeMs 每秒 tick，带动自定义时钟按倍率刷新展示
  const displayLiveMs = useMemo(() => {
    if (lockedByStory || form.mode === 'custom') {
      return resolveWeChatCurrentTimeMs(form)
    }
    return currentTimeMs
  }, [currentTimeMs, form, lockedByStory])
  const previewMessageTime = useMemo(() => displayLiveMs - 8 * 24 * 60 * 60 * 1000, [displayLiveMs])
  const minLocal = lockedByStory && storyFloor.floorMs != null ? toDateTimeLocalValue(storyFloor.floorMs) : undefined

  /** 剧情时间点与线上「现在」同步流逝（有锚点时） */
  const liveStoryLabel = useMemo(() => {
    if (!lockedByStory) return ''
    const ms =
      storyFloor.floorMs != null && displayLiveMs < storyFloor.floorMs
        ? storyFloor.floorMs
        : displayLiveMs
    return composeStoryTimelineCalendarAnchorLabel({
      story_day: formatGregorianStoryDayFromMs(ms),
      story_time: formatStoryTimeClockFromMs(ms),
    }).trim()
  }, [displayLiveMs, lockedByStory, storyFloor.floorMs])
  const storyTimeDisplay = liveStoryLabel || storyFloor.label.trim() || '暂无剧情时间点'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[1230] bg-black/22"
            initial={disableTransitions ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={disableTransitions ? { opacity: 1 } : { opacity: 0 }}
            transition={disableTransitions ? { duration: 0 } : { duration: 0.2 }}
            onClick={requestClose}
          />
          <motion.div
            initial={disableTransitions ? false : { y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={disableTransitions ? { y: 0, opacity: 1 } : { y: '100%', opacity: 0 }}
            transition={disableTransitions ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-[1240] mx-auto flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] border border-[#e5e5e5] bg-[#f9f9f9] shadow-[0_-12px_48px_rgba(0,0,0,0.12)]"
          >
              <header className="flex shrink-0 items-center border-b border-[#e5e5e5] px-4 pb-3 pt-4">
                <Pressable
                  type="button"
                  aria-label="返回"
                  onClick={requestClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-70"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </Pressable>
                <div className="min-w-0 flex-1 px-2 text-center">
                  <h2 className="truncate text-[17px] font-semibold text-[#111111]">{peerDisplayName} 的时间设置</h2>
                  <p className="mt-1 text-[12px] text-[#888888]">仅当前角色生效 · 融合剧情锚点</p>
                </div>
                <div className="w-10 shrink-0" />
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
                <div className="space-y-3">
                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <p className="text-[12px] uppercase tracking-[0.08em] text-[#888888]">剧情时间点</p>
                    <p
                      className="mt-1 text-[20px] font-semibold leading-snug tabular-nums text-[#111111]"
                      style={phoneNumStyle}
                    >
                      {storyTimeDisplay}
                    </p>
                    <p className="mt-2 text-[12px] leading-5 text-[#888888]">
                      {lockedByStory
                        ? '已有剧情锚点：与上方线上「现在」同步流逝；只能往后推。打开面板时若仍停在真实墙钟会自动对齐。保存时同步推进剧情轴。'
                        : '暂无剧情锚点时，可自由开关时间感知与系统/自定义时间。'}
                    </p>
                  </section>

                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[16px] font-medium text-[#111111]">启用时间感知</p>
                        <p className="mt-1 text-[13px] text-[#888888]">
                          {lockedByStory
                            ? '已有剧情时间点，时间感知已锁定开启，避免与剧情时序矛盾'
                            : '关闭后模型不再接收系统注入的「当前时间点」，仅根据聊天记录与对话语境推断时段'}
                        </p>
                      </div>
                      <WxSwitch
                        on={lockedByStory ? true : timePerceptionEnabled}
                        disabled={lockedByStory}
                        onToggle={() => {
                          if (lockedByStory) return
                          setTimePerceptionEnabled((v) => !v)
                        }}
                      />
                    </div>
                  </section>

                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[16px] font-medium text-[#111111]">使用自定义时间</p>
                        <p className="mt-1 text-[13px] text-[#888888]">
                          {lockedByStory
                            ? '已有剧情锚点时须用自定义时间，并与剧情轴同步推进'
                            : '关闭后该角色回退为系统时间'}
                        </p>
                      </div>
                      <WxSwitch
                        on={lockedByStory ? true : form.mode === 'custom'}
                        disabled={lockedByStory}
                        onToggle={() => {
                          if (lockedByStory) return
                          setForm((prev) => ({
                            ...prev,
                            mode: prev.mode === 'custom' ? 'system' : 'custom',
                            customAnchorRealTime: Date.now(),
                          }))
                        }}
                      />
                    </div>
                  </section>

                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <div className="rounded-[10px] bg-[#f9f9f9] px-3 py-3">
                      <p className="text-[12px] uppercase tracking-[0.08em] text-[#888888]">当前线上时间</p>
                      <p
                        className="mt-1 text-[20px] font-semibold tabular-nums text-[#111111]"
                        style={phoneNumStyle}
                      >
                        {new Date(displayLiveMs).toLocaleString('zh-CN', { hour12: false })}
                      </p>
                    </div>
                    <div
                      className={`mt-4 ${lockedByStory || form.mode === 'custom' ? '' : 'pointer-events-none opacity-45'}`}
                    >
                      <label className="block text-[14px] text-[#333333]">
                        <span>设定当前时间</span>
                        <input
                          type="datetime-local"
                          min={minLocal}
                          value={toDateTimeLocalValue(form.customBaseTime)}
                          onChange={(e) => setChosenTime(parseDateTimeLocalValue(e.target.value))}
                          className="mt-2 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#111111] outline-none tabular-nums"
                          style={phoneNumStyle}
                        />
                      </label>
                      {floorHint ? <p className="mt-2 text-[12px] text-[#c45c26]">{floorHint}</p> : null}
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[14px] text-[#333333]">时间流速</span>
                          <span className="text-[13px] tabular-nums text-[#888888]" style={phoneNumStyle}>
                            {multiplierText(form.timeMultiplier)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={240}
                          value={Math.round(form.timeMultiplier)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              mode: 'custom',
                              timeMultiplier: Math.max(1, Number(e.target.value) || 1),
                              customBaseTime: resolveWeChatCurrentTimeMs(prev),
                              customAnchorRealTime: Date.now(),
                            }))
                          }
                          className="mt-2 w-full accent-black"
                        />
                        <input
                          type="number"
                          min={1}
                          max={86400}
                          step={1}
                          value={Math.round(form.timeMultiplier)}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              mode: 'custom',
                              timeMultiplier: Math.max(1, Number(e.target.value) || 1),
                              customBaseTime: resolveWeChatCurrentTimeMs(prev),
                              customAnchorRealTime: Date.now(),
                            }))
                          }
                          className="mt-3 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#111111] outline-none tabular-nums"
                          style={phoneNumStyle}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[14px] border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                    <p className="text-[14px] font-medium text-[#111111]">时间戳预览</p>
                    <div className="mt-3 flex justify-center">
                      <span className="text-[12px] tabular-nums text-[#999999]" style={phoneNumStyle}>
                        {formatWeChatChatTimestamp(previewMessageTime, displayLiveMs)}
                      </span>
                    </div>
                  </section>
                </div>
              </div>

              <div
                className="shrink-0 border-t border-[#e5e5e5] bg-white px-4 pb-4 pt-3"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
              >
                <Pressable
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="flex h-11 w-full items-center justify-center rounded-[12px] bg-black text-[15px] font-medium text-white transition-opacity active:opacity-90 disabled:opacity-50"
                >
                  {saving ? '保存中…' : lockedByStory ? '保存并推进剧情时间' : '保存'}
                </Pressable>
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
