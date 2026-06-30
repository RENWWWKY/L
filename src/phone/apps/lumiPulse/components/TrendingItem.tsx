import { motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { PULSE_COLORS } from '../constants'
import type { PulseTrendingTag, PulseTrendingTopic } from '../pulseTypes'

const TAG_STYLE: Record<PulseTrendingTag, string> = {
  新: 'bg-[#A3C4BC] text-white',
  热: 'bg-[#E5989B] text-white',
  爆: 'bg-[#D4AF37] text-white',
}

function rankColor(rank: number): string {
  if (rank === 1) return PULSE_COLORS.lightGold
  if (rank === 2) return PULSE_COLORS.dustyRose
  if (rank === 3) return PULSE_COLORS.dustyRose
  return '#D1D5DB'
}

export function TrendingItem({
  topic,
  index,
  onPress,
}: {
  topic: PulseTrendingTopic
  index: number
  onPress?: () => void
}) {
  const rank = index + 1

  const body = (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0 },
      }}
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
    >
      <span
        className="w-7 shrink-0 text-center font-mono text-[17px] font-semibold tabular-nums"
        style={{ color: rankColor(rank) }}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[15px] text-[#1C1C1E]">{topic.title}</p>
        {topic.excerpt ? (
          <p className="mt-0.5 truncate text-[12px] text-neutral-400">{topic.excerpt}</p>
        ) : null}
      </div>
      {topic.tag ? (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${TAG_STYLE[topic.tag]}`}
        >
          {topic.tag}
        </span>
      ) : null}
    </motion.div>
  )

  if (!onPress) return body
  return (
    <Pressable type="button" onClick={onPress} className="block w-full text-left">
      {body}
    </Pressable>
  )
}
