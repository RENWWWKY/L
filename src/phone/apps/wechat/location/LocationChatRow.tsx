import type { WeChatBubbleTheme } from '../../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from '../group/ChatGroupSpeakerAvatarWrap'
import type { WeChatLocationPayload } from '../newFriendsPersona/types'
import { LocationMessageCard } from './LocationMessageCard'
import {
  ImessageLocationCard,
  TelegramLocationBubble,
  TalkmakerLocationCard,
  resolveMessengerBubbleStyle,
} from '../wechatMessengerSpecialBubbles'
import { formatTelegramBubbleTime } from '../wechatBubbleTelegramUi'
import {
  formatTalkmakerExternalTime,
  TalkmakerExternalTimestamp,
} from '../wechatBubbleTalkmakerUi'

type Props = {
  id: string
  isSelf: boolean
  data: WeChatLocationPayload
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showAvatarColumn: boolean
  showBubbleTail?: boolean
  bubbleTailMaskColor?: string
  messageTimestampMs?: number
  telegramShowReadChecks?: boolean
  chatSelfAvatarUrl?: string
  chatOtherAvatarUrl?: string
  chatOtherSenderNickname?: string
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  groupRankShowBesideNickname?: boolean
}

/** 位置分享聊天气泡行 */
export function LocationChatRow({
  id,
  isSelf,
  data,
  bubble,
  showAvatar,
  showAvatarColumn,
  showBubbleTail = false,
  bubbleTailMaskColor = 'var(--wx-chat-room-bg, #EDEDED)',
  messageTimestampMs,
  telegramShowReadChecks = true,
  chatSelfAvatarUrl,
  chatOtherAvatarUrl,
  chatOtherSenderNickname,
  chatOtherAvatarRankBadge = null,
  chatSelfAvatarRankBadge: _chatSelfAvatarRankBadge = null,
  groupRankShowBesideNickname = true,
}: Props) {
  const avatarPx = 40
  const messengerStyle = resolveMessengerBubbleStyle(bubble)
  const talkmakerTimeLabel =
    messengerStyle === 'talkmaker' && typeof messageTimestampMs === 'number'
      ? formatTalkmakerExternalTime(messageTimestampMs)
      : null
  const cardInner =
    messengerStyle === 'imessage' ? (
      <ImessageLocationCard
        data={data}
        isSelf={isSelf}
        showTail={showBubbleTail}
        bubbleTailMaskColor={bubbleTailMaskColor}
        bubble={bubble}
      />
    ) : messengerStyle === 'telegram' ? (
      <TelegramLocationBubble
        data={data}
        isSelf={isSelf}
        bubble={bubble}
        showTail={showBubbleTail}
        timeLabel={
          typeof messageTimestampMs === 'number' ? formatTelegramBubbleTime(messageTimestampMs) : undefined
        }
        showReadChecks={telegramShowReadChecks}
      />
    ) : messengerStyle === 'talkmaker' ? (
      <TalkmakerLocationCard data={data} isSelf={isSelf} showTail={showBubbleTail} />
    ) : (
      <LocationMessageCard data={data} wechatClassic={messengerStyle === 'wechat'} />
    )
  const card =
    talkmakerTimeLabel ? (
      <div className={`flex items-end gap-1 ${isSelf ? 'justify-end' : ''}`}>
        {isSelf ? <TalkmakerExternalTimestamp timeLabel={talkmakerTimeLabel} /> : null}
        {cardInner}
        {!isSelf ? <TalkmakerExternalTimestamp timeLabel={talkmakerTimeLabel} /> : null}
      </div>
    ) : (
      cardInner
    )
  const showAvatarVisual = showAvatar && showAvatarColumn
  const reserveAvatarGutter = showAvatar
  const rankBeside = groupRankShowBesideNickname !== false
  const avatarGutter = <div className="h-10 w-10 shrink-0" aria-hidden />
  const otherAvatarFallback = (
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

  if (isSelf) {
    if (messengerStyle === 'talkmaker') {
      return (
        <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={id}>
          <div className="ml-auto mr-[24px] flex max-w-full flex-row-reverse items-start">{card}</div>
        </div>
      )
    }
    return (
      <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={id}>
        <div className="ml-auto mr-[24px] flex max-w-full flex-row-reverse items-start gap-[12px]">
          {showAvatarVisual ? (
            chatSelfAvatarUrl?.trim() ? (
              <img
                src={chatSelfAvatarUrl.trim()}
                alt=""
                width={avatarPx}
                height={avatarPx}
                className="h-10 w-10 shrink-0 object-cover"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            ) : (
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
          ) : reserveAvatarGutter ? (
            avatarGutter
          ) : null}
          <div className="min-w-0 max-w-[calc(100vw-96px)]">{card}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={id}>
      <div className="ml-[24px] mr-auto flex max-w-full items-start gap-[12px]">
        {showAvatarVisual ? (
          <div className="relative shrink-0">
            {!rankBeside ? (
              <ChatGroupSpeakerRankOnAvatar rankBadge={chatOtherAvatarRankBadge}>
                {chatOtherAvatarUrl?.trim() ? (
                  <img
                    src={chatOtherAvatarUrl.trim()}
                    alt=""
                    width={avatarPx}
                    height={avatarPx}
                    className="h-10 w-10 shrink-0 object-cover"
                    style={{
                      borderRadius: `${bubble.avatarRadiusPx}px`,
                      border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                    }}
                    aria-hidden
                  />
                ) : (
                  otherAvatarFallback
                )}
              </ChatGroupSpeakerRankOnAvatar>
            ) : chatOtherAvatarUrl?.trim() ? (
              <img
                src={chatOtherAvatarUrl.trim()}
                alt=""
                width={avatarPx}
                height={avatarPx}
                className="h-10 w-10 shrink-0 object-cover"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            ) : (
              otherAvatarFallback
            )}
          </div>
        ) : reserveAvatarGutter ? (
          avatarGutter
        ) : null}
        <div className="min-w-0 max-w-[calc(100vw-96px)]">
          {rankBeside && chatOtherSenderNickname ? (
            <ChatGroupSenderNicknameWithRank
              nickname={chatOtherSenderNickname}
              rankBadge={chatOtherAvatarRankBadge}
            />
          ) : chatOtherSenderNickname ? (
            <p className="mb-1 text-[12px] text-[#888888]">{chatOtherSenderNickname}</p>
          ) : null}
          {card}
        </div>
      </div>
    </div>
  )
}
