import { Loader2, Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { addLocalComment, type ListenCommentTargetType } from './listenLocalComments'
import { postNeteaseComment, type NeteaseSongComment } from './neteaseMusicApi'

export type ListenCommentAuthor = {
  nickname: string
  avatar: string
  userId: number
}

export type ListenCommentComposerProps = {
  targetType: ListenCommentTargetType
  targetId: number
  cookie: string
  author?: ListenCommentAuthor
  onPosted: (comment: NeteaseSongComment) => void
  onToast?: (message: string) => void
  onRequireLogin?: () => void
}

export function ListenCommentComposer({
  targetType,
  targetId,
  cookie,
  author,
  onPosted,
  onToast,
  onRequireLogin,
}: ListenCommentComposerProps) {
  const hasCookie = Boolean(cookie.trim())
  const [content, setContent] = useState('')
  const [syncToNetease, setSyncToNetease] = useState(hasCookie)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!hasCookie) setSyncToNetease(false)
  }, [hasCookie])

  const resolvedAuthor = {
    nickname: author?.nickname?.trim() || '我',
    avatar: author?.avatar ?? '',
    userId: author?.userId ?? 0,
  }

  const handleSend = useCallback(async () => {
    const text = content.trim()
    if (!text || !targetId || sending) return

    if (syncToNetease) {
      if (!hasCookie) {
        onToast?.('请先登录网易云账号')
        onRequireLogin?.()
        return
      }
      setSending(true)
      try {
        const comment = await postNeteaseComment(cookie, {
          resourceId: targetId,
          type: targetType === 'song' ? 0 : 2,
          content: text,
        })
        setContent('')
        onPosted({
          ...comment,
          nickname: comment.nickname || resolvedAuthor.nickname,
          avatar: comment.avatar || resolvedAuthor.avatar,
          userId: comment.userId || resolvedAuthor.userId,
        })
        onToast?.('评论已同步到网易云')
      } catch (e) {
        onToast?.(e instanceof Error ? e.message : '发送失败')
      } finally {
        setSending(false)
      }
      return
    }

    setSending(true)
    try {
      const comment = await addLocalComment(targetType, targetId, {
        content: text,
        nickname: resolvedAuthor.nickname,
        avatar: resolvedAuthor.avatar,
        userId: resolvedAuthor.userId,
      })
      setContent('')
      onPosted(comment)
      onToast?.('已保存，仅在本机显示')
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSending(false)
    }
  }, [
    content,
    targetId,
    sending,
    syncToNetease,
    hasCookie,
    cookie,
    targetType,
    onPosted,
    onToast,
    onRequireLogin,
    resolvedAuthor.nickname,
    resolvedAuthor.avatar,
    resolvedAuthor.userId,
  ])

  const canSend = content.trim().length > 0 && !sending

  return (
    <div className="shrink-0 border-t border-stone-100/90 bg-stone-50/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md">
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) void handleSend()
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="写下你的评论…"
          className="max-h-24 min-h-[40px] flex-1 resize-none rounded-2xl bg-white px-3.5 py-2.5 text-[15px] leading-snug text-stone-700 shadow-sm ring-1 ring-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-rose-200"
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void handleSend()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-400 text-white shadow-sm transition-colors hover:bg-rose-500 disabled:opacity-40"
          aria-label="发送评论"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <Send className="size-4" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-stone-500">
        <button
          type="button"
          role="switch"
          aria-checked={syncToNetease}
          disabled={!hasCookie}
          onClick={() => {
            if (!hasCookie) {
              onToast?.('登录后可同步到网易云')
              onRequireLogin?.()
              return
            }
            setSyncToNetease((v) => !v)
          }}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            syncToNetease ? 'bg-rose-400' : 'bg-stone-200'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              syncToNetease ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span>
          同步到网易云
          {!hasCookie ? (
            <span className="ml-1 text-stone-400">（未登录，仅本机显示）</span>
          ) : syncToNetease ? null : (
            <span className="ml-1 text-stone-400">（关闭后仅 Lumi 内可见）</span>
          )}
        </span>
      </label>
    </div>
  )
}
