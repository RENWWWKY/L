import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { CharacterMemory } from '../wechat/newFriendsPersona/types'
import { DestinyArchiveMemoryCard } from './DestinyArchiveMemoryCard'
import { DestinyArchiveSummaryProgressPanel } from './DestinyArchiveSummaryProgressPanel'
import { computeDestinyArchiveStats, mergeNpcIntoDestinyArchive } from './meetDestinyArchive'
import {
  deleteMeetArchiveMemoryEntry,
  destinyArchiveRowMatchesQuery,
  loadMeetMemoriesByCharacterIds,
  upsertMeetArchiveMemoryEntry,
} from './meetDestinyArchiveMemories'
import { useMeetStore } from './LumiMeetStore'
import type { MeetArchiveCoachTab } from './meetAppCoachSteps'
import { MEET_APP_COACH_TARGET_ATTR } from './meetAppCoachSteps'

const PLATINUM = '#D4AF37'

type ArchiveTabId = MeetArchiveCoachTab

const ARCHIVE_TABS: { id: ArchiveTabId; label: string; caption: string }[] = [
  { id: 'memories', label: '邂逅残卷', caption: 'Memories' },
  { id: 'progress', label: '总结进度', caption: 'Summary · Progress' },
]

export function DestinyArchive({ coachArchiveTab = null }: { coachArchiveTab?: ArchiveTabId | null }) {
  const { state, hydrated, syncDestinyArchiveFromNpcs } = useMeetStore()

  const [memoriesByChar, setMemoriesByChar] = useState<Map<string, CharacterMemory[]>>(new Map())
  const [loadingMemories, setLoadingMemories] = useState(false)
  const [archiveTab, setArchiveTab] = useState<ArchiveTabId>('memories')
  const activeArchiveTab = coachArchiveTab ?? archiveTab
  const [searchQuery, setSearchQuery] = useState('')
  const [summaryInterval, setSummaryInterval] = useState<number | null>(null)

  const merged = useMemo(
    () =>
      mergeNpcIntoDestinyArchive(
        state.destinyArchive ?? [],
        state.destinyArchiveMetaByCharId ?? {},
        state.npcs,
      ),
    [state.destinyArchive, state.destinyArchiveMetaByCharId, state.npcs],
  )

  const reloadMemories = useCallback(async () => {
    const ids = merged.map((r) => r.charId)
    if (!ids.length) {
      setMemoriesByChar(new Map())
      return
    }
    setLoadingMemories(true)
    try {
      const map = await loadMeetMemoriesByCharacterIds(ids)
      setMemoriesByChar(map)
    } finally {
      setLoadingMemories(false)
    }
  }, [merged])

  useEffect(() => {
    if (!hydrated) return
    syncDestinyArchiveFromNpcs()
  }, [hydrated, syncDestinyArchiveFromNpcs, state.npcs.length])

  useEffect(() => {
    void reloadMemories()
  }, [reloadMemories])

  useEffect(() => {
    const on = () => void reloadMemories()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [reloadMemories])

  useEffect(() => {
    void personaDb.getMemorySettings().then((s) => {
      setSummaryInterval(Math.max(1, Math.floor(s.autoSummaryInterval)))
    })
  }, [])

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return merged
    return merged.filter((row) => {
      const mems = memoriesByChar.get(row.charId) ?? []
      return destinyArchiveRowMatchesQuery(row, mems, searchQuery)
    })
  }, [merged, memoriesByChar, searchQuery])

  const npcById = useMemo(() => new Map(state.npcs.map((n) => [n.id, n])), [state.npcs])

  const stats = useMemo(() => computeDestinyArchiveStats(merged), [merged])

  const totalMemoryCount = useMemo(() => {
    let n = 0
    for (const row of merged) {
      n += (memoriesByChar.get(row.charId) ?? []).length
    }
    return n
  }, [merged, memoriesByChar])

  const handleSaveMemoryEntry = useCallback(
    async (charId: string, body: string, existing: CharacterMemory | null) => {
      await upsertMeetArchiveMemoryEntry({ characterId: charId, body, existing })
      await reloadMemories()
    },
    [reloadMemories],
  )

  const handleDeleteMemoryEntry = useCallback(
    async (id: string) => {
      if (!window.confirm('删除这条邂逅记忆？')) return
      await deleteMeetArchiveMemoryEntry(id)
      await reloadMemories()
    },
    [reloadMemories],
  )

  return (
    <div data-meet-app-coach="archive-panel" className="relative flex min-h-0 flex-1 flex-col bg-[#faf9f7]">
      <div className="meet-scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-8">
        <header className="px-4 pb-4 pt-6 text-center">
          <p className="meet-caption-en text-[10px] uppercase tracking-[0.48em] text-[#b8b5ad]">
            DESTINY ARCHIVE
          </p>
          <h2 className="mt-2 font-elegant-serif text-[18px] font-medium tracking-[0.12em] text-[#2c2a26]">
            邂逅残卷
          </h2>
          <p className="mx-auto mt-4 max-w-[300px] font-elegant-serif text-[12px] italic leading-relaxed text-[#8a847b]">
            {stats.epitaph}
          </p>
          {summaryInterval != null ? (
            <p className="mx-auto mt-2 max-w-[320px] text-[11px] font-light leading-relaxed text-[#b0aba3]">
              邂逅对话与微信私聊共用记忆设置：每 {summaryInterval} 轮 NPC 回复自动写入一条
              <span className="text-[#9a7d3a]"> [遇见] </span>
              记忆（已收录 {totalMemoryCount} 条）
            </p>
          ) : null}
        </header>

        <nav
          {...{ [MEET_APP_COACH_TARGET_ATTR]: 'archive-tabs' }}
          className="sticky top-0 z-10 border-b border-black/[0.06] bg-[#faf9f7]/95 px-3 backdrop-blur-[6px]"
          aria-label="邂逅档案分页"
        >
          <div className="flex justify-center gap-6">
            {ARCHIVE_TABS.map((t) => {
              const active = activeArchiveTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setArchiveTab(t.id)}
                  className={`relative min-w-0 flex-1 pb-2.5 pt-2 text-center outline-none transition-colors ${
                    active ? 'text-[#2c2a26]' : 'text-[#b8b5ad]'
                  }`}
                >
                  <span className="block font-elegant-serif text-[13px] tracking-[0.08em]">{t.label}</span>
                  <span className="meet-caption-en mt-0.5 block text-[8px] uppercase tracking-[0.2em]">
                    {t.caption}
                  </span>
                  {active ? (
                    <motion.div
                      layoutId="destinyArchiveTabGoldLine"
                      className="absolute bottom-0 left-[12%] right-[12%] h-[2px] rounded-full bg-[#D4AF37]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {activeArchiveTab === 'memories' ? (
            <motion.div
              key="archive-memories"
              role="tabpanel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <div className="px-4 pb-4 pt-3">
                <label className="sr-only" htmlFor="destiny-archive-search">
                  搜索邂逅记忆
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#b8b5ad]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <input
                    id="destiny-archive-search"
                    type="search"
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索角色名或记忆关键词…"
                    className="w-full rounded-[14px] border border-black/[0.06] bg-white/80 py-2.5 pl-10 pr-3 text-[14px] font-light text-[#2c2a26] outline-none placeholder:text-[#c4bfb8] focus:border-[#D4AF37]/45"
                  />
                </div>
              </div>

              <div className="relative px-4">
                <motion.div
                  className="pointer-events-none absolute bottom-0 left-8 top-0 w-px origin-top"
                  style={{
                    background: `linear-gradient(180deg, transparent 0%, ${PLATINUM} 18%, rgba(212,175,55,0.35) 72%, transparent 100%)`,
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  aria-hidden
                />

                {filteredRows.length === 0 && !loadingMemories ? (
                  <p className="py-16 text-center text-[13px] font-light leading-relaxed text-[#a39e96]">
                    {searchQuery.trim()
                      ? '没有匹配的邂逅残卷'
                      : '残卷尚空。去星轨完成一次匹配或擦肩而过，交汇会在此留下残响。'}
                  </p>
                ) : (
                  <ul className="relative space-y-8 pb-8 pl-2">
                    {filteredRows.map((row, index) => (
                      <DestinyArchiveMemoryCard
                        key={row.id}
                        memory={row}
                        memoryEntries={memoriesByChar.get(row.charId) ?? []}
                        index={index}
                        npc={npcById.get(row.charId) ?? null}
                        meetProfile={state.meetProfile}
                        intimacyScore={state.intimacyByNpcId?.[row.charId] ?? 0}
                        canRewindMissed={
                          row.matchType === 'faded' &&
                          npcById.get(row.charId)?.status === 'missed' &&
                          state.rewindChargesRemaining > 0
                        }
                        onDeleteMemoryEntry={(id) => void handleDeleteMemoryEntry(id)}
                        onSaveMemoryEntry={(body, existing) =>
                          void handleSaveMemoryEntry(row.charId, body, existing)
                        }
                      />
                    ))}
                  </ul>
                )}

                {loadingMemories ? (
                  <p className="meet-caption-en pb-8 text-center text-[10px] tracking-[0.24em] text-[#c4bfb8]">
                    正在整理会话残响…
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="archive-progress"
              role="tabpanel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <DestinyArchiveSummaryProgressPanel
                archiveRows={merged}
                meetProfile={state.meetProfile}
                memoriesByChar={memoriesByChar}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
