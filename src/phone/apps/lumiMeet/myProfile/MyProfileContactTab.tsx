import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Pressable } from '../../../components/Pressable'
import { personaDb } from '../../wechat/newFriendsPersona/idb'
import type { PlayerIdentity } from '../../wechat/newFriendsPersona/types'
import { isMeetContactWechatIdPlausible } from '../meetContactSettings'
import {
  findMeetWechatAccount,
  listMeetSelectableWechatAccounts,
  type MeetWechatAccountOption,
} from '../meetWechatAccountPool'
import type { MeetPublicProfile } from '../meetTypes'
import { MeetPlayerIdentityPickerSheet } from './MeetPlayerIdentityPickerSheet'
import { MeetWechatAccountPickerSheet } from './MeetWechatAccountPickerSheet'

type Props = {
  profile: MeetPublicProfile
  setMeetProfile: (p: Partial<MeetPublicProfile>) => void
}

function openWeChatApp() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'wechat' } }))
}

async function listIdentitiesForMeetAccount(account: MeetWechatAccountOption | null): Promise<PlayerIdentity[]> {
  const acc = account?.accountId?.trim()
  if (!acc) return personaDb.listPlayerIdentities()
  return personaDb.listPlayerIdentities(acc)
}

export function MyProfileContactTab({ profile, setMeetProfile }: Props) {
  const [accounts, setAccounts] = useState<MeetWechatAccountOption[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)

  const [identities, setIdentities] = useState<PlayerIdentity[]>([])
  const [identitiesLoading, setIdentitiesLoading] = useState(false)
  const [identitySheetOpen, setIdentitySheetOpen] = useState(false)

  const boundId = profile.baseWeChatIdentityId?.trim() ?? ''
  const hasIdentity = !!boundId && boundId !== '__none__'

  const selectedAccount = findMeetWechatAccount(accounts, profile.contactWechatId)
  const boundIdentity = identities.find((i) => i.id === boundId) ?? null

  const wx = profile.contactWechatId?.trim() ?? ''
  const wxOk = !wx || isMeetContactWechatIdPlausible(wx)

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true)
    try {
      const rows = await listMeetSelectableWechatAccounts()
      setAccounts(rows)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const refreshIdentities = useCallback(async (account: MeetWechatAccountOption | null) => {
    if (!account) {
      setIdentities([])
      return
    }
    setIdentitiesLoading(true)
    try {
      const rows = await listIdentitiesForMeetAccount(account)
      setIdentities(rows)
    } finally {
      setIdentitiesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAccounts()
  }, [refreshAccounts])

  useEffect(() => {
    if (accountSheetOpen) void refreshAccounts()
  }, [accountSheetOpen, refreshAccounts])

  useEffect(() => {
    void refreshIdentities(selectedAccount)
  }, [selectedAccount?.key, selectedAccount?.accountId, refreshIdentities])

  useEffect(() => {
    if (identitySheetOpen && selectedAccount) void refreshIdentities(selectedAccount)
  }, [identitySheetOpen, selectedAccount, refreshIdentities])

  /** 当前所选微信账号下：仅一条身份时自动绑定 */
  useEffect(() => {
    if (!selectedAccount || hasIdentity || identitiesLoading) return
    if (identities.length === 0) return
    if (identities.length === 1) {
      setMeetProfile({ baseWeChatIdentityId: identities[0].id })
      return
    }
    let canceled = false
    void personaDb.getCurrentIdentityId().then((cur) => {
      if (canceled) return
      const hit = identities.find((i) => i.id === cur.trim())
      if (hit) setMeetProfile({ baseWeChatIdentityId: hit.id })
    })
    return () => {
      canceled = true
    }
  }, [hasIdentity, identities, identitiesLoading, selectedAccount, setMeetProfile])

  /** 已绑身份不属于当前所选微信账号时清空 */
  useEffect(() => {
    if (!hasIdentity || identitiesLoading || !selectedAccount) return
    if (identities.some((i) => i.id === boundId)) return
    setMeetProfile({ baseWeChatIdentityId: '' })
  }, [boundId, hasIdentity, identities, identitiesLoading, selectedAccount, setMeetProfile])

  const handleSelectAccount = useCallback(
    async (account: MeetWechatAccountOption) => {
      const rows = await listIdentitiesForMeetAccount(account)
      const stillValid = rows.some((i) => i.id === boundId)
      setMeetProfile({
        contactWechatId: account.wechatId,
        ...(stillValid ? {} : { baseWeChatIdentityId: '' }),
      })
      setIdentities(rows)
    },
    [boundId, setMeetProfile],
  )

  const handleSelectIdentity = useCallback(
    (identity: PlayerIdentity) => {
      setMeetProfile({ baseWeChatIdentityId: identity.id })
    },
    [setMeetProfile],
  )

  return (
    <motion.div className="px-1 pb-10 pt-2">
      <MeetWechatAccountPickerSheet
        open={accountSheetOpen}
        accounts={accounts}
        selectedWechatId={wx}
        onClose={() => setAccountSheetOpen(false)}
        onSelect={handleSelectAccount}
        onOpenWeChatRegistration={openWeChatApp}
      />

      <MeetPlayerIdentityPickerSheet
        open={identitySheetOpen}
        identities={identities}
        selectedIdentityId={boundId}
        accountNickname={selectedAccount?.nickname}
        loading={identitiesLoading}
        onClose={() => setIdentitySheetOpen(false)}
        onSelect={handleSelectIdentity}
        onOpenWeChatIdentityManager={openWeChatApp}
      />

      <p className="meet-caption-en text-[9px] uppercase tracking-[0.36em] text-[#b8b5ad]">03 CONTACT | 联络绑定</p>
      <p className="mt-2 font-elegant-serif text-[15px] font-medium tracking-[0.06em] text-[#2c2a26]">
        交换联系方式 · 微信侧绑定
      </p>
      <p className="mt-2 text-[12px] font-light leading-relaxed text-[#7a756d]">
        <strong className="font-normal text-[#5c574f]">微信账号</strong>用于互换微信号展示；
        <strong className="font-normal text-[#5c574f]">玩家身份</strong>须从该账号下已创建的身份中选择，用于加好友与 AI 私聊。
      </p>

      <motion.div
        data-meet-app-coach="profile-contact-bindings"
        className="mx-auto mt-10 max-w-sm space-y-10"
      >
        <section>
          <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">WeChat Account</p>
          <p className="mt-1 text-[11px] font-light text-[#7a756d]">微信账号 · 交换联络方式时出示</p>

          <Pressable
            type="button"
            onClick={() => setAccountSheetOpen(true)}
            className="mt-4 w-full rounded-[14px] border border-[#e8e4dc] bg-white px-3 py-3 text-left transition-colors hover:border-[#D4AF37] active:bg-[#faf9f7]"
            aria-label="选择微信账号"
          >
            {accountsLoading ? (
              <p className="text-[13px] font-light text-[#9a9590]">正在拉取微信账号…</p>
            ) : selectedAccount ? (
              <span className="flex items-center gap-3">
                <span className="size-11 shrink-0 overflow-hidden rounded-full border border-[#ebe7e0] bg-[#f5f5f5]">
                  {selectedAccount.avatarUrl ? (
                    <img src={selectedAccount.avatarUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[#1a1918]">
                    {selectedAccount.nickname}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[12px] tracking-[0.04em] text-[#9a9590]">
                    {selectedAccount.wechatId}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[#c8c3ba]" strokeWidth={1.5} />
              </span>
            ) : (
              <span className="flex items-center justify-between gap-2">
                <span>
                  <span className="block text-[13px] text-[#6e6860]">
                    {accounts.length > 0 ? '点击选择微信账号' : '暂无已注册微信账号'}
                  </span>
                  <span className="mt-1 block text-[11px] font-light text-[#9a9590]">
                    {accounts.length > 0
                      ? '从主微信已注册账号中拉取'
                      : '请先到主微信完成身份注册'}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[#c8c3ba]" strokeWidth={1.5} />
              </span>
            )}
          </Pressable>

          {!wxOk && wx ? (
            <p className="mt-2 text-[11px] text-[#b85c4c]">
              当前绑定的微信号格式不符合交换展示规则，请重新选择账号。
            </p>
          ) : !wx ? (
            <p className="mt-2 text-[11px] font-light text-[#9a9590]">
              未选择账号则无法在交换卡片中展示你的微信号，也无法拉取对应玩家身份。
            </p>
          ) : (
            <p className="mt-2 text-[11px] font-light text-[#9a9590]">
              已绑定主微信账号；切换账号后，玩家身份列表会随之更新。
            </p>
          )}
        </section>

        <section>
          <p className="meet-caption-en text-[9px] uppercase tracking-[0.32em] text-[#b8b5ad]">Player Identity</p>
          <p className="mt-1 text-[11px] font-light text-[#7a756d]">
            玩家身份 · 仅显示所选微信账号下的身份
          </p>

          {!selectedAccount ? (
            <p className="mt-4 text-[12px] font-light leading-relaxed text-[#9a9590]">
              请先选择上方微信账号，再绑定该账号下的玩家身份。
            </p>
          ) : (
            <Pressable
              type="button"
              onClick={() => setIdentitySheetOpen(true)}
              disabled={identitiesLoading && identities.length === 0}
              className="mt-4 w-full rounded-[14px] border border-[#e8e4dc] bg-white px-3 py-3 text-left transition-colors hover:border-[#D4AF37] active:bg-[#faf9f7] disabled:opacity-60"
              aria-label="选择玩家身份"
            >
              {identitiesLoading ? (
                <p className="text-[13px] font-light text-[#9a9590]">正在拉取该账号下的身份…</p>
              ) : boundIdentity ? (
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#1a1918]">
                      {(boundIdentity.wechatNickname || boundIdentity.name || '未命名').trim()}
                    </span>
                    {boundIdentity.wechatId?.trim() ? (
                      <span className="mt-0.5 block truncate font-mono text-[12px] tracking-[0.04em] text-[#9a9590]">
                        {boundIdentity.wechatId.trim()}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[#c8c3ba]" strokeWidth={1.5} />
                </span>
              ) : identities.length === 0 ? (
                <span className="flex items-center justify-between gap-2">
                  <span>
                    <span className="block text-[13px] text-[#6e6860]">该账号下暂无玩家身份</span>
                    <span className="mt-1 block text-[11px] font-light text-[#9a9590]">
                      点击前往创建或查看说明
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[#c8c3ba]" strokeWidth={1.5} />
                </span>
              ) : (
                <span className="flex items-center justify-between gap-2">
                  <span>
                    <span className="block text-[13px] text-[#6e6860]">点击选择玩家身份</span>
                    <span className="mt-1 block text-[11px] font-light text-[#9a9590]">
                      共 {identities.length} 套身份可选
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[#c8c3ba]" strokeWidth={1.5} />
                </span>
              )}
            </Pressable>
          )}

          {!hasIdentity && selectedAccount && identities.length > 0 ? (
            <p className="mt-3 text-[11px] font-light text-[#b8973a]">
              缔结契约前须选定玩家身份：对方加你、好友验证与私聊会话键均与此绑定。
            </p>
          ) : null}
          <p
            className="mt-5 border-l-2 pl-3 text-[11px] font-light italic leading-relaxed text-[#8a847b]"
            style={{ borderLeftColor: '#D4AF37' }}
          >
            玩家身份列表随所选微信账号变化；切换账号后，若原绑定身份不属于新账号，需重新选择。
          </p>
        </section>
      </motion.div>
    </motion.div>
  )
}
