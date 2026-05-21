import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EncounterNPC } from './meetTypes'
import { useLumiMeetStore } from './LumiMeetStore'
import { EncounterChatRoom } from './EncounterChatRoom'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import {
  countUnreadMeetEncounterThread,
  formatMeetEncounterListPreview,
  formatMeetEncounterListTime,
  pickLastMeetThreadMessage,
} from './meetEncounterInboxRow'

export function EncounterChats() {
  const { state } = useLumiMeetStore()
  const [open, setOpen] = useState<EncounterNPC | null>(null)
  const meetPortalEl = getLumiMeetPortalTarget()

  const matched = useMemo(() => {
    const list = state.npcs.filter((n) => n.status === 'matched' || n.status === 'wechat_added')
    return [...list].sort((a, b) => {
      const msgsA = state.chatThreads[a.id] ?? []
      const msgsB = state.chatThreads[b.id] ?? []
      const ta = msgsA.length ? Math.max(...msgsA.map((m) => m.ts)) : a.lastEncounterTime
      const tb = msgsB.length ? Math.max(...msgsB.map((m) => m.ts)) : b.lastEncounterTime
      return tb - ta
    })
  }, [state.chatThreads, state.npcs])

  return (
    <>
      <div
        data-meet-app-coach="inbox-header"
        className="meet-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-28 pt-2"
      >
        <h2 className="font-elegant-serif text-[1.35rem] font-medium tracking-[0.08em] text-[#2c2a26]">消息</h2>
        <p className="meet-caption-en mt-0.5 text-[10px] uppercase tracking-[0.35em] text-[#b8b5ad]">
          Inbox · 临时会话
        </p>

        {matched.length === 0 ? (
          <p className="mt-8 text-center font-elegant-serif text-[14px] leading-relaxed text-[#8a8680]">
            暂无匹配对象。去「遇见」点一次心动，让命运先响一声。
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {matched.map((n) => {
              const thread = state.chatThreads[n.id] ?? []
              const last = pickLastMeetThreadMessage(thread)
              const preview = formatMeetEncounterListPreview(last, n.nickname)
              const timeLabel = formatMeetEncounterListTime(last?.ts)
              const unread = countUnreadMeetEncounterThread(thread, state.meetInboxLastReadTsByNpcId[n.id])
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(n)}
                    className="flex w-full items-center gap-3 rounded-[16px] border border-black/[0.04] bg-white p-3 text-left shadow-[0_8px_32px_rgba(40,36,30,0.04)] transition active:scale-[0.99]"
                  >
                    <span className="relative inline-flex h-10 w-10 shrink-0">
                      <img
                        src={n.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.05]"
                      />
                      {unread > 0 ? (
                        <span
                          className="pointer-events-none absolute right-0 top-0 flex min-h-[18px] min-w-[18px] -translate-y-[38%] translate-x-[45%] items-center justify-center rounded-full px-[5px] text-[10px] font-bold leading-none text-white"
                          style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
                          title={`未读 ${unread} 条`}
                          aria-label={`未读 ${unread} 条`}
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[16px] font-normal text-[#1a1a1a]">{n.nickname}</p>
                        <span className="shrink-0 text-[12px] leading-none text-[#b2b2b2]">
                          <span
                            className="tabular-nums"
                            style={{
                              fontVariantNumeric: 'tabular-nums lining-nums',
                              fontFeatureSettings: '"tnum" 1, "lnum" 1',
                            }}
                          >
                            {timeLabel}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[14px] leading-snug text-[#666666]">{preview}</p>
                        {n.status === 'wechat_added' ? (
                          <span className="meet-caption-en shrink-0 text-[9px] tracking-[0.12em] text-[#b8a994]">
                            WECHAT
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {open && meetPortalEl
        ? createPortal(
            <div className="fixed inset-0 z-[290] flex min-h-0 flex-col bg-[#ededed]">
              <EncounterChatRoom npc={open} onBack={() => setOpen(null)} />
            </div>,
            meetPortalEl,
          )
        : null}
    </>
  )
}
