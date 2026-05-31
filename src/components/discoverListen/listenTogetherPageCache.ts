import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { NeteaseHomeFeed } from './neteaseHomeApi'
import type { NeteaseToplistChart } from './neteaseToplistApi'
import type {
  NeteaseAlbumItem,
  NeteaseArtistDetail,
  NeteaseArtistItem,
  NeteaseArtistNote,
  NeteaseSearchBundle,
  NeteaseSongItem,
} from './neteaseMusicApi'

export const LISTEN_TOGETHER_HOME_FEED_CACHE_KV_KEY = 'listen-together-home-feed-v1'
export const LISTEN_TOGETHER_TOPLISTS_CACHE_KV_KEY = 'listen-together-toplists-v1'
export const LISTEN_TOGETHER_FEATURED_ARTISTS_CACHE_KV_KEY = 'listen-together-featured-artists-v1'
export const LISTEN_TOGETHER_SEARCH_RESULTS_CACHE_KV_KEY = 'listen-together-search-results-v1'
export const LISTEN_TOGETHER_ARTIST_PAGE_CACHE_KV_KEY = 'listen-together-artist-page-v1'

const MAX_SEARCH_CACHE_ENTRIES = 32
const MAX_ARTIST_CACHE_ENTRIES = 24

export type CachedHomeFeed = {
  dayKey: string
  feed: NeteaseHomeFeed
  updatedAt: number
}

export type CachedToplists = {
  charts: NeteaseToplistChart[]
  updatedAt: number
}

export type CachedFeaturedArtists = {
  artists: NeteaseArtistItem[]
  updatedAt: number
}

export type SearchResultTab = 'all' | 'songs' | 'playlists' | 'artists'

export type CachedSearchResult = {
  query: string
  tab: SearchResultTab
  bundle: NeteaseSearchBundle
  updatedAt: number
}

export type CachedArtistPage = {
  artistId: number
  detail: NeteaseArtistDetail | null
  hotSongs: NeteaseSongItem[]
  partners: NeteaseArtistItem[]
  allSongs?: NeteaseSongItem[]
  albums?: NeteaseAlbumItem[]
  notes?: NeteaseArtistNote[]
  songsMore?: boolean
  albumsMore?: boolean
  updatedAt: number
}

function todayDayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

function searchCacheKey(query: string, tab: SearchResultTab): string {
  return `${tab}:${normalizeSearchQuery(query)}`
}

function trimRecordByUpdatedAt<T extends { updatedAt: number }>(
  store: Record<string, T>,
  max: number,
): Record<string, T> {
  const entries = Object.entries(store).sort((a, b) => b[1].updatedAt - a[1].updatedAt)
  if (entries.length <= max) return store
  const next: Record<string, T> = {}
  for (const [key, value] of entries.slice(0, max)) {
    next[key] = value
  }
  return next
}

// —— 首页推荐（按自然日）——

let homeFeedMemory: CachedHomeFeed | null = null
let homeFeedHydrated = false

async function hydrateHomeFeed(): Promise<void> {
  if (homeFeedHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_HOME_FEED_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as CachedHomeFeed
    if (row.dayKey && row.feed) homeFeedMemory = row
  }
  homeFeedHydrated = true
}

export async function getCachedHomeFeed(): Promise<NeteaseHomeFeed | null> {
  await hydrateHomeFeed()
  if (!homeFeedMemory || homeFeedMemory.dayKey !== todayDayKey()) return null
  const { feed } = homeFeedMemory
  if (feed.banners.length === 0 && feed.sections.length === 0) return null
  return feed
}

export async function saveCachedHomeFeed(feed: NeteaseHomeFeed): Promise<void> {
  if (feed.banners.length === 0 && feed.sections.length === 0) return
  await hydrateHomeFeed()
  homeFeedMemory = { dayKey: todayDayKey(), feed, updatedAt: Date.now() }
  await personaDb.setPhoneKv(LISTEN_TOGETHER_HOME_FEED_CACHE_KV_KEY, homeFeedMemory)
}

export async function clearCachedHomeFeed(): Promise<void> {
  await hydrateHomeFeed()
  homeFeedMemory = null
  homeFeedHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_HOME_FEED_CACHE_KV_KEY)
}

// —— 排行榜 ——

let toplistsMemory: CachedToplists | null = null
let toplistsHydrated = false

async function hydrateToplists(): Promise<void> {
  if (toplistsHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_TOPLISTS_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as CachedToplists
    if (Array.isArray(row.charts) && row.charts.length > 0) toplistsMemory = row
  }
  toplistsHydrated = true
}

export async function getCachedToplists(): Promise<NeteaseToplistChart[] | null> {
  await hydrateToplists()
  return toplistsMemory?.charts.length ? toplistsMemory.charts : null
}

export async function saveCachedToplists(charts: NeteaseToplistChart[]): Promise<void> {
  if (charts.length === 0) return
  await hydrateToplists()
  toplistsMemory = { charts, updatedAt: Date.now() }
  await personaDb.setPhoneKv(LISTEN_TOGETHER_TOPLISTS_CACHE_KV_KEY, toplistsMemory)
}

export async function clearCachedToplists(): Promise<void> {
  await hydrateToplists()
  toplistsMemory = null
  toplistsHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_TOPLISTS_CACHE_KV_KEY)
}

// —— 推荐歌手 ——

let featuredArtistsMemory: CachedFeaturedArtists | null = null
let featuredArtistsHydrated = false

async function hydrateFeaturedArtists(): Promise<void> {
  if (featuredArtistsHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_FEATURED_ARTISTS_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as CachedFeaturedArtists
    if (Array.isArray(row.artists) && row.artists.length > 0) featuredArtistsMemory = row
  }
  featuredArtistsHydrated = true
}

export async function getCachedFeaturedArtists(): Promise<NeteaseArtistItem[] | null> {
  await hydrateFeaturedArtists()
  return featuredArtistsMemory?.artists.length ? featuredArtistsMemory.artists : null
}

export async function saveCachedFeaturedArtists(artists: NeteaseArtistItem[]): Promise<void> {
  if (artists.length === 0) return
  await hydrateFeaturedArtists()
  featuredArtistsMemory = { artists, updatedAt: Date.now() }
  await personaDb.setPhoneKv(LISTEN_TOGETHER_FEATURED_ARTISTS_CACHE_KV_KEY, featuredArtistsMemory)
}

export async function clearCachedFeaturedArtists(): Promise<void> {
  await hydrateFeaturedArtists()
  featuredArtistsMemory = null
  featuredArtistsHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_FEATURED_ARTISTS_CACHE_KV_KEY)
}

// —— 搜索结果 ——

const searchMemory = new Map<string, CachedSearchResult>()
let searchHydrated = false

async function hydrateSearchResults(): Promise<void> {
  if (searchHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_SEARCH_RESULTS_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, CachedSearchResult>)) {
      if (entry?.query && entry.bundle) searchMemory.set(searchCacheKey(entry.query, entry.tab), entry)
    }
  }
  searchHydrated = true
}

function searchMemoryToStore(): Record<string, CachedSearchResult> {
  const store: Record<string, CachedSearchResult> = {}
  for (const [key, entry] of searchMemory.entries()) {
    store[key] = entry
  }
  return trimRecordByUpdatedAt(store, MAX_SEARCH_CACHE_ENTRIES)
}

async function persistSearchStore(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_SEARCH_RESULTS_CACHE_KV_KEY, searchMemoryToStore())
}

export async function getCachedSearchResult(
  query: string,
  tab: SearchResultTab,
): Promise<NeteaseSearchBundle | null> {
  const q = query.trim()
  if (!q) return null
  await hydrateSearchResults()
  const hit = searchMemory.get(searchCacheKey(q, tab))
  return hit?.bundle ?? null
}

export async function saveCachedSearchResult(
  query: string,
  tab: SearchResultTab,
  bundle: NeteaseSearchBundle,
): Promise<void> {
  const q = query.trim()
  if (!q) return
  const hasData =
    bundle.songs.length > 0 || bundle.artists.length > 0 || bundle.playlists.length > 0
  if (!hasData) return
  await hydrateSearchResults()
  const key = searchCacheKey(q, tab)
  const prev = searchMemory.get(key)
  const merged: NeteaseSearchBundle = prev
    ? {
        songs: tab === 'songs' || tab === 'all' ? bundle.songs : prev.bundle.songs,
        artists: tab === 'artists' || tab === 'all' ? bundle.artists : prev.bundle.artists,
        playlists:
          tab === 'playlists' || tab === 'all' ? bundle.playlists : prev.bundle.playlists,
      }
    : bundle
  searchMemory.set(key, { query: q, tab, bundle: merged, updatedAt: Date.now() })
  await persistSearchStore()
}

export async function clearCachedSearchResults(): Promise<void> {
  await hydrateSearchResults()
  searchMemory.clear()
  searchHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_SEARCH_RESULTS_CACHE_KV_KEY)
}

// —— 歌手页 ——

const artistPageMemory = new Map<number, CachedArtistPage>()
let artistPageHydrated = false

async function hydrateArtistPages(): Promise<void> {
  if (artistPageHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_ARTIST_PAGE_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, CachedArtistPage>)) {
      if (entry?.artistId) artistPageMemory.set(entry.artistId, entry)
    }
  }
  artistPageHydrated = true
}

function artistPageMemoryToStore(): Record<string, CachedArtistPage> {
  const store: Record<string, CachedArtistPage> = {}
  for (const entry of artistPageMemory.values()) {
    store[String(entry.artistId)] = entry
  }
  return trimRecordByUpdatedAt(store, MAX_ARTIST_CACHE_ENTRIES)
}

async function persistArtistPageStore(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_ARTIST_PAGE_CACHE_KV_KEY, artistPageMemoryToStore())
}

export async function getCachedArtistPage(artistId: number): Promise<CachedArtistPage | null> {
  if (!artistId) return null
  await hydrateArtistPages()
  const hit = artistPageMemory.get(artistId)
  if (!hit) return null
  const hasCore =
    hit.detail !== null || hit.hotSongs.length > 0 || hit.partners.length > 0
  return hasCore ? hit : null
}

export async function saveCachedArtistPage(
  data: Omit<CachedArtistPage, 'updatedAt'>,
): Promise<void> {
  if (!data.artistId) return
  const hasCore =
    data.detail !== null || data.hotSongs.length > 0 || data.partners.length > 0
  if (!hasCore) return
  await hydrateArtistPages()
  const prev = artistPageMemory.get(data.artistId)
  const entry: CachedArtistPage = {
    ...prev,
    ...data,
    updatedAt: Date.now(),
  }
  artistPageMemory.set(data.artistId, entry)
  await persistArtistPageStore()
}

export async function clearCachedArtistPage(artistId?: number): Promise<void> {
  await hydrateArtistPages()
  if (artistId) {
    artistPageMemory.delete(artistId)
    await persistArtistPageStore()
    return
  }
  artistPageMemory.clear()
  artistPageHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_ARTIST_PAGE_CACHE_KV_KEY)
}

/** 用户点击「同步」或主动全量刷新时清空页面级缓存 */
export async function clearListenTogetherPageCaches(): Promise<void> {
  await Promise.all([
    clearCachedHomeFeed(),
    clearCachedToplists(),
    clearCachedFeaturedArtists(),
    clearCachedSearchResults(),
    clearCachedArtistPage(),
  ])
}
