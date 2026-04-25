import { ArrowDownLeft, ArrowUpRight, HeartHandshake, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

import type { WalletTransaction } from './walletMockStore'

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
}

function getIcon(type: WalletTransaction['type']) {
  switch (type) {
    case 'topup':
      return ArrowDownLeft
    case 'withdraw':
      return ArrowUpRight
    case 'affection':
      return HeartHandshake
    default:
      return Wallet
  }
}

export function TransactionHistory({
  items,
  variant = 'solid',
}: {
  items: WalletTransaction[]
  variant?: 'solid' | 'glass'
}) {
  const wrapClass =
    variant === 'glass'
      ? 'rounded-[28px] border border-white/60 bg-white/40 px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]'
      : 'rounded-[28px] border border-gray-100 bg-white px-5 py-5 shadow-sm'
  const rowClass =
    variant === 'glass'
      ? 'flex items-center gap-3 rounded-[20px] border border-white/55 bg-white/25 px-4 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]'
      : 'flex items-center gap-3 rounded-[20px] border border-gray-100 px-4 py-3'
  const iconWrapClass =
    variant === 'glass'
      ? 'flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/35 text-gray-700 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)]'
      : 'flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-700'

  return (
    <section className={wrapClass}>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] tracking-[0.28em] text-gray-400">TRANSACTIONS</p>
          <h3 className="mt-2 text-[20px] font-semibold text-black">交易流水</h3>
        </div>
        <p className="text-[12px] text-gray-400">{items.length} records</p>
      </div>

      <motion.div
        className="mt-4 space-y-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {items.map((item) => {
          const Icon = getIcon(item.type)
          const positive = item.amount > 0
          return (
            <motion.div
              key={item.id}
              variants={itemVariants}
              className={rowClass}
            >
              <div className={iconWrapClass}>
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-black">{item.title}</p>
                <p className="mt-1 text-[12px] text-gray-400">{item.subtitle}</p>
              </div>
              <p className={`text-[15px] font-semibold tabular-nums ${positive ? 'text-black' : 'text-gray-400'}`}>
                {positive ? '+' : '-'} {Math.abs(item.amount).toFixed(2)}
              </p>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
