import { motion } from 'framer-motion'
import { ArrowLeft, Hash, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { PostCard } from './components/PostCard'
import { PulseWeiboFacePicker } from './components/PulseWeiboFacePicker'
import { PulseWeiboFaceText } from './components/PulseWeiboFaceText'
import { PULSE_COLORS, PULSE_MODAL_SPRING } from './constants'
import { insertAtTextareaCursor } from './pulseWeiboRichText'
import { aiGeneratePulseComments, aiGeneratePulseFeedPosts, nestPulseComments } from './lumiPulseAi'
import {
  pickStablePulseNetizenAvatarPath,
  resolvePulseAuthorAvatarForPersist,
  resolvePulseAuthorAvatarUrl,
} from './pulseNetizenAvatar'
import type { PulseComment, PulsePost } from './pulseTypes'
import { usePulsePostComments } from './pulseStoreSelectors'
import { usePulseStore } from './usePulseStore'

function CommentBlock({
  comment,
  depth = 0,
}: {
  comment: PulseComment & { replies?: PulseComment[] }
  depth?: number
}) {
  const avatarSrc = useMemo(() => {
    const stored = resolvePulseAuthorAvatarUrl(comment.authorAvatarUrl)
    if (stored) return stored
    const path = resolvePulseAuthorAvatarForPersist(
      comment.authorPovId,
      comment.authorName,
      comment.authorAvatarUrl,
      comment.isAiGenerated,
    )
    return resolvePulseAuthorAvatarUrl(path)
  }, [comment.authorAvatarUrl, comment.authorName, comment.authorPovId, comment.isAiGenerated])

  return (
    <div className={depth > 0 ? 'ml-5 mt-3 border-l border-black/[0.04] pl-4' : 'mt-4'}>
      <div className="flex items-center gap-2">
        {avatarSrc ? (
          <img src={avatarSrc} alt="" className="size-8 rounded-full object-cover ring-1 ring-black/[0.04]" />
        ) : (
          <div className="size-8 rounded-full bg-[#F5F5F4]" />
        )}
        <span className="text-[12px] font-medium text-[#1C1C1E]">{comment.authorName}</span>
      </div>
      <p className="mt-1.5 font-serif text-[13px] leading-relaxed text-neutral-600">
        <PulseWeiboFaceText text={comment.content} />
      </p>
      {comment.replies?.map((r) => (
        <CommentBlock key={r.id} comment={r} depth={depth + 1} />
      ))}
    </div>
  )
}

export function PostDetail({
  post,
  currentPlayerPovId,
  authorLabel,
  authorAvatarUrl,
  onBack,
  onToast,
  onRepost,
}: {
  post: PulsePost
  currentPlayerPovId: string
  authorLabel: string
  authorAvatarUrl?: string
  onBack: () => void
  onToast: (msg: string) => void
  onRepost: () => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const comments = usePulsePostComments(post.id)
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const addComment = usePulseStore((s) => s.appendAiComments)
  const appendAiPosts = usePulseStore((s) => s.appendAiPosts)
  const addUserComment = usePulseStore((s) => s.addComment)
  const ensurePostDetailAvatars = usePulseStore((s) => s.ensurePostDetailAvatars)
  const [refreshing, setRefreshing] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const commentInputRef = useRef<HTMLInputElement>(null)

  const insertCommentToken = useCallback((token: string) => {
    setCommentDraft((prev) => {
      const el = commentInputRef.current
      const { next, cursor } = insertAtTextareaCursor(prev, token, el)
      requestAnimationFrame(() => {
        if (el) {
          el.focus()
          el.setSelectionRange(cursor, cursor)
        }
      })
      return next
    })
  }, [])

  const nested = useMemo(() => nestPulseComments(comments), [comments])

  /** 首次打开详情：为 AI 网友帖/评分配随机网友头像并写入 IndexedDB */
  useEffect(() => {
    ensurePostDetailAvatars(post.id)
  }, [ensurePostDetailAvatars, post.id])

  const handleRefreshTimeline = useCallback(async () => {
    setRefreshing(true)
    try {
      const feedRows = await aiGeneratePulseFeedPosts({
        apiConfig,
        viewerName: post.authorName,
        count: 4,
      })
      appendAiPosts(feedRows, currentPlayerPovId)

      const commentRows = await aiGeneratePulseComments({
        apiConfig,
        post: { authorName: post.authorName, content: post.content },
        count: 6,
      })
      const now = Date.now()
      const nameToId = new Map<string, string>()
      const built: PulseComment[] = []
      for (const row of commentRows) {
        const id = `pc-ai-${now}-${Math.random().toString(36).slice(2, 6)}`
        nameToId.set(row.authorName, id)
        let parentId: string | undefined
        if (row.parentHint) {
          parentId = nameToId.get(row.parentHint) ?? [...nameToId.values()][0]
        }
        built.push({
          id,
          postId: post.id,
          authorPovId: `ai:${row.authorName}`,
          authorName: row.authorName,
          authorAvatarUrl: pickStablePulseNetizenAvatarPath(`ai:${row.authorName}`),
          content: row.content,
          createdAt: now - built.length * 12_000,
          parentId,
          isAiGenerated: true,
        })
      }
      addComment(post.id, built)
      onToast('时间线已刷新')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '生成失败')
    } finally {
      setRefreshing(false)
    }
  }, [addComment, apiConfig, appendAiPosts, currentPlayerPovId, onToast, post])

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[1200] flex flex-col bg-[#FCFCFC]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_MODAL_SPRING}
      >
        <header
          className="flex shrink-0 items-center gap-2 bg-white/90 px-3 py-3 backdrop-blur-xl"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 0px))' }}
        >
          <Pressable type="button" onClick={onBack} className="flex size-9 items-center justify-center rounded-full">
            <ArrowLeft className="size-5" strokeWidth={1.3} />
          </Pressable>
          <span className="text-[13px] text-neutral-500">动态详情</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-32 pt-2">
          <PostCard
            post={post}
            currentPovId={currentPlayerPovId}
            onOpen={() => {}}
            onLike={() => toggleLike(post.id)}
            onRepost={onRepost}
            compact
          />

          <Pressable
            type="button"
            onClick={() => void handleRefreshTimeline()}
            disabled={refreshing}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[11px] tracking-wide text-neutral-600 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
          >
            <Sparkles className="size-3.5" strokeWidth={1.3} style={{ color: PULSE_COLORS.lightGold }} />
            {refreshing ? '生成中…' : '刷新时间线'}
          </Pressable>

          <section className="mt-6 px-1">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">评论</h3>
            {nested.length ? (
              nested.map((c) => <CommentBlock key={c.id} comment={c} />)
            ) : (
              <p className="mt-4 text-[12px] text-neutral-400">暂无评论，刷新时间线以召唤网友。</p>
            )}
          </section>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 border-t border-black/[0.04] bg-white/92 px-4 py-3 backdrop-blur-xl"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center gap-1 rounded-full bg-[#F5F5F4]/80 px-2 py-2">
            <PulseWeiboFacePicker onPick={insertCommentToken} />
            <Pressable
              type="button"
              onClick={() => insertCommentToken('#')}
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              aria-label="插入话题"
            >
              <Hash className="size-4" strokeWidth={1.35} style={{ color: PULSE_COLORS.topicBlue }} />
            </Pressable>
            <input
              ref={commentInputRef}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="写评论…"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            <Pressable
              type="button"
              disabled={!commentDraft.trim()}
              onClick={() => {
                addUserComment({
                  postId: post.id,
                  authorPovId: currentPlayerPovId,
                  authorName: authorLabel,
                  authorAvatarUrl,
                  content: commentDraft.trim(),
                })
                setCommentDraft('')
              }}
              className="text-[12px] font-medium disabled:opacity-30"
              style={{ color: PULSE_COLORS.dustyRose }}
            >
              发送
            </Pressable>
          </div>
        </div>
      </motion.div>
    </>
  )
}
