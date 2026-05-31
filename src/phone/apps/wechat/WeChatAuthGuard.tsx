import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState, type ReactNode } from 'react'
import { WeChatRegistration } from './WeChatRegistration'
import { WeChatWelcomeSplash } from './WeChatWelcomeSplash'
import { WeChatWelcomeRevealProvider } from './weChatWelcomeRevealContext'
import { useWechatStore } from './useWechatStore'
import { isWechatProfileComplete } from './wechatProfileTypes'
import {
  clearWeChatWelcomeSplashPending,
  isWeChatWelcomeSplashPending,
} from './wechatWelcomeSplashGate'

type Props = {
  children: ReactNode
  onBack?: () => void
}

export function WeChatAuthGuard({ children, onBack }: Props) {
  const { profile, hydrated } = useWechatStore()
  const hasProfile = isWechatProfileComplete(profile)
  const [welcomeFinished, setWelcomeFinished] = useState(false)

  /** 仅「刚完成注册」且 session 打了 pending 标记时才播欢迎动效；老用户重进不再误播 */
  const showWelcomeSplash =
    hydrated && hasProfile && isWeChatWelcomeSplashPending() && !welcomeFinished

  const handleWelcomeComplete = useCallback(() => {
    clearWeChatWelcomeSplashPending()
    setWelcomeFinished(true)
  }, [])

  const showRegistration = hydrated && !hasProfile
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
                <WeChatWelcomeSplash key="wechat-welcome-splash" onComplete={handleWelcomeComplete} />
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
