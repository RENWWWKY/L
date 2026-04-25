import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import {
  densityToTrackCount,
  hexAndOpacityToRgba,
  mergeDanmakuVisualsForPreview,
} from '../danmakuResolve'
import { InlineDropdown } from '../newFriendsPersona/InlineDropdown'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterDanmakuSettingsRow, WeChatGlobalSettingsRow } from '../newFriendsPersona/types'

const PREVIEW_SAMPLES = ['666', '笑死', '这也太真实了', '你认真的？', '很难评']

/** 供 `<input type="color" />` 使用（须为 #rrggbb） */
function normalizeHexForColorInput(hex: string): string {
  const raw = hex.trim().replace(/^#/, '')
  if (raw.length === 3 && /^[0-9a-fA-F]{3}$/.test(raw)) {
    const a = raw[0]!
    const b = raw[1]!
    const c = raw[2]!
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase()
  }
  if (raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`
  }
  return '#000000'
}

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
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap gap-0.5 rounded-[10px] border border-[#e5e5e5] bg-[#f5f5f5] p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`min-w-0 flex-[1_1_42%] rounded-[8px] px-2 py-2 text-[13px] font-medium transition-colors ${
            value === o.v ? 'bg-white text-black shadow-sm' : 'text-[#666666]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-full min-w-0 rounded-[12px] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  )
}

/** 来自微信通讯录同步；展示名在弹幕配置内改用人设库 `Character.name`，不用 remarkName */
type PersonaContact = { characterId: string; remarkName: string; avatarUrl?: string }

function DanmakuPreviewLoop({
  visuals,
}: {
  visuals: ReturnType<typeof mergeDanmakuVisualsForPreview>
}) {
  const [tick, setTick] = useState(0)
  const [bullets, setBullets] = useState<
    { id: string; text: string; track: number; topPct?: number; startedAt: number }[]
  >([])

  const durationSec = visuals.scrollDurationSec
  const trackCount = densityToTrackCount(visuals.density)
  const colorRgba = hexAndOpacityToRgba(visuals.color, visuals.opacity)
  const lineH = visuals.fontSize + 8
  const nextTrackRef = useRef(0)
  const spawnPerTick = Math.min(20, Math.max(1, visuals.generateCount))

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2400)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const n = Math.min(spawnPerTick, 6)
    for (let i = 0; i < n; i += 1) {
      window.setTimeout(() => {
        const text = PREVIEW_SAMPLES[(tick + i) % PREVIEW_SAMPLES.length]!
        const track = (nextTrackRef.current + i) % trackCount
        nextTrackRef.current += 1
        const id = `pv-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
        const topPct = visuals.position === 'random' ? Math.random() * 78 : undefined
        setBullets((p) => [...p, { id, text, track, topPct, startedAt: Date.now() }])
      }, i * 100)
    }
  }, [tick, trackCount, visuals.position, spawnPerTick, visuals.density])

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      setBullets((p) => p.filter((b) => now - b.startedAt < (durationSec + 1) * 1000))
    }, 400)
    return () => window.clearInterval(id)
  }, [durationSec])

  const zone =
    visuals.position === 'middle'
      ? { top: '12%', height: '76%' }
      : visuals.position === 'bottom'
        ? { top: '44%', height: '52%' }
        : visuals.position === 'random'
          ? { top: '8%', height: '84%' }
          : { top: '8%', height: '84%' }

  const bg =
    visuals.style === 'gray'
      ? 'rgba(0,0,0,0.06)'
      : visuals.style === 'white'
        ? 'rgba(255,255,255,0.92)'
        : undefined

  return (
    <>
      <style>{`
        /* 用容器宽度 cqw 横穿整条预览带；百分比若相对弹幕自身则只会挪一小段，看起来像只占左半边 */
        @keyframes wxDmPreviewFly {
          from { transform: translate3d(100cqw, 0, 0); }
          to { transform: translate3d(calc(-100% - 100cqw), 0, 0); }
        }
      `}</style>
      <div
        className="relative w-full max-w-full min-w-0 overflow-hidden rounded-[12px] bg-[#ebebeb] [container-type:inline-size]"
        style={{ height: 120 }}
        aria-hidden
      >
        <div className="pointer-events-none absolute inset-x-0 overflow-hidden" style={zone}>
          {bullets.map((b) => {
            const topStyle =
              visuals.position === 'random' && b.topPct != null ? `${b.topPct}%` : b.track * lineH
            return (
              <div
                key={b.id}
                className="absolute left-0 max-w-[90%] truncate font-medium"
                style={{
                  top: topStyle,
                  fontSize: visuals.fontSize,
                  lineHeight: `${lineH}px`,
                  color: colorRgba,
                  backgroundColor: bg,
                  padding: visuals.style === 'none' ? undefined : '2px 10px',
                  borderRadius: visuals.style === 'none' ? undefined : 8,
                  whiteSpace: 'nowrap',
                  animation: `wxDmPreviewFly ${durationSec}s linear forwards`,
                  willChange: 'transform',
                }}
              >
                {b.text}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export function WeChatDanmakuConfigScreen({
  onBack,
  personaContacts,
}: {
  onBack: () => void
  personaContacts: PersonaContact[]
}) {
  const [row, setRow] = useState<WeChatGlobalSettingsRow | null>(null)
  const [charRow, setCharRow] = useState<CharacterDanmakuSettingsRow | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [charPickerOpen, setCharPickerOpen] = useState(false)
  /** 人设库中的真实姓名（`Character.name`），key 为 characterId */
  const [characterRealNames, setCharacterRealNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const r = await personaDb.getGlobalSettings()
    setRow(r)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!row || row.danmakuScopeMode !== 'character') {
      setCharRow(null)
      return
    }
    const id = selectedCharacterId.trim()
    if (!id) {
      setCharRow(null)
      return
    }
    let cancelled = false
    void personaDb.getCharacterDanmakuSettings(id).then((cr) => {
      if (!cancelled) setCharRow(cr)
    })
    return () => {
      cancelled = true
    }
  }, [row, selectedCharacterId])

  useEffect(() => {
    if (personaContacts.length && !selectedCharacterId) {
      setSelectedCharacterId(personaContacts[0]!.characterId)
    }
  }, [personaContacts, selectedCharacterId])

  useEffect(() => {
    if (row?.danmakuScopeMode !== 'character') setCharPickerOpen(false)
  }, [row?.danmakuScopeMode])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const ids = [...new Set(personaContacts.map((c) => c.characterId.trim()).filter(Boolean))]
      if (!ids.length) {
        if (!cancelled) setCharacterRealNames({})
        return
      }
      const next: Record<string, string> = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const ch = await personaDb.getCharacter(id)
            next[id] = (ch?.name ?? '').trim() || id
          } catch {
            next[id] = id
          }
        }),
      )
      if (!cancelled) setCharacterRealNames(next)
    }
    void run()
    const onStorage = () => void run()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [personaContacts])

  const patchGlobal = useCallback(
    async (partial: Partial<Omit<WeChatGlobalSettingsRow, 'id' | 'createdAt'>>) => {
      await personaDb.putGlobalSettings(partial)
      await load()
    },
    [load],
  )

  const patchCharacter = useCallback(
    async (partial: Partial<Omit<CharacterDanmakuSettingsRow, 'characterId' | 'updatedAt'>>) => {
      const cid = selectedCharacterId.trim()
      if (!cid || !row) return
      await personaDb.putCharacterDanmakuSettings({ characterId: cid, ...partial })
      const next = await personaDb.getCharacterDanmakuSettings(cid)
      setCharRow(next)
    },
    [row, selectedCharacterId],
  )

  const editCharacter = row?.danmakuScopeMode === 'character' && !!selectedCharacterId.trim()

  const charForm = useMemo(() => {
    if (!row || !editCharacter) return null
    const cid = selectedCharacterId.trim()
    if (!cid) return null
    if (charRow) return charRow
    return {
      characterId: cid,
      enabled: true,
      useMemory: row.danmakuUseMemory,
      generateCount: row.danmakuGenerateCount,
      fontSize: row.danmakuFontSize,
      color: row.danmakuColor,
      opacity: row.danmakuOpacity,
      scrollDurationSec: row.danmakuScrollDurationSec,
      position: row.danmakuPosition,
      density: row.danmakuDensity,
      style: row.danmakuStyle,
      customPrompt: row.danmakuCustomPrompt,
      updatedAt: Date.now(),
    } satisfies CharacterDanmakuSettingsRow
  }, [row, editCharacter, selectedCharacterId, charRow])

  const previewVisualsSafe = useMemo(() => {
    if (!row) {
      return {
        fontSize: 14,
        color: '#000000',
        opacity: 0.85,
        scrollDurationSec: 8,
        position: 'top' as const,
        density: 'normal' as const,
        style: 'none' as const,
        useMemory: false,
        generateCount: 5,
        customPrompt: '',
      }
    }
    return mergeDanmakuVisualsForPreview(
      row,
      row.danmakuScopeMode === 'character' && charForm ? charForm : null,
    )
  }, [row, charForm])

  if (!row) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f5f5f5] text-[14px] text-[#666666]">加载中…</div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-full min-w-0 flex-col overflow-x-hidden bg-[#f5f5f5] touch-pan-y">
      <header
        className="flex min-w-0 shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">弹幕配置</h1>
        <div className="w-10 shrink-0" />
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain touch-pan-y py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-full min-w-0 max-w-[520px] flex-col gap-3 px-4">
          <Card>
            <p className="mb-2 text-[13px] font-medium text-[#666666]">配置模式</p>
            <Segmented
              value={row.danmakuScopeMode}
              options={[
                { v: 'global', label: '全局统一' },
                { v: 'character', label: '按角色单独' },
              ]}
              onChange={(v) => void patchGlobal({ danmakuScopeMode: v })}
            />
            {row.danmakuScopeMode === 'character' ? (
              <div className="mt-3">
                {personaContacts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-3 text-[13px] text-[#888888]">
                    暂无可选角色，请先在通讯录添加人设角色。
                  </p>
                ) : (
                  <label className="block">
                    <span className="text-[12px] text-[#888888]">选择角色</span>
                    <div className="mt-2">
                      <InlineDropdown
                        label="选择角色"
                        valueText={
                          selectedCharacterId.trim()
                            ? characterRealNames[selectedCharacterId]?.trim() || '加载中…'
                            : '未选择'
                        }
                        open={charPickerOpen}
                        onToggle={() => setCharPickerOpen((v) => !v)}
                      >
                        <div className="grid grid-cols-2 gap-2 px-3 py-2">
                          {personaContacts.map((c) => {
                            const active = c.characterId === selectedCharacterId
                            const rn = characterRealNames[c.characterId]?.trim()
                            const title = rn || '加载中…'
                            const initial = (rn || '?').slice(0, 1)
                            return (
                              <button
                                key={c.characterId}
                                type="button"
                                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200 ease-out"
                                style={{
                                  borderColor: '#e5e5e5',
                                  background: active ? '#111827' : '#ffffff',
                                  color: active ? '#ffffff' : '#000000',
                                }}
                                onClick={() => {
                                  setSelectedCharacterId(c.characterId)
                                  setCharPickerOpen(false)
                                }}
                              >
                                <div
                                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                                  style={{
                                    borderWidth: 1,
                                    borderStyle: 'solid',
                                    borderColor: active ? 'rgba(255,255,255,0.25)' : '#e5e5e5',
                                    background: active ? 'rgba(255,255,255,0.08)' : '#f5f5f5',
                                  }}
                                >
                                  {c.avatarUrl?.trim() ? (
                                    <img
                                      src={c.avatarUrl.trim()}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  ) : (
                                    <span
                                      className="text-[11px] font-semibold"
                                      style={{ color: active ? 'rgba(255,255,255,0.85)' : '#888888' }}
                                    >
                                      {initial.toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold">{title}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </InlineDropdown>
                    </div>
                  </label>
                )}
                {personaContacts.length > 0 && editCharacter && charForm ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[14px] text-black">该角色启用弹幕</span>
                    <WxSwitch
                      on={charForm.enabled}
                      onToggle={() => void patchCharacter({ enabled: !charForm.enabled })}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] text-black">生成弹幕时参考长期记忆</p>
                <p className="mt-1 text-[12px] leading-snug text-[#888888]">
                  关闭：仅根据最近 20 条消息生成。开启：与主对话一致，含角色档案、玩家身份、长期记忆、世界背景与完整上下文。
                </p>
              </div>
              <WxSwitch
                on={
                  row.danmakuScopeMode === 'character' && charForm ? charForm.useMemory : row.danmakuUseMemory
                }
                onToggle={() => {
                  if (row.danmakuScopeMode === 'character' && charForm) {
                    void patchCharacter({ useMemory: !charForm.useMemory })
                  } else {
                    void patchGlobal({ danmakuUseMemory: !row.danmakuUseMemory })
                  }
                }}
              />
            </div>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#666666]">单次生成弹幕条数</p>
              <span className="text-[12px] tabular-nums text-[#888888]">
                {row.danmakuScopeMode === 'character' && charForm ? charForm.generateCount : row.danmakuGenerateCount}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={
                row.danmakuScopeMode === 'character' && charForm ? charForm.generateCount : row.danmakuGenerateCount
              }
              onChange={(e) => {
                const n = Number(e.target.value)
                if (row.danmakuScopeMode === 'character') void patchCharacter({ generateCount: n })
                else void patchGlobal({ danmakuGenerateCount: n })
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e5e5e5] accent-black"
              aria-label="单次生成弹幕条数"
            />
            <p className="mt-2 text-[12px] text-[#aaaaaa]">模型按此条数输出；每条独立一行。</p>
          </Card>

          <Card>
            <p className="mb-2 text-[13px] font-medium text-[#666666]">自定义弹幕提示词（可选）</p>
            <p className="mb-2 text-[12px] leading-snug text-[#888888]">
              填写后将<strong className="font-semibold text-[#666666]">优先使用</strong>
              此处内容作为弹幕生成的风格与约束，替代内置通用综艺弹幕规则。留空则使用代码内置通用提示词。条数与换行格式仍以下方「单次生成弹幕条数」与用户任务说明为准。
            </p>
            {row.danmakuScopeMode === 'character' && editCharacter && charForm ? (
              <p className="mb-2 text-[12px] text-[#aaaaaa]">当前为按角色配置；本框留空时沿用全局统一提示词。</p>
            ) : null}
            <textarea
              className="box-border min-h-[120px] w-full min-w-0 max-w-full resize-y rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-[14px] text-black outline-none placeholder:text-[#bbbbbb] focus:border-black focus:ring-1 focus:ring-black/10"
              maxLength={6000}
              rows={5}
              placeholder="留空则使用内置通用综艺弹幕提示词…"
              value={
                row.danmakuScopeMode === 'character' && charForm
                  ? charForm.customPrompt
                  : row.danmakuCustomPrompt
              }
              onChange={(e) => {
                const v = e.target.value
                if (row.danmakuScopeMode === 'character' && charForm) void patchCharacter({ customPrompt: v })
                else void patchGlobal({ danmakuCustomPrompt: v })
              }}
              aria-label="自定义弹幕提示词"
            />
            <p className="mt-1 text-[11px] tabular-nums text-[#aaaaaa]">
              {row.danmakuScopeMode === 'character' && charForm
                ? charForm.customPrompt.length
                : row.danmakuCustomPrompt.length}
              /6000
            </p>
          </Card>

          <div className="min-w-0 w-full max-w-full">
            <p className="mb-2 text-[13px] font-medium text-[#666666]">实时预览</p>
            <DanmakuPreviewLoop visuals={previewVisualsSafe} />
          </div>

          <Card>
            <p className="mb-3 text-[13px] font-medium text-[#666666]">字号</p>
            <p className="mb-2 text-[14px] text-black">弹幕文本字号</p>
            <input
              type="range"
              min={12}
              max={24}
              step={1}
              value={row.danmakuScopeMode === 'character' && charForm ? charForm.fontSize : row.danmakuFontSize}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (row.danmakuScopeMode === 'character') void patchCharacter({ fontSize: n })
                else void patchGlobal({ danmakuFontSize: n })
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e5e5e5] accent-black"
              aria-label="弹幕字号"
            />
          </Card>

          <Card>
            <p className="mb-2 text-[13px] font-medium text-[#666666]">颜色</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-11 w-14 cursor-pointer shrink-0 rounded-lg border border-[#e5e5e5] bg-white p-0.5"
                value={normalizeHexForColorInput(
                  row.danmakuScopeMode === 'character' && charForm ? charForm.color : row.danmakuColor,
                )}
                onChange={(e) => {
                  const v = e.target.value
                  if (row.danmakuScopeMode === 'character') void patchCharacter({ color: v })
                  else void patchGlobal({ danmakuColor: v })
                }}
                aria-label="弹幕颜色"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[#666666]">
                {normalizeHexForColorInput(
                  row.danmakuScopeMode === 'character' && charForm ? charForm.color : row.danmakuColor,
                )}
              </span>
            </div>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#666666]">透明度</p>
              <span className="text-[12px] tabular-nums text-[#888888]">
                {(row.danmakuScopeMode === 'character' && charForm ? charForm.opacity : row.danmakuOpacity).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={row.danmakuScopeMode === 'character' && charForm ? charForm.opacity : row.danmakuOpacity}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (row.danmakuScopeMode === 'character') void patchCharacter({ opacity: n })
                else void patchGlobal({ danmakuOpacity: n })
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e5e5e5] accent-black"
              aria-label="弹幕透明度"
            />
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[#666666]">滚动速度</p>
              <span className="text-[12px] tabular-nums text-[#888888]">
                {(row.danmakuScopeMode === 'character' && charForm
                  ? charForm.scrollDurationSec
                  : row.danmakuScrollDurationSec
                ).toFixed(1)}
                s
              </span>
            </div>
            <p className="mb-2 text-[12px] text-[#aaaaaa]">数值越大飘得越慢</p>
            <input
              type="range"
              min={5}
              max={15}
              step={0.5}
              value={
                row.danmakuScopeMode === 'character' && charForm
                  ? charForm.scrollDurationSec
                  : row.danmakuScrollDurationSec
              }
              onChange={(e) => {
                const n = Number(e.target.value)
                if (row.danmakuScopeMode === 'character') void patchCharacter({ scrollDurationSec: n })
                else void patchGlobal({ danmakuScrollDurationSec: n })
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e5e5e5] accent-black"
              aria-label="弹幕滚动速度"
            />
          </Card>

          <Card>
            <p className="mb-2 text-[13px] font-medium text-[#666666]">出现位置</p>
            <Segmented
              value={row.danmakuScopeMode === 'character' && charForm ? charForm.position : row.danmakuPosition}
              options={[
                { v: 'top', label: '顶部' },
                { v: 'middle', label: '中部' },
                { v: 'bottom', label: '底部' },
                { v: 'random', label: '随机' },
              ]}
              onChange={(v) => {
                if (row.danmakuScopeMode === 'character') void patchCharacter({ position: v })
                else void patchGlobal({ danmakuPosition: v })
              }}
            />
          </Card>

          <Card>
            <p className="mb-2 text-[13px] font-medium text-[#666666]">同屏密度</p>
            <Segmented
              value={row.danmakuScopeMode === 'character' && charForm ? charForm.density : row.danmakuDensity}
              options={[
                { v: 'sparse', label: '稀少' },
                { v: 'normal', label: '正常' },
                { v: 'dense', label: '密集' },
              ]}
              onChange={(v) => {
                if (row.danmakuScopeMode === 'character') void patchCharacter({ density: v })
                else void patchGlobal({ danmakuDensity: v })
              }}
            />
          </Card>

          <Card>
            <p className="mb-2 text-[13px] font-medium text-[#666666]">边框 / 背景</p>
            <Segmented
              value={row.danmakuScopeMode === 'character' && charForm ? charForm.style : row.danmakuStyle}
              options={[
                { v: 'none', label: '无边框' },
                { v: 'gray', label: '浅灰底' },
                { v: 'white', label: '白底圆角' },
              ]}
              onChange={(v) => {
                if (row.danmakuScopeMode === 'character') void patchCharacter({ style: v })
                else void patchGlobal({ danmakuStyle: v })
              }}
            />
          </Card>
        </div>
        <div className="h-6 shrink-0" style={{ minHeight: 'max(24px, env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  )
}
