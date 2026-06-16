import { AnimatePresence, motion } from 'framer-motion'
import { Heart, MessageCircle, Mic2, Sparkles, UserPlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Pressable } from '../../../../components/Pressable'
import type { Artist, ArtistStatKey } from '../agentTypes'
import { DATE_AFFECTION_THRESHOLD, GIG_STAMINA_COST, MAX_STAMINA, STAT_LABELS } from '../agentTypes'
import { RadarChart } from '../components/RadarChart'
import {
  DateStoryOverlay,
  RecruitPanel,
  TrainFlavorToast,
  TrainMenuOverlay,
} from '../components/Overlays'
import { formatCompactNumber } from '../useAnimatedNumber'
import { AgentNum } from '../components/AgentNumeric'
import { useAgentStore } from '../useAgentStore'

function RosterCard({
  artist,
  selected,
  onSelect,
}: {
  artist: Artist
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Pressable
      onClick={onSelect}
      className={`agent-rose-card flex shrink-0 flex-col items-center gap-1 p-3 transition-all ${
        selected ? 'ring-2 ring-rose-300 agent-tab-glow scale-[1.02]' : ''
      }`}
      style={{ width: 88 }}
    >
      <div className="agent-artist-avatar flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
        {artist.name.slice(0, 1)}
      </div>
      <span className="text-[13px] font-medium text-stone-800">{artist.name}</span>
      <span className="text-[10px] text-stone-500">
        <AgentNum>{formatCompactNumber(artist.metrics.fans)}</AgentNum> 粉
      </span>
    </Pressable>
  )
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[11px] text-stone-500">{label}</span>
      <div className="agent-stat-bar flex-1">
        <div className="agent-stat-bar-fill" style={{ width: `${value}%` }} />
      </div>
      <AgentNum className="w-6 text-right text-[11px] text-stone-700">{value}</AgentNum>
    </div>
  )
}

export function ArtistManagerTab({ onOpenChat }: { onOpenChat: (artistId: string) => void }) {
  const artists = useAgentStore((s) => s.artists)
  const selectedArtistId = useAgentStore((s) => s.selectedArtistId)
  const stamina = useAgentStore((s) => s.stamina)
  const selectArtist = useAgentStore((s) => s.selectArtist)
  const acceptGig = useAgentStore((s) => s.acceptGig)
  const startDateStory = useAgentStore((s) => s.startDateStory)
  const isDateUnlocked = useAgentStore((s) => s.isDateUnlocked)

  const artist = artists.find((a) => a.id === selectedArtistId) ?? artists[0]

  const [recruitOpen, setRecruitOpen] = useState(false)
  const [trainOpen, setTrainOpen] = useState(false)
  const [dateStory, setDateStory] = useState<{ title: string; lines: string[] } | null>(null)
  const [trainFlavor, setTrainFlavor] = useState<string | null>(null)

  if (!artist) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-stone-500">
        尚无旗下艺人，请点击右下角寻访新人。
      </div>
    )
  }

  const statKeys: ArtistStatKey[] = ['vocal', 'acting', 'variety', 'charm']
  const dateReady = isDateUnlocked(artist.id)

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="shrink-0 overflow-x-auto px-3 pb-2 pt-1">
        <div className="flex gap-2">
          {artists.map((a) => (
            <RosterCard
              key={a.id}
              artist={a}
              selected={a.id === artist.id}
              onSelect={() => selectArtist(a.id)}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-20">
        <motion.div
          key={artist.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="agent-rose-card p-4"
        >
          <div className="flex items-start gap-4">
            <div className="agent-artist-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold">
              {artist.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="agent-serif text-xl font-semibold text-stone-800">{artist.name}</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                {artist.tags.map((t) => (
                  <span key={t} className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] text-rose-600">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-stone-500">粉丝</p>
                  <p className="text-[14px] text-stone-800">
                    <AgentNum className="font-semibold">{formatCompactNumber(artist.metrics.fans)}</AgentNum>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500">商业价值</p>
                  <p className="text-[14px] text-stone-800">
                    <AgentNum className="font-semibold">{artist.metrics.commercialValue}</AgentNum>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500">好感</p>
                  <p className="text-[14px] text-rose-500">
                    <AgentNum className="font-semibold">{artist.metrics.affection}</AgentNum>
                  </p>
                </div>
              </div>
            </div>
            <RadarChart stats={artist.stats} size={100} />
          </div>

          <div className="mt-4 space-y-2">
            {statKeys.map((k) => (
              <StatBar key={k} label={STAT_LABELS[k]} value={artist.stats[k]} />
            ))}
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <ActionTile
            icon={<Mic2 size={20} />}
            label="安排培训"
            onClick={() => setTrainOpen(true)}
          />
          <ActionTile
            icon={<MessageCircle size={20} />}
            label="线上联络"
            onClick={() => onOpenChat(artist.id)}
          />
          <ActionTile
            icon={<Heart size={20} />}
            label="专属约会"
            sub={dateReady ? '已解锁' : `好感 ${DATE_AFFECTION_THRESHOLD}`}
            disabled={!dateReady}
            onClick={() => {
              const story = startDateStory(artist.id)
              if (story) setDateStory(story)
            }}
          />
          <ActionTile
            icon={<Sparkles size={20} />}
            label="承接通告"
            sub={
              <>
                体力 <AgentNum>{stamina}</AgentNum>/<AgentNum>{MAX_STAMINA}</AgentNum>
              </>
            }
            disabled={stamina < GIG_STAMINA_COST}
            onClick={() => acceptGig(artist.id)}
          />
        </div>
      </div>

      <Pressable
        onClick={() => setRecruitOpen(true)}
        className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-rose-400 px-4 py-2.5 text-[14px] font-medium text-white shadow-lg shadow-rose-300/40"
      >
        <UserPlus size={16} />
        寻访新人
      </Pressable>

      <AnimatePresence>
        {recruitOpen && <RecruitPanel onClose={() => setRecruitOpen(false)} />}
        {trainOpen && (
          <TrainMenuOverlay
            artistId={artist.id}
            onClose={() => setTrainOpen(false)}
            onTrained={(f) => setTrainFlavor(f)}
          />
        )}
        {dateStory && (
          <DateStoryOverlay
            title={dateStory.title}
            lines={dateStory.lines}
            onClose={() => setDateStory(null)}
          />
        )}
        {trainFlavor && (
          <TrainFlavorToast text={trainFlavor} onDone={() => setTrainFlavor(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function ActionTile({
  icon,
  label,
  sub,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  sub?: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Pressable
      disabled={disabled}
      onClick={onClick}
      className="agent-rose-card flex flex-col items-center justify-center gap-1 py-4 disabled:opacity-45"
    >
      <span className="text-rose-400">{icon}</span>
      <span className="text-[14px] font-medium text-stone-800">{label}</span>
      {sub && <span className="text-[10px] text-stone-500">{sub}</span>}
    </Pressable>
  )
}
