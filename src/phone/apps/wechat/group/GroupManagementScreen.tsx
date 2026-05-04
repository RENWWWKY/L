import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import type { GroupChatRow, GroupMember, GroupMemberRole } from '../newFriendsPersona/types'
import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import { appendGroupChatEventNotice, groupNoticeMemberNickname } from '../groupChatEventNotice'
import { WECHAT_GROUP_USER_CHAR_ID } from '../wechatConversationKey'
import {
  userCanAccessGroupAdminLevelInClient,
  userCanAccessGroupOwnerLevelInClient,
} from '../groupChatUtils'
import { groupMemberSpeechBlockedInGroup } from '../groupBotSmartEngine'
import { GroupMemberAvatarWithRanks } from './GroupMemberAvatarWithRanks'

function WxSwitchSmall({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-7 w-[46px] shrink-0 rounded-full transition-opacity disabled:opacity-40"
      style={{ backgroundColor: on ? '#111827' : '#D1D5DB' }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left]"
        style={{ left: on ? 22 : 2 }}
        aria-hidden
      />
    </button>
  )
}

function rowLabels(
  m: GroupMember,
  contactRemark: string | undefined,
  playerDisplayName: string,
): { primary: string; remarkSub?: string } {
  let gn = (m.groupNickname || '').trim()
  if (m.charId === WECHAT_GROUP_USER_CHAR_ID && gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
  const remark = contactRemark?.trim()
  const primary =
    gn ||
    remark ||
    (m.charId === WECHAT_GROUP_USER_CHAR_ID ? playerDisplayName.trim() || '我' : m.charId)
  const remarkSub = gn && remark && gn !== remark ? remark : undefined
  return { primary, remarkSub }
}

export function GroupManagementScreen({
  group,
  playerIdentityId,
  playerDisplayName,
  resolveMemberAvatar,
  contactRemarkFor,
  onBack,
}: {
  group: GroupChatRow
  playerIdentityId: string
  playerDisplayName: string
  resolveMemberAvatar?: (charId: string) => string | undefined
  /** 通讯录备注；与本群昵称不同时显示为辅行 */
  contactRemarkFor?: (charId: string) => string | undefined
  onBack: () => void
}) {
  const [local, setLocal] = useState(group)
  const canAdmin = userCanAccessGroupAdminLevelInClient(local)
  const canOwner = userCanAccessGroupOwnerLevelInClient(local)

  useEffect(() => {
    setLocal(group)
  }, [group])

  const persist = useCallback(
    async (nextMembers: GroupMember[]) => {
      const row = await personaDb.getGroupChat(group.id)
      if (!row) return
      const ng = { ...row, members: nextMembers, updatedAt: Date.now() }
      await personaDb.putGroupChat(ng)
      emitWeChatStorageChanged()
      setLocal(ng)
    },
    [group.id],
  )

  const roleChars = useMemo(() => local.members.filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID), [local.members])

  const [muteClock, setMuteClock] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setMuteClock((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [local.id])
  const muteNowMs = useMemo(() => Date.now(), [muteClock])

  const toggleAdmin = async (charId: string) => {
    const cur = local.members.find((m) => m.charId === charId)
    if (!cur || cur.role === 'owner') return
    const wasAdmin = cur.role === 'admin'
    const next: GroupMember[] = local.members.map((m) => {
      if (m.charId !== charId || m.role === 'owner') return m
      const role: GroupMemberRole = m.role === 'admin' ? 'member' : 'admin'
      return { ...m, role }
    })
    await persist(next)
    const pid = playerIdentityId.trim()
    if (!pid) return
    const actorMem = next.find((m) => m.charId === WECHAT_GROUP_USER_CHAR_ID)
    const targetMem = next.find((m) => m.charId === charId)
    const actorLabel = groupNoticeMemberNickname(actorMem)
    const targetLabel = groupNoticeMemberNickname(targetMem)
    const displayText = wasAdmin ? `${actorLabel}撤销了${targetLabel}的群管理` : `${actorLabel}设置${targetLabel}为群管理`
    await appendGroupChatEventNotice({
      groupId: local.id,
      playerIdentityId: pid,
      displayText,
    })
  }

  const toggleMute = async (charId: string) => {
    const next = local.members.map((m) => (m.charId === charId ? { ...m, isMuted: !m.isMuted } : m))
    await persist(next)
  }

  const renameMemberGroupNick = async (charId: string) => {
    if (!canOwner) return
    const mem = local.members.find((x) => x.charId === charId)
    const cur = (mem?.groupNickname || '').trim()
    const v = window.prompt('修改该成员在本群的昵称', cur || charId)
    if (v == null) return
    const nextNick = v.trim().slice(0, 32)
    if (!nextNick || nextNick === cur) return
    const nextMembers = local.members.map((m) => (m.charId === charId ? { ...m, groupNickname: nextNick } : m))
    await persist(nextMembers)
    const pid = playerIdentityId.trim()
    if (pid && pid !== '__none__') {
      const oldLabel = cur || '群成员'
      const safe = nextNick.replace(/"/g, "'")
      await appendGroupChatEventNotice({
        groupId: local.id,
        playerIdentityId: pid,
        displayText: `${playerDisplayName.trim() || '用户'}将「${oldLabel}」的本群昵称改为"${safe}"`,
      })
    }
  }

  if (!canAdmin) {
    return (
      <div className="flex h-full flex-col bg-[#F3F4F6]">
        <header className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center">
            <Pressable type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
            </Pressable>
            <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群管理</h1>
            <div className="w-10" />
          </div>
        </header>
        <p className="p-6 text-center text-[14px] leading-relaxed text-[#9CA3AF]">
          仅群主或管理员可进入群管理（禁言、移除成员等）。普通成员无此权限。
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F3F4F6]">
      <header className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center">
          <Pressable type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
          </Pressable>
          <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群管理</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-8 pt-3">
        <p className="px-4 pb-2 text-[12px] text-[#9CA3AF]">管理员与禁言</p>
        <div className="overflow-hidden bg-white">
          {roleChars.map((m, i) => {
            const { primary, remarkSub } = rowLabels(m, contactRemarkFor?.(m.charId), playerDisplayName)
            if (m.role === 'owner') {
              return (
                <div
                  key={m.charId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderBottom: i < roleChars.length - 1 ? '1px solid #F3F4F6' : undefined }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="shrink-0 pl-1 pt-1">
                      <GroupMemberAvatarWithRanks
                        avatarUrl={resolveMemberAvatar?.(m.charId)}
                        role={m.role}
                        speechBlocked={groupMemberSpeechBlockedInGroup(m, muteNowMs)}
                        botMuteExpiresAt={m.botViolation?.muteExpiresAt ?? null}
                        sizePx={44}
                        roundedClassName="rounded-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-[16px] text-[#111827]">{primary}</span>
                      {remarkSub ? (
                        <span className="mt-0.5 block truncate text-[12px] text-[#9CA3AF]">备注 {remarkSub}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-[13px] text-[#9CA3AF]">群主</span>
                </div>
              )
            }
            return (
              <div
                key={m.charId}
                className="flex flex-col gap-2 border-b border-[#F3F4F6] px-4 py-3"
                style={{ borderBottom: i < roleChars.length - 1 ? '1px solid #F3F4F6' : undefined }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="shrink-0 pl-1 pt-1">
                      <GroupMemberAvatarWithRanks
                        avatarUrl={resolveMemberAvatar?.(m.charId)}
                        role={m.role}
                        speechBlocked={groupMemberSpeechBlockedInGroup(m, muteNowMs)}
                        botMuteExpiresAt={m.botViolation?.muteExpiresAt ?? null}
                        sizePx={44}
                        roundedClassName="rounded-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-[16px] text-[#111827]">{primary}</span>
                      {remarkSub ? (
                        <span className="mt-0.5 block truncate text-[12px] text-[#9CA3AF]">备注 {remarkSub}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] text-[#9CA3AF]">{m.role === 'admin' ? '管理员' : '成员'}</span>
                </div>
                <div className={`flex items-center justify-between ${!canOwner ? 'opacity-45' : ''}`}>
                  <span className="text-[14px] text-[#9CA3AF]">管理员{!canOwner ? '（仅群主可改）' : ''}</span>
                  <WxSwitchSmall
                    on={m.role === 'admin'}
                    onToggle={() => {
                      if (canOwner) void toggleAdmin(m.charId)
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[#9CA3AF]">禁言</span>
                  <WxSwitchSmall on={m.isMuted} onToggle={() => void toggleMute(m.charId)} />
                </div>
                {canOwner ? (
                  <Pressable
                    type="button"
                    onClick={() => void renameMemberGroupNick(m.charId)}
                    className="text-left text-[14px] font-medium text-[#111827] underline decoration-[#E5E7EB] underline-offset-4"
                  >
                    修改本群昵称…
                  </Pressable>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
