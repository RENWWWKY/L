import { Camera, ChevronRight, MessageCircleQuestionMark, Store } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AnonymousQnAApp } from './anonymousQa/AnonymousQnAApp'
import { WeChatMomentsPage } from './moments/WeChatMomentsPage'

type DiscoverActionId = 'moments' | 'anonymous-qa' | 'shop'

type DiscoverAction = {
  id: DiscoverActionId
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

export type WeChatDiscoverInstagramProps = {
  onActionClick?: (id: DiscoverActionId) => void
  onImmersiveViewChange?: (open: boolean) => void
  currentUserName?: string
  className?: string
}

const DISCOVER_ACTIONS: DiscoverAction[] = [
  { id: 'moments', label: '朋友圈', icon: Camera },
  { id: 'anonymous-qa', label: '匿问我答', icon: MessageCircleQuestionMark },
  { id: 'shop', label: '小店', icon: Store },
]

export function WeChatDiscoverInstagram({
  onActionClick,
  onImmersiveViewChange,
  currentUserName,
  className = '',
}: WeChatDiscoverInstagramProps) {
  const [activeView, setActiveView] = useState<'list' | 'moments' | 'anonymous-qa'>('list')
  useEffect(() => {
    onImmersiveViewChange?.(activeView !== 'list')
  }, [activeView, onImmersiveViewChange])

  useEffect(() => {
    return () => onImmersiveViewChange?.(false)
  }, [onImmersiveViewChange])
  if (activeView === 'moments') {
    return (
      <div className={`h-full min-h-0 ${className}`}>
        <WeChatMomentsPage
          onBack={() => setActiveView('list')}
          goToPublish={() => window.alert('发布朋友圈页面待接入')}
          currentUserName={currentUserName}
        />
      </div>
    )
  }
  if (activeView === 'anonymous-qa') {
    return (
      <div className={`h-full min-h-0 ${className}`}>
        <AnonymousQnAApp onBack={() => setActiveView('list')} currentUserName={currentUserName} />
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
                      if (item.id === 'anonymous-qa') setActiveView('anonymous-qa')
                    }}
                    className="flex w-full items-center px-4 py-4 text-left transition-colors duration-200 hover:bg-[#fafafa]"
                  >
                    <Icon className="size-5 text-[#262626]" strokeWidth={1.75} aria-hidden />
                    <span className="ml-3 text-[16px] font-normal text-[#262626]">{item.label}</span>
                    <ChevronRight className="ml-auto size-4 text-[#8e8e8e]" strokeWidth={1.75} aria-hidden />
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
