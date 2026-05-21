import { AnimatePresence, motion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useWechatStore } from '../useWechatStore'
import type { UserAccount } from '../wechatAccountTypes'
import { SwitchAccountCeremony } from './SwitchAccountCeremony'

const SERIF =
  '"Cormorant Garamond", "Noto Serif SC", "STSong", "STKaiti", "Georgia", "Times New Roman", serif'

function accountInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t.slice(0, 1).toUpperCase()
}

function AccountAvatar({ account }: { account: UserAccount }) {
  const url = account.avatarUrl.trim()
  if (url) {
    return <img src={url} alt="" className="size-14 rounded-2xl object-cover" />
  }
  return (
    <span
      className="flex size-14 items-center justify-center rounded-2xl bg-[#F3F4F6] text-[18px] font-medium text-[#111827]"
      style={{ fontFamily: SERIF }}
    >
      {accountInitial(account.nickname)}
    </span>
  )
}

type Props = {
  onBack: () => void
  onAddAccount: () => void
  onSwitched: () => void
}

export function SwitchAccountPage({ onBack, onAddAccount, onSwitched }: Props) {
  const { accounts, currentAccountId, switchAccount } = useWechatStore()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [ceremonyOpen, setCeremonyOpen] = useState(false)
  const [ceremonyName, setCeremonyName] = useState('')
  const [hoverId, setHoverId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => b.lastActive - a.lastActive),
    [accounts],
  )

  const onPickAccount = useCallback(
    async (accountId: string) => {
      if (accountId === currentAccountId || pendingId) return
      const target = accounts.find((a) => a.accountId === accountId)
      if (!target) return
      setPendingId(accountId)
      setCeremonyName(target.nickname)
      setCeremonyOpen(true)
      try {
        await switchAccount(accountId)
      } catch {
        setCeremonyOpen(false)
        setPendingId(null)
      }
    },
    [accounts, currentAccountId, pendingId, switchAccount],
  )

  const handleCeremonyDone = useCallback(() => {
    setCeremonyOpen(false)
    setPendingId(null)
    onSwitched()
  }, [onSwitched])

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white">
      <header
        className="flex shrink-0 items-center border-b border-[#F3F4F6] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full text-[#111827] transition-colors hover:bg-[#F9FAFB]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-medium uppercase tracking-[0.36em] text-[#9CA3AF]">SWITCH ACCOUNT</p>
          <h1 className="mt-1 text-[17px] font-medium text-[#111827]">切换账号</h1>
        </div>
        <div className="size-10 shrink-0" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <p
          className="mx-auto mb-8 max-w-sm text-center text-[12px] leading-relaxed tracking-[0.06em] text-[#9CA3AF]"
          style={{ fontFamily: SERIF }}
        >
          每个马甲拥有独立的身份与私聊记录；同一角色微信号在后台共享人设与长期记忆，可通过搜索跨号添加。
        </p>

        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <AnimatePresence initial={false}>
            {sorted.map((account) => {
              const active = account.accountId === currentAccountId
              const dimmed = !active && hoverId !== account.accountId
              return (
                <motion.button
                  key={account.accountId}
                  type="button"
                  disabled={!!pendingId}
                  onClick={() => void onPickAccount(account.accountId)}
                  onMouseEnter={() => setHoverId(account.accountId)}
                  onMouseLeave={() => setHoverId((id) => (id === account.accountId ? null : id))}
                  onFocus={() => setHoverId(account.accountId)}
                  onBlur={() => setHoverId((id) => (id === account.accountId ? null : id))}
                  layout
                  className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-300 ${
                    active
                      ? 'border-[#E5E7EB] bg-white shadow-sm'
                      : 'border-[#F3F4F6] bg-[#FAFAFA]'
                  } ${dimmed ? 'opacity-60 grayscale-[20%]' : 'opacity-100 grayscale-0'}`}
                  style={{ borderWidth: '0.5px' }}
                >
                  <AccountAvatar account={account} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-[#111827]">{account.nickname}</p>
                    <p className="mt-1 truncate font-mono text-[11px] tracking-[0.08em] text-[#9CA3AF]">
                      {account.wechatId}
                    </p>
                  </div>
                  {active ? (
                    <span className="flex shrink-0 items-center gap-1 text-[#111827]">
                      <Check className="size-4" strokeWidth={2} aria-hidden />
                      <span className="hidden text-[9px] font-medium uppercase tracking-[0.2em] text-[#9CA3AF] sm:inline">
                        CURRENT
                      </span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] italic tracking-[0.12em] text-[#D1D5DB]">TAP</span>
                  )}
                </motion.button>
              )
            })}
          </AnimatePresence>

          <button
            type="button"
            onClick={onAddAccount}
            disabled={!!pendingId}
            className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D1D5DB] bg-white px-4 py-8 transition-colors hover:border-[#111827]/30 hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Plus className="size-5 text-[#9CA3AF]" strokeWidth={1.5} />
            <span className="text-[9px] font-medium uppercase tracking-[0.32em] text-[#9CA3AF]">ADD NEW IDENTITY</span>
            <span className="text-[13px] text-[#6B7280]">添加新账号</span>
          </button>
        </div>
      </div>

      <SwitchAccountCeremony open={ceremonyOpen} nickname={ceremonyName} onFinished={handleCeremonyDone} />
    </div>
  )
}
