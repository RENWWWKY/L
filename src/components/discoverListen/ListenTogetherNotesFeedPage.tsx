import { MessageCircle, Feather, Heart, Play } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ListenTogetherHeaderRefreshButton } from './ListenTogetherHeaderRefreshButton'
import { ListenNum } from './ListenNum'
import {
  NOTES_FEED_MOCK,
  type ListenAttachedMusic,
  type ListenFeedNote,
} from './listenTogetherNotesMock'

function MusicCapsule({
  music,
  onPlay,
}: {
  music: ListenAttachedMusic
  onPlay?: () => void
}) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50/80 p-2.5">
      <div className="relative h-12 w-12 shrink-0">
        <div className="h-12 w-12 overflow-hidden rounded-lg shadow-sm ring-1 ring-stone-200/60">
          <img src={music.cover} alt="" className="h-full w-full object-cover" />
        </div>
        <div
          className="pointer-events-none absolute -right-0.5 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-sm bg-stone-300/90 shadow-sm"
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-stone-800">{music.title}</p>
        <p className="truncate text-[11px] font-normal text-stone-400">{music.artist}</p>
      </div>
      <button
        type="button"
        aria-label={`播放 ${music.title}`}
        onClick={(e) => {
          e.stopPropagation()
          onPlay?.()
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-400 shadow-sm ring-1 ring-rose-100/80 transition-colors hover:bg-rose-100 active:scale-95"
      >
        <Play className="size-4 fill-current pl-0.5" strokeWidth={0} />
      </button>
    </div>
  )
}

function RelationBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full bg-indigo-50/90 px-2 py-0.5 text-[10px] font-medium tracking-wide text-indigo-400/90 ring-1 ring-indigo-100/60">
      {label}
    </span>
  )
}

function NoteCard({
  note,
  liked,
  likeCount,
  onToggleLike,
  onPlayMusic,
}: {
  note: ListenFeedNote
  liked: boolean
  likeCount: number
  onToggleLike: () => void
  onPlayMusic: () => void
}) {
  const { author } = note
  const isUser = author.type === 'user'

  return (
    <article className="rounded-3xl bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
      <header className="flex items-start gap-3">
        <img
          src={author.avatar}
          alt={author.name}
          className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-stone-50 shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-[14px] font-medium ${
                isUser ? 'text-rose-400' : 'text-stone-800'
              }`}
            >
              {author.name}
            </span>
            {author.type === 'character' && author.relationLabel ? (
              <RelationBadge label={author.relationLabel} />
            ) : null}
          </div>
        </div>
        <ListenNum className="shrink-0 text-[11px] text-stone-400/90">{note.time}</ListenNum>
      </header>

      <p className="mt-4 text-[14px] leading-relaxed text-stone-700">{note.content}</p>

      <MusicCapsule music={note.attachedMusic} onPlay={onPlayMusic} />

      <footer className="mt-5 flex items-center gap-5">
        <button
          type="button"
          onClick={onToggleLike}
          className={`inline-flex items-center gap-1.5 text-[12px] transition-colors ${
            liked ? 'text-rose-400' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Heart className={`size-4 ${liked ? 'fill-current' : ''}`} strokeWidth={1.5} />
          <ListenNum>{likeCount}</ListenNum>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] text-stone-400 transition-colors hover:text-stone-600"
          aria-label="评论"
        >
          <MessageCircle className="size-4" strokeWidth={1.5} />
          <ListenNum>{note.stats.comments}</ListenNum>
        </button>
      </footer>
    </article>
  )
}

export function ListenNotesFeedList({
  notes,
  className = '',
  onPlayAttachedMusic,
}: {
  notes: ListenFeedNote[]
  className?: string
  onPlayAttachedMusic?: (music: ListenAttachedMusic, noteId: string) => void
}) {
  const [likedById, setLikedById] = useState<Record<string, boolean>>({})

  const toggleLike = useCallback((note: ListenFeedNote) => {
    setLikedById((prev) => ({ ...prev, [note.id]: !prev[note.id] }))
  }, [])

  if (notes.length === 0) {
    return (
      <p className={`py-8 text-center text-[12px] text-stone-400 ${className}`}>还没有写过手账</p>
    )
  }

  return (
    <ul className={`space-y-4 ${className}`}>
      {notes.map((note) => {
        const liked = likedById[note.id] ?? false
        const likeCount = note.stats.likes + (liked ? 1 : 0)
        return (
          <li key={note.id}>
            <NoteCard
              note={note}
              liked={liked}
              likeCount={likeCount}
              onToggleLike={() => toggleLike(note)}
              onPlayMusic={() => onPlayAttachedMusic?.(note.attachedMusic, note.id)}
            />
          </li>
        )
      })}
    </ul>
  )
}

export type ListenTogetherNotesFeedPageProps = {
  className?: string
  onCompose?: () => void
  onPlayAttachedMusic?: (music: ListenAttachedMusic, noteId: string) => void
  onRefresh?: () => void
}

export function ListenTogetherNotesFeedPage({
  className = '',
  onCompose,
  onPlayAttachedMusic,
  onRefresh,
}: ListenTogetherNotesFeedPageProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    onRefresh?.()
    window.setTimeout(() => setRefreshing(false), 400)
  }, [onRefresh])

  return (
    <div className={`min-h-full ${className}`}>
      <header className="sticky top-0 z-10 border-b border-white/40 bg-white/45 px-4 pb-3 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="relative flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-[17px] font-medium tracking-wide text-stone-800">音符手记</h1>
            <p className="mt-0.5 text-[10px] tracking-[0.28em] text-stone-400">NOTES</p>
          </div>
          <div className="absolute right-0 flex items-center gap-1.5">
            <ListenTogetherHeaderRefreshButton
              variant="ghost"
              loading={refreshing}
              onClick={handleRefresh}
              className="border border-stone-100 bg-white shadow-[0_4px_16px_rgba(120,113,108,0.08)]"
            />
            <button
              type="button"
              aria-label="发布手记"
              onClick={onCompose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-100 bg-white text-stone-500 shadow-[0_4px_16px_rgba(120,113,108,0.08)] transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-400"
            >
              <Feather className="size-[18px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <ListenNotesFeedList
        notes={NOTES_FEED_MOCK.notes}
        className="px-4 pb-40 pt-5"
        onPlayAttachedMusic={onPlayAttachedMusic}
      />
    </div>
  )
}
