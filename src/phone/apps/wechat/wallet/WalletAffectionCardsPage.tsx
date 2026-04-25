import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { AffectionCard, AffectionCardBack } from './AffectionCard'
import { useWalletMockStore } from './walletMockStore'

import walletBg from '../../../../../image/钱包页背景图.png'

export function WalletAffectionCardsPage({
  onBack,
  onOpenCardTransactions,
}: {
  onBack: () => void
  onOpenCardTransactions: (payload: { cardId: string; giverName: string }) => void
}) {
  const { snapshot } = useWalletMockStore()
  const [flippedCardIds, setFlippedCardIds] = useState<Set<string>>(() => new Set())

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
          className="absolute inset-0 bg-no-repeat opacity-[0.85]"
          style={{
            backgroundImage: `url(${walletBg})`,
            backgroundPosition: 'center bottom',
            backgroundSize: 'cover',
          }}
        />
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
          <div className="text-[16px] font-semibold text-black">亲情卡</div>
        </div>
      </header>

      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[560px]">
          <p className="text-[11px] tracking-[0.28em] text-gray-400">CARDS</p>
          <p className="mt-2 text-[13px] text-gray-400">Affection Cards</p>

          <div className="mt-5 grid gap-4">
            {snapshot.affectionCards.map((card) => {
              const flipped = flippedCardIds.has(card.id)
              return (
                <div
                  key={card.id}
                  className="relative h-[250px] w-full [perspective:1100px] [perspective-origin:50%_50%]"
                >
                  <motion.button
                    type="button"
                    onClick={() =>
                      setFlippedCardIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(card.id)) next.delete(card.id)
                        else next.add(card.id)
                        return next
                      })
                    }
                    className="relative block h-full w-full cursor-pointer select-none rounded-[26px] border-0 bg-transparent p-0 text-left"
                  >
                    <motion.div
                      className="relative h-full w-full origin-center [transform-style:preserve-3d]"
                      style={{ transformStyle: 'preserve-3d', transformOrigin: 'center center' }}
                      animate={{ rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="absolute inset-0 flex items-center justify-center p-3 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
                        style={{ transform: 'translateZ(0)' }}
                      >
                        <AffectionCard
                          senderName={card.giverName}
                          senderAvatar={card.giverAvatar}
                          signature={card.signature?.trim() ? `Always yours, ${card.signature.trim()}` : `Always yours, ${card.giverName}`}
                          quote={card.message?.trim() ? card.message.trim() : 'Buy whatever makes you smile.'}
                          balance={card.monthlyRemaining}
                          limit={card.monthlyLimit}
                          onOpenTransactions={() => onOpenCardTransactions({ cardId: card.id, giverName: card.giverName })}
                        />
                      </div>

                      <div
                        className="absolute inset-0 flex items-center justify-center p-3 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
                        style={{ transform: 'rotateY(180deg) translateZ(0)' }}
                      >
                        <AffectionCardBack
                          giverName={card.giverName}
                          blessing={card.blessing?.trim() || '把这份底气，都留给你。'}
                        />
                      </div>
                    </motion.div>
                  </motion.button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

