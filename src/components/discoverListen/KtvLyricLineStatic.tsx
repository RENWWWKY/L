import { memo } from 'react'

import type { LyricWord } from './listenLyricParse'

export type KtvLyricVisualMode = 'idle' | 'playing' | 'past' | 'cursor'

const LYRIC_COLOR = {
  idle: 'text-stone-400/50',
  past: 'text-rose-200/55',
  playing: 'text-rose-300/90',
  cursor: 'text-rose-200',
} as const

export type KtvLyricLineProps = {
  text: string
  words?: LyricWord[]
  playbackTimeMs?: number
  lineStartMs: number
  lineEndMs: number
  mode: KtvLyricVisualMode
  className?: string
}

function colorForMode(mode: KtvLyricVisualMode): string {
  switch (mode) {
    case 'playing':
      return LYRIC_COLOR.playing
    case 'past':
      return LYRIC_COLOR.past
    case 'cursor':
      return LYRIC_COLOR.cursor
    default:
      return LYRIC_COLOR.idle
  }
}

function KtvLyricLineStaticInner({ text, mode, className = '' }: KtvLyricLineProps) {
  return <span className={`${colorForMode(mode)} ${className}`}>{text}</span>
}

export const KtvLyricLineStatic = memo(KtvLyricLineStaticInner)
