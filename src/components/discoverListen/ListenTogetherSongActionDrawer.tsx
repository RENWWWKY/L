import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  Headphones,
  Link2,
  Loader2,
  Send,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import {
  buildNeteaseSongPageUrl,
  fetchNeteaseFollowUsers,
  sendNeteaseSongToFriend,
  type NeteaseFollowUser,
} from './neteaseShareApi'

type DrawerStep = 'menu' | 'netease-friends'

export type ListenTogetherSongActionDrawerProps = {
  open: boolean
  onClose: () => void
  song: { id: number; title: string; artist: string }
  neteaseCookie: string
  neteaseUserId?: number
  onShareListenTogether: () => void
  onToast: (message: string) => void
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

type MenuRowProps = {
  icon: ReactNode
  title: string
  subtitle?: string
  disabled?: boolean
  onClick: () => void
}

function MenuRow({ icon, title, subtitle, disabled, onClick }: MenuRowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[16px] px-3.5 py-3.5 text-left transition-colors hover:bg-stone-50/90 disabled:opacity-45"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50/80 text-rose-500 ring-1 ring-rose-100/80">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-[#2D2422]">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-stone-400">{subtitle}</span>
        ) : null}
      </span>
    </button>
  )
}

export function ListenTogetherSongActionDrawer({
  open,
  onClose,
  song,
  neteaseCookie,
  neteaseUserId = 0,
  onShareListenTogether,
  onToast,
}: ListenTogetherSongActionDrawerProps) {
  const [step, setStep] = useState<DrawerStep>('menu')
  const [friends, setFriends] = useState<NeteaseFollowUser[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [sendingUserId, setSendingUserId] = useState<number | null>(null)

  const neteaseLoggedIn = Boolean(neteaseCookie.trim() && neteaseUserId > 0)

  const resetAndClose = useCallback(() => {
    setStep('menu')
    setSendingUserId(null)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) {
      setStep('menu')
      setSendingUserId(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || step !== 'netease-friends' || !neteaseLoggedIn) return
    let cancelled = false
    setFriendsLoading(true)
    void fetchNeteaseFollowUsers(neteaseCookie, neteaseUserId, 60)
      .then((list) => {
        if (!cancelled) setFriends(list)
      })
      .catch(() => {
        if (!cancelled) {
          setFriends([])
          onToast('加载关注列表失败')
        }
      })
      .finally(() => {
        if (!cancelled) setFriendsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, step, neteaseCookie, neteaseUserId, neteaseLoggedIn, onToast])

  const handleCopySongLink = async () => {
    const url = buildNeteaseSongPageUrl(song.id)
    const ok = await copyTextToClipboard(url)
    onToast(ok ? '歌曲链接已复制' : '复制失败，请手动复制')
    resetAndClose()
  }

  const handleShareListenTogether = () => {
    resetAndClose()
    onShareListenTogether()
  }

  const handleOpenNeteaseFriends = () => {
    if (!neteaseLoggedIn) {
      onToast('请先登录网易云账号')
      return
    }
    setStep('netease-friends')
  }

  const handleSendToFriend = async (friend: NeteaseFollowUser) => {
    if (sendingUserId) return
    setSendingUserId(friend.userId)
    try {
      await sendNeteaseSongToFriend({
        cookie: neteaseCookie,
        songId: song.id,
        userId: friend.userId,
        msg: `分享《${song.title}》给你`,
      })
      onToast(`已分享给 ${friend.nickname}`)
      resetAndClose()
    } catch {
      onToast('分享失败，请稍后重试')
      setSendingUserId(null)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-[10025] bg-black/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="song-action-drawer-title"
            className="fixed inset-x-0 bottom-0 z-[10026] max-h-[78vh] overflow-hidden rounded-t-[24px] border border-white/60 bg-white/90 shadow-[0_-10px_48px_rgba(45,36,34,0.14)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-200/90" />

            {step === 'menu' ? (
              <>
                <div className="border-b border-stone-100/80 px-5 pb-3 pt-4">
                  <h2
                    id="song-action-drawer-title"
                    className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400"
                  >
                    SHARE & MORE | 分享与更多
                  </h2>
                  <p className="mt-2 truncate text-center text-[15px] font-medium text-[#2D2422]">
                    {song.title}
                  </p>
                  <p className="truncate text-center text-[12px] text-stone-400">{song.artist}</p>
                </div>

                <div className="px-2 py-2">
                  <MenuRow
                    icon={<Link2 className="size-[18px]" strokeWidth={1.75} />}
                    title="复制歌曲链接"
                    subtitle="网易云网页分享地址"
                    onClick={() => void handleCopySongLink()}
                  />
                  <MenuRow
                    icon={<Headphones className="size-[18px]" strokeWidth={1.75} />}
                    title="分享听一听"
                    subtitle="从 Lumi 内置微信通讯录选择好友"
                    onClick={handleShareListenTogether}
                  />
                  <MenuRow
                    icon={<UserRound className="size-[18px]" strokeWidth={1.75} />}
                    title="分享给网易云好友"
                    subtitle={
                      neteaseLoggedIn ? '从关注列表选择好友' : '需先登录网易云账号'
                    }
                    disabled={!neteaseLoggedIn}
                    onClick={handleOpenNeteaseFriends}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-stone-100/80 px-3 pb-3 pt-3">
                  <button
                    type="button"
                    aria-label="返回"
                    onClick={() => setStep('menu')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-50"
                  >
                    <ChevronLeft className="size-5" strokeWidth={1.75} />
                  </button>
                  <div className="min-w-0 flex-1 text-center pr-9">
                    <h2
                      id="song-action-drawer-title"
                      className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400"
                    >
                      NETEASE FRIENDS | 分享给好友
                    </h2>
                    <p className="mt-1 truncate text-[13px] text-stone-500">{song.title}</p>
                  </div>
                </div>

                <div className="max-h-[calc(78vh-120px)] overflow-y-auto px-3 py-2">
                  {friendsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-stone-400">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      加载关注列表…
                    </div>
                  ) : friends.length === 0 ? (
                    <p className="py-10 text-center text-[13px] text-stone-400">
                      暂无关注的好友可分享
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {friends.map((f) => {
                        const busy = sendingUserId === f.userId
                        return (
                          <li key={f.userId}>
                            <button
                              type="button"
                              disabled={Boolean(sendingUserId)}
                              onClick={() => void handleSendToFriend(f)}
                              className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-rose-50/40 disabled:opacity-50"
                            >
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-stone-100">
                                {f.avatar ? (
                                  <img
                                    src={f.avatar}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-rose-50 to-stone-100" />
                                )}
                              </div>
                              <span className="min-w-0 flex-1 truncate text-[15px] text-[#1A1A1A]">
                                {f.nickname}
                              </span>
                              {busy ? (
                                <Loader2
                                  className="size-4 shrink-0 animate-spin text-rose-400"
                                  aria-hidden
                                />
                              ) : (
                                <Send
                                  className="size-4 shrink-0 text-stone-300"
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}

            <div className="border-t border-stone-100/80 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
              <button
                type="button"
                onClick={resetAndClose}
                className="w-full rounded-full py-3 text-[14px] font-medium text-stone-500 transition-colors hover:bg-stone-50"
              >
                取消
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
