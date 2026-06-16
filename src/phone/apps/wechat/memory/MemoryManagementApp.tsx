import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import { Pressable } from '../../../components/Pressable'
import { MemoryDashboard } from './MemoryDashboard'
import { MemoryEngineConfig } from './MemoryEngineConfig'
import { MemorySummaryProgressPanel } from './MemorySummaryProgressPanel'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import type { MemoryCharacterPageMeta } from './memoryArchiveTypes'
import { MEMORY_ARCHIVE_TUTORIAL_SECTIONS } from './memoryArchiveTutorialCopy'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import { MemoryTutorialButton } from './MemoryTutorialButton'

const MEMORY_ARCHIVE_START_COACH_EVENT = 'memory-archive-start-coach'

function TopBar({
  title,
  subtitle,
  onBack,
  onOpenTutorial,
  onPrevCharacter,
  onNextCharacter,
  canPrevCharacter,
  canNextCharacter,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  onOpenTutorial?: () => void
  onPrevCharacter?: () => void
  onNextCharacter?: () => void
  canPrevCharacter?: boolean
  canNextCharacter?: boolean
}) {
  const showCharNav = onPrevCharacter != null && onNextCharacter != null

  return (
    <div
      className="sticky top-0 z-30 shrink-0"
      style={{
        background: '#FFFFFF',
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
        boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
      }}
    >
      <div className="flex items-center gap-1 px-3 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50"
          aria-label={showCharNav ? '返回浏览记忆' : '返回'}
        >
          <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
        </Pressable>

        {showCharNav ? (
          <Pressable
            onClick={onPrevCharacter}
            disabled={!canPrevCharacter}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-25"
            aria-label="上一位角色"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </Pressable>
        ) : null}

        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate text-[17px] font-semibold tracking-tight text-gray-900">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-gray-400">
              <ListenNumericText text={subtitle} />
            </p>
          ) : null}
        </div>

        {showCharNav ? (
          <Pressable
            onClick={onNextCharacter}
            disabled={!canNextCharacter}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-25"
            aria-label="下一位角色"
          >
            <ChevronRight className="size-5" strokeWidth={1.75} />
          </Pressable>
        ) : null}

        {onOpenTutorial ? (
          <MemoryTutorialButton onClick={onOpenTutorial} />
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
  onBack,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string | null
  playerDisplayName: string
  currentWechatAccountId?: string
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'config' | 'memories' | 'progress'>('memories')
  const [hubTutorialOpen, setHubTutorialOpen] = useState(false)
  const [characterPage, setCharacterPage] = useState<MemoryCharacterPageMeta | null>(null)
  const characterNavRef = useRef<{ prev: () => void; next: () => void } | null>(null)

  const pid = playerIdentityId?.trim() ?? ''
  const onCharacterPage = characterPage != null

  const handleTopBack = useCallback(() => {
    if (characterPage) {
      setCharacterPage(null)
      return
    }
    onBack()
  }, [characterPage, onBack])

  const topTitle = characterPage ? `${characterPage.displayName}的记忆` : '记忆档案馆'
  const topSubtitle = characterPage
    ? characterPage.rosterIndex >= 0
      ? `${characterPage.rosterIndex + 1} / ${characterPage.rosterTotal}`
      : undefined
    : undefined

  const registerCharacterNav = useCallback((nav: { prev: () => void; next: () => void } | null) => {
    characterNavRef.current = nav
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-gray-900" style={{ background: ARCHIVE_BG }}>
      <TopBar
        title={topTitle}
        subtitle={topSubtitle}
        onBack={handleTopBack}
        onOpenTutorial={
          activeTab === 'memories' && !onCharacterPage ? () => setHubTutorialOpen(true) : undefined
        }
        onPrevCharacter={onCharacterPage ? () => characterNavRef.current?.prev() : undefined}
        onNextCharacter={onCharacterPage ? () => characterNavRef.current?.next() : undefined}
        canPrevCharacter={characterPage?.canPrev}
        canNextCharacter={characterPage?.canNext}
      />

      {activeTab === 'memories' && !onCharacterPage ? (
        <MemoryTutorialModal
          open={hubTutorialOpen}
          onClose={() => setHubTutorialOpen(false)}
          title="记忆档案馆 · 怎么看"
          subtitle="列表、配置与注入规则小抄"
          sections={MEMORY_ARCHIVE_TUTORIAL_SECTIONS}
          onStartLiveCoach={() => {
            setHubTutorialOpen(false)
            window.setTimeout(() => {
              window.dispatchEvent(new CustomEvent(MEMORY_ARCHIVE_START_COACH_EVENT))
            }, 280)
          }}
          zIndex={52000}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!onCharacterPage ? (
          <div className="shrink-0 px-4 pb-2 pt-2" style={{ background: ARCHIVE_BG }}>
            <div className="mx-auto grid max-w-xl grid-cols-3 gap-1 rounded-full bg-gray-100/80 p-1">
              <Pressable
                type="button"
                role="tab"
                aria-selected={activeTab === 'config'}
                onClick={() => setActiveTab('config')}
                className={`min-h-[44px] rounded-full py-2.5 text-center text-[13px] font-semibold transition-colors ${
                  activeTab === 'config'
                    ? 'bg-white text-gray-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                配置
              </Pressable>
              <Pressable
                type="button"
                role="tab"
                aria-selected={activeTab === 'progress'}
                onClick={() => setActiveTab('progress')}
                className={`min-h-[44px] rounded-full py-2.5 text-center text-[13px] font-semibold transition-colors ${
                  activeTab === 'progress'
                    ? 'bg-white text-gray-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                进度
              </Pressable>
              <Pressable
                type="button"
                role="tab"
                aria-selected={activeTab === 'memories'}
                onClick={() => setActiveTab('memories')}
                className={`min-h-[44px] rounded-full py-2.5 text-center text-[13px] font-semibold transition-colors ${
                  activeTab === 'memories'
                    ? 'bg-white text-gray-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                记忆管理
              </Pressable>
            </div>
          </div>
        ) : null}
        <div
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            activeTab === 'config' && !onCharacterPage ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'config' || onCharacterPage}
        >
          <MemoryEngineConfig currentWechatAccountId={currentWechatAccountId} />
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
          />
        </div>
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            activeTab === 'memories' || onCharacterPage ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'memories' && !onCharacterPage}
        >
          <MemoryDashboard
            contacts={contacts}
            playerIdentityId={pid || '__none__'}
            playerDisplayName={playerDisplayName.trim() || '我'}
            currentWechatAccountId={currentWechatAccountId}
            activeCharacterPageId={characterPage?.charId ?? null}
            onCharacterPageChange={setCharacterPage}
            onRegisterCharacterNav={registerCharacterNav}
          />
        </div>
      </div>
    </div>
  )
}
