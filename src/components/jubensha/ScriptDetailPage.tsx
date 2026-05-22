import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, ChevronLeft, Feather } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { FlipBookOpen } from './FlipBookOpen'
import type { ContactDB } from './contactDB'
import { useJubenshaBookmarks } from './jubenshaBookmarks'
import { appendComment, loadExtraComments } from './jubenshaStorage'
import { StarRating } from './StarRating'
import type { JubenshaComment, JubenshaScript } from './types'

export type ScriptDetailPageProps = {
  script: JubenshaScript
  contactDb: ContactDB
  currentUserName: string
  onBack: () => void
  onStartRoleplay?: (script: JubenshaScript) => void
}

type OpenPhase = 'fly' | 'flip' | 'reveal'

const contentReveal = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 + i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function CommentMarginalia({
  comment,
  contactDb,
}: {
  comment: JubenshaComment
  contactDb: ContactDB
}) {
  const name = comment.characterId
    ? contactDb.getDisplayName(comment.characterId, comment.authorName)
    : comment.authorName

  return (
    <li className="border-l-2 border-[#722f37]/55 py-3 pl-4">
      <p className="jbs-font-serif text-[10px] text-[#5c3d2e]">{name}</p>
      <p className="mt-1.5 jbs-font-serif text-[13px] leading-[1.9] text-gray-800">{comment.body}</p>
    </li>
  )
}

function loreWithDropCap(text: string) {
  const t = text.trim()
  if (!t) return null
  const first = t[0]
  const rest = t.slice(1)
  return (
    <>
      <span className="jbs-drop-cap jbs-font-handwriting float-left mr-1 text-[#5c3d2e]">{first}</span>
      {rest}
    </>
  )
}

export function ScriptDetailPage({
  script,
  contactDb,
  currentUserName,
  onBack,
  onStartRoleplay,
}: ScriptDetailPageProps) {
  const { isBookmarked, toggleBookmark } = useJubenshaBookmarks()
  const bookmarked = isBookmarked(script.id)
  const [openPhase, setOpenPhase] = useState<OpenPhase>('fly')
  const [draft, setDraft] = useState('')
  const [extra, setExtra] = useState<JubenshaComment[]>(() => loadExtraComments(script.id))
  const [starting, setStarting] = useState(false)
  const [stampBump, setStampBump] = useState(false)

  const allComments = useMemo(() => [...script.comments, ...extra], [script.comments, extra])
  const ceremonyActive = openPhase !== 'reveal'

  useEffect(() => {
    setOpenPhase('fly')
    const t1 = window.setTimeout(() => setOpenPhase('flip'), 520)
    const t2 = window.setTimeout(() => setOpenPhase('reveal'), 1420)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [script.id])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleBookmark = useCallback(() => {
    toggleBookmark(script.id)
    setStampBump(true)
    window.setTimeout(() => setStampBump(false), 320)
  }, [script.id, toggleBookmark])

  const submitComment = useCallback(() => {
    const body = draft.trim()
    if (!body) return
    const comment: JubenshaComment = {
      id: `user-${Date.now()}`,
      authorName: currentUserName,
      body,
      createdAtIso: new Date().toISOString(),
      isMarginalia: true,
    }
    appendComment(script.id, comment)
    setExtra((prev) => [...prev, comment])
    setDraft('')
  }, [draft, currentUserName, script.id])

  const handleStart = useCallback(() => {
    setStarting(true)
    window.setTimeout(() => {
      onStartRoleplay?.(script)
      setStarting(false)
    }, 900)
  }, [onStartRoleplay, script])

  return (
    <motion.div
      key={`detail-${script.id}`}
      className="jbs-detail-page absolute inset-0 z-20 flex min-h-0 flex-col bg-[#f4f1ea]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* 阶段 1–2：layoutId 飞入 + 3D 翻封 */}
      <AnimatePresence>
        {ceremonyActive ? (
          <motion.div
            key="flip-ceremony"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45 } }}
          >
            <button
              type="button"
              onClick={onBack}
              className="jbs-safe-top absolute left-4 z-10 flex size-10 items-center justify-center rounded-full border border-[#f4f1ea]/35 bg-black/30 text-[#f4f1ea]"
              aria-label="返回书架"
            >
              <ChevronLeft className="size-5" strokeWidth={1.75} />
            </button>

            <FlipBookOpen
              script={script}
              coverOpen={openPhase === 'flip'}
              sharedLayout
              scale={openPhase === 'fly' ? 1.05 : 1.12}
            />

            <motion.p
              className="jbs-font-serif pointer-events-none absolute bottom-[max(2rem,env(safe-area-inset-bottom))] text-[11px] tracking-[0.2em] text-[#f4f1ea]/45"
              animate={{ opacity: openPhase === 'flip' ? 0.85 : 0.4 }}
            >
              {openPhase === 'fly' ? '抽取卷宗…' : '展卷阅读…'}
            </motion.p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 阶段 3：详情卷宗（封面渐入，正文墨水显影） */}
      <motion.div
        className="flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: openPhase === 'reveal' ? 1 : 0 }}
        transition={{ duration: 0.5, delay: openPhase === 'reveal' ? 0.05 : 0 }}
      >
        <div className="relative h-[min(38vh,280px)] shrink-0 overflow-hidden bg-[#1a1a1a]">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: openPhase === 'reveal' ? 1 : 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {script.coverImageUrl ? (
              <img src={script.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: 'linear-gradient(160deg, #3d2a22 0%, #1a1a1a 100%)' }}
              />
            )}
          </motion.div>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#f4f1ea] via-[#f4f1ea]/25 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent"
            aria-hidden
          />

          <button
            type="button"
            onClick={onBack}
            className="jbs-safe-top absolute left-4 z-10 flex size-10 items-center justify-center rounded-full border border-[#f4f1ea]/40 bg-black/25 text-[#f4f1ea] backdrop-blur-sm"
            aria-label="返回书架"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto jbs-hide-scrollbar pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
          {openPhase === 'reveal' ? (
            <motion.div
              className="mx-auto max-w-[560px] px-5 pt-6"
              initial="hidden"
              animate="show"
            >
              <motion.header custom={0} variants={contentReveal} className="text-center">
                <h1 className="jbs-font-handwriting text-[32px] leading-tight text-[#1a1a1a]">
                  {script.title}
                </h1>
                {script.subtitle ? (
                  <p className="jbs-font-serif mt-2 text-[12px] italic text-[#5c3d2e]/75">{script.subtitle}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <StarRating label="推理" value={script.logicDifficulty} />
                  <StarRating label="情感" value={script.tearsDepth} />
                </div>
                <p className="jbs-font-serif mt-2 text-[11px] text-[#1a1a1a]/50">
                  角色 {script.maleCount}男{script.femaleCount}女 · 约 {script.durationMinutes} 分钟
                </p>
              </motion.header>

              <motion.section custom={1} variants={contentReveal} className="mt-8">
                <h2 className="jbs-font-handwriting text-center text-[20px] text-[#5c3d2e]">卷首</h2>
                <p className="mt-4 text-justify jbs-font-serif text-[15px] leading-loose text-gray-800">
                  {loreWithDropCap(script.loreIntro)}
                </p>
              </motion.section>

              <motion.section custom={2} variants={contentReveal} className="mt-10">
                <h2 className="jbs-font-handwriting text-center text-[20px] text-[#5c3d2e]">人物</h2>
                <ul className="mt-4 space-y-3">
                  {script.roles.map((r) => (
                    <li
                      key={r.name}
                      className="rounded border border-[#5c3d2e]/15 bg-[#fffef9]/80 px-4 py-3"
                    >
                      <p className="jbs-font-serif text-[14px] font-medium text-[#1a1a1a]">
                        {r.name}
                        <span className="ml-1 text-[11px] font-normal text-[#5c3d2e]/70">({r.gender})</span>
                      </p>
                      <p className="mt-1 jbs-font-serif text-[12px] leading-relaxed text-gray-700">{r.blurb}</p>
                    </li>
                  ))}
                </ul>
              </motion.section>

              <motion.section custom={3} variants={contentReveal} className="mt-10">
                <h2 className="jbs-font-handwriting text-center text-[20px] text-[#5c3d2e]">卷尾批注</h2>
                <ul className="mt-4 space-y-1">
                  {allComments.length === 0 ? (
                    <li className="py-6 text-center jbs-font-serif text-[12px] italic text-[#1a1a1a]/40">
                      尚无墨迹——可在卷末落笔。
                    </li>
                  ) : (
                    allComments.map((c) => <CommentMarginalia key={c.id} comment={c} contactDb={contactDb} />)
                  )}
                </ul>
                <div className="mt-6 border-t border-dashed border-[#5c3d2e]/30 pt-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="在此落笔…"
                    className="w-full resize-none rounded border border-[#5c3d2e]/20 bg-[#fffef9] px-3 py-2 jbs-font-serif text-[14px] text-gray-800 outline-none focus:border-[#8b6914]/45"
                  />
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={!draft.trim()}
                    className="mt-2 w-full rounded border border-[#5c3d2e] bg-[#5c3d2e] py-2.5 jbs-font-serif text-[12px] tracking-wider text-[#f4f1ea] disabled:opacity-40"
                  >
                    钤印落笔
                  </button>
                </div>
              </motion.section>
            </motion.div>
          ) : null}
        </div>
      </motion.div>

      {openPhase === 'reveal' ? (
        <div className="jbs-detail-action-bar pointer-events-none fixed inset-x-0 bottom-0 z-30">
          <div className="pointer-events-auto mx-auto flex max-w-[560px] items-center gap-3 px-4 pb-[max(14px,env(safe-area-inset-bottom,0px))] pt-8">
            <motion.button
              type="button"
              onClick={handleBookmark}
              animate={stampBump ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.28 }}
              className={`flex size-12 shrink-0 items-center justify-center rounded-lg border-2 bg-[#faf8f5]/95 backdrop-blur-sm ${
                bookmarked
                  ? 'border-[#8b6914] bg-[#8b6914]/15 text-[#8b6914]'
                  : 'border-[#1a1a1a]/35 text-[#1a1a1a]/55'
              }`}
              aria-label={bookmarked ? '取消收藏' : '收藏'}
              aria-pressed={bookmarked}
            >
              <Bookmark
                className="size-5"
                strokeWidth={1.75}
                fill={bookmarked ? 'currentColor' : 'none'}
              />
            </motion.button>

            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="jbs-wax-seal-btn flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 disabled:opacity-70"
            >
              <Feather className="size-4 shrink-0 text-[#f4f1ea]/90" strokeWidth={1.75} aria-hidden />
              <span className="jbs-font-serif text-[14px] tracking-[0.18em] text-[#f4f1ea]">开始演绎</span>
            </button>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {starting ? (
          <motion.div
            key="fade-black"
            className="pointer-events-none fixed inset-0 z-40 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeIn' }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
