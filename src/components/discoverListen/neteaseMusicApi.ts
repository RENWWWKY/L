import {
  getCachedSongPlayback,
  isSongPlayUrlCacheValid,
  saveCachedSongPlayback,
} from './listenTogetherPersistence'
import { parseLrcContent, type ParsedLyricLine } from './listenLyricParse'
import { ncmApiGet } from './neteaseApiClient'

export type { ParsedLyricLine }

export type NeteaseSongItem = {
  id: number
  name: string
  artist: string
  cover: string
}

function coverUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw : ''
  if (!url) return ''
  return url.includes('?') ? url : `${url}?param=300y300`
}

function mapSong(raw: Record<string, unknown>): NeteaseSongItem | null {
  const id = Number(raw.id ?? raw.songId)
  if (!id) return null
  const ar = Array.isArray(raw.ar)
    ? raw.ar
    : Array.isArray(raw.artists)
      ? raw.artists
      : []
  const artist = ar
    .map((a) => (a && typeof a === 'object' ? String((a as Record<string, unknown>).name ?? '') : ''))
    .filter(Boolean)
    .join(' / ')
  const al = raw.al && typeof raw.al === 'object' ? (raw.al as Record<string, unknown>) : null
  const nameRaw = raw.name ?? raw.songName ?? raw.title
  return {
    id,
    name: nameRaw != null && String(nameRaw).trim() ? String(nameRaw) : '未知歌曲',
    artist: artist || '未知歌手',
    cover: coverUrl(al?.picUrl ?? raw.picUrl),
  }
}

function songNeedsMetadataEnrich(song: NeteaseSongItem): boolean {
  return song.name === '未知歌曲' || song.artist === '未知歌手'
}

function pickIntelligenceSongId(row: Record<string, unknown>): number {
  for (const key of ['song', 'songInfo', 'recommendSong', 'targetSong', 'relatedSong'] as const) {
    const nested = row[key]
    if (nested && typeof nested === 'object') {
      const nestedId = Number((nested as Record<string, unknown>).id)
      if (nestedId > 0) return nestedId
    }
  }
  const songId = Number(row.songId)
  if (songId > 0) return songId
  const id = Number(row.id)
  return id > 0 ? id : 0
}

/** GET /song/detail?ids= — 按 id 批量拉取歌名、歌手、封面 */
export async function fetchNeteaseSongDetails(
  cookie: string,
  ids: number[],
): Promise<NeteaseSongItem[]> {
  const unique = [...new Set(ids.filter((id) => id > 0))]
  if (unique.length === 0) return []
  const body = await ncmApiGet('/song/detail', cookie, { ids: unique.join(',') })
  const rows = pickSongsFromBody(body as Record<string, unknown>)
  const byId = new Map<number, NeteaseSongItem>()
  for (const row of rows) {
    const mapped = mapSong(row)
    if (mapped) byId.set(mapped.id, mapped)
  }
  return unique.map((id) => byId.get(id)).filter((s): s is NeteaseSongItem => Boolean(s))
}

/** GET /search?keywords=&type=1 — 单曲搜索（文档：搜索） */
export async function searchNeteaseSongs(
  cookie: string,
  keywords: string,
  limit = 20,
): Promise<NeteaseSongItem[]> {
  const body = await ncmApiGet('/search', cookie, {
    keywords: keywords.trim(),
    type: '1',
    limit: String(limit),
    offset: '0',
  })
  const result = body.result && typeof body.result === 'object' ? (body.result as Record<string, unknown>) : body
  const songs = Array.isArray(result.songs) ? result.songs : []
  return songs
    .map((s) => (s && typeof s === 'object' ? mapSong(s as Record<string, unknown>) : null))
    .filter((s): s is NeteaseSongItem => Boolean(s))
}

/** GET /song/url/v1?id= — 获取播放地址（文档：音乐 url） */
export async function fetchSongPlayUrl(cookie: string, id: number): Promise<string | null> {
  const levels = ['standard', 'exhigh', 'higher', 'lossless'] as const
  for (const level of levels) {
    const body = await ncmApiGet('/song/url/v1', cookie, { id: String(id), level })
    const data = Array.isArray(body.data) ? body.data : []
    const first = data[0]
    if (first && typeof first === 'object') {
      const row = first as Record<string, unknown>
      const url = row.url
      if (typeof url === 'string' && url) return url
      if (row.code === -110 || url === null) continue
    }
  }
  return null
}

export type SongPlaybackResources = {
  playUrl: string | null
  lyrics: ParsedLyricLine[]
  fromCache: boolean
}

/**
 * 加载播放所需资源：优先读 IndexedDB 缓存（播放地址约 6 小时有效，歌词长期保留）
 */
export async function resolveSongPlayback(
  cookie: string,
  songId: number,
): Promise<SongPlaybackResources> {
  if (!songId) {
    return { playUrl: null, lyrics: [], fromCache: false }
  }

  const cached = await getCachedSongPlayback(songId)
  const urlValid = isSongPlayUrlCacheValid(cached)
  const hasLyrics = Boolean(cached?.lyrics?.length)

  if (urlValid && cached && hasLyrics) {
    return {
      playUrl: cached.playUrl,
      lyrics: cached.lyrics,
      fromCache: true,
    }
  }

  const needUrl = !urlValid
  const needLyrics = !hasLyrics

  const [playUrl, lyrics] = await Promise.all([
    needUrl
      ? fetchSongPlayUrl(cookie, songId)
      : Promise.resolve(cached?.playUrl ?? null),
    needLyrics
      ? fetchSongLyric(cookie, songId).catch(() => [] as ParsedLyricLine[])
      : Promise.resolve(cached?.lyrics ?? []),
  ])

  const mergedLyrics = lyrics.length > 0 ? lyrics : (cached?.lyrics ?? [])

  if (playUrl) {
    await saveCachedSongPlayback({
      songId,
      playUrl,
      lyrics: mergedLyrics,
    })
  }

  return {
    playUrl,
    lyrics: mergedLyrics,
    fromCache: false,
  }
}

export type PlaylistMeta = {
  id: number
  title: string
  cover: string
  count: number
  description: string
}

/** GET /playlist/detail?id= — 歌单元信息 */
export async function fetchPlaylistMeta(cookie: string, playlistId: number): Promise<PlaylistMeta> {
  if (!playlistId) {
    return { id: 0, title: '歌单', cover: '', count: 0, description: '' }
  }
  const body = await ncmApiGet('/playlist/detail', cookie, { id: String(playlistId) })
  const playlist =
    body.playlist && typeof body.playlist === 'object'
      ? (body.playlist as Record<string, unknown>)
      : null
  if (!playlist) {
    return { id: playlistId, title: '歌单', cover: '', count: 0, description: '' }
  }
  return {
    id: playlistId,
    title: String(playlist.name ?? '歌单'),
    cover: coverUrl(playlist.coverImgUrl),
    count: Number(playlist.trackCount ?? 0),
    description: typeof playlist.description === 'string' ? playlist.description : '',
  }
}

function pickSongsFromBody(body: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(body.songs)) return body.songs as Record<string, unknown>[]
  const playlist = body.playlist
  if (playlist && typeof playlist === 'object' && Array.isArray((playlist as Record<string, unknown>).tracks)) {
    return (playlist as Record<string, unknown>).tracks as Record<string, unknown>[]
  }
  return []
}

/** 歌单曲目分页默认每页条数（对接 /playlist/track/all 的 limit） */
export const PLAYLIST_TRACKS_PAGE_SIZE = 100

/** 歌单内本地筛选（歌名 / 歌手） */
export function filterPlaylistTracks(tracks: NeteaseSongItem[], query: string): NeteaseSongItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return tracks
  return tracks.filter((s) => {
    const name = s.name.toLowerCase()
    const artist = s.artist.toLowerCase()
    return name.includes(q) || artist.includes(q) || `${name} ${artist}`.includes(q)
  })
}

function mergePlaylistTracks(
  existing: NeteaseSongItem[],
  incoming: NeteaseSongItem[],
): NeteaseSongItem[] {
  if (incoming.length === 0) return existing
  const seen = new Set(existing.map((s) => s.id))
  const next = [...existing]
  for (const song of incoming) {
    if (!seen.has(song.id)) {
      seen.add(song.id)
      next.push(song)
    }
  }
  return next
}

/** GET /playlist/track/all?id= — 歌单全部歌曲（文档：歌单所有歌曲） */
export async function fetchPlaylistTracks(
  cookie: string,
  playlistId: number,
  limit = PLAYLIST_TRACKS_PAGE_SIZE,
  offset = 0,
): Promise<NeteaseSongItem[]> {
  if (!playlistId) return []
  try {
    const body = await ncmApiGet('/playlist/track/all', cookie, {
      id: String(playlistId),
      limit: String(limit),
      offset: String(offset),
    })
    return pickSongsFromBody(body)
      .map((s) => mapSong(s))
      .filter((s): s is NeteaseSongItem => Boolean(s))
  } catch {
    const detail = await ncmApiGet('/playlist/detail', cookie, { id: String(playlistId) })
    return pickSongsFromBody(detail)
      .map((s) => mapSong(s))
      .filter((s): s is NeteaseSongItem => Boolean(s))
  }
}

/** 分页拉取直至歌单曲目全部加载（用于「加载全部」） */
export async function fetchAllPlaylistTracks(
  cookie: string,
  playlistId: number,
  totalCount: number,
  alreadyLoaded: NeteaseSongItem[] = [],
  onBatch?: (tracks: NeteaseSongItem[]) => void,
): Promise<NeteaseSongItem[]> {
  let acc = alreadyLoaded
  let offset = alreadyLoaded.length
  const total = Math.max(totalCount, offset)

  while (offset < total) {
    const batch = await fetchPlaylistTracks(
      cookie,
      playlistId,
      PLAYLIST_TRACKS_PAGE_SIZE,
      offset,
    )
    if (batch.length === 0) break
    acc = mergePlaylistTracks(acc, batch)
    onBatch?.(acc)
    offset = acc.length
    if (batch.length < PLAYLIST_TRACKS_PAGE_SIZE) break
  }
  return acc
}

/** GET /user/record?uid=&type=1 — 最近一周播放（文档：用户播放记录） */
export async function fetchUserRecentSongs(
  cookie: string,
  uid: number,
  limit = 10,
): Promise<NeteaseSongItem[]> {
  const body = await ncmApiGet('/user/record', cookie, { uid: String(uid), type: '1' })
  const weekData =
    body.weekData && typeof body.weekData === 'object'
      ? (body.weekData as Record<string, unknown>)
      : null
  const records =
    weekData && Array.isArray(weekData.weekRecords) ? weekData.weekRecords : []
  const songs: NeteaseSongItem[] = []
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue
    const song = (rec as Record<string, unknown>).song
    if (song && typeof song === 'object') {
      const mapped = mapSong(song as Record<string, unknown>)
      if (mapped) songs.push(mapped)
    }
    if (songs.length >= limit) break
  }
  return songs
}

/** GET /lyric?id= — 歌词（LRC + 可选 YRC 逐字） */
export async function fetchSongLyric(cookie: string, id: number): Promise<ParsedLyricLine[]> {
  const body = await ncmApiGet('/lyric', cookie, { id: String(id) })
  const lrc =
    body.lrc && typeof body.lrc === 'object'
      ? String((body.lrc as Record<string, unknown>).lyric ?? '')
      : ''
  if (!lrc.trim()) return []
  return parseLrcContent(lrc)
}

export type NeteaseSongComment = {
  id: number
  content: string
  nickname: string
  avatar: string
  likedCount: number
  time: number
  isHot?: boolean
}

export type SongCommentsPage = {
  hot: NeteaseSongComment[]
  items: NeteaseSongComment[]
  total: number
  more: boolean
}

export type SongCommentsCacheEntry = {
  songId: number
  hot: NeteaseSongComment[]
  items: NeteaseSongComment[]
  total: number
  more: boolean
  updatedAt: number
}

function mapComment(raw: unknown, isHot = false): NeteaseSongComment | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = Number(row.commentId ?? row.id)
  if (!id) return null
  const user =
    row.user && typeof row.user === 'object' ? (row.user as Record<string, unknown>) : null
  return {
    id,
    content: String(row.content ?? ''),
    nickname: String(user?.nickname ?? '匿名用户'),
    avatar: coverUrl(user?.avatarUrl),
    likedCount: Number(row.likedCount ?? 0),
    time: Number(row.time ?? 0),
    isHot,
  }
}

/** GET /comment/music?id= — 歌曲评论（文档：歌曲评论） */
export async function fetchSongComments(
  cookie: string,
  songId: number,
  limit = 30,
  offset = 0,
): Promise<SongCommentsPage> {
  if (!songId) {
    return { hot: [], items: [], total: 0, more: false }
  }
  const body = await ncmApiGet('/comment/music', cookie, {
    id: String(songId),
    limit: String(limit),
    offset: String(offset),
  })
  const hotRaw = offset === 0 && Array.isArray(body.hotComments) ? body.hotComments : []
  const itemsRaw = Array.isArray(body.comments) ? body.comments : []
  const hot = hotRaw
    .map((c) => mapComment(c, true))
    .filter((c): c is NeteaseSongComment => Boolean(c))
  const items = itemsRaw
    .map((c) => mapComment(c, false))
    .filter((c): c is NeteaseSongComment => Boolean(c))
  const total = Number(body.total ?? hot.length + items.length)
  const loaded = offset + items.length
  return {
    hot,
    items,
    total,
    more: loaded < total,
  }
}

/** GET /playmode/intelligence/list — 心动模式推荐曲目（文档：心动模式/智能播放） */
export async function fetchHeartModeNextSongs(
  cookie: string,
  songId: number,
  likedPlaylistId: number,
  count = 1,
): Promise<NeteaseSongItem[]> {
  if (!songId || !likedPlaylistId) return []
  const body = await ncmApiGet('/playmode/intelligence/list', cookie, {
    id: String(songId),
    pid: String(likedPlaylistId),
    sid: String(songId),
    count: String(count),
  })
  const data = body.data
  const rawList: unknown[] = []
  if (Array.isArray(data)) rawList.push(...data)
  else if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>
    if (Array.isArray(row.songs)) rawList.push(...row.songs)
    if (Array.isArray(row.data)) rawList.push(...row.data)
  }
  const ids: number[] = []
  const fallback: NeteaseSongItem[] = []
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = pickIntelligenceSongId(row)
    if (id > 0) ids.push(id)
    for (const key of ['song', 'songInfo', 'recommendSong', 'targetSong', 'relatedSong'] as const) {
      const nested = row[key]
      if (nested && typeof nested === 'object') {
        const mapped = mapSong(nested as Record<string, unknown>)
        if (mapped && !songNeedsMetadataEnrich(mapped)) {
          fallback.push(mapped)
          break
        }
      }
    }
    if (!id) {
      const mapped = mapSong(row)
      if (mapped) fallback.push(mapped)
    }
  }

  const uniqueIds = [...new Set(ids)].slice(0, Math.max(1, count))
  if (uniqueIds.length > 0) {
    try {
      const detailed = await fetchNeteaseSongDetails(cookie, uniqueIds)
      if (detailed.length > 0) return detailed.slice(0, count)
    } catch {
      /* 详情接口失败时回退心动列表内嵌字段 */
    }
  }

  const fromFallback = fallback.filter((s) => !songNeedsMetadataEnrich(s))
  if (fromFallback.length > 0) return fromFallback.slice(0, count)

  if (uniqueIds.length > 0) {
    return uniqueIds.slice(0, count).map((id) => ({
      id,
      name: '未知歌曲',
      artist: '未知歌手',
      cover: '',
    }))
  }
  return fallback.slice(0, count)
}

/** GET /likelist?uid= — 用户喜欢的歌曲 id 列表（文档：喜欢的音乐） */
export async function fetchLikedSongIds(cookie: string, uid: number): Promise<number[]> {
  if (!uid) return []
  const body = await ncmApiGet('/likelist', cookie, { uid: String(uid) })
  if (Array.isArray(body.ids)) {
    return body.ids.map((id) => Number(id)).filter((id) => id > 0)
  }
  const data = body.data
  if (Array.isArray(data)) {
    return data.map((id) => Number(id)).filter((id) => id > 0)
  }
  if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).ids)) {
    return ((data as Record<string, unknown>).ids as unknown[])
      .map((id) => Number(id))
      .filter((id) => id > 0)
  }
  return []
}

/** GET /like?id=&like= — 喜欢 / 取消喜欢单曲（文档：喜欢音乐） */
export async function setNeteaseSongLiked(
  cookie: string,
  songId: number,
  liked: boolean,
): Promise<void> {
  if (!songId) return
  await ncmApiGet('/like', cookie, {
    id: String(songId),
    like: liked ? 'true' : 'false',
  })
}

/** GET /login/status — 校验 cookie 是否有效 */
export async function checkNeteaseLogin(cookie: string): Promise<boolean> {
  try {
    const body = await ncmApiGet('/login/status', cookie)
    if (body.code === 200 && body.data && typeof body.data === 'object') {
      const data = body.data as Record<string, unknown>
      if (data.account && typeof data.account === 'object') return true
      if (Number(data.code) === 200) return true
    }
    return body.code === 200
  } catch {
    return false
  }
}

export function songToAttached(song: NeteaseSongItem) {
  return {
    songId: song.id,
    title: song.name,
    artist: song.artist,
    cover: song.cover || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80',
  }
}
