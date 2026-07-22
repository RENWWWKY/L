import { useCallback, useEffect, useState } from 'react'
import { accountNumStyle } from '../../userSystem/AccountNum'
import { DISCORD_SNOWFLAKE_HINT, isDiscordSnowflakeId } from '../../userSystem/discordId'
import { updateUserProfile } from '../../userSystem/userSystemApi'
import type { UserProfile } from '../../userSystem/types'
import type { userAccountThemeTokens } from '../../userSystem/userAccountTheme'

type ThemeTokens = ReturnType<typeof userAccountThemeTokens>

type Props = {
  t: ThemeTokens
  inputCls: string
  dividerCls: string
  profile: UserProfile
  defaultOpen?: boolean
  onInfo: (message: string) => void
  onError: (message: string) => void
  onUpdated: (profile: UserProfile) => void
}

const inputStyle = {
  fontFamily: accountNumStyle.fontFamily,
  fontVariantNumeric: accountNumStyle.fontVariantNumeric,
} as const

export function UserAccountFixDiscordIdPanel({
  t,
  inputCls,
  dividerCls,
  profile,
  defaultOpen = false,
  onInfo,
  onError,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [dcId, setDcId] = useState(profile.dcId || '')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setDcId(profile.dcId || '')
  }, [profile.dcId])

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev)
    setLocalError('')
  }, [])

  const handleSubmit = useCallback(async () => {
    setLocalError('')
    onError('')
    const next = dcId.trim()
    if (!next) {
      setLocalError('请填写 Discord 数字 ID')
      return
    }
    if (!isDiscordSnowflakeId(next)) {
      setLocalError(DISCORD_SNOWFLAKE_HINT)
      return
    }
    if (next === (profile.dcId || '').trim()) {
      setLocalError('请填写与当前不同的正确数字 ID')
      return
    }

    setSubmitting(true)
    try {
      const r = await updateUserProfile({ dcId: next, qq: profile.qq })
      if (!r.ok) {
        setLocalError(r.error)
        return
      }
      onUpdated(r.profile)
      onInfo(
        r.profile.communityVerified
          ? 'Discord 数字 ID 已更新，社区身份组验证通过'
          : 'Discord 数字 ID 已更新，请返回主页重新验证身份组',
      )
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }, [dcId, profile.dcId, profile.qq, onError, onInfo, onUpdated])

  return (
    <div className={`rounded-[16px] border p-4 ${t.card}`}>
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={handleToggle}>
        <div>
          <p className="text-[14px] font-medium">修正 Discord 数字 ID</p>
          <p className={`mt-1 text-[12px] leading-5 ${t.muted}`}>
            账密注册时若误填了用户名，可在此改成正确的数字 ID（不影响密码）
          </p>
        </div>
        <span className={`text-[12px] ${t.subtitle}`}>{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <div className={`mt-4 space-y-3 border-t pt-4 ${dividerCls}`}>
          <p className={`text-[12px] leading-5 ${t.muted}`}>{DISCORD_SNOWFLAKE_HINT}</p>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>当前 Discord ID</span>
            <p className={`rounded-[10px] border px-3 py-2 text-[13px] ${t.input}`}>{profile.dcId || '（空）'}</p>
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>正确的 Discord 数字 ID</span>
            <input
              className={inputCls}
              style={inputStyle}
              value={dcId}
              onChange={(e) => setDcId(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="例如 123456789012345678"
            />
          </label>
          {localError ? (
            <p className={`rounded-[10px] px-3 py-2 text-[13px] ${t.statusRejected}`}>{localError}</p>
          ) : null}
          <button
            type="button"
            className={`h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '保存中…' : '保存并重新校验身份组'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
