import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { useCustomization } from '../../../../CustomizationContext'
import type { Artist, ChatMessage } from '../agentTypes'
import { AgentNumericText } from './AgentNumeric'
import { useAgentStore } from '../useAgentStore'

const EMPTY_CHAT_THREAD: ChatMessage[] = []

function SendPlaneIcon({ color }: { color: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

function ArtistAvatarBubble({
  artist,
  size = 40,
}: {
  artist: Artist
  size?: number
}) {
  return (
    <div
      className="agent-artist-avatar flex shrink-0 items-center justify-center font-semibold ring-1 ring-black/[0.04]"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        fontSize: size * 0.38,
      }}
    >
      {artist.name.slice(0, 1)}
    </div>
  )
}

function ChatBubble({
  message,
  artist,
}: {
  message: ChatMessage
  artist: Artist
}) {
  const isSelf = message.role === 'user'
  return (
    <div
      className={`flex w-full max-w-full shrink-0 ${isSelf ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`flex max-w-[calc(100vw-24px-24px-80px)] items-end gap-3 ${
          isSelf ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {!isSelf && <ArtistAvatarBubble artist={artist} />}
        <div
          className={`px-3 py-2.5 text-[16px] leading-[1.45] ${
            isSelf
              ? 'rounded-[18px] rounded-br-[4px] text-white'
              : 'rounded-[18px] rounded-bl-[4px] text-stone-800 shadow-sm ring-1 ring-black/[0.04]'
          }`}
          style={{
            background: isSelf ? '#f9a8c4' : '#ffffff',
          }}
        >
          <AgentNumericText text={message.content} />
        </div>
      </div>
    </div>
  )
}

/**
 * 线上联络 · 全页通讯（布局对齐微信私聊：顶栏 + 灰底消息区 + 底栏输入）
 */
export function ArtistChatRoom({
  artist,
  onBack,
}: {
  artist: Artist
  onBack: () => void
}) {
  const { themeStyle, wechatThemeStyle } = useCustomization()
  const thread = useAgentStore((s) => s.chatThreads[artist.id] ?? EMPTY_CHAT_THREAD)
  const sendChatMessage = useAgentStore((s) => s.sendChatMessage)
  const liveArtist = useAgentStore((s) => s.artists.find((a) => a.id === artist.id) ?? artist)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const chatStyle = useMemo(
    () => ({
      ...themeStyle,
      ...wechatThemeStyle,
      fontFamily: 'var(--phone-font)',
      fontSize: 'var(--wx-font-size, 16px)',
      color: 'var(--wx-text, #1a1a1a)',
      background: '#ededed',
    }),
    [themeStyle, wechatThemeStyle],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [thread.length, sending])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    try {
      await sendChatMessage(artist.id, text)
    } finally {
      setSending(false)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
  }, [artist.id, draft, sending, sendChatMessage])

  return (
    <div className="flex h-full min-h-0 flex-col" style={chatStyle}>
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 pb-2"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          borderColor: 'var(--wx-border, rgba(0,0,0,0.08))',
          background: 'var(--wx-surface, #f7f7f7)',
        }}
      >
        <div className="flex w-10 shrink-0 items-center justify-start">
          <Pressable
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text, #1a1a1a)' }}
            aria-label="返回"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Pressable>
        </div>
        <div className="min-w-0 flex-1 px-1 text-center">
          <h1
            className="truncate text-[16px] font-medium leading-tight"
            style={{ color: 'var(--wx-text, #1a1a1a)' }}
          >
            {liveArtist.name}
          </h1>
          <p className="mt-0.5 text-[11px] text-stone-500">
            <AgentNumericText text={`线上联络 · 好感 ${liveArtist.metrics.affection}`} />
          </p>
        </div>
        <div className="flex w-10 shrink-0 items-center justify-end">
          <ArtistAvatarBubble artist={liveArtist} size={32} />
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        {thread.length === 0 && !sending ? (
          <p className="px-6 py-8 text-center text-[13px] leading-relaxed text-stone-500">
            发一条消息，{liveArtist.name}会以人设与你实时对话。
          </p>
        ) : null}
        <div className="flex flex-col gap-3 px-[24px]">
          {thread.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <ChatBubble message={m} artist={liveArtist} />
            </motion.div>
          ))}
          {sending ? (
            <div className="flex justify-start pl-0">
              <div className="flex items-end gap-3">
                <ArtistAvatarBubble artist={liveArtist} />
                <div
                  className="rounded-[18px] rounded-bl-[4px] bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.04]"
                  aria-live="polite"
                  aria-label="对方正在输入"
                >
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-stone-400"
                        style={{
                          animation: 'agentChatTyping 1.2s ease-in-out infinite',
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="relative z-10 w-full shrink-0 border-t"
        style={{
          backgroundColor: 'var(--wx-input-bg, #f7f7f7)',
          borderTopColor: 'var(--wx-border, rgba(0,0,0,0.08))',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex w-full max-w-full items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="说点什么…"
            rows={1}
            disabled={sending}
            className="min-h-[44px] min-w-0 flex-1 resize-none bg-white text-[16px] leading-snug tabular-nums outline-none disabled:opacity-60"
            style={{
              borderRadius: 'var(--wx-radius, 8px)',
              border: '1px solid var(--wx-input-border, #e5e5e5)',
              padding: '10px 14px',
              color: 'var(--wx-text, #1a1a1a)',
              maxHeight: 120,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            aria-label="输入消息"
          />
          <Pressable
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="mb-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
            style={{ background: draft.trim() ? '#f9a8c4' : 'var(--wx-border, #e5e5e5)' }}
            aria-label="发送"
          >
            <SendPlaneIcon color={draft.trim() ? '#ffffff' : '#9ca3af'} />
          </Pressable>
        </div>
      </div>

      <style>{`
        @keyframes agentChatTyping {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
