import { AnimatePresence, motion } from 'framer-motion'
import { Lock, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ApiConfig } from '../api/types'
import { pickTruthMirrorQuestionIndices, resolveMeetTruthPeerCeremonyCopy, TRUTH_MIRROR_QUESTIONS } from './encounterTruthMirrorData'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { aiMeetTruthMirrorCharAnswer, scrubMeetNpcWechatLeaks } from './lumiMeetAi'
import { meetMessagesToAiTranscript } from './meetEncounterTranscript'
import type { EncounterNPC, MeetChatMessage, MeetPublicProfile, MeetTruthMirrorRecordPayload } from './meetTypes'

const PLATINUM = '#D4AF37'

type CeremonyStep = 'draw' | 'input' | 'reveal'

function PlatinumGeometryPattern({ patternId }: { patternId: string }) {
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id={patternId} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M0 24h48M24 0v48" fill="none" stroke={PLATINUM} strokeOpacity="0.22" strokeWidth="0.5" />
          <path d="M0 0l48 48M48 0L0 48" fill="none" stroke={PLATINUM} strokeOpacity="0.12" strokeWidth="0.5" />
          <circle cx="24" cy="24" r="10" fill="none" stroke={PLATINUM} strokeOpacity="0.18" strokeWidth="0.5" />
          <circle cx="24" cy="24" r="3" fill="none" stroke={PLATINUM} strokeOpacity="0.28" strokeWidth="0.35" />
        </pattern>
        <linearGradient id={`${patternId}-shine`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#f4f1ea" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#e8e2d8" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      <rect width="100%" height="100%" fill={`url(#${patternId}-shine)`} />
    </svg>
  )
}

function CardShell({
  children,
  className,
  patternId,
}: {
  children: React.ReactNode
  className?: string
  patternId: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[12px] border-[0.5px] border-[#e6e1d8] bg-gradient-to-br from-white via-[#faf9f7] to-[#f0ebe3] shadow-[0_18px_48px_rgba(28,22,16,0.08)] ${className ?? ''}`}
    >
      <PlatinumGeometryPattern patternId={patternId} />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}

function TruthFlipCard({
  labelEn,
  labelZh,
  text,
  flipped,
}: {
  labelEn: string
  labelZh: string
  text: string
  flipped: boolean
}) {
  return (
    <div className="relative min-h-[140px] w-full" style={{ perspective: 1000 }}>
      <motion.div
        className="relative h-full min-h-[140px] w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.92, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="absolute inset-0 flex flex-col justify-between rounded-[11px] border-[0.5px] border-[#e8e3dc] bg-gradient-to-b from-white to-[#f7f4ef] p-4"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
          }}
        >
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.28em] text-[#b8a994]">Sealed · 封存</p>
          <p className="text-center font-dossier-serif text-[13px] tracking-[0.12em] text-[#c9c4bc]">—</p>
          <p className="meet-caption-en text-center text-[7px] uppercase tracking-[0.22em] text-[#a8a4a0]">{labelEn}</p>
        </div>
        <div
          className="absolute inset-0 flex flex-col rounded-[11px] border-[0.5px] border-[#1a1918] bg-[#faf9f7] p-4 text-[#0f0f0f] shadow-inner"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <p className="meet-caption-en text-[8px] uppercase tracking-[0.26em] text-[#b8973a]">{labelEn}</p>
          <p className="meet-caption-en mt-0.5 text-[8px] tracking-[0.14em] text-[#7a736b]">{labelZh}</p>
          <p className="mt-3 flex-1 whitespace-pre-wrap font-dossier-serif text-[13px] leading-relaxed tracking-[0.04em] text-[#141312]">
            {text}
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export type TruthMirrorCeremonyPortalProps = {
  open: boolean
  onClose: () => void
  npc: EncounterNPC
  userProfile: MeetPublicProfile
  apiConfig: ApiConfig | null
  dualPersonaDirective: string
  encounterSwapStatus: string
  getThreadMessages: () => MeetChatMessage[]
  setParentLoading: (v: boolean) => void
  onPersist: (payload: MeetTruthMirrorRecordPayload) => void
  /** 角色邀约应允后：自动抽牌，无需手选 */
  autoPickCard?: boolean
}

export function TruthMirrorCeremonyPortal({
  open,
  onClose,
  npc,
  userProfile,
  apiConfig,
  dualPersonaDirective,
  encounterSwapStatus,
  getThreadMessages,
  setParentLoading,
  onPersist,
  autoPickCard = false,
}: TruthMirrorCeremonyPortalProps) {
  const uid = useId().replace(/:/g, '')
  const pickLock = useRef(false)
  const drawTRef = useRef<number[]>([])
  const [step, setStep] = useState<CeremonyStep>('draw')
  const [triplet, setTriplet] = useState<[string, string, string]>(['', '', ''])
  const [pickedSlot, setPickedSlot] = useState<number | null>(null)
  const [dustOthers, setDustOthers] = useState(false)
  const [flipDraw, setFlipDraw] = useState(false)
  const [question, setQuestion] = useState('')
  const [userDraft, setUserDraft] = useState('')
  const [npcAnswer, setNpcAnswer] = useState('')
  const [revealFlip, setRevealFlip] = useState(false)
  const [sealError, setSealError] = useState<string | null>(null)
  const [sealing, setSealing] = useState(false)

  const peerCopy = useMemo(() => resolveMeetTruthPeerCeremonyCopy(npc.gender), [npc.gender])

  useEffect(() => {
    if (!open) return
    drawTRef.current.forEach((id) => window.clearTimeout(id))
    drawTRef.current = []
    pickLock.current = false
    setStep('draw')
    setPickedSlot(null)
    setDustOthers(false)
    setFlipDraw(false)
    setQuestion('')
    setUserDraft('')
    setNpcAnswer('')
    setRevealFlip(false)
    setSealError(null)
    setSealing(false)
    const seed = Date.now() ^ (Math.floor(Math.random() * 0xffff) << 8)
    const idx = pickTruthMirrorQuestionIndices(3, seed)
    setTriplet([TRUTH_MIRROR_QUESTIONS[idx[0]!]!, TRUTH_MIRROR_QUESTIONS[idx[1]!]!, TRUTH_MIRROR_QUESTIONS[idx[2]!]!])
    return () => {
      drawTRef.current.forEach((id) => window.clearTimeout(id))
      drawTRef.current = []
    }
  }, [open])

  const advanceAfterPick = useCallback(
    (slot: 0 | 1 | 2) => {
      if (pickLock.current || step !== 'draw') return
      const chosen = triplet[slot]
      if (!chosen?.trim()) return
      pickLock.current = true
      setPickedSlot(slot)
      const t1 = window.setTimeout(() => setDustOthers(true), 280)
      const t2 = window.setTimeout(() => setFlipDraw(true), 820)
      const t3 = window.setTimeout(() => {
        setQuestion(chosen)
        setStep('input')
      }, 1880)
      drawTRef.current.push(t1, t2, t3)
    },
    [step, triplet],
  )

  useEffect(() => {
    if (!open || !autoPickCard || step !== 'draw' || !triplet.every((t) => t.trim())) return
    if (pickLock.current || pickedSlot !== null) return
    const slot = Math.floor(Math.random() * 3) as 0 | 1 | 2
    const t = window.setTimeout(() => advanceAfterPick(slot), 720)
    return () => window.clearTimeout(t)
  }, [open, autoPickCard, step, triplet, pickedSlot, advanceAfterPick])

  useEffect(() => {
    if (step !== 'reveal') return
    setRevealFlip(false)
    const t = window.setTimeout(() => setRevealFlip(true), 420)
    return () => window.clearTimeout(t)
  }, [step])

  const handleSeal = useCallback(async () => {
    const ua = userDraft.trim()
    if (!ua || !question || step !== 'input' || sealing) return
    setSealError(null)
    setSealing(true)
    setParentLoading(true)
    try {
      const transcript = meetMessagesToAiTranscript(getThreadMessages())
      let raw = await aiMeetTruthMirrorCharAnswer({
        apiConfig,
        npc,
        userProfile,
        transcript,
        question,
        dualPersonaDirective,
      })
      raw = scrubMeetNpcWechatLeaks([raw], encounterSwapStatus, npc.wechatId)[0] ?? raw
      setNpcAnswer(raw.trim() || '……写到此处，够了。')
      setStep('reveal')
    } catch {
      setSealError('Invocation failed. 请稍后重试。')
    } finally {
      setSealing(false)
      setParentLoading(false)
    }
  }, [
    apiConfig,
    dualPersonaDirective,
    encounterSwapStatus,
    getThreadMessages,
    npc,
    question,
    sealing,
    setParentLoading,
    step,
    userDraft,
    userProfile,
  ])

  const handleCloseReveal = useCallback(() => {
    if (step !== 'reveal' || !question) return
    onPersist({
      question,
      userAnswer: userDraft.trim(),
      npcAnswer,
    })
    onClose()
  }, [npcAnswer, onClose, onPersist, question, step, userDraft])

  const handleAbort = useCallback(() => {
    if (step === 'reveal' || sealing) return
    onClose()
  }, [onClose, sealing, step])

  const el = getLumiMeetPortalTarget()
  if (!el) return null

  const tripletReady = triplet.every((t) => t.trim().length > 0)

  const fanAngles: [number, number, number] = [-14, 0, 14]
  const fanY: [number, number, number] = [10, 0, 10]

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="truth-mirror"
          role="presentation"
          className="fixed inset-0 z-[350] flex flex-col bg-[#faf8f5]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex shrink-0 justify-end p-3 pt-[max(12px,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={handleAbort}
              className="flex size-10 items-center justify-center rounded-full border-[0.5px] border-[#e0dcd4] bg-[#faf8f5] text-[#5c574f] transition-colors hover:bg-[#f2efe9]"
              aria-label="Close"
              disabled={step === 'reveal' || sealing}
            >
              <X className="size-[18px]" strokeWidth={1.25} />
            </button>
          </div>

          <AnimatePresence>
            {sealing && step === 'input' ? (
              <motion.div
                key="truth-await-npc"
                className="absolute inset-0 z-[20] flex items-center justify-center bg-black/42 px-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="alertdialog"
                aria-modal="true"
                aria-busy="true"
                aria-labelledby="truth-await-npc-title"
                aria-live="polite"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="w-full max-w-[min(340px,92vw)] rounded-[18px] border border-[#e8e4dc] bg-[#faf8f5] px-6 py-8 text-center shadow-[0_24px_80px_rgba(22,18,14,0.2)]"
                >
                  <div
                    className="mx-auto mb-5 size-10 animate-spin rounded-full border-2 border-[#D4AF37]/25 border-t-[#b8973a]"
                    aria-hidden
                  />
                  <p id="truth-await-npc-title" className="font-elegant-serif text-[16px] tracking-[0.04em] text-[#2c2a26]">
                    {peerCopy.peerAwaitingZh}
                  </p>
                  <p className="meet-caption-en mt-2 text-[10px] uppercase tracking-[0.22em] text-[#9a9590]">
                    {peerCopy.peerAwaitingEn}
                  </p>
                  <p className="mt-4 font-dossier-serif text-[12px] leading-relaxed text-[#7a736b]">
                    你的答案已封存。双盲揭晓前，请稍候对方写完同一道题的真心话。
                  </p>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="relative flex min-h-0 flex-1 flex-col items-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <p className="meet-caption-en text-center text-[9px] uppercase tracking-[0.34em] text-[#9a9590]">
              TRUTH · 交换真心话
            </p>

            <AnimatePresence mode="wait">
              {step === 'draw' ? (
                <motion.div
                  key="draw"
                  className="flex w-full max-w-md flex-1 flex-col items-center justify-center"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <p className="mt-4 text-center font-dossier-serif text-[15px] tracking-[0.06em] text-[#2c2a26]">
                    Choose your fate.
                  </p>
                  <p className="mt-1 text-center font-dossier-serif text-[12px] tracking-[0.14em] text-[#7a736b]">
                    抽取你们的命运
                  </p>
                  <div className="relative mt-10 flex h-[200px] w-full items-end justify-center gap-3">
                    {([0, 1, 2] as const).map((slot) => {
                      const hide = dustOthers && pickedSlot !== slot
                      return (
                        <motion.button
                          key={slot}
                          type="button"
                          disabled={!tripletReady || (pickedSlot !== null && pickedSlot !== slot)}
                          onClick={() => advanceAfterPick(slot)}
                          className="relative outline-none"
                          style={{ perspective: 1000 }}
                          initial={{ opacity: 0, rotate: fanAngles[slot] * 0.6, y: 28, scale: 0.92 }}
                          animate={{
                            opacity: hide ? 0 : 1,
                            rotate: pickedSlot === slot ? 0 : fanAngles[slot],
                            y: pickedSlot === slot ? 0 : fanY[slot],
                            scale: hide ? 0.2 : pickedSlot === slot ? 1.08 : 1,
                          }}
                          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                        >
                          <motion.div
                            className="relative h-[148px] w-[104px]"
                            style={{ transformStyle: 'preserve-3d' }}
                            animate={{ rotateY: pickedSlot === slot && flipDraw ? 180 : 0 }}
                            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div
                              className="absolute inset-0"
                              style={{
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                                transform: 'rotateY(0deg)',
                              }}
                            >
                              <CardShell patternId={`tm-back-${uid}-${slot}`} className="h-full w-full">
                                <div className="flex h-[148px] flex-col items-center justify-between p-3">
                                  <span className="meet-caption-en text-[7px] uppercase tracking-[0.26em] text-[#b8a994]">
                                    Mirror
                                  </span>
                                  <div className="h-px w-8 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
                                  <span className="meet-caption-en text-[7px] uppercase tracking-[0.24em] text-[#c9c4bc]">
                                    Fate
                                  </span>
                                </div>
                              </CardShell>
                            </div>
                            <div
                              className="absolute inset-0"
                              style={{
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)',
                              }}
                            >
                              <CardShell patternId={`tm-face-${uid}-${slot}`} className="flex h-full w-full items-center justify-center p-3">
                                <p className="text-center font-dossier-serif text-[11px] leading-relaxed tracking-[0.06em] text-[#1c1b19]">
                                  {triplet[slot]}
                                </p>
                              </CardShell>
                            </div>
                          </motion.div>
                        </motion.button>
                      )
                    })}
                  </div>
                </motion.div>
              ) : null}

              {step === 'input' ? (
                <motion.div
                  key="input"
                  className="flex w-full max-w-lg flex-1 flex-col"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="shrink-0 border-b border-[#ebe7e0] pb-4 pt-2">
                    <p className="meet-caption-en text-[8px] uppercase tracking-[0.28em] text-[#b8973a]">The Question · 命题</p>
                    <p className="mt-2 font-dossier-serif text-[15px] leading-relaxed tracking-[0.05em] text-[#141312]">{question}</p>
                  </div>
                  <div className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                    <div className="flex min-h-[180px] flex-col">
                      <p className="meet-caption-en text-[8px] uppercase tracking-[0.24em] text-[#8c8883]">Your chamber · 你的密室</p>
                      {sealing ? (
                        <p className="mt-2 rounded-[10px] border border-[#ebe7e0] bg-[#faf6ee]/80 px-3 py-2 font-dossier-serif text-[13px] leading-relaxed tracking-[0.04em] text-[#5c574f]">
                          {userDraft.trim()}
                        </p>
                      ) : (
                        <textarea
                          value={userDraft}
                          onChange={(e) => setUserDraft(e.target.value)}
                          rows={5}
                          disabled={sealing}
                          className="mt-2 min-h-[120px] w-full flex-1 resize-none border-0 border-b border-[#dcd7cf] bg-transparent px-0 py-2 font-dossier-serif text-[14px] leading-relaxed tracking-[0.04em] text-[#1a1918] outline-none ring-0 placeholder:text-[#b8b4ae] placeholder:font-dossier-serif disabled:opacity-60"
                          placeholder="写下你的答案... (Write your truth)"
                        />
                      )}
                      {sealing ? (
                        <p className="meet-caption-en mt-2 text-[9px] uppercase tracking-[0.18em] text-[#b8973a]">
                          Sealed · 已封存
                        </p>
                      ) : null}
                    </div>
                    <div className="flex min-h-[180px] flex-col items-center justify-center border-t border-[#f0ebe3] pt-6 sm:border-t-0 sm:pt-0">
                      <motion.div
                        className="flex size-[104px] items-center justify-center rounded-full border-[0.5px] border-[#e6e1d8] bg-[#faf9f7] shadow-[0_0_0_1px_rgba(212,175,55,0.12)]"
                        animate={
                          sealing
                            ? { rotate: 360 }
                            : {
                                boxShadow: [
                                  '0 0 0 1px rgba(212,175,55,0.12)',
                                  '0 0 28px 6px rgba(212,175,55,0.18)',
                                  '0 0 0 1px rgba(212,175,55,0.12)',
                                ],
                              }
                        }
                        transition={
                          sealing
                            ? { duration: 1.1, repeat: Infinity, ease: 'linear' }
                            : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                        }
                      >
                        <Lock className="size-7 text-[#b8973a]" strokeWidth={1.15} aria-hidden />
                      </motion.div>
                      <p className="meet-caption-en mt-4 text-center text-[9px] uppercase tracking-[0.22em] text-[#9a9590]">
                        {sealing ? peerCopy.peerAwaitingEn : 'Awaiting your seal'}
                      </p>
                      <p className="mt-1 text-center font-dossier-serif text-[12px] tracking-[0.12em] text-[#7a736b]">
                        {sealing ? peerCopy.peerAwaitingZh : '封存你的答案后，对方才会动笔'}
                      </p>
                    </div>
                  </div>
                  {sealError ? <p className="mt-3 text-center font-dossier-serif text-[12px] text-red-700/85">{sealError}</p> : null}
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      disabled={!userDraft.trim() || sealing}
                      onClick={() => void handleSeal()}
                      className="meet-caption-en rounded-full border-[0.5px] border-[#D4AF37]/55 px-8 py-3 text-[10px] uppercase tracking-[0.26em] text-[#2c2a26] transition-opacity disabled:opacity-35"
                      style={{ background: 'color-mix(in oklab, white 94%, transparent)' }}
                    >
                      {sealing ? '等待对方…' : '封存答案 (Seal)'}
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {step === 'reveal' ? (
                <motion.div
                  key="reveal"
                  className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="meet-caption-en text-center text-[9px] uppercase tracking-[0.32em] text-[#b8a994]">Revelation · 命运翻牌</p>
                  <motion.div
                    className="mt-8 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8"
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 0.95, 1.02, 1] }}
                    transition={{ duration: 1.05, times: [0, 0.22, 0.52, 1], ease: 'easeInOut' }}
                  >
                    <TruthFlipCard
                      labelEn={peerCopy.peerTruthLabelEn}
                      labelZh={peerCopy.peerTruthLabelZh}
                      text={npcAnswer}
                      flipped={revealFlip}
                    />
                    <TruthFlipCard
                      labelEn="Your Truth"
                      labelZh="你的真心"
                      text={userDraft.trim()}
                      flipped={revealFlip}
                    />
                  </motion.div>
                  <button
                    type="button"
                    onClick={handleCloseReveal}
                    className="meet-caption-en mt-10 rounded-full border-[0.5px] border-[#1a1918] bg-[#141312] px-10 py-3 text-[10px] uppercase tracking-[0.24em] text-[#f7f4ef]"
                  >
                    归档并关闭 (Archive)
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    el,
  )
}
