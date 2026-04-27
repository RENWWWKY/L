import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { AppPlaceholderScreen } from './components/AppPlaceholderScreen'
import { CustomizeScreen } from './components/CustomizeScreen'
import { HomeScreen } from './components/HomeScreen'
import { PhoneShell } from './components/PhoneShell'
import { useCustomization } from './CustomizationContext'
import { ApiSettingsProvider } from './apps/api/ApiSettingsContext'
import { ApiSettingsApp } from './apps/api/ApiSettingsApp'
import { VoiceprintHubApp } from './apps/voiceprint/VoiceprintHubApp'
import { WeChatApp } from './apps/wechat/WeChatApp'
import type { AppSlot } from './types'

type Route =
  | { name: 'home' }
  | { name: 'customize' }
  | { name: 'app'; id: AppSlot['id'] }

const transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }

const pageProps = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition,
}

export function PhoneApp() {
  const { state } = useCustomization()
  const fullScreen = state.ui.fullScreen
  const [route, setRoute] = useState<Route>({ name: 'home' })

  const goHome = useCallback(() => setRoute({ name: 'home' }), [])

  const openApp = useCallback((id: AppSlot['id']) => {
    if (id === 'appearance') {
      setRoute({ name: 'customize' })
      return
    }
    setRoute({ name: 'app', id })
  }, [])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ id: AppSlot['id'] }>
      const id = ce.detail?.id
      if (!id) return
      openApp(id)
    }
    window.addEventListener('phone:open-app', onOpen as EventListener)
    return () => window.removeEventListener('phone:open-app', onOpen as EventListener)
  }, [openApp])

  return (
    <div
      className={
        fullScreen
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
          : 'flex min-h-0 min-w-0 flex-1 flex-col'
      }
    >
      <ApiSettingsProvider>
        <PhoneShell>
          <AnimatePresence mode="wait">
            {route.name === 'home' && (
              <motion.div key="home" className="relative flex h-full min-h-0 flex-col" {...pageProps}>
                <HomeScreen onOpenApp={openApp} />
              </motion.div>
            )}
            {route.name === 'customize' && (
              <motion.div key="customize" className="flex h-full min-h-0 flex-col" {...pageProps}>
                <CustomizeScreen onBack={goHome} />
              </motion.div>
            )}
            {route.name === 'app' && (
              <motion.div key={`app-${route.id}`} className="flex h-full min-h-0 flex-col" {...pageProps}>
                {route.id === 'wechat' ? (
                  <WeChatApp onBack={goHome} />
                ) : route.id === 'api' ? (
                  <ApiSettingsApp onBack={goHome} />
                ) : route.id === 'voiceprint' ? (
                  <VoiceprintHubApp onBack={goHome} />
                ) : (
                  <AppPlaceholderScreen appId={route.id} onBack={goHome} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </PhoneShell>
      </ApiSettingsProvider>
    </div>
  )
}
