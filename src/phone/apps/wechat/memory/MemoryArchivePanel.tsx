import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { loadAccountsBundle } from '../wechatAccountPersistence'
import type { WechatAccountsBundle } from '../wechatAccountTypes'
import {
  buildMemoryArchiveAccountOptions,
  matchesMemoryArchiveAccount,
  resolvePrimaryWechatAccountId,
} from './memoryArchiveAccountScope'
import {
  buildMemoryArchiveLookup,
  characterMemoryToMemoryEntry,
} from './memoryArchiveMapper'
import {
  resolveMemoryEntrySourceLineLabel,
  resolveMemoryUserBindingLabels,
} from './memoryArchiveSourceLabel'
import {
  buildCharacterRoster,
  filterAndSortMemoryEntries,
  isLinkedMemoryEntry,
  resolveDetailCharacterInfo,
  rosterMatchesSearch,
} from './memoryArchiveFilter'
import type { MemoryEntry, MemoryTypeFilterId, MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { parseMemorySourcePrefix } from './memorySourceBadges'
import {
  clearCharacterMemoryArchive,
  memoryArchiveClearScopeHasWork,
  resolveMemoryArchiveClearCounts,
  type MemoryArchiveClearScope,
} from './clearCharacterMemoryArchive'
import { MemoryArchiveBackToTop } from './MemoryArchiveBackToTop'
import { MemoryArchiveHeader } from './MemoryArchiveHeader'
import { MemoryClearAllConfirmModal } from './MemoryClearAllConfirmModal'
import { MemoryCharacterDetailView } from './MemoryCharacterDetailView'
import { MemoryCharacterRoster } from './MemoryCharacterRoster'
import { MemoryList } from './MemoryList'
import { MemoryEditorSheet } from './MemoryEditorSheet'
import { MemoryStoryTimelineDetailSection } from './MemoryStoryTimelineDetailSection'
import { MemoryUnifiedCharacterHero } from './MemoryUnifiedCharacterHero'
import {
  MemoryCharacterSourceTabNav,
  type MemoryCharacterSourceTab,
} from './MemoryCharacterSourceTabNav'
import { gatherLatestRoundBodyForEpilogue } from './memoryEpilogueArchive'
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
import { runManualStoryTimelineSummary } from './storyTimelinePerRoundSync'
import { buildUnifiedSummaryRoster, type MemoryUnifiedRosterItem } from './memoryUnifiedSummaryArchive'
import type { ApiConfig } from '../../api/types'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { useDebouncedValue } from './useDebouncedValue'
import { resolveWorldBookUserInsertContext } from '../charUserPlaceholders'
import {
  alignAllStoredMemoryUserPlaceholders,
  summarizeMemoryUserPlaceholders,
} from '../memoryUserPlaceholderBindings'
import { MEMORY_ARCHIVE_COACH_STEPS, MEMORY_ARCHIVE_START_COACH_EVENT } from './memoryArchiveCoachSteps'
import { MEMORY_ARCHIVE_TUTORIAL_SECTIONS } from './memoryArchiveTutorialCopy'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import {
  MEMORY_ARCHIVE_COACH_SEEN_KEY,
  MEMORY_HUB_COACH_SEEN_KEY,
  readMemoryCoachSeen,
  writeMemoryCoachSeen,
} from './memoryCoachTypes'
import { isUserMomentViewerMemory } from '../../../../components/moments/userMomentDistributionArchiveService'
import { memoryTextMatchesQuery } from './memorySearchFilter'

function stripMemoryPrefixForDisplay(raw: string): string {
  return parseMemorySourcePrefix(raw).body.trim() || raw.trim()
}

export function MemoryArchivePanel({
  contacts,
  currentWechatAccountId,
  playerIdentityId,
  apiConfig,
  activeCharacterPageId,
  onCharacterPageChange,
  onRegisterCharacterNav,
  coachActive = true,
}: {
  contacts: WeChatContactRow[]
  currentWechatAccountId?: string
  playerIdentityId?: string
  apiConfig?: ApiConfig | null
  /** 顶栏返回浏览页时置 null，面板退回角色列表 */
  activeCharacterPageId?: string | null
  onCharacterPageChange?: (meta: MemoryCharacterPageMeta | null) => void
  onRegisterCharacterNav?: (nav: { prev: () => void; next: () => void } | null) => void
  /** 仅记忆管理 Tab 可见时允许自动/展示高亮引导 */
  coachActive?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [allEntries, setAllEntries] = useState<MemoryEntry[]>([])
  const [rawById, setRawById] = useState<Map<string, CharacterMemory>>(new Map())
  const [groupOptions, setGroupOptions] = useState<Array<{ groupId: string; title: string }>>([])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 280)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [accountsBundle, setAccountsBundle] = useState<WechatAccountsBundle | null>(null)
  const [archiveView, setArchiveView] = useState<'roster' | 'detail'>('roster')
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null)
  const [typeFilters, setTypeFilters] = useState<ReadonlySet<MemoryTypeFilterId>>(() => new Set())

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null)
  const [editingRaw, setEditingRaw] = useState<CharacterMemory | null>(null)
  const [alignUserBusy, setAlignUserBusy] = useState(false)
  const [alignUserToast, setAlignUserToast] = useState<string | null>(null)
  const [userInsertCtx, setUserInsertCtx] =
    useState<import('../charUserPlaceholders').WorldBookUserInsertContext | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false)
  const [clearAllBusy, setClearAllBusy] = useState(false)
  const accountBootstrappedForAccountRef = useRef<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [charRealNameById, setCharRealNameById] = useState<Map<string, string>>(() => new Map())
  const [offlineRoster, setOfflineRoster] = useState<StoryTimelineArchiveRosterItem[]>([])
  const [detailTimelineRows, setDetailTimelineRows] = useState<StoryTimelinePlotRow[]>([])
  const [timelineRowDisplayById, setTimelineRowDisplayById] = useState<Map<string, string>>(
    () => new Map(),
  )
  const [timelineEditorOpen, setTimelineEditorOpen] = useState(false)
  const [timelineEditorTarget, setTimelineEditorTarget] = useState<StoryTimelineEditorTarget | null>(
    null,
  )
  const [timelineAlignDraft, setTimelineAlignDraft] = useState('')
  const [timelineAlignBusy, setTimelineAlignBusy] = useState(false)
  const [timelineAlignFeedback, setTimelineAlignFeedback] = useState('')
  const [detailSourceTab, setDetailSourceTab] = useState<MemoryCharacterSourceTab>('online')
  const [detailTimelineHasState, setDetailTimelineHasState] = useState(false)

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const [memories, groups, chars] = await Promise.all([
        personaDb.listAllCharacterMemories(),
        personaDb.listGroupChats(),
        personaDb.listCharacters(),
      ])

      const charNameById = new Map<string, string>()
      for (const ch of chars) {
        const id = ch.id.trim()
        if (!id) continue
        charNameById.set(id, String(ch.name ?? ch.wechatNickname ?? '').trim() || id.slice(0, 8))
      }

      const groupNameById = new Map<string, string>()
      const gOpts: Array<{ groupId: string; title: string }> = []
      for (const g of groups) {
        const gid = g.id?.trim()
        if (!gid) continue
        const title = String(g.remark ?? g.name ?? '').trim() || `群 ${gid.slice(0, 6)}`
        groupNameById.set(gid, title)
        gOpts.push({ groupId: gid, title })
      }
      gOpts.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
      setGroupOptions(gOpts)
      setCharRealNameById(charNameById)

      const bundle = await loadAccountsBundle()
      setAccountsBundle(bundle)
      const lookup = buildMemoryArchiveLookup(contacts, charNameById, groupNameById, bundle)
      const rawMap = new Map<string, CharacterMemory>()
      const entries: MemoryEntry[] = []
      for (const m of memories) {
        if (isUserMomentViewerMemory(m)) continue
        rawMap.set(m.id, m)
        const base = characterMemoryToMemoryEntry(m, lookup)
        const [sourceLineLabel, userBindingLabels, contentExpanded] = await Promise.all([
          resolveMemoryEntrySourceLineLabel(m, bundle),
          resolveMemoryUserBindingLabels(m, bundle),
          personaDb
            .expandMemoryDraftForPromptPreview({
              content: m.content,
              characterId: m.characterId,
              memoryScope: m.memoryScope,
              linkedFromCharacterId: m.linkedFromCharacterId,
              involvedCharIds: m.involvedCharIds,
              userPlaceholderBindings: m.userPlaceholderBindings,
            })
            .catch(() => base.content),
        ])
        entries.push({
          ...base,
          ...(sourceLineLabel ? { sourceLineLabel } : {}),
          ...(userBindingLabels.length ? { userBindingLabels } : {}),
          contentExpanded: stripMemoryPrefixForDisplay(contentExpanded.trim() || base.content),
        })
      }
      entries.sort((a, b) => b.timestamp - a.timestamp)
      setRawById(rawMap)
      setAllEntries(entries)

      await purgeOrphanStoryTimelineArchiveData({ contacts })
      const offline = await buildStoryTimelineArchiveRoster({ contacts })
      setOfflineRoster(offline)
    } finally {
      setLoading(false)
    }
  }, [contacts])

  useEffect(() => {
    const acc = currentWechatAccountId?.trim()
    if (!acc) return
    if (accountBootstrappedForAccountRef.current === acc) return
    accountBootstrappedForAccountRef.current = acc
    setSelectedAccountId(acc)
  }, [currentWechatAccountId])

  useEffect(() => {
    if (selectedAccountId.trim()) return
    const fallback =
      accountsBundle?.currentAccountId?.trim() ||
      accountsBundle?.accounts[0]?.accountId?.trim() ||
      currentWechatAccountId?.trim() ||
      ''
    if (fallback) setSelectedAccountId(fallback)
  }, [accountsBundle, currentWechatAccountId, selectedAccountId])

  const accountOptions = useMemo(
    () => buildMemoryArchiveAccountOptions(accountsBundle),
    [accountsBundle],
  )

  const primaryAccountId = useMemo(
    () => resolvePrimaryWechatAccountId(accountsBundle),
    [accountsBundle],
  )

  const accountScoped = useMemo(() => {
    const acc = selectedAccountId.trim()
    if (!acc) return allEntries
    return allEntries.filter((e) => matchesMemoryArchiveAccount(e, acc, primaryAccountId))
  }, [allEntries, selectedAccountId, primaryAccountId])

  useEffect(() => {
    void reload()
  }, [reload])

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback((opts?: { openTutorial?: boolean }) => {
    writeMemoryCoachSeen(MEMORY_ARCHIVE_COACH_SEEN_KEY)
    setCoachOpen(false)
    setCoachStepIndex(0)
    if (opts?.openTutorial) setTutorialOpen(true)
  }, [])

  useEffect(() => {
    if (!coachActive) {
      setCoachOpen(false)
      setCoachStepIndex(0)
      return
    }
    if (loading) return
    if (!readMemoryCoachSeen(MEMORY_HUB_COACH_SEEN_KEY)) return
    if (readMemoryCoachSeen(MEMORY_ARCHIVE_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 640)
    return () => window.clearTimeout(id)
  }, [loading, startLiveCoach, coachActive])

  useEffect(() => {
    const onStart = () => startLiveCoach()
    window.addEventListener(MEMORY_ARCHIVE_START_COACH_EVENT, onStart)
    return () => window.removeEventListener(MEMORY_ARCHIVE_START_COACH_EVENT, onStart)
  }, [startLiveCoach])

  useEffect(() => {
    let cancelled = false
    void resolveWorldBookUserInsertContext({
      wechatAccountId: currentWechatAccountId,
      playerIdentityId: playerIdentityId ?? undefined,
    }).then((ctx) => {
      if (!cancelled) setUserInsertCtx(ctx)
    })
    return () => {
      cancelled = true
    }
  }, [currentWechatAccountId, playerIdentityId])

  const userPlaceholderSummary = useMemo(
    () => summarizeMemoryUserPlaceholders([...rawById.values()]),
    [rawById],
  )

  const runAlignUserPlaceholders = useCallback(() => {
    if (alignUserBusy || userPlaceholderSummary.slotCount === 0) return
    if (!userInsertCtx) {
      setAlignUserToast('请先在当前微信账号下选择扮演身份，再执行对齐')
      window.setTimeout(() => setAlignUserToast(null), 3200)
      return
    }
    setAlignUserBusy(true)
    setAlignUserToast(null)
    void (async () => {
      try {
        const { written, after } = await alignAllStoredMemoryUserPlaceholders({
          fillUnboundWith: userInsertCtx,
        })
        await reload()
        const unbound = Math.max(0, after.slotCount - after.boundCount)
        const who = userInsertCtx.displayName || userInsertCtx.lineLabel || '当前身份'
        if (written === 0 && unbound === 0) {
          setAlignUserToast('未发现需要对齐的内容（各槽位均已绑定）')
        } else if (unbound > 0) {
          setAlignUserToast(
            `已更新 ${written} 条记忆：未绑定槽位已尽量绑到「${who}」，仍有 ${unbound} 处需在对应账号下用「玩家」插入补全`,
          )
        } else {
          setAlignUserToast(
            `已对齐 ${written} 条记忆：未绑定的 {{user}} 已按来源线或当前账号「${who}」补全（共 ${after.slotCount} 处；已有绑定未改动）`,
          )
        }
      } catch {
        setAlignUserToast('对齐失败，请稍后重试')
      } finally {
        setAlignUserBusy(false)
        window.setTimeout(() => setAlignUserToast(null), 4200)
      }
    })()
  }, [alignUserBusy, reload, userInsertCtx, userPlaceholderSummary.slotCount])

  useEffect(() => {
    const onEvt = () => void reload({ silent: true })
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])


  const contactByCharId = useMemo(() => {
    const m = new Map<string, WeChatContactRow>()
    for (const c of contacts) {
      const id = c.id.trim()
      if (id) m.set(id, c)
    }
    return m
  }, [contacts])

  const remarkByCharId = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts) {
      const id = c.id.trim()
      const remark = c.remarkName?.trim()
      if (id && remark) m.set(id, remark)
    }
    return m
  }, [contacts])

  const characterRoster = useMemo(
    () =>
      buildCharacterRoster(accountScoped, {
        realNameByCharId: charRealNameById,
        remarkByCharId,
      }),
    [accountScoped, charRealNameById, remarkByCharId],
  )

  const unifiedRoster = useMemo(
    () => buildUnifiedSummaryRoster({ onlineRoster: characterRoster, offlineRoster }),
    [characterRoster, offlineRoster],
  )

  const rosterForDisplay = useMemo(() => {
    const q = debouncedSearch.trim()
    if (!q) return unifiedRoster
    return unifiedRoster.filter((item) => {
      if (rosterMatchesSearch(item, q)) return true
      if (item.onlineMemoryCount > 0) {
        return accountScoped.some((e) => {
          if (e.charId !== item.charId) return false
          const raw = rawById.get(e.id)
          return raw ? memoryTextMatchesQuery(raw, q) : e.content.toLowerCase().includes(q.toLowerCase())
        })
      }
      return false
    })
  }, [unifiedRoster, debouncedSearch, accountScoped, rawById])

  const rosterSummary = useMemo(
    () => ({
      characterCount: rosterForDisplay.length,
      memoryCount: rosterForDisplay.reduce((sum, item) => sum + item.memoryCount, 0),
      onlineCount: rosterForDisplay.reduce((sum, item) => sum + item.onlineMemoryCount, 0),
      offlineCount: rosterForDisplay.reduce((sum, item) => sum + item.offlineRowCount, 0),
    }),
    [rosterForDisplay],
  )

  const selectedRosterIndex = useMemo(
    () => (selectedCharId ? unifiedRoster.findIndex((c) => c.charId === selectedCharId) : -1),
    [unifiedRoster, selectedCharId],
  )

  const selectedUnifiedCharacter = useMemo((): MemoryUnifiedRosterItem | null => {
    if (!selectedCharId) return null
    return unifiedRoster.find((r) => r.charId === selectedCharId) ?? null
  }, [selectedCharId, unifiedRoster])

  const loadTimelineDetail = useCallback(async (charId: string) => {
    const { rows, state } = await loadStoryTimelineArchiveForCharacter(charId)
    setDetailTimelineRows(rows)
    setDetailTimelineHasState(
      !!(
        state?.manualAnchorBlock?.trim() ||
        state?.currentLocation?.trim() ||
        state?.currentStoryDay?.trim() ||
        state?.currentStoryTime?.trim() ||
        state?.costumes.length ||
        state?.items.length ||
        state?.foreshadows.length ||
        (state?.todos?.length ?? 0) ||
        state?.recentEvents.length
      ),
    )
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
    setTimelineRowDisplayById(displayMap)
    const latest = await gatherLatestRoundBodyForEpilogue(charId)
    setTimelineAlignDraft(latest)
    setTimelineAlignFeedback('')
  }, [])

  useEffect(() => {
    if (archiveView === 'detail' && selectedCharId) void loadTimelineDetail(selectedCharId)
  }, [archiveView, selectedCharId, loadTimelineDetail, offlineRoster])

  const refreshAfterTimelineMutation = useCallback(async () => {
    await reload({ silent: true })
    if (selectedCharId) await loadTimelineDetail(selectedCharId)
  }, [reload, loadTimelineDetail, selectedCharId])

  const openTimelineEditor = useCallback((target: StoryTimelineEditorTarget) => {
    setTimelineEditorTarget(target)
    setTimelineEditorOpen(true)
  }, [])

  const handleTimelineEditRow = useCallback(
    (row: StoryTimelinePlotRow) => {
      openTimelineEditor({ kind: 'row-edit', row })
    },
    [openTimelineEditor],
  )

  const handleTimelineDeleteRow = useCallback(
    async (rowId: string) => {
      await personaDb.deleteStoryTimelinePlotRowById(rowId)
      await refreshAfterTimelineMutation()
    },
    [refreshAfterTimelineMutation],
  )

  const handleTimelineRunAlign = useCallback(async () => {
    if (!selectedCharId || !selectedUnifiedCharacter || timelineAlignBusy) return
    setTimelineAlignBusy(true)
    setTimelineAlignFeedback('')
    try {
      const outcome = await runManualStoryTimelineSummary({
        apiConfig: apiConfig ?? null,
        characterId: selectedCharId,
        latestRoundBody: timelineAlignDraft,
        displayName: selectedUnifiedCharacter.displayName,
      })
      if (outcome.status === 'applied') {
        setTimelineAlignFeedback('已生成并写入剧情摘要表。')
        await loadTimelineDetail(selectedCharId)
        await reload({ silent: true })
      } else {
        setTimelineAlignFeedback(outcome.reason || '生成失败，请检查记忆配置中的 API。')
      }
    } finally {
      setTimelineAlignBusy(false)
    }
  }, [
    selectedCharId,
    selectedUnifiedCharacter,
    timelineAlignBusy,
    timelineAlignDraft,
    apiConfig,
    loadTimelineDetail,
    reload,
  ])

  const handleTimelineGatherLatest = useCallback(async () => {
    if (!selectedCharId) return
    const latest = await gatherLatestRoundBodyForEpilogue(selectedCharId)
    if (latest) setTimelineAlignDraft(latest)
    else setTimelineAlignFeedback('未找到最近私聊或约会剧情正文，请手动粘贴。')
  }, [selectedCharId])

  const detailCharacter = useMemo(() => {
    if (!selectedCharId) return null
    const contact = contactByCharId.get(selectedCharId)
    return resolveDetailCharacterInfo(
      selectedCharId,
      allEntries,
      selectedAccountId,
      primaryAccountId,
      {
        displayName: contact?.remarkName,
        avatarUrl: contact?.avatarUrl,
        wechatRemarkName: contact?.remarkName,
      },
      charRealNameById,
    )
  }, [selectedCharId, allEntries, selectedAccountId, primaryAccountId, contactByCharId, charRealNameById])

  const characterTotalCount = useMemo(() => detailCharacter?.memoryCount ?? 0, [detailCharacter])

  const publishCharacterPage = useCallback(() => {
    if (!onCharacterPageChange) return
    if (archiveView !== 'detail' || !selectedCharId || !detailCharacter) {
      onCharacterPageChange(null)
      return
    }
    const idx = unifiedRoster.findIndex((c) => c.charId === selectedCharId)
    onCharacterPageChange({
      charId: selectedCharId,
      displayName: detailCharacter.displayName,
      rosterIndex: idx,
      rosterTotal: unifiedRoster.length,
      canPrev: idx > 0,
      canNext: idx >= 0 && idx < unifiedRoster.length - 1,
    })
  }, [
    archiveView,
    selectedCharId,
    detailCharacter,
    unifiedRoster,
    onCharacterPageChange,
  ])

  const navigateCharacter = useCallback(
    (delta: -1 | 1) => {
      const idx = selectedRosterIndex
      if (idx < 0) return
      const next = unifiedRoster[idx + delta]
      if (!next) return
      setSelectedCharId(next.charId)
      setDetailSourceTab(
        next.onlineMemoryCount <= 0 && next.offlineRowCount > 0 ? 'offline' : 'online',
      )
      setTypeFilters(new Set())
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    },
    [selectedRosterIndex, unifiedRoster],
  )

  const availableTypeFilters = useMemo(() => {
    if (!selectedCharId) return undefined
    const set = new Set<MemoryTypeFilterId>()
    for (const e of allEntries) {
      if (e.charId !== selectedCharId || !matchesMemoryArchiveAccount(e, selectedAccountId, primaryAccountId)) continue
      for (const t of e.tags) set.add(t)
      if (isLinkedMemoryEntry(e)) set.add('linked')
    }
    return set
  }, [selectedCharId, allEntries, selectedAccountId, primaryAccountId])

  const filtered = useMemo(
    () =>
      filterAndSortMemoryEntries({
        entries: allEntries,
        rawById,
        accountId: selectedAccountId,
        primaryAccountId,
        charId: selectedCharId ?? 'all',
        searchQuery: archiveView === 'detail' ? debouncedSearch : '',
        typeFilters,
      }),
    [allEntries, rawById, selectedAccountId, primaryAccountId, selectedCharId, debouncedSearch, typeFilters, archiveView],
  )

  const clearAllCounts = useMemo(() => {
    if (!selectedCharId) {
      return { onlineMemoryCount: 0, offlineRowCount: 0, offlineHasState: false }
    }
    return resolveMemoryArchiveClearCounts({
      selectedCharId,
      allEntries,
      rawMemories: [...rawById.values()],
      offlineRowCount: selectedUnifiedCharacter?.offlineRowCount ?? detailTimelineRows.length,
      offlineHasState: detailTimelineHasState,
    })
  }, [
    selectedCharId,
    allEntries,
    rawById,
    selectedUnifiedCharacter?.offlineRowCount,
    detailTimelineRows.length,
    detailTimelineHasState,
  ])

  const clearAllDefaultScope = useMemo((): MemoryArchiveClearScope => {
    if (detailSourceTab === 'offline') return 'offline'
    if (detailSourceTab === 'online') return 'online'
    return 'both'
  }, [detailSourceTab])

  const clearAllDisabled =
    clearAllBusy ||
    !memoryArchiveClearScopeHasWork('both', clearAllCounts)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => setShowBackToTop(el.scrollTop > 240)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading, archiveView, filtered.length, rosterForDisplay.length])

  const scrollArchiveToTop = useCallback(() => {
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openCharacter = useCallback(
    (charId: string) => {
      setClearAllConfirmOpen(false)
      setSelectedCharId(charId)
      setTypeFilters(new Set())
      const item = unifiedRoster.find((r) => r.charId === charId)
      setDetailSourceTab(
        item && item.onlineMemoryCount <= 0 && item.offlineRowCount > 0 ? 'offline' : 'online',
      )
      setArchiveView('detail')
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    },
    [unifiedRoster],
  )

  const backToRoster = useCallback(() => {
    setClearAllConfirmOpen(false)
    setArchiveView('roster')
    setSelectedCharId(null)
    setTypeFilters(new Set())
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    onCharacterPageChange?.(null)
  }, [onCharacterPageChange])

  useEffect(() => {
    publishCharacterPage()
  }, [publishCharacterPage])

  const prevActiveCharacterPageIdRef = useRef<string | null | undefined>(activeCharacterPageId)

  useEffect(() => {
    const prev = prevActiveCharacterPageIdRef.current
    prevActiveCharacterPageIdRef.current = activeCharacterPageId ?? null

    // 仅当顶栏返回把 characterPage 清掉时退回列表；打开详情时 activeCharacterPageId 会短暂为 null，不能误判
    if (prev != null && activeCharacterPageId == null && archiveView === 'detail') {
      setArchiveView('roster')
      setSelectedCharId(null)
      setTypeFilters(new Set())
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [activeCharacterPageId, archiveView])

  useEffect(() => {
    if (!onRegisterCharacterNav) return
    if (archiveView !== 'detail') {
      onRegisterCharacterNav(null)
      return
    }
    onRegisterCharacterNav({
      prev: () => navigateCharacter(-1),
      next: () => navigateCharacter(1),
    })
    return () => onRegisterCharacterNav(null)
  }, [archiveView, navigateCharacter, onRegisterCharacterNav])

  useEffect(() => {
    if (!coachOpen) return
    const step = MEMORY_ARCHIVE_COACH_STEPS[coachStepIndex]
    const target = step?.target
    if (!target) return

    const rosterSteps = new Set([
      'roster',
      'source',
      'search',
      'align',
      'create',
      'memories-tab-tutorial',
    ])
    const detailSteps = new Set(['detail-source-tabs', 'type-filter', 'list'])

    if (rosterSteps.has(target) && archiveView === 'detail') {
      backToRoster()
      return
    }
    if (detailSteps.has(target) && archiveView === 'roster' && rosterForDisplay.length > 0) {
      openCharacter(rosterForDisplay[0]!.charId)
      return
    }
    if ((target === 'type-filter' || target === 'list') && archiveView === 'detail') {
      setDetailSourceTab('online')
    }
    if (target === 'detail-source-tabs' && archiveView === 'detail') {
      setDetailSourceTab('online')
    }
  }, [coachOpen, coachStepIndex, archiveView, rosterForDisplay, openCharacter, backToRoster])

  const openCreate = () => {
    setEditorMode('create')
    setEditingEntry(null)
    setEditingRaw(null)
    setEditorOpen(true)
  }

  const openEdit = (entry: MemoryEntry) => {
    const raw = rawById.get(entry.id) ?? null
    setEditorMode('edit')
    setEditingEntry(entry)
    setEditingRaw(raw)
    setEditorOpen(true)
  }

  const handleDelete = async (entry: MemoryEntry) => {
    await personaDb.deleteCharacterMemory(entry.id)
    if (editorOpen && editingEntry?.id === entry.id) {
      setEditorOpen(false)
      setEditingEntry(null)
      setEditingRaw(null)
    }
    await reload({ silent: true })
  }

  const handleClearAllConfirm = async (scope: MemoryArchiveClearScope) => {
    if (!selectedCharId || clearAllBusy || !memoryArchiveClearScopeHasWork(scope, clearAllCounts)) return
    setClearAllBusy(true)
    try {
      await clearCharacterMemoryArchive({
        selectedCharId,
        displayName: detailCharacter?.displayName ?? selectedUnifiedCharacter?.displayName ?? '该角色',
        scope,
        allEntries,
        rawMemories: [...rawById.values()],
      })
      if (
        editorOpen &&
        editingEntry &&
        (scope === 'online' || scope === 'both') &&
        editingEntry.charId === selectedCharId
      ) {
        setEditorOpen(false)
        setEditingEntry(null)
        setEditingRaw(null)
      }
      setClearAllConfirmOpen(false)
      setTypeFilters(new Set())
      setSearch('')
      if (scope === 'offline' || scope === 'both') {
        setDetailTimelineRows([])
        setTimelineRowDisplayById(new Map())
        setDetailTimelineHasState(false)
      }
      await reload({ silent: true })
      if (selectedCharId) await loadTimelineDetail(selectedCharId)
    } finally {
      setClearAllBusy(false)
    }
  }

  const editorKind: 'own' | 'linked' =
    editingRaw?.memoryScope === 'linked' || editingEntry?.memoryScope === 'linked' ? 'linked' : 'own'

  return (
    <div
      data-memory-coach-root="memory-archive"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{ background: ARCHIVE_BG }}
    >
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className="h-full overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        >
          {archiveView === 'roster' ? (
            <>
              <MemoryArchiveHeader
                search={search}
                onSearchChange={setSearch}
                accountOptions={accountOptions}
                selectedAccountId={selectedAccountId}
                onAccountChange={(id) => {
                  setSelectedAccountId(id)
                  setTypeFilters(new Set())
                }}
                onCreate={openCreate}
                alignUserBusy={alignUserBusy}
                alignUserDisabled={userPlaceholderSummary.slotCount === 0}
                alignUserTitle={
                  userPlaceholderSummary.slotCount === 0
                    ? '当前记忆库中没有 {{user}} 表达式'
                    : userInsertCtx
                      ? `先按各条来源线对齐；未绑定的 {{user}} 将绑到当前账号「${userInsertCtx.displayName || userInsertCtx.lineLabel}」；已有绑定不变`
                      : '请先在当前微信账号下选择扮演身份'
                }
                onAlignUser={runAlignUserPlaceholders}
                alignUserToast={alignUserToast}
                rosterSummary={rosterSummary}
                onOpenTutorial={() => setTutorialOpen(true)}
              />
              {!loading && rosterForDisplay.length > 0 ? (
                <div className="mx-auto max-w-xl px-4 pb-1 pt-2">
                  <p className="text-[11px] font-medium tracking-wide text-gray-400">
                    <ListenNumericText text={`${rosterForDisplay.length} 位角色`} />
                  </p>
                </div>
              ) : null}
              <MemoryCharacterRoster
                items={rosterForDisplay}
                loading={loading}
                searchQuery={debouncedSearch}
                onSelect={openCharacter}
                showArchiveSourceLabels
              />
            </>
          ) : archiveView === 'detail' && selectedCharId && detailCharacter && selectedUnifiedCharacter ? (
            <>
              <MemoryUnifiedCharacterHero
                character={selectedUnifiedCharacter}
                rosterIndex={selectedRosterIndex}
                rosterTotal={unifiedRoster.length}
                onClearAll={() => setClearAllConfirmOpen(true)}
                clearAllDisabled={clearAllDisabled}
              />
              <div
                className="sticky top-0 z-20 px-4 pb-2 pt-1"
                style={{ background: ARCHIVE_BG }}
              >
                <MemoryCharacterSourceTabNav
                  value={detailSourceTab}
                  onChange={(tab) => {
                    setDetailSourceTab(tab)
                    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
                  }}
                  onlineCount={selectedUnifiedCharacter.onlineMemoryCount}
                  offlineCount={selectedUnifiedCharacter.offlineRowCount}
                />
              </div>
              {detailSourceTab === 'offline' ? (
                <MemoryStoryTimelineDetailSection
                  showSectionHeading={false}
                  rows={detailTimelineRows}
                  rowDisplayById={timelineRowDisplayById}
                  onEditRow={handleTimelineEditRow}
                  onDeleteRow={(id) => void handleTimelineDeleteRow(id)}
                  alignDraft={timelineAlignDraft}
                  alignBusy={timelineAlignBusy}
                  alignFeedback={timelineAlignFeedback}
                  onAlignDraftChange={setTimelineAlignDraft}
                  onRunAlign={() => void handleTimelineRunAlign()}
                  onGatherLatest={() => void handleTimelineGatherLatest()}
                />
              ) : (
                <MemoryCharacterDetailView
                  character={detailCharacter}
                  rosterIndex={selectedRosterIndex}
                  rosterTotal={unifiedRoster.length}
                  layout="onlineSection"
              search={search}
              onSearchChange={setSearch}
              accountOptions={accountOptions}
              selectedAccountId={selectedAccountId}
              onAccountChange={(id) => {
                setSelectedAccountId(id)
                setTypeFilters(new Set())
              }}
              typeFilters={typeFilters}
              onTypeFiltersChange={setTypeFilters}
              availableTypeFilters={availableTypeFilters}
              filteredCount={filtered.length}
              totalCount={characterTotalCount}
              onCreate={openCreate}
              onOpenTutorial={() => setTutorialOpen(true)}
              onAlignUser={runAlignUserPlaceholders}
              alignUserBusy={alignUserBusy}
              alignUserDisabled={userPlaceholderSummary.slotCount === 0}
              alignUserTitle={
                userPlaceholderSummary.slotCount === 0
                  ? '当前记忆库中没有 {{user}} 表达式'
                  : userInsertCtx
                    ? `先按各条来源线对齐；未绑定的 {{user}} 将绑到当前账号「${userInsertCtx.displayName || userInsertCtx.lineLabel}」；已有绑定不变`
                    : '请先在当前微信账号下选择扮演身份'
              }
              alignUserToast={alignUserToast}
            >
              <MemoryList
                entries={filtered}
                loading={loading}
                inCharacterContext
                emptyHint={
                  characterTotalCount === 0
                    ? '该角色在当前账号下暂无记忆；可切换上方查看账号，或用「遇见应用」标签筛选 Lumi Meet 记忆，或点上方按钮新建。'
                    : '调整检索词或记忆类型，或点上方按钮新建记忆。'
                }
                onEdit={openEdit}
                onDelete={(e) => void handleDelete(e)}
              />
            </MemoryCharacterDetailView>
              )}
            </>
          ) : null}
        </div>
        <MemoryArchiveBackToTop visible={showBackToTop} onClick={scrollArchiveToTop} />
      </div>

      <MemoryClearAllConfirmModal
        open={clearAllConfirmOpen}
        characterName={detailCharacter?.displayName ?? '该角色'}
        onlineCount={clearAllCounts.onlineMemoryCount}
        offlineCount={clearAllCounts.offlineRowCount}
        offlineHasState={clearAllCounts.offlineHasState}
        defaultScope={clearAllDefaultScope}
        busy={clearAllBusy}
        onCancel={() => {
          if (clearAllBusy) return
          setClearAllConfirmOpen(false)
        }}
        onConfirm={(scope) => void handleClearAllConfirm(scope)}
      />

      <MemoryTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="角色总结 · 怎么看"
        subtitle="按角色浏览线上与线下记忆"
        sections={MEMORY_ARCHIVE_TUTORIAL_SECTIONS}
        onStartLiveCoach={startLiveCoach}
        zIndex={55000}
      />

      <MemoryCoachPortal
        open={coachOpen && coachActive}
        steps={MEMORY_ARCHIVE_COACH_STEPS}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        scopeRoot="memory-archive"
        layoutEpoch={`${archiveView}-${selectedAccountId}-${selectedCharId ?? 'none'}-${detailSourceTab}`}
        zIndex={56000}
      />

      <MemoryEditorSheet
        open={editorOpen}
        mode={editorMode}
        entry={editingEntry}
        raw={editingRaw}
        contacts={contacts}
        initialCharId={selectedCharId ?? undefined}
        archiveSelectedAccountId={selectedAccountId}
        editorKind={editorKind}
        currentWechatAccountId={currentWechatAccountId}
        playerIdentityId={playerIdentityId}
        groupOptions={groupOptions}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void reload()}
      />

      <StoryTimelineEditorSheet
        open={timelineEditorOpen}
        target={timelineEditorTarget}
        onClose={() => {
          setTimelineEditorOpen(false)
          setTimelineEditorTarget(null)
        }}
        onSaved={() => void refreshAfterTimelineMutation()}
      />
    </div>
  )
}
