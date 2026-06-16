import type { ReactNode } from 'react'
import { Heart, MessageCircle, User } from 'lucide-react'

import { ListenNum, ListenNumericText } from './ListenNum'
import { ListenNeteaseCommentText } from './ListenNeteaseCommentText'
import type { NeteaseArtistNote } from './neteaseMusicApi'

export function formatNoteTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  if (sameYear) return `${month}月${day}日`
  return `${d.getFullYear()}年${month}月${day}日`
}

export function normalizeNoteText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function NoteText({ text }: { text: string }) {
  const normalized = normalizeNoteText(text)
  if (!normalized) return null

  const lines = normalized.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, lineIndex) => {
        if (!line) return <div key={lineIndex} className="h-1" aria-hidden />
        const parts = line.split(/(#[^#\s]+#|#[^\s#]+)/g)
        return (
          <p key={lineIndex} className="text-[14px] leading-[1.65] text-stone-700">
            {parts.map((part, partIndex) => {
              if (part.startsWith('#')) {
                return (
                  <span key={partIndex} className="font-medium text-rose-500">
                    <ListenNeteaseCommentText text={part} emojiScale={1.05} />
                  </span>
                )
              }
              return <ListenNeteaseCommentText key={partIndex} text={part} emojiScale={1.05} />
            })}
          </p>
        )
      })}
    </div>
  )
}

export function NoteImageGrid({
  images,
  className = '',
  onImageClick,
}: {
  images: string[]
  className?: string
  onImageClick?: () => void
}) {
  const visible = images.slice(0, 9)
  const overflow = images.length - visible.length

  const wrap = (node: ReactNode, key?: string) => {
    if (!onImageClick) return node
    return (
      <button
        key={key}
        type="button"
        onClick={onImageClick}
        className="block w-full text-left"
      >
        {node}
      </button>
    )
  }

  const img = (src: string, className: string) => (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={`h-full w-full object-cover ${className}`}
    />
  )

  if (visible.length === 0) return null

  if (visible.length === 1) {
    return wrap(
      <div
        className={`overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-100/80 ${className}`}
      >
        {img(visible[0], 'max-h-[320px] w-full')}
      </div>,
    )
  }

  if (visible.length === 2) {
    return wrap(
      <div className={`grid grid-cols-2 gap-1.5 overflow-hidden rounded-2xl ${className}`}>
        {visible.map((src) => (
          <div key={src} className="aspect-[4/5] overflow-hidden bg-stone-100">
            {img(src, '')}
          </div>
        ))}
      </div>,
    )
  }

  if (visible.length === 3) {
    return wrap(
      <div
        className={`grid h-[220px] grid-cols-2 gap-1.5 overflow-hidden rounded-2xl ${className}`}
      >
        <div className="row-span-2 overflow-hidden bg-stone-100">
          {img(visible[0], '')}
        </div>
        <div className="overflow-hidden bg-stone-100">{img(visible[1], '')}</div>
        <div className="overflow-hidden bg-stone-100">{img(visible[2], '')}</div>
      </div>,
    )
  }

  if (visible.length === 4) {
    return wrap(
      <div className={`grid grid-cols-2 gap-1.5 overflow-hidden rounded-2xl ${className}`}>
        {visible.map((src) => (
          <div key={src} className="aspect-square overflow-hidden bg-stone-100">
            {img(src, '')}
          </div>
        ))}
      </div>,
    )
  }

  return wrap(
    <div className={`grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl ${className}`}>
      {visible.map((src, index) => (
        <div key={src} className="relative aspect-square overflow-hidden bg-stone-100">
          {img(src, '')}
          {index === visible.length - 1 && overflow > 0 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[15px] font-medium text-white">
              +<ListenNum>{overflow}</ListenNum>
            </span>
          ) : null}
        </div>
      ))}
    </div>,
  )
}

export function ArtistNoteBody({
  note,
  artistName,
  artistAvatar,
  showStats = true,
  imageClassName = 'mt-4',
  onImageClick,
}: {
  note: NeteaseArtistNote
  artistName: string
  artistAvatar: string
  showStats?: boolean
  imageClassName?: string
  onImageClick?: () => void
}) {
  const hasText = Boolean(normalizeNoteText(note.text))

  return (
    <>
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-2 ring-white shadow-sm">
          {artistAvatar ? (
            <img
              src={artistAvatar}
              alt={artistName}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="m-auto size-5 text-stone-300" strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-stone-800">{artistName}</p>
          <p className="mt-0.5 text-[12px] text-stone-400">
            <ListenNumericText text={formatNoteTime(note.time)} />
          </p>
        </div>
      </header>

      {hasText ? (
        <div className="px-4 pb-1">
          <NoteText text={note.text} />
        </div>
      ) : null}

      {note.images.length > 0 ? (
        <div className="px-4">
          <NoteImageGrid
            images={note.images}
            className={imageClassName}
            onImageClick={onImageClick}
          />
        </div>
      ) : null}

      {showStats ? (
        <div className="mt-4 flex items-center gap-5 px-4 pb-4 text-[12px] text-stone-500">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-4 text-stone-400" strokeWidth={1.5} />
            <ListenNum>{note.likedCount}</ListenNum>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-4 text-stone-400" strokeWidth={1.5} />
            <ListenNum>{note.commentCount}</ListenNum>
          </span>
        </div>
      ) : null}
    </>
  )
}
