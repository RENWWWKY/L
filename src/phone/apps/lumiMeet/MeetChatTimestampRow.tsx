/** 遇见临时会话 · 时间分隔条（暖金描边，与浅金气泡一致） */

const MEET_TIMESTAMP = {
  text: '#9A8A72',
  textMuted: '#B5A48C',
  border: 'rgba(212, 175, 55, 0.32)',
  bg: 'linear-gradient(180deg, rgba(255, 252, 245, 0.92) 0%, rgba(248, 238, 218, 0.88) 100%)',
} as const

export function MeetChatTimestampRow({ text }: { text: string }) {
  const parts = text.split(' ')
  const left = parts.slice(0, -1).join(' ')
  const time = parts.at(-1) ?? ''

  return (
    <div className="my-2 flex w-full max-w-full shrink-0 justify-center px-2">
      <span
        className="inline-flex max-w-[min(100%,280px)] items-center justify-center rounded-full px-3.5 py-[5px] text-[11px] leading-[1.2] tracking-[0.02em]"
        style={{
          color: MEET_TIMESTAMP.text,
          background: MEET_TIMESTAMP.bg,
          border: `1px solid ${MEET_TIMESTAMP.border}`,
          boxShadow: 'none',
        }}
      >
        {left ? (
          <span className="truncate" style={{ fontFamily: 'var(--wx-font)', color: MEET_TIMESTAMP.textMuted }}>
            {left}
            <span aria-hidden>&nbsp;</span>
          </span>
        ) : null}
        <span
          className="shrink-0"
          style={{
            fontFamily: 'var(--wx-num-font)',
            fontVariantNumeric: 'tabular-nums lining-nums',
            fontFeatureSettings: '"tnum" 1, "lnum" 1',
            color: MEET_TIMESTAMP.text,
          }}
        >
          {time}
        </span>
      </span>
    </div>
  )
}
