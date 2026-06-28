import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import { Pressable } from '../../../components/Pressable'
import { MemoryDashboard } from './MemoryDashboard'
import { MemoryEngineConfig } from './MemoryEngineConfig'
import { MemorySummaryProgressPanel } from './MemorySummaryProgressPanel'
import { MemoryEpiloguePanel } from './MemoryEpiloguePanel'
import { MemorySummaryRetryPanel } from './MemorySummaryRetryPanel'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import type { MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { MemoryCoachPortal } from './MemoryCoachPortal'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import { MemoryTutorialButton } from './MemoryTutorialButton'
import { MEMORY_HUB_COACH_STEPS, MEMORY_HUB_START_COACH_EVENT } from './memoryHubCoachSteps'
import { MEMORY_HUB_TUTORIAL_SECTIONS } from './memoryHubTutorialCopy'
import {
  MEMORY_HUB_COACH_SEEN_KEY,
  readMemoryCoachSeen,
  writeMemoryCoachSeen,
} from './memoryCoachTypes'
import { dispatchMemoryTabCoachForHubTab } from './useMemoryTabCoach'

const MEMORY_ARCHIVE_TABS = [
  { id: 'config' as const, label: '记忆配置' },
  { id: 'memories' as const, label: '角色总结' },
  { id: 'epilogue' as const, label: '尾声延展' },
  { id: 'progress' as const, label: '线上总结进度' },
  { id: 'retry' as const, label: '补全总结' },
] as const

type MemoryArchiveTabId = (typeof MEMORY_ARCHIVE_TABS)[number]['id']

function TopBar({
  title,
  subtitle,
  onBack,
  onOpenTutorial,
  backLabel = '返回',
}: {
  title: string
  subtitle?: string
  onBack: () => void
  onOpenTutorial?: () => void
  backLabel?: string
}) {
  return (
    <div
      className="sticky top-0 z-30 shrink-0 border-b border-gray-200/60"
      style={{
        background: ARCHIVE_BG,
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
      }}
    >
      <div className="flex items-center gap-1 px-3 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50"
          aria-label={backLabel}
        >
          <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
        </Pressable>

        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[17px] font-semibold tracking-tight text-gray-900">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-gray-400">
              <ListenNumericText text={subtitle} />
            </p>
          ) : title === '记忆档案馆' ? (
            <p className="mt-0.5 truncate text-[11px] text-gray-400">微信长期记忆管理</p>
          ) : null}
        </div>

        {onOpenTutorial ? (
          <MemoryTutorialButton compact onClick={onOpenTutorial} coachTarget="hub-tutorial" />
        ) : (
          <div className="h-10 w-10 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  )
}

export function MemoryManagementApp({
  contacts,
  playerIdentityId,
  playerDisplayName,
  currentWechatAccountId,
  apiConfig,
  onBack,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string | null
  playerDisplayName: string
  currentWechatAccountId?: string
  apiConfig?: import('../../api/types').ApiConfig | null
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<MemoryArchiveTabId>('memories')
  const [retryCount, setRetryCount] = useState(0)
  const [hubTutorialOpen, setHubTutorialOpen] = useState(false)
  const [hubCoachOpen, setHubCoachOpen] = useState(false)
  const [hubCoachStepIndex, setHubCoachStepIndex] = useState(0)
  const [characterPage, setCharacterPage] = useState<MemoryCharacterPageMeta | null>(null)
  const [epilogueCharacterPage, setEpilogueCharacterPage] = useState<MemoryCharacterPageMeta | null>(null)

  const pid = playerIdentityId?.trim() ?? ''
  const onCharacterPage =
    (activeTab === 'epilogue' && epilogueCharacterPage != null) ||
    (activeTab === 'memories' && characterPage != null)
  const hubCoachActive = !onCharacterPage
  const configCoachActive = activeTab === 'config' && hubCoachActive
  const archiveCoachActive = activeTab === 'memories' && hubCoachActive
  const progressCoachActive = activeTab === 'progress' && hubCoachActive
  const retryCoachActive = activeTab === 'retry' && hubCoachActive
  const epilogueCoachActive = activeTab === 'epilogue' && !epilogueCharacterPage

  const startHubCoach = useCallback(() => {
    setHubCoachStepIndex(0)
    setHubCoachOpen(true)
  }, [])

  const finishHubCoach = useCallback(
    (opts?: { openTutorial?: boolean }) => {
      writeMemoryCoachSeen(MEMORY_HUB_COACH_SEEN_KEY)
      setHubCoachOpen(false)
      setHubCoachStepIndex(0)
      if (opts?.openTutorial) {
        setHubTutorialOpen(true)
        return
      }
      window.setTimeout(() => dispatchMemoryTabCoachForHubTab(activeTab), 420)
    },
    [activeTab],
  )

  const handleTopBack = useCallback(() => {
    if (activeTab === 'epilogue' && epilogueCharacterPage) {
      setEpilogueCharacterPage(null)
      return
    }
    if (characterPage) {
      setCharacterPage(null)
      return
    }
    onBack()
  }, [activeTab, characterPage, epilogueCharacterPage, onBack])

  const topTitle = (() => {
    if (activeTab === 'epilogue' && epilogueCharacterPage) {
      return `${epilogueCharacterPage.displayName}的尾声延展`
    }
    if (activeTab === 'memories' && characterPage) {
      return `${characterPage.displayName}的角色总结`
    }
    return '记忆档案馆'
  })()

  const reloadRetryCount = useCallback(async () => {
    const list = await personaDb.listMemorySummaryRetries()
    setRetryCount(list.length)
  }, [])

  useEffect(() => {
    void reloadRetryCount()
    const onStorage = () => void reloadRetryCount()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [reloadRetryCount])

  useEffect(() => {
    const onResult = (e: Event) => {
      const ce = e as CustomEvent<{ ok?: boolean }>
      if (ce.detail?.ok) return
      void reloadRetryCount()
      setActiveTab('retry')
    }
    window.addEventListener('wechat-memory-summary-result', onResult as EventListener)
    return () => window.removeEventListener('wechat-memory-summary-result', onResult as EventListener)
  }, [reloadRetryCount])

  useEffect(() => {
    if (!hubCoachActive) {
      setHubCoachOpen(false)
      setHubCoachStepIndex(0)
      return
    }
    if (readMemoryCoachSeen(MEMORY_HUB_COACH_SEEN_KEY)) return
    const id = window.setTimeout(() => startHubCoach(), 640)
    return () => window.clearTimeout(id)
  }, [hubCoachActive, startHubCoach])

  useEffect(() => {
    const onStart = () => startHubCoach()
    window.addEventListener(MEMORY_HUB_START_COACH_EVENT, onStart)
    return () => window.removeEventListener(MEMORY_HUB_START_COACH_EVENT, onStart)
  }, [startHubCoach])

  return (
    <div
      data-memory-coach-root="memory-management"
      className="flex h-full min-h-0 flex-col overflow-hidden text-gray-900"
      style={{ background: ARCHIVE_BG }}
    >
      <TopBar
        title={topTitle}
        onBack={handleTopBack}
        backLabel={onCharacterPage ? '返回浏览' : '返回'}
        onOpenTutorial={hubCoachActive ? () => setHubTutorialOpen(true) : undefined}
      />

      {hubCoachActive ? (
        <MemoryTutorialModal
          open={hubTutorialOpen}
          onClose={() => setHubTutorialOpen(false)}
          title="记忆档案馆 · 五个标签"
          subtitle="先认入口，再进各页细看"
          sections={MEMORY_HUB_TUTORIAL_SECTIONS}
          onStartLiveCoach={() => {
            setHubTutorialOpen(false)
            window.setTimeout(() => startHubCoach(), 280)
          }}
          zIndex={52000}
        />
      ) : null}

      <MemoryCoachPortal
        open={hubCoachOpen && hubCoachActive}
        steps={MEMORY_HUB_COACH_STEPS}
        stepIndex={hubCoachStepIndex}
        onStepChange={setHubCoachStepIndex}
        onSkip={() => finishHubCoach()}
        onComplete={(opts) => finishHubCoach(opts)}
        scopeRoot="memory-management"
        layoutEpoch={activeTab}
        zIndex={57000}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!onCharacterPage ? (
          <div className="shrink-0 px-4 pb-2 pt-1.5" style={{ background: ARCHIVE_BG }}>
            <nav
              className="mx-auto flex max-w-xl gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-[0_4px_20px_rgba(0,0,0,0.03)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="记忆档案馆分区"
            >
              {MEMORY_ARCHIVE_TABS.map((tab) => {
                const active = activeTab === tab.id
                const showRetryBadge = tab.id === 'retry' && retryCount > 0
                return (
                  <Pressable
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-memory-coach={`hub-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-gray-900 text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                    {showRetryBadge ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-700 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                        {retryCount > 9 ? '9+' : retryCount}
                      </span>
                    ) : null}
                  </Pressable>
                )
              })}
            </nav>
          </div>
        ) : null}
        <div
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            activeTab === 'config' && !onCharacterPage ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'config' || onCharacterPage}
        >
          <MemoryEngineConfig
            currentWechatAccountId={currentWechatAccountId}
            coachActive={configCoachActive}
          />
        </div>
        <div
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            activeTab === 'progress' && !onCharacterPage ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'progress' || onCharacterPage}
        >
          <MemorySummaryProgressPanel
            contacts={contacts}
            currentWechatAccountId={currentWechatAccountId}
            playerIdentityId={playerIdentityId}
            coachActive={progressCoachActive}
          />
        </div>
        <div
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            activeTab === 'retry' && !onCharacterPage ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'retry' || onCharacterPage}
        >
          <MemorySummaryRetryPanel coachActive={retryCoachActive} />
        </div>
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            activeTab === 'epilogue' ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'epilogue'}
        >
          <MemoryEpiloguePanel
            contacts={contacts}
            apiConfig={apiConfig ?? null}
            currentWechatAccountId={currentWechatAccountId}
            activeCharacterPageId={epilogueCharacterPage?.charId ?? null}
            onCharacterPageChange={setEpilogueCharacterPage}
            coachActive={epilogueCoachActive}
          />
        </div>
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            activeTab === 'memories' ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'memories'}
        >
          <MemoryDashboard
            contacts={contacts}
            playerIdentityId={pid || '__none__'}
            playerDisplayName={playerDisplayName.trim() || '我'}
            currentWechatAccountId={currentWechatAccountId}
            apiConfig={apiConfig ?? null}
            activeCharacterPageId={characterPage?.charId ?? null}
            onCharacterPageChange={setCharacterPage}
            coachActive={archiveCoachActive}
          />
        </div>
      </div>
    </div>
  )
}
