import { Check, ChevronRight } from 'lucide-react'
import { Pressable } from '../../../components/Pressable'
import type { PlayerIdentity } from '../../wechat/newFriendsPersona/types'
import { MeetCenteredPickerDialog } from './MeetCenteredPickerDialog'

type Props = {
  open: boolean
  identities: PlayerIdentity[]
  selectedIdentityId: string
  accountNickname?: string
  loading?: boolean
  onClose: () => void
  onSelect: (identity: PlayerIdentity) => void
  onOpenWeChatIdentityManager?: () => void
}

export function MeetPlayerIdentityPickerSheet({
  open,
  identities,
  selectedIdentityId,
  accountNickname,
  loading = false,
  onClose,
  onSelect,
  onOpenWeChatIdentityManager,
}: Props) {
  const selected = selectedIdentityId.trim()

  return (
    <MeetCenteredPickerDialog
      open={open}
      caption="Player Identity"
      title="选择玩家身份"
      onClose={onClose}
    >
      <p className="px-1 text-[11px] font-light leading-relaxed text-[#9a9590]">
        仅显示
        <strong className="font-normal text-[#6e6860]">
          {accountNickname?.trim() ? `「${accountNickname.trim()}」` : '当前所选微信账号'}
        </strong>
        下已创建的玩家身份，不会混入其它微信号的身份。
      </p>

      {loading ? (
        <p className="mt-6 text-center text-[13px] font-light text-[#9a9590]">正在拉取身份列表…</p>
      ) : identities.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[#e8e4dc] bg-[#faf9f7] px-4 py-8 text-center">
          <p className="text-[13px] text-[#6e6860]">该微信账号下尚无玩家身份</p>
          <p className="mt-2 text-[11px] font-light text-[#9a9590]">
            请先在微信「玩家身份」中为该账号创建至少一套身份。
          </p>
          {onOpenWeChatIdentityManager ? (
            <Pressable
              type="button"
              onClick={() => {
                onOpenWeChatIdentityManager()
                onClose()
              }}
              className="mt-5 inline-flex rounded-full border border-[#1C1C1E] bg-[#1C1C1E] px-5 py-2.5 text-[11px] tracking-[0.08em] text-white"
            >
              前往微信创建身份
            </Pressable>
          ) : null}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {identities.map((row) => {
            const active = row.id === selected
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(row)
                    onClose()
                  }}
                  className={`flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-[#D4AF37] bg-[#fffdf8]'
                      : 'border-[#ebe7e0] bg-white hover:border-[#e0dcd4] hover:bg-[#faf9f7]'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#1a1918]">
                      {(row.wechatNickname || row.name || '未命名').trim()}
                    </span>
                    {row.wechatId?.trim() ? (
                      <span className="mt-0.5 block truncate font-mono text-[12px] tracking-[0.04em] text-[#9a9590]">
                        {row.wechatId.trim()}
                      </span>
                    ) : null}
                    {row.identity?.trim() ? (
                      <span className="mt-1 block truncate text-[11px] font-light text-[#b8b5ad]">
                        {row.identity.trim().slice(0, 40)}
                      </span>
                    ) : null}
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
