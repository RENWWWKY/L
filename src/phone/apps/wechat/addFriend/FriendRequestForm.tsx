import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import {
  isMeetSyncedCharacter,
  loadCurrentMeetProfileSnapshotFromKv,
  loadMeetUserProfileSnapshotFromKv,
} from '../../lumiMeet/meetUserProfileSnapshot'
import { personaDb } from '../newFriendsPersona/idb'
import type { PlayerIdentity } from '../newFriendsPersona/types'
import { PlatinumSwitch } from '../newFriendsPersona/PlatinumSwitch'
import { resolveAccountSessionIdentityId } from '../wechatAccountPersistence'
import {
  arePlayerIdentitiesBasicsEquivalent,
  getCharacterBoundPlayerIdentityId,
  isWechatAccountSessionSlotIdentityId,
} from '../wechatCharacterPlayerIdentity'
import { submitUserOutgoingFriendRequest } from './submitUserOutgoingFriendRequest'
import { useWechatStore } from '../useWechatStore'

function playerIdentityDisplayName(i: PlayerIdentity): string {
  return i.wechatNickname?.trim() || i.name?.trim() || '未命名身份'
}

export type FriendRequestFormProps = {
  characterId: string
  playerIdentityId?: string | null
  playerDisplayName: string
  onBack: () => void
  /** 发送成功后：返回 requestId，由上层打开「新的朋友」并触发角色裁决 */
  onSent: (requestId: string) => void
}

export function FriendRequestForm({
  characterId,
  playerIdentityId,
  playerDisplayName,
  onBack,
  onSent,
}: FriendRequestFormProps) {
  const [verification, setVerification] = useState('')
  const [alias, setAlias] = useState('')
  const [hideMyMoments, setHideMyMoments] = useState(false)
  const [hideTheirMoments, setHideTheirMoments] = useState(false)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [identities, setIdentities] = useState<PlayerIdentity[]>([])
  const [selectedIdentityId, setSelectedIdentityId] = useState('')
  const [fromMeet, setFromMeet] = useState(false)
  const [meetMaskNick, setMeetMaskNick] = useState('')
  const [boundPrimaryIdentityId, setBoundPrimaryIdentityId] = useState<string | null>(null)
  const [altMaskHint, setAltMaskHint] = useState(false)
  const { currentAccountId, accounts } = useWechatStore()

  const sessionSlotIdentityId = useMemo(() => {
    const acc = accounts.find((a) => a.accountId === currentAccountId)
    return acc ? resolveAccountSessionIdentityId(acc).trim() : ''
  }, [accounts, currentAccountId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [c, ids, curId] = await Promise.all([
        personaDb.getCharacter(characterId),
        personaDb.listPlayerIdentities(currentAccountId ?? undefined),
        personaDb.getCurrentIdentityId(),
      ])
      if (cancelled) return
      const nick = c?.wechatNickname?.trim() || c?.name?.trim() || ''
      setAlias(nick)

      const bound = getCharacterBoundPlayerIdentityId(c)
      setBoundPrimaryIdentityId(bound)

      const list = ids.filter((i) => i.id !== '__none__')
      setIdentities(list)

      const slot = sessionSlotIdentityId
      const preferred =
        playerIdentityId?.trim() || curId.trim() || list[0]?.id || slot || ''
      const usable =
        list.some((i) => i.id === preferred) ||
        (!!slot && preferred === slot && isWechatAccountSessionSlotIdentityId(preferred))
      setSelectedIdentityId(usable ? preferred : list[0]?.id ?? slot)
    })()
    return () => {
      cancelled = true
    }
  }, [characterId, currentAccountId, playerIdentityId, sessionSlotIdentityId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const sel = selectedIdentityId.trim()
      const primary = boundPrimaryIdentityId?.trim()
      if (!sel || !primary || sel === primary) {
        if (!cancelled) setAltMaskHint(false)
        return
      }
      const equiv = await arePlayerIdentitiesBasicsEquivalent(sel, primary)
      if (!cancelled) setAltMaskHint(equiv)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedIdentityId, boundPrimaryIdentityId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const c = await personaDb.getCharacter(characterId)
      if (cancelled) return

      const linked = isMeetSyncedCharacter(characterId, c?.worldBooks)
      setFromMeet(linked)
      if (linked) {
        const snap =
          (await loadMeetUserProfileSnapshotFromKv(characterId)) ??
          (await loadCurrentMeetProfileSnapshotFromKv())
        if (!cancelled) setMeetMaskNick(snap?.displayName?.trim() || '')
      } else if (!cancelled) {
        setMeetMaskNick('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [characterId, playerIdentityId])

  const defaultVerification = useMemo(() => `我是 ${playerDisplayName}`, [playerDisplayName])

  useEffect(() => {
    setVerification(defaultVerification)
  }, [defaultVerification])

  const selectedIdentity = useMemo(
    () => identities.find((i) => i.id === selectedIdentityId),
    [identities, selectedIdentityId],
  )

  const send = () => {
    if (sending) return
    const pid = selectedIdentityId.trim() || sessionSlotIdentityId
    if (!pid || pid === '__none__') {
      window.alert('请先选择要绑定的微信身份')
      return
    }
    setSending(true)
    void (async () => {
      try {
        const meetSnap = fromMeet ? await loadCurrentMeetProfileSnapshotFromKv() : null
        const { requestId } = await submitUserOutgoingFriendRequest({
          characterId,
          wechatAccountId: currentAccountId ?? undefined,
          playerIdentityId: pid,
          verificationMessage: verification.trim(),
          alias: alias.trim(),
          hideMyMoments,
          hideTheirMoments,
          ...(fromMeet ? { meetLinkedNpcId: characterId } : {}),
          ...(meetSnap ? { meetUserProfileAtRequest: meetSnap } : {}),
        })
        setSuccess(true)
        window.setTimeout(() => {
          setSuccess(false)
          onSent(requestId)
        }, 900)
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '发送失败')
      } finally {
        setSending(false)
      }
    })()
  }

  return (
    <motion.div className="relative flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-center border-b border-[#EBEBEB] bg-white px-1 pb-1 pt-[max(8px,env(safe-area-inset-top,0px))]">
        <Pressable
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center active:opacity-55"
        >
          <ChevronLeft className="size-6 text-[#111111]" strokeWidth={1.5} />
        </Pressable>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-medium tracking-[0.26em] text-[#8A8A8A]">FRIEND REQUEST</p>
          <p className="text-[15px] font-medium text-[#111111]">申请添加朋友</p>
        </div>
        <div className="w-11" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-6">
        <section className="mb-8">
          <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#8A8A8A]">验证消息</p>
          <textarea
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            rows={4}
            placeholder="向对方说明你是谁…"
            className="w-full resize-none rounded-[12px] border border-[#E0E0E0] bg-white px-4 py-3 text-[15px] leading-relaxed text-[#111111] outline-none ring-0 placeholder:text-[#B0B0B0] focus:border-[#111111]"
          />
        </section>

        {identities.length > 0 ? (
          <section className="mb-8">
            <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#8A8A8A]">绑定微信身份</p>
            <p className="mb-3 text-[12px] leading-relaxed text-[#6B6B6B]">
              {boundPrimaryIdentityId
                ? '该角色已绑定主档身份（跨马甲共享主绑定不变）。请选择本马甲用于本次验证的聊天身份：可与主档不同，小号扮演时对方仅能看到微信「我」页基础资料。'
                : '对方将通过此身份资料验证你是谁；可与遇见里的对外档案刻意不一致。'}
            </p>
            {altMaskHint ? (
              <p className="mb-3 text-[12px] leading-relaxed text-[#8C6B2B]">
                所选身份与角色主绑定资料一致：将按小号处理，对方在验证与私聊中仅读取本马甲微信主页信息，不注入该身份世界书。
              </p>
            ) : null}
            <motion.div
              role="radiogroup"
              aria-label="绑定微信身份"
              className="divide-y divide-[#EBEBEB] rounded-[12px] border border-[#E8E8E8] bg-white"
            >
              {identities.map((i) => {
                const checked = i.id === selectedIdentityId
                const label = playerIdentityDisplayName(i)
                return (
                  <Pressable
                    key={i.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    disabled={sending}
                    onClick={() => setSelectedIdentityId(i.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-[#FAFAFA] ${
                      checked ? 'bg-[#FAFAFA]' : ''
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                        checked ? 'border-[#111111]' : 'border-[#C4C4C4]'
                      }`}
                      aria-hidden
                    >
                      {checked ? <span className="h-2 w-2 rounded-full bg-[#111111]" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-[#111111]">{label}</span>
                      {i.bio?.trim() ? (
                        <span className="mt-0.5 block line-clamp-2 text-[12px] leading-relaxed text-[#8A8A8A]">
                          {i.bio.trim()}
                        </span>
                      ) : null}
                    </span>
                  </Pressable>
                )
              })}
            </motion.div>
            {fromMeet ? (
              <motion.div className="mt-3 rounded-[12px] border border-[#E8D4A8] bg-[#FFFBF3] px-4 py-3">
                <p className="text-[10px] font-medium tracking-[0.18em] text-[#8C6B2B]">遇见 · 假面档案</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#5C4A2E]">
                  对方在遇见里记住的你{meetMaskNick ? `（昵称「${meetMaskNick}」）` : ''}
                  可能与本次选择的微信身份「
                  {selectedIdentity ? playerIdentityDisplayName(selectedIdentity) : '—'}
                  」不同——通过后私聊可能出现「原来你还有这一面」的张力。
                </p>
              </motion.div>
            ) : null}
          </section>
        ) : sessionSlotIdentityId ? (
          <section className="mb-8">
            <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#8A8A8A]">验证身份</p>
            <p className="text-[12px] leading-relaxed text-[#6B6B6B]">
              将使用当前微信账号资料发起申请；可在「我的身份」中创建马甲后再切换。
            </p>
          </section>
        ) : null}

        <section className="mb-8 space-y-3">
          <div>
            <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#8A8A8A]">备注</p>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="h-12 w-full rounded-[12px] border border-[#E0E0E0] bg-white px-4 text-[15px] text-[#111111] outline-none placeholder:text-[#B0B0B0] focus:border-[#111111]"
              placeholder="备注名（可选）"
            />
          </div>
          <Pressable
            type="button"
            className="flex h-12 w-full items-center justify-between rounded-[12px] border border-[#E8E8E8] bg-[#FAFAFA] px-4 active:bg-[#F5F5F5]"
          >
            <span className="text-[14px] text-[#111111]">标签</span>
            <ChevronRight className="size-[18px] text-[#B0B0B0]" aria-hidden />
          </Pressable>
        </section>

        <section className="mb-4">
          <p className="mb-3 text-[10px] font-medium tracking-[0.2em] text-[#8A8A8A]">朋友权限</p>
          <div className="divide-y divide-[#EBEBEB] rounded-[12px] border border-[#E8E8E8] bg-white px-4">
            <div className="flex items-center justify-between gap-3 py-3.5">
              <span className="min-w-0 flex-1 text-[14px] text-[#111111]">不让他看我</span>
              <PlatinumSwitch
                checked={hideMyMoments}
                onChange={setHideMyMoments}
                aria-label="不让他看我"
                className={sending ? 'pointer-events-none opacity-45' : ''}
              />
            </div>
            <div className="flex items-center justify-between gap-3 py-3.5">
              <span className="min-w-0 flex-1 text-[14px] text-[#111111]">不看他</span>
              <PlatinumSwitch
                checked={hideTheirMoments}
                onChange={setHideTheirMoments}
                aria-label="不看他"
                className={sending ? 'pointer-events-none opacity-45' : ''}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-end border-t border-[#EBEBEB] bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Pressable
          type="button"
          onClick={() => send()}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-7 py-2.5 text-[14px] font-medium tracking-[0.06em] text-white disabled:bg-[#C4C4C4] disabled:text-[#F5F5F5]"
        >
          {sending ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : null}
          发送
        </Pressable>
      </div>

      <AnimatePresence>
        {success ? (
          <motion.div
            key="sent-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[40] flex items-center justify-center bg-white/70 px-8 backdrop-blur-[3px]"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[280px] rounded-[14px] border border-[#111111] bg-white px-6 py-8 text-center shadow-[0_16px_48px_rgba(0,0,0,0.08)]"
            >
              <p className="text-[11px] font-medium tracking-[0.36em] text-[#111111]">SENT</p>
              <p className="mt-2 text-[17px] font-medium tracking-[0.12em] text-[#111111]">申请已发送</p>
              <p className="mt-2 text-[12px] text-[#6B6B6B]">等待对方验证</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
