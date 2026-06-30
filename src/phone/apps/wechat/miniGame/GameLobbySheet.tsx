import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { GAME_CATALOG } from './gameCatalog'
import type { MiniGameType } from './types'

export function GameLobbySheet({
  open,
  onClose,
  onLaunch,
}: {
  open: boolean
  onClose: () => void
  onLaunch: (game: MiniGameType, reactionEnabled: boolean) => void
}) {
  const [selected, setSelected] = useState<MiniGameType | null>(null)
  const [reactionEnabled, setReactionEnabled] = useState(true)

  const handleLaunch = () => {
    if (!selected) return
    onLaunch(selected, reactionEnabled)
    setSelected(null)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1350] bg-black/20 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[520px] rounded-t-[24px] border border-[#E5E7EB]/80 bg-white/90 backdrop-blur-xl"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D1D5DB]" aria-hidden />
              <div className="mb-1 text-[11px] tracking-[0.12em] text-[#9CA3AF]">小游戏</div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[20px] font-medium tracking-tight text-[#0A0A0C]">一起玩游戏</h2>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-[12px] text-[#6B7280] active:bg-black/5"
                  onClick={onClose}
                >
                  关闭
                </button>
              </div>

              <div className="max-h-[42vh] space-y-1 overflow-y-auto">
                {GAME_CATALOG.map((game) => {
                  const active = selected === game.id
                  return (
                    <Pressable
                      key={game.id}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 transition-colors ${
                        active ? 'bg-[#0A0A0C] text-white' : 'bg-[#F9FAFB] text-[#0A0A0C] active:bg-[#F3F4F6]'
                      }`}
                      onClick={() => setSelected(game.id)}
                    >
                      <div className="min-w-0 text-left">
                        <div
                          className="text-[15px] font-medium"
                          style={{ fontFamily: 'var(--phone-font, "Noto Serif SC", serif)' }}
                        >
                          {game.zh}
                        </div>
                      </div>
                      <div className={`text-[10px] tracking-wider ${active ? 'text-[#D4D4D8]' : 'text-[#9CA3AF]'}`}>
                        {game.subtitle}
                      </div>
                    </Pressable>
                  )
                })}
              </div>

              {selected ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 overflow-hidden border-t border-[#E5E7EB] pt-4"
                >
                  <div className="text-[10px] tracking-[0.12em] text-[#9CA3AF]">设置</div>
                  <label className="mt-2 flex cursor-pointer items-center justify-between">
                    <span className="text-[13px] text-[#374151]">开启伴玩反馈</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reactionEnabled}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        reactionEnabled ? 'bg-[#0A0A0C]' : 'bg-[#E5E7EB]'
                      }`}
                      onClick={() => setReactionEnabled((v) => !v)}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          reactionEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  <p className="mt-2 text-[12px] italic text-[#9CA3AF]">
                    开启后，他将在观察或对局中给出实时情感反馈。
                  </p>

                  <Pressable
                    className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#0A0A0C] py-3 text-[14px] font-medium text-white active:opacity-90"
                    onClick={handleLaunch}
                  >
                    进入游戏
                  </Pressable>
                </motion.div>
              ) : (
                <p className="mt-4 text-center text-[12px] text-[#9CA3AF]">选择一款游戏以继续</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
