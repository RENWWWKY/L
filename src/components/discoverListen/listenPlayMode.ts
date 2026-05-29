export type ListenPlayMode = 'repeatOne' | 'repeatAll' | 'shuffle' | 'heart'

export type PlayQueueMeta = {
  playlistId: number
  isLikedPlaylist: boolean
}

export type PlaySongContext = {
  queue?: NeteaseSongItemRef[]
  index?: number
  playlistId?: number
  isLikedPlaylist?: boolean
}

/** 仅用于类型引用，避免循环依赖 */
export type NeteaseSongItemRef = {
  id: number
  name: string
  artist: string
  cover: string
}

const MODES_NORMAL: ListenPlayMode[] = ['repeatOne', 'repeatAll', 'shuffle']
const MODES_WITH_HEART: ListenPlayMode[] = ['repeatOne', 'repeatAll', 'shuffle', 'heart']

export function getNextPlayMode(current: ListenPlayMode, canHeart: boolean): ListenPlayMode {
  const list = canHeart ? MODES_WITH_HEART : MODES_NORMAL
  const idx = list.indexOf(current)
  if (idx < 0) return list[0]
  return list[(idx + 1) % list.length]
}

export function normalizePlayMode(mode: ListenPlayMode, canHeart: boolean): ListenPlayMode {
  if (mode === 'heart' && !canHeart) return 'repeatAll'
  return mode
}

export const PLAY_MODE_LABELS: Record<ListenPlayMode, string> = {
  repeatOne: '单曲循环',
  repeatAll: '列表循环',
  shuffle: '歌单随机',
  heart: '心动模式',
}

export function pickRandomQueueIndex(length: number, exclude = -1): number {
  if (length <= 0) return 0
  if (length === 1) return 0
  let idx = exclude
  let guard = 0
  while (idx === exclude && guard < 12) {
    idx = Math.floor(Math.random() * length)
    guard += 1
  }
  return idx < 0 ? 0 : idx
}
