import { ArrowLeft, ChevronDown, ChevronRight, Clock, Copy, Edit, Map, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from './idb'
import type { WorldBackground, WorldBackgroundDimensionKey, WorldBackgroundSettings } from './types'
import {
  cloneTimelineEvents,
  cloneWorldBackgroundSettings,
  cloneWorldMapData,
  emptyWorldBackgroundSettings,
  emptyWorldMap,
} from './types'
import { uid } from './utils'
import { WB_DIMENSION_SECTIONS } from './worldBackgroundDimensions'
import { generateWorldBackgroundWithAi } from './worldBackgroundAi'
import { WorldMapEditorScreen } from './WorldMapEditorScreen'
import { WorldTimelineEditorScreen } from './WorldTimelineEditorScreen'

const C = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
} as const

const cardShadow = '0 1px 3px rgba(0,0,0,0.05)'

function formatDimLine(values: string[]): string {
  return values.length > 0 ? values.join('、') : '—'
}

function WorldBackgroundPresetDetailPage({
  preset,
  onBack,
  onCloneFromPreset,
}: {
  preset: WorldBackground
  onBack: () => void
  onCloneFromPreset: (presetId: string) => void
}) {
  const copyJson = async () => {
    const payload = {
      name: preset.name,
      description: preset.description,
      settings: cloneWorldBackgroundSettings(preset.settings),
      map: {
        imageUrl: preset.map?.imageUrl ?? '',
        markers: (preset.map?.markers ?? []).map((m) => ({ ...m })),
      },
      timeline: (preset.timeline ?? []).map((t) => ({ ...t })),
    }
    const t = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard?.writeText(t)
      window.alert('已复制 JSON 到剪贴板')
    } catch {
      window.alert('复制失败，请检查浏览器剪贴板权限')
    }
  }

  const rules = preset.settings.customRuleLines ?? []

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.bg }}>
      <header
        className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center border-b px-4 pb-3"
        style={{
          borderColor: C.border,
          background: C.bg,
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:bg-black/5"
          aria-label="返回"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" style={{ color: C.text }} strokeWidth={2} />
        </button>
        <h1 className="text-center text-[18px] font-bold" style={{ color: C.text }}>
          预设详情
        </h1>
        <span aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-36 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <p className="mb-4 text-center text-[12px] leading-relaxed" style={{ color: C.faint }}>
          预设为只读。可复制 JSON，或生成「我的世界」副本后编辑保存。
        </p>

        <div className="rounded-[12px] border bg-white p-5" style={{ borderColor: C.border, boxShadow: cardShadow }}>
          <p className="text-[16px] font-semibold" style={{ color: C.text }}>
            基本信息
          </p>
          <p className="mt-3 text-[16px] font-semibold" style={{ color: C.text }}>
            {preset.name}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: C.sub }}>
            {preset.description?.trim() ? preset.description : '—'}
          </p>
        </div>

        {WB_DIMENSION_SECTIONS.map((sec) => {
          const vals = (preset.settings[sec.key] as string[]) ?? []
          return (
            <div
              key={sec.key}
              className="mt-3 rounded-[12px] border bg-white p-5"
              style={{ borderColor: C.border, boxShadow: cardShadow }}
            >
              <p className="text-[16px] font-semibold" style={{ color: C.text }}>
                {sec.title}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: C.sub }}>
                {formatDimLine(vals)}
              </p>
            </div>
          )
        })}

        <div className="mt-3 rounded-[12px] border bg-white p-5" style={{ borderColor: C.border, boxShadow: cardShadow }}>
          <p className="text-[16px] font-semibold" style={{ color: C.text }}>
            自定义规则
          </p>
          {rules.length === 0 ? (
            <p className="mt-2 text-[14px]" style={{ color: C.sub }}>
              —
            </p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[14px] leading-relaxed" style={{ color: C.sub }}>
              {rules.map((line, i) => (
                <li key={`${i}-${line.slice(0, 12)}`}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className="shrink-0 border-t bg-[#f5f5f5] px-4 pt-3"
        style={{
          borderColor: C.border,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -1px 0 rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border bg-white py-3 text-[14px] font-medium transition-all duration-200 ease-out hover:bg-black/[0.03]"
            style={{ borderColor: C.text, color: C.text }}
            onClick={() => void copyJson()}
          >
            <Copy className="size-4 shrink-0" strokeWidth={1.75} />
            复制 JSON
          </button>
          <button
            type="button"
            className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out hover:opacity-90"
            style={{ background: C.text }}
            onClick={() => onCloneFromPreset(preset.id)}
          >
            复制为自定义并编辑
          </button>
        </div>
      </div>
    </div>
  )
}

export function WorldBackgroundPickerPage({
  selectedId,
  onBack,
  onUse,
  onNew,
  onEdit,
  onCloneFromPreset,
}: {
  selectedId: string
  onBack: () => void
  onUse: (id: string) => void
  onNew: () => void
  onEdit: (id: string) => void
  /** 从预设复制为新自定义世界并进入编辑页（预设本身不可改） */
  onCloneFromPreset: (presetId: string) => void
}) {
  const [list, setList] = useState<WorldBackground[]>([])
  const [delId, setDelId] = useState<string | null>(null)
  const [detailPreset, setDetailPreset] = useState<WorldBackground | null>(null)

  const reload = useCallback(() => {
    void personaDb.listWorldBackgrounds().then(setList)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const presets = list.filter((w) => w.isPreset)
  const mine = list.filter((w) => !w.isPreset)

  if (detailPreset) {
    return (
      <WorldBackgroundPresetDetailPage
        preset={detailPreset}
        onBack={() => setDetailPreset(null)}
        onCloneFromPreset={(id) => {
          setDetailPreset(null)
          onCloneFromPreset(id)
        }}
      />
    )
  }

  const renderPresetCard = (w: WorldBackground) => {
    const selected = w.id === selectedId
    return (
      <div
        key={w.id}
        className="flex items-stretch gap-3 rounded-[12px] border bg-white p-4"
        style={{ borderColor: C.border, boxShadow: cardShadow }}
      >
        <button
          type="button"
          className="min-w-0 flex-1 rounded-[8px] text-left transition-all duration-200 ease-out hover:bg-black/[0.03] active:bg-black/[0.05]"
          onClick={() => setDetailPreset(w)}
        >
          <p className="text-[16px] font-semibold" style={{ color: C.text }}>
            {w.name}
          </p>
          <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed" style={{ color: C.sub }}>
            {w.description || '暂无简介'}
          </p>
          <p className="mt-1.5 text-[12px]" style={{ color: C.faint }}>
            点击查看全部设定
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end justify-center gap-2 self-center">
          {selected ? (
            <span
              className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white"
              style={{ background: C.text }}
            >
              已选择
            </span>
          ) : (
            <button
              type="button"
              className="rounded-[8px] border bg-white px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out"
              style={{ borderColor: C.text, color: C.text }}
              onClick={() => onUse(w.id)}
            >
              使用
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderCard = (w: WorldBackground, showEdit: boolean) => {
    const selected = w.id === selectedId
    return (
      <div
        key={w.id}
        className="flex items-start gap-3 rounded-[12px] border bg-white p-4"
        style={{ borderColor: C.border, boxShadow: cardShadow }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold" style={{ color: C.text }}>
            {w.name}
          </p>
          <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed" style={{ color: C.sub }}>
            {w.description || '暂无简介'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selected ? (
            <span
              className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-white"
              style={{ background: C.text }}
            >
              已选择
            </span>
          ) : (
            <button
              type="button"
              className="rounded-[8px] border bg-white px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ease-out"
              style={{ borderColor: C.text, color: C.text }}
              onClick={() => onUse(w.id)}
            >
              使用
            </button>
          )}
          {showEdit ? (
            <>
              <button
                type="button"
                className="rounded-[8px] p-2 transition-all duration-200 ease-out hover:bg-black/5"
                aria-label="编辑"
                onClick={() => onEdit(w.id)}
              >
                <Edit className="size-[18px]" style={{ color: C.sub }} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="rounded-[8px] p-2 transition-all duration-200 ease-out hover:bg-black/5"
                aria-label="删除"
                onClick={() => setDelId(w.id)}
              >
                <Trash2 className="size-[18px]" style={{ color: C.sub }} strokeWidth={1.75} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.bg }}>
      <header
        className="flex shrink-0 items-center justify-between border-b px-4 pb-3"
        style={{
          borderColor: C.border,
          background: C.bg,
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:bg-black/5"
          aria-label="返回"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" style={{ color: C.text }} strokeWidth={2} />
        </button>
        <h1 className="text-[18px] font-bold" style={{ color: C.text }}>
          选择世界背景
        </h1>
        <button
          type="button"
          className="text-[16px] font-semibold transition-opacity duration-200 ease-out hover:opacity-70"
          style={{ color: C.text }}
          onClick={onNew}
        >
          新建
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <p className="px-4 pt-4 text-[16px] font-semibold" style={{ color: C.text }}>
          预设世界
        </p>
        <div className="mt-3 space-y-3 px-4">
          {presets.map((w) => (
            <div key={w.id}>{renderPresetCard(w)}</div>
          ))}
        </div>

        <p className="mt-6 px-4 text-[16px] font-semibold" style={{ color: C.text }}>
          我的世界
        </p>
        <div className="mt-3 space-y-3 px-4 pb-8">
          {mine.length === 0 ? (
            <p className="text-center text-[14px]" style={{ color: C.faint }}>
              暂无自定义世界，点击右上角「新建」
            </p>
          ) : (
            mine.map((w) => <div key={w.id}>{renderCard(w, true)}</div>)
          )}
        </div>
      </div>

      {delId ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/45 px-4">
          <div
            className="w-full max-w-[360px] rounded-[12px] border bg-white p-5"
            style={{ borderColor: C.border, boxShadow: cardShadow }}
          >
            <p className="text-center text-[16px] font-semibold" style={{ color: C.text }}>
              删除世界背景？
            </p>
            <p className="mt-2 text-center text-[14px]" style={{ color: C.sub }}>
              关联该世界的角色将自动切回「现代都市」预设。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-2.5 text-[14px] transition-all duration-200 ease-out hover:bg-black/[0.03]"
                style={{ borderColor: C.border, color: C.text }}
                onClick={() => setDelId(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-2.5 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: C.text }}
                onClick={() => {
                  const id = delId
                  setDelId(null)
                  if (id) void personaDb.deleteWorldBackground(id).then(reload)
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function toggleInList(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function WorldBackgroundEditPage({
  editingId,
  cloneFromPresetId,
  onBack,
  onSaved,
}: {
  editingId: string | undefined
  /** 从该预设 id 复制为新的自定义世界（新 id，进入编辑页） */
  cloneFromPresetId?: string
  onBack: () => void
  onSaved: () => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [draft, setDraft] = useState<WorldBackground | null>(null)
  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [openIdx, setOpenIdx] = useState(0)
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({})
  const [aiBusy, setAiBusy] = useState(false)
  const [newRuleLine, setNewRuleLine] = useState('')
  const [subFlow, setSubFlow] = useState<null | 'map' | 'timeline'>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (editingId) {
        const w = await personaDb.getWorldBackground(editingId)
        if (cancelled) return
        if (!w || w.isPreset) {
          setDraft(null)
          return
        }
        setDraft({ ...w, settings: { ...w.settings, customRuleLines: [...(w.settings.customRuleLines ?? [])] } })
        setDirty(false)
        return
      }
      if (cloneFromPresetId) {
        const w = await personaDb.getWorldBackground(cloneFromPresetId)
        if (cancelled) return
        if (!w || !w.isPreset) {
          setDraft(null)
          return
        }
        const now = Date.now()
        setDraft({
          id: uid('wb'),
          name: `${w.name}（副本）`,
          description: w.description,
          isPreset: false,
          settings: cloneWorldBackgroundSettings(w.settings),
          map: cloneWorldMapData(w.map),
          timeline: cloneTimelineEvents(w.timeline),
          createdAt: now,
          updatedAt: now,
        })
        setDirty(false)
        return
      }
      const now = Date.now()
      setDraft({
        id: uid('wb'),
        name: '',
        description: '',
        isPreset: false,
        settings: emptyWorldBackgroundSettings(),
        map: emptyWorldMap(),
        timeline: [],
        createdAt: now,
        updatedAt: now,
      })
      setDirty(false)
    })()
    return () => {
      cancelled = true
    }
  }, [editingId, cloneFromPresetId])

  useEffect(() => {
    setSubFlow(null)
  }, [editingId, cloneFromPresetId])

  const setSettings = (patch: Partial<WorldBackgroundSettings>) => {
    if (!draft) return
    setDirty(true)
    setDraft({
      ...draft,
      settings: { ...draft.settings, ...patch },
      updatedAt: Date.now(),
    })
  }

  const toggleOption = (key: WorldBackgroundDimensionKey, opt: string) => {
    if (!draft) return
    const cur = draft.settings[key] as string[]
    setSettings({ [key]: toggleInList([...cur], opt) } as Partial<WorldBackgroundSettings>)
  }

  const appendCustomToDim = (key: WorldBackgroundDimensionKey) => {
    const raw = (customDraft[key] || '').trim()
    if (!raw || !draft) return
    const parts = raw.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    const cur = [...(draft.settings[key] as string[])]
    for (const p of parts) {
      if (!cur.includes(p)) cur.push(p)
    }
    setSettings({ [key]: cur } as Partial<WorldBackgroundSettings>)
    setCustomDraft((s) => ({ ...s, [key]: '' }))
  }

  const save = async () => {
    if (!draft?.name.trim()) {
      window.alert('请填写世界名称')
      return
    }
    await personaDb.upsertWorldBackground({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      updatedAt: Date.now(),
    })
    setDirty(false)
    onSaved()
  }

  const tryBack = () => {
    if (dirty) setLeaveOpen(true)
    else onBack()
  }

  const runAi = async () => {
    if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
      window.alert('请先在 API 设置中配置密钥与模型')
      return
    }
    if (!draft) return
    setAiBusy(true)
    try {
      const r = await generateWorldBackgroundWithAi({
        apiConfig,
        nameDraft: draft.name,
        descriptionDraft: draft.description,
        current: draft.settings,
      })
      setDirty(true)
      setDraft((d) =>
        d
          ? {
              ...d,
              name: r.name,
              description: r.description,
              settings: r.settings,
              updatedAt: Date.now(),
            }
          : d,
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '生成失败')
    } finally {
      setAiBusy(false)
    }
  }

  if (!draft) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-[14px]" style={{ color: C.sub, background: C.bg }}>
        加载失败或预设不可编辑
      </div>
    )
  }

  if (subFlow === 'map') {
    return (
      <WorldMapEditorScreen
        map={draft.map}
        worldBackgroundDraft={draft}
        onChange={(map) => {
          setDirty(true)
          setDraft({ ...draft, map, updatedAt: Date.now() })
        }}
        onBack={() => setSubFlow(null)}
      />
    )
  }

  if (subFlow === 'timeline') {
    return (
      <WorldTimelineEditorScreen
        timeline={draft.timeline}
        onChange={(timeline) => {
          setDirty(true)
          setDraft({ ...draft, timeline, updatedAt: Date.now() })
        }}
        onBack={() => setSubFlow(null)}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.bg }}>
      <header
        className="flex shrink-0 items-center justify-between border-b px-4 pb-3"
        style={{
          borderColor: C.border,
          background: C.bg,
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:bg-black/5"
          aria-label="返回"
          onClick={tryBack}
        >
          <ArrowLeft className="size-5" style={{ color: C.text }} strokeWidth={2} />
        </button>
        <h1 className="text-[18px] font-bold" style={{ color: C.text }}>
          {editingId ? '编辑世界背景' : '新建世界背景'}
        </h1>
        <button
          type="button"
          className="text-[16px] font-semibold transition-opacity duration-200 ease-out hover:opacity-70"
          style={{ color: C.text }}
          onClick={() => void save()}
        >
          保存
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-28 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-4 mt-4 rounded-[12px] border bg-white p-5" style={{ borderColor: C.border, boxShadow: cardShadow }}>
          <p className="text-[16px] font-semibold" style={{ color: C.text }}>
            基本信息
          </p>
          <label className="mt-4 block">
            <span className="text-[12px]" style={{ color: C.sub }}>
              世界名称
            </span>
            <input
              value={draft.name}
              onChange={(e) => {
                setDirty(true)
                setDraft({ ...draft, name: e.target.value, updatedAt: Date.now() })
              }}
              placeholder="请输入世界名称"
              className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none transition-all duration-200 ease-out"
              style={{ borderColor: C.border, color: C.text }}
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[12px]" style={{ color: C.sub }}>
              世界简介
            </span>
            <textarea
              value={draft.description}
              onChange={(e) => {
                setDirty(true)
                setDraft({ ...draft, description: e.target.value, updatedAt: Date.now() })
              }}
              placeholder="请输入世界简介"
              rows={3}
              className="mt-1 min-h-[80px] w-full resize-none rounded-[12px] border bg-white px-4 py-3 text-[14px] outline-none transition-all duration-200 ease-out"
              style={{ borderColor: C.border, color: C.text }}
            />
          </label>
          <button
            type="button"
            disabled={aiBusy}
            className="mt-3 w-full rounded-[12px] py-2.5 text-[14px] font-medium text-white transition-all duration-200 ease-out disabled:opacity-50"
            style={{ background: C.text }}
            onClick={() => void runAi()}
          >
            {aiBusy ? '生成中…' : 'AI 自动生成完整设定'}
          </button>
        </div>

        {WB_DIMENSION_SECTIONS.map((sec, idx) => {
          const open = openIdx === idx
          const key = sec.key
          const selected = (draft.settings[key] as string[]) ?? []
          return (
            <div
              key={sec.key}
              className="mx-4 mt-3 rounded-[12px] border bg-white p-5"
              style={{ borderColor: C.border, boxShadow: cardShadow }}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setOpenIdx(open ? -1 : idx)}
              >
                <span className="text-[16px] font-semibold" style={{ color: C.text }}>
                  {sec.title}
                </span>
                <ChevronDown
                  className={`size-5 shrink-0 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
                  style={{ color: C.sub }}
                />
              </button>
              {open ? (
                <div className="mt-4">
                  <p className="text-[12px]" style={{ color: C.sub }}>
                    预选项（可多选）
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sec.options.map((opt) => {
                      const on = selected.includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleOption(sec.key, opt)}
                          className="rounded-[8px] border px-2.5 py-1.5 text-[12px] transition-all duration-200 ease-out"
                          style={{
                            borderColor: C.border,
                            background: on ? C.text : C.card,
                            color: on ? '#fff' : C.text,
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={customDraft[key] ?? ''}
                      onChange={(e) => setCustomDraft((s) => ({ ...s, [key]: e.target.value }))}
                      placeholder="自定义，可用逗号分隔多项"
                      className="min-w-0 flex-1 rounded-[12px] border bg-white px-3 py-2 text-[13px] outline-none"
                      style={{ borderColor: C.border, color: C.text }}
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-[12px] border px-3 py-2 text-[12px] transition-all duration-200 ease-out hover:bg-black/[0.03]"
                      style={{ borderColor: C.text, color: C.text }}
                      onClick={() => appendCustomToDim(sec.key)}
                    >
                      添加
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}

        <div className="mx-4 mt-3 rounded-[12px] border bg-white p-5" style={{ borderColor: C.border, boxShadow: cardShadow }}>
          <p className="text-[16px] font-semibold" style={{ color: C.text }}>
            自定义规则
          </p>
          <div className="mt-3 space-y-2">
            {(draft.settings.customRuleLines ?? []).map((line, i) => (
              <div key={`${i}-${line.slice(0, 8)}`} className="flex gap-2">
                <p className="min-w-0 flex-1 rounded-[12px] border px-3 py-2 text-[13px]" style={{ borderColor: C.border, color: C.text }}>
                  {line}
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-[8px] border px-2 py-1 text-[12px]"
                  style={{ borderColor: C.border, color: C.sub }}
                  onClick={() => {
                    const next = (draft.settings.customRuleLines ?? []).filter((_, j) => j !== i)
                    setDirty(true)
                    setDraft({
                      ...draft,
                      settings: { ...draft.settings, customRuleLines: next },
                      updatedAt: Date.now(),
                    })
                  }}
                >
                  删
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newRuleLine}
              onChange={(e) => setNewRuleLine(e.target.value)}
              placeholder="输入一条规则后添加"
              className="min-w-0 flex-1 rounded-[12px] border bg-white px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: C.border, color: C.text }}
            />
            <button
              type="button"
              className="shrink-0 rounded-[12px] border px-3 py-2 text-[12px]"
              style={{ borderColor: C.text, color: C.text }}
              onClick={() => {
                const t = newRuleLine.trim()
                if (!t) return
                setDirty(true)
                setDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    customRuleLines: [...(draft.settings.customRuleLines ?? []), t],
                  },
                  updatedAt: Date.now(),
                })
                setNewRuleLine('')
              }}
            >
              添加
            </button>
          </div>
        </div>

        <button
          type="button"
          className="mx-4 mt-3 flex w-[calc(100%-32px)] items-center rounded-[12px] border bg-white p-4 text-left transition-all duration-200 ease-out active:bg-black/[0.02]"
          style={{ borderColor: C.border, boxShadow: cardShadow }}
          onClick={() => setSubFlow('map')}
        >
          <Map className="size-5 shrink-0" style={{ color: C.text }} strokeWidth={1.75} />
          <div className="ml-3 min-w-0 flex-1">
            <p className="text-[16px] font-medium" style={{ color: C.text }}>
              世界地图
            </p>
            <p className="mt-0.5 text-[14px]" style={{ color: C.sub }}>
              {draft.map.markers.length}个标记点
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0" style={{ color: C.sub }} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          className="mx-4 mt-3 flex w-[calc(100%-32px)] items-center rounded-[12px] border bg-white p-4 text-left transition-all duration-200 ease-out active:bg-black/[0.02]"
          style={{ borderColor: C.border, boxShadow: cardShadow }}
          onClick={() => setSubFlow('timeline')}
        >
          <Clock className="size-5 shrink-0" style={{ color: C.text }} strokeWidth={1.75} />
          <div className="ml-3 min-w-0 flex-1">
            <p className="text-[16px] font-medium" style={{ color: C.text }}>
              时间线
            </p>
            <p className="mt-0.5 text-[14px]" style={{ color: C.sub }}>
              {draft.timeline.length}个事件
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0" style={{ color: C.sub }} strokeWidth={1.75} />
        </button>
      </div>

      {leaveOpen ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-[360px] rounded-[12px] border bg-white p-5" style={{ borderColor: C.border }}>
            <p className="text-center text-[16px] font-semibold" style={{ color: C.text }}>
              放弃未保存的修改？
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-2.5 text-[14px]"
                style={{ borderColor: C.border, color: C.text }}
                onClick={() => setLeaveOpen(false)}
              >
                继续编辑
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-2.5 text-[14px] font-semibold text-white"
                style={{ background: C.text }}
                onClick={() => {
                  setLeaveOpen(false)
                  onBack()
                }}
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
