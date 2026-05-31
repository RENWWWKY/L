import type { WeChatBubbleTheme } from '../../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from '../group/ChatGroupSpeakerAvatarWrap'
import type { WeChatMusicSyncPayload } from '../newFriendsPersona/types'
import { AcceptResponseCard } from './AcceptResponseCard'
import { DeclineResponseCard } from './DeclineResponseCard'
import { InviteSentCard } from './InviteSentCard'

type Props = {
  id: string
  isSelf: boolean
  data: WeChatMusicSyncPayload
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showAvatarColumn: boolean
  chatSelfAvatarUrl?: string
  chatOtherAvatarUrl?: string
  chatOtherSenderNickname?: string
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  groupRankShowBesideNickname?: boolean
  animated?: boolean
  /** music_accept：邀约曲目封面（可来自 data 或会话内邀约卡） */
  inviteCoverUrl?: string
}

function MusicSyncCardBody({
  data,
  inviteCoverUrl,
}: {
  data: WeChatMusicSyncPayload
  inviteCoverUrl?: string
}) {
  if (data.kind === 'music_invite') return <InviteSentCard data={data} />
  if (data.kind === 'music_accept') {
    return <AcceptResponseCard data={data} coverUrl={inviteCoverUrl} />
  }
  return <DeclineResponseCard data={data} />
}

/** 同频共听邀约 / 回应聊天气泡行 */
export function MusicInviteChatRow({
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
  inviteCoverUrl,
}: Props) {
  const avatarPx = 40
  const card = <MusicSyncCardBody data={data} inviteCoverUrl={inviteCoverUrl} />
  const showAvatarVisual = showAvatar && showAvatarColumn
  const reserveAvatarGutter = showAvatar
  const rankBeside = groupRankShowBesideNickname !== false
  /** 与同一人连续气泡对齐：仅占位，不渲染可见灰块 */
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
          <div className="flex min-w-0 flex-col items-end">{card}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={id}>
      {!showAvatar ? (
        <div className="ml-[24px] mr-auto min-w-0">{card}</div>
      ) : showAvatarVisual ? (
        <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
          {rankBeside || !chatOtherAvatarRankBadge ? (
            chatOtherAvatarUrl?.trim() ? (
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
            )
          ) : (
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
          )}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
            {rankBeside ? (
              <ChatGroupSenderNicknameWithRank
                nickname={chatOtherSenderNickname}
                rankBadge={chatOtherAvatarRankBadge ?? null}
              />
            ) : null}
            {card}
          </div>
        </div>
      ) : reserveAvatarGutter ? (
        <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
          {avatarGutter}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">{card}</div>
        </div>
      ) : (
        <div className="ml-[24px] mr-auto min-w-0">{card}</div>
      )}
    </div>
  )
}
