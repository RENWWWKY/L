import type { ReactNode } from 'react'
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  Clock,
  HardDrive,
  MessageCircle,
  Palette,
  Shield,
  UserCircle,
  Users,
} from 'lucide-react'

import { Pressable } from '../../../components/Pressable'

export type WeChatGlobalSettingsNav =
  | { screen: 'root' }
  | { screen: 'danmaku' }
  | { screen: 'notify' }
  | { screen: 'busy' }
  | { screen: 'time' }
  | { screen: 'stub'; title: string }

type RowDef = {
  id: string
  label: string
  icon: ReactNode
  nav: WeChatGlobalSettingsNav | 'theme' | 'switch-account'
}

const ROWS: RowDef[] = [
  { id: 'security', label: '账号安全', icon: <Shield className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'stub', title: '账号安全' } },
  { id: 'notify', label: '通知', icon: <Bell className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'notify' } },
  { id: 'friends', label: '朋友权限', icon: <Users className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'stub', title: '朋友权限' } },
  { id: 'storage', label: '存储空间', icon: <HardDrive className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'stub', title: '存储空间' } },
  { id: 'time', label: '时间同步', icon: <Clock className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'time' } },
  { id: 'busy', label: '忙碌设置', icon: <BriefcaseBusiness className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'busy' } },
  { id: 'danmaku', label: '弹幕配置', icon: <MessageCircle className="size-5 text-black" strokeWidth={1.75} />, nav: { screen: 'danmaku' } },
  { id: 'theme', label: '主题配置', icon: <Palette className="size-5 text-black" strokeWidth={1.75} />, nav: 'theme' },
  { id: 'account', label: '切换账号', icon: <UserCircle className="size-5 text-black" strokeWidth={1.75} />, nav: 'switch-account' },
]

export function WeChatGlobalSettingsScreen({
  onBack,
  onNavigate,
  onOpenTheme,
  onSwitchAccount,
}: {
  onBack: () => void
  onNavigate: (nav: WeChatGlobalSettingsNav) => void
  onOpenTheme: () => void
  onSwitchAccount: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f5f5]">
      <header
        className="flex shrink-0 items-center border-b border-[#e5e5e5] bg-[#f5f5f5] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Pressable>
        <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">设置</h1>
        <div className="w-10 shrink-0" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
          {ROWS.map((row) => (
            <Pressable
              key={row.id}
              type="button"
              onClick={() => {
                if (row.nav === 'theme') {
                  onOpenTheme()
                  return
                }
                if (row.nav === 'switch-account') {
                  onSwitchAccount()
                  return
                }
                onNavigate(row.nav)
              }}
              className="flex w-full items-center gap-3 rounded-[12px] bg-white px-4 py-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.98]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f5f5f5]">{row.icon}</span>
              <span className="min-w-0 flex-1 text-[16px] text-black">{row.label}</span>
              <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
            </Pressable>
          ))}
        </div>
        <div className="h-6 shrink-0" style={{ minHeight: 'max(24px, env(safe-area-inset-bottom, 0px))' }} />
      </div>
    </div>
  )
}
