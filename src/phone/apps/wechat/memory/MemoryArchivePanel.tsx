import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { isSecondaryWechatAccountInBundle, loadAccountsBundle } from '../wechatAccountPersistence'
import {
  buildMemoryArchiveLookup,
  characterMemoryToMemoryEntry,
} from './memoryArchiveMapper'
import {
  resolveMemoryEntrySourceLineLabel,
  resolveMemoryUserBindingLabels,
} from './memoryArchiveSourceLabel'
import { buildCharacterFocusRoster, filterMemoryEntries } from './memoryArchiveFilter'
import type { MemoryArchiveKind, MemoryEntry, MemorySourceIdentity } from './memoryArchiveTypes'
import { MemoryArchiveHeader } from './MemoryArchiveHeader'
import { MemoryList } from './MemoryList'
import { MemoryEditorSheet } from './MemoryEditorSheet'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { useDebouncedValue } from './useDebouncedValue'
import { resolveWorldBookUserInsertContext } from '../charUserPlaceholders'
import {
  alignAllStoredMemoryUserPlaceholders,
  summarizeMemoryUserPlaceholders,
} from '../memoryUserPlaceholderBindings'
import { MEMORY_ARCHIVE_COACH_STEPS } from './memoryArchiveCoachSteps'
import { MEMORY_ARCHIVE_TUTORIAL_SECTIONS } from './memoryArchiveTutorialCopy'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import {
  MEMORY_ARCHIVE_COACH_SEEN_KEY,
  readMemoryCoachSeen,
  writeMemoryCoachSeen,
} from './memoryCoachTypes'

const MEMORY_ARCHIVE_START_COACH_EVENT = 'memory-archive-start-coach'

export function MemoryArchivePanel({
  contacts,
  currentWechatAccountId,
  playerIdentityId,
}: {
  contacts: WeChatContactRow[]
  currentWechatAccountId?: string
  playerIdentityId?: string
}) {
  const [loading, setLoading] = useState(true)
  const [allEntries, setAllEntries] = useState<MemoryEntry[]>([])
  const [rawById, setRawById] = useState<Map<string, CharacterMemory>>(new Map())
  const [groupOptions, setGroupOptions] = useState<Array<{ groupId: string; title: string }>>([])

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 280)
  const [source, setSource] = useState<MemorySourceIdentity>('main_wechat')
  const [memoryKind, setMemoryKind] = useState<MemoryArchiveKind>('own')
  const [focusCharId, setFocusCharId] = useState<string | 'all'>('all')

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
  /** 仅首次进入当前微信账号时按主/副号设默认身份源；刷新列表勿覆盖用户已选 Tab */
  const sourceBootstrappedForAccountRef = useRef<string | null>(null)

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

      const bundle = await loadAccountsBundle()
      const lookup = buildMemoryArchiveLookup(contacts, charNameById, groupNameById, bundle)
      const rawMap = new Map<string, CharacterMemory>()
      const entries: MemoryEntry[] = []
      for (const m of memories) {
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
          contentExpanded: contentExpanded.trim() || base.content,
        })
      }
      entries.sort((a, b) => b.timestamp - a.timestamp)
      setRawById(rawMap)
      setAllEntries(entries)
    } finally {
      setLoading(false)
    }
  }, [contacts])

  useEffect(() => {
    const acc = currentWechatAccountId?.trim()
    if (!acc) return
    if (sourceBootstrappedForAccountRef.current === acc) return
    let cancelled = false
    void (async () => {
      const bundle = await loadAccountsBundle()
      if (cancelled || !bundle) return
      sourceBootstrappedForAccountRef.current = acc
      setSource(isSecondaryWechatAccountInBundle(bundle, acc) ? 'sub_wechat' : 'main_wechat')
    })()
    return () => {
      cancelled = true
    }
  }, [currentWechatAccountId])

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
    if (loading) return
    if (readMemoryCoachSeen(MEMORY_ARCHIVE_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startLiveCoach(), 640)
    return () => window.clearTimeout(id)
  }, [loading, startLiveCoach])

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

  const sourceScoped = useMemo(() => {
    return allEntries.filter((e) => {
      if (e.sourceIdentity !== source) return false
      const raw = rawById.get(e.id)
      if (memoryKind === 'linked') {
        return !!raw && raw.memoryScope === 'linked'
      }
      return !raw || raw.memoryScope !== 'linked'
    })
  }, [allEntries, source, memoryKind, rawById])

  const characterRoster = useMemo(
    () =>
      buildCharacterFocusRoster(sourceScoped).map((c) => ({
        charId: c.charId,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
      })),
    [sourceScoped],
  )

  useEffect(() => {
    if (focusCharId === 'all') return
    if (!characterRoster.some((c) => c.charId === focusCharId)) {
      setFocusCharId('all')
    }
  }, [characterRoster, focusCharId])

  const filtered = useMemo(
    () =>
      filterMemoryEntries({
        entries: allEntries,
        rawById,
        source,
        kind: memoryKind,
        charId: focusCharId,
        searchQuery: debouncedSearch,
      }),
    [allEntries, rawById, source, memoryKind, focusCharId, debouncedSearch],
  )

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

  return (
    <div
      data-memory-coach-root="memory-archive"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{ background: ARCHIVE_BG }}
    >
      <MemoryArchiveHeader
        search={search}
        onSearchChange={setSearch}
        source={source}
        onSourceChange={(s) => {
          setSource(s)
          setFocusCharId('all')
        }}
        memoryKind={memoryKind}
        onMemoryKindChange={(k) => {
          setMemoryKind(k)
          setFocusCharId('all')
        }}
        characters={characterRoster}
        focusCharId={focusCharId}
        onFocusCharChange={setFocusCharId}
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
        onOpenTutorial={() => setTutorialOpen(true)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <MemoryList
          entries={filtered}
          loading={loading}
          emptyHint={
            memoryKind === 'linked'
              ? '暂无关联记忆。来自绑定主角线下约会：人脉 NPC 与「管理关系」绑定的其它主角均可各有一条；请在本馆按对应角色筛选查看。'
              : '调整检索词、身份源或角色焦点；也可点右上角「+」新建角色私聊记忆。'
          }
          onEdit={openEdit}
          onDelete={(e) => void handleDelete(e)}
        />
      </div>

      <MemoryTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="记忆档案馆 · 怎么看"
        subtitle="长期记忆小抄，随时可回看"
        sections={MEMORY_ARCHIVE_TUTORIAL_SECTIONS}
        onStartLiveCoach={startLiveCoach}
        zIndex={55000}
      />

      <MemoryCoachPortal
        open={coachOpen}
        steps={MEMORY_ARCHIVE_COACH_STEPS}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        scopeRoot="memory-archive"
        zIndex={54000}
      />

      <MemoryEditorSheet
        open={editorOpen}
        mode={editorMode}
        entry={editingEntry}
        raw={editingRaw}
        contacts={contacts}
        initialCharId={focusCharId !== 'all' ? focusCharId : undefined}
        sourceIdentity={source}
        editorKind={memoryKind}
        currentWechatAccountId={currentWechatAccountId}
        playerIdentityId={playerIdentityId}
        groupOptions={groupOptions}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  )
}
