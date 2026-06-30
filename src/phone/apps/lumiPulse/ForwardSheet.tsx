import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { PersonaRosterAvatar } from '../wechat/newFriendsPersona/personaRoster/PersonaRosterAvatar'
import { PULSE_COLORS, PULSE_SHEET_SPRING } from './constants'
import type { PulsePost } from './pulseTypes'
import { sendPulseShareToWeChatContacts } from './pulseWechatBridge'

export function ForwardSheet({
  post,
  onClose,
  onSent,
}: {
  post: PulsePost
  onClose: () => void
  onSent: () => void
}) {
  const { state } = useCustomization()
  const contacts = useMemo(
    () => state.wechatPersonaContacts.filter((c) => c.characterId?.trim()),
    [state.wechatPersonaContacts],
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const send = async () => {
    if (!picked.size || sending) return
    setSending(true)
    try {
      await sendPulseShareToWeChatContacts([...picked], {
        postId: post.id,
        authorName: post.authorName,
        content: post.content,
        excerpt: post.content.slice(0, 120),
      })
      onSent()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <motion.button
        type="button"
        className="fixed inset-0 z-[1300] bg-black/15 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-label="关闭"
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[1310] max-h-[72vh] overflow-hidden rounded-t-[24px] bg-white/95 backdrop-blur-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SHEET_SPRING}
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/10" />
        <div className="px-5 pt-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-400">Forward to WeChat</p>
          <h2 className="mt-1 font-serif text-[17px] text-[#1C1C1E]">发送给微信好友</h2>
          <p className="mt-2 line-clamp-2 font-serif text-[12px] leading-relaxed text-neutral-500">
            {post.content}
          </p>
        </div>

        <div className="mt-4 max-h-[40vh] overflow-y-auto px-3">
          {contacts.map((c) => {
            const id = c.characterId.trim()
            const active = picked.has(id)
            return (
              <Pressable
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 ${
                  active ? 'bg-[#FCFCFC] shadow-[0_2px_15px_rgba(0,0,0,0.03)]' : ''
                }`}
              >
                <PersonaRosterAvatar character={{ avatarUrl: c.avatarUrl, mbti: undefined }} size={40} />
                <span className="min-w-0 flex-1 truncate text-left text-[14px] text-[#1C1C1E]">
                  {c.remarkName?.trim() || '未命名'}
                </span>
                <span
                  className={`size-4 rounded-full border-2 ${
                    active ? 'border-transparent' : 'border-neutral-200'
                  }`}
                  style={active ? { backgroundColor: PULSE_COLORS.dustyRose } : undefined}
                />
              </Pressable>
            )
          })}
          {!contacts.length ? (
            <p className="px-3 py-6 text-center text-[12px] text-neutral-400">微信通讯录暂无角色</p>
          ) : null}
        </div>

        <div className="px-5 pt-3">
          <Pressable
            type="button"
            disabled={!picked.size || sending}
            onClick={() => void send()}
            className="flex w-full items-center justify-center rounded-full bg-[#1C1C1E] py-3.5 text-[12px] tracking-wide text-white disabled:opacity-40"
          >
            {sending ? '投递中…' : '发送'}
          </Pressable>
        </div>
      </motion.div>
    </>
  )
}
