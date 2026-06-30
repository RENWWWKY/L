import { memo } from 'react'

import { ProactiveMessageCountdownBar } from '../ProactiveMessageCountdownBar'
import { useProactiveMessageCountdown } from '../useProactiveMessageCountdown'

type Props = {
  conversationKey: string
  enabled: boolean
  isBusyActive: boolean
}

/** 主动消息倒计时：内部 1s tick 不冒泡到 ChatRoom，避免静止态每秒全页重绘 */
function ProactiveMessageCountdownHostInner({ conversationKey, enabled, isBusyActive }: Props) {
  const state = useProactiveMessageCountdown({
    conversationKey,
    enabled,
    isBusyActive,
  })
  return <ProactiveMessageCountdownBar state={state} />
}

export const ProactiveMessageCountdownHost = memo(ProactiveMessageCountdownHostInner)
