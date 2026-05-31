import { motion, type Variants } from 'framer-motion'
import { Heart, Loader2, Play } from 'lucide-react'
import { useMemo } from 'react'

import { buildMusicDiscoveryModel } from './musicDiscoveryModel'
import type { NeteaseToplistChart } from './neteaseToplistApi'
import type { NeteaseHomeFeed } from './neteaseHomeApi'
import type { NeteaseSongItem } from './neteaseMusicApi'
import type { NeteasePlaylistItem, NeteaseProfileBundle } from './neteaseProfileApi'

const COVER_SHADOW = 'shadow-[0_10px_30px_rgba(225,29,72,0.08)]'
const H_SCROLL =
  'flex gap-3 overflow-x-auto pb-2 scroll-smooth scroll-px-4 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
}

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

type MusicDiscoveryPageProps = {
  feed: NeteaseHomeFeed | null
  profile: NeteaseProfileBundle | null
  loading: boolean
  error: string | null
  onHeartModePlay: () => void
  onOpenDaily: () => void
  onOpenRadar: () => void
  onPlaySong: (song: NeteaseSongItem, queue: NeteaseSongItem[]) => void
  onOpenPlaylist: (playlist: NeteasePlaylistItem) => void
  toplistCharts: NeteaseToplistChart[]
  toplistLoading?: boolean
  toplistError?: string | null
  onOpenToplistChart: (chart: NeteaseToplistChart) => void
}

function CoverImg({
  src,
  alt = '',
  className = '',
}: {
  src?: string
  alt?: string
  className?: string
}) {
  if (!src) {
    return <div className={`bg-gradient-to-br from-rose-100/80 to-[#F5E6E8] ${className}`} />
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3 px-0.5">
      <h2 className="font-serif text-[17px] font-medium tracking-tight text-[#2D2422]">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-[12px] italic leading-relaxed text-rose-300">{subtitle}</p>
      ) : null}
    </div>
  )
}

function HeartbeatHero({
  cover,
  onPlay,
}: {
  cover: string
  onPlay: () => void
}) {
  return (
    <motion.button
      type="button"
      layoutId="hero-heartbeat"
      onClick={onPlay}
      whileTap={{ scale: 0.95 }}
      className={`group relative aspect-[2/1] w-full overflow-hidden rounded-[28px] ${COVER_SHADOW}`}
    >
      <div className="absolute inset-0">
        <CoverImg src={cover} className="scale-110 blur-md" />
        <div className="absolute inset-0 bg-black/20" />
        <CoverImg src={cover} className="absolute inset-0 opacity-90" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/40"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span
            className="absolute inset-0 rounded-full bg-rose-200/40 blur-xl"
            aria-hidden
          />
          <Play className="relative size-6 fill-white text-white pl-0.5" strokeWidth={0} />
        </motion.span>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-5 pb-5 pt-12">
        <p className="font-serif text-[11px] uppercase tracking-[0.28em] text-white/75">
          Heartbeat Rhythm
        </p>
        <p className="mt-1 font-serif text-[20px] font-medium tracking-wide text-white">
          心动模式
        </p>
      </div>
    </motion.button>
  )
}

function DualHeroCard({
  layoutId,
  cover,
  line1,
  line2,
  onClick,
}: {
  layoutId: string
  cover: string
  line1: string
  line2: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`relative aspect-square w-full overflow-hidden rounded-[24px] ${COVER_SHADOW}`}
    >
      <CoverImg src={cover} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#3D2C2A]/70 via-[#3D2C2A]/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-rose-100/90">
          {line1}
        </p>
        <p className="mt-0.5 font-serif text-[15px] text-white/95">{line2}</p>
      </div>
    </motion.button>
  )
}

export function MusicDiscoveryPage({
  feed,
  profile,
  loading,
  error,
  onHeartModePlay,
  onOpenDaily,
  onOpenRadar,
  onPlaySong,
  onOpenPlaylist,
  toplistCharts,
  toplistLoading = false,
  toplistError = null,
  onOpenToplistChart,
}: MusicDiscoveryPageProps) {
  const model = useMemo(() => buildMusicDiscoveryModel(feed, profile), [feed, profile])

  if (loading && !feed) {
    return (
      <section className="flex items-center justify-center gap-2 py-16 text-[13px] text-rose-300">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
        正在编排你的音乐展厅…
      </section>
    )
  }

  if (!feed || (feed.sections.length === 0 && feed.banners.length === 0)) {
    if (error) {
      return (
        <section className="py-12 text-center text-[13px] text-rose-300/90">{error}</section>
      )
    }
    return null
  }

  const inspiredTitle = model.inspired.anchorSong
    ? `根据你听过的「${model.inspired.anchorSong}」定制`
    : '根据你的听歌足迹定制'

  return (
    <motion.div
      className="pb-4"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* —— Hero 1+2 —— */}
      <motion.section variants={riseVariants} className="mb-5 space-y-3">
        <HeartbeatHero cover={model.heartCover} onPlay={onHeartModePlay} />
        <div className="grid grid-cols-2 gap-3">
          <DualHeroCard
            layoutId="hero-daily"
            cover={model.daily.cover}
            line1="Daily Mix"
            line2="每日推荐"
            onClick={onOpenDaily}
          />
          <DualHeroCard
            layoutId="hero-radar"
            cover={model.radar.cover}
            line1="Radar"
            line2="频率雷达"
            onClick={onOpenRadar}
          />
        </div>
      </motion.section>

      {/* —— 2.1 Inspired —— */}
      {model.inspired.songs.length > 0 ? (
        <motion.section variants={riseVariants} className="mb-8">
          <SectionTitle
            title={inspiredTitle}
            subtitle="因为一首歌，推演一个宇宙..."
          />
          <div className={H_SCROLL}>
            {model.inspired.songs.map((song) => (
              <button
                key={`inspired-${song.id}`}
                type="button"
                onClick={() => onPlaySong(song, model.inspired.songs)}
                className={`relative aspect-[4/3] w-[132px] shrink-0 snap-start overflow-hidden rounded-[20px] ${COVER_SHADOW}`}
              >
                <CoverImg src={song.cover} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2D2422]/65 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
                  <p className="line-clamp-1 text-[12px] font-medium text-white">{song.name}</p>
                  <p className="line-clamp-1 text-[10px] text-white/65">{song.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}

      {/* —— 2.2 Curated playlists —— */}
      {model.curatedPlaylists.length > 0 ? (
        <motion.section variants={riseVariants} className="mb-8">
          <SectionTitle title="推荐歌单" />
          <div className={H_SCROLL}>
            {model.curatedPlaylists.map((pl) => (
              <button
                key={`pl-${pl.id}`}
                type="button"
                onClick={() => onOpenPlaylist(pl)}
                className="w-40 shrink-0 snap-start text-left"
              >
                <div
                  className={`aspect-square w-40 overflow-hidden rounded-[22px] ${COVER_SHADOW}`}
                >
                  <CoverImg src={pl.cover} />
                </div>
                <p className="mt-2 line-clamp-2 px-0.5 text-[12px] font-extralight leading-snug text-[#2D2422]/85">
                  {pl.title}
                </p>
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}

      {/* —— 2.3 Loved & similar —— */}
      {model.lovedSongs.length > 0 ? (
        <motion.section variants={riseVariants} className="mb-8">
          <SectionTitle title="红心与相似波长" />
          <div className={H_SCROLL}>
            {model.lovedSongs.map((song) => (
              <button
                key={`loved-${song.id}`}
                type="button"
                onClick={() => onPlaySong(song, model.lovedSongs)}
                className={`relative aspect-square w-[108px] shrink-0 snap-start overflow-hidden rounded-[20px] ${COVER_SHADOW}`}
              >
                <CoverImg src={song.cover} />
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-rose-200 shadow-[0_0_12px_rgba(251,207,232,0.9)] backdrop-blur-sm">
                  <Heart className="size-3 fill-current" strokeWidth={0} />
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                  <p className="line-clamp-1 text-[11px] text-white/90">{song.name}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}

      {/* —— 2.4 官方排行榜歌单（华语榜 / 热歌榜等）—— */}
      {toplistLoading && toplistCharts.length === 0 ? (
        <motion.section variants={riseVariants} className="mb-4 flex items-center gap-2 py-4 text-[13px] text-rose-300">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
          正在加载官方排行榜…
        </motion.section>
      ) : null}

      {toplistCharts.length > 0 ? (
        <motion.section variants={riseVariants} className="mb-4">
          <SectionTitle
            title="官方排行榜"
            subtitle="热歌榜 · 华语榜 · 新歌榜 · 飙升榜"
          />
          <div className={H_SCROLL}>
            {toplistCharts.map((chart) => (
              <button
                key={`toplist-${chart.id}`}
                type="button"
                onClick={() => onOpenToplistChart(chart)}
                className="w-[148px] shrink-0 snap-start text-left"
              >
                <div
                  className={`relative aspect-square w-[148px] overflow-hidden rounded-[22px] ${COVER_SHADOW}`}
                >
                  <CoverImg src={chart.cover} alt={chart.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2D2422]/75 via-[#2D2422]/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="font-serif text-[16px] font-medium leading-tight text-white">
                      {chart.name}
                    </p>
                    {chart.songs[0] ? (
                      <p className="mt-1 line-clamp-1 text-[10px] text-white/65">
                        No.1 {chart.songs[0].name}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.section>
      ) : toplistError ? (
        <motion.section variants={riseVariants} className="mb-4 py-2 text-center text-[12px] text-rose-300/90">
          {toplistError}
        </motion.section>
      ) : null}
    </motion.div>
  )
}
