import { ChevronRight } from 'lucide-react'

import type { FriendRequest } from './friendRequestTypes'

export function ReceivedRequestsList({
  requests,
  onOpenRequest,
  replyingRequestIds,
}: {
  requests: FriendRequest[]
  onOpenRequest: (id: string) => void
  replyingRequestIds?: string[]
}) {
  const now = Date.now()
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  const pickMs = (req: FriendRequest) => req.requestTimeMs ?? now
  const sorted = [...requests].sort((a, b) => pickMs(b) - pickMs(a))
  const withinThreeDays = sorted.filter((r) => now - pickMs(r) <= threeDaysMs)
  const older = sorted.filter((r) => now - pickMs(r) > threeDaysMs)

  const renderGroup = (title: string, group: FriendRequest[]) => (
    <section className="space-y-2" key={title}>
      <div className="px-1">
        <p className="text-[11px] font-medium tracking-[0.08em] text-[#9CA3AF]">{title}</p>
      </div>
      {group.map((req) => {
        const preview = req.verificationMsg || req.messages[req.messages.length - 1]?.content?.trim() || '暂无验证消息'
        const isReplying = !!replyingRequestIds?.includes(req.id)
        return (
          <button
            key={req.id}
            type="button"
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-left shadow-sm transition-colors duration-200 hover:bg-[#F9FAFB]"
            style={{ borderWidth: '0.5px' }}
            onClick={() => onOpenRequest(req.id)}
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
                <p className="mt-1 truncate text-[12px] text-[#9CA3AF]" title={preview}>
                  {isReplying ? '等待你的回复…' : preview}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[#9CA3AF]">
                {req.status === 'pending' && req.unread ? (
                  <span className="h-2 w-2 rounded-full bg-[#000000]" aria-label="未读" />
                ) : null}
                <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden />
              </div>
            </div>
          </button>
        )
      })}
    </section>
  )

  if (!requests.length) {
    return (
      <div
        className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-12 text-center shadow-sm"
        style={{ borderWidth: '0.5px' }}
      >
        <p className="text-[15px] font-medium text-[#1C1C1E]">暂无收到的验证</p>
        <p className="mt-2 text-[12px] text-[#9CA3AF]">他人发来的好友申请会出现在这里。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {withinThreeDays.length ? renderGroup('三天内', withinThreeDays) : null}
      {older.length ? renderGroup('三天前', older) : null}
    </div>
  )
}
