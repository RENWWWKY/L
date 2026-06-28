import { motion } from 'framer-motion'
import { Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import { Pressable } from '../../../components/Pressable'
import type { MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { ARCHIVE_BG, archiveSerifTextStyle, ARCHIVE_SOFT_BTN_PRIMARY, ARCHIVE_SOFT_BTN_SECONDARY, ARCHIVE_SOFT_SECTION, ARCHIVE_SOFT_TEXTAREA, MEMORY_ARCHIVE_SERIF_CLASS } from './memoryArchiveTheme'
import { StoryTimelineRowCard } from './MemoryStoryTimelineDetailSection'
import { MemoryArchiveBackToTop } from './MemoryArchiveBackToTop'
import { rosterMatchesSearch } from './memoryArchiveFilter'
import { MemoryCharacterRoster } from './MemoryCharacterRoster'
import { personaDb } from '../newFriendsPersona/idb'
import {
  buildStoryTimelineArchiveRoster,
  loadStoryTimelineArchiveForCharacter,
  purgeOrphanStoryTimelineArchiveData,
  type StoryTimelineArchiveRosterItem,
} from './memoryStoryTimelineArchive'
import {
  StoryTimelineEditorSheet,
  type StoryTimelineEditorTarget,
} from './StoryTimelineEditorSheet'
import {
  prepareStoryTimelineArchiveDisplayText,
  type StoryTimelinePlotRow,
} from './storyTimelineTypes'
import type { ApiConfig } from '../../api/types'
import { gatherLatestRoundBodyForEpilogue } from './memoryEpilogueArchive'
import { runManualStoryTimelineSummary } from './storyTimelinePerRoundSync'
import { useDebouncedValue } from './useDebouncedValue'

function StoryTimelineCharacterDetail({
  character,
  rosterIndex,
  rosterTotal,
  rows,
  rowDisplayById,
  onEditRow,
  onDeleteRow,
  alignDraft,
  alignBusy,
  alignFeedback,
  onAlignDraftChange,
  onRunAlign,
  onGatherLatest,
}: {
  character: StoryTimelineArchiveRosterItem
  rosterIndex: number
  rosterTotal: number
  rows: StoryTimelinePlotRow[]
  rowDisplayById: Map<string, string>
  onEditRow: (row: StoryTimelinePlotRow) => void
  onDeleteRow: (rowId: string) => void
  alignDraft: string
  alignBusy: boolean
  alignFeedback: string
  onAlignDraftChange: (v: string) => void
  onRunAlign: () => void
  onGatherLatest: () => void
}) {
  const rowsNewestFirst = useMemo(() => [...rows].reverse(), [rows])

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
                    `共 ${rows.length} 条按轮摘要`
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
          <h3 className="text-[13px] font-semibold text-gray-900">手动生成摘要</h3>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-gray-500">
          每轮自动写入失败时，可粘贴本轮剧情 / 私聊正文后在此单独请求摘要并落库（与聊天内补救使用同一接口）。
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
            采集最近正文
          </Pressable>
          <Pressable
            type="button"
            disabled={alignBusy || alignDraft.trim().length < 8}
            onClick={onRunAlign}
            className={ARCHIVE_SOFT_BTN_PRIMARY}
          >
            {alignBusy ? '生成中…' : '生成并写入'}
          </Pressable>
        </div>
        {alignFeedback ? (
          <p className="mt-3 text-[12px] leading-relaxed text-gray-600">{alignFeedback}</p>
        ) : null}
      </section>

      <section className="mx-4 mt-5">
        <div className="mb-2.5 px-1">
          <h3 className="text-[12px] font-semibold text-gray-500">按轮剧情摘要（新→旧）</h3>
        </div>
        {rowsNewestFirst.length ? (
          <ul className="flex flex-col gap-2.5">
            {rowsNewestFirst.map((row, i) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.12) }}
              >
                <StoryTimelineRowCard
                  row={row}
                  index={rows.length - i}
                  displayText={rowDisplayById.get(row.id) ?? row.rowText}
                  onEdit={() => onEditRow(row)}
                  onDelete={() => onDeleteRow(row.id)}
                />
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[20px] bg-white px-4 py-8 text-center text-[13px] text-gray-400 shadow-sm">
            暂无按轮摘要行；可在上方粘贴正文生成，或由约会/私聊 AI 落库后自动出现。
          </p>
        )}
      </section>
    </div>
  )
}

export function MemoryStoryTimelinePanel({
  contacts,
  apiConfig,
  activeCharacterPageId,
  onCharacterPageChange,
  onRegisterCharacterNav,
}: {
  contacts: WeChatContactRow[]
  apiConfig?: ApiConfig | null
  activeCharacterPageId?: string | null
  onCharacterPageChange?: (meta: MemoryCharacterPageMeta | null) => void
  onRegisterCharacterNav?: (nav: { prev: () => void; next: () => void } | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [roster, setRoster] = useState<StoryTimelineArchiveRosterItem[]>([])
  const [view, setView] = useState<'roster' | 'detail'>('roster')
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 280)
  const [detailRowsRaw, setDetailRowsRaw] = useState<StoryTimelinePlotRow[]>([])
  const [rowDisplayById, setRowDisplayById] = useState<Map<string, string>>(new Map())
  const [detailLoading, setDetailLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorTarget, setEditorTarget] = useState<StoryTimelineEditorTarget | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [alignDraft, setAlignDraft] = useState('')
  const [alignBusy, setAlignBusy] = useState(false)
  const [alignFeedback, setAlignFeedback] = useState('')

  const reloadRoster = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      await purgeOrphanStoryTimelineArchiveData({ contacts })
      const items = await buildStoryTimelineArchiveRoster({ contacts })
      setRoster(items)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [contacts])

  const loadDetail = useCallback(async (charId: string) => {
    setDetailLoading(true)
    try {
      const { rows } = await loadStoryTimelineArchiveForCharacter(charId)
      setDetailRowsRaw(rows)
      const expandedRows = await Promise.all(
        rows.map(async (row) =>
          prepareStoryTimelineArchiveDisplayText(
            await personaDb.expandStoryTimelineTextForDisplay(charId, row.rowText),
            row.recordedAt,
          ),
        ),
      )
      const displayMap = new Map<string, string>()
      rows.forEach((row, i) => {
        displayMap.set(row.id, expandedRows[i] ?? row.rowText)
      })
      setRowDisplayById(displayMap)
      const latest = await gatherLatestRoundBodyForEpilogue(charId)
      setAlignDraft(latest)
      setAlignFeedback('')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const refreshAfterMutation = useCallback(async () => {
    await reloadRoster({ silent: true })
    if (selectedCharId) await loadDetail(selectedCharId)
  }, [reloadRoster, loadDetail, selectedCharId])

  const openEditor = useCallback((target: StoryTimelineEditorTarget) => {
    setEditorTarget(target)
    setEditorOpen(true)
  }, [])

  const handleEditRow = useCallback(
    (row: StoryTimelinePlotRow) => {
      openEditor({ kind: 'row-edit', row })
    },
    [openEditor],
  )

  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      await personaDb.deleteStoryTimelinePlotRowById(rowId)
      await refreshAfterMutation()
    },
    [refreshAfterMutation],
  )

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

  const handleRunAlign = useCallback(async () => {
    if (!selectedCharId || !selectedCharacter || alignBusy) return
    setAlignBusy(true)
    setAlignFeedback('')
    try {
      const outcome = await runManualStoryTimelineSummary({
        apiConfig: apiConfig ?? null,
        characterId: selectedCharId,
        latestRoundBody: alignDraft,
        displayName: selectedCharacter.displayName,
      })
      if (outcome.status === 'applied') {
        setAlignFeedback('已生成并写入剧情摘要表。')
        await loadDetail(selectedCharId)
        await reloadRoster({ silent: true })
      } else {
        setAlignFeedback(outcome.reason || '生成失败，请检查记忆配置中的 API。')
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

  const backToRoster = useCallback(() => {
    setView('roster')
    setSelectedCharId(null)
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    onCharacterPageChange?.(null)
  }, [onCharacterPageChange])

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

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => setShowBackToTop(el.scrollTop > 480)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const scrollArchiveToTop = useCallback(() => {
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" style={{ background: ARCHIVE_BG }}>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className="h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        >
          {view === 'roster' ? (
            <>
              <div className="px-4 pb-2 pt-3" style={{ background: ARCHIVE_BG }}>
                <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                  <p className="text-[15px] font-semibold text-gray-900">剧情摘要表</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                    按角色查看约会/私聊自动维护的时间轴。自动写入失败时可到角色详情「手动生成摘要」补跑。
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
                      {`${rosterForDisplay.length} 个角色 · 共 ${roster.reduce((s, r) => s + r.rowCount, 0)} 条摘要`}
                    </p>
                  ) : null}
                </div>
              </div>
              <MemoryCharacterRoster
                items={rosterForDisplay}
                loading={loading}
                searchQuery={debouncedSearch}
                onSelect={openCharacter}
                subtitleForCount={(n) => `共 ${n} 条摘要`}
                monochromeSceneTags
              />
            </>
          ) : view === 'detail' && selectedCharId && selectedCharacter ? (
            detailLoading && !detailRowsRaw.length ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200/80" />
              </div>
            ) : (
              <StoryTimelineCharacterDetail
                character={selectedCharacter}
                rosterIndex={selectedRosterIndex}
                rosterTotal={roster.length}
                rows={detailRowsRaw}
                rowDisplayById={rowDisplayById}
                onEditRow={handleEditRow}
                onDeleteRow={(id) => void handleDeleteRow(id)}
                alignDraft={alignDraft}
                alignBusy={alignBusy}
                alignFeedback={alignFeedback}
                onAlignDraftChange={setAlignDraft}
                onRunAlign={() => void handleRunAlign()}
                onGatherLatest={() => void handleGatherLatest()}
              />
            )
          ) : (
            <div className="px-6 py-16 text-center">
              <Pressable
                type="button"
                onClick={backToRoster}
                className="text-[13px] font-medium text-gray-500 underline"
              >
                返回角色列表
              </Pressable>
            </div>
          )}
        </div>
        <MemoryArchiveBackToTop visible={showBackToTop} onClick={scrollArchiveToTop} />
      </div>

      <StoryTimelineEditorSheet
        open={editorOpen}
        target={editorTarget}
        onClose={() => {
          setEditorOpen(false)
          setEditorTarget(null)
        }}
        onSaved={() => void refreshAfterMutation()}
      />
    </div>
  )
}
