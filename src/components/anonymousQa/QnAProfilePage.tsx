import { motion } from 'framer-motion'

import type { QnAProfileTab, Question } from './types'

const STAT_BLOCKS: { key: QnAProfileTab; labelZh: string; labelEn: string }[] = [
  { key: 'received', labelZh: '被提问', labelEn: 'RECEIVED' },
  { key: 'asked', labelZh: '我的提问', labelEn: 'ASKED' },
  { key: 'answered', labelZh: '我的回答', labelEn: 'ANSWERED' },
  { key: 'liked', labelZh: '我的点赞', labelEn: 'LIKED' },
  { key: 'commented', labelZh: '我的评论', labelEn: 'COMMENTED' },
]

type QnAProfilePageProps = {
  questions: Question[]
  listByTab: Record<string, string[]>
  activeTab: QnAProfileTab
  onTab: (t: QnAProfileTab) => void
  onOpenQuestion: (id: string, opts?: { fromReceivedUnread?: boolean }) => void
}

export function QnAProfilePage({
  questions,
  listByTab,
  activeTab,
  onTab,
  onOpenQuestion,
}: QnAProfilePageProps) {
  const ids = listByTab[activeTab] ?? []
  const list = ids.map((id) => questions.find((q) => q.id === id)).filter(Boolean) as Question[]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <p className="mb-3 text-[10px] tracking-[0.28em] text-[#9CA3AF]">PROFILE</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STAT_BLOCKS.map((b) => (
          <motion.button
            key={b.key}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onTab(b.key)}
            className={`rounded-2xl border px-3 py-3 text-left ${
              activeTab === b.key
                ? 'border-[#111827] bg-white/34 shadow-sm backdrop-blur-[3px]'
                : 'border-black/8 bg-white/24 backdrop-blur-[3px]'
            }`}
          >
            <p className="text-[22px] font-semibold tabular-nums text-[#111827]">
              {(listByTab[b.key] ?? []).length}
            </p>
            <p className="mt-1 text-[12px] text-[#374151]">{b.labelZh}</p>
            <p className="text-[9px] tracking-[0.2em] text-[#9CA3AF]">{b.labelEn}</p>
          </motion.button>
        ))}
      </div>

      <p className="mb-2 mt-8 text-[10px] tracking-[0.28em] text-[#9CA3AF]">LIST</p>
      <div className="space-y-3">
        {list.map((q, idx) => (
          <motion.button
            key={q.id}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(0.05 * idx, 0.2) }}
            whileTap={{ scale: 0.985 }}
            onClick={() =>
              onOpenQuestion(q.id, {
                fromReceivedUnread: activeTab === 'received' && !!q.unreadForCurrentUser,
              })
            }
            className="w-full rounded-2xl border border-black/8 bg-white/30 p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-[3px]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-[15px] leading-relaxed text-[#111827]">
                {activeTab === 'received' && q.visibility === 'directed' && q.unreadForCurrentUser
                  ? '一封由你定向回答的匿名信'
                  : q.body}
              </p>
              {activeTab === 'received' && q.unreadForCurrentUser ? (
                <span className="shrink-0 rounded-full bg-[#111827] px-2 py-0.5 text-[10px] text-white">新</span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <span>{q.visibility === 'directed' ? '定向提问' : '公开提问'}</span>
              <span>{Math.max(0, q.answers.length)} 回答</span>
            </div>
          </motion.button>
        ))}
        {list.length === 0 ? <p className="py-8 text-center text-[13px] text-[#9CA3AF]">暂无内容</p> : null}
      </div>
    </div>
  )
}
