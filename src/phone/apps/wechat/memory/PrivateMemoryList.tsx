import { motion } from 'framer-motion'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  WECHAT_LUMI_ASSISTANT_CONTACT,
  type WeChatContactRow,
} from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { resolveOfflineDatingArchiveContext } from '../dating/offlineDatingArchiveResolve'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory, CharacterMemoryTriggerMode } from '../newFriendsPersona/types'
import { uid } from '../newFriendsPersona/utils'
import { reconcileMemoryUserPlaceholdersOnSave } from '../memoryUserPlaceholderBindings'
import { MemoryContentWithSourceBadgesFromRow } from './memoryContentExpanded'
import { composeMemoryWithSourcePrefix, parseMemorySourcePrefix } from './memorySourceBadges'
import { memoryTextMatchesQuery } from './memorySearchFilter'
import {
  MemoryManualPlaceholderToolbar,
  useMemoryDraftPlaceholderPreview,
} from './MemoryManualPlaceholderToolbar'
import { MemoryManualKeywordEditor } from './MemoryManualKeywordEditor'
import { MemoryTriggerModeBadge } from './MemoryTriggerModeBadge'
import { flattenMemoryTriggerKeywords, formatMemoryTriggerSummaryLine } from './memoryTriggerUtils'

function buildAddressBookRows(contacts: WeChatContactRow[]): WeChatContactRow[] {
  const lumi = contacts.find((c) => c.id === WECHAT_LUMI_ASSISTANT_CONTACT.id)
  const rest = contacts.filter((c) => c.id !== WECHAT_LUMI_ASSISTANT_CONTACT.id)
  rest.sort((a, b) => a.remarkName.localeCompare(b.remarkName, 'zh-CN'))
  return lumi ? [lumi, ...rest] : rest
}

function formatTs(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function MemoryCardBody({ memory, clamp }: { memory: CharacterMemory; clamp: boolean }) {
  const { body } = parseMemorySourcePrefix(memory.content)
  const [open, setOpen] = useState(false)
  const long = body.length > 120 || body.split('\n').length > 3
  const showClamp = clamp && long && !open
  return (
    <div>
      <p
        className={`text-[14px] leading-relaxed text-neutral-600 ${showClamp ? 'line-clamp-3' : ''} whitespace-pre-wrap`}
      >
        <MemoryContentWithSourceBadgesFromRow
          memory={memory}
          bodyClassName="text-[14px] leading-relaxed text-neutral-600 whitespace-pre-wrap"
          emptyBodyFallback="—"
        />
      </p>
      {clamp && long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-[12px] text-neutral-400 underline decoration-neutral-200 underline-offset-4 transition-colors hover:text-neutral-700"
        >
          {open ? '收起' : '…展开'}
        </button>
      ) : null}
    </div>
  )
}

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const } },
}

export function PrivateMemoryList({ contacts }: { contacts: WeChatContactRow[] }) {
  const [memories, setMemories] = useState<CharacterMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [subTab, setSubTab] = useState<'own' | 'linked'>('own')

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const all = await personaDb.listAllCharacterMemories()
      const priv = all.filter((m) => m.memoryScope !== 'group')
      setMemories(priv)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const on = () => void reload({ silent: true })
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [reload])

  const rows = useMemo(() => buildAddressBookRows(contacts), [contacts])

  const byCharacter = useMemo(() => {
    const m = new Map<string, CharacterMemory[]>()
    for (const mem of memories) {
      const cid = mem.characterId
      if (!m.has(cid)) m.set(cid, [])
      m.get(cid)!.push(mem)
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    return m
  }, [memories])

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows
    return rows.filter((r) => (byCharacter.get(r.id) ?? []).some((m) => memoryTextMatchesQuery(m, searchQuery)))
  }, [rows, byCharacter, searchQuery])

  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null)
      return
    }
    if (!filteredRows.length) {
      setSelectedId(null)
      return
    }
    if (selectedId && filteredRows.some((r) => r.id === selectedId)) return
    setSelectedId(filteredRows[0]!.id)
  }, [rows, filteredRows, selectedId])

  useEffect(() => {
    setSubTab('own')
  }, [selectedId])

  const activeListRaw = selectedId ? byCharacter.get(selectedId) ?? [] : []
  const activeList = useMemo(() => {
    if (!searchQuery.trim()) return activeListRaw
    return activeListRaw.filter((m) => memoryTextMatchesQuery(m, searchQuery))
  }, [activeListRaw, searchQuery])

  const activeOwnList = useMemo(
    () => activeList.filter((m) => m.memoryScope !== 'linked'),
    [activeList],
  )
  const activeLinkedList = useMemo(() => activeList.filter((m) => m.memoryScope === 'linked'), [activeList])
  const displayedList = subTab === 'own' ? activeOwnList : activeLinkedList

  const deleteMemory = async (id: string) => {
    if (!window.confirm('删除这条记忆？')) return
    await personaDb.deleteCharacterMemory(id)
    await reload({ silent: true })
  }

  const [editRow, setEditRow] = useState<CharacterMemory | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editTriggerMode, setEditTriggerMode] = useState<CharacterMemoryTriggerMode>('keyword')
  const [editKeywords, setEditKeywords] = useState<string[]>([])
  const [editKwKey, setEditKwKey] = useState(0)

  const saveEdit = async () => {
    if (!editRow) return
    const t = editDraft.trim()
    if (!t) return
    const flags = parseMemorySourcePrefix(editRow.content)
    let body = t
    const reconciled = await reconcileMemoryUserPlaceholdersOnSave({
      content: body,
      userPlaceholderBindings: editRow.userPlaceholderBindings,
      sourceWechatAccountId: editRow.sourceWechatAccountId,
      sourceSessionPlayerIdentityId: editRow.sourceSessionPlayerIdentityId,
    })
    body = reconciled.content
    const content = composeMemoryWithSourcePrefix(flags, body).slice(0, 4000)
    const mode: CharacterMemoryTriggerMode = editTriggerMode === 'always' ? 'always' : 'keyword'
    const normalized = [...new Set(editKeywords.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))]
    const kws = normalized.length ? normalized : undefined
    await personaDb.upsertCharacterMemory({
      ...editRow,
      content,
      ...(reconciled.userPlaceholderBindings.length
        ? { userPlaceholderBindings: reconciled.userPlaceholderBindings }
        : {}),
      memoryTriggerMode: mode,
      memoryTriggerCategory: undefined,
      memoryTriggerPrecise: undefined,
      memoryTriggerEmotionNeed: undefined,
      memoryKeywords: kws,
      updatedAt: Date.now(),
      isAutoGenerated: false,
    })
    setEditRow(null)
    await reload({ silent: true })
  }

  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState('')
  const [addTriggerMode, setAddTriggerMode] = useState<CharacterMemoryTriggerMode>('keyword')
  const [addKeywords, setAddKeywords] = useState<string[]>([])
  const [addKwKey, setAddKwKey] = useState(0)
  const [addMemoryScope, setAddMemoryScope] = useState<'private' | 'linked'>('private')
  const [addLinkedRootId, setAddLinkedRootId] = useState<string | null>(null)
  const addTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!addOpen || !selectedId) {
      setAddLinkedRootId(null)
      return
    }
    if (addMemoryScope !== 'linked') {
      setAddLinkedRootId(null)
      return
    }
    let cancelled = false
    void resolveOfflineDatingArchiveContext(selectedId).then((ctx) => {
      if (!cancelled) setAddLinkedRootId(ctx?.archiveCharacterId?.trim() || selectedId)
    })
    return () => {
      cancelled = true
    }
  }, [addOpen, selectedId, addMemoryScope])

  const addPlaceholderPreview = useMemoryDraftPlaceholderPreview({
    draft: addDraft,
    characterId: addOpen ? selectedId : null,
    memoryScope: addMemoryScope === 'linked' ? 'linked' : 'private',
    linkedFromCharacterId: addLinkedRootId,
  })

  const editPlaceholderPreview = useMemoryDraftPlaceholderPreview({
    draft: editDraft,
    characterId: editRow?.characterId ?? null,
    memoryScope: editRow?.memoryScope === 'linked' ? 'linked' : 'private',
    linkedFromCharacterId: editRow?.linkedFromCharacterId,
    involvedCharIds: editRow?.involvedCharIds,
    userPlaceholderBindings: editRow?.userPlaceholderBindings,
    sourceWechatAccountId: editRow?.sourceWechatAccountId,
    sourceSessionPlayerIdentityId: editRow?.sourceSessionPlayerIdentityId,
  })

  const saveAdd = async () => {
    if (!selectedId) return
    const t = addDraft.trim()
    if (!t) return
    const now = Date.now()
    const mode: CharacterMemoryTriggerMode = addTriggerMode === 'always' ? 'always' : 'keyword'
    const normalized = [...new Set(addKeywords.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))]
    const kws = normalized.length ? normalized : undefined
    const scope = addMemoryScope
    let content = t.slice(0, 4000)
    let linkedFromCharacterId: string | undefined
    if (scope === 'linked') {
      const ctx = await resolveOfflineDatingArchiveContext(selectedId)
      linkedFromCharacterId = ctx?.archiveCharacterId?.trim() || selectedId
      content = composeMemoryWithSourcePrefix(
        {
          hasOnlineTag: false,
          hasGroupChatTag: false,
          hasOfflineTag: false,
          hasLinkedOfflineTag: true,
          hasMeetTag: false,
        },
        t,
      ).slice(0, 4000)
    }
    await personaDb.upsertCharacterMemory({
      id: uid('mem'),
      characterId: selectedId,
      content,
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: false,
      memoryScope: scope === 'linked' ? 'linked' : 'private',
      ...(linkedFromCharacterId ? { linkedFromCharacterId } : {}),
      memoryTriggerMode: mode,
      memoryTriggerCategory: undefined,
      memoryTriggerPrecise: undefined,
      memoryTriggerEmotionNeed: undefined,
      memoryKeywords: kws,
    })
    setAddOpen(false)
    setAddDraft('')
    await reload({ silent: true })
  }

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center py-16 text-[13px] text-neutral-400">加载中…</div>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <div className="border-b border-neutral-100 px-4 pb-3 pt-2 md:px-6">
        <label className="sr-only" htmlFor="private-memory-search">
          搜索私人记忆关键词
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.75} aria-hidden />
          <input
            id="private-memory-search"
            type="search"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索关键词…"
            className="w-full rounded-[10px] border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-3 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          />
        </div>
      </div>

      <div className="flex w-full flex-col md:flex-row md:items-start">
      <aside className="shrink-0 border-b border-neutral-100 bg-white md:w-[148px] md:border-b-0 md:border-r md:px-2 md:py-3">
        <div className="flex gap-2 overflow-x-auto px-3 py-2 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:py-0">
          {filteredRows.map((r) => {
            const allM = byCharacter.get(r.id) ?? []
            const n = searchQuery.trim()
              ? allM.filter((m) => memoryTextMatchesQuery(m, searchQuery)).length
              : allM.length
            const sel = selectedId === r.id
            return (
              <Pressable
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-2 py-1.5 md:rounded-[10px] md:px-2 md:py-2 ${
                  sel ? 'bg-neutral-950 text-white md:bg-transparent md:text-inherit' : 'bg-neutral-50 md:bg-transparent'
                }`}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white ${
                    sel ? 'border-neutral-950 md:border-neutral-950' : 'border-neutral-200'
                  }`}
                >
                  {r.avatarUrl ? (
                    <img src={r.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-neutral-300">—</span>
                  )}
                </div>
                <div className="min-w-0 text-left md:block">
                  <p
                    className={`truncate text-[13px] ${sel ? 'md:text-neutral-950 md:font-medium' : 'text-neutral-600'}`}
                  >
                    {r.remarkName}
                  </p>
                  <p className={`hidden text-[11px] md:block ${sel ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    {n} 条
                  </p>
                </div>
              </Pressable>
            )
          })}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-10 pt-4 md:px-6">
        {!selectedId ? (
          <p className="py-12 text-center text-[13px] text-neutral-400">
            {searchQuery.trim() ? '无匹配联系人' : '请选择左侧联系人'}
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-[10px] border border-neutral-100 bg-neutral-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setSubTab('own')}
                  className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    subTab === 'own' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  自有记忆（{activeOwnList.length}）
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('linked')}
                  className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    subTab === 'linked'
                      ? 'bg-white text-neutral-950 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  关联记忆（{activeLinkedList.length}）
                </button>
              </div>
              <Pressable
                type="button"
                onClick={() => {
                  setAddDraft('')
                  setAddTriggerMode('keyword')
                  setAddKeywords([])
                  setAddKwKey((k) => k + 1)
                  setAddMemoryScope(subTab === 'linked' ? 'linked' : 'private')
                  setAddOpen(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-800 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                添加记忆
              </Pressable>
            </div>
            {displayedList.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-neutral-400">
                {searchQuery.trim()
                  ? '无匹配记忆'
                  : subTab === 'linked'
                    ? '暂无关联记忆（来自绑定主角线下剧情中与本角色相关的摘录）'
                    : '暂无私人记忆'}
              </p>
            ) : (
              <motion.ul className="flex flex-col gap-3" variants={listVariants} initial="hidden" animate="show">
                {displayedList.map((mem) => (
                  <motion.li key={mem.id} variants={itemVariants} layout>
                    <div className="group relative rounded-[12px] border border-neutral-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <MemoryTriggerModeBadge mode={mem.memoryTriggerMode} />
                          <p className="text-[11px] tracking-wide text-neutral-400">{formatTs(mem.updatedAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1 opacity-40 transition-opacity group-hover:opacity-100">
                          <Pressable
                            type="button"
                            aria-label="编辑"
                            className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
                            onClick={() => {
                              setEditRow(mem)
                              setEditDraft(parseMemorySourcePrefix(mem.content).body || mem.content)
                              setEditTriggerMode(mem.memoryTriggerMode === 'always' ? 'always' : 'keyword')
                              setEditKeywords(flattenMemoryTriggerKeywords(mem))
                              setEditKwKey((k) => k + 1)
                            }}
                          >
                            <Edit2 className="size-4" strokeWidth={1.5} />
                          </Pressable>
                          <Pressable
                            type="button"
                            aria-label="删除"
                            className="rounded-md p-1.5 text-red-900/55 hover:bg-neutral-50 hover:text-red-900"
                            onClick={() => void deleteMemory(mem.id)}
                          >
                            <Trash2 className="size-4" strokeWidth={1.5} />
                          </Pressable>
                        </div>
                      </div>
                      <div className="mt-3">
                        <MemoryCardBody memory={mem} clamp />
                        <p className="mt-2 text-[12px] leading-snug text-neutral-500">
                          {formatMemoryTriggerSummaryLine(mem)}
                        </p>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </>
        )}
      </main>
      </div>

      {addOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[50000] flex min-h-0 items-center justify-center overflow-y-auto overscroll-contain bg-black/40 px-4 py-10 sm:py-14"
              role="presentation"
              onClick={() => setAddOpen(false)}
            >
          <div
            role="dialog"
            aria-modal
            className="my-auto max-h-[min(90dvh,720px)] w-full max-w-[400px] overflow-y-auto rounded-[14px] border border-neutral-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-medium text-neutral-950">添加记忆</p>
            <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
              {addMemoryScope === 'linked' ? (
                <>
                  本条将存入「关联记忆」并自动加上
                  <span className="text-neutral-600"> [关联线下] </span>
                  前缀；正文写线下情境中与该角色有关的事实即可。
                </>
              ) : (
                <>
                  可直接输入正文；需要时在文首加
                  <span className="text-neutral-600"> [遇见] [私聊] [群聊] [线下] [关联线下] </span>
                  标记来源（顺序须一致）。
                </>
              )}
            </p>
            <textarea
              ref={addTextareaRef}
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              placeholder="输入记忆内容…"
              className="mt-3 min-h-[160px] w-full resize-y rounded-[10px] border border-neutral-100 bg-neutral-50 px-3 py-2 text-[14px] text-neutral-800 outline-none focus:border-neutral-950"
            />
            <MemoryManualPlaceholderToolbar
              textareaRef={addTextareaRef}
              value={addDraft}
              onChange={setAddDraft}
              previewExpanded={addPlaceholderPreview.expanded}
              previewLoading={addPlaceholderPreview.loading}
              placeholderCharacterId={addOpen ? selectedId : null}
              memoryScope={addMemoryScope === 'linked' ? 'linked' : 'private'}
              involvedCharIds={null}
            />
            <MemoryManualKeywordEditor
              key={addKwKey}
              radioGroupName="private-memory-add-trigger"
              triggerMode={addTriggerMode}
              onTriggerMode={setAddTriggerMode}
              keywords={addKeywords}
              onKeywordsChange={setAddKeywords}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Pressable
                type="button"
                className="rounded-[10px] px-4 py-2 text-[14px] text-neutral-500 hover:bg-neutral-50"
                onClick={() => setAddOpen(false)}
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                className="rounded-[10px] bg-neutral-950 px-4 py-2 text-[14px] text-white"
                onClick={() => void saveAdd()}
              >
                保存
              </Pressable>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}

      {editRow
        ? createPortal(
            <div
              className="fixed inset-0 z-[50000] flex min-h-0 items-center justify-center overflow-y-auto overscroll-contain bg-black/40 px-4 py-10 sm:py-14"
              role="presentation"
              onClick={() => setEditRow(null)}
            >
          <div
            role="dialog"
            aria-modal
            className="my-auto max-h-[min(90dvh,720px)] w-full max-w-[400px] overflow-y-auto rounded-[14px] border border-neutral-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-medium text-neutral-950">编辑记忆</p>
            <textarea
              ref={editTextareaRef}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="mt-3 min-h-[160px] w-full resize-y rounded-[10px] border border-neutral-100 bg-neutral-50 px-3 py-2 text-[14px] text-neutral-800 outline-none focus:border-neutral-950"
            />
            <MemoryManualPlaceholderToolbar
              textareaRef={editTextareaRef}
              value={editDraft}
              onChange={setEditDraft}
              previewExpanded={editPlaceholderPreview.expanded}
              previewLoading={editPlaceholderPreview.loading}
              placeholderCharacterId={editRow?.characterId ?? null}
              memoryScope={editRow?.memoryScope === 'linked' ? 'linked' : 'private'}
              involvedCharIds={editRow?.involvedCharIds ?? null}
            />
            <MemoryManualKeywordEditor
              key={editKwKey}
              radioGroupName="private-memory-edit-trigger"
              triggerMode={editTriggerMode}
              onTriggerMode={setEditTriggerMode}
              keywords={editKeywords}
              onKeywordsChange={setEditKeywords}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Pressable
                type="button"
                className="rounded-[10px] px-4 py-2 text-[14px] text-neutral-500 hover:bg-neutral-50"
                onClick={() => setEditRow(null)}
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                className="rounded-[10px] bg-neutral-950 px-4 py-2 text-[14px] text-white"
                onClick={() => void saveEdit()}
              >
                保存
              </Pressable>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
