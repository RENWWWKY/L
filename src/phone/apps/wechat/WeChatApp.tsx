import { animate, AnimatePresence, motion, Reorder, useDragControls, useMotionValue } from 'framer-motion'
import { Activity, BellOff, EyeOff, MoreHorizontal, Pin, PinOff, Plus, Trash2, CircleDot } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useCustomization } from '../../CustomizationContext'
import { LISTEN_TOGETHER_NAVIGATE_EVENT } from '../../../components/discoverListen/listenTogetherNavigation'
import {
  LUMI_PULSE_NAVIGATE_EVENT,
  LUMI_PULSE_RETURN_TO_CHAT_EVENT,
  type PulseReturnToChat,
} from '../lumiPulse/lumiPulseNavigation'
import {
  WECHAT_FOCUS_GROUP_CHAT_EVENT,
  WECHAT_FOCUS_PERSONA_CHAT_EVENT,
  consumeWeChatFocusGroupChatId,
  consumeWeChatFocusPersonaChatId,
  type WeChatFocusGroupChatDetail,
  type WeChatFocusPersonaChatDetail,
} from './wechatFocusChatNavigation'
import { wxFillToStyle } from './wechatThemeFillStyle'
import { resolvePublicImageUrl } from '../../../publicAssetUrl'
import { WeChatTitleUnreadText, WeChatThreadPreviewText, WeChatThreadTimeText, WeChatUnreadBadgeText } from './wechatUnreadCountText'
import { Pressable } from '../../components/Pressable'
import {
  DEFAULT_CUSTOMIZATION,
  type WeChatBubbleTheme,
  type WeChatTabId,
  type WeChatTheme,
  type WxFillMode,
  type WxFillStyle,
  wechatBubbleThemesEqual,
} from '../../types'
import { ImageCropperModal } from '../../components/ImageCropperModal'
import { WeChatMeInstagramProfile } from './WeChatProfile'
import {
  WECHAT_DEFAULT_CONTACTS,
  WECHAT_LUMI_ASSISTANT_CONTACT,
  WeChatContactsInstagram,
} from '../../../components/WeChatContactsInstagram'
import { WeChatDiscoverInstagram } from '../../../components/WeChatDiscoverInstagram'
import {
  MomentsNoticeRuntime,
  useMomentsInteractionUnreadCount,
} from '../../../components/moments/MomentsNoticeRuntime'
import { mockContactsToMomentRefs } from '../../../components/moments/publishMomentUtils'
import { UserMomentsArchive } from '../../../components/moments/UserMomentsArchive'
import type { MockContact } from '../../../components/anonymousQa/types'
import type { AnonymousQaWechatContext } from '../../../components/anonymousQa/buildAnonymousQaPersonaContext'
import type { MomentParticipantProfilePayload } from '../../../components/moments/momentProfileNavigation'
import { DatingSystem } from './dating/DatingSystem'
import { NewFriendsPersonaApp } from './newFriendsPersona/NewFriendsPersonaApp'
import type { FriendRequest } from './newFriendsPersona/friendRequestTypes'
import { ensureMeetVol10EpilogueIfNeeded } from '../lumiMeet/meetEpilogueAfterContactsSync'
import { MeetVol10EpilogueNoticeHost } from '../lumiMeet/MeetVol10EpilogueNoticeHost'
import {
  buildMeetWechatPrivateChatContinuityBlock,
  isMeetSyncedCharacter,
  loadMeetUserProfileSnapshotFromKv,
} from '../lumiMeet/meetUserProfileSnapshot'
import {
  resolveUiHideBeforeForMeetImport,
  shouldSyncMeetEncounterToWechat,
  syncMeetEncounterToWechatAfterFriendLinked,
} from '../lumiMeet/meetWechatSyncOnFriendLinked'
import { mapFriendRequestRowToUi, lumiFallbackNickname } from './newFriendsPersona/mapFriendRequestToUi'
import { countNewFriendsBadge } from './newFriendsPersona/newFriendsBadge'
import {
  appendFriendRequestTempChatMessage,
  runFriendRequestTempChatReply,
  tempChatThreadFromRow,
} from './addFriend/friendRequestTempChat'
import { PlayerIdentityApp } from './playerIdentity/PlayerIdentityApp'
import { ChatSettingsScreen } from './chatSettings/ChatSettingsScreen'
import { ChatTimeSettingsScreen } from './chatSettings/ChatTimeSettingsScreen'
import { CreateGroupPickContactsSheet } from './group/CreateGroupPickContactsSheet'
import { ContactsGroupChatsScreen } from './group/ContactsGroupChatsScreen'
import { GroupInfoScreen, createWeChatGroupAndSeedConversation } from './group/GroupInfoScreen'
import { ContactProfileCardScreen } from './ContactProfileCardScreen'
import { ContactProfileSettingsScreen } from './ContactProfileSettingsScreen'
import { ContactComplaintScreen } from './ContactComplaintScreen'
import { ChatRoom } from './ChatRoom'
import { RedPacketPage, type WxChatTarget } from './redPacket/RedPacketPage'
import { TransferPage } from './transfer/TransferPage'
import { TransferDetailPage } from './transfer/TransferDetailPage'
import { upsertLumiTransfer } from './transfer/lumiTransferStorage'
import { RedPacketDetailPage } from './redPacket/RedPacketDetailPage'
import { RedPacketHistoryPage } from './redPacket/RedPacketHistoryPage'
import { WeChatProfileEditModal } from './WeChatProfileEditModal'
import { MemoryTraceModal } from './MemoryTraceModal'
import { WorldBookAfterPatchNoticeHost } from './WorldBookAfterPatchNoticeHost'
import { DatingPlotCompletionToastHost } from './dating/DatingPlotCompletionToastHost'
import { getLastMemoryTrace, hydrateMemoryTraceFromIndexedDb, subscribeLastMemoryTrace } from './memoryTraceStore'
import { ChatThemeProvider, useChatTheme } from './ChatThemeContext'
import { WeChatConsoleFloatingPanel } from './WeChatConsoleFloatingPanel'
import { WeChatConsoleProvider, useWeChatConsole } from './WeChatConsoleContext'
import { MemoryManagementApp } from './memory/MemoryManagementApp'
import { WeChatFavoritesPage } from './favorites/WeChatFavoritesPage'
import { MemoryAlbumApp } from './memoryAlbum/MemoryAlbumApp'
import { emitWeChatStorageChanged, personaDb } from './newFriendsPersona/idb'
import { formatWeChatMessagesTabPreviewFromStoredMessage } from './wechatThreadPreviewText'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
  resolvePrivateChatSessionPlayerIdentityId,
  resolveGroupWeChatStorageConversationKey,
  resolvePrivateWeChatStorageConversationKey,
  resolveWeChatPrivateChatTarget,
  parseWechatAccountPrivateConversationKey,
  wechatGroupPeerCharacterId,
} from './wechatConversationKey'
import {
  getConversationPipelineFlags,
  isConversationPeerReplyingVisible,
  subscribeWechatConversationAiPipeline,
} from './wechatConversationAiPipeline'
import {
  markPrivateChatConversationReadForAccountCharacter,
  resolveAccountScopedPrivateConversationKey,
  resolveWalletChatMessageStorageKey,
} from './wechatAccountPrivateChatStorage'
import {
  linkCharacterPlayerIdentityFromAcceptedFriendRequest,
  listFriendRequestsForWechatAccount,
  resolveActivePrivateChatSessionPlayerIdentityId,
  resolveOutgoingFriendRequestPlayerIdentityId,
  isNonPrimaryBindingSession,
} from './wechatCharacterPlayerIdentity'
import { resolveWorldBookUserBinding } from './charUserPlaceholders'
import { buildFriendRequestNonPrimaryBindingBias } from './wechatFriendRequestSessionBias'
import { resolveCanonicalCharacterId } from './wechatGlobalCharacterRegistry'
import { contactEntryFromCharacter } from './wechatPersonaContactsSync'
import { pruneCharacterVoiceMappings } from '../voiceprint/characterVoiceMapStorage'
import { applyWechatContactRemovalDataClear } from './wechatContactRemoval'
import { resolveCharacterAvatarUrl, resolveWeChatContactAvatarUrl } from '../../utils/characterAvatarUrl'
import { WeChatMessengerChatHeader } from './WeChatMessengerChatHeader'
import { ChatHeader } from './chatRoom/ChatHeader'
import { WeChatBubblePresetCards } from './WeChatBubblePresetCards'
import {
  WECHAT_BUBBLE_PRESETS,
  type WeChatBubblePreset,
  migrateMislabeledLumiDefaultBubble,
  resolveEffectiveChatInputBarForBubble,
  resolvePreviewWechatThemeForBubble,
} from './wechatBubblePresets'
import { buildWeChatChatSkinExport, buildWeChatChatSkinAiPrompt, WECHAT_CHAT_SKIN_EXPORT_UI_ENABLED } from './wechatChatSkinExport'
import { WeChatChatSkinPreviewPanel } from './WeChatChatSkinPreviewPanel'
import {
  resolveChatDisplayFontFamily,
} from './wechatBubbleTemplateFonts'
import { wechatChatRoomBgFallbackColor, wechatChatRoomBgToStyle } from './wechatChatRoomBg'
import { WeChatForwardSelectChatScreen, type WeChatForwardMode } from './WeChatForwardSelectChatScreen'
import type { GroupChatRow, WeChatChatHistoryPayload, WeChatChatMessage } from './newFriendsPersona/types'
import { ChatHistoryViewer } from './chatHistory/ChatHistoryViewer'
import { useMuteStatus } from './hooks/useMuteStatus'
import { setWeChatForegroundConversationKey } from './wechatSystemNotify'
import { GlobalMessageListener } from './globalMessage/GlobalMessageListener'
import { setWeChatGlobalMessageGuardState } from './globalMessage/wechatGlobalMessageGuard'
import type { WeChatQuickReplyChat } from './globalMessage/wechatGlobalMessageGuard'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { requestWeChatMemorySummary, requestWeChatPeerReplyBubbles, type ChatTranscriptTurn } from './wechatChatAi'
import { resolveAutoSummaryApiConfig } from './memory/memorySummaryApi'
import { sanitizePrivateMemorySummaryBody } from './memory/autoSummaryPlaceholderSanitize'
import { resolveMemoryUserInsertContextFromSource } from './memoryUserPlaceholderBindings'
import { buildAutoSummaryMemoryKeywordsBackup } from './memory/memoryTriggerUtils'
import { persistStoryTimelineFromSummaryDelta } from './memory/storyTimelinePersist'
import { uid } from './newFriendsPersona/utils'
import { formatWorldBackgroundForPrompt } from './newFriendsPersona/worldBackgroundFormat'
import {
  applyWorldBookAfterPatchesToCharacter,
  WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT,
} from './newFriendsPersona/worldBookAfterPatch'
import {
  buildFriendRequestDeletionOrdinalBias,
  FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS,
  buildFriendRequestPrivatePromptPack,
} from './wechatFriendRequestPrivatePromptPack'
import { buildAltWechatStrangerContactPromptBlock } from './wechatAltAccountPrompt'
import {
  isSecondaryWechatAccountInBundle,
  loadAccountsBundle,
  resolveAccountSessionIdentityId,
} from './wechatAccountPersistence'
import { getContactDeletionCount, incrementContactDeletionCount } from './wechatContactDeletionCount'
import {
  clearGroupChatPrivatePeerAnchorDockStagingIfMatches,
  setGroupChatPrivatePeerAnchorFromDockTransition,
  setPrivateChatGroupAnchorFromDockTransition,
} from './wechatPrivateGroupAnchorStaging'
import { WeChatAuthGuard } from './WeChatAuthGuard'
import { WeChatRegistration } from './WeChatRegistration'
import { SwitchAccountPage } from './settings/SwitchAccountPage'
import { WeChatWelcomeRevealLayer } from './WeChatWelcomeRevealLayer'
import { wechatProfileToPhoneProfile } from './wechatAccountTypes'
import { useWechatStore, WechatStoreProvider } from './useWechatStore'
import { WeChatDanmakuConfigScreen } from './settings/WeChatDanmakuConfigScreen'
import {
  WeChatGlobalSettingsScreen,
  type WeChatGlobalSettingsNav,
} from './settings/WeChatGlobalSettingsScreen'
import { WeChatNotificationSettingsScreen } from './settings/WeChatNotificationSettingsScreen'
import { WeChatBusySettingsScreen } from './settings/WeChatBusySettingsScreen'
import { WeChatTimeSettingsScreen } from './settings/WeChatTimeSettingsScreen'
import { WeChatSettingsStubScreen } from './settings/WeChatSettingsStubScreen'
import { AccountSecurityPage } from './settings/accountSecurity/AccountSecurityPage'
import { useWeChatCurrentTime } from './time/useWeChatCurrentTime'
import { isCharacterTimePerceptionEnabled } from './time/wechatTimeUtils'
import { WalletCardsPage } from './wallet/WalletCardsPage'
import { AffectionPayPage } from './wallet/AffectionPayPage'
import { walletSpend } from './wallet/walletMockStore'

import lumiWechatAvatarUrl from '../../../../image/主屏幕图标.png'

import { WalletTransactionsPage } from './wallet/WalletTransactionsPage'
import { WalletAffectionCardsPage } from './wallet/WalletAffectionCardsPage'
import { WalletBankCardsPage } from './wallet/WalletBankCardsPage'
import { WalletAffectionTransactionsPage } from './wallet/WalletAffectionTransactionsPage'
import { WealthDashboardPage } from './wallet/WealthDashboardPage'
import { StickerCenterPage } from './stickers/StickerCenterPage'
import { AddFriendPage } from './addFriend/AddFriendPage'
import { FriendRequestForm } from './addFriend/FriendRequestForm'
import {
  FRIEND_REQUEST_ADJUDICATION_INCOMPLETE_ERROR,
  loadFriendRequestMessagesForAdjudication,
  runCharacterFriendRequestAdjudication,
} from './addFriend/friendRequestAdjudication'
import { formatFriendRequestApiError } from './addFriend/friendRequestApiError'
import {
  FRIEND_REQUEST_ADJUDICATION_RESET_EVENT,
  type FriendRequestAdjudicationResetDetail,
} from './addFriend/friendRequestAdjudicationReset'
import { isUserInitiatedFriendRequestSource } from './addFriend/submitUserOutgoingFriendRequest'
import {
  isFriendRequestAdjudicationInFlight,
  registerFriendRequestAdjudicationJob,
} from './addFriend/friendRequestAdjudicationInFlight'
import { stampWechatAccountOwner } from './wechatAccountScope'
import { StrangerProfilePage } from './addFriend/StrangerProfilePage'

type WxGlobalNavState = null | WeChatGlobalSettingsNav

type Props = {
  onBack: () => void
}

const WECHAT_APPEARANCE_GUIDE_SEEN_KEY = 'lumi-wechat-appearance-guide-seen-v1'

type TabId = 'messages' | 'contacts' | 'dates' | 'discover' | 'profile'

/** 当前打开的会话：Lumi 小助手、私聊人设角色，或群聊 */
type WxActiveChat =
  | { kind: 'lumi' }
  | { kind: 'self' }
  | { kind: 'persona'; characterId: string }
  | { kind: 'group'; groupId: string }

/** 红包详情导航载荷（与 ChatRoom.onNavigateRedPacketDetail 对齐） */
type WxRedPacketDetailPayload = {
  messageId: string
  amountYuan: number
  remark: string
  senderName: string
  senderAvatarUrl?: string
  chatPeerName: string
  /** 已拆开时「领取记录」展示领取者：己方发包为对方备注；对方发包为己方昵称 */
  claimerName?: string
  fromSelf: boolean
  /** 是否已拆；false 为只读详情（如本人发出的待对方领取） */
  opened: boolean
}

type WxContactProfileReturnTo =
  | { mode: 'tabs-contacts' }
  | { mode: 'chat'; chat: WxActiveChat; reopenChatSettings: boolean }
  | { mode: 'moments-feed' }
  | {
      mode: 'user-moments-archive'
      userId: string
      coverNickname?: string
      returnTo: WxUserMomentsArchiveReturnTo
    }

type WxUserMomentsArchiveReturnTo =
  | { mode: 'tabs-profile' }
  | {
      mode: 'contact-profile'
      target: { kind: 'lumi' } | { kind: 'self' } | { kind: 'persona'; characterId: string }
      remarkName: string
      avatarUrl?: string
      returnTo: WxContactProfileReturnTo
    }

type WxRoute =
  | { name: 'tabs'; tab: TabId }
  | { name: 'chat'; chat: WxActiveChat }
  | {
      name: 'forward-select-chat'
      fromChat: WxActiveChat
      payload: { mode: WeChatForwardMode; messageIds: string[]; mergeTitle?: { userName: string; peerName: string; peerCharacterId?: string } }
    }
  | {
      name: 'new-friends-persona'
      editCharacterId?: string
      returnToChat?: WxActiveChat
      source?: 'contacts' | 'profile' | 'dating'
    }
  /** 通讯录 → 群聊列表 */
  | { name: 'contacts-group-chats' }
  | { name: 'player-identities' }
  | { name: 'switch-account' }
  | { name: 'switch-account-register' }
  | { name: 'wallet-cards' }
  | { name: 'wallet-transactions' }
  | { name: 'wallet-affection-cards' }
  | { name: 'wallet-affection-transactions'; cardId: string; giverName: string }
  | { name: 'wallet-bank-cards' }
  | { name: 'wallet-wealth' }
  | { name: 'sticker-center' }
  | { name: 'affection-pay'; chat: WxActiveChat }
  | { name: 'memory-manage' }
  | { name: 'favorites' }
  | { name: 'album' }
  | {
      name: 'contact-profile'
      target: { kind: 'lumi' } | { kind: 'self' } | { kind: 'persona'; characterId: string }
      remarkName: string
      avatarUrl?: string
      returnTo: WxContactProfileReturnTo
    }
  | {
      name: 'contact-profile-settings'
      target: { kind: 'lumi' } | { kind: 'self' } | { kind: 'persona'; characterId: string }
      remarkName: string
      avatarUrl?: string
      returnTo: WxContactProfileReturnTo
    }
  | {
      name: 'contact-recommend-select'
      target: { kind: 'persona'; characterId: string }
      remarkName: string
      avatarUrl?: string
      returnTo: WxContactProfileReturnTo
    }
  | {
      name: 'contact-complaint'
      target: { kind: 'persona'; characterId: string }
      remarkName: string
      avatarUrl?: string
      returnTo: WxContactProfileReturnTo
    }
  /** 发红包独立页：完成后回到 `chat` */
  | { name: 'red-packet-send'; chat: WxActiveChat }
  | { name: 'red-packet-detail'; chat: WxActiveChat; detail: WxRedPacketDetailPayload }
  | { name: 'red-packet-history'; chat: WxActiveChat; detailSnapshot: WxRedPacketDetailPayload | null }
  /** 私聊转账页（Lumi/角色私聊共用） */
  | { name: 'lumi-transfer'; chat: WxActiveChat }
  | { name: 'transfer-detail'; chat: WxActiveChat; transferId: string }
  /** 主微信「添加朋友」：用户本人通讯录向 NPC 发起申请的全链路（非查手机镜像会话） */
  | { name: 'add-friend' }
  | { name: 'add-friend-stranger'; characterId: string }
  | { name: 'add-friend-request-form'; characterId: string }
  | {
      name: 'user-moments-archive'
      userId: string
      returnTo: WxUserMomentsArchiveReturnTo
    }

function wxContactProfileTarget(payload: MomentParticipantProfilePayload) {
  if (payload.kind === 'lumi') return { kind: 'lumi' as const }
  if (payload.kind === 'self') return { kind: 'self' as const }
  return { kind: 'persona' as const, characterId: payload.characterId!.trim() }
}

function wxWalletPeerCharacterId(chat: WxActiveChat): string {
  if (chat.kind === 'lumi') return WECHAT_LUMI_PEER_CHARACTER_ID
  if (chat.kind === 'self') return WECHAT_SELF_PEER_CHARACTER_ID
  if (chat.kind === 'persona') return chat.characterId
  return wechatGroupPeerCharacterId(chat.groupId)
}

/**
 * 仍绑定同一「聊天会话」的路由：从聊天页进入子页时 ChatRoom 保持挂载（隐藏续跑逐条露出 / 正在输入），避免卸载丢动画。
 */
function wxRouteChatLayerContext(route: WxRoute): WxActiveChat | null {
  if (route.name === 'chat') return route.chat
  switch (route.name) {
    case 'affection-pay':
    case 'red-packet-send':
    case 'red-packet-detail':
    case 'red-packet-history':
    case 'lumi-transfer':
    case 'transfer-detail':
      return route.chat
    default:
      return null
  }
}

/** RedPacketPage 仅接受 lumi/persona；群会话映射为占位 persona id */
function wxChatTargetForRedPacket(chat: WxActiveChat): WxChatTarget {
  if (chat.kind === 'group') {
    return { kind: 'persona', characterId: wechatGroupPeerCharacterId(chat.groupId) }
  }
  if (chat.kind === 'self') {
    return { kind: 'persona', characterId: WECHAT_SELF_PEER_CHARACTER_ID }
  }
  if (chat.kind === 'persona') {
    return chat
  }
  return { kind: 'lumi' }
}

const transition = { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const }

function formatFriendRequestTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return String(ts)
  }
}

function sanitizeFriendRequestPlainText(input: string): string {
  const singleLine = String(input || '').replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!singleLine) return ''
  const lower = singleLine.toLowerCase()
  // 验证聊天室只允许纯文本，不接收表情包协议/图片链接形态文本
  if (singleLine.startsWith('[表情包]') || singleLine.startsWith('[表情]')) return ''
  // 引用消息协议/标记（文本形式）也禁止
  if (singleLine.startsWith('[引用') || singleLine.includes('[引用:') || singleLine.includes('【引用')) return ''
  if (lower.includes('/image/') || /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(singleLine)) return ''
  return singleLine.slice(0, 120)
}

function friendRequestGapBeforeBubbleMs(currentSegmentLength: number, isFirst: boolean): number {
  if (isFirst) return 0
  const chars = Math.max(1, currentSegmentLength)
  return Math.min(25000, Math.ceil(chars / 5) * 1000)
}

function buildFriendRequestReplyBias(params: { messages: FriendRequest['messages']; extraBias?: string }): string {
  const hasUserReply = params.messages.some((m) => m.sender === 'user')
  const adjudicationMode = /friend_request_response|系统裁决/.test(params.extraBias ?? '')
  const roundRule = hasUserReply
    ? adjudicationMode
      ? '对方已发来验证：先输出裁决 XML（见补充偏向）；口语验证回复 0~2 行可选，无必要可只输出 XML。'
      : '当前不是首条验证消息阶段：可输出 1~4 条普通文本（每行一条）。'
    : '当前是首条验证消息阶段：必须且只能输出 1 条普通文本。'
  const rule1 = adjudicationMode
    ? '1) 最开头必须输出补充偏向中的 `<friend_request_response>` 裁决块；其后仅写口语验证回复，禁止 [表情包]、引用、红包、转账等结构化消息。'
    : '1) 只允许普通文本消息，禁止任何特殊格式：禁止 [表情包]、[引用:...]、[REDPACKET]、[TRANSFER]、[VOICECALL]、[BUSY]、JSON、Markdown、代码块、URL 图片链接。'
  const extra = params.extraBias?.trim() ? `\n补充偏向：${params.extraBias.trim()}` : ''
  return (
    `这是“新朋友-验证申请”专用聊天，不是普通私聊。\n` +
    `角色**默认不认识**申请人是谁，只能依据本栏验证内容回应；不知真名时**禁止**用微信昵称直呼对方（默认叫「你」），不得当作已通过好友后的私聊。\n` +
    `输出硬规则：\n` +
    `${rule1}\n` +
    `2) 语气必须像真实微信验证申请/验证聊天：简短、口语化、围绕“为何加回/是否认识/合作来意”推进，不要发散成日常闲聊。\n` +
    `3) 必须贴合角色人设与当前关系状态（刚删除后重加 or 验证沟通中）。\n` +
    `4) ${roundRule}\n` +
    `5) 每行尽量 6~28 字，禁止空行。${extra}`
  )
}

function buildPageProps(disableTransitions: boolean) {
  if (disableTransitions) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
      transition: { duration: 0 },
      style: { willChange: 'auto' },
    }
  }
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition,
    style: {
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden' as const,
      WebkitBackfaceVisibility: 'hidden' as const,
    },
  }
}

function DragHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <Pressable
      onPointerDown={onPointerDown}
      className="flex h-9 w-9 items-center justify-center rounded-[12px] border"
      style={{ borderColor: 'var(--wx-border)', color: 'var(--wx-text-muted)', background: 'transparent' }}
      aria-label="拖拽排序"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M9 6h0.01" />
        <path d="M9 12h0.01" />
        <path d="M9 18h0.01" />
        <path d="M15 6h0.01" />
        <path d="M15 12h0.01" />
        <path d="M15 18h0.01" />
      </svg>
    </Pressable>
  )
}

function TabBarItemRow({
  item,
  index,
  onSetIconUrl,
  onPickLocal,
  onOpenLabelPanel,
}: {
  item: { id: WeChatTabId; label: string; en: string; iconUrl: string; labelActiveColor: string; labelInactiveColor: string }
  index: number
  onSetIconUrl: (url: string) => void
  onPickLocal: () => void
  onOpenLabelPanel: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-[16px] border px-3 py-2"
      style={{ borderColor: 'var(--wx-border)', background: 'transparent' }}
    >
      <DragHandle onPointerDown={(e) => controls.start(e)} />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {item.iconUrl?.trim() ? (
          <img src={item.iconUrl} alt="" className="h-8 w-8 rounded-[10px] object-cover" aria-hidden />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border"
            style={{ borderColor: 'var(--wx-border)', color: 'var(--wx-text-muted)' }}
          >
            <span className="text-[11px] font-medium">{index + 1}</span>
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--wx-text)' }}>
            {item.label}
          </p>
          <p className="truncate text-[10px] tracking-[0.14em]" style={{ color: 'var(--wx-text-muted)' }}>
            {item.en}
          </p>
        </div>
      </div>

      <Pressable
        onClick={() => {
          const url = window.prompt('输入图标 URL（留空则清空/恢复默认）', item.iconUrl || '')
          if (url == null) return
          onSetIconUrl(url.trim())
        }}
        className="rounded-[12px] border px-3 py-2 text-[12px]"
        style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
      >
        URL
      </Pressable>

      <Pressable
        onClick={onPickLocal}
        className="rounded-[12px] border px-3 py-2 text-[12px]"
        style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
      >
        本地
      </Pressable>

      <Pressable
        onClick={onOpenLabelPanel}
        className="rounded-[12px] border px-3 py-2 text-[12px]"
        style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
      >
        字色
      </Pressable>
    </Reorder.Item>
  )
}

function fillToStyle(fill: WxFillStyle): React.CSSProperties {
  return wxFillToStyle(fill)
}

function fillLayerOpacity(fill: Partial<WxFillStyle> | null | undefined) {
  const op = typeof fill?.layerOpacity === 'number' && Number.isFinite(fill.layerOpacity) ? fill.layerOpacity : 100
  return clamp(op, 0, 100) / 100
}

function glassStyle(fill: Partial<WxFillStyle> | null | undefined): React.CSSProperties {
  const enabled = !!fill?.glassEnabled
  const blurPx = typeof fill?.blurPx === 'number' && Number.isFinite(fill.blurPx) ? clamp(fill.blurPx, 0, 40) : 0
  const glassOpacity =
    typeof fill?.glassOpacity === 'number' && Number.isFinite(fill.glassOpacity) ? clamp(fill.glassOpacity, 0, 100) : 0
  if (!enabled || (blurPx <= 0 && glassOpacity <= 0)) return { display: 'none' }
  return {
    backdropFilter: `blur(${blurPx}px)`,
    WebkitBackdropFilter: `blur(${blurPx}px)`,
    background: `rgba(255,255,255,${glassOpacity / 100})`,
  }
}

function bubbleForRole(theme: WeChatTheme, roleKey: string): WeChatBubbleTheme {
  let by = theme.bubbleByRole?.[roleKey]
  if (!by && roleKey === WECHAT_LUMI_PEER_CHARACTER_ID) {
    by = theme.bubbleByRole?.['lumi']
  }
  if (!by) return theme.bubbleGlobal
  if (wechatBubbleThemesEqual(by, theme.bubbleGlobal)) return theme.bubbleGlobal
  return by
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** `<input type="color">` 仅接受 #rrggbb；非 hex 时用回退色避免控件报错 */
function safeHex6ForColorInput(value: string, fallback = '#1B1B1F'): string {
  const v = String(value || '').trim()
  return /^#[0-9A-Fa-f]{6}$/i.test(v) ? v : fallback
}

function parseWeChatCssVars(cssText: string) {
  const vars: Record<string, string> = {}
  const re = /--wx-([a-z0-9-]+)\s*:\s*([^;]+);/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(cssText))) {
    const key = m[1]!.trim()
    const value = m[2]!.trim()
    if (key) vars[key] = value
  }
  return vars
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/css;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function copyTextToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

function Icon({ path, active }: { path: string; active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.92 }}
      aria-hidden
    >
      <path d={path} />
    </svg>
  )
}

function Header({
  title,
  titleSub,
  showTyping,
  typingText,
  onBack,
  onOpenTheme,
  showBack,
  onHome,
  showHome,
  showRight = true,
  /** 「信息」页：紧挨标题右侧展示未读，如（3） */
  titleUnreadCount,
  /** 聊天室：昵称/备注块右侧的静音等装饰；不参与标题居中参考 */
  titleTrailing,
  titleTrailingInteractive = false,
  /** 聊天室：右上角为「当前聊天设置」（三点）；其它页为外观主题（太阳图标） */
  rightMode = 'appearance',
  /** 若提供则替换右上角按钮（例如消息 Tab 的「+」） */
  customRight,
  showAppearanceGuide = false,
  onDismissAppearanceGuide,
  /** 为 true 时在主标题与 typingText 之间循环切换（模型已返回、消息逐条露出时） */
  titleTypingAlternate = false,
  /** 逐条露出队列长度；优先于 titleTypingAlternate */
  pendingQueueCount = 0,
  /** 为 true 时标题相对整条顶栏绝对居中（聊天页右侧多按钮时使用） */
  titleCenterAbsolute = false,
  /** 私聊：返回键旁打开线上时间设置 */
  onOpenTimeSettings,
}: {
  title: string
  /** 第二行：备注/说明（灰色小字），与微信昵称主行搭配 */
  titleSub?: string
  /** 为 true 时中间区域只显示「对方正在输入…」，替换主副标题 */
  showTyping?: boolean
  typingText?: string
  titleTypingAlternate?: boolean
  pendingQueueCount?: number
  titleCenterAbsolute?: boolean
  onBack: () => void
  onOpenTheme: () => void
  showBack: boolean
  onHome: () => void
  showHome: boolean
  showRight?: boolean
  titleUnreadCount?: number
  titleTrailing?: ReactNode
  titleTrailingInteractive?: boolean
  rightMode?: 'appearance' | 'chat-room-settings'
  customRight?: ReactNode
  showAppearanceGuide?: boolean
  onDismissAppearanceGuide?: () => void
  onOpenTimeSettings?: () => void
}) {
  const effectivePendingCount =
    pendingQueueCount > 0 ? pendingQueueCount : titleTypingAlternate ? 1 : 0

  const center = (
    <div className="flex min-h-[36px] min-w-0 flex-1 justify-center px-1">
      <ChatHeader
        contactName={title}
        contactSub={titleSub}
        pendingCount={effectivePendingCount}
        forceTyping={!!showTyping}
        typingText={typingText}
        titleTrailing={titleTrailing}
        titleTrailingInteractive={titleTrailingInteractive}
        titleUnreadCount={titleUnreadCount}
        renderUnread={(count) => (
          <WeChatTitleUnreadText
            count={count}
            className="shrink-0 text-[15px] font-medium leading-[36px] tracking-normal"
          />
        )}
      />
    </div>
  )

  const balancedSideSlot =
    customRight || onOpenTimeSettings ? 'min-w-[76px]' : 'w-10'

  return (
    <header
      data-wx-chat-header
      className="relative flex shrink-0 items-center justify-between gap-2 border-b px-3 pb-2"
      style={{
        paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
        borderColor: 'var(--wx-chat-header-border, var(--wx-border))',
        background: 'var(--wx-chat-header-bg, var(--wx-surface))',
        color: 'var(--wx-chat-header-text, var(--wx-text))',
      }}
    >
      <div className={`relative z-20 flex ${balancedSideSlot} shrink-0 items-center justify-start gap-0.5`}>
        {showBack ? (
          <Pressable
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text)' }}
            aria-label="返回"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Pressable>
        ) : showHome ? (
          <Pressable
            onClick={onHome}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text)' }}
            aria-label="返回桌面"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10.5V20a1.8 1.8 0 0 0 1.8 1.8h10.4A1.8 1.8 0 0 0 19 20v-9.5" />
              <path d="M10 21v-6.2a1.6 1.6 0 0 1 1.6-1.6h.8a1.6 1.6 0 0 1 1.6 1.6V21" />
            </svg>
          </Pressable>
        ) : null}
        {showBack && onOpenTimeSettings ? (
          <Pressable
            onClick={onOpenTimeSettings}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--wx-text)' }}
            aria-label="线上时间设置"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </Pressable>
        ) : null}
      </div>

      {titleCenterAbsolute ? null : center}

      <div className={`relative z-20 flex ${balancedSideSlot} shrink-0 items-center justify-end`}>
        {showRight ? (
          <>
            {customRight ? (
              <div className="relative z-[2] flex items-center justify-end">{customRight}</div>
            ) : (
              <Pressable
                onClick={onOpenTheme}
                className="relative z-[2] flex h-9 w-9 items-center justify-center rounded-full"
                style={{ color: 'var(--wx-text)' }}
                aria-label={rightMode === 'chat-room-settings' ? '当前聊天设置' : '外观与主题'}
              >
                {rightMode === 'chat-room-settings' ? (
                  <MoreHorizontal size={22} strokeWidth={2} aria-hidden />
                ) : (
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                  >
                    <path d="M12 2v2.2" />
                    <path d="M12 19.8V22" />
                    <path d="M2 12h2.2" />
                    <path d="M19.8 12H22" />
                    <path d="M4.5 4.5l1.6 1.6" />
                    <path d="M17.9 17.9l1.6 1.6" />
                    <path d="M4.5 19.5l1.6-1.6" />
                    <path d="M17.9 6.1l1.6-1.6" />
                    <circle cx="12" cy="12" r="3.6" />
                  </svg>
                )}
              </Pressable>
            )}
            {showAppearanceGuide && rightMode === 'appearance' && !customRight ? (
              <>
                <div
                  className="pointer-events-none absolute right-0 top-0 z-[1] h-9 w-9 rounded-full border-2 border-[#111827]"
                  style={{ boxShadow: '0 0 0 4px rgba(17,24,39,0.12)' }}
                  aria-hidden
                />
                <div className="absolute right-0 top-full z-[3] mt-2 w-[190px] rounded-[12px] border bg-white/95 p-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                  <p className="text-[12px] leading-snug text-[#1C1C1E]">
                    点这里可以调整微信外观，比如聊天气泡和头像显示。
                  </p>
                  <Pressable
                    onClick={onDismissAppearanceGuide}
                    className="mt-2 w-full rounded-[8px] bg-black py-1.5 text-center text-[11px] text-white"
                  >
                    知道了
                  </Pressable>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="h-9 w-9" aria-hidden />
        )}
      </div>

      {titleCenterAbsolute ? (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex min-h-9 items-center justify-center px-3"
          style={{
            top: 'max(0px, env(safe-area-inset-top, 0px))',
            paddingLeft: customRight ? '4.75rem' : '2.5rem',
            paddingRight: customRight ? '4.75rem' : '2.5rem',
          }}
        >
          <div className="pointer-events-auto w-full min-w-0 [&_.flex-1]:!flex-none [&_.flex-1]:!w-full [&_.flex-1]:!max-w-full">
            {center}
          </div>
        </div>
      ) : null}
    </header>
  )
}

function TabBar({
  active,
  onChange,
  messagesUnreadCount = 0,
  contactsUnreadCount = 0,
  discoverUnreadCount = 0,
}: {
  active: TabId
  onChange: (id: TabId) => void
  /** 「信息」Tab 未读数（微信外或会话列表外展示） */
  messagesUnreadCount?: number
  /** 「通讯录」Tab 未读数（新的朋友） */
  contactsUnreadCount?: number
  /** 「发现」Tab 未读数（朋友圈互动消息） */
  discoverUnreadCount?: number
}) {
  const { state } = useCustomization()
  const { wechatTheme } = state
  const builtin: Record<TabId, string> = {
    messages: 'M7 7h10a3 3 0 0 1 3 3v4.6a3 3 0 0 1-3 3H12l-3 3v-3H7a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z',
    contacts: 'M16 19a4 4 0 0 0-8 0 M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    dates: 'M12 21s-7-4.6-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.4-7 10-7 10z',
    discover: 'M12 2l3.2 6.5L22 12l-6.8 3.5L12 22l-3.2-6.5L2 12l6.8-3.5L12 2z',
    profile: 'M20 21c0-4.2-3.6-7-8-7s-8 2.8-8 7 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  }

  return (
    <nav
      className="relative shrink-0 overflow-hidden"
      style={{
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid var(--wx-border)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ ...fillToStyle(wechatTheme.tabBarStyle), opacity: fillLayerOpacity(wechatTheme.tabBarStyle) }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0" style={glassStyle(wechatTheme.tabBarStyle)} aria-hidden />

      <div className="relative mx-auto grid max-w-[420px] grid-cols-5 px-2 pt-1.5">
        {wechatTheme.tabBarItems.map((it) => {
          const isActive = it.id === active
          const labelColor = isActive
            ? it.labelActiveColor?.trim() || wechatTheme.tabBarLabelActive
            : it.labelInactiveColor?.trim() || wechatTheme.tabBarLabelInactive
          const badgeCount =
            it.id === 'messages'
              ? messagesUnreadCount
              : it.id === 'contacts'
                ? contactsUnreadCount
                : it.id === 'discover'
                  ? discoverUnreadCount
                  : 0
          const showBadge = badgeCount > 0
          const iconNode = it.iconUrl?.trim() ? (
            <img
              src={it.iconUrl}
              alt=""
              className="h-[22px] w-[22px] rounded-[6px] object-cover"
              aria-hidden
            />
          ) : (
            <Icon path={builtin[it.id]} active={isActive} />
          )
          return (
            <Pressable
              key={it.id}
              onClick={() => onChange(it.id)}
              className="relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px]"
              style={{
                color: isActive ? 'var(--wx-tabbar-active)' : 'var(--wx-tabbar-inactive)',
              }}
              aria-label={showBadge ? `${it.label}，未读 ${badgeCount} 条` : it.label}
            >
              {showBadge ? (
                <span className="relative inline-flex shrink-0">
                  {iconNode}
                  <span
                    className="pointer-events-none absolute -right-1 -top-1 z-[1] flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] leading-none text-white"
                    style={{
                      background: '#fa5151',
                      boxShadow: '0 0 0 1.5px var(--wx-surface, #fff)',
                    }}
                  >
                    <WeChatUnreadBadgeText count={badgeCount} />
                  </span>
                </span>
              ) : (
                iconNode
              )}
              <div className="leading-none">
                <div className="text-[12px] font-medium tracking-[0.2px]" style={{ color: labelColor }}>
                  {it.label}
                </div>
                <div className="mt-[1px] text-[10px] tracking-[0.14em] opacity-70" style={{ color: labelColor }}>
                  {it.en}
                </div>
              </div>
            </Pressable>
          )
        })}
      </div>
    </nav>
  )
}

type MessagesThreadRow =
  | {
      key: 'lumi'
      kind: 'lumi'
      conversationKey: string
      peerCharacterId: string
      isPinned: boolean
      name: string
      time: string
      preview: string
      avatarUrl: string
      unread: number
    }
  | {
      key: 'self'
      kind: 'self'
      conversationKey: string
      peerCharacterId: string
      isPinned: boolean
      name: string
      time: string
      preview: string
      avatarUrl: string
      unread: number
    }
  | {
      key: string
      kind: 'persona'
      conversationKey: string
      peerCharacterId: string
      characterId: string
      isPinned: boolean
      name: string
      time: string
      preview: string
      avatarUrl?: string
      unread: number
    }
  | {
      key: string
      kind: 'group'
      groupId: string
      conversationKey: string
      peerCharacterId: string
      isPinned: boolean
      name: string
      time: string
      preview: string
      avatarUrl?: string
      unread: number
    }

const PIN_ROW_EST_PX = 76

type ActiveChatUnreadExclude = {
  conversationKey: string | null
  characterId: string | null
  groupId: string | null
}

/** 聊天室顶栏返回键旁未读：排除当前正在看的会话（含分裂 conversationKey 的 persona 桶） */
function isMessageThreadForActiveChat(t: MessagesThreadRow, active: ActiveChatUnreadExclude): boolean {
  if (active.conversationKey && t.conversationKey === active.conversationKey) return true
  if (active.groupId && t.kind === 'group' && t.groupId === active.groupId) return true
  if (active.characterId) {
    if (t.kind === 'persona' && t.characterId === active.characterId) return true
    if (t.peerCharacterId === active.characterId) return true
  }
  return false
}

/** 信息页会话卡片左滑露出的操作区宽度（4 个横向操作） */
const MSG_THREAD_SWIPE_ACTION_W = 232
const MSG_THREAD_SWIPE_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.85 }
const MSG_THREAD_SWIPE_DRAG_THRESHOLD = 7
const MSG_THREAD_SWIPE_COMMIT_RATIO = 0.22
const MSG_THREAD_SWIPE_FLING_PX_PER_SEC = 520

function MessageThreadListItem({
  t,
  isPinnedSection,
  muted,
  onOpenChat,
  onLongPress,
  swipeOpen,
  onSwipeOpenChange,
  playerIdentityId,
  onListDataMutated,
  onThreadHidden,
  onRequestDelete,
}: {
  t: MessagesThreadRow
  isPinnedSection: boolean
  muted: boolean
  onOpenChat: (chat: WxActiveChat) => void
  onLongPress: (t: MessagesThreadRow, e: ReactPointerEvent) => void
  swipeOpen: boolean
  onSwipeOpenChange: (open: boolean) => void
  playerIdentityId: string | null
  onListDataMutated: () => void
  /** 左滑「不显示」：立刻从列表移除（全量刷新前先反馈） */
  onThreadHidden?: (conversationKey: string) => void
  onRequestDelete: (t: MessagesThreadRow) => void
}) {
  const { state } = useCustomization()
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const x = useMotionValue(0)
  const pointerIdRef = useRef<number | null>(null)
  const swipeDraggingRef = useRef(false)
  const swipeStartClientXRef = useRef(0)
  const swipeStartClientYRef = useRef(0)
  const swipeStartXRef = useRef(0)
  const swipeStartOpenRef = useRef(false)
  const pointerSamplesRef = useRef<Array<{ t: number; clientX: number }>>([])

  useEffect(() => {
    void animate(x, swipeOpen ? -MSG_THREAD_SWIPE_ACTION_W : 0, MSG_THREAD_SWIPE_SPRING)
  }, [swipeOpen, x])

  const clearTimer = () => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const endSwipeDrag = () => {
    swipeDraggingRef.current = false
    const cur = x.get()
    // 和聊天室翻页一致：位移比例 + 快速轻扫双通道判定
    const samples = pointerSamplesRef.current
    let vx = 0
    if (samples.length >= 2) {
      const a = samples[samples.length - 2]!
      const b = samples[samples.length - 1]!
      const dt = Math.max(1, b.t - a.t)
      vx = ((b.clientX - a.clientX) / dt) * 1000
    }
    const startOpen = swipeStartOpenRef.current
    let shouldOpen = startOpen
    if (!startOpen) {
      if (cur <= -MSG_THREAD_SWIPE_ACTION_W * MSG_THREAD_SWIPE_COMMIT_RATIO || vx < -MSG_THREAD_SWIPE_FLING_PX_PER_SEC) {
        shouldOpen = true
      }
    } else {
      if (
        cur >= -MSG_THREAD_SWIPE_ACTION_W * (1 - MSG_THREAD_SWIPE_COMMIT_RATIO) ||
        vx > MSG_THREAD_SWIPE_FLING_PX_PER_SEC
      ) {
        shouldOpen = false
      }
    }
    onSwipeOpenChange(shouldOpen)
    void animate(x, shouldOpen ? -MSG_THREAD_SWIPE_ACTION_W : 0, MSG_THREAD_SWIPE_SPRING)
    pointerSamplesRef.current = []
  }

  const runPin = async () => {
    if (!playerIdentityId) return
    await personaDb.updatePinnedStatus({
      conversationKey: t.conversationKey,
      peerCharacterId: t.peerCharacterId,
      playerIdentityId,
      isPinned: !t.isPinned,
    })
    onSwipeOpenChange(false)
    void animate(x, 0, MSG_THREAD_SWIPE_SPRING)
    onListDataMutated()
  }

  const runMarkUnread = async () => {
    await personaDb.markWeChatConversationUnread(t.conversationKey)
    onSwipeOpenChange(false)
    void animate(x, 0, MSG_THREAD_SWIPE_SPRING)
    onListDataMutated()
  }

  const runHide = async () => {
    const existing = await personaDb.getChatConversationSettings(t.conversationKey)
    const pid = playerIdentityId?.trim() || existing?.playerIdentityId?.trim()
    if (!pid) return
    // 先从列表摘掉，避免全量刷新慢时以为「不显示」没生效
    onThreadHidden?.(t.conversationKey)
    onSwipeOpenChange(false)
    void animate(x, 0, MSG_THREAD_SWIPE_SPRING)
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    await personaDb.upsertChatConversationSettings({
      conversationKey: t.conversationKey,
      peerCharacterId: t.peerCharacterId,
      playerIdentityId: pid,
      hiddenFromMessageList: true,
    })
  }

  const runDelete = () => {
    onSwipeOpenChange(false)
    void animate(x, 0, MSG_THREAD_SWIPE_SPRING)
    onRequestDelete(t)
  }

  const swipeActionBtnClass =
    'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 border-l border-black/10 px-1 py-1 text-[11px] font-medium leading-tight text-[#333] transition-colors active:bg-black/10'

  return (
    <div
      data-swipe-row-root
      className={`relative overflow-hidden ${isPinnedSection ? '' : 'rounded-[18px]'}`}
      style={isPinnedSection ? undefined : { borderColor: 'var(--wx-border)' }}
    >
      <div className="absolute inset-y-0 right-0 z-0 flex bg-[#e6e6e6]" style={{ width: MSG_THREAD_SWIPE_ACTION_W }} aria-hidden={!swipeOpen}>
        <button
          type="button"
          data-swipe-action
          tabIndex={swipeOpen ? 0 : -1}
          className={`${swipeActionBtnClass} border-l-0`}
          onClick={() => void runPin()}
        >
          <Pin className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>{t.isPinned ? '取消置顶' : '置顶'}</span>
        </button>
        <button
          type="button"
          data-swipe-action
          tabIndex={swipeOpen ? 0 : -1}
          className={swipeActionBtnClass}
          onClick={() => void runMarkUnread()}
        >
          <CircleDot className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>标为未读</span>
        </button>
        <button
          type="button"
          data-swipe-action
          tabIndex={swipeOpen ? 0 : -1}
          className={swipeActionBtnClass}
          onClick={() => void runHide()}
        >
          <EyeOff className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>不显示</span>
        </button>
        <button
          type="button"
          data-swipe-action
          tabIndex={swipeOpen ? 0 : -1}
          className={`${swipeActionBtnClass} text-[#fa5151]`}
          onClick={runDelete}
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>删除</span>
        </button>
      </div>

      <motion.div
        className="relative z-[1] touch-pan-y"
        style={{ x }}
        onPointerDownCapture={(e) => {
          if ((e.target as HTMLElement).closest('[data-swipe-action]')) return
          pointerIdRef.current = e.pointerId
          swipeDraggingRef.current = false
          swipeStartClientXRef.current = e.clientX
          swipeStartClientYRef.current = e.clientY
          swipeStartXRef.current = x.get()
          swipeStartOpenRef.current = swipeOpen
          pointerSamplesRef.current = [{ t: performance.now(), clientX: e.clientX }]
          longPressFiredRef.current = false
          clearTimer()
          longPressTimerRef.current = window.setTimeout(() => {
            longPressFiredRef.current = true
            onLongPress(t, e)
          }, 520)
        }}
        onPointerMoveCapture={(e) => {
          if (pointerIdRef.current !== e.pointerId) return
          const dx = e.clientX - swipeStartClientXRef.current
          const dy = e.clientY - swipeStartClientYRef.current
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) clearTimer()
          if (!swipeDraggingRef.current) {
            if (Math.abs(dx) < MSG_THREAD_SWIPE_DRAG_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return
            swipeDraggingRef.current = true
            try {
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            } catch {
              /* ignore */
            }
          }
          // 横向滑动已生效后，锁住页面纵向滚动，避免“边滑边上下跑”
          e.preventDefault()
          const now = performance.now()
          const samples = pointerSamplesRef.current
          samples.push({ t: now, clientX: e.clientX })
          if (samples.length > 6) samples.splice(0, samples.length - 6)
          let next = swipeStartXRef.current + dx
          const min = -MSG_THREAD_SWIPE_ACTION_W
          const max = 0
          const rubber = 0.22
          if (next > max) next = max + (next - max) * rubber
          else if (next < min) next = min + (next - min) * rubber
          x.set(next)
        }}
        onPointerUpCapture={(e) => {
          if (pointerIdRef.current !== e.pointerId) return
          pointerIdRef.current = null
          clearTimer()
          try {
            ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          if (swipeDraggingRef.current) endSwipeDrag()
        }}
        onPointerCancelCapture={(e) => {
          if (pointerIdRef.current !== e.pointerId) return
          pointerIdRef.current = null
          clearTimer()
          try {
            ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          if (swipeDraggingRef.current) endSwipeDrag()
        }}
      >
        <Pressable
          onPointerUp={clearTimer}
          onPointerCancel={clearTimer}
          onPointerLeave={clearTimer}
          onClick={() => {
            if (longPressFiredRef.current) {
              longPressFiredRef.current = false
              return
            }
            if (swipeOpen) {
              onSwipeOpenChange(false)
              void animate(x, 0, MSG_THREAD_SWIPE_SPRING)
              return
            }
            onOpenChat(
              t.kind === 'lumi'
                ? { kind: 'lumi' }
                : t.kind === 'self'
                  ? { kind: 'self' }
                  : t.kind === 'group'
                    ? { kind: 'group', groupId: t.groupId }
                    : { kind: 'persona', characterId: t.characterId },
            )
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={
            isPinnedSection
              ? 'flex w-full items-stretch gap-3 bg-[#f5f5f5] px-4 py-3 text-left transition-[background-color] duration-200'
              : 'flex w-full items-stretch gap-3 rounded-[18px] border border-[var(--wx-border)] px-4 py-3 text-left transition-[border-color,box-shadow] duration-200'
          }
          style={
            isPinnedSection
              ? { boxShadow: 'none' }
              : {
                  ...fillToStyle(state.wechatTheme.conversationCard),
                  boxShadow: 'var(--wx-shadow)',
                }
          }
        >
          <span className="relative inline-flex h-10 w-10 shrink-0">
            {t.avatarUrl ? (
              <img
                src={resolveCharacterAvatarUrl({ avatarUrl: t.avatarUrl }) || t.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 border object-cover transition-opacity duration-200"
                style={{
                  borderRadius: 'var(--wx-avatar-radius)',
                  borderColor: 'var(--wx-border)',
                }}
              />
            ) : (
              <div
                className="h-10 w-10 shrink-0 transition-opacity duration-200"
                style={{
                  borderRadius: 'var(--wx-avatar-radius)',
                  background: 'rgba(0,0,0,0.06)',
                }}
              />
            )}
            {t.unread > 0 ? (
              <span
                className={`pointer-events-none absolute right-0 top-0 flex items-center justify-center rounded-full text-[10px] font-bold leading-none text-white transition-opacity duration-200 ${
                  muted
                    ? 'h-[10px] w-[10px] translate-x-[38%] -translate-y-[38%]'
                    : 'min-h-[18px] min-w-[18px] -translate-y-[38%] translate-x-[45%] px-[5px]'
                }`}
                style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
                title={`未读 ${t.unread} 条`}
                aria-label={`未读 ${t.unread} 条`}
              >
                {muted ? null : <WeChatUnreadBadgeText count={t.unread} />}
              </span>
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[16px] font-normal text-black transition-opacity duration-200">{t.name}</p>
              <span className="shrink-0 text-[12px] leading-none transition-opacity duration-200" style={{ color: '#b2b2b2' }}>
                <WeChatThreadTimeText text={t.time} />
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-[14px] leading-snug transition-opacity duration-200" style={{ color: '#666666' }}>
                <WeChatThreadPreviewText text={t.preview} />
              </p>
              <div className="flex shrink-0 flex-row items-center gap-2">
                {muted ? (
                  <BellOff
                    className="shrink-0 transition-opacity duration-200"
                    width={12}
                    height={12}
                    strokeWidth={2}
                    color="#666666"
                    aria-hidden
                  />
                ) : null}
              </div>
            </div>
          </div>
        </Pressable>
      </motion.div>
    </div>
  )
}

function MessagesTab({
  threads,
  pinnedExpanded,
  onPinnedExpandedChange,
  isConversationMuted,
  onOpenChat,
  playerIdentityId,
  onListDataMutated,
  onThreadHidden,
}: {
  threads: MessagesThreadRow[]
  pinnedExpanded: boolean
  onPinnedExpandedChange: (v: boolean) => void
  isConversationMuted: (conversationKey: string) => boolean
  onOpenChat: (chat: WxActiveChat) => void
  playerIdentityId: string | null
  onListDataMutated: () => void
  onThreadHidden?: (conversationKey: string) => void
}) {
  const [swipeOpenThreadKey, setSwipeOpenThreadKey] = useState<string | null>(null)
  const [deleteConfirmThread, setDeleteConfirmThread] = useState<MessagesThreadRow | null>(null)
  const [pinActionSheet, setPinActionSheet] = useState<{
    thread: MessagesThreadRow
    x: number
    y: number
  } | null>(null)

  const pinnedThreads = useMemo(() => threads.filter((t) => t.isPinned), [threads])
  const normalThreads = useMemo(() => threads.filter((t) => !t.isPinned), [threads])

  const pinTotal = pinnedThreads.length
  const needsFold = pinTotal >= 4
  const visiblePinned = needsFold && !pinnedExpanded ? pinnedThreads.slice(0, 3) : pinnedThreads
  const foldRestCount = pinTotal - 3

  const outerMaxHeightPx = !needsFold
    ? pinTotal * PIN_ROW_EST_PX
    : pinnedExpanded
      ? pinTotal * PIN_ROW_EST_PX + 44
      : 3 * PIN_ROW_EST_PX + 44

  const showPinnedBlock = pinTotal > 0
  const showMidDivider = showPinnedBlock && normalThreads.length > 0

  const onLongPressRow = useCallback((t: MessagesThreadRow, e: ReactPointerEvent) => {
    setPinActionSheet({ thread: t, x: e.clientX, y: e.clientY })
  }, [])

  const applyPinToggle = useCallback(
    async (t: MessagesThreadRow, nextPinned: boolean) => {
      if (!playerIdentityId) return
      await personaDb.updatePinnedStatus({
        conversationKey: t.conversationKey,
        peerCharacterId: t.peerCharacterId,
        playerIdentityId,
        isPinned: nextPinned,
      })
      setPinActionSheet(null)
    },
    [playerIdentityId],
  )

  const applyDeleteThread = useCallback(
    async (mode: 'hard' | 'soft') => {
      if (!deleteConfirmThread) return
      if (deleteConfirmThread.kind === 'group') {
        const pid = playerIdentityId?.trim()
        if (pid) await personaDb.leaveGroupChat(deleteConfirmThread.groupId, pid)
      } else if (mode === 'soft') {
        await personaDb.hideWeChatConversationHistoryFromUiKeepAiContext(deleteConfirmThread.conversationKey)
      } else {
        await personaDb.deleteAllWeChatMessagesForConversation(deleteConfirmThread.conversationKey)
      }
      setDeleteConfirmThread(null)
      setSwipeOpenThreadKey(null)
      onListDataMutated()
    },
    [deleteConfirmThread, onListDataMutated, playerIdentityId],
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-4"
        onPointerDownCapture={(e) => {
          if (!swipeOpenThreadKey) return
          const el = e.target as HTMLElement
          if (!el.closest('[data-swipe-row-root]')) setSwipeOpenThreadKey(null)
        }}
      >
        <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-3 flex items-center justify-between">
          <p
            className="text-[12px] font-medium uppercase tracking-[0.18em] transition-opacity duration-200"
            style={{ color: 'var(--wx-text-muted)' }}
          >
            会话
          </p>
        </div>

        {threads.length === 0 ? (
          <p className="py-12 text-center text-[14px]" style={{ color: 'var(--wx-text-muted)' }}>
            暂无会话
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {showPinnedBlock ? (
              <div
                className="overflow-hidden rounded-[18px] border transition-[max-height] duration-200 ease-out"
                style={{
                  borderColor: '#e5e5e5',
                  maxHeight: `${outerMaxHeightPx}px`,
                }}
              >
                <div className="flex flex-col">
                  {visiblePinned.map((t, idx) => {
                    const muted = isConversationMuted(t.conversationKey)
                    const showDivider = idx < visiblePinned.length - 1
                    return (
                      <div key={t.key} className={showDivider ? 'border-b border-[#e5e5e5]' : ''}>
                        <MessageThreadListItem
                          t={t}
                          isPinnedSection
                          muted={muted}
                          onOpenChat={onOpenChat}
                          onLongPress={onLongPressRow}
                          swipeOpen={swipeOpenThreadKey === t.key}
                          onSwipeOpenChange={(open) => setSwipeOpenThreadKey(open ? t.key : null)}
                          playerIdentityId={playerIdentityId}
                          onListDataMutated={onListDataMutated}
                          onThreadHidden={onThreadHidden}
                          onRequestDelete={setDeleteConfirmThread}
                        />
                      </div>
                    )
                  })}
                  {needsFold ? (
                    <button
                      type="button"
                      className="flex h-11 w-full shrink-0 items-center justify-center border-t border-[#e5e5e5] bg-[#f5f5f5] text-[14px] text-[#666666] transition-colors duration-200"
                      onClick={() => onPinnedExpandedChange(!pinnedExpanded)}
                    >
                      {pinnedExpanded ? '收起置顶聊天' : `展开${foldRestCount}条置顶聊天`}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showMidDivider ? <div className="mx-4 h-px shrink-0 bg-[#e5e5e5]" aria-hidden /> : null}

            <div className="flex flex-col gap-2">
              {normalThreads.map((t) => {
                const muted = isConversationMuted(t.conversationKey)
                return (
                  <MessageThreadListItem
                    key={t.key}
                    t={t}
                    isPinnedSection={false}
                    muted={muted}
                    onOpenChat={onOpenChat}
                    onLongPress={onLongPressRow}
                    swipeOpen={swipeOpenThreadKey === t.key}
                    onSwipeOpenChange={(open) => setSwipeOpenThreadKey(open ? t.key : null)}
                    playerIdentityId={playerIdentityId}
                    onListDataMutated={onListDataMutated}
                    onThreadHidden={onThreadHidden}
                    onRequestDelete={setDeleteConfirmThread}
                  />
                )
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      {pinActionSheet ? (
        <div className="fixed inset-0 z-[280]" role="presentation">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-black/20"
            onClick={() => setPinActionSheet(null)}
          />
          <div
            className="absolute min-w-[200px] overflow-hidden rounded-[12px] border bg-white shadow-lg"
            style={{
              borderColor: '#e5e5e5',
              left: Math.min(pinActionSheet.x, typeof window !== 'undefined' ? window.innerWidth - 220 : pinActionSheet.x),
              top: Math.min(pinActionSheet.y, typeof window !== 'undefined' ? window.innerHeight - 120 : pinActionSheet.y),
            }}
          >
            <Pressable
              type="button"
              className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-[16px] text-black"
              style={{ borderBottom: '1px solid #e5e5e5', borderRadius: 0, background: '#fff' }}
              onClick={() => void applyPinToggle(pinActionSheet.thread, !pinActionSheet.thread.isPinned)}
            >
              {pinActionSheet.thread.isPinned ? (
                <>
                  <PinOff className="size-4 shrink-0 text-black" strokeWidth={2} aria-hidden />
                  <span>取消置顶</span>
                </>
              ) : (
                <>
                  <Pin className="size-4 shrink-0 text-black" strokeWidth={2} aria-hidden />
                  <span>置顶聊天</span>
                </>
              )}
            </Pressable>
            <Pressable
              type="button"
              className="w-full px-4 py-3.5 text-left text-[16px] text-black"
              style={{ borderRadius: 0, background: '#fff' }}
              onClick={() => setPinActionSheet(null)}
            >
              取消
            </Pressable>
          </div>
        </div>
      ) : null}

      {deleteConfirmThread ? (
        <div className="fixed inset-0 z-[285] flex items-center justify-center px-5" role="presentation">
          <button
            type="button"
            aria-label="关闭删除确认"
            className="absolute inset-0 bg-black/35"
            onClick={() => setDeleteConfirmThread(null)}
          />
          <div
            className="relative z-[1] w-full max-w-[320px] overflow-hidden rounded-[14px] border bg-white"
            style={{ borderColor: '#e5e5e5', boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
          >
            <div className="px-5 py-4">
              <h3 className="text-[17px] font-medium text-black">
                {deleteConfirmThread.kind === 'group' ? '确认删除并退出群聊？' : '确认删除聊天？'}
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-[#666666]">
                {deleteConfirmThread.kind === 'group'
                  ? `将退出群聊「${deleteConfirmThread.name}」并清空本会话在本地的全部记录（含回收站归档），此操作不可仅隐藏界面。提示：可在手机桌面「回收站」查看条目并在保留期内尝试恢复聊天记录。`
                  : `与「${deleteConfirmThread.name}」的会话：可选择只清空聊天界面（本地消息仍保留，角色回复仍会参考完整记录），或彻底删除本地消息并在桌面「回收站」保留至多约 5 日可尝试恢复；后者会清除模型上下文中的历史参考。会话会从信息列表隐藏，直至再次发来消息。若只想在列表里不显示但保留入口，请用左滑「不显示」。提示：两种清空都会在桌面「回收站」生成快照（限期保留），需要时可前往尝试恢复聊天记录。`}
              </p>
            </div>
            {deleteConfirmThread.kind === 'group' ? (
              <div className="flex border-t border-[#e5e5e5]">
                <button
                  type="button"
                  className="h-11 flex-1 text-[16px] text-[#666666] transition-colors active:bg-[#f2f2f2]"
                  onClick={() => setDeleteConfirmThread(null)}
                >
                  取消
                </button>
                <div className="h-11 w-px bg-[#e5e5e5]" aria-hidden />
                <button
                  type="button"
                  className="h-11 flex-1 text-[16px] font-medium text-[#fa5151] transition-colors active:bg-[#fff1f1]"
                  onClick={() => void applyDeleteThread('hard')}
                >
                  删除并退出
                </button>
              </div>
            ) : (
              <div className="flex flex-col border-t border-[#e5e5e5]">
                <button
                  type="button"
                  className="h-11 w-full text-[16px] font-medium text-[#fa5151] transition-colors active:bg-[#fff1f1]"
                  onClick={() => void applyDeleteThread('hard')}
                >
                  彻底删除（清除上下文参考）
                </button>
                <div className="h-px w-full bg-[#e5e5e5]" aria-hidden />
                <button
                  type="button"
                  className="h-11 w-full text-[16px] text-[#576b95] transition-colors active:bg-[#f2f2f2]"
                  onClick={() => void applyDeleteThread('soft')}
                >
                  仅清空界面（保留 AI 参考）
                </button>
                <div className="h-px w-full bg-[#e5e5e5]" aria-hidden />
                <button
                  type="button"
                  className="h-11 w-full text-[16px] text-[#666666] transition-colors active:bg-[#f2f2f2]"
                  onClick={() => setDeleteConfirmThread(null)}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type ThemePanelBoot = {
  /** 从聊天室进入时：打开后直达「聊天气泡 → 按角色覆盖」并选中该会话角色 id */
  focusChatRoleId?: string | null
}

function ThemePanel({
  open,
  onClose,
  boot = {},
}: {
  open: boolean
  onClose: () => void
  boot?: ThemePanelBoot
}) {
  const { state, setWeChatTheme } = useCustomization()
  const { chatTheme, updateChatTheme } = useChatTheme()
  const { wechatTheme, theme } = state
  const fileRef = useRef<HTMLInputElement | null>(null)
  const imageRef = useRef<HTMLInputElement | null>(null)
  const [section, setSection] = useState<
    'home' | 'backgrounds' | 'bubbles' | 'headers' | 'tabbar' | 'cards' | 'chat-theme'
  >('home')
  const [bgTarget, setBgTarget] = useState<'global' | WeChatTabId>('global')
  const [headerTarget, setHeaderTarget] = useState<WeChatTabId>('messages')
  const [bubbleScope, setBubbleScope] = useState<'global' | 'role'>('global')
  const [bubbleRole, setBubbleRole] = useState<string>(WECHAT_LUMI_PEER_CHARACTER_ID)
  const [pendingImage, setPendingImage] = useState<{
    kind: 'bg' | 'header' | 'card' | 'tabbar'
    target?: WeChatTabId
  } | null>(null)

  const [tabBarBgPick, setTabBarBgPick] = useState<{ src: string } | null>(null)

  const [tabBarLabelPanel, setTabBarLabelPanel] = useState<
    | null
    | { scope: 'global' }
    | { scope: 'item'; tabId: WeChatTabId }
  >(null)

  const [tabIconPick, setTabIconPick] = useState<{
    tabId: WeChatTabId
    src: string
  } | null>(null)
  const tabIconFileRef = useRef<HTMLInputElement | null>(null)

  const bootAppliedForOpenRef = useRef(false)
  useEffect(() => {
    if (!open) {
      bootAppliedForOpenRef.current = false
      return
    }
    if (bootAppliedForOpenRef.current) return
    bootAppliedForOpenRef.current = true
    const id = boot.focusChatRoleId?.trim()
    if (id) {
      setSection('bubbles')
      setBubbleScope('role')
      setBubbleRole(id)
    }
  }, [open, boot.focusChatRoleId])

  useEffect(() => {
    if (bubbleRole !== 'lumi') return
    setBubbleRole(WECHAT_LUMI_PEER_CHARACTER_ID)
  }, [bubbleRole])

  const activeBubble = useMemo(() => {
    const raw =
      bubbleScope === 'role' ? bubbleForRole(wechatTheme, bubbleRole) : wechatTheme.bubbleGlobal
    return migrateMislabeledLumiDefaultBubble(raw)
  }, [bubbleScope, bubbleRole, wechatTheme])
  const activeBubbleTailStyle = activeBubble.bubbleTailStyle

  const applyBubblePreset = useCallback(
    (preset: WeChatBubblePreset) => {
      if (preset.chatThemePatch) {
        if (preset.id === 'wechat-app-default') {
          updateChatTheme({
            ...preset.chatThemePatch,
            inputBar: {
              ...preset.chatThemePatch.inputBar,
              layout: 'lumi',
              sendButtonColor: undefined,
            },
          })
        } else {
          updateChatTheme(preset.chatThemePatch)
        }
      }
      if (bubbleScope === 'global') {
        setWeChatTheme({
          bubbleGlobal: preset.bubble,
          selfBubbleText: preset.selfBubbleText,
          otherBubbleText: preset.otherBubbleText,
          ...(preset.wechatThemePatch ?? {}),
        })
        return
      }
      setWeChatTheme({
        bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: preset.bubble },
        selfBubbleText: preset.selfBubbleText,
        otherBubbleText: preset.otherBubbleText,
      })
    },
    [bubbleRole, bubbleScope, setWeChatTheme, updateChatTheme, wechatTheme.bubbleByRole],
  )

  const bubblePreviewBgStyle = useMemo(
    () => wechatChatRoomBgToStyle(wechatTheme.chatRoomDefaultBg, resolvePublicImageUrl),
    [wechatTheme.chatRoomDefaultBg],
  )

  const previewTailMaskColor = useMemo(
    () => wechatChatRoomBgFallbackColor(wechatTheme.chatRoomDefaultBg),
    [wechatTheme.chatRoomDefaultBg],
  )

  const previewInputBar = useMemo(
    () => resolveEffectiveChatInputBarForBubble(chatTheme.inputBar, activeBubble),
    [activeBubble, chatTheme.inputBar],
  )

  const previewChatTheme = useMemo(
    () => ({ ...chatTheme, inputBar: previewInputBar }),
    [chatTheme, previewInputBar],
  )

  const previewWechatTheme = useMemo(
    () => resolvePreviewWechatThemeForBubble(wechatTheme, activeBubble),
    [activeBubble, wechatTheme],
  )

  const bgFill: WxFillStyle =
    bgTarget === 'global'
      ? wechatTheme.pageBgGlobal
      : wechatTheme.pageBgByTab?.[bgTarget] ?? wechatTheme.pageBgGlobal

  const headerFill: WxFillStyle =
    wechatTheme.headerByTab?.[headerTarget] ?? {
      ...wechatTheme.pageBgGlobal,
      mode: 'solid',
      solidColor: wechatTheme.surface,
    }

  const cssExport = useMemo(() => {
    const t = wechatTheme
    const resolvedFont = t.fontFamily?.trim() ? t.fontFamily : theme.fontFamily
    const resolvedNumFont = t.numberFontFamily?.trim() ? t.numberFontFamily : 'var(--wx-num-font)'
    return [
      '/* WeChat Theme (CSS Variables) */',
      '[data-app-id="wechat"] {',
      `  --wx-primary: ${t.primary};`,
      `  --wx-bg: ${t.background};`,
      `  --wx-surface: ${t.surface};`,
      `  --wx-text: ${t.text};`,
      `  --wx-text-muted: ${t.textMuted};`,
      `  --wx-border: ${t.border};`,
      `  --wx-shadow: ${t.shadow};`,
      `  --wx-font: ${resolvedFont};`,
      `  --wx-num-font: ${resolvedNumFont};`,
      `  --wx-font-size: ${t.fontSizeBasePx}px;`,
      `  --wx-radius: ${t.radiusPx}px;`,
      '',
      `  --wx-tabbar-bg: ${t.tabBarBg};`,
      `  --wx-tabbar-active: ${t.tabBarActive};`,
      `  --wx-tabbar-inactive: ${t.tabBarInactive};`,
      '',
      `  --wx-input-bg: ${t.chatInputBg};`,
      `  --wx-input-border: ${t.chatInputBorder};`,
      `  --wx-self-bubble-bg: ${t.bubbleGlobal.selfBubbleBg};`,
      `  --wx-self-bubble-text: ${t.selfBubbleText};`,
      `  --wx-self-bubble-radius: ${t.bubbleGlobal.selfBubbleRadiusPx}px;`,
      `  --wx-other-bubble-bg: ${t.bubbleGlobal.otherBubbleBg};`,
      `  --wx-other-bubble-text: ${t.otherBubbleText};`,
      `  --wx-other-bubble-radius: ${t.bubbleGlobal.otherBubbleRadiusPx}px;`,
      `  --wx-avatar-radius: ${t.bubbleGlobal.avatarRadiusPx}px;`,
      `  --wx-timestamp-text: ${t.timestampText};`,
      '}',
      '',
      '/* Notes: */',
      '/* - Boolean & enum options live in JSON state (showAvatar, timestampStyle). */',
    ].join('\n')
  }, [theme.fontFamily, wechatTheme])

  const chatSkinExport = useMemo(
    () =>
      WECHAT_CHAT_SKIN_EXPORT_UI_ENABLED
        ? buildWeChatChatSkinExport({
            wechatTheme,
            chatTheme,
            globalFontFamily: theme.fontFamily,
          })
        : '',
    [chatTheme, theme.fontFamily, wechatTheme],
  )

  const chatSkinAiPrompt = useMemo(
    () => (WECHAT_CHAT_SKIN_EXPORT_UI_ENABLED ? buildWeChatChatSkinAiPrompt() : ''),
    [],
  )

  async function onPickLocalImage(file: File | null) {
    if (!file || !pendingImage) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      if (pendingImage.kind === 'bg') {
        if (bgTarget === 'global') {
          setWeChatTheme({
            pageBgGlobal: { ...wechatTheme.pageBgGlobal, mode: 'image', imageUrl: src },
          })
        } else {
          setWeChatTheme({
            pageBgByTab: {
              ...wechatTheme.pageBgByTab,
              [bgTarget]: { ...bgFill, mode: 'image', imageUrl: src },
            },
          })
        }
      } else if (pendingImage.kind === 'header') {
        setWeChatTheme({
          headerByTab: {
            ...wechatTheme.headerByTab,
            [headerTarget]: { ...headerFill, mode: 'image', imageUrl: src },
          },
        })
      } else if (pendingImage.kind === 'card') {
        setWeChatTheme({
          conversationCard: { ...wechatTheme.conversationCard, mode: 'image', imageUrl: src },
        })
      } else if (pendingImage.kind === 'tabbar') {
        setTabBarBgPick({ src })
      }
      setPendingImage(null)
    }
    reader.readAsDataURL(file)
  }

  async function onPickTabIconFile(file: File | null, tabId: WeChatTabId) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setTabIconPick({ tabId, src })
    }
    reader.readAsDataURL(file)
  }

  function NavCard({ title, desc, to }: { title: string; desc: string; to: typeof section }) {
    return (
      <Pressable
        onClick={() => setSection(to)}
        className="w-full rounded-[18px] border px-4 py-4 text-left"
        style={{
          borderColor: 'var(--wx-border)',
          background: 'var(--wx-surface)',
          boxShadow: 'var(--wx-shadow)',
        }}
      >
        <p className="text-[14px] font-semibold" style={{ color: 'var(--wx-text)' }}>
          {title}
        </p>
        <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--wx-text-muted)' }}>
          {desc}
        </p>
      </Pressable>
    )
  }

  async function onImportCss(file: File | null) {
    if (!file) return
    const text = await file.text()
    const vars = parseWeChatCssVars(text)
    const pxToNum = (v: string) => {
      const m = v.trim().match(/^(-?\d+(?:\.\d+)?)px$/i)
      return m ? Number(m[1]) : null
    }

    const patch: Partial<WeChatTheme> = {}
    if (vars.primary) patch.primary = vars.primary
    if (vars.bg) patch.background = vars.bg
    if (vars.surface) patch.surface = vars.surface
    if (vars.text) patch.text = vars.text
    if (vars['text-muted']) patch.textMuted = vars['text-muted']
    if (vars.border) patch.border = vars.border
    if (vars.shadow) patch.shadow = vars.shadow
    if (vars.font) patch.fontFamily = vars.font
    if (vars['num-font']) patch.numberFontFamily = vars['num-font']
    if (vars['font-size']) {
      const n = pxToNum(vars['font-size'])
      if (n != null) patch.fontSizeBasePx = clamp(Math.round(n), 12, 18)
    }
    if (vars.radius) {
      const n = pxToNum(vars.radius)
      if (n != null) patch.radiusPx = clamp(Math.round(n), 10, 24)
    }

    if (vars['tabbar-bg']) patch.tabBarBg = vars['tabbar-bg']
    if (vars['tabbar-active']) patch.tabBarActive = vars['tabbar-active']
    if (vars['tabbar-inactive']) patch.tabBarInactive = vars['tabbar-inactive']

    if (vars['input-bg']) patch.chatInputBg = vars['input-bg']
    if (vars['input-border']) patch.chatInputBorder = vars['input-border']
    const bubblePatch: Partial<WeChatBubbleTheme> = {}
    if (vars['self-bubble-bg']) bubblePatch.selfBubbleBg = vars['self-bubble-bg']
    if (vars['self-bubble-radius']) {
      const n = pxToNum(vars['self-bubble-radius'])
      if (n != null) bubblePatch.selfBubbleRadiusPx = clamp(Math.round(n), 10, 28)
    }
    if (vars['other-bubble-bg']) bubblePatch.otherBubbleBg = vars['other-bubble-bg']
    if (vars['other-bubble-radius']) {
      const n = pxToNum(vars['other-bubble-radius'])
      if (n != null) bubblePatch.otherBubbleRadiusPx = clamp(Math.round(n), 10, 28)
    }
    if (vars['avatar-radius']) {
      const n = pxToNum(vars['avatar-radius'])
      if (n != null) bubblePatch.avatarRadiusPx = clamp(Math.round(n), 0, 18)
    }
    if (Object.keys(bubblePatch).length) {
      patch.bubbleGlobal = { ...wechatTheme.bubbleGlobal, ...bubblePatch }
    }
    if (vars['self-bubble-text']) patch.selfBubbleText = vars['self-bubble-text']
    if (vars['other-bubble-text']) patch.otherBubbleText = vars['other-bubble-text']
    if (vars['timestamp-text']) patch.timestampText = vars['timestamp-text']

    setWeChatTheme(patch)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[1200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="absolute inset-0 z-[1200] flex flex-col"
            style={{
              background: 'var(--wx-bg)',
            }}
            aria-label="主题设置"
          >
            <div
              className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2"
              style={{
                paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
                borderBottom: '1px solid var(--wx-border)',
                background: 'color-mix(in oklab, var(--wx-surface) 92%, transparent)',
                backdropFilter: 'blur(22px)',
              }}
            >
              <Pressable
                onClick={() => {
                  if (section === 'home') onClose()
                  else setSection('home')
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ color: 'var(--wx-text)' }}
                aria-label="返回"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Pressable>
              <p
                className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold"
                style={{ color: 'var(--wx-text)' }}
              >
                {section === 'home'
                  ? '主题设置'
                  : section === 'backgrounds'
                    ? '背景'
                    : section === 'bubbles'
                      ? '聊天气泡'
                      : section === 'headers'
                        ? '标题栏'
                        : section === 'tabbar'
                          ? '主页导航栏'
                          : section === 'chat-theme'
                            ? '聊天输入栏'
                            : '聊天卡片样式'}
              </p>
              <Pressable
                onClick={onClose}
                className="rounded-full px-3 py-2 text-[12px]"
                style={{ color: 'var(--wx-text-muted)', background: 'rgba(0,0,0,0.04)' }}
                aria-label="关闭"
              >
                关闭
              </Pressable>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
            >
            <div className="mx-auto w-full max-w-[560px]">
              {section === 'home' ? (
                <div className="space-y-3">
                  <NavCard
                    title="背景"
                    desc="全局/单页背景；支持纯色、渐变、URL 与本地壁纸。单页优先于全局（不含聊天页）。"
                    to="backgrounds"
                  />
                  <NavCard
                    title="聊天气泡"
                    desc="先配置全局，再选择聊天角色单独覆盖；可切换是否全局生效。"
                    to="bubbles"
                  />
                  <NavCard
                    title="标题栏"
                    desc="信息/通讯录/约会/发现/我 各页面独立；支持纯色、渐变、URL 与本地图片。"
                    to="headers"
                  />
                  <NavCard
                    title="主页导航栏"
                    desc="底部 TabBar 的整体样式：背景、选中/未选中颜色。"
                    to="tabbar"
                  />
                  <NavCard
                    title="聊天卡片样式"
                    desc="信息页会话列表卡片背景：纯色、渐变、URL 与本地图片。"
                    to="cards"
                  />
                  <NavCard
                    title="聊天输入栏（IndexedDB）"
                    desc="仅底部输入栏：圆角、描边、背景、按钮图标色与尺寸。聊天气泡请在「聊天气泡」里设置。"
                    to="chat-theme"
                  />
                </div>
              ) : section === 'chat-theme' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-[18px] border p-3"
                    style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}
                  >
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--wx-text)' }}>
                      输入栏
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--wx-text-muted)' }}>
                      底部输入栏仅在进入聊天室后显示；此处不展示预览，只保存样式参数。
                    </p>
                    <label className="mt-2 block text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      输入框圆角（px）
                    </label>
                    <input
                      type="number"
                      min={8}
                      max={28}
                      value={chatTheme.inputBar.borderRadius}
                      onChange={(e) =>
                        updateChatTheme({ inputBar: { borderRadius: clamp(Number(e.target.value) || 16, 8, 28) } })
                      }
                      className="mt-1 w-full rounded-[12px] border px-3 py-2 text-[13px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                    />
                    <label className="mt-2 block text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      描边色
                    </label>
                    <input
                      type="color"
                      value={chatTheme.inputBar.borderColor}
                      onChange={(e) => updateChatTheme({ inputBar: { borderColor: e.target.value } })}
                      className="mt-1 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 p-1"
                    />
                    <label className="mt-2 block text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      栏背景色
                    </label>
                    <input
                      type="color"
                      value={chatTheme.inputBar.backgroundColor}
                      onChange={(e) => updateChatTheme({ inputBar: { backgroundColor: e.target.value } })}
                      className="mt-1 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 p-1"
                    />
                    <label className="mt-2 block text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      按钮图标色
                    </label>
                    <input
                      type="color"
                      value={chatTheme.inputBar.buttonColor}
                      onChange={(e) => updateChatTheme({ inputBar: { buttonColor: e.target.value } })}
                      className="mt-1 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 p-1"
                    />
                    <label className="mt-2 block text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      按钮尺寸（px）
                    </label>
                    <input
                      type="number"
                      min={14}
                      max={28}
                      value={chatTheme.inputBar.buttonSize}
                      onChange={(e) =>
                        updateChatTheme({ inputBar: { buttonSize: clamp(Number(e.target.value) || 20, 14, 28) } })
                      }
                      className="mt-1 w-full rounded-[12px] border px-3 py-2 text-[13px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                    />
                  </div>
                </div>
              ) : section === 'backgrounds' ? (
                <div className="space-y-3">
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      目标页面
                    </p>
                    <select
                      className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={bgTarget}
                      onChange={(e) => setBgTarget(e.target.value as any)}
                    >
                      <option value="global">全局（除聊天页）</option>
                      <option value="messages">信息</option>
                      <option value="contacts">通讯录</option>
                      <option value="dates">约会</option>
                      <option value="discover">发现</option>
                      <option value="profile">我</option>
                    </select>
                    <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--wx-text-muted)' }}>
                      优先级：单页设置 &gt; 全局设置。
                    </p>
                    {bgTarget === 'global' ? (
                      <Pressable
                        type="button"
                        onClick={() =>
                          setWeChatTheme({
                            pageBgGlobal: { ...DEFAULT_CUSTOMIZATION.wechatTheme.pageBgGlobal },
                          })
                        }
                        className="mt-3 w-full rounded-[14px] border px-3 py-2.5 text-[12px] font-medium"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: 'rgba(0,0,0,0.04)',
                          color: 'var(--wx-text)',
                        }}
                      >
                        恢复全局默认
                      </Pressable>
                    ) : null}
                  </div>

                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      背景类型
                    </p>
                    <select
                      className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={bgFill.mode}
                      onChange={(e) => {
                        const mode = e.target.value as WxFillMode
                        const next = { ...bgFill, mode }
                        if (bgTarget === 'global') setWeChatTheme({ pageBgGlobal: next })
                        else
                          setWeChatTheme({
                            pageBgByTab: { ...wechatTheme.pageBgByTab, [bgTarget]: next },
                          })
                      }}
                    >
                      <option value="solid">纯色</option>
                      <option value="gradient">渐变</option>
                      <option value="image">图片</option>
                    </select>

                    {bgFill.mode === 'solid' ? (
                      <input
                        type="color"
                        value={bgFill.solidColor}
                        onChange={(e) => {
                          const next = { ...bgFill, solidColor: e.target.value }
                          if (bgTarget === 'global') setWeChatTheme({ pageBgGlobal: next })
                          else
                            setWeChatTheme({
                              pageBgByTab: { ...wechatTheme.pageBgByTab, [bgTarget]: next },
                            })
                        }}
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    ) : bgFill.mode === 'gradient' ? (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                            渐变起点
                          </p>
                          <input
                            type="color"
                            value={bgFill.gradientFrom}
                            onChange={(e) => {
                              const next = { ...bgFill, gradientFrom: e.target.value }
                              if (bgTarget === 'global') setWeChatTheme({ pageBgGlobal: next })
                              else
                                setWeChatTheme({
                                  pageBgByTab: { ...wechatTheme.pageBgByTab, [bgTarget]: next },
                                })
                            }}
                            className="mt-1 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                          />
                        </div>
                        <div>
                          <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                            渐变终点
                          </p>
                          <input
                            type="color"
                            value={bgFill.gradientTo}
                            onChange={(e) => {
                              const next = { ...bgFill, gradientTo: e.target.value }
                              if (bgTarget === 'global') setWeChatTheme({ pageBgGlobal: next })
                              else
                                setWeChatTheme({
                                  pageBgByTab: { ...wechatTheme.pageBgByTab, [bgTarget]: next },
                                })
                            }}
                            className="mt-1 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                            角度：{bgFill.gradientAngle}°
                          </p>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={1}
                            value={bgFill.gradientAngle}
                            onChange={(e) => {
                              const next = { ...bgFill, gradientAngle: Number(e.target.value) }
                              if (bgTarget === 'global') setWeChatTheme({ pageBgGlobal: next })
                              else
                                setWeChatTheme({
                                  pageBgByTab: { ...wechatTheme.pageBgByTab, [bgTarget]: next },
                                })
                            }}
                            className="mt-1 w-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <input
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                          placeholder="图片 URL / dataURL"
                          value={bgFill.imageUrl}
                          onChange={(e) => {
                            const next = { ...bgFill, imageUrl: e.target.value }
                            if (bgTarget === 'global') setWeChatTheme({ pageBgGlobal: next })
                            else
                              setWeChatTheme({
                                pageBgByTab: { ...wechatTheme.pageBgByTab, [bgTarget]: next },
                              })
                          }}
                        />
                        <div className="flex gap-2">
                          <Pressable
                            onClick={() => {
                              setPendingImage({ kind: 'bg' })
                              imageRef.current?.click()
                            }}
                            className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                            style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                          >
                            本地上传
                          </Pressable>
                          {bgTarget === 'global' ? null : (
                            <Pressable
                              onClick={() => {
                                const next = { ...wechatTheme.pageBgByTab }
                                delete (next as any)[bgTarget]
                                setWeChatTheme({ pageBgByTab: next })
                              }}
                              className="rounded-[14px] border px-3 py-2 text-[12px]"
                              style={{ borderColor: 'var(--wx-border)', background: 'rgba(0,0,0,0.04)', color: 'var(--wx-text)' }}
                            >
                              清除单页
                            </Pressable>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : section === 'headers' ? (
                <div className="space-y-3">
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      目标页面
                    </p>
                    <select
                      className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={headerTarget}
                      onChange={(e) => setHeaderTarget(e.target.value as any)}
                    >
                      <option value="messages">信息</option>
                      <option value="contacts">通讯录</option>
                      <option value="dates">约会</option>
                      <option value="discover">发现</option>
                      <option value="profile">我</option>
                    </select>
                  </div>
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      标题栏类型
                    </p>
                    <select
                      className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={headerFill.mode}
                      onChange={(e) => {
                        const next = { ...headerFill, mode: e.target.value as any }
                        setWeChatTheme({ headerByTab: { ...wechatTheme.headerByTab, [headerTarget]: next } })
                      }}
                    >
                      <option value="solid">纯色</option>
                      <option value="gradient">渐变</option>
                      <option value="image">图片</option>
                    </select>
                    {headerFill.mode === 'solid' ? (
                      <input
                        type="color"
                        value={headerFill.solidColor}
                        onChange={(e) =>
                          setWeChatTheme({
                            headerByTab: {
                              ...wechatTheme.headerByTab,
                              [headerTarget]: { ...headerFill, solidColor: e.target.value },
                            },
                          })
                        }
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    ) : headerFill.mode === 'gradient' ? (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <input
                          type="color"
                          value={headerFill.gradientFrom}
                          onChange={(e) =>
                            setWeChatTheme({
                              headerByTab: {
                                ...wechatTheme.headerByTab,
                                [headerTarget]: { ...headerFill, gradientFrom: e.target.value },
                              },
                            })
                          }
                          className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                        />
                        <input
                          type="color"
                          value={headerFill.gradientTo}
                          onChange={(e) =>
                            setWeChatTheme({
                              headerByTab: {
                                ...wechatTheme.headerByTab,
                                [headerTarget]: { ...headerFill, gradientTo: e.target.value },
                              },
                            })
                          }
                          className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <input
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                          placeholder="图片 URL / dataURL"
                          value={headerFill.imageUrl}
                          onChange={(e) =>
                            setWeChatTheme({
                              headerByTab: {
                                ...wechatTheme.headerByTab,
                                [headerTarget]: { ...headerFill, imageUrl: e.target.value },
                              },
                            })
                          }
                        />
                        <Pressable
                          onClick={() => {
                            setPendingImage({ kind: 'header', target: headerTarget })
                            imageRef.current?.click()
                          }}
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px]"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                        >
                          本地上传
                        </Pressable>
                      </div>
                    )}
                  </div>
                </div>
              ) : section === 'cards' ? (
                <div className="space-y-3">
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      会话卡片背景
                    </p>
                    <select
                      className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={wechatTheme.conversationCard.mode}
                      onChange={(e) =>
                        setWeChatTheme({
                          conversationCard: { ...wechatTheme.conversationCard, mode: e.target.value as any },
                        })
                      }
                    >
                      <option value="solid">纯色</option>
                      <option value="gradient">渐变</option>
                      <option value="image">图片</option>
                    </select>
                    {wechatTheme.conversationCard.mode === 'solid' ? (
                      <input
                        type="color"
                        value={wechatTheme.conversationCard.solidColor}
                        onChange={(e) =>
                          setWeChatTheme({
                            conversationCard: { ...wechatTheme.conversationCard, solidColor: e.target.value },
                          })
                        }
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    ) : wechatTheme.conversationCard.mode === 'gradient' ? (
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <input
                          type="color"
                          value={wechatTheme.conversationCard.gradientFrom}
                          onChange={(e) =>
                            setWeChatTheme({
                              conversationCard: { ...wechatTheme.conversationCard, gradientFrom: e.target.value },
                            })
                          }
                          className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                        />
                        <input
                          type="color"
                          value={wechatTheme.conversationCard.gradientTo}
                          onChange={(e) =>
                            setWeChatTheme({
                              conversationCard: { ...wechatTheme.conversationCard, gradientTo: e.target.value },
                            })
                          }
                          className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <input
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                          placeholder="图片 URL / dataURL"
                          value={wechatTheme.conversationCard.imageUrl}
                          onChange={(e) =>
                            setWeChatTheme({
                              conversationCard: { ...wechatTheme.conversationCard, imageUrl: e.target.value },
                            })
                          }
                        />
                        <Pressable
                          onClick={() => {
                            setPendingImage({ kind: 'card' })
                            imageRef.current?.click()
                          }}
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px]"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                        >
                          本地上传
                        </Pressable>
                      </div>
                    )}
                  </div>
                </div>
              ) : section === 'tabbar' ? (
                <div className="space-y-3">
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      导航栏背景
                    </p>

                    <div
                      className="relative mt-2 overflow-hidden rounded-[16px] border"
                      style={{
                        borderColor: 'var(--wx-border)',
                        boxShadow: 'var(--wx-shadow)',
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ ...fillToStyle(wechatTheme.tabBarStyle), opacity: fillLayerOpacity(wechatTheme.tabBarStyle) }}
                        aria-hidden
                      />
                      <div className="pointer-events-none absolute inset-0" style={glassStyle(wechatTheme.tabBarStyle)} aria-hidden />
                      {/* 预览高度与主页真实 TabBar 对齐 */}
                      <div className="relative mx-auto grid max-w-[420px] grid-cols-5 px-2 pt-1.5 pb-2">
                        {wechatTheme.tabBarItems.slice(0, 5).map((it) => {
                          const isActive = it.id === 'messages'
                          const labelColor = isActive
                            ? it.labelActiveColor?.trim() || wechatTheme.tabBarLabelActive
                            : it.labelInactiveColor?.trim() || wechatTheme.tabBarLabelInactive
                          return (
                            <div
                              key={it.id}
                              className="flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px]"
                              style={{
                                color: isActive ? 'var(--wx-tabbar-active)' : 'var(--wx-tabbar-inactive)',
                              }}
                              aria-hidden
                            >
                              {it.iconUrl?.trim() ? (
                                <img
                                  src={it.iconUrl}
                                  alt=""
                                  className="h-[22px] w-[22px] rounded-[6px] object-cover"
                                />
                              ) : (
                                <div
                                  className="h-[22px] w-[22px] rounded-[6px] border"
                                  style={{ borderColor: 'rgba(0,0,0,0.08)' }}
                                />
                              )}
                              <div className="leading-none">
                                <div className="text-[12px] font-medium tracking-[0.2px]" style={{ color: labelColor }}>
                                  {it.label}
                                </div>
                                <div className="mt-[1px] text-[10px] tracking-[0.14em] opacity-70" style={{ color: labelColor }}>
                                  {it.en}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <select
                      className="mt-3 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={wechatTheme.tabBarStyle.mode}
                      onChange={(e) =>
                        setWeChatTheme({
                          tabBarStyle: { ...wechatTheme.tabBarStyle, mode: e.target.value as any },
                        })
                      }
                    >
                      <option value="solid">纯色</option>
                      <option value="gradient">渐变</option>
                      <option value="image">图片</option>
                    </select>

                    {wechatTheme.tabBarStyle.mode === 'solid' ? (
                      <input
                        type="color"
                        value={wechatTheme.tabBarStyle.solidColor}
                        onChange={(e) =>
                          setWeChatTheme({
                            tabBarStyle: { ...wechatTheme.tabBarStyle, solidColor: e.target.value },
                            tabBarBg: e.target.value,
                          })
                        }
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    ) : wechatTheme.tabBarStyle.mode === 'gradient' ? (
                      <div className="mt-2 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="color"
                            value={wechatTheme.tabBarStyle.gradientFrom}
                            onChange={(e) =>
                              setWeChatTheme({
                                tabBarStyle: { ...wechatTheme.tabBarStyle, gradientFrom: e.target.value },
                              })
                            }
                            className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                          />
                          <input
                            type="color"
                            value={wechatTheme.tabBarStyle.gradientTo}
                            onChange={(e) =>
                              setWeChatTheme({
                                tabBarStyle: { ...wechatTheme.tabBarStyle, gradientTo: e.target.value },
                              })
                            }
                            className="h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                          />
                        </div>

                        <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: 'var(--wx-border)' }}>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                              渐变自然度
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                              {wechatTheme.tabBarStyle.gradientNaturalness}
                            </p>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={wechatTheme.tabBarStyle.gradientNaturalness}
                            onChange={(e) =>
                              setWeChatTheme({
                                tabBarStyle: {
                                  ...wechatTheme.tabBarStyle,
                                  gradientNaturalness: Number(e.target.value),
                                },
                              })
                            }
                            className="mt-2 w-full"
                          />
                        </div>

                        <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: 'var(--wx-border)' }}>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                              渐变角度
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                              {wechatTheme.tabBarStyle.gradientAngle}°
                            </p>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={1}
                            value={wechatTheme.tabBarStyle.gradientAngle}
                            onChange={(e) =>
                              setWeChatTheme({
                                tabBarStyle: { ...wechatTheme.tabBarStyle, gradientAngle: Number(e.target.value) },
                              })
                            }
                            className="mt-2 w-full"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <input
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                          placeholder="图片 URL / dataURL"
                          value={wechatTheme.tabBarStyle.imageUrl}
                          onChange={(e) =>
                            setWeChatTheme({
                              tabBarStyle: { ...wechatTheme.tabBarStyle, imageUrl: e.target.value },
                            })
                          }
                        />
                        <Pressable
                          onClick={() => {
                            setPendingImage({ kind: 'tabbar' })
                            imageRef.current?.click()
                          }}
                          className="w-full rounded-[14px] border px-3 py-2 text-[12px]"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                        >
                          本地上传导航栏背景
                        </Pressable>
                      </div>
                    )}

                    <div className="mt-3 rounded-[16px] border px-3 py-2" style={{ borderColor: 'var(--wx-border)' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                          背景透明度
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                          {wechatTheme.tabBarStyle.layerOpacity}%
                        </p>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={wechatTheme.tabBarStyle.layerOpacity}
                        onChange={(e) =>
                          setWeChatTheme({
                            tabBarStyle: { ...wechatTheme.tabBarStyle, layerOpacity: Number(e.target.value) },
                          })
                        }
                        className="mt-2 w-full"
                      />
                    </div>

                    <div className="mt-3 rounded-[16px] border px-3 py-2" style={{ borderColor: 'var(--wx-border)' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                          毛玻璃
                        </p>
                        <Pressable
                          onClick={() =>
                            setWeChatTheme({
                              tabBarStyle: { ...wechatTheme.tabBarStyle, glassEnabled: !wechatTheme.tabBarStyle.glassEnabled },
                            })
                          }
                          className="rounded-[12px] border px-3 py-1.5 text-[12px]"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                        >
                          {wechatTheme.tabBarStyle.glassEnabled ? '已开启' : '已关闭'}
                        </Pressable>
                      </div>

                      {wechatTheme.tabBarStyle.glassEnabled ? (
                        <div className="mt-3 space-y-3">
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                                模糊强度
                              </p>
                              <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                                {wechatTheme.tabBarStyle.blurPx}px
                              </p>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={40}
                              step={1}
                              value={wechatTheme.tabBarStyle.blurPx}
                              onChange={(e) =>
                                setWeChatTheme({
                                  tabBarStyle: { ...wechatTheme.tabBarStyle, blurPx: Number(e.target.value) },
                                })
                              }
                              className="mt-2 w-full"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                                玻璃不透明度
                              </p>
                              <p className="text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                                {wechatTheme.tabBarStyle.glassOpacity}%
                              </p>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={wechatTheme.tabBarStyle.glassOpacity}
                              onChange={(e) =>
                                setWeChatTheme({
                                  tabBarStyle: { ...wechatTheme.tabBarStyle, glassOpacity: Number(e.target.value) },
                                })
                              }
                              className="mt-2 w-full"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      字样颜色（全局）
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      影响所有按钮的中英文文案；单按钮可在下方覆盖。
                    </p>

                    <Pressable
                      onClick={() => setTabBarLabelPanel({ scope: 'global' })}
                      className="mt-3 w-full rounded-[14px] border px-3 py-2 text-[12px]"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                    >
                      配置全局字色（选中/未选中）
                    </Pressable>

                    <Pressable
                      onClick={() =>
                        setWeChatTheme({
                          tabBarItems: wechatTheme.tabBarItems.map((it) => ({
                            ...it,
                            labelActiveColor: '',
                            labelInactiveColor: '',
                          })),
                        })
                      }
                      className="mt-3 w-full rounded-[14px] border px-3 py-2 text-[12px]"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                    >
                      将全局字色应用到全部（清空单项覆盖）
                    </Pressable>
                  </div>

                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      导航按钮
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      支持自定义图标（URL/本地上传裁剪 1:1）与拖拽排序（按住左侧把手拖动）。
                    </p>

                    <Reorder.Group
                      axis="y"
                      values={wechatTheme.tabBarItems}
                      onReorder={(next) => setWeChatTheme({ tabBarItems: next })}
                      className="mt-3 space-y-2"
                    >
                      {wechatTheme.tabBarItems.map((it, idx) => (
                        <TabBarItemRow
                          key={it.id}
                          item={it}
                          index={idx}
                          onSetIconUrl={(iconUrl) =>
                            setWeChatTheme({
                              tabBarItems: wechatTheme.tabBarItems.map((x) =>
                                x.id === it.id ? { ...x, iconUrl } : x,
                              ),
                            })
                          }
                          onOpenLabelPanel={() => setTabBarLabelPanel({ scope: 'item', tabId: it.id })}
                          onPickLocal={() => {
                            tabIconFileRef.current?.setAttribute('data-tab-id', it.id)
                            tabIconFileRef.current?.click()
                          }}
                        />
                      ))}
                    </Reorder.Group>
                  </div>
                </div>
              ) : section === 'bubbles' ? (
                <div className="space-y-3">
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      配置范围
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Pressable
                        onClick={() => setBubbleScope('global')}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: bubbleScope === 'global' ? 'rgba(0,0,0,0.06)' : 'transparent',
                          color: 'var(--wx-text)',
                        }}
                      >
                        全局配置
                      </Pressable>
                      <Pressable
                        onClick={() => setBubbleScope('role')}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: bubbleScope === 'role' ? 'rgba(0,0,0,0.06)' : 'transparent',
                          color: 'var(--wx-text)',
                        }}
                      >
                        按角色覆盖
                      </Pressable>
                    </div>
                    {bubbleScope === 'role' ? (
                      <select
                        className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                        style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                        value={(() => {
                          const rid = bubbleRole === 'lumi' ? WECHAT_LUMI_PEER_CHARACTER_ID : bubbleRole
                          const inPersona = state.wechatPersonaContacts.some((c) => c.characterId === rid)
                          if (rid === WECHAT_LUMI_PEER_CHARACTER_ID || inPersona) return rid
                          return WECHAT_LUMI_PEER_CHARACTER_ID
                        })()}
                        onChange={(e) => setBubbleRole(e.target.value)}
                      >
                        <option value={WECHAT_LUMI_PEER_CHARACTER_ID}>Lumi</option>
                        {state.wechatPersonaContacts.map((c) => (
                          <option key={c.characterId} value={c.characterId}>
                            {(c.remarkName || '未命名').trim() || c.characterId}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      气泡模版
                    </p>
                    <div className="mt-3">
                      <WeChatBubblePresetCards
                        presets={WECHAT_BUBBLE_PRESETS}
                        activeBubble={activeBubble}
                        selfBubbleText={wechatTheme.selfBubbleText}
                        otherBubbleText={wechatTheme.otherBubbleText}
                        wechatTheme={wechatTheme}
                        bubbleScope={bubbleScope}
                        onApply={applyBubblePreset}
                      />
                    </div>
                  </div>

                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      预览
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--wx-text-muted)' }}>
                      对照文字气泡、顶栏、输入栏、红包、转账、语音与位置卡片；切换上方模版或调整颜色后可即时查看。
                    </p>
                    <WeChatChatSkinPreviewPanel
                      wechatTheme={previewWechatTheme}
                      chatTheme={previewChatTheme}
                      bubble={activeBubble}
                      roomBgStyle={bubblePreviewBgStyle}
                      tailMaskColor={previewTailMaskColor}
                    />
                  </div>

                  {WECHAT_CHAT_SKIN_EXPORT_UI_ENABLED ? (
                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      导出聊天美化模版
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--wx-text-muted)' }}>
                      复制 AI 提示词后，在文末「需求填写模版」里按区块填空（留空表示不改），整段发给 AI；把返回的 CSS 贴到「外观 → 自定义 CSS」。
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pressable
                        onClick={() => downloadTextFile('lumi-wechat-chat-skin.template.css', chatSkinExport)}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{ borderColor: 'var(--wx-border)', background: 'rgba(0,0,0,0.06)', color: 'var(--wx-text)' }}
                      >
                        导出 CSS 模版
                      </Pressable>
                      <Pressable
                        onClick={() => {
                          void copyTextToClipboard(chatSkinAiPrompt).catch(() => {
                            window.alert('复制失败，请重试')
                          })
                        }}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      >
                        复制 AI 提示词
                      </Pressable>
                    </div>
                  </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                      <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                        对方气泡颜色
                      </p>
                      <input
                        type="color"
                        value={activeBubble.otherBubbleBg}
                        onChange={(e) => {
                          const next = { ...activeBubble, otherBubbleBg: e.target.value }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else
                            setWeChatTheme({
                              bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next },
                            })
                        }}
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    </div>
                    <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                      <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                        自己气泡颜色
                      </p>
                      <input
                        type="color"
                        value={activeBubble.selfBubbleBg}
                        onChange={(e) => {
                          const next = { ...activeBubble, selfBubbleBg: e.target.value }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else
                            setWeChatTheme({
                              bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next },
                            })
                        }}
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                      <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                        对方文字颜色
                      </p>
                      <input
                        type="color"
                        value={safeHex6ForColorInput(wechatTheme.otherBubbleText)}
                        onChange={(e) => setWeChatTheme({ otherBubbleText: e.target.value })}
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    </div>
                    <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                      <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                        自己文字颜色
                      </p>
                      <input
                        type="color"
                        value={safeHex6ForColorInput(wechatTheme.selfBubbleText)}
                        onChange={(e) => setWeChatTheme({ selfBubbleText: e.target.value })}
                        className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                      <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                        显示头像
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Pressable
                          onClick={() => {
                            const next = { ...activeBubble, showAvatar: true }
                            if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                            else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                          }}
                          className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                          style={{
                            borderColor: 'var(--wx-border)',
                            background: activeBubble.showAvatar ? 'rgba(0,0,0,0.06)' : 'transparent',
                            color: 'var(--wx-text)',
                          }}
                        >
                          开
                        </Pressable>
                        <Pressable
                          onClick={() => {
                            const next = { ...activeBubble, showAvatar: false }
                            if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                            else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                          }}
                          className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                          style={{
                            borderColor: 'var(--wx-border)',
                            background: !activeBubble.showAvatar ? 'rgba(0,0,0,0.06)' : 'transparent',
                            color: 'var(--wx-text)',
                          }}
                        >
                          关
                        </Pressable>
                      </div>
                      <p className="mt-2 text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                        头像圆角：{activeBubble.avatarRadiusPx}px
                      </p>
                      <input
                        type="range"
                        min={0}
                        max={18}
                        step={1}
                        value={activeBubble.avatarRadiusPx}
                        onChange={(e) => {
                          const next = { ...activeBubble, avatarRadiusPx: Number(e.target.value) }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="mt-1 w-full"
                      />
                    </div>

                    <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                      <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                        气泡圆角
                      </p>
                      <p className="mt-2 text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                        自己：{activeBubble.selfBubbleRadiusPx}px
                      </p>
                      <input
                        type="range"
                        min={10}
                        max={28}
                        step={1}
                        value={activeBubble.selfBubbleRadiusPx}
                        onChange={(e) => {
                          const next = { ...activeBubble, selfBubbleRadiusPx: Number(e.target.value) }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="mt-1 w-full"
                      />
                      <p className="mt-2 text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                        对方：{activeBubble.otherBubbleRadiusPx}px
                      </p>
                      <input
                        type="range"
                        min={10}
                        max={28}
                        step={1}
                        value={activeBubble.otherBubbleRadiusPx}
                        onChange={(e) => {
                          const next = { ...activeBubble, otherBubbleRadiusPx: Number(e.target.value) }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="mt-1 w-full"
                      />
                    </div>
                  </div>

                  <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                      指向三角
                    </p>
                    <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--wx-text-muted)' }}>
                      开启后在朝头像一侧显示小三角，竖直方向与头像水平中线对齐（需开启「显示头像」）。
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Pressable
                        onClick={() => {
                          const next = { ...activeBubble, showBubbleTail: true }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: activeBubble.showBubbleTail ? 'rgba(0,0,0,0.06)' : 'transparent',
                          color: 'var(--wx-text)',
                        }}
                      >
                        开
                      </Pressable>
                      <Pressable
                        onClick={() => {
                          const next = { ...activeBubble, showBubbleTail: false }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: !activeBubble.showBubbleTail ? 'rgba(0,0,0,0.06)' : 'transparent',
                          color: 'var(--wx-text)',
                        }}
                      >
                        关
                      </Pressable>
                    </div>
                  </div>

                  <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: 'var(--wx-text-muted)' }}>
                      连续消息头像
                    </p>
                    <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--wx-text-muted)' }}>
                      {activeBubbleTailStyle === 'wechat'
                        ? '微信气泡模板固定为每条消息均显示头像。'
                        : '开启后，同一人连续发送的多条消息仅在首条显示头像列；关闭则每条都占位（需「显示头像」为开时在聊天页生效）。'}
                    </p>
                    {activeBubbleTailStyle === 'wechat' ? null : (
                    <div className="mt-2 flex gap-2">
                      <Pressable
                        onClick={() => {
                          const next = { ...activeBubble, mergeConsecutiveAvatarGroup: true }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: activeBubble.mergeConsecutiveAvatarGroup ? 'rgba(0,0,0,0.06)' : 'transparent',
                          color: 'var(--wx-text)',
                        }}
                      >
                        合并（仅首条头像）
                      </Pressable>
                      <Pressable
                        onClick={() => {
                          const next = { ...activeBubble, mergeConsecutiveAvatarGroup: false }
                          if (bubbleScope === 'global') setWeChatTheme({ bubbleGlobal: next })
                          else setWeChatTheme({ bubbleByRole: { ...wechatTheme.bubbleByRole, [bubbleRole]: next } })
                        }}
                        className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: 'var(--wx-border)',
                          background: !activeBubble.mergeConsecutiveAvatarGroup ? 'rgba(0,0,0,0.06)' : 'transparent',
                          color: 'var(--wx-text)',
                        }}
                      >
                        每条都显示
                      </Pressable>
                    </div>
                    )}
                  </div>

                  <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                      时间戳
                    </p>
                    <select
                      className="mt-2 w-full rounded-[14px] border px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                      value={wechatTheme.timestampStyle}
                      onChange={(e) =>
                        setWeChatTheme({
                          timestampStyle: e.target.value as 'hidden' | 'subtle' | 'detailed',
                        })
                      }
                    >
                      <option value="hidden">隐藏</option>
                      <option value="subtle">弱展示</option>
                      <option value="detailed">详细</option>
                    </select>
                    <p className="mt-2 text-[11px]" style={{ color: 'var(--wx-text-muted)' }}>
                      时间戳文字色
                    </p>
                    <input
                      type="color"
                      value={wechatTheme.timestampText}
                      onChange={(e) => setWeChatTheme({ timestampText: e.target.value })}
                      className="mt-1 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--wx-text-muted)' }}>
                    该分区正在接入中。
                  </p>
                </div>
              )}

              {section === 'home' ? (
                <div className="mt-3 rounded-[18px] border p-3" style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}>
                  <p className="text-[12px] font-medium" style={{ color: 'var(--wx-text)' }}>
                    导入 / 导出主题（CSS）
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--wx-text-muted)' }}>
                    导入时会读取 `--wx-*` 变量并更新当前配置；导出会生成同样的变量文件。
                  </p>

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".css,text/css"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      void onImportCss(f)
                      e.currentTarget.value = ''
                    }}
                  />

                  <div className="mt-2 flex gap-2">
                    <Pressable
                      onClick={() => fileRef.current?.click()}
                      className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                      style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                    >
                      导入 CSS
                    </Pressable>
                    <Pressable
                      onClick={() => downloadTextFile('wechat-theme.css', cssExport)}
                      className="flex-1 rounded-[14px] border px-3 py-2 text-[12px]"
                      style={{ borderColor: 'var(--wx-border)', background: 'rgba(0,0,0,0.06)', color: 'var(--wx-text)' }}
                    >
                      导出 CSS
                    </Pressable>
                  </div>
                </div>
              ) : null}

              {tabBarLabelPanel ? (
                <div className="absolute inset-0 z-50 flex items-end justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <div
                    className="w-full max-w-[520px] overflow-hidden rounded-[20px] border"
                    style={{ borderColor: 'var(--wx-border)', background: 'var(--wx-surface)' }}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--wx-text)' }}>
                        {tabBarLabelPanel.scope === 'global' ? '全局字样颜色' : '单按钮字样颜色'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Pressable
                          onClick={() => {
                            if (tabBarLabelPanel.scope === 'global') {
                              const d = DEFAULT_CUSTOMIZATION.wechatTheme
                              setWeChatTheme({
                                tabBarLabelActive: d.tabBarLabelActive,
                                tabBarLabelInactive: d.tabBarLabelInactive,
                              })
                            } else if (tabBarLabelPanel.scope === 'item') {
                              const tabId = tabBarLabelPanel.tabId
                              setWeChatTheme({
                                tabBarItems: wechatTheme.tabBarItems.map((x) =>
                                  x.id === tabId ? { ...x, labelActiveColor: '', labelInactiveColor: '' } : x,
                                ),
                              })
                            }
                          }}
                          className="rounded-[12px] border px-3 py-1.5 text-[12px]"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text-muted)' }}
                        >
                          恢复默认
                        </Pressable>
                        <Pressable
                          onClick={() => setTabBarLabelPanel(null)}
                          className="rounded-[12px] border px-3 py-1.5 text-[12px]"
                          style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text)' }}
                        >
                          关闭
                        </Pressable>
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      {(() => {
                        const isGlobal = tabBarLabelPanel.scope === 'global'
                        const item =
                          !isGlobal && tabBarLabelPanel.scope === 'item'
                            ? wechatTheme.tabBarItems.find((x) => x.id === tabBarLabelPanel.tabId) ?? null
                            : null

                        const activeValue = isGlobal ? wechatTheme.tabBarLabelActive : item?.labelActiveColor || ''
                        const inactiveValue = isGlobal ? wechatTheme.tabBarLabelInactive : item?.labelInactiveColor || ''

                        return (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)' }}>
                                <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                                  选中字色
                                </p>
                                <input
                                  type="color"
                                  value={activeValue || '#000000'}
                                  onChange={(e) => {
                                    if (isGlobal) setWeChatTheme({ tabBarLabelActive: e.target.value })
                                    else if (item) {
                                      setWeChatTheme({
                                        tabBarItems: wechatTheme.tabBarItems.map((x) =>
                                          x.id === item.id ? { ...x, labelActiveColor: e.target.value } : x,
                                        ),
                                      })
                                    }
                                  }}
                                  className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                                />
                                {!isGlobal ? (
                                  <Pressable
                                    onClick={() => {
                                      if (!item) return
                                      setWeChatTheme({
                                        tabBarItems: wechatTheme.tabBarItems.map((x) =>
                                          x.id === item.id ? { ...x, labelActiveColor: '' } : x,
                                        ),
                                      })
                                    }}
                                    className="mt-2 w-full rounded-[12px] border px-3 py-2 text-[12px]"
                                    style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text-muted)' }}
                                  >
                                    清空覆盖
                                  </Pressable>
                                ) : null}
                              </div>

                              <div className="rounded-[16px] border p-3" style={{ borderColor: 'var(--wx-border)' }}>
                                <p className="text-[11px] font-medium" style={{ color: 'var(--wx-text)' }}>
                                  未选中字色
                                </p>
                                <input
                                  type="color"
                                  value={inactiveValue || '#000000'}
                                  onChange={(e) => {
                                    if (isGlobal) setWeChatTheme({ tabBarLabelInactive: e.target.value })
                                    else if (item) {
                                      setWeChatTheme({
                                        tabBarItems: wechatTheme.tabBarItems.map((x) =>
                                          x.id === item.id ? { ...x, labelInactiveColor: e.target.value } : x,
                                        ),
                                      })
                                    }
                                  }}
                                  className="mt-2 h-10 w-full cursor-pointer rounded-[12px] border border-black/10 bg-transparent p-1"
                                />
                                {!isGlobal ? (
                                  <Pressable
                                    onClick={() => {
                                      if (!item) return
                                      setWeChatTheme({
                                        tabBarItems: wechatTheme.tabBarItems.map((x) =>
                                          x.id === item.id ? { ...x, labelInactiveColor: '' } : x,
                                        ),
                                      })
                                    }}
                                    className="mt-2 w-full rounded-[12px] border px-3 py-2 text-[12px]"
                                    style={{ borderColor: 'var(--wx-border)', background: 'transparent', color: 'var(--wx-text-muted)' }}
                                  >
                                    清空覆盖
                                  </Pressable>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              ) : null}

            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                void onPickLocalImage(f)
                e.currentTarget.value = ''
              }}
            />

            <input
              ref={tabIconFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                const tabId = (e.currentTarget.getAttribute('data-tab-id') ?? '') as WeChatTabId
                void onPickTabIconFile(f, tabId)
                e.currentTarget.value = ''
              }}
            />

            <ImageCropperModal
              open={!!tabIconPick}
              imageSrc={tabIconPick?.src ?? ''}
              title="裁剪导航按钮图标（1:1）"
              aspect={1}
              maxSide={256}
              objectFit="contain"
              onCancel={() => setTabIconPick(null)}
              onConfirm={(dataUrl) => {
                if (!tabIconPick) return
                const next = wechatTheme.tabBarItems.map((x) =>
                  x.id === tabIconPick.tabId ? { ...x, iconUrl: dataUrl } : x,
                )
                setWeChatTheme({ tabBarItems: next })
                setTabIconPick(null)
              }}
            />

            <ImageCropperModal
              open={!!tabBarBgPick}
              imageSrc={tabBarBgPick?.src ?? ''}
              title="裁剪导航栏背景（横幅比例）"
              // TabBar 预期是横向长条，按宽:高≈420:76 体验更接近实际
              aspect={420 / 76}
              maxSide={1024}
              objectFit="horizontal-cover"
              onCancel={() => setTabBarBgPick(null)}
              onConfirm={(dataUrl) => {
                setWeChatTheme({
                  tabBarStyle: { ...wechatTheme.tabBarStyle, mode: 'image', imageUrl: dataUrl },
                })
                setTabBarBgPick(null)
              }}
            />
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function WeChatAppInner({ onBack }: Props) {
  const { consoleOpen, closeConsole } = useWeChatConsole()
  const {
    accountSwitchRevision,
    currentAccountId,
    accounts,
    appendPersonaContactsForCurrentAccount,
    updatePhoneProfile,
    updateMomentsCoverUrl,
    profile: wechatAccountProfile,
  } = useWechatStore()
  const { state, wechatThemeStyle, removeWeChatPersonaContactsByCharacterIds } = useCustomization()
  const currentAccountMomentsCoverUrl = useMemo(() => {
    const acc = accounts.find((a) => a.accountId === currentAccountId)
    return acc?.momentsCoverUrl
  }, [accounts, currentAccountId])

  const wechatEditProfile = useMemo(
    () =>
      wechatAccountProfile
        ? wechatProfileToPhoneProfile(wechatAccountProfile)
        : state.profile,
    [wechatAccountProfile, state.profile],
  )
  const disableTransitions = state.ui.disablePageTransitions
  const pageProps = buildPageProps(disableTransitions)
  const apiConfig = useCurrentApiConfig('chatCard')
  const { appPageStyles, wechatTheme } = state
  const pageStyle = appPageStyles.wechat

  const weChatSelfAccountContact = useMemo(() => {
    const nickname =
      wechatAccountProfile?.nickname?.trim() || state.profile.displayName?.trim() || '我'
    const avatarUrl =
      resolveCharacterAvatarUrl({
        avatarUrl: wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl,
      }) || undefined
    return {
      id: WECHAT_SELF_PEER_CHARACTER_ID,
      remarkName: nickname,
      avatarUrl,
      tag: '我',
    }
  }, [
    state.profile.avatarImageUrl,
    state.profile.displayName,
    wechatAccountProfile?.avatarUrl,
    wechatAccountProfile?.nickname,
  ])

  const weChatMergedContacts = useMemo((): ComponentProps<typeof WeChatContactsInstagram>['contacts'] => {
    const persona = state.wechatPersonaContacts.map((c) => ({
      id: c.id,
      remarkName: c.remarkName,
      avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || undefined,
      isStarred: c.isStarred,
    }))
    return [weChatSelfAccountContact, ...persona, ...WECHAT_DEFAULT_CONTACTS]
  }, [state.wechatPersonaContacts, weChatSelfAccountContact])

  // 记忆管理需要用 characterId 作为主键，否则会出现“聊天可读到记忆，但记忆页显示 0 条”
  const memoryManageContacts = useMemo((): ComponentProps<typeof WeChatContactsInstagram>['contacts'] => {
    const persona = state.wechatPersonaContacts.map((c) => ({
      id: c.characterId,
      remarkName: c.remarkName,
      avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || undefined,
      isStarred: c.isStarred,
    }))
    return [WECHAT_LUMI_ASSISTANT_CONTACT, ...persona]
  }, [state.wechatPersonaContacts])

  const [route, setRoute] = useState<WxRoute>({ name: 'tabs', tab: 'messages' })
  const [pendingNewFriendRequests, setPendingNewFriendRequests] = useState<FriendRequest[]>([])
  const [pendingOpenFriendRequestId, setPendingOpenFriendRequestId] = useState<string | null>(null)
  const [themeOpen, setThemeOpen] = useState(false)
  const [themePanelBoot, setThemePanelBoot] = useState<ThemePanelBoot>({})
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false)
  const [chatTimeSettingsOpen, setChatTimeSettingsOpen] = useState(false)
  const [chatCheckPhoneOpen, setChatCheckPhoneOpen] = useState(false)
  const [chatMiniGameOverlayOpen, setChatMiniGameOverlayOpen] = useState(false)
  const [chatVoiceCallOverlayOpen, setChatVoiceCallOverlayOpen] = useState(false)
  const [psycheRadarOpen, setPsycheRadarOpen] = useState(false)
  const [messagesPlusMenuOpen, setMessagesPlusMenuOpen] = useState(false)
  const [newGroupFromMessagesOpen, setNewGroupFromMessagesOpen] = useState(false)
  const [activeGroupRow, setActiveGroupRow] = useState<GroupChatRow | null>(null)
  const [wxGlobalNav, setWxGlobalNav] = useState<WxGlobalNavState>(null)
  const [showAppearanceGuide, setShowAppearanceGuide] = useState(false)
  const dismissAppearanceGuide = useCallback(() => {
    setShowAppearanceGuide(false)
    try {
      window.localStorage.setItem(WECHAT_APPEARANCE_GUIDE_SEEN_KEY, '1')
    } catch {
      // ignore storage failures
    }
  }, [])
  const openWeChatAppearance = useCallback(() => {
    if (showAppearanceGuide) dismissAppearanceGuide()
    setThemePanelBoot({})
    setThemeOpen(true)
  }, [dismissAppearanceGuide, showAppearanceGuide])
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [memoryTraceOpen, setMemoryTraceOpen] = useState(false)
  const memoryTraceSnapshot = useSyncExternalStore(subscribeLastMemoryTrace, getLastMemoryTrace, getLastMemoryTrace)
  useEffect(() => {
    void hydrateMemoryTraceFromIndexedDb()
  }, [])
  useEffect(() => {
    if (route.name !== 'chat') {
      setPsycheRadarOpen(false)
    }
  }, [route.name])

  const [hideDatingChrome, setHideDatingChrome] = useState(false)
  const [discoverMomentsOpen, setDiscoverMomentsOpen] = useState(false)
  const [discoverRestoreView, setDiscoverRestoreView] = useState<'moments' | null>(null)

  useEffect(() => {
    const onNavigateListen = () => setRoute({ name: 'tabs', tab: 'discover' })
    window.addEventListener(LISTEN_TOGETHER_NAVIGATE_EVENT, onNavigateListen)
    return () => window.removeEventListener(LISTEN_TOGETHER_NAVIGATE_EVENT, onNavigateListen)
  }, [])
  useEffect(() => {
    const onNavigateWeibo = () => setRoute({ name: 'tabs', tab: 'discover' })
    window.addEventListener(LUMI_PULSE_NAVIGATE_EVENT, onNavigateWeibo)
    return () => window.removeEventListener(LUMI_PULSE_NAVIGATE_EVENT, onNavigateWeibo)
  }, [])
  useEffect(() => {
    const onReturnToChat = (e: Event) => {
      const detail = (e as CustomEvent<PulseReturnToChat>).detail
      if (!detail?.kind) return
      if (detail.kind === 'persona') {
        const id = detail.characterId?.trim()
        if (!id) return
        setRoute({ name: 'chat', chat: { kind: 'persona', characterId: id } })
        return
      }
      if (detail.kind === 'group') {
        const id = detail.groupId?.trim()
        if (!id) return
        setRoute({ name: 'chat', chat: { kind: 'group', groupId: id } })
        return
      }
      setRoute({ name: 'chat', chat: { kind: detail.kind } })
    }
    window.addEventListener(LUMI_PULSE_RETURN_TO_CHAT_EVENT, onReturnToChat as EventListener)
    return () =>
      window.removeEventListener(LUMI_PULSE_RETURN_TO_CHAT_EVENT, onReturnToChat as EventListener)
  }, [])

  const openPersonaChatByCharacterId = useCallback((characterId: string) => {
    const target = resolveWeChatPrivateChatTarget(characterId)
    if (!target) return
    const chat: WxActiveChat =
      target.kind === 'lumi'
        ? { kind: 'lumi' }
        : target.kind === 'self'
          ? { kind: 'self' }
          : { kind: 'persona', characterId: target.characterId }
    setRoute({ name: 'chat', chat })
  }, [])

  const openGroupChatByGroupId = useCallback((groupId: string) => {
    const id = groupId.trim()
    if (!id) return
    setRoute({ name: 'chat', chat: { kind: 'group', groupId: id } })
  }, [])

  useEffect(() => {
    const pending = consumeWeChatFocusPersonaChatId()
    if (pending) openPersonaChatByCharacterId(pending)
    const pendingGroup = consumeWeChatFocusGroupChatId()
    if (pendingGroup) openGroupChatByGroupId(pendingGroup)
  }, [openGroupChatByGroupId, openPersonaChatByCharacterId])

  useEffect(() => {
    const onFocusChat = (e: Event) => {
      const ce = e as CustomEvent<WeChatFocusPersonaChatDetail>
      const id = ce.detail?.characterId?.trim() || consumeWeChatFocusPersonaChatId()
      if (id) openPersonaChatByCharacterId(id)
    }
    window.addEventListener(WECHAT_FOCUS_PERSONA_CHAT_EVENT, onFocusChat as EventListener)
    return () => window.removeEventListener(WECHAT_FOCUS_PERSONA_CHAT_EVENT, onFocusChat as EventListener)
  }, [openPersonaChatByCharacterId])

  useEffect(() => {
    const onFocusGroup = (e: Event) => {
      const ce = e as CustomEvent<WeChatFocusGroupChatDetail>
      const id = ce.detail?.groupId?.trim() || consumeWeChatFocusGroupChatId()
      if (id) openGroupChatByGroupId(id)
    }
    window.addEventListener(WECHAT_FOCUS_GROUP_CHAT_EVENT, onFocusGroup as EventListener)
    return () => window.removeEventListener(WECHAT_FOCUS_GROUP_CHAT_EVENT, onFocusGroup as EventListener)
  }, [openGroupChatByGroupId])

  const [chatOtherTyping, setChatOtherTyping] = useState(false)
  const [chatOpponentRevealPending, setChatOpponentRevealPending] = useState(false)
  const [chatPendingQueueCount, setChatPendingQueueCount] = useState(0)
  const setChatOtherTypingDeduped = useCallback((v: boolean) => {
    setChatOtherTyping((prev) => (prev === v ? prev : v))
  }, [])
  const setChatPendingQueueCountDeduped = useCallback((n: number) => {
    setChatPendingQueueCount((prev) => (prev === n ? prev : n))
  }, [])
  const setChatOpponentRevealPendingDeduped = useCallback((v: boolean) => {
    setChatOpponentRevealPending((prev) => (prev === v ? prev : v))
  }, [])
  const [orphanPeerNames, setOrphanPeerNames] = useState<Record<string, string>>({})
  const newFriendsUnreadCount = useMemo(
    () => countNewFriendsBadge(pendingNewFriendRequests),
    [pendingNewFriendRequests],
  )

  const personaContactsForGroupPick = useMemo(
    () =>
      state.wechatPersonaContacts.map((c) => ({
        characterId: c.characterId,
        remarkName: c.remarkName,
        avatarUrl: c.avatarUrl,
      })),
    [state.wechatPersonaContacts],
  )

  const anonymousQnaContacts = useMemo((): MockContact[] => {
    const selfAvatar =
      resolveCharacterAvatarUrl({
        avatarUrl: wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl,
      }) || undefined
    const self: MockContact = {
      id: 'self',
      remarkName: state.profile.displayName?.trim() || '我',
      avatarUrl: selfAvatar,
    }
    const friends: MockContact[] = state.wechatPersonaContacts.map((c) => ({
      id: c.id,
      characterId: c.characterId,
      remarkName: c.remarkName,
      avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || undefined,
    }))
    return [self, ...friends]
  }, [state.profile.avatarImageUrl, state.profile.displayName, state.wechatPersonaContacts, wechatAccountProfile?.avatarUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const seen = window.localStorage.getItem(WECHAT_APPEARANCE_GUIDE_SEEN_KEY) === '1'
      if (!seen) setShowAppearanceGuide(true)
    } catch {
      setShowAppearanceGuide(true)
    }
  }, [])

  /**
   * 底层 ChatRoom 绑定的会话：除当前 `chat`/红包转账等外，在「消息列表 tabs」上仍保留最后一次会话，
   * 避免返回列表时卸载导致逐条露出 / 正在输入状态丢失。
   */
  const wxDockChatRef = useRef<WxActiveChat | null>(null)
  const routeWxChatCtx = wxRouteChatLayerContext(route)
  if (routeWxChatCtx) wxDockChatRef.current = routeWxChatCtx
  else if (route.name === 'forward-select-chat') wxDockChatRef.current = route.fromChat

  const wxDockRouteGroup =
    route.name === 'tabs' ||
    route.name === 'chat' ||
    route.name === 'forward-select-chat' ||
    routeWxChatCtx != null

  useLayoutEffect(() => {
    if (!wxDockRouteGroup) wxDockChatRef.current = null
  }, [wxDockRouteGroup])

  const wxDockChat: WxActiveChat | null =
    routeWxChatCtx ??
    (route.name === 'forward-select-chat' ? route.fromChat : null) ??
    (route.name === 'tabs' ? wxDockChatRef.current : null)

  const chatPeerContact = useMemo(() => {
    const chat = wxDockChat
    if (!chat) return null
    if (chat.kind === 'lumi') {
      return weChatMergedContacts?.find((c) => c.id === 'wechat-lumi-assistant') ?? WECHAT_LUMI_ASSISTANT_CONTACT
    }
    if (chat.kind === 'self') {
      return weChatSelfAccountContact
    }
    if (chat.kind === 'group') {
      const g = activeGroupRow
      const count = g?.members.length ?? 0
      const base = g ? g.remark.trim() || g.name : '群聊'
      return {
        id: `group-${chat.groupId}`,
        remarkName: g ? `${base}（${count}）` : '群聊',
        avatarUrl: g?.avatar?.trim() || undefined,
        tag: undefined,
      }
    }
    const row = state.wechatPersonaContacts.find((c) => c.characterId === chat.characterId)
    if (!row) {
      const fallback = orphanPeerNames[chat.characterId]?.trim()
      return {
        id: `persona-${chat.characterId}`,
        remarkName: fallback || '聊天',
        avatarUrl: undefined as string | undefined,
      }
    }
    return { id: row.id, remarkName: row.remarkName, avatarUrl: row.avatarUrl }
  }, [wxDockChat, activeGroupRow, orphanPeerNames, weChatMergedContacts, weChatSelfAccountContact, state.wechatPersonaContacts])

  useEffect(() => {
    const chat = wxDockChat
    if (!chat || chat.kind !== 'persona') return
    const cid = chat.characterId.trim()
    if (!cid) return
    if (state.wechatPersonaContacts.some((c) => c.characterId === cid)) return
    if (orphanPeerNames[cid]) return
    let cancelled = false
    void personaDb.getCharacter(cid).then((ch) => {
      if (cancelled || !ch) return
      const name = ch.wechatNickname?.trim() || ch.name?.trim() || '聊天'
      setOrphanPeerNames((prev) => (prev[cid] ? prev : { ...prev, [cid]: name }))
    })
    return () => {
      cancelled = true
    }
  }, [orphanPeerNames, state.wechatPersonaContacts, wxDockChat])

  const chatHeaderShowPsycheRadar =
    route.name === 'chat' && wxDockChat?.kind !== 'group' && wxDockChat?.kind !== 'self'

  useEffect(() => {
    const layer = wxDockChat
    if (!layer || layer.kind !== 'group') {
      setActiveGroupRow(null)
      return
    }
    let cancelled = false
    void personaDb.getGroupChat(layer.groupId).then((g) => {
      if (!cancelled) setActiveGroupRow(g)
    })
    return () => {
      cancelled = true
    }
  }, [wxDockChat])

  /** 转账页对方信息 */
  const lumiTransferPeer = useMemo(() => {
    if (route.name !== 'lumi-transfer') return null
    const chat = route.chat
    if (chat.kind === 'lumi') {
      return weChatMergedContacts?.find((c) => c.id === 'wechat-lumi-assistant') ?? WECHAT_LUMI_ASSISTANT_CONTACT
    }
    const cid = wxWalletPeerCharacterId(chat)
    const row = state.wechatPersonaContacts.find((c) => c.characterId === cid)
    if (!row) {
      return {
        id: `persona-${cid}`,
        remarkName: '聊天',
        avatarUrl: undefined as string | undefined,
      }
    }
    return { id: row.id, remarkName: row.remarkName, avatarUrl: row.avatarUrl }
  }, [route, weChatMergedContacts, state.wechatPersonaContacts])

  /** 发红包页顶部展示的对方信息（与 chatPeerContact 同源逻辑，但路由在 red-packet-send 时也可用） */
  const redPacketPeer = useMemo(() => {
    if (route.name !== 'red-packet-send') return null
    const chat = route.chat
    if (chat.kind === 'lumi') {
      return weChatMergedContacts?.find((c) => c.id === 'wechat-lumi-assistant') ?? WECHAT_LUMI_ASSISTANT_CONTACT
    }
    const cid = wxWalletPeerCharacterId(chat)
    const row = state.wechatPersonaContacts.find((c) => c.characterId === cid)
    if (!row) {
      return {
        id: `persona-${cid}`,
        remarkName: '聊天',
        avatarUrl: undefined as string | undefined,
      }
    }
    return { id: row.id, remarkName: row.remarkName, avatarUrl: row.avatarUrl }
  }, [route, weChatMergedContacts, state.wechatPersonaContacts])

  /** Lumi 小助手会话绑定的人设（世界书）；优先备注名为 Lumi 的同步联系人，否则在仅有一条人设同步时使用该条 */
  const lumiBindingPersonaCharacterId = useMemo(() => {
    const list = state.wechatPersonaContacts
    const byRemark = list.find((c) => c.remarkName.trim() === 'Lumi')
    if (byRemark) return byRemark.characterId
    if (list.length === 1) return list[0].characterId
    return null
  }, [state.wechatPersonaContacts])

  /** 当前聊天页用于 IndexedDB 的会话 id：Lumi 固定为助手 id，与绑定人设无关，避免与角色私聊串线 */
  const activeConversationCharacterId = useMemo(() => {
    const layer = wxDockChat
    if (!layer) return null
    if (layer.kind === 'lumi') return WECHAT_LUMI_PEER_CHARACTER_ID
    if (layer.kind === 'self') return WECHAT_SELF_PEER_CHARACTER_ID
    if (layer.kind === 'group') return wechatGroupPeerCharacterId(layer.groupId)
    return layer.characterId
  }, [wxDockChat])

  const chatActiveBubble = useMemo(() => {
    const key = activeConversationCharacterId?.trim() ?? ''
    return key ? bubbleForRole(state.wechatTheme, key) : state.wechatTheme.bubbleGlobal
  }, [activeConversationCharacterId, state.wechatTheme])

  const chatMessengerHeaderVariant =
    route.name === 'chat' && chatActiveBubble.bubbleTailStyle
      ? chatActiveBubble.bubbleTailStyle === 'imessage'
        ? 'imessage'
        : chatActiveBubble.bubbleTailStyle === 'telegram'
          ? 'telegram'
          : chatActiveBubble.bubbleTailStyle === 'talkmaker'
            ? 'talkmaker'
            : 'wechat'
      : null

  const chatMessengerFontFamily = resolveChatDisplayFontFamily(chatActiveBubble) ?? undefined

  const activeChatForRoute = useMemo<WxActiveChat | null>(() => wxDockChat, [wxDockChat])

  const chatRoomPersonaCharacterId = useMemo(() => {
    const layer = wxDockChat
    if (!layer) return null
    if (layer.kind === 'group' || layer.kind === 'self') return null
    if (layer.kind === 'persona') return layer.characterId
    return lumiBindingPersonaCharacterId
  }, [wxDockChat, lumiBindingPersonaCharacterId])

  /**
   * null = 尚未从 IndexedDB 读到当前身份 id。
   * 若先用 '__none__' 拼 conversationKey，会与真实身份下的消息 key 不一致，未读会被误算成 0。
   */
  const [playerIdentityId, setPlayerIdentityId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const activeAcc = currentAccountId
      ? accounts.find((a) => a.accountId === currentAccountId)
      : null
    const fromBundle = activeAcc ? resolveAccountSessionIdentityId(activeAcc).trim() : ''
    void (async () => {
      const fromDb = (await personaDb.getCurrentIdentityId()).trim()
      const id = fromBundle || fromDb || '__none__'
      if (cancelled) return
      setPlayerIdentityId(id)
      if (fromBundle && fromBundle !== fromDb) {
        await personaDb.setCurrentIdentityId(fromBundle)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [route.name, accountSwitchRevision, currentAccountId, accounts])

  const anonymousQnaWechatCtx = useMemo((): AnonymousQaWechatContext | null => {
    if (playerIdentityId === null) return null
    return {
      wechatAccountId: currentAccountId,
      playerIdentityId,
      playerDisplayName: state.profile.displayName?.trim() || '我',
      apiConfig,
    }
  }, [apiConfig, currentAccountId, playerIdentityId, state.profile.displayName])

  const momentContactsForNotices = useMemo(
    () => mockContactsToMomentRefs(anonymousQnaContacts),
    [anonymousQnaContacts],
  )
  const momentsInteractionUnreadCount = useMomentsInteractionUnreadCount()
  const momentsDisplayName =
    wechatAccountProfile?.nickname?.trim() || state.profile.displayName?.trim() || '我'

  const openContactProfileFromMomentsFeed = useCallback((payload: MomentParticipantProfilePayload) => {
    setDiscoverRestoreView('moments')
    setRoute({
      name: 'contact-profile',
      target: wxContactProfileTarget(payload),
      remarkName: payload.remarkName,
      avatarUrl: payload.avatarUrl,
      returnTo: { mode: 'moments-feed' },
    })
  }, [])

  const openContactProfileFromUserMomentsArchive = useCallback(
    (payload: MomentParticipantProfilePayload) => {
      if (route.name !== 'user-moments-archive') return
      setRoute({
        name: 'contact-profile',
        target: wxContactProfileTarget(payload),
        remarkName: payload.remarkName,
        avatarUrl: payload.avatarUrl,
        returnTo: {
          mode: 'user-moments-archive',
          userId: route.userId,
          coverNickname:
            route.returnTo.mode === 'contact-profile' ? route.returnTo.remarkName : undefined,
          returnTo: route.returnTo,
        },
      })
    },
    [route],
  )

  /** 把仍落在「未选身份」(__none__) 下的会话迁到当前身份；随后修复曾误入私聊键的群消息，避免与群会话双份并存。 */
  useEffect(() => {
    if (playerIdentityId === null) return
    const pid = playerIdentityId.trim()
    if (!pid || pid === '__none__') return
    void (async () => {
      await personaDb.migrateWeChatDataFromNonePlayerIdentity(pid)
      await personaDb.repairMisfiledWeChatMessagesAfterThreadMixup(pid)
    })()
  }, [playerIdentityId])

  useEffect(() => {
    if (!(route.name === 'tabs' && route.tab === 'messages')) setMessagesPlusMenuOpen(false)
  }, [route])

  const { isConversationMuted } = useMuteStatus(playerIdentityId)

  /**
   * 聊天页实际使用的身份：与本马甲该角色已有私聊记录 / 好友申请档一致，
   * 不再无条件使用档案主绑定（避免小号串大号身份）。
   */
  const [chatRouteIdentityId, setChatRouteIdentityId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const chat = wxDockChat
      if (!chat) {
        if (!cancelled) setChatRouteIdentityId(null)
        return
      }
      if (playerIdentityId === null) {
        if (!cancelled) setChatRouteIdentityId(null)
        return
      }
      if (chat.kind !== 'persona') {
        if (!cancelled) setChatRouteIdentityId(playerIdentityId)
        return
      }
      const sid = await resolveActivePrivateChatSessionPlayerIdentityId({
        characterId: chat.characterId,
        wechatAccountId: currentAccountId,
        appPlayerIdentityId: playerIdentityId,
      })
      if (!cancelled) setChatRouteIdentityId(sid)
    })()
    return () => {
      cancelled = true
    }
  }, [wxDockChat, playerIdentityId, currentAccountId])

  /** 群↔私 dock 切换：写锚点 KV + 同步 staging（layout 阶段，早于子组件首轮读） */
  const prevWxDockChatForAnchorRef = useRef<WxActiveChat | null>(null)
  useLayoutEffect(() => {
    const prev = prevWxDockChatForAnchorRef.current
    prevWxDockChatForAnchorRef.current = wxDockChat

    if (playerIdentityId === null) return
    const appPid = playerIdentityId.trim()
    if (!appPid || appPid === '__none__') return

    if (wxDockChat?.kind === 'persona' && prev?.kind === 'group') {
      const gid = prev.groupId.trim()
      const cid = wxDockChat.characterId.trim()
      if (gid && cid && cid !== WECHAT_LUMI_PEER_CHARACTER_ID) {
        setPrivateChatGroupAnchorFromDockTransition(cid, gid)
        void (async () => {
          const ch = await personaDb.getCharacter(cid)
          const sessionPid = resolvePrivateChatSessionPlayerIdentityId(ch, playerIdentityId)
          await personaDb.setPrivateChatAnchorGroupId(cid, sessionPid, gid)
        })()
      }
    }

    if (wxDockChat?.kind === 'group' && prev?.kind === 'persona') {
      const gid = wxDockChat.groupId.trim()
      const cid = prev.characterId.trim()
      if (gid && cid && cid !== WECHAT_LUMI_PEER_CHARACTER_ID) {
        setGroupChatPrivatePeerAnchorFromDockTransition(gid, cid)
        void (async () => {
          const g = await personaDb.getGroupChat(gid)
          if (!g || !(g.members ?? []).some((m) => m.charId.trim() === cid)) {
            clearGroupChatPrivatePeerAnchorDockStagingIfMatches(gid, cid)
            return
          }
          await personaDb.setGroupChatAnchorPrivatePeerCharacterId(gid, appPid, cid)
        })()
      }
    }
  }, [wxDockChat, playerIdentityId])

  const refreshPendingNewFriendRequests = useCallback(async () => {
    if (playerIdentityId === null) return
    const pid = playerIdentityId.trim()
    if (!pid) return

    const allRows = await listFriendRequestsForWechatAccount(currentAccountId, { pendingOnly: false })
    const rows = allRows.filter((r) => {
      const outbound = isUserInitiatedFriendRequestSource(r.source)
      if (outbound) return true
      return r.status === 'pending'
    })
    const ui = await Promise.all(
      rows.map(async (r) => {
        const requestPid = r.playerIdentityId.trim() || pid
        const ch = await personaDb.getCharacter(r.characterId)
        const outboundRow = isUserInitiatedFriendRequestSource(r.source)
        const nickname =
          (outboundRow && r.contactRemarkAlias?.trim()) ||
          ch?.remark?.trim() ||
          ch?.wechatNickname?.trim() ||
          ch?.name ||
          lumiFallbackNickname(r.characterId)
        const avatar =
          resolveCharacterAvatarUrl({ avatarUrl: ch?.avatarUrl }) ||
          (r.characterId === WECHAT_LUMI_PEER_CHARACTER_ID ? lumiWechatAvatarUrl : '')
        const convKey = await resolveAccountScopedPrivateConversationKey({
          wechatAccountId: currentAccountId,
          characterId: r.characterId,
          appSessionPlayerIdentityId: requestPid,
        })
        const unreadCount = await personaDb.countUnreadWeChatCharacterMessages(convKey)
        const msgs = await personaDb.listWeChatChatMessagesRecent({ conversationKey: convKey, limit: 200 })
        const verificationEpochMs = r.verificationEpochMs ?? r.createdAt
        const messages: FriendRequest['messages'] = msgs
          .filter((m) => m.timestamp >= verificationEpochMs)
          .filter((m) => !m.images?.length && !m.redPacket && !m.transfer && !m.callStatus && !m.replyTo)
          .map((m) => ({
            id: m.id,
            sender: (m.type === 'character' ? 'character' : 'user') as 'character' | 'user',
            content: sanitizeFriendRequestPlainText(m.content),
            timestamp: formatFriendRequestTime(m.timestamp),
            timestampMs: m.timestamp,
          }))
          .filter((m) => m.content.length > 0)
        return mapFriendRequestRowToUi({
          row: r,
          nickname,
          avatar,
          messages,
          unread: unreadCount > 0,
        })
      }),
    )
    setPendingNewFriendRequests(ui)
  }, [currentAccountId, playerIdentityId, state.profile.displayName, state.wechatPersonaContacts])

  useEffect(() => {
    void refreshPendingNewFriendRequests()
  }, [refreshPendingNewFriendRequests])

  useEffect(() => {
    const onStorage = () => void refreshPendingNewFriendRequests()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [refreshPendingNewFriendRequests])

  const [messageThreads, setMessageThreads] = useState<MessagesThreadRow[]>([])
  /** 置顶区折叠：离开消息 Tab 再进入时恢复默认折叠（与微信一致） */
  const [messagesPinnedExpanded, setMessagesPinnedExpanded] = useState(false)

  const refreshMessageThreadsMeta = useCallback(async () => {
    if (playerIdentityId === null) return
    const pid = playerIdentityId
    const acc = currentAccountId?.trim() ?? ''

    // 按 conversationKey 建索引（勿仅按 playerIdentityId）：私聊会话身份可能与当前马甲不同，
    // 否则左滑「不显示/置顶」写入后刷新读不到设置，卡片会立刻弹回来。
    const convSettings = await personaDb.listAllChatConversationSettings()
    const settingsByKey = new Map(convSettings.map((s) => [s.conversationKey, s]))
    const hiddenPeerIds = new Set(
      convSettings
        .filter((s) => s.hiddenFromMessageList)
        .map((s) => s.peerCharacterId.trim())
        .filter(Boolean),
    )

    const buildOne = async (
      conversationKey: string,
      kind: 'lumi' | 'self' | 'persona',
      name: string,
      avatarUrl: string | undefined,
      characterIdForKey: string,
      peerCharacterId: string,
    ): Promise<(MessagesThreadRow & { sortTs: number }) | null> => {
      // 「不显示」的会话：直接跳过，别再扫未读/最新消息
      if (
        hiddenPeerIds.has(peerCharacterId) ||
        (settingsByKey.get(conversationKey)?.hiddenFromMessageList ?? false)
      ) {
        return null
      }
      const st = settingsByKey.get(conversationKey) ?? null
      const isPinned = st?.isPinned ?? false
      const [unread, last] = await Promise.all([
        personaDb.countUnreadWeChatCharacterMessages(conversationKey),
        personaDb.peekLatestWeChatChatMessage(conversationKey),
      ])
      let preview =
        kind === 'lumi'
          ? '点击开始与 Lumi 聊天'
          : kind === 'self'
            ? '发消息给自己，当作备忘录'
            : `点击开始与 ${name || '角色'} 聊天`
      let time = '—'
      const msgTs = last ? last.timestamp : 0
      const sortTs = Math.max(msgTs, st?.lastMessageTime ?? 0)
      if (last) {
        const pv = formatWeChatMessagesTabPreviewFromStoredMessage(last)
        preview = pv.slice(0, 48) + (pv.length > 48 ? '…' : '')
        const d = new Date(last.timestamp)
        time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      if (kind === 'lumi') {
        return {
          key: 'lumi',
          kind: 'lumi',
          conversationKey,
          peerCharacterId: WECHAT_LUMI_PEER_CHARACTER_ID,
          isPinned,
          name: 'Lumi',
          time,
          preview,
          avatarUrl: lumiWechatAvatarUrl,
          unread,
          sortTs,
        }
      }
      if (kind === 'self') {
        const selfAvatar =
          resolveCharacterAvatarUrl({
            avatarUrl: wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl,
          }) || ''
        return {
          key: 'self',
          kind: 'self',
          conversationKey,
          peerCharacterId: WECHAT_SELF_PEER_CHARACTER_ID,
          isPinned,
          name: name || '我',
          time,
          preview,
          avatarUrl: selfAvatar,
          unread,
          sortTs,
        }
      }
      return {
        key: `persona-${characterIdForKey}`,
        kind: 'persona',
        conversationKey,
        peerCharacterId: characterIdForKey,
        characterId: characterIdForKey,
        isPinned,
        name,
        time,
        preview,
        avatarUrl,
        unread,
        sortTs,
      }
    }

    // 列表刷新只算键，不做 ensure* 迁移（迁移会 listDistinct getAll + rekey，角色一多就卡死）
    const lumiKey = resolvePrivateWeChatStorageConversationKey(
      WECHAT_LUMI_PEER_CHARACTER_ID,
      acc || null,
      pid,
    )
    const selfDisplayName =
      wechatAccountProfile?.nickname?.trim() || state.profile.displayName?.trim() || '我'
    const selfKey = resolvePrivateWeChatStorageConversationKey(
      WECHAT_SELF_PEER_CHARACTER_ID,
      acc || null,
      pid,
    )

    const [lumiRowData, selfRowData] = await Promise.all([
      buildOne(lumiKey, 'lumi', 'Lumi', lumiWechatAvatarUrl, WECHAT_LUMI_PEER_CHARACTER_ID, WECHAT_LUMI_PEER_CHARACTER_ID),
      buildOne(
        selfKey,
        'self',
        selfDisplayName,
        wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl,
        WECHAT_SELF_PEER_CHARACTER_ID,
        WECHAT_SELF_PEER_CHARACTER_ID,
      ),
    ])

    const contacts = state.wechatPersonaContacts
    const personaRowsData: Array<MessagesThreadRow & { sortTs: number }> = []
    // 分批，避免 Promise.all 一次性 stampede
    const BATCH = 6
    for (let i = 0; i < contacts.length; i += BATCH) {
      const slice = contacts.slice(i, i + BATCH)
      const batch = await Promise.all(
        slice.map(async (c) => {
          if (hiddenPeerIds.has(c.characterId)) return null
          const ch = await personaDb.getCharacter(c.characterId)
          // 列表用同步绑定身份即可，不必对每个关联身份再探 latest（那是进聊天室才该做的）
          const sessionSid = resolvePrivateChatSessionPlayerIdentityId(ch, pid)
          const convKey = resolvePrivateWeChatStorageConversationKey(c.characterId, acc || null, sessionSid)
          if (settingsByKey.get(convKey)?.hiddenFromMessageList) return null
          const avatarResolved =
            resolveWeChatContactAvatarUrl(c.avatarUrl, ch?.avatarUrl?.trim()) || undefined
          return buildOne(convKey, 'persona', c.remarkName, avatarResolved, c.characterId, c.characterId)
        }),
      )
      for (const row of batch) {
        if (row) personaRowsData.push(row)
      }
    }

    const groups = await personaDb.listGroupChatsForPlayerIdentity(pid)
    const groupRowsData: Array<MessagesThreadRow & { sortTs: number }> = []
    for (let i = 0; i < groups.length; i += BATCH) {
      const slice = groups.slice(i, i + BATCH)
      const batch = await Promise.all(
        slice.map(async (g) => {
          const peerCharacterId = wechatGroupPeerCharacterId(g.id)
          if (hiddenPeerIds.has(peerCharacterId)) return null
          const conversationKey = resolveGroupWeChatStorageConversationKey(g.id, acc || null, pid)
          if (settingsByKey.get(conversationKey)?.hiddenFromMessageList) return null
          const st = settingsByKey.get(conversationKey) ?? null
          const isPinned = st?.isPinned ?? false
          const [unread, last] = await Promise.all([
            personaDb.countUnreadWeChatCharacterMessages(conversationKey),
            personaDb.peekLatestWeChatChatMessage(conversationKey),
          ])
          let preview = '点击开始群聊'
          let time = '—'
          const msgTs = last ? last.timestamp : 0
          const sortTs = Math.max(msgTs, st?.lastMessageTime ?? 0)
          if (last) {
            const pv = formatWeChatMessagesTabPreviewFromStoredMessage(last)
            preview = pv.slice(0, 48) + (pv.length > 48 ? '…' : '')
            const d = new Date(last.timestamp)
            time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          }
          const listTitle = g.remark.trim() || g.name
          const avatarUrl = g.avatar.trim() || undefined
          return {
            key: `group-${g.id}`,
            kind: 'group' as const,
            groupId: g.id,
            conversationKey,
            peerCharacterId,
            isPinned,
            name: listTitle,
            time,
            preview,
            avatarUrl,
            unread,
            sortTs,
          }
        }),
      )
      for (const row of batch) {
        if (row) groupRowsData.push(row)
      }
    }

    const pack: Array<MessagesThreadRow & { sortTs: number }> = [
      ...(lumiRowData ? [lumiRowData] : []),
      ...(selfRowData ? [selfRowData] : []),
      ...personaRowsData,
      ...groupRowsData,
    ]
    const pinned = pack.filter((r) => r.isPinned).sort((a, b) => b.sortTs - a.sortTs)
    const normal = pack.filter((r) => !r.isPinned).sort((a, b) => b.sortTs - a.sortTs)
    const merged = [...pinned, ...normal].map((row) => {
      const { sortTs: _s, ...rest } = row
      return rest
    })
    setMessageThreads(merged)
  }, [
    currentAccountId,
    playerIdentityId,
    state.profile.avatarImageUrl,
    state.profile.displayName,
    state.wechatPersonaContacts,
    wechatAccountProfile?.avatarUrl,
    wechatAccountProfile?.nickname,
  ])

  useEffect(() => {
    void refreshMessageThreadsMeta()
  }, [refreshMessageThreadsMeta])

  const messagesListTabActive = route.name === 'tabs' && route.tab === 'messages'
  useEffect(() => {
    if (messagesListTabActive) setMessagesPinnedExpanded(false)
  }, [messagesListTabActive])

  /** 角色多时 storage 事件会连打；合并刷新，避免会话列表卡死 */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const onStorage = () => {
      if (timer != null) clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void refreshMessageThreadsMeta()
      }, 160)
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      window.removeEventListener('wechat-storage-changed', onStorage)
      if (timer != null) clearTimeout(timer)
    }
  }, [refreshMessageThreadsMeta])

  const hideMessageThreadFromList = useCallback((conversationKey: string) => {
    const k = conversationKey.trim()
    if (!k) return
    setMessageThreads((prev) => prev.filter((t) => t.conversationKey !== k))
  }, [])

  const [activeConversationKey, setActiveConversationKey] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const layer = wxDockChat
    const acc = currentAccountId?.trim()
    const pid = playerIdentityId?.trim()
    if (!layer || !pid || !activeConversationCharacterId) {
      if (!cancelled) setActiveConversationKey(null)
      return
    }
    if (layer.kind === 'persona' && chatRouteIdentityId === null) {
      return
    }
    // 只算键，不做 ensure* 迁移（进聊天与列表一致，避免整库扫卡白屏）
    const sessionPid =
      layer.kind === 'persona' && chatRouteIdentityId?.trim()
        ? chatRouteIdentityId.trim()
        : pid
    if (layer.kind === 'group') {
      const key = resolveGroupWeChatStorageConversationKey(layer.groupId, acc || null, sessionPid)
      setActiveConversationKey(key)
    } else {
      const key = resolvePrivateWeChatStorageConversationKey(
        activeConversationCharacterId,
        acc || null,
        sessionPid,
      )
      setActiveConversationKey(key)
    }
    return () => {
      cancelled = true
    }
  }, [wxDockChat, currentAccountId, playerIdentityId, chatRouteIdentityId, activeConversationCharacterId])

  /** 切换聊天对象时从会话级 pipeline 恢复顶栏输入态（各会话独立，互不抢占） */
  useEffect(() => {
    const ck = activeConversationKey?.trim()
    if (!ck) {
      setChatOtherTyping(false)
      setChatPendingQueueCount(0)
      setChatOpponentRevealPending(false)
      return
    }
    const syncHeaderFromPipeline = () => {
      const flags = getConversationPipelineFlags(ck)
      const typing =
        flags.headerTyping ||
        isConversationPeerReplyingVisible(ck) ||
        flags.pendingQueueCount > 0
      setChatOtherTyping(typing)
      setChatPendingQueueCount(flags.pendingQueueCount)
      setChatOpponentRevealPending(flags.pendingQueueCount > 0)
    }
    syncHeaderFromPipeline()
    return subscribeWechatConversationAiPipeline(syncHeaderFromPipeline)
  }, [activeConversationCharacterId, chatRouteIdentityId, activeConversationKey])

  /** 从消息列表/子页返回聊天页时，再对齐一次顶栏输入态 */
  useEffect(() => {
    if (route.name !== 'chat') return
    const ck = activeConversationKey?.trim()
    if (!ck) return
    const flags = getConversationPipelineFlags(ck)
    const typing = flags.headerTyping || isConversationPeerReplyingVisible(ck) || flags.pendingQueueCount > 0
    setChatOtherTyping(typing)
    setChatPendingQueueCount(flags.pendingQueueCount)
    setChatOpponentRevealPending(flags.pendingQueueCount > 0)
  }, [route.name, activeConversationKey])

  useEffect(() => {
    setWeChatGlobalMessageGuardState({
      isMessagesTab: messagesListTabActive,
      activeConversationKey: route.name === 'chat' ? activeConversationKey : null,
    })
  }, [messagesListTabActive, route.name, activeConversationKey])

  const openChatFromGlobalMessage = useCallback((chat: WeChatQuickReplyChat) => {
    setRoute({ name: 'chat', chat })
  }, [])

  // 转发：选择聊天页当前待转发消息（单条/多条）
  const [forwardPendingMessages, setForwardPendingMessages] = useState<WeChatChatMessage[] | null>(null)
  const [forwardPendingMode, setForwardPendingMode] = useState<WeChatForwardMode>('single')
  const [forwardPendingMergeTitle, setForwardPendingMergeTitle] = useState<{ userName: string; peerName: string } | null>(
    null,
  )

  useEffect(() => {
    if (route.name !== 'forward-select-chat') {
      setForwardPendingMessages(null)
      return
    }
    const ids = route.payload.messageIds.map((x) => x.trim()).filter(Boolean)
    setForwardPendingMode(route.payload.mode)
    setForwardPendingMergeTitle(route.payload.mergeTitle ?? null)
    let cancelled = false
    void (async () => {
      const got = await Promise.all(ids.map((id) => personaDb.getWeChatChatMessageById(id)))
      if (cancelled) return
      setForwardPendingMessages(got.filter((x): x is WeChatChatMessage => !!x))
    })()
    return () => {
      cancelled = true
    }
  }, [route])

  const [chatHeaderBusyOn, setChatHeaderBusyOn] = useState(false)
  const [chatHeaderBusyEndTime, setChatHeaderBusyEndTime] = useState(0)
  const [chatHeaderBusyCountdown, setChatHeaderBusyCountdown] = useState('')
  const [chatHeaderBusyReason, setChatHeaderBusyReason] = useState('')
  const [chatHeaderBusyStartTime, setChatHeaderBusyStartTime] = useState(0)
  const [chatHeaderBusyDurationMinutes, setChatHeaderBusyDurationMinutes] = useState(0)
  const [busyDetailOpen, setBusyDetailOpen] = useState(false)
  const [chatSkipBusySignal, setChatSkipBusySignal] = useState(0)
  const [chatMultiSelectActive, setChatMultiSelectActive] = useState(false)
  const [chatMultiSelectExitSignal, setChatMultiSelectExitSignal] = useState(0)
  const [chatHistoryRefreshSignal, setChatHistoryRefreshSignal] = useState(0)
  const [chatHistoryViewerOpen, setChatHistoryViewerOpen] = useState(false)
  const [chatHistoryViewerData, setChatHistoryViewerData] = useState<WeChatChatHistoryPayload | null>(null)
  const [chatHistoryViewerAvatars, setChatHistoryViewerAvatars] = useState<Record<string, string | undefined>>({})
  const [chatHistoryViewerAvatarRadiusPx, setChatHistoryViewerAvatarRadiusPx] = useState(8)
  const [chatHistoryViewerRecipientId, setChatHistoryViewerRecipientId] = useState<string | undefined>()
  const [chatHistoryViewerUserDisplayName, setChatHistoryViewerUserDisplayName] = useState('我')
  const [chatHistoryViewerPersonaContacts, setChatHistoryViewerPersonaContacts] = useState<
    import('../../types').WeChatPersonaContact[]
  >([])
  const [chatHistoryViewerCardSenderCharacterId, setChatHistoryViewerCardSenderCharacterId] = useState<
    string | undefined
  >()
  const routeTimeCharacterId =
    route.name === 'chat' ? null : wxDockChat ? wxWalletPeerCharacterId(wxDockChat) : null
  const { getCurrentTimeMs } = useWeChatCurrentTime({
    characterId:
      route.name === 'chat'
        ? route.chat.kind === 'group'
          ? null
          : activeConversationCharacterId
        : routeTimeCharacterId,
    /**
     * 聊天页内 ChatRoom 自行读时间（liveTick:false）。
     * 返回消息列表 / 红包转账子页时底层 ChatRoom 仍挂载续跑 AI 队列，此时 App 层 tick 会每秒重绘隐藏 ChatRoom。
     */
    liveTick: route.name !== 'chat' && !wxDockChat,
  })

  const resolveRedPacketPeer = useCallback(
    (characterId: string) => {
      const cid = characterId.trim()
      if (cid === WECHAT_LUMI_PEER_CHARACTER_ID) {
        const c = weChatMergedContacts?.find((x) => x.id === 'wechat-lumi-assistant') ?? WECHAT_LUMI_ASSISTANT_CONTACT
        return { remarkName: c.remarkName, avatarUrl: c.avatarUrl }
      }
      if (cid === WECHAT_SELF_PEER_CHARACTER_ID) {
        return { remarkName: weChatSelfAccountContact.remarkName, avatarUrl: weChatSelfAccountContact.avatarUrl }
      }
      const row = state.wechatPersonaContacts.find((x) => x.characterId === cid)
      if (!row) return { remarkName: '聊天', avatarUrl: undefined as string | undefined }
      return { remarkName: row.remarkName, avatarUrl: row.avatarUrl }
    },
    [state.wechatPersonaContacts, weChatMergedContacts, weChatSelfAccountContact],
  )

  useEffect(() => {
    let cancelled = false
    const loadBusy = async () => {
      if (route.name !== 'chat' || !activeConversationCharacterId || !activeConversationKey) {
        if (!cancelled) {
          setChatHeaderBusyOn(false)
          setChatHeaderBusyEndTime(0)
          setChatHeaderBusyReason('')
          setChatHeaderBusyStartTime(0)
          setChatHeaderBusyDurationMinutes(0)
          setBusyDetailOpen(false)
        }
        return
      }
      if (activeConversationCharacterId.startsWith('wxgrp:')) {
        if (!cancelled) {
          setChatHeaderBusyOn(false)
          setChatHeaderBusyEndTime(0)
          setChatHeaderBusyReason('')
          setChatHeaderBusyStartTime(0)
          setChatHeaderBusyDurationMinutes(0)
          setBusyDetailOpen(false)
        }
        return
      }
      const gs = await personaDb.getGlobalSettings()
      const kv = await personaDb.getPhoneKv(`busy-conv:${activeConversationKey}`)
      const convEnabled = typeof kv === 'boolean' ? kv : true
      const row = await personaDb.getCharacterBusySettings(activeConversationCharacterId)
      const switchEnabled = gs.busyEnabled && (gs.busyMode === 'character' ? (row?.enabled ?? true) : convEnabled)
      const now = getCurrentTimeMs()
      const isBusy = !!row?.isBusy && (row.busyEndTime ?? 0) > now
      if (!cancelled) {
        setChatHeaderBusyOn(switchEnabled && isBusy)
        setChatHeaderBusyEndTime(switchEnabled && isBusy ? row?.busyEndTime ?? 0 : 0)
        setChatHeaderBusyReason(switchEnabled && isBusy ? (row?.busyReason ?? '') : '')
        setChatHeaderBusyStartTime(switchEnabled && isBusy ? row?.busyStartTime ?? 0 : 0)
        setChatHeaderBusyDurationMinutes(switchEnabled && isBusy ? row?.busyDurationMinutes ?? 0 : 0)
      }
    }
    void loadBusy()
    const onStorage = () => void loadBusy()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [route.name, activeConversationCharacterId, activeConversationKey, getCurrentTimeMs])

  useEffect(() => {
    if (!chatHeaderBusyOn || chatHeaderBusyEndTime <= 0) {
      setChatHeaderBusyCountdown('')
      return
    }
    const fmt = (ms: number) => {
      const remain = Math.max(0, ms)
      const total = Math.ceil(remain / 1000)
      const m = Math.floor(total / 60)
      const s = total % 60
      return `${m}分${String(s).padStart(2, '0')}秒`
    }
    const tick = () => {
      const remain = chatHeaderBusyEndTime - getCurrentTimeMs()
      if (remain <= 0) {
        setChatHeaderBusyCountdown('')
        setChatHeaderBusyOn(false)
        return
      }
      setChatHeaderBusyCountdown(fmt(remain))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [chatHeaderBusyOn, chatHeaderBusyEndTime, getCurrentTimeMs])

  useEffect(() => {
    if (!chatHeaderBusyOn) setBusyDetailOpen(false)
  }, [chatHeaderBusyOn])

  const chatHeaderMuteTrailing = useMemo(() => {
    if (route.name !== 'chat' || !activeConversationKey) return undefined
    const muted = isConversationMuted(activeConversationKey)
    if (!muted && !chatHeaderBusyOn) return undefined
    return (
      <span className="flex items-center gap-1">
        {chatHeaderBusyOn ? (
          <span
            role="button"
            tabIndex={0}
            onClick={() => {
              setBusyDetailOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setBusyDetailOpen(true)
              }
            }}
            className="inline-flex whitespace-nowrap rounded-full bg-[#f0f0f0] px-1.5 py-[1px] text-[10px] leading-none text-[#666]"
            aria-label="查看当前忙碌详情"
          >
            {chatHeaderBusyCountdown ? `忙碌中 ${chatHeaderBusyCountdown}` : '忙碌中'}
          </span>
        ) : null}
        {muted ? <BellOff className="shrink-0" width={12} height={12} strokeWidth={2} color="#666666" aria-hidden /> : null}
      </span>
    )
  }, [route.name, activeConversationKey, isConversationMuted, chatHeaderBusyOn, chatHeaderBusyCountdown, chatHeaderBusyReason, chatPeerContact?.remarkName])

  const busyDetailText = useMemo(() => {
    const who = chatPeerContact?.remarkName || '对方'
    const reasonRaw = chatHeaderBusyReason.trim() || '处理事情'
    const reason = reasonRaw.replace(/^(?:正在|目前正在|当前正在|在)\s*/u, '').trim() || reasonRaw
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (ts: number) => {
      if (!ts || !Number.isFinite(ts)) return '--:--:--'
      const d = new Date(ts)
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
    const start = fmt(chatHeaderBusyStartTime)
    const end = fmt(chatHeaderBusyEndTime)
    const busyFor = chatHeaderBusyDurationMinutes > 0 ? `${chatHeaderBusyDurationMinutes} 分钟` : '--'
    const remain = chatHeaderBusyCountdown || '0分00秒'
    const headline = `${who}正在${reason}`
    return { who, reason, headline, start, end, busyFor, remain }
  }, [chatPeerContact?.remarkName, chatHeaderBusyReason, chatHeaderBusyStartTime, chatHeaderBusyEndTime, chatHeaderBusyDurationMinutes, chatHeaderBusyCountdown])

  const skipBusyAndTriggerReply = useCallback(async () => {
    if (route.name !== 'chat' || !activeConversationCharacterId) {
      setBusyDetailOpen(false)
      return
    }
    const row = await personaDb.getCharacterBusySettings(activeConversationCharacterId)
    if (!row?.isBusy) {
      setBusyDetailOpen(false)
      return
    }
    await personaDb.putCharacterBusySettings({
      characterId: activeConversationCharacterId,
      enabled: row.enabled,
      isBusy: false,
      busyReason: '',
      busyStartTime: 0,
      busyEndTime: 0,
      busyDurationMinutes: row.busyDurationMinutes || 15,
      busyMessages: [],
    })
    // 立即收起头部忙碌提示，实际“忙后回复”由 ChatRoom 的忙碌到期监听触发
    setChatHeaderBusyOn(false)
    setChatHeaderBusyEndTime(0)
    setChatHeaderBusyCountdown('')
    setBusyDetailOpen(false)
    setChatSkipBusySignal((n) => n + 1)
  }, [route.name, activeConversationCharacterId, getCurrentTimeMs])

  useEffect(() => {
    if (route.name === 'chat' && activeConversationKey) {
      setWeChatForegroundConversationKey(activeConversationKey)
      return () => setWeChatForegroundConversationKey(null)
    }
    setWeChatForegroundConversationKey(null)
    return () => setWeChatForegroundConversationKey(null)
  }, [route.name, activeConversationKey])

  const [chatSessionPrefs, setChatSessionPrefs] = useState<{
    danmaku: boolean
    thinkingChain: boolean
    forwardHistoryCard: boolean
    pulseDmScreenshot: boolean
    profileImageChange: boolean
    internetMemeLexicon: boolean
    bg: string
    showGroupMemberNicknameInChat: boolean
    showGroupRankBadgesInChat: boolean
  } | null>(null)
  const [pendingScrollToMessageId, setPendingScrollToMessageId] = useState<string | null>(null)
  const clearPendingScrollToMessage = useCallback(() => setPendingScrollToMessageId(null), [])

  useEffect(() => {
    if (route.name !== 'chat') {
      setChatSettingsOpen(false)
      setChatTimeSettingsOpen(false)
    }
  }, [route.name])

  useEffect(() => {
    if (route.name !== 'chat') setChatCheckPhoneOpen(false)
  }, [route.name])

  useEffect(() => {
    if (route.name !== 'chat') setChatVoiceCallOverlayOpen(false)
  }, [route.name])

  useEffect(() => {
    if (route.name !== 'chat') setPendingScrollToMessageId(null)
  }, [route.name])

  useEffect(() => {
    if (!activeConversationKey) {
      setChatSessionPrefs(null)
      return
    }
    const load = () => {
      void personaDb.getChatConversationSettings(activeConversationKey).then((s) => {
        const next = {
          danmaku: s?.isDanmakuMode ?? false,
          thinkingChain: s?.showThinkingChain === true,
          forwardHistoryCard: s?.forwardHistoryCardEnabled === true,
          pulseDmScreenshot: s?.pulseDmScreenshotEnabled === true,
          profileImageChange: s?.profileImageChangeEnabled === true,
          internetMemeLexicon: s?.internetMemeLexiconEnabled === true,
          bg: (s?.chatBackground ?? '').trim(),
          showGroupMemberNicknameInChat: s?.showGroupMemberNicknameInChat !== false,
          showGroupRankBadgesInChat: !!s?.showGroupRankBadgesInChat,
        }
        setChatSessionPrefs((prev) =>
          prev &&
          prev.danmaku === next.danmaku &&
          prev.thinkingChain === next.thinkingChain &&
          prev.forwardHistoryCard === next.forwardHistoryCard &&
          prev.pulseDmScreenshot === next.pulseDmScreenshot &&
          prev.profileImageChange === next.profileImageChange &&
          prev.internetMemeLexicon === next.internetMemeLexicon &&
          prev.bg === next.bg &&
          prev.showGroupMemberNicknameInChat === next.showGroupMemberNicknameInChat &&
          prev.showGroupRankBadgesInChat === next.showGroupRankBadgesInChat
            ? prev
            : next,
        )
      })
    }
    load()
    const on = () => load()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [activeConversationKey])

  /**
   * 未读由「最后阅读游标 + 消息」计算。在聊天室内须持续标已读（含对方新消息落库），
   * 不能只进房标一次——否则返回键旁会误显示当前会话未读。
   */
  const markActiveChatReadInFlightRef = useRef(false)
  const markActiveChatRead = useCallback(async () => {
    if (route.name !== 'chat') return
    if (!activeConversationKey) return
    if (markActiveChatReadInFlightRef.current) return
    const layer = wxDockChat
    if (layer?.kind === 'persona' && chatRouteIdentityId === null) return

    markActiveChatReadInFlightRef.current = true
    try {
      const acc = currentAccountId?.trim()
      const sessionPid = (chatRouteIdentityId ?? playerIdentityId ?? '__none__').trim()

      if (layer?.kind === 'persona' && acc && activeConversationCharacterId) {
        await markPrivateChatConversationReadForAccountCharacter({
          wechatAccountId: acc,
          characterId: activeConversationCharacterId,
          appSessionPlayerIdentityId: sessionPid,
        })
      } else {
        await personaDb.markWeChatConversationReadToLatest(activeConversationKey)
      }
      await refreshMessageThreadsMeta()
    } finally {
      markActiveChatReadInFlightRef.current = false
    }
  }, [
    route.name,
    activeConversationKey,
    activeConversationCharacterId,
    chatRouteIdentityId,
    currentAccountId,
    playerIdentityId,
    refreshMessageThreadsMeta,
    wxDockChat,
  ])

  useEffect(() => {
    if (route.name !== 'chat') return
    if (!activeConversationKey) return
    const layer = wxDockChat
    if (layer?.kind === 'persona' && chatRouteIdentityId === null) return

    let debounceTimer: number | null = null
    const scheduleMark = () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        void markActiveChatRead()
      }, 80)
    }

    void markActiveChatRead()
    window.addEventListener('wechat-storage-changed', scheduleMark)
    return () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      window.removeEventListener('wechat-storage-changed', scheduleMark)
    }
  }, [route.name, activeConversationKey, chatRouteIdentityId, wxDockChat, markActiveChatRead])

  const activeChatUnreadExclude = useMemo((): ActiveChatUnreadExclude | null => {
    if (route.name !== 'chat') return null
    return {
      conversationKey: activeConversationKey,
      characterId:
        route.chat.kind === 'group' ? null : activeConversationCharacterId,
      groupId: route.chat.kind === 'group' ? route.chat.groupId : null,
    }
  }, [route, activeConversationKey, activeConversationCharacterId])

  const messagesTabUnreadTotal = useMemo(
    () =>
      messageThreads.reduce((s, t) => {
        if (isConversationMuted(t.conversationKey)) return s
        return s + t.unread
      }, 0),
    [messageThreads, isConversationMuted],
  )

  const chatBackBadgeUnreadTotal = useMemo(() => {
    if (!activeChatUnreadExclude) return messagesTabUnreadTotal
    return messageThreads.reduce((s, t) => {
      if (isConversationMuted(t.conversationKey)) return s
      if (isMessageThreadForActiveChat(t, activeChatUnreadExclude)) return s
      return s + t.unread
    }, 0)
  }, [messageThreads, isConversationMuted, activeChatUnreadExclude, messagesTabUnreadTotal])

  const exitChatToMessages = useCallback(() => {
    const convKey = activeConversationKey
    const layer = wxDockChat
    const acc = currentAccountId?.trim()
    const sessionPid = (chatRouteIdentityId ?? playerIdentityId ?? '__none__').trim()
    const personaCid =
      layer?.kind === 'persona' ? layer.characterId.trim() : activeConversationCharacterId?.trim() || ''
    setRoute({ name: 'tabs', tab: 'messages' })
    void (async () => {
      try {
        if (layer?.kind === 'persona' && acc && personaCid) {
          await markPrivateChatConversationReadForAccountCharacter({
            wechatAccountId: acc,
            characterId: personaCid,
            appSessionPlayerIdentityId: sessionPid,
          })
        } else if (convKey) {
          await personaDb.markWeChatConversationReadToLatest(convKey)
        }
        await refreshMessageThreadsMeta()
      } catch {
        // 读游标/列表刷新失败不阻断已完成的返回
      }
    })()
  }, [
    activeConversationKey,
    activeConversationCharacterId,
    chatRouteIdentityId,
    currentAccountId,
    playerIdentityId,
    refreshMessageThreadsMeta,
    wxDockChat,
  ])

  const title = useMemo(() => {
    if (route.name === 'new-friends-persona') return '新的朋友'
    if (route.name === 'contacts-group-chats') return '群聊'
    if (route.name === 'player-identities') return '我的身份'
    if (route.name === 'wallet-cards') return '卡包'
    if (route.name === 'wallet-transactions') return '交易流水'
    if (route.name === 'wallet-affection-cards') return '亲情卡'
    if (route.name === 'wallet-affection-transactions') return '亲情卡流水'
    if (route.name === 'wallet-bank-cards') return '银行卡'
    if (route.name === 'wallet-wealth') return 'Lumi理财'
    if (route.name === 'sticker-center') return '表情'
    if (route.name === 'affection-pay') return '亲情卡支付'
    if (route.name === 'memory-manage') return '记忆档案馆'
    if (route.name === 'favorites') return '收藏'
    if (route.name === 'album') return '相册'
    if (route.name === 'forward-select-chat') return '选择聊天'
    if (route.name === 'contact-profile-settings') return '资料设置'
    if (route.name === 'contact-recommend-select') return '选择联系人'
    if (route.name === 'contact-complaint') return '投诉'
    if (route.name === 'red-packet-detail') return '红包详情'
    if (route.name === 'red-packet-history') return '红包记录'
    if (route.name === 'lumi-transfer') return route.chat.kind === 'lumi' ? 'Lumi转账' : '转账'
    if (route.name === 'transfer-detail') return '转账详情'
    if (route.name === 'chat') return '微信'
    if (route.name !== 'tabs') return '微信'
    switch (route.tab) {
      case 'messages':
        return '信息'
      case 'contacts':
        return '通讯录'
      case 'dates':
        return '约会'
      case 'discover':
        return '发现'
      case 'profile':
        return '我'
      default:
        return '微信'
    }
  }, [route])

  const activeTab = route.name === 'tabs' ? route.tab : 'messages'
  const hideTabChrome =
    (route.name === 'tabs' && route.tab === 'dates' && hideDatingChrome) ||
    (route.name === 'tabs' && route.tab === 'discover' && discoverMomentsOpen) ||
    wxGlobalNav != null ||
    (route.name === 'tabs' && newGroupFromMessagesOpen) ||
    (route.name === 'contacts-group-chats' && newGroupFromMessagesOpen) ||
    route.name === 'user-moments-archive'
  const hideWeChatHeader =
    route.name === 'new-friends-persona' ||
    route.name === 'contacts-group-chats' ||
    route.name === 'player-identities' ||
    route.name === 'switch-account' ||
    route.name === 'switch-account-register' ||
    route.name === 'wallet-cards' ||
    route.name === 'wallet-transactions' ||
    route.name === 'wallet-affection-cards' ||
    route.name === 'wallet-affection-transactions' ||
    route.name === 'wallet-bank-cards' ||
    route.name === 'wallet-wealth' ||
    route.name === 'sticker-center' ||
    route.name === 'affection-pay' ||
    route.name === 'memory-manage' ||
    route.name === 'favorites' ||
    route.name === 'album' ||
    route.name === 'forward-select-chat' ||
    route.name === 'contact-profile' ||
    route.name === 'red-packet-send' ||
    route.name === 'red-packet-detail' ||
    route.name === 'red-packet-history' ||
    route.name === 'lumi-transfer' ||
    route.name === 'transfer-detail' ||
    route.name === 'add-friend' ||
    route.name === 'add-friend-stranger' ||
    route.name === 'add-friend-request-form' ||
    route.name === 'user-moments-archive' ||
    wxGlobalNav != null ||
    (route.name === 'tabs' && route.tab === 'discover' && discoverMomentsOpen) ||
    (route.name === 'chat' && chatSettingsOpen) ||
    (route.name === 'chat' && chatCheckPhoneOpen) ||
    (route.name === 'chat' && chatMiniGameOverlayOpen) ||
    (route.name === 'chat' && chatVoiceCallOverlayOpen) ||
    (route.name === 'tabs' && newGroupFromMessagesOpen)
  const activeTabBgFill = useMemo(() => {
    const byTab = wechatTheme.pageBgByTab?.[activeTab as WeChatTabId]
    return byTab ?? wechatTheme.pageBgGlobal
  }, [activeTab, wechatTheme.pageBgByTab, wechatTheme.pageBgGlobal])

  const wechatPageBackdropStyle = useMemo((): CSSProperties => {
    if (route.name === 'tabs') return fillToStyle(activeTabBgFill)
    return {
      backgroundColor: pageStyle?.pageBg || 'var(--wx-bg)',
      backgroundImage: pageStyle?.pageBgImageUrl?.trim()
        ? `url(${resolvePublicImageUrl(pageStyle.pageBgImageUrl)})`
        : 'none',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    }
  }, [route.name, activeTabBgFill, pageStyle?.pageBg, pageStyle?.pageBgImageUrl])

  useEffect(() => {
    if (!(route.name === 'tabs' && route.tab === 'profile')) {
      setWxGlobalNav(null)
    }
  }, [route])

  useEffect(() => {
    if (!(route.name === 'tabs' && route.tab === 'discover')) {
      setDiscoverMomentsOpen(false)
    }
  }, [route])

  useEffect(() => {
    if (route.name === 'chat') return
    setChatHistoryViewerOpen(false)
    setChatHistoryViewerData(null)
    setChatHistoryViewerAvatars({})
    setChatHistoryViewerRecipientId(undefined)
    setChatHistoryViewerCardSenderCharacterId(undefined)
  }, [route.name])

  const markNewFriendRequestsRead = useCallback(() => {
    if (playerIdentityId === null) return
    const pid = playerIdentityId.trim()
    if (!pid) return
    void (async () => {
      const rows = await listFriendRequestsForWechatAccount(currentAccountId, { pendingOnly: true })
      await Promise.all(
        rows.map(async (r) => {
          if (r.outcomeUnread) await personaDb.clearFriendRequestOutcomeUnread(r.id)
          const requestPid = r.playerIdentityId.trim() || pid
          const ck = await resolveAccountScopedPrivateConversationKey({
            wechatAccountId: currentAccountId,
            characterId: r.characterId,
            appSessionPlayerIdentityId: requestPid,
          })
          return personaDb.markWeChatConversationReadToLatest(ck)
        }),
      )
      emitWeChatStorageChanged()
      await refreshPendingNewFriendRequests()
    })()
  }, [currentAccountId, playerIdentityId, refreshPendingNewFriendRequests])

  const buildFriendRequestAiReply = useCallback(
    async (params: {
      characterId: string
      messages: FriendRequest['messages']
      replyBias?: string
      /** 本地累计删除次数（含本轮）；缺省则不注入「第几次删」偏向 */
      contactDeletionCount?: number
      /** 裁决/私聊用：好友申请绑定的微信身份（优先于 App 当前身份） */
      sessionPlayerIdentityId?: string
    }) => {
      const character = await personaDb.getCharacter(params.characterId)
      if (!character) throw new Error('角色不存在')
      const pid =
        params.sessionPlayerIdentityId?.trim() || playerIdentityId?.trim() || ''
      const sessionPid = pid && pid !== '__none__' ? pid : '__none__'
      /** 好友申请栏一律不注入玩家身份卡，避免模型凭档案认出申请人。 */
      const friendRequestHomeOnly = true
      const bundle = await loadAccountsBundle()
      const accounts = bundle?.accounts ?? []
      const altWechatLine = isSecondaryWechatAccountInBundle(bundle, currentAccountId)
      const currentAcc = currentAccountId
        ? accounts.find((a) => a.accountId === currentAccountId)
        : undefined
      const altAccountProbeBlock = currentAcc
        ? buildAltWechatStrangerContactPromptBlock(currentAcc)
        : ''
      const playerIdentity = null
      let worldBackgroundPrompt: string | undefined
      if (character.worldBackgroundEnabled !== false && character.worldBackgroundId?.trim()) {
        const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
        const block = formatWorldBackgroundForPrompt(wbg)
        if (block.trim()) worldBackgroundPrompt = block
      }
      const transcript: ChatTranscriptTurn[] = params.messages.map((m) => ({
        from: m.sender === 'user' ? 'self' : 'other',
        text: m.content,
      }))
      const convKey = await resolveAccountScopedPrivateConversationKey({
        wechatAccountId: currentAccountId,
        characterId: character.id,
        appSessionPlayerIdentityId: sessionPid,
      })
      const ordinalBias =
        typeof params.contactDeletionCount === 'number' && params.contactDeletionCount > 0
          ? buildFriendRequestDeletionOrdinalBias(params.contactDeletionCount)
          : ''
      const nonPrimarySession = isNonPrimaryBindingSession(character, sessionPid)
      const nonPrimaryBindingBias = nonPrimarySession
        ? await buildFriendRequestNonPrimaryBindingBias({
            characterId: character.id,
            sessionPlayerIdentityId: sessionPid,
            wechatHomeDisplayName: state.profile.displayName?.trim() || '朋友',
          })
        : ''
      const firstUserVerify = params.messages.find((m) => m.sender === 'user')?.content?.trim()
      const verificationVerbatimBias = firstUserVerify
        ? [
            '【对方验证原文·勿曲解】',
            firstUserVerify,
            '解读：句中「我是…」=申请人验证里的自称，**不是**档案主绑定真名，**不等于**可用微信主页昵称直呼；「顾社长/某某推的」=推荐人介绍。**禁止**认定申请人就是顾社长/社长/档案主绑定玩家本人。',
          ].join('\n')
        : ''
      const mergedExtra = [
        FRIEND_REQUEST_APPLICANT_UNKNOWN_BIAS,
        params.replyBias,
        ordinalBias,
        nonPrimaryBindingBias,
        altAccountProbeBlock,
        verificationVerbatimBias,
      ]
        .filter(Boolean)
        .join('\n\n')
      const replyBiasFull = buildFriendRequestReplyBias({ messages: params.messages, extraBias: mergedExtra })
      const friendRequestAdjudication = /friend_request_response|系统裁决/.test(replyBiasFull)
      const pack = await buildFriendRequestPrivatePromptPack({
        characterId: character.id,
        conversationKey: convKey,
        sessionPlayerIdentityId: sessionPid,
        apiConfig,
        transcript,
        biasTextForMemoryHaystack: replyBiasFull,
        crossAccountContext: currentAccountId
          ? { currentAccountId, allAccounts: accounts }
          : undefined,
      })
      const wechatHome = {
        displayName: state.profile.displayName?.trim() || '',
        signature: state.profile.signature?.trim() || '',
      }
      const isMeetChar = isMeetSyncedCharacter(character.id, character.worldBooks ?? [])
      const useHomeOnly = friendRequestHomeOnly || isMeetChar
      const peerDisplayName = wechatHome.displayName || '朋友'
      let meetWechatContinuityBlock: string | undefined
      if (isMeetChar && !altWechatLine) {
        const meetSnap = await loadMeetUserProfileSnapshotFromKv(character.id)
        meetWechatContinuityBlock = buildMeetWechatPrivateChatContinuityBlock({
          meetSnapshot: meetSnap,
          wechatProfile: wechatHome,
          forFriendRequest: true,
        })
      }
      const friendReqWbIds = [character.id?.trim()].filter(Boolean) as string[]
      const worldBookBinding = await resolveWorldBookUserBinding(character)
      const charTimeRow = await personaDb.getCharacterTimeSettings(character.id)
      const timePerceptionEnabled = isCharacterTimePerceptionEnabled(charTimeRow)
      const convSettings = await personaDb.getChatConversationSettings(convKey)
      const ai = await requestWeChatPeerReplyBubbles({
        apiConfig,
        character,
        playerIdentity: useHomeOnly ? null : playerIdentity,
        playerDisplayName: peerDisplayName,
        wechatHomeProfile: useHomeOnly ? wechatHome : undefined,
        meetWechatContinuityBlock: meetWechatContinuityBlock,
        transcript,
        promptMode: 'persona',
        longTermMemoryNotes: pack.memory || undefined,
        worldBackgroundPrompt,
        offlineDatingPlotsContext: pack.offlineDatingPlotsContext || undefined,
        meetEncounterMemoriesContext: pack.meetEncounterMemoriesContext || undefined,
        unsummarizedMeetNotes: pack.unsMeet || undefined,
        recentGroupChatsReference: pack.recentGroupChatsReference || undefined,
        unsummarizedPrivateNotes: pack.unsPrivate || undefined,
        unsummarizedGroupNotes: pack.unsGroup || undefined,
        replyBias: replyBiasFull,
        includeThinkingChain: !friendRequestAdjudication && convSettings?.showThinkingChain === true,
        includeForwardHistoryCard: convSettings?.forwardHistoryCardEnabled === true,
        includePulseDmScreenshot: convSettings?.pulseDmScreenshotEnabled === true,
        includeProfileImageChange: convSettings?.profileImageChangeEnabled === true,
        includeInternetMemeLexicon: convSettings?.internetMemeLexiconEnabled === true,
        friendRequestAdjudication,
        altAccountProbeBlock: altAccountProbeBlock || undefined,
        currentTimeMs: getCurrentTimeMs(),
        timePerceptionEnabled,
        chatMemberIds: friendReqWbIds,
        globalWechatPlate: 'private_chat',
        nonPrimarySpeakerLine: nonPrimarySession || useHomeOnly,
        worldBookPlayerIdentity: worldBookBinding?.row ?? null,
        worldBookUserLineLabel: worldBookBinding?.lineLabel,
      })
      if (ai.worldBookPatches?.length) {
        try {
          const nextCh = applyWorldBookAfterPatchesToCharacter(character, ai.worldBookPatches)
          if (nextCh) {
            await personaDb.upsertCharacter(nextCh)
            window.dispatchEvent(
              new CustomEvent(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, {
                detail: { appliedPatchCount: ai.worldBookPatches.length },
              }),
            )
          }
        } catch {
          /* 与 ChatRoom 一致：尾声延展写库失败不阻断好友验证气泡 */
        }
      }
      return {
        bubbles: ai.bubbles.filter((x) => String(x || '').trim().length > 0),
        nickname: character.remark?.trim() || character.wechatNickname?.trim() || character.name || '对方',
        avatar: character.avatarUrl?.trim() || '',
        rawText: ai.rawText,
      }
    },
    [apiConfig, currentAccountId, getCurrentTimeMs, playerIdentityId, state.profile.displayName, state.profile.signature],
  )

  const resolveNewFriendRequest = useCallback(
    async (requestId: string, action: 'accepted' | 'declined'): Promise<number | undefined> => {
      const target = pendingNewFriendRequests.find((x) => x.id === requestId)
      const frRow = await personaDb.getFriendRequestById(requestId)
      const characterId = target?.targetCharId?.trim() || target?.characterId?.trim() || frRow?.characterId?.trim()
      const userOutgoing =
        !!frRow && isUserInitiatedFriendRequestSource(frRow.source)
      await personaDb.setFriendRequestStatus(
        requestId,
        action,
        action === 'accepted'
          ? { outcomeUnread: false }
          : action === 'declined' && userOutgoing
            ? { outcomeUnread: true }
            : undefined,
      )
      let acceptedAtMs: number | undefined
      let meetHideBefore: number | null = null
      if (action === 'accepted' && characterId) {
        const canonId = (await resolveCanonicalCharacterId(characterId)) || characterId.trim()
        const ch = await personaDb.getCharacter(canonId)
        if (ch) {
          const pid =
            resolveOutgoingFriendRequestPlayerIdentityId(ch, frRow?.playerIdentityId) ||
            playerIdentityId?.trim() ||
            ''
          const requestPid = frRow?.playerIdentityId?.trim() || pid
          const appSessionPid = playerIdentityId?.trim() || requestPid
          if (requestPid && requestPid !== '__none__') {
            if (userOutgoing) {
              await linkCharacterPlayerIdentityFromAcceptedFriendRequest(
                canonId,
                requestPid,
                currentAccountId,
              )
            }
            const isMeetChar = isMeetSyncedCharacter(canonId, ch.worldBooks ?? [])
            const needMeetSync = await shouldSyncMeetEncounterToWechat({
              characterId: canonId,
              friendRequestSource: frRow?.source,
            })
            if (needMeetSync) {
              const meetSync = await syncMeetEncounterToWechatAfterFriendLinked({
                apiConfig,
                characterId: canonId,
                playerIdentityId: requestPid,
                friendRequestSource: frRow?.source,
                verificationEpochMs: frRow?.verificationEpochMs ?? frRow?.createdAt,
              })
              meetHideBefore = resolveUiHideBeforeForMeetImport({
                verificationEpochMs: frRow?.verificationEpochMs ?? frRow?.createdAt ?? Date.now(),
                meetEarliestTs: meetSync.meetEarliestTs,
              })
            } else if (isMeetChar) {
              await ensureMeetVol10EpilogueIfNeeded({
                apiConfig,
                characterId: canonId,
                playerIdentityId: requestPid,
                verificationEpochMs: frRow?.verificationEpochMs ?? frRow?.createdAt,
                requireWechatLink: false,
              }).catch(() => {
                // 不阻断加好友
              })
            }
          }
          acceptedAtMs = Date.now()
          const acceptedRemark =
            frRow?.contactRemarkAlias?.trim() ||
            (userOutgoing ? target?.nickname?.trim() : '') ||
            ''
          let chForContact = ch
          const acceptAcc = currentAccountId?.trim()
          if (acceptAcc && !ch.wechatAccountId?.trim()) {
            chForContact = stampWechatAccountOwner(
              { ...ch, updatedAt: Date.now() },
              acceptAcc,
            )
            await personaDb.upsertCharacter(chForContact)
          }
          const contactEntry = contactEntryFromCharacter(chForContact, {
            remarkName: acceptedRemark || undefined,
          })
          await appendPersonaContactsForCurrentAccount([contactEntry])
          /**
           * 与 ChatRoom 同一会话键。
           * 删除联系人（尤其「告知对方」软删）时旧气泡仍在 IndexedDB，仅靠 uiOnlyHiddenBeforeTimestamp 隐藏；
           * 若此处「清空 UI 隐藏」，会把回收站归档对应的旧记录一并露出。
           * 因此同意好友后：**保留**隐藏分割线在本轮「验证阶段」起点之前（verificationEpochMs − 1），
           * 聊天室只默认展示本轮验证以来的消息；更早的记录仍只能从回收站手动恢复（快照 uiClearOnly）。
           */
          const sessionPid = requestPid || '__none__'
          const epochMs = frRow?.verificationEpochMs ?? frRow?.createdAt ?? target?.requestTimeMs ?? 0
          const keepHideBeforeTimestamp =
            meetHideBefore != null
              ? meetHideBefore
              : typeof epochMs === 'number' && Number.isFinite(epochMs) && epochMs > 0
                ? Math.max(0, epochMs - 1)
                : null
          const settingsPatch = {
            peerCharacterId: canonId,
            ...(keepHideBeforeTimestamp != null
              ? { uiOnlyHiddenBeforeTimestamp: keepHideBeforeTimestamp }
              : { clearUiOnlyHiddenBeforeTimestamp: true }),
            hiddenFromMessageList: false,
            friendRequestAcceptedAtMs: acceptedAtMs,
          } as const
          const sessionIds = new Set<string>([sessionPid])
          if (appSessionPid && appSessionPid !== '__none__') sessionIds.add(appSessionPid)
          for (const sid of sessionIds) {
            const convKey = await resolveAccountScopedPrivateConversationKey({
              wechatAccountId: currentAccountId,
              characterId: canonId,
              appSessionPlayerIdentityId: sid,
            })
            await personaDb.upsertChatConversationSettings({
              conversationKey: convKey,
              playerIdentityId: sid,
              ...settingsPatch,
            })
          }
        }
      }
      emitWeChatStorageChanged()
      await refreshPendingNewFriendRequests()
      await refreshMessageThreadsMeta()
      return acceptedAtMs
    },
    [
      apiConfig,
      appendPersonaContactsForCurrentAccount,
      pendingNewFriendRequests,
      currentAccountId,
      playerIdentityId,
      refreshPendingNewFriendRequests,
      refreshMessageThreadsMeta,
    ],
  )

  const replyingFriendRequestIdsRef = useRef<Set<string>>(new Set())
  const [replyingFriendRequestIds, setReplyingFriendRequestIds] = useState<string[]>([])
  const [tempChatReplyingIds, setTempChatReplyingIds] = useState<string[]>([])
  const replyWatchdogTimersRef = useRef<Record<string, number>>({})
  const adjudicateInFlightRef = useRef<Map<string, Promise<void>>>(new Map())
  const autoAdjudicateRetryCountRef = useRef<Record<string, number>>({})
  const AUTO_ADJUDICATE_MAX_RETRIES = 4
  const ADJUDICATE_IN_FLIGHT_MAX_MS = 120_000

  const clearFriendRequestAdjudicationUiState = useCallback((requestId: string) => {
    const id = requestId.trim()
    if (!id) return
    adjudicateInFlightRef.current.delete(id)
    replyingFriendRequestIdsRef.current.delete(id)
    setReplyingFriendRequestIds((prev) => prev.filter((x) => x !== id))
    delete autoAdjudicateRetryCountRef.current[id]
    if (replyWatchdogTimersRef.current[id]) {
      window.clearTimeout(replyWatchdogTimersRef.current[id])
      delete replyWatchdogTimersRef.current[id]
    }
  }, [])

  useEffect(() => {
    const onReset = (ev: Event) => {
      const id = (ev as CustomEvent<FriendRequestAdjudicationResetDetail>).detail?.requestId?.trim()
      if (id) clearFriendRequestAdjudicationUiState(id)
    }
    window.addEventListener(FRIEND_REQUEST_ADJUDICATION_RESET_EVENT, onReset)
    return () => window.removeEventListener(FRIEND_REQUEST_ADJUDICATION_RESET_EVENT, onReset)
  }, [clearFriendRequestAdjudicationUiState])

  const adjudicateFriendRequestAsCharacter = useCallback(
    async (requestId: string, opts?: { force?: boolean }) => {
      if (opts?.force) clearFriendRequestAdjudicationUiState(requestId)

      const existing = adjudicateInFlightRef.current.get(requestId)
      if (existing && !opts?.force) {
        await Promise.race([
          existing,
          new Promise<void>((resolve) => window.setTimeout(resolve, ADJUDICATE_IN_FLIGHT_MAX_MS)),
        ]).catch(() => undefined)
        if (adjudicateInFlightRef.current.get(requestId) === existing) return
      }

      const job = (async () => {
        const frRow = await personaDb.getFriendRequestById(requestId)
        const chRow = frRow ? await personaDb.getCharacter(frRow.characterId) : null
        const pid =
          resolveOutgoingFriendRequestPlayerIdentityId(chRow, frRow?.playerIdentityId) ||
          frRow?.playerIdentityId?.trim() ||
          playerIdentityId?.trim() ||
          ''
        replyingFriendRequestIdsRef.current.add(requestId)
        setReplyingFriendRequestIds((prev) => (prev.includes(requestId) ? prev : [...prev, requestId]))
        try {
          if (!pid || pid === '__none__') {
            window.alert('请先选择微信身份后再等待对方回复。')
            return
          }
          if (frRow) {
            await personaDb.upsertFriendRequest({ ...frRow, adjudicationLastError: '' })
          }
          let adjudicateThrew = false
          try {
          const decision = await runCharacterFriendRequestAdjudication({
            requestId,
            playerIdentityId: pid,
            wechatAccountId: currentAccountId,
            wechatHomeProfile: {
              displayName: state.profile.displayName?.trim() || '',
              signature: state.profile.signature?.trim() || '',
            },
            buildFriendRequestAiReply,
            applyResolution: (id, action) => resolveNewFriendRequest(id, action),
          })
          await refreshPendingNewFriendRequests()
          if (decision == null && frRow?.status === 'pending') {
            const refreshed = await personaDb.getFriendRequestById(requestId)
            if (refreshed?.status !== 'pending') return
            const msgs = await loadFriendRequestMessagesForAdjudication({
              requestId,
              characterId: refreshed.characterId,
              playerIdentityId: pid,
              wechatAccountId: currentAccountId,
              verificationEpochMs: refreshed.verificationEpochMs ?? refreshed.createdAt ?? Date.now(),
              maxTimestampMs: refreshed.adjudicationCutoffMs ?? refreshed.verificationEpochMs,
            })
            const hasChar = msgs.some((m) => m.sender === 'character')
            const hint = hasChar
              ? FRIEND_REQUEST_ADJUDICATION_INCOMPLETE_ERROR
              : '对方暂未回复，请检查 API 配置后在本页重试。'
            if (!refreshed.adjudicationLastError?.trim()) {
              await personaDb.upsertFriendRequest({ ...refreshed, adjudicationLastError: hint })
              await refreshPendingNewFriendRequests()
            }
          }
          } catch (e) {
            adjudicateThrew = true
            console.warn('[friend-request] adjudicate failed', e)
            const friendly = formatFriendRequestApiError(e)
            const latest = (await personaDb.getFriendRequestById(requestId)) ?? frRow
            if (latest) {
              await personaDb.upsertFriendRequest({ ...latest, adjudicationLastError: friendly })
            }
            await refreshPendingNewFriendRequests()
          } finally {
            if (!adjudicateThrew) {
              const latest = await personaDb.getFriendRequestById(requestId)
              if (
                latest?.adjudicationLastError?.trim() &&
                latest.status !== 'pending'
              ) {
                await personaDb.upsertFriendRequest({ ...latest, adjudicationLastError: '' })
              }
            }
          }
        } finally {
          clearFriendRequestAdjudicationUiState(requestId)
        }
      })()

      adjudicateInFlightRef.current.set(requestId, job)
      registerFriendRequestAdjudicationJob(requestId, job)
      try {
        await job
      } finally {
        if (adjudicateInFlightRef.current.get(requestId) === job) {
          adjudicateInFlightRef.current.delete(requestId)
        }
      }
    },
    [
      buildFriendRequestAiReply,
      clearFriendRequestAdjudicationUiState,
      currentAccountId,
      playerIdentityId,
      refreshPendingNewFriendRequests,
      resolveNewFriendRequest,
    ],
  )

  /** 裁决进行中：轮询刷新验证页气泡（异步 AI + 写入间隔期间也更新 UI） */
  useEffect(() => {
    if (!replyingFriendRequestIds.length) return
    const tick = () => void refreshPendingNewFriendRequests()
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [replyingFriendRequestIds, refreshPendingNewFriendRequests])

  /** 补跑未裁决的用户主动申请（发送后中断、首次裁决未触发、或模型未输出裁决 XML 仅回复口语） */
  useEffect(() => {
    for (const req of pendingNewFriendRequests) {
      if (req.status !== 'pending') continue
      if (!(req.direction === 'outbound' || req.userInitiated)) continue
      if (replyingFriendRequestIdsRef.current.has(req.id)) continue
      if (isFriendRequestAdjudicationInFlight(req.id)) continue
      const hasChar = req.messages.some((m) => m.sender === 'character')
      const last = req.messages[req.messages.length - 1]
      const err = req.adjudicationLastError?.trim() ?? ''
      const retryCount = autoAdjudicateRetryCountRef.current[req.id] ?? 0
      if (retryCount >= AUTO_ADJUDICATE_MAX_RETRIES) continue
      const needsInitialAdjudication = !hasChar && last?.sender === 'user'
      const needsDecisionRetry =
        hasChar &&
        !!err &&
        (err.includes('accept/decline') ||
          err.includes('裁决') ||
          err.includes('暂未回复') ||
          err.includes('API'))
      /** 角色已在验证区回复但仍 pending（常见于模型只口语、未写 XML） */
      const needsStalePendingAdjudication =
        hasChar && !err && (last?.sender === 'character' || last?.sender === 'user')
      if (!needsInitialAdjudication && !needsDecisionRetry && !needsStalePendingAdjudication) continue
      autoAdjudicateRetryCountRef.current[req.id] = retryCount + 1
      const delayMs = needsInitialAdjudication ? 400 : 1500 + retryCount * 2000
      window.setTimeout(() => {
        if (isFriendRequestAdjudicationInFlight(req.id)) return
        if (replyingFriendRequestIdsRef.current.has(req.id)) return
        void adjudicateFriendRequestAsCharacter(req.id)
      }, delayMs)
    }
  }, [adjudicateFriendRequestAsCharacter, pendingNewFriendRequests])

  /** 从「添加朋友」发送后打开验证详情时，确保后台裁决已排队 */
  useEffect(() => {
    const id = pendingOpenFriendRequestId?.trim()
    if (!id) return
    const req = pendingNewFriendRequests.find((x) => x.id === id)
    if (!req || req.status !== 'pending') return
    if (!(req.direction === 'outbound' || req.userInitiated)) return
    if (isFriendRequestAdjudicationInFlight(id)) return
    if (replyingFriendRequestIdsRef.current.has(id)) return
    const timer = window.setTimeout(() => {
      if (isFriendRequestAdjudicationInFlight(id)) return
      void adjudicateFriendRequestAsCharacter(id)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [
    adjudicateFriendRequestAsCharacter,
    pendingNewFriendRequests,
    pendingOpenFriendRequestId,
  ])

  const sendNewFriendRequestMessage = useCallback(
    async (requestId: string, replyText: string) => {
      const target = pendingNewFriendRequests.find((x) => x.id === requestId)
      if (!target) return
      if (!target.characterId) return
      if (playerIdentityId === null) return
      const frRow = await personaDb.getFriendRequestById(requestId)
      const chRow = frRow ? await personaDb.getCharacter(frRow.characterId) : null
      const sessionPid =
        resolveOutgoingFriendRequestPlayerIdentityId(chRow, frRow?.playerIdentityId) ||
        frRow?.playerIdentityId?.trim() ||
        playerIdentityId.trim()
      if (!sessionPid || sessionPid === '__none__') return
      const convKey = await resolveAccountScopedPrivateConversationKey({
        wechatAccountId: currentAccountId,
        characterId: target.characterId,
        appSessionPlayerIdentityId: sessionPid,
      })
      const nowMs = Date.now()
      const userText = sanitizeFriendRequestPlainText(replyText)
      if (!userText) return
      await personaDb.appendWeChatChatMessage({
        id: `fr-user-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
        characterId: target.characterId,
        playerIdentityId: sessionPid,
        type: 'player',
        content: userText,
        timestamp: nowMs,
        isRead: true,
        conversationKey: convKey,
      })
      await personaDb.markWeChatConversationReadToLatest(convKey)
      emitWeChatStorageChanged()
      await refreshPendingNewFriendRequests()
    },
    [currentAccountId, pendingNewFriendRequests, playerIdentityId, refreshPendingNewFriendRequests],
  )

  const sendFriendRequestTempChatMessage = useCallback(
    async (requestId: string, text: string) => {
      const target = pendingNewFriendRequests.find((x) => x.id === requestId)
      const charId = target?.targetCharId?.trim() || target?.characterId?.trim()
      if (!target || !charId || target.status !== 'declined') return
      const userText = sanitizeFriendRequestPlainText(text)
      if (!userText) return

      const now = Date.now()
      await appendFriendRequestTempChatMessage(requestId, {
        sender: 'user',
        text: userText,
        time: now,
      })
      await refreshPendingNewFriendRequests()

      setTempChatReplyingIds((prev) => (prev.includes(requestId) ? prev : [...prev, requestId]))
      try {
        const frRow = await personaDb.getFriendRequestById(requestId)
        const thread = frRow ? tempChatThreadFromRow(frRow) : [...(target.tempChatThread ?? []), { sender: 'user' as const, text: userText, time: now }]
        await runFriendRequestTempChatReply({
          requestId,
          characterId: charId,
          tempThread: thread,
          buildFriendRequestAiReply,
          applyAccept: (id) => resolveNewFriendRequest(id, 'accepted'),
        })
      } catch (e) {
        console.warn('[friend-request] temp chat failed', e)
      } finally {
        setTempChatReplyingIds((prev) => prev.filter((x) => x !== requestId))
        await refreshPendingNewFriendRequests()
      }
    },
    [
      buildFriendRequestAiReply,
      pendingNewFriendRequests,
      refreshPendingNewFriendRequests,
      resolveNewFriendRequest,
    ],
  )

  const triggerNewFriendRequestReply = useCallback(
    (requestId: string) => {
      void (async () => {
        const frMetaEarly = await personaDb.getFriendRequestById(requestId)
        if (frMetaEarly && isUserInitiatedFriendRequestSource(frMetaEarly.source)) {
          await adjudicateFriendRequestAsCharacter(requestId)
          return
        }
        if (replyingFriendRequestIdsRef.current.has(requestId)) return
        replyingFriendRequestIdsRef.current.add(requestId)
        setReplyingFriendRequestIds((prev) => (prev.includes(requestId) ? prev : [...prev, requestId]))
        if (replyWatchdogTimersRef.current[requestId]) window.clearTimeout(replyWatchdogTimersRef.current[requestId])
        replyWatchdogTimersRef.current[requestId] = window.setTimeout(() => {
          replyingFriendRequestIdsRef.current.delete(requestId)
          setReplyingFriendRequestIds((prev) => prev.filter((id) => id !== requestId))
          delete replyWatchdogTimersRef.current[requestId]
        }, 25000)
        try {
          let target = pendingNewFriendRequests.find((x) => x.id === requestId) ?? null
          const frMeta = frMetaEarly ?? (await personaDb.getFriendRequestById(requestId))
          if (!target) {
            const row = frMeta
            if (!row) return
            target = await mapFriendRequestRowToUi({
              row,
              nickname: '对方',
              avatar: '',
              messages: [],
              unread: false,
            })
          }
          if (!target || !target.characterId) return
          if (playerIdentityId === null) return
          const chRow = frMeta ? await personaDb.getCharacter(frMeta.characterId) : null
          const sessionPid =
            resolveOutgoingFriendRequestPlayerIdentityId(chRow, frMeta?.playerIdentityId) ||
            frMeta?.playerIdentityId?.trim() ||
            playerIdentityId.trim()
          if (!sessionPid || sessionPid === '__none__') return
          const convKey = await resolveAccountScopedPrivateConversationKey({
            wechatAccountId: currentAccountId,
            characterId: target.characterId,
            appSessionPlayerIdentityId: sessionPid,
          })
          const verificationEpochRaw = frMeta
            ? (frMeta.verificationEpochMs ?? frMeta.createdAt)
            : target.requestTimeMs
          if (verificationEpochRaw == null) return
          const verificationEpochMs = verificationEpochRaw
          const recent = await personaDb.listWeChatChatMessagesRecent({ conversationKey: convKey, limit: 200 })
          const messages: FriendRequest['messages'] = recent
            .filter((m) => m.timestamp >= verificationEpochMs)
            .filter((m) => !m.images?.length && !m.redPacket && !m.transfer && !m.callStatus && !m.replyTo)
            .map((m) => ({
              id: m.id,
              sender: (m.type === 'character' ? 'character' : 'user') as 'character' | 'user',
              content: sanitizeFriendRequestPlainText(m.content),
              timestamp: formatFriendRequestTime(m.timestamp),
              timestampMs: m.timestamp,
            }))
            .filter((m) => m.content.length > 0)
          const last = messages[messages.length - 1]
          if (!last || last.sender !== 'user') return
          const delCount = await getContactDeletionCount(target.characterId, sessionPid)
          const ai = await buildFriendRequestAiReply({
            characterId: target.characterId,
            messages,
            contactDeletionCount: delCount > 0 ? delCount : undefined,
          })
          const aiTexts = ai.bubbles.map((x) => sanitizeFriendRequestPlainText(x)).filter(Boolean)
          if (!aiTexts.length) return
          const roundTranscript: ChatTranscriptTurn[] = [
            ...messages.map((m) => ({ from: m.sender === 'user' ? ('self' as const) : ('other' as const), text: m.content })),
          ]
          const baseTs = Date.now()
          for (let i = 0; i < aiTexts.length; i += 1) {
            const seg = aiTexts[i]!
            const gap = friendRequestGapBeforeBubbleMs(seg.length, i === 0)
            if (gap > 0) {
              await new Promise<void>((resolve) => {
                window.setTimeout(() => resolve(), gap)
              })
            }
            if (!replyingFriendRequestIdsRef.current.has(requestId)) break
            const ts = Date.now()
            await personaDb.appendWeChatChatMessage({
              id: `fr-ai-${baseTs}-${i}-${Math.random().toString(36).slice(2, 7)}`,
              characterId: target.characterId,
              playerIdentityId: sessionPid,
              type: 'character',
              content: seg,
              timestamp: ts,
              isRead: true,
              conversationKey: convKey,
              notifyPeerTitle: ai.nickname || target.nickname,
            })
            emitWeChatStorageChanged()
            await refreshPendingNewFriendRequests()
            roundTranscript.push({ from: 'other', text: seg })
          }
          try {
            const summaryApi = await resolveAutoSummaryApiConfig(apiConfig)
            const memParsed = await requestWeChatMemorySummary({
              apiConfig: summaryApi,
              transcript: roundTranscript,
              peerCharacterId: target.characterId,
            })
            let memText = memParsed.content.trim()
            let frUserBindings: import('./newFriendsPersona/types').WorldBookUserPlaceholderBinding[] | undefined
            if (memText) {
              try {
                const frMemSource = parseWechatAccountPrivateConversationKey(convKey)
                const frUserBindCtx = await resolveMemoryUserInsertContextFromSource(
                  frMemSource?.wechatAccountId,
                  sessionPid,
                )
                const sanitized = await sanitizePrivateMemorySummaryBody(
                  memText,
                  target.characterId,
                  frUserBindCtx,
                )
                memText = sanitized.content.trim().slice(0, 2000)
                frUserBindings = sanitized.userPlaceholderBindings
              } catch {
                /* 保持模型原文 */
              }
            }
            if (memText) {
              const now = Date.now()
              const triggerMode = 'keyword'
              const kwBackup = buildAutoSummaryMemoryKeywordsBackup({
                memoryTriggerCategory: memParsed.memoryTriggerCategory,
                memoryTriggerPrecise: memParsed.memoryTriggerPrecise,
                memoryTriggerEmotionNeed: memParsed.memoryTriggerEmotionNeed,
                memorySupplementKeywords: memParsed.memorySupplementKeywords,
              })
              const frMemSource2 = parseWechatAccountPrivateConversationKey(convKey)
              await personaDb.upsertCharacterMemory({
                id: uid('mem'),
                characterId: target.characterId,
                content: memText.slice(0, 2000),
                createdAt: now,
                updatedAt: now,
                isAutoGenerated: true,
                ...(frUserBindings?.length ? { userPlaceholderBindings: frUserBindings } : {}),
                ...(frMemSource2
                  ? {
                      sourceWechatAccountId: frMemSource2.wechatAccountId,
                      sourceSessionPlayerIdentityId: frMemSource2.sessionPlayerId,
                    }
                  : {}),
                memoryTriggerMode: triggerMode,
                memoryTriggerCategory: memParsed.memoryTriggerCategory,
                memoryTriggerPrecise: memParsed.memoryTriggerPrecise,
                memoryTriggerEmotionNeed: memParsed.memoryTriggerEmotionNeed,
                memoryKeywords: kwBackup?.length ? kwBackup : undefined,
              })
              if (memParsed.timeline) {
                await persistStoryTimelineFromSummaryDelta(
                  target.characterId,
                  memParsed.timeline,
                  'private',
                  {
                    conversationKey: convKey,
                    recordedAtMs: Date.now(),
                  },
                )
              }
            }
          } catch {
            // 记忆写入失败不影响当前聊天回复
          }
          await personaDb.markWeChatConversationReadToLatest(convKey)
          emitWeChatStorageChanged()
          await refreshPendingNewFriendRequests()
        } finally {
          replyingFriendRequestIdsRef.current.delete(requestId)
          setReplyingFriendRequestIds((prev) => prev.filter((id) => id !== requestId))
          if (replyWatchdogTimersRef.current[requestId]) {
            window.clearTimeout(replyWatchdogTimersRef.current[requestId])
            delete replyWatchdogTimersRef.current[requestId]
          }
        }
      })()
    },
    [
      adjudicateFriendRequestAsCharacter,
      apiConfig,
      buildFriendRequestAiReply,
      pendingNewFriendRequests,
      playerIdentityId,
      refreshPendingNewFriendRequests,
    ],
  )

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      data-phone-page="wechat"
      data-app-id="wechat"
      style={{
        ...wechatThemeStyle,
        fontFamily: 'var(--wx-font)',
        fontSize: 'var(--wx-font-size)',
        color: 'var(--wx-text)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
        style={wechatPageBackdropStyle}
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
      <WeChatWelcomeRevealLayer slot="header" className="shrink-0">
      {hideTabChrome || hideWeChatHeader ? null : chatMessengerHeaderVariant ? (
        <WeChatMessengerChatHeader
          variant={chatMessengerHeaderVariant}
          title={chatPeerContact?.remarkName ?? title}
          avatarUrl={chatPeerContact?.avatarUrl}
          fontFamily={chatMessengerFontFamily}
          onBack={() => exitChatToMessages()}
          onOpenSettings={() => setChatSettingsOpen(true)}
          onOpenTimeSettings={
            route.name === 'chat' && wxDockChat?.kind === 'persona'
              ? () => setChatTimeSettingsOpen(true)
              : undefined
          }
          onOpenPsycheRadar={() => setPsycheRadarOpen(true)}
          showPsycheRadar={chatHeaderShowPsycheRadar}
          backBadgeCount={chatBackBadgeUnreadTotal}
          showTyping={chatOtherTyping}
          pendingCount={chatPendingQueueCount}
          typingText={route.name === 'chat' && route.chat.kind === 'group' ? '成员正在输入…' : '对方正在输入…'}
          onCenterClick={() => setChatSettingsOpen(true)}
          customRight={
            chatMultiSelectActive ? (
              <Pressable
                type="button"
                aria-label="取消多选"
                onClick={() => setChatMultiSelectExitSignal((n) => n + 1)}
                className={
                  chatMessengerHeaderVariant === 'imessage'
                    ? 'rounded-[10px] px-2 py-1 text-[15px] active:opacity-60'
                    : 'rounded-[10px] px-2 py-1 text-[15px] text-[#191919] active:opacity-60'
                }
                style={chatMessengerHeaderVariant === 'imessage' ? { color: '#0B93F6' } : undefined}
              >
                取消
              </Pressable>
            ) : undefined
          }
        />
      ) : (
        <Header
          title={route.name === 'chat' && chatPeerContact ? chatPeerContact.remarkName : title}
          titleSub={route.name === 'chat' && chatPeerContact?.tag ? chatPeerContact.tag : undefined}
          showTyping={route.name === 'chat' && chatOtherTyping}
          pendingQueueCount={route.name === 'chat' ? chatPendingQueueCount : 0}
          titleTypingAlternate={
            route.name === 'chat' && chatOpponentRevealPending && !chatOtherTyping && chatPendingQueueCount === 0
          }
          titleCenterAbsolute={route.name === 'chat'}
          typingText={
            route.name === 'chat' && route.chat.kind === 'group' ? '成员正在输入…' : '对方正在输入…'
          }
          onOpenTimeSettings={
            route.name === 'chat' && wxDockChat?.kind === 'persona'
              ? () => setChatTimeSettingsOpen(true)
              : undefined
          }
          showBack={route.name !== 'tabs'}
          showHome={route.name === 'tabs'}
          onBack={() => {
            if (route.name === 'chat') {
              exitChatToMessages()
              return
            }
            if (route.name === 'contact-profile-settings') {
              setRoute({
                name: 'contact-profile',
                target: route.target,
                remarkName: route.remarkName,
                avatarUrl: route.avatarUrl,
                returnTo: route.returnTo,
              })
              return
            }
            if (route.name === 'contact-recommend-select') {
              setRoute({
                name: 'contact-profile-settings',
                target: route.target,
                remarkName: route.remarkName,
                avatarUrl: route.avatarUrl,
                returnTo: route.returnTo,
              })
              return
            }
            if (route.name === 'contact-complaint') {
              setRoute({
                name: 'contact-profile-settings',
                target: route.target,
                remarkName: route.remarkName,
                avatarUrl: route.avatarUrl,
                returnTo: route.returnTo,
              })
              return
            }
            onBack()
          }}
          onHome={onBack}
          rightMode={route.name === 'chat' ? 'chat-room-settings' : 'appearance'}
          showRight={route.name === 'tabs' || route.name === 'chat'}
          onOpenTheme={route.name === 'chat' ? () => setChatSettingsOpen(true) : openWeChatAppearance}
          customRight={
            route.name === 'chat' && chatMultiSelectActive ? (
              <Pressable
                type="button"
                aria-label="取消多选"
                onClick={() => setChatMultiSelectExitSignal((n) => n + 1)}
                className="rounded-[10px] px-2 py-1 text-[15px] text-black active:bg-black/5"
              >
                取消
              </Pressable>
            ) : chatHeaderShowPsycheRadar ? (
              <div className="flex items-center justify-end gap-0.5">
                <Pressable
                  type="button"
                  aria-label="体征与心理监测"
                  onClick={() => setPsycheRadarOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
                >
                  <Activity size={20} strokeWidth={1.75} aria-hidden />
                </Pressable>
                <Pressable
                  type="button"
                  aria-label="当前聊天设置"
                  onClick={() => setChatSettingsOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
                >
                  <MoreHorizontal size={22} strokeWidth={2} aria-hidden />
                </Pressable>
              </div>
            ) : route.name === 'tabs' && route.tab === 'messages' ? (
              <div className="relative flex justify-end">
                <Pressable
                  type="button"
                  aria-label="新建会话"
                  onClick={() => setMessagesPlusMenuOpen((o) => !o)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#111827]"
                >
                  <Plus size={22} strokeWidth={2} aria-hidden />
                </Pressable>
                {messagesPlusMenuOpen ? (
                  <>
                    <Pressable
                      type="button"
                      aria-label="关闭"
                      className="fixed inset-0 z-[198]"
                      onClick={() => setMessagesPlusMenuOpen(false)}
                    >
                      {null}
                    </Pressable>
                    <div className="absolute right-0 top-[calc(100%+6px)] z-[199] min-w-[172px] overflow-hidden rounded-[10px] border border-[#F3F4F6] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                      <Pressable
                        type="button"
                        className="flex w-full px-4 py-3 text-left text-[15px] text-[#111827] active:bg-[#F9FAFB]"
                        onClick={() => {
                          setMessagesPlusMenuOpen(false)
                          setNewGroupFromMessagesOpen(true)
                        }}
                      >
                        发起群聊
                      </Pressable>
                      <Pressable
                        type="button"
                        className="flex w-full px-4 py-3 text-left text-[15px] text-[#111827] active:bg-[#F9FAFB]"
                        onClick={() => {
                          setMessagesPlusMenuOpen(false)
                          setRoute({ name: 'add-friend' })
                        }}
                      >
                        添加朋友
                      </Pressable>
                    </div>
                  </>
                ) : null}
              </div>
            ) : undefined
          }
          showAppearanceGuide={showAppearanceGuide && route.name === 'tabs' && route.tab !== 'messages'}
          onDismissAppearanceGuide={dismissAppearanceGuide}
          titleUnreadCount={
            route.name === 'tabs' && route.tab === 'messages' ? messagesTabUnreadTotal : undefined
          }
          titleTrailing={chatHeaderMuteTrailing}
          titleTrailingInteractive={route.name === 'chat' && chatHeaderBusyOn}
        />
      )}
      </WeChatWelcomeRevealLayer>

      <WeChatWelcomeRevealLayer slot="body" className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <AnimatePresence>
        {busyDetailOpen && chatHeaderBusyOn ? (
          <motion.div
            key="wx-busy-detail-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[260] flex items-center justify-center bg-black/25 px-6"
          >
            <Pressable type="button" className="absolute inset-0" aria-label="关闭忙碌详情" onClick={() => setBusyDetailOpen(false)}>
              {null}
            </Pressable>
            <motion.div
              initial={{ y: 10, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.98 }}
              className="relative z-[1] w-full max-w-[320px] rounded-[14px] bg-white px-4 py-4 text-[#111]"
            >
              <p className="text-[16px] font-semibold">{busyDetailText.headline}</p>
              <div className="mt-3 space-y-1 text-[13px] text-[#666]">
                <p>忙碌时间：{busyDetailText.busyFor}</p>
                <p>忙碌起始：{busyDetailText.start}</p>
                <p>预计结束：{busyDetailText.end}</p>
                <p>剩余时间：{busyDetailText.remain}</p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Pressable
                  type="button"
                  className="rounded-[10px] border border-black/15 bg-white px-3 py-1.5 text-[13px] text-black"
                  onClick={() => {
                    void skipBusyAndTriggerReply()
                  }}
                >
                  跳过忙碌
                </Pressable>
                <Pressable type="button" className="rounded-[10px] bg-black px-3 py-1.5 text-[13px] text-white" onClick={() => setBusyDetailOpen(false)}>
                  知道了
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

        {wxDockChat && activeConversationCharacterId ? (
          <div
            className={
              route.name === 'chat'
                ? 'relative z-0 flex min-h-0 flex-1 flex-col'
                : 'pointer-events-none absolute inset-0 z-0 flex min-h-0 overflow-hidden opacity-0'
            }
            aria-hidden={route.name !== 'chat'}
          >
            {playerIdentityId === null ? (
              route.name === 'chat' ? (
                <motion.div
                  className="flex flex-1 items-center justify-center px-4 text-[14px]"
                  style={{ color: 'var(--wx-text-muted)' }}
                >
                  正在加载…
                </motion.div>
              ) : null
            ) : (
              <ChatRoom
                onBack={exitChatToMessages}
                onOtherTypingChange={setChatOtherTypingDeduped}
                onPendingQueueCountChange={setChatPendingQueueCountDeduped}
                onOpponentRevealQueueActive={setChatOpponentRevealPendingDeduped}
                skipBusySignal={chatSkipBusySignal}
                historyRefreshSignal={chatHistoryRefreshSignal}
                personaCharacterId={chatRoomPersonaCharacterId ?? undefined}
                playerDisplayName={state.profile.displayName}
                playerAvatarUrl={state.profile.avatarImageUrl}
                peerAvatarUrl={chatPeerContact?.avatarUrl}
                peerNotifyTitle={chatPeerContact?.remarkName ?? '聊天'}
                chatBackgroundUrl={chatSessionPrefs?.bg || undefined}
                chatRoomDefaultBg={wechatTheme.chatRoomDefaultBg}
                danmakuEnabled={chatSessionPrefs?.danmaku ?? false}
                thinkingChainEnabled={chatSessionPrefs?.thinkingChain ?? false}
                forwardHistoryCardEnabled={chatSessionPrefs?.forwardHistoryCard ?? false}
                pulseDmScreenshotEnabled={chatSessionPrefs?.pulseDmScreenshot ?? false}
                profileImageChangeEnabled={chatSessionPrefs?.profileImageChange ?? false}
                internetMemeLexiconEnabled={chatSessionPrefs?.internetMemeLexicon ?? false}
                showGroupMemberNicknameInChat={chatSessionPrefs?.showGroupMemberNicknameInChat !== false}
                showGroupRankBadgesInChat={!!chatSessionPrefs?.showGroupRankBadgesInChat}
                useLumiProjectAssistantPrompt={wxDockChat.kind === 'lumi'}
                roomType={wxDockChat.kind === 'group' ? 'group' : 'private'}
                groupId={wxDockChat.kind === 'group' ? wxDockChat.groupId : null}
                conversationCharacterId={activeConversationCharacterId ?? ''}
                playerIdentityId={chatRouteIdentityId ?? playerIdentityId ?? '__none__'}
                promptPlayerIdentityId={chatRouteIdentityId ?? playerIdentityId}
                scrollToMessageId={pendingScrollToMessageId}
                onScrollToMessageConsumed={clearPendingScrollToMessage}
                onRequestForwardMessage={(msg) => {
                  if (!activeChatForRoute) return
                  setRoute({
                    name: 'forward-select-chat',
                    fromChat: activeChatForRoute,
                    payload: { mode: 'single', messageIds: [msg.id] },
                  })
                }}
                onRequestForwardMessages={(payload) => {
                  if (!activeChatForRoute) return
                  const peerCharacterId =
                    activeChatForRoute.kind === 'persona' ? activeChatForRoute.characterId : undefined
                  setRoute({
                    name: 'forward-select-chat',
                    fromChat: activeChatForRoute,
                    payload: {
                      mode: payload.mode,
                      messageIds: payload.messageIds,
                      mergeTitle: payload.mergeTitle
                        ? { ...payload.mergeTitle, peerCharacterId }
                        : undefined,
                    },
                  })
                }}
                onMultiSelectModeChange={setChatMultiSelectActive}
                multiSelectExitSignal={chatMultiSelectExitSignal}
                onOpenChatHistoryViewer={(payload) => {
                  setChatHistoryViewerData(payload.data)
                  setChatHistoryViewerAvatars(payload.participantAvatars)
                  setChatHistoryViewerAvatarRadiusPx(payload.avatarRadiusPx ?? 8)
                  setChatHistoryViewerRecipientId(payload.recipientCharacterId)
                  setChatHistoryViewerUserDisplayName(payload.userDisplayName?.trim() || '我')
                  setChatHistoryViewerPersonaContacts([...(payload.personaContacts ?? [])])
                  setChatHistoryViewerCardSenderCharacterId(payload.cardSenderCharacterId)
                  setChatHistoryViewerOpen(true)
                }}
                onOpenSendRedPacket={() => {
                  if (!activeChatForRoute || playerIdentityId === null) return
                  setRoute({ name: 'red-packet-send', chat: activeChatForRoute })
                }}
                onNavigateRedPacketDetail={(detail) => {
                  const chat = activeChatForRoute ?? wxDockChatRef.current
                  if (!chat) return
                  setRoute({ name: 'red-packet-detail', chat, detail })
                }}
                onOpenLumiTransfer={() => {
                  if (!activeChatForRoute) return
                  setRoute({ name: 'lumi-transfer', chat: activeChatForRoute })
                }}
                onOpenAffectionPay={() => {
                  if (!activeChatForRoute || playerIdentityId === null) return
                  setRoute({ name: 'affection-pay', chat: activeChatForRoute })
                }}
                onNavigateTransferDetail={(transferId) => {
                  if (!activeChatForRoute) return
                  setRoute({ name: 'transfer-detail', chat: activeChatForRoute, transferId })
                }}
                psycheRadarOpen={psycheRadarOpen}
                onPsycheRadarOpenChange={setPsycheRadarOpen}
                onCheckPhoneOpenChange={setChatCheckPhoneOpen}
                onMiniGameOverlayOpenChange={setChatMiniGameOverlayOpen}
                onVoiceCallOverlayOpenChange={setChatVoiceCallOverlayOpen}
                chatRouteVisible={route.name === 'chat'}
              />
            )}
          </div>
        ) : null}
        <div
          className={
            route.name === 'chat'
              ? 'pointer-events-none absolute inset-0 z-[1] flex min-h-0 opacity-0'
              : 'relative z-[1] flex min-h-0 flex-1 flex-col'
          }
          aria-hidden={route.name === 'chat'}
          key={accountSwitchRevision}
        >
        <AnimatePresence mode="wait" initial={false}>
          {route.name === 'tabs' ? (
            <motion.div key={`tab-${route.tab}`} className="flex h-full min-h-0 flex-col" {...pageProps}>
              {route.tab === 'messages' ? (
                <div className="min-h-0 flex-1">
                  <MessagesTab
                    threads={messageThreads}
                    pinnedExpanded={messagesPinnedExpanded}
                    onPinnedExpandedChange={setMessagesPinnedExpanded}
                    isConversationMuted={isConversationMuted}
                    onOpenChat={(chat) => setRoute({ name: 'chat', chat })}
                    playerIdentityId={playerIdentityId}
                    onListDataMutated={() => void refreshMessageThreadsMeta()}
                    onThreadHidden={hideMessageThreadFromList}
                  />
                </div>
              ) : route.tab === 'contacts' ? (
                <div className="min-h-0 flex-1">
                  <WeChatContactsInstagram
                    contacts={weChatMergedContacts}
                    newFriendsBadgeCount={newFriendsUnreadCount}
                    onEntryClick={(id) => {
                      if (id === 'new-friend') {
                        markNewFriendRequestsRead()
                        setRoute({ name: 'new-friends-persona', source: 'contacts' })
                        return
                      }
                      if (id === 'group-chats') {
                        setRoute({ name: 'contacts-group-chats' })
                      }
                    }}
                    onContactClick={(contactId) => {
                      if (contactId === 'wechat-lumi-assistant') {
                        setRoute({
                          name: 'contact-profile',
                          target: { kind: 'lumi' },
                          remarkName: WECHAT_LUMI_ASSISTANT_CONTACT.remarkName,
                          avatarUrl: WECHAT_LUMI_ASSISTANT_CONTACT.avatarUrl,
                          returnTo: { mode: 'tabs-contacts' },
                        })
                        return
                      }
                      if (contactId === WECHAT_SELF_PEER_CHARACTER_ID) {
                        setRoute({
                          name: 'contact-profile',
                          target: { kind: 'self' },
                          remarkName: weChatSelfAccountContact.remarkName,
                          avatarUrl: weChatSelfAccountContact.avatarUrl,
                          returnTo: { mode: 'tabs-contacts' },
                        })
                        return
                      }
                      const pc = state.wechatPersonaContacts.find((c) => c.id === contactId)
                      if (pc) {
                        setRoute({
                          name: 'contact-profile',
                          target: { kind: 'persona', characterId: pc.characterId },
                          remarkName: pc.remarkName,
                          avatarUrl: pc.avatarUrl,
                          returnTo: { mode: 'tabs-contacts' },
                        })
                      }
                    }}
                  />
                </div>
              ) : route.tab === 'dates' ? (
                <div className="min-h-0 flex-1">
                  <DatingSystem
                    onVnChromeChange={setHideDatingChrome}
                    onOpenPersonaManager={() => setRoute({ name: 'new-friends-persona', source: 'dating' })}
                  />
                </div>
              ) : route.tab === 'discover' ? (
                <div className="min-h-0 flex-1">
                  <WeChatDiscoverInstagram
                    onImmersiveViewChange={setDiscoverMomentsOpen}
                    restoreView={discoverRestoreView}
                    onRestoreViewConsumed={() => setDiscoverRestoreView(null)}
                    onOpenParticipantProfile={openContactProfileFromMomentsFeed}
                    wechatNickname={wechatAccountProfile?.nickname ?? state.profile.displayName}
                    wechatAvatarUrl={
                      wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl
                    }
                    momentsCoverUrl={currentAccountMomentsCoverUrl}
                    onMomentsCoverChange={updateMomentsCoverUrl}
                    currentUserName={state.profile.displayName || '我'}
                    qnaContacts={anonymousQnaContacts}
                    qnaWechatCtx={anonymousQnaWechatCtx}
                    personaContacts={state.wechatPersonaContacts}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1">
                  <WeChatMeInstagramProfile
                    nickname={wechatAccountProfile?.nickname ?? state.profile.displayName}
                    signature={wechatAccountProfile?.signature ?? state.profile.signature}
                    avatarUrl={
                      (wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl) || undefined
                    }
                    onOpenProfileCard={() => setProfileEditOpen(true)}
                    onOpenMemoryTrace={() => setMemoryTraceOpen(true)}
                    onMenuItemClick={(id) => {
                      if (id === 'settings') setWxGlobalNav({ screen: 'root' })
                      if (id === 'identity') setRoute({ name: 'player-identities' })
                      if (id === 'card') setRoute({ name: 'wallet-cards' })
                      if (id === 'memory') setRoute({ name: 'memory-manage' })
                      if (id === 'favorites') setRoute({ name: 'favorites' })
                      if (id === 'album') setRoute({ name: 'album' })
                      if (id === 'persona') setRoute({ name: 'new-friends-persona', source: 'profile' })
                      if (id === 'emoji') setRoute({ name: 'sticker-center' })
                    }}
                  />
                </div>
              )}
            </motion.div>
          ) : route.name === 'chat' ? (
            <motion.div
              key="wx-chat-route-placeholder"
              initial={false}
              className="pointer-events-none h-0 min-h-0 w-0 shrink-0 overflow-hidden opacity-0"
              aria-hidden
            />
          ) : route.name === 'affection-pay' ? (
            <motion.div key="affection-pay" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              {playerIdentityId === null ||
              (route.chat.kind === 'persona' && chatRouteIdentityId === null) ? (
                <div className="flex flex-1 items-center justify-center px-4 text-[14px]" style={{ color: 'var(--wx-text-muted)' }}>
                  正在加载…
                </div>
              ) : (
                <AffectionPayPage
                  peerName={chatPeerContact?.remarkName ?? '对方'}
                  peerAvatarUrl={chatPeerContact?.avatarUrl}
                  onBack={() => setRoute({ name: 'chat', chat: route.chat })}
                  onPaid={async ({ amountYuan, giverName, title }) => {
                    const cid = wxWalletPeerCharacterId(route.chat)
                    const sessionPid =
                      route.chat.kind === 'persona' ? chatRouteIdentityId! : playerIdentityId!
                    const ts = getCurrentTimeMs()
                    const msgId = `wx-aff-${ts}-${Math.random().toString(36).slice(2, 7)}`
                    const conversationKey = await resolveWalletChatMessageStorageKey({
                      wechatAccountId: currentAccountId,
                      groupId: route.chat.kind === 'group' ? route.chat.groupId : null,
                      peerCharacterId: cid,
                      appSessionPlayerIdentityId: sessionPid,
                    })
                    await personaDb.appendWeChatChatMessage({
                      id: msgId,
                      characterId: cid,
                      playerIdentityId: sessionPid,
                      type: 'player',
                      content: `${title}（由亲情卡支付 · ${giverName}） -${amountYuan.toFixed(2)}`,
                      timestamp: ts,
                      isRead: true,
                      conversationKey,
                    })
                    emitWeChatStorageChanged()
                  }}
                />
              )}
            </motion.div>
          ) : route.name === 'red-packet-send' ? (
            <motion.div key="red-packet-send" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              {playerIdentityId === null ||
              (route.chat.kind === 'persona' && chatRouteIdentityId === null) ? (
                <div
                  className="flex flex-1 items-center justify-center px-4 text-[14px]"
                  style={{ color: 'var(--wx-text-muted)' }}
                >
                  正在加载…
                </div>
              ) : (
                <RedPacketPage
                  chat={wxChatTargetForRedPacket(route.chat)}
                  peerRemarkName={redPacketPeer?.remarkName ?? '聊天'}
                  peerAvatarUrl={redPacketPeer?.avatarUrl}
                  onBack={() => setRoute({ name: 'chat', chat: route.chat })}
                  onPaidSend={async (payload) => {
                    const cid = wxWalletPeerCharacterId(route.chat)
                    const sessionPid =
                      route.chat.kind === 'persona' ? chatRouteIdentityId! : playerIdentityId!
                    const ts = getCurrentTimeMs()
                    const peerName = redPacketPeer?.remarkName?.trim() || '对方'
                    const remark = payload.remark.trim() || 'Best Wishes'
                    const ok = walletSpend(payload.amountYuan, `发红包给${peerName} · ${remark}`)
                    if (!ok) throw new Error('余额不足，支付失败')
                    const conversationKey = await resolveWalletChatMessageStorageKey({
                      wechatAccountId: currentAccountId,
                      groupId: route.chat.kind === 'group' ? route.chat.groupId : null,
                      peerCharacterId: cid,
                      appSessionPlayerIdentityId: sessionPid,
                    })
                    await personaDb.appendWeChatChatMessage({
                      id: payload.packetId,
                      characterId: cid,
                      playerIdentityId: sessionPid,
                      type: 'player',
                      content: `[红包] ${payload.remark}`,
                      timestamp: ts,
                      isRead: true,
                      conversationKey,
                      redPacket: {
                        packetId: payload.packetId,
                        amountYuan: payload.amountYuan,
                        remark: payload.remark,
                        opened: false,
                      },
                    })
                    setRoute({ name: 'chat', chat: route.chat })
                  }}
                />
              )}
            </motion.div>
          ) : route.name === 'lumi-transfer' ? (
            <motion.div key="lumi-transfer" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              {playerIdentityId === null ||
              (route.chat.kind === 'persona' && chatRouteIdentityId === null) ? (
                <div
                  className="flex flex-1 items-center justify-center px-4 text-[14px]"
                  style={{ color: 'var(--wx-text-muted)' }}
                >
                  正在加载…
                </div>
              ) : (
                <TransferPage
                  peerCharacterId={wxWalletPeerCharacterId(route.chat)}
                  peerRemarkName={lumiTransferPeer?.remarkName ?? 'Lumi'}
                  peerAvatarUrl={lumiTransferPeer?.avatarUrl}
                  onBack={() => setRoute({ name: 'chat', chat: route.chat })}
                  onPaidTransfer={async (payload) => {
                    const cid = wxWalletPeerCharacterId(route.chat)
                    const sessionPid =
                      route.chat.kind === 'persona' ? chatRouteIdentityId! : playerIdentityId!
                    const ts = getCurrentTimeMs()
                    const expiresAt = ts + 24 * 60 * 60 * 1000
                    const convKey = await resolveWalletChatMessageStorageKey({
                      wechatAccountId: currentAccountId,
                      groupId: route.chat.kind === 'group' ? route.chat.groupId : null,
                      peerCharacterId: cid,
                      appSessionPlayerIdentityId: sessionPid,
                    })
                    const peerName = lumiTransferPeer?.remarkName?.trim() || '对方'
                    const remark = payload.remark.trim()
                    const ok = walletSpend(payload.amountYuan, remark ? `转账给${peerName} · ${remark}` : `转账给${peerName}`)
                    if (!ok) throw new Error('余额不足，支付失败')
                    upsertLumiTransfer({
                      id: payload.transferId,
                      amount: payload.amountYuan,
                      remark: payload.remark,
                      senderId: sessionPid,
                      receiverId: cid,
                      status: 'pending',
                      createdAt: ts,
                      expiresAt,
                      conversationKey: convKey,
                      messageId: payload.transferId,
                    })
                    await personaDb.appendWeChatChatMessage({
                      id: payload.transferId,
                      characterId: cid,
                      playerIdentityId: sessionPid,
                      type: 'player',
                      content: payload.remark?.trim() ? `[转账] ${payload.remark.trim()}` : '[转账]',
                      timestamp: ts,
                      isRead: true,
                      conversationKey: convKey,
                      transfer: { transferId: payload.transferId },
                    })
                    emitWeChatStorageChanged()
                    setRoute({ name: 'chat', chat: route.chat })
                  }}
                />
              )}
            </motion.div>
          ) : route.name === 'transfer-detail' ? (
            <motion.div key="transfer-detail" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              {playerIdentityId === null || chatRouteIdentityId === null ? (
                <div
                  className="flex flex-1 items-center justify-center px-4 text-[14px]"
                  style={{ color: 'var(--wx-text-muted)' }}
                >
                  正在加载…
                </div>
              ) : (
                <TransferDetailPage
                  transferId={route.transferId}
                  playerIdentityId={chatRouteIdentityId}
                  getCurrentTime={getCurrentTimeMs}
                  peerName={(chatPeerContact?.remarkName ?? '').trim() || (route.chat.kind === 'lumi' ? 'Lumi' : '对方')}
                  onBack={() => setRoute({ name: 'chat', chat: route.chat })}
                />
              )}
            </motion.div>
          ) : route.name === 'red-packet-detail' ? (
            <motion.div key="red-packet-detail" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              <RedPacketDetailPage
                amountYuan={route.detail.amountYuan}
                remark={route.detail.remark}
                senderName={route.detail.senderName}
                senderAvatarUrl={route.detail.senderAvatarUrl}
                chatPeerName={route.detail.chatPeerName}
                claimerName={route.detail.claimerName}
                fromSelf={route.detail.fromSelf}
                opened={route.detail.opened}
                onBack={() => setRoute({ name: 'chat', chat: route.chat })}
                onOpenHistory={() =>
                  setRoute({
                    name: 'red-packet-history',
                    chat: route.chat,
                    detailSnapshot: route.detail,
                  })
                }
              />
            </motion.div>
          ) : route.name === 'red-packet-history' ? (
            <motion.div key="red-packet-history" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              <RedPacketHistoryPage
                playerIdentityId={playerIdentityId ?? ''}
                resolvePeer={resolveRedPacketPeer}
                onBack={() => {
                  if (route.detailSnapshot) {
                    setRoute({
                      name: 'red-packet-detail',
                      chat: route.chat,
                      detail: route.detailSnapshot,
                    })
                  } else {
                    setRoute({ name: 'chat', chat: route.chat })
                  }
                }}
              />
            </motion.div>
          ) : route.name === 'add-friend' ||
            route.name === 'add-friend-stranger' ||
            route.name === 'add-friend-request-form' ? (
            <motion.div
              key={
                route.name === 'add-friend'
                  ? 'add-friend'
                  : route.name === 'add-friend-stranger'
                    ? `add-friend-stranger-${route.characterId}`
                    : `add-friend-request-${route.characterId}`
              }
              className="flex h-full min-h-0 flex-1 flex-col bg-white"
              {...(disableTransitions
                ? { initial: false, animate: { x: 0 }, exit: { x: 0 }, transition: { duration: 0 } }
                : {
                    initial: { x: '100%' },
                    animate: { x: 0 },
                    exit: { x: '100%' },
                    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
                  })}
            >
              {route.name === 'add-friend' ? (
                <AddFriendPage
                  onBack={() => setRoute({ name: 'tabs', tab: 'messages' })}
                  onPickCharacter={(characterId) => setRoute({ name: 'add-friend-stranger', characterId })}
                />
              ) : route.name === 'add-friend-stranger' ? (
                <StrangerProfilePage
                  characterId={route.characterId}
                  onBack={() => setRoute({ name: 'add-friend' })}
                  onRequestAdd={() =>
                    setRoute({ name: 'add-friend-request-form', characterId: route.characterId })
                  }
                />
              ) : (
                <FriendRequestForm
                  characterId={route.characterId}
                  playerIdentityId={playerIdentityId}
                  playerDisplayName={state.profile.displayName?.trim() || '我'}
                  onBack={() => setRoute({ name: 'add-friend-stranger', characterId: route.characterId })}
                  onSent={(requestId) => {
                    setPendingOpenFriendRequestId(requestId)
                    void refreshPendingNewFriendRequests().then(() => {
                      setRoute({ name: 'new-friends-persona', source: 'contacts' })
                    })
                    /** 后台异步裁决，不阻塞切页与其它操作 */
                    void adjudicateFriendRequestAsCharacter(requestId).then(() =>
                      refreshPendingNewFriendRequests(),
                    )
                  }}
                />
              )}
            </motion.div>
          ) : route.name === 'contact-profile' ? (
            <div key="contact-profile" className="flex h-full min-h-0 flex-1 flex-col">
              <ContactProfileCardScreen
                target={route.target}
                remarkName={route.remarkName}
                avatarUrl={route.avatarUrl}
                accountId={currentAccountId}
                momentContacts={momentContactsForNotices}
                selfAccountProfile={
                  route.target.kind === 'self' ? wechatAccountProfile : undefined
                }
                onBack={() => {
                  if (route.returnTo.mode === 'tabs-contacts') {
                    setRoute({ name: 'tabs', tab: 'contacts' })
                    return
                  }
                  if (route.returnTo.mode === 'moments-feed') {
                    setDiscoverRestoreView('moments')
                    setRoute({ name: 'tabs', tab: 'discover' })
                    return
                  }
                  if (route.returnTo.mode === 'user-moments-archive') {
                    setRoute({
                      name: 'user-moments-archive',
                      userId: route.returnTo.userId,
                      returnTo: route.returnTo.returnTo,
                    })
                    return
                  }
                  setRoute({ name: 'chat', chat: route.returnTo.chat })
                  if (route.returnTo.reopenChatSettings) setChatSettingsOpen(true)
                }}
                onOpenChat={() => {
                  const t = route.target
                  setRoute({
                    name: 'chat',
                    chat:
                      t.kind === 'lumi'
                        ? { kind: 'lumi' }
                        : t.kind === 'self'
                          ? { kind: 'self' }
                          : { kind: 'persona', characterId: t.characterId },
                  })
                }}
                onOpenProfileSettings={() => {
                  if (route.target.kind === 'lumi') {
                    window.alert('设置与备注开发中')
                    return
                  }
                  if (route.target.kind === 'self') {
                    setProfileEditOpen(true)
                    return
                  }
                  setRoute({
                    name: 'contact-profile-settings',
                    target: route.target,
                    remarkName: route.remarkName,
                    avatarUrl: route.avatarUrl,
                    returnTo: route.returnTo,
                  })
                }}
                onOpenContactSettings={(characterId) => {
                  const ret = route.returnTo.mode === 'chat' ? route.returnTo.chat : undefined
                  setRoute({
                    name: 'new-friends-persona',
                    editCharacterId: characterId,
                    returnToChat: ret,
                    source: 'contacts',
                  })
                }}
                onOpenMoments={() => {
                  if (route.target.kind === 'self') {
                    setRoute({
                      name: 'user-moments-archive',
                      userId: 'self',
                      returnTo: {
                        mode: 'contact-profile',
                        target: route.target,
                        remarkName: route.remarkName,
                        avatarUrl: route.avatarUrl,
                        returnTo: route.returnTo,
                      },
                    })
                    return
                  }
                  if (route.target.kind !== 'persona') return
                  setRoute({
                    name: 'user-moments-archive',
                    userId: route.target.characterId,
                    returnTo: {
                      mode: 'contact-profile',
                      target: route.target,
                      remarkName: route.remarkName,
                      avatarUrl: route.avatarUrl,
                      returnTo: route.returnTo,
                    },
                  })
                }}
              />
            </div>
          ) : route.name === 'user-moments-archive' ? (
            <motion.div
              key="user-moments-archive"
              className="flex h-full min-h-0 flex-1 flex-col"
              {...pageProps}
            >
              <UserMomentsArchive
                userId={route.userId}
                accountId={currentAccountId}
                qnaWechatCtx={anonymousQnaWechatCtx}
                coverNickname={
                  route.returnTo.mode === 'contact-profile'
                    ? route.returnTo.remarkName
                    : momentsDisplayName
                }
                selfProfile={{
                  displayName: momentsDisplayName,
                  signature:
                    wechatAccountProfile?.signature?.trim() || state.profile.signature?.trim(),
                  avatarUrl:
                    wechatAccountProfile?.avatarUrl ?? state.profile.avatarImageUrl ?? undefined,
                  coverUrl: currentAccountMomentsCoverUrl,
                }}
                momentContacts={momentContactsForNotices}
                onOpenParticipantProfile={openContactProfileFromUserMomentsArchive}
                onBack={() => {
                  if (route.returnTo.mode === 'tabs-profile') {
                    setRoute({ name: 'tabs', tab: 'profile' })
                    return
                  }
                  setRoute({
                    name: 'contact-profile',
                    target: route.returnTo.target,
                    remarkName: route.returnTo.remarkName,
                    avatarUrl: route.returnTo.avatarUrl,
                    returnTo: route.returnTo.returnTo,
                  })
                }}
              />
            </motion.div>
          ) : route.name === 'forward-select-chat' ? (
            <motion.div key="forward-select-chat" className="flex min-h-0 flex-1 flex-col" {...pageProps}>
              {/* 进入转发页时，底层聊天保持不渲染（微信同款：新页面承载） */}
              <div className="flex flex-1 items-center justify-center text-[14px]" style={{ color: 'var(--wx-text-muted)' }}>
                正在加载…
              </div>
            </motion.div>
          ) : route.name === 'memory-manage' ? (
            <motion.div key="memory-manage" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <MemoryManagementApp
                contacts={memoryManageContacts ?? []}
                playerIdentityId={playerIdentityId}
                playerDisplayName={state.profile.displayName || '我'}
                currentWechatAccountId={currentAccountId ?? undefined}
                apiConfig={apiConfig}
                onBack={() => setRoute({ name: 'tabs', tab: 'profile' })}
              />
            </motion.div>
          ) : route.name === 'favorites' ? (
            <motion.div key="favorites" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WeChatFavoritesPage
                contacts={memoryManageContacts ?? []}
                onBack={() => setRoute({ name: 'tabs', tab: 'profile' })}
                onOpenChat={openPersonaChatByCharacterId}
              />
            </motion.div>
          ) : route.name === 'album' ? (
            <motion.div key="album" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <MemoryAlbumApp
                contacts={memoryManageContacts ?? []}
                currentAccountId={currentAccountId ?? undefined}
                onBack={() => setRoute({ name: 'tabs', tab: 'profile' })}
              />
            </motion.div>
          ) : route.name === 'player-identities' ? (
            <motion.div key="player-identities" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <PlayerIdentityApp
                onBack={() => setRoute({ name: 'tabs', tab: 'profile' })}
                onOpenCharacter={(characterId) => {
                  void characterId
                  setRoute({ name: 'new-friends-persona', source: 'profile' })
                }}
              />
            </motion.div>
          ) : route.name === 'switch-account' ? (
            <motion.div key="switch-account" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <SwitchAccountPage
                onBack={() => setRoute({ name: 'tabs', tab: 'profile' })}
                onAddAccount={() => setRoute({ name: 'switch-account-register' })}
                onSwitched={() => {
                  setRoute({ name: 'tabs', tab: 'messages' })
                  void refreshMessageThreadsMeta()
                }}
              />
            </motion.div>
          ) : route.name === 'switch-account-register' ? (
            <motion.div key="switch-account-register" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WeChatRegistration
                mode="add-account"
                onBack={() => setRoute({ name: 'switch-account' })}
                onAccountAdded={() => setRoute({ name: 'switch-account' })}
              />
            </motion.div>
          ) : route.name === 'wallet-cards' ? (
            <motion.div key="wallet-cards" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WalletCardsPage
                onBack={() => setRoute({ name: 'tabs', tab: 'profile' })}
                onOpenTransactions={() => setRoute({ name: 'wallet-transactions' })}
                onOpenAffectionCards={() => setRoute({ name: 'wallet-affection-cards' })}
                onOpenBankCards={() => setRoute({ name: 'wallet-bank-cards' })}
                onOpenWealth={() => setRoute({ name: 'wallet-wealth' })}
              />
            </motion.div>
          ) : route.name === 'wallet-transactions' ? (
            <motion.div key="wallet-transactions" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WalletTransactionsPage onBack={() => setRoute({ name: 'wallet-cards' })} />
            </motion.div>
          ) : route.name === 'wallet-affection-cards' ? (
            <motion.div key="wallet-affection-cards" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WalletAffectionCardsPage
                onBack={() => setRoute({ name: 'wallet-cards' })}
                onOpenCardTransactions={({ cardId, giverName }) =>
                  setRoute({ name: 'wallet-affection-transactions', cardId, giverName })
                }
              />
            </motion.div>
          ) : route.name === 'wallet-affection-transactions' ? (
            <motion.div key="wallet-affection-transactions" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WalletAffectionTransactionsPage
                cardId={route.cardId}
                giverName={route.giverName}
                onBack={() => setRoute({ name: 'wallet-affection-cards' })}
              />
            </motion.div>
          ) : route.name === 'wallet-bank-cards' ? (
            <motion.div key="wallet-bank-cards" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WalletBankCardsPage onBack={() => setRoute({ name: 'wallet-cards' })} />
            </motion.div>
          ) : route.name === 'wallet-wealth' ? (
            <motion.div key="wallet-wealth" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <WealthDashboardPage onBack={() => setRoute({ name: 'wallet-cards' })} />
            </motion.div>
          ) : route.name === 'sticker-center' ? (
            <motion.div key="sticker-center" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <StickerCenterPage onBack={() => setRoute({ name: 'tabs', tab: 'profile' })} />
            </motion.div>
          ) : route.name === 'contacts-group-chats' ? (
            <motion.div key="contacts-group-chats" className="flex h-full min-h-0 flex-col" {...pageProps}>
              <ContactsGroupChatsScreen
                playerIdentityId={playerIdentityId}
                onBack={() => setRoute({ name: 'tabs', tab: 'contacts' })}
                onOpenGroup={(groupId) => setRoute({ name: 'chat', chat: { kind: 'group', groupId } })}
                onRequestCreateGroup={() => {
                  const pid = playerIdentityId?.trim()
                  if (!pid || pid === '__none__') {
                    window.alert('请先完成身份选择后再创建群聊。')
                    return
                  }
                  setNewGroupFromMessagesOpen(true)
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`new-friends-persona-${route.name === 'new-friends-persona' ? route.editCharacterId ?? 'list' : 'x'}`}
              className="flex h-full min-h-0 flex-col"
              {...pageProps}
            >
              <NewFriendsPersonaApp
                initialEditCharacterId={route.name === 'new-friends-persona' ? route.editCharacterId : undefined}
                initialActiveRequestId={
                  route.name === 'new-friends-persona' ? (pendingOpenFriendRequestId ?? undefined) : undefined
                }
                onInitialActiveRequestConsumed={() => setPendingOpenFriendRequestId(null)}
                pendingRequests={pendingNewFriendRequests}
                onMarkRequestsRead={markNewFriendRequestsRead}
                onResolveRequest={resolveNewFriendRequest}
                onReplyRequest={sendNewFriendRequestMessage}
                onTriggerReplyRequest={triggerNewFriendRequestReply}
                onRetryAdjudication={(requestId) =>
                  void adjudicateFriendRequestAsCharacter(requestId, { force: true })
                }
                replyingRequestIds={replyingFriendRequestIds}
                onSendTempChat={sendFriendRequestTempChatMessage}
                tempChatReplyingIds={tempChatReplyingIds}
                entrySource={route.name === 'new-friends-persona' ? route.source : undefined}
                onBack={() => {
                  if (route.name === 'new-friends-persona' && route.returnToChat) {
                    setRoute({ name: 'chat', chat: route.returnToChat })
                    return
                  }
                  if (route.name === 'new-friends-persona' && route.source === 'dating') {
                    setRoute({ name: 'tabs', tab: 'dates' })
                    return
                  }
                  if (route.name === 'new-friends-persona' && route.source === 'profile') {
                    setRoute({ name: 'tabs', tab: 'profile' })
                    return
                  }
                  setRoute({ name: 'tabs', tab: 'contacts' })
                }}
                onOpenIdentityManager={() => setRoute({ name: 'player-identities' })}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        <AnimatePresence>
          {route.name === 'forward-select-chat' && playerIdentityId && forwardPendingMessages?.length ? (
            <motion.div
              key="wx-forward-select"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-[320] flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[#f5f5f5]"
            >
              <WeChatForwardSelectChatScreen
                open
                forward={{
                  mode: forwardPendingMode,
                  messages: forwardPendingMessages,
                  mergeTitle: forwardPendingMergeTitle ?? undefined,
                }}
                threads={messageThreads as any}
                contacts={state.wechatPersonaContacts as any}
                playerIdentityId={playerIdentityId}
                currentConversationKey={activeConversationKey}
                lumiAvatarUrl={lumiWechatAvatarUrl}
                onClose={() => setRoute({ name: 'chat', chat: route.fromChat })}
                onPickChat={(chat) => setRoute({ name: 'chat', chat })}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {route.name === 'contact-profile-settings' ? (
            <motion.div
              key="wx-contact-profile-settings"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-[320] flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[#f5f5f5]"
            >
              {route.target.kind === 'persona' ? (
                <ContactProfileSettingsScreen
                  characterId={route.target.characterId}
                  onOpenRecommend={() =>
                    setRoute({
                      name: 'contact-recommend-select',
                      target: { kind: 'persona', characterId: (route.target as { kind: 'persona'; characterId: string }).characterId },
                      remarkName: route.remarkName,
                      avatarUrl: route.avatarUrl,
                      returnTo: route.returnTo,
                    })
                  }
                  onOpenComplaint={() =>
                    setRoute({
                      name: 'contact-complaint',
                      target: { kind: 'persona', characterId: (route.target as { kind: 'persona'; characterId: string }).characterId },
                      remarkName: route.remarkName,
                      avatarUrl: route.avatarUrl,
                      returnTo: route.returnTo,
                    })
                  }
                  onBlockedAndBack={() =>
                    setRoute({
                      name: 'contact-profile',
                      target: route.target,
                      remarkName: route.remarkName,
                      avatarUrl: route.avatarUrl,
                      returnTo: route.returnTo,
                    })
                  }
                  onDeleteContact={async (notifyPeer, chatHistoryMode) => {
                    if (route.target.kind !== 'persona') return
                    const characterId = route.target.characterId
                    const appPid = playerIdentityId?.trim() || ''
                    const remarkNameSeed = route.remarkName?.trim() || '对方'
                    const avatarUrlSeed = route.avatarUrl || ''
                    /** 先于一切 await：否则任一步抛错或耗时过长都会一直停在资料设置/删除向导 */
                    setRoute({ name: 'tabs', tab: 'contacts' })
                    try {
                      const sessionPid = appPid || '__none__'
                      const convKey = await resolveAccountScopedPrivateConversationKey({
                        wechatAccountId: currentAccountId,
                        characterId,
                        appSessionPlayerIdentityId: sessionPid,
                      })

                      removeWeChatPersonaContactsByCharacterIds([characterId])

                      const { preservedOnOtherAccounts } = await applyWechatContactRemovalDataClear({
                        characterId,
                        wechatAccountId: currentAccountId?.trim() || '',
                        playerIdentityId: sessionPid,
                        notifyPeer,
                        chatHistoryMode,
                        conversationKey: convKey,
                      })
                      if (!preservedOnOtherAccounts) {
                        pruneCharacterVoiceMappings([characterId])
                      }

                      if (!notifyPeer) {
                        await incrementContactDeletionCount(characterId, sessionPid)
                      } else {
                        let nick = remarkNameSeed
                        let avatar = avatarUrlSeed
                        let firstMessage = ''
                        try {
                          const ch = await personaDb.getCharacter(characterId)
                          if (ch) {
                            nick = ch.remark?.trim() || ch.wechatNickname?.trim() || ch.name || nick
                            avatar = ch.avatarUrl?.trim() || avatar
                          }
                          const deletionCount = await incrementContactDeletionCount(characterId, sessionPid)
                          const seedUserContent =
                            deletionCount <= 1
                              ? '我把你从通讯录删除了。'
                              : `我把你从通讯录删除了。（这是我第${deletionCount}次删你了）`
                          const ai = await buildFriendRequestAiReply({
                            characterId,
                            messages: [
                              {
                                id: `msg-del-seed-${Date.now()}`,
                                sender: 'user',
                                content: seedUserContent,
                                timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
                              },
                            ],
                            replyBias:
                              '这是“重新加好友”的验证申请首条消息。必须只输出一条普通文字（单行、无换行、无emoji、无特殊格式），长度8~28字；语气像真人发验证申请，贴合该角色人设、与对方当前关系状态（刚被删除后尝试重新添加），可带轻微在意/疑问，但不要变成日常闲聊。',
                            contactDeletionCount: deletionCount,
                          })
                          if (ai.nickname.trim()) nick = ai.nickname
                          if (ai.avatar.trim()) avatar = ai.avatar
                          firstMessage = sanitizeFriendRequestPlainText(ai.bubbles[0] ?? '')
                        } catch {
                          // AI 或角色读取失败时走兜底
                        }
                        if (!firstMessage) firstMessage = '怎么把我删了？'
                        firstMessage = sanitizeFriendRequestPlainText(firstMessage)
                        if (appPid) {
                          const verificationEpochMs = Date.now()
                          const requestId = `fr-${appPid}-${characterId}`
                          await personaDb.upsertFriendRequest({
                            id: requestId,
                            characterId,
                            playerIdentityId: appPid,
                            source: '来自微信号搜索',
                            status: 'pending',
                            createdAt: verificationEpochMs,
                            updatedAt: verificationEpochMs,
                            verificationEpochMs,
                          })
                          await personaDb.appendWeChatChatMessage({
                            id: `${requestId}-del-${verificationEpochMs}-${Math.random().toString(36).slice(2, 7)}`,
                            characterId,
                            playerIdentityId: sessionPid,
                            type: 'character',
                            content: firstMessage,
                            timestamp: verificationEpochMs,
                            isRead: false,
                            conversationKey: convKey,
                            notifyPeerTitle: nick,
                          })
                          await personaDb.markWeChatConversationUnread(convKey)
                          emitWeChatStorageChanged()
                          await refreshPendingNewFriendRequests()
                        }
                      }
                    } catch {
                      // 已回到通讯录；避免未捕获 Promise 影响后续操作
                    }
                  }}
                />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {route.name === 'contact-recommend-select' && playerIdentityId ? (
            <motion.div
              key="wx-contact-recommend-select"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-[325] flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[#f5f5f5]"
            >
              <WeChatForwardSelectChatScreen
                open
                forward={{ mode: 'single', messages: [] }}
                threads={messageThreads as any}
                contacts={state.wechatPersonaContacts as any}
                playerIdentityId={playerIdentityId}
                currentConversationKey={activeConversationKey}
                lumiAvatarUrl={lumiWechatAvatarUrl}
                title="选择联系人"
                recentTitle="最近联系人"
                listTitle="联系人"
                onClose={() =>
                  setRoute({
                    name: 'contact-profile-settings',
                    target: route.target,
                    remarkName: route.remarkName,
                    avatarUrl: route.avatarUrl,
                    returnTo: route.returnTo,
                  })
                }
                onPickChat={() => {
                  /* 由 onPickTarget 接管 */
                }}
                onPickTarget={async () => {
                  window.alert('联系人名片发送逻辑已预留，后续可在此接入。')
                  setRoute({
                    name: 'contact-profile-settings',
                    target: route.target,
                    remarkName: route.remarkName,
                    avatarUrl: route.avatarUrl,
                    returnTo: route.returnTo,
                  })
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {route.name === 'contact-complaint' ? (
            <motion.div
              key="wx-contact-complaint"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-[325] flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[#f5f5f5]"
            >
              <ContactComplaintScreen
                onBack={() =>
                  setRoute({
                    name: 'contact-profile-settings',
                    target: route.target,
                    remarkName: route.remarkName,
                    avatarUrl: route.avatarUrl,
                    returnTo: route.returnTo,
                  })
                }
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {wxGlobalNav && route.name === 'tabs' && route.tab === 'profile' ? (
            <motion.div
              key="wx-global-stack"
              initial={disableTransitions ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={disableTransitions ? { x: 0 } : { x: '100%' }}
              transition={disableTransitions ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-[230] flex min-h-0 min-w-0 flex-col overflow-x-hidden bg-[#f5f5f5]"
            >
              {wxGlobalNav.screen === 'root' ? (
                <WeChatGlobalSettingsScreen
                  onBack={() => setWxGlobalNav(null)}
                  onNavigate={(nav) => setWxGlobalNav(nav)}
                  onOpenTheme={() => {
                    setWxGlobalNav(null)
                    openWeChatAppearance()
                  }}
                  onSwitchAccount={() => {
                    setWxGlobalNav(null)
                    setRoute({ name: 'switch-account' })
                  }}
                />
              ) : wxGlobalNav.screen === 'account-security' ? (
                <AccountSecurityPage
                  onBack={() => setWxGlobalNav({ screen: 'root' })}
                  onAccountErased={({ remainingAccounts }) => {
                    setWxGlobalNav(null)
                    if (remainingAccounts > 0) {
                      setRoute({ name: 'switch-account' })
                    } else {
                      setRoute({ name: 'tabs', tab: 'messages' })
                    }
                  }}
                />
              ) : wxGlobalNav.screen === 'danmaku' ? (
                <WeChatDanmakuConfigScreen
                  onBack={() => setWxGlobalNav({ screen: 'root' })}
                  personaContacts={state.wechatPersonaContacts.map((c) => ({
                    characterId: c.characterId,
                    remarkName: c.remarkName,
                    avatarUrl: c.avatarUrl,
                  }))}
                />
              ) : wxGlobalNav.screen === 'notify' ? (
                <WeChatNotificationSettingsScreen
                  onBack={() => setWxGlobalNav({ screen: 'root' })}
                  personaContacts={state.wechatPersonaContacts.map((c) => ({
                    characterId: c.characterId,
                    remarkName: c.remarkName,
                    avatarUrl: c.avatarUrl,
                  }))}
                />
              ) : wxGlobalNav.screen === 'busy' ? (
                <WeChatBusySettingsScreen
                  onBack={() => setWxGlobalNav({ screen: 'root' })}
                  personaContacts={state.wechatPersonaContacts.map((c) => ({
                    characterId: c.characterId,
                    remarkName: c.remarkName,
                    avatarUrl: c.avatarUrl,
                  }))}
                />
              ) : wxGlobalNav.screen === 'time' ? (
                <WeChatTimeSettingsScreen
                  onBack={() => setWxGlobalNav({ screen: 'root' })}
                />
              ) : (
                <WeChatSettingsStubScreen
                  title={wxGlobalNav.title}
                  onBack={() => setWxGlobalNav({ screen: 'root' })}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {chatSettingsOpen &&
          route.name === 'chat' &&
          playerIdentityId &&
          activeConversationCharacterId &&
          activeConversationKey ? (
            <motion.div
              key={route.chat.kind === 'group' ? 'wx-group-info' : 'wx-chat-settings'}
              initial={disableTransitions ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={disableTransitions ? { x: 0 } : { x: '100%' }}
              transition={disableTransitions ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`absolute inset-0 z-[220] flex flex-col ${route.chat.kind === 'group' ? 'bg-[#F3F4F6]' : 'bg-[#ededed]'}`}
            >
              {route.chat.kind === 'group' ? (
                <GroupInfoScreen
                  groupId={route.chat.groupId}
                  playerIdentityId={playerIdentityId}
                  playerDisplayName={state.profile.displayName || '我'}
                  playerAvatarUrl={state.profile.avatarImageUrl ?? undefined}
                  personaContacts={personaContactsForGroupPick}
                  onClose={() => setChatSettingsOpen(false)}
                  onAfterLeave={() => {
                    setChatSettingsOpen(false)
                    exitChatToMessages()
                  }}
                />
              ) : (
                <ChatSettingsScreen
                  conversationKey={activeConversationKey}
                  peerCharacterId={activeConversationCharacterId}
                  playerIdentityId={playerIdentityId}
                  peerDisplayName={chatPeerContact?.remarkName ?? '聊天'}
                  peerAvatarUrl={chatPeerContact?.avatarUrl}
                  showProactiveMessageSettings={route.chat.kind === 'persona'}
                  personaEditTargetId={
                    route.chat.kind === 'persona' ? route.chat.characterId : lumiBindingPersonaCharacterId
                  }
                  inviteGroupFromPeerCharacterId={route.chat.kind === 'persona' ? route.chat.characterId : null}
                  personaContactsForGroup={personaContactsForGroupPick}
                  onInviteCreateGroup={async (extra) => {
                    if (route.name !== 'chat' || route.chat.kind !== 'persona' || !playerIdentityId) return
                    const peer = route.chat.characterId
                    const nickByCharacterId: Record<string, string> = {}
                    for (const c of personaContactsForGroupPick) nickByCharacterId[c.characterId] = c.remarkName
                    const { groupId } = await createWeChatGroupAndSeedConversation({
                      playerIdentityId,
                      playerDisplayName: state.profile.displayName || '我',
                      characterIds: [peer, ...extra],
                      nickByCharacterId,
                    })
                    setChatSettingsOpen(false)
                    await refreshMessageThreadsMeta()
                    setRoute({ name: 'chat', chat: { kind: 'group', groupId } })
                  }}
                  onClose={() => setChatSettingsOpen(false)}
                  onHistoryCleared={() => {
                    setChatSettingsOpen(false)
                    setChatHistoryRefreshSignal((n) => n + 1)
                    void refreshMessageThreadsMeta()
                  }}
                  onOpenPersonaEdit={(characterId) => {
                    setChatSettingsOpen(false)
                    setRoute({ name: 'new-friends-persona', editCharacterId: characterId, returnToChat: route.chat })
                  }}
                  onJumpToChatMessage={(messageId) => setPendingScrollToMessageId(messageId)}
                  onOpenPeerProfile={() => {
                    if (route.name !== 'chat') return
                    const chat = route.chat
                    setChatSettingsOpen(false)
                    if (chat.kind === 'lumi') {
                      setRoute({
                        name: 'contact-profile',
                        target: { kind: 'lumi' },
                        remarkName: chatPeerContact?.remarkName ?? 'Lumi',
                        avatarUrl: chatPeerContact?.avatarUrl ?? lumiWechatAvatarUrl,
                        returnTo: { mode: 'chat', chat, reopenChatSettings: true },
                      })
                      return
                    }
                    if (chat.kind === 'self') {
                      setRoute({
                        name: 'contact-profile',
                        target: { kind: 'self' },
                        remarkName: weChatSelfAccountContact.remarkName,
                        avatarUrl: weChatSelfAccountContact.avatarUrl,
                        returnTo: { mode: 'chat', chat, reopenChatSettings: true },
                      })
                      return
                    }
                    if (chat.kind === 'group') return
                    const pc = state.wechatPersonaContacts.find((c) => c.characterId === chat.characterId)
                    setRoute({
                      name: 'contact-profile',
                      target: { kind: 'persona', characterId: chat.characterId },
                      remarkName: pc?.remarkName ?? chatPeerContact?.remarkName ?? '聊天',
                      avatarUrl: pc?.avatarUrl ?? chatPeerContact?.avatarUrl,
                      returnTo: { mode: 'chat', chat, reopenChatSettings: true },
                    })
                  }}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {route.name === 'chat' && wxDockChat?.kind === 'persona' ? (
          <ChatTimeSettingsScreen
            open={chatTimeSettingsOpen}
            characterId={wxDockChat.characterId}
            peerDisplayName={chatPeerContact?.remarkName ?? '聊天'}
            onClose={() => setChatTimeSettingsOpen(false)}
          />
        ) : null}

        <AnimatePresence>
          {(route.name === 'tabs' || route.name === 'contacts-group-chats') &&
          newGroupFromMessagesOpen &&
          playerIdentityId ? (
            <motion.div
              key="wx-new-group-pick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-[330] bg-[#FFFFFF]"
            >
              <CreateGroupPickContactsSheet
                open
                title="发起群聊"
                lockedCharacterIds={[]}
                contacts={personaContactsForGroupPick}
                minExtraSelections={2}
                onClose={() => setNewGroupFromMessagesOpen(false)}
                onConfirm={async (extra) => {
                  const nickByCharacterId: Record<string, string> = {}
                  for (const c of personaContactsForGroupPick) nickByCharacterId[c.characterId] = c.remarkName
                  const { groupId } = await createWeChatGroupAndSeedConversation({
                    playerIdentityId,
                    playerDisplayName: state.profile.displayName || '我',
                    characterIds: extra,
                    nickByCharacterId,
                  })
                  setNewGroupFromMessagesOpen(false)
                  await refreshMessageThreadsMeta()
                  setRoute({ name: 'chat', chat: { kind: 'group', groupId } })
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      </WeChatWelcomeRevealLayer>

      <WeChatWelcomeRevealLayer slot="tabbar" className="shrink-0">
      {route.name === 'tabs' && !hideTabChrome ? (
        <TabBar
          active={activeTab}
          onChange={(id) => setRoute({ name: 'tabs', tab: id })}
          messagesUnreadCount={messagesTabUnreadTotal}
          contactsUnreadCount={newFriendsUnreadCount}
          discoverUnreadCount={momentsInteractionUnreadCount}
        />
      ) : null}
      </WeChatWelcomeRevealLayer>

      <ThemePanel
        open={themeOpen}
        boot={themePanelBoot}
        onClose={() => {
          setThemeOpen(false)
          setThemePanelBoot({})
        }}
      />
      <WeChatProfileEditModal
        open={profileEditOpen}
        onClose={() => setProfileEditOpen(false)}
        profile={wechatEditProfile}
        onSave={(patch) => {
          void updatePhoneProfile(patch)
        }}
      />
      <MemoryTraceModal open={memoryTraceOpen} onClose={() => setMemoryTraceOpen(false)} data={memoryTraceSnapshot} />
      <WorldBookAfterPatchNoticeHost />
      <DatingPlotCompletionToastHost />
      <MeetVol10EpilogueNoticeHost />
      <MomentsNoticeRuntime
        accountId={currentAccountId}
        userDisplayName={momentsDisplayName}
        playerIdentityId={playerIdentityId}
        momentContacts={momentContactsForNotices}
      />

      <GlobalMessageListener
        playerIdentityId={playerIdentityId}
        playerDisplayName={state.profile.displayName}
        playerAvatarUrl={state.profile.avatarImageUrl}
        personaContacts={state.wechatPersonaContacts}
        onOpenChat={openChatFromGlobalMessage}
      />

      <AnimatePresence>
        {consoleOpen ? (
          <WeChatConsoleFloatingPanel
            open={consoleOpen}
            onClose={closeConsole}
            characterId={chatRoomPersonaCharacterId ?? undefined}
          />
        ) : null}
      </AnimatePresence>

      <ChatHistoryViewer
        open={chatHistoryViewerOpen && route.name === 'chat'}
        data={chatHistoryViewerData}
        participantAvatars={chatHistoryViewerAvatars}
        avatarRadiusPx={chatHistoryViewerAvatarRadiusPx}
        recipientCharacterId={chatHistoryViewerRecipientId}
        userDisplayName={chatHistoryViewerUserDisplayName}
        personaContacts={chatHistoryViewerPersonaContacts}
        cardSenderCharacterId={chatHistoryViewerCardSenderCharacterId}
        onClose={() => {
          setChatHistoryViewerOpen(false)
          setChatHistoryViewerData(null)
          setChatHistoryViewerAvatars({})
          setChatHistoryViewerRecipientId(undefined)
          setChatHistoryViewerCardSenderCharacterId(undefined)
        }}
      />
      </div>
    </div>
  )
}

export function WeChatApp({ onBack }: Props) {
  return (
    <WechatStoreProvider>
      <ChatThemeProvider>
        <WeChatConsoleProvider>
          <WeChatAuthGuard onBack={onBack}>
            <WeChatAppInner onBack={onBack} />
          </WeChatAuthGuard>
        </WeChatConsoleProvider>
      </ChatThemeProvider>
    </WechatStoreProvider>
  )
}
