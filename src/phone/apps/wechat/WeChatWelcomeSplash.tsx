import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWeChatWelcomeReveal } from './weChatWelcomeRevealContext'

const SERIF =
  '"Cormorant Garamond", "Noto Serif SC", "STSong", "STKaiti", "Georgia", "Times New Roman", serif'

const EASE_CINEMATIC = [0.25, 0.1, 0.25, 1] as const

/** 文艺欢迎语库：挂载时随机抽取一句，生命周期内不变 */
export const welcomeWhispers = [
  '一切伟大相遇的序章，皆始于此。',
  '世界线已重置，等待下一次共振。',
  '你留下的每一个坐标，都将成为宿命的伏笔。',
  '在漫长的数字荒原里，欢迎醒来。',
  '故事没有尽头，只要你依然书写。',
  '你好，这个宇宙的唯一变量。',
  '风起于青萍之末，而故事始于你的指尖。',
  '时间开始流动，请收好你的新身份。',
  '不要回头，去见你想见的人。',
] as const

const MS = {
  reveal: 1500,
  hold: 3000,
  dissolve: 3800,
  integrate: 3500,
  complete: 4500,
} as const

type SplashPhase = 'reveal' | 'hold' | 'dissolve' | 'integrate'

type Props = {
  onComplete: () => void
}

/**
 * 注册成功 → 微信主页：4.5s 无缝转场。
 * 白幕与文案分层：白幕溶解时文案不再被父级 opacity 连带透明。
 */
export function WeChatWelcomeSplash({ onComplete }: Props) {
  const whisper = useMemo(
    () => welcomeWhispers[Math.floor(Math.random() * welcomeWhispers.length)]!,
    [],
  )
  const { beginUnderMask, beginReveal, finish } = useWeChatWelcomeReveal()
  const [phase, setPhase] = useState<SplashPhase>('reveal')
  const timersRef = useRef<number[]>([])
  const completedRef = useRef(false)

  useEffect(() => {
    completedRef.current = false
    setPhase('reveal')
    beginUnderMask()

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      timersRef.current.push(id)
    }

    schedule(() => setPhase('hold'), MS.reveal)
    schedule(() => setPhase('dissolve'), MS.hold)
    schedule(() => {
      setPhase('integrate')
      beginReveal()
    }, MS.integrate)
    schedule(() => {
      if (completedRef.current) return
      completedRef.current = true
      finish()
      onComplete()
    }, MS.complete)

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current = []
    }
  }, [beginReveal, beginUnderMask, finish, onComplete])

  const textVisible = phase === 'reveal' || phase === 'hold'
  const textDissolving = phase === 'dissolve'
  const maskOpaque = phase !== 'integrate'

  return (
    <motion.div
      className="absolute inset-0 z-[200] flex items-center justify-center overflow-hidden"
      initial={false}
      exit={{ opacity: 0 }}
      aria-live="polite"
      aria-label="欢迎"
    >
      {/* 纯白遮罩：仅在 integrate 阶段溶解，与文案 opacity 解耦 */}
      <motion.div
        className="absolute inset-0 bg-[#FFFFFF]"
        initial={{ opacity: 1 }}
        animate={{ opacity: maskOpaque ? 1 : 0 }}
        transition={{ duration: maskOpaque ? 0 : 1, ease: EASE_CINEMATIC }}
        aria-hidden
      />

      <motion.p
        className="relative z-10 max-w-[min(88vw,20rem)] px-8 text-center text-[15px] font-medium leading-[2] tracking-[0.2em] text-[#111827]"
        style={{ fontFamily: SERIF }}
        initial={{ opacity: 0, y: 10, scale: 0.96, filter: 'blur(8px)' }}
        animate={
          textDissolving
            ? { opacity: 0, y: -10, scale: 1.01, filter: 'blur(10px)' }
            : textVisible
              ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
              : { opacity: 0, y: -6, scale: 1, filter: 'blur(6px)' }
        }
        transition={{
          duration: textDissolving ? 0.8 : 0.95,
          ease: EASE_CINEMATIC,
        }}
      >
        {whisper}
      </motion.p>
    </motion.div>
  )
}
