import { motion } from 'framer-motion'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory, CharacterMemoryTriggerMode, GroupChatRow } from '../newFriendsPersona/types'
import { uid } from '../newFriendsPersona/utils'
import { reconcileMemoryUserPlaceholdersOnSave } from '../memoryUserPlaceholderBindings'
import {
  groupMemoryBucketCharacterId,
  parseGroupIdFromMemoryBucketCharacterId,
  WECHAT_GROUP_BOT_CHARACTER_ID,
  WECHAT_GROUP_USER_CHAR_ID,
} from '../wechatConversationKey'
import { groupTitleMatchesQuery, memoryTextMatchesQuery } from './memorySearchFilter'
import {
  composeMemoryWithSourcePrefix,
  MemoryContentWithSourceBadges,
  parseMemorySourcePrefix,
} from './memorySourceBadges'
import {
  MemoryManualPlaceholderToolbar,
  useMemoryDraftPlaceholderPreview,
} from './MemoryManualPlaceholderToolbar'
import { MemoryManualKeywordEditor } from './MemoryManualKeywordEditor'
import { MemoryTriggerModeBadge } from './MemoryTriggerModeBadge'
import { flattenMemoryTriggerKeywords, formatMemoryTriggerSummaryLine } from './memoryTriggerUtils'

function formatTs(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function MemoryCardBody({ content, clamp }: { content: string; clamp: boolean }) {
  const { body } = parseMemorySourcePrefix(content)
  const [open, setOpen] = useState(false)
  const long = body.length > 140 || body.split('\n').length > 4
  const showClamp = clamp && long && !open
  return (
    <div>
      <p
        className={`text-[14px] leading-relaxed text-neutral-600 whitespace-pre-wrap ${showClamp ? 'line-clamp-3' : ''}`}
      >
        <MemoryContentWithSourceBadges
          content={content}
          bodyClassName="text-[14px] leading-relaxed text-neutral-600 whitespace-pre-wrap"
          emptyBodyFallback="—"
        />
      </p>
      {clamp && long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-[12px] text-neutral-400 underline decoration-neutral-200 underline-offset-4 hover:text-neutral-700"
        >
          {open ? '收起' : '…展开'}
        </button>
      ) : null}
    </div>
  )
}

function involvedIdsForGroup(g: GroupChatRow | undefined): string[] | undefined {
  const ids =
    g?.members
      .map((m) => m.charId.trim())
      .filter((cid) => cid && cid !== WECHAT_GROUP_USER_CHAR_ID && cid !== WECHAT_GROUP_BOT_CHARACTER_ID) ?? []
  return ids.length ? ids : undefined
}

const groupCardVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.03 },
  },
}

const groupItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const } },
}

export function GroupMemoryList({
  playerIdentityId,
  playerDisplayName: _playerDisplayName,
}: {
  playerIdentityId: string
  playerDisplayName: string
}) {
  const pid = playerIdentityId.trim()
  const [memories, setMemories] = useState<CharacterMemory[]>([])
  const [groups, setGroups] = useState<GroupChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!pid) {
      setMemories([])
      setGroups([])
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      const all = await personaDb.listAllCharacterMemories()
      const grpMem = all.filter((m) => m.memoryScope === 'group')
      setMemories(grpMem)
      const gl = await personaDb.listGroupChatsForPlayerIdentity(pid)
      setGroups(gl)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [pid])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const on = () => void reload({ silent: true })
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [reload])

  const groupMetaById = useMemo(() => {
    const m = new Map<string, GroupChatRow>()
    for (const g of groups) m.set(g.id.trim(), g)
    return m
  }, [groups])

  const grouped = useMemo(() => {
    const m = new Map<string, CharacterMemory[]>()
    for (const mem of memories) {
      const gid =
        mem.groupId?.trim() ||
        parseGroupIdFromMemoryBucketCharacterId(mem.characterId) ||
        ''
      if (!gid) continue
      if (!m.has(gid)) m.set(gid, [])
      m.get(gid)!.push(mem)
    }
    for (const [, arr] of m) arr.sort((a, b) => b.updatedAt - a.updatedAt)
    return m
  }, [memories])

  const allGroupIds = useMemo(() => {
    const s = new Set<string>()
    for (const g of groups) s.add(g.id.trim())
    for (const k of grouped.keys()) s.add(k)
    return [...s]
  }, [groups, grouped])

  const displayBlocks = useMemo(() => {
    const sorted = [...allGroupIds].sort((a, b) => {
      const ta = grouped.get(a)?.[0]?.updatedAt ?? 0
      const tb = grouped.get(b)?.[0]?.updatedAt ?? 0
      return tb - ta
    })
    const q = searchQuery.trim()
    if (!q) {
      return sorted.map((gid) => ({ gid, items: grouped.get(gid) ?? [] }))
    }
    const out: { gid: string; items: CharacterMemory[] }[] = []
    for (const gid of sorted) {
      const items = grouped.get(gid) ?? []
      const meta = groupMetaById.get(gid)
      const title = meta?.name?.trim() || `群聊 ${gid.slice(0, 6)}`
      const titleHit = groupTitleMatchesQuery(title, q)
      const memHits = items.filter((m) => memoryTextMatchesQuery(m, q))
      if (titleHit) out.push({ gid, items })
      else if (memHits.length) out.push({ gid, items: memHits })
    }
    return out
  }, [allGroupIds, grouped, groupMetaById, searchQuery])

  const deleteMemory = async (id: string) => {
    if (!window.confirm('删除这条群聊记忆？')) return
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
    const reconciled = await reconcileMemoryUserPlaceholdersOnSave({
      content: t,
      userPlaceholderBindings: editRow.userPlaceholderBindings,
      sourceWechatAccountId: editRow.sourceWechatAccountId,
      sourceSessionPlayerIdentityId: editRow.sourceSessionPlayerIdentityId,
    })
    const content = composeMemoryWithSourcePrefix(flags, reconciled.content).slice(0, 4000)
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
  const [addTargetGid, setAddTargetGid] = useState<string | null>(null)
  const [addDraft, setAddDraft] = useState('')
  const [addTriggerMode, setAddTriggerMode] = useState<CharacterMemoryTriggerMode>('keyword')
  const [addKeywords, setAddKeywords] = useState<string[]>([])
  const [addKwKey, setAddKwKey] = useState(0)

  const addTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const addBucketId = addTargetGid ? groupMemoryBucketCharacterId(addTargetGid) : ''
  const addInvolvedPreview = useMemo(() => {
    if (!addTargetGid) return null
    return involvedIdsForGroup(groupMetaById.get(addTargetGid))
  }, [addTargetGid, groupMetaById])

  const addPlaceholderPreview = useMemoryDraftPlaceholderPreview({
    draft: addDraft,
    characterId: addOpen ? addBucketId : null,
    memoryScope: 'group',
    involvedCharIds: addInvolvedPreview ?? undefined,
  })

  const editPlaceholderPreview = useMemoryDraftPlaceholderPreview({
    draft: editDraft,
    characterId: editRow?.characterId ?? null,
    memoryScope: 'group',
    involvedCharIds: editRow?.involvedCharIds,
    userPlaceholderBindings: editRow?.userPlaceholderBindings,
    sourceWechatAccountId: editRow?.sourceWechatAccountId,
    sourceSessionPlayerIdentityId: editRow?.sourceSessionPlayerIdentityId,
  })

  const saveAdd = async () => {
    const gid = addTargetGid?.trim()
    if (!gid) return
    const t = addDraft.trim()
    if (!t) return
    const now = Date.now()
    const meta = groupMetaById.get(gid)
    const involvedCharIds = involvedIdsForGroup(meta)
    const mode: CharacterMemoryTriggerMode = addTriggerMode === 'always' ? 'always' : 'keyword'
    const normalized = [...new Set(addKeywords.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean))]
    const kws = normalized.length ? normalized : undefined
    await personaDb.upsertCharacterMemory({
      id: uid('mem'),
      characterId: groupMemoryBucketCharacterId(gid),
      content: t.slice(0, 4000),
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: false,
      memoryScope: 'group',
      groupId: gid,
      memoryTriggerMode: mode,
      memoryTriggerCategory: undefined,
      memoryTriggerPrecise: undefined,
      memoryTriggerEmotionNeed: undefined,
      memoryKeywords: kws,
      ...(involvedCharIds ? { involvedCharIds } : {}),
    })
    setAddOpen(false)
    setAddTargetGid(null)
    setAddDraft('')
    await reload({ silent: true })
  }

  if (!pid) {
    return <div className="py-12 text-center text-[13px] text-neutral-400">请先选择玩家身份</div>
  }

  if (loading) {
    return <div className="flex w-full items-center justify-center py-16 text-[13px] text-neutral-400">加载中…</div>
  }

  if (!allGroupIds.length) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[14px] text-neutral-500">暂无群聊记忆</p>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
          加入群聊后，可在此查看自动总结的记忆，也可手动添加。
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <div className="border-b border-neutral-100 px-4 pb-3 pt-2 md:px-6">
        <label className="sr-only" htmlFor="group-memory-search">
          搜索群像记忆关键词
        </label>
        <div className="relative mx-auto max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.75} aria-hidden />
          <input
            id="group-memory-search"
            type="search"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索关键词…"
            className="w-full rounded-[10px] border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-3 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-950"
          />
        </div>
      </div>

      <motion.div
        className="w-full px-4 pb-12 pt-2 md:px-6"
        variants={groupCardVariants}
        initial="hidden"
        animate="show"
      >
        {!displayBlocks.length && searchQuery.trim() ? (
          <p className="mx-auto max-w-xl py-12 text-center text-[13px] text-neutral-400">无匹配群聊记忆</p>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col gap-8">
            {displayBlocks.map(({ gid, items }) => {
              const meta = groupMetaById.get(gid)
              const title = meta?.name?.trim() || `群聊 ${gid.slice(0, 6)}`
              const groupAvatarSrc = meta?.avatar?.trim()

              return (
                <motion.section key={gid} variants={groupItemVariants} className="rounded-[14px] border border-neutral-100 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[16px] font-semibold tracking-tight text-neutral-950">{title}</h3>
                      <p className="mt-0.5 text-[11px] tracking-[0.12em] text-neutral-400">GROUP MEMORY</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Pressable
                        type="button"
                        onClick={() => {
                          setAddTargetGid(gid)
                          setAddDraft('')
                          setAddTriggerMode('keyword')
                          setAddKeywords([])
                          setAddKwKey((k) => k + 1)
                          setAddOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded-[10px] border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-neutral-800 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                      >
                        <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                        添加
                      </Pressable>
                      <div
                        className="flex size-10 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 shadow-sm"
                        title={title}
                      >
                        {groupAvatarSrc ? (
                          <img src={groupAvatarSrc} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-[11px] font-medium text-neutral-400">
                            群
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {items.length === 0 ? (
                      <li className="px-4 py-8 text-center text-[13px] text-neutral-400">暂无记忆条目，可点击「添加」手写一条。</li>
                    ) : (
                      items.map((mem) => (
                        <li key={mem.id} className="group/row px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <MemoryTriggerModeBadge mode={mem.memoryTriggerMode} />
                              <p className="text-[11px] text-neutral-400">{formatTs(mem.updatedAt)}</p>
                            </div>
                            <div className="flex shrink-0 gap-1 opacity-40 transition-opacity group-hover/row:opacity-100">
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
                          <div className="mt-2">
                            <MemoryCardBody content={mem.content} clamp />
                            <p className="mt-2 text-[12px] leading-snug text-neutral-500">
                              {formatMemoryTriggerSummaryLine(mem)}
                            </p>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </motion.section>
              )
            })}
          </div>
        )}
      </motion.div>

      {addOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[50000] flex min-h-0 items-center justify-center overflow-y-auto overscroll-contain bg-black/40 px-4 py-10 sm:py-14"
              role="presentation"
              onClick={() => {
                setAddOpen(false)
                setAddTargetGid(null)
              }}
            >
          <div
            role="dialog"
            aria-modal
            className="my-auto max-h-[min(90dvh,720px)] w-full max-w-[400px] overflow-y-auto rounded-[14px] border border-neutral-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-medium text-neutral-950">添加群聊记忆</p>
            <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
              可直接输入正文；需要时在文首加
              <span className="text-neutral-600"> [私聊] [群聊] [线下] </span>
              标记来源（顺序须一致）。
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
              placeholderCharacterId={addOpen ? addBucketId : null}
              memoryScope="group"
              involvedCharIds={addInvolvedPreview ?? null}
            />
            <MemoryManualKeywordEditor
              key={addKwKey}
              radioGroupName="group-memory-add-trigger"
              triggerMode={addTriggerMode}
              onTriggerMode={setAddTriggerMode}
              keywords={addKeywords}
              onKeywordsChange={setAddKeywords}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Pressable
                type="button"
                className="rounded-[10px] px-4 py-2 text-[14px] text-neutral-500 hover:bg-neutral-50"
                onClick={() => {
                  setAddOpen(false)
                  setAddTargetGid(null)
                }}
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
            <p className="text-[15px] font-medium text-neutral-950">编辑群聊记忆</p>
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
              memoryScope="group"
              involvedCharIds={editRow?.involvedCharIds ?? null}
            />
            <MemoryManualKeywordEditor
              key={editKwKey}
              radioGroupName="group-memory-edit-trigger"
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
