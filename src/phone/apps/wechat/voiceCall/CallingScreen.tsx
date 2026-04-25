import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../../components/Pressable'

function fallbackBgStyle(backgroundImage?: string): React.CSSProperties {
  const url = (backgroundImage ?? '').trim()
  if (url) {
    return {
      backgroundImage: `url(${url})`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }
  }
  return {
    backgroundImage:
      'radial-gradient(1200px 700px at 20% 10%, rgba(255,255,255,0.95) 0%, rgba(245,245,247,0.82) 46%, rgba(240,240,242,0.88) 100%)',
  }
}

function useLoopingDots(active: boolean) {
  const [dots, setDots] = useState('')
  useEffect(() => {
    if (!active) {
      setDots('')
      return
    }
    let i = 0
    const id = window.setInterval(() => {
      i = (i + 1) % 4
      setDots('.'.repeat(i))
    }, 620)
    return () => window.clearInterval(id)
  }, [active])
  return dots
}

export type CallDecision = 'ACCEPT' | 'REJECT' | 'NO_ANSWER'

export function CallingScreen({
  open,
  peerAvatarUrl,
  peerRemarkName,
  backgroundImage,
  onCancel,
  onDecision,
  requestDecision,
}: {
  open: boolean
  peerAvatarUrl?: string
  peerRemarkName: string
  backgroundImage?: string
  onCancel: () => void
  onDecision: (d: CallDecision) => void
  /** 页面出现即调用一次 */
  requestDecision: () => Promise<CallDecision>
}) {
  const [phase, setPhase] = useState<'waiting' | 'resolved'>('waiting')
  const dots = useLoopingDots(open && phase === 'waiting')
  const mountedRef = useRef(false)
  const openSeqRef = useRef(0)
  const decisionRequestedRef = useRef(false)
  const requestDecisionRef = useRef(requestDecision)
  const onDecisionRef = useRef(onDecision)

  useEffect(() => {
    requestDecisionRef.current = requestDecision
  }, [requestDecision])

  useEffect(() => {
    onDecisionRef.current = onDecision
  }, [onDecision])

  const peerName = useMemo(() => peerRemarkName.trim() || '对方', [peerRemarkName])
  const bgStyle = useMemo(() => fallbackBgStyle(backgroundImage), [backgroundImage])

  useEffect(() => {
    if (!open) {
      setPhase('waiting')
      mountedRef.current = false
      decisionRequestedRef.current = false
      return
    }
    if (decisionRequestedRef.current) return
    decisionRequestedRef.current = true
    mountedRef.current = true
    const seq = Date.now()
    openSeqRef.current = seq
    setPhase('waiting')
    void (async () => {
      const d = await requestDecisionRef.current()
      if (!mountedRef.current) return
      if (openSeqRef.current !== seq) return
      setPhase('resolved')
      onDecisionRef.current(d)
    })()
    return () => {
      mountedRef.current = false
    }
  }, [open])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="calling-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[285] flex h-full w-full flex-col"
        style={{ background: '#fff' }}
      >
        <div className="absolute inset-0" aria-hidden style={bgStyle} />
        <div className="absolute inset-0" aria-hidden style={{ background: 'rgba(255,255,255,0.62)', backdropFilter: 'blur(18px)' }} />

        <header className="relative z-[1] flex shrink-0 items-center justify-end px-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
          <Pressable
            type="button"
            aria-label="关闭"
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#1c1c1e] shadow-sm active:scale-[0.97]"
          >
            <X className="size-5" strokeWidth={2} />
          </Pressable>
        </header>

        <main className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          {peerAvatarUrl?.trim() ? (
            <img src={peerAvatarUrl.trim()} alt="" className="h-[96px] w-[96px] rounded-full object-cover shadow-[0_8px_26px_rgba(0,0,0,0.10)]" />
          ) : (
            <div className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-white/80 text-[#b3b3b3] shadow-[0_8px_26px_rgba(0,0,0,0.10)]">
              ?
            </div>
          )}
          <p className="mt-5 text-[20px] font-semibold text-[#1c1c1e]">{peerName}</p>
          <p className="mt-2 text-[14px] text-[#1c1c1e]/60">
            正在等待对方接听
            <span className="inline-block w-[28px] text-left">{dots || '\u00A0'}</span>
            <span className="ml-0.5 inline-block h-[14px] w-[1px] align-middle" style={{ background: 'rgba(28,28,30,0.20)' }} />
          </p>
        </main>

        <footer className="relative z-[1] shrink-0 px-6 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-4">
          <div className="mx-auto w-full max-w-[520px]">
            <Pressable
              type="button"
              onClick={onCancel}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#ff3b30] text-[16px] font-semibold text-white shadow-sm active:scale-[0.98]"
            >
              取消
            </Pressable>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  )
}

