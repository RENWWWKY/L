import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../newFriendsPersona/idb'
import { MemoryDashboard } from './MemoryDashboard'

const COLORS = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
} as const

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div
      className="sticky top-0 z-30 shrink-0 border-b"
      style={{
        borderColor: COLORS.border,
        background: COLORS.card,
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-[#f5f5f5]"
          aria-label="返回"
        >
          <ArrowLeft className="size-5" color={COLORS.text} strokeWidth={1.75} />
        </Pressable>
        <p className="flex-1 text-center text-[18px] font-bold" style={{ color: COLORS.text }}>
          {title}
        </p>
        <div className="h-10 w-10 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

export function MemoryManagementApp({
  contacts,
  playerIdentityId,
  playerDisplayName,
  playerAvatarUrl,
  onBack,
}: {
  /** 与微信通讯录 `WeChatContactsInstagram` 相同的合并列表（人设同步联系人等） */
  contacts: WeChatContactRow[]
  playerIdentityId: string | null
  playerDisplayName: string
  playerAvatarUrl?: string
  onBack: () => void
}) {
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(true)
  const [intervalN, setIntervalN] = useState(10)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const settings = await personaDb.getMemorySettings()
      setAutoSummaryEnabled(settings.autoSummaryEnabled !== false)
      setIntervalN(settings.autoSummaryInterval)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onEvt = () => {
      void reload({ silent: true })
    }
    window.addEventListener('wechat-storage-changed', onEvt)
    return () => window.removeEventListener('wechat-storage-changed', onEvt)
  }, [reload])

  const commitInterval = async (raw: number) => {
    const n = Math.max(1, Math.min(100, Math.floor(Number.isFinite(raw) ? raw : 10)))
    setIntervalN(n)
    await personaDb.putMemorySettings({ autoSummaryInterval: n })
  }

  const toggleAutoSummary = async () => {
    const next = !autoSummaryEnabled
    setAutoSummaryEnabled(next)
    await personaDb.putMemorySettings({ autoSummaryEnabled: next })
  }

  const pid = playerIdentityId?.trim() ?? ''

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-neutral-950">
      <TopBar title="记忆档案馆" onBack={onBack} />
      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom,0px))' }}
      >
        <div className="shrink-0 border-b border-neutral-100 bg-neutral-50/80 px-4 pb-3 pt-2">
          <div className="mx-auto max-w-xl rounded-[12px] border border-neutral-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]" style={{ color: COLORS.text }}>
                自动总结
              </span>
              <WxSwitch on={autoSummaryEnabled} onToggle={() => void toggleAutoSummary()} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
              <span className="text-[15px]" style={{ color: COLORS.text }}>
                间隔轮数
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={intervalN}
                onChange={(e) => setIntervalN(Number(e.target.value))}
                onBlur={() => {
                  void commitInterval(intervalN)
                }}
                disabled={!autoSummaryEnabled}
                className="w-[72px] shrink-0 rounded-[8px] border px-2 py-1.5 text-center text-[15px] outline-none transition-all duration-200 ease-out focus:border-black disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: COLORS.border,
                  background: COLORS.card,
                  color: COLORS.text,
                }}
                aria-label="自动总结间隔轮数"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] w-full items-center justify-center text-[13px] text-neutral-400">
            加载中…
          </div>
        ) : (
          <MemoryDashboard
            contacts={contacts}
            playerIdentityId={pid || '__none__'}
            playerDisplayName={playerDisplayName.trim() || '我'}
            playerAvatarUrl={playerAvatarUrl}
          />
        )}
      </div>
    </div>
  )
}
