import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppPlaceholderScreen } from './components/AppPlaceholderScreen'
import { CustomizeScreen } from './components/CustomizeScreen'
import { EntryNoticeModal } from './components/EntryNoticeModal'
import { HomeScreen } from './components/HomeScreen'
import { PhoneShell } from './components/PhoneShell'
import { UserAccountApp } from './apps/userAccount/UserAccountApp'
import { UserSystemAuthModal } from './components/UserSystemAuthModal'
import { UserInfoCorrectionModal } from './components/UserInfoCorrectionModal'
import { AccountStatusCheckingOverlay } from './components/AccountStatusCheckingOverlay'
import { SplashScreen } from './components/SplashScreen'
import { useCustomization } from './CustomizationContext'
import {
  clearAuth,
  clearAuthVerified,
  fetchUserStatus,
  getAuthToken,
  needsRemoteAuthCheck,
  readAuthVerified,
  readBannedNotice,
  readLocalAccountGateStatus,
  readLocalUserLoginStatus,
  readSessionKickedNotice,
  runLumiSessionGuard,
  shouldShowAccountStatusCheck,
  setAuthVerified,
  STATUS_FETCH_TIMEOUT_MS,
  STATUS_CHECK_MIN_OVERLAY_MS,
  waitForStatusCheckOverlay,
} from './userSystem/userSystemApi'
import { isUserActivated, needsUserInfoCorrection, type UserAccountTab, type UserLoginStatus } from './userSystem/types'
import { isLocalDevBypassAuth, LOCAL_DEV_MOCK_STATUS } from './userSystem/localDevMode'
import { ApiSettingsProvider } from './apps/api/ApiSettingsContext'
import { ApiSettingsApp } from './apps/api/ApiSettingsApp'
import { VoiceprintHubApp } from './apps/voiceprint/VoiceprintHubApp'
import { DataArchiveApp } from './apps/dataArchive/DataArchiveApp'
import { LUMI_SYS_FIRST_BOOT_KEY } from './apps/dataArchive/constants'
import { LoreArchiveApp } from './apps/loreArchive/LoreArchiveApp'
import { RecycleBinApp } from './apps/recycleBin/RecycleBinApp'
import { BackgroundNotifyApp } from './apps/backgroundNotify/BackgroundNotifyApp'
import { EvolutionApp } from './apps/evolution/EvolutionApp'
import { EvolutionUpdatePushModal } from './apps/evolution/EvolutionUpdatePushModal'
import { getLatestEvolutionRecord } from './apps/evolution/evolutionLogData'
import { shouldOfferEvolutionPush } from './apps/evolution/evolutionPushStorage'
import { personaDb } from './apps/wechat/newFriendsPersona/idb'
import { WeChatApp } from './apps/wechat/WeChatApp'
import { LumiMeetApp } from './apps/lumiMeet/LumiMeetApp'
import { SandboxApp } from './apps/sandbox/SandboxApp'
import { LumiTasteApp } from './apps/takeout/LumiTasteApp'
import { LUMI_PULSE_NAVIGATE_EVENT } from './apps/lumiPulse/lumiPulseNavigation'
import { TasteFeastCeremonyHost } from './apps/takeout/TasteFeastCeremonyHost'
import { LumiMeetProvider } from './apps/lumiMeet/LumiMeetStore'
import { WorldbookLoreProvider } from './worldbook/worldbookLoreStore'
import type { AppSlot } from './types'
import { ListenTogetherPlayerBootstrap } from '../components/discoverListen/ListenTogetherPlayerBootstrap'
import { dispatchPhoneDismissOverlays } from './phoneDismissOverlays'
import {
  runDiscordOAuthCallbackFromUrl,
  resolveDiscordAuthTabAfterOAuth,
  storeDiscordOAuthError,
} from './userSystem/discordOAuthFlow'
import { consumeDiscordRegisterFromCommunityTroubleshoot } from './userSystem/discordRegisterFlags'
import { storeDiscordRegisterPending } from './components/DiscordRegisterCompleteModal'

type Route =
  | { name: 'home' }
  | { name: 'customize' }
  | { name: 'userAccount'; tab?: UserAccountTab; authTab?: 'login' | 'register' }
  | { name: 'app'; id: AppSlot['id'] }

function resolveInitialPhoneRoute(): Route {
  if (typeof window === 'undefined') return { name: 'home' }
  const authTab = resolveDiscordAuthTabAfterOAuth()
  if (authTab) {
    return { name: 'userAccount', tab: 'auth', authTab }
  }
  return { name: 'home' }
}

function shouldSkipSplashOnBoot(): boolean {
  if (typeof window === 'undefined') return false
  return !!resolveDiscordAuthTabAfterOAuth()
}

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
const localDevBypassAuth = isLocalDevBypassAuth()

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
  const [route, setRoute] = useState<Route>(resolveInitialPhoneRoute)
  const [showSplash, setShowSplash] = useState(() => !shouldSkipSplashOnBoot())
  const [wechatKeepAlive, setWechatKeepAlive] = useState(false)
  const [showEntryNotice, setShowEntryNotice] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [riskConfirmed, setRiskConfirmed] = useState(false)
  const [userAuthStatus, setUserAuthStatus] = useState<UserLoginStatus | null>(
    () => (localDevBypassAuth ? LOCAL_DEV_MOCK_STATUS : null),
  )
  const [userAuthReady, setUserAuthReady] = useState(() => localDevBypassAuth)
  const [banNotice, setBanNotice] = useState<string | null>(() => readBannedNotice()?.message ?? null)
  const [sessionKickedNotice, setSessionKickedNotice] = useState<string | null>(() => readSessionKickedNotice())
  const [authVerifyError, setAuthVerifyError] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(false)
  const [showEvolutionPush, setShowEvolutionPush] = useState(false)
  const openVerifiedRef = useRef(localDevBypassAuth || readAuthVerified())
  /** 本次页面加载是否已做过开屏后的唯一一次账号检测（刷新页面会重置） */
  const sessionBootAuthDoneRef = useRef(false)

  useEffect(() => {
    if (localDevBypassAuth) openVerifiedRef.current = true
  }, [])

  useEffect(() => {
    if (localDevBypassAuth && import.meta.env.DEV) {
      console.info('[Lumi] 本地开发模式：已跳过账号登录与状态检测')
    }
    if (!localDevBypassAuth && import.meta.env.DEV) {
      console.info('[Lumi] 本地开发模式：已启用账号登录与状态检测（验证完请在 .env.development 改回 bypass）')
    }
  }, [])

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
    if (id === 'weibo') {
      setWechatKeepAlive(true)
      setRoute({ name: 'app', id: 'wechat' })
      window.dispatchEvent(new CustomEvent(LUMI_PULSE_NAVIGATE_EVENT))
      return
    }
    if (id === 'appearance') {
      setRoute({ name: 'customize' })
      return
    }
    setRoute({ name: 'app', id })
  }, [])

  const wechatVisible = route.name === 'app' && route.id === 'wechat'

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (shouldSkipSplashOnBoot()) {
      setShowEntryNotice(false)
      return
    }
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
    if (localDevBypassAuth) {
      openVerifiedRef.current = true
      setAuthChecking(false)
      setUserAuthStatus(LOCAL_DEV_MOCK_STATUS)
      setAuthVerifyError(null)
      setBanNotice(null)
      setSessionKickedNotice(null)
      setUserAuthReady(true)
      return
    }

    if (!getAuthToken()) {
      if (readBannedNotice()) {
        setAuthChecking(true)
        setUserAuthReady(false)
        setAuthVerifyError(null)
        try {
          await waitForStatusCheckOverlay()
          setUserAuthStatus(readLocalAccountGateStatus())
          setBanNotice(readBannedNotice()?.message ?? null)
          setSessionKickedNotice(readSessionKickedNotice())
        } finally {
          setAuthChecking(false)
          setUserAuthReady(true)
        }
        return
      }
      openVerifiedRef.current = false
      setAuthChecking(false)
      setUserAuthStatus(null)
      setAuthVerifyError(null)
      setBanNotice(readBannedNotice()?.message ?? null)
      setSessionKickedNotice(readSessionKickedNotice())
      setUserAuthReady(true)
      return
    }

    setAuthChecking(true)
    setUserAuthReady(false)
    setAuthVerifyError(null)
    const checkStarted = Date.now()
    try {
      const status = await fetchUserStatus({ force: true, timeoutMs: STATUS_FETCH_TIMEOUT_MS })
      if (!getAuthToken()) {
        openVerifiedRef.current = false
        handleKickedToLogin()
        return
      }
      if (!status) {
        openVerifiedRef.current = false
        clearAuthVerified()
        // 状态接口失败（含 401/404）时清掉旧 token，避免只剩「重新验证」无法登录
        clearAuth()
        setUserAuthStatus(null)
        setAuthVerifyError(null)
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
      setAuthVerifyError(null)
      setBanNotice(readBannedNotice()?.message ?? null)
      setSessionKickedNotice(readSessionKickedNotice())
      setUserAuthReady(true)
    } finally {
      const remain = STATUS_CHECK_MIN_OVERLAY_MS - (Date.now() - checkStarted)
      if (remain > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remain))
      }
      setAuthChecking(false)
    }
  }, [handleKickedToLogin])

  useEffect(() => {
    if (localDevBypassAuth) return
    if (showSplash || showEntryNotice) return
    if (sessionBootAuthDoneRef.current) return
    sessionBootAuthDoneRef.current = true
    if (shouldShowAccountStatusCheck()) {
      setAuthChecking(true)
      setUserAuthReady(false)
    }
    void refreshUserAuth()
  }, [showSplash, showEntryNotice, refreshUserAuth])

  const needsCorrection = needsUserInfoCorrection(userAuthStatus)

  const showUserAuthModal =
    !localDevBypassAuth &&
    !showSplash &&
    !showEntryNotice &&
    !authChecking &&
    !needsCorrection &&
    route.name === 'home' &&
    userAuthReady &&
    (!!authVerifyError ||
      !userAuthStatus ||
      !isUserActivated(userAuthStatus))

  const showInfoCorrectionModal =
    !localDevBypassAuth &&
    !showSplash &&
    !showEntryNotice &&
    !authChecking &&
    userAuthReady &&
    needsCorrection &&
    !!userAuthStatus

  const showAccountStatusChecking =
    !localDevBypassAuth &&
    !showSplash &&
    !showEntryNotice &&
    route.name === 'home' &&
    shouldShowAccountStatusCheck() &&
    (authChecking || !userAuthReady)

  const userAuthStatusOnly =
    !!userAuthStatus && !isUserActivated(userAuthStatus)

  const canOfferEvolutionPush =
    !showSplash &&
    !showEntryNotice &&
    !showAccountStatusChecking &&
    !showUserAuthModal &&
    !showInfoCorrectionModal &&
    route.name === 'home' &&
    (localDevBypassAuth ||
      (userAuthReady && !!userAuthStatus && isUserActivated(userAuthStatus)))

  useEffect(() => {
    if (!canOfferEvolutionPush) {
      setShowEvolutionPush(false)
      return
    }
    const version = getLatestEvolutionRecord().version
    if (!shouldOfferEvolutionPush(version)) {
      setShowEvolutionPush(false)
      return
    }
    setShowEvolutionPush(true)
  }, [canOfferEvolutionPush])

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
    if (isUserActivated(status)) {
      setAuthVerified()
    }
  }, [])

  const openUserAccount = useCallback((tab: UserAccountTab = 'overview', authTab?: 'login' | 'register') => {
    setRoute({ name: 'userAccount', tab, authTab: authTab ?? (tab === 'auth' ? 'register' : undefined) })
  }, [])

  useEffect(() => {
    void runDiscordOAuthCallbackFromUrl().then((result) => {
      if (!result) return
      if (result.kind === 'login' && result.ok) {
        handleUserAuthed(result.status)
        if (result.status.banStatus === 'banned') {
          openUserAccount('unban', 'login')
        } else if (!result.lumiEntry) {
          openUserAccount('overview', 'login')
        }
        return
      }
      if (result.kind === 'register' && result.ok) {
        storeDiscordRegisterPending({
          registerToken: result.registerToken,
          discordId: result.discordId,
          discordHandle: result.discordHandle,
          discordDisplayName: result.discordDisplayName,
          discordUsername: result.discordUsername,
          fromUnregisteredLogin: result.fromUnregisteredLogin,
          fromCommunityTroubleshoot: consumeDiscordRegisterFromCommunityTroubleshoot(),
        })
        openUserAccount('auth', result.fromUnregisteredLogin ? 'login' : 'register')
        return
      }
      storeDiscordOAuthError(result.error)
      openUserAccount('auth', result.kind === 'register' ? 'register' : 'login')
    })
  }, [handleUserAuthed, openUserAccount])

  const handleUserAccountBack = useCallback(() => {
    setRoute({ name: 'home' })
  }, [])

  const syncUserAuthFromLocal = useCallback(() => {
    if (!getAuthToken()) {
      openVerifiedRef.current = false
      setUserAuthStatus(null)
      setAuthVerifyError(null)
      setBanNotice(readBannedNotice()?.message ?? null)
      setSessionKickedNotice(readSessionKickedNotice())
      setUserAuthReady(true)
      return
    }
    openVerifiedRef.current = readAuthVerified()
    setUserAuthStatus(readLocalUserLoginStatus())
    setAuthVerifyError(null)
    setBanNotice(readBannedNotice()?.message ?? null)
    setSessionKickedNotice(readSessionKickedNotice())
    setUserAuthReady(true)
  }, [])

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
                  onAuthChange={syncUserAuthFromLocal}
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
                ) : route.id === 'evolution' ? (
                  <EvolutionApp onBack={goHome} />
                ) : route.id === 'takeout' ? (
                  <LumiTasteApp onBack={goHome} />
                ) : (
                  <AppPlaceholderScreen appId={route.id} onBack={goHome} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <TasteFeastCeremonyHost />
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
        <EvolutionUpdatePushModal
          open={showEvolutionPush}
          onClose={() => setShowEvolutionPush(false)}
          onOpenEvolution={() => openApp('evolution')}
        />
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
        {userAuthStatus ? (
          <UserInfoCorrectionModal
            open={showInfoCorrectionModal}
            status={userAuthStatus}
            onCorrected={(status) => {
              setUserAuthStatus(status)
              setUserAuthReady(true)
            }}
            onLogout={() => {
              openVerifiedRef.current = false
              setUserAuthStatus(null)
              setUserAuthReady(true)
            }}
          />
        ) : null}
      </ApiSettingsProvider>
    </div>
  )
}
