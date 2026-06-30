import { memo, type ReactNode } from 'react'

import { probeChatRender } from './chatRenderProbe'

function ChatMessageListInner({ children }: { children: ReactNode }) {
  probeChatRender('ChatMessageList')
  return <>{children}</>
}

export const ChatMessageList = memo(ChatMessageListInner)
