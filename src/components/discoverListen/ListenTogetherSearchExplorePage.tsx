import { Loader2, Search, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'

import {
  SEARCH_EXPLORE_MOCK,
  type SearchSuggestion,
  type VibeCategory,
} from './listenTogetherSearchMock'
import { searchNeteaseSongs, type NeteaseSongItem } from './neteaseMusicApi'

function SuggestionTag({
  item,
  onSelect,
}: {
  item: SearchSuggestion
  onSelect: (text: string) => void
}) {
  const isCharacter = item.type === 'character_vibe'

  return (
    <button
      type="button"
      onClick={() => onSelect(item.text)}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-transform active:scale-95 ${
        isCharacter
          ? 'bg-rose-50 text-rose-500 shadow-sm ring-1 ring-rose-100/80'
          : 'border border-stone-100 bg-white text-stone-600 shadow-sm'
      }`}
    >
      {isCharacter ? (
        <Sparkles className="size-3.5 shrink-0 text-rose-400" strokeWidth={1.5} aria-hidden />
      ) : item.isHot ? (
        <span className="text-[10px] text-rose-300" aria-hidden>
          ·
        </span>
      ) : null}
      <span>{item.text}</span>
    </button>
  )
}

function CategoryCard({
  category,
  onSelect,
}: {
  category: VibeCategory
  onSelect: (category: VibeCategory) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className="group relative aspect-[4/5] overflow-hidden rounded-3xl text-left shadow-[0_8px_32px_rgba(120,113,108,0.12)] transition-transform active:scale-95"
    >
      <img
        src={category.cover}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div
        className={`absolute inset-0 bg-gradient-to-br ${category.gradient}`}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-lg font-bold tracking-wider text-white">{category.title}</p>
        <p className="mt-1 text-xs uppercase tracking-widest text-white/70">{category.subtitle}</p>
      </div>
    </button>
  )
}

function SearchResultRow({
  song,
  onPlay,
}: {
  song: NeteaseSongItem
  onPlay: (song: NeteaseSongItem) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(song)}
      className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-sm ring-1 ring-stone-100/80 active:scale-[0.99]"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {song.cover ? (
          <img src={song.cover} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-stone-800">{song.name}</p>
        <p className="truncate text-[12px] text-stone-400">{song.artist}</p>
      </div>
    </button>
  )
}

export type ListenTogetherSearchExplorePageProps = {
  className?: string
  neteaseCookie?: string
  onRequireLogin?: () => void
  onPlaySong?: (song: NeteaseSongItem) => void
  onCategorySelect?: (category: VibeCategory) => void
}

export function ListenTogetherSearchExplorePage({
  className = '',
  neteaseCookie = '',
  onRequireLogin,
  onPlaySong,
  onCategorySelect,
}: ListenTogetherSearchExplorePageProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NeteaseSongItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q) return
      if (!neteaseCookie) {
        onRequireLogin?.()
        return
      }
      setLoading(true)
      setError(null)
      setSearched(true)
      try {
        const songs = await searchNeteaseSongs(neteaseCookie, q)
        setResults(songs)
        if (songs.length === 0) setError('未找到相关歌曲')
      } catch (e) {
        setResults([])
        setError(e instanceof Error ? e.message : '搜索失败')
      } finally {
        setLoading(false)
      }
    },
    [neteaseCookie, onRequireLogin],
  )

  const submitSearch = useCallback(() => {
    void runSearch(query)
  }, [query, runSearch])

  const pickSuggestion = useCallback(
    (text: string) => {
      setQuery(text)
      void runSearch(text)
    },
    [runSearch],
  )

  const onCategory = useCallback(
    (cat: VibeCategory) => {
      onCategorySelect?.(cat)
      void runSearch(cat.title)
    },
    [onCategorySelect, runSearch],
  )

  return (
    <div className={`min-h-full ${className}`}>
      <div className="sticky top-0 z-20 border-b border-white/40 bg-white/45 px-4 pb-4 pt-[max(10px,env(safe-area-inset-top))] shadow-[0_4px_24px_-8px_rgba(120,113,108,0.06)] backdrop-blur-md">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-4 size-[18px] text-stone-400"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSearch()
            }}
            placeholder="搜索歌曲（网易云）..."
            className="h-11 w-full rounded-full border-0 bg-white pl-11 pr-4 text-[14px] text-stone-800 shadow-sm outline-none ring-0 placeholder:text-stone-400 focus:shadow-[0_4px_20px_rgba(251,207,232,0.25)]"
            aria-label="搜索歌曲"
          />
        </label>
      </div>

      <div className="px-4 pb-40 pt-6">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-stone-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            搜索中…
          </p>
        ) : null}

        {error ? <p className="py-4 text-center text-[13px] text-rose-400">{error}</p> : null}

        {searched && results.length > 0 ? (
          <section className="mb-8 space-y-2" aria-label="搜索结果">
            <h2 className="mb-3 text-[15px] font-semibold text-stone-700">搜索结果</h2>
            {results.map((song) => (
              <SearchResultRow
                key={song.id}
                song={song}
                onPlay={(s) => onPlaySong?.(s)}
              />
            ))}
          </section>
        ) : null}

        {!searched || results.length === 0 ? (
          <>
            <section className="mb-10" aria-label="探索灵感">
              <h2 className="mb-4 text-[15px] font-semibold tracking-tight text-stone-700">
                探索灵感
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {SEARCH_EXPLORE_MOCK.searchSuggestions.map((item) => (
                  <SuggestionTag key={item.text} item={item} onSelect={pickSuggestion} />
                ))}
              </div>
            </section>

            <section aria-label="情绪频率">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight text-stone-700">
                  情绪频率
                </h2>
                <span className="text-[10px] uppercase tracking-[0.28em] text-stone-400">
                  Browse
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {SEARCH_EXPLORE_MOCK.categories.map((cat) => (
                  <CategoryCard key={cat.id} category={cat} onSelect={onCategory} />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
