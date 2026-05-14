import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { AppPlaceholderScreen } from './components/AppPlaceholderScreen'
import { CustomizeScreen } from './components/CustomizeScreen'
import { EntryNoticeModal } from './components/EntryNoticeModal'
import { HomeScreen } from './components/HomeScreen'
import { PhoneShell } from './components/PhoneShell'
import { SplashScreen } from './components/SplashScreen'
import { useCustomization } from './CustomizationContext'
import { ApiSettingsProvider } from './apps/api/ApiSettingsContext'
import { ApiSettingsApp } from './apps/api/ApiSettingsApp'
import { VoiceprintHubApp } from './apps/voiceprint/VoiceprintHubApp'
import { DataArchiveApp } from './apps/dataArchive/DataArchiveApp'
import { LUMI_SYS_FIRST_BOOT_KEY } from './apps/dataArchive/constants'
import { LoreArchiveApp } from './apps/loreArchive/LoreArchiveApp'
import { RecycleBinApp } from './apps/recycleBin/RecycleBinApp'
import { personaDb } from './apps/wechat/newFriendsPersona/idb'
import { WeChatApp } from './apps/wechat/WeChatApp'
import { LumiMeetApp } from './apps/lumiMeet/LumiMeetApp'
import { WorldbookLoreProvider } from './worldbook/worldbookLoreStore'
import type { AppSlot } from './types'

type Route =
  | { name: 'home' }
  | { name: 'customize' }
  | { name: 'app'; id: AppSlot['id'] }

const transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }

function buildPageProps(disableTransitions: boolean) {
  if (disableTransitions) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
      transition: { duration: 0 },
      style: {
        willChange: 'auto',
      },
    }
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition,
    style: {
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden' as const,
      WebkitBackfaceVisibility: 'hidden' as const,
    },
  }
}
const ENTRY_NOTICE_KEY = 'entry-notice-accepted-v1'

export function PhoneApp() {
  const { state } = useCustomization()
  const fullScreen = state.ui.fullScreen
  const disableTransitions = state.ui.disablePageTransitions
  const pageProps = buildPageProps(disableTransitions)
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [showSplash, setShowSplash] = useState(true)
  const [showEntryNotice, setShowEntryNotice] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [riskConfirmed, setRiskConfirmed] = useState(false)

  const goHome = useCallback(() => setRoute({ name: 'home' }), [])

  const openApp = useCallback((id: AppSlot['id']) => {
    if (id === 'appearance') {
      setRoute({ name: 'customize' })
      return
    }
    setRoute({ name: 'app', id })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const accepted = window.localStorage.getItem(ENTRY_NOTICE_KEY) === '1'
    setShowEntryNotice(!accepted)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (!window.localStorage.getItem(LUMI_SYS_FIRST_BOOT_KEY)) {
        window.localStorage.setItem(LUMI_SYS_FIRST_BOOT_KEY, String(Date.now()))
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const run = () => void personaDb.purgeExpiredIndexedTrash()
    run()
    const t = window.setInterval(run, 120000)
    return () => window.clearInterval(t)
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

  const handleNoticeConfirm = useCallback(() => {
    if (!ageConfirmed || !riskConfirmed) return
    window.localStorage.setItem(ENTRY_NOTICE_KEY, '1')
    setShowEntryNotice(false)
  }, [ageConfirmed, riskConfirmed])

  return (
    <div
      className={
        fullScreen
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
          : 'flex min-h-0 min-w-0 flex-1 flex-col'
      }
    >
      <ApiSettingsProvider>
        <WorldbookLoreProvider>
        <PhoneShell>
          <AnimatePresence mode="wait" initial={false}>
            {route.name === 'home' && (
              <motion.div
                key="home"
                className={`route-page-layer relative flex h-full min-h-0 flex-col ${disableTransitions ? '' : 'transform-gpu'}`}
                {...pageProps}
              >
                <HomeScreen onOpenApp={openApp} />
              </motion.div>
            )}
            {route.name === 'customize' && (
              <motion.div
                key="customize"
                className={`route-page-layer flex h-full min-h-0 flex-col ${disableTransitions ? '' : 'transform-gpu'}`}
                {...pageProps}
              >
                <CustomizeScreen onBack={goHome} />
              </motion.div>
            )}
            {route.name === 'app' && (
              <motion.div
                key={`app-${route.id}`}
                className={`route-page-layer flex h-full min-h-0 flex-col ${disableTransitions ? '' : 'transform-gpu'}`}
                {...pageProps}
              >
                {route.id === 'wechat' ? (
                  <WeChatApp onBack={goHome} />
                ) : route.id === 'lumiMeet' ? (
                  <LumiMeetApp onBack={goHome} />
                ) : route.id === 'api' ? (
                  <ApiSettingsApp onBack={goHome} />
                ) : route.id === 'voiceprint' ? (
                  <VoiceprintHubApp onBack={goHome} />
                ) : route.id === 'dataArchive' ? (
                  <DataArchiveApp onBack={goHome} />
                ) : route.id === 'loreArchive' ? (
                  <LoreArchiveApp onBack={goHome} />
                ) : route.id === 'recycleBin' ? (
                  <RecycleBinApp onBack={goHome} />
                ) : (
                  <AppPlaceholderScreen appId={route.id} onBack={goHome} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </PhoneShell>
        </WorldbookLoreProvider>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
        <EntryNoticeModal
          open={!showSplash && showEntryNotice}
          ageConfirmed={ageConfirmed}
          riskConfirmed={riskConfirmed}
          onToggleAge={setAgeConfirmed}
          onToggleRisk={setRiskConfirmed}
          onConfirm={handleNoticeConfirm}
        />
      </ApiSettingsProvider>
    </div>
  )
}
