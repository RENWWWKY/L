import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCustomization } from '../../CustomizationContext'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { IndexedTrashEntry } from './indexedTrashTypes'
import { RecycleBinChatMessagesSheet } from './RecycleBinChatMessagesSheet'
import { INDEXED_TRASH_CHANGED_EVENT } from './recycleBinEvents'
import { restoreIndexedTrashEntry } from './trashRestore'
import { extractTrashChatMessages } from './trashChatPayload'

type Props = { onBack: () => void }

function formatRemain(ms: number): string {
  if (ms <= 0) return '即将清除'
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `剩余约 ${d} 天`
  if (h >= 1) return `剩余约 ${h} 小时`
  const m = Math.max(1, Math.floor(ms / 60000))
  return `剩余约 ${m} 分钟`
}

export function RecycleBinApp({ onBack }: Props) {
  const { state } = useCustomization()
  const pageStyle = state.appPageStyles.recycleBin
  const [entries, setEntries] = useState<IndexedTrashEntry[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [clock, setClock] = useState(0)
  const [detailEntry, setDetailEntry] = useState<IndexedTrashEntry | null>(null)
  const detailMessages = useMemo(
    () => (detailEntry ? extractTrashChatMessages(detailEntry) : null),
    [detailEntry],
  )

  const refresh = useCallback(async () => {
    await personaDb.purgeExpiredIndexedTrash()
    const list = await personaDb.listIndexedTrashEntries()
    setEntries(list)
  }, [])

  useEffect(() => {
    void refresh()
    const onTrash = () => void refresh()
    window.addEventListener(INDEXED_TRASH_CHANGED_EVENT, onTrash)
    const t = window.setInterval(() => void refresh(), 60000)
    const clock = window.setInterval(() => setClock((x) => x + 1), 30000)
    return () => {
      window.removeEventListener(INDEXED_TRASH_CHANGED_EVENT, onTrash)
      window.clearInterval(t)
      window.clearInterval(clock)
    }
  }, [refresh])

  const now = Date.now()
  const rows = useMemo(() => {
    void clock
    const t = Date.now()
    return entries.map((e) => ({
      entry: e,
      remainMs: e.expiresAt - t,
    }))
  }, [entries, clock])

  const handleRestore = async (e: IndexedTrashEntry) => {
    setBusyId(e.id)
    setToast(null)
    try {
      const r = await restoreIndexedTrashEntry(e)
      if (r.ok) setToast('已恢复')
      else setToast(r.message || '恢复失败')
    } finally {
      setBusyId(null)
      await refresh()
    }
  }

  const handleDeleteForever = async (e: IndexedTrashEntry) => {
    setBusyId(e.id)
    try {
      await personaDb.removeIndexedTrashEntry(e.id)
      setToast('已永久删除')
    } finally {
      setBusyId(null)
      await refresh()
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        background: pageStyle.pageBgImageUrl?.trim()
          ? undefined
          : pageStyle.pageBg,
        color: pageStyle.headerText,
        fontFamily: pageStyle.fontFamily,
      }}
    >
      {pageStyle.pageBgImageUrl?.trim() ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${pageStyle.pageBgImageUrl})` }}
        />
      ) : null}
      <header
        className="relative z-[1] flex shrink-0 items-center gap-2 border-b border-black/10 px-3 pb-3 pt-[calc(0.65rem+env(safe-area-inset-top,0px))]"
        style={{
          background: pageStyle.headerBgImageUrl?.trim()
            ? undefined
            : pageStyle.headerBg,
          color: pageStyle.headerText,
        }}
      >
        {pageStyle.headerBgImageUrl?.trim() ? (
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-95"
            style={{ backgroundImage: `url(${pageStyle.headerBgImageUrl})` }}
          />
        ) : null}
        <button
          type="button"
          onClick={onBack}
          className="relative z-[1] flex size-10 items-center justify-center rounded-full border border-black/10 bg-white/70 transition-colors active:opacity-80"
          aria-label="返回"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="relative z-[1] min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold">回收站</h1>
          <p className="truncate text-[11px] opacity-70">本地 IndexedDB 删除快照 · 超期自动清空</p>
        </div>
      </header>

      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {toast ? (
          <p className="mb-3 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-[12px] text-zinc-800 shadow-sm backdrop-blur">
            {toast}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <div
            className="mx-auto mt-10 max-w-[320px] rounded-2xl border border-black/10 p-6 text-center shadow-sm"
            style={{ background: pageStyle.cardBg, color: pageStyle.headerText }}
          >
            <p className="text-[14px] font-medium">回收站是空的</p>
            <p className="mt-2 text-[12px] leading-relaxed opacity-70">
              删除的聊天记录、角色、记忆等会先出现在这里。条目自删除时起保留约 5 天；到期自动彻底清除。
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ entry, remainMs }) => {
              const loading = busyId === entry.id
              const chatLike =
                entry.kind === 'wechat-message' ||
                entry.kind === 'wechat-conversation' ||
                entry.kind === 'group-chat'
              const trashMessages = chatLike ? extractTrashChatMessages(entry) : null
              const canViewDeletedChat = trashMessages !== null
              const showAvatar =
                chatLike || !!(entry.peerDisplayName || entry.peerAvatarUrl)
              const initial = (entry.peerDisplayName || entry.title || '?').trim().slice(0, 1)
              return (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-black/10 p-4 shadow-sm backdrop-blur"
                  style={{ background: pageStyle.cardBg, color: pageStyle.headerText }}
                >
                  {canViewDeletedChat ? (
                    <button
                      type="button"
                      onClick={() => setDetailEntry(entry)}
                      className="flex w-full items-start gap-3 rounded-xl text-left outline-none transition-opacity active:opacity-80"
                    >
                      {showAvatar ? (
                        <div
                          className="size-12 shrink-0 overflow-hidden rounded-[10px] border border-black/10 bg-zinc-200/80"
                          aria-hidden
                        >
                          {entry.peerAvatarUrl ? (
                            <img
                              src={entry.peerAvatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-zinc-500">
                              {initial}
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{entry.title}</p>
                        <p className="mt-0.5 text-[12px] opacity-75">{entry.summary}</p>
                        <p className="mt-1 text-[11px] text-orange-700/90">{formatRemain(remainMs)}</p>
                        <p className="mt-1.5 text-[11px] font-medium text-sky-700">点击查看已删除的聊天内容</p>
                      </div>
                    </button>
                  ) : (
                    <div className="flex w-full items-start gap-3">
                      {showAvatar ? (
                        <div
                          className="size-12 shrink-0 overflow-hidden rounded-[10px] border border-black/10 bg-zinc-200/80"
                          aria-hidden
                        >
                          {entry.peerAvatarUrl ? (
                            <img
                              src={entry.peerAvatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-zinc-500">
                              {initial}
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{entry.title}</p>
                        <p className="mt-0.5 text-[12px] opacity-75">{entry.summary}</p>
                        <p className="mt-1 text-[11px] text-orange-700/90">{formatRemain(remainMs)}</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleRestore(entry)}
                      className="rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                    >
                      恢复
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleDeleteForever(entry)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700 disabled:opacity-50"
                    >
                      永久删除
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <RecycleBinChatMessagesSheet
        open={detailMessages !== null}
        title={detailEntry?.title ?? '聊天记录'}
        isGroup={detailEntry?.kind === 'group-chat'}
        messages={detailMessages ?? []}
        onClose={() => setDetailEntry(null)}
      />
    </div>
  )
}
