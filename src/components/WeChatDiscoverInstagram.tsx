import {
  BookOpen,
  Camera,
  ChevronRight,
  Headphones,
  MessageCircleQuestionMark,
  ScrollText,
  Store,
} from 'lucide-react'
import { SubconsciousArchivesApp } from '../phone/apps/wechat/diary/SubconsciousArchivesApp'
import type { WeChatPersonaContact } from '../phone/types'
import { useEffect, useState } from 'react'

import { AnonymousQnAApp } from './anonymousQa/AnonymousQnAApp'
import type { AnonymousQaWechatContext } from './anonymousQa/buildAnonymousQaPersonaContext'
import type { MockContact } from './anonymousQa/types'
import { DiscoverListenTogetherApp } from './discoverListen/DiscoverListenTogetherApp'
import { LISTEN_TOGETHER_NAVIGATE_EVENT } from './discoverListen/listenTogetherNavigation'
import { LISTEN_TOGETHER_SHARE_TO_MOMENTS_EVENT } from './discoverListen/listenTogetherMomentShareNavigation'
import { JubenshaHallApp } from './jubensha'
import { useMomentsInteractionUnreadCount } from './moments/MomentsNoticeRuntime'
import { MomentsSerifNumericText } from './moments/ArchiveTimelineDateColumn'
import type { OnOpenMomentParticipantProfile } from './moments/momentProfileNavigation'
import { WeChatMomentsPage } from './moments/WeChatMomentsPage'
import { mockContactsToMomentRefs } from './moments/publishMomentUtils'

type DiscoverActionId =
  | 'moments'
  | 'anonymous-qa'
  | 'listen-together'
  | 'subconscious-archives'
  | 'jubensha'
  | 'shop'

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
  /** 剧本杀馆：微信人脉通讯录 */
  personaContacts?: WeChatPersonaContact[]
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
  restoreView?: 'moments' | null
  onRestoreViewConsumed?: () => void
  className?: string
}

const DISCOVER_ACTIONS: DiscoverAction[] = [
  { id: 'moments', label: '朋友圈', icon: Camera },
  { id: 'listen-together', label: '听一听', icon: Headphones },
  { id: 'anonymous-qa', label: '匿问我答', icon: MessageCircleQuestionMark },
  { id: 'subconscious-archives', label: '私语档案', icon: ScrollText },
  { id: 'jubensha', label: '剧本杀馆', icon: BookOpen },
  { id: 'shop', label: '小店', icon: Store },
]

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
  personaContacts = [],
  onOpenParticipantProfile,
  restoreView = null,
  onRestoreViewConsumed,
  className = '',
}: WeChatDiscoverInstagramProps) {
  const momentsDisplayName = wechatNickname?.trim() || currentUserName?.trim() || '我'
  const momentContacts = mockContactsToMomentRefs(qnaContacts ?? [])
  const momentsUnreadCount = useMomentsInteractionUnreadCount()
  const [activeView, setActiveView] = useState<
    'list' | 'moments' | 'listen-together' | 'anonymous-qa' | 'subconscious-archives' | 'jubensha'
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
    const onShareToMoments = () => setActiveView('moments')
    window.addEventListener(LISTEN_TOGETHER_SHARE_TO_MOMENTS_EVENT, onShareToMoments)
    return () => window.removeEventListener(LISTEN_TOGETHER_SHARE_TO_MOMENTS_EVENT, onShareToMoments)
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
  if (activeView === 'subconscious-archives') {
    return (
      <SubconsciousArchivesApp
        className={`h-full min-h-0 ${className}`}
        onBack={() => setActiveView('list')}
        contacts={qnaContacts}
        wechatCtx={qnaWechatCtx}
      />
    )
  }
  if (activeView === 'jubensha') {
    return (
      <div className={`h-full min-h-0 ${className}`}>
        <JubenshaHallApp
          onBack={() => setActiveView('list')}
          currentUserName={momentsDisplayName}
          personaContacts={personaContacts}
        />
      </div>
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
                      if (item.id === 'subconscious-archives') setActiveView('subconscious-archives')
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
