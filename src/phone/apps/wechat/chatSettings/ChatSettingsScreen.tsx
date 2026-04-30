import { ArrowLeft, ChevronRight, Clock, Phone, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { Pressable } from '../../../components/Pressable'
import type {
  ChatConversationSettingsRow,
  CharacterBusySettingsRow,
  CharacterNotificationSettingsRow,
  WeChatGlobalSettingsRow,
} from '../newFriendsPersona/types'
import { personaDb } from '../newFriendsPersona/idb'
import { ChatTimeSettingsScreen } from './ChatTimeSettingsScreen'
import { ChatFindChatHistoryScreen } from './ChatFindChatHistoryScreen'

function WxSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? '#000000' : '#cccccc' }}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
        style={{ left: on ? 26 : 4 }}
        aria-hidden
      />
    </button>
  )
}

function SettingsListCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-4 mt-4 overflow-hidden rounded-[12px] bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {children}
    </div>
  )
}

function ListRow({
  children,
  onClick,
  borderBottom,
}: {
  children: React.ReactNode
  onClick?: () => void
  borderBottom?: boolean
}) {
  const style = { borderBottom: borderBottom ? '1px solid #f2f2f7' : undefined }
  if (onClick) {
    return (
      <Pressable
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
        style={style}
      >
        {children}
      </Pressable>
    )
  }
  return (
    <div className="flex w-full items-center justify-between px-4 py-4" style={style}>
      {children}
    </div>
  )
}

type StubKind = 'chat-bg' | 'voice' | 'complaint'

const STUB_TITLES: Record<StubKind, string> = {
  'chat-bg': '设置当前聊天背景',
  voice: '主动语音电话',
  complaint: '投诉',
}

export type ChatSettingsScreenProps = {
  conversationKey: string
  peerCharacterId: string
  playerIdentityId: string
  peerDisplayName: string
  peerAvatarUrl?: string
  /** 打开「人设编辑」时使用的角色 id；Lumi 未绑人设时为 null */
  personaEditTargetId: string | null
  /** 通讯录人设（用于邀请群聊多选） */
  personaContacts: Array<{ characterId: string; remarkName: string; avatarUrl?: string }>
  onClose: () => void
  onOpenPersonaEdit: (characterId: string) => void
  onOpenGroupChat: (groupId: string) => void
  /** 查找聊天记录：定位到消息后关闭设置并回聊天页 */
  onJumpToChatMessage: (messageId: string) => void
  /** 点击对方头像进入联系人资料卡 */
  onOpenPeerProfile?: () => void
}

export function ChatSettingsScreen({
  conversationKey,
  peerCharacterId,
  playerIdentityId,
  peerDisplayName,
  peerAvatarUrl,
  personaEditTargetId,
  personaContacts,
  onClose,
  onOpenPersonaEdit,
  onOpenGroupChat,
  onJumpToChatMessage,
  onOpenPeerProfile,
}: ChatSettingsScreenProps) {
  const [settings, setSettings] = useState<ChatConversationSettingsRow | null>(null)
  const [gs, setGs] = useState<WeChatGlobalSettingsRow | null>(null)
  const [characterNotify, setCharacterNotify] = useState<CharacterNotificationSettingsRow | null>(null)
  const [characterBusy, setCharacterBusy] = useState<CharacterBusySettingsRow | null>(null)
  const [globalModeBusyEnabled, setGlobalModeBusyEnabled] = useState(true)
  const [findHistoryOpen, setFindHistoryOpen] = useState(false)
  const [stub, setStub] = useState<StubKind | null>(null)
  const [chatBgDraft, setChatBgDraft] = useState('')
  const [chatBgCropSrc, setChatBgCropSrc] = useState<string | null>(null)
  const [timeSettingsOpen, setTimeSettingsOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [selectedInvite, setSelectedInvite] = useState<Set<string>>(() => new Set())
  const chatBgFileRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    const [row, nextGs] = await Promise.all([personaDb.getChatConversationSettings(conversationKey), personaDb.getGlobalSettings()])
    setSettings(row)
    setGs(nextGs)
    if (nextGs.notificationMode === 'character') {
      const cn = await personaDb.getCharacterNotificationSettings(peerCharacterId)
      setCharacterNotify(cn)
    } else {
      setCharacterNotify(null)
    }
    if (nextGs.busyMode === 'character') {
      const cb = await personaDb.getCharacterBusySettings(peerCharacterId)
      setCharacterBusy(cb)
    } else {
      setCharacterBusy(null)
      const kv = await personaDb.getPhoneKv(`busy-conv:${conversationKey}`)
      setGlobalModeBusyEnabled(typeof kv === 'boolean' ? kv : true)
    }
  }, [conversationKey, peerCharacterId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onChange = () => void load()
    window.addEventListener('wechat-storage-changed', onChange)
    return () => window.removeEventListener('wechat-storage-changed', onChange)
  }, [load])

  const defaults = useMemo(
    () => ({
      isPinned: false,
      isMuted: false,
      hiddenFromMessageList: false,
      notifyEnabled: true,
      showThinkingChain: false,
      isDanmakuMode: false,
      chatBackground: '',
      lastMessageTime: 0,
    }),
    [],
  )

  const effective = settings
    ? settings
    : ({
        conversationKey,
        peerCharacterId,
        playerIdentityId,
        ...defaults,
        updatedAt: 0,
      } satisfies ChatConversationSettingsRow)

  const effectiveNotifyEnabled =
    gs?.notificationMode === 'character' ? (characterNotify?.notificationEnabled ?? true) : effective.notifyEnabled

  const toggleNotify = useCallback(async () => {
    const next = !effectiveNotifyEnabled
    if (gs?.notificationMode === 'character') {
      await personaDb.putCharacterNotificationSettings({ characterId: peerCharacterId, notificationEnabled: next })
    } else {
      await personaDb.upsertChatConversationSettings({
        conversationKey,
        peerCharacterId,
        playerIdentityId,
        notifyEnabled: next,
      })
    }
    await load()
  }, [
    conversationKey,
    peerCharacterId,
    playerIdentityId,
    effectiveNotifyEnabled,
    gs?.notificationMode,
    load,
  ])

  const effectiveBusyEnabled = gs?.busyMode === 'character' ? (characterBusy?.enabled ?? true) : globalModeBusyEnabled
  const toggleBusy = useCallback(async () => {
    const next = !effectiveBusyEnabled
    if (gs?.busyMode === 'character') {
      await personaDb.putCharacterBusySettings({
        characterId: peerCharacterId,
        enabled: next,
        ...(next ? {} : { isBusy: false, busyEndTime: 0, busyReason: '', busyMessages: [] }),
      })
    } else {
      await personaDb.setPhoneKv(`busy-conv:${conversationKey}`, next)
      window.dispatchEvent(new Event('wechat-storage-changed'))
    }
    await load()
  }, [effectiveBusyEnabled, gs?.busyMode, peerCharacterId, conversationKey, load])

  const patch = useCallback(
    async (partial: Partial<Pick<ChatConversationSettingsRow, 'isPinned' | 'isDanmakuMode' | 'chatBackground'>>) => {
      await personaDb.upsertChatConversationSettings({
        conversationKey,
        peerCharacterId,
        playerIdentityId,
        ...partial,
      })
      await load()
    },
    [conversationKey, peerCharacterId, playerIdentityId, load],
  )

  const toggleMute = useCallback(async () => {
    await personaDb.updateMuteStatus({
      conversationKey,
      peerCharacterId,
      playerIdentityId,
      isMuted: !effective.isMuted,
    })
    await load()
  }, [conversationKey, peerCharacterId, playerIdentityId, effective.isMuted, load])

  const togglePin = useCallback(async () => {
    const next = !effective.isPinned
    await personaDb.updatePinnedStatus({
      conversationKey,
      peerCharacterId,
      playerIdentityId,
      isPinned: next,
    })
    await load()
  }, [conversationKey, peerCharacterId, playerIdentityId, effective.isPinned, load])

  const inviteCandidates = useMemo(
    () => personaContacts.filter((c) => c.characterId !== peerCharacterId),
    [personaContacts, peerCharacterId],
  )

  const toggleInvite = (id: string) => {
    setSelectedInvite((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createGroup = async () => {
    const extra = Array.from(selectedInvite)
    if (extra.length === 0) {
      window.alert('请至少选择一位联系人')
      return
    }
    const memberIds = [peerCharacterId, ...extra]
    const names = [
      peerDisplayName,
      ...extra.map((id) => personaContacts.find((c) => c.characterId === id)?.remarkName || id),
    ]
    const name = names.slice(0, 3).join('、') + (names.length > 3 ? '…' : '')
    const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    await personaDb.putGroupChat({
      id,
      name: name || '群聊',
      avatar: '',
      memberIds,
      createdAt: now,
      updatedAt: now,
    })
    setInviteOpen(false)
    setSelectedInvite(new Set())
    onClose()
    onOpenGroupChat(id)
  }

  useEffect(() => {
    if (stub !== 'chat-bg') return
    setChatBgDraft((effective.chatBackground ?? '').trim())
  }, [stub, effective.chatBackground])

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

  if (stub === 'chat-bg') {
    const draftTrimmed = chatBgDraft.trim()
    const currentTrimmed = (effective.chatBackground ?? '').trim()
    const canApply = draftTrimmed.length > 0 && draftTrimmed !== currentTrimmed
    const canReset = currentTrimmed.length > 0
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#ededed]">
        <header
          className="shrink-0 border-b border-[#e5e5e5] bg-[#ededed] px-3 pb-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex w-full items-center">
            <Pressable
              type="button"
              aria-label="返回"
              onClick={() => setStub(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            >
              <ArrowLeft className="size-5 text-black" strokeWidth={2} />
            </Pressable>
            <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">设置当前聊天背景</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <div className="rounded-[12px] bg-white px-4 py-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-[15px] font-medium text-black">图片地址（URL）</p>
            <input
              value={draftTrimmed.startsWith('data:') ? '' : chatBgDraft}
              onChange={(e) => setChatBgDraft(e.target.value)}
              placeholder="https://... 粘贴图片链接"
              className="mt-2 h-11 w-full rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-black outline-none"
            />
            <p className="mt-2 text-[12px] text-[#8e8e8e]">
              支持 URL 与本地上传二选一；本地上传会进入 9:16 裁剪后应用到当前聊天。
            </p>
            <div className="mt-3 overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-[#f7f7f7]" style={{ aspectRatio: '9 / 16' }}>
              {draftTrimmed ? (
                <img src={draftTrimmed} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[12px] text-[#8e8e8e]">当前使用默认聊天背景</div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pressable
                type="button"
                onClick={() => chatBgFileRef.current?.click()}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-black bg-black px-4 text-[13px] text-white"
              >
                本地上传并裁剪（9:16）
              </Pressable>
              <Pressable
                type="button"
                disabled={!canApply}
                onClick={() => {
                  void (async () => {
                    await patch({ chatBackground: draftTrimmed })
                    setStub(null)
                  })()
                }}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#d0d0d0] bg-white px-4 text-[13px] text-black disabled:opacity-45"
              >
                应用到当前聊天
              </Pressable>
              <Pressable
                type="button"
                disabled={!canReset}
                onClick={() => {
                  void (async () => {
                    await patch({ chatBackground: '' })
                    setChatBgDraft('')
                    setStub(null)
                  })()
                }}
                className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#d0d0d0] bg-white px-4 text-[13px] text-black disabled:opacity-45"
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
          title="裁剪聊天背景（9:16）"
          aspect={9 / 16}
          maxSide={1440}
          objectFit="vertical-cover"
          onCancel={() => setChatBgCropSrc(null)}
          onConfirm={(dataUrl) => {
            setChatBgCropSrc(null)
            setChatBgDraft(dataUrl)
          }}
        />
      </div>
    )
  }

  if (stub) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#ededed]">
        <header
          className="shrink-0 border-b border-[#e5e5e5] bg-[#ededed] px-3 pb-3"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex w-full items-center">
            <Pressable
              type="button"
              aria-label="返回"
              onClick={() => setStub(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            >
              <ArrowLeft className="size-5 text-black" strokeWidth={2} />
            </Pressable>
            <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">{STUB_TITLES[stub]}</h1>
            <div className="w-10 shrink-0" />
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
          <p className="text-center text-[15px] text-[#8e8e8e]">功能开发中，敬请期待</p>
        </div>
        <div className="shrink-0 pb-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }} />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#ededed]">
      <header
        className="flex shrink-0 items-center gap-2 border-b border-[#e5e5e5] bg-[#ededed] px-3 pb-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex w-full items-center">
          <Pressable
            type="button"
            aria-label="返回聊天"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-5 text-black" strokeWidth={2} />
          </Pressable>
          <h1 className="min-w-0 flex-1 text-center text-[18px] font-bold text-black">聊天信息</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* 顶部群聊邀请区 */}
        <div
          className="mx-4 mt-4 rounded-[12px] bg-white px-5 py-5"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <div className="-mx-1 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-[60px] shrink-0 flex-col items-center">
              {onOpenPeerProfile ? (
                <Pressable
                  type="button"
                  onClick={onOpenPeerProfile}
                  className="flex w-[60px] flex-col items-center border-0 bg-transparent p-0 text-left"
                  aria-label="查看联系人资料"
                >
                  <div
                    className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full border bg-[#f2f2f7]"
                    style={{ borderColor: '#e5e5e5' }}
                  >
                    {peerAvatarUrl?.trim() ? (
                      <img src={peerAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-center text-[12px] text-black" style={{ marginTop: 4 }}>
                    {peerDisplayName}
                  </p>
                </Pressable>
              ) : (
                <>
                  <div
                    className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full border bg-[#f2f2f7]"
                    style={{ borderColor: '#e5e5e5' }}
                  >
                    {peerAvatarUrl?.trim() ? (
                      <img src={peerAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-center text-[12px] text-black" style={{ marginTop: 4 }}>
                    {peerDisplayName}
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              className="flex w-[60px] shrink-0 flex-col items-center border-0 bg-transparent p-0"
              onClick={() => {
                setSelectedInvite(new Set())
                setInviteOpen(true)
              }}
            >
              <div
                className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border border-dashed bg-white"
                style={{ borderColor: '#c7c7cc' }}
              >
                <Plus className="size-6 text-[#8e8e8e]" strokeWidth={2} />
              </div>
              <p className="text-center text-[12px] text-[#8e8e8e]" style={{ marginTop: 4 }}>
                邀请
              </p>
            </button>
          </div>
        </div>

        {/* 功能列表 */}
        <SettingsListCard>
          <ListRow onClick={() => setFindHistoryOpen(true)} borderBottom>
            <span className="text-[16px] text-black">查找聊天记录</span>
            <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
          <ListRow borderBottom>
            <span className="text-[16px] text-black">消息免打扰</span>
            <WxSwitch on={effective.isMuted} onToggle={() => void toggleMute()} />
          </ListRow>
          <ListRow borderBottom>
            <span className="text-[16px] text-black">通知提醒</span>
            <WxSwitch on={effectiveNotifyEnabled} onToggle={() => void toggleNotify()} />
          </ListRow>
          <ListRow borderBottom>
            <span className="text-[16px] text-black">开启忙碌</span>
            <WxSwitch on={effectiveBusyEnabled} onToggle={() => void toggleBusy()} />
          </ListRow>
          <ListRow borderBottom>
            <span className="text-[16px] text-black">置顶聊天</span>
            <WxSwitch on={effective.isPinned} onToggle={() => void togglePin()} />
          </ListRow>
          <ListRow onClick={() => setTimeSettingsOpen(true)} borderBottom>
            <span className="text-[16px] text-black">角色时间设置</span>
            <Clock className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
          <ListRow onClick={() => setStub('chat-bg')} borderBottom>
            <span className="text-[16px] text-black">设置当前聊天背景</span>
            <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
          <ListRow onClick={() => setStub('voice')} borderBottom>
            <span className="text-[16px] text-black">主动语音电话</span>
            <Phone className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
          <ListRow borderBottom>
            <span className="text-[16px] text-black">弹幕模式</span>
            <WxSwitch
              on={effective.isDanmakuMode}
              onToggle={() => void patch({ isDanmakuMode: !effective.isDanmakuMode })}
            />
          </ListRow>
          <ListRow
            onClick={() => {
              if (!personaEditTargetId) {
                window.alert('当前会话未关联可编辑的人设角色（Lumi 需在通讯录绑定人设后编辑）')
                return
              }
              onOpenPersonaEdit(personaEditTargetId)
            }}
            borderBottom
          >
            <span className="text-[16px] text-black">聊天设定</span>
            <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
          <ListRow
            onClick={() => setClearOpen(true)}
            borderBottom
          >
            <span className="text-[16px] text-black">清空聊天记录</span>
            <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
          <ListRow onClick={() => setStub('complaint')}>
            <span className="text-[16px] text-black">
              投诉
            </span>
            <ChevronRight className="size-4 shrink-0 text-[#c7c7cc]" aria-hidden />
          </ListRow>
        </SettingsListCard>

        <div className="h-5 shrink-0" style={{ minHeight: 'max(20px, env(safe-area-inset-bottom, 0px))' }} />
      </div>

      <ChatTimeSettingsScreen
        open={timeSettingsOpen}
        characterId={peerCharacterId}
        peerDisplayName={peerDisplayName}
        onClose={() => setTimeSettingsOpen(false)}
      />

      {/* 底部邀请面板 */}
      {inviteOpen ? (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end bg-black/40" role="presentation">
          <Pressable
            type="button"
            aria-label="关闭"
            className="min-h-0 flex-1"
            onClick={() => setInviteOpen(false)}
          >
            {null}
          </Pressable>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-h-[72vh] overflow-hidden rounded-t-[16px] bg-white"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="border-b border-[#f2f2f7] px-4 py-3">
              <p className="text-center text-[16px] font-semibold text-black">选择联系人</p>
            </div>
            <div className="max-h-[48vh] overflow-y-auto px-2 py-2">
              {inviteCandidates.length === 0 ? (
                <p className="px-3 py-6 text-center text-[14px] text-[#8e8e8e]">暂无可选角色，请先在「新的朋友」创建并同步到通讯录</p>
              ) : (
                inviteCandidates.map((c) => {
                  const checked = selectedInvite.has(c.characterId)
                  return (
                    <Pressable
                      key={c.characterId}
                      type="button"
                      onClick={() => toggleInvite(c.characterId)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border"
                        style={{
                          borderColor: '#c7c7cc',
                          background: checked ? '#000000' : '#ffffff',
                        }}
                        aria-hidden
                      >
                        {checked ? <span className="text-[12px] text-white">✓</span> : null}
                      </span>
                      <div
                        className="h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-[#f2f2f7]"
                        style={{ borderColor: '#e5e5e5' }}
                      >
                        {c.avatarUrl?.trim() ? (
                          <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-[16px] text-black">{c.remarkName}</span>
                    </Pressable>
                  )
                })
              )}
            </div>
            <div className="px-4 pt-2">
              <Pressable
                type="button"
                onClick={() => void createGroup()}
                className="flex w-full items-center justify-center rounded-xl bg-black py-3 text-[16px] font-medium text-white"
              >
                创建群聊
              </Pressable>
            </div>
          </motion.div>
        </div>
      ) : null}

      {clearOpen ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45 px-6">
          <div className="w-full max-w-[320px] rounded-[14px] bg-white p-5">
            <p className="text-[16px] leading-relaxed text-black">确定要清空所有聊天记录吗？清空后无法恢复</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-[15px] text-[#8e8e8e]"
                onClick={() => setClearOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-[15px] font-medium text-black"
                onClick={() => {
                  void (async () => {
                    await personaDb.deleteAllWeChatMessagesForConversation(conversationKey)
                    setClearOpen(false)
                    onClose()
                  })()
                }}
              >
                清空
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {findHistoryOpen ? (
          <motion.div
            key="wx-find-chat-history"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-[80] flex min-h-0 flex-col overflow-hidden bg-[#f5f5f5]"
          >
            <ChatFindChatHistoryScreen
              conversationKey={conversationKey}
              peerCharacterId={peerCharacterId}
              peerDisplayName={peerDisplayName}
              peerAvatarUrl={peerAvatarUrl}
              onBack={() => setFindHistoryOpen(false)}
              onJumpToChatMessage={(id) => {
                onJumpToChatMessage(id)
                setFindHistoryOpen(false)
                onClose()
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
