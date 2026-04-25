import { Gift } from 'lucide-react'

import { Pressable } from '../../components/Pressable'
import { toMoneyText } from './redPacketUtils'

export function WeChatRedPacketBubble({
  isSelf,
  remark,
  amount,
  opened,
  onClick,
}: {
  isSelf: boolean
  remark: string
  amount: number
  opened: boolean
  onClick?: () => void
}) {
  return (
    <Pressable
      type="button"
      onClick={onClick}
      className={`w-[220px] rounded-2xl px-3 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
        opened
          ? 'border border-[#dfdfdf] bg-[#f2f2f2]'
          : isSelf
            ? 'bg-gradient-to-br from-[#b3532a] to-[#d0844d]'
            : 'bg-gradient-to-br from-[#8b3f24] to-[#b3663a]'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${opened ? 'bg-[#e4e4e4]' : 'bg-[#f0c987]'}`}>
          <Gift size={17} className={opened ? 'text-[#8f8f8f]' : 'text-[#6f3712]'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] ${opened ? 'text-[#7d7d7d]' : 'text-[#fff4e9]'}`}>{remark || '恭喜发财，大吉大利'}</p>
          <p className={`mt-0.5 text-[11px] ${opened ? 'text-[#9b9b9b]' : 'text-[#ffe2c2]'}`}>
            {opened ? `已领取 ￥${toMoneyText(amount)}` : '微信红包'}
          </p>
        </div>
      </div>
    </Pressable>
  )
}
