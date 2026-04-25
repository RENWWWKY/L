import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { Pressable } from '../../../components/Pressable'
import { TransactionHistory } from './TransactionHistory'
import { useWalletMockStore } from './walletMockStore'

import walletBg from '../../../../../image/钱包页背景图.png'

export function WalletAffectionTransactionsPage({
  cardId,
  giverName,
  onBack,
}: {
  cardId: string
  giverName: string
  onBack: () => void
}) {
  const { snapshot } = useWalletMockStore()

  const items = useMemo(() => {
    const affectionAll = snapshot.transactions.filter((t) => t.type === 'affection')
    const byCardId = affectionAll.filter((t) => t.meta?.affectionCardId === cardId)
    if (byCardId.length > 0) return byCardId
    const byGiver = affectionAll.filter((t) => (t.meta?.giverName ?? '').trim() === giverName.trim())
    if (byGiver.length > 0) return byGiver
    // 再兜底：若旧存档仍无 meta，至少展示全部亲情卡流水，避免“空白页”
    return affectionAll
  }, [cardId, giverName, snapshot.transactions])

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-no-repeat opacity-[1]"
          style={{
            backgroundImage: `url(${walletBg})`,
            backgroundPosition: 'center bottom',
            backgroundSize: 'cover',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/18 to-white/0" />
      </div>

      <header
        className="relative z-[1] flex shrink-0 items-center border-b border-white/60 bg-white/55 px-2 py-1 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.98]">
          <ChevronLeft className="size-6 text-black" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-11 text-center">
          <div className="truncate text-[16px] font-semibold text-black">{giverName} · 亲情卡流水</div>
        </div>
      </header>

      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {items.length ? (
          <TransactionHistory items={items} variant="glass" />
        ) : (
          <div className="rounded-[28px] border border-white/60 bg-white/40 px-5 py-10 text-center text-[13px] text-gray-500 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]">
            暂无该亲情卡的交易记录
          </div>
        )}
      </div>
    </motion.div>
  )
}

