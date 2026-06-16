import { ArrowLeft, ChevronRight, Clock, Phone, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ImageCropperModal } from '../../../components/ImageCropperModal'
import { Pressable } from '../../../components/Pressable'
import { useCustomization } from '../../../CustomizationContext'
import type {
  ChatConversationSettingsRow,
  CharacterBusySettingsRow,
  CharacterNotificationSettingsRow,
  WeChatGlobalSettingsRow,
} from '../newFriendsPersona/types'
import {
  displayRoundTriggerPercent,
  IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT,
  IMAGE_DEFAULT_ROUND_COUNT_MIN,
  IMAGE_DEFAULT_ROUND_COUNT_MAX,
  IMAGE_ROUND_COUNT_MIN_LIMIT,
  IMAGE_ROUND_COUNT_MAX_LIMIT,
  clampImageRoundCount,
  formatImageRoundCountRangeLabel,
  isImageRoundCountRangeCustomized,
  isRoundTriggerCustomized,
  parseStoredImageRoundCountRange,
  VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT,
} from '../wechatMediaSendFrequency'
import { resolveProactiveMessageIntervalSeconds, hasProactiveMessageScheduleSaved, PROACTIVE_MESSAGE_NUMBER_FONT } from '../proactivePrivateMessageTypes'
import {
  drawProactiveVariableIntervalSeconds,
  formatProactiveVariableIntervalRangeLabel,
  isProactiveVariableIntervalEnabled,
  resolveCharacterExplicitBusyForProactive,
} from '../proactiveVariableInterval'
import { ProactiveMessageIntervalControl } from './ProactiveMessageIntervalControl'
import { personaDb } from '../newFriendsPersona/idb'
import { ChatTimeSettingsScreen } from './ChatTimeSettingsScreen'
import { ChatFindChatHistoryScreen } from './ChatFindChatHistoryScreen'
import { CreateGroupPickContactsSheet, type CreateGroupContactPick } from '../group/CreateGroupPickContactsSheet'

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

const roundTriggerNumStyle = { fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT } as const

function RoundTriggerPercentControl({
  kind,
  stored,
  onChange,
  onResetDefault,
}: {
  kind: 'voice' | 'sticker' | 'image'
  stored: number | undefined
  onChange: (percent: number) => void
  onResetDefault: () => void
}) {
  const display = displayRoundTriggerPercent(stored, kind)
  const customized = isRoundTriggerCustomized(stored)
  const defaultHint =
    kind === 'voice'
      ? `系统默认约 ${VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT}%`
      : kind === 'image'
        ? `默认 ${IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT}%（不发图）`
        : '系统默认由语境决定（无固定概率）'

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-black">
          {customized ? (
            <>
              <span style={roundTriggerNumStyle}>{display}%</span>
            </>
          ) : kind === 'voice' ? (
            <>
              系统默认约{' '}
              <span style={roundTriggerNumStyle}>{VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT}%</span>
            </>
          ) : kind === 'image' ? (
            <>
              默认 <span style={roundTriggerNumStyle}>{IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT}%</span>（不发图）
            </>
          ) : (
            defaultHint
          )}
        </span>
        {customized ? (
          <button
            type="button"
            onClick={onResetDefault}
            className="shrink-0 text-[12px] text-[#576b95]"
          >
            恢复默认
          </button>
        ) : null}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-black"
        aria-label={
          kind === 'voice'
            ? '语音消息每轮触发概率'
            : kind === 'image'
              ? 'AI 配图每轮触发概率'
              : '表情包每轮触发概率'
        }
      />
      <div className="mt-1 flex justify-between text-[11px] text-[#8e8e8e]">
        <span>
          <span style={roundTriggerNumStyle}>0%</span> 不发
        </span>
        <span>
          <span style={roundTriggerNumStyle}>100%</span> 每轮必发
        </span>
      </div>
    </div>
  )
}

function ImageRoundCountRangeControl({
  minStored,
  maxStored,
  onChange,
  onResetDefault,
}: {
  minStored?: number
  maxStored?: number
  onChange: (min: number, max: number) => void
  onResetDefault: () => void
}) {
  const range = parseStoredImageRoundCountRange(minStored, maxStored)
  const customized = isImageRoundCountRangeCustomized(minStored, maxStored)

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-black">
          {customized ? (
            <span style={roundTriggerNumStyle}>{formatImageRoundCountRangeLabel(range)}</span>
          ) : (
            <>
              默认{' '}
              <span style={roundTriggerNumStyle}>
                {IMAGE_DEFAULT_ROUND_COUNT_MIN}～{IMAGE_DEFAULT_ROUND_COUNT_MAX}
              </span>{' '}
              张
            </>
          )}
        </span>
        {customized ? (
          <button
            type="button"
            onClick={onResetDefault}
            className="shrink-0 text-[12px] text-[#576b95]"
          >
            恢复默认
          </button>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#8e8e8e]">
          <span>最少张数</span>
          <span style={roundTriggerNumStyle}>{range.min} 张</span>
        </div>
        <input
          type="range"
          min={IMAGE_ROUND_COUNT_MIN_LIMIT}
          max={IMAGE_ROUND_COUNT_MAX_LIMIT}
          step={1}
          value={range.min}
          onChange={(e) => {
            const min = clampImageRoundCount(Number(e.target.value))
            onChange(min, Math.max(min, range.max))
          }}
          className="mt-1 w-full accent-black"
          aria-label="AI 配图每次最少张数"
        />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[12px] text-[#8e8e8e]">
          <span>最多张数</span>
          <span style={roundTriggerNumStyle}>{range.max} 张</span>
        </div>
        <input
          type="range"
          min={IMAGE_ROUND_COUNT_MIN_LIMIT}
          max={IMAGE_ROUND_COUNT_MAX_LIMIT}
          step={1}
          value={range.max}
          onChange={(e) => {
            const max = clampImageRoundCount(Number(e.target.value))
            onChange(Math.min(range.min, max), max)
          }}
          className="mt-1 w-full accent-black"
          aria-label="AI 配图每次最多张数"
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[#8e8e8e]">
        <span>
          <span style={roundTriggerNumStyle}>{IMAGE_ROUND_COUNT_MIN_LIMIT}</span> 张
        </span>
        <span>
          <span style={roundTriggerNumStyle}>{IMAGE_ROUND_COUNT_MAX_LIMIT}</span> 张
        </span>
      </div>
    </div>
  )
}

function ListRow({
  children,
  onClick,
  borderBottom,
  stacked,
}: {
  children: React.ReactNode
  onClick?: () => void
  borderBottom?: boolean
  /** 标题在上、控件在下（用于频率分段选择） */
  stacked?: boolean
}) {
  const style = { borderBottom: borderBottom ? '1px solid #f2f2f7' : undefined }
  const layoutClass = stacked
    ? 'flex w-full flex-col items-stretch px-4 py-4 text-left'
    : 'flex w-full items-center justify-between px-4 py-4 text-left'
  if (onClick) {
    return (
      <Pressable type="button" onClick={onClick} className={layoutClass} style={style}>
        {children}
      </Pressable>
    )
  }
  return (
    <div className={layoutClass} style={style}>
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
  onClose: () => void
  onOpenPersonaEdit: (characterId: string) => void
  /** 查找聊天记录：定位到消息后关闭设置并回聊天页 */
  onJumpToChatMessage: (messageId: string) => void
  /** 点击对方头像进入联系人资料卡 */
  onOpenPeerProfile?: () => void
  /** 角色私聊：展示「主动消息」开关与频率配置 */
  showProactiveMessageSettings?: boolean
  /** 非空时展示「发起群聊」入口：与当前私聊对象一并拉群 */
  inviteGroupFromPeerCharacterId?: string | null
  personaContactsForGroup?: CreateGroupContactPick[]
  onInviteCreateGroup?: (extraCharacterIds: string[]) => void | Promise<void>
}

export function ChatSettingsScreen({
  conversationKey,
  peerCharacterId,
  playerIdentityId,
  peerDisplayName,
  peerAvatarUrl,
  personaEditTargetId,
  onClose,
  onOpenPersonaEdit,
  onJumpToChatMessage,
  onOpenPeerProfile,
  showProactiveMessageSettings = false,
  inviteGroupFromPeerCharacterId = null,
  personaContactsForGroup = [],
  onInviteCreateGroup,
}: ChatSettingsScreenProps) {
  const { state } = useCustomization()
  const disableTransitions = state.ui.disablePageTransitions
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
  const [clearOpen, setClearOpen] = useState(false)
  const [inviteGroupOpen, setInviteGroupOpen] = useState(false)
  const chatBgFileRef = useRef<HTMLInputElement | null>(null)

  const peerForInvite = inviteGroupFromPeerCharacterId?.trim() || ''
  const canInviteToGroup = !!peerForInvite && !!onInviteCreateGroup && personaContactsForGroup.length > 0

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
      showGroupMemberNicknameInChat: true,
      showGroupRankBadgesInChat: false,
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
    async (
      partial: Partial<
        Pick<
          ChatConversationSettingsRow,
          | 'isPinned'
          | 'isDanmakuMode'
          | 'chatBackground'
          | 'stickerRoundTriggerPercent'
          | 'voiceRoundTriggerPercent'
          | 'imageRoundTriggerPercent'
          | 'imageRoundCountMin'
          | 'imageRoundCountMax'
          | 'proactiveMessageEnabled'
          | 'proactiveMessageIntervalSeconds'
          | 'proactiveMessageLastFiredAtMs'
          | 'proactiveMessageVariableIntervalEnabled'
          | 'proactiveMessageNextIntervalSeconds'
        >
      > & {
        clearStickerRoundTriggerPercent?: boolean
        clearVoiceRoundTriggerPercent?: boolean
        clearImageRoundTriggerPercent?: boolean
        clearImageRoundCountRange?: boolean
        clearProactiveMessageIntervalSeconds?: boolean
      },
    ) => {
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

  const stickerStored = effective.stickerRoundTriggerPercent
  const voiceStored = effective.voiceRoundTriggerPercent
  const imageStored = effective.imageRoundTriggerPercent
  const imageCountMinStored = effective.imageRoundCountMin
  const imageCountMaxStored = effective.imageRoundCountMax
  const proactiveEnabled = effective.proactiveMessageEnabled ?? false
  const proactiveVariableEnabled = isProactiveVariableIntervalEnabled(effective)
  const proactiveIntervalSeconds = resolveProactiveMessageIntervalSeconds(effective)
  const proactiveScheduleSaved = hasProactiveMessageScheduleSaved(effective)
  const [proactiveIntervalSaving, setProactiveIntervalSaving] = useState(false)
  const [proactiveVariableBusyHint, setProactiveVariableBusyHint] = useState(false)

  useEffect(() => {
    if (!proactiveEnabled || !proactiveVariableEnabled) {
      setProactiveVariableBusyHint(false)
      return
    }
    let cancelled = false
    void (async () => {
      const busy = await resolveCharacterExplicitBusyForProactive({
        row: effective,
        now: Date.now(),
      })
      if (!cancelled) setProactiveVariableBusyHint(busy)
    })()
    return () => {
      cancelled = true
    }
  }, [proactiveEnabled, proactiveVariableEnabled, effective, conversationKey])

  const toggleProactiveMessage = useCallback(async () => {
    const next = !proactiveEnabled
    await personaDb.upsertChatConversationSettings({
      conversationKey,
      peerCharacterId,
      playerIdentityId,
      proactiveMessageEnabled: next,
    })
    await load()
  }, [conversationKey, peerCharacterId, playerIdentityId, proactiveEnabled, load])

  const saveProactiveInterval = useCallback(
    async (seconds: number) => {
      setProactiveIntervalSaving(true)
      try {
        await patch({
          proactiveMessageIntervalSeconds: seconds,
          proactiveMessageLastFiredAtMs: Date.now(),
        })
      } finally {
        setProactiveIntervalSaving(false)
      }
    },
    [patch],
  )

  const toggleProactiveVariableInterval = useCallback(async () => {
    const next = !proactiveVariableEnabled
    if (!next) {
      await patch({ proactiveMessageVariableIntervalEnabled: false })
      return
    }
    const explicitBusy = await resolveCharacterExplicitBusyForProactive({
      row: effective,
      now: Date.now(),
    })
    const nextSeconds = drawProactiveVariableIntervalSeconds(explicitBusy)
    await patch({
      proactiveMessageVariableIntervalEnabled: true,
      proactiveMessageNextIntervalSeconds: nextSeconds,
      proactiveMessageLastFiredAtMs: Date.now(),
    })
  }, [effective, patch, proactiveVariableEnabled])

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
                本地上传并裁剪
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
        {/* 聊天对象 */}
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
            {canInviteToGroup ? (
              <div className="flex w-[60px] shrink-0 flex-col items-center">
                <Pressable
                  type="button"
                  aria-label="发起群聊"
                  onClick={() => setInviteGroupOpen(true)}
                  className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[12px] border border-dashed border-[#9CA3AF] bg-white text-[#111827]"
                >
                  <Plus className="size-6" strokeWidth={2} aria-hidden />
                </Pressable>
                <p className="mt-1 line-clamp-2 text-center text-[12px] text-[#9CA3AF]" style={{ marginTop: 4 }}>
                  发起群聊
                </p>
              </div>
            ) : null}
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
          {showProactiveMessageSettings ? (
            <ListRow stacked borderBottom>
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-[16px] text-black">主动消息</span>
                <WxSwitch on={proactiveEnabled} onToggle={() => void toggleProactiveMessage()} />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#8e8e8e]">
                开启后，角色会按设定频率结合聊天上下文主动发来消息（不重复上一轮内容）。切到后台时若已开启「后台保活」或「后台推送」，仍可收到系统通知。
              </p>
              {proactiveEnabled ? (
                <>
                  <div className="mt-4 flex w-full items-center justify-between gap-3 border-t border-[#f0f0f0] pt-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[15px] font-medium text-black">灵动间隔</span>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#8e8e8e]">
                        像真人聊天一样不固定节奏：空闲时随机{' '}
                        <span style={{ fontFamily: PROACTIVE_MESSAGE_NUMBER_FONT }}>1 秒～5 分钟</span>
                        触达；角色说忙或开启忙碌后，下次等待自动拉长到数分钟～数小时。
                      </p>
                    </div>
                    <WxSwitch
                      on={proactiveVariableEnabled}
                      onToggle={() => void toggleProactiveVariableInterval()}
                    />
                  </div>
                  {proactiveVariableEnabled ? (
                    <p className="mt-2 text-[11px] text-[#8e8e8e]">
                      当前模式：{formatProactiveVariableIntervalRangeLabel(proactiveVariableBusyHint)}
                      {proactiveScheduleSaved ? ' · 每次触达后重新随机' : ' · 开启后将立即开始随机倒计时'}
                    </p>
                  ) : (
                    <ProactiveMessageIntervalControl
                      savedIntervalSeconds={proactiveIntervalSeconds}
                      scheduleSaved={proactiveScheduleSaved}
                      saving={proactiveIntervalSaving}
                      onSave={(seconds) => void saveProactiveInterval(seconds)}
                    />
                  )}
                </>
              ) : null}
            </ListRow>
          ) : null}
          <ListRow borderBottom>
            <span className="text-[16px] text-black">置顶聊天</span>
            <WxSwitch on={effective.isPinned} onToggle={() => void togglePin()} />
          </ListRow>
          <ListRow borderBottom>
            <span className="text-[16px] text-black">弹幕模式</span>
            <WxSwitch
              on={effective.isDanmakuMode}
              onToggle={() => void patch({ isDanmakuMode: !effective.isDanmakuMode })}
            />
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
          <ListRow stacked borderBottom>
            <div>
              <span className="text-[16px] text-black">表情包每轮触发概率</span>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                拖动滑块设定角色每轮回复中至少发 1 条表情包的目标概率（
                <span style={roundTriggerNumStyle}>0%</span> 为完全不发）。
              </p>
              <RoundTriggerPercentControl
                kind="sticker"
                stored={stickerStored}
                onChange={(percent) => void patch({ stickerRoundTriggerPercent: percent })}
                onResetDefault={() => void patch({ clearStickerRoundTriggerPercent: true })}
              />
            </div>
          </ListRow>
          <ListRow stacked borderBottom>
            <div>
              <span className="text-[16px] text-black">语音消息每轮触发概率</span>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                设定该轮回复<strong className="font-normal text-[#666]">会不会出现</strong>语音（门槛概率，不是条数上限）。命中后同一轮可发<strong className="font-normal text-[#666]">多条</strong>语音并与文字穿插。未定制时系统默认约{' '}
                <span style={roundTriggerNumStyle}>{VOICE_PROTOCOL_DEFAULT_ROUND_TRIGGER_PERCENT}%</span>。
              </p>
              <RoundTriggerPercentControl
                kind="voice"
                stored={voiceStored}
                onChange={(percent) => void patch({ voiceRoundTriggerPercent: percent })}
                onResetDefault={() => void patch({ clearVoiceRoundTriggerPercent: true })}
              />
            </div>
          </ListRow>
          <ListRow stacked borderBottom>
            <div>
              <span className="text-[16px] text-black">AI 配图每轮触发概率</span>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8e8e8e]">
                拖动滑块设定角色每轮回复中至少发 1 张 AI 配图的目标概率（默认{' '}
                <span style={roundTriggerNumStyle}>{IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT}%</span>{' '}
                不发；用户直接要求发图时不受限制；须已配置生图 API）。
              </p>
              <RoundTriggerPercentControl
                kind="image"
                stored={imageStored}
                onChange={(percent) => void patch({ imageRoundTriggerPercent: percent })}
                onResetDefault={() => void patch({ clearImageRoundTriggerPercent: true })}
              />
              <p className="mt-4 text-[12px] leading-relaxed text-[#8e8e8e]">
                每次触发发图时，角色可发送的图片张数范围（每条 <span className="font-mono">[图片]</span>{' '}
                行计 1 张）。
              </p>
              <ImageRoundCountRangeControl
                minStored={imageCountMinStored}
                maxStored={imageCountMaxStored}
                onChange={(min, max) => void patch({ imageRoundCountMin: min, imageRoundCountMax: max })}
                onResetDefault={() => void patch({ clearImageRoundCountRange: true })}
              />
            </div>
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

      {clearOpen ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45 px-6">
          <div className="w-full max-w-[320px] overflow-hidden rounded-[14px] bg-white">
            <div className="p-5 pb-4">
              <p className="text-[16px] font-medium text-black">清空聊天记录</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#666666]">
                可选：仅隐藏聊天界面中的历史气泡（本地记录仍在，角色仍会参考）；或彻底删除本地消息（清除模型上下文参考）。两种操作都会在手机桌面「回收站」留下快照（限期保留），如需找回聊天记录可前往尝试恢复。
              </p>
            </div>
            <div className="flex flex-col border-t border-[#e5e5e5]">
              <button
                type="button"
                className="h-11 w-full text-[16px] font-medium text-[#fa5151] transition-colors active:bg-[#fff1f1]"
                onClick={() => {
                  void (async () => {
                    await personaDb.deleteAllWeChatMessagesForConversation(conversationKey)
                    setClearOpen(false)
                    onClose()
                  })()
                }}
              >
                彻底删除（清除上下文）
              </button>
              <div className="h-px w-full bg-[#e5e5e5]" aria-hidden />
              <button
                type="button"
                className="h-11 w-full text-[16px] text-[#576b95] transition-colors active:bg-[#f2f2f2]"
                onClick={() => {
                  void (async () => {
                    await personaDb.hideWeChatConversationHistoryFromUiKeepAiContext(conversationKey)
                    setClearOpen(false)
                    onClose()
                  })()
                }}
              >
                仅清空界面（保留 AI 参考）
              </button>
              <div className="h-px w-full bg-[#e5e5e5]" aria-hidden />
              <button
                type="button"
                className="h-11 w-full text-[16px] text-[#666666] transition-colors active:bg-[#f2f2f2]"
                onClick={() => setClearOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inviteGroupOpen && canInviteToGroup ? (
        <div className="absolute inset-0 z-[120] flex min-h-0 flex-col bg-[#FFFFFF]">
          <CreateGroupPickContactsSheet
            open
            title="选择群成员"
            lockedCharacterIds={[peerForInvite]}
            contacts={personaContactsForGroup}
            minExtraSelections={1}
            onClose={() => setInviteGroupOpen(false)}
            onConfirm={(extra) => {
              void Promise.resolve(onInviteCreateGroup?.(extra)).finally(() => setInviteGroupOpen(false))
            }}
          />
        </div>
      ) : null}

      <AnimatePresence>
        {findHistoryOpen ? (
          <motion.div
            key="wx-find-chat-history"
            initial={disableTransitions ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={disableTransitions ? { x: 0 } : { x: '100%' }}
            transition={disableTransitions ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
