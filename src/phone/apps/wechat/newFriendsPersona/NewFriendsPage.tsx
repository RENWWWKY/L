import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import { personaDb } from './idb'
import type { FriendRequest } from './friendRequestTypes'
import { NewFriendsTwinTabs, type NewFriendsTabId } from './NewFriendsTwinTabs'
import { ReceivedRequestsList } from './ReceivedRequestsList'
import { SentRequestsList } from './SentRequestsList'

export type { FriendRequest, TempChatMessage, VerificationMsg } from './friendRequestTypes'

export function NewFriendsPage({
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
  const [tab, setTab] = useState<NewFriendsTabId>('received')

  const received = useMemo(
    () => requests.filter((r) => r.direction === 'inbound'),
    [requests],
  )
  const sent = useMemo(
    () => requests.filter((r) => r.direction === 'outbound'),
    [requests],
  )

  const handleOpenReceived = (id: string) => {
    const req = requests.find((r) => r.id === id)
    if (req?.outcomeUnread) {
      void personaDb.clearFriendRequestOutcomeUnread(id)
    }
    onOpenRequest(id)
  }

  const handleOpenSent = (id: string) => {
    const req = requests.find((r) => r.id === id)
    if (req?.outcomeUnread) {
      void personaDb.clearFriendRequestOutcomeUnread(id)
    }
    onOpenRequest(id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <NewFriendsTwinTabs active={tab} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'received' ? (
              <ReceivedRequestsList
                requests={received}
                replyingRequestIds={replyingRequestIds}
                onOpenRequest={handleOpenReceived}
              />
            ) : (
              <SentRequestsList
                requests={sent}
                replyingRequestIds={replyingRequestIds}
                tempChatReplyingIds={tempChatReplyingIds}
                onOpenRequest={handleOpenSent}
                onRetryRequest={onRetryRequest}
                onSendTempChat={onSendTempChat}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
