import { motion } from 'framer-motion'

import { ListenNeteaseCommentText } from '../../../../components/discoverListen/ListenNeteaseCommentText'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { WeChatListenCommentSharePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatListenCommentSharePayload
  onOpen?: () => void
}

/** 听一听评论分享卡：曲目信息 + 显眼评论摘录 */
export function ListenCommentShareCard({ data, onOpen }: Props) {
  const artistLine =
    data.targetType === 'song'
      ? data.targetArtist?.trim() || 'Unknown Artist'
      : '歌单评论'

  const hint =
    data.targetType === 'song' ? '点击查看歌曲评论' : '点击查看歌单评论'

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.()
      }}
      aria-label={hint}
      title={hint}
      className="w-[min(280px,calc(100vw-120px))] overflow-hidden rounded-[16px] border border-white/70 bg-white/80 text-left shadow-[0_4px_28px_rgba(255,192,203,0.24)] ring-1 ring-rose-100/55 backdrop-blur-md transition-transform active:scale-[0.98] hover:ring-rose-200/80"
      {...CARD_MOTION}
    >
      <div className="flex gap-3 p-3.5">
        {data.targetCover ? (
          <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[12px] shadow-[0_2px_12px_rgba(255,192,203,0.28)] ring-1 ring-rose-100/60">
            <img
              src={data.targetCover}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="h-[56px] w-[56px] shrink-0 rounded-[12px] bg-gradient-to-br from-rose-50 to-[#FFF0F3] ring-1 ring-rose-100/60" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-400/90">
            {data.targetType === 'song' ? 'Song · 单曲' : 'Playlist · 歌单'}
          </p>
          <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-[#2D2422]">
            <ListenNumericText text={data.targetTitle} />
          </p>
          <p className="mt-0.5 truncate text-[12px] text-stone-400">
            <ListenNumericText text={artistLine} />
          </p>
        </div>
      </div>

      <div className="border-t border-rose-100/55 bg-gradient-to-br from-rose-50/70 via-white/40 to-amber-50/30 px-3.5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-500">
          分享的评论
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-medium leading-relaxed text-[#2D2422]">
          <ListenNeteaseCommentText text={data.commentText} />
        </p>
        <p className="mt-2 truncate text-[12px] text-stone-400">
          — <ListenNumericText text={data.commentAuthor} />
        </p>
        {onOpen ? (
          <p className="mt-2.5 text-[11px] font-medium text-rose-400/90">点击查看评论区 →</p>
        ) : null}
      </div>
    </motion.button>
  )
}
