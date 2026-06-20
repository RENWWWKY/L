import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppPlaceholderScreen } from './components/AppPlaceholderScreen'
import { CustomizeScreen } from './components/CustomizeScreen'
import { EntryNoticeModal } from './components/EntryNoticeModal'
import { HomeScreen } from './components/HomeScreen'
import { PhoneShell } from './components/PhoneShell'
import { UserAccountApp } from './apps/userAccount/UserAccountApp'
import { UserSystemAuthModal } from './components/UserSystemAuthModal'
import { AccountStatusCheckingOverlay } from './components/AccountStatusCheckingOverlay'
import { SplashScreen } from './components/SplashScreen'
import { useCustomization } from './CustomizationContext'
import {
  fetchUserStatus,
  getAuthToken,
  needsRemoteAuthCheck,
  readBannedNotice,
  readLocalUserLoginStatus,
  readSessionKickedNotice,
  runLumiSessionGuard,
} from './userSystem/userSystemApi'
import { isUserActivated, type UserAccountTab, type UserLoginStatus } from './userSystem/types'
import { ApiSettingsProvider } from './apps/api/ApiSettingsContext'
import { ApiSettingsApp } from './apps/api/ApiSettingsApp'
import { VoiceprintHubApp } from './apps/voiceprint/VoiceprintHubApp'
import { DataArchiveApp } from './apps/dataArchive/DataArchiveApp'
import { LUMI_SYS_FIRST_BOOT_KEY } from './apps/dataArchive/constants'
import { LoreArchiveApp } from './apps/loreArchive/LoreArchiveApp'
import { RecycleBinApp } from './apps/recycleBin/RecycleBinApp'
import { BackgroundNotifyApp } from './apps/backgroundNotify/BackgroundNotifyApp'
import { personaDb } from './apps/wechat/newFriendsPersona/idb'
import { WeChatApp } from './apps/wechat/WeChatApp'
import { LumiMeetApp } from './apps/lumiMeet/LumiMeetApp'
import { SandboxApp } from './apps/sandbox/SandboxApp'
import { LumiMeetProvider } from './apps/lumiMeet/LumiMeetStore'
import { WorldbookLoreProvider } from './worldbook/worldbookLoreStore'
import type { AppSlot } from './types'
import { ListenTogetherPlayerBootstrap } from '../components/discoverListen/ListenTogetherPlayerBootstrap'
import { dispatchPhoneDismissOverlays } from './phoneDismissOverlays'

type Route =
  | { name: 'home' }
  | { name: 'customize' }
  | { name: 'userAccount'; tab?: UserAccountTab; authTab?: 'login' | 'register' }
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

/** Provider 置于路由层，避免与 LumiMeetApp 同文件热更新时子树脱离 Context */
function LumiMeetAppRoute({ onBack }: { onBack: () => void }) {
  return (
    <LumiMeetProvider>
      <LumiMeetApp onBack={onBack} />
    </LumiMeetProvider>
  )
}

export function PhoneApp() {
  const { state } = useCustomization()
  const fullScreen = state.ui.fullScreen
  const disableTransitions = state.ui.disablePageTransitions
  const pageProps = buildPageProps(disableTransitions)
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [showSplash, setShowSplash] = useState(true)
  const [wechatKeepAlive, setWechatKeepAlive] = useState(false)
  const [showEntryNotice, setShowEntryNotice] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [riskConfirmed, setRiskConfirmed] = useState(false)
  const [userAuthStatus, setUserAuthStatus] = useState<UserLoginStatus | null>(null)
  const [userAuthReady, setUserAuthReady] = useState(false)
  const [banNotice, setBanNotice] = useState<string | null>(() => readBannedNotice()?.message ?? null)
  const [sessionKickedNotice, setSessionKickedNotice] = useState<string | null>(() => readSessionKickedNotice())
  const [authVerifyError, setAuthVerifyError] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(false)
  const openVerifiedRef = useRef(false)

  const handleKickedToLogin = useCallback(() => {
    setUserAuthStatus(null)
    setBanNotice(readBannedNotice()?.message ?? null)
    setSessionKickedNotice(readSessionKickedNotice())
    setUserAuthReady(true)
    setRoute({ name: 'home' })
  }, [])

  const goHome = useCallback(() => setRoute({ name: 'home' }), [])

  const openApp = useCallback((id: AppSlot['id']) => {
    if (id === 'wechat') setWechatKeepAlive(true)
    if (id === 'appearance') {
      setRoute({ name: 'customize' })
      return
    }
    setRoute({ name: 'app', id })
  }, [])

  const wechatVisible = route.name === 'app' && route.id === 'wechat'

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
    if (route.name === 'app' && route.id !== 'wechat') {
      dispatchPhoneDismissOverlays()
    }
  }, [route])

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
      if (id === 'wechat') setWechatKeepAlive(true)
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

  const refreshUserAuth = useCallback(async () => {
    if (!getAuthToken()) {
      openVerifiedRef.current = false
      setAuthChecking(false)
      setUserAuthStatus(null)
      setAuthVerifyError(null)
      setBanNotice(readBannedNotice()?.message ?? null)
      setSessionKickedNotice(readSessionKickedNotice())
      setUserAuthReady(true)
      return
    }

    if (!openVerifiedRef.current) {
      setAuthChecking(true)
      setAuthVerifyError(null)
      try {
        const status = await fetchUserStatus({ force: true })
        if (!getAuthToken()) {
          openVerifiedRef.current = false
          handleKickedToLogin()
          return
        }
        if (!status) {
          setUserAuthStatus(null)
          setAuthVerifyError('无法连接账号服务器，请打开梯子后点击「重新验证账号状态」')
          setBanNotice(readBannedNotice()?.message ?? null)
          setSessionKickedNotice(readSessionKickedNotice())
          setUserAuthReady(true)
          return
        }
        openVerifiedRef.current = true

        if (needsRemoteAuthCheck()) {
          const guard = await runLumiSessionGuard()
          if (guard === 'displaced' || guard === 'banned') {
            openVerifiedRef.current = false
            handleKickedToLogin()
            return
          }
        }

        setUserAuthStatus(status)
        setBanNotice(readBannedNotice()?.message ?? null)
        setSessionKickedNotice(readSessionKickedNotice())
        setUserAuthReady(true)
      } finally {
        setAuthChecking(false)
      }
      return
    }

    setAuthChecking(false)
    setUserAuthStatus(readLocalUserLoginStatus())
    setAuthVerifyError(null)
    setBanNotice(readBannedNotice()?.message ?? null)
    setSessionKickedNotice(readSessionKickedNotice())
    setUserAuthReady(true)
  }, [handleKickedToLogin])

  useEffect(() => {
    if (showSplash || showEntryNotice) return
    if (route.name !== 'home') return
    setUserAuthReady(false)
    void refreshUserAuth()
  }, [route.name, showSplash, showEntryNotice, refreshUserAuth])

  const showUserAuthModal =
    !showSplash &&
    !showEntryNotice &&
    !authChecking &&
    route.name === 'home' &&
    userAuthReady &&
    (!!authVerifyError ||
      !userAuthStatus ||
      !isUserActivated(userAuthStatus))

  const showAccountStatusChecking =
    !showSplash &&
    !showEntryNotice &&
    route.name === 'home' &&
    authChecking

  const userAuthStatusOnly =
    !!userAuthStatus && !isUserActivated(userAuthStatus)

  const handleRetryAuthVerify = useCallback(() => {
    openVerifiedRef.current = false
    setAuthVerifyError(null)
    setUserAuthReady(false)
    void refreshUserAuth()
  }, [refreshUserAuth])

  const handleUserAuthed = useCallback((status: UserLoginStatus) => {
    openVerifiedRef.current = true
    setUserAuthStatus(status)
    setAuthVerifyError(null)
    setBanNotice(null)
    setSessionKickedNotice(null)
  }, [])

  const openUserAccount = useCallback((tab: UserAccountTab = 'overview', authTab?: 'login' | 'register') => {
    setRoute({ name: 'userAccount', tab, authTab: authTab ?? (tab === 'auth' ? 'register' : undefined) })
  }, [])

  const handleUserAccountBack = useCallback(() => {
    setRoute({ name: 'home' })
    setUserAuthReady(false)
    void refreshUserAuth()
  }, [refreshUserAuth])

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
        <ListenTogetherPlayerBootstrap />
        <PhoneShell>
          {wechatKeepAlive ? (
            <div
              className={`route-page-layer flex h-full min-h-0 flex-col bg-white ${
                wechatVisible ? 'absolute inset-0 z-[20]' : 'hidden'
              }`}
              aria-hidden={!wechatVisible}
            >
              <WeChatApp onBack={goHome} />
            </div>
          ) : null}
          <AnimatePresence mode="wait" initial={false}>
            {route.name === 'home' && (
              <motion.div
                key="home"
                className={`route-page-layer relative flex h-full min-h-0 flex-col ${disableTransitions ? '' : 'transform-gpu'}`}
                {...pageProps}
              >
                <HomeScreen onOpenApp={openApp} onOpenUserAccount={() => openUserAccount('overview')} />
              </motion.div>
            )}
            {route.name === 'userAccount' && (
              <motion.div
                key="userAccount"
                className={`route-page-layer flex h-full min-h-0 flex-col ${disableTransitions ? '' : 'transform-gpu'}`}
                {...pageProps}
              >
                <UserAccountApp
                  onBack={handleUserAccountBack}
                  initialTab={route.tab}
                  initialAuthTab={route.authTab}
                  onAuthChange={() => {
                    setUserAuthReady(false)
                    void refreshUserAuth()
                  }}
                />
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
            {route.name === 'app' && route.id !== 'wechat' && (
              <motion.div
                key={`app-${route.id}`}
                className={`route-page-layer flex h-full min-h-0 flex-col ${disableTransitions ? '' : 'transform-gpu'}`}
                {...pageProps}
              >
                {route.id === 'lumiMeet' ? (
                  <LumiMeetAppRoute onBack={goHome} />
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
                ) : route.id === 'backgroundNotify' ? (
                  <BackgroundNotifyApp onBack={goHome} />
                ) : route.id === 'sandbox' ? (
                  <SandboxApp onBack={goHome} />
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
        <AccountStatusCheckingOverlay open={showAccountStatusChecking} />
        <UserSystemAuthModal
          open={showUserAuthModal}
          statusOnly={userAuthStatusOnly}
          initialStatus={userAuthStatus}
          banNotice={banNotice}
          sessionKickedNotice={sessionKickedNotice}
          authVerifyError={authVerifyError}
          onAuthed={handleUserAuthed}
          onRetryAuthVerify={handleRetryAuthVerify}
          onOpenAccount={(tab) => {
            openUserAccount(tab ?? 'overview')
          }}
        />
      </ApiSettingsProvider>
    </div>
  )
}
