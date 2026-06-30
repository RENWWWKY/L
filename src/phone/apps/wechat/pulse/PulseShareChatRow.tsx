import type { WeChatBubbleTheme } from '../../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from '../group/ChatGroupSpeakerAvatarWrap'
import type { WeChatPulseSharePayload } from '../newFriendsPersona/types'
import { PulseShareMessageCard } from './PulseShareMessageCard'

type Props = {
  id: string
  isSelf: boolean
  data: WeChatPulseSharePayload
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showAvatarColumn: boolean
  chatSelfAvatarUrl?: string
  chatOtherAvatarUrl?: string
  chatOtherSenderNickname?: string
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  groupRankShowBesideNickname?: boolean
}

export function PulseShareChatRow({
  id,
  isSelf,
  data,
  bubble,
  showAvatar,
  showAvatarColumn,
  chatSelfAvatarUrl,
  chatOtherAvatarUrl,
  chatOtherSenderNickname,
  chatOtherAvatarRankBadge = null,
  chatSelfAvatarRankBadge: _chatSelfAvatarRankBadge = null,
  groupRankShowBesideNickname = true,
}: Props) {
  const avatarPx = 40
  const card = <PulseShareMessageCard data={data} />
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
