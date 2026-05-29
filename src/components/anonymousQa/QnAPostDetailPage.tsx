import { MessagesSquare, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'

import type { AnonymousQaWechatContext } from './buildAnonymousQaPersonaContext'
import {
  QnADirectedCommentComposer,
  QnAUnifiedCommentSection,
  type QnaDirectedReplyTarget,
} from './QnADirectedDiscussion'
import { QnaTimeBadge } from './QnaTimeBadge'
import type { QnADirectedPost } from './qnaStoreTypes'
import type { MockContact } from './types'
import { QNA_GLASS_CARD, QNA_GLASS_HEADER } from './qnaUiStyles'
import { useQnAStore, useQnADirectedPost } from './useQnAStore'

const DEFAULT_AVATAR = '/image/个人名片默认头像1.png'

type QnAPostDetailPageProps = {
  post: QnADirectedPost
  onBack: () => void
  currentUserName?: string
  currentUserAvatar?: string
  contacts?: MockContact[]
  wechatCtx?: AnonymousQaWechatContext | null
}

function formatDetailTime(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da} ${h}:${mi}`
}

function DirectedDetailHeader({
  onBack,
  pendingCount,
  onRevealAll,
}: {
  onBack: () => void
  pendingCount: number
  onRevealAll: () => void
}) {
  const canReveal = pendingCount > 0
  return (
    <header
      className={`sticky top-0 z-20 flex shrink-0 items-center justify-between px-3 pb-2 ${QNA_GLASS_HEADER}`}
      style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={onBack}
        aria-label="关闭"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
      >
        <X className="size-5" strokeWidth={1.75} />
      </motion.button>
      <span className="text-[10px] tracking-[0.25em] text-[#9CA3AF]">THREAD</span>
      <motion.button
        type="button"
        whileTap={canReveal ? { scale: 0.96 } : undefined}
        onClick={onRevealAll}
        disabled={!canReveal}
        title={canReveal ? `显示全部评论互动（${pendingCount} 条未到点）` : '评论已全部显示'}
        aria-label="显示全部评论互动"
        className={`flex h-9 w-9 items-center justify-center rounded-full text-[#111827] transition-opacity ${
          canReveal ? '' : 'opacity-35'
        }`}
      >
        <MessagesSquare className="size-[17px]" strokeWidth={1.75} />
      </motion.button>
    </header>
  )
}

function QuestionCard({
  title,
  targetName,
  createdAt,
}: {
  title: string
  targetName: string
  createdAt: number
}) {
  return (
    <article className={`${QNA_GLASS_CARD} p-5`}>
      <h2 className="text-[20px] font-semibold leading-relaxed text-[#111827]">{title}</h2>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#111827] px-2.5 py-0.5 text-[10px] font-medium text-white">
          定向提问
        </span>
        <span className="rounded-full border border-black/10 bg-white/40 px-2.5 py-0.5 text-[10px] font-medium text-[#374151]">
          仅 {targetName} 可回答
        </span>
        <time className="ml-auto text-[11px] tabular-nums text-[#9CA3AF]">{formatDetailTime(createdAt)}</time>
      </div>
    </article>
  )
}

function AnswerCard({
  authorName,
  avatarUrl,
  content,
  createdAt,
  nowMs,
}: {
  authorName: string
  avatarUrl: string
  content: string
  createdAt: number
  nowMs: number
}) {
  return (
    <article className={`${QNA_GLASS_CARD} p-5`}>
      <div className="flex items-start gap-3">
        <img
          src={avatarUrl}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full border border-black/8 object-cover shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-[#111827]">{authorName}</p>
            <span className="rounded-full border border-amber-200/90 bg-amber-50/90 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              答主
            </span>
            <QnaTimeBadge ts={createdAt} nowMs={nowMs} />
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-[#374151]">{content}</p>
        </div>
      </div>
    </article>
  )
}

export function QnAPostDetailPage({
  post,
  onBack,
  currentUserName = '我',
  currentUserAvatar,
  contacts = [],
  wechatCtx = null,
}: QnAPostDetailPageProps) {
  const { now, countPendingComments, revealAllComments } = useQnAStore()
  const livePost = useQnADirectedPost(post.id) ?? post
  const [replyTarget, setReplyTarget] = useState<QnaDirectedReplyTarget | null>(null)
  const pendingCount = useMemo(
    () => countPendingComments(livePost),
    [countPendingComments, livePost],
  )

  const answerAvatar = livePost.targetCharacterAvatar?.trim() || DEFAULT_AVATAR

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <DirectedDetailHeader
        onBack={onBack}
        pendingCount={pendingCount}
        onRevealAll={() => revealAllComments(livePost.id)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex max-w-[560px] flex-col gap-4">
          <QuestionCard
            title={livePost.question}
            targetName={livePost.targetCharacterName}
            createdAt={livePost.createdAt}
          />

          <AnswerCard
            authorName={livePost.targetCharacterName}
            avatarUrl={answerAvatar}
            content={livePost.characterAnswer}
            createdAt={livePost.createdAt}
            nowMs={now}
          />

          <QnAUnifiedCommentSection
            post={livePost}
            nowMs={now}
            contacts={contacts}
            onReplyTarget={setReplyTarget}
          />
        </div>
      </div>

      <QnADirectedCommentComposer
        post={livePost}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        contacts={contacts}
        wechatCtx={wechatCtx}
        replyTarget={replyTarget}
        onReplyTarget={setReplyTarget}
      />
    </motion.div>
  )
}
