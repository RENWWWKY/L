import { Megaphone } from 'lucide-react'
import {
  OFFICIAL_QQ_GROUP_JOIN_HINT,
  OFFICIAL_QQ_GROUP_NUMBER,
} from '../../userSystem/officialCommunity'
import { AccountNum } from '../../userSystem/AccountNum'
import type { userAccountThemeTokens } from '../../userSystem/userAccountTheme'

type ThemeTokens = ReturnType<typeof userAccountThemeTokens>

type Props = {
  t: ThemeTokens
}

export function UserAccountAnnouncementPanel({ t }: Props) {
  return (
    <div className="space-y-4">
      <div className={`rounded-[16px] border p-4 ${t.card}`}>
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-[#4F46E5]" strokeWidth={1.75} />
          <h2 className="text-[16px] font-semibold">公告</h2>
        </div>

        <div className={`mt-4 space-y-4 text-[14px] leading-7 ${t.muted}`}>
          <p className={`rounded-[12px] border px-3 py-3 font-medium text-[#B91C1C] ${t.statusRejected}`}>
            请勿购买或传播任何声称可提供 Lumi 访问权限的倒卖链接。本项目始终免费，此类收费与项目作者无关。
          </p>
          <p>
            请妥善保管自己的账号与密码，勿向他人泄露或交由代登录，避免账号被盗用。
          </p>
          <p>
            若发现有人倒卖 Lumi 访问链接，可在此账号中心提交举报，或前往官方 QQ 群反馈。
          </p>
        </div>
      </div>

      <div className={`rounded-[16px] border p-4 ${t.card}`}>
        <h3 className="text-[15px] font-semibold">官方答疑 QQ 群</h3>
        <p className={`mt-2 text-[13px] leading-6 ${t.muted}`}>
          如有使用疑问，或要反馈倒卖链接线索，请加入官方 QQ 群。
        </p>
        <div className={`mt-4 rounded-[14px] border px-4 py-4 text-center ${t.claimBox}`}>
          <p className={`text-[12px] ${t.subtitle}`}>群号</p>
          <AccountNum className="mt-1 block text-[22px] tracking-wide text-[#4F46E5]">{OFFICIAL_QQ_GROUP_NUMBER}</AccountNum>
          <p className={`mt-2 text-[12px] leading-5 ${t.claimHint}`}>{OFFICIAL_QQ_GROUP_JOIN_HINT}</p>
        </div>
      </div>
    </div>
  )
}
