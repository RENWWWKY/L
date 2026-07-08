import { useState } from 'react'

import { AnimatePresence, motion } from 'framer-motion'



import { Pressable } from '../../../components/Pressable'

import { GAME_CATALOG } from './gameCatalog'

import type { MiniGameType } from './types'



export function GameLobbySheet({

  open,

  onClose,

  onSendInvite,

}: {

  open: boolean

  onClose: () => void

  onSendInvite: (game: MiniGameType) => void

}) {

  const [selected, setSelected] = useState<MiniGameType | null>(null)



  const selectedEntry = selected ? GAME_CATALOG.find((g) => g.id === selected) : null

  const canLaunch = selectedEntry?.available === true



  const handleSendInvite = () => {

    if (!selected || !canLaunch) return

    onSendInvite(selected)

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

                  const disabled = game.available === false

                  return (

                    <Pressable

                      key={game.id}

                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 transition-colors ${

                        active ? 'bg-[#0A0A0C] text-white' : 'bg-[#F9FAFB] text-[#0A0A0C] active:bg-[#F3F4F6]'

                      } ${disabled ? 'opacity-55' : ''}`}

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

                        {disabled ? '开发中' : game.subtitle}

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

                  {!canLaunch ? (

                    <p className="text-[13px] text-[#9CA3AF]">该游戏尚在开发中，请先选择已开放的游戏。</p>

                  ) : (

                    <Pressable

                      className="flex w-full items-center justify-center rounded-xl bg-[#0A0A0C] py-3 text-[14px] font-medium text-white active:opacity-90"

                      onClick={handleSendInvite}

                    >

                      发送游戏邀请

                    </Pressable>

                  )}

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


