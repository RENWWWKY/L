import { MessageCircle, Send, Sparkles, VenetianMask, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import {
  resolveDirectedQnaPlayerName,
  type AnonymousQaWechatContext,
} from './buildAnonymousQaPersonaContext'
import {
  DirectedInteractionError,
  generateDirectedThreadInteraction,
} from './directedCommentInteractionAi'
import { getVisibleThreadReplies, patchQnaDirectedPost } from './qnaDirectedStore'
import { relationLabelForDisplay } from './qnaDirectedRelationLabel'
import {
  buildUnifiedCommentList,
  countUnifiedComments,
  displayAuthorType,
  migrateVisibleBondIntoThreads,
  resolveThreadCommentId,
} from './qnaUnifiedComments'
import { buildQnaContactDisplayIndex, type QnaContactDisplayIndex } from './qnaContactDisplay'
import {
  DIRECTED_ANONYMOUS_AUTHOR,
  DIRECTED_ANONYMOUS_SELF_LABEL,
  directedPlayerRoutingLabels,
  isDirectedAnonymousAuthor,
  resolveDirectedPlayerWechatNickname,
} from './qnaDirectedPlayerDisplay'
import { distributeInteractionReplies } from './qnaThreadReplyRouting'
import type { QnADirectedPost, QnAThreadComment, QnAThreadReply } from './qnaStoreTypes'
import { QnaTimeBadge } from './QnaTimeBadge'
import type { MockContact } from './types'
import { QNA_GLASS_CARD, QNA_GLASS_FOOTER } from './qnaUiStyles'
import { useQnAStore } from './useQnAStore'

const DEFAULT_AVATAR = '/image/个人名片默认头像1.png'

export type QnaDirectedReplyTarget = {
  commentId: string
  replyToName: string
  replyToContent: string
}

function RelationTag({ label }: { label: string }) {
  const text = relationLabelForDisplay(label)
  if (!text) return null
  return (
    <span className="rounded-full border border-sky-200/90 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
      {text}
    </span>
  )
}

function AuthorBadge() {
  return (
    <span className="rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
      答主
    </span>
  )
}

function ReplyQuoteInline({ name }: { name: string }) {
  return (
    <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500">
      <span className="shrink-0 text-gray-400">回复</span>
      <span className="truncate font-medium text-gray-700">@{name}</span>
    </div>
  )
}

function ReplyQuoteBar({ name, onCancel }: { name: string; onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/50 px-3 py-2 text-[12px] text-[#6B7280] backdrop-blur-sm">
      <span className="min-w-0 truncate">
        正在回复 <span className="font-semibold text-gray-800">@{name}</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/80"
        aria-label="取消回复"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function CommentBody({ text }: { text: string }) {
  const parts = text.split(/(@[\u4e00-\u9fa5A-Za-z0-9_·]+)/g)
  return (
    <p className="mt-2 text-[14px] leading-relaxed text-gray-800">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-medium text-gray-700">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

function MetaActions({
  ts,
  nowMs,
  onReply,
}: {
  ts: number
  nowMs: number
  onReply: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-end gap-3">
      <QnaTimeBadge ts={ts} nowMs={nowMs} />
      <button
        type="button"
        onClick={onReply}
        className="text-[12px] font-medium text-gray-400 transition-colors hover:text-gray-700"
      >
        回复
      </button>
    </div>
  )
}

function UserAvatar({ anonymous, src }: { anonymous?: boolean; src?: string }) {
  if (anonymous) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#E8EAED]">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(17,24,39,0.06) 4px, rgba(17,24,39,0.06) 8px)',
          }}
        />
        <VenetianMask className="relative size-[18px] text-[#6B7280]" strokeWidth={1.35} />
      </div>
    )
  }
  return <img src={src || DEFAULT_AVATAR} alt="" className="h-full w-full object-cover" />
}

/** 仅用户本人匿名评论显示「匿名（我）」 */
function UserAuthorName({
  anonymous,
  isOwnComment,
  name,
}: {
  anonymous?: boolean
  isOwnComment?: boolean
  name: string
}) {
  if (isOwnComment && (anonymous || isDirectedAnonymousAuthor(name))) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full border border-dashed border-[#9CA3AF]/80 bg-white/50 px-2 py-0.5 text-[12px] font-medium tracking-[0.12em] text-[#4B5563] backdrop-blur-[2px]">
          {DIRECTED_ANONYMOUS_AUTHOR}
        </span>
        <span className="text-[12px] font-normal text-[#6B7280]">（我）</span>
      </span>
    )
  }
  if (isDirectedAnonymousAuthor(name)) {
    return (
      <span className="rounded-full border border-dashed border-[#D1D5DB] bg-white/40 px-2 py-0.5 text-[12px] font-medium tracking-[0.08em] text-[#6B7280]">
        {DIRECTED_ANONYMOUS_AUTHOR}
      </span>
    )
  }
  return <span className="text-[14px] font-semibold text-blue-600">{name}</span>
}

function AuthorName({
  type,
  name,
  anonymous,
  isOwnComment,
}: {
  type: ReturnType<typeof displayAuthorType>
  name: string
  anonymous?: boolean
  isOwnComment?: boolean
}) {
  if (type === 'user') {
    return <UserAuthorName anonymous={anonymous} isOwnComment={isOwnComment} name={name} />
  }
  if (type === 'author') {
    return <span className="text-[14px] font-semibold text-gray-900">{name}</span>
  }
  return <span className="text-[14px] font-semibold text-gray-800">{name}</span>
}

function replyDisplayTime(reply: QnAThreadReply): number {
  return reply.visibleAt ?? reply.createdAt
}

function ReplyRow({
  reply,
  nowMs,
  onReply,
}: {
  reply: QnAThreadReply
  nowMs: number
  onReply: () => void
}) {
  const isUser = reply.authorType === 'user'
  const isAuthor = reply.authorType === 'author'
  const userAnonymous = isUser && reply.isAnonymous

  return (
    <li className="border-l-2 border-gray-100 pl-4 sm:pl-5">
      <div className="flex gap-2.5 pt-3">
        <div
          className={`mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full shadow-sm ${
            userAnonymous ? 'ring-1 ring-dashed ring-[#9CA3AF]/70' : 'border border-gray-100'
          }`}
        >
          <UserAvatar anonymous={userAnonymous} src={reply.authorAvatar} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <AuthorName
              type={reply.authorType}
              name={reply.authorName}
              anonymous={userAnonymous}
              isOwnComment={isUser}
            />
            {isAuthor ? <AuthorBadge /> : null}
            {!isAuthor && !isUser && reply.relationLabel ? (
              <RelationTag label={reply.relationLabel} />
            ) : null}
          </div>
          {reply.replyToName ? <ReplyQuoteInline name={reply.replyToName} /> : null}
          <CommentBody text={reply.content} />
          <MetaActions ts={replyDisplayTime(reply)} nowMs={nowMs} onReply={onReply} />
        </div>
      </div>
    </li>
  )
}

function UnifiedCommentCard({
  comment,
  nowMs,
  onReplyTarget,
}: {
  comment: QnAThreadComment
  nowMs: number
  onReplyTarget: (t: QnaDirectedReplyTarget) => void
}) {
  const authorType = displayAuthorType(comment)
  const userAnonymous = authorType === 'user' && comment.isAnonymous
  const visibleReplies = getVisibleThreadReplies(comment, nowMs)
  const pendingMore = comment.replies.length > visibleReplies.length
  const replyToLabel = (name: string, anonymous?: boolean) =>
    anonymous || isDirectedAnonymousAuthor(name) ? DIRECTED_ANONYMOUS_AUTHOR : name

  return (
    <article className="border-b border-gray-50 pb-5 last:border-b-0 last:pb-0">
      <div className="flex gap-3">
        <div
          className={`h-10 w-10 shrink-0 overflow-hidden rounded-full shadow-sm ${
            userAnonymous ? 'ring-1 ring-dashed ring-[#9CA3AF]/70' : 'border border-gray-100'
          }`}
        >
          <UserAvatar anonymous={userAnonymous} src={comment.authorAvatar} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <AuthorName
              type={authorType}
              name={comment.authorName}
              anonymous={userAnonymous}
              isOwnComment={authorType === 'user'}
            />
            {authorType === 'author' ? <AuthorBadge /> : null}
            {authorType === 'character' && comment.relationLabel ? (
              <RelationTag label={comment.relationLabel} />
            ) : null}
          </div>
          <CommentBody text={comment.content} />
          <MetaActions
            ts={comment.createdAt}
            nowMs={nowMs}
            onReply={() =>
              onReplyTarget({
                commentId: comment.id,
                replyToName: replyToLabel(comment.authorName, comment.isAnonymous),
                replyToContent: comment.content,
              })
            }
          />
          {visibleReplies.length > 0 ? (
            <ul className="mt-1 space-y-0 pl-2 sm:pl-4">
              {visibleReplies.map((r) => (
                <ReplyRow
                  key={r.id}
                  reply={r}
                  nowMs={nowMs}
                  onReply={() =>
                    onReplyTarget({
                      commentId: comment.id,
                      replyToName: replyToLabel(r.authorName, r.isAnonymous),
                      replyToContent: r.content,
                    })
                  }
                />
              ))}
            </ul>
          ) : null}
          {pendingMore ? (
            <p className="mt-2 text-[11px] text-gray-400">更多角色正在接话…</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function SummonInteractionButton({
  disabled,
  loading,
  onClick,
}: {
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-gray-800 bg-gray-900 px-3 py-2 text-[11px] font-medium text-white shadow-sm transition-opacity hover:bg-gray-800 ${
        disabled || loading ? 'opacity-50' : ''
      }`}
    >
      <Sparkles className="size-3.5 text-white/90" strokeWidth={1.75} />
      {loading ? '互动中…' : '触发互动'}
    </button>
  )
}

function resolveUserReplyTarget(
  tc: QnAThreadComment,
  userReply: QnAThreadReply,
): QnaDirectedReplyTarget {
  const replyToName = userReply.replyToName?.trim() ?? ''
  if (!replyToName) {
    return { commentId: tc.id, replyToName: '', replyToContent: '' }
  }
  if (replyToName === tc.authorName.trim()) {
    return { commentId: tc.id, replyToName, replyToContent: tc.content }
  }
  const idx = tc.replies.findIndex((x) => x.id === userReply.id)
  for (let k = idx - 1; k >= 0; k--) {
    const prev = tc.replies[k]!
    if (prev.authorName.trim() === replyToName) {
      return { commentId: tc.id, replyToName, replyToContent: prev.content }
    }
  }
  return { commentId: tc.id, replyToName, replyToContent: '' }
}

/** 取最新一条玩家评论/回复，供「触发互动」使用 */
function findLatestUserCommentTarget(post: QnADirectedPost): {
  commentId: string
  text: string
  replyTarget: QnaDirectedReplyTarget | null
  isAnonymous: boolean
} | null {
  const threads = post.threadComments ?? []
  for (let i = threads.length - 1; i >= 0; i--) {
    const tc = threads[i]!
    for (let j = tc.replies.length - 1; j >= 0; j--) {
      const r = tc.replies[j]!
      if (r.authorType === 'user') {
        return {
          commentId: tc.id,
          text: r.content,
          replyTarget: resolveUserReplyTarget(tc, r),
          isAnonymous: r.isAnonymous === true,
        }
      }
    }
    if (tc.authorType === 'user') {
      return {
        commentId: tc.id,
        text: tc.content,
        replyTarget: null,
        isAnonymous: tc.isAnonymous === true,
      }
    }
  }
  return null
}

function AnonymousCommentToggle({
  active,
  disabled,
  onChange,
}: {
  active: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!active)}
      aria-pressed={active}
      aria-label={active ? '当前将以匿名（我）发送，点击切换为实名' : '当前实名发送，点击切换为匿名'}
      className={`flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-medium transition-all ${
        active
          ? 'border-[#9CA3AF]/60 bg-[#F3F4F6] text-[#374151] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]'
          : 'border-black/10 bg-white/65 text-[#6B7280] backdrop-blur-sm hover:bg-white/85'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <VenetianMask className={`size-4 shrink-0 ${active ? 'text-[#4B5563]' : 'text-[#9CA3AF]'}`} strokeWidth={1.5} />
      <span className="flex flex-col items-start leading-tight">
        <span>{active ? '面具' : '实名'}</span>
        {active ? <span className="text-[9px] font-normal text-[#9CA3AF]">（我）</span> : null}
      </span>
    </button>
  )
}

type QnADirectedDiscussionProps = {
  post: QnADirectedPost
  currentUserName: string
  currentUserAvatar?: string
  contacts: MockContact[]
  wechatCtx: AnonymousQaWechatContext | null
  replyTarget: QnaDirectedReplyTarget | null
  onReplyTarget: (t: QnaDirectedReplyTarget | null) => void
}

export function QnAUnifiedCommentSection({
  post,
  nowMs,
  contacts = [],
  onReplyTarget,
}: {
  post: QnADirectedPost
  nowMs: number
  contacts?: MockContact[]
  onReplyTarget: (t: QnaDirectedReplyTarget) => void
}) {
  const [contactIndex, setContactIndex] = useState<QnaContactDisplayIndex | null>(null)
  useEffect(() => {
    let cancelled = false
    void buildQnaContactDisplayIndex(contacts).then((idx) => {
      if (!cancelled) setContactIndex(idx)
    })
    return () => {
      cancelled = true
    }
  }, [contacts])

  const unified = useMemo(
    () => buildUnifiedCommentList(post, nowMs, contactIndex ?? undefined),
    [post, nowMs, contactIndex],
  )
  const total = useMemo(() => countUnifiedComments(post, nowMs), [post, nowMs])
  const pendingBond =
    post.comments.length > 0 && post.comments.some((c) => c.visibleAt > nowMs)

  return (
    <section className="pt-2">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="size-5 text-[#111827]" strokeWidth={1.75} />
        <h3 className="text-[17px] font-semibold text-[#111827]">全部评论</h3>
        <span className="text-[13px] font-medium tabular-nums text-[#9CA3AF]">({total})</span>
      </div>

      <div className={`${QNA_GLASS_CARD} p-4`}>
        {unified.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-[#9CA3AF]">
            {pendingBond ? '羁绊角色正在赶来评论区…' : '还没有评论，做第一个开口的人吧'}
          </p>
        ) : (
          <div className="space-y-0">
            {unified.map((c) => (
              <UnifiedCommentCard
                key={c.id}
                comment={c}
                nowMs={nowMs}
                onReplyTarget={onReplyTarget}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** @deprecated 使用 QnAUnifiedCommentSection */
export const QnADirectedDiscussionThreads = QnAUnifiedCommentSection

export function QnADirectedCommentComposer({
  post,
  currentUserName,
  currentUserAvatar,
  contacts,
  wechatCtx,
  replyTarget,
  onReplyTarget,
}: QnADirectedDiscussionProps) {
  const { now, saveDirectedPost } = useQnAStore()
  const [draft, setDraft] = useState('')
  const [commentAnonymous, setCommentAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summoning, setSummoning] = useState(false)
  const [interactionError, setInteractionError] = useState<string | null>(null)
  const busy = submitting || summoning

  /** 评论区展示：微信「我」页昵称，不用身份档案姓名 */
  const wechatNickname = resolveDirectedPlayerWechatNickname(wechatCtx, currentUserName)

  const playerAvatar =
    currentUserAvatar?.trim() ||
    contacts.find((c) => c.id === 'self')?.avatarUrl?.trim() ||
    DEFAULT_AVATAR

  const patchThreads = (updater: (comments: QnAThreadComment[]) => QnAThreadComment[]) => {
    patchQnaDirectedPost(post.id, (p) => {
      const migrated = migrateVisibleBondIntoThreads(p, now)
      const next = updater(migrated.threadComments ?? [])
      return { ...migrated, threadComments: next }
    })
  }

  const appendAiReplies = async (
    commentId: string,
    text: string,
    target: QnaDirectedReplyTarget | null,
    basePost: QnADirectedPost,
    userCommentAnonymous: boolean,
  ) => {
    const playerIdentityName = userCommentAnonymous
      ? undefined
      : await resolveDirectedQnaPlayerName({ wechatCtx, fallback: wechatNickname })
    const aiReplies = await generateDirectedThreadInteraction({
      post: basePost,
      userComment: text,
      playerWechatNickname: wechatNickname,
      userCommentAnonymous,
      contacts,
      wechatCtx,
      replyToName: target?.replyToName,
      replyToContent: target?.replyToContent,
    })
    if (!aiReplies.length) {
      throw new DirectedInteractionError('未生成任何角色回复')
    }
    const playerLabels = directedPlayerRoutingLabels({
      wechatNickname,
      identityName: playerIdentityName,
      includeAnonymous: true,
    })
    const contactIndex = await buildQnaContactDisplayIndex(contacts)
    patchThreads((comments) =>
      distributeInteractionReplies(comments, commentId, aiReplies, {
        playerLabels,
        authorName: basePost.targetCharacterName,
        contactIndex,
      }),
    )
  }

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || submitting) return

    setSubmitting(true)
    const baseMs = Date.now()

    try {
      if (replyTarget) {
        const { post: resolvedPost, commentId } = resolveThreadCommentId(post, replyTarget.commentId, now)
        if (resolvedPost !== post) saveDirectedPost(resolvedPost)

        const userReply: QnAThreadReply = {
          id: `ur-${baseMs}`,
          createdAt: baseMs,
          authorType: 'user',
          authorName: commentAnonymous ? DIRECTED_ANONYMOUS_AUTHOR : wechatNickname,
          authorAvatar: commentAnonymous ? '' : playerAvatar,
          isAnonymous: commentAnonymous,
          replyToName: replyTarget.replyToName,
          content: text,
        }
        patchThreads((comments) =>
          comments.map((c) =>
            c.id === commentId ? { ...c, replies: [...c.replies, userReply] } : c,
          ),
        )
        setDraft('')
        onReplyTarget(null)
        return
      }

      const commentId = `tc-${baseMs}`
      const userComment: QnAThreadComment = {
        id: commentId,
        createdAt: baseMs,
        authorType: 'user',
        authorName: commentAnonymous ? DIRECTED_ANONYMOUS_AUTHOR : wechatNickname,
        authorAvatar: commentAnonymous ? '' : playerAvatar,
        isAnonymous: commentAnonymous,
        content: text,
        replies: [],
      }
      const migrated = migrateVisibleBondIntoThreads(post, now)
      const nextPost: QnADirectedPost = {
        ...migrated,
        threadComments: [...(migrated.threadComments ?? []), userComment],
      }
      saveDirectedPost(nextPost)
      setDraft('')
    } catch {
      // 玩家评论已写入
    } finally {
      setSubmitting(false)
    }
  }

  const handleSummonInteraction = async () => {
    if (busy) return
    const migrated = migrateVisibleBondIntoThreads(post, now)
    const latest = findLatestUserCommentTarget(migrated)
    if (!latest) return

    setSummoning(true)
    setInteractionError(null)
    try {
      const { post: resolvedPost, commentId } = resolveThreadCommentId(
        migrated,
        latest.commentId,
        now,
      )
      if (resolvedPost !== post) saveDirectedPost(resolvedPost)
      const base = resolvedPost !== post ? resolvedPost : migrated
      await appendAiReplies(
        commentId,
        latest.text,
        latest.replyTarget,
        base,
        latest.isAnonymous,
      )
    } catch (e) {
      const msg =
        e instanceof DirectedInteractionError
          ? e.message
          : e instanceof Error && e.message.trim()
            ? e.message
            : '角色互动失败，请稍后重试'
      setInteractionError(msg)
    } finally {
      setSummoning(false)
    }
  }

  const canSummon = !!findLatestUserCommentTarget(migrateVisibleBondIntoThreads(post, now))
  const placeholder = replyTarget
    ? `回复 @${replyTarget.replyToName}…`
    : commentAnonymous
      ? `以 ${DIRECTED_ANONYMOUS_SELF_LABEL} 说点什么…`
      : '说点什么...'

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] ${QNA_GLASS_FOOTER}`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto max-w-[560px] space-y-2 px-4 pb-3 pt-2">
        {replyTarget ? (
          <ReplyQuoteBar name={replyTarget.replyToName} onCancel={() => onReplyTarget(null)} />
        ) : null}
        <div className="flex items-end gap-2">
          <SummonInteractionButton
            disabled={!canSummon}
            loading={summoning}
            onClick={() => void handleSummonInteraction()}
          />
          <AnonymousCommentToggle
            active={commentAnonymous}
            disabled={busy}
            onChange={setCommentAnonymous}
          />
          <label className="sr-only" htmlFor="qna-directed-comment">
            {replyTarget ? '回复评论' : '发表评论'}
          </label>
          <textarea
            id="qna-directed-comment"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            disabled={busy}
            className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-[14px] text-[#111827] outline-none backdrop-blur-sm transition-colors placeholder:text-[#9CA3AF] focus:border-black/15 focus:bg-white/90"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            disabled={!draft.trim() || busy}
            onClick={() => void handleSend()}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-gray-900 text-white shadow-md disabled:opacity-40"
            aria-label="发送"
          >
            <Send className="size-[18px]" strokeWidth={1.75} />
          </motion.button>
        </div>
        {interactionError ? (
          <p className="text-center text-[12px] font-medium text-red-600">{interactionError}</p>
        ) : summoning ? (
          <p className="text-center text-[11px] text-gray-500">角色们正在接话…</p>
        ) : null}
      </div>
    </div>
  )
}

export function QnADirectedDiscussionPanel(
  props: Omit<QnADirectedDiscussionProps, 'replyTarget' | 'onReplyTarget'>,
) {
  const { now } = useQnAStore()
  const [replyTarget, setReplyTarget] = useState<QnaDirectedReplyTarget | null>(null)

  return (
    <>
      <QnAUnifiedCommentSection
        post={props.post}
        nowMs={now}
        contacts={props.contacts}
        onReplyTarget={setReplyTarget}
      />
      <QnADirectedCommentComposer
        {...props}
        replyTarget={replyTarget}
        onReplyTarget={setReplyTarget}
      />
    </>
  )
}

export function QnADirectedDiscussion(
  props: Omit<QnADirectedDiscussionProps, 'replyTarget' | 'onReplyTarget'>,
) {
  return <QnADirectedDiscussionPanel {...props} />
}
