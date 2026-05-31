import { Loader2 } from 'lucide-react'

import { ListenNum } from './ListenNum'
import type { NeteaseHomeFeed } from './neteaseHomeApi'
import type { NeteaseSongItem } from './neteaseMusicApi'
import type { NeteasePlaylistItem } from './neteaseProfileApi'

type ListenTogetherHomeDiscoveryProps = {
  feed: NeteaseHomeFeed | null
  loading: boolean
  error: string | null
  onPlaySong: (song: NeteaseSongItem, queue: NeteaseSongItem[]) => void
  onOpenPlaylist: (playlist: NeteasePlaylistItem) => void
}

function SongCard({
  song,
  onPlay,
}: {
  song: NeteaseSongItem
  onPlay: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative h-[108px] w-[148px] shrink-0 overflow-hidden rounded-2xl bg-stone-200 text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      {song.cover ? (
        <img
          src={song.cover}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-[14px] font-medium leading-snug text-white">{song.name}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">{song.artist}</p>
      </div>
    </button>
  )
}

function PlaylistCard({
  playlist,
  onOpen,
}: {
  playlist: NeteasePlaylistItem
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-[108px] w-[148px] shrink-0 overflow-hidden rounded-2xl bg-stone-200 text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      {playlist.cover ? (
        <img
          src={playlist.cover}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-[14px] font-medium leading-snug text-white">{playlist.title}</p>
        {playlist.count > 0 ? (
          <p className="mt-0.5 text-[11px] text-white/70">
            <ListenNum className="text-white/70">{playlist.count}</ListenNum> 首
          </p>
        ) : null}
      </div>
    </button>
  )
}

export function ListenTogetherHomeDiscovery({
  feed,
  loading,
  error,
  onPlaySong,
  onOpenPlaylist,
}: ListenTogetherHomeDiscoveryProps) {
  if (loading && !feed) {
    return (
      <section className="mb-7 flex items-center justify-center gap-2 rounded-2xl bg-white/45 py-8 text-[13px] text-stone-400">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
        正在加载网易云首页推荐…
      </section>
    )
  }

  if (!feed || (feed.sections.length === 0 && feed.banners.length === 0)) {
    if (error) {
      return (
        <section className="mb-7 rounded-2xl border border-dashed border-stone-200 bg-white/45 px-4 py-6 text-center text-[13px] text-stone-400">
          {error}
        </section>
      )
    }
    return null
  }

  return (
    <>
      {feed.banners.length > 0 ? (
        <section className="mb-7">
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-stone-700">精选 Banner</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {feed.banners.map((banner) => (
              <div
                key={banner.id}
                className="relative h-[108px] w-[220px] shrink-0 overflow-hidden rounded-2xl bg-stone-200 shadow-sm"
              >
                {banner.cover ? (
                  <img
                    src={banner.cover}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                {banner.title ? (
                  <p className="absolute inset-x-0 bottom-0 p-3 text-[13px] font-medium text-white">
                    {banner.title}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {feed.sections.map((section) => (
        <section key={section.id} className="mb-7">
          <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-stone-700">{section.title}</h2>
          {section.songs.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {section.songs.map((song) => (
                <SongCard
                  key={`${section.id}-${song.id}`}
                  song={song}
                  onPlay={() => onPlaySong(song, section.songs)}
                />
              ))}
            </div>
          ) : null}
          {section.playlists.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {section.playlists.map((pl) => (
                <PlaylistCard
                  key={`${section.id}-${pl.id}`}
                  playlist={pl}
                  onOpen={() => onOpenPlaylist(pl)}
                />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </>
  )
}
