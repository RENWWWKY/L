import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { WeChatRegistration } from './WeChatRegistration'
import { WeChatWelcomeSplash } from './WeChatWelcomeSplash'
import { WeChatWelcomeRevealProvider } from './weChatWelcomeRevealContext'
import { useWechatStore } from './useWechatStore'
import { isWechatProfileComplete } from './wechatProfileTypes'

type Props = {
  children: ReactNode
  onBack?: () => void
}

export function WeChatAuthGuard({ children, onBack }: Props) {
  const { profile, hydrated } = useWechatStore()
  const hasProfile = isWechatProfileComplete(profile)
  const [welcomeDone, setWelcomeDone] = useState(false)
  const hadProfileOnHydrateRef = useRef<boolean | null>(null)

  /** 仅老用户（启动时已有档案）跳过注册与欢迎动效 */
  useEffect(() => {
    if (!hydrated || hadProfileOnHydrateRef.current !== null) return
    hadProfileOnHydrateRef.current = hasProfile
    if (hasProfile) setWelcomeDone(true)
  }, [hydrated, hasProfile])

  /** 深度注销后需重新走注册与欢迎动效 */
  useEffect(() => {
    if (!hydrated || hasProfile) return
    setWelcomeDone(false)
    hadProfileOnHydrateRef.current = false
  }, [hydrated, hasProfile])

  const showRegistration = hydrated && !hasProfile
  const showWelcomeSplash = hydrated && hasProfile && !welcomeDone
  const showApp = hydrated && hasProfile

  return (
    <WeChatWelcomeRevealProvider active={showWelcomeSplash}>
      <motion.div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-white">
        {!hydrated ? (
          <motion.div
            className="flex flex-1 items-center justify-center bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="size-6 rounded-full border border-[#E5E7EB] border-t-[#111827] animate-spin" />
          </motion.div>
        ) : (
          <>
            {showApp ? (
              <motion.div
                className="relative z-0 flex min-h-0 flex-1 flex-col"
                initial={false}
                animate={{ opacity: 1 }}
              >
                {children}
              </motion.div>
            ) : null}

            <AnimatePresence>
              {showWelcomeSplash ? (
                <WeChatWelcomeSplash key="wechat-welcome-splash" onComplete={() => setWelcomeDone(true)} />
              ) : null}
            </AnimatePresence>

            {showRegistration ? (
              <motion.div className="absolute inset-0 z-[50] flex min-h-0 flex-col">
                <WeChatRegistration onBack={onBack} />
              </motion.div>
            ) : null}
          </>
        )}
      </motion.div>
    </WeChatWelcomeRevealProvider>
  )
}
