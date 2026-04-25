import { ChevronDown, Dice5, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ApiConfig } from '../../api/types'
import { generateWorldBookItemContent } from './ai'
import type { Character, PlayerIdentity, WorldBook, WorldBookItem, WorldBookPriority } from './types'
import { uid } from './utils'
import { WorldBookItemGenLengthModal } from './WorldBookItemGenLengthModal'
import { InlineDropdown } from './InlineDropdown'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
} as const

/** AI 写入正文前在内容框中展示（不写进条目数据，仅 UI） */
const WB_ITEM_GENERATING_TEXT = '生成中…'

function priorityLabel(p: WorldBookPriority) {
  return p === 'before' ? '聊天之前' : '聊天之后'
}

/** 世界书/条目启用：黑白配色滑动开关（关：浅灰轨；开：黑轨 + 白点） */
function WbToggleSwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-all duration-200 ease-out"
      style={{ background: checked ? '#000000' : '#e5e5e5' }}
      aria-pressed={checked}
      aria-label={ariaLabel}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-out"
        style={{ left: checked ? 'calc(100% - 1.5rem - 2px)' : '2px' }}
      />
    </button>
  )
}

export function WorldBooksEditor({
  apiConfig,
  character,
  onChange,
  forPlayerIdentity = false,
  worldBackgroundPrompt = '',
  /** 角色人设页：当前玩家身份，供世界书 AI 生成时作「操作者」参考 */
  identityContext = null,
  /** 角色人设页：同人脉下已生成 NPC 摘要（`formatLinkedNpcsForWorldBookPrompt`） */
  linkedNpcsContext = '',
}: {
  apiConfig: ApiConfig | null
  character: Character
  onChange: (next: Character) => void
  /** 玩家身份编辑页：AI 生成按第一人称自述，禁止第三人称 */
  forPlayerIdentity?: boolean
  /** 身份关联的世界背景（可选） */
  worldBackgroundPrompt?: string
  identityContext?: PlayerIdentity | null
  /** 仅角色编辑页：人脉 NPC 摘要，供世界书条目补全参考 */
  linkedNpcsContext?: string
}) {
  const [openBookId, setOpenBookId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<null | { kind: 'wb' | 'item'; wbId: string; itemId?: string; title: string }>(null)
  const [generatingKey, setGeneratingKey] = useState<string>('')
  const [wbItemGenPicker, setWbItemGenPicker] = useState<null | { wbId: string; itemId: string }>(null)
  /** 与 MBTI 一致的下拉：同一时间只展开一条目的「聊天之前/之后」 */
  const [priorityOpenKey, setPriorityOpenKey] = useState<string | null>(null)

  const worldBooks = character.worldBooks ?? []

  const setWorldBooks = (next: WorldBook[]) => {
    onChange({ ...character, worldBooks: next, updatedAt: Date.now() })
  }

  const addWorldBook = () => {
    const wb: WorldBook = { id: uid('wb'), name: '新的世界书', enabled: true, items: [], collapsed: false }
    setWorldBooks([wb, ...worldBooks])
    setOpenBookId(wb.id)
  }

  const updateWorldBook = (wbId: string, patch: Partial<WorldBook>) => {
    setWorldBooks(worldBooks.map((w) => (w.id === wbId ? { ...w, ...patch } : w)))
  }

  const addItem = (wbId: string) => {
    const now = Date.now()
    const item: WorldBookItem = {
      id: uid('it'),
      name: '新条目',
      enabled: true,
      priority: 'before',
      keywords: '',
      content: '',
      updatedAt: now,
      collapsed: false,
    }
    setWorldBooks(worldBooks.map((w) => (w.id === wbId ? { ...w, items: [item, ...(w.items ?? [])] } : w)))
  }

  const updateItem = (wbId: string, itemId: string, patch: Partial<WorldBookItem>) => {
    setWorldBooks(
      worldBooks.map((w) =>
        w.id !== wbId
          ? w
          : {
              ...w,
              items: (w.items ?? []).map((it) => (it.id === itemId ? { ...it, ...patch, updatedAt: Date.now() } : it)),
            },
      ),
    )
  }

  const removeWorldBook = (wbId: string) => {
    setWorldBooks(worldBooks.filter((w) => w.id !== wbId))
    if (openBookId === wbId) setOpenBookId(null)
  }

  const removeItem = (wbId: string, itemId: string) => {
    setWorldBooks(worldBooks.map((w) => (w.id === wbId ? { ...w, items: (w.items ?? []).filter((it) => it.id !== itemId) } : w)))
  }

  const enabledBookText = useMemo(() => {
    return worldBooks
      .filter((w) => w.enabled)
      .map((w) => {
        const lines = (w.items ?? [])
          .filter((it) => it.enabled && String(it.content || '').trim())
          .map((it) => `- [${it.priority === 'before' ? '聊天之前' : '聊天之后'}] ${it.name}：${String(it.content).trim()}`)
          .join('\n')
        return lines ? `世界书「${w.name}」\n${lines}` : ''
      })
      .filter(Boolean)
      .join('\n\n')
  }, [worldBooks])

  const canUseAi = !!apiConfig?.apiUrl && !!apiConfig?.apiKey && !!apiConfig?.modelId

  return (
    <div
      className="rounded-[12px] bg-white"
      style={{ background: COLORS.card, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center justify-between border-b px-5 py-5" style={{ borderColor: COLORS.border }}>
        <div>
          <p className="text-[16px] font-semibold" style={{ color: COLORS.text }}>
            世界书
          </p>
          <p className="mt-1 text-[12px]" style={{ color: COLORS.sub }}>
            可创建多个世界书，条目可设聊天之前/之后；点「AI 生成」会先选目标字数。
          </p>
        </div>
        <button
          type="button"
          onClick={addWorldBook}
          className="flex items-center gap-1 rounded-[12px] border bg-white px-3 py-2 text-[13px] font-medium transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
          style={{ borderColor: COLORS.border, color: COLORS.text }}
        >
          <Plus className="size-4" color={COLORS.text} strokeWidth={2} />
          新建
        </button>
      </div>

      {worldBooks.length === 0 ? (
        <div className="px-5 py-6 text-center text-[13px]" style={{ color: COLORS.faint }}>
          暂无世界书。点击右上角“新建”开始添加。
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: COLORS.border }}>
          {worldBooks.map((wb) => {
            return (
              <div key={wb.id} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateWorldBook(wb.id, { collapsed: !wb.collapsed })}
                    className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                    aria-label="展开/折叠"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${wb.collapsed ? 'rotate-0' : 'rotate-180'}`}
                      color={COLORS.sub}
                      strokeWidth={2}
                    />
                  </button>
                  <input
                    value={wb.name}
                    onChange={(e) => updateWorldBook(wb.id, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-[12px] border bg-white px-3 py-2 text-[14px] outline-none transition-all duration-200 ease-out"
                    style={{ borderColor: COLORS.border, color: COLORS.text }}
                    aria-label="世界书名称"
                  />
                  <WbToggleSwitch
                    checked={wb.enabled}
                    onChange={(v) => updateWorldBook(wb.id, { enabled: v })}
                    aria-label="世界书开关"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ kind: 'wb', wbId: wb.id, title: wb.name || '世界书' })}
                    className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                    aria-label="删除世界书"
                  >
                    <Trash2 className="size-4" color={COLORS.sub} strokeWidth={1.8} />
                  </button>
                </div>

                {wb.collapsed ? null : (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium" style={{ color: COLORS.text }}>
                        条目
                      </p>
                      <button
                        type="button"
                        onClick={() => addItem(wb.id)}
                        className="rounded-[10px] border bg-white px-3 py-2 text-[12px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                        style={{ borderColor: COLORS.border, color: COLORS.text }}
                      >
                        + 新条目
                      </button>
                    </div>

                    {(wb.items ?? []).length === 0 ? (
                      <p className="mt-3 text-[13px]" style={{ color: COLORS.faint }}>
                        暂无条目。
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {(wb.items ?? []).map((it) => {
                          const key = `${wb.id}::${it.id}`
                          const generating = generatingKey === key
                          return (
                            <div key={it.id} className="rounded-[12px] border bg-white p-3" style={{ borderColor: COLORS.border }}>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateItem(wb.id, it.id, { collapsed: !it.collapsed })}
                                  className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                                  aria-label={it.collapsed ? '展开条目详情' : '折叠条目详情'}
                                >
                                  <ChevronDown
                                    className={`size-4 transition-transform duration-200 ${it.collapsed ? 'rotate-0' : 'rotate-180'}`}
                                    color={COLORS.sub}
                                    strokeWidth={2}
                                  />
                                </button>
                                <input
                                  value={it.name}
                                  onChange={(e) => updateItem(wb.id, it.id, { name: e.target.value })}
                                  className="min-w-0 flex-1 rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                  style={{ borderColor: COLORS.border, color: COLORS.text }}
                                  placeholder="条目名称"
                                />
                                <WbToggleSwitch
                                  checked={it.enabled}
                                  onChange={(v) => updateItem(wb.id, it.id, { enabled: v })}
                                  aria-label="条目开关"
                                />
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete({ kind: 'item', wbId: wb.id, itemId: it.id, title: it.name || '条目' })}
                                  className="rounded-[10px] p-2 transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                                  aria-label="删除条目"
                                >
                                  <Trash2 className="size-4" color={COLORS.sub} strokeWidth={1.8} />
                                </button>
                              </div>

                              <div className="mt-2">
                                <span className="text-[12px]" style={{ color: COLORS.sub }}>
                                  生效时机
                                </span>
                                <div className="mt-1">
                                  <InlineDropdown
                                    label="生效时机"
                                    valueText={priorityLabel(it.priority)}
                                    open={priorityOpenKey === key}
                                    onToggle={() =>
                                      setPriorityOpenKey((k) => (k === key ? null : key))
                                    }
                                  >
                                    <div className="border-b px-3 py-2" style={{ borderColor: '#f0f0f0' }}>
                                      <p className="text-[11px] leading-relaxed" style={{ color: COLORS.sub }}>
                                        <span className="font-semibold" style={{ color: COLORS.text }}>聊天之前</span>
                                        ：固定设定。
                                      </p>
                                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: COLORS.sub }}>
                                        <span className="font-semibold" style={{ color: COLORS.text }}>聊天之后</span>
                                        ：临时设定，会随聊天变化。
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 px-3 py-2">
                                      {(['before', 'after'] as const).map((p) => {
                                        const active = it.priority === p
                                        return (
                                          <button
                                            key={p}
                                            type="button"
                                            className="flex items-center justify-center rounded-xl border px-3 py-3 text-center transition-all duration-200 ease-out"
                                            style={{
                                              borderColor: '#e5e5e5',
                                              background: active ? '#111827' : '#ffffff',
                                              color: active ? '#ffffff' : '#000000',
                                            }}
                                            onClick={() => {
                                              updateItem(wb.id, it.id, { priority: p })
                                              setPriorityOpenKey(null)
                                            }}
                                          >
                                            <span className="text-[13px] font-semibold">{priorityLabel(p)}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </InlineDropdown>
                                </div>
                              </div>

                              {it.collapsed ? null : (
                                <>
                                  <div className="mt-2 grid grid-cols-1 gap-2">
                                    <input
                                      value={it.keywords ?? ''}
                                      onChange={(e) => updateItem(wb.id, it.id, { keywords: e.target.value })}
                                      className="w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out"
                                      style={{ borderColor: COLORS.border, color: COLORS.text }}
                                      placeholder="关键词（可选）"
                                    />
                                    <textarea
                                      readOnly={generating}
                                      value={generating ? WB_ITEM_GENERATING_TEXT : (it.content ?? '')}
                                      onChange={(e) => {
                                        if (generating) return
                                        updateItem(wb.id, it.id, { content: e.target.value })
                                      }}
                                      className="w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] outline-none transition-all duration-200 ease-out read-only:cursor-wait"
                                      style={{
                                        borderColor: COLORS.border,
                                        color: generating ? COLORS.sub : COLORS.text,
                                      }}
                                      rows={4}
                                      placeholder="条目内容"
                                    />
                                  </div>

                                  <div className="mt-2 flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={!canUseAi || generating}
                                      className="flex items-center gap-1 rounded-[10px] border bg-white px-3 py-2 text-[12px] transition-all duration-200 ease-out hover:bg-[#f5f5f5] disabled:opacity-60"
                                      style={{ borderColor: COLORS.border, color: COLORS.text }}
                                      onClick={() => {
                                        if (!canUseAi || generating) return
                                        setWbItemGenPicker({ wbId: wb.id, itemId: it.id })
                                      }}
                                    >
                                      <Dice5 className="size-4" color={COLORS.sub} strokeWidth={1.7} />
                                      AI生成
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <WorldBookItemGenLengthModal
        open={!!wbItemGenPicker}
        onClose={() => setWbItemGenPicker(null)}
        onConfirm={(targetChineseChars) => {
          const p = wbItemGenPicker
          setWbItemGenPicker(null)
          if (!p || !canUseAi) return
          const genKey = `${p.wbId}::${p.itemId}`
          setGeneratingKey(genKey)
          void (async () => {
            try {
              const wb = worldBooks.find((w) => w.id === p.wbId)
              const item = wb?.items.find((x) => x.id === p.itemId)
              if (!wb || !item || !apiConfig) return
              const text = await generateWorldBookItemContent({
                character,
                worldBook: wb,
                item,
                apiConfig,
                forPlayerIdentity,
                identityContext: identityContext ?? undefined,
                targetChineseChars,
                worldBackgroundPrompt: worldBackgroundPrompt.trim() || undefined,
                linkedNpcsContext: linkedNpcsContext.trim() || undefined,
              })
              updateItem(p.wbId, p.itemId, { content: text })
            } finally {
              setGeneratingKey('')
            }
          })()
        }}
      />

      {confirmDelete ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[420px] rounded-[16px] bg-white p-5" style={{ background: COLORS.card }}>
            <p className="text-center text-[16px] font-semibold" style={{ color: COLORS.text }}>
              确认删除
            </p>
            <p className="mt-2 text-center text-[14px]" style={{ color: COLORS.sub }}>
              将删除「{confirmDelete.title}」，此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-[12px] border bg-white px-4 py-2 text-[13px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
                style={{ borderColor: COLORS.border, color: COLORS.text }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const x = confirmDelete
                  setConfirmDelete(null)
                  if (x.kind === 'wb') removeWorldBook(x.wbId)
                  else if (x.kind === 'item' && x.itemId) removeItem(x.wbId, x.itemId)
                }}
                className="flex-1 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: COLORS.text }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* enabledBookText 预留：作为 AI 上下文节选（当前由 ai.ts 内自行汇总） */}
      {enabledBookText ? null : null}
    </div>
  )
}

export default WorldBooksEditor

