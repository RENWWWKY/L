import { useMemo } from 'react'
import type { WeChatChatMessage } from '../newFriendsPersona/types'
import { WeChatChatMixedText } from '../WeChatChatMixedText'
import { formatWeChatMessagesTabPreviewFromStoredMessage, isWeChatStickerPreviewContent } from '../wechatThreadPreviewText'
import { RedPacketBubble } from '../redPacket/RedPacketBubble'
import { TransferBubble } from '../transfer/TransferBubble'
import { parseCharacterStickerLine } from '../stickers/stickerStore'

type Props = {
  message: WeChatChatMessage
  isSelf: boolean
}

function QuickReplyVoiceBubble({
  isSelf,
  durationSec,
  transcriptText,
}: {
  isSelf: boolean
  durationSec: number
  transcriptText: string
}) {
  const sec = Math.max(1, Math.round(durationSec || 1))
  const transcript = transcriptText.trim()
  const bars = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const n = Math.sin((i + 1) * 0.85) * 0.5 + 0.5
        return 4 + Math.round(n * 10)
      }),
    [],
  )
  return (
    <div className="max-w-[88%]">
      <div
        className={`inline-flex min-w-[88px] items-center gap-2 rounded-2xl px-3 py-2 ${
          isSelf ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'
        }`}
      >
        <span className="flex items-end gap-[2px]" aria-hidden>
          {bars.map((h, i) => (
            <span
              key={i}
              className={`w-[2px] rounded-full ${isSelf ? 'bg-white/70' : 'bg-neutral-400'}`}
              style={{ height: h }}
            />
          ))}
        </span>
        <span className="text-[12px] tabular-nums">{sec}"</span>
      </div>
      {transcript && transcript !== '[语音]' && transcript !== '（语音）' ? (
        <div
          className={`mt-1.5 rounded-xl border px-2.5 py-2 text-[12px] leading-snug ${
            isSelf
              ? 'border-neutral-800/30 bg-neutral-900/90 text-white/90'
              : 'border-neutral-200 bg-neutral-50 text-neutral-800'
          }`}
        >
          {transcript}
        </div>
      ) : null}
    </div>
  )
}

function QuickReplyStickerImage({ src, isSelf }: { src: string; isSelf: boolean }) {
  return (
    <div
      className={`inline-block overflow-hidden rounded-2xl border ${
        isSelf ? 'border-neutral-900' : 'border-neutral-200'
      } bg-white`}
    >
      <img
        src={src}
        alt=""
        className="block h-auto max-h-[120px] w-[96px] object-cover"
        draggable={false}
      />
    </div>
  )
}

function QuickReplyTextBubble({ isSelf, text }: { isSelf: boolean; text: string }) {
  return (
    <div
      className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
        isSelf ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'
      }`}
    >
      <WeChatChatMixedText text={text} />
    </div>
  )
}

export function QuickReplyMessageBubble({ message, isSelf }: Props) {
  if (message.redPacket) {
    const rp = message.redPacket
    return (
      <div className="max-w-[min(220px,82%)] origin-bottom scale-[0.92]">
        <RedPacketBubble
          isSelf={isSelf}
          data={{
            remark: rp.remark,
            opened: rp.opened,
            amountYuan: rp.amountYuan,
            expired: rp.expired === true,
          }}
        />
      </div>
    )
  }

  if (message.transfer?.transferId) {
    return (
      <div
        className="max-w-[min(240px,82%)] origin-bottom scale-[0.92]"
        style={{ transformOrigin: isSelf ? 'right bottom' : 'left bottom' }}
      >
        <TransferBubble
          transferId={message.transfer.transferId}
          getCurrentTime={() => Date.now()}
          perspective={isSelf ? 'outgoing' : 'incoming'}
        />
      </div>
    )
  }

  if (message.voice) {
    const transcript =
      message.voice.transcriptText?.trim() ||
      message.content?.trim().replace(/^\[语音\]\s*/i, '').trim() ||
      ''
    return (
      <QuickReplyVoiceBubble
        isSelf={isSelf}
        durationSec={message.voice.durationSec}
        transcriptText={transcript}
      />
    )
  }

  const img = message.images?.[0]
  if (img?.base64) {
    const mime = img.type ?? 'image/jpeg'
    const src = img.base64.startsWith('data:') ? img.base64 : `data:${mime};base64,${img.base64}`
    return <QuickReplyStickerImage src={src} isSelf={isSelf} />
  }

  const stickerFromLine = parseCharacterStickerLine(message.content)
  if (stickerFromLine?.url) {
    return <QuickReplyStickerImage src={stickerFromLine.url} isSelf={isSelf} />
  }

  if (isWeChatStickerPreviewContent(message.content)) {
    return (
      <QuickReplyTextBubble isSelf={isSelf} text={formatWeChatMessagesTabPreviewFromStoredMessage(message)} />
    )
  }

  const text = formatWeChatMessagesTabPreviewFromStoredMessage(message).trim()
  if (!text) return null
  return <QuickReplyTextBubble isSelf={isSelf} text={text} />
}

export function isQuickReplyDisplayableMessage(message: WeChatChatMessage): boolean {
  if (message.isRecalled) return false
  if (message.type !== 'player' && message.type !== 'character') return false
  if (message.redPacket || message.transfer || message.voice) return true
  if (message.images?.length) return true
  if (parseCharacterStickerLine(message.content)) return true
  if (isWeChatStickerPreviewContent(message.content)) return true
  return formatWeChatMessagesTabPreviewFromStoredMessage(message).trim().length > 0
}
