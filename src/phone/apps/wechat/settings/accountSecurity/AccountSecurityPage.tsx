import { motion } from 'framer-motion'
import { ChevronRight, Lock, MonitorSmartphone, Shield } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { useWechatStore } from '../../useWechatStore'
import { ChangePasswordSheet } from './ChangePasswordSheet'
import { DeleteAccountModal } from './DeleteAccountModal'
import { WeChatSecurityToast } from './WeChatSecurityToast'

type Props = {
  onBack: () => void
  /** 注销成功后关闭设置栈；remainingAccounts>0 时应进入切换账号页 */
  onAccountErased?: (result: { remainingAccounts: number }) => void
}

type RowDef = {
  id: string
  labelEn: string
  labelZh: string
  icon: typeof Lock
  trailing?: string
  onPress: () => void
}

export function AccountSecurityPage({ onBack, onAccountErased }: Props) {
  const { updatePassword, deleteAccount } = useWechatStore()
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false)
  const [eraseModalOpen, setEraseModalOpen] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
  }, [])

  const rows: RowDef[] = [
    {
      id: 'password',
      labelEn: 'CHANGE PASSWORD',
      labelZh: '修改密码',
      icon: Lock,
      onPress: () => setPasswordSheetOpen(true),
    },
    {
      id: 'devices',
      labelEn: 'DEVICE MANAGEMENT',
      labelZh: '登录设备管理',
      icon: MonitorSmartphone,
      trailing: '1 Online',
      onPress: () => showToast('该权限模组暂未开放 (Device management coming soon).'),
    },
  ]

  const handleErase = useCallback(async () => {
    setErasing(true)
    const res = await deleteAccount()
    setErasing(false)
    if (!res.ok) {
      showToast('无法完成抹除，请稍后重试')
      return
    }
    setEraseModalOpen(false)
    showToast(
      res.remainingAccounts > 0
        ? '该账号已注销，请选择其他账号继续使用。'
        : '本机微信数据已彻底抹除，请重新注册。',
    )
    onAccountErased?.({ remainingAccounts: res.remainingAccounts })
  }, [deleteAccount, onAccountErased, showToast])

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col bg-[#F9FAFB] text-[#111827]"
      initial={{ x: '100%', opacity: 0.98 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
    >
      <header
        className="shrink-0 border-b border-[#E5E7EB]/80 bg-white px-3 pb-4"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center">
          <Pressable
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Pressable>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-[17px] font-medium tracking-[0.02em] text-[#111827]">账号与安全</h1>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.42em] text-[#9CA3AF]">
              SECURITY & IDENTITY
            </p>
          </div>
          <div className="size-10 shrink-0" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <motion.div
          className="mx-auto max-w-[520px] overflow-hidden rounded-2xl border border-[#E5E7EB]/60 bg-white shadow-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          {rows.map((row, i) => {
            const Icon = row.icon
            return (
              <Pressable
                key={row.id}
                type="button"
                onClick={row.onPress}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors active:bg-[#F9FAFB] ${
                  i > 0 ? 'border-t border-[#E5E7EB]/80' : ''
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB]">
                  <Icon className="size-[18px] text-[#111827]" strokeWidth={1.35} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">
                    {row.labelEn}
                  </span>
                  <span className="mt-0.5 block text-[14px] font-medium text-[#111827]">{row.labelZh}</span>
                </span>
                {row.trailing ? (
                  <span className="shrink-0 text-[11px] font-light italic text-[#9CA3AF]">{row.trailing}</span>
                ) : null}
                <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={1.5} aria-hidden />
              </Pressable>
            )
          })}
        </motion.div>

        <motion.section
          className="mx-auto mt-14 max-w-[520px] text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.4 }}
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            <Shield className="size-3.5 text-[#9CA3AF]" strokeWidth={1.25} aria-hidden />
            <p className="text-[9px] font-medium uppercase tracking-[0.32em] text-[#9CA3AF]">Danger Zone</p>
          </div>
          <button
            type="button"
            onClick={() => setEraseModalOpen(true)}
            className="text-[13px] font-medium tracking-[0.06em] text-red-900/70 transition-colors hover:text-[#111827]"
          >
            ERASE IDENTITY | 注销账号
          </button>
        </motion.section>
      </div>

      <ChangePasswordSheet
        open={passwordSheetOpen}
        onClose={() => setPasswordSheetOpen(false)}
        onSubmit={updatePassword}
        onSuccess={() => showToast('安全密钥已更新。')}
      />

      <DeleteAccountModal
        open={eraseModalOpen}
        loading={erasing}
        onCancel={() => {
          if (!erasing) setEraseModalOpen(false)
        }}
        onConfirmErase={() => void handleErase()}
      />

      <WeChatSecurityToast message={toast} onDismiss={() => setToast(null)} />
    </motion.div>
  )
}
