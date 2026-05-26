import type { ReactNode } from 'react'

import type { DmTextHighlightRange } from './jbsFlowTypes'

/** 将 DM 气泡正文按高亮区间渲染（用于打字机逐字输出） */
export function renderDmBubbleText(
  body: string,
  highlight?: DmTextHighlightRange,
  isTyping?: boolean,
): ReactNode {
  const cursor = isTyping ? (
    <span className="jbs-gf-chat-typewriter-cursor ml-0.5 inline-block w-[2px] align-middle" />
  ) : null

  if (!highlight || body.length <= highlight.start) {
    return (
      <>
        {body}
        {cursor}
      </>
    )
  }

  const hlEnd = Math.min(body.length, highlight.end)
  return (
    <>
      {body.slice(0, highlight.start)}
      <span className="jbs-gf-chat-dm-highlight">{body.slice(highlight.start, hlEnd)}</span>
      {body.slice(hlEnd)}
      {cursor}
    </>
  )
}
