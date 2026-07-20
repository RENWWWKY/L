import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AtSign, ChevronDown, PhoneCall, Share2, Trash2, X } from 'lucide-react'

import { useCustomization } from '../../CustomizationContext'
import { computeWeChatStyleKeyboardInset, measureComposerOverlapPx } from '../../hooks/keyboardInset'
import { Pressable } from '../../components/Pressable'
import { setBackgroundNotifyPendingWork } from '../backgroundNotify/backgroundNotifyPendingWork'
import { registerProactiveMessageRevealHandler } from './proactiveMessageRevealBridge'
import { planProactiveRevealBubblesAsync, repairStoredMediaMessageRow, repairStoredVoiceMessageRow } from './proactiveBubbleRevealPlan'
import {
  isProactiveMessageInFlight,
  markProactiveMessageConversationAiBusy,
  resetProactiveMessageCountdown,
  subscribeProactiveMessageInFlight,
} from './proactivePrivateMessageEngine'
import {
  isWechatAiReplyPipelineActive,
  setWechatAiReplyPipelineActive,
  subscribeWechatAiReplyPipelineActive,
} from './wechatAiReplyInFlight'
import {
  getConversationFlushContext,
  getConversationPendingAiReplies,
  getConversationPipelineFlags,
  isAnyConversationPeerTypingForNotify,
  isConversationAiPipelineBlockingSend,
  isConversationPeerReplyingVisible,
  isConversationFlushAiRepliesBusy,
  isConversationOpponentQueueStopped,
  isConversationProcessingSend,
  setConversationAiCalling,
  setConversationAwaitingAiKick,
  clearConversationFlushContext,
  setConversationFlushContext,
  setConversationFlushAiRepliesBusy,
  setConversationFlushUiBusy,
  setConversationHeaderTyping,
  setConversationOpponentQueueStop,
  setConversationPendingAiReplies,
  setConversationPendingQueueCount,
  setConversationProcessingSend,
  subscribeWechatConversationAiPipeline,
  notifyWechatConversationAiPipeline,
  resolveBoundConversationFlushContext,
} from './wechatConversationAiPipeline'
import { hasProactiveMessageScheduleSaved } from './proactivePrivateMessageTypes'
import {
  drawProactiveVariableIntervalSeconds,
  isProactiveVariableIntervalEnabled,
} from './proactiveVariableInterval'
import { ProactiveMessageCountdownHost } from './chatRoom/ProactiveMessageCountdownHost'
import { resolveCharacterAvatarUrl } from '../../utils/characterAvatarUrl'
import { PHONE_DISMISS_OVERLAYS_EVENT } from '../../phoneDismissOverlays'
import type { WeChatBubbleTheme, WeChatChatRoomBg, WeChatTheme } from '../../types'
import { DEFAULT_WECHAT_CHAT_ROOM_BG, wechatBubbleSkinKey, wechatBubbleThemesEqual } from '../../types'
import { resolvePublicImageUrl } from '../../../publicAssetUrl'
import { wechatChatRoomBgFallbackColor, wechatChatRoomBgToStyle } from './wechatChatRoomBg'
import { migrateMislabeledLumiDefaultBubble, resolveEffectiveChatInputBarForBubble } from './wechatBubblePresets'
import { chatDisplayFontCssVars, resolveChatDisplayFontFamily } from './wechatBubbleTemplateFonts'
import { resolveMessengerBubbleStyle } from './wechatMessengerSpecialBubbles'
import { weChatChatSkinCssProperties } from './wechatChatSkinVars'
import './wechatChatSkinScope.css'
import { useCurrentApiConfig, useIsSubApiEnabled } from '../api/ApiSettingsContext'
import type { ApiConfig } from '../api/types'
import { DEFAULT_IMAGE_GEN_SETTINGS } from '../api/imageGenPresetUtils'
import { loadResolvedImageGenSettings } from '../api/loadResolvedImageGenSettings'
import {
  buildCharacterImageGenPromptBlock,
  buildCharacterImageFakeSendRetryBias,
  characterOutputClaimsSentImageWithoutLine,
  mergeCharacterImageRetryBubbles,
  parseCharacterImageGenLine,
  countCharacterImageGenLinesInBubbles,
  limitCharacterImageGenLinesFromBubbles,
  stripCharacterImageGenLinesFromBubbles,
  resolveCharacterImageDescriptionForUi,
  resolveCharacterImageGenPromptForApi,
} from './wechatCharacterImageGen'
import { buildChatContextTailFromTranscript } from './nsfwPoseLibrary/buildWeChatNsfwPoseLibraryPromptBlock'
import {
  retryWeChatCharacterImageGenMessage,
  WECHAT_IMAGE_GEN_UI_PATCH_EVENT,
  clearWeChatImageGenUiPatch,
  getWeChatImageGenUiPatch,
  getWeChatImageGenUiPatchMap,
  isWeChatImageGenUiPatchResolved,
  rememberWeChatImageGenUiPatch,
  type WeChatImageGenUiPatch,
} from './wechatCharacterImageGenAsync'
import { characterHasAppearanceReference, resolveCharacterImageGenPromptAppearanceHint } from './characterAppearanceImageGen'
import { resolveCharacterMediaImageStyleHint } from '../../../components/moments/momentsImagePromptEnhancer'

import { useChatTheme } from './ChatThemeContext'
import { WeChatChatMixedText } from './WeChatChatMixedText'
import {
  densityToTrackCount,
  hexAndOpacityToRgba,
  resolveEffectiveDanmakuVisuals,
  type EffectiveDanmakuVisuals,
} from './danmakuResolve'
import { isMeetImportedWeChatMessageId } from '../lumiMeet/meetMemoryConstants'
import { loadStarMakerAgencyReplyBias } from '../starMaker/starMakerWechatBridge'
import { formatUnsummarizedMeetChatBlock } from '../lumiMeet/meetMemoryPromptBlocks'
import {
  buildMeetWechatPrivateChatContinuityBlock,
  isMeetSyncedCharacter,
  loadMeetUserProfileSnapshotFromKv,
} from '../lumiMeet/meetUserProfileSnapshot'
import { loadMeetEncounterMemoriesPromptBlock } from '../lumiMeet/meetWechatSyncOnFriendLinked'
import { formatCharacterMemoriesForPromptInjectionPack } from './memory/formatCharacterMemoriesForPromptInjection'
import { loadStoryTimelinePromptBlock } from './memory/storyTimelinePersist'
import { composeStoryTimelineCalendarAnchorLabel } from './memory/storyTimelineTypes'
import { syncStoryTimelineNowFromOnlineClock } from './time/applyOnlineChatTimeFusion'
import { mergeMomentImageUrlsForGroup } from './memory/momentMemoryPromptImages'
import { emitWeChatStorageChanged, personaDb } from './newFriendsPersona/idb'
import {
  shouldTreatWechatLineAsStrangerContact,
  wrapStrangerContactLongTermMemoryBlock,
} from './wechatAltAccountPrompt'
import { isSecondaryWechatAccountInBundle, loadAccountsBundle } from './wechatAccountPersistence'
import { buildCrossAccountPrivateChatDigests } from './wechatCrossAccountChatDigest'
import {
  buildCharacterProfileImageCatalogBlock,
  buildUserImageProfileApplyCaptionBias,
  buildUserProfileImageRestoreBias,
  parseCharacterProfileImageApplyDirective,
  stripAndApplyCharacterProfileImageActions,
} from './wechatCharacterProfileImageApply'
import {
  applyCharacterWechatProfileUpdateDirectives,
  userRequestedWechatSignatureUpdate,
  buildCharacterWechatProfileStateBlock,
  buildUserWechatProfileUpdateBias,
  filterCharacterWechatProfileUpdateDirectives,
  parseCharacterWechatProfileUpdateDirective,
} from './wechatCharacterProfileUpdateApply'
import {
  applyCharacterMomentPinDirectives,
  buildUserMomentPinRequestBias,
  filterCharacterMomentPinDirectives,
  parseCharacterMomentPinDirective,
} from './wechatCharacterMomentPinApply'
import {
  applyCharacterMomentPublishDirectives,
  buildUserMomentPublishRequestBias,
  filterCharacterMomentPublishDirectives,
} from './wechatCharacterMomentPublishApply'
import {
  applyCharacterMomentSongShareDirectives,
  filterCharacterMomentSongShareDirectives,
  mergeCharacterMomentSongShareDirectiveLines,
  WECHAT_CHARACTER_MOMENT_SONG_SHARE_APPENDIX,
} from './wechatCharacterMomentSongShareApply'
import { buildCharacterMomentsPinCatalogBlock } from '../../../components/moments/momentPinService'
import { buildUserMomentsVisibleToCharacterCatalogBlock } from '../../../components/moments/userMomentChatCatalog'
import { contactEntryFromCharacter } from './wechatPersonaContactsSync'
import { useWechatStore } from './useWechatStore'
import {
  applyWorldBookAfterPatchesToCharacter,
  applyWorldBookAfterRevertEntries,
  buildAggregateGroupChatAfterPatchItemsSection,
  buildWorldBookAfterPatchOutputAppendix,
  collectWorldBookAfterRevertSnapshot,
  enrichWeChatCharacterMessageWithRoundRevert,
  hasChatAfterWorldBookItems,
  mergeWorldBookAfterRevertByCharacterFromMessages,
  revertWorldBookAfterUsingContentPrevious,
  WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT,
  type WorldBookAfterPatch,
} from './newFriendsPersona/worldBookAfterPatch'
import { finalizeWorldBookAfterPerAiRound } from './newFriendsPersona/worldBookAfterSync'
import type {
  Character,
  CharacterBusySettingsRow,
  CharacterDanmakuSettingsRow,
  GroupPsycheArchive,
  HeartWhisper,
  PlayerIdentity,
  Relationship,
  WeChatChatMessage,
  WeChatImageMime,
  WeChatGlobalSettingsRow,
  WeChatRedPacketPayload,
  WeChatTransferPayload,
  WeChatMusicSyncPayload,
  WeChatMiniGameInvitePayload,
  WeChatMiniGameMatchResult,
  WeChatMiniGamePayload,
  WeChatListenCommentSharePayload,
  WeChatListenProfileSharePayload,
  WeChatListenTrackSharePayload,
  WeChatLocationPayload,
  WeChatSharedRecordPayload,
  WeChatChatHistoryPayload,
  WeChatMusicSyncInvitePayload,
  WeChatReplyToMeta,
  ScheduleTable,
} from './newFriendsPersona/types'
import {
  parseStoredRoundTriggerPercent,
  rollRoundMediaTriggerAllowed,
  rollClassicEmojiRoundTriggerAllowed,
  drawRoundImageCount,
  parseStoredImageRoundCountRange,
  isCharacterImageSendSupported,
  shouldSuppressCharacterStickerLine,
  shouldSuppressCharacterVoiceLine,
  shouldSuppressCharacterImageLine,
  stripBannedClassicEmojiTokens,
  shouldStripClassicEmojiTokensThisRound,
} from './wechatMediaSendFrequency'
import { stripWechatClassicEmojiTokens } from './stickers/wechatClassicStickerPack'
import { shouldInjectImageGenCompositionLifeFeelCot } from '../../../components/moments/imageGenCompositionLifeFeelCot'
import {
  buildUserExplicitCharacterImageRequestBias,
  resolveCharacterImageRequestIntent,
  userExplicitlyRequestsCharacterSticker,
} from './wechatCharacterImageRequestDetect'
import { logConsole } from './consoleLogger'
import {
  requestWeChatHeartWhisper,
  requestWeChatCharacterPsyche,
  requestWeChatGroupPsyche,
  requestWeChatDanmakuVarietyShow,
  requestWeChatPeerReplyBubbles,
  requestWeChatPeerReplyBubblesWithImage,
  requestWeChatGroupMultiSpeakerReplyBubbles,
  requestWeChatGroupMultiSpeakerReplyBubblesWithImage,
  buildWeChatGroupMultiSpeakerSystem,
  buildWeChatPlayerIdentityPromptBlock,
  buildWeChatPlayerThirdPersonPronounIronRule,
  buildDanmakuInlineInstruction,
  buildWorldBookText,
  buildCharacterCard,
  requestWeChatVoiceCallReplyText,
  requestWeChatVoiceCallDecision,
  WECHAT_RECALL_ACTION_TOKEN,
  type BusyRuntimeContext,
  type ChatTranscriptTurn,
  type WeChatPeerReplyResult,
  type WeChatPeerReplyOrderedSegment,
  type WeChatGroupMultiSpeakerMemberPrompt,
} from './wechatChatAi'
import type { WeChatGroupMetaAction, WeChatGroupMultiSpeakerOrderedItem } from './groupChatModelMeta'
import { applyWeChatGroupMetaFromModel } from './groupChatMetaApply'
import {
  buildNpcGroupChatsRecentDigestForPrivatePrompt,
  buildNpcPrivateChatDigestForGroupPrompt,
} from './groupChatPrivateDigest'
import {
  buildMemoryRelevanceHaystack,
  buildLastOnlineChatContinuityNote,
  buildRecentPrivateChatRoundsWithTimeBlock,
  buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt,
  formatUnsummarizedCurrentGroupChatBlock,
  formatUnsummarizedPrivateChatBlock,
  formatUnsummarizedPrivateDigestForGroupMember,
  MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
  MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
} from './wechatMemoryPromptBlocks'
import { buildNpcRelationshipRomanceProfileForGroupPrompt } from './groupChatMemberRelationshipPrompt'
import {
  buildGroupLeanSessionIdentityPromptBlock,
  buildGroupMultiIdentityCoPresenceBlock,
  buildNpcIdentityAlignmentNoteForGroup,
  type GroupNpcIdentityBindingRow,
} from './groupChatMultiIdentityPrompt'
import { buildGroupChatSelfAuditPromptSection } from './groupChatSelfAuditPrompt'
import { loadOfflineDatingPlotsPromptBlock } from './dating/loadOfflineDatingPlotsForWechatPrompt'
import { buildOnlineChatCrossChannelTimelineRule } from './wechatCrossChannelTimeline'
import { publishWeChatGroupMemoryTrace, publishWeChatPrivatePersonaMemoryTrace } from './memoryTracePublisher'
import {
  runGroupChatMemorySummaryAfterThreshold,
  runUnifiedAutoMemorySummaryAfterThreshold,
} from './unifiedMemoryAutoSummary'
import { notifyMemorySummaryAttempt } from './memory/memorySummaryRetry'
import { parseWechatAccountPrivateConversationKey } from './wechatConversationKey'
import { DanmakuOverlay } from './DanmakuOverlay'
import { useWeChatCurrentTime } from './time/useWeChatCurrentTime'
import { formatWeChatChatTimestamp, shouldRenderWeChatTimestamp } from './time/wechatTimeUtils'
import {
  WECHAT_GROUP_BOT_CHARACTER_ID,
  WECHAT_GROUP_USER_CHAR_ID,
  WECHAT_LUMI_PEER_CHARACTER_ID,
  isWechatSelfMemoPeerCharacterId,
  isWechatGroupConversationKey,
  parseGroupIdFromGroupPeerCharacterId,
  isSameWeChatStorageConversationMigration,
  resolveGroupWeChatStorageConversationKey,
  resolvePrivateWeChatStorageConversationKey,
} from './wechatConversationKey'
import {
  isNonPrimaryBindingSession,
  resolvePrivateChatPromptPlayerIdentityId,
  shouldUseWechatHomeProfileOnlyForPrivateChat,
} from './wechatCharacterPlayerIdentity'
import { resolveWorldBookUserBinding } from './charUserPlaceholders'
import { buildWechatPrivateContactIdentityContextBlock } from './wechatContactIdentityPrompt'
import {
  buildPrivateChatMemoryInjectionAnchor,
  normalizeMemoryPromptLineScope,
  wrapUnsummarizedPrivateBlockWithLineLabel,
} from './wechatMemoryLineScope'
import {
  peekGroupChatPrivatePeerAnchorFromDockStaging,
  peekPrivateChatGroupAnchorFromDockStaging,
} from './wechatPrivateGroupAnchorStaging'
import type { GroupChatRow, GroupMember } from './newFriendsPersona/types'
import {
  buildGroupStrangerPairDisplayLines,
  findGroupMember,
  matchGroupRobotRules,
  resolveGroupRobotAvatarDisplayUrl,
  textMentionsGroupEveryone,
  userCanAccessGroupAdminLevelInClient,
} from './groupChatUtils'
import {
  applyGroupSmartBotViolationPipeline,
  getGroupSmartBotMentionLabels,
  groupMemberSpeechBlockedInGroup,
  pruneExpiredBotMutesOnGroup,
  requestGroupSmartBotAtReply,
  normalizeGroupSmartBotBubblePlaintext,
  textMentionsGroupSmartBot,
} from './groupBotSmartEngine'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from './group/ChatGroupSpeakerAvatarWrap'
import { formatWorldBackgroundForPrompt } from './newFriendsPersona/worldBackgroundFormat'
import { WeChatMessageBubbleRow, type WeChatBubbleReplyPreview } from './WeChatMessageBubbleRow'
import { ImessageDetachedReplyBubble } from './wechatMessengerSpecialBubbles'
import { WechatDetachedQuoteReply } from './wechatBubbleWechatUi'
import { WeChatChatImageBubbleRow } from './WeChatChatImageBubbleRow'
import {
  WeChatMessageActionPanel,
  type PanelAnchor,
  type WeChatMessageActionId,
} from './WeChatMessageActionPanel'
import { WeChatCenterToast } from './WeChatCenterToast'
import { WeChatConfirmDialog } from './WeChatConfirmDialog'
import {
  PLUS_MENU_HEIGHT_PX,
  WeChatChatPlusMenuPanel,
  type WeChatPlusActionId,
} from './WeChatChatPlusMenu'
import { CheckPhoneFlow } from './checkPhone/CheckPhoneFlow'
import { enrichMiniGamePayloadMatchResult, collectMiniGameThreadMessageIds, playerSideMatchOutcome, charSideMatchOutcome, resolveMiniGameThreadLink } from './miniGame/miniGameMatchHelpers'
import { MiniGameFlow, type MiniGameSession } from './miniGame/MiniGameFlow'
import { MiniGameInviteChatRow } from './miniGame/MiniGameInviteChatRow'
import {
  buildMiniGameAcceptPayload,
  buildMiniGameDeclinePayload,
  shouldSyncMiniGameInviteCharResponded,
  buildMiniGameInvitePayload,
} from './miniGame/miniGameInviteHelpers'
import { ensureGomokuSessionOnInvitePayload, gomokuSessionSetupFromPayload } from './miniGame/gomokuReactionBank'
import type { GomokuSessionSetup } from './miniGame/gomokuReactionBank'
import {
  adjudicateMiniGameFromCharacterText,
  buildMiniGameInviteReplyBias,
  enrichChatRowsMiniGameForAiTranscript,
  enrichMiniGameInviteCharResponded,
  findLatestPendingMiniGameInvite,
  formatMiniGameAcceptTranscriptLine,
  formatMiniGameInviteTranscriptLineWithResult,
  shouldAppendMiniGameMatchResultOnInvite,
  isMiniGameDirectiveArtifactLine,
  mergeMiniGameDirectiveBubbleLines,
  parseMiniGameInviteActionDirective,
  resolvePendingMiniGameInviteMessageId,
  WECHAT_MINI_GAME_INVITE_OUTPUT_BLOCK,
} from './miniGame/wechatMiniGameInviteAi'
import {
  buildCharacterMiniGameInviteStateBias,
  formatCharacterMiniGameInviteTranscriptLine,
  isCharacterMiniGameInviteDirectiveArtifactLine,
  parseCharacterMiniGameInviteDirectiveFromArtifactLine,
  preprocessCharacterMiniGameInviteBubblesForChat,
  type PendingCharacterMiniGameInvite,
  WECHAT_CHARACTER_MINI_GAME_INVITE_OUTPUT_BLOCK,
} from './miniGame/wechatCharacterMiniGameInviteAi'
import type { MiniGameType } from './miniGame/types'
import { isGameAvailable } from './miniGame/gameCatalog'
import { WeChatChatCameraScreen } from './WeChatChatCameraScreen'
import {
  WeChatChatPhotoPickerSheet,
  type WeChatChatImagePayload,
} from './WeChatChatPhotoPickerSheet'
import { useWeChatConsole } from './WeChatConsoleContext'
import { GroupPsycheModal } from './GroupPsycheModal'
import { formatHeartWhisperGenerateError, HeartWhisperModal } from './HeartWhisperModal'
import { CharacterPsycheRadarSheet } from './characterPsyche/CharacterPsycheRadarSheet'
import { loadCharacterPsycheState, saveCharacterPsycheState } from './characterPsyche/characterPsycheStore'
import { extractLastUserQuoteFromChatTexts } from './characterPsyche/characterPsycheSummaries'
import type { CharacterPsychePageSummaries } from './characterPsyche/characterPsycheSummaries'
import type { CharacterPsycheMetricsSnapshot, CharacterPsycheState } from './characterPsyche/characterPsycheTypes'
import { RedPacketChatRow } from './redPacket/RedPacketChatRow'
import {
  clearLumiRedPacketOpenedUi,
  isLumiRedPacketOpenedUi,
  markLumiRedPacketOpenedUi,
} from './redPacket/lumiRedPacketOpenedStore'
import { MusicInviteChatRow } from './musicSync/MusicInviteChatRow'
import { ListenCommentShareChatRow } from './musicSync/ListenCommentShareChatRow'
import { ListenProfileShareChatRow } from './musicSync/ListenProfileShareChatRow'
import { ListenTrackShareChatRow } from './musicSync/ListenTrackShareChatRow'
import {
  formatListenCommentShareAiTranscriptLine,
  formatListenProfileShareAiTranscriptLine,
  formatListenTrackShareAiTranscriptLine,
} from './musicSync/listenShareAiContext'
import { SharedRecordChatRow } from './favorites/SharedRecordChatRow'
import { ShareContactSheet } from './favorites/ShareContactSheet'
import { ChatHistoryChatRow } from './chatHistory/ChatHistoryChatRow'
import { resolveParticipantAvatarMap } from './chatHistory/buildParticipantAvatarMap'
import {
  resolveChatHistoryFromStoredMessage,
} from './chatHistory/buildChatHistoryPayload'
import {
  forwardMessagesItemByItemToContact,
  forwardMessagesMergedToContact,
} from './chatHistory/forwardMessagesToContact'
import { MultiSelectAvatarSlot, composeMultiSelectLeading } from './chatHistory/MultiSelectAvatarSlot'
import { buildSharedRecordReplyBias } from './favorites/buildSharedRecordPromptBias'
import { buildChatHistoryReplyBias } from './chatHistory/buildChatHistoryPromptBias'
import { buildCharacterForwardHistorySituationBias, detectForwardHistoryEvidenceSituation } from './chatHistory/wechatForwardHistorySituation'
import { findLatestSelfChatHistoryInBurst } from './chatHistory/findLatestSelfChatHistoryInBurst'
import { enrichCharacterForwardHistoryPayload } from './chatHistory/enrichCharacterForwardHistoryPayload'
import { formatChatHistoryForAiTranscript } from './chatHistory/formatChatHistoryForMemorySummary'
import { findLatestSelfSharedRecordInBurst } from './favorites/findLatestSelfSharedRecordInBurst'
import { buildLinkPreviewPromptBlockFromTexts } from './linkPreview/formatLinkPreviewPromptBlock'
import { WeChatChatRenderErrorBoundary } from './WeChatChatRenderErrorBoundary'
import { ChatRoomFavoritesPicker } from './favorites/ChatRoomFavoritesPicker'
import { addWeChatMessageToAlbum } from './album/addWeChatMessageToAlbum'
import { resolveAlbumSaveMessage } from './album/resolveAlbumSaveMessage'
import { buildSharedRecordPayloadFromFavorite } from './favorites/buildSharedRecordPayload'
import type { FavoriteItem } from './favorites/favoriteItemTypes'
import { sendSharedRecordToContact } from './favorites/sendSharedRecord'
import { requestOpenListenCommentShareCard } from '../../../components/discoverListen/listenTogetherCommentNavigation'
import { requestOpenListenProfileShareCard } from '../../../components/discoverListen/listenTogetherProfileNavigation'
import { requestOpenListenTrackShareCard } from '../../../components/discoverListen/listenTogetherTrackNavigation'
import {
  adjudicateMusicSyncFromCharacterText,
  buildMusicSyncInviteReplyBias,
  expandMultilineReplyBubbles,
  formatMusicSyncInviteTranscriptLine,
  findLatestPendingMusicInvite,
  isMusicSyncDirectiveArtifactLine,
  mergeMusicSyncDirectiveBubbleLines,
  parseMusicSyncIncomingActionDirective,
  resolveMusicSyncInviteCover,
  resolvePendingMusicInviteMessageId,
  WECHAT_LISTEN_TRACK_SHARE_OUTPUT_BLOCK,
} from './musicSync/wechatMusicSyncAi'
import { buildSyncListeningLyricHumBias, buildSyncListeningPlaybackBias } from './musicSync/syncListeningPlaybackBias'
import { preprocessCharacterMusicSyncBubblesForChat, applyCharacterMusicSeek, applyCharacterMusicSyncDirective, startCharacterMusicSyncInvitePlayback, type PendingCharacterMusicSyncInvite, type PendingCharacterMusicSyncPlay, type PendingCharacterMusicSyncSeek } from './musicSync/applyCharacterMusicSyncDirective'
import {
  buildCharacterMusicSyncInviteStateBias,
  formatCharacterMusicSyncInviteTranscriptLine,
  isCharacterMusicSyncDirectiveArtifactLine,
  mergeCharacterMusicSyncDirectiveLines,
  parseCharacterMusicSyncDirectiveFromArtifactLine,
  WECHAT_CHARACTER_MUSIC_SYNC_OUTPUT_BLOCK,
} from './musicSync/wechatCharacterMusicSyncAi'
import { shouldEngageMusicSyncInviteFlow } from './musicSync/findLatestSelfListenTrackShareInBurst'
import { resolveListenTogetherSyncUserAvatar } from '../../../components/discoverListen/useListenTogetherUserAvatar'
import { resolveWechatAppAvatar } from '../../../components/discoverListen/listenTogetherUserAvatarPreference'
import { useMusicStore } from '../../../stores/useMusicStore'
import { RedPacketModal } from './redPacket/RedPacketModal'
import type { TransferBubblePerspective } from './transfer/TransferBubble'
import { TransferChatRow } from './transfer/TransferChatRow'
import type { WeChatTakeoutOrderPayload, WeChatPulseSharePayload } from './newFriendsPersona/types'
import { LocationChatRow } from './location/LocationChatRow'
import { LocationSpoofModal } from './location/LocationSpoofModal'
import { sendLocationToContact } from './location/sendLocationToContact'
import {
  formatLocationShareAiTranscriptLine,
} from './location/locationAiContext'
import {
  buildWeChatLocationPayloadFromAiDirective,
  isLocationShareDirectiveArtifactLine,
  parseLocationShareDirective,
} from './location/locationShareAiDirective'
import { locationShareContentFallback } from './location/wechatLocationUtils'
import { emitTasteOrderPlaced } from '../takeout/tasteOrderBridge'
import { openTasteAppTracking } from '../takeout/tasteNavigation'
import { TakeoutOrderChatRow } from './takeout/TakeoutOrderChatRow'
import { openLumiPulseApp } from '../lumiPulse/lumiPulseNavigation'
import { PulseShareChatRow } from './pulse/PulseShareChatRow'
import {
  buildCharacterTakeoutOrderBundle,
  isTakeoutOrderDirectiveArtifactLine,
  parseTakeoutOrderDirective,
  takeoutOrderContentFallback,
} from './takeout/takeoutOrderShareAiDirective'
import {
  applyPulseCommentDirective,
  coalescePulseCommentBlocksInLines,
  formatPulseShareAiTranscriptLine,
  isPulseCommentDirectiveArtifactLine,
  parsePulseCommentDirective,
  stripPulseCommentDirectivesFromBubbles,
} from './pulse/pulseShareAiDirective'
import {
  applyPulseFollowDirective,
  isPulseFollowDirectiveArtifactLine,
  parsePulseFollowDirective,
  stripPulseFollowDirectivesFromBubbles,
} from './pulse/pulseFollowAiDirective'
import {
  isPulseDmScreenshotDirectiveArtifactLine,
  parsePulseDmScreenshotPlaceholderId,
  preparePulseDmScreenshotPlaceholders,
  PULSE_DM_SCREENSHOT_TRANSCRIPT,
  stripPulseDmScreenshotDirectivesFromBubbles,
  takePulseDmScreenshotCachedImage,
} from './pulse/pulseDmScreenshotAiDirective'
import {
  acceptLumiTransfer,
  emitLumiTransferChanged,
  evaluateExpiredTransfers,
  getLumiTransferFresh,
  resetAcceptedIncomingPlayerTransfersForConversationPeer,
  returnLumiTransfer,
  upsertLumiTransfer,
} from './transfer/lumiTransferStorage'
import { walletAddTransaction, walletAdjustBalance } from './wallet/walletMockStore'
import {
  LS_REDPACKET_EXPIRED_NOTIFIED_KEY,
  LS_TRANSFER_RETURN_NOTIFIED_KEY,
  readNotifiedSet,
  writeNotifiedSet,
} from './wechatLocalNotifySet'
import { CallingScreen } from './voiceCall/CallingScreen'
import { IncomingCallScreen } from './voiceCall/IncomingCallScreen'
import { VoiceCallActionSheet } from './voiceCall/VoiceCallActionSheet'
import { VoiceCallPanel } from './voiceCall/VoiceCallPanel'
import { requestSiliconflowTranscription } from './voiceCall/siliconflowAsr'
import { ChatEmojiPickerPanel } from './stickers/ChatEmojiPickerPanel'
import {
  clearWeChatComposerField,
  insertWeChatClassicEmojiAtCaret,
  moveWeChatComposerCaretToEnd,
  normalizeWeChatComposerDraftText,
  readWeChatComposerDraftText,
  serializeWeChatComposerEl,
} from './stickers/wechatClassicEmojiComposer'
import { ensureStickerStoreHydrated, getStickerCatalogEntries, parseCharacterStickerLine } from './stickers/stickerStore'
import {
  collectRecentCharacterStickerRefsFromTranscript,
  collectRecentCharacterStickerRefsFromMessages,
  formatStickerTranscriptLine,
  shouldSkipDuplicateCharacterSticker,
  stickerTranscriptTextFromFields,
} from './stickers/stickerAntiRepeat'
import { stickerUrlToImagePayload, arrayBufferToBase64ForMedia } from './wechatStickerImagePayload'
import { ChatInputBar } from './voiceInput/ChatInputBar'
import { VoiceOverlay, type VoiceGestureZone } from './voiceInput/VoiceOverlay'
import { VoiceMessageBubble } from './VoiceMessageBubble'
import {
  readMiniMaxCredentialsFromLocalStorage,
  readMiniMaxSpeechModelFromLocalStorage,
  synthesizeMiniMaxVoiceAudioBlob,
} from '../voiceprint/services/minimaxApi'
import { lookupBoundVoiceIdForCharacter } from '../voiceprint/characterVoiceMapStorage'
import {
  groupNoticeMemberNickname,
  isWechatGroupEventNoticeContent,
  stripWechatGroupEventNoticePrefix,
} from './groupChatEventNotice'
import { RecallNotice } from './RecallNotice'
import { RecallHistoryModal, type RecallHistoryRecord } from './RecallHistoryModal'
import { ShieldedMessageModal } from './ShieldedMessageModal'
import './chatRoomMotion.css'
import { TypingIndicatorBubble } from './chatRoom/TypingIndicatorBubble'
import { MemoizedMessageItem, chatMsgRenderFingerprint } from './chatRoom/MessageItem'
import { ChatMessageList } from './chatRoom/ChatMessageList'
import { probeChatRender, probeMemoDeps } from './chatRoom/chatRenderProbe'
import { useChatQueue } from './chatRoom/useChatQueue'
import {
  hasStashedOpponentRevealJobs,
  stashOpponentRevealJobs,
  takeStashedOpponentRevealJobs,
} from './chatRoom/opponentRevealQueueStore'
import { computeRevealDelayMs } from './chatRoom/computeRevealDelayMs'
import { useConsoleLogger } from './useConsoleLogger'

const VoiceCallPanelCompat = VoiceCallPanel as unknown as (
  props: ComponentProps<typeof VoiceCallPanel> & { initialAiText?: string }
) => ReactNode

const LUMI_DEFAULT_OPENING_BUBBLES = [
  '嗨，我是 Lumi，是您的专属小助手！',
  '您在这里遇到任何问题，都可以直接问我：比如 API/模型怎么配、人设/世界书怎么绑、发图看图怎么用、气泡主题/拆条怎么调等。你有什么困惑的地方吗？',
  '官方教程（建议收藏）：https://www.notion.so/Lumi-Phone-350d29002fd980fdafb8c00f3e13b2b6?source=copy_link',
]
const ENTER_DOUBLE_TAP_WINDOW_MS = 220
const ENTER_SINGLE_COMMIT_DELAY_MS = 80
const SEND_DEDUPE_WINDOW_MS = 600
const EMPTY_PERSONA_CONTACTS: readonly import('../../types').WeChatPersonaContact[] = []
const CHAT_VISIBLE_MSG_INITIAL = 30
const CHAT_VISIBLE_MSG_STEP = 30

/** 历史版本误将遇见线程写入微信库；展示与 AI 上下文均须排除 */
function stripLegacyMeetImportedWeChatMessages(
  rows: WeChatChatMessage[],
  peerCharacterId?: string,
): WeChatChatMessage[] {
  const cid = peerCharacterId?.trim()
  return rows.filter((m) => !isMeetImportedWeChatMessageId(m.id, cid || undefined))
}
/** IndexedDB phoneKv：按 `conversationKey` 存「当前会话最新一轮」弹幕；新一批生成时整键覆盖，各聊天室互不串 */
const WECHAT_DM_BULLETS_KV_PREFIX = 'wechat-dm-bullets-v1'

function clearWeChatDmBulletsKv(conversationKey: string): void {
  void personaDb.setPhoneKv(`${WECHAT_DM_BULLETS_KV_PREFIX}:${conversationKey}`, { v: 1, bullets: [] })
}
/** 群聊：每名角色单次「出场」最多落几条气泡再交给下一名，避免一人连刷一长串 */
const hasSpeechRecognitionApi = true
const VOICE_HOLD_START_MS = 180
const VOICE_TAP_MOVE_THRESHOLD_PX = 12
import {
  estimateVoiceDurationSecFromScript,
  normalizeVoiceScriptForTts,
  pickVoiceEmotionForTts,
  sanitizeVoiceControlForTextBubble,
  sanitizeVoiceTranscriptDisplay,
  stripEmotionTagsForTts,
  voiceTranscriptDuplicatesPlainTexts,
} from './wechatVoiceScript'

type RoundDanmakuInlineConfig = {
  enabled: true
  useMemory: boolean
  generateCount: number
  customPrompt?: string
}

function resolveDanmakuApiForRequest(
  danmakuApiConfig: ApiConfig | null,
  chatApiConfig: ApiConfig | null,
): ApiConfig | null {
  const usable = (cfg: ApiConfig | null | undefined) =>
    cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim() ? cfg : null
  return usable(danmakuApiConfig) ?? usable(chatApiConfig)
}

async function resolveRoundDanmakuInlineConfig(params: {
  danmakuEnabled: boolean
  effectiveDm: EffectiveDanmakuVisuals | null
  personaCharacterId?: string
  conversationCharacterId: string
}): Promise<{ config?: RoundDanmakuInlineConfig; visuals: EffectiveDanmakuVisuals | null }> {
  if (!params.danmakuEnabled) return { visuals: null }
  let visuals = params.effectiveDm
  if (!visuals) {
    try {
      const g = await personaDb.getGlobalSettings()
      const pid = (params.personaCharacterId?.trim() || params.conversationCharacterId.trim()) || ''
      const row =
        pid && g.danmakuScopeMode === 'character'
          ? await personaDb.getCharacterDanmakuSettings(pid)
          : null
      visuals = resolveEffectiveDanmakuVisuals(g, pid, row)
    } catch {
      visuals = null
    }
  }
  if (!visuals || visuals.skipCharacter) return { visuals, config: undefined }
  return {
    visuals,
    config: {
      enabled: true,
      useMemory: visuals.useMemory,
      generateCount: visuals.generateCount,
      customPrompt: visuals.customPrompt.trim() || undefined,
    },
  }
}
const VOICE_ALLOWED_EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral', 'calm', 'fluent', 'whisper'] as const
function makeStableLumiOpeningId(conversationKey: string, index: number): string {
  const key = conversationKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 48)
  return `wxm-${key}-lumi-open-${index}`
}

function makeStablePersonaOpeningId(conversationKey: string, index: number): string {
  const key = conversationKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 48)
  return `wxm-${key}-persona-open-${index}`
}

function itemsToTranscript(items: ChatItem[], opts?: { groupSpeakerLabel?: (m: ChatMsg) => string | undefined }): ChatTranscriptTurn[] {
  const miniGameMsgs = items
    .filter((x): x is ChatMsg => x.kind === 'msg' && !!x.miniGameInvite)
    .map((m) => ({ id: m.id, from: m.from, miniGameInvite: m.miniGameInvite }))
  return items
    .filter((x): x is ChatMsg => x.kind === 'msg')
    .map((m) => {
      const speakerLabel = opts?.groupSpeakerLabel?.(m)
      if (m.mutedMessageVisibleToModeratorsOnly) {
        const who = m.from === 'self' ? '用户' : speakerLabel || '群成员'
        return {
          id: m.id,
          from: m.from,
          text: `（${who}在禁言期间发言；气泡侧已隐藏，仅系统灰条提示）`,
          speakerLabel,
        }
      }
      if (m.isRecalled) {
        const who = m.from === 'self' ? '用户' : speakerLabel || '对方'
        return { id: m.id, from: m.from, text: `（${who}撤回了一条消息）`, speakerLabel }
      }
      if (m.isGroupEventStrip && m.text?.trim()) {
        return { id: m.id, from: m.from, text: `（系统）${m.text.trim()}`, speakerLabel }
      }
      if (m.voice) {
        const txt = m.voice.transcriptText?.trim() || m.text?.trim() || '（语音）'
        const emo = m.voice.emotionLabel?.trim()
        const who = m.from === 'self' ? '用户语音' : `${speakerLabel || '对方'}语音`
        const voiceText = emo ? `（${who}，情绪：${emo}）${txt}` : `（${who}）${txt}`
        return { id: m.id, from: m.from, text: voiceText, replyTo: m.replyTo, speakerLabel }
      }
      if (m.musicSync) {
        const ms = m.musicSync
        if (ms.kind === 'music_invite') {
          return {
            id: m.id,
            from: m.from,
            text:
              m.from === 'self'
                ? formatMusicSyncInviteTranscriptLine(m.id, ms)
                : formatCharacterMusicSyncInviteTranscriptLine(m.id, ms),
            replyTo: m.replyTo,
            speakerLabel,
          }
        }
        if (ms.kind === 'music_accept') {
          return {
            id: m.id,
            from: m.from,
            text: `（已接受音乐共听）${ms.replyText}`,
            replyTo: m.replyTo,
            speakerLabel,
          }
        }
        if (ms.kind === 'music_decline') {
          return {
            id: m.id,
            from: m.from,
            text: `（已拒绝音乐共听）${ms.replyText}`,
            replyTo: m.replyTo,
            speakerLabel,
          }
        }
      }
      if (m.miniGameInvite) {
        const mg = m.miniGameInvite
        if (mg.kind === 'game_invite') {
          return {
            id: m.id,
            from: m.from,
            text:
              m.from === 'self'
                ? formatMiniGameInviteTranscriptLineWithResult(m.id, mg, {
                    appendMatchResult: shouldAppendMiniGameMatchResultOnInvite(mg, miniGameMsgs),
                  })
                : formatCharacterMiniGameInviteTranscriptLine(m.id, mg),
            replyTo: m.replyTo,
            speakerLabel,
          }
        }
        if (mg.kind === 'game_accept') {
          return {
            id: m.id,
            from: m.from,
            text: formatMiniGameAcceptTranscriptLine(mg),
            replyTo: m.replyTo,
            speakerLabel,
          }
        }
        if (mg.kind === 'game_decline') {
          return {
            id: m.id,
            from: m.from,
            text: `（已拒绝游戏邀请）${mg.replyText}`,
            replyTo: m.replyTo,
            speakerLabel,
          }
        }
      }
      if (m.listenCommentShare) {
        const lc = m.listenCommentShare
        return {
          id: m.id,
          from: m.from,
          text: formatListenCommentShareAiTranscriptLine(lc),
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      if (m.listenProfileShare) {
        const lp = m.listenProfileShare
        return {
          id: m.id,
          from: m.from,
          text: formatListenProfileShareAiTranscriptLine(lp),
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      if (m.listenTrackShare) {
        const lt = m.listenTrackShare
        return {
          id: m.id,
          from: m.from,
          text: formatListenTrackShareAiTranscriptLine(lt),
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      if (m.locationShare) {
        return {
          id: m.id,
          from: m.from,
          text: formatLocationShareAiTranscriptLine(m.locationShare, m.from === 'self' ? 'self' : 'other'),
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      if (m.pulseShare) {
        return {
          id: m.id,
          from: m.from,
          text: formatPulseShareAiTranscriptLine(m.pulseShare, m.from === 'self' ? 'self' : 'other'),
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      if (m.sharedRecord) {
        const sr = m.sharedRecord
        const typeLabel =
          sr.recordType === 'voice' ? '语音收藏' : sr.recordType === 'image' ? '图片收藏' : '文字收藏'
        return {
          id: m.id,
          from: m.from,
          text: `（用户向你转发一条【收藏】；正文非当前对话原句）类型：${typeLabel}；内容：${sr.contentSummary}`,
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      if (m.chatHistory) {
        return {
          id: m.id,
          from: m.from,
          text: formatChatHistoryForAiTranscript({
            payload: m.chatHistory,
            from: m.from,
          }),
          replyTo: m.replyTo,
          speakerLabel,
        }
      }
      const stickerLine = stickerTranscriptTextFromFields(m.text, m.stickerRef)
      if (stickerLine) {
        return { id: m.id, from: m.from, text: stickerLine, replyTo: m.replyTo, speakerLabel }
      }
      const text = m.text?.trim()
      if (text) return { id: m.id, from: m.from, text, replyTo: m.replyTo, speakerLabel }
      if (m.images?.length)
        return { id: m.id, from: m.from, text: '（发送了一张图片）', replyTo: m.replyTo, speakerLabel }
      return { id: m.id, from: m.from, text: '', replyTo: m.replyTo, speakerLabel }
    })
    .filter((t) => t.text.trim())
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

function mapDbRecalledByToChatUi(m: Pick<WeChatChatMessage, 'recalledBy'>): ChatMsg['recalledBy'] | undefined {
  const r = m.recalledBy
  if (r === 'moderator') return 'moderator'
  if (r === 'character') return 'other'
  if (r === 'player') return 'self'
  return undefined
}

/** 群聊：禁言期间落库的「原文」消息不在气泡侧展示（全员一致）；仅系统灰条 + 群主/管理员可点「查看」读档。 */
function filterGroupChatItemsHideModeratorOnlyBubbles(
  items: ChatItem[],
  roomType: 'private' | 'group',
  group: GroupChatRow | null,
): ChatItem[] {
  void group
  if (roomType !== 'group') return items
  return items.filter((it) => {
    if (it.kind === 'msg' && it.mutedMessageVisibleToModeratorsOnly) return false
    return true
  })
}

/** 群 NPC（不含用户占位、群管家） */
function filterGroupNpcMembersExcludingUserAndBot(members: GroupChatRow['members'] | undefined): GroupMember[] {
  return (members ?? []).filter(
    (m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID && m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID,
  )
}

/**
 * 多角色群 AI 用成员列表：优先当前未禁言的 NPC；若全员禁言则退回含禁言的全部 NPC，
 * 仍走模型输出 + 客户端「隐藏灰条」管线。
 */
function pickGroupNpcMembersForAiTurn(group: GroupChatRow | null | undefined, nowMs: number): GroupMember[] {
  const base = filterGroupNpcMembersExcludingUserAndBot(group?.members)
  const unblocked = base.filter((m) => !m.isMuted && !groupMemberSpeechBlockedInGroup(m, nowMs))
  return unblocked.length ? unblocked : base
}

function mapWeChatMessagesToChatItems(msgs: WeChatChatMessage[]): ChatMsg[] {
  if (msgs.length === 0) {
    return []
  }
  const mapped: ChatMsg[] = []
  for (const raw of msgs) {
    const m = repairStoredVoiceMessageRow(raw)
    if (
      m.type === 'character' &&
      m.characterId?.trim() === WECHAT_GROUP_BOT_CHARACTER_ID &&
      typeof m.content === 'string' &&
      isWechatGroupEventNoticeContent(m.content)
    ) {
      mapped.push({
        id: m.id,
        kind: 'msg',
        from: 'other',
        text: stripWechatGroupEventNoticePrefix(m.content),
        thinking: m.thinking,
        timestamp: m.timestamp,
        storyTimeLabel: m.storyTimeLabel,
        replyTo: m.replyTo,
        images: m.images,
        imageGenPending: m.imageGenPending,
        imageGenAwaitingConfirm: m.imageGenAwaitingConfirm,
        imageGenFailed: m.imageGenFailed,
        imageDescription: m.imageDescription,
        imageGenPrompt: m.imageGenPrompt,
        redPacket: m.redPacket,
        transfer: m.transfer,
        callStatus: m.callStatus,
        voice: m.voice,
        musicSync: m.musicSync,
        miniGameInvite: m.miniGameInvite,
        listenCommentShare: m.listenCommentShare,
        listenProfileShare: m.listenProfileShare,
        listenTrackShare: m.listenTrackShare,
        locationShare: m.locationShare,
        takeoutOrder: m.takeoutOrder,
        pulseShare: m.pulseShare,
        sharedRecord: m.sharedRecord,
        originalText: m.originalContent,
        isRecalled: m.isRecalled,
        recallTimestamp: m.recallTimestamp,
        recalledBy: mapDbRecalledByToChatUi(m),
        status: 'sent',
        senderCharacterId: WECHAT_GROUP_BOT_CHARACTER_ID,
        isGroupEventStrip: true,
      })
      continue
    }
    const ext = m.ext
    let bodyText = m.content
    if (
      m.type === 'character' &&
      !m.musicSync &&
      !m.locationShare &&
      !m.takeoutOrder &&
      typeof bodyText === 'string' &&
      (isMusicSyncDirectiveArtifactLine(bodyText) ||
        isCharacterMusicSyncDirectiveArtifactLine(bodyText) ||
        isMiniGameDirectiveArtifactLine(bodyText))
    ) {
      continue
    }
    if (
      m.type === 'character' &&
      !m.locationShare &&
      !m.takeoutOrder &&
      typeof bodyText === 'string' &&
      isLocationShareDirectiveArtifactLine(bodyText)
    ) {
      continue
    }
    if (
      m.type === 'character' &&
      !m.takeoutOrder &&
      typeof bodyText === 'string' &&
      isTakeoutOrderDirectiveArtifactLine(bodyText)
    ) {
      continue
    }
    if (m.type === 'character' && typeof bodyText === 'string' && isPulseCommentDirectiveArtifactLine(bodyText)) {
      continue
    }
    if (m.type === 'character' && typeof bodyText === 'string' && isPulseFollowDirectiveArtifactLine(bodyText)) {
      continue
    }
    if (
      m.type === 'character' &&
      m.characterId?.trim() === WECHAT_GROUP_BOT_CHARACTER_ID &&
      typeof m.content === 'string' &&
      !isWechatGroupEventNoticeContent(m.content)
    ) {
      bodyText = normalizeGroupSmartBotBubblePlaintext(m.content, null)
    }
    const resolvedChatHistory = m.chatHistory ?? resolveChatHistoryFromStoredMessage(m) ?? undefined
    mapped.push({
      id: m.id,
      kind: 'msg',
      from: m.type === 'player' ? 'self' : 'other',
      text: resolvedChatHistory ? '[聊天记录]' : bodyText,
      thinking: m.thinking,
      timestamp: m.timestamp,
      storyTimeLabel: m.storyTimeLabel,
      replyTo: m.replyTo,
      images: m.images,
      imageGenPending: m.imageGenPending,
      imageGenAwaitingConfirm: m.imageGenAwaitingConfirm,
      imageGenFailed: m.imageGenFailed,
      imageDescription: m.imageDescription,
      imageGenPrompt: m.imageGenPrompt,
      redPacket: m.redPacket,
      transfer: m.transfer,
      callStatus: m.callStatus,
      voice: m.voice,
      musicSync: m.musicSync,
      miniGameInvite: m.miniGameInvite,
      listenCommentShare: m.listenCommentShare,
      listenProfileShare: m.listenProfileShare,
      listenTrackShare: m.listenTrackShare,
      locationShare: m.locationShare,
      takeoutOrder: m.takeoutOrder,
      pulseShare: m.pulseShare,
      sharedRecord: m.sharedRecord,
      chatHistory: resolvedChatHistory,
      stickerRef: m.stickerRef,
      originalText: m.originalContent,
      isRecalled: m.isRecalled,
      recallTimestamp: m.recallTimestamp,
      recalledBy: mapDbRecalledByToChatUi(m),
      status: 'sent',
      senderCharacterId: m.type === 'character' ? m.characterId : undefined,
      isSystemCenterStrip: ext?.centerSystemStrip === true,
      groupBotDarkBubble: ext?.groupBotDarkBubble === true,
      shieldedMessageContent:
        typeof ext?.shieldedMessageContent === 'string' ? ext.shieldedMessageContent : undefined,
      muteSuppressStrip: ext?.muteSuppressStrip === true,
      mutedMessageVisibleToModeratorsOnly: ext?.mutedMessageVisibleToModeratorsOnly === true,
    })
  }
  return mapped
}

/** 己方消息但实为「收到对方转账后的确认/退还」ack：须用 incoming 文案（已收款 / 已退还），不能用 outgoing */
function resolveSelfTransferAckBubblePerspective(
  m: ChatMsg,
  isSelf: boolean,
  playerIdentityId: string,
  getCurrentTime: () => number,
): TransferBubblePerspective | undefined {
  const tid = m.transfer?.transferId?.trim()
  if (!tid || !isSelf) return undefined
  const pid = playerIdentityId.trim()
  if (!pid || pid === '__none__') return undefined
  const rec = getLumiTransferFresh(tid, getCurrentTime)
  if (!rec || rec.senderId === pid) return undefined
  const mid = m.id.trim()
  if (mid.startsWith('wxtr-recv-ack-') || mid.startsWith('wxtr-recv-return-ack-')) return 'incoming'
  return undefined
}

function rebuildChatItemsWithTimestamps(msgs: ChatMsg[], formatWxTimeLabel: (ts: number) => string, nowMs: number): ChatItem[] {
  if (msgs.length === 0) {
    return [{ id: `t-empty-${nowMs}`, kind: 'time', text: formatWxTimeLabel(nowMs) }]
  }
  const next: ChatItem[] = []
  let lastShownTime: number | null = null
  for (const msg of msgs) {
    if (shouldRenderWeChatTimestamp(lastShownTime, msg.timestamp)) {
      next.push({
        id: `t-${msg.id}-${msg.timestamp}`,
        kind: 'time',
        text: formatWxTimeLabel(msg.timestamp),
      })
      lastShownTime = msg.timestamp
    }
    next.push(msg)
  }
  return next
}

function messagePlainPreview(
  msg: Pick<
    ChatMsg,
    'text' | 'images' | 'imageGenPending' | 'imageGenAwaitingConfirm' | 'imageGenFailed' | 'redPacket' | 'transfer' | 'callStatus' | 'voice' | 'musicSync' | 'miniGameInvite' | 'listenCommentShare' | 'listenProfileShare' | 'listenTrackShare' | 'locationShare' | 'takeoutOrder' | 'pulseShare' | 'sharedRecord' | 'chatHistory' | 'isRecalled' | 'isGroupEventStrip'
  >,
): string {
  if (msg.isGroupEventStrip && msg.text?.trim()) return msg.text.trim()
  if (msg.isRecalled) return '该消息已撤回'
  if (msg.transfer) return '[转账]'
  if (msg.callStatus) return '[通话]'
  if (msg.voice) return `[语音] ${Math.max(1, Math.round(msg.voice.durationSec || 1))}"`
  const ms = msg.musicSync
  if (ms?.kind === 'music_invite') return `[音乐共听] ${ms.trackTitle}`
  if (ms?.kind === 'music_accept') return '[频率已接轨]'
  if (ms?.kind === 'music_decline') return '[错失的波段]'
  const mg = msg.miniGameInvite
  if (mg?.kind === 'game_invite') {
    const outcome = playerSideMatchOutcome(mg.matchResult)
    if (outcome) {
      const label = outcome === 'win' ? '你赢了' : outcome === 'lose' ? '你输了' : '和棋'
      return `[游戏邀请] ${mg.gameTitle} · ${label}`
    }
    if (mg.userResponded === 'accepted') return `[游戏邀请] ${mg.gameTitle} · 已接受`
    if (mg.userResponded === 'declined') return `[游戏邀请] ${mg.gameTitle} · 已拒绝`
    return `[游戏邀请] ${mg.gameTitle}`
  }
  if (mg?.kind === 'game_accept') {
    const outcome = charSideMatchOutcome(mg.matchResult)
    if (outcome) {
      const label = outcome === 'win' ? '你赢了' : outcome === 'lose' ? '你输了' : '和棋'
      return `[已接受游戏邀请] · ${label}`
    }
    return '[已接受游戏邀请]'
  }
  if (mg?.kind === 'game_decline') return '[已拒绝游戏邀请]'
  if (msg.listenCommentShare) return `[分享评论] ${msg.listenCommentShare.targetTitle}`
  if (msg.listenProfileShare) return `[分享主页] ${msg.listenProfileShare.displayName}`
  if (msg.listenTrackShare) {
    const prefix = msg.listenTrackShare.targetType === 'song' ? '[分享单曲]' : '[分享歌单]'
    return `${prefix} ${msg.listenTrackShare.targetTitle}`
  }
  if (msg.locationShare) return '[位置]'
  if (msg.takeoutOrder) return `[外卖] ${msg.takeoutOrder.storeName}`
  if (msg.pulseShare) return `[微博] ${msg.pulseShare.authorName}`
  if (msg.sharedRecord) return '[收藏]'
  if (msg.chatHistory) return '[聊天记录]'
  const rp = msg.redPacket
  if (rp) {
    const r = rp.remark?.trim()
    return r ? `[红包] ${r}` : '[红包]'
  }
  const t = msg.text?.trim()
  if (t) return t
  if (msg.imageGenPending) return '[图片]（生成中）'
  if (msg.imageGenAwaitingConfirm) return '[图片]（待生成）'
  if (msg.imageGenFailed) return '[图片]（生成失败）'
  if (msg.images?.length) return '[图片]'
  return '...'
}

function parseReplyMarker(raw: string): { replyMessageId?: string; text: string } {
  const line = String(raw ?? '')
    // 无论出现在行首/行中/行尾，都剥离模型泄露的内部消息ID标记
    .replace(/\s*(?:\[消息ID[:：][^\]]+\]|【消息ID[:：][^】]+】)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!line) return { text: '' }
  const inline = line.match(/^\[引用[:：]([^\]]+)\]\s*(.*)$/)
  if (inline) {
    return {
      replyMessageId: inline[1]?.trim() || undefined,
      text: (inline[2] ?? '').trim(),
    }
  }
  const pure = line.match(/^\[引用[:：]([^\]]+)\]$/)
  if (pure) return { replyMessageId: pure[1]?.trim() || undefined, text: '' }
  // 兼容旧格式：
  // [引用回复] 本条正在回复：消息ID=xxx; 发送者=xxx; 原文=xxx; <正文>
  // 以及仅有头部、正文另起一行/下一条的场景
  const legacyHeader = line.match(
    /^\[引用回复\]\s*本条正在回复[:：]\s*消息ID\s*[=：:]\s*([^;；\s]+)\s*[;；]?\s*([\s\S]*)$/,
  )
  if (legacyHeader) {
    const replyMessageId = legacyHeader[1]?.trim() || undefined
    const tail = (legacyHeader[2] ?? '').trim()
    // 尽量剥离 "发送者=...; 原文=...;" 的元信息，保留真正正文
    const text = tail
      .replace(/^(?:发送者\s*[=：:]\s*[^;；\n]+[;；]?\s*)+/u, '')
      .replace(/^(?:原文\s*[=：:]\s*[^;；\n]+[;；]?\s*)+/u, '')
      .trim()
    return { replyMessageId, text }
  }
  return { text: line }
}

/** 将模型气泡行拉平（与逐行循环里的换行展开一致），供纯文本批量渲染 */
function flattenBubbleLinesForBatch(source: string[]): string[] {
  const out: string[] = []
  for (const raw0 of source) {
    const normalizedRawLine = String(raw0 ?? '').trim().replace(/\\n/g, '\n').trim()
    const parts = normalizedRawLine
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (parts.length > 1) out.push(...parts)
    else if (normalizedRawLine) out.push(normalizedRawLine)
  }
  return coalescePulseCommentBlocksInLines(out)
}

/** 需走完整分支（语音/红包/撤回/引用等）时为 true；纯文本批量路径为 false */
function bubbleLineNeedsSpecialBubbleHandler(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return false
  if (t === WECHAT_RECALL_ACTION_TOKEN) return true
  if (/^(?:\[语音\]|【语音】)\s*/.test(t)) return true
  if (parseRedPacketDirective(t)) return true
  if (parseTransferDirective(t)) return true
  if (parseTransferIncomingActionDirective(t)) return true
  if (parseRedPacketOpenDirective(t)) return true
  if (parseVoiceCallDirective(t)) return true
  if (parseCharacterStickerLine(t)) return true
  if (parseCharacterImageGenLine(t)) return true
  if (parseCharacterProfileImageApplyDirective(t)) return true
  if (parseCharacterWechatProfileUpdateDirective(t)) return true
  if (parseCharacterMomentPinDirective(t)) return true
  if (parseMusicSyncIncomingActionDirective(t)) return true
  if (isMusicSyncDirectiveArtifactLine(t)) return true
  if (parseMiniGameInviteActionDirective(t)) return true
  if (isMiniGameDirectiveArtifactLine(t)) return true
  if (parseCharacterMiniGameInviteDirectiveFromArtifactLine(t)) return true
  if (isCharacterMiniGameInviteDirectiveArtifactLine(t)) return true
  if (parseCharacterMusicSyncDirectiveFromArtifactLine(t)) return true
  if (isCharacterMusicSyncDirectiveArtifactLine(t)) return true
  if (isLocationShareDirectiveArtifactLine(t)) return true
  if (parseLocationShareDirective(t)) return true
  if (isTakeoutOrderDirectiveArtifactLine(t)) return true
  if (parseTakeoutOrderDirective(t)) return true
  if (isPulseCommentDirectiveArtifactLine(t)) return true
  if (parsePulseCommentDirective(t)) return true
  if (isPulseFollowDirectiveArtifactLine(t)) return true
  if (parsePulseFollowDirective(t)) return true
  if (isPulseDmScreenshotDirectiveArtifactLine(t)) return true
  return false
}

function parseBusyDirective(raw: string): { reason: string; duration: number } | null {
  const line = String(raw ?? '')
    .replace(/```(?:json)?/gi, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
  const busyIdx = line.toUpperCase().indexOf('[BUSY]')
  if (busyIdx < 0) return null
  const after = line.slice(busyIdx + '[BUSY]'.length)
  const left = after.indexOf('{')
  const right = after.lastIndexOf('}')
  if (left < 0 || right <= left) return null
  const jsonRaw = after.slice(left, right + 1)
  try {
    const j = JSON.parse(jsonRaw) as { reason?: unknown; duration?: unknown }
    const reason = String(j.reason ?? '').trim() || '暂时有事'
    const duration = Math.min(120, Math.max(1, Math.round(Number(j.duration ?? 15) || 15)))
    return { reason, duration }
  } catch {
    return null
  }
}

type AiRedPacketDirective = { amountYuan: number; remark: string }
type AiTransferDirective = { amountYuan: number; remark: string }
type AiVoiceCallDirective = { type: 'start'; openingLine?: string }

function pickMoneyJsonRemark(j: { remark?: unknown; memo?: unknown }, maxLen: number): string {
  const r = String(j.remark ?? '').trim()
  if (r) return r.slice(0, maxLen)
  return String(j.memo ?? '').trim().slice(0, maxLen)
}

/** 整行即「展示用」红包文案（模型常误把会话里的 `[红包]…` 当指令输出，无 `[REDPACKET]`） */
const RED_PACKET_UI_SHORTHAND_DEFAULT_YUAN = 8.88
/** 整行即「展示用」转账文案（模型常误只输出 `[转账]`） */
const TRANSFER_UI_SHORTHAND_DEFAULT_YUAN = 88

function parseRedPacketDirective(raw: string): AiRedPacketDirective | null {
  let line = String(raw ?? '').trim()
  if (line.startsWith('【红包】')) line = `[红包]${line.slice('【红包】'.length)}`
  const m = /^\[REDPACKET\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (m) {
    try {
      const j = JSON.parse(m[1]!) as { amount?: unknown; remark?: unknown; memo?: unknown }
      const amountRaw = Number(j.amount)
      const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
      const remark = pickMoneyJsonRemark(j, 64)
      if (!Number.isFinite(amountYuan) || amountYuan < 0.01 || amountYuan > 200) return null
      return { amountYuan, remark }
    } catch {
      return null
    }
  }
  const mSend = /^\[REDPACKET_SEND\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (mSend) {
    try {
      const j = JSON.parse(mSend[1]!) as { amount?: unknown; remark?: unknown; memo?: unknown; count?: unknown }
      const amountRaw = Number(j.amount)
      const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
      const remark = pickMoneyJsonRemark(j, 64)
      if (!Number.isFinite(amountYuan) || amountYuan < 0.01 || amountYuan > 200) return null
      return { amountYuan, remark }
    } catch {
      return null
    }
  }
  const hb = /^\[红包\]\s*(.*)$/s.exec(line)
  if (!hb) return null
  const remark = String(hb[1] ?? '').trim().slice(0, 64)
  return { amountYuan: RED_PACKET_UI_SHORTHAND_DEFAULT_YUAN, remark }
}

function parseTransferDirective(raw: string): AiTransferDirective | null {
  let line = String(raw ?? '').trim()
  if (line.startsWith('【转账】')) line = `[转账]${line.slice('【转账】'.length)}`
  const m = /^\[TRANSFER\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (m) {
    try {
      const j = JSON.parse(m[1]!) as { amount?: unknown; remark?: unknown; memo?: unknown }
      const amountRaw = Number(j.amount)
      const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
      const remark = pickMoneyJsonRemark(j, 40)
      if (!Number.isFinite(amountYuan) || amountYuan < 0.01) return null
      return { amountYuan, remark }
    } catch {
      return null
    }
  }
  const mSend = /^\[TRANSFER_SEND\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (mSend) {
    try {
      const j = JSON.parse(mSend[1]!) as { amount?: unknown; remark?: unknown; memo?: unknown }
      const amountRaw = Number(j.amount)
      const amountYuan = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : Number.NaN
      const remark = pickMoneyJsonRemark(j, 40)
      if (!Number.isFinite(amountYuan) || amountYuan < 0.01) return null
      return { amountYuan, remark }
    } catch {
      return null
    }
  }
  const tf = /^\[转账\]\s*(.*)$/s.exec(line)
  if (!tf) return null
  const remark = String(tf[1] ?? '').trim().slice(0, 40)
  return { amountYuan: TRANSFER_UI_SHORTHAND_DEFAULT_YUAN, remark }
}

/** 角色将用户发出的未拆红包标为已拆：须单独占一行；不写此行则仅靠用户自己在气泡上拆开 */
function parseRedPacketOpenDirective(raw: string): { messageId?: string } | null {
  const line = String(raw ?? '').trim()
  const m = /^\[REDPACKET_OPEN\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (!m) return null
  try {
    const j = JSON.parse(m[1]!) as { messageId?: unknown }
    const mid = typeof j.messageId === 'string' ? j.messageId.trim() : ''
    return { messageId: mid || undefined }
  } catch {
    return null
  }
}

function resolveSelfUnopenedRedPacketMessageId(params: { messageIdHint?: string; msgs: ChatMsg[] }): string | null {
  const hint = params.messageIdHint?.trim()
  const msgs = params.msgs
  const isOpenableSelfPacket = (m: ChatMsg): boolean =>
    m.kind === 'msg' &&
    m.from === 'self' &&
    !!m.redPacket &&
    !m.redPacket.opened &&
    !m.redPacket.expired
  if (hint) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.kind !== 'msg' || m.id !== hint) continue
      if (isOpenableSelfPacket(m)) return m.id
      return null
    }
    return null
  }
  /**
   * 无 messageId：只认领「时间上最近」的未拆红包。
   * 若从最新消息往回扫时先碰到己方转账气泡，视为模型误输出 `[REDPACKET_OPEN]`（应收款应走 `[TRANSFER_ACCEPT]`），勿再去匹配更早的红包以免出现「领取红包」灰条。
   */
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m.kind !== 'msg' || m.from !== 'self') continue
    if (m.transfer?.transferId?.trim()) return null
    if (isOpenableSelfPacket(m)) return m.id
  }
  return null
}

/** 角色对用户转入账款的确认收款 / 拒收退还（不产生新气泡，仅改本地转账记录） */
function parseTransferIncomingActionDirective(raw: string): { kind: 'accept' | 'return'; messageId?: string } | null {
  const line = String(raw ?? '').trim()
  const tryOne = (tag: string, kind: 'accept' | 'return') => {
    const m = new RegExp(`^\\[${tag}\\]\\s*(\\{[\\s\\S]*\\})$`, 'i').exec(line)
    if (!m) return null
    try {
      const j = JSON.parse(m[1]!) as { messageId?: unknown }
      const mid = typeof j.messageId === 'string' ? j.messageId.trim() : ''
      return { kind, messageId: mid || undefined }
    } catch {
      return null
    }
  }
  return tryOne('TRANSFER_ACCEPT', 'accept') ?? tryOne('TRANSFER_RETURN', 'return')
}

function resolveIncomingTransferForCharacter(params: {
  messageIdHint: string | undefined
  msgs: ChatMsg[]
  conversationKey: string
  characterId: string
  playerIdentityId: string
  getCurrentTime: () => number
}): string | null {
  const { messageIdHint, msgs, conversationKey, characterId, playerIdentityId, getCurrentTime } = params
  evaluateExpiredTransfers(getCurrentTime)
  const validIncoming = (tid: string): boolean => {
    const rec = getLumiTransferFresh(tid, getCurrentTime)
    if (!rec || rec.conversationKey !== conversationKey) return false
    if (rec.senderId !== playerIdentityId || rec.receiverId !== characterId) return false
    return rec.status === 'pending'
  }
  if (messageIdHint?.trim()) {
    const hint = messageIdHint.trim()
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.kind !== 'msg' || m.id !== hint) continue
      if (m.from !== 'self' || !m.transfer?.transferId) continue
      const tid = m.transfer.transferId.trim()
      if (validIncoming(tid)) return tid
    }
    if (validIncoming(hint)) return hint
  }
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m.kind !== 'msg' || m.from !== 'self' || !m.transfer?.transferId) continue
    const tid = m.transfer.transferId.trim()
    if (validIncoming(tid)) return tid
  }
  return null
}

/**
 * 模型常误用 `[REDPACKET_OPEN]` 收下用户转账（尤其把 `messageId` 填成 `wxtr-…` 转账 id）。
 * 若可唯一对应一笔仍 pending 的「用户→当前角色」转账，返回其 transferId，按收款处理；否则返回 null 走红包逻辑。
 */
function resolveTransferIdFromMisplacedRedPacketOpen(params: {
  messageIdHint: string | undefined
  msgs: ChatMsg[]
  conversationKey: string
  characterId: string
  playerIdentityId: string
  getCurrentTime: () => number
}): string | null {
  const { messageIdHint, msgs, conversationKey, characterId, playerIdentityId, getCurrentTime } = params
  const hint = messageIdHint?.trim()
  if (!hint) {
    const anyOpenablePacket = resolveSelfUnopenedRedPacketMessageId({
      messageIdHint: undefined,
      msgs,
    })
    if (anyOpenablePacket) return null
    return resolveIncomingTransferForCharacter({
      messageIdHint: undefined,
      msgs,
      conversationKey,
      characterId,
      playerIdentityId,
      getCurrentTime,
    })
  }
  const lower = hint.toLowerCase()
  if (lower.startsWith('wxtr-')) {
    return resolveIncomingTransferForCharacter({
      messageIdHint: hint,
      msgs,
      conversationKey,
      characterId,
      playerIdentityId,
      getCurrentTime,
    })
  }
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m.kind !== 'msg' || m.id !== hint) continue
    const tid = m.transfer?.transferId?.trim()
    if (!tid) return null
    return resolveIncomingTransferForCharacter({
      messageIdHint: tid,
      msgs,
      conversationKey,
      characterId,
      playerIdentityId,
      getCurrentTime,
    })
  }
  return resolveIncomingTransferForCharacter({
    messageIdHint: hint,
    msgs,
    conversationKey,
    characterId,
    playerIdentityId,
    getCurrentTime,
  })
}

function parseVoiceCallDirective(raw: string): AiVoiceCallDirective | null {
  const line = String(raw ?? '').trim()
  const m =
    /^\[VOICECALL\]\s*(\{[\s\S]*\})$/i.exec(line) ??
    /^\[VOICECALL\s*(\{[\s\S]*\})\]$/i.exec(line)
  if (!m) return null
  try {
    const j = JSON.parse(m[1]!) as { type?: unknown; opening?: unknown; openingLine?: unknown; firstLine?: unknown }
    const t = String(j.type ?? '')
      .trim()
      .toLowerCase()
    if (t !== 'start') return null
    const openingRaw = j.openingLine ?? j.opening ?? j.firstLine
    const openingLine = typeof openingRaw === 'string' ? openingRaw.trim().slice(0, 120) : ''
    return openingLine ? { type: 'start', openingLine } : { type: 'start' }
  } catch {
    return null
  }
}

function extractDanmakuFromBubbleText(lines: string[]): { cleaned: string[]; danmakuLines: string[] } {
  const input = (lines ?? []).map((s) => String(s ?? '')).join('\n')
  const normalized = input
    .replace(/\\n/g, '\n')
    .replace(/\\<(\/?danmaku\b[^>]*)>/gi, '<$1>')
  const tagRe = /<danmaku\b[^>]*>([\s\S]*?)<\/danmaku>/gi
  const blocks: string[] = []
  const visible = normalized.replace(tagRe, (_all, body: string) => {
    blocks.push(String(body ?? '').trim())
    return ''
  })
  const cleaned = visible
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!blocks.length) return { cleaned, danmakuLines: [] }
  const dm: string[] = []
  for (const body of blocks) {
    try {
      const j = JSON.parse(body) as unknown
      if (Array.isArray(j)) {
        dm.push(...j.map((x) => String(x ?? '').trim()).filter(Boolean))
        continue
      }
    } catch {
      // ignore and fallback
    }
    dm.push(
      ...body
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
  }
  return { cleaned, danmakuLines: dm.slice(0, 20) }
}

function formatBusyCountdownByEndTime(endTimeMs: number, nowMs = Date.now()): string {
  const remainMs = Math.max(0, endTimeMs - nowMs)
  const totalSec = Math.ceil(remainMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}分${String(sec).padStart(2, '0')}秒`
}

function buildBusyToastText(peerName: string, reason: string, endTimeMs: number, nowMs = Date.now()): string {
  const cleanReason = reason.trim() || '处理点事情'
  const countdown = formatBusyCountdownByEndTime(endTimeMs, nowMs)
  return `${peerName}正在${cleanReason}\n预计还要 ${countdown}`
}

/** 离开子页再回聊天：恢复「正在输入」；须与 flush 结束时的清除配对，避免组件已卸载时丢状态 */
const WX_CHAT_AWAITING_AI_TYPING_PREFIX = 'wx-chat-awaiting-ai-typing:'
function chatAwaitingAiTypingStorageKey(conversationKey: string) {
  return `${WX_CHAT_AWAITING_AI_TYPING_PREFIX}${conversationKey.trim()}`
}
function persistChatAwaitingAiTyping(conversationKey: string, active: boolean) {
  const ck = conversationKey.trim()
  if (!ck) return
  try {
    if (active) sessionStorage.setItem(chatAwaitingAiTypingStorageKey(ck), '1')
    else sessionStorage.removeItem(chatAwaitingAiTypingStorageKey(ck))
  } catch {
    /* ignore */
  }
}
function readChatAwaitingAiTyping(conversationKey: string): boolean {
  const ck = conversationKey.trim()
  if (!ck) return false
  try {
    return sessionStorage.getItem(chatAwaitingAiTypingStorageKey(ck)) === '1'
  } catch {
    return false
  }
}

/** 离开聊天去子页时若仍有未露出的逐条队列：与 {@link persistChatAwaitingAiTyping} 配合，回聊天室后恢复顶栏/底部三点，首轮 hydrate 后再清 */
const WX_CHAT_TYPING_INTERRUPT_RECOVER_PREFIX = 'wx-chat-typing-interrupt-recover:'
function typingInterruptRecoverStorageKey(conversationKey: string) {
  return `${WX_CHAT_TYPING_INTERRUPT_RECOVER_PREFIX}${conversationKey.trim()}`
}
function persistTypingInterruptRecover(conversationKey: string, active: boolean) {
  const ck = conversationKey.trim()
  if (!ck) return
  try {
    if (active) sessionStorage.setItem(typingInterruptRecoverStorageKey(ck), '1')
    else sessionStorage.removeItem(typingInterruptRecoverStorageKey(ck))
  } catch {
    /* ignore */
  }
}
function readTypingInterruptRecover(conversationKey: string): boolean {
  const ck = conversationKey.trim()
  if (!ck) return false
  try {
    return sessionStorage.getItem(typingInterruptRecoverStorageKey(ck)) === '1'
  } catch {
    return false
  }
}

/** 将子元素顶对齐到容器可视区域顶部，ease-out 约 300ms */
function scrollChildToTopSmooth(
  container: HTMLElement,
  child: HTMLElement,
  durationMs: number,
  onDone?: () => void,
) {
  const cRect = container.getBoundingClientRect()
  const chRect = child.getBoundingClientRect()
  const targetTop = container.scrollTop + (chRect.top - cRect.top)
  const end = Math.max(0, targetTop)
  const start = container.scrollTop
  const t0 = performance.now()
  const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / durationMs)
    container.scrollTop = start + (end - start) * easeOut(t)
    if (t < 1) requestAnimationFrame(tick)
    else onDone?.()
  }
  requestAnimationFrame(tick)
}

function isScrollNearBottom(el: HTMLElement, thresholdPx = 28): boolean {
  const remain = el.scrollHeight - (el.scrollTop + el.clientHeight)
  return remain <= thresholdPx
}

function randomBetween(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1))
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const mime = (blob.type || 'audio/mpeg').trim().toLowerCase()
  const base64 = arrayBufferToBase64ForMedia(await blob.arrayBuffer())
  return `data:${mime};base64,${base64}`
}

type MsgStatus = 'sending' | 'sent' | 'failed'

type ChatMsg = {
  id: string
  kind: 'msg'
  from: 'self' | 'other'
  /** 群聊角色消息：发送者 characterId（机器人 / 各角色） */
  senderCharacterId?: string
  /** 居中系统浅灰条（违禁屏蔽等，与「【系统】」样式一致） */
  isSystemCenterStrip?: boolean
  /** 群助手黑底白字程序化回复 */
  groupBotDarkBubble?: boolean
  text: string
  thinking?: string
  timestamp: number
  /** 剧情时间展示（有则时间分隔行优先显示，不展示系统/沉浸墙钟） */
  storyTimeLabel?: string
  replyTo?: WeChatReplyToMeta
  images?: { base64: string; type: WeChatImageMime }[]
  imageGenPending?: boolean
  imageGenAwaitingConfirm?: boolean
  imageGenFailed?: boolean
  /** 给用户看的中文画面描述 */
  imageDescription?: string
  /** 英文生图提示词缓存 */
  imageGenPrompt?: string
  redPacket?: WeChatRedPacketPayload
  transfer?: WeChatTransferPayload
  callStatus?: { status: 'rejected' | 'no_answer' | 'duration'; durationSec?: number }
  voice?: {
    durationSec: number
    emotionAnalyzed?: boolean
    emotionLabel?: string
    ttsScript?: string
    audioUrl?: string
    transcriptText?: string
    voicePlayed?: boolean
  }
  musicSync?: WeChatMusicSyncPayload
  miniGameInvite?: WeChatMiniGamePayload
  listenCommentShare?: WeChatListenCommentSharePayload
  listenProfileShare?: WeChatListenProfileSharePayload
  listenTrackShare?: WeChatListenTrackSharePayload
  locationShare?: WeChatLocationPayload
  takeoutOrder?: WeChatTakeoutOrderPayload
  pulseShare?: WeChatPulseSharePayload
  sharedRecord?: WeChatSharedRecordPayload
  chatHistory?: WeChatChatHistoryPayload
  /** 表情包引用名（落库后供 AI 历史与防重复） */
  stickerRef?: string
  status?: MsgStatus
  /** 为 true 时播放对方消息入场动效 */
  otherAnimated?: boolean
  /** 为 true 时播放己方消息入场动效（与对方相同） */
  selfAnimated?: boolean
  originalText?: string
  isRecalled?: boolean
  recallTimestamp?: number
  recalledBy?: 'self' | 'other' | 'moderator'
  /** 群系统灰条（群名 / 本群昵称变更等），样式同撤回提示条 */
  isGroupEventStrip?: boolean
  /** 违禁系统条关联的被拦截原文（可点击查看） */
  shieldedMessageContent?: string
  /** 禁言未展示条：与 shieldedMessageContent 配套 */
  muteSuppressStrip?: boolean
  /** 禁言期间仍生成的发言：原文已落库；聊天气泡侧全员不展示，仅配套系统灰条供群主/管理员点「查看」 */
  mutedMessageVisibleToModeratorsOnly?: boolean
}

type ChatTime = { id: string; kind: 'time'; text: string }

/** 好友验证期与恢复私聊后的分界提示（仅界面，不落库） */
type ChatVerificationBanner = { id: string; kind: 'fr-verify-banner'; text: string }

type ChatItem = ChatMsg | ChatTime | ChatVerificationBanner

/** DB 合并 / hydrate 排序：时间相同则按 id 稳定次序，避免语音与后续句同毫秒时顺序翻转 */
function compareChatMsgByRevealOrder(a: ChatMsg, b: ChatMsg): number {
  const dt = (typeof a.timestamp === 'number' ? a.timestamp : 0) - (typeof b.timestamp === 'number' ? b.timestamp : 0)
  if (dt !== 0) return dt
  return a.id.localeCompare(b.id)
}

function dedupeChatMsgsById(msgs: ChatMsg[]): ChatMsg[] {
  const seen = new Set<string>()
  const out: ChatMsg[] = []
  for (const m of msgs) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}

/** 对方消息异步露出队列任务（延迟后并入 `items` 并落库） */
type OpponentRevealJob = {
  /** 入队时所属会话；与 {@link conversationKeyLiveRef} 不一致时只落库、不并入当前聊天列表 */
  forConversationKey: string
  msg: ChatMsg
  /** 在并入列表与 `persist` 之前执行（如：先 accept 转账，再展示接收方卡，以便与发送方「已收款」UI 同步） */
  beforeReveal?: () => void
  /**
   * 为 true 时：本条 `setItems` 用 flushSync，并在合并后立刻 `emitLumiTransferChanged`（须与 `beforeReveal` 内
   * `acceptLumiTransfer(..., { emitChanged: false })` 配对，避免发送方气泡早于接收方卡提交）。
   */
  opponentRevealFlushSync?: boolean
  persist: () => void
  afterReveal?: () => void
  /** 不展示气泡，仅按 delay 执行 beforeReveal / afterReveal（共听指令等在可见气泡露出后收尾） */
  revealCallbackOnly?: boolean
  revealCallbackDelayMs?: number
}

/** AI 对方消息逐条露出前的动态间隔（毫秒）：短句偏快，长句偏慢；语音按时长。 */
function computeOpponentStaggerDelayMs(msg: ChatMsg): number {
  return computeRevealDelayMs(msg)
}

function injectFriendRequestAcceptedDivider(items: ChatItem[], acceptedAtMs: number): ChatItem[] {
  if (!Number.isFinite(acceptedAtMs) || acceptedAtMs <= 0) return items
  const idx = items.findIndex((it) => it.kind === 'msg' && it.timestamp > acceptedAtMs)
  const banner: ChatVerificationBanner = {
    id: `wx-fr-verify-divider-${acceptedAtMs}`,
    kind: 'fr-verify-banner',
    text: '以上为验证消息',
  }
  if (idx < 0) {
    const hasMsg = items.some((it) => it.kind === 'msg')
    return hasMsg ? [...items, banner] : items
  }
  return [...items.slice(0, idx), banner, ...items.slice(idx)]
}

const GROUP_SHIELDED_ANNEX_MAX_ENTRIES = 8
const GROUP_SHIELDED_ANNEX_MAX_BODY = 600

function parseGroupShieldedVictimDisplayName(stripText: string, muteSuppress: boolean): string {
  const t = String(stripText ?? '').trim()
  if (muteSuppress) {
    const hit = t.match(/^(?:【系统】)?(.+?)因被禁言已自动隐藏这条消息$/)
    if (hit?.[1]) return hit[1].trim() || '某成员'
    return '某成员'
  }
  const hit = t.match(/^【系统】「([^」]+)」的消息被自动屏蔽$/)
  if (hit?.[1]) return hit[1].trim() || '某成员'
  return '某成员'
}

  /** 群聊多角色：组装「风纪后台」摘录，仅注入系统提示供群主/管理员角色知情；聊天气泡侧全员只见灰条，原文需点灰条「查看」。 */
function buildGroupShieldedModeratorAnnex(items: ChatItem[]): string {
  const hits: string[] = []
  for (const it of items) {
    if (it.kind !== 'msg') continue
    const m = it
    if (!m.isSystemCenterStrip || !m.shieldedMessageContent?.trim()) continue
    const body = m.shieldedMessageContent.trim().slice(0, GROUP_SHIELDED_ANNEX_MAX_BODY)
    const kindTag = m.muteSuppressStrip ? '禁言未展示' : '敏感词拦截'
    const who = parseGroupShieldedVictimDisplayName(m.text || '', !!m.muteSuppressStrip)
    hits.push(`- 「${who}」｜${kindTag}｜未在群内展示的原文：\n${body}`)
  }
  if (!hits.length) return ''
  return hits.slice(-GROUP_SHIELDED_ANNEX_MAX_ENTRIES).join('\n\n')
}

type ChatMsgProps = {
  messageText: string
  /** 群助手程序化黑底气泡 */
  luxuryDarkAdminBubble?: boolean
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showBubbleTail: boolean
  /** 己方气泡旁头像，与全局资料一致 */
  chatSelfAvatarUrl?: string
  /** 对方气泡旁头像（通讯录 / 人设库） */
  chatOtherAvatarUrl?: string
  /** 群聊：头像与气泡之间的发送者昵称（仅首条合并行展示） */
  chatOtherSenderNickname?: string
  /** 群聊：对方头像左上角头衔（群主/管理员） */
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  /** 群聊：己方头像左上角头衔 */
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  /**
   * 群聊：头衔是否与成员昵称并排（开启显示成员昵称时）；关闭昵称显示时为 false，头衔改叠在头像角上。
   */
  groupRankShowBesideNickname?: boolean
  bubbleTailMaskColor?: string
  /** 单击对方头像：快捷打开面板（如心语） */
  onOtherAvatarClick?: () => void
  onBubbleLongPress?: (anchorRect: DOMRect) => void
  bubbleSelected?: boolean
}

/** 连续同侧 8px；交替 16px；Telegram 等同人连续仅 2px */
function messageBlockSpacing(items: ChatItem[], index: number, compactMessenger?: boolean): string {
  if (index <= 0) return ''
  const cur = items[index]
  const prev = items[index - 1]
  if (cur.kind === 'time' || cur.kind === 'fr-verify-banner') return 'mt-4'
  if (prev.kind === 'time' || prev.kind === 'fr-verify-banner') return 'mt-4'
  if (cur.kind === 'msg' && prev.kind === 'msg') {
    if (cur.from === prev.from) return compactMessenger ? 'mt-0.5' : 'mt-2'
    return compactMessenger ? 'mt-2' : 'mt-4'
  }
  return 'mt-4'
}

/** 与上一条是否为连续同侧（对方合并：首条显头像） */
function consecutiveSameSpeaker(items: ChatItem[], index: number, groupMode?: boolean): boolean {
  if (index <= 0) return false
  const cur = items[index]
  if (cur.kind !== 'msg' || cur.isRecalled || cur.isGroupEventStrip || cur.isSystemCenterStrip) return false
  for (let i = index - 1; i >= 0; i -= 1) {
    const prev = items[i]
    if (prev.kind === 'time' || prev.kind === 'fr-verify-banner') return false
    if (prev.kind !== 'msg') continue
    // 已撤回消息只显示撤回提示，不应参与头像“连续同侧”合并判断。
    if (prev.isRecalled || prev.isGroupEventStrip || prev.isSystemCenterStrip) continue
    if (cur.from !== prev.from) return false
    if (groupMode && cur.from === 'other' && prev.kind === 'msg') {
      const cId = (cur as ChatMsg).senderCharacterId?.trim() ?? ''
      const pId = (prev as ChatMsg).senderCharacterId?.trim() ?? ''
      if (cId && pId && cId !== pId) return false
      // 任一方缺 senderCharacterId：不合并（避免群管家无 id 时误并进上一条 NPC）
      if (!cId || !pId) return false
      const cBot = cId === WECHAT_GROUP_BOT_CHARACTER_ID
      const pBot = pId === WECHAT_GROUP_BOT_CHARACTER_ID
      if (cBot !== pBot) return false
    }
    return true
  }
  return false
}

/** 与下一条是否为连续同侧（iMessage 尾巴：仅组内最后一条显示） */
function sameSpeakerAsNext(items: ChatItem[], index: number, groupMode?: boolean): boolean {
  if (index >= items.length - 1) return false
  return consecutiveSameSpeaker(items, index + 1, groupMode)
}

/** 重新回复：此类己方行是程序插入的居中灰条，不得作为「本轮最后一条用户消息」锚点，且须随本轮对方稿一并删掉 */
function isRetryRoundTrimmableSelfSystemStrip(m: ChatMsg): boolean {
  if (m.kind !== 'msg' || m.from !== 'self') return false
  if (m.isSystemCenterStrip) return true
  const t = typeof m.text === 'string' ? m.text.trim() : ''
  return t.startsWith('【系统】')
}

/**
 * 程序插入的己方消息（游戏接受/结果卡、共听回应等）：不能作为重新回复锚点。
 * 本轮重生时先移除，待新对方稿落库后再还原，避免结果卡截断角色整轮回复。
 */
function isRetryNonAnchorSelfMessage(m: ChatMsg): boolean {
  if (m.kind !== 'msg' || m.from !== 'self') return false
  const mg = m.miniGameInvite
  if (mg?.kind === 'game_accept' || mg?.kind === 'game_decline') return true
  if (mg?.kind === 'game_invite') {
    if (mg.userResponded === 'accepted' || mg.userResponded === 'declined') return true
    if (mg.matchResult) return true
  }
  const ms = m.musicSync
  if (ms?.kind === 'music_accept' || ms?.kind === 'music_decline') return true
  return false
}

/** 本轮锚点：最后一条真实用户消息（排除重新回复用系统灰条与程序插入卡） */
function findLastRealSelfMessageIndex(msgs: ChatMsg[]): number {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.from !== 'self' || m.kind !== 'msg') continue
    if (isRetryRoundTrimmableSelfSystemStrip(m)) continue
    if (isRetryNonAnchorSelfMessage(m)) continue
    return i
  }
  return -1
}

/**
 * AI 请求上下文：只保留至「本轮最后一条用户消息」为止。
 * 重新回复时即使 UI/DB 尚未完全同步，也不会把本轮旧对方稿注入模型。
 */
function trimChatItemsToAiTurnAnchor(items: ChatItem[]): ChatItem[] {
  const msgs = items.filter((it): it is ChatMsg => it.kind === 'msg')
  const lastSelfIdx = findLastRealSelfMessageIndex(msgs)
  if (lastSelfIdx < 0) return items
  const keepIds = new Set(msgs.slice(0, lastSelfIdx + 1).map((m) => m.id))
  return items.filter((it) => it.kind !== 'msg' || keepIds.has(it.id))
}

/**
 * 群聊对方消息：部分历史数据未写入 senderCharacterId，沿「连续同发言者」向上继承，
 * 避免头衔 / 头像 / 昵称只在首条有效。
 */
function effectiveGroupOtherSenderCharacterId(items: ChatItem[], index: number): string | undefined {
  const cur = items[index]
  if (
    cur.kind !== 'msg' ||
    cur.isRecalled ||
    cur.isGroupEventStrip ||
    (cur as ChatMsg).isSystemCenterStrip ||
    cur.from !== 'other'
  )
    return undefined
  let j = index
  while (j >= 0) {
    const it = items[j]
    if (it.kind !== 'msg' || it.isRecalled || (it as ChatMsg).isGroupEventStrip) return undefined
    // 系统灰条（违禁屏蔽/禁言未展示）属于「对方」但不应参与发言者继承，勿把群管家 id 误并入上下文人设气泡
    if ((it as ChatMsg).isSystemCenterStrip) {
      if (j === 0) return undefined
      j -= 1
      continue
    }
    if (it.from !== 'other') return undefined
    const sid = (it as ChatMsg).senderCharacterId?.trim()
    if (sid) return sid
    if (j === 0) return undefined
    if (!consecutiveSameSpeaker(items, j, true)) return undefined
    j -= 1
  }
  return undefined
}

/** 极简入场：轻微上移 + 微缩放 + 渐显，避免弹跳感。入场完成后移除 will-change。 */
function ChatMessageEnter({ children, isSelf = false }: { children: ReactNode; isSelf?: boolean }) {
  const [entered, setEntered] = useState(false)
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
        transformOrigin: isSelf ? 'right bottom' : 'left bottom',
        transition: 'opacity 320ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: entered ? undefined : 'transform, opacity',
      }}
    >
      {children}
    </div>
  )
}

function FailRetryIcon({ onClick }: { onClick: () => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <Pressable
      aria-label="重发"
      className="wx-chat-fail-btn mb-1 flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full text-[16px]"
      style={{
        color: '#b42318',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease-out',
      }}
      onClick={onClick}
    >
      ⚠️
    </Pressable>
  )
}

type DmBullet = {
  id: string
  text: string
  track: number
  durationSec: number
  startDelaySec?: number
  fontPx: number
  colorRgba: string
  style: 'none' | 'gray' | 'white'
  positionMode: 'top' | 'middle' | 'bottom' | 'random'
  /** 随机纵向位置（0～100，相对弹幕区） */
  topPct?: number
}

function normalizeDmBulletRow(x: unknown): DmBullet | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id.trim() : ''
  const text = typeof r.text === 'string' ? r.text : ''
  if (!id || !text.trim()) return null
  const track = typeof r.track === 'number' && Number.isFinite(r.track) ? Math.max(0, Math.floor(r.track)) : 0
  const durationSec =
    typeof r.durationSec === 'number' && Number.isFinite(r.durationSec) ? Math.max(3, r.durationSec) : 8
  const startDelaySec =
    typeof r.startDelaySec === 'number' && Number.isFinite(r.startDelaySec) ? Math.max(0, r.startDelaySec) : undefined
  const fontPx = typeof r.fontPx === 'number' && Number.isFinite(r.fontPx) ? Math.max(10, Math.min(36, r.fontPx)) : 14
  const colorRgba = typeof r.colorRgba === 'string' && r.colorRgba.trim() ? r.colorRgba.trim() : 'rgba(0,0,0,0.85)'
  const st = r.style
  const style: DmBullet['style'] = st === 'gray' || st === 'white' || st === 'none' ? st : 'none'
  const pm = r.positionMode
  const positionMode: DmBullet['positionMode'] =
    pm === 'top' || pm === 'middle' || pm === 'bottom' || pm === 'random' ? pm : 'top'
  let topPct: number | undefined
  if (typeof r.topPct === 'number' && Number.isFinite(r.topPct)) {
    topPct = Math.min(100, Math.max(0, r.topPct))
  }
  return {
    id,
    text,
    track,
    durationSec,
    startDelaySec,
    fontPx,
    colorRgba,
    style,
    positionMode,
    topPct,
  }
}

function parseStoredDmBullets(raw: unknown): DmBullet[] {
  let arr: unknown[] = []
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.bullets)) arr = o.bullets
  }
  const out: DmBullet[] = []
  for (const x of arr) {
    const b = normalizeDmBulletRow(x)
    if (b) out.push(b)
  }
  return out
}

/** 从 KV 恢复时按轨错开 startDelay，避免同轨叠字 */
function staggerDmBulletsAfterRestore(bullets: DmBullet[], trackCount: number): DmBullet[] {
  const tc = Math.max(1, trackCount)
  const nextEarliestSec = new Map<number, number>()
  return bullets.map((b) => {
    const track = Math.min(Math.max(0, b.track), tc - 1)
    const gapSec = Math.max(1.4, b.durationSec * 0.92)
    const wanted = b.startDelaySec ?? 0
    const minStart = nextEarliestSec.get(track) ?? 0
    const startDelaySec = Math.max(wanted, minStart)
    nextEarliestSec.set(track, startDelaySec + gapSec)
    return { ...b, track, startDelaySec }
  })
}

/** 本会话内用户已拆开的红包消息 id：防止异步落库 / hydrate 用 opened:false 盖回未领样式 */
const locallyOpenedRedPacketMessageIds = new Set<string>()

function markWeChatRedPacketLocallyOpened(messageId: string) {
  const id = messageId.trim()
  if (id) locallyOpenedRedPacketMessageIds.add(id)
}

function isWeChatRedPacketLocallyOpened(messageId: string): boolean {
  return locallyOpenedRedPacketMessageIds.has(messageId.trim())
}

function applyLocallyOpenedRedPacketToMsg(msg: ChatMsg): ChatMsg {
  if (!msg.redPacket || msg.redPacket.opened) return msg
  if (!isWeChatRedPacketLocallyOpened(msg.id)) return msg
  return { ...msg, redPacket: { ...msg.redPacket, opened: true } }
}

/** hydrate / DB 回放与内存 patch 合并：优先保留已出图或已失败状态，避免 imageGenPending 盖掉成功结果 */
function preferResolvedImageGenChatMsg(dbMsg: ChatMsg, liveMsg: ChatMsg): ChatMsg {
  const mergeRedPacketOpened = (base: ChatMsg): ChatMsg => {
    const dbRp = dbMsg.redPacket
    const liveRp = liveMsg.redPacket
    if (!dbRp && !liveRp) return base
    const opened = Boolean(
      dbRp?.opened || liveRp?.opened || isWeChatRedPacketLocallyOpened(base.id || liveMsg.id || dbMsg.id),
    )
    const src = liveRp ?? dbRp!
    return {
      ...base,
      redPacket: {
        packetId: src.packetId,
        amountYuan: src.amountYuan,
        remark: src.remark,
        opened,
        ...((dbRp?.expired || liveRp?.expired) && !opened ? { expired: true as const } : {}),
      },
    }
  }

  const dbImg = dbMsg.images?.[0]?.base64?.trim()
  const liveImg = liveMsg.images?.[0]?.base64?.trim()
  if (liveImg && !dbImg) {
    return mergeRedPacketOpened({
      ...dbMsg,
      ...liveMsg,
      images: liveMsg.images,
      imageGenPending: undefined,
      imageGenAwaitingConfirm: undefined,
      imageGenFailed: liveMsg.imageGenFailed,
      imageGenPrompt: liveMsg.imageGenPrompt ?? dbMsg.imageGenPrompt,
      imageDescription: liveMsg.imageDescription ?? dbMsg.imageDescription,
    })
  }
  if (dbImg) {
    return mergeRedPacketOpened({
      ...liveMsg,
      ...dbMsg,
      images: dbMsg.images,
      imageGenPending: undefined,
      imageGenAwaitingConfirm: undefined,
      imageGenFailed: dbMsg.imageGenFailed,
      imageDescription: dbMsg.imageDescription ?? liveMsg.imageDescription,
      imageGenPrompt: dbMsg.imageGenPrompt ?? liveMsg.imageGenPrompt,
    })
  }
  if (!liveMsg.imageGenPending && liveMsg.imageGenFailed) {
    return mergeRedPacketOpened({ ...dbMsg, ...liveMsg })
  }
  if (!dbMsg.imageGenPending && dbMsg.imageGenFailed) {
    return mergeRedPacketOpened({ ...liveMsg, ...dbMsg })
  }
  if (liveMsg.imageGenPending && !dbMsg.imageGenPending) {
    return mergeRedPacketOpened({ ...liveMsg, ...dbMsg })
  }
  if (!liveMsg.imageGenPending && dbMsg.imageGenPending) {
    return mergeRedPacketOpened({ ...dbMsg, ...liveMsg })
  }
  if (liveMsg.imageGenAwaitingConfirm && !dbMsg.imageGenAwaitingConfirm) {
    return mergeRedPacketOpened({ ...liveMsg, ...dbMsg })
  }
  if (!liveMsg.imageGenAwaitingConfirm && dbMsg.imageGenAwaitingConfirm) {
    return mergeRedPacketOpened({ ...dbMsg, ...liveMsg })
  }
  return mergeRedPacketOpened({ ...dbMsg, ...liveMsg })
}

function applyImageGenUiPatchToMsg(
  msg: ChatMsg,
  patch: Partial<Pick<ChatMsg, 'images' | 'imageGenPending' | 'imageGenAwaitingConfirm' | 'imageGenFailed'>>,
): ChatMsg {
  return {
    ...msg,
    ...patch,
    ...(patch.imageGenPending === false ? { imageGenPending: undefined } : {}),
    ...(patch.imageGenAwaitingConfirm === false ? { imageGenAwaitingConfirm: undefined } : {}),
    ...(patch.imageGenFailed === false ? { imageGenFailed: undefined } : {}),
  }
}

function resolveImageGenPatchForMessageId(
  messageId: string,
  localPatches?: ReadonlyMap<string, WeChatImageGenUiPatch>,
): WeChatImageGenUiPatch | undefined {
  const id = messageId.trim()
  if (!id) return undefined
  return localPatches?.get(id) ?? getWeChatImageGenUiPatch(id)
}

function mergeImageGenUiPatchMaps(
  localPatches?: ReadonlyMap<string, WeChatImageGenUiPatch>,
): Map<string, WeChatImageGenUiPatch> {
  const merged = new Map(getWeChatImageGenUiPatchMap())
  if (localPatches) {
    for (const [id, patch] of localPatches) merged.set(id, patch)
  }
  return merged
}

function applyImageGenUiPatchToChatMsgIfAny(
  msg: ChatMsg,
  patchById?: ReadonlyMap<string, WeChatImageGenUiPatch>,
): ChatMsg {
  const patch = resolveImageGenPatchForMessageId(msg.id, patchById)
  return patch ? applyImageGenUiPatchToMsg(msg, patch) : msg
}

/** hydrate 落库时用 React 最新 prev 再合并，避免异步 DB 快照盖掉已出图的内存 patch */
function mergeHydratedMsgsWithLivePrev(
  mappedMsgs: ChatMsg[],
  prevMsgs: ChatMsg[],
  pendingPatchById?: ReadonlyMap<string, WeChatImageGenUiPatch>,
): ChatMsg[] {
  const prevById = new Map(prevMsgs.map((m) => [m.id, m]))
  const mappedIds = new Set(mappedMsgs.map((m) => m.id))
  const applyPending = (msg: ChatMsg): ChatMsg => {
    const pending = resolveImageGenPatchForMessageId(msg.id, pendingPatchById)
    return pending ? applyImageGenUiPatchToMsg(msg, pending) : msg
  }
  const mergedMapped = mappedMsgs.map((dbMsg) => {
    const live = prevById.get(dbMsg.id)
    const base = live ? preferResolvedImageGenChatMsg(dbMsg, live) : applyLocallyOpenedRedPacketToMsg(dbMsg)
    return applyPending(base)
  })
  const pendingOnly = prevMsgs.filter((m) => !mappedIds.has(m.id)).map((m) => applyPending(applyLocallyOpenedRedPacketToMsg(m)))
  return dedupeChatMsgsById([...mergedMapped, ...pendingOnly].sort(compareChatMsgByRevealOrder))
}

function chatItemsMessageSnapshotEqual(prev: ChatItem[], next: ChatItem[]): boolean {
  const pick = (list: ChatItem[]) =>
    list
      .filter((it): it is ChatMsg => it.kind === 'msg')
      .map((m) => {
        const mg = m.miniGameInvite
        const mgKey = mg
          ? `${mg.kind}\0${mg.inviteId ?? ''}\0${'charResponded' in mg ? mg.charResponded ?? '' : ''}\0${'matchResult' in mg ? mg.matchResult ?? '' : ''}`
          : ''
        const mediaKey = [
          m.imageGenPending ? '1' : '0',
          m.imageGenAwaitingConfirm ? '1' : '0',
          m.imageGenFailed ? '1' : '0',
          m.images?.[0]?.base64?.length ?? 0,
          m.images?.[0]?.type ?? '',
        ].join(':')
        // 必须纳入红包 opened/expired：否则 hydrate 在「仅 opened 变化」时会 return prev，气泡卡死未领样式直到下一条消息
        const rp = m.redPacket
        const rpKey = rp
          ? `${rp.packetId ?? ''}\0${rp.opened ? '1' : '0'}\0${rp.expired ? '1' : '0'}\0${rp.amountYuan ?? ''}`
          : ''
        return `${m.id}\0${m.from}\0${m.timestamp}\0${m.text ?? ''}\0${mgKey}\0${mediaKey}\0${rpKey}`
      })
      .join('\n')
  return pick(prev) === pick(next)
}

export function ChatRoomInner({
  onBack: _onBack,
  onOtherTypingChange,
  onPendingQueueCountChange,
  onOpponentRevealQueueActive,
  skipBusySignal = 0,
  /** 聊天设置内清空记录后递增，强制重载当前会话气泡 */
  historyRefreshSignal = 0,
  personaCharacterId = null,
  playerDisplayName = '',
  /** 仅在与内置 Lumi 助手会话且未绑人设时为 true；其他聊天勿开，以免注入 Lumi 专用系统提示词 */
  useLumiProjectAssistantPrompt = false,
  /** 会话存储用的角色 id：Lumi 为固定助手 id，角色私聊为对应 characterId */
  conversationCharacterId,
  /** 当前微信马甲下的会话身份 id（存 IndexedDB 用，勿传角色全局绑定身份） */
  playerIdentityId,
  /** 注入模型 / 记忆用的身份 id；缺省时私聊会回退为「角色绑定 ∪ 会话身份」 */
  promptPlayerIdentityId: _promptPlayerIdentityId = null,
  /** 玩家头像（与「我」页资料一致），用于己方聊天气泡 */
  playerAvatarUrl,
  /** 对方在微信通讯录中的头像 URL；缺省时（角色私聊）会尝试从人设库读取 */
  peerAvatarUrl,
  /** 系统通知标题（通讯录备注名 / Lumi） */
  peerNotifyTitle = '',
  /** 会话设置：自定义聊天区背景（URL / dataURL） */
  chatBackgroundUrl,
  /** 主题：无单会话壁纸时的聊天室默认背景 */
  chatRoomDefaultBg = DEFAULT_WECHAT_CHAT_ROOM_BG,
  /** 会话设置：弹幕模式 */
  danmakuEnabled = false,
  /** 会话设置：后台思维链 CoT（默认关） */
  thinkingChainEnabled = false,
  /** 会话设置：伪造聊天记录卡片协议（默认关） */
  forwardHistoryCardEnabled = false,
  /** 会话设置：微博私信截图协议（默认关） */
  pulseDmScreenshotEnabled = false,
  /** 会话设置：换头像/朋友圈背景协议（默认关） */
  profileImageChangeEnabled = false,
  /** 会话设置：网络玩梗轻量词库（默认关） */
  internetMemeLexiconEnabled = false,
  /** 群聊：是否在对方消息头像右侧显示发送者群昵称 */
  showGroupMemberNicknameInChat = true,
  /** 群聊：是否在发言者头像左上角显示群主/管理员头衔 */
  showGroupRankBadgesInChat = false,
  /** 从「查找聊天记录」等入口定位到指定消息 id */
  scrollToMessageId = null,
  onScrollToMessageConsumed,
  onRequestForwardMessage,
  onRequestForwardMessages: _onRequestForwardMessages,
  onMultiSelectModeChange,
  multiSelectExitSignal = 0,
  onOpenChatHistoryViewer,
  onOpenSendRedPacket,
  onNavigateRedPacketDetail,
  onOpenLumiTransfer,
  onOpenAffectionPay,
  onNavigateTransferDetail,
  roomType = 'private' as 'private' | 'group',
  groupId = null as string | null,
  onOpenGroupInfo: _onOpenGroupInfo,
  psycheRadarOpen = false,
  onPsycheRadarOpenChange,
  onCheckPhoneOpenChange,
  onMiniGameOverlayOpenChange,
  onVoiceCallOverlayOpenChange,
  /** 当前是否在聊天页前台（消息列表/子页为 false）：false 时暂停逐条露出计时，回聊天页后续跑 */
  chatRouteVisible = true,
  embedMode,
  onEmbedSendReady,
}: {
  onBack: () => void
  /** 同步「对方正在输入」到顶栏（替代底部提示） */
  onOtherTypingChange?: (visible: boolean) => void
  /** 等待露出队列长度，供顶栏 ChatHeader 内聚动画使用 */
  onPendingQueueCountChange?: (count: number) => void
  /** 对方消息异步队列非空（逐条露出阶段），用于顶栏「备注 / 正在输入」呼吸切换 */
  onOpponentRevealQueueActive?: (active: boolean) => void
  /** 上层点击“跳过忙碌”后递增，用于立即触发一轮忙后回复 */
  skipBusySignal?: number
  /** 聊天设置内清空记录后递增，强制重载当前会话气泡 */
  historyRefreshSignal?: number
  /** 与人设库角色 id 绑定后注入世界书；未绑定时仅用通用提示词 */
  personaCharacterId?: string | null
  /** 玩家在微信侧展示名，供模型称呼参考 */
  playerDisplayName?: string
  useLumiProjectAssistantPrompt?: boolean
  conversationCharacterId: string
  playerIdentityId: string
  promptPlayerIdentityId?: string | null
  playerAvatarUrl?: string
  peerAvatarUrl?: string
  peerNotifyTitle?: string
  chatBackgroundUrl?: string
  chatRoomDefaultBg?: WeChatChatRoomBg
  danmakuEnabled?: boolean
  thinkingChainEnabled?: boolean
  forwardHistoryCardEnabled?: boolean
  pulseDmScreenshotEnabled?: boolean
  profileImageChangeEnabled?: boolean
  internetMemeLexiconEnabled?: boolean
  showGroupMemberNicknameInChat?: boolean
  showGroupRankBadgesInChat?: boolean
  scrollToMessageId?: string | null
  onScrollToMessageConsumed?: () => void
  /** 点击长按面板「转发」后交给上层路由打开“选择聊天”页 */
  onRequestForwardMessage?: (msg: WeChatChatMessage) => void
  /** 多选模式：转发多条（合并/逐条） */
  onRequestForwardMessages?: (payload: {
    mode: 'multi-item' | 'multi-merge'
    messageIds: string[]
    mergeTitle: { userName: string; peerName: string; peerCharacterId?: string }
  }) => void
  onMultiSelectModeChange?: (active: boolean) => void
  multiSelectExitSignal?: number
  /** 打开全屏聊天记录阅读器（由 WeChatApp 顶层渲染，覆盖顶栏） */
  onOpenChatHistoryViewer?: (payload: {
    data: WeChatChatHistoryPayload
    participantAvatars: Record<string, string | undefined>
    avatarRadiusPx?: number
    recipientCharacterId?: string
    userDisplayName?: string
    personaContacts?: readonly import('../../types').WeChatPersonaContact[]
    cardSenderCharacterId?: string
  }) => void
  /** 发红包：由 WeChatApp 切到 `red-packet-send` 路由 */
  onOpenSendRedPacket?: () => void
  /** 拆红包动画结束后进入详情页 */
  onNavigateRedPacketDetail?: (p: {
    messageId: string
    amountYuan: number
    remark: string
    senderName: string
    senderAvatarUrl?: string
    chatPeerName: string
    claimerName?: string
    fromSelf: boolean
    opened: boolean
  }) => void
  /** 打开转账页 */
  onOpenLumiTransfer?: () => void
  /** 打开亲情卡代付页 */
  onOpenAffectionPay?: () => void
  /** 打开转账详情 */
  onNavigateTransferDetail?: (transferId: string) => void
  roomType?: 'private' | 'group'
  groupId?: string | null
  onOpenGroupInfo?: () => void
  /** 私聊顶栏「体征监测」抽屉开关（由 WeChatApp 承载入口） */
  psycheRadarOpen?: boolean
  onPsycheRadarOpenChange?: (open: boolean) => void
  /** 查手机全屏模式：通知上层隐藏微信顶栏，避免遮挡镜像 App 内页标题 */
  onCheckPhoneOpenChange?: (open: boolean) => void
  /** 小游戏全屏层打开时通知上层隐藏微信聊天顶栏，避免与「一起玩游戏」标题重叠 */
  onMiniGameOverlayOpenChange?: (open: boolean) => void
  /** 语音通话全屏（拨打/来电/通话中）时隐藏微信聊天顶栏 */
  onVoiceCallOverlayOpenChange?: (open: boolean) => void
  /** 当前是否在聊天页前台（消息列表/子页为 false）：false 时暂停逐条露出计时，回聊天页后续跑 */
  chatRouteVisible?: boolean
  /** 隐藏 UI，仅保留发送与 AI 管线（全局快捷回复引擎） */
  embedMode?: 'quick-reply'
  onEmbedSendReady?: (api: { sendText: (text: string) => void }) => void
}) {
  const logger = useConsoleLogger()
  const loggerRef = useRef(logger)
  loggerRef.current = logger
  const onNavigateRedPacketDetailRef = useRef(onNavigateRedPacketDetail)
  onNavigateRedPacketDetailRef.current = onNavigateRedPacketDetail
  const onNavigateTransferDetailRef = useRef(onNavigateTransferDetail)
  onNavigateTransferDetailRef.current = onNavigateTransferDetail
  const groupDocRef = useRef<GroupChatRow | null>(null)

  // `ChatRoom` 顶栏由上层承载，这里仅保留引用以避免未使用告警
  useEffect(() => {}, [_onBack, _onOpenGroupInfo])
  const { state, setUi, replaceWeChatPersonaContacts } = useCustomization()
  const personaContactsList = useMemo(
    () => state.wechatPersonaContacts ?? EMPTY_PERSONA_CONTACTS,
    [state.wechatPersonaContacts],
  )
  const { wechatTheme } = state
  const { chatTheme } = useChatTheme()
  const apiConfig = useCurrentApiConfig('chatCard')
  const { currentAccountId, accounts } = useWechatStore()
  const danmakuApiConfig = useCurrentApiConfig('danmaku')
  const voiceAsrApiConfig = useCurrentApiConfig('voiceAsr')
  const voiceAsrEnabled = useIsSubApiEnabled('voiceAsr')

  const conversationKey = useMemo(
    () =>
      roomType === 'group'
        ? resolveGroupWeChatStorageConversationKey(
            groupId?.trim() || parseGroupIdFromGroupPeerCharacterId(conversationCharacterId) || '',
            currentAccountId,
            playerIdentityId,
          )
        : resolvePrivateWeChatStorageConversationKey(
            conversationCharacterId,
            currentAccountId,
            playerIdentityId,
          ),
    [conversationCharacterId, currentAccountId, groupId, playerIdentityId, roomType],
  )

  const isSelfMemoChat = useMemo(
    () => isWechatSelfMemoPeerCharacterId(conversationCharacterId),
    [conversationCharacterId],
  )

  // 打开聊天室不做 ensure* 迁移（会整库 getAll + rekey，角色/消息一多进房就白屏卡死）。
  // 马甲隔离键由 conversationKey / resolve* 同步计算；历史迁移改在切号/启动修复里做。

  /** 与 UI 当前会话一致；异步 hydrate 结束前若已切会话则丢弃结果，避免错写/空窗 */
  const conversationKeyLiveRef = useRef(conversationKey)
  conversationKeyLiveRef.current = conversationKey
  const chatRouteVisibleRef = useRef(chatRouteVisible)
  chatRouteVisibleRef.current = chatRouteVisible
  /** flushAiReplies 绑定会话 key；后台 flush 时与可见 conversationKey 可能不一致 */
  const flushOpponentRevealConvKeyRef = useRef<string | null>(null)
  const stashOpponentRevealJobsByKey = useCallback((jobs: OpponentRevealJob[]) => {
    const byKey = new Map<string, OpponentRevealJob[]>()
    for (const j of jobs) {
      const k = j.forConversationKey.trim()
      if (!k) continue
      const list = byKey.get(k) ?? []
      list.push(j)
      byKey.set(k, list)
    }
    for (const [k, list] of byKey) stashOpponentRevealJobs(k, list)
    if (byKey.size > 0) notifyWechatConversationAiPipeline()
  }, [])
  /** 追踪 storage 键变更：区分「切会话」与「马甲键升级」 */
  /** 须为 ''：若用 conversationKey 初始化，首进聊天室时 prev===next 会跳过 hydrate（刷新后历史空白） */
  const prevConversationKeyRef = useRef('')
  const conversationKeyMigrationRef = useRef(false)
  /** 并发 hydrate 时仅应用「最后一次启动」的结果，避免先入的空列表覆盖后入的 storage 拉取 */
  const hydrateRunIdRef = useRef(0)

  const { getCurrentTimeMs, timePerceptionEnabled } = useWeChatCurrentTime({
    characterId: personaCharacterId?.trim() || conversationCharacterId,
    liveTick: false,
  })
  const [globalDm, setGlobalDm] = useState<WeChatGlobalSettingsRow | null>(null)
  const [peerDmRow, setPeerDmRow] = useState<CharacterDanmakuSettingsRow | null>(null)
  const [peerBusyRow, setPeerBusyRow] = useState<CharacterBusySettingsRow | null>(null)
  const [globalModeBusyEnabled, setGlobalModeBusyEnabled] = useState(true)

  const proactiveBusyActiveRef = useRef(false)
  const [proactiveBusyActive, setProactiveBusyActive] = useState(false)

  useEffect(() => {
    const compute = () => {
      if (!globalDm?.busyEnabled) return false
      const switchOn =
        globalDm.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : globalModeBusyEnabled
      if (!switchOn) return false
      return !!(peerBusyRow?.isBusy && (peerBusyRow.busyEndTime ?? 0) > getCurrentTimeMs())
    }
    const next = compute()
    if (proactiveBusyActiveRef.current !== next) {
      proactiveBusyActiveRef.current = next
      setProactiveBusyActive(next)
    }
    if (!peerBusyRow?.isBusy || (peerBusyRow.busyEndTime ?? 0) <= 0) return
    const ms = Math.max(0, peerBusyRow.busyEndTime - getCurrentTimeMs())
    const tid = window.setTimeout(() => {
      const ended = compute()
      if (proactiveBusyActiveRef.current !== ended) {
        proactiveBusyActiveRef.current = ended
        setProactiveBusyActive(ended)
      }
    }, ms + 40)
    return () => window.clearTimeout(tid)
  }, [globalDm, peerBusyRow, globalModeBusyEnabled, getCurrentTimeMs])

  const proactiveCountdownEnabled = useMemo(
    () =>
      roomType === 'private' &&
      !!personaCharacterId?.trim() &&
      !useLumiProjectAssistantPrompt &&
      !isSelfMemoChat,
    [roomType, personaCharacterId, useLumiProjectAssistantPrompt, isSelfMemoChat],
  )

  const [dmBullets, setDmBullets] = useState<DmBullet[]>([])
  const dmBulletsRef = useRef<DmBullet[]>([])
  dmBulletsRef.current = dmBullets
  /** 新一批模型弹幕入队时递增；过期定时器据此放弃写入，避免与旧弹幕叠在一起 */
  const danmakuEnqueueGenRef = useRef(0)
  const onOpponentRevealQueueActiveRef = useRef(onOpponentRevealQueueActive)
  onOpponentRevealQueueActiveRef.current = onOpponentRevealQueueActive

  /**
   * 切换会话：作废旧弹幕调度、清空浮层后从 IndexedDB 读本会话「最新一轮」缓存。
   * 各会话 key 独立（`wechat-dm-bullets-v1:${conversationKey}`），离开聊天室不会清掉其它会话数据。
   */
  useEffect(() => {
    danmakuEnqueueGenRef.current += 1
    setDmBullets([])
    let cancelled = false
    void (async () => {
      try {
        const raw = await personaDb.getPhoneKv(`${WECHAT_DM_BULLETS_KV_PREFIX}:${conversationKey}`)
        if (cancelled) return
        let parsed = parseStoredDmBullets(raw).slice(-180)
        try {
          const g = await personaDb.getGlobalSettings()
          const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
          const row = pid ? await personaDb.getCharacterDanmakuSettings(pid) : null
          const eff = resolveEffectiveDanmakuVisuals(g, pid, row)
          if (eff && !eff.skipCharacter) {
            parsed = staggerDmBulletsAfterRestore(parsed, densityToTrackCount(eff.density))
          }
        } catch {
          /* 设置读失败时仍使用未错开的列表 */
        }
        if (cancelled) return
        setDmBullets(parsed)
      } catch {
        if (!cancelled) setDmBullets([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationKey, personaCharacterId, conversationCharacterId])

  /** 有弹幕时 debounce 落库：整表覆盖写入当前会话 key，即「只保留最新一轮」快照。不在 length===0 时写入，避免切会话瞬间用空数组盖掉刚要异步读出的缓存。 */
  useEffect(() => {
    if (!danmakuEnabled) return
    if (dmBulletsRef.current.length === 0) return
    const key = conversationKey
    const t = window.setTimeout(() => {
      const snap = dmBulletsRef.current.slice(-180)
      if (snap.length === 0) return
      void personaDb.setPhoneKv(`${WECHAT_DM_BULLETS_KV_PREFIX}:${key}`, { v: 1, bullets: snap })
    }, 320)
    return () => window.clearTimeout(t)
  }, [dmBullets, conversationKey, danmakuEnabled])

  const dmLaneBusyUntilRef = useRef<number[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const g = await personaDb.getGlobalSettings()
      if (cancelled) return
      setGlobalDm(g)
      const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
      if (g.danmakuScopeMode === 'character' && pid) {
        const row = await personaDb.getCharacterDanmakuSettings(pid)
        if (!cancelled) setPeerDmRow(row)
      } else if (!cancelled) {
        setPeerDmRow(null)
      }
      if (g.busyMode === 'character' && pid) {
        const row = await personaDb.getCharacterBusySettings(pid)
        if (!cancelled) setPeerBusyRow(row)
      } else if (!cancelled) {
        setPeerBusyRow(null)
        const convKey = conversationKey
        const kv = await personaDb.getPhoneKv(`busy-conv:${convKey}`)
        if (!cancelled) setGlobalModeBusyEnabled(typeof kv === 'boolean' ? kv : true)
      }
    }
    void load()
    const onStorage = () => void load()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [personaCharacterId, conversationCharacterId, playerIdentityId, roomType, groupId])

  const effectiveDm = useMemo(() => {
    if (!globalDm) return null
    const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
    return resolveEffectiveDanmakuVisuals(globalDm, pid, peerDmRow)
  }, [globalDm, personaCharacterId, conversationCharacterId, peerDmRow])

  const bubble = useMemo(
    () =>
      migrateMislabeledLumiDefaultBubble(bubbleForRole(wechatTheme, conversationCharacterId)),
    [wechatTheme, conversationCharacterId],
  )
  const bubbleSkinKey = useMemo(() => wechatBubbleSkinKey(bubble), [bubble])
  const showAvatar = bubble.showAvatar
  const bubbleTailStyle = bubble.bubbleTailStyle
  const messengerStyle = resolveMessengerBubbleStyle(bubble)
  const showBubbleTail =
    bubble.showBubbleTail &&
    (bubbleTailStyle === 'imessage' || bubbleTailStyle === 'telegram' || bubbleTailStyle === 'talkmaker' || bubbleTailStyle === 'wechat' || showAvatar)
  const compactMessengerSpacing = bubbleTailStyle === 'telegram'
  const usesMessengerBubbleTime =
    bubbleTailStyle === 'telegram' || bubbleTailStyle === 'talkmaker'
  const showTimestamp =
    wechatTheme.timestampStyle !== 'hidden' && bubbleTailStyle !== 'telegram'
  const mergeAvatarGroup =
    bubbleTailStyle === 'wechat' ? false : bubble.mergeConsecutiveAvatarGroup

  const synthCharacterVoiceAudioUrl = useCallback(
    async (
      voiceCharacterId: string,
      ttsScript: string,
      emotion?: (typeof VOICE_ALLOWED_EMOTIONS)[number],
    ): Promise<string> => {
      try {
        const cid = voiceCharacterId.trim()
        if (!cid) return ''
        const creds = readMiniMaxCredentialsFromLocalStorage()
        if (!creds.apiKey.trim()) return ''
        const speechModel = readMiniMaxSpeechModelFromLocalStorage()
        const voiceId = await lookupBoundVoiceIdForCharacter(cid)
        if (!voiceId) return ''
        const blob = await synthesizeMiniMaxVoiceAudioBlob(creds, {
          voice_id: voiceId,
          text: ttsScript,
          model: speechModel,
          emotion,
        })
        return await blobToDataUrl(blob)
      } catch (e) {
        logger.log('error', `角色语音合成失败: ${e instanceof Error ? e.message : String(e)}`)
        return ''
      }
    },
    [logger],
  )
  const voiceSynthesisPromiseRef = useRef(new Map<string, Promise<string>>())

  const [peerAvatarResolved, setPeerAvatarResolved] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    const direct = peerAvatarUrl?.trim()
    if (direct) {
      setPeerAvatarResolved(resolveCharacterAvatarUrl({ avatarUrl: direct }) || direct)
      return
    }
    if (useLumiProjectAssistantPrompt) {
      setPeerAvatarResolved(undefined)
      return
    }
    const cid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
    if (!cid || cid === WECHAT_LUMI_PEER_CHARACTER_ID) {
      setPeerAvatarResolved(undefined)
      return
    }
    void personaDb.getCharacter(cid).then((c) => {
      if (cancelled) return
      const resolved = resolveCharacterAvatarUrl({ avatarUrl: c?.avatarUrl })
      setPeerAvatarResolved(resolved || undefined)
    })
    return () => {
      cancelled = true
    }
  }, [peerAvatarUrl, useLumiProjectAssistantPrompt, personaCharacterId, conversationCharacterId])

  const playerAvatarResolved = useMemo(() => {
    const resolved =
      resolveWechatAppAvatar(playerAvatarUrl) || resolveWechatAppAvatar(state.profile.avatarImageUrl)
    return resolved.trim() || undefined
  }, [playerAvatarUrl, state.profile.avatarImageUrl])

  /**
   * 私聊专用：仅从 IndexedDB 拼「群聊近期消息摘录」，**不调用模型**（与约会线下剧情参考同源思路）。
   * 注入系统提示独立区块 {@link recentGroupChatsReference}，与长期记忆总结分列。
   */
  const loadPrivateGroupChatsRecentReference = useCallback(async (): Promise<string> => {
    if (roomType === 'group' || useLumiProjectAssistantPrompt) return ''
    const pc = personaCharacterId?.trim()
    if (!pc || pc === WECHAT_LUMI_PEER_CHARACTER_ID) return ''
    try {
      const ch = await personaDb.getCharacter(pc)
      const pid = playerIdentityId.trim()
      const anchorGroupId =
        peekPrivateChatGroupAnchorFromDockStaging(pc) ?? (await personaDb.getPrivateChatAnchorGroupId(pc, pid))
      return (
        await buildNpcGroupChatsRecentDigestForPrivatePrompt({
          npcCharacterId: pc,
          sessionPlayerIdentityId: pid,
          boundPlayerIdentityId: ch?.playerIdentityId,
          anchorGroupId,
          messageCap: 50,
          charCap: 4500,
        })
      ).trim()
    } catch {
      return ''
    }
  }, [roomType, useLumiProjectAssistantPrompt, personaCharacterId, playerIdentityId])

  /** 私聊主模型：关键词筛选长期记忆 + 未总结私聊/群聊摘录（每轮现算，避免全量记忆常驻 state）。 */
  const buildPrivateMemoryInjectionForAi = useCallback(
    async (transcript: ChatTranscriptTurn[], biasText: string) => {
      if (roomType === 'group' || useLumiProjectAssistantPrompt) {
        return {
          memory: '',
          momentImageUrls: [] as string[],
          unsPrivate: '',
          unsGroup: '',
          unsMeet: '',
          recentPrivateAiRounds: '',
          recentOfflineAiRounds: '',
          recentMeetAiRounds: '',
          storyTimeline: '',
          crossChannelTimeline: '',
          traceCrossAccountPrivate: '',
          traceCurrentLinePrivate: '',
        }
      }
      const pc = personaCharacterId?.trim()
      if (!pc || pc === WECHAT_LUMI_PEER_CHARACTER_ID) {
        return {
          memory: '',
          momentImageUrls: [] as string[],
          unsPrivate: '',
          unsGroup: '',
          unsMeet: '',
          recentPrivateAiRounds: '',
          recentOfflineAiRounds: '',
          recentMeetAiRounds: '',
          storyTimeline: '',
          crossChannelTimeline: '',
          traceCrossAccountPrivate: '',
          traceCurrentLinePrivate: '',
        }
      }
      const pid = playerIdentityId.trim()
      const chRow = await personaDb.getCharacter(pc)
      const anchorGroupId =
        peekPrivateChatGroupAnchorFromDockStaging(pc) ?? (await personaDb.getPrivateChatAnchorGroupId(pc, pid))
      const offlineHay = (
        await loadOfflineDatingPlotsPromptBlock(pc, chRow?.name ?? chRow?.wechatNickname ?? null)
      ).trim()

      const fromMeet = isMeetSyncedCharacter(pc, chRow?.worldBooks)
      const bundle = await loadAccountsBundle()
      const altWechatLine = isSecondaryWechatAccountInBundle(bundle, currentAccountId)
      const nonPrimarySession = isNonPrimaryBindingSession(chRow, pid)
      const homeOnlyLine =
        !!pid &&
        pid !== '__none__' &&
        (await shouldUseWechatHomeProfileOnlyForPrivateChat({
          character: chRow,
          sessionPlayerIdentityId: pid,
          wechatAccountId: currentAccountId,
        }))
      const isolateStrangerLine = altWechatLine || homeOnlyLine || nonPrimarySession
      const digestBoundPid = isolateStrangerLine ? pid : chRow?.playerIdentityId
      const lineScope = normalizeMemoryPromptLineScope(currentAccountId, pid)
      let crossAccountPrivate = ''
      let traceCrossAccountPrivate = ''
      if (currentAccountId && accounts.length > 1) {
        const crossDigest = await buildCrossAccountPrivateChatDigests({
          characterId: pc,
          currentAccountId,
          currentConversationKey: conversationKey,
          allAccounts: accounts,
          currentScope: lineScope,
          strangerLine: isolateStrangerLine,
        })
        crossAccountPrivate = crossDigest.injection.trim()
        traceCrossAccountPrivate = crossDigest.traceExcerpts.trim()
      }
      const skipGroupDigestForStranger = isolateStrangerLine
      const [unsPrivateRaw, unsGroup, unsMeet, crossChannelTimeline] = await Promise.all([
        formatUnsummarizedPrivateChatBlock({
          conversationKey,
          maxMessages: MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
          maxChars: MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
          includeMessageTimestamps: true,
        }).then((s) => s.trim()),
        skipGroupDigestForStranger
          ? Promise.resolve('')
          : buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt({
              npcCharacterId: pc,
              sessionPlayerIdentityId: pid,
              boundPlayerIdentityId: digestBoundPid,
              anchorGroupId,
              maxMessagesPerGroup: 50,
              charCap: 4200,
              includeMessageTimestamps: true,
            }).then((s) => s.trim()),
        fromMeet
          ? formatUnsummarizedMeetChatBlock({ characterId: pc, maxMessages: 120, maxChars: 3200 }).then((s) => s.trim())
          : Promise.resolve(''),
        buildOnlineChatCrossChannelTimelineRule({
          characterId: pc,
          conversationKey,
          generationTs: Date.now(),
        }),
      ])
      const scopeForWrap =
        lineScope ?? normalizeMemoryPromptLineScope(currentAccountId, pid)
      const unsPrivateCurrent =
        unsPrivateRaw && scopeForWrap
          ? await wrapUnsummarizedPrivateBlockWithLineLabel(unsPrivateRaw, scopeForWrap, 'current')
          : unsPrivateRaw
      const injectionAnchor = scopeForWrap
        ? await buildPrivateChatMemoryInjectionAnchor({
            currentScope: scopeForWrap,
            strangerLine: isolateStrangerLine,
            characterId: pc,
          })
        : ''
      const unsPrivate = [injectionAnchor, unsPrivateCurrent, crossAccountPrivate]
        .filter(Boolean)
        .join('\n\n')

      const hay = buildMemoryRelevanceHaystack([
        ...transcript.slice(-32).map((t) => t.text),
        biasText,
        offlineHay.slice(0, 3600),
        unsMeet.slice(0, 2800),
        unsPrivate.slice(0, 4800),
        unsGroup.slice(0, 2400),
      ])
      const timelineApiConfig =
        apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null
      const liveMs = getCurrentTimeMs()
      // 线上时钟在流逝时，把剧情轴「现在」推到同一时刻（未点保存也会同步）
      const syncedStory = await syncStoryTimelineNowFromOnlineClock({
        characterId: pc,
        liveTimeMs: liveMs,
      })
      const timelineState = await personaDb.getStoryTimelineState(pc)
      const storyCalendarAnchor =
        syncedStory.storyLabel.trim() ||
        composeStoryTimelineCalendarAnchorLabel({
          story_day: timelineState?.currentStoryDay,
          story_time: timelineState?.currentStoryTime,
        }).trim() ||
        undefined
      const lastOnlineNote = (
        await buildLastOnlineChatContinuityNote({
          conversationKey,
          currentStoryLabel: storyCalendarAnchor,
          currentTimeMs: liveMs,
        })
      ).trim()
      const recentPrivateRounds = (
        await buildRecentPrivateChatRoundsWithTimeBlock({
          conversationKey,
        })
      ).trim()
      const latestUserText =
        [...transcript].reverse().find((t) => t.from === 'self')?.text?.trim() || ''
      let storyTimeline = ''
      try {
        storyTimeline = (
          await loadStoryTimelinePromptBlock(pc, {
            relevanceText: hay,
            recallQueryUserText: latestUserText || undefined,
            storyCalendarAnchor,
            apiConfig: timelineApiConfig,
            conversationKey,
          })
        ).trim()
      } catch {
        storyTimeline = ''
      }
      let memory = ''
      let momentImageUrls: string[] = []
      try {
        const pack = await formatCharacterMemoriesForPromptInjectionPack(pc, hay, {
          apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
          lineScope: (lineScope ?? scopeForWrap) ?? undefined,
          conversationKey,
        })
        memory = pack.text.trim()
        momentImageUrls = pack.momentImageUrls
      } catch {
        memory = ''
        momentImageUrls = []
      }
      if (memory && isolateStrangerLine && !memory.includes('分线阅读')) {
        memory = wrapStrangerContactLongTermMemoryBlock(memory)
      }
      return {
        memory,
        momentImageUrls,
        unsPrivate: [lastOnlineNote, recentPrivateRounds, unsPrivate].filter(Boolean).join('\n\n'),
        unsGroup,
        unsMeet,
        recentPrivateAiRounds: '',
        recentOfflineAiRounds: '',
        recentMeetAiRounds: '',
        offlineUnsummarizedForPrompt: offlineHay,
        storyTimeline,
        crossChannelTimeline,
        traceCrossAccountPrivate,
        traceCurrentLinePrivate: unsPrivateRaw,
        dedupePrivateRecentOmitted: false,
        dedupeMeetRecentOmitted: false,
        dedupeOfflineRecentOmitted: false,
      }
    },
    [
      accounts,
      apiConfig,
      conversationKey,
      currentAccountId,
      getCurrentTimeMs,
      roomType,
      useLumiProjectAssistantPrompt,
      personaCharacterId,
      playerIdentityId,
    ],
  )

  const formatWxTimeLabel = useCallback(
    (ts: number) => formatWeChatChatTimestamp(ts, getCurrentTimeMs()),
    [getCurrentTimeMs],
  )

  /** 聊天列表（含时间行）；对方 AI 气泡经 `pendingQueue` 逐条并入此 state，避免大批量 setState 卡死 */
  const [items, setItems] = useState<ChatItem[]>([])
  const [musicInviteRespondBusy, setMusicInviteRespondBusy] = useState(false)
  const [miniGameInviteRespondBusy, setMiniGameInviteRespondBusy] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const pendingImageGenUiPatchesRef = useRef(new Map<string, WeChatImageGenUiPatch>())
  const [imageGenPatchVersion, bumpImageGenPatchVersion] = useState(0)
  /** 本地已拆红包：驱动 itemsForDisplay 立刻刷新（不依赖 hydrate 快照相等） */
  const [locallyOpenedRedPacketRev, setLocallyOpenedRedPacketRev] = useState(0)
  const scheduleReconcilePendingImageGenBubblesRef = useRef<() => void>(() => {})
  /** 仅在虚拟/真实日历日切换时重建时间分隔行，避免 currentTimeMs 每秒 tick 全量 setItems */
  const timeRebuildDayKeyRef = useRef('')
  /** 当前会话从 DB 拉取窗口内的完整消息（含「仅 UI 隐藏」），供 AI 转写；与气泡列表展示可不同步 */
  const aiContextDbMessagesRef = useRef<WeChatChatMessage[]>([])
  /** 会话设置里的「仅 UI 隐藏」截止时间；≤ 此时间的消息不展示在列表中 */
  const uiOnlyHiddenCutTsRef = useRef<number | null>(null)
  /** 私聊「聊天信息」：角色发表情包 / 语音 / 黄脸每轮是否出现的触发概率（undefined = 未定制；命中后仍可多条） */
  const convMediaFreqRef = useRef<{
    sticker?: number
    voice?: number
    image?: number
    imageCountMin?: number
    imageCountMax?: number
    classicEmoji?: number
    stickerTargetedModeEnabled?: boolean
    stickerTargetedGroups?: string[]
    stickerTargetedEntries?: import('./wechatMediaSendFrequency').StickerTargetedEntryMap
    stickerBannedRefs?: string[]
    classicEmojiBannedNames?: string[]
  }>({})
  /** 与 ref 同步，供列表渲染兜底：即使 items 曾短暂含「仅 UI 清空」区间消息，也不在前端露出（回收站快照对应内容） */
  const [uiOnlyHiddenCutForView, setUiOnlyHiddenCutForView] = useState<number | null>(null)
  /** 同意好友申请时刻：用于插入「以上为验证消息」分隔条（仅私聊 UI） */
  const [friendRequestAcceptedDividerAtMs, setFriendRequestAcceptedDividerAtMs] = useState<number | null>(null)
  /** 从搜索/日期跳转进聊天时暂时展示全部已加载消息，避免锚点落在被隐藏区间 */
  const ignoreUiOnlyHiddenInListRef = useRef(false)
  const clearUiOnlyHiddenCutLocal = useCallback(() => {
    if (uiOnlyHiddenCutTsRef.current == null) return
    uiOnlyHiddenCutTsRef.current = null
    setUiOnlyHiddenCutForView(null)
    const ck = conversationKey.trim()
    if (!ck) return
    const peerId = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
    const pid = playerIdentityId.trim()
    if (!peerId || !pid) return
    void personaDb
      .upsertChatConversationSettings({
        conversationKey: ck,
        peerCharacterId: peerId,
        playerIdentityId: pid,
        clearUiOnlyHiddenBeforeTimestamp: true,
      })
      .catch(() => {})
  }, [conversationKey, conversationCharacterId, personaCharacterId, playerIdentityId])
  const rebuildWithCurrentTime = useCallback(
    (msgs: ChatMsg[]) => rebuildChatItemsWithTimestamps(msgs, formatWxTimeLabel, getCurrentTimeMs()),
    [formatWxTimeLabel, getCurrentTimeMs],
  )
  const extractMessages = useCallback((list: ChatItem[]) => list.filter((it): it is ChatMsg => it.kind === 'msg'), [])
  const buildChatItemsForAiTranscript = useCallback((): ChatItem[] => {
    const rows = aiContextDbMessagesRef.current
    const dbItems = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(rows))
    const dbIds = new Set(rows.map((r) => r.id))
    const pending = extractMessages(itemsRef.current).filter((m) => !dbIds.has(m.id))
    const mergedMsgs = [...extractMessages(dbItems), ...pending].sort(compareChatMsgByRevealOrder)
    let items = rebuildWithCurrentTime(mergedMsgs)
    if (roomType === 'group' && groupId?.trim()) {
      items = filterGroupChatItemsHideModeratorOnlyBubbles(items, roomType, groupDocRef.current)
    }
    const trimmed = trimChatItemsToAiTurnAnchor(items)
    const msgRows = trimmed.filter((it): it is ChatMsg => it.kind === 'msg')
    const enrichedMsgs = enrichChatRowsMiniGameForAiTranscript(msgRows)
    const enrichedById = new Map(enrichedMsgs.map((m) => [m.id, m]))
    return trimmed.map((it) => (it.kind === 'msg' && enrichedById.has(it.id) ? enrichedById.get(it.id)! : it))
  }, [extractMessages, groupId, rebuildWithCurrentTime, roomType])

  /** 后台 flush（用户已切到其他会话）时从 DB 构建 transcript，避免 itemsRef 被清空导致串会话/空上下文 */
  const buildChatItemsForAiTranscriptForKey = useCallback(
    async (forKey: string, ctx: ReturnType<typeof getConversationFlushContext>): Promise<ChatItem[]> => {
      const key = forKey.trim()
      if (!key) return []
      const bound = resolveBoundConversationFlushContext(
        key,
        ctx,
        null,
        conversationKeyLiveRef.current.trim() === key,
      )
      const fxRoomType = bound.roomType
      const fxGroupId = bound.groupId
      const fxPersonaCharacterId = bound.personaCharacterId
      const fxConversationCharacterId = bound.conversationCharacterId
      const fxUseLumi = bound.useLumiProjectAssistantPrompt
      let rows = await personaDb.listWeChatChatMessagesRecent({ conversationKey: key, limit: 200 })
      if (
        fxRoomType === 'private' &&
        !fxUseLumi &&
        !isWechatGroupConversationKey(key)
      ) {
        const peerSan = (fxPersonaCharacterId || fxConversationCharacterId.trim() || '').trim()
        if (peerSan && peerSan !== WECHAT_LUMI_PEER_CHARACTER_ID) {
          rows = rows.filter((m) => {
            if (m.type === 'player') return parseGroupIdFromGroupPeerCharacterId(m.characterId) == null
            if (m.type === 'character') {
              return m.characterId === peerSan || m.characterId === WECHAT_GROUP_BOT_CHARACTER_ID
            }
            return true
          })
        }
      }
      let items = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(rows))
      if (fxRoomType === 'group' && fxGroupId) {
        const gDoc = await personaDb.getGroupChat(fxGroupId)
        items = filterGroupChatItemsHideModeratorOnlyBubbles(items, fxRoomType, gDoc)
      }
      const trimmed = trimChatItemsToAiTurnAnchor(items)
      const msgRows = trimmed.filter((it): it is ChatMsg => it.kind === 'msg')
      const enrichedMsgs = enrichChatRowsMiniGameForAiTranscript(msgRows)
      const enrichedById = new Map(enrichedMsgs.map((m) => [m.id, m]))
      return trimmed.map((it) => (it.kind === 'msg' && enrichedById.has(it.id) ? enrichedById.get(it.id)! : it))
    },
    [
      conversationCharacterId,
      groupId,
      personaCharacterId,
      rebuildWithCurrentTime,
      roomType,
      useLumiProjectAssistantPrompt,
    ],
  )
  const resolveVoiceSynthCharacterId = useCallback(
    (msg: ChatMsg): string => {
      if (roomType === 'group') {
        const sid = msg.senderCharacterId?.trim()
        if (sid && sid !== WECHAT_GROUP_BOT_CHARACTER_ID) return sid
        return ''
      }
      if (useLumiProjectAssistantPrompt) {
        return personaCharacterId?.trim() || ''
      }
      return (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
    },
    [conversationCharacterId, personaCharacterId, roomType, useLumiProjectAssistantPrompt],
  )

  const ensureVoiceMessageAudio = useCallback(
    async (
      messageId: string,
      voice?: ChatMsg['voice'],
      opts?: { forceResynthesize?: boolean; voiceCharacterId?: string },
    ): Promise<string> => {
      const msgId = messageId.trim()
      if (!msgId || !voice) return ''
      const forceResynthesize = opts?.forceResynthesize === true
      const existingAudioUrl = voice.audioUrl?.trim() || ''
      if (existingAudioUrl && !forceResynthesize) return existingAudioUrl

      const pending = voiceSynthesisPromiseRef.current.get(msgId)
      if (pending) return pending

      const task = (async () => {
        const voiceCharacterId = opts?.voiceCharacterId?.trim() || ''
        const rawScript = String(voice.ttsScript || '').trim()
        const emotion = pickVoiceEmotionForTts(rawScript)
        const playableScript = stripEmotionTagsForTts(rawScript)
        if (!playableScript) return ''
        if (!voiceCharacterId) return ''
        const synthesizedAudioUrl = await synthCharacterVoiceAudioUrl(voiceCharacterId, playableScript, emotion)
        if (!synthesizedAudioUrl) return ''

        setItems((prev) => {
          const next = rebuildWithCurrentTime(
            extractMessages(prev).map((msg) =>
              msg.id !== msgId || !msg.voice
                ? msg
                : {
                    ...msg,
                    voice: {
                      ...msg.voice,
                      audioUrl: synthesizedAudioUrl,
                    },
                  },
            ),
          )
          itemsRef.current = next
          return next
        })

        try {
          await personaDb.patchWeChatChatMessageById(msgId, {
            voice: { audioUrl: synthesizedAudioUrl },
          })
          try {
            await personaDb.syncFavoriteVoiceAudioFromMessage(msgId, synthesizedAudioUrl)
          } catch {
            /* 收藏同步失败不影响聊天播放 */
          }
        } catch (e) {
          logger.log('error', `角色语音缓存落库失败 id=${msgId} err=${e instanceof Error ? e.message : String(e)}`)
        }

        return synthesizedAudioUrl
      })()

      voiceSynthesisPromiseRef.current.set(msgId, task)
      try {
        return await task
      } finally {
        voiceSynthesisPromiseRef.current.delete(msgId)
      }
    },
    [extractMessages, logger, rebuildWithCurrentTime, synthCharacterVoiceAudioUrl],
  )
  const mergeIncomingMessage = useCallback(
    (prev: ChatItem[], incoming: ChatMsg) => {
      // 与异步 hydrate 并发时，可能已存在同 id 行；先去重再追加，避免短暂双气泡闪烁
      const existing = extractMessages(prev).find((m) => m.id === incoming.id)
      const base = extractMessages(prev).filter((m) => m.id !== incoming.id)
      let msg = applyImageGenUiPatchToChatMsgIfAny(incoming, mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current))
      const existingResolved = existing
        ? applyImageGenUiPatchToChatMsgIfAny(existing, mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current))
        : undefined
      const existingImage = existingResolved?.images?.[0]?.base64?.trim()
      const incomingImage = msg.images?.[0]?.base64?.trim()
      if (existingImage && !incomingImage) {
        msg = {
          ...msg,
          images: existingResolved?.images,
          imageGenPending: undefined,
          imageGenFailed: undefined,
        }
      } else if (
        existingResolved?.imageGenPending &&
        !existingImage &&
        incomingImage
      ) {
        msg = {
          ...msg,
          imageGenPending: undefined,
          imageGenFailed: msg.imageGenFailed ?? existingResolved.imageGenFailed,
        }
      }
      // 同 id 重入队时保留已领取，避免角色晚落库 / 再入队用 opened:false 盖掉
      const keepRpOpened =
        Boolean(existingResolved?.redPacket?.opened) ||
        Boolean(msg.redPacket?.opened) ||
        isWeChatRedPacketLocallyOpened(msg.id)
      if (keepRpOpened && msg.redPacket && !msg.redPacket.opened) {
        msg = { ...msg, redPacket: { ...msg.redPacket, opened: true } }
      } else if (keepRpOpened && !msg.redPacket && existingResolved?.redPacket) {
        msg = { ...msg, redPacket: { ...existingResolved.redPacket, opened: true } }
      }
      /**
       * 对方气泡必须与当前列表时间单调一致：否则 hydrate 合并时用 timestamp 排序，
       * 会把「虚拟时间倒退 / 同毫秒」的新消息排到旧消息前面，看起来像跑到列表顶部。
       */
      if (incoming.from === 'other') {
        let maxTs = 0
        for (const m of base) {
          const t = typeof m.timestamp === 'number' ? m.timestamp : 0
          if (t > maxTs) maxTs = t
        }
        const incTs = typeof incoming.timestamp === 'number' ? incoming.timestamp : 0
        if (incTs <= maxTs) {
          msg = { ...msg, timestamp: maxTs + 1 }
        }
      }
      return rebuildWithCurrentTime([...base, msg])
    },
    [extractMessages, rebuildWithCurrentTime],
  )

  const patchChatMsgInList = useCallback(
    (messageId: string, patch: Partial<Pick<ChatMsg, 'images' | 'imageGenPending' | 'imageGenAwaitingConfirm' | 'imageGenFailed'>>) => {
      const mid = messageId.trim()
      if (!mid) return
      const normalizedPatch: WeChatImageGenUiPatch = {
        images: patch.images,
        imageGenPending: patch.imageGenPending,
        imageGenAwaitingConfirm: patch.imageGenAwaitingConfirm,
        imageGenFailed: patch.imageGenFailed,
      }
      pendingImageGenUiPatchesRef.current.set(mid, normalizedPatch)
      rememberWeChatImageGenUiPatch(mid, normalizedPatch)
      const applyPatchToMsg = (msg: ChatMsg) => applyImageGenUiPatchToMsg(msg, patch)
      for (const j of opponentRevealJobsRef.current) {
        if (j.msg.id !== mid) continue
        j.msg = applyPatchToMsg(j.msg)
      }
      for (const j of deferredBubbleRevealJobsRef.current) {
        if (j.msg.id !== mid) continue
        j.msg = applyPatchToMsg(j.msg)
      }
      syncPendingQueueFromRefFnRef.current?.()
      let applied = false
      flushSync(() => {
        setItems((prev) => {
          const prevMsgs = extractMessages(prev)
          const idx = prevMsgs.findIndex((msg) => msg.id === mid)
          if (idx < 0) return prev
          applied = true
          const nextMsgs = prevMsgs.map((msg, i) => (i === idx ? applyPatchToMsg(msg) : msg))
          const next = rebuildWithCurrentTime(nextMsgs)
          itemsRef.current = next
          pendingImageGenUiPatchesRef.current.delete(mid)
          const patchedMsg = nextMsgs[idx]
          if (
            patchedMsg &&
            (patchedMsg.images?.[0]?.base64?.trim() ||
              patchedMsg.imageGenFailed ||
              !patchedMsg.imageGenPending)
          ) {
            clearWeChatImageGenUiPatch(mid)
          }
          return next
        })
      })
      bumpImageGenPatchVersion((v) => v + 1)
      if (!applied) scheduleReconcilePendingImageGenBubblesRef.current()
    },
    [extractMessages, rebuildWithCurrentTime],
  )
  const patchChatMsgInListRef = useRef(patchChatMsgInList)
  patchChatMsgInListRef.current = patchChatMsgInList

  const reconcilePendingImageGenBubblesFromDb = useCallback(async () => {
    const ck = conversationKeyLiveRef.current.trim()
    if (!ck) return
    const stuck = extractMessages(itemsRef.current).filter(
      (m) => m.imageGenPending && !m.images?.[0]?.base64?.trim(),
    )
    const ids = new Set(stuck.map((m) => m.id))
    for (const [id] of pendingImageGenUiPatchesRef.current) ids.add(id)
    for (const [id, patch] of getWeChatImageGenUiPatchMap()) {
      if (isWeChatImageGenUiPatchResolved(patch)) ids.add(id)
    }
    for (const id of ids) {
      try {
        const row = await personaDb.getWeChatChatMessageById(id)
        if (!row || row.conversationKey?.trim() !== ck) continue
        if (row.images?.[0]?.base64?.trim()) {
          patchChatMsgInListRef.current(id, {
            images: row.images,
            imageGenPending: false,
            imageGenAwaitingConfirm: false,
            imageGenFailed: false,
          })
          continue
        }
        if (row.imageGenFailed) {
          patchChatMsgInListRef.current(id, {
            imageGenPending: false,
            imageGenAwaitingConfirm: false,
            imageGenFailed: true,
          })
        }
      } catch {
        /* ignore */
      }
    }
  }, [extractMessages])
  const reconcilePendingImageGenBubblesFromDbRef = useRef(reconcilePendingImageGenBubblesFromDb)
  reconcilePendingImageGenBubblesFromDbRef.current = reconcilePendingImageGenBubblesFromDb

  const scheduleReconcilePendingImageGenBubbles = useCallback(() => {
    const run = () => void reconcilePendingImageGenBubblesFromDbRef.current()
    queueMicrotask(run)
    window.setTimeout(run, 120)
    window.setTimeout(run, 480)
    window.setTimeout(run, 1500)
    window.setTimeout(run, 4000)
  }, [])
  scheduleReconcilePendingImageGenBubblesRef.current = scheduleReconcilePendingImageGenBubbles

  useEffect(() => {
    const hasStuckPendingImageGen = () =>
      extractMessages(itemsRef.current).some(
        (m) => m.imageGenPending && !m.images?.[0]?.base64?.trim(),
      ) || getWeChatImageGenUiPatchMap().size > 0
    if (!hasStuckPendingImageGen()) return
    const timer = window.setInterval(() => {
      if (!hasStuckPendingImageGen()) return
      void reconcilePendingImageGenBubblesFromDbRef.current()
      bumpImageGenPatchVersion((v) => v + 1)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [items, imageGenPatchVersion, extractMessages])

  useEffect(() => {
    const onPatch = (ev: Event) => {
      const detail = (ev as CustomEvent<{ messageId?: string; patch?: WeChatImageGenUiPatch }>).detail
      const messageId = detail?.messageId?.trim()
      const patch = detail?.patch
      if (!messageId || !patch) return
      patchChatMsgInList(messageId, patch)
      scheduleReconcilePendingImageGenBubbles()
      bumpImageGenPatchVersion((v) => v + 1)
    }
    window.addEventListener(WECHAT_IMAGE_GEN_UI_PATCH_EVENT, onPatch)
    return () => window.removeEventListener(WECHAT_IMAGE_GEN_UI_PATCH_EVENT, onPatch)
  }, [patchChatMsgInList, scheduleReconcilePendingImageGenBubbles])

  const mergeOtherIncomingForRoom = useCallback(
    (prev: ChatItem[], incoming: ChatMsg) => {
      if (roomType === 'private' && !useLumiProjectAssistantPrompt) {
        const peer = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
        const sid = incoming.senderCharacterId?.trim()
        if (
          peer &&
          sid &&
          sid !== peer &&
          sid !== WECHAT_GROUP_BOT_CHARACTER_ID &&
          sid !== WECHAT_LUMI_PEER_CHARACTER_ID
        ) {
          return prev
        }
      }
      return filterGroupChatItemsHideModeratorOnlyBubbles(mergeIncomingMessage(prev, incoming), roomType, null)
    },
    [conversationCharacterId, mergeIncomingMessage, personaCharacterId, roomType, useLumiProjectAssistantPrompt],
  )

  const appendSystemNote = useCallback(
    async (text: string) => {
      const seg = String(text ?? '').trim()
      if (!seg) return
      const ts = getCurrentTimeMs()
      const id = `wxsys-${ts}-${Math.random().toString(36).slice(2, 7)}`
      try {
        await personaDb.appendWeChatChatMessage({
          id,
          characterId: conversationCharacterId,
          playerIdentityId,
          type: 'player',
          content: seg,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      } catch {
        // ignore
      }
      const incoming: ChatMsg = { id, kind: 'msg', from: 'self', text: seg, timestamp: ts, status: 'sent', selfAnimated: true }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([...extractMessages(prev), incoming])
        itemsRef.current = next
        return next
      })
    },
    [conversationCharacterId, conversationKey, extractMessages, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime],
  )

  /** 对方领取本人发出的红包：由模型输出 `[REDPACKET_OPEN]` 触发；系统灰条进异步揭示队列 */
  const createPeerClaimedSelfRedPacketStripRevealJob = useCallback(
    (packetMsgId: string): OpponentRevealJob => {
      const stripId = `wxsys-rp-${getCurrentTimeMs()}-${Math.random().toString(36).slice(2, 8)}`
      const stripText = `【系统】${peerNotifyTitle.trim() || '对方'}领取了你的红包`
      const stripMsg: ChatMsg = {
        id: stripId,
        kind: 'msg',
        from: 'self',
        text: stripText,
        timestamp: 0,
        status: 'sent',
      }
      return {
        forConversationKey: conversationKey,
        msg: stripMsg,
        persist: () => {
          void (async () => {
            try {
              const row = await personaDb.getWeChatChatMessageById(packetMsgId)
              const cur = row?.redPacket
              if (!row || row.type !== 'player' || !cur || cur.opened || cur.expired) return
              await personaDb.patchWeChatChatMessageById(packetMsgId, {
                redPacket: { ...cur, opened: true },
              })
              await personaDb.appendWeChatChatMessage({
                id: stripId,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'player',
                content: stripText,
                timestamp: stripMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              const pid = cur.packetId?.trim()
              if (pid) {
                const redPacketNotified = readNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY)
                redPacketNotified.add(`opened:${pid}`)
                writeNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY, redPacketNotified)
              }
              setItems((prev) => {
                const msgs = extractMessages(prev).map((it) =>
                  it.id === packetMsgId && it.redPacket
                    ? { ...it, redPacket: { ...it.redPacket, opened: true } }
                    : it,
                )
                const next = rebuildWithCurrentTime(msgs)
                itemsRef.current = next
                return next
              })
              markLumiRedPacketOpenedUi(packetMsgId)
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [
      conversationCharacterId,
      conversationKey,
      extractMessages,
      getCurrentTimeMs,
      peerNotifyTitle,
      playerIdentityId,
      rebuildWithCurrentTime,
    ],
  )

  /** 角色确认收下用户转出的转账：仅对方转账卡气泡；`beforeReveal` 内 accept，与发送方「已收款」UI 同步露出 */
  const createCharacterTransferAcceptedAckRevealJob = useCallback(
    (transferId: string): OpponentRevealJob => {
      const tid = transferId.trim()
      const msgId = `wxtr-peer-ack-${tid}`
      const rec = getLumiTransferFresh(tid, getCurrentTimeMs)
      const rmk = rec?.remark?.trim()
      const text = rmk ? `[转账] ${rmk}` : '[转账]'
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: conversationCharacterId,
        text,
        timestamp: 0,
        status: 'sent',
        otherAnimated: true,
        transfer: { transferId: tid },
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        opponentRevealFlushSync: true,
        beforeReveal: () => {
          acceptLumiTransfer(tid, getCurrentTimeMs, { emitChanged: false })
        },
        persist: () => {
          void (async () => {
            try {
              const r = getLumiTransferFresh(tid, getCurrentTimeMs)
              if (r?.status !== 'accepted') return
              const mk = r.remark?.trim()
              const content = mk ? `[转账] ${mk}` : '[转账]'
              try {
                await personaDb.appendWeChatChatMessage({
                  id: msgId,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'character',
                  content,
                  timestamp: ackMsg.timestamp,
                  isRead: true,
                  conversationKey,
                  quiet: true,
                  transfer: { transferId: tid },
                })
              } catch {
                /* 同 id 重复揭示时忽略 */
              }
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [conversationCharacterId, conversationKey, getCurrentTimeMs, playerIdentityId],
  )

  /** 对方退还用户转出的待收款：系统灰条 + 与定时器去重（避免再插一条「退还」系统说明） */
  const createPeerReturnedSelfTransferStripRevealJob = useCallback(
    (transferMsgId: string, opts?: { returnIfPending?: boolean }): OpponentRevealJob => {
      const returnIfPending = opts?.returnIfPending !== false
      const tid = transferMsgId.trim()
      const stripId = `wxsys-tr-return-${tid}`
      const stripText = `【系统】${peerNotifyTitle.trim() || '对方'}退还了你的转账`
      const stripMsg: ChatMsg = {
        id: stripId,
        kind: 'msg',
        from: 'self',
        text: stripText,
        timestamp: 0,
        status: 'sent',
      }
      return {
        forConversationKey: conversationKey,
        msg: stripMsg,
        persist: () => {
          void (async () => {
            try {
              if (returnIfPending) {
                returnLumiTransfer(tid, getCurrentTimeMs)
              }
              const rec = getLumiTransferFresh(tid, getCurrentTimeMs)
              if (rec?.status !== 'returned') return
              try {
                await personaDb.appendWeChatChatMessage({
                  id: stripId,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'player',
                  content: stripText,
                  timestamp: stripMsg.timestamp,
                  isRead: true,
                  conversationKey,
                })
              } catch {
                /* 同 id 重复揭示时忽略 */
              }
              const transferNotified = readNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY)
              transferNotified.add(tid)
              writeNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY, transferNotified)
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [conversationCharacterId, conversationKey, getCurrentTimeMs, peerNotifyTitle, playerIdentityId],
  )

  /** 角色退还用户转出的转账：对方转账卡气泡「已退还」 */
  const createCharacterTransferReturnedAckRevealJob = useCallback(
    (transferId: string): OpponentRevealJob => {
      const tid = transferId.trim()
      const msgId = `wxtr-peer-return-${tid}`
      const rec = getLumiTransferFresh(tid, getCurrentTimeMs)
      const rmk = rec?.remark?.trim()
      const text = rmk ? `[转账] ${rmk}` : '[转账]'
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: conversationCharacterId,
        text,
        timestamp: 0,
        status: 'sent',
        otherAnimated: true,
        transfer: { transferId: tid },
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        persist: () => {
          void (async () => {
            try {
              const r = getLumiTransferFresh(tid, getCurrentTimeMs)
              if (r?.status !== 'returned') return
              const mk = r.remark?.trim()
              const content = mk ? `[转账] ${mk}` : '[转账]'
              try {
                await personaDb.appendWeChatChatMessage({
                  id: msgId,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'character',
                  content,
                  timestamp: ackMsg.timestamp,
                  isRead: true,
                  conversationKey,
                  quiet: true,
                  transfer: { transferId: tid },
                })
              } catch {
                /* 同 id 重复揭示时忽略 */
              }
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [conversationCharacterId, conversationKey, getCurrentTimeMs, playerIdentityId],
  )

  const createMusicSyncAcceptRevealJob = useCallback(
    (invite: WeChatMusicSyncInvitePayload, replyText: string): OpponentRevealJob => {
      const ts = getCurrentTimeMs()
      const msgId = `wxm-${ts}-msa-${Math.random().toString(36).slice(2, 8)}`
      const body = replyText.trim() || '频率已接轨。'
      const acceptSync = {
        kind: 'music_accept' as const,
        inviteId: invite.inviteId,
        replyText: body,
        ...(invite.coverUrl?.trim() ? { coverUrl: invite.coverUrl.trim() } : {}),
        ...(invite.trackTitle?.trim() ? { trackTitle: invite.trackTitle.trim() } : {}),
        ...(invite.trackArtist?.trim() ? { trackArtist: invite.trackArtist.trim() } : {}),
      }
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: conversationCharacterId,
        text: body,
        timestamp: ts,
        status: 'sent',
        otherAnimated: true,
        musicSync: acceptSync,
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        beforeReveal: () => {
          const userName = playerDisplayName.trim() || state.profile.displayName.trim() || '我'
          const wechatAvatar = playerAvatarResolved || ''
          const userAvatar = resolveListenTogetherSyncUserAvatar({ wechatAvatarUrl: wechatAvatar })
          const companionName = peerNotifyTitle.trim() || '对方'
          const companionAvatar = peerAvatarResolved?.trim() || ''
          useMusicStore.getState().setSyncListening({
            user: { name: userName, avatar: userAvatar },
            companion: {
              name: companionName,
              avatar: companionAvatar,
              characterId: conversationCharacterId,
            },
          })
        },
        persist: () => {
          void (async () => {
            try {
              await personaDb.appendWeChatChatMessage({
                id: msgId,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'character',
                content: body,
                musicSync: acceptSync,
                timestamp: ackMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [
      conversationCharacterId,
      conversationKey,
      getCurrentTimeMs,
      peerAvatarResolved,
      peerNotifyTitle,
      playerAvatarResolved,
      playerDisplayName,
      playerIdentityId,
      state.profile.displayName,
    ],
  )

  const createMusicSyncDeclineRevealJob = useCallback(
    (invite: WeChatMusicSyncInvitePayload, replyText: string): OpponentRevealJob => {
      const ts = getCurrentTimeMs()
      const msgId = `wxm-${ts}-msd-${Math.random().toString(36).slice(2, 8)}`
      const body = replyText.trim() || '现在没空，自己听吧。'
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: conversationCharacterId,
        text: body,
        timestamp: ts,
        status: 'sent',
        otherAnimated: true,
        musicSync: { kind: 'music_decline', inviteId: invite.inviteId, replyText: body },
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        persist: () => {
          void (async () => {
            try {
              await personaDb.appendWeChatChatMessage({
                id: msgId,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'character',
                content: body,
                musicSync: { kind: 'music_decline', inviteId: invite.inviteId, replyText: body },
                timestamp: ackMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [conversationCharacterId, conversationKey, getCurrentTimeMs, playerIdentityId],
  )

  const createMiniGameAcceptRevealJob = useCallback(
    (
      invite: WeChatMiniGameInvitePayload,
      replyText: string,
      userInviteMsgId: string,
      gomokuSession?: GomokuSessionSetup,
    ): OpponentRevealJob => {
      const ts = getCurrentTimeMs()
      const msgId = `wxm-${ts}-mga-${Math.random().toString(36).slice(2, 8)}`
      const body = replyText.trim() || '好啊，来！'
      const acceptPayload = buildMiniGameAcceptPayload({ invite, replyText: body, gomokuSession })
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: conversationCharacterId,
        text: body,
        timestamp: ts,
        status: 'sent',
        otherAnimated: true,
        miniGameInvite: acceptPayload,
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        opponentRevealFlushSync: true,
        beforeReveal: () => {
          const inviteId = invite.inviteId.trim()
          const status = 'accepted' as const
          setItems((prev) => {
            const next = rebuildWithCurrentTime(
              extractMessages(prev).map((msg) => {
                if (!shouldSyncMiniGameInviteCharResponded(msg, userInviteMsgId, inviteId)) return msg
                const mg = msg.miniGameInvite!
                return { ...msg, miniGameInvite: { ...mg, charResponded: status } }
              }),
            )
            itemsRef.current = next
            return next
          })
          void (async () => {
            try {
              for (const msg of extractMessages(itemsRef.current)) {
                if (!shouldSyncMiniGameInviteCharResponded(msg, userInviteMsgId, inviteId)) continue
                const mg = msg.miniGameInvite
                if (!mg || mg.kind !== 'game_invite') continue
                await personaDb.patchWeChatChatMessageById(msg.id, {
                  miniGameInvite: { ...mg, charResponded: status },
                })
              }
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
        persist: () => {
          void (async () => {
            try {
              await personaDb.appendWeChatChatMessage({
                id: msgId,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'character',
                content: body,
                miniGameInvite: acceptPayload,
                timestamp: ackMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [
      conversationCharacterId,
      conversationKey,
      extractMessages,
      getCurrentTimeMs,
      playerIdentityId,
      rebuildWithCurrentTime,
    ],
  )

  const createMiniGameDeclineRevealJob = useCallback(
    (
      invite: WeChatMiniGameInvitePayload,
      replyText: string,
      userInviteMsgId: string,
    ): OpponentRevealJob => {
      const ts = getCurrentTimeMs()
      const msgId = `wxm-${ts}-mgd-${Math.random().toString(36).slice(2, 8)}`
      const body = replyText.trim() || '现在没空，下次吧。'
      const declinePayload = buildMiniGameDeclinePayload({ invite, replyText: body })
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: conversationCharacterId,
        text: body,
        timestamp: ts,
        status: 'sent',
        otherAnimated: true,
        miniGameInvite: declinePayload,
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        opponentRevealFlushSync: true,
        beforeReveal: () => {
          const inviteId = invite.inviteId.trim()
          const status = 'declined' as const
          setItems((prev) => {
            const next = rebuildWithCurrentTime(
              extractMessages(prev).map((msg) => {
                if (!shouldSyncMiniGameInviteCharResponded(msg, userInviteMsgId, inviteId)) return msg
                const mg = msg.miniGameInvite!
                return { ...msg, miniGameInvite: { ...mg, charResponded: status } }
              }),
            )
            itemsRef.current = next
            return next
          })
          void (async () => {
            try {
              for (const msg of extractMessages(itemsRef.current)) {
                if (!shouldSyncMiniGameInviteCharResponded(msg, userInviteMsgId, inviteId)) continue
                const mg = msg.miniGameInvite
                if (!mg || mg.kind !== 'game_invite') continue
                await personaDb.patchWeChatChatMessageById(msg.id, {
                  miniGameInvite: { ...mg, charResponded: status },
                })
              }
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
        persist: () => {
          void (async () => {
            try {
              await personaDb.appendWeChatChatMessage({
                id: msgId,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'character',
                content: body,
                miniGameInvite: declinePayload,
                timestamp: ackMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [
      conversationCharacterId,
      conversationKey,
      extractMessages,
      getCurrentTimeMs,
      playerIdentityId,
      rebuildWithCurrentTime,
    ],
  )

  const buildCharacterMusicSyncSessionContext = useCallback(() => {
    const userName = playerDisplayName.trim() || state.profile.displayName.trim() || '我'
    const wechatAvatar = playerAvatarResolved || ''
    const userAvatar = resolveListenTogetherSyncUserAvatar({ wechatAvatarUrl: wechatAvatar })
    const companionName = peerNotifyTitle.trim() || '对方'
    const companionAvatar = peerAvatarResolved?.trim() || ''
    return {
      characterId: conversationCharacterId,
      user: { name: userName, avatar: userAvatar },
      companion: {
        name: companionName,
        avatar: companionAvatar,
        characterId: conversationCharacterId,
      },
    }
  }, [
    conversationCharacterId,
    peerAvatarResolved,
    peerNotifyTitle,
    playerAvatarResolved,
    playerDisplayName,
    state.profile.displayName,
  ])

  const createCharacterMusicSyncInviteRevealJob = useCallback(
    (
      invite: WeChatMusicSyncInvitePayload,
      replyText?: string,
      characterId?: string,
    ): OpponentRevealJob => {
      const charId = characterId?.trim() || conversationCharacterId
      const ts = getCurrentTimeMs()
      const msgId = `wxm-${ts}-cmi-${Math.random().toString(36).slice(2, 8)}`
      const body = replyText?.trim() || '[音乐共听邀约]'
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: charId,
        text: body,
        timestamp: ts,
        status: 'sent',
        otherAnimated: true,
        musicSync: invite,
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        opponentRevealFlushSync: true,
        persist: () => {
          void (async () => {
            try {
              await personaDb.appendWeChatChatMessage({
                id: msgId,
                characterId: charId,
                playerIdentityId,
                type: 'character',
                content: body,
                musicSync: invite,
                timestamp: ackMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [conversationCharacterId, conversationKey, getCurrentTimeMs, playerIdentityId],
  )

  const createCharacterMiniGameInviteRevealJob = useCallback(
    (
      invite: WeChatMiniGameInvitePayload,
      replyText?: string,
      characterId?: string,
      messageId?: string,
    ): OpponentRevealJob => {
      const charId = characterId?.trim() || conversationCharacterId
      const ts = getCurrentTimeMs()
      const msgId = messageId?.trim() || `wxm-${ts}-cgi-${Math.random().toString(36).slice(2, 8)}`
      const body = replyText?.trim() || invite.replyText?.trim() || '[游戏邀请]'
      const ackMsg: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'other',
        senderCharacterId: charId,
        text: body,
        timestamp: ts,
        status: 'sent',
        otherAnimated: true,
        miniGameInvite: invite,
      }
      return {
        forConversationKey: conversationKey,
        msg: ackMsg,
        opponentRevealFlushSync: true,
        persist: () => {
          void (async () => {
            try {
              await personaDb.appendWeChatChatMessage({
                id: msgId,
                characterId: charId,
                playerIdentityId,
                type: 'character',
                content: body,
                miniGameInvite: invite,
                timestamp: ackMsg.timestamp,
                isRead: true,
                conversationKey,
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore */
            }
          })()
        },
      }
    },
    [conversationCharacterId, conversationKey, getCurrentTimeMs, playerIdentityId],
  )

  const appendCallStatusBubble = useCallback(
    async (
      payload: { status: 'rejected' | 'no_answer' | 'duration'; durationSec?: number },
      initiator: 'self' | 'other' = 'self',
    ) => {
      const ts = getCurrentTimeMs()
      const dedupKey = `${initiator}:${payload.status}:${payload.durationSec ?? 0}`
      const last = callBubbleDedupRef.current
      if (last && last.key === dedupKey && ts - last.ts < 1200) return
      callBubbleDedupRef.current = { key: dedupKey, ts }
      const id = `wxcall-${ts}-${Math.random().toString(36).slice(2, 7)}`
      const content = '[通话]'
      const msgType = initiator === 'self' ? 'player' : 'character'
      const from = initiator === 'self' ? 'self' : 'other'
      try {
        await personaDb.appendWeChatChatMessage({
          id,
          characterId: conversationCharacterId,
          playerIdentityId,
          type: msgType,
          content,
          callStatus: payload,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      } catch {
        // ignore
      }
      const incoming: ChatMsg = {
        id,
        kind: 'msg',
        from,
        text: content,
        timestamp: ts,
        status: 'sent',
        callStatus: payload,
        selfAnimated: from === 'self' ? true : undefined,
        otherAnimated: from === 'other' ? true : undefined,
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([...extractMessages(prev), incoming])
        itemsRef.current = next
        return next
      })
    },
    [conversationCharacterId, conversationKey, extractMessages, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime],
  )

  useEffect(() => {
    const rebuildIfDayChanged = () => {
      const now = getCurrentTimeMs()
      const d = new Date(now)
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (timeRebuildDayKeyRef.current === dayKey) return
      timeRebuildDayKeyRef.current = dayKey
      setItems((prev) => {
        const rebuilt = rebuildWithCurrentTime(extractMessages(prev))
        itemsRef.current = rebuilt
        return rebuilt
      })
    }
    rebuildIfDayChanged()
    const id = window.setInterval(rebuildIfDayChanged, 60_000)
    return () => window.clearInterval(id)
  }, [extractMessages, rebuildWithCurrentTime, getCurrentTimeMs])

  // 让角色/Lumi“知道”转账退还、红包 24h 未领取：用系统提示消息写入对话历史（供模型读取）。
  useEffect(() => {
    let cancelled = false
    const transferNotified = readNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY)
    const redPacketNotified = readNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY)

    const tick = async () => {
      if (cancelled) return
      const now = getCurrentTimeMs()

      // 1) 转账：检查 localStorage 中是否出现 pending->returned（超时或主动退还），写入一次系统提示
      evaluateExpiredTransfers(() => now)
      for (const it of extractMessages(itemsRef.current)) {
        const tid = it.transfer?.transferId?.trim()
        if (!tid) continue
        if (transferNotified.has(tid)) continue
        const rec = getLumiTransferFresh(tid, () => now)
        if (rec?.status === 'returned') {
          transferNotified.add(tid)
          writeNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY, transferNotified)
          const peerName = peerNotifyTitle.trim() || '对方'
          if (rec.receiverId === playerIdentityId) {
            void appendSystemNote(`【系统】你退还了${peerName}的转账`)
          } else {
            void appendSystemNote(`【系统】${peerName}退还了你的转账`)
          }
        }
      }

      // 2) 红包：24h 未领取 → 失效提示（不改红包状态，仅提示一次，便于模型感知）
      const EXPIRE_MS = 24 * 60 * 60 * 1000
      for (const it of extractMessages(itemsRef.current)) {
        const rp = it.redPacket
        if (!rp || rp.opened) continue
        const pid = rp.packetId?.trim()
        if (!pid) continue
        if (redPacketNotified.has(pid)) continue
        if (now - it.timestamp >= EXPIRE_MS) {
          redPacketNotified.add(pid)
          writeNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY, redPacketNotified)
          void appendSystemNote('【系统】红包24小时未领取，已自动退回')
        }
      }

      // 3) 「对方领取了你的红包」系统条：须模型输出 `[REDPACKET_OPEN]`，由异步揭示队列插入（见 createPeerClaimedSelfRedPacketStripRevealJob），
      // 避免定时器用当前时间落库导致排序落到列表末尾、与台词顺序脱节。
    }

    const id = window.setInterval(() => void tick(), 4000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [appendSystemNote, extractMessages, getCurrentTimeMs, peerNotifyTitle, playerIdentityId])

  const oldestMsgTsRef = useRef<number | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [, setHistoryExhausted] = useState(false)
  const [hasOlderHistory, setHasOlderHistory] = useState(false)
  const [visibleMsgLimit, setVisibleMsgLimit] = useState(CHAT_VISIBLE_MSG_INITIAL)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const historyExhaustedRef = useRef(false)
  const userScrolledRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputBarRef = useRef<HTMLDivElement>(null)
  const keyboardInsetFillRef = useRef<HTMLDivElement>(null)
  const newMsgFabWrapRef = useRef<HTMLDivElement>(null)
  const keyboardInsetRef = useRef(0)
  const keyboardBaselineRef = useRef({ current: 0 })
  const syncChatScrollForKeyboardRef = useRef<() => void>(() => {})
  const scheduleStickChatScrollToBottomRef = useRef<() => void>(() => {})
  const chatScrollThemeFallback = useMemo(
    () => wechatChatRoomBgFallbackColor(chatRoomDefaultBg),
    [chatRoomDefaultBg],
  )
  const chatTailMaskColor = chatScrollThemeFallback
  const isAtBottomRef = useRef(true)
  const [pendingNewCount, setPendingNewCount] = useState(0)
  /** hydrate 在落库中断恢复后需清掉底部三点等 UI，定义早于 hydrateMessages */
  const typingInterruptPendingUiClearRef = useRef<string | null>(null)

  const hydrateMessages = useCallback(
    async (scrollToBottom: boolean) => {
      const runId = ++hydrateRunIdRef.current
      const hydrateForKey = conversationKey
      if (!hydrateForKey) return
      const stillSameConv = () => conversationKeyLiveRef.current === hydrateForKey
      const stillThisRun = () => runId === hydrateRunIdRef.current && stillSameConv()
      // 首屏只取可见窗口附近，勿过大；索引游标路径已支持任意 limit
      const recentLimit = Math.max(CHAT_VISIBLE_MSG_INITIAL, Math.min(80, visibleMsgLimit + 20))
      let msgs = await personaDb.listWeChatChatMessagesRecent({
        conversationKey: hydrateForKey,
        limit: recentLimit,
      })
      if (!stillThisRun()) return

      /** 人设私聊：过滤误入的群聊占位玩家气泡与其它 NPC 气泡（与 repairMisfiledWeChatMessagesAfterThreadMixup 一致，避免串台观感） */
      if (
        roomType === 'private' &&
        !useLumiProjectAssistantPrompt &&
        !isWechatGroupConversationKey(hydrateForKey)
      ) {
        const peerSan = (personaCharacterId?.trim() || conversationCharacterId.trim() || '').trim()
        if (peerSan && peerSan !== WECHAT_LUMI_PEER_CHARACTER_ID) {
          msgs = msgs.filter((m) => {
            if (m.type === 'player') return parseGroupIdFromGroupPeerCharacterId(m.characterId) == null
            if (m.type === 'character') {
              return m.characterId === peerSan || m.characterId === WECHAT_GROUP_BOT_CHARACTER_ID
            }
            return true
          })
        }
      }

      // Lumi 小助手：首次进入且无历史时，写入默认开场白（只写一次，避免每次进入都刷屏）。
      const isLumiAssistantSession =
        useLumiProjectAssistantPrompt && conversationCharacterId === WECHAT_LUMI_PEER_CHARACTER_ID
      if (isLumiAssistantSession && msgs.length === 0) {
        const alreadyHas =
          (await personaDb.peekLatestWeChatChatMessage(hydrateForKey)) != null ||
          ((await personaDb.getChatConversationSettings(hydrateForKey))?.lastMessageTime ?? 0) > 0
        if (alreadyHas) {
          if (!stillThisRun()) return
          msgs = await personaDb.listWeChatChatMessagesRecent({
            conversationKey: hydrateForKey,
            limit: recentLimit,
          })
          if (!stillThisRun()) return
        } else {
          const baseTs = getCurrentTimeMs()
          for (let i = 0; i < LUMI_DEFAULT_OPENING_BUBBLES.length; i += 1) {
            const content = LUMI_DEFAULT_OPENING_BUBBLES[i]?.trim()
            if (!content) continue
            const id = makeStableLumiOpeningId(hydrateForKey, i)
            // 已有同 id 开场白绝不可 put 重写——会把 timestamp 刷成「现在」挤到列表底部
            const existed = await personaDb.getWeChatChatMessageById(id)
            if (existed) continue
            const row: WeChatChatMessage = {
              id,
              characterId: conversationCharacterId,
              playerIdentityId,
              type: 'character',
              content,
              timestamp: baseTs + i,
              isRead: true,
              conversationKey: hydrateForKey,
            }
            try {
              await personaDb.appendWeChatChatMessage({ ...row, quiet: true })
            } catch {
              // ignore
            }
          }
          if (!stillThisRun()) return
          msgs = await personaDb.listWeChatChatMessagesRecent({
            conversationKey: hydrateForKey,
            limit: recentLimit,
          })
          if (!stillThisRun()) return
        }
      }

      // 普通角色会话：若首次进入且无历史，按人设开场白（每行一个气泡）写入一次。
      if (!isLumiAssistantSession && msgs.length === 0) {
        const cid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
        if (cid) {
          try {
            // 列表偶发读空 / 会话键瞬时不一致时，禁止把开场白按「新消息」写到最底
            const alreadyHas =
              (await personaDb.peekLatestWeChatChatMessage(hydrateForKey)) != null ||
              ((await personaDb.getChatConversationSettings(hydrateForKey))?.lastMessageTime ?? 0) > 0 ||
              (await personaDb.getWeChatChatMessageById(makeStablePersonaOpeningId(hydrateForKey, 0))) != null
            if (alreadyHas) {
              if (!stillThisRun()) return
              msgs = await personaDb.listWeChatChatMessagesRecent({
                conversationKey: hydrateForKey,
                limit: recentLimit,
              })
              if (!stillThisRun()) return
            } else {
              const ch = await personaDb.getCharacter(cid)
              if (!stillThisRun()) return
              const openingBubbles = String(ch?.openingLines || '')
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 8)
              if (openingBubbles.length) {
                const baseTs = getCurrentTimeMs()
                for (let i = 0; i < openingBubbles.length; i += 1) {
                  const content = openingBubbles[i]!
                  const id = makeStablePersonaOpeningId(hydrateForKey, i)
                  const existed = await personaDb.getWeChatChatMessageById(id)
                  if (existed) continue
                  const row: WeChatChatMessage = {
                    id,
                    characterId: conversationCharacterId,
                    playerIdentityId,
                    type: 'character',
                    content,
                    timestamp: baseTs + i,
                    isRead: true,
                    conversationKey: hydrateForKey,
                  }
                  try {
                    await personaDb.appendWeChatChatMessage({ ...row, quiet: true })
                  } catch {
                    // ignore
                  }
                }
                msgs = await personaDb.listWeChatChatMessagesRecent({
                  conversationKey: hydrateForKey,
                  limit: recentLimit,
                })
                if (!stillThisRun()) return
              }
            }
          } catch {
            // ignore
          }
        }
      }

      let convSt: Awaited<ReturnType<typeof personaDb.getChatConversationSettings>> = null
      try {
        convSt = await personaDb.getChatConversationSettings(hydrateForKey)
      } catch {
        convSt = null
      }
      if (!stillThisRun()) return
      const rawUiCut = convSt?.uiOnlyHiddenBeforeTimestamp
      const uiCut =
        typeof rawUiCut === 'number' && Number.isFinite(rawUiCut) && rawUiCut > 0 ? rawUiCut : null
      uiOnlyHiddenCutTsRef.current = uiCut
      setUiOnlyHiddenCutForView(uiCut)
      const rawFrAcc = convSt?.friendRequestAcceptedAtMs
      setFriendRequestAcceptedDividerAtMs(
        typeof rawFrAcc === 'number' && Number.isFinite(rawFrAcc) && rawFrAcc > 0 ? rawFrAcc : null,
      )
      convMediaFreqRef.current = {
        sticker: parseStoredRoundTriggerPercent(convSt?.stickerRoundTriggerPercent),
        voice: parseStoredRoundTriggerPercent(convSt?.voiceRoundTriggerPercent),
        image: parseStoredRoundTriggerPercent(convSt?.imageRoundTriggerPercent),
        imageCountMin: convSt?.imageRoundCountMin,
        imageCountMax: convSt?.imageRoundCountMax,
        classicEmoji: parseStoredRoundTriggerPercent(convSt?.classicEmojiRoundTriggerPercent),
        stickerTargetedModeEnabled: convSt?.stickerTargetedModeEnabled === true,
        stickerTargetedGroups: convSt?.stickerTargetedGroups,
        stickerTargetedEntries: convSt?.stickerTargetedEntries,
        stickerBannedRefs: convSt?.stickerBannedRefs,
        classicEmojiBannedNames: convSt?.classicEmojiBannedNames,
      }
      const peerCid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || undefined
      const msgsForWeChat = stripLegacyMeetImportedWeChatMessages(msgs, peerCid)
      let effectiveUiCut = uiCut
      if (
        effectiveUiCut != null &&
        !ignoreUiOnlyHiddenInListRef.current &&
        msgsForWeChat.length > 0 &&
        !msgsForWeChat.some((m) => m.timestamp > effectiveUiCut!)
      ) {
        /**
         * 旧版曾用 Date.now() 写 cut、消息用 getCurrentTimeMs()：cut 明显大于所有消息时会「全藏」。
         * 「仅清空界面」则把 cut 设为会话内最大 timestamp，此时全藏是预期，**禁止**撤销。
         * 仅当 cut 比最新消息还靠后超过 1s（墙钟/模拟时偏差）时才清掉坏 cut。
         */
        const maxMsgTs = Math.max(
          ...msgsForWeChat.map((m) =>
            typeof m.timestamp === 'number' && Number.isFinite(m.timestamp) ? m.timestamp : 0,
          ),
        )
        if (effectiveUiCut > maxMsgTs + 1000) {
          effectiveUiCut = null
          uiOnlyHiddenCutTsRef.current = null
          setUiOnlyHiddenCutForView(null)
          const peerId = convSt?.peerCharacterId?.trim() || conversationCharacterId.trim()
          const pid = convSt?.playerIdentityId?.trim() || playerIdentityId.trim()
          if (peerId && pid) {
            void personaDb
              .upsertChatConversationSettings({
                conversationKey: hydrateForKey,
                peerCharacterId: peerId,
                playerIdentityId: pid,
                clearUiOnlyHiddenBeforeTimestamp: true,
              })
              .catch(() => {})
          }
        }
      } else if (effectiveUiCut !== uiCut) {
        uiOnlyHiddenCutTsRef.current = effectiveUiCut
        setUiOnlyHiddenCutForView(effectiveUiCut)
      }
      aiContextDbMessagesRef.current = msgsForWeChat

      // 先进房上屏：贴纸/语音修复改后台，避免串行 await 把聊天室卡成白屏
      let mapped = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(msgsForWeChat))
      if (roomType === 'group' && groupId?.trim()) {
        let gSnap = groupDocRef.current
        if (!gSnap) {
          try {
            gSnap = await personaDb.getGroupChat(groupId.trim())
          } catch {
            gSnap = null
          }
          if (!stillThisRun()) return
        }
        mapped = filterGroupChatItemsHideModeratorOnlyBubbles(mapped, roomType, gSnap)
      }
      if (!stillThisRun()) return
      await Promise.resolve()
      if (!stillThisRun()) return
      {
        const dbMsgs = extractMessages(mapped)
        const dbIds = new Set(msgsForWeChat.map((m) => m.id))
        const liveById = new Map(extractMessages(itemsRef.current).map((m) => [m.id, m]))
        const mergedDbMsgs = dbMsgs.map((dbMsg) => {
          const live = liveById.get(dbMsg.id)
          return live ? preferResolvedImageGenChatMsg(dbMsg, live) : dbMsg
        })
        const pending = extractMessages(itemsRef.current).filter((m) => !dbIds.has(m.id))
        const mergedMsgs = dedupeChatMsgsById([...mergedDbMsgs, ...pending].sort(compareChatMsgByRevealOrder))
        let mergedItems = rebuildWithCurrentTime(mergedMsgs)
        if (roomType === 'group' && groupId?.trim()) {
          mergedItems = filterGroupChatItemsHideModeratorOnlyBubbles(
            mergedItems,
            roomType,
            groupDocRef.current,
          )
        }
        mapped = mergedItems
      }
      if (!stillThisRun()) return
      const prevOtherIds = new Set(
        itemsRef.current
          .filter((it): it is ChatMsg => it.kind === 'msg' && it.from === 'other')
          .map((it) => it.id),
      )
      const appendedOtherCount = mapped.reduce((acc, it) => {
        if (it.kind !== 'msg' || it.from !== 'other') return acc
        return prevOtherIds.has(it.id) ? acc : acc + 1
      }, 0)
      oldestMsgTsRef.current = msgs.length ? (msgs[0]?.timestamp ?? null) : null
      {
        const oldestTs = msgs[0]?.timestamp
        if (oldestTs == null) {
          historyExhaustedRef.current = true
          setHistoryExhausted(true)
          setHasOlderHistory(false)
        } else {
          void personaDb
            .listWeChatChatMessagesRecent({
              conversationKey: hydrateForKey,
              limit: 1,
              beforeTimestamp: oldestTs,
            })
            .then((olderProbe) => {
              if (!stillThisRun()) return
              const hasOlder = olderProbe.length > 0
              historyExhaustedRef.current = !hasOlder
              setHistoryExhausted(!hasOlder)
              setHasOlderHistory(hasOlder)
            })
            .catch(() => {})
        }
      }
      if (!stillThisRun()) return
      if (readTypingInterruptRecover(hydrateForKey)) {
        persistTypingInterruptRecover(hydrateForKey, false)
        persistChatAwaitingAiTyping(hydrateForKey, false)
        typingInterruptPendingUiClearRef.current = hydrateForKey
      }
      setItems((prev) => {
        const mergedMsgs = mergeHydratedMsgsWithLivePrev(
          extractMessages(mapped),
          extractMessages(prev),
          mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current),
        )
        let finalItems = rebuildWithCurrentTime(mergedMsgs)
        if (roomType === 'group' && groupId?.trim()) {
          finalItems = filterGroupChatItemsHideModeratorOnlyBubbles(
            finalItems,
            roomType,
            groupDocRef.current,
          )
        }
        if (chatItemsMessageSnapshotEqual(prev, finalItems)) {
          return prev
        }
        itemsRef.current = finalItems
        return finalItems
      })

      void (async () => {
        try {
          await ensureStickerStoreHydrated()
          if (!stillThisRun()) return
          const repairedDisplayMsgs = await Promise.all(
            msgsForWeChat.map((m) => repairStoredMediaMessageRow(m)),
          )
          if (!stillThisRun()) return
          let anyChanged = false
          for (let i = 0; i < msgsForWeChat.length; i += 1) {
            const m = msgsForWeChat[i]!
            const repaired = repairedDisplayMsgs[i]!
            if (
              repaired.content !== m.content ||
              repaired.voice !== m.voice ||
              (repaired.images?.length && !m.images?.length)
            ) {
              anyChanged = true
              void personaDb
                .patchWeChatChatMessageById(m.id, {
                  content: repaired.content,
                  voice: repaired.voice ?? undefined,
                  images: repaired.images ?? undefined,
                })
                .catch(() => {})
            }
          }
          if (!anyChanged || !stillThisRun()) return
          let remapped = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(repairedDisplayMsgs))
          if (roomType === 'group' && groupId?.trim()) {
            remapped = filterGroupChatItemsHideModeratorOnlyBubbles(
              remapped,
              roomType,
              groupDocRef.current,
            )
          }
          if (!stillThisRun()) return
          setItems((prev) => {
            const mergedMsgs = mergeHydratedMsgsWithLivePrev(
              extractMessages(remapped),
              extractMessages(prev),
              mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current),
            )
            let finalItems = rebuildWithCurrentTime(mergedMsgs)
            if (roomType === 'group' && groupId?.trim()) {
              finalItems = filterGroupChatItemsHideModeratorOnlyBubbles(
                finalItems,
                roomType,
                groupDocRef.current,
              )
            }
            if (chatItemsMessageSnapshotEqual(prev, finalItems)) return prev
            itemsRef.current = finalItems
            return finalItems
          })
        } catch {
          /* ignore */
        }
      })()

      if (scrollToBottom) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = scrollRef.current
            if (!el) return
            el.scrollTop = el.scrollHeight
            isAtBottomRef.current = true
            setPendingNewCount(0)
          })
        })
      } else if (appendedOtherCount > 0) {
        const el = scrollRef.current
        const atBottomNow = el ? isScrollNearBottom(el) : isAtBottomRef.current
        const browsingHistory = !!el && userScrolledRef.current && !atBottomNow
        const shouldStickToBottom = atBottomNow && !browsingHistory
        isAtBottomRef.current = shouldStickToBottom
        if (shouldStickToBottom) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const root = scrollRef.current
              if (!root) return
              root.scrollTop = root.scrollHeight
              isAtBottomRef.current = true
              setPendingNewCount(0)
            })
          })
        } else {
          setPendingNewCount((c) => c + appendedOtherCount)
        }
      }
    },
    [
      conversationKey,
      getCurrentTimeMs,
      rebuildWithCurrentTime,
      extractMessages,
      useLumiProjectAssistantPrompt,
      personaCharacterId,
      conversationCharacterId,
      playerIdentityId,
      visibleMsgLimit,
      roomType,
      groupId,
    ],
  )

  const hydrateMessagesRef = useRef(hydrateMessages)
  hydrateMessagesRef.current = hydrateMessages

  const storageHydrateDebounceRef = useRef<number | null>(null)
  const storageGroupSyncDebounceRef = useRef<number | null>(null)

  const opponentRevealTimerRef = useRef<number | null>(null)

  const cancelOpponentRevealTimer = useCallback(() => {
    if (opponentRevealTimerRef.current != null) {
      window.clearTimeout(opponentRevealTimerRef.current)
      opponentRevealTimerRef.current = null
    }
  }, [])

  const [typingVisible, setTypingVisibleState] = useState(false)
  const [typingFooterInterrupt, setTypingFooterInterrupt] = useState(false)
  const setTypingVisible = useCallback(
    (v: boolean) => {
      persistChatAwaitingAiTyping(conversationKey, v)
      setTypingVisibleState((prev) => (prev === v ? prev : v))
    },
    [conversationKey],
  )

  useEffect(() => {
    const prevKey = prevConversationKeyRef.current.trim()
    const nextKey = conversationKey.trim()
    if (prevKey === nextKey) {
      conversationKeyMigrationRef.current = false
      /** 兜底：同 key 但内存仍空（hydrate 被跳过或竞态失败）时再拉一次 */
      if (nextKey) {
        const loadedMsgCount = itemsRef.current.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0)
        if (loadedMsgCount === 0) void hydrateMessagesRef.current(true)
      }
      return
    }
    const isStorageKeyMigration = isSameWeChatStorageConversationMigration(prevKey, nextKey)
    conversationKeyMigrationRef.current = isStorageKeyMigration
    prevConversationKeyRef.current = nextKey

    if (storageHydrateDebounceRef.current != null) {
      window.clearTimeout(storageHydrateDebounceRef.current)
      storageHydrateDebounceRef.current = null
    }

    if (isStorageKeyMigration) {
      void hydrateMessagesRef.current(false)
      syncAiReplyPipelineActiveRef.current(nextKey)
      return
    }

    historyExhaustedRef.current = false
    setHistoryExhausted(false)
    setHasOlderHistory(false)
    setVisibleMsgLimit(CHAT_VISIBLE_MSG_INITIAL)
    userScrolledRef.current = false
    ignoreUiOnlyHiddenInListRef.current = false
    setUiOnlyHiddenCutForView(null)
    setFriendRequestAcceptedDividerAtMs(null)
    /**
     * 切换会话必须先清空内存列表：hydrate 会把 itemsRef 里「DB 尚无 id」的气泡与本轮 DB 结果合并（同会话乐观更新）。
     * 若不置空，从群聊切到私聊时上一屏群消息仍留在 ref 中，会被误并进私聊列表（串会话）。
     */
    setConversationOpponentQueueStop(nextKey, true)
    setConversationAwaitingAiKick(nextKey, false)
    setTypingVisible(false)
    onOpponentRevealQueueActiveRef.current?.(false)
    cancelOpponentRevealTimer()
    setPendingQueue([])
    setItems([])
    itemsRef.current = []
    timeRebuildDayKeyRef.current = ''
    void hydrateMessagesRef.current(true)
  }, [conversationKey, cancelOpponentRevealTimer, setTypingVisible])

  useEffect(() => {
    if (!historyRefreshSignal) return
    setConversationOpponentQueueStop(conversationKey.trim(), true)
    setConversationAwaitingAiKick(conversationKey.trim(), false)
    setTypingVisible(false)
    onOpponentRevealQueueActiveRef.current?.(false)
    cancelOpponentRevealTimer()
    setPendingQueue([])
    setItems([])
    itemsRef.current = []
    ignoreUiOnlyHiddenInListRef.current = false
    void hydrateMessagesRef.current(true)
  }, [historyRefreshSignal, cancelOpponentRevealTimer, setTypingVisible])

  useEffect(() => {
    const id = scrollToMessageId?.trim()
    if (!id) {
      // 搜索/日期定位结束后若无重置，ignore 会一直为 true，后续 hydrate 会跳过「仅 UI 清空」裁剪，
      // 导致回收站快照里同一批（本地仍保留的）消息重新出现在聊天室。
      if (ignoreUiOnlyHiddenInListRef.current) {
        ignoreUiOnlyHiddenInListRef.current = false
        void hydrateMessagesRef.current(false)
      }
      return
    }
    let cancelled = false
    void (async () => {
      const anchor = await personaDb.getWeChatChatMessageById(id)
      if (cancelled || !anchor || anchor.conversationKey !== conversationKey) {
        onScrollToMessageConsumed?.()
        return
      }
      const older = await personaDb.listWeChatChatMessagesBeforeTimestampAsc({
        conversationKey,
        beforeTimestampExclusive: anchor.timestamp,
        limit: 80,
      })
      const newer = await personaDb.listWeChatChatMessagesFromTimestampAsc({
        conversationKey,
        fromTimestampInclusive: anchor.timestamp,
        limit: 400,
      })
      const byId = new Map<string, WeChatChatMessage>()
      for (const m of older) byId.set(m.id, m)
      for (const m of newer) byId.set(m.id, m)
      const mergedRaw = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp)
      const peerCidScroll = (personaCharacterId?.trim() || conversationCharacterId.trim()) || undefined
      const merged = stripLegacyMeetImportedWeChatMessages(mergedRaw, peerCidScroll)
      let mapped = rebuildWithCurrentTime(mapWeChatMessagesToChatItems(merged))
      if (roomType === 'group' && groupId?.trim()) {
        let gSnap = groupDocRef.current
        if (!gSnap) {
          try {
            gSnap = await personaDb.getGroupChat(groupId.trim())
          } catch {
            gSnap = null
          }
        }
        mapped = filterGroupChatItemsHideModeratorOnlyBubbles(mapped, roomType, gSnap)
      }
      if (cancelled) return
      ignoreUiOnlyHiddenInListRef.current = true
      aiContextDbMessagesRef.current = merged
      setItems((prev) => {
        const mergedMsgs = mergeHydratedMsgsWithLivePrev(
          extractMessages(mapped),
          extractMessages(prev),
          mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current),
        )
        let finalItems = rebuildWithCurrentTime(mergedMsgs)
        if (roomType === 'group' && groupId?.trim()) {
          finalItems = filterGroupChatItemsHideModeratorOnlyBubbles(
            finalItems,
            roomType,
            groupDocRef.current,
          )
        }
        if (chatItemsMessageSnapshotEqual(prev, finalItems)) {
          return prev
        }
        itemsRef.current = finalItems
        return finalItems
      })
      // 来自「按日期/搜索定位」的跳转必须能直接看到目标消息：
      // 若仍按默认 30 条裁剪，目标锚点可能被截断导致看起来“没跳转”。
      const mergedMsgCount = mapped.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0)
      setVisibleMsgLimit(Math.max(CHAT_VISIBLE_MSG_INITIAL, mergedMsgCount))
      oldestMsgTsRef.current = merged[0]?.timestamp ?? null
      historyExhaustedRef.current = older.length < 80
      setHistoryExhausted(older.length < 80)
      setHasOlderHistory(older.length >= 80)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          const root = scrollRef.current
          const target = root?.querySelector(`[data-wx-msg-id="${anchor.id}"]`) as HTMLElement | null
          if (!root || !target) {
            onScrollToMessageConsumed?.()
            return
          }
          scrollChildToTopSmooth(root, target, 300, () => onScrollToMessageConsumed?.())
        })
      })
    })()
    return () => {
      cancelled = true
    }
  }, [scrollToMessageId, conversationKey, rebuildWithCurrentTime, onScrollToMessageConsumed])

  useEffect(() => {
    const debounceMs = 160
    const onStorage = () => {
      scheduleReconcilePendingImageGenBubbles()
      if (isConversationFlushAiRepliesBusy(conversationKeyLiveRef.current.trim())) return
      if (opponentRevealTimerRef.current != null) return
      if (opponentRevealJobsRef.current.length > 0) return
      if (storageHydrateDebounceRef.current != null) window.clearTimeout(storageHydrateDebounceRef.current)
      storageHydrateDebounceRef.current = window.setTimeout(() => {
        storageHydrateDebounceRef.current = null
        void hydrateMessagesRef.current(false)
      }, debounceMs)
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      window.removeEventListener('wechat-storage-changed', onStorage)
      if (storageHydrateDebounceRef.current != null) {
        window.clearTimeout(storageHydrateDebounceRef.current)
        storageHydrateDebounceRef.current = null
      }
    }
  }, [scheduleReconcilePendingImageGenBubbles])

  const [draft, setDraft] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false)
  const [voiceGestureZone, setVoiceGestureZone] = useState<VoiceGestureZone>('send')
  const [voicePressing, setVoicePressing] = useState(false)
  const [voiceSessionStartMs, setVoiceSessionStartMs] = useState<number | null>(null)
  const [voiceThumbOrigin, setVoiceThumbOrigin] = useState<{ x: number; y: number } | null>(null)
  const [mockVoiceInputOpen, setMockVoiceInputOpen] = useState(false)
  const [mockVoiceInputDraft, setMockVoiceInputDraft] = useState('')
  const [voiceConfigAlertOpen, setVoiceConfigAlertOpen] = useState(false)
  const [voiceConfigAlertMessage, setVoiceConfigAlertMessage] = useState('未配置语音识别 API Key')
  const [stubPanel, setStubPanel] = useState<null | 'emoji'>(null)
  const stubPanelRef = useRef<null | 'emoji'>(null)
  stubPanelRef.current = stubPanel
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [groupLive, setGroupLive] = useState<GroupChatRow | null>(null)
  const [groupAvatarByCharId, setGroupAvatarByCharId] = useState<Record<string, string>>({})
  const [groupAtOpen, setGroupAtOpen] = useState(false)
  const [groupAtFilter, setGroupAtFilter] = useState('')
  const [groupAtHighlightIdx, setGroupAtHighlightIdx] = useState(0)
  /** 插入 `@昵称 ` 后的 draft 长度：此后仅当该位置之后出现新的 `@` 时再打开艾特面板 */
  const groupAtFreezeAfterInsertRef = useRef<number | null>(null)

  useEffect(() => {
    if (roomType !== 'group' || !groupId?.trim()) {
      setGroupLive(null)
      setGroupAvatarByCharId({})
      return
    }
    let cancelled = false
    const gid = groupId.trim()
    const sync = async () => {
      const g = await personaDb.getGroupChat(gid)
      if (cancelled) return
      groupDocRef.current = g
      setGroupLive(g)
      const map: Record<string, string> = {}
      for (const mem of g?.members ?? []) {
        if (mem.charId === WECHAT_GROUP_USER_CHAR_ID || mem.charId === WECHAT_GROUP_BOT_CHARACTER_ID) continue
        const ch = await personaDb.getCharacter(mem.charId)
        if (ch?.avatarUrl?.trim()) {
          const resolved = resolveCharacterAvatarUrl({ avatarUrl: ch.avatarUrl })
          if (resolved) map[mem.charId] = resolved
        }
      }
      setGroupAvatarByCharId((prev) => {
        const keys = Object.keys(map)
        if (
          keys.length === Object.keys(prev).length &&
          keys.every((k) => prev[k] === map[k])
        ) {
          return prev
        }
        return map
      })
    }
    void sync()
    const debounceMs = 160
    const scheduleSync = () => {
      if (isConversationFlushAiRepliesBusy(conversationKeyLiveRef.current.trim())) return
      if (storageGroupSyncDebounceRef.current != null) window.clearTimeout(storageGroupSyncDebounceRef.current)
      storageGroupSyncDebounceRef.current = window.setTimeout(() => {
        storageGroupSyncDebounceRef.current = null
        void sync()
      }, debounceMs)
    }
    const fn = () => void scheduleSync()
    window.addEventListener('wechat-storage-changed', fn)
    return () => {
      cancelled = true
      window.removeEventListener('wechat-storage-changed', fn)
      if (storageGroupSyncDebounceRef.current != null) {
        window.clearTimeout(storageGroupSyncDebounceRef.current)
        storageGroupSyncDebounceRef.current = null
      }
    }
  }, [roomType, groupId])

  useEffect(() => {
    if (roomType !== 'group') {
      setGroupAtOpen(false)
      groupAtFreezeAfterInsertRef.current = null
      return
    }
    const fz = groupAtFreezeAfterInsertRef.current
    if (fz != null && draft.length < fz) {
      groupAtFreezeAfterInsertRef.current = null
    }
    // 取输入末尾「最后一处 @」起的未完成艾特（与 insertGroupMention / Esc 一致）：允许「先打字再打 @」；
    // 典型误触 email（如 xxx@yy.zz）在群聊输入里较少，若出现可 Esc 关闭面板。
    const match = draft.match(/@([^@\n]*)$/)
    if (!match) {
      setGroupAtOpen(false)
      return
    }
    const fz2 = groupAtFreezeAfterInsertRef.current
    if (fz2 != null && fz2 <= draft.length) {
      const typedAfter = draft.slice(fz2)
      if (!typedAfter.includes('@')) {
        setGroupAtOpen(false)
        return
      }
    }
    const raw = match[1] ?? ''
    const core = raw.replace(/\s+$/, '')
    setGroupAtFilter(core.trim())
    setGroupAtOpen(true)
  }, [draft, roomType])

  useEffect(() => {
    setGroupAtHighlightIdx(0)
  }, [groupAtFilter, groupAtOpen])

  const groupAtPickRows = useMemo(() => {
    if (!groupLive || roomType !== 'group') return []
    const q = groupAtFilter.trim().toLowerCase()
    const rows: { key: string; label: string }[] = []
    if (userCanAccessGroupAdminLevelInClient(groupLive)) {
      const showAll =
        !q || '所有人'.toLowerCase().includes(q) || q === 'all' || 'everyone'.startsWith(q)
      if (showAll) rows.push({ key: '__all__', label: '所有人' })
    }
    const botLabels = getGroupSmartBotMentionLabels(groupLive)
    const showBot = !q || botLabels.some((n) => n.toLowerCase().includes(q))
    if (showBot) {
      rows.push({ key: WECHAT_GROUP_BOT_CHARACTER_ID, label: '群管家' })
    }
    const mems = groupLive.members
      .filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID)
      .filter((m) => m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID)
      .filter((m) => {
        if (!q) return true
        const nick = (m.groupNickname || '').trim().toLowerCase()
        return nick.includes(q) || m.charId.toLowerCase().includes(q)
      })
      .sort((a, b) =>
        (a.groupNickname || '').localeCompare(b.groupNickname || '', 'zh-CN-u-co-pinyin'),
      )
    for (const m of mems) {
      const label = (m.groupNickname || '').trim() || m.charId
      rows.push({ key: m.charId, label })
    }
    return rows
  }, [groupLive, roomType, groupAtFilter])

  const [retryReplyPromptOpen, setRetryReplyPromptOpen] = useState(false)
  const [retryReplyBiasDraft, setRetryReplyBiasDraft] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)
  const [favoritesPickerOpen, setFavoritesPickerOpen] = useState(false)
  const [favoriteShareSending, setFavoriteShareSending] = useState(false)
  const [heartWhisperOpen, setHeartWhisperOpen] = useState(false)
  const [callSheetOpen, setCallSheetOpen] = useState(false)
  const [locationSpoofOpen, setLocationSpoofOpen] = useState(false)
  const [locationSending, setLocationSending] = useState(false)
  const [callingOpen, setCallingOpen] = useState(false)
  const [incomingCallOpen, setIncomingCallOpen] = useState(false)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [activeCallInitiator, setActiveCallInitiator] = useState<'self' | 'other' | null>(null)
  const [incomingCallOpeningLine, setIncomingCallOpeningLine] = useState<string>('')
  const [outgoingCallOpeningLine, setOutgoingCallOpeningLine] = useState<string>('')
  const incomingRejectLockRef = useRef(false)
  const callBubbleDedupRef = useRef<{ key: string; ts: number } | null>(null)
  /** 拆红包全屏层：仅「领取对方发来的未拆红包」时打开；自己发出的红包不可自领 */
  const [redPacketModalMessageId, setRedPacketModalMessageId] = useState<string | null>(null)
  const [heartWhisperLoading, setHeartWhisperLoading] = useState(false)
  const [heartWhisperData, setHeartWhisperData] = useState<HeartWhisper | null>(null)
  const [heartWhisperGenerateError, setHeartWhisperGenerateError] = useState<string | null>(null)
  const [groupPsycheGenerateError, setGroupPsycheGenerateError] = useState<string | null>(null)
  const [groupPsycheArchive, setGroupPsycheArchive] = useState<GroupPsycheArchive | null>(null)
  const [psycheRadarLoading, setPsycheRadarLoading] = useState(false)
  const [psycheRadarState, setPsycheRadarState] = useState<CharacterPsycheState | null>(null)
  const [psycheRadarSummaries, setPsycheRadarSummaries] = useState<CharacterPsychePageSummaries | null>(null)
  const [psycheRadarPreviousMetrics, setPsycheRadarPreviousMetrics] = useState<CharacterPsycheMetricsSnapshot | null>(null)
  const [psycheRadarLastGeneratedAt, setPsycheRadarLastGeneratedAt] = useState<number | null>(null)
  const [psycheCharacterFullName, setPsycheCharacterFullName] = useState('')
  const [psycheRadarGenerating, setPsycheRadarGenerating] = useState(false)
  const [psycheRadarGenerateError, setPsycheRadarGenerateError] = useState<string | null>(null)
  const retryReplyBiasRef = useRef('')
  /** 「重新回复」重生当轮对方稿：不额外 +1 自动总结计轮 */
  const skipMemoryRoundBumpRef = useRef(false)
  /** 本轮 AI 落库前采集的尾声补丁回滚快照（按 characterId） */
  const pendingWorldBookRevertByCharRef = useRef<
    Map<string, import('./dating/types').WorldBookAfterRevertEntry[]>
  >(new Map())
  const { openConsole } = useWeChatConsole()
  const [composerToast, setComposerToast] = useState<string | null>(null)
  const [centerToast, setCenterToast] = useState<string | null>(null)
  const keyboardDebugEnabled = !!state.ui.keyboardDebugEnabled
  const keyboardDebugInsetPx = Math.max(-220, Math.min(220, Math.round(state.ui.keyboardDebugInsetPx || 0)))
  const toastTimerRef = useRef<number | null>(null)
  const centerToastTimerRef = useRef<number | null>(null)
  /** 已读不回 / 忙碌：阻止新的 AI 回复，直至用户发送消息或点「继续回复」 */
  const manualAiPauseRef = useRef(false)

  const [replyingTo, setReplyingTo] = useState<null | WeChatReplyToMeta>(null)
  const replyingToRef = useRef(replyingTo)
  replyingToRef.current = replyingTo
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  /** 长按「编辑」：居中弹窗编辑，不占用底部输入框 */
  const [messageEditModal, setMessageEditModal] = useState<null | { id: string; isSelf: boolean }>(null)
  const [messageEditDraft, setMessageEditDraft] = useState('')
  const [messageEditSaving, setMessageEditSaving] = useState(false)
  const messageEditTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [actionPanelOpen, setActionPanelOpen] = useState(false)
  const [actionAnchor, setActionAnchor] = useState<PanelAnchor | null>(null)
  const [actionMessageId, setActionMessageId] = useState<string | null>(null)
  const [actionMessageIsSelf, setActionMessageIsSelf] = useState<boolean>(false)
  const [actionMessageText, setActionMessageText] = useState<string>('')
  const [actionMessageCanRecall, setActionMessageCanRecall] = useState(false)
  const [actionMessageModeratorRecall, setActionMessageModeratorRecall] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [voiceResynthesizeConfirmId, setVoiceResynthesizeConfirmId] = useState<string | null>(null)
  const [voiceResynthesizing, setVoiceResynthesizing] = useState(false)
  const aiCallingRef = useRef(false)
  /** 当前 flush / AI 调用所属的会话 key，避免切到其它聊天室时顶栏误显示「正在输入」 */
  const aiPipelineOwnerKeyRef = useRef<string | null>(null)
  const isConversationAiPipelineBusyRef = useRef<(ck: string) => boolean>(() => false)
  const lastUserAiTriggerTsRef = useRef<number>(0)

  const closeActionPanel = useCallback(() => {
    setActionPanelOpen(false)
    setActionAnchor(null)
    setActionMessageId(null)
    setActionMessageText('')
    setActionMessageCanRecall(false)
    setActionMessageModeratorRecall(false)
    setConfirmDeleteOpen(false)
  }, [])

  const showCenterToast = useCallback((msg: string) => {
    if (centerToastTimerRef.current != null) window.clearTimeout(centerToastTimerRef.current)
    setCenterToast(msg)
    centerToastTimerRef.current = window.setTimeout(() => {
      setCenterToast(null)
      centerToastTimerRef.current = null
    }, 1500)
  }, [])

  const retryCharacterImageGenInFlightRef = useRef(new Set<string>())

  const handleRetryCharacterImageGen = useCallback(
    (msg: Pick<ChatMsg, 'id' | 'imageGenPrompt' | 'imageDescription'>) => {
      const messageId = msg.id.trim()
      if (!messageId || retryCharacterImageGenInFlightRef.current.has(messageId)) return
      retryCharacterImageGenInFlightRef.current.add(messageId)
      void retryWeChatCharacterImageGenMessage({
        messageId,
        prompt: resolveCharacterImageGenPromptForApi(msg) || undefined,
        playerIdentityId,
      })
        .then((result) => {
          if (result.ok) return
          const { failure } = result
          if (failure.kind === 'rate_limit') {
            showCenterToast(/额度|quota|配额/i.test(failure.message) ? '生图额度已用尽' : '生图请求过于频繁，请稍后再试')
          } else if (failure.kind === 'safety') {
            showCenterToast('配图未通过内容安全审核')
          } else if (failure.message === 'missing_image_gen_prompt') {
            showCenterToast('缺少配图描述，无法重试')
          } else {
            showCenterToast('配图生成失败，请稍后再试')
          }
        })
        .finally(() => {
          retryCharacterImageGenInFlightRef.current.delete(messageId)
        })
    },
    [playerIdentityId, showCenterToast],
  )

  const handleConfirmCharacterImageGen = useCallback(
    (msg: Pick<ChatMsg, 'id' | 'imageGenPrompt' | 'imageDescription'>) => {
      const messageId = msg.id.trim()
      const prompt = resolveCharacterImageGenPromptForApi(msg)
      if (!messageId || !prompt || retryCharacterImageGenInFlightRef.current.has(messageId)) return
      retryCharacterImageGenInFlightRef.current.add(messageId)
      patchChatMsgInListRef.current(messageId, {
        imageGenAwaitingConfirm: false,
        imageGenPending: true,
        imageGenFailed: false,
      })
      void personaDb
        .patchWeChatChatMessageById(messageId, {
          imageGenAwaitingConfirm: false,
          imageGenPending: true,
          imageGenFailed: false,
        })
        .catch(() => {})
      void retryWeChatCharacterImageGenMessage({
        messageId,
        prompt,
        playerIdentityId,
      })
        .then((result) => {
          if (result.ok) {
            scheduleReconcilePendingImageGenBubblesRef.current()
            return
          }
          const { failure } = result
          if (failure.kind === 'rate_limit') {
            showCenterToast(/额度|quota|配额/i.test(failure.message) ? '生图额度已用尽' : '生图请求过于频繁，请稍后再试')
          } else if (failure.kind === 'safety') {
            showCenterToast('配图未通过内容安全审核')
          } else if (failure.message === 'missing_image_gen_prompt') {
            showCenterToast('缺少配图描述，无法生成')
          } else {
            showCenterToast('配图生成失败，请稍后再试')
          }
          scheduleReconcilePendingImageGenBubblesRef.current()
        })
        .finally(() => {
          retryCharacterImageGenInFlightRef.current.delete(messageId)
        })
    },
    [playerIdentityId, showCenterToast],
  )

  const requestVoiceMessageAudio = useCallback(
    async (msg: ChatMsg): Promise<string> => {
      const voiceCharacterId = resolveVoiceSynthCharacterId(msg)
      if (!voiceCharacterId) {
        showCenterToast(roomType === 'group' ? '该群成员未绑定声纹' : '该角色未绑定声纹')
        return ''
      }
      const apiKey = String(localStorage.getItem('minimax:apiKey') || '').trim()
      if (!apiKey) {
        showCenterToast('请先在「声纹档案」配置 MiniMax API Key')
        return ''
      }
      const voiceId = await lookupBoundVoiceIdForCharacter(voiceCharacterId)
      if (!voiceId) {
        showCenterToast('该角色尚未绑定声纹，请打开「声纹档案」→ 角色声带映射')
        return ''
      }
      const url = await ensureVoiceMessageAudio(msg.id, msg.voice, { voiceCharacterId })
      if (!url) showCenterToast('语音合成失败，请检查声纹档案中的 API 与音色配置')
      return url
    },
    [ensureVoiceMessageAudio, resolveVoiceSynthCharacterId, roomType, showCenterToast],
  )

  const markVoiceMessagePlayed = useCallback((msgId: string, voice: NonNullable<ChatMsg['voice']>) => {
    const id = msgId.trim()
    if (!id) return
    setItems((prev) =>
      rebuildWithCurrentTime(
        extractMessages(prev).map((row) =>
          row.id === id && row.voice
            ? { ...row, voice: { ...row.voice, voicePlayed: true } }
            : row,
        ),
      ),
    )
    void personaDb.patchWeChatChatMessageById(id, { voice: { ...voice, voicePlayed: true } }).catch(() => {
      /* ignore */
    })
  }, [extractMessages, rebuildWithCurrentTime])

  const requestVoiceResynthesizeConfirm = useCallback((messageId: string) => {
    const id = messageId.trim()
    if (!id) return
    setVoiceResynthesizeConfirmId(id)
  }, [])

  const runVoiceResynthesize = useCallback(async () => {
    const msgId = voiceResynthesizeConfirmId?.trim() || ''
    if (!msgId || voiceResynthesizing) return
    const target = extractMessages(itemsRef.current).find((m) => m.id === msgId)
    if (!target?.voice) {
      setVoiceResynthesizeConfirmId(null)
      showCenterToast('语音消息不存在或已被删除')
      return
    }
    setVoiceResynthesizing(true)
    try {
      // 先清掉旧缓存，确保 UI 与落库都进入“待重合成”状态。
      setItems((prev) => {
        const next = rebuildWithCurrentTime(
          extractMessages(prev).map((msg) =>
            msg.id !== msgId || !msg.voice
              ? msg
              : {
                  ...msg,
                  voice: {
                    ...msg.voice,
                    audioUrl: undefined,
                  },
                },
          ),
        )
        itemsRef.current = next
        return next
      })
      try {
        await personaDb.patchWeChatChatMessageById(msgId, { voice: { audioUrl: '' } })
      } catch (e) {
        logger.log('error', `清理旧语音缓存失败 id=${msgId} err=${e instanceof Error ? e.message : String(e)}`)
      }

      const nextUrl = await ensureVoiceMessageAudio(
        msgId,
        {
          ...target.voice,
          audioUrl: '',
        },
        { forceResynthesize: true, voiceCharacterId: resolveVoiceSynthCharacterId(target) },
      )
      if (!nextUrl) showCenterToast('重新合成失败，请稍后重试')
      else showCenterToast('已重新合成语音')
    } finally {
      setVoiceResynthesizing(false)
      setVoiceResynthesizeConfirmId(null)
    }
  }, [
    ensureVoiceMessageAudio,
    extractMessages,
    logger,
    rebuildWithCurrentTime,
    resolveVoiceSynthCharacterId,
    showCenterToast,
    voiceResynthesizeConfirmId,
    voiceResynthesizing,
  ])

  useEffect(() => {
    return () => {
      if (centerToastTimerRef.current != null) window.clearTimeout(centerToastTimerRef.current)
    }
  }, [])

  const MAX_MULTI_SELECT = 100
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const isMultiSelectModeRef = useRef(isMultiSelectMode)
  isMultiSelectModeRef.current = isMultiSelectMode

  const applyComposerInsetDom = useCallback((insetPx: number) => {
    const scroll = scrollRef.current
    const multi = isMultiSelectModeRef.current
    if (scroll) {
      scroll.style.paddingBottom = `${12 + (multi ? 86 : insetPx)}px`
    }
    const bar = inputBarRef.current
    const fill = keyboardInsetFillRef.current
    if (bar) {
      if (insetPx > 0) {
        bar.style.transform = `translate3d(0, -${insetPx}px, 0)`
        bar.style.willChange = 'transform'
        /** 键盘已盖住 Home 条区域，不必再留 safe-area，否则会与键盘之间露出聊天背景 */
        bar.style.paddingBottom = '12px'
      } else {
        bar.style.transform = ''
        bar.style.willChange = ''
        /** 勿写 ''：会清掉 JSX 的 safe-area，导致未弹键盘时输入栏贴底 */
        bar.style.paddingBottom = 'max(12px, env(safe-area-inset-bottom, 0px))'
      }
    }
    if (fill) {
      if (insetPx > 0 && bar) {
        const bg = window.getComputedStyle(bar).backgroundColor
        fill.style.display = 'block'
        fill.style.height = `${insetPx}px`
        fill.style.backgroundColor = bg || 'var(--wx-chat-input-bar-bg, #ffffff)'
      } else {
        fill.style.display = 'none'
        fill.style.height = '0px'
        fill.style.backgroundColor = ''
      }
    }
    const fab = newMsgFabWrapRef.current
    if (fab) {
      fab.style.bottom = `calc(${70 + insetPx}px + env(safe-area-inset-bottom, 0px))`
    }
  }, [])

  const syncComposerInsetFromRefs = useCallback(() => {
    const base = keyboardInsetRef.current
    const insetPx = base > 0 ? Math.max(0, base + keyboardDebugInsetPx) : 0
    applyComposerInsetDom(insetPx)
  }, [applyComposerInsetDom, keyboardDebugInsetPx])

  useLayoutEffect(() => {
    syncComposerInsetFromRefs()
  }, [isMultiSelectMode, syncComposerInsetFromRefs])

  /** React 重绘会覆盖 scroll/inputBar 的内联 style，每帧末把键盘抬升量写回 DOM */
  useLayoutEffect(() => {
    syncComposerInsetFromRefs()
  })

  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const selectedSet = useMemo(() => new Set(selectedMessageIds), [selectedMessageIds])
  const [multiDeleteConfirmOpen, setMultiDeleteConfirmOpen] = useState(false)
  const [recallModalOpen, setRecallModalOpen] = useState(false)
  const [recallModalRecord, setRecallModalRecord] = useState<RecallHistoryRecord | null>(null)
  const [shieldedMessageModalOpen, setShieldedMessageModalOpen] = useState(false)
  const [shieldedMessageModalText, setShieldedMessageModalText] = useState<string | null>(null)
  const [shieldedMessageModalVariant, setShieldedMessageModalVariant] = useState<'blocked' | 'muted'>('blocked')
  const pendingRecalledUserTextRef = useRef<string | null>(null)
  const [recallAnimatingIds, setRecallAnimatingIds] = useState<Set<string>>(() => new Set())
  const activeVoicePointerIdRef = useRef<number | null>(null)
  const voiceHoldTimerRef = useRef<number | null>(null)
  const voiceDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const voiceLongPressAttemptedRef = useRef(false)
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceStreamRef = useRef<MediaStream | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const [forwardModeSheetOpen, setForwardModeSheetOpen] = useState(false)
  const [shareHistorySheetOpen, setShareHistorySheetOpen] = useState(false)
  const [shareHistorySending, setShareHistorySending] = useState(false)
  const [shareForwardMode, setShareForwardMode] = useState<'multi-item' | 'multi-merge'>('multi-merge')
  const [checkPhoneOpen, setCheckPhoneOpen] = useState(false)
  const [gameLobbyOpen, setGameLobbyOpen] = useState(false)
  const [miniGameSession, setMiniGameSession] = useState<MiniGameSession | null>(null)
  const miniGameOverlayOpen = gameLobbyOpen || miniGameSession != null

  useEffect(() => {
    onCheckPhoneOpenChange?.(checkPhoneOpen)
  }, [checkPhoneOpen, onCheckPhoneOpenChange])

  useEffect(() => {
    return () => onCheckPhoneOpenChange?.(false)
  }, [onCheckPhoneOpenChange])

  useEffect(() => {
    onMiniGameOverlayOpenChange?.(miniGameOverlayOpen)
  }, [miniGameOverlayOpen, onMiniGameOverlayOpenChange])

  useEffect(() => {
    return () => onMiniGameOverlayOpenChange?.(false)
  }, [onMiniGameOverlayOpenChange])

  const voiceCallOverlayOpen = callingOpen || incomingCallOpen || voiceCallOpen

  useEffect(() => {
    onVoiceCallOverlayOpenChange?.(voiceCallOverlayOpen)
  }, [voiceCallOverlayOpen, onVoiceCallOverlayOpenChange])

  useEffect(() => {
    return () => onVoiceCallOverlayOpenChange?.(false)
  }, [onVoiceCallOverlayOpenChange])

  const openHeartWhisperPanel = useCallback(() => {
    if (isMultiSelectMode) return
    setPlusMenuOpen(false)
    setHeartWhisperOpen(true)
  }, [isMultiSelectMode])

  const exitMultiSelect = useCallback(() => {
    setIsMultiSelectMode(false)
    setSelectedMessageIds([])
    setMultiDeleteConfirmOpen(false)
    setForwardModeSheetOpen(false)
    setShareHistorySheetOpen(false)
  }, [])

  useEffect(() => {
    onMultiSelectModeChange?.(isMultiSelectMode)
  }, [isMultiSelectMode, onMultiSelectModeChange])

  useEffect(() => {
    if (!multiSelectExitSignal) return
    exitMultiSelect()
  }, [multiSelectExitSignal, exitMultiSelect])

  const openChatHistoryViewer = useCallback(
    (
      historyData: WeChatChatHistoryPayload,
      options?: { cardSenderCharacterId?: string },
    ) => {
      void (async () => {
        const avatars = await resolveParticipantAvatarMap({
          data: historyData,
          userDisplayName: playerDisplayName.trim() || '我',
          userAvatarUrl: playerAvatarResolved,
          personaContacts: personaContactsList,
          cardSenderCharacterId: options?.cardSenderCharacterId,
        })
        onOpenChatHistoryViewer?.({
          data: historyData,
          participantAvatars: avatars,
          avatarRadiusPx: bubble.avatarRadiusPx,
          userDisplayName: playerDisplayName.trim() || '我',
          personaContacts: personaContactsList,
          cardSenderCharacterId: options?.cardSenderCharacterId,
        })
      })()
    },
    [
      playerDisplayName,
      playerAvatarUrl,
      state.wechatPersonaContacts,
      onOpenChatHistoryViewer,
      bubble.avatarRadiusPx,
    ],
  )

  const toggleSelect = useCallback(
    (id: string) => {
      const tid = id.trim()
      if (!tid) return
      setSelectedMessageIds((prev) => {
        const set = new Set(prev)
        if (set.has(tid)) {
          set.delete(tid)
          return [...set]
        }
        if (set.size >= MAX_MULTI_SELECT) {
          showCenterToast(`最多只能选择${MAX_MULTI_SELECT}条消息`)
          return prev
        }
        set.add(tid)
        return [...set]
      })
    },
    [showCenterToast, MAX_MULTI_SELECT],
  )

  /** 引用条/落库 replyTo：群聊对方用发言者本群昵称（非会话标题/群名） */
  const resolveGroupQuoteSenderLabel = useCallback(
    (isSelfMsg: boolean, senderCharacterId: string | undefined): string => {
      const g = groupLive ?? groupDocRef.current
      if (roomType !== 'group') {
        return isSelfMsg ? (playerDisplayName.trim() || '我').slice(0, 64) : (peerNotifyTitle.trim() || '对方').slice(0, 64)
      }
      if (!g) {
        return isSelfMsg ? (playerDisplayName.trim() || '我').slice(0, 64) : (peerNotifyTitle.trim() || '群成员').slice(0, 64)
      }
      if (isSelfMsg) {
        const mem = findGroupMember(g, WECHAT_GROUP_USER_CHAR_ID)
        let gn = (mem?.groupNickname || '').trim()
        if (gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
        return (gn || playerDisplayName.trim() || '我').slice(0, 64)
      }
      const sid = senderCharacterId?.trim()
      if (!sid) return (peerNotifyTitle.trim() || '群成员').slice(0, 64)
      if (sid === WECHAT_GROUP_BOT_CHARACTER_ID) return '群管家'
      const mem = findGroupMember(g, sid)
      let gn = (mem?.groupNickname || '').trim()
      if (gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
      return (gn || groupNoticeMemberNickname(mem)).slice(0, 64)
    },
    [roomType, groupLive, playerDisplayName, peerNotifyTitle],
  )

  const buildReplyMetaById = useCallback(
    async (messageId: string): Promise<WeChatReplyToMeta | null> => {
      const local = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === messageId)
      if (local) {
        return {
          messageId: local.id,
          senderName: resolveGroupQuoteSenderLabel(local.from === 'self', local.senderCharacterId),
          content: messagePlainPreview(local).slice(0, 300),
          isUser: local.from === 'self',
        }
      }
      const msg = await Promise.race<WeChatChatMessage | null>([
        personaDb.getWeChatChatMessageById(messageId),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 300)),
      ])
      if (!msg) return null
      if (msg.isRecalled) {
        return {
          messageId: msg.id,
          senderName: resolveGroupQuoteSenderLabel(
            msg.type === 'player',
            msg.type === 'character' ? msg.characterId : undefined,
          ),
          content: '该消息已撤回',
          isUser: msg.type === 'player',
        }
      }
      const rp = msg.redPacket
      const snap = rp
        ? (`[红包] ${(rp.remark ?? '').trim()}`.trim() || '[红包]').slice(0, 300)
        : (msg.content?.trim() || (msg.images?.length ? '[图片]' : '...')).slice(0, 300)
      return {
        messageId: msg.id,
        senderName: resolveGroupQuoteSenderLabel(
          msg.type === 'player',
          msg.type === 'character' ? msg.characterId : undefined,
        ),
        content: snap,
        isUser: msg.type === 'player',
      }
    },
    [resolveGroupQuoteSenderLabel],
  )

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const id = messageId.trim()
      if (!id) return
      const root = scrollRef.current
      if (!root) return
      const target = root.querySelector(`[data-wx-msg-id="${id}"]`) as HTMLElement | null
      if (!target) {
        showCenterToast('原消息不存在或已被删除')
        return
      }
      scrollChildToTopSmooth(root, target, 280, () => {
        setHighlightedMessageId(id)
        window.setTimeout(() => {
          setHighlightedMessageId((prev) => (prev === id ? null : prev))
        }, 500)
      })
    },
    [showCenterToast],
  )

  const openActionPanelFor = useCallback(
    (params: { id: string; isSelf: boolean; text: string; ts: number; anchorRect: DOMRect }) => {
      if (extractMessages(itemsRef.current).some((x) => x.id === params.id && x.isGroupEventStrip)) return
      const preferBelow = params.anchorRect.top < 100
      setActionMessageId(params.id)
      setActionMessageIsSelf(params.isSelf)
      setActionMessageText(params.text)
      const msgs = extractMessages(itemsRef.current)
      const last = msgs.length ? msgs[msgs.length - 1] : null
      const targetMsg = msgs.find((x): x is ChatMsg => x.kind === 'msg' && x.id === params.id) ?? null
      const canRecallSelf = !!(params.isSelf && last?.id === params.id && !last?.isRecalled)
      const canModeratorRecall = !!(
        roomType === 'group' &&
        groupLive &&
        userCanAccessGroupAdminLevelInClient(groupLive) &&
        !params.isSelf &&
        targetMsg &&
        !targetMsg.isRecalled &&
        !targetMsg.isGroupEventStrip
      )
      setActionMessageModeratorRecall(canModeratorRecall)
      setActionMessageCanRecall(canRecallSelf || canModeratorRecall)
      setActionAnchor({ rect: params.anchorRect, preferBelow })
      setActionPanelOpen(true)
      setConfirmDeleteOpen(false)
    },
    [extractMessages, roomType, groupLive],
  )

  const scrollToBottomSmooth = useCallback((opts?: { force?: boolean }) => {
    const el = scrollRef.current
    if (!el) return
    const force = opts?.force === true
    if (!force) {
      const atBottomNow = isScrollNearBottom(el)
      const browsingHistory = userScrolledRef.current && !atBottomNow
      if (!atBottomNow || browsingHistory) return
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const now = scrollRef.current
        if (!now) return
        now.scrollTo({ top: now.scrollHeight, behavior: 'smooth' })
        isAtBottomRef.current = true
        setPendingNewCount(0)
        window.setTimeout(() => {
          const latest = scrollRef.current
          if (!latest) return
          latest.scrollTo({ top: latest.scrollHeight, behavior: 'auto' })
        }, 240)
      })
    })
  }, [])

  const stickChatScrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    isAtBottomRef.current = true
    userScrolledRef.current = false
    setPendingNewCount(0)
  }, [])

  const scheduleStickChatScrollToBottom = useCallback(() => {
    const run = () => stickChatScrollToBottom()
    requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    window.setTimeout(run, 120)
    window.setTimeout(run, 280)
  }, [stickChatScrollToBottom])

  scheduleStickChatScrollToBottomRef.current = scheduleStickChatScrollToBottom

  /** 呼出键盘时无条件贴底，不做「是否在浏览历史」等判断 */
  const syncChatScrollForKeyboard = useCallback(() => {
    if (isMultiSelectModeRef.current) return
    scheduleStickChatScrollToBottom()
  }, [scheduleStickChatScrollToBottom])

  syncChatScrollForKeyboardRef.current = syncChatScrollForKeyboard

  /** 主动消息生成中：顶栏「对方正在输入」与普通 AI 回复同一套 persist + onOtherTypingChange */
  useEffect(() => {
    if (!proactiveCountdownEnabled) return
    const ck = conversationKey.trim()
    if (!ck) return

    const syncProactiveTyping = () => {
      if (ck !== conversationKeyLiveRef.current.trim()) return
      if (isProactiveMessageInFlight(ck)) {
        setTypingVisible(true)
        return
      }
      syncAiReplyPipelineActiveRef.current(ck)
      if (!isConversationAiPipelineBusyRef.current(ck)) setTypingVisible(false)
    }

    syncProactiveTyping()
    return subscribeProactiveMessageInFlight(syncProactiveTyping)
  }, [proactiveCountdownEnabled, conversationKey, setTypingVisible])

  /** 切会话 / 从子路由返回：与 sessionStorage 对齐；仅当前会话的 AI 管线可驱动顶栏「正在输入」 */
  useLayoutEffect(() => {
    const ck = conversationKey.trim()
    if (!ck) {
      setTypingFooterInterrupt(false)
      return
    }
    const pipelineActive = isConversationAiPipelineBusyRef.current(ck)
    setWechatAiReplyPipelineActive(ck, pipelineActive)
    const recover = readTypingInterruptRecover(ck)
    setTypingFooterInterrupt(recover)
    const recoverAwaitingTyping = readChatAwaitingAiTyping(ck)
    const shouldShowTyping = pipelineActive || recover || recoverAwaitingTyping
    if (shouldShowTyping) {
      setTypingVisible(true)
    } else {
      persistChatAwaitingAiTyping(ck, false)
      setTypingVisible(false)
    }
  }, [conversationKey, setTypingVisible])

  /** 中断恢复：hydrate 已从 DB 合并列表后，清顶栏/底部「正在输入」占位 */
  useEffect(() => {
    const pending = typingInterruptPendingUiClearRef.current?.trim()
    if (!pending || pending !== conversationKey.trim()) return
    typingInterruptPendingUiClearRef.current = null
    setTypingFooterInterrupt(false)
    setTypingVisible(false)
  }, [items, conversationKey, setTypingVisible])

  const opponentRevealJobsRef = useRef<OpponentRevealJob[]>([])

  const conversationKeysMatch = useCallback((a: string, b: string) => {
    const x = a.trim()
    const y = b.trim()
    if (!x || !y) return false
    return x === y || isSameWeChatStorageConversationMigration(x, y)
  }, [])

  /** 指定会话是否仍有 AI 请求 / 逐条露出；与当前可见会话无关的全局 ref 不计入其它会话 */
  const isConversationAiPipelineBusy = useCallback(
    (ck: string): boolean => {
      const key = ck.trim()
      if (!key) return false
      const flags = getConversationPipelineFlags(key)
      if (
        flags.flushAiRepliesBusy ||
        flags.aiCalling ||
        flags.pendingAiReplies > 0 ||
        flags.flushUiBusy ||
        flags.awaitingAiKick ||
        flags.processingSend
      ) {
        return true
      }
      if (opponentRevealJobsRef.current.some((j) => conversationKeysMatch(j.forConversationKey, key))) {
        return true
      }
      if (isProactiveMessageInFlight(key)) return true
      if (hasStashedOpponentRevealJobs(key)) return true
      return false
    },
    [conversationKeysMatch],
  )
  isConversationAiPipelineBusyRef.current = isConversationAiPipelineBusy

  /** 单轮气泡循环内暂不入队，避免逐条 enqueue 与露出处理器交错导致顺序错乱 */
  const deferBubbleRevealEnqueueRef = useRef(false)
  const deferredBubbleRevealJobsRef = useRef<OpponentRevealJob[]>([])
  const syncAiReplyPipelineActiveRef = useRef<(ck?: string) => boolean>(() => false)
  const [pendingQueue, setPendingQueue] = useState<ChatMsg[]>([])

  const persistOpponentRevealJobOnly = useCallback((j: OpponentRevealJob) => {
    try {
      j.beforeReveal?.()
    } catch {
      /* ignore */
    }
    try {
      j.persist()
    } catch {
      /* ignore */
    }
    try {
      j.afterReveal?.()
    } catch {
      /* ignore */
    }
  }, [])

  const isOpponentRevealJobForLiveConversation = useCallback((j: OpponentRevealJob) => {
    const live = conversationKeyLiveRef.current.trim()
    const jobKey = j.forConversationKey.trim()
    if (!live || !jobKey) return false
    return live === jobKey || isSameWeChatStorageConversationMigration(jobKey, live)
  }, [])

  const syncPendingQueueFromRef = useCallback(() => {
    const next = opponentRevealJobsRef.current
      .filter(isOpponentRevealJobForLiveConversation)
      .filter((j) => !j.revealCallbackOnly)
      .map((j) => j.msg)
    setPendingQueue((prev) => {
      if (prev.length === next.length && prev.every((m, i) => m.id === next[i]?.id)) return prev
      return next
    })
  }, [isOpponentRevealJobForLiveConversation])

  /**
   * 入队前统一写死本条批次的 timestamp：须与 merge 后出现在列表里的顺序一致，
   * 否则 persist 闭包里仍是生成时的较小 ts，IndexedDB 与 hydrate 的 sort 会把气泡顺序打乱。
   * 就地修改 `job.msg`（与各处 persist 捕获的引用为同一对象）。
   */
  const assignSequentialOpponentRevealTimestamps = useCallback((jobs: OpponentRevealJob[]) => {
    if (jobs.length === 0) return jobs
    let maxTs = 0
    for (const m of extractMessages(itemsRef.current)) {
      const t = typeof m.timestamp === 'number' ? m.timestamp : 0
      if (t > maxTs) maxTs = t
    }
    for (const j of opponentRevealJobsRef.current) {
      const t = typeof j.msg.timestamp === 'number' ? j.msg.timestamp : 0
      if (t > maxTs) maxTs = t
    }
    let nextTs = maxTs + 1
    const now = getCurrentTimeMs()
    if (nextTs < now) nextTs = now
    for (const j of jobs) {
      j.msg.timestamp = nextTs
      nextTs += 1
    }
    return jobs
  }, [extractMessages, getCurrentTimeMs])

  /** 用户插话等：立刻露出剩余队列，避免与新一轮发送打架 */
  const flushOpponentRevealQueueImmediate = useCallback(() => {
    cancelOpponentRevealTimer()
    const jobs = opponentRevealJobsRef.current.splice(0)
    if (jobs.length === 0) return
    setPendingQueue([])
    const live = conversationKeyLiveRef.current.trim()
    const forUi = jobs.filter((j) => j.forConversationKey.trim() === live)
    const stale = jobs.filter((j) => j.forConversationKey.trim() !== live)
    for (const j of stale) persistOpponentRevealJobOnly(j)
    if (forUi.length === 0) {
      onOpponentRevealQueueActive?.(false)
      syncAiReplyPipelineActiveRef.current(conversationKeyLiveRef.current.trim())
      return
    }
    const needsFlushTransferEmit = forUi.some((j) => j.opponentRevealFlushSync)
    const mergeAll = (prev: ChatItem[]) => {
      let next = prev
      for (const j of forUi) {
        next = mergeOtherIncomingForRoom(next, { ...j.msg, otherAnimated: true })
      }
      itemsRef.current = next
      return next
    }
    if (needsFlushTransferEmit) {
      flushSync(() => {
        setItems((prev) => mergeAll(prev))
      })
      emitLumiTransferChanged()
    } else {
      setItems((prev) => mergeAll(prev))
    }
    for (const j of forUi) persistOpponentRevealJobOnly(j)
    scrollToBottomSmooth()
    persistTypingInterruptRecover(conversationKey, false)
    onOpponentRevealQueueActive?.(false)
    setBackgroundNotifyPendingWork({ wechatRevealPending: false })
    syncAiReplyPipelineActiveRef.current(conversationKeyLiveRef.current.trim())
    const liveCk = conversationKeyLiveRef.current.trim()
    if (liveCk && !isConversationAiPipelineBusyRef.current(liveCk)) {
      setTypingVisible(false)
    }
  }, [
    cancelOpponentRevealTimer,
    conversationKey,
    mergeOtherIncomingForRoom,
    persistOpponentRevealJobOnly,
    scrollToBottomSmooth,
    onOpponentRevealQueueActive,
    setTypingVisible,
  ])

  const clearOpponentRevealIdle = useCallback(() => {
    setPendingQueue((prev) => (prev.length === 0 ? prev : []))
    onOpponentRevealQueueActive?.(false)
    setBackgroundNotifyPendingWork({ wechatRevealPending: false })
    syncAiReplyPipelineActiveRef.current(conversationKeyLiveRef.current.trim())
    scheduleReconcilePendingImageGenBubbles()
    const liveCk = conversationKeyLiveRef.current.trim()
    if (liveCk && !isConversationAiPipelineBusyRef.current(liveCk)) {
      setTypingVisible(false)
    }
  }, [onOpponentRevealQueueActive, setTypingVisible, scheduleReconcilePendingImageGenBubbles])

  const processOpponentCallbackOnly = useCallback(
    (job: OpponentRevealJob) => {
      try {
        job.beforeReveal?.()
      } catch {
        /* ignore */
      }
      try {
        job.afterReveal?.()
      } catch {
        /* ignore */
      }
      syncAiReplyPipelineActiveRef.current(conversationKeyLiveRef.current.trim())
    },
    [],
  )

  const processOpponentRevealJob = useCallback(
    (job: OpponentRevealJob) => {
      const live = conversationKeyLiveRef.current.trim()
      const jobKey = job.forConversationKey.trim()
      if (
        live &&
        jobKey &&
        live !== jobKey &&
        !isSameWeChatStorageConversationMigration(jobKey, live)
      ) {
        persistOpponentRevealJobOnly(job)
        return
      }
      const pendingPatch = resolveImageGenPatchForMessageId(
        job.msg.id,
        mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current),
      )
      let incoming: ChatMsg = { ...job.msg, otherAnimated: true }
      if (pendingPatch) {
        incoming = applyImageGenUiPatchToMsg(incoming, pendingPatch)
        job.msg = incoming
      }
      if (job.msg.musicSync?.kind === 'music_invite') {
        logConsole(
          'ai',
          `[music_sync] 露出共听邀约卡：${job.msg.id} 《${job.msg.musicSync.trackTitle}》`,
        )
      }
      const el = scrollRef.current
      const atBottomNow = el ? isScrollNearBottom(el) : isAtBottomRef.current
      const browsingHistory = !!el && userScrolledRef.current && !atBottomNow
      const shouldStickToBottom = atBottomNow && !browsingHistory
      isAtBottomRef.current = shouldStickToBottom
      try {
        job.beforeReveal?.()
      } catch {
        /* ignore */
      }
      const needsFlushReveal =
        job.opponentRevealFlushSync ||
        !!job.msg.imageGenPending ||
        !!job.msg.imageGenAwaitingConfirm ||
        !!pendingPatch?.images?.length
      if (needsFlushReveal) {
        flushSync(() => {
          setItems((prev) => {
            const next = mergeOtherIncomingForRoom(prev, incoming)
            itemsRef.current = next
            return next
          })
        })
        if (job.opponentRevealFlushSync) emitLumiTransferChanged()
      } else {
        setItems((prev) => {
          const next = mergeOtherIncomingForRoom(prev, incoming)
          itemsRef.current = next
          return next
        })
      }
      try {
        job.persist()
      } catch {
        /* ignore */
      }
      job.afterReveal?.()
      if (shouldStickToBottom) scrollToBottomSmooth()
      else setPendingNewCount((c) => c + 1)
    },
    [mergeOtherIncomingForRoom, persistOpponentRevealJobOnly, scrollToBottomSmooth],
  )

  const handleOpponentQueueActive = useCallback(
    (active: boolean) => {
      if (active) {
        onOpponentRevealQueueActive?.(true)
        setBackgroundNotifyPendingWork({ wechatRevealPending: true })
        return
      }
      clearOpponentRevealIdle()
    },
    [clearOpponentRevealIdle, onOpponentRevealQueueActive],
  )

  const resolveOpponentRevealDelayMs = useCallback((job: OpponentRevealJob) => {
    return job.revealCallbackOnly
      ? Math.max(0, job.revealCallbackDelayMs ?? 0)
      : computeOpponentStaggerDelayMs(job.msg)
  }, [])

  useChatQueue({
    pendingQueue,
    jobsRef: opponentRevealJobsRef,
    timerRef: opponentRevealTimerRef,
    isJobLive: isOpponentRevealJobForLiveConversation,
    getDelayMs: resolveOpponentRevealDelayMs,
    processCallbackOnly: processOpponentCallbackOnly,
    processReveal: processOpponentRevealJob,
    persistOnly: persistOpponentRevealJobOnly,
    syncPendingQueue: syncPendingQueueFromRef,
    onQueueActive: handleOpponentQueueActive,
  })

  const kickOpponentRevealProcessor = useCallback(() => {
    const q = opponentRevealJobsRef.current
    if (q.length === 0) {
      clearOpponentRevealIdle()
      return
    }
    if (q.some(isOpponentRevealJobForLiveConversation)) {
      onOpponentRevealQueueActive?.(true)
      setBackgroundNotifyPendingWork({ wechatRevealPending: true })
    }
    syncPendingQueueFromRef()
  }, [
    clearOpponentRevealIdle,
    isOpponentRevealJobForLiveConversation,
    onOpponentRevealQueueActive,
    syncPendingQueueFromRef,
  ])

  const kickOpponentRevealProcessorRef = useRef(kickOpponentRevealProcessor)
  kickOpponentRevealProcessorRef.current = kickOpponentRevealProcessor
  const syncPendingQueueFromRefFnRef = useRef(syncPendingQueueFromRef)
  syncPendingQueueFromRefFnRef.current = syncPendingQueueFromRef

  const enqueueOpponentMessagesSequential = useCallback(
    (jobs: OpponentRevealJob[]) => {
      if (jobs.length === 0) return
      const liveConvKey = conversationKeyLiveRef.current.trim()
      const stamped: OpponentRevealJob[] = jobs.map((j) => ({
        ...j,
        forConversationKey: j.forConversationKey?.trim() || liveConvKey,
      }))
      if (deferBubbleRevealEnqueueRef.current) {
        deferredBubbleRevealJobsRef.current.push(...stamped)
        return
      }
      const forLive: OpponentRevealJob[] = []
      for (const j of stamped) {
        const jobKey = j.forConversationKey.trim()
        if (
          liveConvKey &&
          (jobKey === liveConvKey || isSameWeChatStorageConversationMigration(jobKey, liveConvKey))
        ) {
          if (jobKey !== liveConvKey) j.forConversationKey = liveConvKey
          forLive.push(j)
        } else if (jobKey) {
          stashOpponentRevealJobs(jobKey, [j])
          notifyWechatConversationAiPipeline()
        }
      }
      if (forLive.length === 0) return
      /** 模型已返回：顶栏「等 API」态结束；逐条露出阶段由 chatOpponentRevealPending 继续显示正在输入 */
      setTypingVisible(false)
      assignSequentialOpponentRevealTimestamps(forLive)
      opponentRevealJobsRef.current.push(...forLive)
      syncPendingQueueFromRef()
      onOpponentRevealQueueActive?.(true)
      setBackgroundNotifyPendingWork({ wechatRevealPending: true })
      syncAiReplyPipelineActiveRef.current(liveConvKey)
      kickOpponentRevealProcessor()
    },
    [
      assignSequentialOpponentRevealTimestamps,
      kickOpponentRevealProcessor,
      onOpponentRevealQueueActive,
      setTypingVisible,
      syncPendingQueueFromRef,
    ],
  )

  const restoreStashedOpponentRevealQueue = useCallback(() => {
    const ck = conversationKeyLiveRef.current.trim()
    if (!ck) return
    const stashed = takeStashedOpponentRevealJobs<OpponentRevealJob>(ck)
    if (!stashed.length) return
    assignSequentialOpponentRevealTimestamps(stashed)
    opponentRevealJobsRef.current.push(...stashed)
    syncPendingQueueFromRef()
    onOpponentRevealQueueActive?.(true)
    setBackgroundNotifyPendingWork({ wechatRevealPending: true })
    syncAiReplyPipelineActiveRef.current(ck)
    if (chatRouteVisibleRef.current) kickOpponentRevealProcessor()
  }, [
    assignSequentialOpponentRevealTimestamps,
    kickOpponentRevealProcessor,
    onOpponentRevealQueueActive,
    syncPendingQueueFromRef,
  ])

  const restoreStashedOpponentRevealQueueRef = useRef(restoreStashedOpponentRevealQueue)
  restoreStashedOpponentRevealQueueRef.current = restoreStashedOpponentRevealQueue

  useEffect(() => {
    if (!chatRouteVisible) {
      cancelOpponentRevealTimer()
      return
    }
    restoreStashedOpponentRevealQueueRef.current()
    kickOpponentRevealProcessorRef.current()
  }, [chatRouteVisible, cancelOpponentRevealTimer])

  const flushDeferredBubbleRevealJobs = useCallback(() => {
    if (!deferredBubbleRevealJobsRef.current.length) return
    const jobs = deferredBubbleRevealJobsRef.current.splice(0)
    enqueueOpponentMessagesSequential(jobs)
  }, [enqueueOpponentMessagesSequential])

  /** 前台聊天页：主动消息走与普通 AI 相同的逐条露出 + 顶栏「对方正在输入」 */
  useEffect(() => {
    if (!proactiveCountdownEnabled) return
    const ck = conversationKey.trim()
    if (!ck) return

    registerProactiveMessageRevealHandler(ck, (payload) => {
      if (payload.conversationKey.trim() !== conversationKeyLiveRef.current.trim()) return false
      if (!payload.bubbles.length) return false

      void (async () => {
        const stored = await personaDb.listWeChatChatMessagesByConversationKey(ck)
        const recentStickerRefs = collectRecentCharacterStickerRefsFromMessages(stored)
        const planned = await planProactiveRevealBubblesAsync(
          payload.bubbles,
          {
            characterId: payload.characterId,
            characterName: payload.notifyPeerTitle.trim() || 'TA',
            defaultRecipientName: playerDisplayName.trim() || state.profile.displayName.trim() || '我',
            userLabel: playerDisplayName.trim() || state.profile.displayName.trim() || '我',
            playerIdentityId: payload.playerIdentityId || playerIdentityId,
            playerDisplayName: playerDisplayName.trim() || state.profile.displayName.trim() || '用户',
            playerAvatarUrl: playerAvatarResolved || undefined,
            pulseDmScreenshotEnabled: pulseDmScreenshotEnabled === true,
          },
          recentStickerRefs,
        )
        if (!planned.length) return

        const jobs: OpponentRevealJob[] = planned.map((p) => {
          const incoming: ChatMsg = {
            id: p.id,
            kind: 'msg',
            from: 'other',
            text: p.content,
            thinking: p.thinking,
            timestamp: p.timestamp,
            status: 'sent',
            senderCharacterId: payload.characterId,
            voice: p.voice,
            images: p.images,
            imageGenPending: p.imageGenPending,
            imageGenAwaitingConfirm: p.imageGenAwaitingConfirm,
            imageGenFailed: p.imageGenFailed,
            imageDescription: p.imageDescription,
            imageGenPrompt: p.imageGenPrompt,
            musicSync: p.musicSync,
            locationShare: p.locationShare,
            takeoutOrder: p.takeoutOrder,
            stickerRef: p.stickerRef,
            otherAnimated: true,
          }
          return {
            forConversationKey: ck,
            msg: incoming,
            persist: () => {
              void personaDb
                .appendWeChatChatMessage({
                  id: p.id,
                  characterId: payload.characterId,
                  playerIdentityId: payload.playerIdentityId,
                  type: 'character',
                  content: p.content,
                  stickerRef: p.stickerRef,
                  thinking: p.thinking,
                  timestamp: p.timestamp,
                  isRead: true,
                  conversationKey: ck,
                  notifyPeerTitle: payload.notifyPeerTitle,
                  voice: p.voice,
                  images: p.images,
                  imageGenPending: p.imageGenPending,
                  imageGenAwaitingConfirm: p.imageGenAwaitingConfirm,
                  imageGenFailed: p.imageGenFailed,
                  imageDescription: p.imageDescription,
                  imageGenPrompt: p.imageGenPrompt,
                  musicSync: p.musicSync,
                  locationShare: p.locationShare,
                  takeoutOrder: p.takeoutOrder,
                })
                .catch(() => {})
            },
            afterReveal: undefined,
          }
        })
        enqueueOpponentMessagesSequential(jobs)
      })()

      return true
    })

    return () => registerProactiveMessageRevealHandler(ck, null)
  }, [conversationKey, enqueueOpponentMessagesSequential, proactiveCountdownEnabled])

  /** 切到安卓系统桌面后 setTimeout 会被严重节流；立刻落库以触发系统通知 */
  useEffect(() => {
    const flushForBackground = () => {
      if (document.visibilityState === 'visible') return
      if (opponentRevealJobsRef.current.length === 0) return
      flushOpponentRevealQueueImmediate()
    }
    document.addEventListener('visibilitychange', flushForBackground)
    window.addEventListener('pagehide', flushForBackground)
    return () => {
      document.removeEventListener('visibilitychange', flushForBackground)
      window.removeEventListener('pagehide', flushForBackground)
    }
  }, [flushOpponentRevealQueueImmediate])

  /** 切换 conversationKey：未露出队列按会话暂存，回该会话后仍逐条露出（勿立刻 persist 全量） */
  useEffect(() => {
    if (conversationKeyMigrationRef.current) {
      conversationKeyMigrationRef.current = false
      const nextKey = conversationKey.trim()
      for (const j of opponentRevealJobsRef.current) {
        const jobKey = j.forConversationKey.trim()
        if (!jobKey || jobKey === nextKey) continue
        if (isSameWeChatStorageConversationMigration(jobKey, nextKey)) {
          j.forConversationKey = nextKey
        }
      }
      syncPendingQueueFromRefFnRef.current()
      kickOpponentRevealProcessorRef.current()
      restoreStashedOpponentRevealQueueRef.current()
      return
    }

    cancelOpponentRevealTimer()
    const jobs = opponentRevealJobsRef.current.splice(0)
    if (jobs.length > 0) {
      setPendingQueue([])
      stashOpponentRevealJobsByKey(jobs)
    }
    onOpponentRevealQueueActiveRef.current?.(false)
    syncAiReplyPipelineActiveRef.current(conversationKeyLiveRef.current.trim())
    restoreStashedOpponentRevealQueueRef.current()
  }, [conversationKey, cancelOpponentRevealTimer, stashOpponentRevealJobsByKey])

  /** 离开聊天室（去发红包页等）：队列按会话暂存，回聊天室后续跑逐条露出 */
  useEffect(() => {
    return () => {
      cancelOpponentRevealTimer()
      const jobs = opponentRevealJobsRef.current.splice(0)
      const ck = conversationKeyLiveRef.current.trim()
      if (jobs.length === 0) {
        onOpponentRevealQueueActiveRef.current?.(false)
        return
      }
      setPendingQueue([])
      stashOpponentRevealJobsByKey(jobs)
      opponentRevealJobsRef.current = []
      onOpponentRevealQueueActiveRef.current?.(false)
      if (ck) {
        persistChatAwaitingAiTyping(ck, true)
        persistTypingInterruptRecover(ck, true)
        setWechatAiReplyPipelineActive(ck, true)
      }
    }
  }, [cancelOpponentRevealTimer, stashOpponentRevealJobsByKey])

  const onActionPanelAction = useCallback(
    async (id: WeChatMessageActionId) => {
      const mid = actionMessageId?.trim() || ''
      if (!mid) {
        closeActionPanel()
        return
      }
      const close = () => closeActionPanel()

      const focusComposer = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => textareaRef.current?.focus())
        })
      }

      if (id === 'delete') {
        // 先收起长按面板（portal 到 body，会盖住壳内确认框），保留 messageId 供确认删除
        setActionPanelOpen(false)
        setActionAnchor(null)
        setConfirmDeleteOpen(true)
        return
      }

      close()

      switch (id) {
        case 'copy': {
          const text = (actionMessageText ?? '').trim()
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            // fallback：旧浏览器 / 权限问题
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.position = 'fixed'
            ta.style.left = '-9999px'
            ta.style.top = '0'
            document.body.appendChild(ta)
            ta.focus()
            ta.select()
            try {
              document.execCommand('copy')
            } catch {
              /* ignore */
            } finally {
              document.body.removeChild(ta)
            }
          }
          showCenterToast('已复制')
          return
        }
        case 'forward': {
          const msg = await personaDb.getWeChatChatMessageById(mid)
          if (msg) onRequestForwardMessage?.(msg)
          return
        }
        case 'favorite': {
          const msg = await personaDb.getWeChatChatMessageById(mid)
          if (msg) {
            await personaDb.addFavoriteFromWeChatMessage(msg)
            await personaDb.setWeChatChatMessageFavorite(mid, true)
          }
          showCenterToast('已收藏')
          return
        }
        case 'saveToAlbum': {
          try {
            const local = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === mid)
            const msg = await resolveAlbumSaveMessage(mid, local ?? null, {
              conversationCharacterId,
              playerIdentityId,
              conversationKey,
            })
            if (!msg) {
              showCenterToast('该消息无图片')
              return
            }
            const result = await addWeChatMessageToAlbum(msg)
            if (result === 'duplicate') showCenterToast('已在相册中')
            else if (result === 'saved') showCenterToast('已保存到相册')
            else showCenterToast('保存失败，请刷新后重试')
          } catch (err) {
            console.error('[saveToAlbum] failed', err)
            showCenterToast('保存失败，请刷新后重试')
          }
          return
        }
        case 'multiSelect': {
          setIsMultiSelectMode(true)
          setSelectedMessageIds([mid])
          return
        }
        case 'quote': {
          const localQuote = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === mid)
          if (localQuote?.isRecalled) {
            showCenterToast('已撤回的消息无法引用')
            return
          }
          const rowQuote = await personaDb.getWeChatChatMessageById(mid)
          if (rowQuote?.isRecalled) {
            showCenterToast('已撤回的消息无法引用')
            return
          }
          const meta = await buildReplyMetaById(mid)
          if (!meta) {
            showCenterToast('该消息不存在或已被删除')
            return
          }
          setReplyingTo(meta)
          focusComposer()
          return
        }
        case 'translate': {
          showCenterToast('翻译中...')
          return
        }
        case 'edit': {
          const row = await personaDb.getWeChatChatMessageById(mid)
          if (!row || row.isRecalled) {
            showCenterToast('该消息无法编辑')
            return
          }
          if (row.type !== 'player' && row.type !== 'character') {
            showCenterToast('该消息无法编辑')
            return
          }
          if (row.images?.length || row.redPacket || row.transfer || row.voice || row.callStatus) {
            showCenterToast('仅支持编辑纯文字消息')
            return
          }
          setMessageEditModal({ id: mid, isSelf: row.type === 'player' })
          setMessageEditDraft(row.content ?? '')
          return
        }
        case 'recall': {
          const moderatorRecall =
            roomType === 'group' &&
            groupLive &&
            userCanAccessGroupAdminLevelInClient(groupLive) &&
            actionMessageModeratorRecall &&
            !actionMessageIsSelf

          if (moderatorRecall) {
            const row = await personaDb.getWeChatChatMessageById(mid)
            if (!row || row.isRecalled) {
              showCenterToast('该消息当前不可撤回')
              return
            }
            let original = ''
            if (row.images?.length) original = '[图片]'
            else if (row.voice) original = '[语音]'
            else if (row.redPacket) {
              original = (`[红包] ${(row.redPacket.remark ?? '').trim()}`.trim() || '[红包]').slice(0, 8000)
            } else if (row.transfer) original = '[转账]'
            else if (row.callStatus) original = '[通话]'
            else original = row.content?.trim() || row.originalContent?.trim() || ''

            const recalledAt = getCurrentTimeMs()
            await personaDb.patchWeChatChatMessageById(mid, {
              content: '',
              isRecalled: true,
              recalledBy: 'moderator',
              recallTimestamp: recalledAt,
              originalContent: original,
            })
            setItems((prev) => {
              const next = rebuildWithCurrentTime(
                extractMessages(prev).map((msg) => {
                  if (msg.id !== mid) return msg
                  return {
                    ...msg,
                    text: '',
                    isRecalled: true,
                    recalledBy: 'moderator',
                    recallTimestamp: recalledAt,
                    originalText: original,
                  }
                }),
              )
              itemsRef.current = next
              return next
            })
            return
          }

          if (!actionMessageCanRecall || !actionMessageIsSelf) {
            showCenterToast('该消息当前不可撤回')
            return
          }
          const row = await personaDb.getWeChatChatMessageById(mid)
          if (!row || row.type !== 'player') {
            showCenterToast('原消息不存在或已被删除')
            return
          }
          const recalledAt = getCurrentTimeMs()
          const original = row.content?.trim() || row.originalContent?.trim() || ''
          pendingRecalledUserTextRef.current = original
          await personaDb.patchWeChatChatMessageById(mid, {
            content: '',
            isRecalled: true,
            recalledBy: 'player',
            recallTimestamp: recalledAt,
            originalContent: original,
          })
          setItems((prev) => {
            const next = rebuildWithCurrentTime(
              extractMessages(prev).map((msg) => {
                if (msg.id !== mid) return msg
                return {
                  ...msg,
                  text: '',
                  isRecalled: true,
                  recalledBy: 'self',
                  recallTimestamp: recalledAt,
                  originalText: original,
                }
              }),
            )
            itemsRef.current = next
            return next
          })
          return
        }
        case 'resynthesizeVoice': {
          const target = itemsRef.current.find((it): it is ChatMsg => it.kind === 'msg' && it.id === mid)
          if (!target?.voice || target.from !== 'other') {
            showCenterToast('仅支持角色语音重合成')
            return
          }
          requestVoiceResynthesizeConfirm(mid)
          return
        }
        default:
          return
      }
    },
    [
      actionMessageId,
      actionMessageIsSelf,
      actionMessageText,
      closeActionPanel,
      showCenterToast,
      actionMessageCanRecall,
      actionMessageModeratorRecall,
      roomType,
      groupLive,
      userCanAccessGroupAdminLevelInClient,
      buildReplyMetaById,
      onRequestForwardMessage,
      requestVoiceResynthesizeConfirm,
      getCurrentTimeMs,
      rebuildWithCurrentTime,
      extractMessages,
      conversationCharacterId,
      playerIdentityId,
      conversationKey,
    ],
  )

  useEffect(() => {
    const onDismiss = () => {
      closeActionPanel()
      setMessageEditModal(null)
      setMessageEditDraft('')
      setMockVoiceInputOpen(false)
    }
    window.addEventListener(PHONE_DISMISS_OVERLAYS_EVENT, onDismiss)
    return () => window.removeEventListener(PHONE_DISMISS_OVERLAYS_EVENT, onDismiss)
  }, [closeActionPanel])

  useEffect(() => {
    if (!actionPanelOpen) return
    const onDown = () => {
      closeActionPanel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeActionPanel()
    }
    const onPop = () => closeActionPanel()
    const scrollEl = scrollRef.current
    const onScroll = () => closeActionPanel()
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', onPop)
    scrollEl?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      scrollEl?.removeEventListener('scroll', onScroll)
    }
  }, [actionPanelOpen, closeActionPanel])

  useEffect(() => {
    if (!isMultiSelectMode) return
    // 进入多选后：关闭长按面板、关闭引用/编辑、收起加号菜单
    closeActionPanel()
    setReplyingTo(null)
    setMessageEditModal(null)
    setMessageEditDraft('')
    setPlusMenuOpen(false)
    setStubPanel(null)
  }, [isMultiSelectMode, closeActionPanel])

  const showComposerToast = useCallback((msg: string) => {
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    setComposerToast(msg)
    toastTimerRef.current = window.setTimeout(() => {
      setComposerToast(null)
      toastTimerRef.current = null
    }, 2200)
  }, [])

  const handleEnterGameFromInvite = useCallback(
    (invite: WeChatMiniGameInvitePayload) => {
      const playable = isGameAvailable(invite.gameType as MiniGameType)
      if (!playable) {
        showComposerToast('该游戏尚在开发中')
        return
      }
      const msgs = extractMessages(itemsRef.current)
      let preloadedGomokuSetup: GomokuSessionSetup | undefined
      if (invite.gomokuSession) {
        preloadedGomokuSetup = gomokuSessionSetupFromPayload(invite.gomokuSession)
      }
      if (!preloadedGomokuSetup) {
        for (let i = msgs.length - 1; i >= 0; i -= 1) {
          const mg = msgs[i]?.miniGameInvite
          if (mg?.kind === 'game_accept' && mg.inviteId === invite.inviteId && mg.gomokuSession) {
            preloadedGomokuSetup = gomokuSessionSetupFromPayload(mg.gomokuSession)
            break
          }
        }
      }
      const thread = resolveMiniGameThreadLink(invite.inviteId, msgs)
      setMiniGameSession({
        gameType: invite.gameType as MiniGameType,
        inviteId: invite.inviteId,
        userInviteMessageId: thread.userInviteMessageId,
        acceptMessageId: thread.acceptMessageId,
        preloadedGomokuSetup,
      })
    },
    [extractMessages, showComposerToast],
  )

  const handleMiniGameFinished = useCallback(
    async (params: { inviteId: string; matchResult: WeChatMiniGameMatchResult }) => {
      const inviteId = params.inviteId.trim()
      if (!inviteId) return
      const matchResult = params.matchResult
      const msgs = extractMessages(itemsRef.current)
      const thread = resolveMiniGameThreadLink(inviteId, msgs)
      const threadMessageIds = collectMiniGameThreadMessageIds(thread, msgs)
      const shouldPatchMiniGameMessage = (msg: ChatMsg): boolean => {
        if (threadMessageIds.has(msg.id)) return true
        const mg = msg.miniGameInvite
        return !!mg && (mg.kind === 'game_invite' || mg.kind === 'game_accept') && mg.inviteId === inviteId
      }
      const withMatchResult = (mg: WeChatMiniGamePayload): WeChatMiniGamePayload => {
        if (mg.kind === 'game_invite') {
          return {
            ...mg,
            matchResult,
            ...(mg.charResponded !== 'declined' ? { charResponded: 'accepted' as const } : {}),
          }
        }
        if (mg.kind === 'game_accept') {
          return { ...mg, matchResult }
        }
        return mg
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime(
          extractMessages(prev).map((msg) => {
            if (!shouldPatchMiniGameMessage(msg)) return msg
            const mg = msg.miniGameInvite
            if (!mg || (mg.kind !== 'game_invite' && mg.kind !== 'game_accept')) return msg
            return { ...msg, miniGameInvite: withMatchResult(mg) }
          }),
        )
        itemsRef.current = next
        return next
      })
      try {
        for (const msg of extractMessages(itemsRef.current)) {
          if (!shouldPatchMiniGameMessage(msg)) continue
          const mg = msg.miniGameInvite
          if (!mg || (mg.kind !== 'game_invite' && mg.kind !== 'game_accept')) continue
          await personaDb.patchWeChatChatMessageById(msg.id, {
            miniGameInvite: withMatchResult(mg),
          })
        }
        emitWeChatStorageChanged()
      } catch {
        /* ignore */
      }
    },
    [extractMessages, rebuildWithCurrentTime],
  )

  const handleRespondToCharacterMusicInvite = useCallback(
    async (
      messageId: string,
      invite: WeChatMusicSyncInvitePayload,
      response: 'accept' | 'decline',
    ) => {
      if (invite.userResponded || musicInviteRespondBusy) return
      const msgId = messageId.trim()
      if (!msgId) return
      setMusicInviteRespondBusy(true)
      const updatedInvite: WeChatMusicSyncInvitePayload = {
        ...invite,
        userResponded: response === 'accept' ? 'accepted' : 'declined',
      }
      try {
        setItems((prev) => {
          const next = rebuildWithCurrentTime(
            extractMessages(prev).map((msg) =>
              msg.id === msgId ? { ...msg, musicSync: updatedInvite } : msg,
            ),
          )
          itemsRef.current = next
          return next
        })
        await personaDb.patchWeChatChatMessageById(msgId, { musicSync: updatedInvite })
        if (response === 'accept') {
          const started = await startCharacterMusicSyncInvitePlayback(
            invite,
            buildCharacterMusicSyncSessionContext(),
          )
          if (!started) {
            showComposerToast('暂时无法播放这首歌，请稍后再试')
          }
        } else {
          const ctx = buildCharacterMusicSyncSessionContext()
          const { syncListening, setSyncListening } = useMusicStore.getState()
          if (syncListening?.companion.characterId === ctx.characterId) {
            setSyncListening(null)
          }
        }
      } catch (err) {
        logger.log(
          'error',
          `角色共听邀约回应失败 id=${msgId} err=${err instanceof Error ? err.message : String(err)}`,
        )
        showComposerToast('操作失败，请稍后再试')
      } finally {
        setMusicInviteRespondBusy(false)
      }
    },
    [
      buildCharacterMusicSyncSessionContext,
      extractMessages,
      logger,
      musicInviteRespondBusy,
      rebuildWithCurrentTime,
      showComposerToast,
    ],
  )

  const handleRespondToCharacterMiniGameInvite = useCallback(
    async (
      messageId: string,
      invite: WeChatMiniGameInvitePayload,
      response: 'accept' | 'decline',
    ) => {
      if (invite.userResponded || miniGameInviteRespondBusy) return
      const msgId = messageId.trim()
      if (!msgId) return
      setMiniGameInviteRespondBusy(true)
      let updatedInvite: WeChatMiniGameInvitePayload = {
        ...invite,
        userResponded: response === 'accept' ? 'accepted' : 'declined',
      }
      try {
        if (response === 'accept' && invite.gameType === 'gomoku') {
          updatedInvite = await ensureGomokuSessionOnInvitePayload(updatedInvite, {
            api: apiConfig,
            characterId: conversationCharacterId,
            conversationKey,
            peerDisplayName: peerNotifyTitle,
            lineScope: normalizeMemoryPromptLineScope(currentAccountId, playerIdentityId),
          })
        }
        setItems((prev) => {
          const next = rebuildWithCurrentTime(
            extractMessages(prev).map((msg) =>
              msg.id === msgId ? { ...msg, miniGameInvite: updatedInvite } : msg,
            ),
          )
          itemsRef.current = next
          return next
        })
        await personaDb.patchWeChatChatMessageById(msgId, { miniGameInvite: updatedInvite })
        if (response === 'accept') {
          const alreadyHasUserAccept = extractMessages(itemsRef.current).some(
            (m) =>
              m.from === 'self' &&
              m.miniGameInvite?.kind === 'game_accept' &&
              m.miniGameInvite.inviteId === updatedInvite.inviteId,
          )
          if (!alreadyHasUserAccept) {
            const acceptTs = getCurrentTimeMs()
            const acceptMsgId = `wxm-${acceptTs}-mga-user-${Math.random().toString(36).slice(2, 8)}`
            const gomokuSession = updatedInvite.gomokuSession
              ? gomokuSessionSetupFromPayload(updatedInvite.gomokuSession)
              : undefined
            const acceptPayload = buildMiniGameAcceptPayload({
              invite: updatedInvite,
              replyText: '已接受邀请',
              gomokuSession,
            })
            const acceptMsg: ChatMsg = {
              id: acceptMsgId,
              kind: 'msg',
              from: 'self',
              text: '[已接受游戏邀请]',
              timestamp: acceptTs,
              status: 'sent',
              selfAnimated: true,
              miniGameInvite: acceptPayload,
            }
            setItems((prev) => {
              const next = rebuildWithCurrentTime([...extractMessages(prev), acceptMsg])
              itemsRef.current = next
              return next
            })
            await personaDb.appendWeChatChatMessage({
              id: acceptMsgId,
              characterId: conversationCharacterId,
              playerIdentityId,
              type: 'player',
              content: '[已接受游戏邀请]',
              miniGameInvite: acceptPayload,
              timestamp: acceptTs,
              isRead: true,
              conversationKey,
            })
            scrollToBottomSmooth()
          }
        }
        emitWeChatStorageChanged()
        if (response === 'accept') {
          showComposerToast('已接受游戏邀请')
        } else {
          showComposerToast('已拒绝游戏邀请')
        }
      } catch (err) {
        logger.log(
          'error',
          `角色游戏邀约回应失败 id=${msgId} err=${err instanceof Error ? err.message : String(err)}`,
        )
        showComposerToast('操作失败，请稍后再试')
      } finally {
        setMiniGameInviteRespondBusy(false)
      }
    },
    [
      apiConfig,
      conversationCharacterId,
      conversationKey,
      currentAccountId,
      extractMessages,
      getCurrentTimeMs,
      logger,
      miniGameInviteRespondBusy,
      peerNotifyTitle,
      playerIdentityId,
      rebuildWithCurrentTime,
      scrollToBottomSmooth,
      showComposerToast,
    ],
  )

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  // iOS/移动端键盘：visualViewport + DOM 直写（无 setState）；监听 scroll/geometrychange 与旧版一致
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const nav = navigator as Navigator & {
      virtualKeyboard?: {
        addEventListener?: (type: 'geometrychange', listener: () => void) => void
        removeEventListener?: (type: 'geometrychange', listener: () => void) => void
      }
    }
    const virtualKeyboard = nav.virtualKeyboard

    let rafId: number | null = null

    const measureAndCommit = () => {
      rafId = null
      const fromVv = computeWeChatStyleKeyboardInset(keyboardBaselineRef.current)
      const overlap = measureComposerOverlapPx(inputBarRef.current)
      const inset = Math.max(0, Math.round(Math.max(fromVv, overlap)))
      const prevInset = keyboardInsetRef.current
      const insetStable = Math.abs(prevInset - inset) < 4
      /** 键盘从 0 弹起时 inset 可能先是很小的值，不能因 <4px 而跳过贴底 */
      if (insetStable && !(prevInset <= 0 && inset > 0)) return
      keyboardInsetRef.current = inset
      if (inset > 80 && inset > prevInset && stubPanelRef.current === 'emoji') {
        setStubPanel(null)
      }
      syncComposerInsetFromRefs()
      const keyboardOpening = prevInset <= 0 && inset > 0
      const keyboardGrowing = inset > prevInset + 4
      if (keyboardOpening || (keyboardGrowing && isAtBottomRef.current)) {
        syncChatScrollForKeyboardRef.current()
      }
    }

    const scheduleMeasure = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(measureAndCommit)
    }

    measureAndCommit()
    vv.addEventListener('resize', scheduleMeasure)
    vv.addEventListener('scroll', scheduleMeasure)
    virtualKeyboard?.addEventListener?.('geometrychange', scheduleMeasure)
    window.addEventListener('orientationchange', scheduleMeasure)

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      vv.removeEventListener('resize', scheduleMeasure)
      vv.removeEventListener('scroll', scheduleMeasure)
      virtualKeyboard?.removeEventListener?.('geometrychange', scheduleMeasure)
      window.removeEventListener('orientationchange', scheduleMeasure)
    }
  }, [syncComposerInsetFromRefs])

  /** iOS 聚焦输入框时会 scroll-into-view，短会话下会把顶部消息顶出可视区 */
  useEffect(() => {
    const bar = inputBarRef.current
    if (!bar || inputMode !== 'text') return

    const onPointerDown = (e: PointerEvent) => {
      const ta = textareaRef.current
      if (!ta) return
      const target = e.target
      const shell = ta.closest('[data-wx-chat-input-shell]')
      const inComposer =
        target instanceof Node &&
        (target === ta || ta.contains(target) || (shell instanceof Element && shell.contains(target)))
      if (!inComposer) return
      if (document.activeElement === ta && stubPanelRef.current !== 'emoji') return
      e.preventDefault()
      if (stubPanelRef.current === 'emoji') {
        setStubPanel(null)
      }
      ta.focus({ preventScroll: true })
      scheduleStickChatScrollToBottom()
      window.setTimeout(() => syncChatScrollForKeyboardRef.current(), 0)
    }

    const onFocus = () => {
      scheduleStickChatScrollToBottom()
      window.setTimeout(() => syncChatScrollForKeyboardRef.current(), 0)
      window.setTimeout(() => syncChatScrollForKeyboardRef.current(), 120)
    }

    bar.addEventListener('pointerdown', onPointerDown, { capture: true })
    const ta = textareaRef.current
    ta?.addEventListener('focus', onFocus)
    return () => {
      bar.removeEventListener('pointerdown', onPointerDown, { capture: true })
      textareaRef.current?.removeEventListener('focus', onFocus)
    }
  }, [inputMode, conversationKey, scheduleStickChatScrollToBottom])

  const draftRef = useRef(draft)
  draftRef.current = draft
  const enterDebounceTimerRef = useRef<number | null>(null)
  const lastEnterDownRef = useRef(0)
  const textareaRef = useRef<HTMLDivElement>(null)
  const refocusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus({ preventScroll: true })
        moveWeChatComposerCaretToEnd(el)
      })
    })
  }, [])

  const showComposerKeyboard = useCallback(() => {
    setStubPanel(null)
    setPlusMenuOpen(false)
    refocusComposer()
    scheduleStickChatScrollToBottom()
    window.setTimeout(() => syncChatScrollForKeyboardRef.current(), 0)
  }, [refocusComposer, scheduleStickChatScrollToBottom])

  const insertGroupMention = useCallback(
    (label: string) => {
      setDraft((d) => {
        const next = d.replace(/@([^@\n]*)$/, `@${label} `)
        groupAtFreezeAfterInsertRef.current = next.length
        return next
      })
      setGroupAtOpen(false)
      refocusComposer()
    },
    [refocusComposer],
  )

  const sendQueueRef = useRef<Array<{ text: string; triggerAi: boolean }>>([])
  const processingSendKeyRef = useRef('')
  const processingSendRef = {
    get current(): boolean {
      const k = processingSendKeyRef.current || conversationKeyLiveRef.current.trim()
      return k ? isConversationProcessingSend(k) : false
    },
    set current(v: boolean) {
      const k = processingSendKeyRef.current || conversationKeyLiveRef.current.trim()
      if (k) setConversationProcessingSend(k, v)
    },
  } as { current: boolean }
  const lastSendFingerprintRef = useRef<{ text: string; at: number } | null>(null)

  const pendingAiRepliesKeyRef = useRef('')
  const pendingAiRepliesRef = {
    get current(): number {
      const k = pendingAiRepliesKeyRef.current || conversationKeyLiveRef.current.trim()
      return k ? getConversationPendingAiReplies(k) : 0
    },
    set current(v: number) {
      const k = pendingAiRepliesKeyRef.current || conversationKeyLiveRef.current.trim()
      if (k) setConversationPendingAiReplies(k, v)
    },
  } as { current: number }

  const [pipelineTick, setPipelineTick] = useState(0)
  useEffect(() => subscribeWechatConversationAiPipeline(() => setPipelineTick((t) => t + 1)), [])
  const flushUiBusy = getConversationPipelineFlags(conversationKey).flushUiBusy
  const awaitingAiKick = getConversationPipelineFlags(conversationKey).awaitingAiKick
  void pipelineTick

  const syncAiReplyPipelineActive = useCallback(
    (ck?: string) => {
      const key = (ck ?? conversationKeyLiveRef.current).trim()
      if (!key) return false
      const active = isConversationAiPipelineBusy(key)
      setWechatAiReplyPipelineActive(key, active)
      persistChatAwaitingAiTyping(key, active)
      return active
    },
    [isConversationAiPipelineBusy],
  )
  syncAiReplyPipelineActiveRef.current = syncAiReplyPipelineActive

  const [aiReplyPipelineActive, setAiReplyPipelineActive] = useState(() =>
    isWechatAiReplyPipelineActive(conversationKey),
  )

  useEffect(() => {
    const ck = conversationKey.trim()
    const sync = () => {
      const live = conversationKeyLiveRef.current.trim()
      if (!live || ck !== live) return
      setAiReplyPipelineActive((prev) => {
        const next = isConversationAiPipelineBusy(live)
        return prev === next ? prev : next
      })
    }
    sync()
    const unsubPipeline = subscribeWechatAiReplyPipelineActive(sync)
    const unsubProactive = subscribeProactiveMessageInFlight(sync)
    const unsubConvPipeline = subscribeWechatConversationAiPipeline(sync)
    return () => {
      unsubPipeline()
      unsubProactive()
      unsubConvPipeline()
    }
  }, [conversationKey, isConversationAiPipelineBusy])

  const peerTypingForHeader =
    typingFooterInterrupt ||
    (conversationKey.trim() !== '' &&
      (typingVisible ||
        pendingQueue.length > 0 ||
        isConversationPeerReplyingVisible(conversationKey) ||
        opponentRevealJobsRef.current.some((j) =>
          conversationKeysMatch(j.forConversationKey, conversationKey),
        ) ||
        isProactiveMessageInFlight(conversationKey.trim())))

  const onOtherTypingChangeRef = useRef(onOtherTypingChange)
  onOtherTypingChangeRef.current = onOtherTypingChange
  const onPendingQueueCountChangeRef = useRef(onPendingQueueCountChange)
  onPendingQueueCountChangeRef.current = onPendingQueueCountChange

  useEffect(() => {
    onOtherTypingChangeRef.current?.(peerTypingForHeader)
  }, [peerTypingForHeader])

  useEffect(() => {
    const ck = conversationKey.trim()
    if (!ck) return
    setConversationHeaderTyping(ck, peerTypingForHeader)
    setConversationPendingQueueCount(ck, pendingQueue.length)
  }, [conversationKey, peerTypingForHeader, pendingQueue.length])

  useEffect(() => {
    const ck = conversationKey.trim()
    if (!ck) return
    persistChatAwaitingAiTyping(ck, peerTypingForHeader)
  }, [conversationKey, peerTypingForHeader])

  useEffect(() => {
    setBackgroundNotifyPendingWork({
      wechatTyping: isAnyConversationPeerTypingForNotify(),
    })
  }, [peerTypingForHeader, awaitingAiKick, pipelineTick])

  const skipBusyBypassRef = useRef(false)
  const skipBusyLastTriggerMsRef = useRef(0)
  const aiFailureCooldownUntilRef = useRef(0)
  const aiLastErrorToastMsRef = useRef(0)

  const jumpToBottom = useCallback(() => {
    scrollToBottomSmooth({ force: true })
  }, [scrollToBottomSmooth])

  /** 消费模型返回的弹幕行；当本地配置尚未加载完成时，回退实时读取 DB，避免“首轮丢弹幕”。 */
  const enqueueDanmakuLines = useCallback(async (lines: string[]) => {
    if (!lines.length || !danmakuEnabled) return
    let eff = effectiveDm
    if (!eff) {
      const g = await personaDb.getGlobalSettings()
      const pid = (personaCharacterId?.trim() || conversationCharacterId.trim()) || ''
      const row = pid ? await personaDb.getCharacterDanmakuSettings(pid) : null
      eff = resolveEffectiveDanmakuVisuals(g, pid, row)
    }
    if (!eff || eff.skipCharacter) return

    const gen = ++danmakuEnqueueGenRef.current
    setDmBullets([])
    clearWeChatDmBulletsKv(conversationKey)

    const trackCount = densityToTrackCount(eff.density)
    dmLaneBusyUntilRef.current = Array.from({ length: trackCount }, () => 0)
    const durationSec = eff.scrollDurationSec
    const fontPx = eff.fontSize
    const colorRgba = hexAndOpacityToRgba(eff.color, eff.opacity)

    /** 同一批入队：错峰入场，避免首轮多条同时从右侧涌出（累积延迟：首条略晚，其后每条再等一轮随机间隔） */
    let waveAccumMs = 0
    lines.forEach((line, i) => {
      const stepMs = i === 0 ? randomBetween(140, 520) : randomBetween(400, 980)
      waveAccumMs += stepMs
      const scheduleDelay = waveAccumMs
      window.setTimeout(() => {
        if (gen !== danmakuEnqueueGenRef.current) return
        const pickTrackWithGap = () => {
          const now = Date.now()
          const busy = dmLaneBusyUntilRef.current
          let best = 0
          let bestWait = Number.POSITIVE_INFINITY
          for (let t = 0; t < trackCount; t += 1) {
            const wait = Math.max(0, (busy[t] ?? 0) - now)
            if (wait <= 0) return { track: t, waitMs: 0 }
            if (wait < bestWait) {
              bestWait = wait
              best = t
            }
          }
          return { track: best, waitMs: Math.max(0, bestWait) }
        }
        const place = () => {
          if (gen !== danmakuEnqueueGenRef.current) return
          const { track, waitMs } = pickTrackWithGap()
          if (waitMs > 0) {
            window.setTimeout(place, waitMs)
            return
          }
          const id = `dm-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`
          const durationJitter = (Math.random() - 0.5) * 2.2
          const realDuration = Math.max(3, durationSec + durationJitter)
          /* 同轨下一发须等上一条大致离开可视区，避免水平叠字（原 0.62 易重叠） */
          const safeGapMs = Math.max(1400, realDuration * 1000 * 0.92)
          dmLaneBusyUntilRef.current[track] = Date.now() + safeGapMs
          const topPct =
            eff.position === 'random'
              ? Math.min(92, Math.max(2, (track / Math.max(1, trackCount - 1)) * 72 + Math.random() * 6))
              : undefined
          setDmBullets((prev) => {
            if (gen !== danmakuEnqueueGenRef.current) return prev
            const next = [
              ...prev,
              {
                id,
                text: line,
                track,
                durationSec: realDuration,
                startDelaySec: Math.random() * 0.35 + Math.min(i * 0.1, 1.8),
                fontPx,
                colorRgba,
                style: eff.style,
                positionMode: eff.position,
                topPct,
              },
            ]
            // 仅本批若干条在屏上，仍做上限防止异常撑爆
            return next.slice(-120)
          })
        }
        place()
      }, scheduleDelay)
    })
  }, [conversationKey, danmakuEnabled, effectiveDm, personaCharacterId, conversationCharacterId])

  const generateGroupPsyche = useCallback(async () => {
    if (heartWhisperLoading || roomType !== 'group') return
    const g = groupLive ?? groupDocRef.current
    if (!g) {
      setGroupPsycheGenerateError('群资料未就绪，请稍后再试')
      return
    }
    const npcs = filterGroupNpcMembersExcludingUserAndBot(g.members)
    if (!npcs.length) {
      setGroupPsycheGenerateError('群内暂无 NPC 成员，无法生成群聊心语')
      return
    }
    setGroupPsycheGenerateError(null)
    setHeartWhisperLoading(true)
    try {
      let playerIdentity: PlayerIdentity | null = null
      const piid = playerIdentityId.trim()
      if (piid && piid !== '__none__') {
        playerIdentity = await personaDb.getPlayerIdentityForWechatAccount(piid, currentAccountId)
      }
      const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
      const groupRef = await loadPrivateGroupChatsRecentReference()
      const tx = itemsToTranscript(buildChatItemsForAiTranscript(), {
        groupSpeakerLabel: (msg) => {
          if (msg.from === 'self') return undefined
          const sid = msg.senderCharacterId?.trim()
          if (!sid) return undefined
          if (sid === WECHAT_GROUP_BOT_CHARACTER_ID) return '群管家'
          const gr = groupLive ?? groupDocRef.current
          return gr ? findGroupMember(gr, sid)?.groupNickname : undefined
        },
      })
      const sessionPidForPsyche = piid && piid !== '__none__' ? piid : '__none__'
      const txHayForPsyche = buildMemoryRelevanceHaystack(tx.slice(-28).map((t) => t.text))
      const memPieces: string[] = []
      const groupPsycheMomentImageLists: string[][] = []
      const unsPrivPieces: string[] = []
      const offlinePieces: string[] = []
      const roster = await Promise.all(
        npcs.map(async (m) => {
          const ch = await personaDb.getCharacter(m.charId)
          const name = (m.groupNickname || '').trim() || ch?.name?.trim() || m.charId
          const avatarUrl = (ch?.avatarUrl || '').trim()
          const npcPronoun = ch?.gender === 'female' ? ('她' as const) : ('他' as const)
          const plotFull = (await loadOfflineDatingPlotsPromptBlock(m.charId, ch?.name ?? null)).trim()
          if (plotFull) offlinePieces.push(`【${(m.groupNickname || '').trim() || name}】\n${plotFull}`)
          const hay = buildMemoryRelevanceHaystack([txHayForPsyche, plotFull.slice(0, 2800)])
          const groupLineScope = normalizeMemoryPromptLineScope(currentAccountId, sessionPidForPsyche)
          try {
            const pack = await formatCharacterMemoriesForPromptInjectionPack(m.charId, hay, {
              apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
              lineScope: groupLineScope ?? undefined,
            })
            const mem = pack.text.trim()
            if (mem) memPieces.push(`### 角色ID ${m.charId}\n${mem}`)
            if (pack.momentImageUrls.length) groupPsycheMomentImageLists.push(pack.momentImageUrls)
          } catch {
            /* ignore */
          }
          if (sessionPidForPsyche !== '__none__') {
            try {
              const uns = (
                await formatUnsummarizedPrivateDigestForGroupMember({
                  npcCharacterId: m.charId,
                  sessionPlayerIdentityId: sessionPidForPsyche,
                  boundPlayerIdentityId: ch?.playerIdentityId,
                  maxMessagesPerKey: 40,
                  charCap: 1600,
                })
              ).trim()
              if (uns) unsPrivPieces.push(`### ${m.charId}\n${uns}`)
            } catch {
              /* ignore */
            }
          }
          return { charId: m.charId, name, avatarUrl, npcPronoun }
        }),
      )
      const userAliasesToStrip = [
        ...new Set(
          [peerName, state.profile.displayName]
            .map((s) => String(s ?? '').trim())
            .filter((s) => s.length >= 2),
        ),
      ]
      const wbGroupPsycheIds = [...new Set(roster.map((r) => r.charId.trim()))]
      const groupUnsForPsyche = (
        await formatUnsummarizedCurrentGroupChatBlock({
          groupId: g.id.trim(),
          playerIdentityId: piid || '__none__',
          group: g,
          maxMessages: 80,
          maxChars: 3200,
        })
      ).trim()

      const groupPsycheMomentImages = mergeMomentImageUrlsForGroup(...groupPsycheMomentImageLists)

      const archive = await requestWeChatGroupPsyche({
        apiConfig,
        playerIdentity,
        playerDisplayName: peerName,
        transcript: tx,
        roster,
        userAliasesToStrip,
        nowMs: getCurrentTimeMs(),
        longTermMemoryNotes: memPieces.join('\n\n').trim().slice(0, 14000) || undefined,
        longTermMemoryMomentImages: groupPsycheMomentImages.length ? groupPsycheMomentImages : undefined,
        offlineDatingPlotsContext: offlinePieces.join('\n\n').trim().slice(0, 12000) || undefined,
        recentGroupChatsReference: groupRef || undefined,
        unsummarizedPrivateNotes: unsPrivPieces.join('\n\n').trim().slice(0, 12000) || undefined,
        unsummarizedGroupNotes: groupUnsForPsyche || undefined,
        chatMemberIds: wbGroupPsycheIds,
      })
      await personaDb.putGroupPsyche(conversationCharacterId, archive)
      setGroupPsycheArchive(archive)
      setGroupPsycheGenerateError(null)
      showComposerToast('心语已更新')
    } catch (err) {
      setGroupPsycheGenerateError(formatHeartWhisperGenerateError(err))
    } finally {
      setHeartWhisperLoading(false)
    }
  }, [
    apiConfig,
    conversationCharacterId,
    currentAccountId,
    getCurrentTimeMs,
    groupLive,
    heartWhisperLoading,
    loadPrivateGroupChatsRecentReference,
    playerDisplayName,
    playerIdentityId,
    roomType,
    showComposerToast,
    state.profile.displayName,
    buildChatItemsForAiTranscript,
  ])

  const generateHeartWhisper = useCallback(async () => {
    if (heartWhisperLoading) return
    setHeartWhisperGenerateError(null)
    setHeartWhisperLoading(true)
    try {
      let character: Character | null = null
      let worldBackgroundPrompt: string | undefined
      const pcid = personaCharacterId?.trim()
      const lumiAssistantChat = useLumiProjectAssistantPrompt
      if (!lumiAssistantChat && pcid) {
        character = await personaDb.getCharacter(pcid)
        if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
          const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
          const block = formatWorldBackgroundForPrompt(wbg)
          if (block.trim()) worldBackgroundPrompt = block
        }
      }
      let playerIdentity: PlayerIdentity | null = null
      const piid = playerIdentityId.trim()
      let wechatHomeProfileForHw: { displayName: string; signature?: string } | undefined
      const homeOnlyHw =
        !lumiAssistantChat &&
        !!character &&
        piid &&
        piid !== '__none__' &&
        (await shouldUseWechatHomeProfileOnlyForPrivateChat({
          character,
          sessionPlayerIdentityId: piid,
          wechatAccountId: currentAccountId,
        }))
      if (homeOnlyHw) {
        wechatHomeProfileForHw = {
          displayName: playerDisplayName.trim() || state.profile.displayName.trim() || '',
          signature: state.profile.signature?.trim() || '',
        }
      } else if (!lumiAssistantChat && piid && piid !== '__none__') {
        playerIdentity = await personaDb.getPlayerIdentityForWechatAccount(piid, currentAccountId)
      }
      const nonPrimaryHw =
        !lumiAssistantChat &&
        !!character &&
        (!!wechatHomeProfileForHw || isNonPrimaryBindingSession(character, piid))
      const worldBookBindingHw = character ? await resolveWorldBookUserBinding(character) : null
      let altAccountProbeBlockHw = ''
      if (!lumiAssistantChat && pcid && currentAccountId && character) {
        const currentAcc = accounts.find((a) => a.accountId === currentAccountId)
        if (currentAcc) {
          altAccountProbeBlockHw = await buildWechatPrivateContactIdentityContextBlock({
            characterId: pcid,
            wechatAccountId: currentAccountId,
            currentAccount: currentAcc,
            sessionPlayerIdentityId: piid || '__none__',
            wechatHomeDisplayName:
              wechatHomeProfileForHw?.displayName ||
              playerDisplayName.trim() ||
              state.profile.displayName.trim() ||
              '朋友',
            wechatHomeSignature: wechatHomeProfileForHw?.signature,
          })
        }
      }
      const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
      const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
      const offlineDatingPlotsContext =
        promptMode === 'persona' && pcid
          ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
          : ''
      let worldBookPlaceholderIdMapHw: Record<string, string> | undefined
      if (character?.generatedForCharacterId?.trim()) {
        try {
          const rid = character.generatedForCharacterId.trim()
          const rootCh = await personaDb.getCharacter(rid)
          const rootNm = rootCh?.name?.trim()
          if (rootNm) worldBookPlaceholderIdMapHw = { [rid]: rootNm }
        } catch {
          /* ignore */
        }
      }
      const groupRef = await loadPrivateGroupChatsRecentReference()
      const tx = itemsToTranscript(buildChatItemsForAiTranscript())
      const memPack = await buildPrivateMemoryInjectionForAi(tx, '')
      const wbHeartIds: string[] = [
        ...new Set([pcid?.trim()].filter((x): x is string => !!x && x !== '__none__')),
      ]
      const whisper = await requestWeChatHeartWhisper({
        apiConfig,
        character,
        playerIdentity,
        playerDisplayName: peerName,
        transcript: tx,
        promptMode,
        nowMs: getCurrentTimeMs(),
        timePerceptionEnabled,
        wechatHomeProfile: wechatHomeProfileForHw,
        altAccountProbeBlock: altAccountProbeBlockHw || undefined,
        nonPrimarySpeakerLine: nonPrimaryHw,
        worldBookPlayerIdentity: worldBookBindingHw?.row ?? null,
        worldBookUserLineLabel: worldBookBindingHw?.lineLabel,
        longTermMemoryNotes: memPack.memory || undefined,
        storyTimelineNotes: memPack.storyTimeline || undefined,
        worldBackgroundPrompt,
        offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
        recentGroupChatsReference: groupRef || undefined,
        unsummarizedPrivateNotes: memPack.unsPrivate || undefined,
        unsummarizedGroupNotes: memPack.unsGroup || undefined,
        crossChannelTimelineNotes: memPack.crossChannelTimeline || undefined,
        recentPrivateAiRoundsNotes: memPack.recentPrivateAiRounds || undefined,
        recentOfflineAiRoundsNotes: memPack.recentOfflineAiRounds || undefined,
        recentMeetAiRoundsNotes: memPack.recentMeetAiRounds || undefined,
        chatMemberIds: wbHeartIds,
        globalWechatPlate: 'private_chat',
        worldBookPlaceholderIdMap: worldBookPlaceholderIdMapHw,
      })
      await personaDb.putHeartWhisper(conversationCharacterId, whisper)
      setHeartWhisperData(whisper)
      setHeartWhisperGenerateError(null)
      showComposerToast('心语已更新')
    } catch (err) {
      setHeartWhisperGenerateError(formatHeartWhisperGenerateError(err))
    } finally {
      setHeartWhisperLoading(false)
    }
  }, [
    accounts,
    apiConfig,
    conversationCharacterId,
    currentAccountId,
    getCurrentTimeMs,
    timePerceptionEnabled,
    heartWhisperLoading,
    buildPrivateMemoryInjectionForAi,
    loadPrivateGroupChatsRecentReference,
    personaCharacterId,
    playerDisplayName,
    playerIdentityId,
    showComposerToast,
    state.profile.displayName,
    state.profile.signature,
    useLumiProjectAssistantPrompt,
    buildChatItemsForAiTranscript,
  ])

  const generateCharacterPsyche = useCallback(async () => {
    if (psycheRadarGenerating || roomType !== 'private') return
    setPsycheRadarGenerateError(null)
    setPsycheRadarGenerating(true)
    try {
      let character: Character | null = null
      let worldBackgroundPrompt: string | undefined
      const pcid = personaCharacterId?.trim()
      const lumiAssistantChat = useLumiProjectAssistantPrompt
      if (!lumiAssistantChat && pcid) {
        character = await personaDb.getCharacter(pcid)
        if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
          const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
          const block = formatWorldBackgroundForPrompt(wbg)
          if (block.trim()) worldBackgroundPrompt = block
        }
      }
      let playerIdentity: PlayerIdentity | null = null
      const piid = playerIdentityId.trim()
      let wechatHomeProfileForHw: { displayName: string; signature?: string } | undefined
      const homeOnlyHw =
        !lumiAssistantChat &&
        !!character &&
        piid &&
        piid !== '__none__' &&
        (await shouldUseWechatHomeProfileOnlyForPrivateChat({
          character,
          sessionPlayerIdentityId: piid,
          wechatAccountId: currentAccountId,
        }))
      if (homeOnlyHw) {
        wechatHomeProfileForHw = {
          displayName: playerDisplayName.trim() || state.profile.displayName.trim() || '',
          signature: state.profile.signature?.trim() || '',
        }
      } else if (!lumiAssistantChat && piid && piid !== '__none__') {
        playerIdentity = await personaDb.getPlayerIdentityForWechatAccount(piid, currentAccountId)
      }
      const nonPrimaryHw =
        !lumiAssistantChat &&
        !!character &&
        (!!wechatHomeProfileForHw || isNonPrimaryBindingSession(character, piid))
      const worldBookBindingHw = character ? await resolveWorldBookUserBinding(character) : null
      let altAccountProbeBlockHw = ''
      if (!lumiAssistantChat && pcid && currentAccountId && character) {
        const currentAcc = accounts.find((a) => a.accountId === currentAccountId)
        if (currentAcc) {
          altAccountProbeBlockHw = await buildWechatPrivateContactIdentityContextBlock({
            characterId: pcid,
            wechatAccountId: currentAccountId,
            currentAccount: currentAcc,
            sessionPlayerIdentityId: piid || '__none__',
            wechatHomeDisplayName:
              wechatHomeProfileForHw?.displayName ||
              playerDisplayName.trim() ||
              state.profile.displayName.trim() ||
              '朋友',
            wechatHomeSignature: wechatHomeProfileForHw?.signature,
          })
        }
      }
      const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
      const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
      const offlineDatingPlotsContext =
        promptMode === 'persona' && pcid
          ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
          : ''
      let worldBookPlaceholderIdMapHw: Record<string, string> | undefined
      if (character?.generatedForCharacterId?.trim()) {
        try {
          const rid = character.generatedForCharacterId.trim()
          const rootCh = await personaDb.getCharacter(rid)
          const rootNm = rootCh?.name?.trim()
          if (rootNm) worldBookPlaceholderIdMapHw = { [rid]: rootNm }
        } catch {
          /* ignore */
        }
      }
      const groupRef = await loadPrivateGroupChatsRecentReference()
      const tx = itemsToTranscript(buildChatItemsForAiTranscript())
      const memPack = await buildPrivateMemoryInjectionForAi(tx, '')
      const wbHeartIds: string[] = [
        ...new Set([pcid?.trim()].filter((x): x is string => !!x && x !== '__none__')),
      ]
      const generated = await requestWeChatCharacterPsyche({
        apiConfig,
        character,
        playerIdentity,
        playerDisplayName: peerName,
        transcript: tx,
        promptMode,
        nowMs: getCurrentTimeMs(),
        timePerceptionEnabled,
        wechatHomeProfile: wechatHomeProfileForHw,
        altAccountProbeBlock: altAccountProbeBlockHw || undefined,
        nonPrimarySpeakerLine: nonPrimaryHw,
        worldBookPlayerIdentity: worldBookBindingHw?.row ?? null,
        worldBookUserLineLabel: worldBookBindingHw?.lineLabel,
        longTermMemoryNotes: memPack.memory || undefined,
        storyTimelineNotes: memPack.storyTimeline || undefined,
        worldBackgroundPrompt,
        offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
        recentGroupChatsReference: groupRef || undefined,
        unsummarizedPrivateNotes: memPack.unsPrivate || undefined,
        unsummarizedGroupNotes: memPack.unsGroup || undefined,
        crossChannelTimelineNotes: memPack.crossChannelTimeline || undefined,
        chatMemberIds: wbHeartIds,
        globalWechatPlate: 'private_chat',
        worldBookPlaceholderIdMap: worldBookPlaceholderIdMapHw,
      })
      const saved = await saveCharacterPsycheState({
        conversationCharacterId,
        playerIdentityId,
        state: generated.state,
      })
      setPsycheRadarState(generated.state)
      setPsycheRadarSummaries(generated.summaries)
      setPsycheRadarPreviousMetrics(saved.previousMetrics ?? null)
      setPsycheRadarLastGeneratedAt(saved.updatedAt)
      const fullName = character?.name?.trim() || peerNotifyTitle.trim() || 'TA'
      setPsycheCharacterFullName(fullName)
      setPsycheRadarGenerateError(null)
      showComposerToast('体征状态已更新')
    } catch (err) {
      setPsycheRadarGenerateError(formatHeartWhisperGenerateError(err))
    } finally {
      setPsycheRadarGenerating(false)
    }
  }, [
    accounts,
    apiConfig,
    buildChatItemsForAiTranscript,
    buildPrivateMemoryInjectionForAi,
    conversationCharacterId,
    currentAccountId,
    getCurrentTimeMs,
    timePerceptionEnabled,
    loadPrivateGroupChatsRecentReference,
    personaCharacterId,
    peerNotifyTitle,
    playerDisplayName,
    playerIdentityId,
    psycheRadarGenerating,
    roomType,
    showComposerToast,
    state.profile.displayName,
    state.profile.signature,
    useLumiProjectAssistantPrompt,
  ])

  useEffect(() => {
    if (!heartWhisperOpen) return
    let cancelled = false
    void (async () => {
      if (roomType === 'group') {
        const row = await personaDb.getGroupPsyche(conversationCharacterId)
        if (cancelled) return
        setGroupPsycheArchive(row?.archive ?? null)
        return
      }
      const row = await personaDb.getHeartWhisper(conversationCharacterId)
      if (cancelled) return
      setHeartWhisperData(row?.data ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [conversationCharacterId, heartWhisperOpen, roomType])

  useEffect(() => {
    if (!psycheRadarOpen || roomType !== 'private') return
    let cancelled = false
    setPsycheRadarLoading(true)
    void (async () => {
      try {
        const selfTexts = extractMessages(itemsRef.current)
          .filter((m) => m.from === 'self')
          .map((m) => m.text?.trim() ?? '')
        const lastUserQuote = extractLastUserQuoteFromChatTexts(selfTexts)
        let characterFullName = peerNotifyTitle.trim() || 'TA'
        const pcid = personaCharacterId?.trim()
        if (pcid) {
          try {
            const ch = await personaDb.getCharacter(pcid)
            if (ch?.name?.trim()) characterFullName = ch.name.trim()
          } catch {
            /* ignore */
          }
        }
        const loaded = await loadCharacterPsycheState({
          conversationCharacterId,
          playerIdentityId,
          personaCharacterId,
          characterFullName,
          lastUserQuote,
        })
        if (cancelled) return
        setPsycheCharacterFullName(characterFullName)
        setPsycheRadarState(loaded.state)
        setPsycheRadarSummaries(loaded.summaries)
        setPsycheRadarPreviousMetrics(loaded.previousMetrics)
        setPsycheRadarLastGeneratedAt(loaded.lastGeneratedAt)
      } catch {
        if (!cancelled) {
          setPsycheRadarState(null)
          setPsycheRadarSummaries(null)
          setPsycheRadarPreviousMetrics(null)
          setPsycheRadarLastGeneratedAt(null)
          setPsycheCharacterFullName('')
        }
      } finally {
        if (!cancelled) setPsycheRadarLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationCharacterId, personaCharacterId, peerNotifyTitle, playerIdentityId, psycheRadarOpen, roomType])

  const flushAiReplies = useCallback(async (forConversationKey?: string) => {
    const flushConversationKey = (forConversationKey ?? pendingAiRepliesKeyRef.current ?? conversationKey).trim()
    if (!flushConversationKey) return
    pendingAiRepliesKeyRef.current = flushConversationKey

    const getFlushPending = () => getConversationPendingAiReplies(flushConversationKey)
    const setFlushPending = (n: number) => setConversationPendingAiReplies(flushConversationKey, n)
    const isFlushQueueStopped = () => isConversationOpponentQueueStopped(flushConversationKey)
    const clearFlushQueueStop = () => setConversationOpponentQueueStop(flushConversationKey, false)
    const flushIsLive = () => conversationKeyLiveRef.current.trim() === flushConversationKey
    const setTypingIfLive = (v: boolean) => {
      if (flushIsLive()) setTypingVisible(v)
    }

    const flushIsSelfMemo =
      getConversationFlushContext(flushConversationKey)?.isSelfMemoChat ?? isSelfMemoChat
    if (flushIsSelfMemo) {
      setFlushPending(0)
      setConversationAwaitingAiKick(flushConversationKey, false)
      setTypingIfLive(false)
      return
    }
    const nowGate = Date.now()
    if (nowGate < aiFailureCooldownUntilRef.current) {
      setFlushPending(0)
      setConversationAwaitingAiKick(flushConversationKey, false)
      setTypingIfLive(false)
      if (conversationKeysMatch(aiPipelineOwnerKeyRef.current ?? '', flushConversationKey)) {
        aiPipelineOwnerKeyRef.current = null
        setConversationAiCalling(flushConversationKey, false)
      }
      syncAiReplyPipelineActive(flushConversationKey)
      return
    }
    if (isConversationFlushAiRepliesBusy(flushConversationKey)) {
      // 另一次 flush 正跑：pending 已由 bump 写入，本轮 finally 会 queueMicrotask 再调 flush。
      // 若不解除 awaitingAiKick，用户首条发出后会长期像「卡住」且无法点输入条旁重试。
      setConversationAwaitingAiKick(flushConversationKey, false)
      return
    }
    setConversationFlushAiRepliesBusy(flushConversationKey, true)
    aiPipelineOwnerKeyRef.current = flushConversationKey
    setConversationAiCalling(flushConversationKey, true)
    markProactiveMessageConversationAiBusy(flushConversationKey, true)
    setConversationAwaitingAiKick(flushConversationKey, false)
    setConversationFlushUiBusy(flushConversationKey, true)
    setTypingIfLive(true)
    syncAiReplyPipelineActive(flushConversationKey)
    const storedFlushCtx = getConversationFlushContext(flushConversationKey)
    const liveFlushSnapshot = {
      conversationKey: conversationKey.trim(),
      conversationCharacterId,
      personaCharacterId: personaCharacterId?.trim() ?? '',
      roomType,
      groupId: groupId?.trim() || null,
      playerIdentityId,
      peerNotifyTitle,
      useLumiProjectAssistantPrompt,
      isSelfMemoChat,
    }
    const flushCtx = resolveBoundConversationFlushContext(
      flushConversationKey,
      storedFlushCtx,
      liveFlushSnapshot,
      flushIsLive(),
    )
    const fxRoomType = flushCtx.roomType
    const fxGroupId = flushCtx.groupId
    const fxPersonaCharacterId = flushCtx.personaCharacterId
    const fxConversationCharacterId = flushCtx.conversationCharacterId
    const fxPeerNotifyTitle = flushCtx.peerNotifyTitle
    const fxUseLumi = flushCtx.useLumiProjectAssistantPrompt
    const fxPlayerIdentityId = flushCtx.playerIdentityId
    if (fxRoomType === 'group' && fxGroupId && getFlushPending() > 1) {
      setFlushPending(1)
    }
    const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
    flushOpponentRevealConvKeyRef.current = flushConversationKey
    try {
      while (getFlushPending() > 0) {
        const revealConvKey = flushConversationKey
        if (manualAiPauseRef.current) {
          setFlushPending(0)
          break
        }
        setFlushPending(getFlushPending() - 1)
        clearFlushQueueStop()
        pendingWorldBookRevertByCharRef.current = new Map()

        let danmakuConfigForRound: RoundDanmakuInlineConfig | undefined
        let danmakuApiForRound: ApiConfig | null = null
        let danmakuSplitAttemptedForRound = false

        let persistCharacterId = fxConversationCharacterId
        let notifyPeerRound = fxPeerNotifyTitle.trim() || '对方'
        let memoryRound = ''
        let memoryMomentImagesRound: string[] = []
        let unsPrivateRound = ''
        let traceCrossAccountPrivate = ''
        let traceCurrentLinePrivate = ''
        let unsGroupRound = ''
        let unsMeetRound = ''
        let recentPrivateAiRoundsRound = ''
        let recentOfflineAiRoundsRound = ''
        let recentMeetAiRoundsRound = ''
        let storyTimelineRound = ''
        let crossChannelTimelineRound = ''
        let dedupePrivateRecentOmittedRound = false
        let dedupeOfflineRecentOmittedRound = false
        let dedupeMeetRecentOmittedRound = false
        let recentGroupChatsReference =
          fxRoomType !== 'group' && !fxUseLumi
            ? (await loadPrivateGroupChatsRecentReference()).trim()
            : ''

        let groupDocForFlush = groupDocRef.current
        if (fxRoomType === 'group' && fxGroupId) {
          const gid = fxGroupId
          const gFresh = await personaDb.getGroupChat(gid)
          groupDocForFlush = gFresh
          if (flushIsLive()) groupDocRef.current = gFresh
          const npcs = pickGroupNpcMembersForAiTurn(gFresh, getCurrentTimeMs())
          const firstNpc = npcs[0]?.charId?.trim() || ''
          if (!firstNpc) {
            setTypingIfLive(false)
            continue
          }
          persistCharacterId = firstNpc
          notifyPeerRound = findGroupMember(gFresh, firstNpc)?.groupNickname || '群成员'
          memoryRound = ''
          unsPrivateRound = ''
          unsGroupRound = ''
          recentGroupChatsReference = ''
        }

        const transcriptSpeakerOpts =
          fxRoomType === 'group'
            ? {
                groupSpeakerLabel: (msg: ChatMsg) => {
                  if (msg.from === 'self') return undefined
                  const sid = msg.senderCharacterId?.trim()
                  if (!sid) return notifyPeerRound
                  if (sid === WECHAT_GROUP_BOT_CHARACTER_ID) return '群管家'
                  const gr = groupDocForFlush
                  return gr ? findGroupMember(gr, sid)?.groupNickname : undefined
                },
              }
            : undefined
        const transcriptItems = flushIsLive()
          ? buildChatItemsForAiTranscript()
          : await buildChatItemsForAiTranscriptForKey(flushConversationKey, flushCtx)
        let transcript = itemsToTranscript(transcriptItems, transcriptSpeakerOpts)
        const roundReplyBias = retryReplyBiasRef.current.trim()
        retryReplyBiasRef.current = ''

        setTypingIfLive(true)
        if (isFlushQueueStopped()) {
          setTypingIfLive(false)
          continue
        }

        let character: Character | null = null
        let worldBackgroundPrompt: string | undefined
        const cid = fxRoomType === 'group' ? persistCharacterId : fxPersonaCharacterId?.trim()
        const lumiAssistantChat = fxUseLumi
        if (!lumiAssistantChat && cid) {
          try {
            character = await personaDb.getCharacter(cid)
            if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
              const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
              const block = formatWorldBackgroundForPrompt(wbg)
              if (block.trim()) worldBackgroundPrompt = block
            }
          } catch {
            character = null
          }
        }

        let playerIdentity: PlayerIdentity | null = null
        /** 注入 AI 提示词的「用户称呼」：遇见转微信私聊用微信主页资料，其余私聊/群聊按绑定身份卡。 */
        let aiPlayerDisplayName = peerName
        let aiPlayerIdentityForPrompt: PlayerIdentity | null = null
        let meetEncounterMemoriesContextForAi = ''
        let meetWechatContinuityBlockForAi = ''
        let wechatHomeProfileForAi: { displayName: string; signature: string } | null = null
        const isMeetPrivateChat =
          fxRoomType !== 'group' &&
          !lumiAssistantChat &&
          !!character &&
          isMeetSyncedCharacter(character.id, character.worldBooks ?? [])

        if (!lumiAssistantChat) {
          if (isMeetPrivateChat) {
            const wxHome = {
              displayName: playerDisplayName.trim() || state.profile.displayName.trim() || '',
              signature: state.profile.signature?.trim() || '',
            }
            const meetStrangerLine =
              (await shouldTreatWechatLineAsStrangerContact(currentAccountId)) ||
              (await shouldUseWechatHomeProfileOnlyForPrivateChat({
                character: character!,
                sessionPlayerIdentityId: fxPlayerIdentityId.trim(),
                wechatAccountId: currentAccountId,
              }))
            wechatHomeProfileForAi = wxHome
            aiPlayerDisplayName = wxHome.displayName || '朋友'
            aiPlayerIdentityForPrompt = null
            if (!meetStrangerLine) {
              try {
                meetEncounterMemoriesContextForAi = await loadMeetEncounterMemoriesPromptBlock(character!.id)
              } catch {
                meetEncounterMemoriesContextForAi = ''
              }
              try {
                const meetSnap = await loadMeetUserProfileSnapshotFromKv(character!.id)
                meetWechatContinuityBlockForAi = buildMeetWechatPrivateChatContinuityBlock({
                  meetSnapshot: meetSnap,
                  wechatProfile: wxHome,
                })
              } catch {
                meetWechatContinuityBlockForAi = ''
              }
            }
          } else {
            const sessionId = fxPlayerIdentityId.trim()
            const homeOnly =
              fxRoomType !== 'group' &&
              !!character &&
              sessionId &&
              sessionId !== '__none__' &&
              (await shouldUseWechatHomeProfileOnlyForPrivateChat({
                character,
                sessionPlayerIdentityId: sessionId,
                wechatAccountId: currentAccountId,
              }))
            if (homeOnly) {
              const wxHome = {
                displayName: playerDisplayName.trim() || state.profile.displayName.trim() || '',
                signature: state.profile.signature?.trim() || '',
              }
              wechatHomeProfileForAi = wxHome
              aiPlayerDisplayName = wxHome.displayName || peerName
              aiPlayerIdentityForPrompt = null
            } else {
              let loadIdentityId = sessionId
              if (
                fxRoomType === 'group' &&
                fxGroupId?.trim() &&
                cid?.trim() &&
                cid.trim() !== WECHAT_GROUP_BOT_CHARACTER_ID
              ) {
                try {
                  const speakingChar = await personaDb.getCharacter(cid.trim())
                  const bound = speakingChar?.playerIdentityId?.trim()
                  if (bound && bound !== '__none__') loadIdentityId = bound
                } catch {
                  /* 保持 loadIdentityId */
                }
              } else if (fxRoomType !== 'group') {
                loadIdentityId = resolvePrivateChatPromptPlayerIdentityId(character, sessionId)
              }
              if (loadIdentityId && loadIdentityId !== '__none__') {
                try {
                  playerIdentity = await personaDb.getPlayerIdentityForWechatAccount(
                    loadIdentityId,
                    currentAccountId,
                  )
                } catch {
                  playerIdentity = null
                }
              }
              aiPlayerIdentityForPrompt = playerIdentity
              if (playerIdentity) {
                aiPlayerDisplayName =
                  playerIdentity.wechatNickname?.trim() ||
                  playerIdentity.name?.trim() ||
                  peerName
              }
            }
          }
        }

        const nonPrimarySpeakerLine =
          roomType !== 'group' &&
          !lumiAssistantChat &&
          !!character &&
          (!!wechatHomeProfileForAi ||
            isNonPrimaryBindingSession(character, playerIdentityId.trim()))

        const worldBookBindingForAi =
          roomType !== 'group' && !lumiAssistantChat && character
            ? await resolveWorldBookUserBinding(character)
            : null
        const worldBookPlayerIdentityForAi = worldBookBindingForAi?.row ?? null
        const worldBookUserLineLabelForAi = worldBookBindingForAi?.lineLabel

        let altAccountProbeBlockForAi = ''
        if (!lumiAssistantChat && roomType !== 'group' && cid && currentAccountId && character) {
          const currentAcc = accounts.find((a) => a.accountId === currentAccountId)
          if (currentAcc) {
            const wxHome = {
              displayName: playerDisplayName.trim() || state.profile.displayName.trim() || '',
              signature: state.profile.signature?.trim() || '',
            }
            altAccountProbeBlockForAi = await buildWechatPrivateContactIdentityContextBlock({
              characterId: cid,
              wechatAccountId: currentAccountId,
              currentAccount: currentAcc,
              sessionPlayerIdentityId: playerIdentityId.trim() || '__none__',
              wechatHomeDisplayName: wxHome.displayName || '朋友',
              wechatHomeSignature: wxHome.signature,
            })
          }
        }

        const pm = lumiAssistantChat ? 'lumi-assistant' : 'persona'
        /** 人脉 NPC 世界书 `{{id:根人设id}}` → 注入前替换为根人设姓名 */
        let worldBookPlaceholderIdMap: Record<string, string> | undefined
        if (character?.generatedForCharacterId?.trim()) {
          try {
            const rid = character.generatedForCharacterId.trim()
            const rootCh = await personaDb.getCharacter(rid)
            const rootNm = rootCh?.name?.trim()
            if (rootNm) worldBookPlaceholderIdMap = { [rid]: rootNm }
          } catch {
            /* ignore */
          }
        }
        /** 档案室法则仅匹配 NPC，不包含玩家身份 */
        const privateWorldbookMemberIds: string[] = [
          ...new Set(
            [personaCharacterId?.trim()].filter((x): x is string => !!x && x !== '__none__'),
          ),
        ]
        let loreSceneMemberIds: string[] = privateWorldbookMemberIds
        let offlineDatingPlotsContext =
          pm === 'persona' && cid
            ? await loadOfflineDatingPlotsPromptBlock(cid, character?.name ?? null)
            : ''

        let aiReply: WeChatPeerReplyResult = { bubbles: [] }
        let aiRequestFailed = false
        let clearBusyAfterReply = false
        let suppressBusyDirectiveThisRound = false
        let groupMultiOrderedItems: WeChatGroupMultiSpeakerOrderedItem[] | null = null
        let groupWorldBookPatches: WorldBookAfterPatch[] | undefined
        let traceGroupChatAfterSection = ''
        let traceGroupChatAfterPatchRules = false
        let groupTraceSnapshot: {
          allowedCharIds: string[]
          groupName: string
          primaryNickname: string
          offlineCombined: string
          groupUnsummarized: string
          firstNpcWorldBg: string
        } | null = null
        let traceGlobalPlate: 'private_chat' | 'group_chat' = 'private_chat'
        let traceReplyBias = ''
        let resolvedImageGenSettings = DEFAULT_IMAGE_GEN_SETTINGS
        let characterImageGenEnabled = false
        let roundUserExplicitImageRequest = false
        let roundUserExplicitStickerRequest = false
        let roundImageAllowed = false
        let roundImageCountTarget = 0
        let privatePeerReplyRetryParams: Parameters<typeof requestWeChatPeerReplyBubbles>[0] | null = null
        let roundUserImageForProfile: { base64: string; mime: WeChatImageMime } | null = null
        try {
          const hasApi =
            !!apiConfig?.apiUrl?.trim() &&
            !!apiConfig?.apiKey?.trim() &&
            !!apiConfig?.modelId?.trim()
          if (!hasApi) {
            // 不做任何本地兜底回复：未触发模型时不应出现角色消息
            showComposerToast('未配置 AI API，无法生成对方回复')
            setFlushPending(0)
            setTypingIfLive(false)
            continue
          } else {
            const busyGs = await personaDb.getGlobalSettings()
            const isGroupRoom = fxRoomType === 'group' && !!fxGroupId
            const busyConvEnabledRaw = await personaDb.getPhoneKv(`busy-conv:${flushConversationKey}`)
            const busyConvEnabled = typeof busyConvEnabledRaw === 'boolean' ? busyConvEnabledRaw : true
            const busySwitchEnabledRaw = isGroupRoom
              ? false
              : busyGs.busyEnabled && (busyGs.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : busyConvEnabled)
            if (skipBusyBypassRef.current) {
              suppressBusyDirectiveThisRound = true
              skipBusyBypassRef.current = false
            }
            const busySwitchEnabled = suppressBusyDirectiveThisRound ? false : busySwitchEnabledRaw
            const busyRow = isGroupRoom ? null : await personaDb.getCharacterBusySettings(fxConversationCharacterId)
            const nowTs = getCurrentTimeMs()
            const busyStillActive = !!busyRow?.isBusy && (busyRow.busyEndTime ?? 0) > nowTs
            clearBusyAfterReply = !!busySwitchEnabled && !!busyRow?.isBusy && !busyStillActive
            if (clearBusyAfterReply && busyRow) {
              // 关键：忙碌已过期时先解除 busy，避免后续 AI 失败时被“过期忙碌”反复触发重试。
              await personaDb.putCharacterBusySettings({
                characterId: fxConversationCharacterId,
                isBusy: false,
                busyReason: '',
                busyStartTime: 0,
                busyEndTime: 0,
                busyDurationMinutes: busyRow.busyDurationMinutes ?? 15,
                busyMessages: [],
              })
              clearBusyAfterReply = false
            }
            if (busySwitchEnabled && busyStillActive && busyRow) {
              showCenterToast(buildBusyToastText(fxPeerNotifyTitle || '对方', busyRow.busyReason || '处理点事情', busyRow.busyEndTime ?? nowTs, nowTs))
              setFlushPending(0)
              continue
            }
            const reversed = [...extractMessages(transcriptItems)].reverse()
            const lastOther = reversed.find((x) => x.kind === 'msg' && x.from === 'other') as ChatMsg | undefined
            const lastSelfVoice = reversed.find((x) => x.kind === 'msg' && x.from === 'self' && !!x.voice) as ChatMsg | undefined
            const voiceEmotionBias = (() => {
              const v = lastSelfVoice?.voice
              if (!v) return ''
              const emotion = v.emotionLabel?.trim()
              const transcript = v.transcriptText?.trim() || lastSelfVoice?.text?.trim() || ''
              if (!emotion && !transcript) return ''
              const chunks: string[] = ['【语音情绪权重提示】']
              if (emotion) chunks.push(`- 用户上一条语音情绪倾向：${emotion}。`)
              if (transcript) chunks.push(`- 语音转写要点：${transcript}`)
              chunks.push('- 回复时先做情绪承接，再给出内容回应；语气自然、克制、贴近真实聊天。')
              return chunks.join('\n')
            })()
            const agencyChatBias =
              roomType !== 'group' && !lumiAssistantChat && personaCharacterId?.trim()
                ? loadStarMakerAgencyReplyBias(personaCharacterId)
                : ''
            const mergedReplyBias = [roundReplyBias, voiceEmotionBias, agencyChatBias]
              .filter((x) => x.trim())
              .join('\n\n')
            const recallPreview = pendingRecalledUserTextRef.current?.trim() || ''
            const recallVagueShape = (() => {
              if (!recallPreview) return ''
              const n = recallPreview.length
              if (n <= 6) return '你只觉得那条气泡非常短，像一句直球或一句狠话。'
              if (n <= 24) return '你只觉得那条不长，像吐槽、撒娇或一句追问。'
              return '你只觉得那条不算短，但规则禁止你还原任何原词。'
            })()
            const recallBias = recallPreview
              ? Math.random() < 0.2
                ? `[系统提示] 用户刚刚撤回了一条私聊消息；你手快，在消失前**瞥到一点氛围**（${recallVagueShape}）**硬性约束**：正文里**禁止**复述撤回原文、**禁止**用加粗/引号复刻措辞、**禁止**使用 \`[引用:消息ID]\` 指向该条或任何等价「引用条」展示原文；只能用人设口吻**旁敲侧击**一句（如「撤回什么呢，我都看见了」「当我瞎？」），让读者感觉你瞄到了又不当众拆穿。`
                : `[系统提示] 用户刚刚撤回了一条消息，你没看清具体内容。**禁止**假装你看见了原文、**禁止**复述臆测的具体措辞；可以好奇追问，或照常接话。`
              : ''
            const lastSelfPlain = reversed.find((x) => x.kind === 'msg' && x.from === 'self') as ChatMsg | undefined
            const groupCtxBias =
              roomType === 'group' && groupDocRef.current
                ? [
                    `【群聊】微信群「${groupDocRef.current.name}」：本轮为 **单次模型调用**；用 <<SPEAKER:角色ID>> 分行输出——**换人必须行首带标**，同人连续多行可**仅首行带标、后续裸续**；**活人感**：成员之间**互嘴、接梗**为主，贴合人设；**不设**固定气泡条数，以像真群在聊为准；禁止「一人先堆一大段、再换另一人堆一大段」的轮流演讲感。`,
                    '历史记录里带发言者前缀的是其他群成员；可互怼、帮腔、抢话；气泡宜短碎，但条数可疏可密。',
                    '**不要求每名 NPC 本轮都开口**；忌全员轮流对用户单独表态；同一 NPC 可本轮多次发言，每次再开口须重新带 <<SPEAKER>>。',
                    '**勿忽视用户**：用户的话与情绪须在整轮中有回响（可直接接一句，或在互怼中自然回扣），禁止全轮只顾 NPC 互怼像没看见用户。',
                    '用户连发多条时不必逐条复读；短确认句（「行」「好」）时优先让群内话题自然延续。',
                  ].join('\n')
                : ''
            const atYouBias = (() => {
              const tx = lastSelfPlain?.text?.trim() || ''
              if (!tx || roomType !== 'group' || !groupDocRef.current) {
                if (roomType !== 'group' && tx && notifyPeerRound.trim() && tx.includes(`@${notifyPeerRound}`)) {
                  return `[系统通知] 用户 @ 了你（${notifyPeerRound}）。请先接住这一句；除非人设明确拒回，否则本轮至少应有 1 条可见回复。`
                }
                return ''
              }
              const mentioned = groupDocRef.current.members.filter(
                (m) =>
                  m.charId !== WECHAT_GROUP_USER_CHAR_ID &&
                  m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID &&
                  m.groupNickname?.trim() &&
                  tx.includes(`@${m.groupNickname.trim()}`),
              )
              if (!mentioned.length) return ''
              return `[系统通知] 用户 @ 了：${mentioned.map((m) => m.groupNickname.trim()).join('、')}。对应角色在本轮输出中至少各出现一行 <<SPEAKER:其角色ID>> 的可见回复（除非人设明确拒回）。`
            })()
            traceReplyBias = [mergedReplyBias, recallBias, groupCtxBias, atYouBias].filter((x) => x.trim()).join('\n\n')
            if (roomType !== 'group' && !lumiAssistantChat && personaCharacterId?.trim()) {
              const engageMusicSync = shouldEngageMusicSyncInviteFlow(reversed)
              if (!engageMusicSync) {
                traceReplyBias = [traceReplyBias, WECHAT_LISTEN_TRACK_SHARE_OUTPUT_BLOCK]
                  .filter((x) => x.trim())
                  .join('\n\n')
              }
              const pendingInvite = engageMusicSync
                ? findLatestPendingMusicInvite(extractMessages(buildChatItemsForAiTranscript()))
                : null
              if (pendingInvite) {
                const msBias = buildMusicSyncInviteReplyBias({
                  messageId: pendingInvite.messageId,
                  invite: pendingInvite.invite,
                })
                traceReplyBias = [traceReplyBias, msBias].filter((x) => x.trim()).join('\n\n')
              }
              const pendingMiniGameInvite = findLatestPendingMiniGameInvite(
                extractMessages(buildChatItemsForAiTranscript()),
              )
              if (pendingMiniGameInvite) {
                const mgBias = buildMiniGameInviteReplyBias({
                  messageId: pendingMiniGameInvite.messageId,
                  invite: pendingMiniGameInvite.invite,
                })
                traceReplyBias = [traceReplyBias, mgBias, WECHAT_MINI_GAME_INVITE_OUTPUT_BLOCK]
                  .filter((x) => x.trim())
                  .join('\n\n')
              }
              const pendingSharedRecord = findLatestSelfSharedRecordInBurst(reversed)
              if (pendingSharedRecord) {
                const srBias = await buildSharedRecordReplyBias({
                  recipientCharacterId: personaCharacterId,
                  recipientDisplayName: notifyPeerRound,
                  payload: pendingSharedRecord,
                })
                traceReplyBias = [traceReplyBias, srBias].filter((x) => x.trim()).join('\n\n')
              }
              const pendingChatHistory = findLatestSelfChatHistoryInBurst(reversed)
              if (pendingChatHistory) {
                const chBias = await buildChatHistoryReplyBias({
                  recipientCharacterId: personaCharacterId,
                  recipientDisplayName: notifyPeerRound,
                  payload: pendingChatHistory,
                  userDisplayName: playerDisplayName.trim() || '我',
                  personaContacts: personaContactsList,
                })
                traceReplyBias = [traceReplyBias, chBias].filter((x) => x.trim()).join('\n\n')
              }
              const lastUserSelfTextForFh = [...transcript]
                .reverse()
                .find((t) => t.from === 'self')?.text
              const fhSituation = detectForwardHistoryEvidenceSituation(lastUserSelfTextForFh)
              const fhBias = buildCharacterForwardHistorySituationBias({
                situation: fhSituation,
                userForwardedHistoryTitle: pendingChatHistory?.title,
              })
              if (fhBias.trim()) {
                traceReplyBias = [traceReplyBias, fhBias].filter((x) => x.trim()).join('\n\n')
              }
              const syncPlaybackBias = buildSyncListeningPlaybackBias(personaCharacterId)
              if (syncPlaybackBias.trim()) {
                traceReplyBias = [traceReplyBias, syncPlaybackBias].filter((x) => x.trim()).join('\n\n')
              }
              const characterInviteStateBias = buildCharacterMusicSyncInviteStateBias(
                personaCharacterId,
                extractMessages(buildChatItemsForAiTranscript()),
              )
              if (characterInviteStateBias.trim()) {
                traceReplyBias = [traceReplyBias, characterInviteStateBias].filter((x) => x.trim()).join('\n\n')
              }
              const lastUserSelfTextForSync = [...transcript].reverse().find((t) => t.from === 'self')?.text ?? ''
              const syncLyricHumBias = buildSyncListeningLyricHumBias(
                personaCharacterId,
                lastUserSelfTextForSync,
              )
              if (syncLyricHumBias.trim()) {
                traceReplyBias = [traceReplyBias, syncLyricHumBias].filter((x) => x.trim()).join('\n\n')
              }
              traceReplyBias = [traceReplyBias, WECHAT_CHARACTER_MUSIC_SYNC_OUTPUT_BLOCK]
                .filter((x) => x.trim())
                .join('\n\n')
              const characterMiniGameStateBias = buildCharacterMiniGameInviteStateBias(
                extractMessages(buildChatItemsForAiTranscript()),
              )
              if (characterMiniGameStateBias.trim()) {
                traceReplyBias = [traceReplyBias, characterMiniGameStateBias].filter((x) => x.trim()).join('\n\n')
              }
              traceReplyBias = [traceReplyBias, WECHAT_CHARACTER_MINI_GAME_INVITE_OUTPUT_BLOCK]
                .filter((x) => x.trim())
                .join('\n\n')
              traceReplyBias = [traceReplyBias, WECHAT_CHARACTER_MOMENT_SONG_SHARE_APPENDIX]
                .filter((x) => x.trim())
                .join('\n\n')
            }
            pendingRecalledUserTextRef.current = null
            let sharedLinkPreviewBlock = ''
            try {
              const userTextsForLink = [...transcript]
                .reverse()
                .filter((t) => t.from === 'self')
                .slice(0, 5)
                .map((t) => t.text ?? '')
              const linkPreviewPack = await buildLinkPreviewPromptBlockFromTexts(userTextsForLink)
              sharedLinkPreviewBlock = linkPreviewPack.block
              const linkNotice = linkPreviewPack.userNotice.trim()
              if (linkNotice) {
                if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
                setComposerToast(linkNotice)
                toastTimerRef.current = window.setTimeout(() => {
                  setComposerToast(null)
                  toastTimerRef.current = null
                }, 4500)
              }
            } catch {
              sharedLinkPreviewBlock = ''
            }
            const linkPreviewExtras = sharedLinkPreviewBlock.trim()
              ? { sharedLinkPreviewBlock: sharedLinkPreviewBlock.trim() }
              : {}
            const isPrivatePersonaRound =
              roomType !== 'group' && !lumiAssistantChat && !!personaCharacterId?.trim()
            if (isPrivatePersonaRound) {
              try {
                // 记忆/向量召回卡住时不能挡死聊天模型；超时后降级为空记忆继续请求
                const MEMORY_INJECT_TIMEOUT_MS = 28_000
                const pack = await Promise.race([
                  buildPrivateMemoryInjectionForAi(transcript, traceReplyBias),
                  new Promise<never>((_, reject) => {
                    window.setTimeout(
                      () => reject(new Error('memory_inject_timeout')),
                      MEMORY_INJECT_TIMEOUT_MS,
                    )
                  }),
                ])
                memoryRound = pack.memory
                memoryMomentImagesRound = pack.momentImageUrls
                unsPrivateRound = pack.unsPrivate
                traceCrossAccountPrivate = pack.traceCrossAccountPrivate ?? ''
                traceCurrentLinePrivate = pack.traceCurrentLinePrivate ?? ''
                unsGroupRound = pack.unsGroup
                unsMeetRound = pack.unsMeet
                recentPrivateAiRoundsRound = pack.recentPrivateAiRounds ?? ''
                recentOfflineAiRoundsRound = pack.recentOfflineAiRounds ?? ''
                recentMeetAiRoundsRound = pack.recentMeetAiRounds ?? ''
                storyTimelineRound = pack.storyTimeline ?? ''
                crossChannelTimelineRound = pack.crossChannelTimeline ?? ''
                dedupePrivateRecentOmittedRound = pack.dedupePrivateRecentOmitted === true
                dedupeOfflineRecentOmittedRound = pack.dedupeOfflineRecentOmitted === true
                dedupeMeetRecentOmittedRound = pack.dedupeMeetRecentOmitted === true
                if (pack.offlineUnsummarizedForPrompt?.trim()) {
                  offlineDatingPlotsContext = pack.offlineUnsummarizedForPrompt
                }
              } catch (memErr) {
                if (memErr instanceof Error && memErr.message === 'memory_inject_timeout') {
                  logger.log('error', '记忆注入超时，已跳过向量召回并继续请求回复模型')
                }
                memoryRound = ''
                memoryMomentImagesRound = []
                unsPrivateRound = ''
                unsGroupRound = ''
                unsMeetRound = ''
                recentPrivateAiRoundsRound = ''
                recentOfflineAiRoundsRound = ''
                recentMeetAiRoundsRound = ''
              }
            }
            // 关键：如果玩家在发图后又补了一句文字（例如“你看不见吗”），则最后一条 self 可能是纯文本。
            // 为确保模型能对“最近一次发的图片”做出反应，这里改为：优先取“最近一次 self 图片消息”，但仅限于发生在最近一次 other 消息之后（即本轮玩家侧发送的图）。
            const lastSelfWithImage = reversed.find((x) => {
              if (x.kind !== 'msg' || x.from !== 'self') return false
              if (!x.images?.[0]?.base64?.trim()) return false
              if (!lastOther) return true
              const aiMsgs = extractMessages(buildChatItemsForAiTranscript())
              const selfIdx = aiMsgs.findIndex((it) => it.id === x.id)
              const otherIdx = aiMsgs.findIndex((it) => it.id === lastOther.id)
              return otherIdx < 0 || selfIdx > otherIdx
            }) as ChatMsg | undefined
            const img = lastSelfWithImage?.images?.[0]
            if (img?.base64?.trim()) {
              roundUserImageForProfile = {
                base64: img.base64.trim(),
                mime: img.type ?? 'image/jpeg',
              }
              const profileImageCaptionBias = buildUserImageProfileApplyCaptionBias(lastSelfWithImage?.text)
              if (profileImageCaptionBias) {
                traceReplyBias = [traceReplyBias, profileImageCaptionBias].filter((x) => x.trim()).join('\n\n')
              }
            }
            // 发请求前再拼一次 transcript，避免重新回复/删稿与异步 flush 交错时仍带入本轮旧对方稿
            transcript = itemsToTranscript(buildChatItemsForAiTranscript(), transcriptSpeakerOpts)
            // 按会话设置决定是否注入后台思维链 CoT（默认关）
            const includeThinkingChain = thinkingChainEnabled === true
            const includeForwardHistoryCard = forwardHistoryCardEnabled === true
            const includePulseDmScreenshot = pulseDmScreenshotEnabled === true
            const includeProfileImageChange = profileImageChangeEnabled === true
            const includeInternetMemeLexicon = internetMemeLexiconEnabled === true
            const busyCfg =
              busyGs.busyMode === 'character'
                ? {
                    maxDuration: peerBusyRow?.maxDuration ?? busyGs.globalBusyConfig.maxDuration,
                    customScenarios: peerBusyRow?.customScenarios ?? busyGs.globalBusyConfig.customScenarios,
                  }
                : busyGs.globalBusyConfig
            const busyContext: BusyRuntimeContext | undefined = busySwitchEnabled
              ? {
                  enabled: true,
                  isBusy: !!busyRow?.isBusy && (busyRow.busyEndTime ?? 0) > nowTs,
                  remainingMinutes: busyRow?.busyEndTime ? Math.max(0, Math.ceil((busyRow.busyEndTime - nowTs) / 60000)) : 0,
                  reason: busyRow?.busyReason ?? '',
                  maxDuration: busyCfg.maxDuration,
                  customScenarios: busyCfg.customScenarios,
                  busyMessages: (busyRow?.busyMessages ?? []).map((m) => ({
                    id: m.id,
                    content: m.content,
                    timestamp: m.timestamp,
                  })),
                }
              : undefined
            const { config: danmakuConfig, visuals: roundEffectiveDm } = await resolveRoundDanmakuInlineConfig({
              danmakuEnabled,
              effectiveDm,
              personaCharacterId: personaCharacterId ?? undefined,
              conversationCharacterId,
            })
            danmakuConfigForRound = danmakuConfig
            danmakuApiForRound = resolveDanmakuApiForRequest(danmakuApiConfig, apiConfig)
            /** 弹幕与正文分路请求；未单独开「弹幕」子 API 时回退主聊天 API，不再依赖模型 inline <danmaku> */
            const shouldSplitDanmakuCall = !!danmakuConfig && !!danmakuApiForRound
            if (danmakuEnabled && danmakuConfig && !danmakuApiForRound) {
              logConsole('ai', '[danmaku] 已开弹幕模式但未配置可用 API（主聊天或弹幕预设）')
            }
            if (danmakuEnabled && roundEffectiveDm?.skipCharacter) {
              logConsole('ai', '[danmaku] 当前角色在弹幕配置中已关闭，跳过生成')
            }
            let peerMediaFreqExtras: {
              stickerRoundTriggerPercent?: number
              voiceRoundTriggerPercent?: number
              classicEmojiRoundTriggerPercent?: number
              applyClassicEmojiDefault?: boolean
              stickerTargetedModeEnabled?: boolean
              stickerTargetedGroups?: string[]
              stickerTargetedEntries?: import('./wechatMediaSendFrequency').StickerTargetedEntryMap
              stickerBannedRefs?: string[]
              classicEmojiBannedNames?: string[]
            } = {}
            if (roomType !== 'group') {
              let sticker = convMediaFreqRef.current.sticker
              let voice = convMediaFreqRef.current.voice
              let image = convMediaFreqRef.current.image
              let imageCountMin = convMediaFreqRef.current.imageCountMin
              let imageCountMax = convMediaFreqRef.current.imageCountMax
              let classicEmoji = convMediaFreqRef.current.classicEmoji
              let stickerTargetedModeEnabled = convMediaFreqRef.current.stickerTargetedModeEnabled
              let stickerTargetedGroups = convMediaFreqRef.current.stickerTargetedGroups
              let stickerTargetedEntries = convMediaFreqRef.current.stickerTargetedEntries
              let stickerBannedRefs = convMediaFreqRef.current.stickerBannedRefs
              let classicEmojiBannedNames = convMediaFreqRef.current.classicEmojiBannedNames
              try {
                const freshConv = await personaDb.getChatConversationSettings(conversationKey)
                sticker = parseStoredRoundTriggerPercent(freshConv?.stickerRoundTriggerPercent)
                voice = parseStoredRoundTriggerPercent(freshConv?.voiceRoundTriggerPercent)
                image = parseStoredRoundTriggerPercent(freshConv?.imageRoundTriggerPercent)
                imageCountMin = freshConv?.imageRoundCountMin
                imageCountMax = freshConv?.imageRoundCountMax
                classicEmoji = parseStoredRoundTriggerPercent(freshConv?.classicEmojiRoundTriggerPercent)
                stickerTargetedModeEnabled = freshConv?.stickerTargetedModeEnabled === true
                stickerTargetedGroups = freshConv?.stickerTargetedGroups
                stickerTargetedEntries = freshConv?.stickerTargetedEntries
                stickerBannedRefs = freshConv?.stickerBannedRefs
                classicEmojiBannedNames = freshConv?.classicEmojiBannedNames
                convMediaFreqRef.current = {
                  sticker,
                  voice,
                  image,
                  imageCountMin,
                  imageCountMax,
                  classicEmoji,
                  stickerTargetedModeEnabled,
                  stickerTargetedGroups,
                  stickerTargetedEntries,
                  stickerBannedRefs,
                  classicEmojiBannedNames,
                }
              } catch {
                /* keep ref */
              }
              const lastUserSelfText = [...transcript].reverse().find((t) => t.from === 'self')?.text
              roundUserExplicitImageRequest = resolveCharacterImageRequestIntent({ transcript })
              roundUserExplicitStickerRequest = userExplicitlyRequestsCharacterSticker(lastUserSelfText)
              peerMediaFreqExtras = {
                ...(sticker !== undefined ? { stickerRoundTriggerPercent: sticker } : {}),
                ...(voice !== undefined ? { voiceRoundTriggerPercent: voice } : {}),
                ...(classicEmoji !== undefined
                  ? { classicEmojiRoundTriggerPercent: classicEmoji }
                  : { applyClassicEmojiDefault: true }),
                ...(stickerTargetedModeEnabled ? { stickerTargetedModeEnabled: true } : {}),
                ...(stickerTargetedGroups?.length ? { stickerTargetedGroups } : {}),
                ...(stickerTargetedEntries ? { stickerTargetedEntries } : {}),
                ...(stickerBannedRefs?.length ? { stickerBannedRefs } : {}),
                ...(classicEmojiBannedNames?.length ? { classicEmojiBannedNames } : {}),
              }
            }
            resolvedImageGenSettings = await loadResolvedImageGenSettings()
            // 私聊且「支持发图」开启时注入发图协议；关闭则不注入、不展示占位
            characterImageGenEnabled =
              roomType !== 'group' &&
              !lumiAssistantChat &&
              isCharacterImageSendSupported(convMediaFreqRef.current.image)
            const characterImageGenStyleHint = resolveCharacterMediaImageStyleHint(
              resolvedImageGenSettings,
              characterHasAppearanceReference(character),
            )
            const roundImageCountRange = parseStoredImageRoundCountRange(
              convMediaFreqRef.current.imageCountMin,
              convMediaFreqRef.current.imageCountMax,
            )
            if (characterImageGenEnabled) {
              roundImageAllowed = true
              roundImageCountTarget = drawRoundImageCount(roundImageCountRange)
              if (roundUserExplicitImageRequest && roundImageCountTarget < 1) {
                roundImageCountTarget = Math.max(1, roundImageCountRange.min)
              }
            }
            if (characterImageGenEnabled && roundUserExplicitImageRequest) {
              const explicitImageBias = buildUserExplicitCharacterImageRequestBias(true)
              traceReplyBias = [traceReplyBias, explicitImageBias].filter((x) => x.trim()).join('\n\n')
            }
            const characterImageGenExtras = characterImageGenEnabled
              ? ({
                  characterImageGenEnabled: true,
                  characterImageGenStyleHint,
                  imageRoundCountMin: roundImageCountRange.min,
                  imageRoundCountMax: roundImageCountRange.max,
                  ...(roundImageCountTarget > 0 ? { imageRoundCountTarget: roundImageCountTarget } : {}),
                  userExplicitCharacterImageRequest: roundUserExplicitImageRequest,
                  imageRoundAllowed: true,
                } as const)
              : {}
            let characterPersonaSelfServiceExtras: {
              characterMomentsPinCatalog?: string
              userMomentsViewerCatalog?: string
              characterWechatProfileBlock?: string
            } = {}
            if (
              roomType !== 'group' &&
              !lumiAssistantChat &&
              pm === 'persona' &&
              character?.id?.trim() &&
              currentAccountId?.trim()
            ) {
              const characterWechatProfileBlock = [
                buildCharacterWechatProfileStateBlock(character),
                buildCharacterProfileImageCatalogBlock(character),
              ]
                .filter((x) => x.trim())
                .join('\n\n')
              const [characterMomentsPinCatalog, userMomentsViewerCatalog] = await Promise.all([
                buildCharacterMomentsPinCatalogBlock(currentAccountId, character.id),
                buildUserMomentsVisibleToCharacterCatalogBlock({
                  accountId: currentAccountId,
                  characterId: character.id,
                  playerIdentityId: playerIdentityId,
                  playerDisplayName: playerDisplayName.trim() || '我',
                }),
              ])
              characterPersonaSelfServiceExtras = {
                ...(characterWechatProfileBlock.trim()
                  ? { characterWechatProfileBlock }
                  : {}),
                ...(characterMomentsPinCatalog.trim()
                  ? { characterMomentsPinCatalog }
                  : {}),
                ...(userMomentsViewerCatalog.trim()
                  ? { userMomentsViewerCatalog }
                  : {}),
              }
              const lastUserLine = [...transcript].reverse().find((t) => t.from === 'self')?.text
              const profileUpdateBias = buildUserWechatProfileUpdateBias(lastUserLine)
              if (profileUpdateBias) {
                traceReplyBias = [traceReplyBias, profileUpdateBias].filter((x) => x.trim()).join('\n\n')
              }
              const profileImageRestoreBias = buildUserProfileImageRestoreBias(lastUserLine)
              if (profileImageRestoreBias) {
                traceReplyBias = [traceReplyBias, profileImageRestoreBias].filter((x) => x.trim()).join('\n\n')
              }
              const momentPinBias = buildUserMomentPinRequestBias(lastUserLine)
              if (momentPinBias) {
                traceReplyBias = [traceReplyBias, momentPinBias].filter((x) => x.trim()).join('\n\n')
              }
              const momentPublishBias = buildUserMomentPublishRequestBias(lastUserLine)
              if (momentPublishBias) {
                traceReplyBias = [traceReplyBias, momentPublishBias].filter((x) => x.trim()).join('\n\n')
              }
            }
            traceGlobalPlate = roomType === 'group' ? 'group_chat' : 'private_chat'
            if (roomType === 'group' && groupId?.trim()) {
              const groupMemberCharactersForWbPatch: Character[] = []
              const gChat = groupDocRef.current
              const npcMembers = pickGroupNpcMembersForAiTurn(gChat, getCurrentTimeMs())
              const allowedCharIds = npcMembers.map((m) => m.charId.trim()).filter(Boolean)
              if (!allowedCharIds.length) {
                showComposerToast('群内没有可接话的 AI 成员')
                setFlushPending(0)
                continue
              }
              let groupUnsummarizedBlock = ''
              try {
                groupUnsummarizedBlock = (
                  await formatUnsummarizedCurrentGroupChatBlock({
                    groupId: groupId.trim(),
                    playerIdentityId: playerIdentityId.trim(),
                    group: gChat ?? null,
                    maxMessages: 100,
                    maxChars: 4000,
                  })
                ).trim()
              } catch {
                groupUnsummarizedBlock = ''
              }
              const nickToId = new Map<string, string>()
              for (const m of npcMembers) {
                if (m.groupNickname?.trim()) nickToId.set(m.groupNickname.trim(), m.charId)
              }
              const sessionPidForGroup = playerIdentityId.trim()
              let sessionRelationshipsBulk: Relationship[] | null = null
              if (sessionPidForGroup && sessionPidForGroup !== '__none__') {
                try {
                  sessionRelationshipsBulk = await personaDb.listRelationshipsForIdentity(sessionPidForGroup)
                } catch {
                  sessionRelationshipsBulk = []
                }
              }
              let anchorPrivatePeerId: string | null = null
              const gidForPvAnchor = groupId?.trim() ?? ''
              if (gidForPvAnchor && sessionPidForGroup && sessionPidForGroup !== '__none__') {
                try {
                  anchorPrivatePeerId =
                    peekGroupChatPrivatePeerAnchorFromDockStaging(gidForPvAnchor) ??
                    (await personaDb.getGroupChatAnchorPrivatePeerCharacterId(gidForPvAnchor, sessionPidForGroup))
                } catch {
                  anchorPrivatePeerId = null
                }
              }
              const boundRelationshipsCache = new Map<string, Relationship[]>()
              const memberPromptRows: WeChatGroupMultiSpeakerMemberPrompt[] = []
              const groupMemoryMomentImageLists: string[][] = []
              const groupLineScope = normalizeMemoryPromptLineScope(currentAccountId, sessionPidForGroup)
              const identityBindingSnapshot: GroupNpcIdentityBindingRow[] = []
              let offlineCombined = ''
              for (const m of npcMembers) {
                let ch: Character | null = null
                try {
                  ch = await personaDb.getCharacter(m.charId)
                } catch {
                  ch = null
                }
                if (ch) groupMemberCharactersForWbPatch.push(ch)
                identityBindingSnapshot.push({
                  groupNickname: m.groupNickname,
                  boundPlayerIdentityId: ch?.playerIdentityId,
                })
                if (ch?.wechatNickname?.trim()) nickToId.set(ch.wechatNickname.trim(), m.charId)
                if (ch?.name?.trim()) nickToId.set(ch.name.trim(), m.charId)
                const anchorBoost =
                  !!anchorPrivatePeerId && m.charId.trim() === anchorPrivatePeerId.trim()
                const continuityBias = anchorBoost
                  ? '【会话锚点】用户刚结束与你在微信私聊并进入本群；须与私聊与长期记忆连贯承接，禁止装作私聊未发生；群发言仍守分寸，勿当众宣读不宜公开的细节。'
                  : ''
                let offlinePlotForMember = ''
                try {
                  offlinePlotForMember = (
                    await loadOfflineDatingPlotsPromptBlock(m.charId, ch?.name ?? ch?.wechatNickname ?? null)
                  ).trim()
                } catch {
                  offlinePlotForMember = ''
                }
                let privateDigest = ''
                try {
                  privateDigest = (
                    await buildNpcPrivateChatDigestForGroupPrompt({
                      npcCharacterId: m.charId,
                      sessionPlayerIdentityId: playerIdentityId.trim(),
                      boundPlayerIdentityId: ch?.playerIdentityId,
                      anchorPrivateBoost: anchorBoost,
                      messageCap: anchorBoost ? 56 : 42,
                      charCap: anchorBoost ? 5200 : 3800,
                    })
                  ).trim()
                } catch {
                  privateDigest = ''
                }
                let unsPrivMember = ''
                try {
                  unsPrivMember = (
                    await formatUnsummarizedPrivateDigestForGroupMember({
                      npcCharacterId: m.charId,
                      sessionPlayerIdentityId: sessionPidForGroup,
                      boundPlayerIdentityId: ch?.playerIdentityId,
                      anchorPrivateBoost: anchorBoost,
                      maxMessagesPerKey: anchorBoost ? 76 : 56,
                      charCap: anchorBoost ? 3600 : 2600,
                    })
                  ).trim()
                } catch {
                  unsPrivMember = ''
                }
                const memberHay = buildMemoryRelevanceHaystack([
                  continuityBias,
                  ...transcript.slice(-36).map((t) => `${t.speakerLabel ?? ''} ${t.text}`),
                  traceReplyBias,
                  offlinePlotForMember.slice(0, 2400),
                  privateDigest.slice(0, anchorBoost ? 2200 : 1400),
                  unsPrivMember.slice(0, 1800),
                ])
                let memNotes = ''
                try {
                  const pack = await formatCharacterMemoriesForPromptInjectionPack(m.charId, memberHay, {
                    apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
                    lineScope: groupLineScope ?? undefined,
                  })
                  memNotes = pack.text.trim()
                  if (pack.momentImageUrls.length) groupMemoryMomentImageLists.push(pack.momentImageUrls)
                } catch {
                  memNotes = ''
                }
                const boundPid = ch?.playerIdentityId?.trim()
                let boundRels: Relationship[] | undefined
                if (
                  boundPid &&
                  boundPid !== '__none__' &&
                  boundPid !== sessionPidForGroup &&
                  sessionPidForGroup &&
                  sessionPidForGroup !== '__none__'
                ) {
                  if (!boundRelationshipsCache.has(boundPid)) {
                    try {
                      boundRelationshipsCache.set(boundPid, await personaDb.listRelationshipsForIdentity(boundPid))
                    } catch {
                      boundRelationshipsCache.set(boundPid, [])
                    }
                  }
                  boundRels = boundRelationshipsCache.get(boundPid)
                }
                let relRomanceProfile = ''
                try {
                  relRomanceProfile = (
                    await buildNpcRelationshipRomanceProfileForGroupPrompt({
                      npcCharacterId: m.charId,
                      sessionPlayerIdentityId: sessionPidForGroup,
                      boundPlayerIdentityId: ch?.playerIdentityId,
                      sessionRelationships: sessionRelationshipsBulk ?? undefined,
                      boundRelationships: boundRels,
                    })
                  ).trim()
                } catch {
                  relRomanceProfile = ''
                }
                try {
                  const alignNote = (
                    await buildNpcIdentityAlignmentNoteForGroup({
                      sessionPlayerIdentityId: sessionPidForGroup,
                      boundPlayerIdentityId: ch?.playerIdentityId,
                    })
                  ).trim()
                  if (alignNote) relRomanceProfile = [relRomanceProfile, alignNote].filter(Boolean).join('\n\n').trim()
                } catch {
                  /* ignore */
                }
                let wbp = ''
                try {
                  if (ch?.worldBackgroundEnabled !== false && ch?.worldBackgroundId?.trim()) {
                    const wbg = await personaDb.getWorldBackground(ch.worldBackgroundId.trim())
                    wbp = formatWorldBackgroundForPrompt(wbg).trim()
                  }
                } catch {
                  wbp = ''
                }
                memberPromptRows.push({
                  charId: m.charId,
                  groupNickname: m.groupNickname,
                  wechatNickname: ch?.wechatNickname?.trim() || undefined,
                  characterCard: buildCharacterCard(ch),
                  worldBook: buildWorldBookText(ch, 3200),
                  memoryNotes: memNotes,
                  worldBackground: wbp || undefined,
                  relationshipRomanceProfile: relRomanceProfile || undefined,
                  privateChatDigest: privateDigest || undefined,
                  unsummarizedPrivateNotes: unsPrivMember || undefined,
                  schedule: (ch?.schedule as ScheduleTable | undefined) ?? null,
                })
                if (offlinePlotForMember) {
                  const gn = (m.groupNickname || '').trim() || ch?.name?.trim() || m.charId
                  offlineCombined += `\n【${gn}】\n${offlinePlotForMember}\n`
                }
              }
              let multiIdentityCoPresenceBlock = ''
              try {
                multiIdentityCoPresenceBlock = (
                  await buildGroupMultiIdentityCoPresenceBlock({
                    sessionPlayerIdentityId: sessionPidForGroup,
                    members: identityBindingSnapshot,
                  })
                ).trim()
              } catch {
                multiIdentityCoPresenceBlock = ''
              }
              let identityForGroupPrompt: PlayerIdentity | null = null
              if (playerIdentityId.trim() && playerIdentityId.trim() !== '__none__') {
                try {
                  identityForGroupPrompt = await personaDb.getPlayerIdentityForWechatAccount(
                    playerIdentityId.trim(),
                    currentAccountId,
                  )
                } catch {
                  identityForGroupPrompt = null
                }
              }
              const userGroupNickForPrompt =
                gChat?.members.find((x) => x.charId === WECHAT_GROUP_USER_CHAR_ID)?.groupNickname?.trim() ||
                aiPlayerDisplayName.trim() ||
                playerDisplayName.trim() ||
                '用户'
              const anyBoundMismatchSession =
                !!sessionPidForGroup &&
                sessionPidForGroup !== '__none__' &&
                identityBindingSnapshot.some((r) => {
                  const b = r.boundPlayerIdentityId?.trim()
                  return !!b && b !== '__none__' && b !== sessionPidForGroup
                })
              const useLeanGroupPlayerIdentity =
                !!multiIdentityCoPresenceBlock.trim() || anyBoundMismatchSession
              const sessionThirdPronoun = buildWeChatPlayerThirdPersonPronounIronRule(identityForGroupPrompt)
              const piBlock = useLeanGroupPlayerIdentity
                ? `${buildGroupLeanSessionIdentityPromptBlock({
                    sessionPlayerIdentityId: sessionPidForGroup,
                    userGroupNicknameInUi: userGroupNickForPrompt,
                  })}${sessionThirdPronoun}`
                : `${buildWeChatPlayerIdentityPromptBlock(identityForGroupPrompt)}\n【用户在本群的昵称】${userGroupNickForPrompt}（群内展示以此为准，可与通讯录备注不同。）`
              let groupStrangerPairsPrompt: string | undefined
              try {
                const rels = await personaDb.listRelationshipsInNetwork(allowedCharIds)
                const pairLines = buildGroupStrangerPairDisplayLines(allowedCharIds, gChat?.members ?? [], rels)
                if (pairLines.length) groupStrangerPairsPrompt = pairLines.join('\n')
              } catch {
                groupStrangerPairsPrompt = undefined
              }
              let groupSelfAuditBlock = ''
              try {
                groupSelfAuditBlock = await buildGroupChatSelfAuditPromptSection({
                  group: gChat ?? null,
                  sessionPlayerIdentityId: playerIdentityId.trim(),
                })
              } catch {
                groupSelfAuditBlock = ''
              }
              const danmakuInstruction = buildDanmakuInlineInstruction({
                enabled: !!danmakuConfig?.enabled,
                useMemory: !!danmakuConfig?.useMemory,
                generateCount: danmakuConfig?.generateCount ?? 0,
                customPrompt: danmakuConfig?.customPrompt,
                character,
                playerIdentity,
                playerDisplayName: aiPlayerDisplayName,
                worldBackgroundPrompt,
                transcript,
              })
              const groupShieldedModeratorAnnex = buildGroupShieldedModeratorAnnex(itemsRef.current)
              /** 群内仅 NPC characterId 参与档案室匹配 */
              const wbGroupIds = new Set<string>(allowedCharIds)
              loreSceneMemberIds = [...wbGroupIds]
              groupTraceSnapshot = {
                allowedCharIds: [...wbGroupIds],
                groupName: gChat?.name?.trim() || '群聊',
                primaryNickname: (memberPromptRows[0]?.groupNickname || '').trim() || '群成员',
                offlineCombined: offlineCombined.trim(),
                groupUnsummarized: groupUnsummarizedBlock.trim(),
                firstNpcWorldBg: (memberPromptRows[0]?.worldBackground || '').trim(),
              }
              await ensureStickerStoreHydrated()
              let systemContentFinal = buildWeChatGroupMultiSpeakerSystem({
                groupName: gChat?.name?.trim() || '群聊',
                groupId: groupId.trim(),
                members: memberPromptRows,
                playerSection: piBlock,
                playerSchedule: (identityForGroupPrompt?.schedule as ScheduleTable | undefined) ?? null,
                replyBias: traceReplyBias || undefined,
                offlinePlotsCombined: offlineCombined.trim() || undefined,
                groupUnsummarizedNotes: groupUnsummarizedBlock || undefined,
                groupStrangerPairsPrompt,
                groupSelfAuditBlock: groupSelfAuditBlock.trim() || undefined,
                groupShieldedModeratorAnnex: groupShieldedModeratorAnnex.trim() || undefined,
                multiIdentityCoPresenceBlock: multiIdentityCoPresenceBlock || undefined,
                currentTimeMs: getCurrentTimeMs(),
                promptMode: pm,
                danmakuInstruction: shouldSplitDanmakuCall ? undefined : danmakuInstruction || undefined,
                chatMemberIds: [...wbGroupIds],
                includeThinkingChain,
              })
              const grpWbExtra = buildAggregateGroupChatAfterPatchItemsSection(groupMemberCharactersForWbPatch)
              if (grpWbExtra.trim()) systemContentFinal += `\n\n${grpWbExtra}`
              if (groupMemberCharactersForWbPatch.some((c) => hasChatAfterWorldBookItems(c))) {
                systemContentFinal += `\n\n${buildWorldBookAfterPatchOutputAppendix()}`
              }
              if (characterImageGenEnabled) {
                systemContentFinal += `\n\n${buildCharacterImageGenPromptBlock(characterImageGenStyleHint, {
                  hasAppearanceReference: characterHasAppearanceReference(character),
                  appearanceHint: resolveCharacterImageGenPromptAppearanceHint(character),
                  userExplicitCharacterImageRequest: roundUserExplicitImageRequest,
                  chatContextTail: buildChatContextTailFromTranscript(transcript),
                  characterGender: character?.gender,
                  playerGender: identityForGroupPrompt?.gender ?? playerIdentity?.gender,
                  injectCompositionLifeFeelCot: shouldInjectImageGenCompositionLifeFeelCot({
                    characterImageGenEnabled,
                    userExplicitCharacterImageRequest: roundUserExplicitImageRequest,
                    imageRoundCountTarget: roundImageCountTarget,
                  }),
                })}`
              }
              if (sharedLinkPreviewBlock.trim()) {
                systemContentFinal += `\n\n---\n${sharedLinkPreviewBlock.trim()}\n`
              }
              traceGroupChatAfterSection = grpWbExtra
              traceGroupChatAfterPatchRules = groupMemberCharactersForWbPatch.some((c) => hasChatAfterWorldBookItems(c))
              const userImageIsSticker = Boolean(lastSelfWithImage?.text?.trim().startsWith('[表情包]'))
              const groupMemoryMomentImages = mergeMomentImageUrlsForGroup(...groupMemoryMomentImageLists)
              const gm =
                img?.base64?.trim()
                  ? await requestWeChatGroupMultiSpeakerReplyBubblesWithImage({
                      apiConfig,
                      transcript,
                      promptMode: pm,
                      systemContent: systemContentFinal,
                      allowedCharIds,
                      nickToId,
                      imageBase64: img.base64.trim(),
                      imageMime: img.type ?? 'image/jpeg',
                      userImageIsSticker,
                      longTermMemoryMomentImages: groupMemoryMomentImages.length
                        ? groupMemoryMomentImages
                        : undefined,
                    })
                  : await requestWeChatGroupMultiSpeakerReplyBubbles({
                      apiConfig,
                      transcript,
                      promptMode: pm,
                      systemContent: systemContentFinal,
                      allowedCharIds,
                      nickToId,
                      longTermMemoryMomentImages: groupMemoryMomentImages.length
                        ? groupMemoryMomentImages
                        : undefined,
                    })
              groupMultiOrderedItems = gm.orderedItems ?? []
              groupWorldBookPatches = gm.worldBookPatches
              aiReply = {
                bubbles: [],
                danmakuLines: [...(gm.danmakuLines ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)],
              }
            } else {
              if (img?.base64?.trim()) {
              const userImageIsSticker = Boolean(lastSelfWithImage?.text?.trim().startsWith('[表情包]'))
              const meetWechatAiExtras = {
                ...(wechatHomeProfileForAi ? { wechatHomeProfile: wechatHomeProfileForAi } : {}),
                ...(isMeetPrivateChat
                  ? {
                      meetWechatContinuityBlock: meetWechatContinuityBlockForAi || undefined,
                      meetEncounterMemoriesContext: meetEncounterMemoriesContextForAi || undefined,
                    }
                  : {}),
              }
              const altExtras = altAccountProbeBlockForAi
                ? { altAccountProbeBlock: altAccountProbeBlockForAi }
                : {}
              privatePeerReplyRetryParams = {
                apiConfig,
                character,
                playerIdentity: aiPlayerIdentityForPrompt,
                playerDisplayName: aiPlayerDisplayName,
                transcript,
                promptMode: pm,
                ...meetWechatAiExtras,
                ...altExtras,
                ...linkPreviewExtras,
                ...peerMediaFreqExtras,
                ...characterImageGenExtras,
                ...characterPersonaSelfServiceExtras,
                longTermMemoryNotes: memoryRound.trim() || undefined,
                longTermMemoryMomentImages:
                  memoryMomentImagesRound.length ? memoryMomentImagesRound : undefined,
                storyTimelineNotes: storyTimelineRound.trim() || undefined,
                crossChannelTimelineNotes: crossChannelTimelineRound.trim() || undefined,
                worldBackgroundPrompt,
                offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                recentGroupChatsReference: recentGroupChatsReference || undefined,
                unsummarizedPrivateNotes: unsPrivateRound.trim() || undefined,
                unsummarizedGroupNotes: unsGroupRound.trim() || undefined,
                unsummarizedMeetNotes: unsMeetRound.trim() || undefined,
                recentPrivateAiRoundsNotes: recentPrivateAiRoundsRound.trim() || undefined,
                recentOfflineAiRoundsNotes: recentOfflineAiRoundsRound.trim() || undefined,
                recentMeetAiRoundsNotes: recentMeetAiRoundsRound.trim() || undefined,
                replyBias: traceReplyBias || undefined,
                busyContext,
                includeThinkingChain,
                includeForwardHistoryCard,
                includePulseDmScreenshot,
                includeProfileImageChange,
                includeInternetMemeLexicon,
                currentTimeMs: getCurrentTimeMs(),
                timePerceptionEnabled: roomType === 'private' ? timePerceptionEnabled : true,
                danmakuConfig: shouldSplitDanmakuCall ? undefined : danmakuConfig,
                groupChatTranscript: false,
                chatMemberIds: loreSceneMemberIds,
                globalWechatPlate: traceGlobalPlate,
                worldBookPlaceholderIdMap,
                nonPrimarySpeakerLine,
                worldBookPlayerIdentity: worldBookPlayerIdentityForAi,
                worldBookUserLineLabel: worldBookUserLineLabelForAi,
              }
              if (userImageIsSticker) {
                aiReply = await requestWeChatPeerReplyBubbles(privatePeerReplyRetryParams)
              } else {
                aiReply = await requestWeChatPeerReplyBubblesWithImage({
                  apiConfig,
                  character,
                  playerIdentity: aiPlayerIdentityForPrompt,
                  playerDisplayName: aiPlayerDisplayName,
                  transcript,
                  promptMode: pm,
                  imageBase64: img.base64.trim(),
                  imageMime: img.type ?? 'image/jpeg',
                  userImageIsSticker,
                  ...meetWechatAiExtras,
                  ...altExtras,
                  ...linkPreviewExtras,
                  ...peerMediaFreqExtras,
                  ...characterImageGenExtras,
                  ...characterPersonaSelfServiceExtras,
                  longTermMemoryNotes: memoryRound.trim() || undefined,
                  longTermMemoryMomentImages:
                    memoryMomentImagesRound.length ? memoryMomentImagesRound : undefined,
                  storyTimelineNotes: storyTimelineRound.trim() || undefined,
                  crossChannelTimelineNotes: crossChannelTimelineRound.trim() || undefined,
                  worldBackgroundPrompt,
                  offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                  recentGroupChatsReference: recentGroupChatsReference || undefined,
                  unsummarizedPrivateNotes: unsPrivateRound.trim() || undefined,
                  unsummarizedGroupNotes: unsGroupRound.trim() || undefined,
                  unsummarizedMeetNotes: unsMeetRound.trim() || undefined,
                  recentPrivateAiRoundsNotes: recentPrivateAiRoundsRound.trim() || undefined,
                  recentOfflineAiRoundsNotes: recentOfflineAiRoundsRound.trim() || undefined,
                  recentMeetAiRoundsNotes: recentMeetAiRoundsRound.trim() || undefined,
                  replyBias: traceReplyBias || undefined,
                  busyContext,
                  includeThinkingChain,
                  includeForwardHistoryCard,
                  includePulseDmScreenshot,
                  includeProfileImageChange,
                  includeInternetMemeLexicon,
                  currentTimeMs: getCurrentTimeMs(),
                  timePerceptionEnabled: roomType === 'private' ? timePerceptionEnabled : true,
                  danmakuConfig: shouldSplitDanmakuCall ? undefined : danmakuConfig,
                  groupChatTranscript: false,
                  chatMemberIds: loreSceneMemberIds,
                  globalWechatPlate: traceGlobalPlate,
                  worldBookPlaceholderIdMap,
                  nonPrimarySpeakerLine,
                  worldBookPlayerIdentity: worldBookPlayerIdentityForAi,
                  worldBookUserLineLabel: worldBookUserLineLabelForAi,
                })
              }
            } else {
              const meetWechatAiExtras = {
                ...(wechatHomeProfileForAi ? { wechatHomeProfile: wechatHomeProfileForAi } : {}),
                ...(isMeetPrivateChat
                  ? {
                      meetWechatContinuityBlock: meetWechatContinuityBlockForAi || undefined,
                      meetEncounterMemoriesContext: meetEncounterMemoriesContextForAi || undefined,
                    }
                  : {}),
              }
              const altExtras = altAccountProbeBlockForAi
                ? { altAccountProbeBlock: altAccountProbeBlockForAi }
                : {}
              privatePeerReplyRetryParams = {
                apiConfig,
                character,
                playerIdentity: aiPlayerIdentityForPrompt,
                playerDisplayName: aiPlayerDisplayName,
                transcript,
                promptMode: pm,
                ...meetWechatAiExtras,
                ...altExtras,
                ...linkPreviewExtras,
                ...peerMediaFreqExtras,
                ...characterImageGenExtras,
                ...characterPersonaSelfServiceExtras,
                longTermMemoryNotes: memoryRound.trim() || undefined,
                longTermMemoryMomentImages:
                  memoryMomentImagesRound.length ? memoryMomentImagesRound : undefined,
                storyTimelineNotes: storyTimelineRound.trim() || undefined,
                crossChannelTimelineNotes: crossChannelTimelineRound.trim() || undefined,
                worldBackgroundPrompt,
                offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                recentGroupChatsReference: recentGroupChatsReference || undefined,
                unsummarizedPrivateNotes: unsPrivateRound.trim() || undefined,
                unsummarizedGroupNotes: unsGroupRound.trim() || undefined,
                unsummarizedMeetNotes: unsMeetRound.trim() || undefined,
                recentPrivateAiRoundsNotes: recentPrivateAiRoundsRound.trim() || undefined,
                recentOfflineAiRoundsNotes: recentOfflineAiRoundsRound.trim() || undefined,
                recentMeetAiRoundsNotes: recentMeetAiRoundsRound.trim() || undefined,
                replyBias: traceReplyBias || undefined,
                busyContext,
                includeThinkingChain,
                includeForwardHistoryCard,
                includePulseDmScreenshot,
                includeProfileImageChange,
                includeInternetMemeLexicon,
                currentTimeMs: getCurrentTimeMs(),
                timePerceptionEnabled: roomType === 'private' ? timePerceptionEnabled : true,
                danmakuConfig: shouldSplitDanmakuCall ? undefined : danmakuConfig,
                groupChatTranscript: false,
                chatMemberIds: loreSceneMemberIds,
                globalWechatPlate: traceGlobalPlate,
                worldBookPlaceholderIdMap,
                nonPrimarySpeakerLine,
                worldBookPlayerIdentity: worldBookPlayerIdentityForAi,
                worldBookUserLineLabel: worldBookUserLineLabelForAi,
              }
              aiReply = await requestWeChatPeerReplyBubbles(privatePeerReplyRetryParams)
            }
            if (shouldSplitDanmakuCall && danmakuApiForRound && danmakuConfig) {
              danmakuSplitAttemptedForRound = true
              try {
                const splitLines = await requestWeChatDanmakuVarietyShow({
                  apiConfig: danmakuApiForRound,
                  character,
                  playerIdentity,
                  playerDisplayName: aiPlayerDisplayName,
                  transcript,
                  promptMode: pm,
                  useMemory: danmakuConfig.useMemory,
                  generateCount: danmakuConfig.generateCount,
                  customRulesPrompt: danmakuConfig.customPrompt,
                  longTermMemoryNotes: memoryRound.trim() || undefined,
                  longTermMemoryMomentImages:
                    memoryMomentImagesRound.length ? memoryMomentImagesRound : undefined,
                  worldBackgroundPrompt,
                  offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                  recentGroupChatsReference: recentGroupChatsReference || undefined,
                  unsummarizedPrivateNotes: unsPrivateRound.trim() || undefined,
                  unsummarizedGroupNotes: unsGroupRound.trim() || undefined,
                  chatMemberIds: loreSceneMemberIds,
                  globalWechatPlate: traceGlobalPlate,
                })
                if (splitLines.length > 0) queueMicrotask(() => enqueueDanmakuLines(splitLines))
                else logConsole('ai', '[danmaku] 副接口返回空弹幕（请检查弹幕模型输出格式）')
              } catch (err) {
                logger.log('error', `弹幕副接口调用失败: ${err instanceof Error ? err.message : String(err)}`)
              }
            }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : '未知错误'
          aiRequestFailed = true
          logger.log('error', `AI请求失败: ${msg}`)
          aiFailureCooldownUntilRef.current = Date.now() + 8000
          setFlushPending(0)
          aiCallingRef.current = false
          if (aiPipelineOwnerKeyRef.current?.trim() === flushConversationKey) {
            aiPipelineOwnerKeyRef.current = null
          }
          setConversationAwaitingAiKick(flushConversationKey, false)
          setTypingIfLive(false)
          syncAiReplyPipelineActive(flushConversationKey)
          const nowToast = Date.now()
          if (nowToast - aiLastErrorToastMsRef.current > 3000) {
            aiLastErrorToastMsRef.current = nowToast
            showComposerToast(`AI请求失败：${msg.slice(0, 120)}`)
          }
        }

        if (isFlushQueueStopped()) continue
        if (aiRequestFailed) continue

        let worldBookAfterUpdated = false
        let worldBookAfterAppliedPatchCount = 0
        const inlineWorldBookPatchAppliedByCharacterId = new Map<string, boolean>()
        try {
          if (!useLumiProjectAssistantPrompt && pm === 'persona') {
            if (roomType === 'group' && groupWorldBookPatches?.length) {
              const byCid = new Map<string, WorldBookAfterPatch[]>()
              for (const p of groupWorldBookPatches) {
                const pc = p.characterId?.trim()
                if (!pc) continue
                const arr = byCid.get(pc) ?? []
                arr.push(p)
                byCid.set(pc, arr)
              }
              for (const [targetId, plist] of byCid) {
                const row = await personaDb.getCharacter(targetId)
                if (!row) continue
                const snap = collectWorldBookAfterRevertSnapshot(row, plist)
                const next = applyWorldBookAfterPatchesToCharacter(row, plist)
                if (next) {
                  await personaDb.upsertCharacter(next)
                  worldBookAfterUpdated = true
                  worldBookAfterAppliedPatchCount += plist.length
                  inlineWorldBookPatchAppliedByCharacterId.set(targetId, true)
                  if (snap.length) pendingWorldBookRevertByCharRef.current.set(targetId.trim(), snap)
                }
              }
            } else if (roomType !== 'group' && aiReply.worldBookPatches?.length && character?.id) {
              const snap = collectWorldBookAfterRevertSnapshot(character, aiReply.worldBookPatches)
              const next = applyWorldBookAfterPatchesToCharacter(character, aiReply.worldBookPatches)
              if (next) {
                await personaDb.upsertCharacter(next)
                worldBookAfterUpdated = true
                worldBookAfterAppliedPatchCount = aiReply.worldBookPatches.length
                if (snap.length) {
                  pendingWorldBookRevertByCharRef.current.set(character.id.trim(), snap)
                }
              }
            }
          }
        } catch {
          /* 尾声延展世界书写库失败不阻断气泡展示 */
        }
        if (worldBookAfterUpdated) {
          window.dispatchEvent(
            new CustomEvent(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, {
              detail: { appliedPatchCount: Math.max(1, worldBookAfterAppliedPatchCount), source: 'model_inline' },
            }),
          )
        }

        if (!useLumiProjectAssistantPrompt && pm === 'persona') {
          void (async () => {
            try {
              if (roomType === 'group' && groupMultiOrderedItems?.length && groupId?.trim()) {
                const byCidText = new Map<string, string[]>()
                for (const item of groupMultiOrderedItems) {
                  if (item.kind !== 'bubble') continue
                  const cid = item.characterId.trim()
                  const t = item.text.trim()
                  if (!cid || !t) continue
                  const arr = byCidText.get(cid) ?? []
                  arr.push(t)
                  byCidText.set(cid, arr)
                }
                const gChat = await personaDb.getGroupChat(groupId.trim())
                for (const [cid, texts] of byCidText) {
                  const body = texts.join('\n')
                  const row = await personaDb.getCharacter(cid)
                  if (!row) continue
                  const displayName =
                    findGroupMember(gChat, cid)?.groupNickname?.trim() ||
                    row.name?.trim() ||
                    row.wechatNickname?.trim() ||
                    '群成员'
                  await finalizeWorldBookAfterPerAiRound({
                    apiConfig,
                    character: row,
                    latestRoundBody: body,
                    displayName,
                    inlinePatchApplied: inlineWorldBookPatchAppliedByCharacterId.get(cid) === true,
                  })
                }
              } else if (roomType === 'private' && character?.id?.trim()) {
                const latestBody = (aiReply.bubbles ?? [])
                  .map((b) => String(b ?? '').trim())
                  .filter(Boolean)
                  .join('\n')
                if (latestBody) {
                  const mainRow = await personaDb.getCharacter(character.id)
                  const displayName =
                    notifyPeerRound.trim() || peerNotifyTitle.trim() || '对方'
                  await finalizeWorldBookAfterPerAiRound({
                    apiConfig,
                    character: mainRow,
                    latestRoundBody: latestBody,
                    displayName,
                    inlinePatchApplied: worldBookAfterUpdated,
                  })
                }
              }
            } catch (epilogueErr) {
              console.warn('[wechat] per-round epilogue sync failed', epilogueErr)
            }
          })()
        }

        const hasGroupModelBubble = (groupMultiOrderedItems ?? []).some((x) => x.kind === 'bubble' && x.text.trim())
        const hasGroupModelMeta = (groupMultiOrderedItems ?? []).some((x) => x.kind === 'meta')
        if (
          roomType === 'group' &&
          groupId?.trim() &&
          groupMultiOrderedItems &&
          !hasGroupModelBubble &&
          !hasGroupModelMeta
        ) {
          showComposerToast('模型未返回有效内容（需 <<SPEAKER:角色ID>> 对白，或可选 <<GROUP_SET_…>> 改名指令）')
          continue
        }

        let forwardHistoryEmittedThisRound = false

        if (
          roomType === 'private' &&
          !lumiAssistantChat &&
          characterImageGenEnabled &&
          privatePeerReplyRetryParams &&
          (aiReply.bubbles?.length ?? 0) > 0
        ) {
          const initialBubbles = aiReply.bubbles ?? []
          const hasImageLine = initialBubbles.some((b) => parseCharacterImageGenLine(String(b).trim()))
          if (!hasImageLine && characterOutputClaimsSentImageWithoutLine(initialBubbles)) {
            try {
              logConsole('ai', '角色口头假发图且无 [图片] 行，触发补图重试')
              const retryReply = await requestWeChatPeerReplyBubbles({
                ...privatePeerReplyRetryParams,
                replyBias: [privatePeerReplyRetryParams.replyBias, buildCharacterImageFakeSendRetryBias()]
                  .filter(Boolean)
                  .join('\n\n'),
              })
              aiReply = {
                ...aiReply,
                bubbles: mergeCharacterImageRetryBubbles(initialBubbles, retryReply.bubbles ?? []),
              }
            } catch (err) {
              logConsole('ai', `角色配图补发重试失败：${String(err)}`)
            }
          }
        }

        const modelImageLineCount = countCharacterImageGenLinesInBubbles(aiReply.bubbles ?? [])
        if (
          modelImageLineCount > 0 &&
          roomType === 'private' &&
          !lumiAssistantChat &&
          characterImageGenEnabled
        ) {
          roundImageAllowed = true
          if (roundImageCountTarget < modelImageLineCount) {
            roundImageCountTarget = Math.max(modelImageLineCount, roundImageCountTarget, 1)
          }
        }

        let bubbles = aiReply.bubbles ?? []
        let orderedSegments: WeChatPeerReplyOrderedSegment[] = aiReply.orderedSegments?.length
          ? aiReply.orderedSegments.map((s) => ({ ...s }))
          : (() => {
              const segs: WeChatPeerReplyOrderedSegment[] = []
              if (aiReply.forwardHistory?.messages?.length) {
                segs.push({ kind: 'forward_history', forwardHistory: aiReply.forwardHistory })
              }
              for (const t of aiReply.bubbles ?? []) {
                const text = String(t ?? '').trim()
                if (text) segs.push({ kind: 'bubble', text })
              }
              return segs
            })()
        const rebuildOrderedSegmentsFromBubbles = (filtered: string[]) => {
          let i = 0
          orderedSegments = orderedSegments
            .map((seg) =>
              seg.kind === 'bubble' ? { kind: 'bubble' as const, text: filtered[i++] ?? '' } : seg,
            )
            .filter((seg) => seg.kind !== 'bubble' || seg.text.trim())
        }
        if (roomType !== 'group' && !lumiAssistantChat && characterImageGenEnabled) {
          const roundImageCountRange = parseStoredImageRoundCountRange(
            convMediaFreqRef.current.imageCountMin,
            convMediaFreqRef.current.imageCountMax,
          )
          const imageLineCap =
            typeof roundImageCountTarget === 'number' && roundImageCountTarget > 0
              ? Math.min(roundImageCountRange.max, roundImageCountTarget)
              : roundImageCountRange.max
          const limited = limitCharacterImageGenLinesFromBubbles(bubbles, imageLineCap)
          if (limited.length !== bubbles.length) {
            logConsole('ai', `本轮 [图片] 行超过张数上限 ${imageLineCap}，已截断`)
          }
          bubbles = limited
          rebuildOrderedSegmentsFromBubbles(bubbles)
        } else if (roomType !== 'group' && !lumiAssistantChat && !characterImageGenEnabled) {
          const stripped = stripCharacterImageGenLinesFromBubbles(bubbles)
          if (stripped.length !== bubbles.length) {
            logConsole('ai', '支持发图已关闭：已剔除本轮 [图片] 行（不展示占位）')
          }
          bubbles = stripped
          rebuildOrderedSegmentsFromBubbles(bubbles)
        }
        if (
          roomType !== 'group' &&
          !lumiAssistantChat &&
          pm === 'persona' &&
          character?.id?.trim()
        ) {
          const profileImageApplied = await stripAndApplyCharacterProfileImageActions({
            characterId: character.id,
            bubbles,
            userImage: roundUserImageForProfile,
          })
          bubbles = profileImageApplied.bubbles
          if (profileImageApplied.updated) {
            if (profileImageApplied.avatarChanged) {
              replaceWeChatPersonaContacts(
                [profileImageApplied.updated.id],
                [contactEntryFromCharacter(profileImageApplied.updated)],
              )
            }
            const profileImageToasts: string[] = []
            if (profileImageApplied.avatarChanged) profileImageToasts.push('已更新角色微信头像')
            if (profileImageApplied.coverChanged) profileImageToasts.push('已更新角色朋友圈背景')
            if (profileImageToasts.length) showComposerToast(profileImageToasts.join('，'))
          }
        }
        if (
          roomType !== 'group' &&
          !lumiAssistantChat &&
          pm === 'persona' &&
          character?.id?.trim() &&
          currentAccountId?.trim()
        ) {
          const profileUpdateFiltered = filterCharacterWechatProfileUpdateDirectives(bubbles)
          bubbles = profileUpdateFiltered.bubbles
          if (profileUpdateFiltered.directives.length) {
            const profileResult = await applyCharacterWechatProfileUpdateDirectives({
              characterId: character.id,
              directives: profileUpdateFiltered.directives,
              userRequestedSignatureUpdate: userRequestedWechatSignatureUpdate(
                [...transcript].reverse().find((t) => t.from === 'self')?.text,
              ),
            })
            if (profileResult.updated) {
              if (profileResult.nicknameChanged) {
                replaceWeChatPersonaContacts(
                  [profileResult.updated.id],
                  [contactEntryFromCharacter(profileResult.updated)],
                )
              }
              const profileToasts: string[] = []
              if (profileResult.nicknameChanged) profileToasts.push('已更新微信昵称')
              if (profileResult.signatureChanged) profileToasts.push('已更新个性签名')
              if (profileToasts.length) showComposerToast(profileToasts.join('，'))
            }
          }
          const pinFiltered = filterCharacterMomentPinDirectives(bubbles)
          bubbles = pinFiltered.bubbles
          if (pinFiltered.directives.length) {
            const pinResult = await applyCharacterMomentPinDirectives({
              accountId: currentAccountId,
              characterId: character.id,
              directives: pinFiltered.directives,
            })
            for (const pinned of pinResult.pinned) {
              showComposerToast(pinned ? '已置顶朋友圈' : '已取消置顶')
            }
          }
          const publishFiltered = filterCharacterMomentPublishDirectives(bubbles)
          bubbles = publishFiltered.bubbles
          if (publishFiltered.directives.length) {
            const publishResult = await applyCharacterMomentPublishDirectives({
              accountId: currentAccountId,
              characterId: character.id,
              playerIdentityId: fxPlayerIdentityId,
              playerDisplayName,
              apiConfig,
              directives: publishFiltered.directives,
            })
            for (const pinned of publishResult.pinned) {
              showComposerToast(pinned ? '已发布朋友圈（已置顶）' : '已发布朋友圈')
            }
          }
          let mergedSongShareBubbles = [...bubbles]
          for (let i = 0; i < mergedSongShareBubbles.length; i += 1) {
            const merged = mergeCharacterMomentSongShareDirectiveLines(
              mergedSongShareBubbles[i]!,
              mergedSongShareBubbles[i + 1] != null
                ? String(mergedSongShareBubbles[i + 1] ?? '')
                : undefined,
            )
            if (merged !== mergedSongShareBubbles[i]) {
              mergedSongShareBubbles[i] = merged
              mergedSongShareBubbles.splice(i + 1, 1)
            }
          }
          const songShareFiltered = filterCharacterMomentSongShareDirectives(mergedSongShareBubbles)
          bubbles = songShareFiltered.bubbles
          if (songShareFiltered.directives.length) {
            const songShareResult = await applyCharacterMomentSongShareDirectives({
              accountId: currentAccountId,
              characterId: character.id,
              playerIdentityId: fxPlayerIdentityId,
              playerDisplayName,
              apiConfig,
              directives: songShareFiltered.directives,
            })
            if (songShareResult.published > 0) {
              showComposerToast('已分享歌曲到朋友圈')
            }
          }
        }
        const bubbleExtraction = extractDanmakuFromBubbleText(bubbles)
        bubbles = expandMultilineReplyBubbles(bubbleExtraction.cleaned)
        {
          const pulseStripped = stripPulseCommentDirectivesFromBubbles(bubbles)
          bubbles = pulseStripped.bubbles
          if (pulseStripped.directives.length && roomType !== 'group') {
            for (const directive of pulseStripped.directives) {
              void applyPulseCommentDirective(directive, {
                characterId: persistCharacterId,
                characterName: notifyPeerRound.trim() || peerNotifyTitle.trim() || 'TA',
                characterAvatarUrl: peerAvatarResolved,
              }).catch(() => {
                /* ignore */
              })
            }
            logConsole(
              'ai',
              `[pulse] 已解析同轮微博评论指令 ×${pulseStripped.directives.length}`,
            )
          }
          const pulseFollowStripped = stripPulseFollowDirectivesFromBubbles(bubbles)
          bubbles = pulseFollowStripped.bubbles
          if (pulseFollowStripped.directives.length && roomType !== 'group') {
            for (const directive of pulseFollowStripped.directives) {
              void applyPulseFollowDirective(directive, {
                characterId: persistCharacterId,
                characterName: notifyPeerRound.trim() || peerNotifyTitle.trim() || 'TA',
                characterAvatarUrl: peerAvatarResolved,
                playerIdentityId: fxPlayerIdentityId,
                playerDisplayName: playerDisplayName.trim() || state.profile.displayName.trim() || '用户',
                playerAvatarUrl: playerAvatarResolved || undefined,
              }).catch(() => {
                /* ignore */
              })
            }
            logConsole(
              'ai',
              `[pulse] 已解析同轮微博关注指令 ×${pulseFollowStripped.directives.length}`,
            )
          }
          {
            const pulseDmShotStripped = stripPulseDmScreenshotDirectivesFromBubbles(bubbles)
            if (pulseDmScreenshotEnabled === true && roomType !== 'group') {
              bubbles = pulseDmShotStripped.bubbles
              if (pulseDmShotStripped.pending.length) {
                await preparePulseDmScreenshotPlaceholders(pulseDmShotStripped.pending)
                logConsole(
                  'ai',
                  `[pulse] 已解析同轮微博私信截图 ×${pulseDmShotStripped.pending.length}`,
                )
              }
            } else {
              // 开关关闭时剥离块且丢弃占位行，避免原文泄漏到气泡
              bubbles = pulseDmShotStripped.bubbles.filter(
                (ln) => !parsePulseDmScreenshotPlaceholderId(ln),
              )
            }
          }
        }
        let pendingMusicSyncInvitesThisRound: PendingCharacterMusicSyncInvite[] = []
        let pendingMusicSyncSeeksThisRound: PendingCharacterMusicSyncSeek[] = []
        let pendingMusicSyncPlaysThisRound: PendingCharacterMusicSyncPlay[] = []
        let pendingCharacterMiniGameInvitesThisRound: PendingCharacterMiniGameInvite[] = []
        if (roomType !== 'group' && !lumiAssistantChat && pm === 'persona') {
          const musicPre = await preprocessCharacterMusicSyncBubblesForChat({
            bubbles,
            ctx: buildCharacterMusicSyncSessionContext(),
            onInviteResolved: (invite) => {
              const enriched = invite.trackId > 0 ? '已匹配网易云曲目' : '未匹配曲目 id，按指令展示卡片'
              logConsole(
                'ai',
                `[music_sync] 共听邀约卡就绪：《${invite.trackTitle}》— ${invite.trackArtist || '未知歌手'}（trackId=${invite.trackId}；${enriched}）`,
              )
            },
            onInviteFailed: ({ title, artist }) => {
              const label = [title, artist].filter(Boolean).join(' · ') || '未指定歌名/歌手'
              logConsole('ai', `[music_sync] MUSIC_SYNC_INVITE 缺少歌名/歌手，未生成邀约卡：${label}`)
            },
            onSeekPlanned: (seek) => {
              const sec = (seek.timeMs / 1000).toFixed(1)
              const hint = seek.lyricHint ? `；${seek.lyricHint}` : ''
              logConsole(
                'ai',
                `[music_sync] 计划在第 ${seek.insertAfterBubbleStep} 条气泡后拉进度：${sec}s${hint}`,
              )
            },
            onPlayPlanned: (play) => {
              const label = [play.directive.title, play.directive.artist].filter(Boolean).join(' · ') || '当前曲'
              logConsole(
                'ai',
                `[music_sync] 计划在第 ${play.insertAfterBubbleStep} 条气泡后点播：《${label}》`,
              )
            },
            onPlayConvertedToInvite: (play) => {
              const label = [play.title, play.artist].filter(Boolean).join(' · ') || '指定曲目'
              logConsole(
                'ai',
                `[music_sync] 未处于共听会话，MUSIC_PLAY 已转为 MUSIC_SYNC_INVITE：《${label}》`,
              )
            },
          })
          bubbles = musicPre.bubbles
          rebuildOrderedSegmentsFromBubbles(bubbles)
          const postMusicImageLineCount = countCharacterImageGenLinesInBubbles(bubbles)
          if (
            postMusicImageLineCount > 0 &&
            roomType === 'private' &&
            !lumiAssistantChat &&
            characterImageGenEnabled
          ) {
            roundImageAllowed = true
            roundImageCountTarget = Math.max(postMusicImageLineCount, roundImageCountTarget, 1)
          }
          if (modelImageLineCount > 0 && postMusicImageLineCount === 0) {
            logConsole(
              'ai',
              `[imagegen] 警告：模型曾输出 ${modelImageLineCount} 条 [图片] 行，但 music/预处理 后已丢失`,
            )
          } else if (postMusicImageLineCount > 0) {
            logConsole(
              'ai',
              `[imagegen] 预处理完成，待展示配图占位 [图片] 行数=${postMusicImageLineCount}`,
            )
          }
          pendingMusicSyncInvitesThisRound = musicPre.pendingInvites
          pendingMusicSyncSeeksThisRound = musicPre.pendingSeeks
          pendingMusicSyncPlaysThisRound = musicPre.pendingPlays
          if (musicPre.bubbles.length !== (aiReply.bubbles ?? []).length) {
            logConsole(
              'ai',
              `[music_sync] 预处理后可见气泡(count=${musicPre.bubbles.length}): ${musicPre.bubbles.map((b, i) => `${i + 1}. ${b}`).join(' | ')}`,
            )
          }
          if (musicPre.pendingInvites.length) {
            for (const p of musicPre.pendingInvites) {
              logConsole(
                'ai',
                `[music_sync] 计划在第 ${p.insertAfterBubbleStep} 条气泡后插入共听卡：《${p.invite.trackTitle}》`,
              )
            }
          } else if (
            (aiReply.bubbles ?? []).some((b) =>
              /\[MUSIC_SYNC_INVITE\]/i.test(String(b ?? '')),
            )
          ) {
            logConsole(
              'ai',
              '[music_sync] 模型输出了 MUSIC_SYNC_INVITE 但未能生成邀约卡（请检查指令是否含 title/artist 或 trackId）',
            )
          }
          if (
            !musicPre.pendingSeeks.length &&
            (aiReply.bubbles ?? []).some((b) => /\[MUSIC_SEEK\]/i.test(String(b ?? '')))
          ) {
            logConsole(
              'ai',
              '[music_sync] MUSIC_SEEK 未能解析进度（需 lyric/time/timeMs，且须正在与该角色一起听）',
            )
          }
        }
        if (roomType !== 'group' && !lumiAssistantChat && pm === 'persona') {
          const miniGamePre = preprocessCharacterMiniGameInviteBubblesForChat({ bubbles })
          bubbles = miniGamePre.bubbles
          rebuildOrderedSegmentsFromBubbles(bubbles)
          pendingCharacterMiniGameInvitesThisRound = miniGamePre.pendingInvites
          if (miniGamePre.pendingInvites.length) {
            for (const p of miniGamePre.pendingInvites) {
              logConsole(
                'ai',
                `[mini_game] 计划在第 ${p.insertAfterBubbleStep} 条气泡后插入游戏邀约卡：《${p.invite.gameTitle}》`,
              )
            }
          } else if ((aiReply.bubbles ?? []).some((b) => /\[MINI_GAME_INVITE\]/i.test(String(b ?? '')))) {
            logConsole('ai', '[mini_game] 模型输出了 MINI_GAME_INVITE 但未能生成邀约卡（请检查 gameType）')
          }
        }
        const danmakuLinesCollected = [
          ...(aiReply.danmakuLines ?? []).map((s) => String(s ?? '').trim()).filter(Boolean),
          ...bubbleExtraction.danmakuLines,
        ].filter(Boolean)
        const busyCandidate = [bubbles?.[0] ?? '', bubbles?.[1] ?? '', bubbles?.[2] ?? ''].join('')
        const busyDirective = parseBusyDirective(busyCandidate.trim())
        // 思维链仅用于模型内部推演，不在聊天室落库/展示。
        const thinking = undefined
        if (busyDirective && !suppressBusyDirectiveThisRound && roomType !== 'group') {
          const nowTs = getCurrentTimeMs()
          const end = nowTs + busyDirective.duration * 60 * 1000
          await personaDb.putCharacterBusySettings({
            characterId: persistCharacterId,
            isBusy: true,
            busyReason: busyDirective.reason,
            busyStartTime: nowTs,
            busyEndTime: end,
            busyDurationMinutes: busyDirective.duration,
          })
          try {
            const convSettings = await personaDb.getChatConversationSettings(conversationKey)
            if (
              convSettings?.proactiveMessageEnabled &&
              isProactiveVariableIntervalEnabled(convSettings) &&
              hasProactiveMessageScheduleSaved(convSettings)
            ) {
              await personaDb.upsertChatConversationSettings({
                conversationKey: revealConvKey,
                peerCharacterId: convSettings.peerCharacterId,
                playerIdentityId: convSettings.playerIdentityId,
                proactiveMessageNextIntervalSeconds: drawProactiveVariableIntervalSeconds(true, convSettings),
                proactiveMessageLastFiredAtMs: nowTs,
              })
            }
          } catch {
            /* ignore */
          }
          showCenterToast(buildBusyToastText(peerNotifyTitle || '对方', busyDirective.reason, end, nowTs))
          continue
        }

        const traceGroupLines =
          roomType === 'group' && groupMultiOrderedItems
            ? groupMultiOrderedItems
                .filter((x) => x.kind === 'bubble')
                .map((x) => String(x.text ?? '').trim())
                .filter(Boolean)
            : []
        if (roomType !== 'group' && pm === 'persona' && cid?.trim() && !useLumiProjectAssistantPrompt) {
          void publishWeChatPrivatePersonaMemoryTrace({
            character,
            charDisplayName: character?.name?.trim() || notifyPeerRound,
            transcript,
            biasText: traceReplyBias,
            worldBackgroundPrompt: worldBackgroundPrompt ?? '',
            offlineDatingPlotsContext: offlineDatingPlotsContext || '',
            unsPrivateNotes: unsPrivateRound,
            crossAccountPrivateRaw: traceCrossAccountPrivate,
            currentLinePrivateRaw: traceCurrentLinePrivate,
            wechatAccountId: currentAccountId,
            sessionPlayerIdentityId: playerIdentityId,
            unsGroupNotes: unsGroupRound,
            unsMeetNotes: unsMeetRound,
            recentPrivateAiRoundsNotes: recentPrivateAiRoundsRound,
            recentOfflineAiRoundsNotes: recentOfflineAiRoundsRound,
            recentMeetAiRoundsNotes: recentMeetAiRoundsRound,
            storyTimelineNotes: storyTimelineRound,
            dedupePrivateRecentOmitted: dedupePrivateRecentOmittedRound,
            dedupeOfflineRecentOmitted: dedupeOfflineRecentOmittedRound,
            dedupeMeetRecentOmitted: dedupeMeetRecentOmittedRound,
            conversationKey: revealConvKey,
            recentGroupChatsReference,
            chatMemberIds: loreSceneMemberIds,
            globalWechatPlate: traceGlobalPlate,
            apiConfig,
            replyBubbles: bubbles,
            worldBookPatches: aiReply.worldBookPatches,
            worldBookAfterApplied: worldBookAfterUpdated,
          }).catch(() => {})
        }
        if (roomType === 'group' && pm === 'persona' && groupTraceSnapshot) {
          void publishWeChatGroupMemoryTrace({
            groupName: groupTraceSnapshot.groupName,
            transcript,
            biasText: traceReplyBias,
            primaryNpcCharacterId: groupTraceSnapshot.allowedCharIds[0] || '',
            primaryNpcDisplayName: groupTraceSnapshot.primaryNickname,
            worldBackgroundFirst: groupTraceSnapshot.firstNpcWorldBg,
            offlinePlotsCombined: groupTraceSnapshot.offlineCombined,
            groupUnsummarizedNotes: groupTraceSnapshot.groupUnsummarized,
            wbGroupCharIds: groupTraceSnapshot.allowedCharIds,
            apiConfig,
            replyBubbles: traceGroupLines,
            groupChatAfterInjectedRaw: traceGroupChatAfterSection,
            patchRulesIncluded: traceGroupChatAfterPatchRules,
            worldBookPatches: groupWorldBookPatches,
            worldBookAfterApplied: worldBookAfterUpdated,
          }).catch(() => {})
        }

        const dedupeBubbleLines = (arr: string[]) =>
          (arr ?? [])
            .map((s) => String(s ?? '').trim())
            .filter(Boolean)
            .filter((s) => !/^\[BUSY\]/i.test(s) && !/^["'“”‘’]\s*,?\s*"duration"\s*:/i.test(s))
            .filter((s) => !isCharacterMusicSyncDirectiveArtifactLine(s) && !isMusicSyncDirectiveArtifactLine(s))
            .reduce<string[]>((acc, cur) => {
              const prev = acc.length ? acc[acc.length - 1] : ''
              if (prev && prev === cur) return acc
              acc.push(cur)
              return acc
            }, [])

        let bubbleRuns: Array<
          | { kind: 'meta'; action: WeChatGroupMetaAction }
          | { kind: 'messages'; characterId: string; notifyTitle: string; bubbles: string[] }
          | {
              kind: 'forward_history'
              characterId: string
              notifyTitle: string
              payload: WeChatChatHistoryPayload
            }
        > = []
        if (roomType === 'group' && groupId?.trim() && groupMultiOrderedItems?.length) {
          for (const it of groupMultiOrderedItems) {
            if (it.kind === 'meta') {
              bubbleRuns.push({ kind: 'meta', action: it.action })
              continue
            }
            const bubs = dedupeBubbleLines([it.text])
            if (!bubs.length) continue
            const cidRun = it.characterId.trim()
            bubbleRuns.push({
              kind: 'messages',
              characterId: cidRun,
              notifyTitle:
                cidRun === WECHAT_GROUP_BOT_CHARACTER_ID
                  ? '群管家'
                  : findGroupMember(groupDocRef.current, cidRun)?.groupNickname || '群成员',
              bubbles: bubs,
            })
          }
        } else {
          let b = [...bubbles]
          if (busyDirective && suppressBusyDirectiveThisRound) {
            b = ['我回来了，刚刚忙完。']
          }
          b = dedupeBubbleLines(b)
          rebuildOrderedSegmentsFromBubbles(b)
          bubbles = orderedSegments
            .filter(
              (s): s is Extract<WeChatPeerReplyOrderedSegment, { kind: 'bubble' }> => s.kind === 'bubble',
            )
            .map((s) => s.text)
          let pendingBatch: string[] = []
          const flushBatch = () => {
            if (!pendingBatch.length) return
            bubbleRuns.push({
              kind: 'messages',
              characterId: persistCharacterId,
              notifyTitle: notifyPeerRound,
              bubbles: [...pendingBatch],
            })
            pendingBatch = []
          }
          for (const seg of orderedSegments) {
            if (seg.kind === 'forward_history') {
              flushBatch()
              bubbleRuns.push({
                kind: 'forward_history',
                characterId: persistCharacterId,
                notifyTitle: notifyPeerRound,
                payload: seg.forwardHistory,
              })
            } else if (seg.text.trim()) {
              pendingBatch.push(seg.text.trim())
            }
          }
          flushBatch()
        }

        if (!bubbleRuns.length) continue

        bubbleRunLoop: for (const br of bubbleRuns) {
          if (br.kind === 'meta') {
            if (groupId?.trim()) {
              await applyWeChatGroupMetaFromModel({
                groupId: groupId.trim(),
                playerIdentityId: fxPlayerIdentityId,
                action: br.action,
                onGroupUpdated: (g) => {
                  groupDocRef.current = g
                  setGroupLive(g)
                },
              })
            }
            if (isFlushQueueStopped()) break bubbleRunLoop
            continue
          }
          if (br.kind === 'forward_history') {
            if (isFlushQueueStopped()) break bubbleRunLoop
            persistCharacterId = br.characterId
            notifyPeerRound = br.notifyTitle
            if (!forwardHistoryEmittedThisRound && br.payload?.messages?.length) {
              forwardHistoryEmittedThisRound = true
              const historyPayload = await enrichCharacterForwardHistoryPayload(
                br.payload,
                persistCharacterId,
                personaContactsList,
                { anchorMs: getCurrentTimeMs() },
              )
              const ts = getCurrentTimeMs()
              const historyId = `wxm-${ts}-fhist-${Math.random().toString(36).slice(2, 8)}`
              const historyRow: WeChatChatMessage = {
                id: historyId,
                characterId: persistCharacterId,
                playerIdentityId: fxPlayerIdentityId,
                type: 'character',
                content: '[聊天记录]',
                chatHistory: historyPayload,
                timestamp: ts,
                isRead: true,
                conversationKey: revealConvKey,
              }
              const mappedHistory = mapWeChatMessagesToChatItems([historyRow])[0]
              if (mappedHistory) {
                setTypingVisible(false)
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: { ...mappedHistory, otherAnimated: true },
                    persist: () => {
                      void personaDb.appendWeChatChatMessage(historyRow).catch(() => {})
                    },
                  },
                ])
              } else {
                void personaDb.appendWeChatChatMessage(historyRow).catch(() => {})
              }
            }
            continue
          }
          persistCharacterId = br.characterId
          notifyPeerRound = br.notifyTitle
          let bubbles = [...br.bubbles]
          if (isFlushQueueStopped()) break bubbleRunLoop

        let pendingCharacterMusicSyncInvites = pendingMusicSyncInvitesThisRound
        let pendingCharacterMusicSyncSeeks = pendingMusicSyncSeeksThisRound
        let pendingCharacterMusicSyncPlays = pendingMusicSyncPlaysThisRound
        let pendingCharacterMiniGameInvites = pendingCharacterMiniGameInvitesThisRound
        const flushedCharacterMusicSyncInviteIdx = new Set<number>()
        const flushedCharacterMusicSyncSeekIdx = new Set<number>()
        const flushedCharacterMusicSyncPlayIdx = new Set<number>()
        const flushedCharacterMiniGameInviteIdx = new Set<number>()
        let bubbleRevealStepCount = 0
        const flushCharacterMusicSyncPlayAt = (pending: PendingCharacterMusicSyncPlay, idx: number) => {
          if (flushedCharacterMusicSyncPlayIdx.has(idx)) return
          flushedCharacterMusicSyncPlayIdx.add(idx)
          void applyCharacterMusicSyncDirective(pending.directive, buildCharacterMusicSyncSessionContext()).then(
            (result) => {
              const label = [pending.directive.title, pending.directive.artist].filter(Boolean).join(' · ')
              logConsole(
                'ai',
                `[music_sync] 共听点播${result.playedTrack ? '成功' : '失败'}：${label || '指定曲目'}`,
              )
            },
          )
        }
        const flushCharacterMusicSyncPlaysThroughStep = (step: number) => {
          for (let pi = 0; pi < pendingCharacterMusicSyncPlays.length; pi += 1) {
            const pending = pendingCharacterMusicSyncPlays[pi]!
            if (pending.insertAfterBubbleStep !== step) continue
            flushCharacterMusicSyncPlayAt(pending, pi)
          }
        }
        const flushRemainingCharacterMusicSyncPlays = () => {
          for (let pi = 0; pi < pendingCharacterMusicSyncPlays.length; pi += 1) {
            flushCharacterMusicSyncPlayAt(pendingCharacterMusicSyncPlays[pi]!, pi)
          }
        }
        const flushCharacterMusicSyncSeekAt = (pending: PendingCharacterMusicSyncSeek, idx: number) => {
          if (flushedCharacterMusicSyncSeekIdx.has(idx)) return
          flushedCharacterMusicSyncSeekIdx.add(idx)
          const ok = applyCharacterMusicSeek(pending.timeMs)
          const sec = (pending.timeMs / 1000).toFixed(1)
          const hint = pending.lyricHint ? `（${pending.lyricHint}）` : ''
          logConsole(
            'ai',
            `[music_sync] 共听拉进度${ok ? '成功' : '失败'}：${sec}s${hint}`,
          )
        }
        const flushCharacterMusicSyncSeeksThroughStep = (step: number) => {
          for (let si = 0; si < pendingCharacterMusicSyncSeeks.length; si += 1) {
            const pending = pendingCharacterMusicSyncSeeks[si]!
            if (pending.insertAfterBubbleStep !== step) continue
            flushCharacterMusicSyncSeekAt(pending, si)
          }
        }
        const flushRemainingCharacterMusicSyncSeeks = () => {
          for (let si = 0; si < pendingCharacterMusicSyncSeeks.length; si += 1) {
            flushCharacterMusicSyncSeekAt(pendingCharacterMusicSyncSeeks[si]!, si)
          }
        }
        const enqueueCharacterMusicSyncInviteAt = (pending: PendingCharacterMusicSyncInvite, idx: number) => {
          if (flushedCharacterMusicSyncInviteIdx.has(idx)) return
          flushedCharacterMusicSyncInviteIdx.add(idx)
          const replyText =
            pending.replyText?.trim() ||
            (() => {
              const order = emittedMessageOrderThisRound
              for (let oi = order.length - 1; oi >= 0; oi -= 1) {
                const mid = order[oi]!
                const meta = emittedMessageMetaThisRound.get(mid)
                if (meta?.preview?.trim()) return meta.preview.trim()
              }
              return ''
            })()
          logConsole(
            'ai',
            `[music_sync] 共听邀约卡入队：《${pending.invite.trackTitle}》— ${pending.invite.trackArtist || '未知歌手'}（id=${pending.invite.trackId}）`,
          )
          logConsole(
            'frontend',
            `角色共听邀约卡入队：《${pending.invite.trackTitle}》— ${pending.invite.trackArtist || '未知歌手'}（id=${pending.invite.trackId}）`,
          )
          enqueueOpponentMessagesSequential([
            createCharacterMusicSyncInviteRevealJob(pending.invite, replyText, persistCharacterId),
          ])
        }
        const flushCharacterMusicSyncInvitesThroughStep = (step: number) => {
          for (let pi = 0; pi < pendingCharacterMusicSyncInvites.length; pi += 1) {
            const pending = pendingCharacterMusicSyncInvites[pi]!
            if (pending.insertAfterBubbleStep !== step) continue
            enqueueCharacterMusicSyncInviteAt(pending, pi)
          }
        }
        const flushRemainingCharacterMusicSyncInvites = () => {
          for (let pi = 0; pi < pendingCharacterMusicSyncInvites.length; pi += 1) {
            enqueueCharacterMusicSyncInviteAt(pendingCharacterMusicSyncInvites[pi]!, pi)
          }
        }
        const enqueueCharacterMiniGameInviteAt = (pending: PendingCharacterMiniGameInvite, idx: number) => {
          if (flushedCharacterMiniGameInviteIdx.has(idx)) return
          flushedCharacterMiniGameInviteIdx.add(idx)
          const replyText =
            pending.replyText?.trim() ||
            (() => {
              const order = emittedMessageOrderThisRound
              for (let oi = order.length - 1; oi >= 0; oi -= 1) {
                const mid = order[oi]!
                const meta = emittedMessageMetaThisRound.get(mid)
                if (meta?.preview?.trim()) return meta.preview.trim()
              }
              return ''
            })()
          const invite = pending.invite
          const msgId = `wxm-${getCurrentTimeMs()}-cgi-${Math.random().toString(36).slice(2, 8)}`
          logConsole(
            'ai',
            `[mini_game] 游戏邀约卡入队：《${invite.gameTitle}》（inviteId=${invite.inviteId}）`,
          )
          enqueueOpponentMessagesSequential([
            createCharacterMiniGameInviteRevealJob(invite, replyText, persistCharacterId, msgId),
          ])
          if (invite.gameType === 'gomoku') {
            void (async () => {
              try {
                const enriched = await ensureGomokuSessionOnInvitePayload(invite, {
                  api: apiConfig,
                  characterId: persistCharacterId,
                  conversationKey: revealConvKey,
                  peerDisplayName: notifyPeerRound,
                  lineScope: normalizeMemoryPromptLineScope(currentAccountId, playerIdentityId),
                })
                if (!enriched.gomokuSession) return
                if (JSON.stringify(enriched.gomokuSession) === JSON.stringify(invite.gomokuSession)) return
                if (conversationKeyLiveRef.current.trim() !== flushConversationKey) return
                setItems((prev) => {
                  const next = rebuildWithCurrentTime(
                    extractMessages(prev).map((msg) =>
                      msg.id === msgId ? { ...msg, miniGameInvite: enriched } : msg,
                    ),
                  )
                  itemsRef.current = next
                  return next
                })
                await personaDb.patchWeChatChatMessageById(msgId, { miniGameInvite: enriched })
              } catch {
                /* ignore pregen failure */
              }
            })()
          }
        }
        const flushCharacterMiniGameInvitesThroughStep = (step: number) => {
          for (let pi = 0; pi < pendingCharacterMiniGameInvites.length; pi += 1) {
            const pending = pendingCharacterMiniGameInvites[pi]!
            if (pending.insertAfterBubbleStep !== step) continue
            enqueueCharacterMiniGameInviteAt(pending, pi)
          }
        }
        const flushRemainingCharacterMiniGameInvites = () => {
          for (let pi = 0; pi < pendingCharacterMiniGameInvites.length; pi += 1) {
            enqueueCharacterMiniGameInviteAt(pendingCharacterMiniGameInvites[pi]!, pi)
          }
        }

        let pendingReplyMessageId: string | undefined
        let thinkingAttached = false
        let musicSyncDirectiveHandledThisRound = false
        let miniGameDirectiveHandledThisRound = false
        const characterPlainTextsThisRound: string[] = [] // 同轮已发出气泡正文（含文字与语音转写）
        const emittedThisRound = new Set<string>()
        const emittedMessageIdsThisRound = new Set<string>()
        const roundStickerAllowed =
          roomType !== 'group' ? rollRoundMediaTriggerAllowed(convMediaFreqRef.current.sticker) : true
        const roundVoiceAllowed =
          roomType !== 'group' ? rollRoundMediaTriggerAllowed(convMediaFreqRef.current.voice) : true
        const roundClassicEmojiAllowed =
          roomType !== 'group'
            ? rollClassicEmojiRoundTriggerAllowed(convMediaFreqRef.current.classicEmoji)
            : true
        let roundImagesEmittedCount = 0
        const recentCharacterStickerRefs = collectRecentCharacterStickerRefsFromTranscript(
          itemsToTranscript(buildChatItemsForAiTranscript(), transcriptSpeakerOpts),
        )
        const emittedMessageOrderThisRound: string[] = []
        const emittedMessageMetaThisRound = new Map<string, { timestamp: number; preview: string }>()
        const markEmittedThisRound = (id: string, timestamp: number, preview: string): number => {
          emittedMessageIdsThisRound.add(id)
          emittedMessageOrderThisRound.push(id)
          emittedMessageMetaThisRound.set(id, { timestamp, preview })
          bubbleRevealStepCount += 1
          return bubbleRevealStepCount
        }
        const retargetRevealJobForCharacterRecall = (
          j: OpponentRevealJob,
          messageId: string,
          recalledAt: number,
          original: string,
        ) => {
          if (j.msg.id !== messageId) return
          j.msg = {
            ...j.msg,
            text: '',
            isRecalled: true,
            recalledBy: 'other',
            recallTimestamp: recalledAt,
            originalText: original,
          }
          const origPersist = j.persist
          j.persist = () => {
            void (async () => {
              try {
                const existing = await personaDb.getWeChatChatMessageById(messageId)
                if (!existing) {
                  origPersist()
                }
                await personaDb.patchWeChatChatMessageById(messageId, {
                  content: '',
                  isRecalled: true,
                  recalledBy: 'character',
                  recallTimestamp: recalledAt,
                  originalContent: original,
                })
              } catch (e) {
                logger.log(
                  'error',
                  `角色撤回落库失败 id=${messageId} err=${e instanceof Error ? e.message : String(e)}`,
                )
              }
            })()
          }
        }
        const applyCharacterRecallToRevealQueues = (
          messageId: string,
          recalledAt: number,
          original: string,
        ) => {
          for (const j of deferredBubbleRevealJobsRef.current) {
            retargetRevealJobForCharacterRecall(j, messageId, recalledAt, original)
          }
          for (const j of opponentRevealJobsRef.current) {
            retargetRevealJobForCharacterRecall(j, messageId, recalledAt, original)
          }
        }
        const withMusicSyncFlushOnBubbleRevealed = (step: number, existing?: () => void) => () => {
          existing?.()
          flushCharacterMusicSyncInvitesThroughStep(step)
          flushCharacterMusicSyncSeeksThroughStep(step)
          flushCharacterMusicSyncPlaysThroughStep(step)
          flushCharacterMiniGameInvitesThroughStep(step)
        }
        const enqueueMusicSyncRoundCompletionJob = () => {
          enqueueOpponentMessagesSequential([
            {
              forConversationKey: revealConvKey,
              msg: {
                id: `wxm-${getCurrentTimeMs()}-music-sync-tail`,
                kind: 'msg',
                from: 'other',
                text: '',
                timestamp: getCurrentTimeMs(),
              },
              persist: () => {},
              revealCallbackOnly: true,
              revealCallbackDelayMs: 0,
              afterReveal: () => {
                flushRemainingCharacterMusicSyncInvites()
                flushRemainingCharacterMusicSyncSeeks()
                flushRemainingCharacterMusicSyncPlays()
                flushRemainingCharacterMiniGameInvites()
              },
            },
          ])
        }
        /** 群助手 botViolation 禁言：落库前再判一次，避免同轮模型仍分配该角色台词 */
        const skipBubbleForGroupMute = async (): Promise<boolean> => {
          if (roomType !== 'group' || !groupId?.trim()) return false
          const cid = persistCharacterId.trim()
          if (!cid || cid === WECHAT_GROUP_BOT_CHARACTER_ID) return false
          const gid = groupId.trim()
          let g0 = (await personaDb.getGroupChat(gid)) ?? groupDocRef.current
          if (!g0) return false
          const nowMs = getCurrentTimeMs()
          const pruned = pruneExpiredBotMutesOnGroup(g0, nowMs)
          if (pruned !== g0) {
            try {
              await personaDb.putGroupChat(pruned)
            } catch {
              /* ignore */
            }
            groupDocRef.current = pruned
            setGroupLive(pruned)
            g0 = pruned
          }
          const mem = findGroupMember(g0, cid)
          return !!(mem && groupMemberSpeechBlockedInGroup(mem, nowMs))
        }
        /**
         * 禁言时系统灰条：全员可见同一文案；`shieldedMessageContent` 存原文供群主/管理员点「查看」。
         * 仅构造数据，由统一批量 `setItems` 与 microtask 落库。
         */
        const buildMuteSuppressStripPiece = async (
          hiddenPlain?: string | null,
        ): Promise<{ row: WeChatChatMessage; ui: ChatMsg } | null> => {
          if (roomType !== 'group' || !groupId?.trim()) return null
          const gid = groupId.trim()
          let g0: GroupChatRow | null = null
          try {
            g0 = (await personaDb.getGroupChat(gid)) ?? groupDocRef.current
          } catch {
            g0 = groupDocRef.current
          }
          if (!g0) return null
          const mem = findGroupMember(g0, persistCharacterId)
          const nick = groupNoticeMemberNickname(mem)
          const ts = getCurrentTimeMs()
          const id = `wxm-${ts}-gmute-${Math.random().toString(36).slice(2, 8)}`
          const clipped = String(hiddenPlain ?? '').trim().slice(0, 8000)
          const row: WeChatChatMessage = {
            id,
            characterId: WECHAT_GROUP_BOT_CHARACTER_ID,
            playerIdentityId: fxPlayerIdentityId,
            type: 'character',
            content: `${nick}因被禁言已自动隐藏这条消息`,
            ext: {
              centerSystemStrip: true,
              muteSuppressStrip: true,
              ...(clipped ? { shieldedMessageContent: clipped } : {}),
            },
            timestamp: ts,
            isRead: true,
            conversationKey: revealConvKey,
            quiet: true,
          }
          const mappedRows = mapWeChatMessagesToChatItems([row])
          const ui = mappedRows[0]
          if (!ui) return null
          return { row, ui }
        }
        const mergeItemsWithGroupModerationFilter = (prev: ChatItem[], incoming: ChatMsg): ChatItem[] =>
          filterGroupChatItemsHideModeratorOnlyBubbles(
            mergeIncomingMessage(prev, incoming),
            roomType,
            groupDocRef.current ?? groupLive,
          )

        const appendMuteSuppressSystemStrip = async (hiddenPlain: string) => {
          const piece = await buildMuteSuppressStripPiece(hiddenPlain)
          if (!piece) return
          try {
            await personaDb.appendWeChatChatMessage(piece.row)
          } catch {
            /* ignore */
          }
          if (conversationKeyLiveRef.current.trim() !== flushConversationKey) return
          setItems((prev) => {
            const next = mergeItemsWithGroupModerationFilter(prev, piece.ui)
            itemsRef.current = next
            return next
          })
        }

        /** 纯文本多气泡：一次进列表；引用元数据在此 await；落库 microtask（禁言或群机器人规则命中则走逐行分支） */
        {
          const flatForBatch = flattenBubbleLinesForBatch(bubbles)
          let allowPlaintextBatch =
            flatForBatch.length > 0 && flatForBatch.every((ln) => !bubbleLineNeedsSpecialBubbleHandler(ln))
          if (allowPlaintextBatch && roomType === 'group' && groupId?.trim()) {
            if (await skipBubbleForGroupMute()) allowPlaintextBatch = false
          }
          const gSnap = roomType === 'group' ? groupDocRef.current ?? groupLive : null
          if (allowPlaintextBatch && roomType === 'group' && groupId?.trim() && !gSnap) {
            allowPlaintextBatch = false
          }
          if (allowPlaintextBatch) {
            type PlanRow = { oid: string; ts: number; charId: string; text: string; replyToId?: string }
            const plans: PlanRow[] = []
            let pendingInline: string | undefined
            let bi = 0
            let abortPlaintextBatch = false
            const ts0 = getCurrentTimeMs()
            for (const rawLine of flatForBatch) {
              const parsed = parseReplyMarker(rawLine)
              if (parsed.replyMessageId?.trim()) pendingInline = parsed.replyMessageId.trim()
              const segRaw = parsed.text.trim()
              const seg = sanitizeVoiceControlForTextBubble(segRaw) || segRaw
              if (!String(seg).trim()) continue
              const emitCharacterId =
                roomType === 'group' &&
                persistCharacterId.trim() !== WECHAT_GROUP_BOT_CHARACTER_ID &&
                /^(群管家|群助手|群机器人)\s*[：:]/u.test(seg.trimStart())
                  ? WECHAT_GROUP_BOT_CHARACTER_ID
                  : persistCharacterId
              const segForStore =
                emitCharacterId === WECHAT_GROUP_BOT_CHARACTER_ID
                  ? normalizeGroupSmartBotBubblePlaintext(seg, groupDocRef.current ?? groupLive)
                  : seg
              if (!String(segForStore).trim()) continue
              const miniGameActInBatch = parseMiniGameInviteActionDirective(String(segForStore))
              if (miniGameActInBatch && roomType !== 'group') {
                const pendingMiniGameForAct = findLatestPendingMiniGameInvite(extractMessages(itemsRef.current))
                const cid = persistCharacterId.trim()
                const pid = playerIdentityId.trim()
                if (pendingMiniGameForAct && cid && pid && pid !== '__none__') {
                  const inviteMsgId = resolvePendingMiniGameInviteMessageId({
                    messageIdHint: miniGameActInBatch.messageId,
                    msgs: extractMessages(itemsRef.current),
                  })
                  if (inviteMsgId) {
                    const inviteRow = extractMessages(itemsRef.current).find((x) => x.id === inviteMsgId)
                    const invitePayload =
                      inviteRow?.miniGameInvite?.kind === 'game_invite' ? inviteRow.miniGameInvite : null
                    if (invitePayload) {
                      const replyText =
                        miniGameActInBatch.replyText?.trim() ||
                        plans.map((p) => p.text.trim()).filter(Boolean).slice(-1)[0] ||
                        ''
                      if (miniGameActInBatch.kind === 'accept') {
                        miniGameDirectiveHandledThisRound = true
                        enqueueOpponentMessagesSequential([
                          createMiniGameAcceptRevealJob(
                            invitePayload,
                            replyText,
                            inviteMsgId,
                            miniGameActInBatch.gomokuSession,
                          ),
                        ])
                      } else {
                        miniGameDirectiveHandledThisRound = true
                        enqueueOpponentMessagesSequential([
                          createMiniGameDeclineRevealJob(invitePayload, replyText, inviteMsgId),
                        ])
                      }
                    }
                  }
                }
                continue
              }
              if (isMusicSyncDirectiveArtifactLine(String(segForStore)) || isMiniGameDirectiveArtifactLine(String(segForStore))) continue
              if (isCharacterMusicSyncDirectiveArtifactLine(String(segForStore))) continue
              if (isCharacterMiniGameInviteDirectiveArtifactLine(String(segForStore))) continue
              if (isLocationShareDirectiveArtifactLine(String(segForStore))) continue
              if (isTakeoutOrderDirectiveArtifactLine(String(segForStore))) continue
              if (isPulseCommentDirectiveArtifactLine(String(segForStore))) continue
              if (isPulseFollowDirectiveArtifactLine(String(segForStore))) continue
              if (
                roomType === 'group' &&
                groupId?.trim() &&
                emitCharacterId !== WECHAT_GROUP_BOT_CHARACTER_ID &&
                gSnap
              ) {
                if (matchGroupRobotRules(seg, gSnap.robotRules ?? [])) {
                  abortPlaintextBatch = true
                  break
                }
              }
              const ts = ts0 + bi
              const oid = `wxm-${ts}-obatch-${bi}-${Math.random().toString(36).slice(2, 6)}`
              bi += 1
              const replyToId = pendingInline
              pendingInline = undefined
              plans.push({ oid, ts, charId: emitCharacterId, text: segForStore, replyToId })
            }
            if (!abortPlaintextBatch && plans.length > 0) {
              const replyIds = [...new Set(plans.map((p) => p.replyToId).filter((x): x is string => !!x?.trim()))]
              const metaById = new Map<string, WeChatReplyToMeta>()
              for (const rid of replyIds) {
                const meta = await buildReplyMetaById(rid)
                if (meta) metaById.set(rid, meta)
              }
              const thinkingRow = !thinkingAttached && thinking ? thinking : undefined
              if (thinkingRow) thinkingAttached = true
              const notifyTitle = notifyPeerRound.trim() || undefined
              const newMsgs: ChatMsg[] = plans.map((p, j) => ({
                id: p.oid,
                kind: 'msg' as const,
                from: 'other' as const,
                senderCharacterId: p.charId,
                text: p.text,
                thinking: j === 0 ? thinkingRow : undefined,
                timestamp: p.ts,
                replyTo: p.replyToId ? metaById.get(p.replyToId) : undefined,
                otherAnimated: true,
              }))
              const batchRevealSteps = newMsgs.map((m) =>
                markEmittedThisRound(m.id, m.timestamp, m.text),
              )
              const afterRevealGroupBump =
                roomType === 'group' && groupId?.trim()
                  ? () => {
                      const gid = groupId.trim()
                      void (async () => {
                        try {
                          const gx = await personaDb.getGroupChat(gid)
                          if (!gx) return
                          const bumped = {
                            ...gx,
                            chatTurnSequence: (gx.chatTurnSequence ?? 0) + 1,
                            updatedAt: Date.now(),
                          }
                          await personaDb.putGroupChat(bumped)
                          groupDocRef.current = bumped
                          setGroupLive(bumped)
                        } catch {
                          /* ignore turn bump */
                        }
                      })()
                    }
                  : undefined
              let opponentJobs: OpponentRevealJob[] = newMsgs.map((m, j) => {
                const p = plans[j]!
                return {
                  forConversationKey: revealConvKey,
                  msg: m,
                  persist: () => {
                    void personaDb
                      .appendWeChatChatMessage({
                        id: m.id,
                        characterId: p.charId,
                        playerIdentityId: fxPlayerIdentityId,
                        type: 'character',
                        content: m.text,
                        thinking: j === 0 ? thinkingRow : undefined,
                        replyTo: m.replyTo ?? undefined,
                        timestamp: m.timestamp,
                        isRead: true,
                        conversationKey: revealConvKey,
                        notifyPeerTitle:
                          p.charId === WECHAT_GROUP_BOT_CHARACTER_ID ? '群管家' : notifyTitle,
                      })
                      .catch(() => {})
                  },
                  afterReveal: withMusicSyncFlushOnBubbleRevealed(batchRevealSteps[j]!, afterRevealGroupBump),
                }
              })
              for (const p of plans) {
                const plain = p.text.trim()
                if (plain) characterPlainTextsThisRound.push(plain)
              }
              enqueueOpponentMessagesSequential(opponentJobs)
              if (
                pendingCharacterMusicSyncInvites.length > 0 ||
                pendingCharacterMusicSyncSeeks.length > 0 ||
                pendingCharacterMusicSyncPlays.length > 0 ||
                pendingCharacterMiniGameInvites.length > 0
              ) {
                enqueueMusicSyncRoundCompletionJob()
              }
              continue bubbleRunLoop
            }
          }
        }

        deferBubbleRevealEnqueueRef.current = true
        try {
        for (let i = 0; i < bubbles.length; i += 1) {
          try {
            if (isFlushQueueStopped()) break bubbleRunLoop
            const rawLine = String(bubbles[i] ?? '').trim()
            const normalizedRawLine = rawLine.replace(/\\n/g, '\n').trim()
            const expandedLines = normalizedRawLine
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
            if (expandedLines.length > 1) {
              bubbles.splice(i, 1, ...expandedLines)
              i -= 1
              continue
            }
            const currentLineRaw = expandedLines[0] ?? normalizedRawLine
            let currentLine = currentLineRaw
            if (roomType !== 'group') {
              currentLine = stripBannedClassicEmojiTokens(
                currentLine,
                convMediaFreqRef.current.classicEmojiBannedNames,
              )
              if (
                shouldStripClassicEmojiTokensThisRound(
                  roomType,
                  convMediaFreqRef.current.classicEmoji,
                  roundClassicEmojiAllowed,
                )
              ) {
                currentLine = stripWechatClassicEmojiTokens(currentLine)
              }
            }
            if (!currentLine.trim()) continue
            if (currentLine === WECHAT_RECALL_ACTION_TOKEN) {
              const lastId = emittedMessageOrderThisRound.length ? emittedMessageOrderThisRound[emittedMessageOrderThisRound.length - 1] : ''
              if (!lastId) continue
              const emittedMeta = emittedMessageMetaThisRound.get(lastId)
              setRecallAnimatingIds((prev) => new Set(prev).add(lastId))
              const recalledAt = getCurrentTimeMs()
              let original = emittedMeta?.preview?.trim() || ''
              try {
                const fromDb = await personaDb.getWeChatChatMessageById(lastId)
                if (fromDb) {
                  original = fromDb.originalContent?.trim() || fromDb.content?.trim() || original
                  await personaDb.patchWeChatChatMessageById(lastId, {
                    content: '',
                    isRecalled: true,
                    recalledBy: 'character',
                    recallTimestamp: recalledAt,
                    originalContent: original,
                  })
                } else if (!original) {
                  const local = extractMessages(itemsRef.current).find((x) => x.id === lastId)
                  original = local?.originalText?.trim() || local?.text?.trim() || ''
                }
              } catch (e) {
                logger.log('error', `角色撤回落库失败 id=${lastId} err=${e instanceof Error ? e.message : String(e)}`)
              }
              applyCharacterRecallToRevealQueues(lastId, recalledAt, original)
              if (conversationKeyLiveRef.current.trim() === flushConversationKey) {
                setItems((prev) => {
                  const msgs = extractMessages(prev)
                  const hasTarget = msgs.some((msg) => msg.id === lastId)
                  const next = rebuildWithCurrentTime(
                    hasTarget
                      ? msgs.map((msg) =>
                          msg.id !== lastId
                            ? msg
                            : {
                                ...msg,
                                text: '',
                                isRecalled: true,
                                recalledBy: 'other',
                                recallTimestamp: recalledAt,
                                originalText: original,
                              },
                        )
                      : msgs,
                  )
                  itemsRef.current = next
                  return next
                })
              }
              setRecallAnimatingIds((prev) => {
                const next = new Set(prev)
                next.delete(lastId)
                return next
              })
              continue
            }
            const voiceLineMatch = currentLine.match(/^(?:\[语音\]|【语音】)\s*(.*)$/)
            if (voiceLineMatch) {
              if (
                shouldSuppressCharacterVoiceLine(
                  roomType,
                  convMediaFreqRef.current.voice,
                  roundVoiceAllowed,
                )
              ) {
                continue
              }
              const rawScript = String(voiceLineMatch[1] ?? '').trim()
              if (!rawScript) continue
              const normalizedScript = normalizeVoiceScriptForTts(rawScript)
              const seg = sanitizeVoiceTranscriptDisplay(normalizedScript)
              if (
                characterPlainTextsThisRound.length > 0 &&
                voiceTranscriptDuplicatesPlainTexts(seg, characterPlainTextsThisRound)
              ) {
                continue
              }
              const rememberVoiceTranscript = () => {
                const spoken = seg.trim()
                if (spoken) characterPlainTextsThisRound.push(spoken)
              }
              if (await skipBubbleForGroupMute()) {
                const tsM = getCurrentTimeMs()
                const oidM = `wxm-${tsM}-ov-${i}-${Math.random().toString(36).slice(2, 6)}`
                const replyToMetaM = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
                pendingReplyMessageId = undefined
                const estimatedVoiceSecM = Math.max(1, Math.min(30, Math.round(seg.length / 6)))
                const voiceM = {
                  durationSec: estimatedVoiceSecM,
                  emotionAnalyzed: true,
                  ttsScript: normalizedScript,
                  transcriptText: seg || '（语音）',
                }
                const thinkingVoiceM = !thinkingAttached && thinking ? thinking : undefined
                const mappedVoice = mapWeChatMessagesToChatItems([
                  {
                    id: oidM,
                    characterId: persistCharacterId,
                    playerIdentityId: fxPlayerIdentityId,
                    type: 'character' as const,
                    content: seg || '[语音]',
                    thinking: thinkingVoiceM,
                    replyTo: replyToMetaM ?? undefined,
                    timestamp: tsM,
                    isRead: true,
                    conversationKey: revealConvKey,
                    voice: voiceM,
                    ext: { mutedMessageVisibleToModeratorsOnly: true },
                  },
                ])
                const uiVoice = mappedVoice[0]
                if (uiVoice) {
                  if (thinkingVoiceM) thinkingAttached = true
                  const voiceMutedStep = markEmittedThisRound(oidM, tsM, seg || '[语音]')
                  const queuedVoiceMuted = { ...uiVoice, otherAnimated: true as const }
                  enqueueOpponentMessagesSequential([
                    {
                      forConversationKey: revealConvKey,
                      msg: queuedVoiceMuted,
                      persist: () => {
                        void personaDb
                          .appendWeChatChatMessage({
                            id: oidM,
                            characterId: persistCharacterId,
                            playerIdentityId: fxPlayerIdentityId,
                            type: 'character',
                            content: seg || '[语音]',
                            thinking: thinkingVoiceM,
                            replyTo: replyToMetaM ?? undefined,
                            timestamp: queuedVoiceMuted.timestamp,
                            isRead: true,
                            conversationKey: revealConvKey,
                            notifyPeerTitle: notifyPeerRound.trim() || undefined,
                            voice: voiceM,
                            ext: { mutedMessageVisibleToModeratorsOnly: true },
                          })
                          .catch(() => {
                            /* ignore */
                          })
                      },
                      afterReveal: withMusicSyncFlushOnBubbleRevealed(voiceMutedStep, () => {
                        void appendMuteSuppressSystemStrip(seg || '[语音]')
                      }),
                    },
                  ])
                  rememberVoiceTranscript()
                }
                continue
              }
              const estimatedVoiceSec = Math.max(1, Math.min(30, Math.round(seg.length / 6)))
              if (isFlushQueueStopped()) break bubbleRunLoop
              const ts = getCurrentTimeMs()
              const oid = `wxm-${ts}-ov-${i}-${Math.random().toString(36).slice(2, 6)}`
              const replyToMeta = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const voice = {
                durationSec: estimatedVoiceSec,
                emotionAnalyzed: true,
                ttsScript: normalizedScript,
                transcriptText: seg || '（语音）',
              }
              const thinkingVoice = !thinkingAttached && thinking ? thinking : undefined
              const incoming: ChatMsg = {
                id: oid,
                kind: 'msg',
                from: 'other',
                senderCharacterId: persistCharacterId,
                text: seg || '[语音]',
                thinking: thinkingVoice,
                timestamp: ts,
                replyTo: replyToMeta ?? undefined,
                voice,
                otherAnimated: true,
              }
              if (thinkingVoice) thinkingAttached = true
              const voiceStep = markEmittedThisRound(oid, ts, seg || '[语音]')
              const voiceGroupBump =
                roomType === 'group' && groupId?.trim()
                  ? () => {
                      const gid = groupId.trim()
                      void (async () => {
                        try {
                          const gx = await personaDb.getGroupChat(gid)
                          if (!gx) return
                          const bumped = { ...gx, chatTurnSequence: (gx.chatTurnSequence ?? 0) + 1, updatedAt: Date.now() }
                          await personaDb.putGroupChat(bumped)
                          groupDocRef.current = bumped
                          setGroupLive(bumped)
                        } catch {
                          /* ignore turn bump */
                        }
                      })()
                    }
                  : undefined
              let voiceJobs: OpponentRevealJob[] = [
                {
                  forConversationKey: revealConvKey,
                  msg: incoming,
                  persist: () => {
                    void personaDb
                      .appendWeChatChatMessage({
                        id: oid,
                        characterId: persistCharacterId,
                        playerIdentityId: fxPlayerIdentityId,
                        type: 'character',
                        content: seg || '[语音]',
                        thinking: thinkingVoice,
                        replyTo: replyToMeta ?? undefined,
                        timestamp: incoming.timestamp,
                        isRead: true,
                        conversationKey: revealConvKey,
                        notifyPeerTitle: notifyPeerRound.trim() || undefined,
                        voice,
                      })
                      .catch(() => {
                        /* ignore */
                      })
                  },
                  afterReveal: withMusicSyncFlushOnBubbleRevealed(voiceStep, () => {
                    voiceGroupBump?.()
                    void ensureVoiceMessageAudio(oid, voice, { voiceCharacterId: persistCharacterId })
                  }),
                },
              ]
              enqueueOpponentMessagesSequential(voiceJobs)
              rememberVoiceTranscript()
              continue
            }
            if (await skipBubbleForGroupMute()) {
              const hidden = String(currentLine ?? '').trim() || '（无内容）'
              const tsT = getCurrentTimeMs()
              const oidT = `wxm-${tsT}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
              const replyToMetaT = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const thinkingTxtM = !thinkingAttached && thinking ? thinking : undefined
              const mappedTxt = mapWeChatMessagesToChatItems([
                {
                  id: oidT,
                  characterId: persistCharacterId,
                  playerIdentityId: fxPlayerIdentityId,
                  type: 'character' as const,
                  content: hidden,
                  thinking: thinkingTxtM,
                  replyTo: replyToMetaT ?? undefined,
                  timestamp: tsT,
                  isRead: true,
                  conversationKey: revealConvKey,
                  ext: { mutedMessageVisibleToModeratorsOnly: true },
                },
              ])
              const uiTxt = mappedTxt[0]
              if (uiTxt) {
                if (thinkingTxtM) thinkingAttached = true
                const textMutedStep = markEmittedThisRound(oidT, tsT, hidden)
                const queuedTxtMuted = { ...uiTxt, otherAnimated: true as const }
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: queuedTxtMuted,
                    persist: () => {
                      void personaDb
                        .appendWeChatChatMessage({
                          id: oidT,
                          characterId: persistCharacterId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: hidden,
                          thinking: thinkingTxtM,
                          replyTo: replyToMetaT ?? undefined,
                          timestamp: queuedTxtMuted.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                          notifyPeerTitle: notifyPeerRound.trim() || undefined,
                          ext: { mutedMessageVisibleToModeratorsOnly: true },
                        })
                        .catch(() => {
                          /* ignore */
                        })
                    },
                    afterReveal: withMusicSyncFlushOnBubbleRevealed(textMutedStep, () => {
                      void appendMuteSuppressSystemStrip(hidden)
                    }),
                  },
                ])
              }
              continue
            }
            if (parseCharacterProfileImageApplyDirective(currentLine)) {
              continue
            }
            if (parseCharacterWechatProfileUpdateDirective(currentLine)) {
              continue
            }
            const rpOpen = parseRedPacketOpenDirective(currentLine)
            if (rpOpen && roomType !== 'group') {
              const cid = persistCharacterId.trim()
              const pid = playerIdentityId.trim()
              if (cid && pid && pid !== '__none__') {
                const misTid = resolveTransferIdFromMisplacedRedPacketOpen({
                  messageIdHint: rpOpen.messageId,
                  msgs: extractMessages(itemsRef.current),
                  conversationKey: revealConvKey,
                  characterId: cid,
                  playerIdentityId: pid,
                  getCurrentTime: getCurrentTimeMs,
                })
                if (misTid) {
                  enqueueOpponentMessagesSequential([createCharacterTransferAcceptedAckRevealJob(misTid)])
                } else {
                  const packetMsgId = resolveSelfUnopenedRedPacketMessageId({
                    messageIdHint: rpOpen.messageId,
                    msgs: extractMessages(itemsRef.current),
                  })
                  if (packetMsgId) {
                    enqueueOpponentMessagesSequential([createPeerClaimedSelfRedPacketStripRevealJob(packetMsgId)])
                  }
                }
              }
              continue
            }
            const incomingTfAct = parseTransferIncomingActionDirective(currentLine)
            if (incomingTfAct) {
              const cid = persistCharacterId.trim()
              const pid = playerIdentityId.trim()
              if (cid && pid && pid !== '__none__') {
                const tid = resolveIncomingTransferForCharacter({
                  messageIdHint: incomingTfAct.messageId,
                  msgs: extractMessages(itemsRef.current),
                  conversationKey: revealConvKey,
                  characterId: cid,
                  playerIdentityId: pid,
                  getCurrentTime: getCurrentTimeMs,
                })
                if (tid) {
                  if (incomingTfAct.kind === 'accept') {
                    enqueueOpponentMessagesSequential([createCharacterTransferAcceptedAckRevealJob(tid)])
                  } else {
                    const rec = getLumiTransferFresh(tid, getCurrentTimeMs)
                    if (rec && rec.senderId === pid && returnLumiTransfer(tid, getCurrentTimeMs)) {
                      walletAdjustBalance(rec.amount)
                      walletAddTransaction({
                        type: 'topup',
                        title: rec.remark?.trim()
                          ? `转账已退还 · ${rec.remark.trim()}`
                          : '转账已退还',
                        amount: rec.amount,
                      })
                      const transferNotifiedEarly = readNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY)
                      transferNotifiedEarly.add(tid)
                      writeNotifiedSet(LS_TRANSFER_RETURN_NOTIFIED_KEY, transferNotifiedEarly)
                      enqueueOpponentMessagesSequential([
                        createPeerReturnedSelfTransferStripRevealJob(tid, { returnIfPending: false }),
                        createCharacterTransferReturnedAckRevealJob(tid),
                      ])
                    }
                  }
                }
              }
              continue
            }
            const charMusicLine = mergeCharacterMusicSyncDirectiveLines(
              currentLine,
              bubbles[i + 1] != null ? String(bubbles[i + 1] ?? '') : undefined,
            )
            const musicSyncDirectiveLine = mergeMusicSyncDirectiveBubbleLines(
              currentLine,
              charMusicLine !== currentLine ? undefined : bubbles[i + 1] != null ? String(bubbles[i + 1] ?? '') : undefined,
            )
            const miniGameDirectiveLine = mergeMiniGameDirectiveBubbleLines(
              currentLine,
              charMusicLine !== currentLine || musicSyncDirectiveLine !== currentLine
                ? undefined
                : bubbles[i + 1] != null
                  ? String(bubbles[i + 1] ?? '')
                  : undefined,
            )
            if (charMusicLine !== currentLine) {
              bubbles.splice(i + 1, 1)
            } else if (musicSyncDirectiveLine !== currentLine) {
              bubbles.splice(i + 1, 1)
            } else if (miniGameDirectiveLine !== currentLine) {
              bubbles.splice(i + 1, 1)
            }
            const charMusicAct = parseCharacterMusicSyncDirectiveFromArtifactLine(charMusicLine)
            if (charMusicAct && roomType !== 'group') {
              if (charMusicAct.kind === 'play' || charMusicAct.kind === 'seek' || charMusicAct.kind === 'invite') {
                continue
              }
              void applyCharacterMusicSyncDirective(
                charMusicAct,
                buildCharacterMusicSyncSessionContext(),
              ).catch(() => {})
              continue
            }
            if (isCharacterMusicSyncDirectiveArtifactLine(charMusicLine)) {
              continue
            }
            const musicSyncAct = parseMusicSyncIncomingActionDirective(musicSyncDirectiveLine)
            if (musicSyncAct && roomType !== 'group') {
              const engageMusicSync = shouldEngageMusicSyncInviteFlow(
                [...extractMessages(itemsRef.current)].reverse(),
              )
              const cid = persistCharacterId.trim()
              const pid = playerIdentityId.trim()
              if (engageMusicSync && cid && pid && pid !== '__none__') {
                const inviteMsgId = resolvePendingMusicInviteMessageId({
                  messageIdHint: musicSyncAct.messageId,
                  msgs: extractMessages(itemsRef.current),
                })
                if (inviteMsgId) {
                  const inviteRow = extractMessages(itemsRef.current).find((x) => x.id === inviteMsgId)
                  const invitePayload =
                    inviteRow?.musicSync?.kind === 'music_invite' ? inviteRow.musicSync : null
                  if (invitePayload) {
                    const replyText =
                      musicSyncAct.replyText?.trim() ||
                      (() => {
                        const order = emittedMessageOrderThisRound
                        for (let oi = order.length - 1; oi >= 0; oi -= 1) {
                          const mid = order[oi]!
                          const meta = emittedMessageMetaThisRound.get(mid)
                          if (meta?.preview?.trim()) return meta.preview.trim()
                        }
                        return ''
                      })()
                    if (musicSyncAct.kind === 'accept') {
                      musicSyncDirectiveHandledThisRound = true
                      enqueueOpponentMessagesSequential([
                        createMusicSyncAcceptRevealJob(invitePayload, replyText),
                      ])
                    } else {
                      musicSyncDirectiveHandledThisRound = true
                      enqueueOpponentMessagesSequential([
                        createMusicSyncDeclineRevealJob(invitePayload, replyText),
                      ])
                    }
                  }
                }
              }
              continue
            }
            const miniGameAct = parseMiniGameInviteActionDirective(miniGameDirectiveLine)
            if (miniGameAct && roomType !== 'group') {
              const pendingMiniGameForAct = findLatestPendingMiniGameInvite(extractMessages(itemsRef.current))
              const cid = persistCharacterId.trim()
              const pid = playerIdentityId.trim()
              if (pendingMiniGameForAct && cid && pid && pid !== '__none__') {
                const inviteMsgId = resolvePendingMiniGameInviteMessageId({
                  messageIdHint: miniGameAct.messageId,
                  msgs: extractMessages(itemsRef.current),
                })
                if (inviteMsgId) {
                  const inviteRow = extractMessages(itemsRef.current).find((x) => x.id === inviteMsgId)
                  const invitePayload =
                    inviteRow?.miniGameInvite?.kind === 'game_invite' ? inviteRow.miniGameInvite : null
                  if (invitePayload) {
                    const replyText =
                      miniGameAct.replyText?.trim() ||
                      (() => {
                        const order = emittedMessageOrderThisRound
                        for (let oi = order.length - 1; oi >= 0; oi -= 1) {
                          const mid = order[oi]!
                          const meta = emittedMessageMetaThisRound.get(mid)
                          if (meta?.preview?.trim()) return meta.preview.trim()
                        }
                        return ''
                      })()
                    if (miniGameAct.kind === 'accept') {
                      miniGameDirectiveHandledThisRound = true
                      enqueueOpponentMessagesSequential([
                        createMiniGameAcceptRevealJob(
                          invitePayload,
                          replyText,
                          inviteMsgId,
                          miniGameAct.gomokuSession,
                        ),
                      ])
                    } else {
                      miniGameDirectiveHandledThisRound = true
                      enqueueOpponentMessagesSequential([
                        createMiniGameDeclineRevealJob(invitePayload, replyText, inviteMsgId),
                      ])
                    }
                  }
                }
              }
              continue
            }
            const rpDirective = parseRedPacketDirective(currentLine)
            const tfDirective = parseTransferDirective(currentLine)
            const vcDirective = parseVoiceCallDirective(currentLine)
            const locDirective = parseLocationShareDirective(currentLine)
            if (locDirective && roomType !== 'group') {
              const payload = buildWeChatLocationPayloadFromAiDirective(locDirective)
              if (payload) {
                const ts = getCurrentTimeMs()
                const mid = `wxm-${ts}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
                const seg = locationShareContentFallback(payload)
                const thinkingLoc = !thinkingAttached && thinking ? thinking : undefined
                const incoming: ChatMsg = {
                  id: mid,
                  kind: 'msg',
                  from: 'other',
                  senderCharacterId: persistCharacterId,
                  text: seg,
                  thinking: thinkingLoc,
                  timestamp: ts,
                  locationShare: payload,
                  otherAnimated: true,
                }
                if (thinkingLoc) thinkingAttached = true
                const locStep = markEmittedThisRound(mid, ts, seg)
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: incoming,
                    persist: () => {
                      void personaDb
                        .appendWeChatChatMessage({
                          id: mid,
                          characterId: persistCharacterId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: seg,
                          thinking: thinkingLoc,
                          timestamp: incoming.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                          notifyPeerTitle: notifyPeerRound.trim() || undefined,
                          locationShare: payload,
                        })
                        .catch(() => {
                          /* ignore */
                        })
                    },
                    afterReveal: withMusicSyncFlushOnBubbleRevealed(locStep),
                  },
                ])
              }
              continue
            }
            const takeoutDirective = parseTakeoutOrderDirective(currentLine)
            if (takeoutDirective && roomType !== 'group') {
              const defaultRecipientName = playerDisplayName.trim() || state.profile.displayName.trim() || '我'
              const bundle = buildCharacterTakeoutOrderBundle(takeoutDirective, {
                characterId: persistCharacterId,
                characterName: peerNotifyTitle.trim() || 'TA',
                defaultRecipientName,
              })
              if (bundle) {
                void emitTasteOrderPlaced(bundle.order)
                const ts = getCurrentTimeMs()
                const mid = `wxm-${ts}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
                const seg = takeoutOrderContentFallback(bundle.card)
                const thinkingTakeout = !thinkingAttached && thinking ? thinking : undefined
                const incoming: ChatMsg = {
                  id: mid,
                  kind: 'msg',
                  from: 'other',
                  senderCharacterId: persistCharacterId,
                  text: seg,
                  thinking: thinkingTakeout,
                  timestamp: ts,
                  takeoutOrder: bundle.card,
                  otherAnimated: true,
                }
                if (thinkingTakeout) thinkingAttached = true
                const takeoutStep = markEmittedThisRound(mid, ts, seg)
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: incoming,
                    persist: () => {
                      void personaDb
                        .appendWeChatChatMessage({
                          id: mid,
                          characterId: persistCharacterId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: seg,
                          thinking: thinkingTakeout,
                          timestamp: incoming.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                          notifyPeerTitle: notifyPeerRound.trim() || undefined,
                          takeoutOrder: bundle.card,
                        })
                        .catch(() => {
                          /* ignore */
                        })
                    },
                    afterReveal: withMusicSyncFlushOnBubbleRevealed(takeoutStep),
                  },
                ])
              }
              continue
            }
            const pulseCommentDirective = parsePulseCommentDirective(currentLine)
            if (pulseCommentDirective && roomType !== 'group') {
              void applyPulseCommentDirective(pulseCommentDirective, {
                characterId: persistCharacterId,
                characterName: peerNotifyTitle.trim() || 'TA',
                characterAvatarUrl: peerAvatarResolved,
              }).catch(() => {
                /* ignore */
              })
              continue
            }
            const pulseFollowDirective = parsePulseFollowDirective(currentLine)
            if (pulseFollowDirective && roomType !== 'group') {
              void applyPulseFollowDirective(pulseFollowDirective, {
                characterId: persistCharacterId,
                characterName: peerNotifyTitle.trim() || 'TA',
                characterAvatarUrl: peerAvatarResolved,
                playerIdentityId: fxPlayerIdentityId,
                playerDisplayName: playerDisplayName.trim() || state.profile.displayName.trim() || '用户',
                playerAvatarUrl: playerAvatarResolved || undefined,
              }).catch(() => {
                /* ignore */
              })
              continue
            }
            const pulseDmShotId = parsePulseDmScreenshotPlaceholderId(currentLine)
            if (pulseDmShotId && roomType !== 'group') {
              const payloadShot = takePulseDmScreenshotCachedImage(pulseDmShotId)
              if (!payloadShot) continue
              if (isFlushQueueStopped()) break bubbleRunLoop
              const replyToShot = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const tsShot = getCurrentTimeMs()
              const oidShot = `wxm-${tsShot}-pdms-${i}-${Math.random().toString(36).slice(2, 6)}`
              const thinkingForShot = !thinkingAttached && thinking ? thinking : undefined
              if (thinkingForShot) thinkingAttached = true
              const incomingShot: ChatMsg = {
                id: oidShot,
                kind: 'msg',
                from: 'other',
                senderCharacterId: persistCharacterId,
                text: PULSE_DM_SCREENSHOT_TRANSCRIPT,
                thinking: thinkingForShot,
                timestamp: tsShot,
                replyTo: replyToShot ?? undefined,
                images: [{ base64: payloadShot.base64, type: payloadShot.mime }],
                otherAnimated: true,
              }
              const shotStep = markEmittedThisRound(oidShot, tsShot, PULSE_DM_SCREENSHOT_TRANSCRIPT)
              enqueueOpponentMessagesSequential([
                {
                  forConversationKey: revealConvKey,
                  msg: incomingShot,
                  persist: () => {
                    void personaDb
                      .appendWeChatChatMessage({
                        id: oidShot,
                        characterId: persistCharacterId,
                        playerIdentityId: fxPlayerIdentityId,
                        type: 'character',
                        content: PULSE_DM_SCREENSHOT_TRANSCRIPT,
                        thinking: thinkingForShot,
                        replyTo: replyToShot ?? undefined,
                        timestamp: incomingShot.timestamp,
                        isRead: true,
                        conversationKey: revealConvKey,
                        notifyPeerTitle: notifyPeerRound.trim() || undefined,
                        images: [{ base64: payloadShot.base64, type: payloadShot.mime }],
                      })
                      .catch(() => {
                        /* ignore */
                      })
                  },
                  afterReveal: withMusicSyncFlushOnBubbleRevealed(shotStep),
                },
              ])
              continue
            }
            if (rpDirective || tfDirective || vcDirective) {
              const ts = getCurrentTimeMs()
              const mid = `wxm-${ts}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
              if (vcDirective?.type === 'start') {
                setActiveCallInitiator('other')
                setIncomingCallOpeningLine(vcDirective.openingLine ?? '')
                incomingRejectLockRef.current = false
                setIncomingCallOpen(true)
                continue
              }
              if (rpDirective) {
                // 角色发红包给用户：备注可用于安慰/祝福；金额 0.01~200
                const packetId = `wxrp-${ts}-${Math.random().toString(36).slice(2, 9)}`
                const seg = rpDirective.remark ? `[红包] ${rpDirective.remark}` : '[红包]'
                const thinkingRp = !thinkingAttached && thinking ? thinking : undefined
                const incoming: ChatMsg = {
                  id: mid,
                  kind: 'msg',
                  from: 'other',
                  senderCharacterId: persistCharacterId,
                  text: seg,
                  thinking: thinkingRp,
                  timestamp: ts,
                  redPacket: { packetId, amountYuan: rpDirective.amountYuan, remark: rpDirective.remark, opened: false },
                  otherAnimated: true,
                }
                if (thinkingRp) thinkingAttached = true
                const rpStep = markEmittedThisRound(mid, ts, seg)
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: incoming,
                    persist: () => {
                      void personaDb
                        .appendWeChatChatMessage({
                          id: mid,
                          characterId: persistCharacterId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: seg,
                          thinking: thinkingRp,
                          timestamp: incoming.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                          notifyPeerTitle: notifyPeerRound.trim() || undefined,
                          redPacket: { packetId, amountYuan: rpDirective.amountYuan, remark: rpDirective.remark, opened: false },
                        })
                        .catch(() => {
                          /* ignore */
                        })
                    },
                    afterReveal: withMusicSyncFlushOnBubbleRevealed(rpStep),
                  },
                ])
                continue
              }
              if (tfDirective) {
                // 角色转账给用户：用 localStorage 记录 24h 退还；备注可用于安慰
                const transferId = `wxtr-${ts}-${Math.random().toString(36).slice(2, 10)}`
                const expiresAt = ts + 24 * 60 * 60 * 1000
                const seg = tfDirective.remark ? `[转账] ${tfDirective.remark}` : '[转账]'
                upsertLumiTransfer({
                  id: transferId,
                  amount: tfDirective.amountYuan,
                  remark: tfDirective.remark,
                  senderId: persistCharacterId,
                  receiverId: playerIdentityId,
                  status: 'pending',
                  createdAt: ts,
                  expiresAt,
                  conversationKey: revealConvKey,
                  messageId: transferId,
                })
                const thinkingTf = !thinkingAttached && thinking ? thinking : undefined
                const incoming: ChatMsg = {
                  id: mid,
                  kind: 'msg',
                  from: 'other',
                  senderCharacterId: persistCharacterId,
                  text: seg,
                  thinking: thinkingTf,
                  timestamp: ts,
                  transfer: { transferId },
                  otherAnimated: true,
                }
                if (thinkingTf) thinkingAttached = true
                const tfStep = markEmittedThisRound(mid, ts, seg)
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: incoming,
                    persist: () => {
                      void personaDb
                        .appendWeChatChatMessage({
                          id: mid,
                          characterId: persistCharacterId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: seg,
                          thinking: thinkingTf,
                          timestamp: incoming.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                          notifyPeerTitle: notifyPeerRound.trim() || undefined,
                          transfer: { transferId },
                        })
                        .catch(() => {
                          /* ignore */
                        })
                    },
                    afterReveal: withMusicSyncFlushOnBubbleRevealed(tfStep),
                  },
                ])
                continue
              }
            }

            const charSticker = parseCharacterStickerLine(currentLine)
            if (charSticker) {
              const stickerGroupTag = getStickerCatalogEntries().find((e) => e.ref === charSticker.ref)?.groupTag
              if (
                shouldSuppressCharacterStickerLine(
                  roomType,
                  convMediaFreqRef.current.sticker,
                  roundStickerAllowed,
                  roundUserExplicitStickerRequest,
                  convMediaFreqRef.current.stickerTargetedModeEnabled,
                  convMediaFreqRef.current.stickerTargetedGroups,
                  convMediaFreqRef.current.stickerTargetedEntries,
                  convMediaFreqRef.current.stickerBannedRefs,
                  charSticker.ref,
                  stickerGroupTag,
                )
              ) {
                logConsole(
                  'ai',
                  `表情包已拦截：会话设为不发表情包(0%)；行=${currentLine.trim().slice(0, 80)}`,
                )
                continue
              }
              const dup = shouldSkipDuplicateCharacterSticker(currentLine, recentCharacterStickerRefs)
              if (dup.skip) {
                logConsole(
                  'ai',
                  `表情包已跳过：与近期重复 ref=${charSticker.ref.slice(0, 48)}`,
                )
                continue
              }
              const url = charSticker.url
              const stickerRef = charSticker.ref
              recentCharacterStickerRefs.push(stickerRef)
              const stickerEmitId =
                roomType === 'group' &&
                persistCharacterId.trim() !== WECHAT_GROUP_BOT_CHARACTER_ID &&
                /^(群管家|群助手|群机器人)\s*[：:]/u.test(String(currentLine ?? '').trimStart())
                  ? WECHAT_GROUP_BOT_CHARACTER_ID
                  : persistCharacterId
              const stickerNotify =
                stickerEmitId === WECHAT_GROUP_BOT_CHARACTER_ID ? '群管家' : notifyPeerRound
              const dedupeSticker = `sticker:${url}`
              if (emittedThisRound.has(dedupeSticker)) continue
              emittedThisRound.add(dedupeSticker)
              if (isFlushQueueStopped()) break bubbleRunLoop
              const replyToSticker = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const tsSticker = getCurrentTimeMs()
              const oidSticker = `wxm-${tsSticker}-ost-${i}-${Math.random().toString(36).slice(2, 6)}`
              try {
                const payloadSticker = await stickerUrlToImagePayload(url)
                const thinkingForSticker = !thinkingAttached && thinking ? thinking : undefined
                if (thinkingForSticker) thinkingAttached = true
                const incomingSticker: ChatMsg = {
                  id: oidSticker,
                  kind: 'msg',
                  from: 'other',
                  senderCharacterId: stickerEmitId,
                  text: formatStickerTranscriptLine(stickerRef),
                  stickerRef,
                  thinking: thinkingForSticker,
                  timestamp: tsSticker,
                  replyTo: replyToSticker ?? undefined,
                  images: [{ base64: payloadSticker.base64, type: payloadSticker.mime }],
                  otherAnimated: true,
                }
                const stickerStep = markEmittedThisRound(oidSticker, tsSticker, '[表情包]')
                const stickerGroupBump =
                  roomType === 'group' && groupId?.trim()
                    ? () => {
                        const gid = groupId.trim()
                        void (async () => {
                          try {
                            const gx = await personaDb.getGroupChat(gid)
                            if (!gx) return
                            const bumped = { ...gx, chatTurnSequence: (gx.chatTurnSequence ?? 0) + 1, updatedAt: Date.now() }
                            await personaDb.putGroupChat(bumped)
                            groupDocRef.current = bumped
                            setGroupLive(bumped)
                          } catch {
                            /* ignore turn bump */
                          }
                        })()
                      }
                    : undefined
                enqueueOpponentMessagesSequential([
                  {
                    forConversationKey: revealConvKey,
                    msg: incomingSticker,
                    persist: () => {
                      void personaDb
                        .appendWeChatChatMessage({
                          id: oidSticker,
                          characterId: stickerEmitId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: formatStickerTranscriptLine(stickerRef),
                          stickerRef,
                          thinking: thinkingForSticker,
                          replyTo: replyToSticker ?? undefined,
                          timestamp: incomingSticker.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                          notifyPeerTitle: stickerNotify.trim() || undefined,
                          images: [{ base64: payloadSticker.base64, type: payloadSticker.mime }],
                        })
                        .catch((e) => {
                          logger.log('error', `角色表情包落库失败: ${e instanceof Error ? e.message : String(e)}`)
                        })
                    },
                    afterReveal: withMusicSyncFlushOnBubbleRevealed(stickerStep, stickerGroupBump),
                  },
                ])
              } catch (e) {
                const errMsg = e instanceof Error ? e.message : String(e)
                logger.log('error', `角色表情包发送失败: ${errMsg}`)
                logConsole(
                  'ai',
                  `表情包加载失败(界面不显示)：${errMsg}；引用=${currentLine.trim().slice(0, 96)}`,
                )
              }
              continue
            }

            if (/^\[表情包\]/.test(String(currentLine ?? '').trim())) {
              logConsole(
                'ai',
                `表情包已跳过：引用名无法匹配资源库；行=${currentLine.trim().slice(0, 80)}`,
              )
              continue
            }

            const charImageGen = parseCharacterImageGenLine(currentLine)
            if (charImageGen) {
              if (!characterImageGenEnabled) {
                logConsole('ai', `[imagegen] 已跳过：支持发图已关闭`)
                continue
              }
              if (
                shouldSuppressCharacterImageLine(
                  roomType,
                  convMediaFreqRef.current.image,
                  roundImageAllowed,
                  roundUserExplicitImageRequest,
                  roundImagesEmittedCount,
                  convMediaFreqRef.current.imageCountMin,
                  convMediaFreqRef.current.imageCountMax,
                  roundImageCountTarget,
                )
              ) {
                logConsole(
                  'ai',
                  `[imagegen] 已跳过：本轮发图张数已达上限（emitted=${roundImagesEmittedCount}, target=${roundImageCountTarget}）`,
                )
                continue
              }
              const dedupeImageGen = `imagegen:${charImageGen.prompt || charImageGen.description}`
              if (emittedThisRound.has(dedupeImageGen)) {
                logConsole('ai', `[imagegen] 已跳过：本轮重复 prompt`)
                continue
              }
              emittedThisRound.add(dedupeImageGen)
              if (isFlushQueueStopped()) break bubbleRunLoop
              const replyToImage = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
              pendingReplyMessageId = undefined
              const tsImage = getCurrentTimeMs()
              const oidImage = `wxm-${tsImage}-oimg-${i}-${Math.random().toString(36).slice(2, 6)}`
              roundImagesEmittedCount += 1
              logConsole('ai', `[imagegen] 排队配图占位 id=${oidImage}`)
              const thinkingForImage = !thinkingAttached && thinking ? thinking : undefined
              if (thinkingForImage) thinkingAttached = true
              const incomingImage: ChatMsg = {
                id: oidImage,
                kind: 'msg',
                from: 'other',
                senderCharacterId: persistCharacterId,
                text: '',
                thinking: thinkingForImage,
                timestamp: tsImage,
                replyTo: replyToImage ?? undefined,
                imageGenAwaitingConfirm: true,
                imageDescription: charImageGen.description,
                imageGenPrompt: charImageGen.prompt,
                otherAnimated: true,
              }
              const imageStep = markEmittedThisRound(oidImage, tsImage, '（发送了一张图片）')
              enqueueOpponentMessagesSequential([
                {
                  forConversationKey: revealConvKey,
                  msg: incomingImage,
                  persist: () => {
                    void personaDb
                      .appendWeChatChatMessage({
                        id: oidImage,
                        characterId: persistCharacterId,
                        playerIdentityId: fxPlayerIdentityId,
                        type: 'character',
                        content: '',
                        thinking: thinkingForImage,
                        timestamp: incomingImage.timestamp,
                        isRead: true,
                        conversationKey: revealConvKey,
                        notifyPeerTitle: notifyPeerRound.trim() || undefined,
                        imageGenAwaitingConfirm: true,
                        imageDescription: charImageGen.description,
                        imageGenPrompt: charImageGen.prompt,
                      })
                      .catch((e) => {
                        logger.log('error', `角色 AI 配图占位落库失败: ${e instanceof Error ? e.message : String(e)}`)
                      })
                  },
                  afterReveal: withMusicSyncFlushOnBubbleRevealed(imageStep, undefined),
                },
              ])
              continue
            }

            const parsed = parseReplyMarker(currentLine)
            if (parsed.replyMessageId) {
              pendingReplyMessageId = parsed.replyMessageId
            }
            const segRaw = parsed.text.trim()
            const seg = sanitizeVoiceControlForTextBubble(segRaw) || segRaw
            if (!seg) continue
            const emitCharacterId =
              roomType === 'group' &&
              persistCharacterId.trim() !== WECHAT_GROUP_BOT_CHARACTER_ID &&
              /^(群管家|群助手|群机器人)\s*[：:]/u.test(seg.trimStart())
                ? WECHAT_GROUP_BOT_CHARACTER_ID
                : persistCharacterId
            const segForStore =
              emitCharacterId === WECHAT_GROUP_BOT_CHARACTER_ID
                ? normalizeGroupSmartBotBubblePlaintext(seg, groupDocRef.current ?? groupLive)
                : seg
            if (!String(segForStore).trim()) continue
            if (isMusicSyncDirectiveArtifactLine(String(segForStore)) || isMiniGameDirectiveArtifactLine(String(segForStore))) continue
            if (isCharacterMusicSyncDirectiveArtifactLine(String(segForStore))) continue
            if (isCharacterMiniGameInviteDirectiveArtifactLine(String(segForStore))) continue
            if (isLocationShareDirectiveArtifactLine(String(segForStore))) continue
            if (isTakeoutOrderDirectiveArtifactLine(String(segForStore))) continue
            if (isPulseCommentDirectiveArtifactLine(String(segForStore))) continue
            if (isPulseFollowDirectiveArtifactLine(String(segForStore))) continue
            characterPlainTextsThisRound.push(String(segForStore).trim())
            if (isFlushQueueStopped()) break bubbleRunLoop

            const replyToMeta = pendingReplyMessageId ? await buildReplyMetaById(pendingReplyMessageId) : null
            pendingReplyMessageId = undefined

            const ts = getCurrentTimeMs()
            const oid = `wxm-${ts}-o-${i}-${Math.random().toString(36).slice(2, 6)}`
            if (roomType === 'group' && groupId?.trim() && emitCharacterId !== WECHAT_GROUP_BOT_CHARACTER_ID) {
              const gid = groupId.trim()
              let g0 = (await personaDb.getGroupChat(gid)) ?? groupDocRef.current
              if (g0) {
                const pruned = pruneExpiredBotMutesOnGroup(g0, ts)
                if (pruned !== g0) {
                  try {
                    await personaDb.putGroupChat(pruned)
                  } catch {
                    /* ignore */
                  }
                  g0 = pruned
                  groupDocRef.current = pruned
                  setGroupLive(pruned)
                }
                const rule = matchGroupRobotRules(seg, g0.robotRules ?? [])
                if (rule) {
                  const mem = findGroupMember(g0, emitCharacterId)
                  const nick = groupNoticeMemberNickname(mem)
                  const { nextGroup, messages } = applyGroupSmartBotViolationPipeline({
                    group: g0,
                    offenderCharId: emitCharacterId,
                    offenderNickname: nick,
                    conversationKey: revealConvKey,
                    playerIdentityId: fxPlayerIdentityId,
                    nowMs: ts,
                    shieldedPlainText: seg,
                  })
                  try {
                    await personaDb.putGroupChat(nextGroup)
                    groupDocRef.current = nextGroup
                    setGroupLive(nextGroup)
                    const queuedUi: ChatMsg[] = []
                    for (const row of messages) {
                      const mappedRows = mapWeChatMessagesToChatItems([row])
                      const ui = mappedRows[0]
                      if (ui) queuedUi.push({ ...ui, otherAnimated: true })
                    }
                    enqueueOpponentMessagesSequential(
                      queuedUi.map((msg, idx) => ({
                        forConversationKey: revealConvKey,
                        msg,
                        persist: () => {
                          const row = messages[idx]
                          if (!row) return
                          void personaDb.appendWeChatChatMessage(row).catch(() => {})
                        },
                      })),
                    )
                  } catch {
                    /* ignore smart bot pipeline */
                  }
                  continue
                }
              }
            }
            const thinkingForRow = !thinkingAttached && thinking ? thinking : undefined
            const incoming: ChatMsg = {
              id: oid,
              kind: 'msg',
              from: 'other',
              senderCharacterId: emitCharacterId,
              text: segForStore,
              thinking: thinkingForRow,
              timestamp: ts,
              replyTo: replyToMeta ?? undefined,
              otherAnimated: true,
            }
            if (thinkingForRow) thinkingAttached = true
            const plainStep = markEmittedThisRound(oid, ts, segForStore)
            const plainGroupBump =
              roomType === 'group' && groupId?.trim()
                ? () => {
                    const gid = groupId.trim()
                    void (async () => {
                      try {
                        const gx = await personaDb.getGroupChat(gid)
                        if (!gx) return
                        const bumped = { ...gx, chatTurnSequence: (gx.chatTurnSequence ?? 0) + 1, updatedAt: Date.now() }
                        await personaDb.putGroupChat(bumped)
                        groupDocRef.current = bumped
                        setGroupLive(bumped)
                      } catch {
                        /* ignore turn bump */
                      }
                    })()
                  }
                : undefined
            let plainJobs: OpponentRevealJob[] = [
              {
                forConversationKey: revealConvKey,
                msg: incoming,
                persist: () => {
                  void personaDb
                    .appendWeChatChatMessage({
                      ...enrichWeChatCharacterMessageWithRoundRevert(
                        {
                          id: oid,
                          characterId: emitCharacterId,
                          playerIdentityId: fxPlayerIdentityId,
                          type: 'character',
                          content: segForStore,
                          thinking: thinkingForRow,
                          replyTo: replyToMeta ?? undefined,
                          timestamp: incoming.timestamp,
                          isRead: true,
                          conversationKey: revealConvKey,
                        },
                        pendingWorldBookRevertByCharRef.current,
                      ),
                      notifyPeerTitle:
                        emitCharacterId === WECHAT_GROUP_BOT_CHARACTER_ID
                          ? '群管家'
                          : notifyPeerRound.trim() || undefined,
                    })
                    .catch((err) => {
                      logger.log(
                        'error',
                        `appendWeChatChatMessage 失败 id=${oid} err=${err instanceof Error ? err.message : String(err)}`,
                      )
                    })
                },
                afterReveal: withMusicSyncFlushOnBubbleRevealed(plainStep, plainGroupBump),
              },
            ]
            enqueueOpponentMessagesSequential(plainJobs)
          } catch (err) {
            logger.log('error', `处理模型气泡行异常#${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
            continue
          }
        }
        if (
          pendingCharacterMusicSyncInvites.length > 0 ||
          pendingCharacterMusicSyncSeeks.length > 0 ||
          pendingCharacterMusicSyncPlays.length > 0 ||
          pendingCharacterMiniGameInvites.length > 0
        ) {
          enqueueMusicSyncRoundCompletionJob()
        }
        } finally {
          deferBubbleRevealEnqueueRef.current = false
          flushDeferredBubbleRevealJobs()
        }

        if (
          roomType !== 'group' &&
          !musicSyncDirectiveHandledThisRound &&
          characterPlainTextsThisRound.length > 0 &&
          shouldEngageMusicSyncInviteFlow([...extractMessages(itemsRef.current)].reverse())
        ) {
          const pendingInvite = findLatestPendingMusicInvite(extractMessages(itemsRef.current))
          if (pendingInvite) {
            const combined = characterPlainTextsThisRound.join(' ').trim()
            const verdict = adjudicateMusicSyncFromCharacterText(combined)
            const replyText = combined.slice(0, 500) || (verdict === 'accept' ? '频率已接轨。' : '现在没空，自己听吧。')
            if (verdict === 'accept') {
              enqueueOpponentMessagesSequential([
                createMusicSyncAcceptRevealJob(pendingInvite.invite, replyText),
              ])
            } else if (verdict === 'decline') {
              enqueueOpponentMessagesSequential([
                createMusicSyncDeclineRevealJob(pendingInvite.invite, replyText),
              ])
            }
          }
        }
        if (
          roomType !== 'group' &&
          !miniGameDirectiveHandledThisRound &&
          characterPlainTextsThisRound.length > 0
        ) {
          const pendingMiniGame = findLatestPendingMiniGameInvite(extractMessages(itemsRef.current))
          if (pendingMiniGame) {
            const combined = characterPlainTextsThisRound.join(' ').trim()
            const verdict = adjudicateMiniGameFromCharacterText(combined)
            const replyText = combined.slice(0, 500) || (verdict === 'accept' ? '好啊，来！' : '现在没空，下次吧。')
            if (verdict === 'accept') {
              enqueueOpponentMessagesSequential([
                createMiniGameAcceptRevealJob(
                  pendingMiniGame.invite,
                  replyText,
                  pendingMiniGame.messageId,
                ),
              ])
            } else if (verdict === 'decline') {
              enqueueOpponentMessagesSequential([
                createMiniGameDeclineRevealJob(
                  pendingMiniGame.invite,
                  replyText,
                  pendingMiniGame.messageId,
                ),
              ])
            }
          }
        }
        }

        const inlineDanmakuLines = danmakuLinesCollected
        if (inlineDanmakuLines.length > 0) {
          queueMicrotask(() => enqueueDanmakuLines(inlineDanmakuLines))
        } else if (
          danmakuEnabled &&
          danmakuConfigForRound &&
          danmakuApiForRound &&
          !danmakuSplitAttemptedForRound &&
          conversationKeyLiveRef.current.trim() === flushConversationKey
        ) {
          void (async () => {
            try {
              const splitLines = await requestWeChatDanmakuVarietyShow({
                apiConfig: danmakuApiForRound,
                character,
                playerIdentity,
                playerDisplayName: aiPlayerDisplayName,
                transcript: itemsToTranscript(buildChatItemsForAiTranscript(), transcriptSpeakerOpts),
                promptMode: pm,
                useMemory: danmakuConfigForRound.useMemory,
                generateCount: danmakuConfigForRound.generateCount,
                customRulesPrompt: danmakuConfigForRound.customPrompt,
                longTermMemoryNotes: memoryRound.trim() || undefined,
                longTermMemoryMomentImages:
                  memoryMomentImagesRound.length ? memoryMomentImagesRound : undefined,
                worldBackgroundPrompt,
                offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
                recentGroupChatsReference: recentGroupChatsReference || undefined,
                unsummarizedPrivateNotes: unsPrivateRound.trim() || undefined,
                unsummarizedGroupNotes: unsGroupRound.trim() || undefined,
                chatMemberIds: loreSceneMemberIds,
                globalWechatPlate: traceGlobalPlate,
              })
              if (splitLines.length > 0) queueMicrotask(() => enqueueDanmakuLines(splitLines))
            } catch (err) {
              logger.log('error', `弹幕补拉失败: ${err instanceof Error ? err.message : String(err)}`)
            }
          })()
        }
        if (clearBusyAfterReply) {
          await personaDb.putCharacterBusySettings({
            characterId: conversationCharacterId,
            isBusy: false,
            busyReason: '',
            busyStartTime: 0,
            busyEndTime: 0,
            busyDurationMinutes: 15,
            busyMessages: [],
          })
        }

        const skipMemoryRoundBumpThisTurn = skipMemoryRoundBumpRef.current
        if (skipMemoryRoundBumpThisTurn) skipMemoryRoundBumpRef.current = false

        void (async () => {
          if (skipMemoryRoundBumpThisTurn) return
          let shouldSummarizeNow = false
          try {
            const { shouldSummarize } = await personaDb.bumpMemoryAiRoundCount(conversationKey)
            shouldSummarizeNow = shouldSummarize
            if (!shouldSummarizeNow) return
            if (roomType === 'group' && groupId?.trim()) {
              await runGroupChatMemorySummaryAfterThreshold({
                apiConfig,
                conversationKey: revealConvKey,
                groupId: groupId.trim(),
                playerIdentityId: fxPlayerIdentityId,
              })
            } else {
              await runUnifiedAutoMemorySummaryAfterThreshold({
                apiConfig,
                conversationKey: revealConvKey,
                characterId: persistCharacterId,
                characterRealName: notifyPeerRound.trim() || peerNotifyTitle.trim() || '对方',
                sessionPlayerIdentityId: playerIdentityId,
              })
            }
          } catch (err) {
            if (shouldSummarizeNow) {
              await personaDb.rollbackMemoryAiRoundCountForRetry(conversationKey)
              const failureReason =
                err instanceof Error && err.message.trim()
                  ? err.message.trim()
                  : String(err)
              if (roomType === 'group' && groupId?.trim()) {
                await notifyMemorySummaryAttempt({
                  ok: false,
                  primaryWritten: false,
                  conversationKey: revealConvKey,
                  characterId: groupId.trim(),
                  displayName: peerNotifyTitle.trim() || '群聊',
                  kind: 'group',
                  groupId: groupId.trim(),
                  sessionPlayerIdentityId: playerIdentityId,
                  failureReason,
                })
              } else {
                const privSource = parseWechatAccountPrivateConversationKey(conversationKey)
                await notifyMemorySummaryAttempt({
                  ok: false,
                  primaryWritten: false,
                  conversationKey: revealConvKey,
                  characterId: persistCharacterId,
                  displayName: notifyPeerRound.trim() || peerNotifyTitle.trim() || '对方',
                  kind: 'private',
                  sessionPlayerIdentityId: playerIdentityId,
                  wechatAccountId: privSource?.wechatAccountId,
                  failureReason,
                })
              }
            }
            logger.log('error', `自动总结失败: ${err instanceof Error ? err.message : String(err)}`)
          }
        })()
      }
    } finally {
      flushOpponentRevealConvKeyRef.current = null
      setConversationFlushAiRepliesBusy(flushConversationKey, false)
      markProactiveMessageConversationAiBusy(flushConversationKey, false)
      setConversationFlushUiBusy(flushConversationKey, false)
      const pendingLeft = getConversationPendingAiReplies(flushConversationKey)
      setConversationAiCalling(flushConversationKey, pendingLeft > 0)
      if (
        pendingLeft <= 0 &&
        aiPipelineOwnerKeyRef.current?.trim() === flushConversationKey
      ) {
        aiPipelineOwnerKeyRef.current = null
        clearConversationFlushContext(flushConversationKey)
      }
      setConversationAwaitingAiKick(flushConversationKey, false)
      const pipelineStillActive = syncAiReplyPipelineActive(flushConversationKey)
      if (flushIsLive() && !pipelineStillActive) {
        setTypingVisible(false)
      }
      if (pendingLeft > 0) {
        queueMicrotask(() => {
          void flushAiReplies(flushConversationKey)
        })
      }
    }
  }, [
    apiConfig,
    conversationCharacterId,
    conversationKey,
    isSelfMemoChat,
    personaCharacterId,
    playerDisplayName,
    playerIdentityId,
    scrollToBottomSmooth,
    state.profile.displayName,
    useLumiProjectAssistantPrompt,
    loadPrivateGroupChatsRecentReference,
    buildPrivateMemoryInjectionForAi,
    peerNotifyTitle,
    enqueueDanmakuLines,
    danmakuEnabled,
    effectiveDm,
    danmakuApiConfig,
    showComposerToast,
    buildReplyMetaById,
    logger,
    showCenterToast,
    peerBusyRow?.enabled,
    peerBusyRow?.maxDuration,
    peerBusyRow?.customScenarios,
    mergeIncomingMessage,
    mergeOtherIncomingForRoom,
    getCurrentTimeMs,
    roomType,
    groupId,
    playerIdentityId,
    groupLive,
    groupAvatarByCharId,
    peerAvatarResolved,
    buildChatItemsForAiTranscript,
    buildChatItemsForAiTranscriptForKey,
    enqueueOpponentMessagesSequential,
    createPeerClaimedSelfRedPacketStripRevealJob,
    createCharacterTransferAcceptedAckRevealJob,
    createPeerReturnedSelfTransferStripRevealJob,
    createCharacterTransferReturnedAckRevealJob,
    createMusicSyncAcceptRevealJob,
    createMusicSyncDeclineRevealJob,
    createMiniGameAcceptRevealJob,
    createMiniGameDeclineRevealJob,
    ensureVoiceMessageAudio,
    syncAiReplyPipelineActive,
  ])

  /** 群聊主回复（含 <<GROUP_SET_…>> 等）单次 completion：pending 恒为 1，避免连发/重叠触发多次模型调用。 */
  const snapshotFlushContextForKey = useCallback(
    (ck: string) => {
      const key = ck.trim()
      if (!key) return
      setConversationFlushContext({
        conversationKey: key,
        conversationCharacterId,
        personaCharacterId: personaCharacterId?.trim() ?? '',
        roomType,
        groupId: groupId?.trim() || null,
        playerIdentityId,
        peerNotifyTitle,
        useLumiProjectAssistantPrompt,
        isSelfMemoChat,
      })
    },
    [
      conversationCharacterId,
      personaCharacterId,
      roomType,
      groupId,
      playerIdentityId,
      peerNotifyTitle,
      useLumiProjectAssistantPrompt,
      isSelfMemoChat,
    ],
  )

  const bumpPendingAiRepliesForReply = useCallback(() => {
    const ck = conversationKey.trim()
    pendingAiRepliesKeyRef.current = ck
    snapshotFlushContextForKey(ck)
    if (roomType === 'group' && groupId?.trim()) {
      pendingAiRepliesRef.current = 1
    } else {
      pendingAiRepliesRef.current += 1
    }
  }, [roomType, groupId, snapshotFlushContextForKey, conversationKey])

  const deferResetProactiveMessageCountdown = useCallback(() => {
    if (!proactiveCountdownEnabled) return
    void resetProactiveMessageCountdown(conversationKey)
  }, [proactiveCountdownEnabled, conversationKey])

  /** 空输入点纸飞机 / 回车等方式手动催回复：顺带重置主动消息倒计时，避免与角色回复撞车。 */
  const triggerManualCharacterReply = useCallback(() => {
    const ck = conversationKey.trim()
    if (ck && isConversationAiPipelineBusy(ck)) {
      return
    }
    manualAiPauseRef.current = false
    deferResetProactiveMessageCountdown()
    bumpPendingAiRepliesForReply()
    syncAiReplyPipelineActive(ck)
                void flushAiReplies(conversationKey.trim())
  }, [
    conversationKey,
    deferResetProactiveMessageCountdown,
    bumpPendingAiRepliesForReply,
    flushAiReplies,
    syncAiReplyPipelineActive,
    isConversationAiPipelineBusy,
  ])

  const handleSendGameInvite = useCallback(
    (gameType: MiniGameType) => {
      if (!isGameAvailable(gameType)) {
        showComposerToast('该游戏尚在开发中')
        return
      }
      if (roomType === 'group') {
        showComposerToast('小游戏邀请仅支持私聊')
        return
      }
      const invite = buildMiniGameInvitePayload({ gameType })
      const ts = getCurrentTimeMs()
      const msgId = `wxm-${ts}-mgi-${Math.random().toString(36).slice(2, 8)}`
      const incoming: ChatMsg = {
        id: msgId,
        kind: 'msg',
        from: 'self',
        text: '[游戏邀请]',
        timestamp: ts,
        status: 'sent',
        selfAnimated: true,
        miniGameInvite: invite,
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([...extractMessages(prev), incoming])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
      void (async () => {
        try {
          await personaDb.appendWeChatChatMessage({
            id: msgId,
            characterId: conversationCharacterId,
            playerIdentityId,
            type: 'player',
            content: '[游戏邀请]',
            miniGameInvite: invite,
            timestamp: ts,
            isRead: true,
            conversationKey,
          })
          emitWeChatStorageChanged()
        } catch {
          /* ignore */
        }
      })()
      showComposerToast('已发送游戏邀请')
      // 与拍摄/相册/表情包一致：发出后不自动拉模型，由用户点纸飞机或空输入回车等方式触发回复
    },
    [
      conversationCharacterId,
      conversationKey,
      extractMessages,
      getCurrentTimeMs,
      playerIdentityId,
      rebuildWithCurrentTime,
      roomType,
      scrollToBottomSmooth,
      showComposerToast,
    ],
  )

  const busyExpireHandledEndRef = useRef(0)
  useEffect(() => {
    if (!globalDm?.busyEnabled) return
    const busySwitchEnabled = globalDm.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : globalModeBusyEnabled
    if (!busySwitchEnabled) return
    if (!peerBusyRow?.isBusy || peerBusyRow.busyEndTime <= 0) {
      busyExpireHandledEndRef.current = 0
      return
    }
    const end = peerBusyRow.busyEndTime
    const ms = Math.max(0, end - getCurrentTimeMs())
    const ck = conversationKey.trim()
    const t = window.setTimeout(() => {
      if (busyExpireHandledEndRef.current === end) return
      busyExpireHandledEndRef.current = end
      bumpPendingAiRepliesForReply()
      void flushAiReplies(ck)
    }, ms + 30)
    return () => window.clearTimeout(t)
  }, [globalDm?.busyEnabled, globalDm?.busyMode, peerBusyRow?.isBusy, peerBusyRow?.busyEndTime, peerBusyRow?.enabled, globalModeBusyEnabled, flushAiReplies, getCurrentTimeMs, bumpPendingAiRepliesForReply, conversationKey])

  useEffect(() => {
    if (!peerBusyRow?.isBusy || peerBusyRow.busyEndTime <= 0) {
      busyExpireHandledEndRef.current = 0
      return
    }
    const end = peerBusyRow.busyEndTime
    const ms = Math.max(0, end - getCurrentTimeMs())
    const ck = conversationKey.trim()
    const t = window.setTimeout(() => {
      if (getCurrentTimeMs() < end) return
      if (busyExpireHandledEndRef.current === end) return
      busyExpireHandledEndRef.current = end
      bumpPendingAiRepliesForReply()
      void flushAiReplies(ck)
    }, ms + 30)
    return () => window.clearTimeout(t)
  }, [peerBusyRow?.isBusy, peerBusyRow?.busyEndTime, flushAiReplies, getCurrentTimeMs, bumpPendingAiRepliesForReply, conversationKey])

  useEffect(() => {
    if (!skipBusySignal) return
    const now = Date.now()
    if (now - skipBusyLastTriggerMsRef.current < 1200) return
    skipBusyLastTriggerMsRef.current = now
    skipBusyBypassRef.current = true
    deferResetProactiveMessageCountdown()
    bumpPendingAiRepliesForReply()
    void flushAiReplies(conversationKey.trim())
  }, [skipBusySignal, flushAiReplies, conversationKey, deferResetProactiveMessageCountdown, bumpPendingAiRepliesForReply])

  const commitSendRef = useRef<(raw: string, triggerAi: boolean) => void>(() => {})

  const commitSend = useCallback(
    (raw: string, triggerAi: boolean) => {
      const text = raw.trim()
      if (!text) return

      if (triggerAi && !isSelfMemoChat) {
        const ck = conversationKeyLiveRef.current.trim()
        if (ck && isConversationAiPipelineBusyRef.current(ck)) {
          showComposerToast('对方正在回复，请稍候')
          return
        }
      }

      const nowFp = Date.now()
      const lastFp = lastSendFingerprintRef.current
      if (lastFp && lastFp.text === text && nowFp - lastFp.at < SEND_DEDUPE_WINDOW_MS) return
      lastSendFingerprintRef.current = { text, at: nowFp }

      if (roomType === 'group' && groupLive && textMentionsGroupEveryone(text)) {
        if (!userCanAccessGroupAdminLevelInClient(groupLive)) {
          showCenterToast('仅群主或管理员可@所有人')
          return
        }
      }

      const replyTo = replyingToRef.current ?? undefined
      if (enterDebounceTimerRef.current != null) {
        window.clearTimeout(enterDebounceTimerRef.current)
        enterDebounceTimerRef.current = null
      }
      lastEnterDownRef.current = 0

      manualAiPauseRef.current = false
      if (processingSendRef.current) {
        if (triggerAi && !isSelfMemoChat) {
          const ck = conversationKeyLiveRef.current.trim()
          if (ck && isConversationAiPipelineBusyRef.current(ck)) {
            showComposerToast('对方正在回复，请稍候')
            return
          }
        }
        sendQueueRef.current.push({ text, triggerAi })
        return
      }
      /** 须在 processingSend 判定之后：若仅入队就 return，异步 finally 不会跑，不能把 opponentQueueStopRef 置 true，否则会永久卡住对方回复落库流程 */
      const sendCk = conversationKeyLiveRef.current.trim()
      processingSendKeyRef.current = sendCk
      if (sendCk) setConversationOpponentQueueStop(sendCk, true)
      flushOpponentRevealQueueImmediate()
      setTypingVisible(false)
      processingSendRef.current = true
      setDraft('')
      clearWeChatComposerField(textareaRef.current)
      setSendBusy(true)
      setReplyingTo(null)
      clearUiOnlyHiddenCutLocal()
      const ts = getCurrentTimeMs()
      const id = `wxm-${ts}-s-${Math.random().toString(36).slice(2, 8)}`
      let groupViolationHandled = false
      let userMutedNoSend = false
      void (async () => {
        try {
          if (roomType === 'group' && groupId?.trim()) {
            const gid = groupId.trim()
            let g0 = (await personaDb.getGroupChat(gid)) ?? groupLive
            if (g0) {
              const memSelf = findGroupMember(g0, WECHAT_GROUP_USER_CHAR_ID)
              if (memSelf && groupMemberSpeechBlockedInGroup(memSelf, getCurrentTimeMs())) {
                showCenterToast('禁言中，请稍后再试')
                userMutedNoSend = true
                return
              }
              const pruned = pruneExpiredBotMutesOnGroup(g0, getCurrentTimeMs())
              if (pruned !== g0) {
                try {
                  await personaDb.putGroupChat(pruned)
                } catch {
                  /* ignore */
                }
                g0 = pruned
                groupDocRef.current = pruned
                setGroupLive(pruned)
              }
              const rule = matchGroupRobotRules(text, g0.robotRules ?? [])
              if (rule) {
                const nick = groupNoticeMemberNickname(findGroupMember(g0, WECHAT_GROUP_USER_CHAR_ID))
                const { nextGroup, messages } = applyGroupSmartBotViolationPipeline({
                  group: g0,
                  offenderCharId: WECHAT_GROUP_USER_CHAR_ID,
                  offenderNickname: nick,
                  conversationKey,
                  playerIdentityId,
                  nowMs: ts,
                  shieldedPlainText: text,
                })
                await personaDb.putGroupChat(nextGroup)
                groupDocRef.current = nextGroup
                setGroupLive(nextGroup)
                const appended: ChatMsg[] = []
                for (const row of messages) {
                  try {
                    await personaDb.appendWeChatChatMessage(row)
                  } catch {
                    /* ignore */
                  }
                  for (const ui of mapWeChatMessagesToChatItems([row])) {
                    appended.push({ ...ui, otherAnimated: true })
                  }
                }
                setItems((prev) => {
                  let next = prev
                  for (const m of appended) {
                    next = mergeIncomingMessage(next, m)
                  }
                  itemsRef.current = next
                  return next
                })
                emitWeChatStorageChanged()
                scrollToBottomSmooth()
                groupViolationHandled = true
                // 违禁会提前 return，原先会跳过整条「@ 群管家」对话回复；仍尝试落一条对话式应答（可与违禁提示并存）
                const gForAt = groupDocRef.current ?? nextGroup
                if (
                  textMentionsGroupSmartBot(text, gForAt) &&
                  apiConfig?.apiUrl?.trim() &&
                  apiConfig?.apiKey?.trim() &&
                  apiConfig?.modelId?.trim()
                ) {
                  try {
                    const gLine =
                      gForAt.members
                        .filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID && m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID)
                        .map((m) => `${m.groupNickname || m.charId}`)
                        .join('、') || '（成员）'
                    const reply = await requestGroupSmartBotAtReply({
                      apiConfig,
                      userQuestion: text,
                      memberNicknamesLine: gLine,
                    })
                    const t1 = getCurrentTimeMs()
                    const bid = `wxm-${t1}-atbot-v-${Math.random().toString(36).slice(2, 8)}`
                    const row: WeChatChatMessage = {
                      id: bid,
                      characterId: WECHAT_GROUP_BOT_CHARACTER_ID,
                      playerIdentityId,
                      type: 'character',
                      content: reply,
                      timestamp: t1,
                      isRead: true,
                      conversationKey,
                    }
                    await personaDb.appendWeChatChatMessage(row)
                    const [ui] = mapWeChatMessagesToChatItems([row])
                    if (ui) {
                      setItems((prev) => {
                        const next = mergeIncomingMessage(prev, { ...ui, otherAnimated: true })
                        itemsRef.current = next
                        return next
                      })
                      emitWeChatStorageChanged()
                      scrollToBottomSmooth()
                    }
                  } catch {
                    showComposerToast('群管家 @ 回复失败，请稍后再试')
                  }
                }
                return
              }
            }
          }
          if (!groupViolationHandled) {
            try {
              await personaDb.appendWeChatChatMessage({
                id,
                characterId: conversationCharacterId,
                playerIdentityId,
                type: 'player',
                content: text,
                replyTo,
                timestamp: ts,
                isRead: true,
                conversationKey,
              })
            } catch {
              /* ignore */
            }
            void (async () => {
              try {
                const busyGs = await personaDb.getGlobalSettings()
                const busyConvEnabledRaw = await personaDb.getPhoneKv(`busy-conv:${conversationKey}`)
                const busyConvEnabled = typeof busyConvEnabledRaw === 'boolean' ? busyConvEnabledRaw : true
                const busySwitchEnabled =
                  busyGs.busyEnabled && (busyGs.busyMode === 'character' ? (peerBusyRow?.enabled ?? true) : busyConvEnabled)
                if (!busySwitchEnabled) return
                const row = await personaDb.getCharacterBusySettings(conversationCharacterId)
                if (!row?.isBusy || row.busyEndTime <= getCurrentTimeMs()) return
                await personaDb.putCharacterBusySettings({
                  characterId: conversationCharacterId,
                  busyMessages: [
                    ...(row.busyMessages ?? []),
                    {
                      id,
                      characterId: conversationCharacterId,
                      playerIdentityId,
                      type: 'player',
                      content: text,
                      timestamp: ts,
                      isRead: true,
                      conversationKey,
                    },
                  ],
                })
              } catch {
                /* ignore */
              }
            })()
            setItems((prev) => {
              const base = extractMessages(prev).filter((m) => m.id !== id)
              const next = rebuildWithCurrentTime([
                ...base,
                { id, kind: 'msg', from: 'self', text, timestamp: ts, replyTo, status: 'sent', selfAnimated: true },
              ])
              itemsRef.current = next
              return next
            })
            if (roomType === 'group' && groupId?.trim()) {
              try {
                const gid = groupId.trim()
                const gx = await personaDb.getGroupChat(gid)
                if (gx) {
                  const bumped = { ...gx, chatTurnSequence: (gx.chatTurnSequence ?? 0) + 1, updatedAt: Date.now() }
                  await personaDb.putGroupChat(bumped)
                  groupDocRef.current = bumped
                  setGroupLive(bumped)
                }
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* ignore */
        } finally {
          scrollToBottomSmooth()
          window.setTimeout(() => {
            setSendBusy(false)
            processingSendRef.current = false
            if (sendCk) setConversationOpponentQueueStop(sendCk, false)
            const next = sendQueueRef.current.shift()
            if (next?.text.trim()) {
              window.setTimeout(() => void commitSendRef.current(next.text, next.triggerAi), 0)
            }
          }, 260)
        }
        if (triggerAi && !userMutedNoSend && !isSelfMemoChat) {
          aiPipelineOwnerKeyRef.current = sendCk
          aiCallingRef.current = true
          lastUserAiTriggerTsRef.current = ts
          setConversationAwaitingAiKick(sendCk, true)
          syncAiReplyPipelineActive(sendCk)
          queueMicrotask(() => {
            void (async () => {
              if (sendCk) setConversationOpponentQueueStop(sendCk, false)
              if (roomType === 'group' && groupId?.trim()) {
                const g = await personaDb.getGroupChat(groupId.trim())
                groupDocRef.current = g
              }
              /** @ 群管家：必须先落一条「角色式」回复，再跑多角色群聊；原先写在 flush 之后，flush 失败/久挂会导致永远不回复 */
              const appendGroupSmartBotMentionReply = async (): Promise<void> => {
                const gNow = groupDocRef.current ?? groupLive
                if (roomType !== 'group' || !groupId?.trim() || !textMentionsGroupSmartBot(text, gNow)) {
                  return
                }
                if (!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() || !apiConfig?.modelId?.trim()) {
                  showComposerToast('未配置 AI API，群管家无法应答 @')
                  return
                }
                try {
                  const gLine =
                    gNow?.members
                      .filter((m) => m.charId !== WECHAT_GROUP_USER_CHAR_ID && m.charId !== WECHAT_GROUP_BOT_CHARACTER_ID)
                      .map((m) => `${m.groupNickname || m.charId}`)
                      .join('、') || '（成员）'
                  const reply = await requestGroupSmartBotAtReply({
                    apiConfig,
                    userQuestion: text,
                    memberNicknamesLine: gLine,
                  })
                  const t1 = getCurrentTimeMs()
                  const bid = `wxm-${t1}-atbot-${Math.random().toString(36).slice(2, 8)}`
                  const row: WeChatChatMessage = {
                    id: bid,
                    characterId: WECHAT_GROUP_BOT_CHARACTER_ID,
                    playerIdentityId,
                    type: 'character',
                    content: reply,
                    timestamp: t1,
                    isRead: true,
                    conversationKey,
                  }
                  await personaDb.appendWeChatChatMessage(row)
                  const [ui] = mapWeChatMessagesToChatItems([row])
                  if (ui) {
                    setItems((prev) => {
                      const next = mergeIncomingMessage(prev, { ...ui, otherAnimated: true })
                      itemsRef.current = next
                      return next
                    })
                    emitWeChatStorageChanged()
                    scrollToBottomSmooth()
                  }
                } catch {
                  showComposerToast('群管家 @ 回复失败，请稍后再试')
                }
              }

              bumpPendingAiRepliesForReply()
              await appendGroupSmartBotMentionReply()
              try {
                await flushAiReplies(sendCk)
              } catch (err) {
                logger.log(
                  'error',
                  `群聊多角色生成失败（@群管家已优先尝试）：${err instanceof Error ? err.message : String(err)}`,
                )
              }
            })()
          })
        }
      })()
    },
    [
      conversationCharacterId,
      conversationKey,
      clearUiOnlyHiddenCutLocal,
      extractMessages,
      flushAiReplies,
      getCurrentTimeMs,
      playerIdentityId,
      rebuildWithCurrentTime,
      scrollToBottomSmooth,
      peerBusyRow?.enabled,
      roomType,
      groupId,
      groupLive,
      showCenterToast,
      showComposerToast,
      bumpPendingAiRepliesForReply,
      deferResetProactiveMessageCountdown,
      apiConfig,
      mergeIncomingMessage,
      personaCharacterId,
      useLumiProjectAssistantPrompt,
      isSelfMemoChat,
      syncAiReplyPipelineActive,
    ],
  )

  commitSendRef.current = commitSend

  const commitSendFavoriteSharedRecord = useCallback(
    async (item: FavoriteItem) => {
      if (favoriteShareSending) return
      if (roomType !== 'private' || useLumiProjectAssistantPrompt || isSelfMemoChat) {
        showComposerToast('请在角色私聊中使用收藏转发')
        return
      }
      const peerId = conversationCharacterId.trim()
      if (!peerId) {
        showComposerToast('当前会话无效')
        return
      }
      setFavoriteShareSending(true)
      try {
        const payload = await buildSharedRecordPayloadFromFavorite(item)
        const result = await sendSharedRecordToContact(peerId, payload)
        const stored = await personaDb.getWeChatChatMessageById(result.messageId)
        if (stored) {
          const mapped = mapWeChatMessagesToChatItems([stored])
          const ui = mapped[0]
          if (ui) {
            setItems((prev) => {
              const next = mergeIncomingMessage(prev, { ...ui, selfAnimated: true })
              itemsRef.current = next
              return next
            })
          }
        }
        setFavoritesPickerOpen(false)
        setPlusMenuOpen(false)
        setStubPanel(null)
        scrollToBottomSmooth()
        showComposerToast('已发送收藏')
      } catch (err) {
        showComposerToast(err instanceof Error ? err.message : '发送失败')
      } finally {
        setFavoriteShareSending(false)
      }
    },
    [
      conversationCharacterId,
      favoriteShareSending,
      isSelfMemoChat,
      mergeIncomingMessage,
      roomType,
      scrollToBottomSmooth,
      showComposerToast,
      useLumiProjectAssistantPrompt,
    ],
  )

  useEffect(() => {
    if (embedMode !== 'quick-reply' || !onEmbedSendReady) return
    onEmbedSendReady({
      sendText: (text: string) => commitSendRef.current(text, true),
    })
  }, [embedMode, onEmbedSendReady, commitSend])

  const commitMessageEdit = useCallback(async () => {
    const modal = messageEditModal
    if (!modal || messageEditSaving) return
    const messageId = modal.id.trim()
    const text = messageEditDraft.trim()
    if (!text) {
      showCenterToast('内容不能为空')
      return
    }
    setMessageEditSaving(true)
    try {
      const row = await personaDb.getWeChatChatMessageById(messageId)
      if (!row || row.isRecalled || (row.type !== 'player' && row.type !== 'character')) {
        showCenterToast('无法保存编辑')
        return
      }
      if (row.images?.length || row.redPacket || row.transfer || row.voice || row.callStatus) {
        showCenterToast('仅支持编辑纯文字消息')
        return
      }
      await personaDb.patchWeChatChatMessageById(messageId, { content: text })
      setItems((prev) => {
        const next = rebuildWithCurrentTime(
          extractMessages(prev).map((msg) => (msg.id === messageId ? { ...msg, text } : msg)),
        )
        itemsRef.current = next
        return next
      })
      showCenterToast('已更新')
      setMessageEditModal(null)
      setMessageEditDraft('')
    } catch {
      showCenterToast('保存失败，请重试')
    } finally {
      setMessageEditSaving(false)
    }
  }, [
    messageEditModal,
    messageEditDraft,
    messageEditSaving,
    extractMessages,
    rebuildWithCurrentTime,
    showCenterToast,
  ])

  useLayoutEffect(() => {
    if (!messageEditModal) return
    const ta = messageEditTextareaRef.current
    if (!ta) return
    ta.focus()
    const len = ta.value.length
    try {
      ta.setSelectionRange(len, len)
    } catch {
      /* ignore */
    }
  }, [messageEditModal])

  const appendVoiceMessage = useCallback(
    async (opts: {
      durationSec: number
      audioBlob?: Blob | null
      transcriptText?: string
      emotion?: string
      ttsScript?: string
    }) => {
      const ts = getCurrentTimeMs()
      const id = `wxm-${ts}-voice-${Math.random().toString(36).slice(2, 8)}`
      const audioUrl = opts.audioBlob ? await blobToDataUrl(opts.audioBlob) : ''
      const transcriptText = sanitizeVoiceTranscriptDisplay(opts.transcriptText?.trim() || '')
      const emotionLabel = opts.emotion?.trim() || ''
      const ttsScript = opts.ttsScript?.trim() || undefined
      const voice = {
        durationSec: Math.max(1, opts.durationSec),
        emotionAnalyzed: true,
        emotionLabel: emotionLabel || undefined,
        ttsScript,
        audioUrl: audioUrl || undefined,
        transcriptText: transcriptText || undefined,
      }
      const persistedContent = transcriptText || '[语音]'
      try {
        await personaDb.appendWeChatChatMessage({
          id,
          characterId: conversationCharacterId,
          playerIdentityId,
          type: 'player',
          content: persistedContent,
          voice,
          timestamp: ts,
          isRead: true,
          conversationKey,
        })
      } catch {
        // ignore
      }
      setItems((prev) => {
        const next = rebuildWithCurrentTime([
          ...extractMessages(prev),
          {
            id,
            kind: 'msg',
            from: 'self',
            text: persistedContent,
            timestamp: ts,
            voice,
            status: 'sent',
            selfAnimated: true,
          },
        ])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
      // 与拍摄/相册/表情包一致：语音只发出去，不自动拉模型；用户需点纸飞机或空输入回车等方式再触发回复。
    },
    [conversationCharacterId, conversationKey, extractMessages, getCurrentTimeMs, playerIdentityId, rebuildWithCurrentTime, scrollToBottomSmooth],
  )

  const commitSendLocationToContact = useCallback(
    async (characterId: string, payload: WeChatLocationPayload) => {
      const targetId = characterId.trim()
      if (!targetId) throw new Error('请选择好友')
      const result = await sendLocationToContact(targetId, payload)
      const isCurrentChat = targetId === conversationCharacterId.trim()
      if (isCurrentChat && roomType === 'private') {
        manualAiPauseRef.current = false
        if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
        setTypingVisible(false)
        const stored = await personaDb.getWeChatChatMessageById(result.messageId)
        const ts = stored?.timestamp ?? Date.now()
        const content = locationShareContentFallback(payload)
        setItems((prev) => {
          const next = rebuildWithCurrentTime([
            ...extractMessages(prev),
            {
              id: result.messageId,
              kind: 'msg',
              from: 'self',
              text: content,
              timestamp: ts,
              locationShare: payload,
              status: 'sent',
              selfAnimated: true,
            },
          ])
          itemsRef.current = next
          return next
        })
        setLocationSpoofOpen(false)
        setPlusMenuOpen(false)
        setStubPanel(null)
        scrollToBottomSmooth()
        if (!isSelfMemoChat) {
          const ck = conversationKey.trim()
          if (ck && isConversationAiPipelineBusy(ck)) {
            showComposerToast('对方正在回复，请稍候')
            if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
            return
          }
          aiPipelineOwnerKeyRef.current = conversationKey.trim()
          aiCallingRef.current = true
          lastUserAiTriggerTsRef.current = ts
          setConversationAwaitingAiKick(conversationKey.trim(), true)
          syncAiReplyPipelineActive(conversationKey)
          queueMicrotask(() => {
            void (async () => {
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
              deferResetProactiveMessageCountdown()
              bumpPendingAiRepliesForReply()
              void flushAiReplies(conversationKey.trim())
            })()
          })
        } else {
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
        }
      } else {
        setLocationSpoofOpen(false)
        setPlusMenuOpen(false)
        setStubPanel(null)
        showComposerToast('已发送位置')
      }
    },
    [
      bumpPendingAiRepliesForReply,
      conversationCharacterId,
      conversationKey,
      deferResetProactiveMessageCountdown,
      extractMessages,
      flushAiReplies,
      isSelfMemoChat,
      rebuildWithCurrentTime,
      roomType,
      scrollToBottomSmooth,
      showComposerToast,
      isConversationAiPipelineBusy,
      syncAiReplyPipelineActive,
    ],
  )

  const commitSendLocation = useCallback(
    async (payload: WeChatLocationPayload) => {
      if (locationSending) return
      if (roomType !== 'private') {
        showComposerToast('请在私聊中使用位置分享')
        return
      }
      setLocationSending(true)
      try {
        await commitSendLocationToContact(conversationCharacterId, payload)
      } catch {
        showComposerToast('位置发送失败，请重试')
      } finally {
        setLocationSending(false)
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
      }
    },
    [
      commitSendLocationToContact,
      conversationCharacterId,
      locationSending,
      roomType,
      showComposerToast,
    ],
  )

  const commitSendImage = useCallback(
    (base64: string, triggerAi: boolean, mime: WeChatImageMime = 'image/jpeg', contentCaption = '') => {
      let clipped = base64.trim()
      // 兼容传入 dataURL / 纯 base64 两种形态
      clipped = clipped.replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '').trim()
      if (!clipped) return
      // 过短一般代表异常（比如没有真正拿到图片）
      if (clipped.length < 64) {
        showComposerToast('图片处理失败，请重试')
        logger.log('error', `commitSendImage: base64 过短 len=${clipped.length}`)
        return
      }
      logger.log('frontend', `commitSendImage: len=${clipped.length} triggerAi=${String(triggerAi)}`)
      if (triggerAi && !isSelfMemoChat) {
        const ck = conversationKeyLiveRef.current.trim()
        if (ck && isConversationAiPipelineBusyRef.current(ck)) {
          showComposerToast('对方正在回复，请稍候')
          return
        }
      }
      manualAiPauseRef.current = false
      if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
      setTypingVisible(false)
      setDraft('')
      const replyTo = replyingToRef.current ?? undefined
      setReplyingTo(null)
      setSendBusy(true)
      const ts = getCurrentTimeMs()
      const id = `wxm-${ts}-img-s-${Math.random().toString(36).slice(2, 8)}`
      void (async () => {
        try {
          logger.log('indexeddb', `appendWeChatChatMessage(image): id=${id} len=${clipped.length}`)
          await personaDb.appendWeChatChatMessage({
            id,
            characterId: conversationCharacterId,
            playerIdentityId,
            type: 'player',
            content: contentCaption.trim(),
            replyTo,
            images: [{ base64: clipped, type: mime }],
            timestamp: ts,
            isRead: true,
            conversationKey,
          })
          logger.log('indexeddb', `appendWeChatChatMessage(image): ok id=${id}`)

          // 关键：立刻从库里读回归一化后的消息，避免“即时 state 与落库结构不一致”
          const stored = await personaDb.getWeChatChatMessageById(id)
          if (stored?.images?.[0]?.base64?.trim()) {
            logger.log('indexeddb', `hydrate(image): ok id=${id} len=${stored.images[0].base64.length}`)
            setItems((prev) => {
              const next = rebuildWithCurrentTime(extractMessages(prev).map((it) => {
                if (it.kind !== 'msg' || it.id !== id) return it
                return {
                  ...it,
                  text: stored.content ?? '',
                  images: stored.images,
                }
              }))
              itemsRef.current = next
              return next
            })
          } else {
            logger.log('error', `hydrate(image): missing images id=${id}`)
          }
        } catch {
          logger.log('error', `appendWeChatChatMessage(image) failed`)
          /* ignore */
        }
      })()
      setItems((prev) => {
        logger.log('frontend', `state insert(image): id=${id} len=${clipped.length}`)
        const next = rebuildWithCurrentTime([
          ...extractMessages(prev),
          {
            id,
            kind: 'msg',
            from: 'self',
            text: contentCaption.trim(),
            timestamp: ts,
            replyTo: replyTo ?? undefined,
            images: [{ base64: clipped, type: mime }],
            status: 'sent',
            selfAnimated: true,
          },
        ])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
      window.setTimeout(() => {
        setSendBusy(false)
        processingSendRef.current = false
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
      }, 260)
      if (triggerAi && !isSelfMemoChat) {
        aiPipelineOwnerKeyRef.current = conversationKey.trim()
        aiCallingRef.current = true
        lastUserAiTriggerTsRef.current = ts
        setConversationAwaitingAiKick(conversationKey.trim(), true)
        syncAiReplyPipelineActive(conversationKey)
        queueMicrotask(() => {
          void (async () => {
            if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
            deferResetProactiveMessageCountdown()
            if (roomType === 'group' && groupId?.trim()) {
              const g = await personaDb.getGroupChat(groupId.trim())
              groupDocRef.current = g
            }
            bumpPendingAiRepliesForReply()
            void flushAiReplies(conversationKey.trim())
          })()
        })
      }
    },
    [
      conversationCharacterId,
      conversationKey,
      extractMessages,
      flushAiReplies,
      isSelfMemoChat,
      getCurrentTimeMs,
      playerIdentityId,
      rebuildWithCurrentTime,
      scrollToBottomSmooth,
      showComposerToast,
      logger,
      roomType,
      groupId,
      bumpPendingAiRepliesForReply,
      deferResetProactiveMessageCountdown,
      flushOpponentRevealQueueImmediate,
    ],
  )

  const commitSendImages = useCallback(
    (payloads: WeChatChatImagePayload[], triggerAi = false) => {
      const normalized = payloads
        .map(({ base64, mime }) => {
          let clipped = base64.trim().replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '').trim()
          if (!clipped || clipped.length < 64) return null
          return { base64: clipped, mime }
        })
        .filter((row): row is WeChatChatImagePayload => row != null)
      if (!normalized.length) {
        showComposerToast('图片处理失败，请重试')
        return
      }

      if (triggerAi && !isSelfMemoChat) {
        const ck = conversationKeyLiveRef.current.trim()
        if (ck && isConversationAiPipelineBusyRef.current(ck)) {
          showComposerToast('对方正在回复，请稍候')
          return
        }
      }

      manualAiPauseRef.current = false
      if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
      setTypingVisible(false)
      setDraft('')
      const replyTo = replyingToRef.current ?? undefined
      setReplyingTo(null)
      setSendBusy(true)

      const tsBase = getCurrentTimeMs()
      const pending = normalized.map((img, index) => {
        const ts = tsBase + index
        const id = `wxm-${ts}-img-s-${Math.random().toString(36).slice(2, 8)}`
        return {
          id,
          ts,
          images: [{ base64: img.base64, type: img.mime }] as { base64: string; type: WeChatImageMime }[],
        }
      })

      void (async () => {
        try {
          for (let index = 0; index < pending.length; index += 1) {
            const row = pending[index]!
            logger.log('indexeddb', `appendWeChatChatMessage(image): id=${row.id} len=${row.images[0]!.base64.length}`)
            await personaDb.appendWeChatChatMessage({
              id: row.id,
              characterId: conversationCharacterId,
              playerIdentityId,
              type: 'player',
              content: '',
              replyTo: index === 0 ? replyTo : undefined,
              images: row.images,
              timestamp: row.ts,
              isRead: true,
              conversationKey,
            })
          }
        } catch {
          logger.log('error', 'appendWeChatChatMessage(image batch) failed')
        }
      })()

      setItems((prev) => {
        const next = rebuildWithCurrentTime([
          ...extractMessages(prev),
          ...pending.map((row, index) => ({
            id: row.id,
            kind: 'msg' as const,
            from: 'self' as const,
            text: '',
            timestamp: row.ts,
            replyTo: index === 0 ? replyTo ?? undefined : undefined,
            images: row.images,
            status: 'sent' as const,
            selfAnimated: true,
          })),
        ])
        itemsRef.current = next
        return next
      })
      scrollToBottomSmooth()
      window.setTimeout(() => {
        setSendBusy(false)
        processingSendRef.current = false
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
      }, 260)
      if (triggerAi && !isSelfMemoChat) {
        aiPipelineOwnerKeyRef.current = conversationKey.trim()
        aiCallingRef.current = true
        lastUserAiTriggerTsRef.current = tsBase
        setConversationAwaitingAiKick(conversationKey.trim(), true)
        syncAiReplyPipelineActive(conversationKey)
        queueMicrotask(() => {
          void (async () => {
            if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
            deferResetProactiveMessageCountdown()
            if (roomType === 'group' && groupId?.trim()) {
              const g = await personaDb.getGroupChat(groupId.trim())
              groupDocRef.current = g
            }
            bumpPendingAiRepliesForReply()
            void flushAiReplies(conversationKey.trim())
          })()
        })
      }
    },
    [
      conversationCharacterId,
      conversationKey,
      extractMessages,
      flushAiReplies,
      isSelfMemoChat,
      getCurrentTimeMs,
      playerIdentityId,
      rebuildWithCurrentTime,
      scrollToBottomSmooth,
      showComposerToast,
      logger,
      roomType,
      groupId,
      bumpPendingAiRepliesForReply,
      deferResetProactiveMessageCountdown,
      syncAiReplyPipelineActive,
    ],
  )

  const lastChatMsg = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i]!
      if (it.kind === 'msg') return it
    }
    return null
  }, [items])

  /** 当前会话 AI 管线进行中：禁用发送键，避免重复调用模型 */
  const aiPipelineBlocksSend = useMemo(() => {
    const ck = conversationKey.trim()
    if (!ck) return false
    // aiReplyPipelineActive / pendingQueue 参与依赖，避免仅 ref 变化时 memo 不刷新
    void aiReplyPipelineActive
    void pendingQueue.length
    void pipelineTick
    return (
      isConversationAiPipelineBlockingSend(ck) ||
      opponentRevealJobsRef.current.some((j) => conversationKeysMatch(j.forConversationKey, ck))
    )
  }, [
    conversationKey,
    conversationKeysMatch,
    aiReplyPipelineActive,
    pendingQueue.length,
    pipelineTick,
  ])

  const normalizedDraft = useMemo(() => normalizeWeChatComposerDraftText(draft), [draft])

  const canNudgeAiReply = useMemo(
    () =>
      Boolean(
        !messageEditModal &&
          lastChatMsg?.kind === 'msg' &&
          lastChatMsg.from === 'self' &&
          !normalizedDraft &&
          !sendBusy &&
          !typingVisible &&
          !flushUiBusy &&
          !awaitingAiKick &&
          !aiReplyPipelineActive &&
          pendingQueue.length === 0,
      ),
    [
      messageEditModal,
      lastChatMsg,
      normalizedDraft,
      sendBusy,
      typingVisible,
      flushUiBusy,
      awaitingAiKick,
      aiReplyPipelineActive,
      pendingQueue.length,
    ],
  )

  const planeCanAct = Boolean((normalizedDraft || canNudgeAiReply) && !aiPipelineBlocksSend)

  const onSendButtonClick = useCallback(() => {
    if (sendBusy || aiPipelineBlocksSend) return
    if (enterDebounceTimerRef.current != null) {
      window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = null
    }
    lastEnterDownRef.current = 0
    if (draft.trim()) {
      commitSend(normalizedDraft, true)
      return
    }
    if (canNudgeAiReply) {
      triggerManualCharacterReply()
    }
  }, [aiPipelineBlocksSend, canNudgeAiReply, commitSend, normalizedDraft, triggerManualCharacterReply, sendBusy])

  const openApiSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'api' } }))
  }, [])

  const startVoiceRecordingOrWarn = useCallback(
    (origin: { x: number; y: number }) => {
      voiceLongPressAttemptedRef.current = true
      const hasSenseVoiceSmallKey = Boolean(voiceAsrEnabled && voiceAsrApiConfig?.apiKey?.trim())
      if (!hasSpeechRecognitionApi || !hasSenseVoiceSmallKey) {
        setVoiceConfigAlertMessage(
          '当前未配置 SenseVoiceSmall 的 API Key，无法使用录音语音功能。请先前往 API 设置完成配置。你也可以单击“按住说话”按钮，改为语音内容的纯文字输入。',
        )
        setVoiceConfigAlertOpen(true)
        return
      }
      setVoicePressing(true)
      setVoiceOverlayOpen(true)
      setVoiceGestureZone('send')
      setVoiceThumbOrigin(origin)
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          voiceStreamRef.current = stream
          const recorder = new MediaRecorder(stream)
          voiceChunksRef.current = []
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) voiceChunksRef.current.push(ev.data)
          }
          recorder.start(120)
          voiceRecorderRef.current = recorder
        } catch (err) {
          setVoicePressing(false)
          setVoiceOverlayOpen(false)
          setVoiceGestureZone('send')
          setVoiceThumbOrigin(null)
          showComposerToast(err instanceof Error ? `麦克风不可用：${err.message}` : '麦克风不可用')
        }
      })()
    },
    [showComposerToast, voiceAsrApiConfig?.apiKey, voiceAsrEnabled],
  )

  const resolveVoiceZone = useCallback((clientX: number, clientY: number): VoiceGestureZone => {
    const origin = voiceThumbOrigin
    if (!origin) return 'send'
    const dx = clientX - origin.x
    const dy = clientY - origin.y
    const distance = Math.hypot(dx, dy)
    if (distance < 56) return 'send'
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const inCancelSector = angle >= -165 && angle <= -105
    const inToTextSector = angle >= -75 && angle <= -15
    if (distance >= 68 && inCancelSector) return 'cancel'
    if (distance >= 68 && inToTextSector) return 'toText'
    return 'send'
  }, [voiceThumbOrigin])

  const onVoicePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      activeVoicePointerIdRef.current = e.pointerId
      voiceLongPressAttemptedRef.current = false
      voiceDownPosRef.current = { x: e.clientX, y: e.clientY }
      if (voiceHoldTimerRef.current != null) {
        window.clearTimeout(voiceHoldTimerRef.current)
        voiceHoldTimerRef.current = null
      }
      voiceHoldTimerRef.current = window.setTimeout(() => {
        startVoiceRecordingOrWarn({ x: e.clientX, y: e.clientY })
      }, VOICE_HOLD_START_MS)
      setVoiceSessionStartMs(Date.now())
    },
    [startVoiceRecordingOrWarn],
  )

  const onVoicePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (activeVoicePointerIdRef.current !== e.pointerId) return
      const down = voiceDownPosRef.current
      if (down && !voicePressing) {
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
        if (moved > VOICE_TAP_MOVE_THRESHOLD_PX && voiceHoldTimerRef.current != null) {
          window.clearTimeout(voiceHoldTimerRef.current)
          voiceHoldTimerRef.current = null
          startVoiceRecordingOrWarn({ x: down.x, y: down.y })
        }
      }
      if (!voicePressing) return
      setVoiceGestureZone(resolveVoiceZone(e.clientX, e.clientY))
    },
    [resolveVoiceZone, startVoiceRecordingOrWarn, voicePressing],
  )

  const onVoicePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (activeVoicePointerIdRef.current !== e.pointerId) return
      if (voiceHoldTimerRef.current != null) {
        window.clearTimeout(voiceHoldTimerRef.current)
        voiceHoldTimerRef.current = null
      }
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      const zone = resolveVoiceZone(e.clientX, e.clientY)
      const durationSec = Math.max(1, Math.round((Date.now() - (voiceSessionStartMs ?? Date.now())) / 1000))
      const wasPressing = voicePressing
      setVoicePressing(false)
      setVoiceOverlayOpen(false)
      setVoiceSessionStartMs(null)
      setVoiceThumbOrigin(null)
      voiceDownPosRef.current = null
      activeVoicePointerIdRef.current = null
      setVoiceGestureZone('send')
      const longPressAttempted = voiceLongPressAttemptedRef.current
      voiceLongPressAttemptedRef.current = false
      if (!wasPressing) {
        if (longPressAttempted) return
        setMockVoiceInputOpen(true)
        return
      }
      const recorder = voiceRecorderRef.current
      const stream = voiceStreamRef.current
      const settleRecordedAudio = async (): Promise<Blob | null> => {
        if (!recorder) return null
        if (recorder.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve()
            recorder.stop()
          })
        }
        const blob = voiceChunksRef.current.length
          ? new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null
        voiceRecorderRef.current = null
        voiceChunksRef.current = []
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          voiceStreamRef.current = null
        }
        return blob
      }
      if (zone === 'cancel') {
        void settleRecordedAudio()
        return
      }
      if (zone === 'toText') {
        void (async () => {
          try {
            const audioBlob = await settleRecordedAudio()
            if (!audioBlob) {
              showComposerToast('录音为空，请重试')
              return
            }
            const asr = await requestSiliconflowTranscription(voiceAsrApiConfig, audioBlob)
            const text = asr.text.trim() || `（语音转文字）${durationSec}秒录音未识别到清晰文本`
            setDraft(text)
            setInputMode('text')
            showComposerToast('已转文字，可编辑后发送')
          } catch (err) {
            showComposerToast(err instanceof Error ? `转写失败：${err.message}` : '转写失败')
          }
        })()
        return
      }
      void (async () => {
        try {
          const audioBlob = await settleRecordedAudio()
          if (!audioBlob) {
            showComposerToast('录音为空，请重试')
            return
          }
          let transcriptText = ''
          let emotion = ''
          try {
            const asr = await requestSiliconflowTranscription(voiceAsrApiConfig, audioBlob)
            transcriptText = asr.text.trim()
            emotion = asr.emotion || ''
          } catch {
            // 发送语音不强依赖转写，失败可忽略
          }
          await appendVoiceMessage({ durationSec, audioBlob, transcriptText, emotion })
        } catch (err) {
          showComposerToast(err instanceof Error ? `录音处理失败：${err.message}` : '录音处理失败')
        }
      })()
    },
    [appendVoiceMessage, resolveVoiceZone, showComposerToast, voiceAsrApiConfig, voicePressing, voiceSessionStartMs],
  )

  const runRetryReply = useCallback(
    async (biasRaw: string) => {
      const bias = biasRaw.trim()
      if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
      cancelOpponentRevealTimer()
      opponentRevealJobsRef.current = []
      setPendingQueue([])
      onOpponentRevealQueueActive?.(false)

      const msgs = extractMessages(itemsRef.current)
      const lastRealSelfIdx = findLastRealSelfMessageIndex(msgs)
      if (lastRealSelfIdx < 0) {
        showComposerToast('未找到可重试的本轮用户消息')
        return
      }
      const tailSelfToRestore: ChatMsg[] = []
      const toRemove = msgs
        .slice(lastRealSelfIdx + 1)
        .filter((m) => {
          if (m.from === 'other') return true
          if (isRetryRoundTrimmableSelfSystemStrip(m)) return true
          if (isRetryNonAnchorSelfMessage(m)) {
            tailSelfToRestore.push(m)
            return true
          }
          return false
        })
        .map((m) => m.id)
      const kill = new Set(toRemove)

      const removedOtherCharIds = new Set<string>()
      for (const m of msgs.slice(lastRealSelfIdx + 1)) {
        if (m.from !== 'other' || m.kind !== 'msg') continue
        const cid = m.senderCharacterId?.trim() || conversationCharacterId.trim()
        if (cid) removedOtherCharIds.add(cid)
      }
      try {
        const revertByChar = mergeWorldBookAfterRevertByCharacterFromMessages(
          aiContextDbMessagesRef.current,
          kill,
        )
        const charIdsToRevert = new Set<string>([...revertByChar.keys(), ...removedOtherCharIds])
        let anyReverted = false
        for (const cid of charIdsToRevert) {
          let chRow = await personaDb.getCharacter(cid)
          if (!chRow) continue
          const entries = revertByChar.get(cid)
          let restored = entries?.length ? applyWorldBookAfterRevertEntries(chRow, entries) : null
          if (!restored && removedOtherCharIds.has(cid)) {
            restored = revertWorldBookAfterUsingContentPrevious(chRow)
          }
          if (restored) {
            await personaDb.upsertCharacter(restored)
            anyReverted = true
          }
        }
        if (anyReverted) {
          window.dispatchEvent(
            new CustomEvent(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, {
              detail: { appliedPatchCount: 1, source: 'retry_revert' },
            }),
          )
        }
      } catch {
        /* 尾声回滚失败不阻断重新回复 */
      }

      resetAcceptedIncomingPlayerTransfersForConversationPeer({
        conversationKey,
        playerIdentityId,
        peerCharacterId: conversationCharacterId.trim(),
      })

      const selfOpenedRpIds = msgs
        .map((m, idx) => ({ m, idx }))
        .filter(
          ({ m, idx }) =>
            idx <= lastRealSelfIdx && m.from === 'self' && m.redPacket?.opened,
        )
        .map(({ m }) => m.id)
      for (const rid of selfOpenedRpIds) {
        try {
          const row = await personaDb.getWeChatChatMessageById(rid)
          const cur = row?.redPacket
          if (!row || row.type !== 'player' || !cur?.opened) continue
          const packetId = cur.packetId?.trim()
          await personaDb.patchWeChatChatMessageById(rid, {
            redPacket: { ...cur, opened: false },
          })
          if (packetId) {
            const notified = readNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY)
            notified.delete(`opened:${packetId}`)
            writeNotifiedSet(LS_REDPACKET_EXPIRED_NOTIFIED_KEY, notified)
          }
        } catch {
          /* ignore */
        }
      }

      if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
      setTypingVisible(false)
      pendingAiRepliesRef.current = 0
      manualAiPauseRef.current = false

      if (toRemove.length) {
        // 重新回复仅替换本轮对方气泡，不应把被删旧稿记入回收站（与用户主动删除区分）
        await personaDb.runWithIndexedTrashSuspended(async () => {
          for (const id of toRemove) {
            await personaDb.deleteWeChatChatMessageById(id)
          }
        })
      }
      const reopenRpIdSet = new Set(selfOpenedRpIds)
      if (selfOpenedRpIds.length) clearLumiRedPacketOpenedUi(selfOpenedRpIds)
      // 与 DB 同步：删对方稿 + 夹在中间的系统灰条；仅撤回锚点及以前本人红包的「已拆」态（不误伤更早历史）
      aiContextDbMessagesRef.current = aiContextDbMessagesRef.current
        .filter((m) => !kill.has(m.id))
        .map((m) => {
          if (m.type === 'player' && reopenRpIdSet.has(m.id) && m.redPacket?.opened) {
            return { ...m, redPacket: { ...m.redPacket, opened: false } }
          }
          return m
        })
      setItems((prev) => {
        const next = rebuildWithCurrentTime(
          extractMessages(prev)
            .filter((it) => !kill.has(it.id))
            .map((it) =>
              reopenRpIdSet.has(it.id) && it.redPacket?.opened
                ? { ...it, redPacket: { ...it.redPacket, opened: false } }
                : it,
            ),
        )
        itemsRef.current = next
        return next
      })

      retryReplyBiasRef.current = [
        '[系统提示] 用户请求「重新回复」：须视为对该轮用户消息的**首次生成**。上下文已移除你方本轮旧稿，**禁止**引用、延续或复读旧内容；仅依据该条用户消息及更早历史重新作答。',
        '【重新回复】须写出与旧稿**可区分**的新对白/新信息/新节奏；禁止同义洗稿。若 system 中「尾声延展」已恢复为补丁前基准，勿再按旧稿关系态复读。',
        bias,
      ]
        .filter((x) => x.trim())
        .join('\n\n')
      skipMemoryRoundBumpRef.current = true
      window.setTimeout(() => {
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
        deferResetProactiveMessageCountdown()
        pendingAiRepliesRef.current = 1
        void (async () => {
          try {
            await flushAiReplies(conversationKey.trim())
          } finally {
            if (!tailSelfToRestore.length) return
            try {
              const restoredRows: WeChatChatMessage[] = []
              for (const m of tailSelfToRestore) {
                const row: WeChatChatMessage = {
                  id: m.id,
                  characterId: conversationCharacterId,
                  playerIdentityId,
                  type: 'player',
                  content: messagePlainPreview(m),
                  miniGameInvite: m.miniGameInvite,
                  musicSync: m.musicSync,
                  timestamp: m.timestamp,
                  isRead: true,
                  conversationKey,
                }
                await personaDb.appendWeChatChatMessage(row)
                restoredRows.push(row)
              }
              if (restoredRows.length) {
                aiContextDbMessagesRef.current = [...aiContextDbMessagesRef.current, ...restoredRows]
              }
              setItems((prev) => {
                const existing = new Set(extractMessages(prev).map((x) => x.id))
                const toAdd = tailSelfToRestore.filter((m) => !existing.has(m.id))
                if (!toAdd.length) return prev
                const next = rebuildWithCurrentTime([...extractMessages(prev), ...toAdd])
                itemsRef.current = next
                return next
              })
              emitWeChatStorageChanged()
            } catch {
              /* ignore tail restore failure */
            }
          }
        })()
      }, 120)
      showComposerToast(bias ? '已按偏向发起重新回复' : '已发起重新回复')
    },
    [
      cancelOpponentRevealTimer,
      conversationCharacterId,
      conversationKey,
      deferResetProactiveMessageCountdown,
      extractMessages,
      flushAiReplies,
      onOpponentRevealQueueActive,
      playerIdentityId,
      rebuildWithCurrentTime,
      showComposerToast,
    ],
  )

  const handlePlusAction = useCallback(
    (id: WeChatPlusActionId) => {
      setPlusMenuOpen(false)
      const stub = (name: string) => showComposerToast(`「${name}」功能开发中`)

      switch (id) {
        case 'photo':
          setStubPanel(null)
          setPhotoPickerOpen(true)
          logger.log('frontend', '点击加号菜单：照片')
          break
        case 'camera':
          setStubPanel(null)
          setPlusMenuOpen(false)
          setCameraOpen(true)
          logger.log('frontend', '点击加号菜单：拍摄')
          break
        case 'call':
          setCallSheetOpen(true)
          break
        case 'location':
          if (roomType !== 'private') {
            showComposerToast('请在私聊中使用位置分享')
            break
          }
          setStubPanel(null)
          setLocationSpoofOpen(true)
          break
        case 'redpacket':
          if (onOpenSendRedPacket) {
            onOpenSendRedPacket()
          } else {
            stub('红包')
          }
          break
        case 'transfer':
          if (onOpenLumiTransfer) {
            onOpenLumiTransfer()
          } else {
            stub('转账')
          }
          break
        case 'affection_pay':
          if (onOpenAffectionPay) {
            onOpenAffectionPay()
          } else {
            stub('亲情卡支付')
          }
          break
        case 'favorite':
          if (roomType !== 'private' || useLumiProjectAssistantPrompt || isSelfMemoChat) {
            showComposerToast('请在角色私聊中使用收藏转发')
            break
          }
          setStubPanel(null)
          setPlusMenuOpen(false)
          setFavoritesPickerOpen(true)
          break
        case 'contact':
          stub('个人名片')
          break
        case 'music':
          stub('音乐')
          break
        case 'heart_words':
          openHeartWhisperPanel()
          break
        case 'read_ignore':
          manualAiPauseRef.current = true
          if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
          setTypingVisible(false)
          pendingAiRepliesRef.current = 0
          showComposerToast('已读不回：已暂停对方回复；发送消息或点「继续回复」可恢复')
          break
        case 'busy':
          manualAiPauseRef.current = true
          if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), true)
          setTypingVisible(false)
          pendingAiRepliesRef.current = 0
          showComposerToast('忙碌：已暂停对方回复')
          break
        case 'retry_reply':
          setRetryReplyBiasDraft('')
          setRetryReplyPromptOpen(true)
          break
        case 'continue_reply':
              if (conversationKey.trim()) setConversationOpponentQueueStop(conversationKey.trim(), false)
          triggerManualCharacterReply()
          showComposerToast('已继续回复')
          break
        case 'console_logs':
          setStubPanel(null)
          setPlusMenuOpen(false)
          openConsole()
          showComposerToast('控制台已打开')
          logger.log('frontend', '点击加号菜单：控制台日志')
          break
        case 'games':
          setStubPanel(null)
          setPlusMenuOpen(false)
          if (roomType === 'group') {
            showComposerToast('小游戏邀请仅支持私聊')
            break
          }
          setGameLobbyOpen(true)
          logger.log('frontend', '点击加号菜单：小游戏')
          break
        case 'check_phone':
          setStubPanel(null)
          setPlusMenuOpen(false)
          setCheckPhoneOpen(true)
          logger.log('frontend', '点击加号菜单：查手机（Spy Mode）')
          break
        default:
          break
      }
    },
    [
      conversationCharacterId,
      isSelfMemoChat,
      logger,
      onOpenLumiTransfer,
      onOpenSendRedPacket,
      openConsole,
      roomType,
      showComposerToast,
      triggerManualCharacterReply,
      useLumiProjectAssistantPrompt,
    ],
  )

  const onComposerKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (roomType === 'group' && inputMode === 'text' && groupAtOpen && groupAtPickRows.length) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setGroupAtHighlightIdx((i) => (i + 1) % groupAtPickRows.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setGroupAtHighlightIdx((i) => (i - 1 + groupAtPickRows.length) % groupAtPickRows.length)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setDraft((d) => d.replace(/@([^@\n]*)$/, ''))
          setGroupAtOpen(false)
          return
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          const ne = e.nativeEvent
          if (ne.isComposing) return
          e.preventDefault()
          const row = groupAtPickRows[groupAtHighlightIdx] ?? groupAtPickRows[0]
          if (row) insertGroupMention(row.label)
          return
        }
      }
      if (e.key !== 'Enter' || e.shiftKey) return
      const ne = e.nativeEvent
      if (ne.isComposing) return
      if (e.repeat) return
      e.preventDefault()
      if (sendBusy || aiPipelineBlocksSend) return
      const text = readWeChatComposerDraftText(textareaRef.current) || normalizeWeChatComposerDraftText(draftRef.current)
      // 空输入时：如果上一条是玩家消息，则回车直接触发“请求对方回复”（微信同款：不需要点纸飞机）
      if (!text) {
        if (!canNudgeAiReply) return
        triggerManualCharacterReply()
        refocusComposer()
        return
      }
      const now = Date.now()
      if (now - lastEnterDownRef.current <= ENTER_DOUBLE_TAP_WINDOW_MS) {
        if (enterDebounceTimerRef.current != null) {
          window.clearTimeout(enterDebounceTimerRef.current)
          enterDebounceTimerRef.current = null
        }
        lastEnterDownRef.current = 0
        commitSend(text, true)
        refocusComposer()
        return
      }
      lastEnterDownRef.current = now
      if (enterDebounceTimerRef.current != null) window.clearTimeout(enterDebounceTimerRef.current)
      enterDebounceTimerRef.current = window.setTimeout(() => {
        enterDebounceTimerRef.current = null
        lastEnterDownRef.current = 0
        const t =
          readWeChatComposerDraftText(textareaRef.current) || normalizeWeChatComposerDraftText(draftRef.current)
        if (t) {
          commitSend(t, false)
          refocusComposer()
        }
      }, ENTER_SINGLE_COMMIT_DELAY_MS)
    },
    [
      canNudgeAiReply,
      commitSend,
      triggerManualCharacterReply,
      groupAtHighlightIdx,
      groupAtOpen,
      groupAtPickRows,
      inputMode,
      insertGroupMention,
      refocusComposer,
      roomType,
      sendBusy,
      aiPipelineBlocksSend,
    ],
  )

  const insertClassicEmojiAtCaret = useCallback((token: string) => {
    const snippet = token.trim()
    if (!snippet) return
    const el = textareaRef.current
    const value = draftRef.current
    if (!el) {
      setDraft(value + snippet)
      return
    }
    if (stubPanelRef.current !== 'emoji' && document.activeElement !== el) {
      el.focus({ preventScroll: true })
    }
    insertWeChatClassicEmojiAtCaret(el, snippet)
    const next = serializeWeChatComposerEl(el)
    setDraft(next)
  }, [])

  const sendStickerFromPicker = useCallback(
    async ({ url, description }: { url: string; description: string }) => {
      const src = url.trim()
      if (!src) return
      try {
        const payload = await stickerUrlToImagePayload(src)
        const cap = description.trim() ? `[表情包] ${description.trim()}` : '[表情包]'
        // 与拍摄/相册图片一致：发出后不自动拉模型，由用户点纸飞机或空输入回车等方式触发回复
        commitSendImage(payload.base64, false, payload.mime, cap)
        textareaRef.current?.blur()
      } catch (e) {
        const err = e instanceof Error ? e.message : 'unknown'
        logger.log('error', `sticker send as image failed: ${err}`)
        showComposerToast('表情图片发送失败，已回退为文本消息')
        const prompt = `用户发送了一个表情包：[${src}] (描述：${description || '未填写'})`
        commitSend(prompt, false)
      }
    },
    [commitSend, commitSendImage, logger, showComposerToast],
  )

  const retrySend = useCallback(
    (id: string, text: string) => {
      setItems((prev) => rebuildWithCurrentTime(extractMessages(prev).filter((it) => it.id !== id)))
      commitSend(text, true)
    },
    [commitSend, extractMessages, rebuildWithCurrentTime],
  )

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading) return
    const loadedMsgCount = itemsRef.current.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0)
    if (loadedMsgCount > visibleMsgLimit) {
      const root = scrollRef.current
      const prevHeight = root?.scrollHeight ?? 0
      const prevTop = root?.scrollTop ?? 0
      setVisibleMsgLimit((v) => v + CHAT_VISIBLE_MSG_STEP)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (!el) return
          const delta = el.scrollHeight - prevHeight
          if (delta > 0) el.scrollTop = prevTop + delta
        })
      })
      return
    }
    if (historyExhaustedRef.current) return
    let beforeTs = oldestMsgTsRef.current
    if (beforeTs == null) return
    const root = scrollRef.current
    const prevHeight = root?.scrollHeight ?? 0
    const prevTop = root?.scrollTop ?? 0
    setHistoryLoading(true)
    try {
      const effectiveCut = ignoreUiOnlyHiddenInListRef.current ? null : uiOnlyHiddenCutTsRef.current
      const segments: WeChatChatMessage[][] = []
      let exhausted = false
      for (let iter = 0; iter < 10; iter++) {
        const older = await personaDb.listWeChatChatMessagesRecent({
          conversationKey,
          limit: 50,
          beforeTimestamp: beforeTs,
        })
        if (older.length === 0) {
          exhausted = true
          break
        }
        segments.push(older)
        beforeTs = older[0]?.timestamp ?? beforeTs
        oldestMsgTsRef.current = older[0]?.timestamp ?? oldestMsgTsRef.current
        const vis = effectiveCut == null ? older : older.filter((m) => m.timestamp > effectiveCut)
        if (vis.length > 0 || older.length < 50) {
          if (older.length < 50) exhausted = true
          break
        }
        if (older.length < 50) {
          exhausted = true
          break
        }
      }
      if (segments.length === 0) {
        historyExhaustedRef.current = true
        setHistoryExhausted(true)
        setHasOlderHistory(false)
        return
      }
      const peerCidHistory = (personaCharacterId?.trim() || conversationCharacterId.trim()) || undefined
      const fullChronological = stripLegacyMeetImportedWeChatMessages(
        [...segments].reverse().flat(),
        peerCidHistory,
      )
      const byId = new Map<string, WeChatChatMessage>()
      for (const r of fullChronological) byId.set(r.id, r)
      for (const r of aiContextDbMessagesRef.current) byId.set(r.id, r)
      aiContextDbMessagesRef.current = stripLegacyMeetImportedWeChatMessages(
        [...byId.values()].sort((a, b) => a.timestamp - b.timestamp),
        peerCidHistory,
      )

      if (exhausted) {
        historyExhaustedRef.current = true
        setHistoryExhausted(true)
        setHasOlderHistory(false)
      } else {
        setHasOlderHistory(true)
      }

      const visiblePrependChronological = stripLegacyMeetImportedWeChatMessages(
        [...segments].reverse().flatMap((seg) =>
          effectiveCut == null ? seg : seg.filter((m) => m.timestamp > effectiveCut),
        ),
        peerCidHistory,
      )
      const prepend = mapWeChatMessagesToChatItems(visiblePrependChronological)
      setItems((prev) => {
        let next = rebuildWithCurrentTime([...prepend, ...extractMessages(prev)])
        if (roomType === 'group' && groupId?.trim()) {
          next = filterGroupChatItemsHideModeratorOnlyBubbles(next, roomType, groupDocRef.current)
        }
        itemsRef.current = next
        return next
      })
      setVisibleMsgLimit((v) => v + CHAT_VISIBLE_MSG_STEP)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (!el) return
          const delta = el.scrollHeight - prevHeight
          if (delta > 0) el.scrollTop = prevTop + delta
        })
      })
    } finally {
      setHistoryLoading(false)
    }
  }, [conversationKey, extractMessages, groupId, historyLoading, rebuildWithCurrentTime, roomType, visibleMsgLimit])

  const onScrollPane = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop > 40) userScrolledRef.current = true
    const atBottom = isScrollNearBottom(el)
    isAtBottomRef.current = atBottom
    if (atBottom) {
      userScrolledRef.current = false
      setPendingNewCount(0)
    }
  }, [])

  const sharedMsgProps: ChatMsgProps = useMemo(
    () => ({
      messageText: '',
      bubble,
      showAvatar,
      showBubbleTail,
      bubbleTailMaskColor: chatTailMaskColor,
      chatSelfAvatarUrl: playerAvatarResolved,
      chatOtherAvatarUrl: peerAvatarResolved,
      onOtherAvatarClick: openHeartWhisperPanel,
      groupRankShowBesideNickname: roomType === 'group' ? showGroupMemberNicknameInChat !== false : true,
    }),
    [bubble, showAvatar, showBubbleTail, chatTailMaskColor, playerAvatarResolved, peerAvatarResolved, openHeartWhisperPanel, roomType, showGroupMemberNicknameInChat],
  )

  const msgById = useMemo(() => {
    const map = new Map<string, ChatMsg>()
    for (const it of items) {
      if (it.kind === 'msg') map.set(it.id, applyLocallyOpenedRedPacketToMsg(it))
    }
    return map
  }, [items, locallyOpenedRedPacketRev])

  const actionPanelTargetMsg = useMemo(() => {
    const id = actionMessageId?.trim()
    if (!id) return null
    return items.find((it): it is ChatMsg => it.kind === 'msg' && it.id === id) ?? null
  }, [actionMessageId, items])

  const wechatActionPanelIds = useMemo((): WeChatMessageActionId[] => {
    const withRecall: WeChatMessageActionId[] = [
      'copy',
      'forward',
      'favorite',
      'delete',
      'multiSelect',
      'quote',
      'translate',
      'edit',
      'recall',
    ]
    const base: WeChatMessageActionId[] = ['copy', 'forward', 'favorite', 'delete', 'multiSelect', 'quote', 'translate', 'edit']
    let next = actionMessageCanRecall ? [...withRecall] : [...base]
    if (actionPanelTargetMsg?.isRecalled) next = next.filter((x) => x !== 'quote')
    if (actionPanelTargetMsg?.voice) next = next.filter((x) => x !== 'copy')
    if (actionPanelTargetMsg?.voice && actionPanelTargetMsg.from === 'other') next = [...next, 'resynthesizeVoice']
    if (actionPanelTargetMsg?.images?.length) next = [...next, 'saveToAlbum']
    const nonPlainText = Boolean(
      actionPanelTargetMsg?.images?.length ||
        actionPanelTargetMsg?.voice ||
        actionPanelTargetMsg?.redPacket ||
        actionPanelTargetMsg?.transfer ||
        actionPanelTargetMsg?.callStatus ||
        actionPanelTargetMsg?.miniGameInvite ||
        actionPanelTargetMsg?.musicSync,
    )
    if (nonPlainText || actionPanelTargetMsg?.isRecalled) next = next.filter((x) => x !== 'edit')
    return next
  }, [
    actionMessageCanRecall,
    actionPanelTargetMsg?.isRecalled,
    actionPanelTargetMsg?.voice,
    actionPanelTargetMsg?.images,
    actionPanelTargetMsg?.redPacket,
    actionPanelTargetMsg?.transfer,
    actionPanelTargetMsg?.callStatus,
    actionPanelTargetMsg?.miniGameInvite,
    actionPanelTargetMsg?.musicSync,
  ])

  const redPacketModalIdRef = useRef<string | null>(null)
  useEffect(() => {
    redPacketModalIdRef.current = redPacketModalMessageId
  }, [redPacketModalMessageId])

  const redPacketModalSender = useMemo(() => {
    if (!redPacketModalMessageId) return null
    const cm = msgById.get(redPacketModalMessageId)
    const rp = cm?.redPacket
    // 领取过程中会先把 opened 写成 true；弹层须靠 messageId 保持挂载到 onFlowComplete
    if (!cm || !rp) return null
    if (cm.from === 'self') return null
    return {
      amountYuan: rp.amountYuan,
      remark: rp.remark,
      senderName: peerNotifyTitle.trim() || '对方',
      senderAvatarUrl: peerAvatarResolved,
    }
  }, [redPacketModalMessageId, msgById, peerNotifyTitle, peerAvatarResolved])

  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Set<string>>(() => new Set())
  const toggleThinkingFold = useCallback((id: string) => {
    setExpandedThinkingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  useEffect(() => {
    setExpandedThinkingIds(new Set())
  }, [conversationKey])

  /** 渲染兜底：生图完成后即使 items state 未及时合并，也从全局 patch 直接展示（同生图预览 setState） */
  const itemsForDisplay = useMemo(() => {
    const patchMap = mergeImageGenUiPatchMaps(pendingImageGenUiPatchesRef.current)
    const hasLocalRp = locallyOpenedRedPacketMessageIds.size > 0
    if (patchMap.size === 0 && !hasLocalRp) return items
    return items.map((it) => {
      if (it.kind !== 'msg') return it
      let msg = applyImageGenUiPatchToChatMsgIfAny(it, patchMap)
      msg = applyLocallyOpenedRedPacketToMsg(msg)
      return msg
    })
  }, [items, imageGenPatchVersion, locallyOpenedRedPacketRev])

  const markRedPacketOpenedInUi = useCallback(
    (messageId: string) => {
      const id = messageId.trim()
      if (!id) return
      // 与转账 emitLumiTransferChanged 同构：先写独立 store 并广播，气泡立刻变样
      markLumiRedPacketOpenedUi(id)
      markWeChatRedPacketLocallyOpened(id)
      setLocallyOpenedRedPacketRev((n) => n + 1)
      flushSync(() => {
        setItems((prev) => {
          const next = rebuildWithCurrentTime(
            extractMessages(prev).map((it) => {
              if (it.id !== id || !it.redPacket) return it
              if (it.redPacket.opened) return it
              return { ...it, redPacket: { ...it.redPacket, opened: true } }
            }),
          )
          itemsRef.current = next
          return next
        })
      })
    },
    [extractMessages, rebuildWithCurrentTime],
  )

  /** 列表展示用：会话设置「仅 UI 清空」时屏蔽截止时间前的气泡（与回收站快照同源）；查找锚点定位期间临时展示全量。 */
  const itemsAfterUiOnlyHide = useMemo(() => {
    const cut = uiOnlyHiddenCutForView
    if (cut == null || scrollToMessageId?.trim()) return itemsForDisplay
    return itemsForDisplay.filter((it) => {
      if (it.kind !== 'msg') return true
      return (it.timestamp ?? 0) > cut
    })
  }, [itemsForDisplay, uiOnlyHiddenCutForView, scrollToMessageId])

  /**
   * hydrate 已修「墙钟 cut 偏大」；此处同规则兜底。
   * 注意：「仅清空界面」cut=最新消息时间，全藏是预期，cut≈maxTs 时切勿撤销（否则清空后会闪回全部历史）。
   */
  useEffect(() => {
    const cut = uiOnlyHiddenCutForView
    if (cut == null || scrollToMessageId?.trim() || ignoreUiOnlyHiddenInListRef.current) return
    const msgs = extractMessages(items)
    if (msgs.length === 0) return
    if (msgs.some((m) => (m.timestamp ?? 0) > cut)) return
    const maxMsgTs = Math.max(...msgs.map((m) => m.timestamp ?? 0))
    if (!(cut > maxMsgTs + 1000)) return
    clearUiOnlyHiddenCutLocal()
  }, [items, uiOnlyHiddenCutForView, scrollToMessageId, extractMessages, clearUiOnlyHiddenCutLocal])

  const totalMsgCount = useMemo(
    () => itemsAfterUiOnlyHide.reduce((n, it) => (it.kind === 'msg' ? n + 1 : n), 0),
    [itemsAfterUiOnlyHide],
  )
  const visibleItems = useMemo(() => {
    const cap = Math.max(CHAT_VISIBLE_MSG_INITIAL, visibleMsgLimit)
    let sliced: ChatItem[]
    if (totalMsgCount <= cap) sliced = itemsAfterUiOnlyHide
    else {
      let msgSeen = 0
      let start = 0
      for (let i = itemsAfterUiOnlyHide.length - 1; i >= 0; i -= 1) {
        if (itemsAfterUiOnlyHide[i]?.kind === 'msg') {
          msgSeen += 1
          if (msgSeen >= cap) {
            start = i
            break
          }
        }
      }
      while (start > 0 && itemsAfterUiOnlyHide[start - 1]?.kind === 'time') start -= 1
      sliced = itemsAfterUiOnlyHide.slice(start)
    }
    if (roomType !== 'group' && friendRequestAcceptedDividerAtMs != null) {
      return injectFriendRequestAcceptedDivider(sliced, friendRequestAcceptedDividerAtMs)
    }
    return sliced
  }, [
    itemsAfterUiOnlyHide,
    totalMsgCount,
    visibleMsgLimit,
    roomType,
    friendRequestAcceptedDividerAtMs,
  ])
  const hasHiddenLoadedMessages = totalMsgCount > visibleMsgLimit
  const canLoadMoreAtTop = hasHiddenLoadedMessages || hasOlderHistory

  const retrySendRef = useRef(retrySend)
  retrySendRef.current = retrySend
  const toggleSelectRef = useRef(toggleSelect)
  toggleSelectRef.current = toggleSelect
  const openActionPanelForRef = useRef(openActionPanelFor)
  openActionPanelForRef.current = openActionPanelFor
  const jumpToMessageRef = useRef(jumpToMessage)
  jumpToMessageRef.current = jumpToMessage
  const showCenterToastRef = useRef(showCenterToast)
  showCenterToastRef.current = showCenterToast
  const requestVoiceMessageAudioRef = useRef(requestVoiceMessageAudio)
  requestVoiceMessageAudioRef.current = requestVoiceMessageAudio
  const resolveGroupQuoteSenderLabelRef = useRef(resolveGroupQuoteSenderLabel)
  resolveGroupQuoteSenderLabelRef.current = resolveGroupQuoteSenderLabel
  const scrollToBottomSmoothRef = useRef(scrollToBottomSmooth)
  scrollToBottomSmoothRef.current = scrollToBottomSmooth
  const getCurrentTimeMsRef = useRef(getCurrentTimeMs)
  getCurrentTimeMsRef.current = getCurrentTimeMs
  const sharedMsgPropsRef = useRef(sharedMsgProps)
  sharedMsgPropsRef.current = sharedMsgProps
  const toggleThinkingFoldRef = useRef(toggleThinkingFold)
  toggleThinkingFoldRef.current = toggleThinkingFold

  const messagesViewDeps = {
    bubble,
    bubbleSkinKey,
    messengerStyle,
    chatTailMaskColor,
    compactMessengerSpacing,
    visibleItems,
    itemsAfterUiOnlyHide,
    mergeAvatarGroup,
    showAvatar,
    showBubbleTail,
    showTimestamp,
    isMultiSelectMode,
    selectedSet,
    actionPanelOpen,
    actionMessageId,
    highlightedMessageId,
    msgById,
    playerDisplayName,
    peerNotifyTitle,
    peerAvatarResolved,
    playerAvatarResolved,
    expandedThinkingIds,
    recallAnimatingIds,
    roomType,
    groupLive,
    groupAvatarByCharId,
    showGroupMemberNicknameInChat,
    showGroupRankBadgesInChat,
  }
  probeMemoDeps('messagesView', messagesViewDeps)

  const messagesView = useMemo(() => {
    const sharedMsgProps = sharedMsgPropsRef.current
    const retrySend = retrySendRef.current
    const toggleSelect = toggleSelectRef.current
    const openActionPanelFor = openActionPanelForRef.current
    const jumpToMessage = jumpToMessageRef.current
    const requestVoiceMessageAudio = requestVoiceMessageAudioRef.current
    const resolveGroupQuoteSenderLabel = resolveGroupQuoteSenderLabelRef.current
    const scrollToBottomSmooth = scrollToBottomSmoothRef.current
    const getCurrentTimeMs = getCurrentTimeMsRef.current
    const toggleThinkingFold = toggleThinkingFoldRef.current
    const groupOtherResolvedByIndex = new Map<number, string>()
    if (roomType === 'group') {
      let lastKnownSid: string | undefined
      for (let idx = 0; idx < visibleItems.length; idx += 1) {
        const it = visibleItems[idx]
        if (it.kind === 'time' || it.kind === 'fr-verify-banner') {
          lastKnownSid = undefined
          continue
        }
        if (it.kind !== 'msg' || it.isRecalled || (it as ChatMsg).isGroupEventStrip || (it as ChatMsg).isSystemCenterStrip)
          continue
        const msg = it as ChatMsg
        if (msg.from !== 'other') {
          lastKnownSid = undefined
          continue
        }
        const sid = msg.senderCharacterId?.trim()
        if (sid) lastKnownSid = sid
        const resolved =
          sid ?? (idx > 0 && consecutiveSameSpeaker(visibleItems, idx, true) ? lastKnownSid : undefined)
        if (resolved) groupOtherResolvedByIndex.set(idx, resolved)
      }
    }
    const resolveReplyPreview = (m: ChatMsg) => {
      const reply = m.replyTo
      if (!reply) return undefined
      const target = msgById.get(reply.messageId)
      const targetExists = !!target
      const recalled = target?.isRecalled === true
      let senderName = reply.senderName || '未知'
      if (roomType === 'group' && target) {
        senderName = resolveGroupQuoteSenderLabel(target.from === 'self', target.senderCharacterId)
      }
      return {
        senderName,
        content: recalled ? '该消息已撤回' : reply.content || '...',
        deleted: !targetExists || recalled,
        recalled,
      }
    }
    const renderMessageReply = (m: ChatMsg, isSelf: boolean) => {
      const reply = resolveReplyPreview(m)
      if (!reply) return null
      if (bubbleTailStyle === 'telegram' || bubbleTailStyle === 'talkmaker') return null

      const inset = showAvatar ? 24 + 40 + 12 : 24
      const sideStyle = isSelf ? { marginRight: `${inset}px` } : { marginLeft: `${inset}px` }
      const content = reply.recalled ? '该消息已撤回' : reply.deleted ? '该消息已被删除' : reply.content
      const id = m.replyTo?.messageId?.trim()

      if (bubbleTailStyle === 'imessage') {
        return (
          <ImessageDetachedReplyBubble
            senderName={reply.senderName}
            content={content}
            isSelf={isSelf}
            showAvatarGutter={showAvatar}
            deleted={reply.deleted || reply.recalled}
            onClick={id ? () => jumpToMessage(id) : undefined}
          />
        )
      }

      if (bubbleTailStyle === 'wechat') {
        return (
          <WechatDetachedQuoteReply
            senderName={reply.senderName}
            content={content}
            isSelf={isSelf}
            showAvatarGutter={showAvatar}
            onClick={id ? () => jumpToMessage(id) : undefined}
          />
        )
      }

      const textColor = '#8e8e8e'
      return (
        <div className={`mt-1 flex w-full max-w-full overflow-x-hidden ${isSelf ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={() => {
              if (id) jumpToMessage(id)
            }}
            className="max-w-[calc(100%-24px-24px-80px)] rounded-[8px] px-1.5 py-1 text-left"
            style={{
              background: '#f5f5f5',
              ...(showAvatar ? sideStyle : {}),
            }}
          >
            <span className="flex items-start gap-2 px-1">
              <span
                className="mt-[1px] h-8 w-px shrink-0"
                style={{ background: '#d4d4d4' }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] italic" style={{ color: textColor }}>
                  {reply.senderName}：
                </span>
                <span
                  className="line-clamp-2 block text-[14px] italic leading-[1.35]"
                  style={{ color: textColor, opacity: reply.deleted ? 0.7 : 1 }}
                >
                  {content}
                </span>
              </span>
            </span>
          </button>
        </div>
      )
    }
    const buildInlineReplyPreview = (m: ChatMsg): WeChatBubbleReplyPreview | undefined => {
      if (bubbleTailStyle !== 'telegram' && bubbleTailStyle !== 'talkmaker') return undefined
      const reply = resolveReplyPreview(m)
      if (!reply) return undefined
      const id = m.replyTo?.messageId?.trim()
      return {
        senderName: reply.senderName,
        content: reply.recalled ? '该消息已撤回' : reply.deleted ? '该消息已被删除' : reply.content,
        onClick: id ? () => jumpToMessage(id) : undefined,
      }
    }
    const renderDetachedReply = (m: ChatMsg, isSelf: boolean) => renderMessageReply(m, isSelf)
    const renderThinkingFold = (m: ChatMsg, isSelf: boolean, index: number) => {
      const text = m.thinking?.trim()
      if (!text || isSelf) return null
      const prev = index > 0 ? visibleItems[index - 1] : null
      if (
        prev &&
        prev.kind === 'msg' &&
        prev.from === 'other' &&
        (prev.thinking?.trim() || '') === text
      ) {
        return null
      }
      const expanded = expandedThinkingIds.has(m.id)
      const inset = showAvatar ? 24 + 40 + 12 : 24
      const sideStyle = isSelf ? { marginRight: `${inset}px` } : { marginLeft: `${inset}px` }
      return (
        <div className={`mb-1 flex w-full max-w-full overflow-x-hidden ${isSelf ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={() => toggleThinkingFold(m.id)}
            className="max-w-[calc(100%-24px-24px-80px)] rounded-[10px] border border-black/8 bg-black/[0.03] px-2.5 py-1.5 text-left"
            style={showAvatar ? sideStyle : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#666]">思维链</span>
              <ChevronDown
                className={`size-3.5 shrink-0 text-[#999] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </div>
            {expanded ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-[1.45] text-[#666]">
                <WeChatChatMixedText text={text} />
              </p>
            ) : null}
          </button>
        </div>
      )
    }
    const resolveGroupSenderDisplayName = (senderCharacterId: string | undefined): string => {
      const sid = senderCharacterId?.trim()
      if (!sid || !groupLive) return ''
      if (sid === WECHAT_GROUP_BOT_CHARACTER_ID) return '群管家'
      if (sid === WECHAT_GROUP_USER_CHAR_ID) {
        const mem = findGroupMember(groupLive, WECHAT_GROUP_USER_CHAR_ID)
        let gn = (mem?.groupNickname || '').trim()
        if (gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
        return gn || playerDisplayName.trim() || '我'
      }
      const mem = findGroupMember(groupLive, sid)
      let gn = (mem?.groupNickname || '').trim()
      if (gn === WECHAT_GROUP_USER_CHAR_ID) gn = ''
      return gn || ''
    }
    const resolveGroupSpeakerRankBadge = (
      isSelfMsg: boolean,
      senderCharacterId: string | undefined,
    ): 'owner' | 'admin' | null => {
      if (!groupLive) return null
      const sid = isSelfMsg ? WECHAT_GROUP_USER_CHAR_ID : senderCharacterId?.trim()
      if (!sid) return null
      const mem = findGroupMember(groupLive, sid)
      if (mem?.role === 'owner' || mem?.role === 'admin') return mem.role
      return null
    }
    return visibleItems.map((m, i) => {
      const effectiveShowAvatar = showAvatar || isMultiSelectMode
      const gap = messageBlockSpacing(visibleItems, i, compactMessengerSpacing)
      const showAvatarColumnOther =
        !mergeAvatarGroup ||
        !consecutiveSameSpeaker(visibleItems, i, roomType === 'group')
      const showAvatarColumnSelf =
        bubbleTailStyle === 'talkmaker'
          ? false
          : !mergeAvatarGroup ||
            !consecutiveSameSpeaker(visibleItems, i, roomType === 'group')
      const showBubbleTailForRow =
        bubble.showBubbleTail &&
        (bubbleTailStyle === 'imessage'
          ? !sameSpeakerAsNext(visibleItems, i, roomType === 'group')
          : bubbleTailStyle === 'telegram' || bubbleTailStyle === 'talkmaker'
            ? !consecutiveSameSpeaker(visibleItems, i, roomType === 'group')
            : bubbleTailStyle === 'wechat'
              ? bubble.showBubbleTail
              : showAvatar)
      if (m.kind === 'time') {
        if (!showTimestamp) return null
        const parts = m.text.split(' ')
        const left = parts.slice(0, -1).join(' ')
        const time = parts.at(-1) ?? ''
        return (
          <div key={m.id} className={gap}>
            <div className="flex justify-center">
              <span
                className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]"
                style={{
                  color: '#999999',
                  lineHeight: 1.1,
                }}
              >
                {left ? (
                  <>
                    <WeChatChatMixedText text={left} />
                    &nbsp;
                  </>
                ) : null}
                <WeChatChatMixedText text={time} />
              </span>
            </div>
          </div>
        )
      }

      if (m.kind === 'fr-verify-banner') {
        return (
          <div key={m.id} className={gap}>
            <div className="flex justify-center">
              <span
                className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]"
                style={{ color: '#999999', lineHeight: 1.1, fontFamily: 'var(--wx-chat-font, var(--wx-font))' }}
              >
                <WeChatChatMixedText text={m.text} />
              </span>
            </div>
          </div>
        )
      }

      const isSelf = m.from === 'self'
      if (m.kind === 'msg' && m.isGroupEventStrip && m.text?.trim()) {
        return (
          <div key={m.id} className={gap} data-wx-msg-id={m.id}>
            <RecallNotice text={m.text.trim()} />
          </div>
        )
      }
      if (m.isRecalled) {
        if (roomType === 'group' && groupLive && m.recalledBy === 'moderator') {
          const actorMem = findGroupMember(groupLive, WECHAT_GROUP_USER_CHAR_ID)
          const sid = m.senderCharacterId?.trim()
          const victimMem = sid ? findGroupMember(groupLive, sid) : undefined
          const actorLabel = groupNoticeMemberNickname(actorMem)
          const victimLabel = groupNoticeMemberNickname(victimMem)
          const noticeText = `${actorLabel}撤回了一条${victimLabel}的消息`
          const victimWasSelf = m.from === 'self'
          return (
            <div key={m.id} className={gap} data-wx-msg-id={m.id}>
              <RecallNotice
                text={noticeText}
                onClick={() => {
                  setRecallModalRecord({
                    sender: victimWasSelf ? 'self' : 'other',
                    senderName: victimLabel,
                    sentAt: m.timestamp,
                    recalledAt: m.recallTimestamp,
                    originalText: m.originalText || '（无内容）',
                  })
                  setRecallModalOpen(true)
                }}
              />
            </div>
          )
        }
        let recallSenderLabel = peerNotifyTitle.trim() || '对方'
        if (roomType === 'group' && groupLive && !isSelf) {
          const sid = m.senderCharacterId?.trim()
          if (sid === WECHAT_GROUP_BOT_CHARACTER_ID) {
            recallSenderLabel = '群管家'
          } else if (sid) {
            const mem = findGroupMember(groupLive, sid)
            recallSenderLabel = groupNoticeMemberNickname(mem)
          } else {
            recallSenderLabel = '群成员'
          }
        }
        const noticeText = isSelf ? '你撤回了一条消息' : `${recallSenderLabel}撤回了一条消息`
        return (
          <div key={m.id} className={gap} data-wx-msg-id={m.id}>
            <RecallNotice
              text={noticeText}
              onClick={() => {
                setRecallModalRecord({
                  sender: isSelf ? 'self' : 'other',
                  senderName: isSelf ? playerDisplayName.trim() || '我' : recallSenderLabel,
                  sentAt: m.timestamp,
                  recalledAt: m.recallTimestamp,
                  originalText: m.originalText || '（无内容）',
                })
                setRecallModalOpen(true)
              }}
            />
          </div>
        )
      }
      // 违禁/禁言系统灰条：必须优先于下方通用「【系统】」分支，且勿依赖 text 非空（避免误落入普通气泡或错误分支）
      if (m.kind === 'msg' && m.isSystemCenterStrip) {
        const raw = (typeof m.text === 'string' ? m.text : '').trim()
        const stripLabel =
          m.muteSuppressStrip === true
            ? (raw || '系统提示')
            : (raw ? raw.replace(/^【系统】\s*/, '') : '系统提示') || '系统提示'
        const archived = m.shieldedMessageContent?.trim()
        /** 群聊中带存档的违禁/禁言灰条：仅群主或管理员可点「查看」 */
        const canOpenShieldArchive =
          !!archived &&
          roomType === 'group' &&
          userCanAccessGroupAdminLevelInClient(groupLive)
        const canOpen = !!archived && (roomType !== 'group' || canOpenShieldArchive)
        const stripWithOptionalView = (
          <>
            {stripLabel}
            {canOpen ? (
              <span className="ml-1 text-[11px] underline decoration-[#bbb] underline-offset-2">查看</span>
            ) : null}
          </>
        )
        const memberCannotOpenShieldInGroup = roomType === 'group' && !!archived && !canOpenShieldArchive
        return (
          <div key={m.id} className={gap} data-wx-msg-id={m.id}>
            <div className="flex justify-center">
              {memberCannotOpenShieldInGroup ? (
                <span
                  className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]"
                  style={{ color: '#999999', lineHeight: 1.1 }}
                >
                  {stripWithOptionalView}
                </span>
              ) : (
                <Pressable
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!archived || !canOpen) return
                    setShieldedMessageModalVariant(m.muteSuppressStrip ? 'muted' : 'blocked')
                    setShieldedMessageModalText(archived)
                    setShieldedMessageModalOpen(true)
                  }}
                  className={`rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px] ${
                    canOpen ? 'cursor-pointer active:bg-[#e8e8e8]' : 'cursor-default opacity-90'
                  }`}
                  style={{ color: '#999999', lineHeight: 1.1 }}
                >
                  {stripWithOptionalView}
                </Pressable>
              )}
            </div>
          </div>
        )
      }
      // 系统通知条：居中展示，像时间戳一样（用于“领取/退还/到期”等事件提示）
      if (
        m.kind === 'msg' &&
        !m.isSystemCenterStrip &&
        typeof m.text === 'string' &&
        m.text.trim().startsWith('【系统】')
      ) {
        const raw = m.text.trim()
        const text = raw.replace(/^【系统】\s*/, '')
        return (
          <div key={m.id} className={gap}>
            <div className="flex justify-center">
              <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px]" style={{ color: '#999999', lineHeight: 1.1 }}>
                {text}
              </span>
            </div>
          </div>
        )
      }
      const isSelected = isMultiSelectMode && selectedSet.has(m.id)
      const msgRow = m as ChatMsg
      const resolvedOtherSenderId =
        roomType === 'group' && !isSelf
          ? groupOtherResolvedByIndex.get(i) ??
            effectiveGroupOtherSenderCharacterId(visibleItems, i) ??
            msgRow.senderCharacterId?.trim()
          : msgRow.senderCharacterId?.trim()
      /** 每条「头像列」可见（含合并头像时的占位格）都应有头衔：不按是否首条显头像过滤 */
      const otherSpeakerRankBadge =
        showGroupRankBadgesInChat && roomType === 'group' && groupLive && !isSelf && showAvatar
          ? resolveGroupSpeakerRankBadge(false, resolvedOtherSenderId)
          : null
      const selfSpeakerRankBadge =
        showGroupRankBadgesInChat && roomType === 'group' && groupLive && isSelf && showAvatar
          ? resolveGroupSpeakerRankBadge(true, msgRow.senderCharacterId)
          : null
      const chatOtherSenderNickname =
        showGroupMemberNicknameInChat &&
        roomType === 'group' &&
        groupLive &&
        !isSelf &&
        showAvatarColumnOther
          ? resolveGroupSenderDisplayName(resolvedOtherSenderId).trim() || undefined
          : undefined
      const chatOtherAvatarRankBadge = otherSpeakerRankBadge
      const chatSelfAvatarRankBadge = selfSpeakerRankBadge
      const wrap = (node: ReactNode, replyNode?: ReactNode, msgFingerprint?: string) => {
        const hi = highlightedMessageId === m.id
        const recallAnim = recallAnimatingIds.has(m.id)
        const thinkingNode = m.kind === 'msg' ? renderThinkingFold(m, isSelf, i) : null
        const msgStatus = m.kind === 'msg' ? (m.status ?? 'sent') : undefined
        return (
          <MemoizedMessageItem
            key={m.id}
            messageId={m.id}
            status={msgStatus}
            gap={gap}
            isHighlighted={hi}
            isRecallAnimating={recallAnim}
            isSelected={isSelected}
            showAvatarColumnSelf={showAvatarColumnSelf}
            showAvatarColumnOther={showAvatarColumnOther}
            bubbleSkinKey={bubbleSkinKey}
            otherAnimated={m.kind === 'msg' ? m.otherAnimated : undefined}
            selfAnimated={m.kind === 'msg' ? m.selfAnimated : undefined}
            isRecalled={m.kind === 'msg' ? m.isRecalled : undefined}
            textFingerprint={
              m.kind === 'msg'
                ? msgFingerprint ??
                  chatMsgRenderFingerprint({
                    id: m.id,
                    status: msgStatus,
                    text: m.text,
                    isRecalled: m.isRecalled,
                    otherAnimated: m.otherAnimated,
                    selfAnimated: m.selfAnimated,
                    imageGenPending: m.imageGenPending,
                    imageGenAwaitingConfirm: m.imageGenAwaitingConfirm,
                    imageGenFailed: m.imageGenFailed,
                    images: m.images,
                    miniGameInvite: m.miniGameInvite,
                  })
                : undefined
            }
            isMultiSelectMode={isMultiSelectMode}
            onToggleSelect={() => toggleSelect(m.id)}
          >
            {thinkingNode}
            {node}
            {replyNode}
          </MemoizedMessageItem>
        )
      }

      const sharedRowProps: ChatMsgProps = {
        ...sharedMsgProps,
        luxuryDarkAdminBubble: false,
        chatOtherAvatarUrl:
          roomType === 'group' && !isSelf && resolvedOtherSenderId
            ? resolvedOtherSenderId === WECHAT_GROUP_BOT_CHARACTER_ID
              ? resolveGroupRobotAvatarDisplayUrl(groupLive)
              : groupAvatarByCharId[resolvedOtherSenderId] ?? sharedMsgProps.chatOtherAvatarUrl
            : sharedMsgProps.chatOtherAvatarUrl,
      }
      const msAvatar = isMultiSelectMode ? <MultiSelectAvatarSlot checked={isSelected} /> : undefined

      if (m.chatHistory) {
        const historyData = m.chatHistory
        const rowInner = (
          <ChatHistoryChatRow
            id={m.id}
            isSelf={isSelf}
            data={historyData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOpen={() =>
              openChatHistoryViewer(historyData, {
                cardSenderCharacterId: isSelf
                  ? undefined
                  : resolvedOtherSenderId ||
                    personaCharacterId?.trim() ||
                    conversationCharacterId.trim() ||
                    undefined,
              })
            }
            multiSelectAvatar={msAvatar}
            userDisplayName={playerDisplayName.trim() || '我'}
            personaContacts={personaContactsList}
            cardSenderCharacterId={
              isSelf
                ? undefined
                : resolvedOtherSenderId ||
                  personaCharacterId?.trim() ||
                  conversationCharacterId.trim() ||
                  undefined
            }
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.voice) {
        const voice = m.voice
        const d = Math.max(1, Math.round(voice.durationSec || 1))
        const showAvatarVisual = showAvatar && (isSelf ? showAvatarColumnSelf : showAvatarColumnOther)
        const reserveAvatarGutter = showAvatar
        const voiceRankBadge = isSelf ? selfSpeakerRankBadge : otherSpeakerRankBadge
        const rankBesideNick = sharedMsgProps.groupRankShowBesideNickname !== false
        const avatarNodeRaw = (
          <img
            src={(isSelf ? sharedMsgProps.chatSelfAvatarUrl : sharedRowProps.chatOtherAvatarUrl) || ''}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 object-cover"
            style={{
              borderRadius: `${bubble.avatarRadiusPx}px`,
              border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
            }}
            aria-hidden
          />
        )
        const otherGrayAvatar = (
          <div
            className="h-10 w-10 shrink-0"
            style={{
              borderRadius: `${bubble.avatarRadiusPx}px`,
              background: 'rgba(0,0,0,0.06)',
              border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
            }}
            aria-hidden
          />
        )
        const selfGrayAvatar = (
          <div
            className="h-10 w-10 shrink-0"
            style={{ borderRadius: `${bubble.avatarRadiusPx}px`, background: 'rgba(0,0,0,0.04)' }}
            aria-hidden
          />
        )
        const voiceShowAvatarColumn = isSelf ? showAvatarColumnSelf : showAvatarColumnOther
        const wrapVoiceRankOnAvatar = (node: ReactNode) => {
          if (msAvatar) return composeMultiSelectLeading(msAvatar, node, voiceShowAvatarColumn)
          if (rankBesideNick || !voiceRankBadge) return node
          return <ChatGroupSpeakerRankOnAvatar rankBadge={voiceRankBadge}>{node}</ChatGroupSpeakerRankOnAvatar>
        }
        const avatarPlaceholder = composeMultiSelectLeading(
          msAvatar,
          <div className="h-10 w-10 shrink-0" aria-hidden />,
          voiceShowAvatarColumn,
        )
        const bubbleNode = (
          <VoiceMessageBubble
            isUser={isSelf}
            duration={d}
            audioUrl={voice.audioUrl || ''}
            transcriptText={voice.transcriptText || '（暂未生成转写文本）'}
            messengerStyle={messengerStyle}
            bubble={bubble}
            showBubbleTail={showBubbleTailForRow}
            bubbleTailMaskColor={chatTailMaskColor}
            messageTimestampMs={usesMessengerBubbleTime ? m.timestamp : undefined}
            telegramShowReadChecks={isSelf && (m.status ?? 'sent') !== 'sending' && (m.status ?? 'sent') !== 'failed'}
            replyPreview={buildInlineReplyPreview(m)}
            onVoicePlayed={() => markVoiceMessagePlayed(m.id, voice)}
            voicePlayed={voice.voicePlayed === true}
            onRequestAudio={isSelf ? undefined : () => requestVoiceMessageAudio({ ...m, voice })}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
            onTranscriptToggle={() => {
              if (!isAtBottomRef.current) return
              requestAnimationFrame(() => {
                scrollToBottomSmooth({ force: true })
                window.setTimeout(() => {
                  scrollToBottomSmooth({ force: true })
                }, 240)
              })
            }}
          />
        )
        const voiceRow = (
          isSelf ? (
            <div className="flex w-full max-w-full shrink-0 items-end justify-end overflow-x-visible">
              {!effectiveShowAvatar && !msAvatar ? (
                <div className="mr-[24px] ml-auto min-w-0">{bubbleNode}</div>
              ) : showAvatarVisual || msAvatar ? (
                <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
                  {bubbleNode}
                  {wrapVoiceRankOnAvatar(sharedMsgProps.chatSelfAvatarUrl ? avatarNodeRaw : selfGrayAvatar)}
                </div>
              ) : reserveAvatarGutter ? (
                <div className="mr-[24px] ml-auto flex max-w-full flex-row items-start gap-[12px]">
                  {bubbleNode}
                  {wrapVoiceRankOnAvatar(avatarPlaceholder)}
                </div>
              ) : (
                <div className="mr-[24px] ml-auto min-w-0">{bubbleNode}</div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-full shrink-0 overflow-x-visible">
              {!effectiveShowAvatar && !msAvatar ? (
                <div className="ml-[24px] mr-auto min-w-0">{bubbleNode}</div>
              ) : showAvatarVisual || msAvatar ? (
                <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
                  {wrapVoiceRankOnAvatar(sharedRowProps.chatOtherAvatarUrl ? avatarNodeRaw : otherGrayAvatar)}
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
                    {rankBesideNick ? (
                      <ChatGroupSenderNicknameWithRank nickname={chatOtherSenderNickname} rankBadge={voiceRankBadge ?? null} />
                    ) : null}
                    {bubbleNode}
                  </div>
                </div>
              ) : reserveAvatarGutter ? (
                <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
                  {wrapVoiceRankOnAvatar(avatarPlaceholder)}
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
                    {rankBesideNick ? (
                      <ChatGroupSenderNicknameWithRank nickname={chatOtherSenderNickname} rankBadge={voiceRankBadge ?? null} />
                    ) : null}
                    {bubbleNode}
                  </div>
                </div>
              ) : (
                <div className="ml-[24px] mr-auto min-w-0">{bubbleNode}</div>
              )}
            </div>
          )
        )
        return wrap(voiceRow, renderDetachedReply(m, isSelf))
      }

      if (m.musicSync) {
        const inviteCoverUrl =
          m.musicSync.kind === 'music_accept'
            ? m.musicSync.coverUrl?.trim() ||
              resolveMusicSyncInviteCover(extractMessages(visibleItems), m.musicSync.inviteId)
            : undefined
        const rowInner = (
          <MusicInviteChatRow
            id={m.id}
            isSelf={isSelf}
            data={m.musicSync}
            inviteCoverUrl={inviteCoverUrl}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            musicInviteRespondBusy={musicInviteRespondBusy}
            onRespondToCharacterInvite={handleRespondToCharacterMusicInvite}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.miniGameInvite) {
        let miniGameData = m.miniGameInvite
        if (miniGameData.kind === 'game_invite') {
          miniGameData = enrichMiniGameInviteCharResponded(
            miniGameData,
            extractMessages(itemsAfterUiOnlyHide),
            m.id,
          )
        }
        miniGameData = enrichMiniGamePayloadMatchResult(
          miniGameData,
          extractMessages(itemsAfterUiOnlyHide),
          m.id,
        )
        const rowInner = (
          <MiniGameInviteChatRow
            id={m.id}
            isSelf={isSelf}
            data={miniGameData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            selected={actionPanelOpen && actionMessageId === m.id}
            onEnterGame={handleEnterGameFromInvite}
            miniGameInviteRespondBusy={miniGameInviteRespondBusy}
            onRespondToCharacterInvite={handleRespondToCharacterMiniGameInvite}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        const miniGameFingerprint = chatMsgRenderFingerprint({
          id: m.id,
          status: m.status,
          text: m.text,
          isRecalled: m.isRecalled,
          otherAnimated: m.otherAnimated,
          selfAnimated: m.selfAnimated,
          miniGameInvite: miniGameData,
        })
        return wrap(rowWrapped, renderDetachedReply(m, isSelf), miniGameFingerprint)
      }

      if (m.listenCommentShare) {
        const shareData = m.listenCommentShare
        const rowInner = (
          <ListenCommentShareChatRow
            id={m.id}
            isSelf={isSelf}
            data={shareData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOpen={() => requestOpenListenCommentShareCard(shareData)}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.listenProfileShare) {
        const shareData = m.listenProfileShare
        const rowInner = (
          <ListenProfileShareChatRow
            id={m.id}
            isSelf={isSelf}
            data={shareData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOpen={() => requestOpenListenProfileShareCard(shareData)}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.listenTrackShare) {
        const shareData = m.listenTrackShare
        const rowInner = (
          <ListenTrackShareChatRow
            id={m.id}
            isSelf={isSelf}
            data={shareData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOpen={() => requestOpenListenTrackShareCard(shareData)}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.sharedRecord) {
        const shareData = m.sharedRecord
        const rowInner = (
          <SharedRecordChatRow
            id={m.id}
            isSelf={isSelf}
            data={shareData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            multiSelectAvatar={msAvatar}
            personaContacts={personaContactsList}
            playerDisplayName={playerDisplayName.trim() || '我'}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.locationShare) {
        const locData = m.locationShare
        const rowInner = (
          <LocationChatRow
            id={m.id}
            isSelf={isSelf}
            data={locData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            showBubbleTail={showBubbleTailForRow}
            bubbleTailMaskColor={chatTailMaskColor}
            messageTimestampMs={usesMessengerBubbleTime ? m.timestamp : undefined}
            telegramShowReadChecks={
              isSelf && (m.status ?? 'sent') !== 'sending' && (m.status ?? 'sent') !== 'failed'
            }
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.takeoutOrder) {
        const takeoutData = m.takeoutOrder
        const rowInner = (
          <TakeoutOrderChatRow
            id={m.id}
            isSelf={isSelf}
            data={takeoutData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOpen={() => openTasteAppTracking(takeoutData.orderId, takeoutData)}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.pulseShare) {
        const pulseData = m.pulseShare
        const rowInner = (
          <PulseShareChatRow
            id={m.id}
            isSelf={isSelf}
            data={pulseData}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOpen={() => {
              const returnToChat =
                roomType === 'group'
                  ? {
                      kind: 'group' as const,
                      groupId:
                        groupId?.trim() ||
                        conversationCharacterId.replace(/^group:/, '').trim(),
                    }
                  : useLumiProjectAssistantPrompt
                    ? { kind: 'lumi' as const }
                    : isSelfMemoChat
                      ? { kind: 'self' as const }
                      : {
                          kind: 'persona' as const,
                          characterId: (
                            personaCharacterId?.trim() ||
                            conversationCharacterId.trim()
                          ).trim(),
                        }
              if (returnToChat.kind === 'group' && !returnToChat.groupId) {
                openLumiPulseApp({ postId: pulseData.postId })
                return
              }
              if (returnToChat.kind === 'persona' && !returnToChat.characterId) {
                openLumiPulseApp({ postId: pulseData.postId })
                return
              }
              openLumiPulseApp({ postId: pulseData.postId, returnToChat })
            }}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      if (m.redPacket) {
        const rp = m.redPacket
        const rowInner = (
          <RedPacketChatRow
            id={m.id}
            isSelf={isSelf}
            data={{
              remark: rp.remark,
              opened: rp.opened,
              amountYuan: rp.amountYuan,
              expired: rp.expired === true,
            }}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            selected={actionPanelOpen && actionMessageId === m.id}
            replyPreview={buildInlineReplyPreview(m)}
            onOpen={() => {
              const live = msgById.get(m.id)
              const liveRp = live?.redPacket ?? rp
              const liveIsSelf = live ? live.from === 'self' : isSelf
              if (!liveRp) return
              const openedNow = Boolean(liveRp.opened || isLumiRedPacketOpenedUi(m.id))
              if (liveRp.expired && !openedNow) {
                showCenterToastRef.current('该红包已过期')
                return
              }
              // 已领取：必须进详情。若误走拆红包弹层，会因 opened 立刻被关掉，表现为「点了没反应」
              if (openedNow) {
                if (onNavigateRedPacketDetailRef.current) {
                  const senderName = liveIsSelf
                    ? playerDisplayName.trim() || '我'
                    : peerNotifyTitle.trim() || '对方'
                  const senderAvatarUrl = liveIsSelf ? playerAvatarResolved : peerAvatarResolved
                  onNavigateRedPacketDetailRef.current({
                    messageId: m.id,
                    amountYuan: liveRp.amountYuan,
                    remark: liveRp.remark,
                    senderName,
                    senderAvatarUrl,
                    chatPeerName: peerNotifyTitle.trim() || '聊天',
                    claimerName: liveIsSelf
                      ? peerNotifyTitle.trim() || '对方'
                      : playerDisplayName.trim() || '我',
                    fromSelf: liveIsSelf,
                    opened: true,
                  })
                } else {
                  showCenterToastRef.current('暂时无法打开红包详情')
                }
                return
              }
              if (liveIsSelf) {
                if (onNavigateRedPacketDetailRef.current) {
                  onNavigateRedPacketDetailRef.current({
                    messageId: m.id,
                    amountYuan: liveRp.amountYuan,
                    remark: liveRp.remark,
                    senderName: playerDisplayName.trim() || '我',
                    senderAvatarUrl: playerAvatarResolved,
                    chatPeerName: peerNotifyTitle.trim() || '聊天',
                    fromSelf: true,
                    opened: false,
                  })
                } else {
                  showCenterToastRef.current('暂时无法打开红包详情')
                }
                return
              }
              setRedPacketModalMessageId(m.id)
            }}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />
        )
        return wrap(rowInner, renderDetachedReply(m, isSelf))
      }

      if (m.transfer) {
        const tid = m.transfer.transferId
        const transferBubblePerspective = resolveSelfTransferAckBubblePerspective(
          m,
          isSelf,
          playerIdentityId,
          getCurrentTimeMs,
        )
        /** 己方「已收款/已退还」转账卡（详情页确认）：勿随连续己方消息合并头像列隐藏，须始终显示用户头像 */
        const transferShowAvatarColumn =
          isSelf && transferBubblePerspective === 'incoming'
            ? true
            : isSelf
              ? showAvatarColumnSelf
              : showAvatarColumnOther
        const rowInner = (
          <TransferChatRow
            id={m.id}
            isSelf={isSelf}
            transferId={tid}
            transferBubblePerspective={transferBubblePerspective}
            getCurrentTime={getCurrentTimeMs}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={transferShowAvatarColumn}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            selected={actionPanelOpen && actionMessageId === m.id}
            replyPreview={buildInlineReplyPreview(m)}
            onOpen={() => {
              if (onNavigateTransferDetailRef.current) onNavigateTransferDetailRef.current(tid)
            }}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />
        )
        return wrap(rowInner, renderDetachedReply(m, isSelf))
      }

      if (m.callStatus) {
        const cs = m.callStatus
        const data =
          cs.status === 'duration'
            ? ({ status: 'duration', durationSec: cs.durationSec ?? 0 } as const)
            : cs.status === 'rejected'
              ? ({ status: 'rejected' } as const)
              : ({ status: 'no_answer' } as const)
        const bubbleText =
          data.status === 'duration'
            ? `通话时长 ${String(Math.floor(data.durationSec / 60)).padStart(2, '0')}:${String(data.durationSec % 60).padStart(2, '0')}`
            : data.status === 'rejected'
              ? '已拒接'
              : '对方未应答'
        const rowInner = (
          <WeChatMessageBubbleRow
            messageText={bubbleText}
            messagePrefixIcon={<PhoneCall className="size-[14px]" strokeWidth={1.9} aria-hidden />}
            isSelf={isSelf}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showBubbleTail={showBubbleTailForRow}
            variant="chat"
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            bubbleTailMaskColor={chatTailMaskColor}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            multiSelectAvatar={msAvatar}
          />
        )
        const rowWrapped =
          !isSelf && m.otherAnimated ? (
            <ChatMessageEnter isSelf={false}>{rowInner}</ChatMessageEnter>
          ) : isSelf && m.selfAnimated ? (
            <ChatMessageEnter isSelf>{rowInner}</ChatMessageEnter>
          ) : (
            rowInner
          )
        return wrap(rowWrapped, renderDetachedReply(m, isSelf))
      }

      const image = m.images?.[0]
      const img = image?.base64?.trim()
      if (img) {
        if (img.startsWith('data:')) {
          loggerRef.current.log('error', `渲染图片消息：base64 竟然包含 dataURL 前缀，len=${img.length}`)
        }
        const isSticker = typeof m.text === 'string' && m.text.trim().startsWith('[表情包]')
        const src = `data:${image?.type ?? 'image/jpeg'};base64,${img}`
        return wrap(
          <WeChatChatImageBubbleRow
            id={m.id}
            isSelf={isSelf}
            src={src}
            isSticker={isSticker}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOtherAvatarClick={sharedRowProps.onOtherAvatarClick}
            multiSelectAvatar={msAvatar}
            selected={actionPanelOpen && actionMessageId === m.id}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />,
          renderDetachedReply(m, isSelf),
        )
      }

      if (m.imageGenPending || m.imageGenFailed || m.imageGenAwaitingConfirm) {
        const isSticker = typeof m.text === 'string' && m.text.trim().startsWith('[表情包]')
        return wrap(
          <WeChatChatImageBubbleRow
            id={m.id}
            isSelf={isSelf}
            generating={!!m.imageGenPending && !m.imageGenFailed && !m.imageGenAwaitingConfirm}
            awaitingConfirm={!!m.imageGenAwaitingConfirm && !m.imageGenPending && !m.imageGenFailed}
            description={resolveCharacterImageDescriptionForUi(m)}
            genFailed={!!m.imageGenFailed}
            onRetry={
              !isSelf && m.imageGenFailed
                ? () => handleRetryCharacterImageGen(m)
                : undefined
            }
            onConfirmGenerate={
              !isSelf &&
              m.imageGenAwaitingConfirm &&
              resolveCharacterImageGenPromptForApi(m)
                ? () => handleConfirmCharacterImageGen(m)
                : undefined
            }
            isSticker={isSticker}
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showAvatarColumn={isSelf ? showAvatarColumnSelf : showAvatarColumnOther}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
            chatOtherSenderNickname={chatOtherSenderNickname}
            chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            onOtherAvatarClick={sharedRowProps.onOtherAvatarClick}
            multiSelectAvatar={msAvatar}
            selected={actionPanelOpen && actionMessageId === m.id}
            onLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) =>
                    openActionPanelFor({
                      id: m.id,
                      isSelf,
                      text: messagePlainPreview(m),
                      ts: m.timestamp,
                      anchorRect: rect,
                    })
            }
          />,
          renderDetachedReply(m, isSelf),
        )
      }
      if (!isSelf) {
        return wrap(
          <WeChatMessageBubbleRow
              messageText={m.text}
              luxuryDarkAdminBubble={!!sharedRowProps.luxuryDarkAdminBubble}
              isSelf={false}
              bubble={bubble}
              showAvatar={effectiveShowAvatar}
              showBubbleTail={showBubbleTailForRow}
              variant="chat"
              avatarTapMotion
              showAvatarColumn={showAvatarColumnOther}
              bubbleTailMaskColor={chatTailMaskColor}
              messageTimestampMs={usesMessengerBubbleTime ? m.timestamp : undefined}
              replyPreview={buildInlineReplyPreview(m)}
              chatOtherAvatarUrl={sharedRowProps.chatOtherAvatarUrl}
              chatOtherSenderNickname={chatOtherSenderNickname}
              chatOtherAvatarRankBadge={chatOtherAvatarRankBadge}
              groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
              onOtherAvatarClick={sharedRowProps.onOtherAvatarClick}
              bubbleSelected={actionPanelOpen && actionMessageId === m.id}
              onBubbleLongPress={
                isMultiSelectMode
                  ? undefined
                  : (rect) => openActionPanelFor({ id: m.id, isSelf: false, text: messagePlainPreview(m), ts: m.timestamp, anchorRect: rect })
              }
              multiSelectAvatar={msAvatar}
            />,
          renderDetachedReply(m, false),
        )
      }

      const st = m.status ?? 'sent'
      return wrap(
        <WeChatMessageBubbleRow
            messageText={m.text}
            isSelf
            bubble={bubble}
            showAvatar={effectiveShowAvatar}
            showBubbleTail={showBubbleTailForRow}
            variant="chat"
            showAvatarColumn={showAvatarColumnSelf}
            bubbleTailMaskColor={chatTailMaskColor}
            messageTimestampMs={usesMessengerBubbleTime ? m.timestamp : undefined}
            replyPreview={buildInlineReplyPreview(m)}
            telegramShowReadChecks={st !== 'sending' && st !== 'failed'}
            chatAccessory={st === 'failed' ? <FailRetryIcon onClick={() => retrySend(m.id, m.text)} /> : undefined}
            chatBubbleOverlay={st === 'sending' ? <span className="wx-chat-sending-dot" aria-hidden /> : undefined}
            chatSelfAvatarUrl={sharedMsgProps.chatSelfAvatarUrl}
            chatSelfAvatarRankBadge={chatSelfAvatarRankBadge}
            groupRankShowBesideNickname={sharedMsgProps.groupRankShowBesideNickname}
            bubbleSelected={actionPanelOpen && actionMessageId === m.id}
            onBubbleLongPress={
              isMultiSelectMode
                ? undefined
                : (rect) => openActionPanelFor({ id: m.id, isSelf: true, text: messagePlainPreview(m), ts: m.timestamp, anchorRect: rect })
            }
            multiSelectAvatar={msAvatar}
          />,
        renderDetachedReply(m, true),
      )
    })
  }, [
    bubble,
    bubbleSkinKey,
    bubbleTailStyle,
    messengerStyle,
    chatTailMaskColor,
    compactMessengerSpacing,
    visibleItems,
    itemsAfterUiOnlyHide,
    mergeAvatarGroup,
    showAvatar,
    showBubbleTail,
    showTimestamp,
    isMultiSelectMode,
    selectedSet,
    actionPanelOpen,
    actionMessageId,
    highlightedMessageId,
    msgById,
    playerDisplayName,
    peerNotifyTitle,
    peerAvatarResolved,
    playerAvatarResolved,
    expandedThinkingIds,
    recallAnimatingIds,
    roomType,
    groupLive,
    groupAvatarByCharId,
    showGroupMemberNicknameInChat,
    showGroupRankBadgesInChat,
    imageGenPatchVersion,
  ])

  const pendingRevealAvatarUrl = useMemo(() => {
    const head = pendingQueue[0]
    if (!head) return peerAvatarResolved?.trim() || ''
    const sid = head.senderCharacterId?.trim()
    if (roomType === 'group' && sid && groupLive) {
      if (sid === WECHAT_GROUP_BOT_CHARACTER_ID) return resolveGroupRobotAvatarDisplayUrl(groupLive)
      return (groupAvatarByCharId[sid] || peerAvatarResolved)?.trim() || ''
    }
    return peerAvatarResolved?.trim() || ''
  }, [pendingQueue, roomType, groupLive, groupAvatarByCharId, peerAvatarResolved])

  useEffect(() => {
    onPendingQueueCountChangeRef.current?.(pendingQueue.length)
  }, [pendingQueue.length])

  useEffect(() => {
    if (pendingQueue.length === 0) return
    const el = scrollRef.current
    if (!el) return
    const near = isScrollNearBottom(el)
    if (!near && userScrolledRef.current) return
    scrollToBottomSmooth()
  }, [pendingQueue.length, scrollToBottomSmooth])

  const effectiveInputBar = useMemo(
    () => resolveEffectiveChatInputBarForBubble(chatTheme.inputBar, bubble),
    [bubble, chatTheme.inputBar],
  )
  const btnPx = effectiveInputBar.buttonSize
  const btnColor = effectiveInputBar.buttonColor
  const inputBarLayout = effectiveInputBar.layout ?? 'lumi'
  const chatSkinScopeStyle = useMemo(
    () => ({
      ...chatDisplayFontCssVars(resolveChatDisplayFontFamily(bubble)),
      ...weChatChatSkinCssProperties(wechatTheme, { ...chatTheme, inputBar: effectiveInputBar }),
    }),
    [bubble, chatTheme, effectiveInputBar, wechatTheme],
  )
  const imessageComposer = inputBarLayout === 'imessage'
  const telegramComposer = inputBarLayout === 'telegram'
  const talkmakerComposer = inputBarLayout === 'talkmaker'

  useEffect(() => {
    return () => {
      if (enterDebounceTimerRef.current != null) window.clearTimeout(enterDebounceTimerRef.current)
      if (voiceHoldTimerRef.current != null) window.clearTimeout(voiceHoldTimerRef.current)
      if (opponentRevealTimerRef.current != null) window.clearTimeout(opponentRevealTimerRef.current)
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        voiceRecorderRef.current.stop()
      }
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const bgUrl = chatBackgroundUrl?.trim()
  const resolvedBgUrl = bgUrl ? resolvePublicImageUrl(bgUrl) : ''
  const defaultRoomBgStyle = useMemo(
    () => wechatChatRoomBgToStyle(chatRoomDefaultBg, resolvePublicImageUrl),
    [chatRoomDefaultBg],
  )
  /** 铺在整页固定层上，避免功能面板/表情面板抬起时 flex 收缩把 cover 背景挤变形 */
  const roomBgStyle = useMemo(() => {
    if (resolvedBgUrl) {
      return {
        backgroundColor: chatScrollThemeFallback,
        backgroundImage: `url(${resolvedBgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      } as CSSProperties
    }
    return defaultRoomBgStyle
  }, [resolvedBgUrl, chatScrollThemeFallback, defaultRoomBgStyle])

  const showDmOverlay = danmakuEnabled && !(effectiveDm?.skipCharacter)
  const dmZoneStyle = useMemo((): CSSProperties => {
    const p = effectiveDm?.position ?? 'top'
    if (p === 'middle') return { top: '28%', height: '30%' }
    if (p === 'bottom') return { top: '54%', height: '30%' }
    if (p === 'random') return { top: '6%', height: '58%' }
    return { top: '3%', height: '26%' }
  }, [effectiveDm?.position])

  if (embedMode === 'quick-reply') {
    return <div className="h-0 w-0 overflow-hidden" aria-hidden data-wx-quick-reply-engine />
  }

  probeChatRender('ChatRoom')

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col"
      data-wx-chat-motion-scope
      data-wx-chat-skin-scope
      style={chatSkinScopeStyle}
    >
      <style>{`@keyframes wxRecallShake { 0% { transform: translateX(0); opacity: 1; } 25% { transform: translateX(-2px); } 50% { transform: translateX(2px); } 75% { transform: translateX(-1px); } 100% { transform: translateX(0); opacity: 0.75; } }`}</style>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={roomBgStyle}
        aria-hidden
      />
      {showDmOverlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-[60]">
          <DanmakuOverlay bullets={dmBullets} zoneStyle={dmZoneStyle} />
        </div>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={onScrollPane}
        className="relative z-[1] min-h-0 w-full max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-transparent py-4 pl-0 pr-0 [-webkit-overflow-scrolling:touch]"
        style={{
          // 给消息列表留出“键盘上移后的输入栏”空间，避免最后几条被挡住
          paddingBottom: 12 + (isMultiSelectMode ? 86 : 0),
          scrollBehavior: 'auto',
        }}
      >
        {/* 多选模式不在顶部显示“已选中” */}
        <div ref={topSentinelRef} className="h-px w-full shrink-0 bg-transparent opacity-0" aria-hidden />
        {canLoadMoreAtTop || historyLoading ? (
          <div className="relative flex min-h-[36px] shrink-0 items-center justify-center pb-1 pt-1">
            {canLoadMoreAtTop ? (
              <button
                type="button"
                className="rounded-full border border-[#dcdcdc] bg-white px-3 py-1 text-[12px] text-[#666] active:bg-[#f5f5f5] disabled:opacity-60"
                disabled={historyLoading}
                onClick={() => void loadMoreHistory()}
              >
                {historyLoading ? '加载中...' : '加载更多聊天记录'}
              </button>
            ) : null}
            {historyLoading ? (
              <div className="wx-chat-history-dots pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" aria-live="polite">
                <span className="wx-chat-history-dot" />
                <span className="wx-chat-history-dot" />
                <span className="wx-chat-history-dot" />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative z-[1] flex w-full max-w-full flex-col">
              {messagesView ? (
            <WeChatChatRenderErrorBoundary
              onRetry={() => {
                setItems((prev) => [...prev])
              }}
            >
              <ChatMessageList>{messagesView}</ChatMessageList>
            </WeChatChatRenderErrorBoundary>
          ) : null}
          {pendingQueue.length > 0 || typingFooterInterrupt ? (
            <TypingIndicatorBubble
              avatarUrl={pendingRevealAvatarUrl}
              showAvatar={showAvatar}
              avatarRadiusPx={bubble.avatarRadiusPx}
            />
          ) : null}
        </div>
      </div>

      <div ref={keyboardInsetFillRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-[8]" aria-hidden />

      {isMultiSelectMode ? (
        <motion.div
          className="relative z-10 w-full max-w-full shrink-0 border-t border-gray-200/60 bg-white/95 transform-gpu will-change-transform"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex h-[56px] items-center justify-center gap-16 px-8">
            {(() => {
              const enabled = selectedMessageIds.length > 0
              return (
                <>
                  <Pressable
                    type="button"
                    disabled={!enabled}
                    aria-label="删除"
                    className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35"
                    onClick={() => setMultiDeleteConfirmOpen(true)}
                  >
                    <Trash2 size={20} strokeWidth={1.75} color={enabled ? '#111111' : '#8e8e8e'} aria-hidden />
                  </Pressable>
                  <Pressable
                    type="button"
                    disabled={!enabled}
                    aria-label="转发"
                    className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35"
                    onClick={() => setForwardModeSheetOpen(true)}
                  >
                    <Share2 size={20} strokeWidth={1.75} color={enabled ? '#111111' : '#8e8e8e'} aria-hidden />
                  </Pressable>
                </>
              )
            })()}
          </div>
        </motion.div>
      ) : (
        <>
          {pendingNewCount > 0 ? (
            <div
              ref={newMsgFabWrapRef}
              className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
              style={{ bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}
            >
              <Pressable
                type="button"
                aria-label="查看新消息并滚动到底部"
                onClick={jumpToBottom}
                className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] text-[#6b7280] shadow-sm active:bg-[#f5f5f5]"
              >
                <span>新消息{pendingNewCount}条</span>
                <ChevronDown size={14} color="#6b7280" aria-hidden />
              </Pressable>
            </div>
          ) : null}
          <div
            ref={inputBarRef}
            data-wx-chat-input-bar
            className="relative z-10 w-full max-w-full shrink-0 border-t"
            style={{
              backgroundColor: imessageComposer
                ? 'rgba(255, 255, 255, 0.8)'
                : telegramComposer || talkmakerComposer
                  ? '#FFFFFF'
                  : 'var(--wx-chat-input-bar-bg, var(--wx-input-bg))',
              backdropFilter: imessageComposer ? 'blur(20px)' : undefined,
              WebkitBackdropFilter: imessageComposer ? 'blur(20px)' : undefined,
              borderTopColor: imessageComposer
                ? 'rgba(0, 0, 0, 0.08)'
                : telegramComposer
                  ? 'transparent'
                  : talkmakerComposer
                    ? '#E5E5E5'
                    : 'var(--wx-chat-input-bar-border, #e5e5e5)',
              boxShadow: telegramComposer ? '0 -1px 4px rgba(0, 0, 0, 0.06)' : undefined,
              paddingLeft: talkmakerComposer ? 0 : 12,
              paddingRight: talkmakerComposer ? 0 : 12,
              paddingTop: talkmakerComposer ? 0 : 12,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              transition: 'transform 220ms ease-out',
            }}
          >
        {!isMultiSelectMode ? (
          <ProactiveMessageCountdownHost
            conversationKey={conversationKey}
            enabled={proactiveCountdownEnabled}
            isBusyActive={proactiveBusyActive}
          />
        ) : null}
        {composerToast ? (
          <div className="mb-2 rounded-[10px] bg-neutral-900 px-3 py-2 text-center text-[12px] leading-snug text-white">
            {composerToast}
          </div>
        ) : null}
        {replyingTo ? (
          <div
            className="mb-2 h-11 border-b border-[#ececec] bg-[#f5f5f5]"
            aria-label="引用预览"
          >
            <div className="flex h-full items-center pl-4 pr-2">
              <span className="mr-3 h-6 w-px shrink-0 bg-black" aria-hidden />
              <div className="min-w-0 flex-1 text-[#6b7280]">
                <div className="truncate text-[14px] leading-[1.2]">{replyingTo.senderName}：</div>
                <div className="truncate text-[14px] leading-[1.2]">{replyingTo.content || '...'}</div>
              </div>
              <Pressable
                type="button"
                aria-label="取消引用"
                className="ml-2 flex h-6 w-6 items-center justify-center rounded-[8px] active:bg-black/5"
                onClick={() => setReplyingTo(null)}
              >
                <X size={16} color="#8e8e8e" aria-hidden />
              </Pressable>
            </div>
          </div>
        ) : null}
        {keyboardDebugEnabled ? (
          <div className="mb-2 rounded-[10px] border border-[#d9d9d9] bg-[#fafafa] px-2 py-2 text-[12px] text-[#333]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span>键盘抬升补偿调试</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[#666]">补偿：{keyboardDebugInsetPx >= 0 ? '+' : ''}{keyboardDebugInsetPx}px</span>
                <Pressable
                  type="button"
                  aria-label="关闭键盘调试盘"
                  className="flex h-6 w-6 items-center justify-center rounded-[8px] border border-[#e5e5e5] bg-white text-[#666] active:bg-[#f3f3f3]"
                  onClick={() => setUi({ keyboardDebugEnabled: false })}
                >
                  <X size={14} aria-hidden />
                </Pressable>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={-220}
                max={220}
                step={1}
                value={keyboardDebugInsetPx}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setUi({ keyboardDebugInsetPx: Number.isFinite(n) ? Math.max(-220, Math.min(220, Math.round(n))) : 0 })
                }}
                className="h-8 w-24 rounded-[8px] border border-[#ddd] bg-white px-2 text-[12px] outline-none"
                aria-label="键盘抬升补偿（像素）"
              />
              <input
                type="range"
                min={-220}
                max={220}
                step={1}
                value={keyboardDebugInsetPx}
                onChange={(e) => setUi({ keyboardDebugInsetPx: Number(e.target.value) })}
                className="min-w-0 flex-1"
                aria-label="键盘抬升补偿滑杆"
              />
              <Pressable
                type="button"
                onClick={() => setUi({ keyboardDebugInsetPx: 0 })}
                className="h-8 rounded-[8px] border border-[#ddd] bg-white px-3 text-[12px] text-[#333]"
              >
                归零
              </Pressable>
            </div>
          </div>
        ) : null}
        {roomType === 'group' && groupAtOpen && inputMode === 'text' && groupLive ? (
          <div
            className="mb-2 max-h-[min(40vh,240px)] overflow-y-auto rounded-[12px] border border-[#e5e7eb] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            role="listbox"
            aria-label="选择要@的群成员"
            aria-activedescendant={
              groupAtPickRows[groupAtHighlightIdx]
                ? `wx-group-at-${groupAtPickRows[groupAtHighlightIdx]!.key}`
                : undefined
            }
          >
            {groupAtPickRows.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-[#9CA3AF]">无匹配成员</div>
            ) : (
              groupAtPickRows.map((row, idx) => {
                const isAll = row.key === '__all__'
                const isBot = row.key === WECHAT_GROUP_BOT_CHARACTER_ID
                const avatarUrl = !isAll && !isBot ? groupAvatarByCharId[row.key] : undefined
                return (
                  <Pressable
                    key={row.key}
                    id={`wx-group-at-${row.key}`}
                    type="button"
                    role="option"
                    aria-selected={idx === groupAtHighlightIdx}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                      idx === groupAtHighlightIdx ? 'bg-[#F3F4F6]' : 'active:bg-[#F9FAFB]'
                    }`}
                    onPointerEnter={() => setGroupAtHighlightIdx(idx)}
                    onClick={() => insertGroupMention(row.label)}
                  >
                    {isAll ? (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F9FAFB] text-[#111827]">
                        <AtSign className="size-[18px]" strokeWidth={2} aria-hidden />
                      </span>
                    ) : isBot ? (
                      <img
                        src={resolveGroupRobotAvatarDisplayUrl(groupLive)}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 shrink-0 rounded-[10px] border border-[#F3F4F6] object-cover"
                      />
                    ) : avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 shrink-0 rounded-[10px] border border-[#F3F4F6] object-cover"
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#F3F4F6] bg-[#F9FAFB] text-[11px] font-medium text-[#111827]">
                        {(row.label || '?').slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] text-[#111827]">{row.label}</span>
                    {isAll ? (
                      <span className="shrink-0 rounded-md bg-[#111827]/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        全员
                      </span>
                    ) : isBot ? (
                      <span className="shrink-0 rounded-md bg-[#111827]/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        机器人
                      </span>
                    ) : null}
                  </Pressable>
                )
              })
            )}
          </div>
        ) : null}
        <ChatInputBar
          inputMode={inputMode}
          btnPx={btnPx}
          btnColor={btnColor}
          layout={inputBarLayout}
          sendButtonColor={effectiveInputBar.sendButtonColor}
          borderRadius={effectiveInputBar.borderRadius}
          borderColor={effectiveInputBar.borderColor}
          draft={draft}
          sendBusy={sendBusy || aiPipelineBlocksSend}
          planeCanAct={planeCanAct}
          plusMenuOpen={plusMenuOpen}
          onToggleInputMode={() => {
            setInputMode((m) => (m === 'text' ? 'voice' : 'text'))
            setStubPanel(null)
            setPlusMenuOpen(false)
          }}
          textareaRef={textareaRef}
          onVoicePointerDown={onVoicePointerDown}
          onVoicePointerMove={onVoicePointerMove}
          onVoicePointerUp={onVoicePointerUp}
          onDraftChange={(v) => setDraft(v)}
          onComposerKeyDown={onComposerKeyDown}
          onToggleEmoji={() => {
            setPlusMenuOpen(false)
            setStubPanel('emoji')
            textareaRef.current?.blur()
          }}
          onShowKeyboard={showComposerKeyboard}
          emojiPanelOpen={stubPanel === 'emoji'}
          onTogglePlus={() => {
            setStubPanel(null)
            setCameraOpen(false)
            setPlusMenuOpen((v) => !v)
          }}
          onSend={onSendButtonClick}
        />

        {stubPanel ? (
          <ChatEmojiPickerPanel
            onInsertClassicEmoji={insertClassicEmojiAtCaret}
            onPickSticker={({ url, description }) => {
              void sendStickerFromPicker({ url, description })
            }}
          />
        ) : null}

        <motion.div
          initial={false}
          animate={{ height: plusMenuOpen ? PLUS_MENU_HEIGHT_PX : 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className={`w-full max-w-full min-w-0 overflow-hidden bg-white ${plusMenuOpen ? '' : 'pointer-events-none'}`}
        >
          <div className="w-full max-w-full min-w-0" style={{ height: PLUS_MENU_HEIGHT_PX }}>
            <WeChatChatPlusMenuPanel onAction={handlePlusAction} />
          </div>
        </motion.div>
      </div>
        </>
      )}

      <AnimatePresence>
        {voiceOverlayOpen ? (
          <VoiceOverlay
            open={voiceOverlayOpen}
            activeZone={voiceGestureZone}
            durationSec={Math.max(1, Math.round((Date.now() - (voiceSessionStartMs ?? Date.now())) / 1000))}
            thumbOrigin={voiceThumbOrigin}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mockVoiceInputOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] transform-gpu bg-black/20 will-change-transform"
            onClick={() => setMockVoiceInputOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0.7 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="absolute inset-x-3 bottom-3 transform-gpu rounded-[20px] border border-[#ece7da] bg-[#fffdfa] p-4 shadow-xl will-change-transform"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[13px] leading-relaxed text-[#555]">
                当前未配置语音 API，请直接输入您的台词，并可使用括号标注语气（例如：*(温柔地) 你好*）。发送后将显示为语音气泡。
              </div>
              <textarea
                className="mt-3 min-h-[96px] w-full resize-none rounded-[12px] border border-[#e9e4d8] bg-white px-3 py-2 text-[14px] outline-none"
                placeholder="请输入要发送的台词..."
                value={mockVoiceInputDraft}
                onChange={(e) => setMockVoiceInputDraft(e.target.value)}
              />
              <div className="mt-3 flex justify-end gap-2">
                <Pressable
                  className="rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px]"
                  onClick={() => setMockVoiceInputOpen(false)}
                >
                  取消
                </Pressable>
                <Pressable
                  className="rounded-[10px] bg-[#f4efe3] px-3 py-1.5 text-[13px] text-[#2f2f2f]"
                  onClick={() => {
                    const text = mockVoiceInputDraft.trim()
                    if (!text) return
                    const normalizedScript = normalizeVoiceScriptForTts(text)
                    void appendVoiceMessage({
                      durationSec: estimateVoiceDurationSecFromScript(text),
                      transcriptText: text,
                      ttsScript: normalizedScript,
                      emotion: pickVoiceEmotionForTts(normalizedScript),
                    }).then(() => {
                      setMockVoiceInputDraft('')
                      setMockVoiceInputOpen(false)
                    })
                  }}
                >
                  发送语音
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <WeChatChatPhotoPickerSheet
        open={photoPickerOpen}
        onClose={() => setPhotoPickerOpen(false)}
        onToast={showComposerToast}
        onSend={(payloads) => {
          setPhotoPickerOpen(false)
          commitSendImages(payloads, false)
        }}
      />

      <ChatRoomFavoritesPicker
        open={favoritesPickerOpen}
        sending={favoriteShareSending}
        onClose={() => {
          if (favoriteShareSending) return
          setFavoritesPickerOpen(false)
        }}
        onPick={(item) => void commitSendFavoriteSharedRecord(item)}
        personaContacts={personaContactsList}
      />

      <AnimatePresence>
        {cameraOpen ? (
          <WeChatChatCameraScreen
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onToast={showComposerToast}
            onSend={({ base64, mime }) => {
              setCameraOpen(false)
              // 微信一致：拍摄/相册发送只是“发出去”，不自动触发对方回复；
              // 用户需要点纸飞机（空输入）或双击回车等方式再触发模型回复。
              commitSendImage(base64, false, mime)
            }}
          />
        ) : null}
      </AnimatePresence>

      <VoiceCallActionSheet
        open={callSheetOpen}
        onClose={() => setCallSheetOpen(false)}
        onChooseVoice={() => {
          setActiveCallInitiator('self')
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
          setCallingOpen(true)
        }}
      />
      <LocationSpoofModal
        open={locationSpoofOpen}
        sending={locationSending}
        conversationCharacterId={conversationCharacterId}
        onClose={() => {
          if (locationSending) return
          setLocationSpoofOpen(false)
        }}
        onSend={(payload) => {
          void commitSendLocation(payload)
        }}
        onSendToContact={
          roomType === 'private'
            ? async (characterId, payload) => commitSendLocationToContact(characterId, payload)
            : undefined
        }
      />
      <CallingScreen
        open={callingOpen}
        peerRemarkName={peerNotifyTitle.trim() || '对方'}
        peerAvatarUrl={peerAvatarResolved}
        backgroundImage={undefined}
        onCancel={() => {
          setCallingOpen(false)
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onDecision={(d) => {
          setCallingOpen(false)
          if (d === 'ACCEPT') {
            setVoiceCallOpen(true)
            return
          }
          if (d === 'REJECT') {
            const initiator = activeCallInitiator ?? 'self'
            void (async () => {
              await appendCallStatusBubble({ status: 'rejected' }, initiator)
              // 角色拒接用户来电后，必须走模型追加一条“普通消息”解释原因（不可本地硬编码文案）。
              if (initiator === 'self') {
                retryReplyBiasRef.current = [
                  '[系统提示] 你刚刚拒接了用户来电。',
                  '- 现在请继续按普通线上聊天机制自然回复，解释拒接原因（例如正在忙/不方便接听/情绪上不想接）。',
                  '- 必须保持人设和当前关系状态；如果双方在闹矛盾，可直接带情绪表达不想接电话。',
                  '- 禁止输出协议标签或 JSON，按正常微信聊天口吻分行回复。',
                ].join('\n')
                bumpPendingAiRepliesForReply()
                void flushAiReplies(conversationKey.trim())
              }
            })()
            setActiveCallInitiator(null)
            setIncomingCallOpeningLine('')
            setOutgoingCallOpeningLine('')
            return
          }
          void appendCallStatusBubble({ status: 'no_answer' }, activeCallInitiator ?? 'self')
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        requestDecision={async () => {
          let character: Character | null = null
          let worldBackgroundPrompt: string | undefined
          const pcid = personaCharacterId?.trim()
          const lumiAssistantChat = useLumiProjectAssistantPrompt
          if (!lumiAssistantChat && pcid) {
            try {
              character = await personaDb.getCharacter(pcid)
              if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
                const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
                const block = formatWorldBackgroundForPrompt(wbg)
                if (block.trim()) worldBackgroundPrompt = block
              }
            } catch {
              character = null
            }
          }

          let playerIdentity: PlayerIdentity | null = null
          let loadPid = playerIdentityId.trim()
          if (!lumiAssistantChat && character?.playerIdentityId?.trim()) {
            const b = character.playerIdentityId.trim()
            if (b && b !== '__none__') loadPid = b
          }
          if (!lumiAssistantChat && loadPid && loadPid !== '__none__') {
            try {
              playerIdentity = await personaDb.getPlayerIdentityForWechatAccount(loadPid, currentAccountId)
            } catch {
              playerIdentity = null
            }
          }

          const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
          const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
          const offlineDatingPlotsContext =
            promptMode === 'persona' && pcid
              ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
              : ''
          const transcript = itemsToTranscript(buildChatItemsForAiTranscript())
          const groupRef = await loadPrivateGroupChatsRecentReference()
          const vMem = await buildPrivateMemoryInjectionForAi(transcript, '')
          const res = await requestWeChatVoiceCallDecision({
            apiConfig,
            character,
            playerIdentity,
            playerDisplayName: peerName,
            transcript,
            promptMode,
            longTermMemoryNotes: vMem.memory || undefined,
            storyTimelineNotes: vMem.storyTimeline || undefined,
            worldBackgroundPrompt,
            offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
            recentGroupChatsReference: groupRef || undefined,
            unsummarizedPrivateNotes: vMem.unsPrivate || undefined,
            unsummarizedGroupNotes: vMem.unsGroup || undefined,
            crossChannelTimelineNotes: vMem.crossChannelTimeline || undefined,
            recentPrivateAiRoundsNotes: vMem.recentPrivateAiRounds || undefined,
            recentOfflineAiRoundsNotes: vMem.recentOfflineAiRounds || undefined,
            recentMeetAiRoundsNotes: vMem.recentMeetAiRounds || undefined,
            currentTimeMs: getCurrentTimeMs(),
            timePerceptionEnabled: roomType === 'private' ? timePerceptionEnabled : true,
            globalWechatPlate: roomType === 'group' ? 'group_chat' : 'private_chat',
          })
          if (res.decision === 'ACCEPT') {
            const opening = String(res.opening ?? '').trim()
            setOutgoingCallOpeningLine(opening)
          }
          return res.decision
        }}
      />
      <IncomingCallScreen
        open={incomingCallOpen}
        peerRemarkName={peerNotifyTitle.trim() || '对方'}
        peerAvatarUrl={peerAvatarResolved}
        backgroundImage={undefined}
        onReject={() => {
          if (incomingRejectLockRef.current) return
          incomingRejectLockRef.current = true
          setIncomingCallOpen(false)
          void appendCallStatusBubble({ status: 'rejected' }, activeCallInitiator ?? 'other')
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onAccept={() => {
          incomingRejectLockRef.current = false
          setIncomingCallOpen(false)
          setVoiceCallOpen(true)
        }}
      />
      <VoiceCallPanelCompat
        open={voiceCallOpen}
        peerRemarkName={peerNotifyTitle.trim() || '对方'}
        peerAvatarUrl={peerAvatarResolved}
        // 预留：从“我的 -> 设置 -> 通话背景”读取并传入
        backgroundImage={undefined}
        initialAiText={
          activeCallInitiator === 'other'
            ? incomingCallOpeningLine
            : activeCallInitiator === 'self'
              ? outgoingCallOpeningLine
              : ''
        }
        onClose={() => {
          setVoiceCallOpen(false)
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onHangup={(durationSec) => {
          void appendCallStatusBubble({ status: 'duration', durationSec }, activeCallInitiator ?? 'self')
          setActiveCallInitiator(null)
          setIncomingCallOpeningLine('')
          setOutgoingCallOpeningLine('')
        }}
        onRequestAiReply={async (text, opts) => {
          let character: Character | null = null
          let worldBackgroundPrompt: string | undefined
          const pcid = personaCharacterId?.trim()
          const lumiAssistantChat = useLumiProjectAssistantPrompt
          if (!lumiAssistantChat && pcid) {
            try {
              character = await personaDb.getCharacter(pcid)
              if (character?.worldBackgroundEnabled !== false && character?.worldBackgroundId?.trim()) {
                const wbg = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
                const block = formatWorldBackgroundForPrompt(wbg)
                if (block.trim()) worldBackgroundPrompt = block
              }
            } catch {
              character = null
            }
          }

          let playerIdentity: PlayerIdentity | null = null
          let loadPidVc = playerIdentityId.trim()
          if (!lumiAssistantChat && character?.playerIdentityId?.trim()) {
            const b = character.playerIdentityId.trim()
            if (b && b !== '__none__') loadPidVc = b
          }
          if (!lumiAssistantChat && loadPidVc && loadPidVc !== '__none__') {
            try {
              playerIdentity = await personaDb.getPlayerIdentityForWechatAccount(
                loadPidVc,
                currentAccountId,
              )
            } catch {
              playerIdentity = null
            }
          }

          const peerName = playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'
          const promptMode = lumiAssistantChat ? 'lumi-assistant' : 'persona'
          const offlineDatingPlotsContext =
            promptMode === 'persona' && pcid
              ? await loadOfflineDatingPlotsPromptBlock(pcid, character?.name ?? null)
              : ''

          const transcript: ChatTranscriptTurn[] = [
            ...itemsToTranscript(buildChatItemsForAiTranscript()),
            {
              from: 'self',
              text:
                opts?.fromVoice && opts.voiceEmotion
                  ? `（这是一条用户语音转写；识别到的情绪倾向：${opts.voiceEmotion}。请先按该情绪理解用户状态，再给出有情绪承接的回复。）\n${text}`
                  : text,
            },
          ]
          const groupRef = await loadPrivateGroupChatsRecentReference()
          const vMem = await buildPrivateMemoryInjectionForAi(transcript, text)
          let worldBookPlaceholderIdMapVc: Record<string, string> | undefined
          if (character?.generatedForCharacterId?.trim()) {
            try {
              const rid = character.generatedForCharacterId.trim()
              const rootCh = await personaDb.getCharacter(rid)
              const rootNm = rootCh?.name?.trim()
              if (rootNm) worldBookPlaceholderIdMapVc = { [rid]: rootNm }
            } catch {
              /* ignore */
            }
          }
          return await requestWeChatVoiceCallReplyText({
            apiConfig,
            character,
            playerIdentity,
            playerDisplayName: peerName,
            transcript,
            promptMode,
            longTermMemoryNotes: vMem.memory || undefined,
            storyTimelineNotes: vMem.storyTimeline || undefined,
            worldBackgroundPrompt,
            offlineDatingPlotsContext: offlineDatingPlotsContext || undefined,
            recentGroupChatsReference: groupRef || undefined,
            unsummarizedPrivateNotes: vMem.unsPrivate || undefined,
            unsummarizedGroupNotes: vMem.unsGroup || undefined,
            crossChannelTimelineNotes: vMem.crossChannelTimeline || undefined,
            recentPrivateAiRoundsNotes: vMem.recentPrivateAiRounds || undefined,
            recentOfflineAiRoundsNotes: vMem.recentOfflineAiRounds || undefined,
            recentMeetAiRoundsNotes: vMem.recentMeetAiRounds || undefined,
            currentTimeMs: getCurrentTimeMs(),
            timePerceptionEnabled: roomType === 'private' ? timePerceptionEnabled : true,
            globalWechatPlate: roomType === 'group' ? 'group_chat' : 'private_chat',
            worldBookPlaceholderIdMap: worldBookPlaceholderIdMapVc,
          })
        }}
        onTranscribeAudio={async (audioBlob) => {
          if (!voiceAsrEnabled) {
            throw new Error('语音识别已关闭，无法使用')
          }
          const cfg = voiceAsrApiConfig
          if (!cfg?.apiKey?.trim()) {
            throw new Error('未配置语音识别api，无法使用')
          }
          return await requestSiliconflowTranscription(cfg, audioBlob)
        }}
      />

      {roomType === 'private' ? (
        <CharacterPsycheRadarSheet
          open={psycheRadarOpen}
          loading={psycheRadarLoading}
          generating={psycheRadarGenerating}
          generateError={psycheRadarGenerateError}
          onDismissGenerateError={() => setPsycheRadarGenerateError(null)}
          onGenerate={() => void generateCharacterPsyche()}
          characterName={psycheCharacterFullName || peerNotifyTitle.trim() || '—'}
          avatarUrl={peerAvatarResolved}
          state={psycheRadarState}
          summaries={psycheRadarSummaries}
          previousMetrics={psycheRadarPreviousMetrics}
          lastGeneratedAt={psycheRadarLastGeneratedAt}
          onClose={() => {
            setPsycheRadarGenerateError(null)
            onPsycheRadarOpenChange?.(false)
          }}
        />
      ) : null}

      {roomType === 'group' ? (
        <GroupPsycheModal
          open={heartWhisperOpen}
          loading={heartWhisperLoading}
          archive={groupPsycheArchive}
          generateError={groupPsycheGenerateError}
          onDismissGenerateError={() => setGroupPsycheGenerateError(null)}
          onClose={() => {
            setHeartWhisperOpen(false)
            setGroupPsycheGenerateError(null)
          }}
          onGenerate={() => void generateGroupPsyche()}
        />
      ) : (
        <HeartWhisperModal
          open={heartWhisperOpen}
          loading={heartWhisperLoading}
          data={heartWhisperData}
          characterName={psycheCharacterFullName || peerNotifyTitle.trim() || undefined}
          generateError={heartWhisperGenerateError}
          onDismissGenerateError={() => setHeartWhisperGenerateError(null)}
          onClose={() => {
            setHeartWhisperOpen(false)
            setHeartWhisperGenerateError(null)
          }}
          onGenerate={() => void generateHeartWhisper()}
        />
      )}

      {redPacketModalSender ? (
        <RedPacketModal
          key={redPacketModalMessageId ?? 'rp'}
          open
          amountYuan={redPacketModalSender.amountYuan}
          remark={redPacketModalSender.remark}
          senderName={redPacketModalSender.senderName}
          senderAvatarUrl={redPacketModalSender.senderAvatarUrl}
          onClose={() => setRedPacketModalMessageId(null)}
          onClaimIntent={() => {
            const id = redPacketModalIdRef.current
            if (id) markRedPacketOpenedInUi(id)
          }}
          onFlowComplete={async () => {
            const id = redPacketModalIdRef.current
            if (!id) return
            const liveBefore = extractMessages(itemsRef.current).find((it) => it.id === id)
            const liveRp = liveBefore?.redPacket
            // 拆封点击时可能已标过；此处再刷一次保证样式与 ref 一致
            markRedPacketOpenedInUi(id)
            setRedPacketModalMessageId(null)

            const amountYuan = liveRp?.amountYuan
            if (onNavigateRedPacketDetailRef.current && liveRp) {
              const isSelfMsg = liveBefore?.from === 'self'
              onNavigateRedPacketDetailRef.current({
                messageId: id,
                amountYuan: liveRp.amountYuan,
                remark: liveRp.remark,
                senderName: isSelfMsg ? playerDisplayName.trim() || '我' : peerNotifyTitle.trim() || '对方',
                senderAvatarUrl: isSelfMsg ? playerAvatarResolved : peerAvatarResolved,
                chatPeerName: peerNotifyTitle.trim() || '聊天',
                claimerName: isSelfMsg
                  ? peerNotifyTitle.trim() || '对方'
                  : playerDisplayName.trim() || '我',
                fromSelf: isSelfMsg,
                opened: true,
              })
            }

            // 角色红包可能尚未落库：短重试，避免只写了系统条、气泡仍是未领
            let patched = false
            for (let attempt = 0; attempt < 10; attempt += 1) {
              const fromDb = await personaDb.getWeChatChatMessageById(id)
              const cur = fromDb?.redPacket
              if (cur) {
                await personaDb.patchWeChatChatMessageById(id, {
                  redPacket: { ...cur, opened: true },
                })
                patched = true
                break
              }
              await new Promise((r) => window.setTimeout(r, 80 + attempt * 60))
            }
            if (!patched && liveRp) {
              // 仍无行时：靠 locallyOpened + hydrate 合并保住样式
            }

            void appendSystemNote(`【系统】你领取了${peerNotifyTitle.trim() || '对方'}的红包`)
            if (amountYuan && Number.isFinite(amountYuan) && amountYuan > 0) {
              walletAdjustBalance(amountYuan)
              walletAddTransaction({
                type: 'topup',
                title: `收到${peerNotifyTitle.trim() || '对方'}的红包`,
                amount: amountYuan,
              })
            }
          }}
        />
      ) : null}

      <WeChatMessageActionPanel
        open={actionPanelOpen}
        anchor={actionAnchor}
        onAction={onActionPanelAction}
        actionIds={wechatActionPanelIds}
      />
      {retryReplyPromptOpen ? (
        <div className="fixed inset-0 z-[1210] flex items-center justify-center bg-black/50 px-4" role="presentation">
          <div className="w-full max-w-[360px] overflow-hidden rounded-[16px] bg-white shadow-lg">
            <div className="px-5 pb-4 pt-5">
              <h2 className="text-center text-[16px] font-semibold text-[#111]">重新回复偏向</h2>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-[#666]">
                填写你希望角色本轮偏向的方向（选填），将撤销当轮角色回复并重生一轮。
              </p>
              <textarea
                value={retryReplyBiasDraft}
                onChange={(e) => setRetryReplyBiasDraft(e.target.value.slice(0, 240))}
                placeholder="例如：先安抚我的情绪，再解释；语气更温柔一点"
                className="mt-3 h-[96px] w-full resize-none rounded-[12px] border border-[#e5e5e5] px-3 py-2 text-[14px] leading-relaxed text-black outline-none placeholder:text-[#9a9a9a] focus:border-[#cfcfcf]"
              />
            </div>
            <div className="grid grid-cols-2 border-t border-[#e5e5e5]">
              <Pressable
                type="button"
                className="h-[48px] text-[15px] text-[#111] active:bg-[#f5f5f5]"
                onClick={() => {
                  setRetryReplyPromptOpen(false)
                  setRetryReplyBiasDraft('')
                }}
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                className="h-[48px] border-l border-[#e5e5e5] text-[15px] text-[#111] active:bg-[#f5f5f5]"
                onClick={() => {
                  const bias = retryReplyBiasDraft
                  setRetryReplyPromptOpen(false)
                  setRetryReplyBiasDraft('')
                  void runRetryReply(bias)
                }}
              >
                确认重试
              </Pressable>
            </div>
          </div>
        </div>
      ) : null}
      {messageEditModal ? (
        <div
          className="fixed inset-0 z-[1225] flex items-center justify-center bg-black/60 px-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !messageEditSaving) {
              setMessageEditModal(null)
              setMessageEditDraft('')
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="编辑消息"
            className="w-full max-w-[min(400px,calc(100vw-32px))] overflow-hidden rounded-[16px] border border-neutral-900 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <div className="border-b border-neutral-200 bg-white px-4 py-3 text-center">
              <div className="text-[16px] font-semibold text-neutral-950">编辑消息</div>
              <div className="mt-1 text-[12px] text-neutral-500">
                {messageEditModal.isSelf ? '你发送的文本（保存后覆盖该气泡）' : '对方发送的文本（保存后覆盖该气泡）'}
              </div>
            </div>
            <div className="border-b border-neutral-200 bg-neutral-100 p-4">
              <textarea
                ref={messageEditTextareaRef}
                value={messageEditDraft}
                onChange={(e) => setMessageEditDraft(e.target.value)}
                className="min-h-[140px] w-full resize-y rounded-[12px] border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-relaxed text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:opacity-60"
                placeholder="编辑正文…"
                disabled={messageEditSaving}
              />
            </div>
            <div className="grid grid-cols-2 overflow-hidden bg-white">
              <Pressable
                type="button"
                className="h-[48px] border-r border-neutral-200 bg-white text-[15px] text-neutral-800 active:bg-neutral-100 disabled:opacity-50"
                disabled={messageEditSaving}
                onClick={() => {
                  setMessageEditModal(null)
                  setMessageEditDraft('')
                }}
              >
                取消
              </Pressable>
              <Pressable
                type="button"
                className="h-[48px] bg-neutral-950 text-[15px] font-medium text-white active:bg-neutral-800 disabled:opacity-50"
                disabled={messageEditSaving}
                onClick={() => void commitMessageEdit()}
              >
                {messageEditSaving ? '保存中…' : '完成'}
              </Pressable>
            </div>
          </div>
        </div>
      ) : null}
      <WeChatConfirmDialog
        open={voiceConfigAlertOpen}
        title="语音录音不可用"
        description={voiceConfigAlertMessage}
        cancelText="知道了"
        confirmText="去配置"
        onCancel={() => setVoiceConfigAlertOpen(false)}
        onConfirm={() => {
          setVoiceConfigAlertOpen(false)
          openApiSettings()
        }}
      />
      <WeChatConfirmDialog
        open={confirmDeleteOpen}
        title="删除消息"
        description="确定要删除这条消息吗？"
        cancelText="取消"
        confirmText="删除"
        onCancel={() => {
          setConfirmDeleteOpen(false)
          setActionMessageId(null)
          setActionMessageText('')
          setActionMessageCanRecall(false)
          setActionMessageModeratorRecall(false)
        }}
        onConfirm={() => {
          const mid = actionMessageId?.trim() || ''
          if (!mid) {
            setConfirmDeleteOpen(false)
            setActionMessageId(null)
            setActionMessageText('')
            setActionMessageCanRecall(false)
            setActionMessageModeratorRecall(false)
            return
          }
          void (async () => {
            await personaDb.deleteWeChatChatMessageById(mid)
            setItems((prev) => {
              const next = rebuildWithCurrentTime(extractMessages(prev).filter((it) => it.id !== mid))
              itemsRef.current = next
              return next
            })
            setConfirmDeleteOpen(false)
            closeActionPanel()
          })()
        }}
      />
      <WeChatConfirmDialog
        open={!!voiceResynthesizeConfirmId}
        title="重新合成语音"
        description="将按当前语音参数重新合成这条语音，并覆盖旧缓存。是否继续？"
        cancelText="取消"
        confirmText={voiceResynthesizing ? '合成中…' : '确认重合成'}
        onCancel={() => {
          if (voiceResynthesizing) return
          setVoiceResynthesizeConfirmId(null)
        }}
        onConfirm={() => {
          void runVoiceResynthesize()
        }}
      />
      <WeChatConfirmDialog
        open={multiDeleteConfirmOpen}
        title="删除消息"
        description={`确定要删除这${selectedMessageIds.length}条消息吗？`}
        cancelText="取消"
        confirmText="删除"
        onCancel={() => setMultiDeleteConfirmOpen(false)}
        onConfirm={() => {
          const ids = [...selectedMessageIds]
          if (!ids.length) {
            setMultiDeleteConfirmOpen(false)
            return
          }
          void (async () => {
            for (const id of ids) {
              await personaDb.deleteWeChatChatMessageById(id)
            }
            setItems((prev) => {
              const set = new Set(ids)
              const next = rebuildWithCurrentTime(extractMessages(prev).filter((it) => !set.has(it.id)))
              itemsRef.current = next
              return next
            })
            setMultiDeleteConfirmOpen(false)
            exitMultiSelect()
          })()
        }}
      />
      <MiniGameFlow
        lobbyOpen={gameLobbyOpen}
        session={miniGameSession}
        charId={conversationCharacterId}
        charName={peerNotifyTitle.trim() || '对方'}
        avatarUrl={peerAvatarResolved}
        playerAvatarUrl={playerAvatarResolved}
        conversationKey={conversationKey}
        onCloseLobby={() => setGameLobbyOpen(false)}
        onSendInvite={handleSendGameInvite}
        onCloseGame={() => setMiniGameSession(null)}
        onGameFinished={handleMiniGameFinished}
      />
      <CheckPhoneFlow
        open={checkPhoneOpen}
        characterId={conversationCharacterId}
        characterName={peerNotifyTitle.trim() || '对方'}
        playerIdentityId={playerIdentityId}
        playerDisplayName={playerDisplayName.trim() || state.profile.displayName.trim() || '朋友'}
        useLumiProjectAssistantPrompt={useLumiProjectAssistantPrompt}
        onToast={showComposerToast}
        onClose={() => setCheckPhoneOpen(false)}
      />
      <RecallHistoryModal
        open={recallModalOpen}
        record={recallModalRecord}
        onClose={() => {
          setRecallModalOpen(false)
          setRecallModalRecord(null)
        }}
      />
      <ShieldedMessageModal
        open={shieldedMessageModalOpen}
        text={shieldedMessageModalText}
        variant={shieldedMessageModalVariant}
        onClose={() => {
          setShieldedMessageModalOpen(false)
          setShieldedMessageModalText(null)
          setShieldedMessageModalVariant('blocked')
        }}
      />
      <WeChatCenterToast message={centerToast} />

      <AnimatePresence>
        {forwardModeSheetOpen ? (
          <motion.div
            className="fixed inset-0 z-[1206]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setForwardModeSheetOpen(false)
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-[16px] bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              exit={{ y: 30 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Pressable
                type="button"
                className="flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left active:bg-[#f5f5f5]"
                onClick={() => {
                  if (!selectedMessageIds.length) return
                  setShareForwardMode('multi-merge')
                  setForwardModeSheetOpen(false)
                  setShareHistorySheetOpen(true)
                }}
              >
                <span className="text-[15px] text-black">合并转发</span>
                <span className="text-[12px] text-[#8e8e8e]">聊天记录卡片</span>
              </Pressable>
              <Pressable
                type="button"
                className="mt-1 flex w-full items-center justify-between rounded-[12px] px-3 py-3 text-left active:bg-[#f5f5f5]"
                onClick={() => {
                  if (!selectedMessageIds.length) return
                  setShareForwardMode('multi-item')
                  setForwardModeSheetOpen(false)
                  setShareHistorySheetOpen(true)
                }}
              >
                <span className="text-[15px] text-black">逐条转发</span>
                <span className="text-[12px] text-[#8e8e8e]">按原顺序发送普通消息</span>
              </Pressable>
              <Pressable
                type="button"
                className="mt-3 w-full rounded-[12px] bg-[#f5f5f5] px-4 py-3 text-[15px] text-black active:bg-[#ededed]"
                onClick={() => setForwardModeSheetOpen(false)}
              >
                取消
              </Pressable>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ShareContactSheet
        open={shareHistorySheetOpen}
        sending={shareHistorySending}
        onClose={() => {
          if (shareHistorySending) return
          setShareHistorySheetOpen(false)
        }}
        onConfirm={async (characterId) => {
          const ids = [...selectedMessageIds]
          if (!ids.length) return
          setShareHistorySending(true)
          try {
            const rows = (
              await Promise.all(ids.map((id) => personaDb.getWeChatChatMessageById(id)))
            ).filter((x): x is WeChatChatMessage => !!x)
            if (!rows.length) {
              showCenterToast('所选消息不存在或已被删除')
              return
            }
            if (shareForwardMode === 'multi-item') {
              await forwardMessagesItemByItemToContact(characterId, rows)
              showCenterToast(`已逐条转发 ${rows.length} 条消息`)
            } else {
              await forwardMessagesMergedToContact(characterId, rows, {
                userName: playerDisplayName.trim() || '我',
                peerName: peerNotifyTitle.trim() || '对方',
                peerCharacterId: personaCharacterId?.trim() || conversationCharacterId.trim() || undefined,
              })
              showCenterToast('已转发聊天记录')
            }
            setShareHistorySheetOpen(false)
            exitMultiSelect()
          } catch (e) {
            showCenterToast(e instanceof Error ? e.message : '转发失败')
          } finally {
            setShareHistorySending(false)
          }
        }}
      />

    </div>
  )
}

/** 父级 WeChatApp 重绘时 props 常变；memo 阻断无意义的全量重跑 */
export const ChatRoom = memo(ChatRoomInner)
