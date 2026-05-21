import { BookOpen, LayoutGrid, MessageCircle, Radar, ScrollText, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable } from '../../components/Pressable'
import { AppIconTile } from '../../components/AppIconTile'
import { useCustomization } from '../../CustomizationContext'
import type { AppSlot } from '../../types'
import { DiscoverFeed } from './DiscoverFeed'
import { EncounterChats } from './EncounterChats'
import { MatchDashboard } from './MatchDashboard'
import './lumiMeetPlatinum.css'
import { LUMI_MEET_ROOT_ID } from './lumiMeetPortal'
import { DestinyArchive } from './DestinyArchive'
import { MyProfile } from './MyProfile'
import { MeetResetEncounterButton } from './MeetResetEncounterButton'
import { countTotalMeetInboxUnread } from './meetEncounterInboxRow'
import { useLumiMeetStore } from './LumiMeetStore'
import type { MeetTab } from './meetAppTabs'
import { MeetAppCoachPortal } from './MeetAppCoach'
import { MeetAppTutorialModalPortal } from './MeetAppTutorialModal'
import {
  MEET_APP_COACH_STEPS,
  MEET_APP_OPEN_TUTORIAL_EVENT,
  MEET_APP_START_COACH_EVENT,
  MEET_APP_COACH_TARGET_ATTR,
  type MeetAppCoachStep,
  type MeetArchiveCoachTab,
} from './meetAppCoachSteps'
import { MEET_APP_GO_PROFILE_CONTACT_EVENT } from './meetBindingReadiness'
import { MeetMemorySummarySuccessToastHost } from './MeetMemorySummarySuccessToastHost.tsx'

const TABS: {
  id: MeetTab
  label: string
  caption: string
  Icon: typeof Radar
}[] = [
  { id: 'match', label: '寻觅', caption: 'Resonance · Match', Icon: Radar },
  { id: 'discover', label: '广场', caption: 'Discover · Square', Icon: LayoutGrid },
  { id: 'inbox', label: '消息', caption: 'Inbox · Chats', Icon: MessageCircle },
  { id: 'archive', label: '记忆', caption: 'Destiny · Archive', Icon: ScrollText },
  { id: 'profile', label: '我的', caption: 'Profile · You', Icon: UserRound },
]

function MeetInboxTabBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="pointer-events-none absolute right-0 top-0 flex min-h-[16px] min-w-[16px] -translate-y-[42%] translate-x-[42%] items-center justify-center rounded-full px-[4px] text-[9px] font-bold leading-none text-white"
      style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * 遇见（Lumi Meet）：底部 Tab 接入匹配雷达、广场、会话与档案。
 */
export function LumiMeetApp({ onBack }: { onBack: () => void }) {
  const { state: phoneState, themeStyle } = useCustomization()
  const pageStyle = phoneState.appPageStyles.lumiMeet
  const title = useMemo(() => phoneState.apps.find((a) => a.id === 'lumiMeet')?.label ?? '遇见', [phoneState.apps])
  const { hydrated, state: meetState, markMeetAppCoachCompleted } = useLumiMeetStore()
  const [tab, setTab] = useState<MeetTab>('match')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [coachProfileTab, setCoachProfileTab] = useState<'mask' | 'aesthetic' | 'contact' | null>(null)
  const [coachArchiveTab, setCoachArchiveTab] = useState<MeetArchiveCoachTab | null>(null)
  const [coachSparkPreview, setCoachSparkPreview] = useState(false)
  const tabMeta = useMemo(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab])
  const inboxUnreadTotal = useMemo(
    () => countTotalMeetInboxUnread(meetState),
    [meetState.npcs, meetState.chatThreads, meetState.meetInboxLastReadTsByNpcId],
  )

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback(
    (opts?: { openTutorial?: boolean }) => {
      markMeetAppCoachCompleted()
      setCoachOpen(false)
      setCoachStepIndex(0)
      setCoachProfileTab(null)
      setCoachArchiveTab(null)
      setCoachSparkPreview(false)
      if (opts?.openTutorial) setTutorialOpen(true)
    },
    [markMeetAppCoachCompleted],
  )

  const onBeforeCoachStep = useCallback((step: MeetAppCoachStep) => {
    if (step.tab) setTab(step.tab)
    setCoachProfileTab(step.profileTab ?? null)
    setCoachArchiveTab(step.archiveTab ?? null)
    setCoachSparkPreview(step.coachPreview === 'match-spark')
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (meetState.meetAppCoachCompleted) return
    const id = window.setTimeout(() => startLiveCoach(), 720)
    return () => window.clearTimeout(id)
  }, [hydrated, meetState.meetAppCoachCompleted, startLiveCoach])

  useEffect(() => {
    const onStart = () => startLiveCoach()
    const onOpenTutorial = () => setTutorialOpen(true)
    const onGoProfileContact = () => setTab('profile')
    window.addEventListener(MEET_APP_START_COACH_EVENT, onStart)
    window.addEventListener(MEET_APP_OPEN_TUTORIAL_EVENT, onOpenTutorial)
    window.addEventListener(MEET_APP_GO_PROFILE_CONTACT_EVENT, onGoProfileContact)
    return () => {
      window.removeEventListener(MEET_APP_START_COACH_EVENT, onStart)
      window.removeEventListener(MEET_APP_OPEN_TUTORIAL_EVENT, onOpenTutorial)
      window.removeEventListener(MEET_APP_GO_PROFILE_CONTACT_EVENT, onGoProfileContact)
    }
  }, [startLiveCoach])

  return (
    <div
      id={LUMI_MEET_ROOT_ID}
      data-meet-app-coach-root="meet-app"
      className="relative flex h-full min-h-0 flex-col bg-[#f7f6f3]"
      data-phone-page="app"
      data-app-id="lumiMeet"
      style={{
        ...themeStyle,
        backgroundColor: pageStyle?.pageBg ?? '#f7f6f3',
        fontFamily: 'var(--phone-font)',
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-2"
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          backgroundColor: pageStyle?.headerBg ?? 'rgba(255,255,255,0.94)',
          color: pageStyle?.headerText ?? '#2c2a26',
        }}
      >
        <Pressable
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full opacity-80"
          aria-label="返回桌面"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <AppIconTile appId={'lumiMeet' as AppSlot['id']} bgSize={46} glyphSize={30} radius={13} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-medium tracking-[0.06em]" style={{ color: pageStyle?.headerText }}>
            {title}
          </h1>
          <p className="meet-caption-en truncate text-[9px] uppercase tracking-[0.42em] opacity-55">
            {tabMeta.caption}
          </p>
        </div>
        <Pressable
          type="button"
          {...{ [MEET_APP_COACH_TARGET_ATTR]: 'tutorial' }}
          onClick={() => setTutorialOpen(true)}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#ebe7e0] bg-white/90 px-2.5 text-[#5c574f] shadow-[0_2px_10px_rgba(40,36,30,0.04)] active:bg-[#f4f2ee]"
          aria-label="遇见新手教程"
        >
          <BookOpen className="size-3.5 text-[#b8973a]" strokeWidth={1.5} aria-hidden />
          <span className="text-[11px] font-medium tracking-[0.06em]">教程</span>
        </Pressable>
        <MeetResetEncounterButton />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'match' ? <MatchDashboard sparkActionsCoachPreview={coachSparkPreview} /> : null}
        {tab === 'discover' ? <DiscoverFeed /> : null}
        {tab === 'inbox' ? <EncounterChats /> : null}
        {tab === 'archive' ? <DestinyArchive coachArchiveTab={coachArchiveTab} /> : null}
        {tab === 'profile' ? <MyProfile coachProfileTab={coachProfileTab} /> : null}
      </div>

      <nav
        className="meet-caption-en flex shrink-0 items-stretch justify-around gap-1 border-t border-black/[0.06] bg-[color-mix(in_oklab,white_92%,transparent)] px-1 pt-1.5 backdrop-blur-md"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))' }}
        aria-label="遇见主导航"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          const tabUnread = id === 'inbox' ? inboxUnreadTotal : 0
          const coachId = `nav-${id}` as const
          return (
            <Pressable
              key={id}
              onClick={() => setTab(id)}
              {...{ [MEET_APP_COACH_TARGET_ATTR]: coachId }}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors ${
                active ? 'text-[#2c2a26]' : 'text-[#b8b5ad] hover:text-[#8a8680]'
              }`}
              aria-current={active ? 'page' : undefined}
              aria-label={tabUnread > 0 ? `${label}，未读 ${tabUnread} 条` : label}
            >
              <span className="relative inline-flex shrink-0">
                <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.35} aria-hidden />
                {id === 'inbox' ? <MeetInboxTabBadge count={tabUnread} /> : null}
              </span>
              <span className="truncate text-[10px] font-medium tracking-[0.12em]">{label}</span>
            </Pressable>
          )
        })}
      </nav>

      <MeetAppTutorialModalPortal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onStartLiveCoach={startLiveCoach}
      />

      <MeetAppCoachPortal
        open={coachOpen}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={() => finishCoach()}
        onComplete={(opts) => finishCoach(opts)}
        onBeforeStep={onBeforeCoachStep}
        layoutEpoch={`${tab}-${coachProfileTab ?? ''}-${coachArchiveTab ?? ''}-${coachSparkPreview ? 'spark' : ''}`}
      />

      <MeetMemorySummarySuccessToastHost />
    </div>
  )
}
