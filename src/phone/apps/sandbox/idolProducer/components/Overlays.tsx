import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import type { Artist } from '../agentTypes'
import { RECRUIT_COST } from '../agentTypes'
import { TRAIN_CONFIGS } from '../agentPresets'
import { RadarChart } from './RadarChart'
import { AgentNumericText } from './AgentNumeric'
import { useAgentStore } from '../useAgentStore'

function ArtistAvatarLarge({ artist }: { artist: Artist }) {
  return (
    <div className="agent-artist-avatar mx-auto flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold shadow-md">
      {artist.name.slice(0, 1)}
    </div>
  )
}

export function RecruitPanel({ onClose }: { onClose: () => void }) {
  const budget = useAgentStore((s) => s.budget)
  const candidate = useAgentStore((s) => s.recruitCandidate)
  const refreshRecruitCandidate = useAgentStore((s) => s.refreshRecruitCandidate)
  const signRecruitCandidate = useAgentStore((s) => s.signRecruitCandidate)

  if (!candidate) return null

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, rotateY: -8, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="agent-rose-card w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-rose-400 font-medium">寻访新人</p>
            <h3 className="agent-serif text-xl font-semibold text-stone-800">{candidate.name}</h3>
          </div>
          <Pressable onClick={onClose} className="rounded-full p-1 text-stone-400">
            <X size={18} />
          </Pressable>
        </div>

        <div className="mt-4 flex justify-center">
          <ArtistAvatarLarge artist={candidate} />
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {candidate.tags.map((t) => (
            <span key={t} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-600 ring-1 ring-rose-200/60">
              {t}
            </span>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <RadarChart stats={candidate.stats} size={140} />
        </div>

        <p className="agent-serif mt-3 text-center text-[13px] leading-relaxed text-stone-600">
          {candidate.personaSummary}
        </p>

        <div className="mt-4 flex gap-2">
          <Pressable
            onClick={() => refreshRecruitCandidate()}
            className="flex flex-1 items-center justify-center gap-1 rounded-2xl bg-rose-50 py-3 text-[14px] text-stone-700 ring-1 ring-rose-200/60"
          >
            <RefreshCw size={14} />
            换一位
          </Pressable>
          <Pressable
            onClick={() => {
              if (signRecruitCandidate()) onClose()
            }}
            disabled={budget < RECRUIT_COST}
            className="flex-1 rounded-2xl bg-rose-400 py-3 text-[14px] font-semibold text-white shadow-md disabled:opacity-45"
          >
            签下他 · <AgentNumericText text={`¥${RECRUIT_COST.toLocaleString()}`} />
          </Pressable>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function TrainMenuOverlay({
  artistId,
  onClose,
  onTrained,
}: {
  artistId: string
  onClose: () => void
  onTrained: (flavor: string) => void
}) {
  const trainArtist = useAgentStore((s) => s.trainArtist)
  const budget = useAgentStore((s) => s.budget)

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end bg-black/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="agent-glass-nav w-full rounded-t-3xl px-4 pb-6 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="agent-serif mb-3 text-center text-[16px] font-semibold text-stone-800">安排培训</h3>
        <div className="space-y-2">
          {TRAIN_CONFIGS.map((cfg) => (
            <Pressable
              key={cfg.type}
              disabled={budget < cfg.cost}
              onClick={() => {
                if (trainArtist(artistId, cfg.type)) {
                  onTrained(cfg.flavor)
                  onClose()
                }
              }}
              className="agent-rose-card flex w-full items-center justify-between px-4 py-3 disabled:opacity-45"
            >
              <span className="text-[15px] font-medium text-stone-800">{cfg.label}</span>
              <span className="text-[13px] text-stone-500">
                <AgentNumericText text={`¥${cfg.cost} · +${cfg.delta}`} />
              </span>
            </Pressable>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function DateStoryOverlay({
  title,
  lines,
  onClose,
}: {
  title: string
  lines: string[]
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col bg-[#1a1215]/75 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex shrink-0 items-center justify-between px-4 pt-4">
        <p className="agent-serif text-rose-200 text-[15px]">{title}</p>
        <Pressable onClick={onClose} className="text-rose-200/80 p-2">
          <X size={20} />
        </Pressable>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="agent-serif text-center text-[18px] leading-[1.8] text-rose-50"
          >
            {lines[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
      <Pressable
        onClick={() => {
          if (idx < lines.length - 1) setIdx(idx + 1)
          else onClose()
        }}
        className="mx-6 mb-8 rounded-2xl bg-rose-400/90 py-3 text-center text-[15px] font-medium text-white"
      >
        {idx < lines.length - 1 ? '继续' : '结束约会'}
      </Pressable>
    </motion.div>
  )
}

export function TrainFlavorToast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 3200)
    return () => window.clearTimeout(t)
  }, [text]) // onDone 由父级内联传入，勿放入 deps 以免反复重置定时器

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="agent-story-dialog agent-serif absolute bottom-24 left-4 right-4 z-40 px-4 py-3 text-[14px] leading-relaxed text-stone-700"
    >
      {text}
    </motion.div>
  )
}