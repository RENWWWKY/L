import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Loader2, Lock, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ListenNum, ListenNumericText } from './ListenNum'
import {
  fetchFollowListPage,
  followListPageTitle,
  type NeteaseFollowListItem,
  type NeteaseFollowListKind,
  type NeteaseFollowListPage as NeteaseFollowListPageResult,
  type NeteaseFollowListSubject,
} from './neteaseFollowApi'
import type { NeteaseArtistItem } from './neteaseMusicApi'
import type { UserDetailInfo } from './listenTogetherProfileTypes'

const PAGE_SIZE = 30

export type ListenTogetherFollowListTarget = {
  subject: NeteaseFollowListSubject
  listKind: NeteaseFollowListKind
}

export type ListenTogetherFollowListPageProps = {
  open: boolean
  target: ListenTogetherFollowListTarget | null
  cookie: string
  onBack: () => void
  onOpenArtist?: (artist: NeteaseArtistItem) => void
  onOpenUser?: (user: UserDetailInfo) => void
  onRequireLogin?: () => void
  className?: string
}

function FollowListRow({
  item,
  onOpenArtist,
  onOpenUser,
}: {
  item: NeteaseFollowListItem
  onOpenArtist?: (artist: NeteaseArtistItem) => void
  onOpenUser?: (user: UserDetailInfo) => void
}) {
  const canOpenArtist = item.kind === 'artist' && item.artistId && onOpenArtist
  const canOpenUser = item.kind === 'user' && item.userId && onOpenUser
  const canOpen = canOpenArtist || canOpenUser
  const inner = (
    <>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-100">
        {item.avatar ? (
          <img
            src={item.avatar}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <User className="size-5" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-stone-800">
          <ListenNumericText text={item.name} />
        </p>
        {item.signature ? (
          <p className="mt-0.5 truncate text-[12px] text-stone-400">{item.signature}</p>
        ) : item.kind === 'artist' ? (
          <p className="mt-0.5 text-[12px] text-stone-400">歌手</p>
        ) : null}
      </div>
    </>
  )

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          if (canOpenArtist) {
            onOpenArtist!({
              id: item.artistId!,
              name: item.name,
              avatar: item.avatar,
            })
          } else if (canOpenUser) {
            onOpenUser!({
              userId: item.userId!,
              nickname: item.name,
              avatar: item.avatar,
            })
          }
        }}
        className="flex w-full items-center gap-3 rounded-2xl bg-white/90 px-3 py-3 text-left shadow-sm ring-1 ring-stone-100/80 transition-colors hover:bg-rose-50/40 active:scale-[0.99]"
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/90 px-3 py-3 shadow-sm ring-1 ring-stone-100/80">
      {inner}
    </div>
  )
}

export function ListenTogetherFollowListPage({
  open,
  target,
  cookie,
  onBack,
  onOpenArtist,
  onOpenUser,
  onRequireLogin,
  className = '',
}: ListenTogetherFollowListPageProps) {
  const [items, setItems] = useState<NeteaseFollowListItem[]>([])
  const [total, setTotal] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadFirst = useCallback(async () => {
    if (!target || !cookie.trim()) {
      if (!cookie.trim()) onRequireLogin?.()
      return
    }
    setLoading(true)
    setError(null)
    setBlocked(false)
    setBlockReason(null)
    try {
      const page = await fetchFollowListPage(cookie, target.subject, target.listKind, 0, PAGE_SIZE)
      setItems(page.items)
      setTotal(page.total)
      setMore(page.more)
      setBlocked(page.blocked)
      setBlockReason(page.blockReason ?? null)
    } catch (e) {
      const blockedPage = (e as Error & { followListBlocked?: NeteaseFollowListPageResult }).followListBlocked
      if (blockedPage) {
        setItems([])
        setTotal(0)
        setMore(false)
        setBlocked(true)
        setBlockReason(blockedPage.blockReason ?? null)
        return
      }
      setItems([])
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [target, cookie, onRequireLogin])

  useEffect(() => {
    if (!open || !target) return
    setItems([])
    setTotal(0)
    setMore(false)
    void loadFirst()
  }, [open, target, loadFirst])

  const loadMore = useCallback(async () => {
    if (!target || !cookie.trim() || loadingMore || !more || blocked) return
    setLoadingMore(true)
    try {
      const page = await fetchFollowListPage(
        cookie,
        target.subject,
        target.listKind,
        items.length,
        PAGE_SIZE,
      )
      setItems((prev) => {
        const seen = new Set(prev.map((i) => `${i.kind}-${i.id}`))
        const merged = [...prev]
        for (const item of page.items) {
          const key = `${item.kind}-${item.id}`
          if (!seen.has(key)) {
            seen.add(key)
            merged.push(item)
          }
        }
        return merged
      })
      setTotal(page.total)
      setMore(page.more)
    } catch {
      /* 保留已加载 */
    } finally {
      setLoadingMore(false)
    }
  }, [target, cookie, loadingMore, more, blocked, items.length])

  if (!target) return null

  const title = followListPageTitle(target.subject, target.listKind)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={title}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`fixed inset-0 z-[110] mx-auto flex max-w-[560px] flex-col bg-stone-50 ${className}`}
        >
          <header className="shrink-0 border-b border-stone-100/80 bg-stone-50/95 px-4 pb-4 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-white"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-stone-800">
                {title}
              </h1>
              {total > 0 ? (
                <span className="shrink-0 text-[13px] text-stone-400">
                  共 <ListenNum>{total.toLocaleString()}</ListenNum> 人
                </span>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-20 text-[13px] text-stone-400">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                加载中…
              </p>
            ) : null}

            {!loading && blocked ? (
              <div className="flex flex-col items-center py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                  <Lock className="size-6" strokeWidth={1.5} aria-hidden />
                </div>
                <p className="mt-4 text-[15px] font-medium text-stone-700">无法查看列表</p>
                <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-stone-400">
                  {blockReason ?? '对方已关闭关注/粉丝列表查看权限'}
                </p>
              </div>
            ) : null}

            {error && !loading && !blocked ? (
              <div className="py-16 text-center">
                <p className="text-[13px] text-rose-400">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadFirst()}
                  className="mt-3 text-[12px] text-stone-500 underline"
                >
                  重试
                </button>
              </div>
            ) : null}

            {!loading && !blocked && !error ? (
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="py-20 text-center text-[14px] text-stone-400">暂无数据</p>
                ) : null}
                {items.map((item) => (
                  <FollowListRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onOpenArtist={onOpenArtist}
                    onOpenUser={onOpenUser}
                  />
                ))}
                {more ? (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-[14px] font-medium text-stone-600 shadow-sm ring-1 ring-stone-100 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        加载中…
                      </>
                    ) : (
                      '加载更多'
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
