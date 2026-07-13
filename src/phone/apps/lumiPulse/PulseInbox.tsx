import { AnimatePresence, motion } from 'framer-motion'
import { AtSign, Heart, MessageCircle, Repeat2, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { NotificationCell } from './components/NotificationCell'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from './constants'
import { aiGeneratePulseDmThreads, flatToDmThreads } from './lumiPulseAi'
import type { PulseDmThread, PulseInteraction } from './pulseTypes'
import { usePulseDmThreads, usePulseInteractions } from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

type InboxCategory = 'all' | 'mention' | 'comment' | 'like' | 'repost'

function DmThreadView({ thread, onBack }: { thread: PulseDmThread; onBack: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[1180] flex flex-col bg-[#FCFCFC]"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={PULSE_MODAL_SPRING}
    >
      <header className="flex items-center gap-3 bg-white/90 px-4 py-3 shadow-[0_2px_15px_rgba(0,0,0,0.03)] backdrop-blur-xl">
        <Pressable type="button" onClick={onBack} className="text-[13px] text-neutral-500">
          返回
        </Pressable>
        <span className="text-[15px] font-medium text-[#1C1C1E]">{thread.fanName}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`mb-3 max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
              m.fromFan
                ? 'bg-white text-[#1C1C1E] shadow-[0_2px_15px_rgba(0,0,0,0.03)]'
                : 'ml-auto bg-[#1C1C1E] text-white'
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function interactionLabel(it: PulseInteraction): string {
  switch (it.type) {
    case 'like':
      return ' 赞了你'
    case 'comment':
      return ' 评论了你'
    case 'mention':
      return ' @了你'
    case 'repost':
      return ' 转发了你'
    case 'follow':
      return ' 关注了你'
    default:
      return ' 互动了你'
  }
}

function matchesCategory(it: PulseInteraction, cat: InboxCategory): boolean {
  if (cat === 'all') return true
  return it.type === cat
}

export function PulseInbox({ povName, currentPlayerPovId }: { povName: string; currentPlayerPovId: string }) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const interactions = usePulseInteractions()
  const dmThreads = usePulseDmThreads()
  const replaceDmThreads = usePulseStore((s) => s.replaceDmThreads)
  const markDmRead = usePulseStore((s) => s.markDmThreadRead)
  const markInteractionsReadByType = usePulseStore((s) => s.markInteractionsReadByType)
  const [activeDm, setActiveDm] = useState<PulseDmThread | null>(null)
  const [genDm, setGenDm] = useState(false)
  const [category, setCategory] = useState<InboxCategory>('all')

  const unreadByType = useMemo(() => {
    const unread = interactions.filter((i) => !i.read)
    return {
      mention: unread.some((i) => i.type === 'mention'),
      comment: unread.some((i) => i.type === 'comment'),
      like: unread.some((i) => i.type === 'like'),
      repost: unread.some((i) => i.type === 'repost'),
    }
  }, [interactions])

  const filteredInteractions = useMemo(
    () => interactions.filter((it) => matchesCategory(it, category)),
    [interactions, category],
  )

  const generateDm = useCallback(async () => {
    setGenDm(true)
    try {
      const rows = await aiGeneratePulseDmThreads({ apiConfig, povName, threadCount: 4 })
      replaceDmThreads(flatToDmThreads(rows), currentPlayerPovId)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenDm(false)
    }
  }, [apiConfig, currentPlayerPovId, povName, replaceDmThreads])

  const pickCategory = (cat: InboxCategory) => {
    setCategory(cat)
    if (cat !== 'all') markInteractionsReadByType(cat)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFC]">
        <div className="shrink-0 px-4 pb-2 pt-2">
          <h2 className="text-[17px] font-semibold text-[#1C1C1E]">消息</h2>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            <NotificationCell
              label="@ 我的"
              Icon={AtSign}
              tintBg="rgba(162,178,198,0.2)"
              iconColor={PULSE_COLORS.mistBlue}
              unread={unreadByType.mention}
              active={category === 'mention'}
              onPress={() => pickCategory(category === 'mention' ? 'all' : 'mention')}
            />
            <NotificationCell
              label="评论"
              Icon={MessageCircle}
              tintBg="rgba(163,196,188,0.2)"
              iconColor={PULSE_COLORS.sage}
              unread={unreadByType.comment}
              active={category === 'comment'}
              onPress={() => pickCategory(category === 'comment' ? 'all' : 'comment')}
            />
            <NotificationCell
              label="赞"
              Icon={Heart}
              tintBg="rgba(229,152,155,0.2)"
              iconColor={PULSE_COLORS.dustyRose}
              unread={unreadByType.like}
              active={category === 'like'}
              onPress={() => pickCategory(category === 'like' ? 'all' : 'like')}
            />
            <NotificationCell
              label="转发"
              Icon={Repeat2}
              tintBg="rgba(212,175,55,0.15)"
              iconColor={PULSE_COLORS.lightGold}
              unread={unreadByType.repost}
              active={category === 'repost'}
              onPress={() => pickCategory(category === 'repost' ? 'all' : 'repost')}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-medium tracking-wide text-neutral-500">私信</p>
            <Pressable
              type="button"
              onClick={() => void generateDm()}
              disabled={genDm}
              className="flex items-center gap-1 text-[11px] tracking-wide text-neutral-500"
            >
              <Sparkles className="size-3.5" strokeWidth={1.3} style={{ color: PULSE_COLORS.lightGold }} />
              {genDm ? '召唤中…' : '生成网友私信'}
            </Pressable>
          </div>

          {filteredInteractions.length > 0 ? (
            <div className="mb-5 space-y-2">
              {filteredInteractions.slice(0, 8).map((it) => (
                <div
                  key={it.id}
                  className={`rounded-2xl bg-white px-4 py-3 shadow-[0_2px_15px_rgba(0,0,0,0.03)] ${
                    !it.read ? 'ring-1 ring-[#E5989B]/20' : ''
                  }`}
                >
                  <p className="text-[13px] text-[#1C1C1E]">
                    <span className="font-medium">{it.fromName}</span>
                    {interactionLabel(it)}
                  </p>
                  {it.content ? (
                    <p className="mt-1 font-serif text-[12px] text-neutral-500">{it.content}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : category !== 'all' ? (
            <p className="mb-5 py-6 text-center text-[12px] text-neutral-400">该分类暂无新互动</p>
          ) : null}

          {dmThreads.map((t) => (
            <Pressable
              key={t.id}
              type="button"
              onClick={() => {
                markDmRead(t.id)
                setActiveDm(t)
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
            >
              {t.fanAvatarUrl ? (
                <img src={t.fanAvatarUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="size-12 shrink-0 rounded-full bg-[#F5F5F4]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-[#1C1C1E]">{t.fanName}</span>
                  {t.unread > 0 ? (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                    />
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-neutral-400">{t.lastMessage}</p>
              </div>
            </Pressable>
          ))}

          {!dmThreads.length && !interactions.length ? (
            <p className="py-16 text-center text-[13px] text-neutral-400">暂无消息</p>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {activeDm ? <DmThreadView thread={activeDm} onBack={() => setActiveDm(null)} /> : null}
      </AnimatePresence>
    </>
  )
}
