import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

export interface VerificationMsg {
  id: string
  sender: 'character' | 'user'
  content: string
  timestamp: string
  timestampMs?: number
}

export interface FriendRequest {
  id: string
  avatar: string
  nickname: string
  source: string
  status: 'pending' | 'accepted' | 'declined'
  messages: VerificationMsg[]
  unread?: boolean
  characterId?: string
  requestTimeMs?: number
}

function statusIcon(status: FriendRequest['status']) {
  if (status === 'pending') {
    return <AlertCircle className="size-4 text-[#c8a64b]" strokeWidth={1.8} aria-hidden />
  }
  if (status === 'accepted') {
    return <CheckCircle2 className="size-4 text-[#9ea1a8]" strokeWidth={1.8} aria-hidden />
  }
  return <CheckCircle2 className="size-4 text-[#c4c6cb]" strokeWidth={1.8} aria-hidden />
}

export function NewFriendsList({
  requests,
  onOpenRequest,
}: {
  requests: FriendRequest[]
  onOpenRequest: (id: string) => void
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
        <p className="text-[12px] font-medium tracking-[0.06em] text-[#9a9ca3]">{title}</p>
      </div>
      {group.map((req) => {
        const preview = req.messages[req.messages.length - 1]?.content?.trim() || '暂无验证消息'
        return (
          <button
            key={req.id}
            type="button"
            className="w-full rounded-2xl border bg-white px-4 py-3 text-left transition-all duration-200 ease-out hover:bg-[#fcfcfc]"
            style={{ borderColor: '#e8e8ea', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
            onClick={() => onOpenRequest(req.id)}
          >
            <div className="flex items-center gap-3">
              {req.avatar?.trim() ? (
                <img
                  src={req.avatar}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full border object-cover"
                  style={{ borderColor: '#e3e3e5' }}
                />
              ) : (
                <div
                  className="h-11 w-11 shrink-0 rounded-full border border-dashed bg-[#f6f6f7]"
                  style={{ borderColor: '#e3e3e5' }}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="min-w-0 truncate text-[15px] font-semibold text-[#202227]">{req.nickname}</p>
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none text-[#b2892f]"
                    style={{ borderColor: 'rgba(212,175,55,0.45)', background: 'rgba(212,175,55,0.10)' }}
                    title={req.source}
                  >
                    {req.source}
                  </span>
                </div>
                <p className="mt-1 truncate text-[12px] text-[#93959b]">{preview}</p>
              </div>
              <div className="flex items-center gap-2 text-[#b2b4b9]">
                {statusIcon(req.status)}
                <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden />
              </div>
            </div>
          </button>
        )
      })}
    </section>
  )

  return (
    <div className="space-y-2">
      {requests.length ? (
        <>
          {withinThreeDays.length ? renderGroup('三天内', withinThreeDays) : null}
          {older.length ? renderGroup('三天前', older) : null}
        </>
      ) : (
        <div className="rounded-2xl border bg-white px-4 py-10 text-center" style={{ borderColor: '#e8e8ea' }}>
          <p className="text-[15px] font-medium text-[#2b2b2f]">暂无新的好友申请</p>
          <p className="mt-2 text-[12px] text-[#8d8d92]">新的验证消息会出现在这里。</p>
        </div>
      )}
    </div>
  )
}
