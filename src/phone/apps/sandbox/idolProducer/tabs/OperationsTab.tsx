import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import type { HotSearchItem } from '../agentTypes'
import { AgentNum, AgentNumericText } from '../components/AgentNumeric'
import { useAnimatedNumber } from '../useAnimatedNumber'
import { useAgentStore } from '../useAgentStore'

function FinancePanel() {
  const budget = useAgentStore((s) => s.budget)
  const reputation = useAgentStore((s) => s.reputation)
  const animBudget = useAnimatedNumber(budget)
  const animRep = useAnimatedNumber(reputation)

  return (
    <div className="agent-rose-card grid grid-cols-2 gap-3 p-4">
      <div>
        <p className="text-[12px] text-stone-500">公司资金</p>
        <motion.p
          key={animBudget}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          className="text-[22px] text-stone-800"
        >
          <AgentNumericText text={`¥${animBudget.toLocaleString()}`} className="font-bold" />
        </motion.p>
      </div>
      <div>
        <p className="text-[12px] text-stone-500">公司声望</p>
        <motion.p
          key={animRep}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          className="text-[22px] text-rose-500"
        >
          <AgentNum className="font-bold">{animRep}</AgentNum>
        </motion.p>
      </div>
    </div>
  )
}

function HotSearchRow({
  item,
  onAction,
}: {
  item: HotSearchItem
  onAction: () => void
}) {
  return (
    <Pressable
      onClick={onAction}
      className="flex items-center gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-rose-50/80"
    >
      <AgentNum className="w-5 text-center text-[13px] text-rose-300">{item.rank}</AgentNum>
      {item.heat >= 90 ? (
        <span className="agent-hot-badge-boil">沸</span>
      ) : item.heat >= 75 ? (
        <span className="agent-hot-badge-hot">热</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[14px] text-stone-800">{item.keyword}</span>
      {item.type === 'negative' && (
        <span className="text-[10px] text-rose-500 shrink-0">舆情</span>
      )}
    </Pressable>
  )
}

export function OperationsTab() {
  const hotSearches = useAgentStore((s) => s.hotSearches)
  const tickHotSearches = useAgentStore((s) => s.tickHotSearches)
  const withdrawHotSearch = useAgentStore((s) => s.withdrawHotSearch)
  const lawyerLetter = useAgentStore((s) => s.lawyerLetter)
  const buyHype = useAgentStore((s) => s.buyHype)
  const budget = useAgentStore((s) => s.budget)
  const reputation = useAgentStore((s) => s.reputation)

  const [modal, setModal] = useState<HotSearchItem | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => tickHotSearches(), 1000)
    return () => window.clearInterval(id)
  }, [tickHotSearches])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-4 pt-1">
      <FinancePanel />

      <div className="mt-4">
        <h3 className="agent-serif mb-2 text-[17px] font-semibold text-stone-800">微博热搜榜</h3>
        <div className="agent-rose-card divide-y divide-rose-100/60 p-2">
          {hotSearches.map((item) => (
            <HotSearchRow key={item.id} item={item} onAction={() => setModal(item)} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="agent-rose-card w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="agent-serif text-[16px] font-semibold text-stone-800">{modal.keyword}</p>
              <p className="mt-1 text-[12px] text-stone-500">
                热度 <AgentNum>{modal.heat}</AgentNum>
                · {modal.type === 'negative' ? '负面舆情' : '正面话题'}
              </p>

              <div className="mt-4 space-y-2">
                {modal.type === 'negative' ? (
                  <>
                    <Pressable
                      disabled={budget < 12000}
                      onClick={() => {
                        if (withdrawHotSearch(modal.id)) setModal(null)
                      }}
                      className="w-full rounded-2xl bg-rose-400 py-3 text-[14px] font-medium text-white disabled:opacity-45"
                    >
                      撤热搜 · <AgentNum>¥12,000</AgentNum>
                    </Pressable>
                    <Pressable
                      disabled={reputation < 6}
                      onClick={() => {
                        if (lawyerLetter(modal.id)) setModal(null)
                      }}
                      className="w-full rounded-2xl bg-white py-3 text-[14px] font-medium text-stone-800 ring-1 ring-rose-200 disabled:opacity-45"
                    >
                      发律师函 · 声望 <AgentNum>-6</AgentNum>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    disabled={budget < 6000}
                    onClick={() => {
                      if (buyHype(modal.id)) setModal(null)
                    }}
                    className="w-full rounded-2xl bg-rose-400 py-3 text-[14px] font-medium text-white disabled:opacity-45"
                  >
                    买水军加热 · <AgentNum>¥6,000</AgentNum>
                  </Pressable>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
