import { ArrowLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { Pressable } from '../../../components/Pressable'
import type { ChatConversationSettingsRow, GroupChatRow, GroupMember } from '../newFriendsPersona/types'
import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import { appendGroupChatEventNotice, groupNoticeMemberNickname } from '../groupChatEventNotice'
import { wechatGroupConversationKey, wechatGroupPeerCharacterId, WECHAT_GROUP_USER_CHAR_ID } from '../wechatConversationKey'
import {
  buildNewGroupChatRow,
  userCanAccessGroupAdminLevelInClient,
  userCanAccessGroupOwnerLevelInClient,
  userIsGroupOwner,
} from '../groupChatUtils'
import { uid } from '../newFriendsPersona/utils'
import { groupMemberSpeechBlockedInGroup, pruneExpiredBotMutesOnGroup } from '../groupBotSmartEngine'
import { GroupRobotSettingsScreen } from './GroupRobotSettingsScreen'
import { GroupManagementScreen } from './GroupManagementScreen'
import { CreateGroupPickContactsSheet, type CreateGroupContactPick } from './CreateGroupPickContactsSheet'
import { GroupMemberAvatarWithRanks } from './GroupMemberAvatarWithRanks'
import { compressAvatarDataUrl, MAX_AVATAR_DATA_URL_LEN } from '../avatarCompress'

function Cell({
  label,
  value,
  onClick,
  borderBottom,
}: {
  label: string
  value?: string
  onClick?: () => void
  borderBottom?: boolean
}) {
  const style = { borderBottom: borderBottom ? '1px solid #F3F4F6' : undefined }
  const row = (
    <>
      <span className="text-[16px] text-[#111827]">{label}</span>
      <span className="max-w-[60%] truncate text-[14px] text-[#9CA3AF]">{value ?? ''}</span>
    </>
  )
  if (onClick) {
    return (
      <Pressable type="button" onClick={onClick} className="flex w-full items-center justify-between bg-white px-4 py-3 text-left" style={style}>
        {row}
      </Pressable>
    )
  }
  return (
    <div className="flex w-full items-center justify-between bg-white px-4 py-3" style={style}>
      {row}
    </div>
  )
}

/** 群信息页：主行优先本群昵称；辅行仅在「本群昵称 ≠ 通讯录备注」时展示备注。 */
function groupMemberGridLabels(
  m: GroupMember,
  playerDisplayName: string,
  contactRemark?: string,
): { primary: string; remarkSub?: string } {
  let gn = (m.groupNickname || '').trim()
  if (m.charId === WECHAT_GROUP_USER_CHAR_ID && gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
  const remark = contactRemark?.trim()
  if (m.charId === WECHAT_GROUP_USER_CHAR_ID) {
    return { primary: gn || playerDisplayName.trim() || '我' }
  }
  const primary = gn || remark || m.charId
  const remarkSub = gn && remark && gn !== remark ? remark : undefined
  return { primary, remarkSub }
}

function WxSwitch({
  on,
  onToggle,
  disabled,
}: {
  on: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onToggle()
      }}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
      style={{ backgroundColor: on ? '#111827' : '#D1D5DB' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

export function GroupInfoScreen({
  groupId,
  playerIdentityId,
  playerDisplayName,
  playerAvatarUrl,
  personaContacts,
  onClose,
  onAfterLeave,
}: {
  groupId: string
  playerIdentityId: string
  playerDisplayName: string
  playerAvatarUrl?: string
  personaContacts: CreateGroupContactPick[]
  onClose: () => void
  onAfterLeave: () => void
}) {
  const [group, setGroup] = useState<GroupChatRow | null>(null)
  const [sub, setSub] = useState<'main' | 'robot' | 'mgmt' | 'add' | 'kick' | 'transfer' | 'avatar' | 'chat-bg'>('main')
  const [kickPick, setKickPick] = useState<Set<string>>(new Set())
  const [announceModalOpen, setAnnounceModalOpen] = useState(false)
  const [announceEditing, setAnnounceEditing] = useState(false)
  const [announceDraft, setAnnounceDraft] = useState('')
  const [permDialog, setPermDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' })
  const [avatarUrlDraft, setAvatarUrlDraft] = useState('')
  const [avatarCropSrc, setAvatarCropSrc] = useState('')
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const chatBgFileRef = useRef<HTMLInputElement>(null)

  const conversationKey = useMemo(
    () => wechatGroupConversationKey(groupId.trim(), playerIdentityId),
    [groupId, playerIdentityId],
  )
  const peerConvCharacterId = useMemo(() => wechatGroupPeerCharacterId(groupId.trim()), [groupId])

  const [convSettings, setConvSettings] = useState<ChatConversationSettingsRow | null>(null)
  const [chatBgDraft, setChatBgDraft] = useState('')
  const [chatBgCropSrc, setChatBgCropSrc] = useState<string | null>(null)

  const loadConvSettings = useCallback(async () => {
    const row = await personaDb.getChatConversationSettings(conversationKey)
    setConvSettings(row)
  }, [conversationKey])

  useEffect(() => {
    void loadConvSettings()
  }, [loadConvSettings])

  useEffect(() => {
    const on = () => void loadConvSettings()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [loadConvSettings])

  const patchConvSettings = useCallback(
    async (
      partial: Partial<
        Pick<
          ChatConversationSettingsRow,
          'chatBackground' | 'isDanmakuMode' | 'showGroupMemberNicknameInChat' | 'showGroupRankBadgesInChat'
        >
      >,
    ) => {
      await personaDb.upsertChatConversationSettings({
        conversationKey,
        peerCharacterId: peerConvCharacterId,
        playerIdentityId,
        ...partial,
      })
      await loadConvSettings()
    },
    [conversationKey, peerConvCharacterId, playerIdentityId, loadConvSettings],
  )

  useEffect(() => {
    if (sub !== 'chat-bg') return
    setChatBgDraft((convSettings?.chatBackground ?? '').trim())
  }, [sub, convSettings?.chatBackground])

  useEffect(() => {
    if (sub !== 'chat-bg') setChatBgCropSrc(null)
  }, [sub])

  const onPickChatBgFile = useCallback((file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      if (!result) return
      setChatBgCropSrc(result)
    }
    reader.readAsDataURL(file)
  }, [])

  const load = useCallback(async () => {
    const g = await personaDb.getGroupChat(groupId.trim())
    if (g) {
      const pruned = pruneExpiredBotMutesOnGroup(g, Date.now())
      if (pruned !== g) {
        await personaDb.putGroupChat(pruned)
        emitWeChatStorageChanged()
        setGroup(pruned)
        return
      }
    }
    setGroup(g)
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const on = () => void load()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [load])

  /** 禁言遮罩/倒计时：每秒刷新 `Date.now()`，否则群助手限时禁言到期后 UI 不更新 */
  const [muteClock, setMuteClock] = useState(0)
  useEffect(() => {
    if (!group) return
    const id = window.setInterval(() => setMuteClock((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [group?.id])
  const muteNowMs = useMemo(() => Date.now(), [muteClock])

  useEffect(() => {
    if (sub !== 'avatar') {
      setAvatarCropSrc('')
      return
    }
    const a = (group?.avatar ?? '').trim()
    setAvatarUrlDraft(a.startsWith('data:') ? '' : a)
  }, [sub, group?.avatar, group?.id])

  const nickLookup = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of personaContacts) m.set(c.characterId, c.remarkName)
    return m
  }, [personaContacts])

  const resolveMemberLabel = useCallback(
    (charId: string) => {
      if (charId === WECHAT_GROUP_USER_CHAR_ID) {
        const gm = group?.members.find((x) => x.charId === WECHAT_GROUP_USER_CHAR_ID)
        return gm?.groupNickname?.trim() || playerDisplayName || '我'
      }
      return nickLookup.get(charId)?.trim() || group?.members.find((x) => x.charId === charId)?.groupNickname?.trim() || charId
    },
    [group?.members, nickLookup, playerDisplayName],
  )

  const resolveMemberAvatar = useCallback(
    (charId: string) => {
      if (charId === WECHAT_GROUP_USER_CHAR_ID) return playerAvatarUrl
      return personaContacts.find((c) => c.characterId === charId)?.avatarUrl
    },
    [personaContacts, playerAvatarUrl],
  )

  const contactRemarkForChar = useCallback((charId: string) => {
    if (charId === WECHAT_GROUP_USER_CHAR_ID) return undefined
    const r = nickLookup.get(charId)?.trim()
    return r || undefined
  }, [nickLookup])

  const persistMembers = async (members: GroupMember[]) => {
    if (!group) return
    await personaDb.putGroupChat({ ...group, members, updatedAt: Date.now() })
    emitWeChatStorageChanged()
    await load()
  }

  const lockedCharIdsForAdd = useMemo(() => {
    if (!group) return []
    return group.members.map((m) => m.charId).filter((id) => id !== WECHAT_GROUP_USER_CHAR_ID)
  }, [group])

  /** 与群公告同款：主信息页公开预览，点入可看全文 */
  const groupRobotRulesPublicPreview = useMemo(() => {
    if (!group) return ''
    const rules = group.robotRules ?? []
    if (!rules.length) return '暂无已发布的敏感词规则'
    const words = rules
      .flatMap((r) => (r.triggerWords ?? []).map((w) => String(w).trim()))
      .filter(Boolean)
    if (!words.length) return `已配置 ${rules.length} 条规则`
    const head = words.slice(0, 5).join('、')
    return words.length > 5 ? `${head}…` : head
  }, [group])

  const owner = userIsGroupOwner(group)
  const canOwnerLevel = userCanAccessGroupOwnerLevelInClient(group)
  const canAdminLevel = userCanAccessGroupAdminLevelInClient(group)

  const PERM_MSG_NEED_ADMIN = '暂无编辑权限。仅群主或管理员可使用此功能。'
  const PERM_MSG_NEED_OWNER = '暂无编辑权限。仅群主可使用此功能。'
  const openPermDialog = (message: string) => setPermDialog({ open: true, message })
  const closePermDialog = () => setPermDialog({ open: false, message: '' })

  const permPortal: ReactNode =
    typeof document !== 'undefined'
      ? createPortal(
          permDialog.open ? (
            <div
              className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
              role="presentation"
              onClick={() => closePermDialog()}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-live="assertive"
                className="w-full max-w-[320px] overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 pb-2 pt-5">
                  <p className="text-center text-[16px] font-semibold text-black">无法操作</p>
                  <p className="mt-3 text-center text-[14px] leading-relaxed text-neutral-600">{permDialog.message}</p>
                </div>
                <div className="flex justify-center border-t border-neutral-200 px-5 pb-5 pt-4">
                  <Pressable
                    type="button"
                    onClick={() => closePermDialog()}
                    className="rounded-lg bg-black px-4 py-2 text-[13px] font-medium text-white active:bg-neutral-800"
                  >
                    知道了
                  </Pressable>
                </div>
              </div>
            </div>
          ) : null,
          document.body,
        )
      : null

  const wrapWithPermPortal = (node: ReactNode) => (
    <>
      {permPortal}
      {node}
    </>
  )

  const openKick = () => {
    setKickPick(new Set())
    setSub('kick')
  }

  const confirmKick = async () => {
    if (!group || !kickPick.size) return
    const keep = group.members.filter((m) => !kickPick.has(m.charId))
    await persistMembers(keep)
    setSub('main')
  }

  const transferOwnerTo = async (charId: string) => {
    const cid = charId.trim()
    if (!cid || cid === WECHAT_GROUP_USER_CHAR_ID || !group) return
    const mem = group.members.find((x) => x.charId === cid)
    const transferConfirmName = mem
      ? groupMemberGridLabels(mem, playerDisplayName, contactRemarkForChar(cid)).primary
      : resolveMemberLabel(cid)
    if (!window.confirm(`将群主转让给「${transferConfirmName}」？`)) return
    const prevOwner = group.members.find((m) => m.role === 'owner')
    const nextOwnerMem = group.members.find((x) => x.charId === cid)
    const next = group.members.map((m): GroupMember => {
      if (m.charId === cid) return { ...m, role: 'owner' }
      if (m.role === 'owner') return { ...m, role: 'member' }
      return m
    })
    await persistMembers(next)
    const pid = playerIdentityId.trim()
    if (pid && prevOwner && nextOwnerMem) {
      await appendGroupChatEventNotice({
        groupId: group.id,
        playerIdentityId: pid,
        displayText: `${groupNoticeMemberNickname(prevOwner)}转让群主给${groupNoticeMemberNickname(nextOwnerMem)}`,
      })
    }
    window.alert('群主已转让')
    setSub('main')
  }

  const gridMembers = group?.members ?? []

  if (!group) {
    return wrapWithPermPortal(
      <div className="flex h-full flex-col bg-[#F3F4F6]">
        <header className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center">
            <Pressable type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
            </Pressable>
            <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群聊信息</h1>
            <div className="w-10" />
          </div>
        </header>
        <p className="flex flex-1 items-center justify-center text-[14px] text-[#9CA3AF]">加载中…</p>
      </div>,
    )
  }

  if (sub === 'chat-bg') {
    const draftTrimmed = chatBgDraft.trim()
    const currentTrimmed = (convSettings?.chatBackground ?? '').trim()
    const canApply = draftTrimmed.length > 0 && draftTrimmed !== currentTrimmed
    const canReset = currentTrimmed.length > 0
    return wrapWithPermPortal(
      <div className="flex h-full min-h-0 flex-col bg-[#F3F4F6]">
        <header
          className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex w-full items-center">
            <Pressable
              type="button"
              aria-label="返回"
              onClick={() => setSub('main')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            >
              <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
            </Pressable>
            <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-[#111827]">设置当前聊天背景</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <div className="rounded-[12px] border border-[#F3F4F6] bg-white px-4 py-4">
            <p className="text-[15px] font-medium text-[#111827]">图片地址（URL）</p>
            <input
              value={draftTrimmed.startsWith('data:') ? '' : chatBgDraft}
              onChange={(e) => setChatBgDraft(e.target.value)}
              placeholder="https://… 粘贴图片链接"
              className="mt-2 h-11 w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-[13px] text-[#111827] outline-none focus:border-[#111827]"
            />
            <p className="mt-2 text-[12px] text-[#9CA3AF]">
              支持 URL 与本地上传二选一；本地上传会进入 9:16 裁剪后应用到当前群聊。
            </p>
            <div className="mt-3 overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB]" style={{ aspectRatio: '9 / 16' }}>
              {draftTrimmed ? (
                <img src={draftTrimmed} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] text-[#9CA3AF]">当前使用默认聊天背景</div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pressable
                type="button"
                onClick={() => chatBgFileRef.current?.click()}
                className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#111827] px-4 text-[13px] text-white"
              >
                本地上传并裁剪
              </Pressable>
              <Pressable
                type="button"
                disabled={!canApply}
                onClick={() => {
                  void (async () => {
                    await patchConvSettings({ chatBackground: draftTrimmed })
                    setSub('main')
                  })()
                }}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] text-[#111827] disabled:opacity-45"
              >
                应用到当前聊天
              </Pressable>
              <Pressable
                type="button"
                disabled={!canReset}
                onClick={() => {
                  void (async () => {
                    await patchConvSettings({ chatBackground: '' })
                    setChatBgDraft('')
                    setSub('main')
                  })()
                }}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 text-[13px] text-[#111827] disabled:opacity-45"
              >
                恢复默认聊天背景
              </Pressable>
            </div>
            <input
              ref={chatBgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickChatBgFile(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
          </div>
        </div>
        <ImageCropperModal
          open={!!chatBgCropSrc}
          imageSrc={chatBgCropSrc ?? ''}
          title="裁剪聊天背景"
          aspect={9 / 19.5}
          maxSide={1440}
          objectFit="vertical-cover"
          onCancel={() => setChatBgCropSrc(null)}
          onConfirm={(dataUrl) => {
            setChatBgCropSrc(null)
            setChatBgDraft(dataUrl)
          }}
        />
      </div>,
    )
  }

  if (sub === 'robot') {
    return wrapWithPermPortal(
      <div className="absolute inset-0 z-[10] flex min-h-0 flex-col bg-[#F3F4F6]">
        <GroupRobotSettingsScreen group={group} playerIdentityId={playerIdentityId} onBack={() => setSub('main')} />
      </div>,
    )
  }

  if (sub === 'mgmt') {
    return wrapWithPermPortal(
      <div className="absolute inset-0 z-[10] flex min-h-0 flex-col bg-[#F3F4F6]">
        <GroupManagementScreen
          group={group}
          playerIdentityId={playerIdentityId}
          playerDisplayName={playerDisplayName}
          resolveMemberAvatar={resolveMemberAvatar}
          contactRemarkFor={contactRemarkForChar}
          onBack={() => setSub('main')}
        />
      </div>,
    )
  }

  if (sub === 'add') {
    return wrapWithPermPortal(
      <div className="absolute inset-0 z-[20] flex min-h-0 flex-col bg-white">
        <CreateGroupPickContactsSheet
          open
          title="添加成员"
          lockedCharacterIds={lockedCharIdsForAdd}
          contacts={personaContacts}
          minExtraSelections={1}
          onClose={() => setSub('main')}
          onConfirm={async (extra) => {
            const nickByCharacterId: Record<string, string> = {}
            for (const c of personaContacts) nickByCharacterId[c.characterId] = c.remarkName
            const added: GroupMember[] = extra.map((cid) => ({
              charId: cid,
              groupNickname: nickByCharacterId[cid]?.trim().slice(0, 32) || cid,
              role: 'member',
              isMuted: false,
              warnings: 0,
            }))
            const seen = new Set(group.members.map((m) => m.charId))
            const merged = [...group.members]
            for (const m of added) {
              if (!seen.has(m.charId)) {
                merged.push(m)
                seen.add(m.charId)
              }
            }
            await persistMembers(merged)
            setSub('main')
          }}
        />
      </div>,
    )
  }

  if (sub === 'kick') {
    const targets = gridMembers.filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID)
    return wrapWithPermPortal(
      <div className="absolute inset-0 z-[20] flex min-h-0 flex-col bg-[#FFFFFF]">
        <header
          className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2">
            <Pressable type="button" onClick={() => setSub('main')} className="flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
            </Pressable>
            <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">移除成员</h1>
            <Pressable
              type="button"
              disabled={!kickPick.size}
              onClick={() => void confirmKick()}
              className="rounded-full bg-[#111827] px-3 py-1.5 text-[13px] text-white disabled:opacity-35"
            >
              移除
            </Pressable>
          </div>
        </header>
        <ul className="min-h-0 flex-1 divide-y divide-[#F3F4F6] overflow-y-auto">
          {targets.map((m) => {
            const on = kickPick.has(m.charId)
            return (
              <li key={m.charId}>
                <button
                  type="button"
                  onClick={() =>
                    setKickPick((prev) => {
                      const n = new Set(prev)
                      if (n.has(m.charId)) n.delete(m.charId)
                      else n.add(m.charId)
                      return n
                    })
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[#F9FAFB]"
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? 'border-[#111827] bg-[#111827]' : 'border-[#D1D5DB]'
                    }`}
                  >
                    {on ? <span className="text-[10px] text-white">✓</span> : null}
                  </span>
                  <div className="shrink-0 pl-1 pt-1">
                    <GroupMemberAvatarWithRanks
                      avatarUrl={resolveMemberAvatar(m.charId)}
                      role={m.role}
                      speechBlocked={groupMemberSpeechBlockedInGroup(m, muteNowMs)}
                      botMuteExpiresAt={m.botViolation?.muteExpiresAt ?? null}
                      sizePx={40}
                      roundedClassName="rounded-full"
                    />
                  </div>
                  <span className="flex-1 truncate text-[16px] text-[#111827]">
                    {groupMemberGridLabels(m, playerDisplayName, contactRemarkForChar(m.charId)).primary}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>,
    )
  }

  if (sub === 'transfer') {
    const transferCandidates = gridMembers.filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID)
    return wrapWithPermPortal(
      <div className="absolute inset-0 z-[20] flex min-h-0 flex-col bg-[#FFFFFF]">
        <header
          className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center">
            <Pressable type="button" onClick={() => setSub('main')} className="flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
            </Pressable>
            <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">转让群主</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>
        <p className="px-4 pb-2 pt-3 text-[13px] leading-relaxed text-[#9CA3AF]">
          {owner
            ? '选择一名群成员担任新群主。转让后你将变为普通成员。'
            : '当前群主为群内其他成员。选择一名成员担任新群主后，原群主将变为普通成员。'}
        </p>
        <ul className="min-h-0 flex-1 divide-y divide-[#F3F4F6] overflow-y-auto">
          {transferCandidates.length === 0 ? (
            <li className="px-4 py-10 text-center text-[14px] text-[#9CA3AF]">暂无可转让的成员</li>
          ) : (
            transferCandidates.map((m) => (
              <li key={m.charId}>
                <Pressable
                  type="button"
                  onClick={() => void transferOwnerTo(m.charId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[#F9FAFB]"
                >
                  <div className="shrink-0 pl-1 pt-1">
                    <GroupMemberAvatarWithRanks
                      avatarUrl={resolveMemberAvatar(m.charId)}
                      role={m.role}
                      speechBlocked={groupMemberSpeechBlockedInGroup(m, muteNowMs)}
                      botMuteExpiresAt={m.botViolation?.muteExpiresAt ?? null}
                      sizePx={44}
                      roundedClassName="rounded-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {(() => {
                      const { primary, remarkSub } = groupMemberGridLabels(m, playerDisplayName, contactRemarkForChar(m.charId))
                      return (
                        <>
                          <p className="truncate text-[16px] text-[#111827]">{primary}</p>
                          {remarkSub ? (
                            <p className="mt-0.5 truncate text-[12px] text-[#9CA3AF]">备注 {remarkSub}</p>
                          ) : null}
                          {m.role === 'admin' ? <p className="mt-0.5 text-[12px] text-[#9CA3AF]">当前为管理员</p> : null}
                        </>
                      )
                    })()}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={2} aria-hidden />
                </Pressable>
              </li>
            ))
          )}
        </ul>
      </div>,
    )
  }

  if (sub === 'avatar') {
    const preview = group.avatar?.trim()
    const persistAvatar = async (next: string) => {
      await personaDb.putGroupChat({ ...group, avatar: next, updatedAt: Date.now() })
      emitWeChatStorageChanged()
      await load()
    }

    const applyUrl = async () => {
      const t = avatarUrlDraft.trim()
      if (!t) {
        window.alert('请输入图片地址')
        return
      }
      await persistAvatar(t)
      setSub('main')
    }

    const clearAvatar = async () => {
      if (!window.confirm('清除当前群头像？')) return
      await persistAvatar('')
      setSub('main')
    }

    const onPickLocalImage = (file: File | null) => {
      if (!file || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : ''
        if (src) setAvatarCropSrc(src)
      }
      reader.readAsDataURL(file)
    }

    return wrapWithPermPortal(
      <div className="absolute inset-0 z-[20] flex min-h-0 flex-col bg-[#F3F4F6]">
        <ImageCropperModal
          open={!!avatarCropSrc}
          imageSrc={avatarCropSrc}
          title="裁剪群头像（1:1）"
          aspect={1}
          maxSide={1080}
          objectFit="contain"
          onCancel={() => setAvatarCropSrc('')}
          onConfirm={async (dataUrl) => {
            try {
              const next = await compressAvatarDataUrl(dataUrl, MAX_AVATAR_DATA_URL_LEN)
              if (next.length > MAX_AVATAR_DATA_URL_LEN) {
                window.alert('图片过大，请选择较小的图片或使用网络地址。')
                return
              }
              await persistAvatar(next)
              setAvatarCropSrc('')
              setSub('main')
            } catch {
              window.alert('图片处理失败，请换一张图片重试。')
            }
          }}
        />
        <input
          ref={avatarFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPickLocalImage(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
        <header
          className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center">
            <Pressable type="button" onClick={() => setSub('main')} className="flex h-10 w-10 items-center justify-center rounded-full">
              <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
            </Pressable>
            <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群头像</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-6">
          <div className="mx-auto flex w-full max-w-[200px] flex-col items-center">
            <div
              className="relative w-full overflow-hidden rounded-[12px] bg-[#E5E7EB]"
              style={{ aspectRatio: '1 / 1' }}
            >
              {preview ? (
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-[15px] text-[#9CA3AF]">预览</div>
              )}
            </div>
            <p className="mt-2 text-center text-[12px] text-[#9CA3AF]">展示区域为 1:1，网络地址将按此比例居中裁切显示</p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-[400px] space-y-3 rounded-[12px] border border-[#F3F4F6] bg-white p-4">
            <label className="block text-[13px] text-[#6B7280]">图片地址（http(s) 或 data URL）</label>
            <input
              value={avatarUrlDraft}
              onChange={(e) => setAvatarUrlDraft(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-[15px] text-[#111827] outline-none focus:border-[#111827]"
            />
            <Pressable
              type="button"
              onClick={() => void applyUrl()}
              className="flex w-full items-center justify-center rounded-[10px] bg-[#111827] py-3 text-[16px] font-medium text-white active:opacity-90"
            >
              应用地址
            </Pressable>
            <Pressable
              type="button"
              onClick={() => avatarFileRef.current?.click()}
              className="flex w-full items-center justify-center rounded-[10px] border border-[#E5E7EB] bg-white py-3 text-[16px] font-medium text-[#111827] active:bg-[#F9FAFB]"
            >
              从本地选择并裁剪（1:1）
            </Pressable>
            {preview ? (
              <Pressable
                type="button"
                onClick={() => void clearAvatar()}
                className="flex w-full items-center justify-center rounded-[10px] py-3 text-[16px] font-medium text-[#DC2626] active:opacity-80"
              >
                清除群头像
              </Pressable>
            ) : null}
          </div>
        </div>
      </div>,
    )
  }

  const myNick = group.members.find((m) => m.charId === WECHAT_GROUP_USER_CHAR_ID)?.groupNickname ?? ''

  const renameGroup = async () => {
    const v = window.prompt('群聊名称', group.name)
    if (v == null) return
    const nextName = v.trim().slice(0, 64) || group.name
    if (nextName === group.name) return
    const actor = playerDisplayName.trim() || '我'
    const safeName = nextName.replace(/"/g, "'")
    await personaDb.putGroupChat({ ...group, name: nextName, updatedAt: Date.now() })
    emitWeChatStorageChanged()
    await load()
    await appendGroupChatEventNotice({
      groupId: group.id,
      playerIdentityId,
      displayText: `${actor}更换了群聊名称为"${safeName}"`,
    })
  }

  const renameRemark = async () => {
    const v = window.prompt('群备注（仅自己可见）', group.remark)
    if (v == null) return
    await personaDb.putGroupChat({ ...group, remark: v.trim().slice(0, 64), updatedAt: Date.now() })
    emitWeChatStorageChanged()
    await load()
  }

  const persistAnnouncement = async (text: string) => {
    if (!group || !canOwnerLevel) return
    const t = text.trim().slice(0, 2000)
    await personaDb.putGroupChat({ ...group, announcement: t, updatedAt: Date.now() })
    emitWeChatStorageChanged()
    await load()
    const actor = playerDisplayName.trim() || '我'
    await appendGroupChatEventNotice({
      groupId: group.id,
      playerIdentityId,
      displayText: `${actor}修改了新的群公告内容`,
    })
  }

  const renameSelfNick = async () => {
    const v = window.prompt('我在本群的昵称', myNick || playerDisplayName)
    if (v == null) return
    const next = v.trim().slice(0, 32) || '我'
    const prev = (myNick || '').trim() || playerDisplayName.trim() || '我'
    if (next === prev) return
    const members = group.members.map((m) =>
      m.charId === WECHAT_GROUP_USER_CHAR_ID ? { ...m, groupNickname: next } : m,
    )
    await persistMembers(members)
    const actor = playerDisplayName.trim() || '我'
    const safeNick = next.replace(/"/g, "'")
    await appendGroupChatEventNotice({
      groupId: group.id,
      playerIdentityId,
      displayText: `${actor}更改了自己的群昵称为"${safeNick}"`,
    })
  }

  const leaveOrDissolve = async (dissolve: boolean) => {
    const ok = window.confirm(dissolve ? '解散后将删除群聊与聊天记录，不可恢复。' : '将删除本地群聊与记录，不可恢复。')
    if (!ok) return
    await personaDb.deleteGroupChat(group.id, playerIdentityId)
    emitWeChatStorageChanged()
    onAfterLeave()
  }

  return wrapWithPermPortal(
    <div className="relative flex h-full min-h-0 flex-col bg-[#F3F4F6]">
      <header className="shrink-0 border-b border-[#F3F4F6] bg-white px-3 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center">
          <Pressable type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft className="size-5 text-[#111827]" strokeWidth={2} />
          </Pressable>
          <h1 className="flex-1 text-center text-[17px] font-semibold text-[#111827]">群聊信息</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mx-0 mt-3 overflow-visible bg-white px-4 py-4">
          <div className="grid grid-cols-5 gap-x-2 gap-y-4 overflow-visible">
            {gridMembers.map((m) => {
              const { primary, remarkSub } = groupMemberGridLabels(m, playerDisplayName, contactRemarkForChar(m.charId))
              return (
                <div key={m.charId} className="flex min-h-0 flex-col items-center overflow-visible pt-1.5 pl-1.5">
                  <GroupMemberAvatarWithRanks
                    avatarUrl={resolveMemberAvatar(m.charId)}
                    role={m.role}
                    speechBlocked={groupMemberSpeechBlockedInGroup(m, muteNowMs)}
                    botMuteExpiresAt={m.botViolation?.muteExpiresAt ?? null}
                    sizePx={52}
                    roundedClassName="rounded-[10px]"
                  />
                  <p className="mt-1 line-clamp-2 w-full text-center text-[11px] leading-tight text-[#111827]">{primary}</p>
                  {remarkSub ? (
                    <p className="line-clamp-1 w-full text-center text-[10px] leading-tight text-[#9CA3AF]">备注 {remarkSub}</p>
                  ) : null}
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => setSub('add')}
              className="flex flex-col items-center gap-1"
              aria-label="添加成员"
            >
              <span className="flex size-[52px] items-center justify-center rounded-[10px] border border-dashed border-[#9CA3AF] bg-white text-[#111827]">
                <Plus className="size-5" strokeWidth={2} />
              </span>
              <span className="text-[11px] text-[#9CA3AF]">添加</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canAdminLevel) {
                  openPermDialog(PERM_MSG_NEED_ADMIN)
                  return
                }
                openKick()
              }}
              className="flex flex-col items-center gap-1"
              aria-label="移除成员"
            >
              <span className="flex size-[52px] items-center justify-center rounded-[10px] border border-dashed border-[#9CA3AF] bg-white text-[#111827]">
                <Minus className="size-5" strokeWidth={2} />
              </span>
              <span className="text-[11px] text-[#9CA3AF]">移除</span>
            </button>
          </div>
          <p className="mt-3 text-center text-[13px] text-[#9CA3AF]">群聊 ({gridMembers.length})</p>
          <p className="mt-1 px-1 text-center text-[11px] leading-relaxed text-[#9CA3AF]">
            头像下为各成员在本群的昵称；与通讯录备注不一致时显示灰色备注行。点下方「我在本群的昵称」可改自己的展示名。
          </p>
        </div>

        <div className="mx-3 mt-3 overflow-hidden rounded-[12px] bg-white shadow-sm">
          <Pressable
            type="button"
            onClick={() => {
              setAnnounceModalOpen(true)
              setAnnounceEditing(false)
              setAnnounceDraft((group.announcement ?? '').trim())
            }}
            className="flex w-full flex-col px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[16px] font-semibold text-[#111827]">群公告</span>
              <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={2} aria-hidden />
            </div>
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[#6B7280]">
              {(() => {
                const t = (group.announcement ?? '').trim()
                if (!t) return '暂无群公告'
                return t.length > 30 ? `${t.slice(0, 30)}…` : t
              })()}
            </p>
            <p className="mt-2 text-[11px] text-[#9CA3AF]">全员可见 · 仅当你的成员身份为群主时可编辑</p>
          </Pressable>
        </div>

        <div className="mx-3 mt-3 overflow-hidden rounded-[12px] bg-white shadow-sm">
          <Pressable
            type="button"
            onClick={() => setSub('robot')}
            className="flex w-full flex-col px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[16px] font-semibold text-[#111827]">群管家敏感词（触发规则）</span>
              <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={2} aria-hidden />
            </div>
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[#6B7280]">{groupRobotRulesPublicPreview}</p>
            <p className="mt-2 text-[11px] text-[#9CA3AF]">全员可见 · 与群公告相同；群主或管理员可编辑规则与群管家头像</p>
          </Pressable>
        </div>

        <div className="mt-3 overflow-hidden bg-white">
          <Cell
            label="群聊名称"
            value={group.name}
            onClick={() => {
              if (!canAdminLevel) {
                openPermDialog(PERM_MSG_NEED_ADMIN)
                return
              }
              void renameGroup()
            }}
            borderBottom
          />
          <Pressable
            type="button"
            onClick={() => setSub('avatar')}
            className="flex w-full items-center justify-between border-b border-[#F3F4F6] bg-white px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <span className="text-[16px] text-[#111827]">群头像</span>
            <div className="flex min-w-0 max-w-[70%] items-center gap-2">
              {group.avatar?.trim() ? (
                <img src={group.avatar.trim()} alt="" className="size-9 shrink-0 rounded-[8px] object-cover" />
              ) : (
                <span className="truncate text-[14px] text-[#9CA3AF]">未设置</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={2} aria-hidden />
            </div>
          </Pressable>
          <Cell label="群备注" value={group.remark ? group.remark : '未设置'} onClick={() => void renameRemark()} borderBottom />
          <Cell label="我在本群的昵称" value={myNick || playerDisplayName} onClick={() => void renameSelfNick()} borderBottom />
          <Pressable
            type="button"
            onClick={() => {
              if (!canOwnerLevel) {
                openPermDialog(PERM_MSG_NEED_OWNER)
                return
              }
              setSub('transfer')
            }}
            className="flex w-full items-center justify-between border-b border-[#F3F4F6] bg-white px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <span className="text-[16px] text-[#111827]">转让群主</span>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[14px] text-[#9CA3AF]">选择成员</span>
              <ChevronRight className="size-4 text-[#D1D5DB]" strokeWidth={2} aria-hidden />
            </div>
          </Pressable>
          <Cell
            label="群管理"
            value=""
            onClick={() => {
              if (!canAdminLevel) {
                openPermDialog(PERM_MSG_NEED_ADMIN)
                return
              }
              setSub('mgmt')
            }}
            borderBottom
          />
          <Pressable
            type="button"
            onClick={() => setSub('chat-bg')}
            className="flex w-full items-center justify-between border-b border-[#F3F4F6] bg-white px-4 py-3 text-left active:bg-[#F9FAFB]"
          >
            <span className="text-[16px] text-[#111827]">设置当前聊天背景</span>
            <ChevronRight className="size-4 shrink-0 text-[#D1D5DB]" strokeWidth={2} aria-hidden />
          </Pressable>
          <div className="flex w-full items-center justify-between border-b border-[#F3F4F6] bg-white px-4 py-3">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-[16px] text-[#111827]">显示成员昵称</p>
              <p className="mt-0.5 text-[12px] text-[#9CA3AF]">在聊天室气泡上方展示发送者群昵称</p>
            </div>
            <WxSwitch
              on={convSettings?.showGroupMemberNicknameInChat !== false}
              onToggle={() =>
                void patchConvSettings({
                  showGroupMemberNicknameInChat: !(convSettings?.showGroupMemberNicknameInChat !== false),
                })
              }
            />
          </div>
          <div className="flex w-full items-center justify-between border-b border-[#F3F4F6] bg-white px-4 py-3">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-[16px] text-[#111827]">显示群头衔</p>
              <p className="mt-0.5 text-[12px] text-[#9CA3AF]">在聊天室发言者头像左上角显示群主、管理员标识</p>
            </div>
            <WxSwitch
              on={!!convSettings?.showGroupRankBadgesInChat}
              onToggle={() =>
                void patchConvSettings({
                  showGroupRankBadgesInChat: !convSettings?.showGroupRankBadgesInChat,
                })
              }
            />
          </div>
          <div className="flex w-full items-center justify-between bg-white px-4 py-3">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-[16px] text-[#111827]">弹幕模式</p>
              <p className="mt-0.5 text-[12px] text-[#9CA3AF]">群内弹幕即将开放，开关暂不可用</p>
            </div>
            <WxSwitch on={!!convSettings?.isDanmakuMode} disabled onToggle={() => {}} />
          </div>
        </div>

        <div className="mx-4 mt-8 space-y-3">
          {owner ? (
            <Pressable
              type="button"
              onClick={() => void leaveOrDissolve(true)}
              className="flex w-full items-center justify-center rounded-[10px] bg-white py-3 text-[16px] font-medium text-[#111827]"
              style={{ border: '1px solid #F3F4F6' }}
            >
              解散该群
            </Pressable>
          ) : null}
          <Pressable
            type="button"
            onClick={() => void leaveOrDissolve(false)}
            className="flex w-full items-center justify-center rounded-[10px] bg-white py-3 text-[16px] font-medium text-[#DC2626]"
            style={{ border: '1px solid #F3F4F6' }}
          >
            删除并退出
          </Pressable>
        </div>
      </div>

      {announceModalOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-announce-title"
          onClick={() => {
            setAnnounceModalOpen(false)
            setAnnounceEditing(false)
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[16px] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#F3F4F6] px-4 py-3">
              <h2 id="group-announce-title" className="text-[17px] font-semibold text-[#111827]">
                群公告
              </h2>
              <Pressable
                type="button"
                className="py-1 text-[15px] text-[#6B7280]"
                onClick={() => {
                  setAnnounceModalOpen(false)
                  setAnnounceEditing(false)
                }}
              >
                关闭
              </Pressable>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {announceEditing && canOwnerLevel ? (
                <>
                  <textarea
                    value={announceDraft}
                    onChange={(e) => setAnnounceDraft(e.target.value.slice(0, 2000))}
                    placeholder="填写群公告，全员可见"
                    className="min-h-[200px] w-full resize-y rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-left text-[15px] text-[#111827] outline-none focus:border-[#111827]"
                  />
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">{announceDraft.length}/2000</p>
                  <div className="mt-4 flex gap-2 pb-4">
                    <Pressable
                      type="button"
                      className="flex flex-1 items-center justify-center rounded-[10px] bg-[#111827] py-3 text-[15px] font-medium text-white"
                      onClick={() => {
                        void (async () => {
                          await persistAnnouncement(announceDraft)
                          setAnnounceEditing(false)
                          setAnnounceModalOpen(false)
                        })()
                      }}
                    >
                      保存
                    </Pressable>
                    <Pressable
                      type="button"
                      className="flex flex-1 items-center justify-center rounded-[10px] border border-[#E5E7EB] py-3 text-[15px] text-[#111827]"
                      onClick={() => {
                        setAnnounceEditing(false)
                        setAnnounceDraft((group.announcement ?? '').trim())
                      }}
                    >
                      取消编辑
                    </Pressable>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex min-h-[min(52vh,360px)] flex-col items-center justify-center py-6">
                    <div className="mx-auto w-full max-w-full whitespace-pre-wrap text-center text-[15px] leading-relaxed text-[#374151]">
                      {(group.announcement ?? '').trim() ? (group.announcement ?? '').trim() : '暂无群公告'}
                    </div>
                  </div>
                  {canOwnerLevel ? (
                    <Pressable
                      type="button"
                      className="mx-auto mt-2 flex w-full max-w-xs shrink-0 items-center justify-center rounded-[10px] border border-[#E5E7EB] py-3 text-[15px] font-medium text-[#111827]"
                      onClick={() => {
                        setAnnounceEditing(true)
                        setAnnounceDraft((group.announcement ?? '').trim())
                      }}
                    >
                      编辑群公告
                    </Pressable>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>,
  )
}

/** 创建群并跳转所需的最小封装（供设置页 / 消息页调用） */
export async function createWeChatGroupAndSeedConversation(params: {
  playerIdentityId: string
  playerDisplayName: string
  characterIds: string[]
  nickByCharacterId: Record<string, string>
  groupName?: string
}): Promise<{ groupId: string; conversationKey: string }> {
  const id = uid('wxgrp')
  const peerId = wechatGroupPeerCharacterId(id)
  const convKey = wechatGroupConversationKey(id, params.playerIdentityId)
  const row = buildNewGroupChatRow({
    id,
    playerIdentityId: params.playerIdentityId,
    name: params.groupName?.trim() || '群聊',
    playerDisplayName: params.playerDisplayName,
    characterIds: params.characterIds,
    nickByCharacterId: params.nickByCharacterId,
  })
  await personaDb.putGroupChat(row)
  await personaDb.upsertChatConversationSettings({
    conversationKey: convKey,
    peerCharacterId: peerId,
    playerIdentityId: params.playerIdentityId,
  })
  emitWeChatStorageChanged()
  return { groupId: id, conversationKey: convKey }
}
