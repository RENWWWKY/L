import type { WeChatMessageSearchIndexRow } from '../newFriendsPersona/types'
import { formatWeChatMessageListTimestamp } from '../newFriendsPersona/chatMessageTimestampFormat'
import { Pressable } from '../../../components/Pressable'
import { HighlightKeyword } from './HighlightKeyword'

export function ChatSearchResultRow({
  row,
  keyword,
  peerDisplayName,
  peerAvatarUrl,
  currentTimeMs,
  isLast,
  onPick,
}: {
  row: WeChatMessageSearchIndexRow
  keyword: string
  peerDisplayName: string
  peerAvatarUrl?: string
  currentTimeMs: number
  isLast: boolean
  onPick: (messageId: string) => void
}) {
  const title = peerDisplayName.trim() || '聊天'
  const timeLabel = formatWeChatMessageListTimestamp(row.timestamp, currentTimeMs)

  return (
    <Pressable
      type="button"
      onClick={() => onPick(row.id)}
      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-opacity duration-200 ease-out"
      style={{
        borderBottom: isLast ? undefined : '1px solid #e5e5e5',
      }}
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-white" style={{ borderColor: '#e5e5e5' }}>
        {peerAvatarUrl?.trim() ? (
          <img src={peerAvatarUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold text-black">{title}</p>
        <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-[#666666]">
          <HighlightKeyword text={row.content} keyword={keyword} />
        </p>
      </div>
      <span className="shrink-0 pt-0.5 text-right text-[12px] text-[#999999] tabular-nums">{timeLabel}</span>
    </Pressable>
  )
}
