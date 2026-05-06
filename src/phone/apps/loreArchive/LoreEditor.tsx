import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { LoreEntry } from '../../worldbook/loreArchiveTypes'
import type { GlobalWechatPlate } from '../../worldbook/globalWorldBookTypes'
import { GLOBAL_WECHAT_PLATE_LABELS } from '../../worldbook/globalWorldBookTypes'
import { Pressable } from '../../components/Pressable'

const PLATINUM_RING = '#D4AF37'

const ALL_PLATES: GlobalWechatPlate[] = ['private_chat', 'group_chat', 'offline_plot', 'vn']

export type LoreEditorCharacter = { id: string; name: string; avatarUrl: string; kind: 'npc' | 'player' }

type Props = {
  draft: LoreEntry
  roster: LoreEditorCharacter[]
  onChange: (next: LoreEntry) => void
  onBack: () => void
  autoSaveLabel?: string
}

function togglePlateInScope(scope: LoreEntry['plateScope'], plate: GlobalWechatPlate): LoreEntry['plateScope'] {
  if (scope.mode === 'all') return { mode: 'plates', plates: [plate] }
  const next = new Set(scope.plates)
  if (next.has(plate)) next.delete(plate)
  else next.add(plate)
  const arr = [...next]
  return arr.length ? { mode: 'plates', plates: arr } : { mode: 'all' }
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const adjust = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(160, el.scrollHeight)}px`
  }, [])

  useEffect(() => {
    adjust()
  }, [value, adjust])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-300"
    />
  )
}

export function LoreEditor({ draft, roster, onChange, onBack, autoSaveLabel }: Props) {
  const plateAll = draft.plateScope.mode === 'all'
  const charAll = draft.characterScope.mode === 'all'

  const selectedCharIds = useMemo(
    () =>
      draft.characterScope.mode === 'characters'
        ? new Set(draft.characterScope.ids.map((x) => String(x ?? '').trim()).filter(Boolean))
        : new Set<string>(),
    [draft.characterScope],
  )

  const setPlateScope = (next: LoreEntry['plateScope']) => {
    onChange({ ...draft, plateScope: next, updatedAt: Date.now() })
  }

  const setCharacterAll = (all: boolean) => {
    onChange({
      ...draft,
      characterScope: all ? { mode: 'all' } : { mode: 'characters', ids: [] },
      updatedAt: Date.now(),
    })
  }

  const toggleTarget = (id: string) => {
    const tid = id.trim()
    if (!tid) return
    if (draft.characterScope.mode !== 'characters') return
    const set = new Set(draft.characterScope.ids)
    if (set.has(tid)) set.delete(tid)
    else set.add(tid)
    onChange({
      ...draft,
      characterScope: { mode: 'characters', ids: [...set] },
      updatedAt: Date.now(),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa]">
      <header
        className="flex shrink-0 items-center gap-2 border-b border-black/[0.06] bg-white/90 px-3 pb-2 backdrop-blur-md"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600"
          aria-label="返回"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Pressable>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-light uppercase tracking-[0.45em] text-neutral-400">LORE ARCHIVE</p>
          {autoSaveLabel ? (
            <p className="text-[10px] text-neutral-400">{autoSaveLabel}</p>
          ) : (
            <p className="text-[10px] text-neutral-300">编辑中</p>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-6">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value, updatedAt: Date.now() })}
          placeholder="设定标题"
          className="w-full border-b border-neutral-200/90 bg-transparent pb-2 text-[26px] font-light tracking-tight text-neutral-900 outline-none placeholder:text-neutral-300"
        />

        <div className="mt-8">
          <AutoGrowTextarea
            value={draft.content}
            onChange={(content) => onChange({ ...draft, content, updatedAt: Date.now() })}
            placeholder="为你的世界注入额外的规则"
          />
        </div>

        <section className="mt-10 border-t border-black/[0.06] pt-8">
          <p className="text-[12px] font-medium text-neutral-700">生效板块</p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
            选择本条出现在哪些场景（私聊 / 群聊 / 线下约会剧情 / VN）；「全部板块」表示四类场景均可能注入。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlateScope({ mode: 'all' })}
              className="rounded-[10px] border px-3 py-2 text-[12px] font-medium transition-all"
              style={{
                borderColor: 'rgba(0,0,0,0.08)',
                background: plateAll ? '#111827' : '#fff',
                color: plateAll ? '#fff' : '#171717',
              }}
            >
              全部板块
            </button>
            <button
              type="button"
              onClick={() =>
                setPlateScope(
                  plateAll ? { mode: 'plates', plates: ['private_chat'] } : draft.plateScope,
                )
              }
              className="rounded-[10px] border px-3 py-2 text-[12px] font-medium transition-all"
              style={{
                borderColor: 'rgba(0,0,0,0.08)',
                background: !plateAll ? '#111827' : '#fff',
                color: !plateAll ? '#fff' : '#171717',
              }}
            >
              自定义板块
            </button>
          </div>
          {!plateAll && draft.plateScope.mode === 'plates' ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_PLATES.map((plate) => {
                const scope = draft.plateScope
                const plates = scope.mode === 'plates' ? scope.plates : []
                const on = plates.includes(plate)
                return (
                  <button
                    key={plate}
                    type="button"
                    onClick={() => setPlateScope(togglePlateInScope(scope, plate))}
                    className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all"
                    style={{
                      borderColor: 'rgba(0,0,0,0.08)',
                      background: on ? '#111827' : '#fff',
                      color: on ? '#fff' : '#171717',
                    }}
                  >
                    {GLOBAL_WECHAT_PLATE_LABELS[plate]}
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>

        <section className="mt-8 border-t border-black/[0.06] pt-8">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-neutral-600">作用全部角色</span>
            <button
              type="button"
              role="switch"
              aria-checked={charAll}
              onClick={() => setCharacterAll(!charAll)}
              className="relative h-8 w-[52px] shrink-0 rounded-full transition-all duration-200 ease-out"
              style={{ background: charAll ? '#000000' : '#e5e5e5' }}
              aria-label="作用全部角色"
            >
              <span
                className="absolute top-0.5 h-7 w-7 rounded-full bg-white shadow-sm transition-all duration-200 ease-out"
                style={{ left: charAll ? 'calc(100% - 1.75rem - 2px)' : '2px' }}
              />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            开启表示对全部角色生效；关闭后请勾选具体角色（仅在该角色在场且档案注入时会采纳）。
          </p>

          <AnimatePresence initial={false}>
            {!charAll ? (
              <motion.div
                key="roster"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="mb-3 mt-6 text-[11px] tracking-wide text-neutral-400">选择生效角色（可多选）</p>
                <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {roster.map((c) => {
                    const on = selectedCharIds.has(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleTarget(c.id)}
                        className="flex shrink-0 flex-col items-center gap-1.5"
                      >
                        <span
                          className="relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border bg-white transition"
                          style={{
                            borderColor: on ? PLATINUM_RING : 'rgba(0,0,0,0.06)',
                            boxShadow: on ? `0 0 0 2px ${PLATINUM_RING}55` : undefined,
                            opacity: on ? 1 : 0.45,
                            filter: on ? 'none' : 'grayscale(1)',
                          }}
                        >
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                          ) : (
                            <span className="text-[14px] text-neutral-500">{c.name.slice(0, 1)}</span>
                          )}
                        </span>
                        <span className="max-w-[64px] truncate text-[10px] text-neutral-500">{c.name}</span>
                      </button>
                    )
                  })}
                </div>
                {!roster.length ? (
                  <p className="text-[12px] text-neutral-400">暂无通讯录角色；请先在微信同步人设到通讯录。</p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </div>
    </div>
  )
}
