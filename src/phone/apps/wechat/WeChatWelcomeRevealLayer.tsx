import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useWeChatWelcomeReveal, useWeChatWelcomeRevealMotion } from './weChatWelcomeRevealContext'

type Slot = 'header' | 'body' | 'tabbar'

export function WeChatWelcomeRevealLayer({
  slot,
  children,
  className,
}: {
  slot: Slot
  children: ReactNode
  className?: string
}) {
  const { active, phase } = useWeChatWelcomeReveal()
  const motionProps = useWeChatWelcomeRevealMotion(slot)
  const blockPointer = active && phase === 'under-mask'

  if (!active) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={`${className ?? ''}${blockPointer ? ' pointer-events-none' : ''}`}
      {...motionProps}
      initial={false}
    >
      {children}
    </motion.div>
  )
}
