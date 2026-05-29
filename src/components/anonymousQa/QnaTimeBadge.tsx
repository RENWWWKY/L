import { formatQnaTimeLabel, formatQnaTimeTitle } from './qnaTimeFormat'

export function QnaTimeBadge({ ts, nowMs }: { ts: number; nowMs: number }) {
  return (
    <time
      dateTime={new Date(ts).toISOString()}
      title={formatQnaTimeTitle(ts)}
      className="shrink-0 rounded-md bg-gray-100/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-400"
    >
      {formatQnaTimeLabel(ts, nowMs)}
    </time>
  )
}
