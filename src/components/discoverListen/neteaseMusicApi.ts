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
  const full = url.startsWith('//') ? `https:${url}` : url
  return full.includes('?') ? full : `${full}?param=300y300`
}

function pickCoverFromRecord(row: Record<string, unknown> | null | undefined): string {
  if (!row) return ''
  for (const key of ['picUrl', 'coverImgUrl', 'imageUrl', 'imgUrl', 'cover', 'pic']) {
    const u = coverUrl(row[key])
    if (u) return u
  }
  const al =
    row.al && typeof row.al === 'object'
      ? (row.al as Record<string, unknown>)
      : row.album && typeof row.album === 'object'
        ? (row.album as Record<string, unknown>)
        : null
  const fromAl = coverUrl(al?.picUrl ?? al?.coverImgUrl)
  if (fromAl) return fromAl

  const image = row.image
  if (typeof image === 'string') return coverUrl(image)
  if (image && typeof image === 'object') {
    const img = image as Record<string, unknown>
    const u = coverUrl(img.imageUrl ?? img.picUrl ?? img.url)
    if (u) return u
  }
  return ''
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
  const nameRaw = raw.name ?? raw.songName ?? raw.title
  return {
    id,
    name: nameRaw != null && String(nameRaw).trim() ? String(nameRaw) : '未知歌曲',
    artist: artist || '未知歌手',
    cover: pickCoverFromRecord(raw),
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

export type NeteaseArtistItem = {
  id: number
  name: string
  avatar: string
}

export type NeteaseArtistDetail = {
  id: number
  name: string
  avatar: string
  /** 歌手主页顶部背景图 */
  cover: string
  briefDesc: string
  alias: string[]
  musicSize: number
  albumSize: number
  mvSize: number
  following: number
  followers: number
  /** 网易音乐人身份标签，如歌手、作词、作曲 */
  identities: string[]
  /** 绑定的网易用户 id，用于拉取笔记动态 */
  accountUserId: number
}

export type NeteaseAlbumItem = {
  id: number
  name: string
  cover: string
  trackCount: number
  publishTime: number
  artistName: string
}

export type NeteaseArtistNote = {
  id: number
  threadId: string
  time: number
  text: string
  images: string[]
  likedCount: number
  commentCount: number
}

export type NeteasePlaylistItem = {
  id: number
  name: string
  cover: string
  trackCount: number
  creator: string
}

export type NeteaseSearchBundle = {
  songs: NeteaseSongItem[]
  artists: NeteaseArtistItem[]
  playlists: NeteasePlaylistItem[]
}

function avatarUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw : ''
  if (!url) return ''
  const full = url.startsWith('//') ? `https:${url}` : url
  return full.includes('?') ? full : `${full}?param=200y200`
}

function mapArtist(raw: Record<string, unknown>): NeteaseArtistItem | null {
  const id = Number(raw.id)
  if (!id) return null
  const name = String(raw.name ?? (Array.isArray(raw.alias) ? raw.alias[0] : '') ?? '').trim()
  if (!name) return null
  return {
    id,
    name,
    avatar: pickArtistAvatar(raw),
  }
}

function mapPlaylist(raw: Record<string, unknown>): NeteasePlaylistItem | null {
  const id = Number(raw.id)
  if (!id) return null
  const name = String(raw.name ?? '').trim()
  if (!name) return null
  const creator =
    raw.creator && typeof raw.creator === 'object'
      ? String((raw.creator as Record<string, unknown>).nickname ?? '')
      : ''
  return {
    id,
    name,
    cover: coverUrl(raw.coverImgUrl ?? raw.picUrl),
    trackCount: Number(raw.trackCount ?? 0),
    creator: creator || '未知用户',
  }
}

function pickSearchResult(body: Record<string, unknown>): Record<string, unknown> {
  return body.result && typeof body.result === 'object' ? (body.result as Record<string, unknown>) : body
}

/** GET /search?keywords=&type=100 — 歌手搜索 */
export async function searchNeteaseArtists(
  cookie: string,
  keywords: string,
  limit = 10,
): Promise<NeteaseArtistItem[]> {
  const body = await ncmApiGet('/search', cookie, {
    keywords: keywords.trim(),
    type: '100',
    limit: String(limit),
    offset: '0',
  })
  const result = pickSearchResult(body as Record<string, unknown>)
  const artists = Array.isArray(result.artists) ? result.artists : []
  return artists
    .map((a) => (a && typeof a === 'object' ? mapArtist(a as Record<string, unknown>) : null))
    .filter((a): a is NeteaseArtistItem => Boolean(a))
}

/** GET /search?keywords=&type=1000 — 歌单搜索 */
export async function searchNeteasePlaylists(
  cookie: string,
  keywords: string,
  limit = 20,
): Promise<NeteasePlaylistItem[]> {
  const body = await ncmApiGet('/search', cookie, {
    keywords: keywords.trim(),
    type: '1000',
    limit: String(limit),
    offset: '0',
  })
  const result = pickSearchResult(body as Record<string, unknown>)
  const playlists = Array.isArray(result.playlists) ? result.playlists : []
  return playlists
    .map((p) => (p && typeof p === 'object' ? mapPlaylist(p as Record<string, unknown>) : null))
    .filter((p): p is NeteasePlaylistItem => Boolean(p))
}

/** 并行搜索单曲 / 歌手 / 歌单，供综合 Tab 使用 */
export async function searchNeteaseAll(
  cookie: string,
  keywords: string,
  limit = 24,
): Promise<NeteaseSearchBundle> {
  const [songs, artists, playlists] = await Promise.all([
    searchNeteaseSongs(cookie, keywords, limit),
    searchNeteaseArtists(cookie, keywords, Math.min(limit, 12)),
    searchNeteasePlaylists(cookie, keywords, Math.min(limit, 12)),
  ])
  return { songs, artists, playlists }
}

/** GET /top/artists?type=1 — 热门歌手（1 华语 2 欧美 3 韩国 4 日本） */
export async function fetchTopNeteaseArtists(
  cookie: string,
  type = 1,
  limit = 10,
): Promise<NeteaseArtistItem[]> {
  const body = await ncmApiGet('/top/artists', cookie, {
    type: String(type),
    limit: String(limit),
  })
  const artists = Array.isArray(body.artists) ? body.artists : []
  return artists
    .map((a) => (a && typeof a === 'object' ? mapArtist(a as Record<string, unknown>) : null))
    .filter((a): a is NeteaseArtistItem => Boolean(a))
    .slice(0, limit)
}

function stripHtmlText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function normalizeImageKey(url: string): string {
  return url.replace(/^https?:/i, '').split('?')[0]
}

function isSameImageUrl(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeImageKey(a) === normalizeImageKey(b)
}

/** 歌手主页顶部横图（勿用 300y300 方形裁切） */
function artistBannerUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw : ''
  if (!url) return ''
  const full = url.startsWith('//') ? `https:${url}` : url
  if (!full.startsWith('http')) return ''
  if (full.includes('param=')) return full
  return `${full}?param=1080y340`
}

function pickArtistUserBlock(pageData?: Record<string, unknown>): Record<string, unknown> | null {
  const user = pageData?.user
  return user && typeof user === 'object' ? (user as Record<string, unknown>) : null
}

/** 歌手头像：与手机端歌手页一致，优先 avatar / 方形 img1v1，勿用 picUrl（常为 PC 横图封面） */
function pickArtistAvatar(
  raw: Record<string, unknown>,
  pageData?: Record<string, unknown>,
): string {
  const avatarField = raw.avatar
  if (typeof avatarField === 'string' && avatarField.startsWith('http')) {
    return avatarUrl(avatarField)
  }
  if (avatarField && typeof avatarField === 'object') {
    const row = avatarField as Record<string, unknown>
    const nested = avatarUrl(row.imgUrl ?? row.picUrl ?? row.url)
    if (nested) return nested
  }

  const user = pickArtistUserBlock(pageData)
  if (user) {
    const fromUser = avatarUrl(user.avatarUrl ?? user.avatar)
    if (fromUser) return fromUser
  }

  return avatarUrl(
    raw.img1v1Url ?? raw.img1Url ?? raw.picUrl ?? raw.avatarImg ?? raw.coverUrl,
  )
}

/** 歌手页顶部背景：优先手机端用户照片墙 backgroundUrl，artist.cover 多为 PC 端横图 */
function pickArtistCover(
  raw: Record<string, unknown>,
  avatar: string,
  pageData?: Record<string, unknown>,
): string {
  const user = pickArtistUserBlock(pageData)
  if (user) {
    for (const key of ['backgroundUrl', 'backgroundImgUrl'] as const) {
      const u = artistBannerUrl(user[key])
      if (u && !isSameImageUrl(u, avatar)) return u
    }
  }

  for (const key of ['backgroundUrl', 'background', 'artistImg', 'coverImgUrl', 'cover'] as const) {
    const u = artistBannerUrl(raw[key])
    if (u && !isSameImageUrl(u, avatar)) return u
  }
  return ''
}

const IDENTITY_LABEL_BY_CODE: Record<number, string> = {
  1: '歌手',
  2: '作词',
  3: '作曲',
  4: '编曲',
  5: '制作人',
}

function normalizeIdentityLabel(name: string): string {
  const t = name.trim()
  if (!t) return ''
  if (t === '演唱') return '歌手'
  return t
}

function pickArtistIdentities(
  pageData: Record<string, unknown>,
  artistRaw: Record<string, unknown>,
): string[] {
  const tags: string[] = []
  const seen = new Set<string>()

  const add = (raw: string) => {
    const label = normalizeIdentityLabel(raw)
    if (!label || seen.has(label)) return
    seen.add(label)
    tags.push(label)
  }

  const readImageDesc = (block: unknown): string => {
    if (!block || typeof block !== 'object') return ''
    return String((block as Record<string, unknown>).imageDesc ?? '').trim()
  }

  // 与手机端歌手页一致：仅展示 identify.imageDesc，勿合并 secondaryExpertIdentiy（会多出混音/录音等细项）
  const desc =
    readImageDesc(pageData.identify) ||
    readImageDesc(pageData.simpleUserIdentify) ||
    ''
  if (desc) {
    for (const part of desc.split(/[、,，/|]/)) add(part)
    return tags
  }

  const identifyTag = artistRaw.identifyTag
  if (Array.isArray(identifyTag)) {
    for (const item of identifyTag) add(String(item))
    if (tags.length > 0) return tags
  }

  const identities = artistRaw.identities
  if (Array.isArray(identities)) {
    for (const code of identities) {
      if (typeof code === 'string') {
        add(code)
        continue
      }
      const label = IDENTITY_LABEL_BY_CODE[Number(code)]
      if (label) add(label)
    }
  }

  return tags
}

function pickArtistSocialFromRecords(
  pageData: Record<string, unknown>,
  artistRaw: Record<string, unknown>,
): { following: number; followers: number } {
  const followBlock =
    pageData.follow && typeof pageData.follow === 'object'
      ? (pageData.follow as Record<string, unknown>)
      : null

  const following = Number(
    artistRaw.followSize ??
      artistRaw.follows ??
      pageData.followSize ??
      followBlock?.follow ??
      0,
  )
  const followers = Number(
    artistRaw.fans ??
      artistRaw.fanSize ??
      artistRaw.followeds ??
      pageData.fanSize ??
      pageData.fans ??
      followBlock?.followed ??
      followBlock?.fans ??
      0,
  )

  return {
    following: Number.isFinite(following) ? following : 0,
    followers: Number.isFinite(followers) ? followers : 0,
  }
}

async function fetchArtistSocialCounts(
  cookie: string,
  artistId: number,
  pageData: Record<string, unknown>,
  artistRaw: Record<string, unknown>,
): Promise<{ following: number; followers: number }> {
  let { following, followers } = pickArtistSocialFromRecords(pageData, artistRaw)

  try {
    const body = await ncmApiGet('/artist/follow/count', cookie, { id: String(artistId) })
    const row =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : (body as Record<string, unknown>)
    const fanCount = Number(
      row.fansCnt ?? row.followed ?? row.followCount ?? row.count ?? row.fans ?? row.fanCount ?? 0,
    )
    const followCount = Number(
      row.followCnt ?? row.followSize ?? row.follows ?? row.follow ?? 0,
    )
    if (fanCount > 0) followers = fanCount
    if (followCount > 0) following = followCount
  } catch {
    /* 粉丝数接口失败时保留详情内字段 */
  }

  const userBlock = pickArtistUserBlock(pageData)
  const accountId = Number(
    artistRaw.accountId ?? artistRaw.userId ?? userBlock?.userId ?? 0,
  )
  if (accountId > 0 && (following === 0 || followers === 0)) {
    try {
      const body = await ncmApiGet('/user/detail', cookie, { uid: String(accountId) })
      const profile =
        body.profile && typeof body.profile === 'object'
          ? (body.profile as Record<string, unknown>)
          : body.user && typeof body.user === 'object'
            ? (body.user as Record<string, unknown>)
            : null
      if (profile) {
        if (following === 0) following = Number(profile.follows ?? 0)
        if (followers === 0) followers = Number(profile.followeds ?? 0)
      }
    } catch {
      /* 无账号资料时忽略 */
    }
  }

  return { following, followers }
}

function mapArtistDetail(
  artistId: number,
  artistRaw: Record<string, unknown>,
  pageData: Record<string, unknown>,
  social: { following: number; followers: number },
): NeteaseArtistDetail {
  const alias = Array.isArray(artistRaw.alias)
    ? artistRaw.alias.map((a) => String(a).trim()).filter(Boolean)
    : []
  const brief =
    typeof artistRaw.briefDesc === 'string'
      ? stripHtmlText(artistRaw.briefDesc)
      : typeof artistRaw.desc === 'string'
        ? stripHtmlText(artistRaw.desc)
        : ''

  const userBlock = pickArtistUserBlock(pageData)
  const accountUserId = Number(
    artistRaw.accountId ?? artistRaw.userId ?? userBlock?.userId ?? 0,
  )

  const avatar = pickArtistAvatar(artistRaw, pageData)
  return {
    id: artistId,
    name: String(artistRaw.name ?? '未知歌手'),
    avatar,
    cover: pickArtistCover(artistRaw, avatar, pageData),
    briefDesc: brief,
    alias,
    musicSize: Number(artistRaw.musicSize ?? 0),
    albumSize: Number(artistRaw.albumSize ?? 0),
    mvSize: Number(artistRaw.mvSize ?? 0),
    following: social.following,
    followers: social.followers,
    identities: pickArtistIdentities(pageData, artistRaw),
    accountUserId: Number.isFinite(accountUserId) ? accountUserId : 0,
  }
}

function pickArtistTopSongRows(body: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(body.songs)) return body.songs as Record<string, unknown>[]
  const data = body.data
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>
    if (Array.isArray(row.songs)) return row.songs as Record<string, unknown>[]
  }
  return []
}

/** GET /artist/detail?id= — 歌手详情 */
export async function fetchArtistDetail(cookie: string, artistId: number): Promise<NeteaseArtistDetail> {
  if (!artistId) {
    return {
      id: 0,
      name: '未知歌手',
      avatar: '',
      cover: '',
      briefDesc: '',
      alias: [],
      musicSize: 0,
      albumSize: 0,
      mvSize: 0,
      following: 0,
      followers: 0,
      identities: [],
      accountUserId: 0,
    }
  }
  const body = await ncmApiGet('/artist/detail', cookie, { id: String(artistId) })
  const pageData =
    body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : body
  const artistRaw =
    (pageData.artist && typeof pageData.artist === 'object'
      ? (pageData.artist as Record<string, unknown>)
      : null) ??
    (body.artist && typeof body.artist === 'object'
      ? (body.artist as Record<string, unknown>)
      : null) ??
    pageData

  const social = await fetchArtistSocialCounts(cookie, artistId, pageData, artistRaw)
  let detail = mapArtistDetail(artistId, artistRaw, pageData, social)

  if (!detail.avatar || !detail.cover) {
    try {
      const multi = await ncmApiGet('/artists', cookie, { id: String(artistId) })
      const artists = Array.isArray(multi.artists) ? multi.artists : []
      const first = artists[0]
      if (first && typeof first === 'object') {
        const row = first as Record<string, unknown>
        const mapped = mapArtist(first as Record<string, unknown>)
        if (mapped) {
          detail = {
            ...detail,
            avatar: detail.avatar || pickArtistAvatar(row, pageData),
            cover:
              detail.cover ||
              pickArtistCover(row, detail.avatar || pickArtistAvatar(row, pageData), pageData),
          }
        }
      }
    } catch {
      /* 补全失败不阻断 */
    }
  }

  return detail
}

/** GET /artist/top/song?id= — 歌手热门歌曲 */
export async function fetchArtistTopSongs(cookie: string, artistId: number): Promise<NeteaseSongItem[]> {
  if (!artistId) return []

  let rows: Record<string, unknown>[] = []
  try {
    const body = await ncmApiGet('/artist/top/song', cookie, { id: String(artistId) })
    rows = pickArtistTopSongRows(body as Record<string, unknown>)
  } catch {
    rows = []
  }

  if (rows.length === 0) {
    try {
      const fallback = await ncmApiGet('/artist/songs', cookie, {
        id: String(artistId),
        order: 'hot',
        limit: '50',
      })
      rows = pickSongsFromBody(fallback as Record<string, unknown>)
      if (rows.length === 0) {
        rows = pickArtistTopSongRows(fallback as Record<string, unknown>)
      }
    } catch {
      rows = []
    }
  }

  const mapped = rows
    .map((s) => mapSong(s))
    .filter((s): s is NeteaseSongItem => Boolean(s))

  const needEnrich = mapped.some((s) => !s.cover.trim())
  if (!needEnrich) return mapped

  try {
    return await enrichSongsWithDetailCovers(cookie, mapped)
  } catch {
    return mapped
  }
}

function mapAlbum(raw: Record<string, unknown>): NeteaseAlbumItem | null {
  const id = Number(raw.id)
  if (!id) return null
  const name = String(raw.name ?? '').trim()
  if (!name) return null
  const artist =
    raw.artist && typeof raw.artist === 'object'
      ? String((raw.artist as Record<string, unknown>).name ?? '')
      : ''
  return {
    id,
    name,
    cover: coverUrl(raw.picUrl ?? raw.coverImgUrl),
    trackCount: Number(raw.size ?? raw.trackCount ?? 0),
    publishTime: Number(raw.publishTime ?? 0),
    artistName: artist,
  }
}

function mapArtistEvent(raw: Record<string, unknown>): NeteaseArtistNote | null {
  const id = Number(raw.id)
  if (!id) return null

  let text = ''
  if (typeof raw.json === 'string' && raw.json.trim()) {
    try {
      const parsed = JSON.parse(raw.json) as { msg?: string; title?: string }
      text = String(parsed.msg ?? parsed.title ?? '').trim()
    } catch {
      text = ''
    }
  }

  const pics = Array.isArray(raw.pics) ? raw.pics : []
  const images = pics
    .map((pic) => {
      if (!pic || typeof pic !== 'object') return ''
      const row = pic as Record<string, unknown>
      return coverUrl(row.originUrl ?? row.squareUrl ?? row.rectangleUrl)
    })
    .filter(Boolean)

  if (!text && images.length === 0) return null

  const info =
    raw.info && typeof raw.info === 'object'
      ? (raw.info as Record<string, unknown>)
      : raw
  const commentThread =
    info.commentThread && typeof info.commentThread === 'object'
      ? (info.commentThread as Record<string, unknown>)
      : null

  return {
    id,
    threadId: String(raw.threadId ?? info.threadId ?? commentThread?.id ?? ''),
    time: Number(raw.showTime ?? raw.eventTime ?? 0),
    text,
    images,
    likedCount: Number(info.likedCount ?? 0),
    commentCount: Number(info.commentCount ?? 0),
  }
}

function pickCoArtistsFromSongs(
  artistId: number,
  rows: Record<string, unknown>[],
  limit = 12,
): NeteaseArtistItem[] {
  const byId = new Map<number, NeteaseArtistItem>()
  for (const row of rows) {
    const artists = Array.isArray(row.ar)
      ? row.ar
      : Array.isArray(row.artists)
        ? row.artists
        : []
    for (const item of artists) {
      if (!item || typeof item !== 'object') continue
      const mapped = mapArtist(item as Record<string, unknown>)
      if (!mapped || mapped.id === artistId || byId.has(mapped.id)) continue
      byId.set(mapped.id, mapped)
      if (byId.size >= limit) break
    }
    if (byId.size >= limit) break
  }
  return [...byId.values()]
}

function pickArtistRawFromArtistsBody(body: Record<string, unknown>): Record<string, unknown> | null {
  if (body.artist && typeof body.artist === 'object') {
    return body.artist as Record<string, unknown>
  }
  const artists = Array.isArray(body.artists) ? body.artists : []
  const first = artists[0]
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
}

/** 歌曲 ar 里常缺头像，用 /artists?id= 逐个补全 */
async function enrichNeteaseArtists(
  cookie: string,
  artists: NeteaseArtistItem[],
): Promise<NeteaseArtistItem[]> {
  const need = artists.filter((a) => !a.avatar.trim())
  if (need.length === 0) return artists

  const avatarById = new Map<number, string>()
  await Promise.all(
    need.map(async (artist) => {
      try {
        const body = await ncmApiGet('/artists', cookie, { id: String(artist.id) })
        const raw = pickArtistRawFromArtistsBody(body as Record<string, unknown>)
        if (!raw) return
        const avatar = pickArtistAvatar(raw)
        if (avatar) avatarById.set(artist.id, avatar)
      } catch {
        /* 单个补全失败不阻断 */
      }
    }),
  )

  return artists.map((artist) => {
    const avatar = avatarById.get(artist.id)
    return avatar ? { ...artist, avatar } : artist
  })
}

/** GET /artist/songs?id= — 歌手全部歌曲（分页） */
export async function fetchArtistSongsPage(
  cookie: string,
  artistId: number,
  options?: { offset?: number; limit?: number; order?: 'hot' | 'time' },
): Promise<{ songs: NeteaseSongItem[]; more: boolean }> {
  if (!artistId) return { songs: [], more: false }
  const offset = options?.offset ?? 0
  const limit = options?.limit ?? 50
  const order = options?.order ?? 'hot'

  const body = await ncmApiGet('/artist/songs', cookie, {
    id: String(artistId),
    order,
    limit: String(limit),
    offset: String(offset),
  })
  const rows = pickSongsFromBody(body as Record<string, unknown>)
  const mapped = rows
    .map((s) => mapSong(s))
    .filter((s): s is NeteaseSongItem => Boolean(s))
  const songs = await enrichSongsWithDetailCovers(cookie, mapped)
  const more = Boolean((body as Record<string, unknown>).more)
  return { songs, more }
}

/** GET /artist/album?id= — 歌手专辑（分页） */
export async function fetchArtistAlbumsPage(
  cookie: string,
  artistId: number,
  options?: { offset?: number; limit?: number },
): Promise<{ albums: NeteaseAlbumItem[]; more: boolean }> {
  if (!artistId) return { albums: [], more: false }
  const offset = options?.offset ?? 0
  const limit = options?.limit ?? 30

  const body = await ncmApiGet('/artist/album', cookie, {
    id: String(artistId),
    limit: String(limit),
    offset: String(offset),
  })
  const hotAlbums = Array.isArray(body.hotAlbums) ? body.hotAlbums : []
  const albums = hotAlbums
    .map((a) => (a && typeof a === 'object' ? mapAlbum(a as Record<string, unknown>) : null))
    .filter((a): a is NeteaseAlbumItem => Boolean(a))
  return { albums, more: Boolean(body.more) }
}

/** 从热门歌曲中提取合作歌手 */
export async function fetchArtistPartners(
  cookie: string,
  artistId: number,
  limit = 12,
): Promise<NeteaseArtistItem[]> {
  if (!artistId) return []
  try {
    const body = await ncmApiGet('/artist/songs', cookie, {
      id: String(artistId),
      order: 'hot',
      limit: '50',
      offset: '0',
    })
    const rows = pickSongsFromBody(body as Record<string, unknown>)
    const partners = pickCoArtistsFromSongs(artistId, rows, limit)
    return enrichNeteaseArtists(cookie, partners)
  } catch {
    return []
  }
}

/** GET /user/event?uid= — 歌手笔记（绑定用户动态） */
export async function fetchArtistNotes(
  cookie: string,
  userId: number,
  limit = 20,
): Promise<NeteaseArtistNote[]> {
  if (!userId) return []
  const body = await ncmApiGet('/user/event', cookie, {
    uid: String(userId),
    limit: String(limit),
    timestamp: String(Date.now()),
  })
  const events = Array.isArray(body.events) ? body.events : []
  return events
    .map((e) => (e && typeof e === 'object' ? mapArtistEvent(e as Record<string, unknown>) : null))
    .filter((n): n is NeteaseArtistNote => Boolean(n))
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

const COVER_ENRICH_BATCH = 50

async function enrichSongsWithDetailCovers(
  cookie: string,
  songs: NeteaseSongItem[],
): Promise<NeteaseSongItem[]> {
  const needIds = [...new Set(songs.filter((s) => !s.cover.trim()).map((s) => s.id))]
  if (needIds.length === 0) return songs

  const byId = new Map<number, NeteaseSongItem>()
  for (let i = 0; i < needIds.length; i += COVER_ENRICH_BATCH) {
    const batch = needIds.slice(i, i + COVER_ENRICH_BATCH)
    try {
      const detailed = await fetchNeteaseSongDetails(cookie, batch)
      for (const row of detailed) {
        if (row.cover.trim()) byId.set(row.id, row)
      }
    } catch {
      /* 单批失败不阻断其余 */
    }
  }

  if (byId.size === 0) return songs
  return songs.map((s) => {
    const d = byId.get(s.id)
    if (!d?.cover) return s
    return {
      ...s,
      cover: d.cover,
      name: s.name === '未知歌曲' ? d.name : s.name,
      artist: s.artist === '未知歌手' ? d.artist : s.artist,
    }
  })
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
  const result = pickSearchResult(body as Record<string, unknown>)
  const songs = Array.isArray(result.songs) ? result.songs : []
  const mapped = songs
    .map((s) => (s && typeof s === 'object' ? mapSong(s as Record<string, unknown>) : null))
    .filter((s): s is NeteaseSongItem => Boolean(s))
  return enrichSongsWithDetailCovers(cookie, mapped)
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

export type PlaylistCreator = {
  id: number
  nickname: string
  avatar: string
}

export type PlaylistMeta = {
  id: number
  title: string
  cover: string
  count: number
  description: string
  creator: PlaylistCreator
  subscribed: boolean
  playCount: number
  commentCount: number
  shareCount: number
  createTime: number
  tags: string[]
}

const EMPTY_PLAYLIST_META: Omit<PlaylistMeta, 'id'> = {
  title: '歌单',
  cover: '',
  count: 0,
  description: '',
  creator: { id: 0, nickname: '未知用户', avatar: '' },
  subscribed: false,
  playCount: 0,
  commentCount: 0,
  shareCount: 0,
  createTime: 0,
  tags: [],
}

function mapPlaylistCreator(raw: unknown): PlaylistCreator {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_PLAYLIST_META.creator
  }
  const row = raw as Record<string, unknown>
  return {
    id: Number(row.userId ?? row.id ?? 0),
    nickname: String(row.nickname ?? '未知用户'),
    avatar: coverUrl(row.avatarUrl ?? row.avatar),
  }
}

function mapPlaylistDetail(playlistId: number, playlist: Record<string, unknown>): PlaylistMeta {
  const tagsRaw = Array.isArray(playlist.tags) ? playlist.tags : []
  const tags = tagsRaw
    .map((tag) => {
      if (typeof tag === 'string') return tag.trim()
      if (tag && typeof tag === 'object') {
        return String((tag as Record<string, unknown>).name ?? '').trim()
      }
      return ''
    })
    .filter(Boolean)

  return {
    id: playlistId,
    title: String(playlist.name ?? '歌单'),
    cover: coverUrl(playlist.coverImgUrl),
    count: Number(playlist.trackCount ?? 0),
    description: typeof playlist.description === 'string' ? playlist.description : '',
    creator: mapPlaylistCreator(playlist.creator),
    subscribed: Boolean(playlist.subscribed),
    playCount: Number(playlist.playCount ?? 0),
    commentCount: Number(playlist.commentCount ?? 0),
    shareCount: Number(playlist.shareCount ?? 0),
    createTime: Number(playlist.createTime ?? 0),
    tags,
  }
}

/** GET /playlist/detail?id= — 歌单元信息 */
export async function fetchPlaylistMeta(cookie: string, playlistId: number): Promise<PlaylistMeta> {
  if (!playlistId) {
    return { id: 0, ...EMPTY_PLAYLIST_META }
  }
  const body = await ncmApiGet('/playlist/detail', cookie, { id: String(playlistId) })
  const playlist =
    body.playlist && typeof body.playlist === 'object'
      ? (body.playlist as Record<string, unknown>)
      : null
  if (!playlist) {
    return { id: playlistId, ...EMPTY_PLAYLIST_META }
  }
  return mapPlaylistDetail(playlistId, playlist)
}

/** GET /album?id= — 专辑详情与曲目 */
export async function fetchAlbumDetail(
  cookie: string,
  albumId: number,
): Promise<{ meta: PlaylistMeta; songs: NeteaseSongItem[] }> {
  if (!albumId) {
    return { meta: { id: 0, ...EMPTY_PLAYLIST_META, title: '专辑' }, songs: [] }
  }
  const body = await ncmApiGet('/album', cookie, { id: String(albumId) })
  const albumRaw =
    body.album && typeof body.album === 'object'
      ? (body.album as Record<string, unknown>)
      : null
  if (!albumRaw) {
    return { meta: { id: albumId, ...EMPTY_PLAYLIST_META, title: '专辑' }, songs: [] }
  }

  const songsRaw = Array.isArray(body.songs) ? body.songs : []
  let songs = songsRaw
    .map((s) => mapSong(s as Record<string, unknown>))
    .filter((s): s is NeteaseSongItem => Boolean(s))

  if (songs.length > 0) {
    try {
      songs = await enrichSongsWithDetailCovers(cookie, songs)
    } catch {
      /* 保留基础字段 */
    }
  }

  const artistRaw =
    albumRaw.artist && typeof albumRaw.artist === 'object'
      ? (albumRaw.artist as Record<string, unknown>)
      : null

  const meta: PlaylistMeta = {
    id: albumId,
    title: String(albumRaw.name ?? '专辑'),
    cover: coverUrl(albumRaw.picUrl ?? albumRaw.coverImgUrl),
    count: songs.length || Number(albumRaw.size ?? 0),
    description: typeof albumRaw.description === 'string' ? albumRaw.description : '',
    creator: artistRaw
      ? {
          id: Number(artistRaw.id ?? 0),
          nickname: String(artistRaw.name ?? '未知歌手'),
          avatar: coverUrl(artistRaw.img1v1Url ?? artistRaw.picUrl),
        }
      : { id: 0, nickname: '未知歌手', avatar: '' },
    subscribed: false,
    playCount: 0,
    commentCount: 0,
    shareCount: 0,
    createTime: Number(albumRaw.publishTime ?? 0),
    tags: [],
  }

  return { meta, songs }
}

/** GET /playlist/subscribe?id=&t= — 收藏/取消收藏歌单（t=1 收藏，t=2 取消） */
export async function subscribeNeteasePlaylist(
  cookie: string,
  playlistId: number,
  subscribe: boolean,
): Promise<void> {
  if (!playlistId) throw new Error('无效歌单')
  const body = await ncmApiGet('/playlist/subscribe', cookie, {
    id: String(playlistId),
    t: subscribe ? '1' : '2',
  })
  const code = Number(body.code)
  if (code !== 200) {
    throw new Error(typeof body.message === 'string' && body.message ? body.message : '收藏歌单失败')
  }
}

/** GET /comment/playlist?id= — 歌单评论 */
export async function fetchPlaylistComments(
  cookie: string,
  playlistId: number,
  limit = 30,
  offset = 0,
): Promise<SongCommentsPage> {
  if (!playlistId) {
    return { hot: [], items: [], total: 0, more: false }
  }
  const body = await ncmApiGet('/comment/playlist', cookie, {
    id: String(playlistId),
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

/** GET /comment/event?threadId= — 动态/笔记评论 */
export async function fetchEventComments(
  cookie: string,
  threadId: string,
  limit = 30,
  offset = 0,
): Promise<SongCommentsPage> {
  if (!threadId) {
    return { hot: [], items: [], total: 0, more: false }
  }
  const body = await ncmApiGet('/comment/event', cookie, {
    threadId,
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
