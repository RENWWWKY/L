import {
  BookOpen,
  Camera,
  ChevronRight,
  Construction,
  Headphones,
  MessageCircleQuestionMark,
  Store,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { AnonymousQnAApp } from './anonymousQa/AnonymousQnAApp'
import type { AnonymousQaWechatContext } from './anonymousQa/buildAnonymousQaPersonaContext'
import type { MockContact } from './anonymousQa/types'
import { DiscoverListenTogetherApp } from './discoverListen/DiscoverListenTogetherApp'
import { LISTEN_TOGETHER_UNDER_DEV } from './discoverListen/listenTogetherConstants'
import { ListenTogetherUnderDev } from './discoverListen/ListenTogetherUnderDev'
import { LISTEN_TOGETHER_NAVIGATE_EVENT } from './discoverListen/listenTogetherNavigation'
import { useMomentsInteractionUnreadCount } from './moments/MomentsNoticeRuntime'
import { MomentsSerifNumericText } from './moments/ArchiveTimelineDateColumn'
import type { OnOpenMomentParticipantProfile } from './moments/momentProfileNavigation'
import { WeChatMomentsPage } from './moments/WeChatMomentsPage'
import { mockContactsToMomentRefs } from './moments/publishMomentUtils'

type DiscoverActionId = 'moments' | 'anonymous-qa' | 'listen-together' | 'shop' | 'jubensha'

type DiscoverAction = {
  id: DiscoverActionId
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

export type WeChatDiscoverInstagramProps = {
  onActionClick?: (id: DiscoverActionId) => void
  onImmersiveViewChange?: (open: boolean) => void
  /** 当前微信账号昵称（朋友圈封面、互动展示） */
  wechatNickname?: string
  /** 当前微信账号头像 */
  wechatAvatarUrl?: string
  /** 朋友圈封面（空则默认图） */
  momentsCoverUrl?: string
  onMomentsCoverChange?: (url: string) => void | Promise<void>
  /** @deprecated 请用 wechatNickname；保留供匿问我答等复用 */
  currentUserName?: string
  /** 匿问我答：真实通讯录（含 self + 人脉 NPC） */
  qnaContacts?: MockContact[]
  qnaWechatCtx?: AnonymousQaWechatContext | null
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
  restoreView?: 'moments' | null
  onRestoreViewConsumed?: () => void
  className?: string
}

const DISCOVER_ACTIONS: DiscoverAction[] = [
  { id: 'moments', label: '朋友圈', icon: Camera },
  { id: 'listen-together', label: '听一听', icon: Headphones },
  { id: 'anonymous-qa', label: '匿问我答', icon: MessageCircleQuestionMark },
  { id: 'jubensha', label: '剧本杀馆', icon: BookOpen },
  { id: 'shop', label: '小店', icon: Store },
]

/** 发现页子功能开发中占位 */
function DiscoverFeatureUnderDev({
  title,
  hint,
  onBack,
  className = '',
}: {
  title: string
  hint: string
  onBack: () => void
  className?: string
}) {
  return (
    <div className={`flex h-full min-h-0 flex-col bg-[#f5f5f5] ${className}`}>
      <header
        className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[18px] font-bold text-black">{title}</h1>
        <div className="w-10 shrink-0" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <div className="w-full max-w-[320px] rounded-[12px] border border-[#e5e5e5] bg-white px-6 py-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fafafa] text-[#8e8e8e]">
            <Construction className="size-7" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="mt-5 text-[17px] font-semibold text-[#262626]">功能开发中</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8e8e8e]">{hint}</p>
          <p className="mt-4 text-[13px] text-[#b0b0b0]">敬请期待</p>
        </div>
      </div>
    </div>
  )
}

export function WeChatDiscoverInstagram({
  onActionClick,
  onImmersiveViewChange,
  wechatNickname,
  wechatAvatarUrl,
  momentsCoverUrl,
  onMomentsCoverChange,
  currentUserName,
  qnaContacts,
  qnaWechatCtx = null,
  onOpenParticipantProfile,
  restoreView = null,
  onRestoreViewConsumed,
  className = '',
}: WeChatDiscoverInstagramProps) {
  const momentsDisplayName = wechatNickname?.trim() || currentUserName?.trim() || '我'
  const momentContacts = mockContactsToMomentRefs(qnaContacts ?? [])
  const momentsUnreadCount = useMomentsInteractionUnreadCount()
  const [activeView, setActiveView] = useState<
    'list' | 'moments' | 'listen-together' | 'anonymous-qa' | 'jubensha'
  >('list')
  useEffect(() => {
    onImmersiveViewChange?.(activeView !== 'list')
  }, [activeView, onImmersiveViewChange])

  useEffect(() => {
    return () => onImmersiveViewChange?.(false)
  }, [onImmersiveViewChange])

  useEffect(() => {
    const onNavigate = () => setActiveView('listen-together')
    window.addEventListener(LISTEN_TOGETHER_NAVIGATE_EVENT, onNavigate)
    return () => window.removeEventListener(LISTEN_TOGETHER_NAVIGATE_EVENT, onNavigate)
  }, [])
  useEffect(() => {
    if (restoreView !== 'moments') return
    setActiveView('moments')
    onRestoreViewConsumed?.()
  }, [onRestoreViewConsumed, restoreView])

  if (activeView === 'moments') {
    return (
      <div className={`h-full min-h-0 ${className}`}>
        <WeChatMomentsPage
          onBack={() => setActiveView('list')}
          wechatNickname={momentsDisplayName}
          wechatAvatarUrl={wechatAvatarUrl}
          momentsCoverUrl={momentsCoverUrl}
          onMomentsCoverChange={onMomentsCoverChange}
          momentContacts={momentContacts}
          currentUserName={momentsDisplayName}
          qnaWechatCtx={qnaWechatCtx}
          onOpenParticipantProfile={onOpenParticipantProfile}
        />
      </div>
    )
  }
  if (activeView === 'listen-together') {
    if (LISTEN_TOGETHER_UNDER_DEV) {
      return (
        <ListenTogetherUnderDev
          className={`h-full min-h-0 ${className}`}
          onBack={() => setActiveView('list')}
        />
      )
    }
    return (
      <DiscoverListenTogetherApp
        className={`h-full min-h-0 ${className}`}
        onBack={() => setActiveView('list')}
      />
    )
  }
  if (activeView === 'anonymous-qa') {
    return (
      <div className={`h-full min-h-0 ${className}`}>
        <AnonymousQnAApp
          onBack={() => setActiveView('list')}
          currentUserName={currentUserName ?? momentsDisplayName}
          contacts={qnaContacts}
          wechatCtx={qnaWechatCtx}
        />
      </div>
    )
  }
  if (activeView === 'jubensha') {
    return (
      <DiscoverFeatureUnderDev
        className={className}
        title="剧本杀馆"
        hint="沉浸式剧本杀玩法正在开发，典藏书架、选角与对局流程将在此接入。"
        onBack={() => setActiveView('list')}
      />
    )
  }
  return (
    <div
      className={`h-full min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <div className="mx-auto max-w-[560px] px-4 pb-8 pt-4">
        <section
          className="overflow-hidden rounded-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          aria-label="发现核心功能"
        >
          <ul className="divide-y divide-[#dbdbdb]">
            {DISCOVER_ACTIONS.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onActionClick?.(item.id)
                      if (item.id === 'moments') setActiveView('moments')
                      if (item.id === 'listen-together') setActiveView('listen-together')
                      if (item.id === 'anonymous-qa') setActiveView('anonymous-qa')
                      if (item.id === 'jubensha') setActiveView('jubensha')
                    }}
                    className="flex w-full items-center px-4 py-4 text-left transition-colors duration-200 hover:bg-[#fafafa]"
                  >
                    <Icon className="size-5 text-[#262626]" strokeWidth={1.75} aria-hidden />
                    <span className="ml-3 text-[16px] font-normal text-[#262626]">{item.label}</span>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {item.id === 'moments' && momentsUnreadCount > 0 ? (
                        <span
                          className="flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-semibold leading-none tabular-nums text-white"
                          style={{ background: '#fa5151' }}
                          aria-label={`${momentsUnreadCount} 条未读互动消息`}
                        >
                          <MomentsSerifNumericText
                            text={momentsUnreadCount > 99 ? '99+' : String(momentsUnreadCount)}
                          />
                        </span>
                      ) : null}
                      <ChevronRight className="size-4 text-[#8e8e8e]" strokeWidth={1.75} aria-hidden />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default WeChatDiscoverInstagram
