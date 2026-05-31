import { ncmApiGet } from './neteaseApiClient'
import { fetchNeteaseSongDetails, type NeteaseSongItem } from './neteaseMusicApi'
import type { NeteasePlaylistItem } from './neteaseProfileApi'

function coverUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw : ''
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url.includes('?') ? url : `${url}?param=300y300`
}

/** 从对象常见字段提取封面 URL（首页 block 字段不统一） */
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
  const fromAl = coverUrl(al?.picUrl)
  if (fromAl) return fromAl

  const image = row.image
  if (typeof image === 'string') return coverUrl(image)
  if (image && typeof image === 'object') {
    const img = image as Record<string, unknown>
    const u = coverUrl(img.imageUrl ?? img.picUrl ?? img.url)
    if (u) return u
    if (Array.isArray(img.urls)) {
      for (const item of img.urls) {
        const nested = coverUrl(item)
        if (nested) return nested
      }
    }
  }
  return ''
}

function uiTitle(ui: unknown): string {
  if (!ui || typeof ui !== 'object') return ''
  const row = ui as Record<string, unknown>
  const main = row.mainTitle
  if (main && typeof main === 'object') {
    const title = (main as Record<string, unknown>).title
    if (typeof title === 'string' && title.trim()) return title.trim()
  }
  return ''
}

function uiSubTitle(ui: unknown): string {
  if (!ui || typeof ui !== 'object') return ''
  const row = ui as Record<string, unknown>
  const sub = row.subTitle
  if (sub && typeof sub === 'object') {
    const title = (sub as Record<string, unknown>).title
    if (typeof title === 'string' && title.trim()) return title.trim()
  }
  return ''
}

function uiImage(ui: unknown): string {
  return pickCoverFromRecord(
    ui && typeof ui === 'object' ? (ui as Record<string, unknown>) : null,
  )
}

function mapSongRow(raw: Record<string, unknown>): NeteaseSongItem | null {
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

function mergeSongCover(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const u = c?.trim()
    if (u) return u
  }
  return ''
}

function mapSongFromResource(
  resource: Record<string, unknown>,
  creative?: Record<string, unknown>,
): NeteaseSongItem | null {
  const ext =
    resource.resourceExtInfo && typeof resource.resourceExtInfo === 'object'
      ? (resource.resourceExtInfo as Record<string, unknown>)
      : null
  let song: NeteaseSongItem | null = null
  for (const key of ['songData', 'song', 'data'] as const) {
    const nested = ext?.[key] ?? resource[key]
    if (nested && typeof nested === 'object') {
      const mapped = mapSongRow(nested as Record<string, unknown>)
      if (mapped) {
        song = mapped
        break
      }
    }
  }
  const id = Number(resource.resourceId) || song?.id
  if (!id) return null

  const cover = mergeSongCover(
    song?.cover,
    pickCoverFromRecord(resource),
    pickCoverFromRecord(ext ?? undefined),
    uiImage(resource.uiElement),
    creative ? uiImage(creative.uiElement) : '',
    creative ? pickCoverFromRecord(creative) : '',
  )

  if (song) {
    return { ...song, id, cover: cover || song.cover }
  }

  const name = uiTitle(resource.uiElement) || uiTitle(creative?.uiElement)
  const artist = uiSubTitle(resource.uiElement) || uiSubTitle(creative?.uiElement)
  if (name) {
    return { id, name, artist: artist || '未知歌手', cover }
  }
  return { id, name: '未知歌曲', artist: '未知歌手', cover }
}

function mapPlaylistFromResource(
  resource: Record<string, unknown>,
  creative?: Record<string, unknown>,
): NeteasePlaylistItem | null {
  const id = Number(resource.resourceId)
  if (!id) return null
  const ext =
    resource.resourceExtInfo && typeof resource.resourceExtInfo === 'object'
      ? (resource.resourceExtInfo as Record<string, unknown>)
      : null
  for (const key of ['playlistData', 'playlist', 'data'] as const) {
    const nested = ext?.[key] ?? resource[key]
    if (nested && typeof nested === 'object') {
      const row = nested as Record<string, unknown>
      return {
        id,
        title: String(row.name ?? row.title ?? uiTitle(resource.uiElement) ?? '歌单'),
        count: Number(row.trackCount ?? row.songCount ?? 0),
        cover: mergeSongCover(
          pickCoverFromRecord(row),
          uiImage(resource.uiElement),
          creative ? uiImage(creative.uiElement) : '',
        ),
      }
    }
  }
  const title = uiTitle(resource.uiElement) || uiTitle(creative?.uiElement)
  if (title) {
    return {
      id,
      title,
      count: 0,
      cover: mergeSongCover(
        uiImage(resource.uiElement),
        creative ? uiImage(creative.uiElement) : '',
        pickCoverFromRecord(resource),
      ),
    }
  }
  return null
}

function mapPlaylistRow(raw: Record<string, unknown>): NeteasePlaylistItem | null {
  const id = Number(raw.id)
  if (!id) return null
  return {
    id,
    title: String(raw.name ?? '歌单'),
    count: Number(raw.trackCount ?? 0),
    cover: mergeSongCover(pickCoverFromRecord(raw)),
  }
}

export type NeteaseHomeBanner = {
  id: number
  title: string
  cover: string
  /** playlist | song | url */
  targetType: 'playlist' | 'song' | 'url' | 'unknown'
  targetId: number
  url: string
}

export type NeteaseHomeSection = {
  id: string
  title: string
  songs: NeteaseSongItem[]
  playlists: NeteasePlaylistItem[]
}

export type NeteaseHomeFeed = {
  banners: NeteaseHomeBanner[]
  sections: NeteaseHomeSection[]
}

async function ncmApiGetOptional(
  path: string,
  cookie: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  try {
    return await ncmApiGet(path, cookie, params)
  } catch {
    return null
  }
}

function parseHomepageBlocks(body: Record<string, unknown>): NeteaseHomeSection[] {
  const data =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body
  const blocks = Array.isArray(data.blocks) ? data.blocks : []
  const sections: NeteaseHomeSection[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (!block || typeof block !== 'object') continue
    const row = block as Record<string, unknown>
    const blockCode = String(row.blockCode ?? '')
    if (blockCode.includes('DRAGON_BALL') || blockCode.includes('VOICELIST')) continue

    const songs: NeteaseSongItem[] = []
    const playlists: NeteasePlaylistItem[] = []
    const creatives = Array.isArray(row.creatives) ? row.creatives : []

    for (const creative of creatives) {
      if (!creative || typeof creative !== 'object') continue
      const creativeRow = creative as Record<string, unknown>
      const resources = Array.isArray(creativeRow.resources)
        ? (creativeRow.resources as unknown[])
        : []
      for (const res of resources) {
        if (!res || typeof res !== 'object') continue
        const resource = res as Record<string, unknown>
        const type = String(resource.resourceType ?? '').toLowerCase()
        if (type === 'song') {
          const song = mapSongFromResource(resource, creativeRow)
          if (song) songs.push(song)
        } else if (type === 'playlist') {
          const pl = mapPlaylistFromResource(resource, creativeRow)
          if (pl) playlists.push(pl)
        }
      }
    }

    if (songs.length === 0 && playlists.length === 0) continue

    const title =
      (typeof row.showName === 'string' && row.showName.trim()) ||
      uiTitle(row.uiElement) ||
      blockTitleFromCode(blockCode)

    sections.push({
      id: blockCode || `block-${i}`,
      title,
      songs: dedupeSongs(songs).slice(0, 12),
      playlists: dedupePlaylists(playlists).slice(0, 8),
    })
    if (sections.length >= 8) break
  }

  return sections
}

function blockTitleFromCode(code: string): string {
  if (code.includes('SONG')) return '推荐歌曲'
  if (code.includes('PLAYLIST')) return '推荐歌单'
  if (code.includes('NEW')) return '新歌新碟'
  if (code.includes('STYLE')) return '风格推荐'
  return '为你推荐'
}

function dedupeSongs(songs: NeteaseSongItem[]): NeteaseSongItem[] {
  const seen = new Set<number>()
  const out: NeteaseSongItem[] = []
  for (const s of songs) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s)
  }
  return out
}

function dedupePlaylists(playlists: NeteasePlaylistItem[]): NeteasePlaylistItem[] {
  const seen = new Set<number>()
  const out: NeteasePlaylistItem[] = []
  for (const p of playlists) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

function parseBanners(body: Record<string, unknown>): NeteaseHomeBanner[] {
  const banners = Array.isArray(body.banners) ? body.banners : []
  const out: NeteaseHomeBanner[] = []
  for (const raw of banners) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const id = Number(row.bannerId ?? row.id)
    if (!id) continue
    const targetTypeRaw = Number(row.targetType)
    let targetType: NeteaseHomeBanner['targetType'] = 'unknown'
    if (targetTypeRaw === 1000) targetType = 'song'
    else if (targetTypeRaw === 1001) targetType = 'playlist'
    else if (typeof row.url === 'string' && row.url) targetType = 'url'
    out.push({
      id,
      title: String(row.typeTitle ?? row.title ?? ''),
      cover: coverUrl(row.pic ?? row.imageUrl),
      targetType,
      targetId: Number(row.targetId ?? 0),
      url: typeof row.url === 'string' ? row.url : '',
    })
  }
  return out.slice(0, 8)
}

function parseRecommendSongs(body: Record<string, unknown>): NeteaseSongItem[] {
  const data =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body
  const daily = Array.isArray(data.dailySongs) ? data.dailySongs : []
  const songs: NeteaseSongItem[] = []
  for (const item of daily) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const nested = row.song ?? row
    if (nested && typeof nested === 'object') {
      const mapped = mapSongRow(nested as Record<string, unknown>)
      if (mapped) songs.push(mapped)
    }
  }
  return dedupeSongs(songs)
}

function parsePersonalizedPlaylists(body: Record<string, unknown>): NeteasePlaylistItem[] {
  const result = Array.isArray(body.result) ? body.result : []
  const playlists: NeteasePlaylistItem[] = []
  for (const item of result) {
    if (!item || typeof item !== 'object') continue
    const mapped = mapPlaylistRow(item as Record<string, unknown>)
    if (mapped) playlists.push(mapped)
  }
  return dedupePlaylists(playlists)
}

function mergeSections(base: NeteaseHomeSection[], extra: NeteaseHomeSection[]): NeteaseHomeSection[] {
  const seen = new Set(base.map((s) => s.id))
  const out = [...base]
  for (const section of extra) {
    if (seen.has(section.id)) continue
    seen.add(section.id)
    out.push(section)
  }
  return out
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

async function enrichHomeFeedCovers(
  cookie: string,
  feed: NeteaseHomeFeed,
): Promise<NeteaseHomeFeed> {
  const sections: NeteaseHomeSection[] = []
  for (const section of feed.sections) {
    const songs = await enrichSongsWithDetailCovers(cookie, section.songs)
    sections.push({ ...section, songs })
  }
  return { ...feed, sections }
}

export type FetchNeteaseHomeFeedOptions = {
  refresh?: boolean
}

/** 首页发现：/homepage/block/page + banner + 日推/推荐歌单补全 */
export async function fetchNeteaseHomeFeed(
  cookie: string,
  options?: FetchNeteaseHomeFeedOptions,
): Promise<NeteaseHomeFeed> {
  const refresh = options?.refresh ? 'true' : 'false'

  const [blockBody, bannerBody, dailyBody, personalizedBody] = await Promise.all([
    ncmApiGetOptional('/homepage/block/page', cookie, { refresh }),
    ncmApiGetOptional('/banner', cookie, { type: '2' }),
    cookie.trim() ? ncmApiGetOptional('/recommend/songs', cookie) : Promise.resolve(null),
    ncmApiGetOptional('/personalized', cookie, { limit: '8' }),
  ])

  const banners = bannerBody ? parseBanners(bannerBody) : []
  let sections = blockBody ? parseHomepageBlocks(blockBody) : []

  const extras: NeteaseHomeSection[] = []
  if (dailyBody) {
    const dailySongs = parseRecommendSongs(dailyBody)
    if (dailySongs.length > 0) {
      extras.push({ id: 'daily-recommend', title: '每日推荐', songs: dailySongs, playlists: [] })
    }
  }
  if (personalizedBody) {
    const playlists = parsePersonalizedPlaylists(personalizedBody)
    if (playlists.length > 0) {
      extras.push({ id: 'personalized-playlists', title: '推荐歌单', songs: [], playlists })
    }
  }

  sections = mergeSections(extras, sections)

  const feed: NeteaseHomeFeed = { banners, sections: sections.slice(0, 10) }
  return enrichHomeFeedCovers(cookie, feed)
}
