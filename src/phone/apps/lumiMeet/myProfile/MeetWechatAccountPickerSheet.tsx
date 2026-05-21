import { Check, ChevronRight } from 'lucide-react'
import { Pressable } from '../../../components/Pressable'
import type { MeetWechatAccountOption } from '../meetWechatAccountPool'
import { MeetCenteredPickerDialog } from './MeetCenteredPickerDialog'

type Props = {
  open: boolean
  accounts: MeetWechatAccountOption[]
  selectedWechatId: string
  onClose: () => void
  onSelect: (account: MeetWechatAccountOption) => void
  onOpenWeChatRegistration?: () => void
}

export function MeetWechatAccountPickerSheet({
  open,
  accounts,
  selectedWechatId,
  onClose,
  onSelect,
  onOpenWeChatRegistration,
}: Props) {
  const selected = selectedWechatId.trim()

  return (
    <MeetCenteredPickerDialog open={open} caption="WeChat Account" title="选择微信账号" onClose={onClose}>
      <p className="px-1 text-[11px] font-light leading-relaxed text-[#9a9590]">
        绑定主微信已注册账号，用于交换微信号展示。切换账号后，下方玩家身份列表会<strong className="font-normal text-[#6e6860]">仅显示该账号下的身份</strong>。
      </p>

      {accounts.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[#e8e4dc] bg-[#faf9f7] px-4 py-8 text-center">
          <p className="text-[13px] text-[#6e6860]">尚未在微信完成身份注册</p>
          <p className="mt-2 text-[11px] font-light text-[#9a9590]">请先到主微信创建账号，再回到此处绑定。</p>
          {onOpenWeChatRegistration ? (
            <Pressable
              type="button"
              onClick={() => {
                onOpenWeChatRegistration()
                onClose()
              }}
              className="mt-5 inline-flex rounded-full border border-[#1C1C1E] bg-[#1C1C1E] px-5 py-2.5 text-[11px] tracking-[0.08em] text-white"
            >
              前往微信注册
            </Pressable>
          ) : null}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {accounts.map((account) => {
            const active = account.wechatId === selected
            return (
              <li key={account.key}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(account)
                    onClose()
                  }}
                  className={`flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-[#D4AF37] bg-[#fffdf8]'
                      : 'border-[#ebe7e0] bg-white hover:border-[#e0dcd4] hover:bg-[#faf9f7]'
                  }`}
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-full border border-[#ebe7e0] bg-[#f5f5f5]">
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt="" className="size-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#1a1918]">
                      {account.nickname}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[12px] tracking-[0.04em] text-[#9a9590]">
                      {account.wechatId}
                    </span>
                  </span>
                  {active ? (
                    <Check className="size-5 shrink-0 text-[#D4AF37]" strokeWidth={2} />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-[#c8c3ba]" strokeWidth={1.5} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </MeetCenteredPickerDialog>
  )
}
