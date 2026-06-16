import { Heart, Loader2, Share2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import {
  ListenCommentHugAnimation,
  ListenCommentHugButton,
} from './ListenCommentHugGesture'
import { formatListenCommentTime } from './listenCommentTime'
import { ListenNum, ListenNumericText } from './ListenNum'
import { ListenNeteaseCommentText } from './ListenNeteaseCommentText'
import type { NeteaseSongComment } from './neteaseMusicApi'

export type ListenCommentItemProps = {
  comment: NeteaseSongComment
  canInteract: boolean
  hugged?: boolean
  liking?: boolean
  hugging?: boolean
  onLike?: () => void
  onHug?: () => void
  onShare?: () => void
  onRequireLogin?: () => void
}

const HUG_ANIM_MS = 620

export function ListenCommentItem({
  comment,
  canInteract,
  hugged = false,
  liking = false,
  hugging = false,
  onLike,
  onHug,
  onShare,
  onRequireLogin,
}: ListenCommentItemProps) {
  const [hugAnim, setHugAnim] = useState(false)
  const animTimerRef = useRef<number | null>(null)

  const guard = (action: () => void) => {
    if (!canInteract) {
      onRequireLogin?.()
      return
    }
    action()
  }

  const handleHugClick = useCallback(() => {
    if (!onHug) return
    if (hugged || hugging) return
    if (!canInteract) {
      onRequireLogin?.()
      return
    }
    setHugAnim(true)
    if (animTimerRef.current != null) {
      window.clearTimeout(animTimerRef.current)
    }
    animTimerRef.current = window.setTimeout(() => {
      setHugAnim(false)
      animTimerRef.current = null
    }, HUG_ANIM_MS)
    onHug()
  }, [canInteract, hugged, hugging, onHug, onRequireLogin])

  return (
    <article className="flex gap-3 rounded-2xl bg-white/90 px-3 py-3 shadow-sm ring-1 ring-stone-100/80">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-100">
        {comment.avatar ? (
          <img
            src={comment.avatar}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-stone-400">
            {comment.nickname.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-medium text-stone-700">
            <ListenNumericText text={comment.nickname} />
          </p>
          {comment.localOnly ? (
            <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-500">
              本机
            </span>
          ) : null}
          {comment.isHot ? (
            <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-400">
              热评
            </span>
          ) : null}
        </div>

        <ListenCommentHugAnimation active={hugAnim}>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-stone-600">
            <ListenNeteaseCommentText text={comment.content} />
          </p>
        </ListenCommentHugAnimation>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-stone-400">
          <ListenNumericText text={formatListenCommentTime(comment.time)} />
          <div className="ml-auto flex items-center gap-2">
            {onShare ? (
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-stone-500 transition-colors hover:bg-sky-50/80 hover:text-sky-500 active:scale-[0.97]"
                aria-label="分享这条评论给好友"
              >
                <Share2 className="size-3.5" strokeWidth={1.5} />
                <span>分享</span>
              </button>
            ) : null}
            {comment.localOnly || !onLike || !onHug ? null : (
              <>
                <ListenCommentHugButton
                  hugged={hugged}
                  hugging={hugging}
                  onClick={handleHugClick}
                />
                <button
                  type="button"
                  disabled={liking}
                  onClick={() => guard(() => onLike?.())}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors active:scale-[0.97] disabled:opacity-60 ${
                    comment.liked
                      ? 'bg-rose-50 text-rose-500'
                      : 'text-stone-500 hover:bg-rose-50/80 hover:text-rose-500'
                  }`}
                  aria-label={comment.liked ? '取消点赞' : '点赞这条评论'}
                  aria-pressed={comment.liked}
                >
                  {liking ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Heart
                      className={`size-3.5 ${comment.liked ? 'fill-current' : ''}`}
                      strokeWidth={1.5}
                    />
                  )}
                  {comment.likedCount > 0 ? <ListenNum>{comment.likedCount}</ListenNum> : null}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
