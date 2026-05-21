import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type WeChatWelcomeRevealPhase = 'idle' | 'under-mask' | 'revealing' | 'done'

type Ctx = {
  active: boolean
  phase: WeChatWelcomeRevealPhase
  beginUnderMask: () => void
  beginReveal: () => void
  finish: () => void
}

const WeChatWelcomeRevealContext = createContext<Ctx | null>(null)

export function WeChatWelcomeRevealProvider({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  const [phase, setPhase] = useState<WeChatWelcomeRevealPhase>('idle')

  useEffect(() => {
    if (!active) {
      setPhase('idle')
      return
    }
    setPhase('under-mask')
  }, [active])

  const beginUnderMask = useCallback(() => setPhase('under-mask'), [])
  const beginReveal = useCallback(() => setPhase('revealing'), [])
  const finish = useCallback(() => setPhase('done'), [])

  const value = useMemo(
    () => ({ active, phase, beginUnderMask, beginReveal, finish }),
    [active, phase, beginUnderMask, beginReveal, finish],
  )

  return <WeChatWelcomeRevealContext.Provider value={value}>{children}</WeChatWelcomeRevealContext.Provider>
}

export function useWeChatWelcomeReveal() {
  const ctx = useContext(WeChatWelcomeRevealContext)
  if (!ctx) {
    return {
      active: false,
      phase: 'idle' as const,
      beginUnderMask: () => {},
      beginReveal: () => {},
      finish: () => {},
    }
  }
  return ctx
}

const SLOT_DELAY: Record<'header' | 'body' | 'tabbar', number> = {
  header: 0,
  body: 0.1,
  tabbar: 0.22,
}

const EASE_CINEMATIC = [0.25, 0.1, 0.25, 1] as const

export function useWeChatWelcomeRevealMotion(slot: 'header' | 'body' | 'tabbar') {
  const { active, phase } = useWeChatWelcomeReveal()
  const revealed = active && (phase === 'revealing' || phase === 'done')

  return {
    initial: { opacity: 0, y: 15 },
    animate: revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 },
    transition: {
      duration: 0.95,
      ease: EASE_CINEMATIC,
      delay: phase === 'revealing' ? SLOT_DELAY[slot] : 0,
    },
  } as const
}
