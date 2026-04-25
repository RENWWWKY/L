import { ChevronLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import type { RedPacketHistoryRow } from './redPacketHistoryTypes'
import { buildRedPacketHistoryLists } from './redPacketHistoryFromMessages'

type TabId = 'received' | 'sent'

const goldAccent = '#9a7b4a'
const goldMuted = 'rgba(154, 123, 74, 0.9)'

function statusStyle(s: RedPacketHistoryRow['status']): CSSProperties {
  if (s === 'Opened') return { color: goldAccent }
  if (s === 'Expired') return { color: '#a8a299' }
  return { color: '#7a756c' }
}

/**
 * 红包收发记录：从 IndexedDB 聚合当前身份的红包消息；白金 UI。
 */
export function RedPacketHistoryPage({
  onBack,
  playerIdentityId,
  resolvePeer,
}: {
  onBack: () => void
  playerIdentityId: string
  resolvePeer: (characterId: string) => { remarkName: string; avatarUrl?: string }
}) {
  const [tab, setTab] = useState<TabId>('received')
  const [received, setReceived] = useState<RedPacketHistoryRow[]>([])
  const [sent, setSent] = useState<RedPacketHistoryRow[]>([])

  const load = useCallback(async () => {
    const pid = playerIdentityId.trim()
    if (!pid) {
      setReceived([])
      setSent([])
      return
    }
    const msgs = await personaDb.listWeChatRedPacketMessagesByPlayerIdentity(pid)
    const { received: rx, sent: tx } = buildRedPacketHistoryLists(msgs, resolvePeer)
    setReceived(rx)
    setSent(tx)
  }, [playerIdentityId, resolvePeer])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onStorage = () => void load()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [load])

  const list = useMemo(() => (tab === 'received' ? received : sent), [tab, received, sent])

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        background: 'linear-gradient(180deg, #faf9f6 0%, #f0ede6 100%)',
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[#e5e0d8] px-2 py-2">
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#2a2a2a] active:scale-[0.98]"
        >
          <ChevronLeft className="size-6" strokeWidth={1.5} />
        </Pressable>
        <h1 className="min-w-0 flex-1 text-center text-[16px] font-medium text-[#1a1a1a]">红包记录</h1>
        <span className="w-10 shrink-0" aria-hidden />
      </header>

      <div className="flex shrink-0 gap-0 border-b border-[#ebe6de] px-4">
        {(
          [
            { id: 'received' as const, en: 'RECEIVED', zh: '收到的红包' },
            { id: 'sent' as const, en: 'SENT', zh: '发出的红包' },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="relative flex-1 py-3.5 text-center active:opacity-80"
          >
            <span
              className="text-[12px] font-medium tracking-[0.12em]"
              style={{ color: tab === t.id ? goldAccent : '#a8a299' }}
            >
              {t.en}
            </span>
            <p className={`mt-0.5 text-[11px] ${tab === t.id ? 'text-[#5c5a55]' : 'text-[#b5b0a8]'}`}>{t.zh}</p>
            {tab === t.id ? (
              <span
                className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: goldMuted }}
              />
            ) : null}
          </Pressable>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {list.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-[#a8a299]">暂无红包记录</p>
        ) : (
          <ul className="space-y-2">
            {list.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-[#e8e2d8] bg-white/95 px-4 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {item.peerAvatarUrl?.trim() ? (
                      <img
                        src={item.peerAvatarUrl.trim()}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl border border-[#e8e2d8] object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e8e2d8] bg-[#faf8f4] text-[13px] text-[#c4bfb5]">
                        ?
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-[#1a1a1a]">{item.peerLabel}</p>
                      <p className="mt-1 text-[12px] tabular-nums text-[#9a958c]">{item.timeLabel}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[16px] font-semibold tabular-nums" style={{ color: goldAccent }}>
                      ¥{item.amountYuan.toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium" style={statusStyle(item.status)}>
                      {item.status}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
