import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { ParsedLyricLine } from './listenLyricParse'
import type { NeteaseProfileBundle } from './neteaseProfileApi'
import type {
  NeteaseSongComment,
  NeteaseSongItem,
  PlaylistMeta,
  SongCommentsCacheEntry,
} from './neteaseMusicApi'

/** IndexedDB `phoneKv` 键（与微信人设同库 `personaDb`） */
export const LISTEN_TOGETHER_PLAYLIST_CACHE_KV_KEY = 'listen-together-playlist-tracks-v1'
export const LISTEN_TOGETHER_SONG_COMMENTS_CACHE_KV_KEY = 'listen-together-song-comments-v1'
export const LISTEN_TOGETHER_PLAYLIST_COMMENTS_CACHE_KV_KEY = 'listen-together-playlist-comments-v1'
export const LISTEN_TOGETHER_PROFILE_CACHE_KV_KEY = 'listen-together-netease-profile-v1'
export const LISTEN_TOGETHER_LOGIN_COOKIE_KV_KEY = 'listen-together-netease-login-cookie-v1'
export const LISTEN_TOGETHER_GUEST_MODE_KV_KEY = 'listen-together-guest-mode-v1'
export const LISTEN_TOGETHER_RECENT_SONGS_KV_KEY = 'listen-together-recent-songs-v1'
export const LISTEN_TOGETHER_SONG_PLAYBACK_KV_KEY = 'listen-together-song-playback-v1'

/** 旧版 localStorage 键（首次读取时自动迁入 IndexedDB） */
export const LEGACY_PLAYLIST_CACHE_LS_KEY = 'listen_together_playlist_tracks_v1'
export const LEGACY_LOGIN_COOKIE_LS_KEY = 'listen_together_netease_cookie'

const MAX_CACHED_PLAYLISTS = 24

export type CachedPlaylistData = {
  playlistId: number
  title: string
  cover: string
  count: number
  tracks: NeteaseSongItem[]
  fullyLoaded: boolean
  meta?: PlaylistMeta
  updatedAt: number
}

export type PlaylistCommentsCacheEntry = {
  playlistId: number
  hot: NeteaseSongComment[]
  items: NeteaseSongComment[]
  total: number
  more: boolean
  updatedAt: number
}

const playlistMemory = new Map<number, CachedPlaylistData>()
let playlistHydrated = false

const commentsMemory = new Map<number, SongCommentsCacheEntry>()
let commentsHydrated = false

function trimPlaylistStore(
  store: Record<string, CachedPlaylistData>,
): Record<string, CachedPlaylistData> {
  const entries = Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt)
  if (entries.length <= MAX_CACHED_PLAYLISTS) return store
  const next: Record<string, CachedPlaylistData> = {}
  for (const item of entries.slice(0, MAX_CACHED_PLAYLISTS)) {
    next[String(item.playlistId)] = item
  }
  return next
}

function playlistMemoryToStore(): Record<string, CachedPlaylistData> {
  const store: Record<string, CachedPlaylistData> = {}
  for (const entry of playlistMemory.values()) {
    store[String(entry.playlistId)] = entry
  }
  return trimPlaylistStore(store)
}

async function hydratePlaylistFromIdb(): Promise<void> {
  if (playlistHydrated) return
  const raw = await pullPhoneKvWithLocalStorageLegacy(LISTEN_TOGETHER_PLAYLIST_CACHE_KV_KEY, [
    LEGACY_PLAYLIST_CACHE_LS_KEY,
  ])
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, CachedPlaylistData>)) {
      if (entry?.playlistId && Array.isArray(entry.tracks) && entry.tracks.length > 0) {
        playlistMemory.set(entry.playlistId, entry)
      }
    }
  }
  playlistHydrated = true
}

async function persistPlaylistStore(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_PLAYLIST_CACHE_KV_KEY, playlistMemoryToStore())
}

async function hydrateCommentsFromIdb(): Promise<void> {
  if (commentsHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_SONG_COMMENTS_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, SongCommentsCacheEntry>)) {
      if (entry?.songId) commentsMemory.set(entry.songId, entry)
    }
  }
  commentsHydrated = true
}

function commentsMemoryToStore(): Record<string, SongCommentsCacheEntry> {
  const store: Record<string, SongCommentsCacheEntry> = {}
  for (const entry of commentsMemory.values()) {
    store[String(entry.songId)] = entry
  }
  return store
}

async function persistCommentsStore(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_SONG_COMMENTS_CACHE_KV_KEY, commentsMemoryToStore())
}

export async function getCachedPlaylist(playlistId: number): Promise<CachedPlaylistData | null> {
  if (!playlistId) return null
  await hydratePlaylistFromIdb()
  const hit = playlistMemory.get(playlistId)
  if (!hit || !Array.isArray(hit.tracks) || hit.tracks.length === 0) return null
  return hit
}

/** 内存已 hydrate 时同步读取歌单缓存 */
export function getCachedPlaylistSync(playlistId: number): CachedPlaylistData | null {
  if (!playlistId || !playlistHydrated) return null
  const hit = playlistMemory.get(playlistId)
  if (!hit || !Array.isArray(hit.tracks) || hit.tracks.length === 0) return null
  return hit
}

export async function savePlaylistCache(
  data: Omit<CachedPlaylistData, 'updatedAt'>,
): Promise<void> {
  if (!data.playlistId || data.tracks.length === 0) return
  await hydratePlaylistFromIdb()
  const entry: CachedPlaylistData = {
    ...data,
    fullyLoaded: data.fullyLoaded || data.tracks.length >= data.count,
    updatedAt: Date.now(),
  }
  playlistMemory.set(data.playlistId, entry)
  await persistPlaylistStore()
}

export async function clearPlaylistCache(playlistId?: number): Promise<void> {
  await hydratePlaylistFromIdb()
  if (playlistId) {
    playlistMemory.delete(playlistId)
    await persistPlaylistStore()
    return
  }
  playlistMemory.clear()
  playlistHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_PLAYLIST_CACHE_KV_KEY)
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_PLAYLIST_CACHE_LS_KEY)
  }
}

export async function getCachedSongComments(
  songId: number,
): Promise<SongCommentsCacheEntry | null> {
  if (!songId) return null
  await hydrateCommentsFromIdb()
  return commentsMemory.get(songId) ?? null
}

export async function saveSongCommentsCache(entry: SongCommentsCacheEntry): Promise<void> {
  if (!entry.songId) return
  await hydrateCommentsFromIdb()
  commentsMemory.set(entry.songId, entry)
  await persistCommentsStore()
}

export async function clearSongCommentsCache(songId?: number): Promise<void> {
  await hydrateCommentsFromIdb()
  if (songId) {
    commentsMemory.delete(songId)
    await persistCommentsStore()
    return
  }
  commentsMemory.clear()
  commentsHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_SONG_COMMENTS_CACHE_KV_KEY)
}

// —— 歌单评论 ——

const playlistCommentsMemory = new Map<number, PlaylistCommentsCacheEntry>()
let playlistCommentsHydrated = false

async function hydratePlaylistCommentsFromIdb(): Promise<void> {
  if (playlistCommentsHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_PLAYLIST_COMMENTS_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, PlaylistCommentsCacheEntry>)) {
      if (entry?.playlistId) playlistCommentsMemory.set(entry.playlistId, entry)
    }
  }
  playlistCommentsHydrated = true
}

function playlistCommentsMemoryToStore(): Record<string, PlaylistCommentsCacheEntry> {
  const store: Record<string, PlaylistCommentsCacheEntry> = {}
  for (const entry of playlistCommentsMemory.values()) {
    store[String(entry.playlistId)] = entry
  }
  return store
}

async function persistPlaylistCommentsStore(): Promise<void> {
  await personaDb.setPhoneKv(
    LISTEN_TOGETHER_PLAYLIST_COMMENTS_CACHE_KV_KEY,
    playlistCommentsMemoryToStore(),
  )
}

export async function getCachedPlaylistComments(
  playlistId: number,
): Promise<PlaylistCommentsCacheEntry | null> {
  if (!playlistId) return null
  await hydratePlaylistCommentsFromIdb()
  return playlistCommentsMemory.get(playlistId) ?? null
}

export async function savePlaylistCommentsCache(
  entry: PlaylistCommentsCacheEntry,
): Promise<void> {
  if (!entry.playlistId) return
  await hydratePlaylistCommentsFromIdb()
  playlistCommentsMemory.set(entry.playlistId, entry)
  await persistPlaylistCommentsStore()
}

export async function clearPlaylistCommentsCache(playlistId?: number): Promise<void> {
  await hydratePlaylistCommentsFromIdb()
  if (playlistId) {
    playlistCommentsMemory.delete(playlistId)
    await persistPlaylistCommentsStore()
    return
  }
  playlistCommentsMemory.clear()
  playlistCommentsHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_PLAYLIST_COMMENTS_CACHE_KV_KEY)
}

// —— 网易云登录 Cookie（IndexedDB + 内存，兼容旧 localStorage）——

let loginCookieMemory = ''
let loginCookieHydrated = false

export async function hydrateNeteaseLoginCookie(): Promise<string> {
  if (loginCookieHydrated) return loginCookieMemory
  const raw = await pullPhoneKvWithLocalStorageLegacy(LISTEN_TOGETHER_LOGIN_COOKIE_KV_KEY, [
    LEGACY_LOGIN_COOKIE_LS_KEY,
  ])
  loginCookieMemory = typeof raw === 'string' ? raw : ''
  loginCookieHydrated = true
  return loginCookieMemory
}

export function getNeteaseLoginCookieSync(): string {
  if (loginCookieHydrated) return loginCookieMemory
  try {
    return localStorage.getItem(LEGACY_LOGIN_COOKIE_LS_KEY) ?? ''
  } catch {
    return ''
  }
}

export async function saveNeteaseLoginCookie(cookie: string): Promise<void> {
  loginCookieMemory = cookie
  loginCookieHydrated = true
  if (cookie.trim()) {
    await clearGuestMode()
  }
  await personaDb.setPhoneKv(LISTEN_TOGETHER_LOGIN_COOKIE_KV_KEY, cookie)
  try {
    if (cookie) localStorage.setItem(LEGACY_LOGIN_COOKIE_LS_KEY, cookie)
    else localStorage.removeItem(LEGACY_LOGIN_COOKIE_LS_KEY)
  } catch {
    /* ignore */
  }
}

export async function clearNeteaseLoginCookie(): Promise<void> {
  loginCookieMemory = ''
  loginCookieHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_LOGIN_COOKIE_KV_KEY)
  try {
    localStorage.removeItem(LEGACY_LOGIN_COOKIE_LS_KEY)
  } catch {
    /* ignore */
  }
}

// —— 游客模式（无网易账号也可搜索/播放公开内容）——

let guestModeMemory = false
let guestModeHydrated = false

export async function hydrateGuestMode(): Promise<boolean> {
  if (guestModeHydrated) return guestModeMemory
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_GUEST_MODE_KV_KEY)
  guestModeMemory = raw === true
  guestModeHydrated = true
  return guestModeMemory
}

export function isGuestModeSync(): boolean {
  if (guestModeHydrated) return guestModeMemory
  return false
}

export async function setGuestMode(enabled: boolean): Promise<void> {
  guestModeMemory = enabled
  guestModeHydrated = true
  if (enabled) {
    await personaDb.setPhoneKv(LISTEN_TOGETHER_GUEST_MODE_KV_KEY, true)
  } else {
    await personaDb.deletePhoneKv(LISTEN_TOGETHER_GUEST_MODE_KV_KEY)
  }
}

export async function clearGuestMode(): Promise<void> {
  await setGuestMode(false)
}

// —— 用户资料（我的页）——

export type CachedNeteaseProfile = {
  userId: number
  profile: NeteaseProfileBundle
  updatedAt: number
}

let profileMemory: CachedNeteaseProfile | null = null
let profileHydrated = false

async function hydrateProfileFromIdb(): Promise<void> {
  if (profileHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_PROFILE_CACHE_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as CachedNeteaseProfile
    if (row.profile?.user?.userId) profileMemory = row
  }
  profileHydrated = true
}

export async function getCachedNeteaseProfile(): Promise<CachedNeteaseProfile | null> {
  await hydrateProfileFromIdb()
  return profileMemory
}

/** 内存已 hydrate 时同步读取用户资料 */
export function getCachedNeteaseProfileSync(): CachedNeteaseProfile | null {
  if (!profileHydrated) return null
  return profileMemory
}

export async function saveCachedNeteaseProfile(profile: NeteaseProfileBundle): Promise<void> {
  const userId = profile.user.userId
  if (!userId) return
  await hydrateProfileFromIdb()
  profileMemory = { userId, profile, updatedAt: Date.now() }
  await personaDb.setPhoneKv(LISTEN_TOGETHER_PROFILE_CACHE_KV_KEY, profileMemory)
}

export async function clearCachedNeteaseProfile(): Promise<void> {
  await hydrateProfileFromIdb()
  profileMemory = null
  profileHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_PROFILE_CACHE_KV_KEY)
}

// —— 首页最近播放 ——

export type CachedRecentSongs = {
  userId: number
  songs: NeteaseSongItem[]
  updatedAt: number
}

const recentSongsMemory = new Map<number, CachedRecentSongs>()
let recentSongsHydrated = false

async function hydrateRecentSongsFromIdb(): Promise<void> {
  if (recentSongsHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_RECENT_SONGS_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, CachedRecentSongs>)) {
      if (entry?.userId && Array.isArray(entry.songs)) {
        recentSongsMemory.set(entry.userId, entry)
      }
    }
  }
  recentSongsHydrated = true
}

function recentSongsMemoryToStore(): Record<string, CachedRecentSongs> {
  const store: Record<string, CachedRecentSongs> = {}
  for (const entry of recentSongsMemory.values()) {
    store[String(entry.userId)] = entry
  }
  return store
}

export async function getCachedRecentSongs(userId: number): Promise<CachedRecentSongs | null> {
  if (!userId) return null
  await hydrateRecentSongsFromIdb()
  return recentSongsMemory.get(userId) ?? null
}

export async function saveCachedRecentSongs(
  userId: number,
  songs: NeteaseSongItem[],
): Promise<void> {
  if (!userId) return
  await hydrateRecentSongsFromIdb()
  const entry: CachedRecentSongs = { userId, songs, updatedAt: Date.now() }
  recentSongsMemory.set(userId, entry)
  await personaDb.setPhoneKv(LISTEN_TOGETHER_RECENT_SONGS_KV_KEY, recentSongsMemoryToStore())
}

export async function clearCachedRecentSongs(userId?: number): Promise<void> {
  await hydrateRecentSongsFromIdb()
  if (userId) {
    recentSongsMemory.delete(userId)
    await personaDb.setPhoneKv(LISTEN_TOGETHER_RECENT_SONGS_KV_KEY, recentSongsMemoryToStore())
    return
  }
  recentSongsMemory.clear()
  recentSongsHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_RECENT_SONGS_KV_KEY)
}

// —— 已加载曲目（播放地址 + 歌词，IndexedDB）——

const MAX_CACHED_SONG_PLAYBACK = 80
/** 网易云播放链通常数小时内有效，过期后仅重新请求 url */
const SONG_PLAY_URL_TTL_MS = 6 * 60 * 60 * 1000

export type CachedSongPlayback = {
  songId: number
  playUrl: string
  lyrics: ParsedLyricLine[]
  updatedAt: number
}

const songPlaybackMemory = new Map<number, CachedSongPlayback>()
let songPlaybackHydrated = false

export function isSongPlayUrlCacheValid(entry: CachedSongPlayback | null | undefined): boolean {
  if (!entry?.playUrl) return false
  return Date.now() - entry.updatedAt < SONG_PLAY_URL_TTL_MS
}

function trimSongPlaybackStore(
  store: Record<string, CachedSongPlayback>,
): Record<string, CachedSongPlayback> {
  const entries = Object.values(store).sort((a, b) => b.updatedAt - a.updatedAt)
  if (entries.length <= MAX_CACHED_SONG_PLAYBACK) return store
  const next: Record<string, CachedSongPlayback> = {}
  for (const item of entries.slice(0, MAX_CACHED_SONG_PLAYBACK)) {
    next[String(item.songId)] = item
  }
  return next
}

function songPlaybackMemoryToStore(): Record<string, CachedSongPlayback> {
  const store: Record<string, CachedSongPlayback> = {}
  for (const entry of songPlaybackMemory.values()) {
    store[String(entry.songId)] = entry
  }
  return trimSongPlaybackStore(store)
}

async function hydrateSongPlaybackFromIdb(): Promise<void> {
  if (songPlaybackHydrated) return
  const raw = await personaDb.getPhoneKv(LISTEN_TOGETHER_SONG_PLAYBACK_KV_KEY)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const entry of Object.values(raw as Record<string, CachedSongPlayback>)) {
      if (entry?.songId && entry.playUrl) {
        songPlaybackMemory.set(entry.songId, entry)
      }
    }
  }
  songPlaybackHydrated = true
}

async function persistSongPlaybackStore(): Promise<void> {
  await personaDb.setPhoneKv(LISTEN_TOGETHER_SONG_PLAYBACK_KV_KEY, songPlaybackMemoryToStore())
}

export async function getCachedSongPlayback(songId: number): Promise<CachedSongPlayback | null> {
  if (!songId) return null
  await hydrateSongPlaybackFromIdb()
  return songPlaybackMemory.get(songId) ?? null
}

export async function saveCachedSongPlayback(
  data: Omit<CachedSongPlayback, 'updatedAt'>,
): Promise<void> {
  if (!data.songId || !data.playUrl) return
  await hydrateSongPlaybackFromIdb()
  const prev = songPlaybackMemory.get(data.songId)
  const entry: CachedSongPlayback = {
    songId: data.songId,
    playUrl: data.playUrl,
    lyrics:
      data.lyrics.length > 0
        ? data.lyrics
        : (prev?.lyrics ?? []),
    updatedAt: Date.now(),
  }
  songPlaybackMemory.set(data.songId, entry)
  await persistSongPlaybackStore()
}

export async function clearSongPlaybackCache(songId?: number): Promise<void> {
  await hydrateSongPlaybackFromIdb()
  if (songId) {
    songPlaybackMemory.delete(songId)
    await persistSongPlaybackStore()
    return
  }
  songPlaybackMemory.clear()
  songPlaybackHydrated = true
  await personaDb.deletePhoneKv(LISTEN_TOGETHER_SONG_PLAYBACK_KV_KEY)
}

/** 用户点击「同步」：清空可刷新缓存，便于重新拉取网易云最新数据 */
export async function clearListenTogetherSyncCaches(): Promise<void> {
  const { clearListenTogetherPageCaches } = await import('./listenTogetherPageCache')
  await Promise.all([
    clearPlaylistCache(),
    clearSongCommentsCache(),
    clearPlaylistCommentsCache(),
    clearSongPlaybackCache(),
    clearCachedNeteaseProfile(),
    clearCachedRecentSongs(),
    clearListenTogetherPageCaches(),
  ])
}

/** 进入听一听时预加载 IndexedDB 缓存到内存，避免每次打开重复请求 */
export async function hydrateListenTogetherDataCaches(): Promise<void> {
  await Promise.all([
    hydratePlaylistFromIdb(),
    hydrateCommentsFromIdb(),
    hydratePlaylistCommentsFromIdb(),
    hydrateProfileFromIdb(),
    hydrateRecentSongsFromIdb(),
    hydrateSongPlaybackFromIdb(),
    hydrateNeteaseLoginCookie(),
    hydrateGuestMode(),
  ])
}
