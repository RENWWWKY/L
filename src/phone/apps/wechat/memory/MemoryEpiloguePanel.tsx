import { motion } from 'framer-motion'
import { ChevronDown, Pencil, Search, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import { Pressable } from '../../../components/Pressable'
import type { MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { ARCHIVE_BG, archiveSerifTextStyle, ARCHIVE_SOFT_BODY_PANEL, ARCHIVE_SOFT_BTN_PRIMARY, ARCHIVE_SOFT_BTN_SECONDARY, ARCHIVE_SOFT_CARD, ARCHIVE_SOFT_CARD_OPEN, ARCHIVE_SOFT_CHIP, ARCHIVE_SOFT_SECTION, ARCHIVE_SOFT_TEXTAREA, MEMORY_ARCHIVE_SERIF_CLASS } from './memoryArchiveTheme'
import { MemoryArchiveBackToTop } from './MemoryArchiveBackToTop'
import { MemoryCharacterRoster } from './MemoryCharacterRoster'
import {
  buildEpilogueArchiveRoster,
  gatherLatestRoundBodyForEpilogue,
  loadEpilogueArchiveForCharacter,
  type EpilogueArchiveEntry,
  type EpilogueArchiveRosterItem,
} from './memoryEpilogueArchive'
import {
  applyEpilogueWorldBookItemDelete,
  applyEpilogueWorldBookItemPatch,
  deleteEpilogueWorldBookItem,
  persistEpilogueCharacter,
  resolveEpilogueLoreEditorSupport,
  type EpilogueLoreEditorSupport,
} from './memoryEpilogueWorldBookEdit'
import { rosterMatchesSearch } from './memoryArchiveFilter'
import { useDebouncedValue } from './useDebouncedValue'
import { runManualEpilogueAlignment } from '../newFriendsPersona/worldBookAfterSync'
import { LoreEntryEditorSheet } from '../newFriendsPersona/LoreEntryEditorSheet'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, WorldBookItem } from '../newFriendsPersona/types'
import type { ApiConfig } from '../../api/types'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import {
  MEMORY_EPILOGUE_COACH_STEPS,
  MEMORY_EPILOGUE_START_COACH_EVENT,
  MEMORY_EPILOGUE_TUTORIAL_SECTIONS,
} from './memoryEpilogueCoachSteps'
import { MEMORY_EPILOGUE_COACH_SEEN_KEY } from './memoryCoachTypes'
import { useMemoryTabCoach } from './useMemoryTabCoach'

function stopPointerBubble(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

function epilogueEntryPreview(content: string): string {
  const line = content.split('\n').find((l) => l.trim())?.trim()
  if (line) return line.length > 120 ? `${line.slice(0, 120)}…` : line
  const trimmed = content.trim()
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed
}

function EpilogueEntryCard({
  entry,
  index,
  onEdit,
  onDelete,
}: {
  entry: EpilogueArchiveEntry
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const [showPrevious, setShowPrevious] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const title = entry.itemName.trim() || `条目 ${index}`
  const preview = epilogueEntryPreview(entry.contentDisplay)
  const previousText = entry.contentPreviousDisplay?.trim() ?? ''
  const hasPrevious =
    previousText.length > 0 &&
    (entry.contentPreviousRaw?.trim() ?? previousText) !== entry.contentRaw.trim()

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      window.setTimeout(() => setConfirmDelete(false), 3200)
      return
    }
    setConfirmDelete(false)
    onDelete()
  }

  return (
    <details
      className={`group overflow-hidden ${ARCHIVE_SOFT_CARD} ${ARCHIVE_SOFT_CARD_OPEN} ${MEMORY_ARCHIVE_SERIF_CLASS}`}
      style={archiveSerifTextStyle}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="border-b border-gray-100 bg-gradient-to-br from-gray-50/95 via-gray-50/40 to-white px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[12px] font-bold tabular-nums text-gray-800"
            >
              {index}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                尾声条目
              </p>
              <h4 className="mt-0.5 text-[16px] font-semibold leading-snug tracking-tight text-gray-900">
                {title}
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {entry.bookName.trim() ? (
                  <p className="inline-flex max-w-full items-center rounded-lg bg-white/80 px-2 py-1 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200/70">
                    <span className="truncate">世界书 · {entry.bookName.trim()}</span>
                  </p>
                ) : null}
                {hasPrevious ? (
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    有上一版
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Pressable
                type="button"
                onPointerDown={stopPointerBubble}
                onClick={(e) => {
                  stopPointerBubble(e)
                  onEdit()
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
                aria-label="编辑尾声条目"
              >
                <Pencil className="size-3.5" strokeWidth={1.75} />
              </Pressable>
              <Pressable
                type="button"
                onPointerDown={stopPointerBubble}
                onClick={(e) => {
                  stopPointerBubble(e)
                  handleDelete()
                }}
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[10px] font-semibold active:bg-gray-100 ${
                  confirmDelete ? 'bg-gray-900 text-white' : 'text-gray-400'
                }`}
                aria-label={confirmDelete ? '再次点击确认删除' : '删除尾声条目'}
              >
                {confirmDelete ? '确认' : <Trash2 className="size-3.5" strokeWidth={1.75} />}
              </Pressable>
              <ChevronDown
                className="size-4 text-gray-400 transition-transform duration-200 group-open:rotate-180"
                strokeWidth={2}
                aria-hidden
              />
            </div>
          </div>
        </div>
        {preview ? (
          <div className="px-4 py-3">
            <p className="line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-500 group-open:hidden">
              {preview}
            </p>
            <p className="text-[10px] font-medium text-gray-400 group-open:hidden">点击展开全文</p>
          </div>
        ) : null}
      </summary>
      <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            当前正文
          </p>
          {hasPrevious ? (
            <Pressable
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowPrevious((v) => !v)
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                showPrevious
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-white text-gray-700 ring-1 ring-gray-200/80'
              }`}
            >
              {showPrevious ? '收起上一版' : '查看上一版'}
            </Pressable>
          ) : null}
        </div>
        <div
          className={`max-h-[min(50vh,360px)] overflow-y-auto whitespace-pre-wrap break-words ${ARCHIVE_SOFT_BODY_PANEL} ${MEMORY_ARCHIVE_SERIF_CLASS}`}
          style={archiveSerifTextStyle}
        >
          {entry.contentDisplay.trim() || '（暂无正文）'}
        </div>
        {hasPrevious && showPrevious ? (
          <div className="mt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              上一版（本次更新前）
            </p>
            <div
              className={`max-h-[min(40vh,280px)] overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-dashed border-gray-200 bg-gray-50/90 px-3.5 py-3.5 text-[13px] leading-[1.75] text-gray-600 ${MEMORY_ARCHIVE_SERIF_CLASS}`}
              style={archiveSerifTextStyle}
            >
              {previousText}
            </div>
          </div>
        ) : null}
        {!hasPrevious ? (
          <p className="mt-2 text-[11px] text-gray-400">暂无上一版记录（下次自动或手动更新后会保留更新前正文）</p>
        ) : null}
      </div>
    </details>
  )
}

function EpilogueCharacterDetail({
  character,
  rosterIndex,
  rosterTotal,
  entries,
  alignDraft,
  alignBusy,
  alignFeedback,
  onAlignDraftChange,
  onRunAlign,
  onGatherLatest,
  onEditEntry,
  onDeleteEntry,
}: {
  character: EpilogueArchiveRosterItem
  rosterIndex: number
  rosterTotal: number
  entries: EpilogueArchiveEntry[]
  alignDraft: string
  alignBusy: boolean
  alignFeedback: string
  onAlignDraftChange: (v: string) => void
  onRunAlign: () => void
  onGatherLatest: () => void
  onEditEntry: (entry: EpilogueArchiveEntry) => void
  onDeleteEntry: (entry: EpilogueArchiveEntry) => void
}) {
  return (
    <div className={`pb-8 ${MEMORY_ARCHIVE_SERIF_CLASS}`} style={archiveSerifTextStyle}>
      <div className="px-4 pt-2" style={{ background: ARCHIVE_BG }}>
        <div className="overflow-hidden rounded-[28px] bg-white px-4 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-gray-50">
              {character.avatarUrl ? (
                <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[13px] font-semibold text-gray-400">
                  {character.displayName.slice(0, 2)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400">
                <ListenNumericText
                  text={
                    (rosterIndex >= 0 ? `${rosterIndex + 1} / ${rosterTotal} · ` : '') +
                    `共 ${entries.length} 条尾声延展`
                  }
                />
              </p>
              <p className="mt-1 text-[17px] font-semibold text-gray-900">{character.displayName}</p>
              {character.wechatRemarkName ? (
                <p className="mt-0.5 text-[12px] text-gray-400">备注 {character.wechatRemarkName}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <section className={`mx-4 mt-4 ${ARCHIVE_SOFT_SECTION}`}>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-gray-600" strokeWidth={1.75} />
          <h3 className="text-[13px] font-semibold text-gray-900">手动判断对齐</h3>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-gray-500">
          每轮自动判断仅在关系态有可持续变化时才会写库；多数轮次为「无变化」。若自动判断失败，可粘贴本轮剧情后在此补跑。
        </p>
        <textarea
          value={alignDraft}
          onChange={(e) => onAlignDraftChange(e.target.value)}
          disabled={alignBusy}
          rows={6}
          placeholder="粘贴本轮 AI 剧情 / 私聊回复正文…"
          className={ARCHIVE_SOFT_TEXTAREA}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Pressable
            type="button"
            disabled={alignBusy}
            onClick={onGatherLatest}
            className={ARCHIVE_SOFT_BTN_SECONDARY}
          >
            填入最近一轮
          </Pressable>
          <Pressable
            type="button"
            disabled={alignBusy || alignDraft.trim().length < 8}
            onClick={onRunAlign}
            className={ARCHIVE_SOFT_BTN_PRIMARY}
          >
            {alignBusy ? '判断中…' : '判断并对齐'}
          </Pressable>
        </div>
        {alignFeedback ? (
          <p className="mt-2 text-[12px] leading-relaxed text-gray-600">{alignFeedback}</p>
        ) : null}
      </section>

      <section className="mx-4 mt-5 pb-2">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-900">尾声延展条目</h3>
            <p className="mt-0.5 text-[11px] text-gray-400">
              可直接编辑或删除；改动会同步到该角色人设 · 世界书 Tab
            </p>
          </div>
          {entries.length ? (
            <span className={`shrink-0 ${ARCHIVE_SOFT_CHIP} tabular-nums`}>
              共 {entries.length} 条
            </span>
          ) : null}
        </div>
        {entries.length ? (
          <ul className="flex flex-col gap-3">
            {entries.map((entry, i) => (
              <motion.li
                key={`${entry.worldBookId}:${entry.itemId}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.12) }}
              >
                <EpilogueEntryCard
                  entry={entry}
                  index={i + 1}
                  onEdit={() => onEditEntry(entry)}
                  onDelete={() => onDeleteEntry(entry)}
                />
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[20px] bg-white px-4 py-8 text-center text-[13px] text-gray-400 shadow-sm">
            该角色暂无 priority=after 尾声延展条目。
          </p>
        )}
      </section>
    </div>
  )
}

export function MemoryEpiloguePanel({
  contacts,
  apiConfig,
  currentWechatAccountId,
  activeCharacterPageId,
  onCharacterPageChange,
  onRegisterCharacterNav,
  coachActive = true,
}: {
  contacts: WeChatContactRow[]
  apiConfig?: ApiConfig | null
  currentWechatAccountId?: string
  activeCharacterPageId?: string | null
  onCharacterPageChange?: (meta: MemoryCharacterPageMeta | null) => void
  onRegisterCharacterNav?: (nav: { prev: () => void; next: () => void } | null) => void
  coachActive?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [roster, setRoster] = useState<EpilogueArchiveRosterItem[]>([])
  const [view, setView] = useState<'roster' | 'detail'>('roster')
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 280)
  const [detailEntries, setDetailEntries] = useState<EpilogueArchiveEntry[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [alignDraft, setAlignDraft] = useState('')
  const [alignBusy, setAlignBusy] = useState(false)
  const [alignFeedback, setAlignFeedback] = useState('')
  const [editCharacter, setEditCharacter] = useState<Character | null>(null)
  const [sheetEntry, setSheetEntry] = useState<null | { worldBookId: string; itemId: string }>(null)
  const [loreEditorSupport, setLoreEditorSupport] = useState<EpilogueLoreEditorSupport>({
    networkPeersForInsert: [],
    worldBookUserInsertContext: null,
  })
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const coach = useMemoryTabCoach({
    seenKey: MEMORY_EPILOGUE_COACH_SEEN_KEY,
    coachActive: coachActive && view === 'roster',
    loading,
    startCoachEvent: MEMORY_EPILOGUE_START_COACH_EVENT,
  })

  const reloadRoster = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const items = await buildEpilogueArchiveRoster({ contacts })
      setRoster(items)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [contacts])

  const loadDetail = useCallback(async (charId: string) => {
    setDetailLoading(true)
    try {
      const entries = await loadEpilogueArchiveForCharacter(charId)
      setDetailEntries(entries)
      const latest = await gatherLatestRoundBodyForEpilogue(charId)
      setAlignDraft(latest)
      setAlignFeedback('')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const refreshEditCharacter = useCallback(
    async (charId: string) => {
      const ch = await personaDb.getCharacter(charId)
      setEditCharacter(ch ?? null)
      if (ch) {
        const support = await resolveEpilogueLoreEditorSupport(ch, currentWechatAccountId)
        setLoreEditorSupport(support)
      }
    },
    [currentWechatAccountId],
  )

  const refreshAfterWorldBookMutation = useCallback(
    async (charId: string) => {
      await loadDetail(charId)
      await reloadRoster({ silent: true })
      await refreshEditCharacter(charId)
    },
    [loadDetail, reloadRoster, refreshEditCharacter],
  )

  useEffect(() => {
    if (view === 'detail' && selectedCharId) void refreshEditCharacter(selectedCharId)
    else {
      setEditCharacter(null)
      setSheetEntry(null)
    }
  }, [view, selectedCharId, detailEntries, refreshEditCharacter])

  useEffect(() => {
    void reloadRoster()
    const onStorage = () => void reloadRoster({ silent: true })
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [reloadRoster])

  useEffect(() => {
    if (view === 'detail' && selectedCharId) void loadDetail(selectedCharId)
  }, [view, selectedCharId, loadDetail, roster])

  const rosterForDisplay = useMemo(
    () => roster.filter((item) => rosterMatchesSearch(item, debouncedSearch)),
    [roster, debouncedSearch],
  )

  const selectedCharacter = useMemo(
    () => roster.find((r) => r.charId === selectedCharId) ?? null,
    [roster, selectedCharId],
  )

  const selectedRosterIndex = useMemo(
    () => (selectedCharId ? roster.findIndex((c) => c.charId === selectedCharId) : -1),
    [roster, selectedCharId],
  )

  const openCharacter = useCallback((charId: string) => {
    setSelectedCharId(charId)
    setView('detail')
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const publishCharacterPage = useCallback(() => {
    if (!onCharacterPageChange) return
    if (view !== 'detail' || !selectedCharId || !selectedCharacter) {
      onCharacterPageChange(null)
      return
    }
    const idx = roster.findIndex((c) => c.charId === selectedCharId)
    onCharacterPageChange({
      charId: selectedCharId,
      displayName: selectedCharacter.displayName,
      rosterIndex: idx,
      rosterTotal: roster.length,
      canPrev: idx > 0,
      canNext: idx >= 0 && idx < roster.length - 1,
    })
  }, [view, selectedCharId, selectedCharacter, roster, onCharacterPageChange])

  const navigateCharacter = useCallback(
    (delta: -1 | 1) => {
      const idx = selectedRosterIndex
      if (idx < 0) return
      const next = roster[idx + delta]
      if (!next) return
      setSelectedCharId(next.charId)
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    },
    [selectedRosterIndex, roster],
  )

  useEffect(() => {
    publishCharacterPage()
  }, [publishCharacterPage])

  useEffect(() => {
    if (!onRegisterCharacterNav) return
    if (view !== 'detail') {
      onRegisterCharacterNav(null)
      return
    }
    onRegisterCharacterNav({
      prev: () => navigateCharacter(-1),
      next: () => navigateCharacter(1),
    })
    return () => onRegisterCharacterNav(null)
  }, [view, navigateCharacter, onRegisterCharacterNav])

  const prevActiveCharacterPageIdRef = useRef<string | null | undefined>(activeCharacterPageId)

  useEffect(() => {
    const prev = prevActiveCharacterPageIdRef.current
    prevActiveCharacterPageIdRef.current = activeCharacterPageId ?? null
    if (prev != null && activeCharacterPageId == null && view === 'detail') {
      setView('roster')
      setSelectedCharId(null)
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [activeCharacterPageId, view])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => setShowBackToTop(el.scrollTop > 480)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const handleRunAlign = useCallback(async () => {
    if (!selectedCharId || !selectedCharacter || alignBusy) return
    setAlignBusy(true)
    setAlignFeedback('')
    try {
      const outcome = await runManualEpilogueAlignment({
        apiConfig: apiConfig ?? null,
        characterId: selectedCharId,
        latestRoundBody: alignDraft,
        displayName: selectedCharacter.displayName,
      })
      if (outcome.status === 'applied') {
        setAlignFeedback(`已更新 ${outcome.count} 条尾声延展条目。`)
        await loadDetail(selectedCharId)
        await reloadRoster({ silent: true })
      } else if (outcome.status === 'no_change') {
        setAlignFeedback('判断完成：本轮剧情与当前尾声条目一致，无需更新。')
      } else if (outcome.status === 'failed') {
        setAlignFeedback(outcome.reason || '判断失败，请检查记忆配置中的 API。')
      } else {
        setAlignFeedback(outcome.reason || '已跳过。')
      }
    } finally {
      setAlignBusy(false)
    }
  }, [
    selectedCharId,
    selectedCharacter,
    alignBusy,
    alignDraft,
    apiConfig,
    loadDetail,
    reloadRoster,
  ])

  const handleGatherLatest = useCallback(async () => {
    if (!selectedCharId) return
    const latest = await gatherLatestRoundBodyForEpilogue(selectedCharId)
    if (latest) setAlignDraft(latest)
    else setAlignFeedback('未找到最近私聊或约会剧情正文，请手动粘贴。')
  }, [selectedCharId])

  const handlePatchItem = useCallback((wbId: string, itemId: string, patch: Partial<WorldBookItem>) => {
    setEditCharacter((prev) => {
      if (!prev) return prev
      return applyEpilogueWorldBookItemPatch(prev, wbId, itemId, patch)
    })
  }, [])

  const handleCloseSheet = useCallback(async () => {
    const charId = selectedCharId
    const draft = editCharacter
    setSheetEntry(null)
    if (!charId || !draft) return
    try {
      const persisted = await personaDb.getCharacter(charId)
      const draftBooks = JSON.stringify(draft.worldBooks ?? [])
      const persistedBooks = JSON.stringify(persisted?.worldBooks ?? [])
      if (persisted && draftBooks !== persistedBooks) {
        await persistEpilogueCharacter(draft)
        await refreshAfterWorldBookMutation(charId)
      }
    } catch (err) {
      console.warn('[epilogue-edit] save failed', err)
    }
  }, [selectedCharId, editCharacter, refreshAfterWorldBookMutation])

  const handleDeleteItem = useCallback(
    async (wbId: string, itemId: string) => {
      if (!selectedCharId) return
      if (editCharacter) {
        const next = applyEpilogueWorldBookItemDelete(editCharacter, wbId, itemId)
        if (next) {
          await persistEpilogueCharacter(next)
          setEditCharacter(next)
        }
      } else {
        await deleteEpilogueWorldBookItem({
          characterId: selectedCharId,
          worldBookId: wbId,
          itemId,
        })
      }
      setSheetEntry(null)
      await refreshAfterWorldBookMutation(selectedCharId)
    },
    [selectedCharId, editCharacter, refreshAfterWorldBookMutation],
  )

  const handleEditEntry = useCallback(
    (entry: EpilogueArchiveEntry) => {
      setSheetEntry({ worldBookId: entry.worldBookId, itemId: entry.itemId })
    },
    [],
  )

  const handleDeleteEntry = useCallback(
    async (entry: EpilogueArchiveEntry) => {
      if (!selectedCharId) return
      await deleteEpilogueWorldBookItem({
        characterId: selectedCharId,
        worldBookId: entry.worldBookId,
        itemId: entry.itemId,
      })
      if (
        sheetEntry?.worldBookId === entry.worldBookId &&
        sheetEntry.itemId === entry.itemId
      ) {
        setSheetEntry(null)
      }
      await refreshAfterWorldBookMutation(selectedCharId)
    },
    [selectedCharId, sheetEntry, refreshAfterWorldBookMutation],
  )

  const sheetWorldBook = sheetEntry
    ? editCharacter?.worldBooks?.find((w) => w.id === sheetEntry.worldBookId)
    : undefined
  const sheetItem = sheetWorldBook?.items?.find((it) => it.id === sheetEntry?.itemId)

  return (
    <div
      data-memory-coach-root="memory-epilogue"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{ background: ARCHIVE_BG }}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className="h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        >
          {view === 'roster' ? (
            <>
              <div className="px-4 pb-2 pt-3" style={{ background: ARCHIVE_BG }}>
                <div
                  data-memory-coach="epilogue-intro"
                  className="rounded-[24px] bg-white px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-gray-900">尾声延展</p>
                    <MemoryTutorialButton compact onClick={() => coach.setTutorialOpen(true)} />
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                    按角色查看关系、态度类世界书条目。聊天或剧情里会自动判断要不要改；也可以在这里直接改。
                  </p>
                  <div className="relative mt-3">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-300"
                      strokeWidth={1.75}
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="搜索角色名或备注"
                      className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-3 text-[14px] text-gray-900 outline-none ring-1 ring-gray-100 placeholder:text-gray-400 focus:ring-gray-200"
                    />
                  </div>
                  {!loading ? (
                    <p className="mt-3 text-[11px] text-gray-400">
                      {`${rosterForDisplay.length} 个角色 · 共 ${roster.reduce((s, r) => s + r.entryCount, 0)} 条尾声`}
                    </p>
                  ) : null}
                </div>
              </div>
              <MemoryCharacterRoster
                items={rosterForDisplay}
                loading={loading}
                searchQuery={debouncedSearch}
                onSelect={openCharacter}
                subtitleForCount={(n) => `共 ${n} 条尾声`}
                monochromeSceneTags
                firstItemCoachTarget="epilogue-roster"
              />
            </>
          ) : view === 'detail' && selectedCharId && selectedCharacter ? (
            detailLoading && !detailEntries.length ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200/80" />
              </div>
            ) : (
              <EpilogueCharacterDetail
                character={selectedCharacter}
                rosterIndex={selectedRosterIndex}
                rosterTotal={roster.length}
                entries={detailEntries}
                alignDraft={alignDraft}
                alignBusy={alignBusy}
                alignFeedback={alignFeedback}
                onAlignDraftChange={setAlignDraft}
                onRunAlign={() => void handleRunAlign()}
                onGatherLatest={() => void handleGatherLatest()}
                onEditEntry={handleEditEntry}
                onDeleteEntry={(entry) => void handleDeleteEntry(entry)}
              />
            )
          ) : null}
        </div>
        <MemoryArchiveBackToTop visible={showBackToTop} onClick={() => scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} />
      </div>

      {sheetEntry && editCharacter && sheetWorldBook && sheetItem ? (
        <LoreEntryEditorSheet
          open
          onClose={() => void handleCloseSheet()}
          character={editCharacter}
          worldBook={sheetWorldBook}
          item={sheetItem}
          wbId={sheetEntry.worldBookId}
          itemId={sheetEntry.itemId}
          onPatchItem={handlePatchItem}
          onDeleteItem={(wbId, itemId) => void handleDeleteItem(wbId, itemId)}
          networkPeersForInsert={loreEditorSupport.networkPeersForInsert}
          canUseAi={false}
          generating={false}
          onOpenAiLengthModal={() => {}}
          worldBookUserInsertContext={loreEditorSupport.worldBookUserInsertContext}
        />
      ) : null}

      <MemoryTutorialModal
        open={coach.tutorialOpen}
        onClose={() => coach.setTutorialOpen(false)}
        title="尾声延展 · 怎么看"
        subtitle="关系与态度类世界书"
        sections={MEMORY_EPILOGUE_TUTORIAL_SECTIONS}
        onStartLiveCoach={coach.startLiveCoach}
        zIndex={55000}
      />

      <MemoryCoachPortal
        open={coach.coachOpen && coachActive && view === 'roster'}
        steps={MEMORY_EPILOGUE_COACH_STEPS}
        stepIndex={coach.coachStepIndex}
        onStepChange={coach.setCoachStepIndex}
        onSkip={() => coach.finishCoach()}
        onComplete={(opts) => coach.finishCoach(opts)}
        scopeRoot="memory-epilogue"
        layoutEpoch={`${view}-${rosterForDisplay.length}`}
        zIndex={56000}
      />
    </div>
  )
}
