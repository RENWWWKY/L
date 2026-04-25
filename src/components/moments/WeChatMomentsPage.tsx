import { useEffect, useRef, useState } from 'react'

import { DynamicHeader } from './DynamicHeader'
import { MomentsFeed } from './MomentsFeed'
import { MomentsCover } from './MomentsCover'
import { mockMoments, momentsCoverImage } from './mockMoments'

type WeChatMomentsPageProps = {
  onBack?: () => void
  goToPublish?: () => void
  currentUserName?: string
}

export function WeChatMomentsPage({ onBack, goToPublish, currentUserName = '我' }: WeChatMomentsPageProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const coverWrapRef = useRef<HTMLDivElement | null>(null)
  const [headerOpacity, setHeaderOpacity] = useState(0)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const syncHeaderOpacity = () => {
      const coverHeight = coverWrapRef.current?.offsetHeight ?? 260
      // 在封面将被列表内容覆盖前开始出现，并在短区间内平滑到 1。
      const fadeStart = Math.max(48, coverHeight - 180)
      const fadeEnd = Math.max(fadeStart + 1, coverHeight - 104)
      const y = el.scrollTop
      if (y <= fadeStart) {
        setHeaderOpacity(0)
        return
      }
      if (y >= fadeEnd) {
        setHeaderOpacity(1)
        return
      }
      const progress = (y - fadeStart) / (fadeEnd - fadeStart)
      setHeaderOpacity(Math.max(0, Math.min(1, progress)))
    }
    el.addEventListener('scroll', syncHeaderOpacity, { passive: true })
    window.addEventListener('resize', syncHeaderOpacity)
    syncHeaderOpacity()
    return () => {
      el.removeEventListener('scroll', syncHeaderOpacity)
      window.removeEventListener('resize', syncHeaderOpacity)
    }
  }, [])

  return (
    <div ref={scrollerRef} className="relative h-full min-h-0 overflow-y-auto bg-[#FAFAFA] text-[#111827] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <DynamicHeader opacity={headerOpacity} onBack={onBack} goToPublish={goToPublish} />
      <div className="mx-auto max-w-[560px] pb-8">
        <div ref={coverWrapRef}>
          <MomentsCover
            coverUrl={momentsCoverImage}
            nickname="Lumi"
            avatarUrl="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80"
          />
        </div>
        <MomentsFeed moments={mockMoments} currentUserName={currentUserName} />
      </div>
    </div>
  )
}
