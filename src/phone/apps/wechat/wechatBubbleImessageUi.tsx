/** iMessage 气泡底角尾巴（透明底 inline SVG · 任意壁纸/渐变均可透出） */

/** 组内末条：尾巴一侧底角为 0，与 SVG 无缝衔接 */
export function imessageBubbleCornerRadius(isSelf: boolean, radiusPx: number, showTail: boolean): string {
  const r = `${radiusPx}px`
  if (!showTail) return r
  if (isSelf) return `${r} ${r} 0 ${r}`
  return `${r} ${r} ${r} 0`
}

const SELF_TAIL_PATH = 'M0,0 C0,10 3,19 10,20 L0,20 Z'
const OTHER_TAIL_PATH = 'M10,0 C10,10 7,19 0,20 L10,20 Z'

export function ImessageBubbleTail({ isSelf, bubbleColor }: { isSelf: boolean; bubbleColor: string }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute bottom-0 z-[1] fill-current"
      style={{
        color: bubbleColor,
        width: 10,
        height: 20,
        overflow: 'visible',
        ...(isSelf ? { right: 0, transform: 'translateX(9px)' } : { left: 0, transform: 'translateX(-9px)' }),
      }}
      viewBox="0 0 10 20"
    >
      <path d={isSelf ? SELF_TAIL_PATH : OTHER_TAIL_PATH} />
    </svg>
  )
}
