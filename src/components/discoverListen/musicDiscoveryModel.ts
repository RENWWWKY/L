import type { NeteaseHomeFeed } from './neteaseHomeApi'
import type { NeteaseSongItem } from './neteaseMusicApi'
import type { NeteasePlaylistItem, NeteaseProfileBundle } from './neteaseProfileApi'

export type MusicDiscoveryModel = {
  heartCover: string
  daily: { cover: string; songs: NeteaseSongItem[] }
  radar: {
    cover: string
    playlist: NeteasePlaylistItem | null
    songs: NeteaseSongItem[]
  }
  inspired: { anchorSong: string; songs: NeteaseSongItem[] }
  curatedPlaylists: NeteasePlaylistItem[]
  lovedSongs: NeteaseSongItem[]
}

const EMPTY: MusicDiscoveryModel = {
  heartCover: '',
  daily: { cover: '', songs: [] },
  radar: { cover: '', playlist: null, songs: [] },
  inspired: { anchorSong: '', songs: [] },
  curatedPlaylists: [],
  lovedSongs: [],
}

function pickCover(...urls: (string | undefined)[]): string {
  for (const u of urls) {
    if (u?.trim()) return u.trim()
  }
  return ''
}

export function buildMusicDiscoveryModel(
  feed: NeteaseHomeFeed | null,
  profile: NeteaseProfileBundle | null,
): MusicDiscoveryModel {
  if (!feed) return EMPTY

  const dailySection = feed.sections.find((s) => s.id === 'daily-recommend')
  const dailySongs = dailySection?.songs ?? []

  const personalizedSection = feed.sections.find((s) => s.id === 'personalized-playlists')
  const allPlaylists = personalizedSection?.playlists ?? []

  const radarPlaylist =
    allPlaylists.find((p) => /雷达|radar/i.test(p.title)) ??
    allPlaylists.find((p) => /私人|fm/i.test(p.title)) ??
    null

  const radarBlock = feed.sections.find((s) => /雷达|radar|私人/i.test(s.title))
  const radarSongs = radarBlock?.songs ?? []

  const curatedPlaylists = allPlaylists.filter((p) => p.id !== radarPlaylist?.id)

  const inspiredSection = feed.sections.find(
    (s) =>
      s.songs.length > 0 &&
      s.id !== 'daily-recommend' &&
      !/排行|榜单|榜$|chart|toplist/i.test(s.title),
  )
  const inspiredSongs = inspiredSection?.songs ?? dailySongs.slice(1, 10)
  const anchorSong = inspiredSongs[0]?.name ?? dailySongs[0]?.name ?? ''

  const lovedSection = feed.sections.find((s) => /相似|红心|波长|love|心动/i.test(s.title))
  const lovedSongs = lovedSection?.songs ?? dailySongs.slice(0, 8)

  const heartCover = pickCover(
    profile?.likedSongs.cover,
    dailySongs[0]?.cover,
    radarPlaylist?.cover,
    feed.banners[0]?.cover,
  )

  return {
    heartCover,
    daily: {
      cover: pickCover(dailySongs[0]?.cover, profile?.likedSongs.cover),
      songs: dailySongs,
    },
    radar: {
      cover: pickCover(radarPlaylist?.cover, radarSongs[0]?.cover, dailySongs[1]?.cover),
      playlist: radarPlaylist ?? curatedPlaylists[0] ?? null,
      songs: radarSongs,
    },
    inspired: { anchorSong, songs: inspiredSongs },
    curatedPlaylists: curatedPlaylists.length > 0 ? curatedPlaylists : allPlaylists,
    lovedSongs,
  }
}
