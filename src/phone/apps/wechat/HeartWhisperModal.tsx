import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import type { HeartWhisper } from './newFriendsPersona/types'

const EDITORIAL_SERIF = 'var(--wx-font, var(--phone-font, "Noto Serif SC", serif))'

/** 供聊天室 / 约会页在捕获异常后写入面板展示 */
export function formatHeartWhisperGenerateError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === 'string' && err.trim()) return err.trim()
  return '未知错误，请稍后重试'
}

const contentStagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

const blockReveal = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function DossierIndexHeader({
  index,
  en,
  zh,
}: {
  index: string
  en: string
  zh: string
}) {
  return (
    <p className="font-mono text-[10px] tracking-[0.22em] text-gray-400">
      {index}. {en} / {zh}
    </p>
  )
}

function Skeleton() {
  return (
    <div className="space-y-10">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-2.5 w-28 animate-pulse rounded bg-gray-100" />
          <div className="h-14 animate-pulse rounded bg-gray-50" />
        </div>
      ))}
      <div className="rounded-2xl bg-[#F9FAFB] p-5">
        <div className="h-2.5 w-36 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-16 animate-pulse rounded bg-gray-50" />
      </div>
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-serif text-[14px] text-gray-800">尚未生成心语</p>
      <p className="mt-3 max-w-[260px] text-[12px] leading-relaxed text-gray-400">
        点击右上角「生成心语」，基于最近一轮对话解码 TA 此刻的内心侧写。
      </p>
    </div>
  )
}

function whisperContentKey(data: HeartWhisper): string {
  return [
    data.timestamp,
    data.location,
    data.outfit,
    data.action,
    data.innerThoughts,
    data.userImpression,
  ]
    .map((s) => String(s ?? '').trim())
    .join('\x1e')
}

export function HeartWhisperModal({
  open,
  loading,
  data,
  characterName,
  generateError,
  onDismissGenerateError,
  onClose,
  onGenerate,
}: {
  open: boolean
  loading: boolean
  data: HeartWhisper | null
  /** 私聊对象名，展示于面板标题 */
  characterName?: string
  generateError?: string | null
  onDismissGenerateError?: () => void
  onClose: () => void
  onGenerate: () => void
}) {
  const err = String(generateError ?? '').trim()
  const [resonating, setResonating] = useState(false)

  const hasContent =
    !!data &&
    [data.location, data.outfit, data.action, data.innerThoughts, data.userImpression].some((s) =>
      String(s ?? '').trim(),
    )

  const location = String(data?.location ?? '').trim()
  const outfit = String(data?.outfit ?? '').trim()
  const action = String(data?.action ?? '').trim()
  const innerThoughts = String(data?.innerThoughts ?? '').trim()
  const userImpression = String(data?.userImpression ?? '').trim()
  const contentKey = data ? whisperContentKey(data) : 'empty'
  const titleName = characterName?.trim() || '心语'

  const handleResonate = useCallback(() => {
    if (loading) return
    setResonating(true)
    onGenerate()
  }, [loading, onGenerate])

  useEffect(() => {
    if (!resonating) return
    const t = window.setTimeout(() => setResonating(false), 1000)
    return () => window.clearTimeout(t)
  }, [resonating])

  useEffect(() => {
    if (!loading) return
    setResonating(true)
  }, [loading])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="heart-whisper-mask"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/15 px-0 backdrop-blur-sm sm:items-center sm:px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            key="heart-whisper-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-[min(88vh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[28px] bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-2xl sm:rounded-[28px]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="relative shrink-0 px-7 pb-5 pt-7">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] tracking-widest text-gray-400">LIVE FEED · 实时心语</p>
                  <h2
                    className="mt-2 truncate text-[26px] font-semibold leading-tight text-[#1C1C1E]"
                    style={{ fontFamily: EDITORIAL_SERIF }}
                  >
                    {titleName}
                  </h2>
                  {data?.timestamp ? (
                    <p className="mt-2 font-mono text-[10px] tabular-nums tracking-wider text-gray-300">
                      {data.timestamp}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 pt-0.5">
                  <Pressable
                    type="button"
                    onClick={handleResonate}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1E] px-4 py-2 text-white shadow-[0_6px_20px_rgba(28,28,30,0.22)] transition-all hover:bg-black active:scale-[0.98] disabled:opacity-45"
                    aria-label={loading ? '心语解码中' : '生成心语'}
                  >
                    <Sparkles
                      className={`size-3.5 shrink-0 ${resonating || loading ? 'animate-spin' : ''}`}
                      strokeWidth={1.75}
                    />
                    <span className="text-[12px] font-medium tracking-wide">
                      {loading ? '解码中…' : '生成心语'}
                    </span>
                  </Pressable>
                  <Pressable
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-gray-300 transition-colors hover:text-gray-600"
                    aria-label="关闭"
                  >
                    <X className="size-[18px]" strokeWidth={1.25} />
                  </Pressable>
                </div>
              </div>
            </div>

            {err ? (
              <div className="relative shrink-0 px-7 pb-4">
                <div className="rounded-2xl bg-red-50/80 px-4 py-3" role="alert">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-red-900">解码失败</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-red-950/85">
                        {err}
                      </p>
                    </div>
                    {onDismissGenerateError ? (
                      <Pressable
                        type="button"
                        onClick={onDismissGenerateError}
                        className="shrink-0 px-2 py-1 text-[11px] text-red-800/80 hover:text-red-900"
                      >
                        知道了
                      </Pressable>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ── Dossier body ── */}
            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-7 pb-10 pt-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
              {loading && !hasContent ? (
                <Skeleton />
              ) : hasContent ? (
                <motion.div
                  key={contentKey}
                  variants={contentStagger}
                  initial="hidden"
                  animate="visible"
                >
                  {location ? (
                    <motion.p
                      variants={blockReveal}
                      className="mb-10 font-mono text-[10px] leading-relaxed tracking-wide text-gray-400"
                    >
                      LOC / {location}
                    </motion.p>
                  ) : null}

                  {outfit ? (
                    <motion.section variants={blockReveal} className="mb-10">
                      <DossierIndexHeader index="01" en="OUTFIT" zh="着装" />
                      <p className="mt-3 font-sans text-[14px] font-light leading-relaxed text-gray-700">
                        {outfit}
                      </p>
                    </motion.section>
                  ) : null}

                  {action ? (
                    <motion.section variants={blockReveal} className="mb-10">
                      <DossierIndexHeader index="02" en="ACTION" zh="动作" />
                      <p className="mt-3 font-sans text-[14px] font-light leading-relaxed text-gray-700">
                        {action}
                      </p>
                    </motion.section>
                  ) : null}

                  {innerThoughts ? (
                    <motion.section variants={blockReveal} className="relative mb-10">
                      <DossierIndexHeader index="03" en="MONOLOGUE" zh="独白" />
                      <div className="relative mt-4">
                        <span
                          className="pointer-events-none absolute -left-3 -top-6 select-none font-serif text-[7.5rem] leading-none text-gray-900 opacity-[0.05]"
                          aria-hidden
                        >
                          “
                        </span>
                        <p
                          className="relative whitespace-pre-wrap text-[15px] leading-relaxed text-[#1C1C1E]"
                          style={{ fontFamily: EDITORIAL_SERIF }}
                        >
                          {innerThoughts}
                        </p>
                      </div>
                    </motion.section>
                  ) : null}

                  {userImpression ? (
                    <motion.section variants={blockReveal} className="mt-4">
                      <div className="rounded-2xl border-l-2 border-gray-800 bg-[#F9FAFB] p-5">
                        <DossierIndexHeader index="04" en="THOUGHTS ON YOU" zh="对你的剖析" />
                        <p
                          className="mt-4 whitespace-pre-wrap text-[14px] italic leading-relaxed text-gray-700"
                          style={{ fontFamily: EDITORIAL_SERIF }}
                        >
                          {userImpression}
                        </p>
                      </div>
                    </motion.section>
                  ) : null}
                </motion.div>
              ) : loading ? (
                <Skeleton />
              ) : (
                <EmptyHint />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
