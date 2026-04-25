import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'

import type { MomentComment } from './mockMoments'

type InteractionPanelProps = {
  likes?: string[]
  comments?: MomentComment[]
  onReplyMock?: (comment: MomentComment) => void
}

export function InteractionPanel({ likes, comments, onReplyMock }: InteractionPanelProps) {
  const hasLikes = !!likes?.length
  const hasComments = !!comments?.length
  if (!hasLikes && !hasComments) return null
  return (
    <div className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2">
      {hasLikes ? (
        <div className="flex items-start gap-1.5 text-[13px] leading-relaxed text-[#374151]">
          <Heart className="mt-[2px] size-3.5 shrink-0 text-[#111827]" />
          <span>{likes?.join('，')}</span>
        </div>
      ) : null}
      {hasComments ? (
        <div className={hasLikes ? 'mt-2 space-y-1.5 border-t border-black/5 pt-2' : 'space-y-1.5'}>
          {comments?.map((comment) => (
            <motion.button
              key={comment.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onReplyMock?.(comment)}
              className="block w-full rounded-md px-1 py-0.5 text-left text-[13px] leading-relaxed text-[#374151] transition-colors hover:bg-white"
            >
              {comment.replyTo ? (
                <>
                  <span className="font-semibold text-[#111827]">{comment.author}</span>
                  <span className="mx-1 text-[#9CA3AF]">回复</span>
                  <span className="font-semibold text-[#111827]">{comment.replyTo}</span>
                  <span className="mx-1">:</span>
                  <span>{comment.content}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-[#111827]">{comment.author}</span>
                  <span className="mx-1">:</span>
                  <span>{comment.content}</span>
                </>
              )}
            </motion.button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
