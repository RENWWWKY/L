import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { RejectionTempChatPanel } from './RejectionTempChatPanel'
import type { FriendRequest } from './friendRequestTypes'
import { personaDb } from './idb'

function StatusBadge({ status }: { status: FriendRequest['status'] }) {
  if (status === 'pending') {
    return (
      <span className="shrink-0 text-[11px] italic text-[#9CA3AF]">Waiting for response...</span>
    )
  }
  if (status === 'accepted') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#000000]">
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
        Added
      </span>
    )
  }
  return <span className="shrink-0 text-[12px] text-[#9CA3AF]">Declined</span>
}

export function SentRequestsList({
  requests,
  onOpenRequest,
  onRetryRequest,
  onSendTempChat,
  replyingRequestIds,
  tempChatReplyingIds,
}: {
  requests: FriendRequest[]
  onOpenRequest: (id: string) => void
  onRetryRequest?: (id: string) => void
  onSendTempChat?: (requestId: string, text: string) => void | Promise<void>
  replyingRequestIds?: string[]
  tempChatReplyingIds?: string[]
}) {
  const [expandedTempChatId, setExpandedTempChatId] = useState<string | null>(null)

  if (!requests.length) {
    return (
      <div
        className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-12 text-center shadow-sm"
        style={{ borderWidth: '0.5px' }}
      >
        <p className="text-[15px] font-medium text-[#1C1C1E]">暂无发出的申请</p>
        <p className="mt-2 text-[12px] text-[#9CA3AF]">你主动添加的好友会出现在这里。</p>
      </div>
    )
  }

  const sorted = [...requests].sort((a, b) => (b.requestTimeMs ?? 0) - (a.requestTimeMs ?? 0))

  return (
    <div className="space-y-3">
      {sorted.map((req) => {
        const excerpt = req.verificationMsg || '暂无验证消息'
        const isReplying = !!replyingRequestIds?.includes(req.id)
        const isTempReplying = !!tempChatReplyingIds?.includes(req.id)
        const errHint = req.adjudicationLastError?.trim()
        const showTempChat = req.status === 'declined'
        const tempOpen = expandedTempChatId === req.id
        const canRetry =
          !!errHint && req.status === 'pending' && !isReplying && !!onRetryRequest

        return (
          <motion.article
            key={req.id}
            layout
            className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm"
            style={{ borderWidth: '0.5px' }}
          >
            <button
              type="button"
              className="w-full px-4 py-3 text-left transition-colors hover:bg-[#F9FAFB]"
              onClick={() => {
                if (req.status === 'pending') onOpenRequest(req.id)
              }}
            >
              <div className="flex items-center gap-3">
                {req.avatar?.trim() ? (
                  <img
                    src={req.avatar}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full border border-[#E5E7EB] object-cover"
                    style={{ borderWidth: '0.5px' }}
                  />
                ) : (
                  <div
                    className="h-11 w-11 shrink-0 rounded-full border border-dashed border-[#E5E7EB] bg-[#F9FAFB]"
                    style={{ borderWidth: '0.5px' }}
                    aria-hidden
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#000000]">{req.nickname}</p>
                  <p
                    className={`mt-1 truncate text-[12px] ${errHint ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}
                    title={errHint || excerpt}
                  >
                    {errHint
                      ? errHint
                      : isReplying
                        ? '对方正在处理你的申请…'
                        : excerpt}
                  </p>
                  {canRetry ? (
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-medium text-[#000000] underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRetryRequest?.(req.id)
                      }}
                    >
                      重试
                    </button>
                  ) : null}
                </div>
                <div className="relative flex shrink-0 flex-col items-end gap-1">
                  {req.outcomeUnread && req.status === 'declined' ? (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#000000]" aria-label="未读" />
                  ) : null}
                  <StatusBadge status={req.status} />
                </div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {showTempChat ? (
                <motion.div
                  key="temp-chat-trigger"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-[#E5E7EB] px-4 pb-3 pt-0"
                  style={{ borderTopWidth: '0.5px' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (req.outcomeUnread) {
                        void personaDb.clearFriendRequestOutcomeUnread(req.id)
                      }
                      setExpandedTempChatId((prev) => (prev === req.id ? null : req.id))
                    }}
                    className="mt-2 w-full rounded-lg border border-[#000000] bg-white py-2.5 text-center transition-colors hover:bg-[#F9FAFB]"
                    style={{ borderWidth: '0.5px' }}
                  >
                    <span className="text-[13px] font-medium text-[#000000]">临时会话</span>
                    <span className="mt-0.5 block text-[8px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                      TEMP CHAT
                    </span>
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {showTempChat && tempOpen && onSendTempChat ? (
                <RejectionTempChatPanel
                  key={`temp-panel-${req.id}`}
                  thread={req.tempChatThread ?? []}
                  isReplying={isTempReplying}
                  onSend={(text) => onSendTempChat(req.id, text)}
                />
              ) : null}
            </AnimatePresence>

            {req.outcomeUnread && req.status === 'declined' ? (
              <span className="sr-only">未读拒绝结果</span>
            ) : null}
          </motion.article>
        )
      })}
    </div>
  )
}
