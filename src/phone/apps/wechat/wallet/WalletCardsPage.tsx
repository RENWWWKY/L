import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { WalletAuthGuard } from './WalletAuthGuard'
import { WalletDashboard } from './WalletDashboard'
import { useWalletMockStore } from './walletMockStore'

import walletBg from '../../../../../image/钱包页背景图.png'

export function WalletCardsPage({
  onBack,
  onOpenTransactions,
  onOpenAffectionCards,
  onOpenBankCards,
  onOpenWealth,
}: {
  onBack: () => void
  onOpenTransactions: () => void
  onOpenAffectionCards: () => void
  onOpenBankCards: () => void
  onOpenWealth: () => void
}) {
  const { snapshot, balanceText, verifyPaymentPassword, setPaymentPassword, addBankCard, topUp, withdraw } = useWalletMockStore()

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
    >
      {/* 全页背景图（不影响交互与滚动） */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-no-repeat opacity-[0.85]"
          style={{
            backgroundImage: `url(${walletBg})`,
            backgroundPosition: 'center bottom',
            backgroundSize: 'cover',
          }}
        />
        {/* 轻白雾：保证文字/卡片可读，但不过度遮挡 */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/35 to-white/10" />
      </div>

      <header
        className="relative z-[1] flex shrink-0 items-center border-b border-white/60 bg-white/55 px-2 py-1 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        style={{ paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" aria-label="返回" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.98]">
          <ChevronLeft className="size-6 text-black" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 pr-11 text-center">
          <div className="text-[16px] font-semibold text-black">卡包</div>
        </div>
      </header>

      <div className="relative z-[1] min-h-0 flex-1">
        <WalletAuthGuard isReady={snapshot.isPaymentPasswordSet} onComplete={setPaymentPassword}>
          <WalletDashboard
            balance={snapshot.balance}
            balanceText={balanceText}
            bankCards={snapshot.bankCards}
            affectionCards={snapshot.affectionCards}
            transactions={snapshot.transactions}
            verifyPaymentPassword={verifyPaymentPassword}
            onTopUp={topUp}
            onWithdraw={withdraw}
            onAddBankCard={addBankCard}
            onChangePassword={setPaymentPassword}
            onOpenTransactions={onOpenTransactions}
            onOpenAffectionCards={onOpenAffectionCards}
            onOpenBankCards={onOpenBankCards}
            onOpenWealth={onOpenWealth}
          />
        </WalletAuthGuard>
      </div>
    </motion.div>
  )
}
