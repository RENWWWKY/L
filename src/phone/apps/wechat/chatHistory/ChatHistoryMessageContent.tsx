import { useEffect, useState, type ReactNode } from 'react'

import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'
import { ChatImageLightbox } from '../ChatImageLightbox'
import { RedPacketBubble } from '../redPacket/RedPacketBubble'
import { parseCharacterStickerLine } from '../stickers/stickerStore'
import { TransferBubbleFace } from '../transfer/TransferBubble'
import { getLumiTransferFresh } from '../transfer/lumiTransferStorage'
import { VoiceMessageBubble } from '../VoiceMessageBubble'

type Props = {
  message: WeChatForwardedMessageItem
  /** 是否为玩家本人发送 */
  isSelf?: boolean
}

function imageDataUrl(image: { base64: string; type: string }): string {
  const raw = image.base64.trim()
  if (raw.startsWith('data:')) return raw
  return `data:${image.type || 'image/jpeg'};base64,${raw}`
}

function HistoryTransferPreview({
  transferId,
  isSelf,
}: {
  transferId: string
  isSelf?: boolean
}) {
  const [face, setFace] = useState(() => {
    const rec = getLumiTransferFresh(transferId, () => Date.now())
    if (!rec) return { status: 'pending' as const, amountYuan: null, remark: undefined }
    if (rec.status === 'pending') return { status: 'pending' as const, amountYuan: rec.amount, remark: rec.remark }
    if (rec.status === 'accepted') return { status: 'accepted' as const, amountYuan: rec.amount, remark: rec.remark }
    return { status: 'returned' as const, amountYuan: rec.amount, remark: rec.remark }
  })

  useEffect(() => {
    const sync = () => {
      const rec = getLumiTransferFresh(transferId, () => Date.now())
      if (!rec) {
        setFace({ status: 'pending', amountYuan: null, remark: undefined })
        return
      }
      if (rec.status === 'pending') setFace({ status: 'pending', amountYuan: rec.amount, remark: rec.remark })
      else if (rec.status === 'accepted') setFace({ status: 'accepted', amountYuan: rec.amount, remark: rec.remark })
      else setFace({ status: 'returned', amountYuan: rec.amount, remark: rec.remark })
    }
    sync()
    window.addEventListener('lumi-transfer-changed', sync)
    return () => window.removeEventListener('lumi-transfer-changed', sync)
  }, [transferId])

  return (
    <TransferBubbleFace
      {...face}
      perspective={isSelf ? 'outgoing' : 'incoming'}
    />
  )
}

function HistoryImagePreview({
  src,
  isSticker,
}: {
  src: string
  isSticker?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="cursor-zoom-in border-0 bg-transparent p-0"
        onClick={() => setOpen(true)}
        aria-label="查看大图"
      >
        <img
          src={src}
          alt=""
          className={
            isSticker
              ? 'max-h-[120px] max-w-[120px] object-contain'
              : 'max-h-[200px] max-w-[min(240px,70vw)] rounded-lg border border-gray-100 object-cover'
          }
          draggable={false}
        />
      </button>
      <ChatImageLightbox open={open} src={src} onClose={() => setOpen(false)} />
    </>
  )
}

function LegacyPlaceholder({
  label,
  detail,
}: {
  label: string
  detail?: string
}) {
  return (
    <div className="inline-flex max-w-full flex-col rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-[11px] font-medium tracking-wide text-gray-400">{label}</span>
      {detail?.trim() ? (
        <span className="mt-0.5 text-[13px] leading-relaxed text-gray-600">{detail.trim()}</span>
      ) : null}
    </div>
  )
}

function resolveLegacyContent(message: WeChatForwardedMessageItem): ReactNode | null {
  const content = message.content.trim()
  if (!content || content === '...') return null

  if (content.startsWith('[表情包]')) {
    const sticker = parseCharacterStickerLine(content)
    if (sticker?.url) return <HistoryImagePreview src={sticker.url} isSticker />
    const ref = content.replace(/^\[表情包\]\s*/, '').trim()
    return <LegacyPlaceholder label="表情包" detail={ref || undefined} />
  }

  if (content === '[图片]' || content.startsWith('[图片]')) {
    return <LegacyPlaceholder label="图片" detail={content === '[图片]' ? undefined : content.replace(/^\[图片\]\s*/, '')} />
  }

  if (content.startsWith('[语音]')) {
    const transcript = content.replace(/^\[语音\]\s*/, '').trim()
    return (
      <LegacyPlaceholder label="语音消息" detail={transcript || '（无转写）'} />
    )
  }

  if (content.startsWith('[红包]')) {
    const remark = content.replace(/^\[红包\]\s*/, '').trim() || '红包'
    return (
      <RedPacketBubble
        data={{ remark, opened: false, amountYuan: 0 }}
        isSelf={false}
      />
    )
  }

  if (content === '[转账]' || content.startsWith('[转账]')) {
    return <LegacyPlaceholder label="转账" detail={content === '[转账]' ? undefined : content.replace(/^\[转账\]\s*/, '')} />
  }

  if (content.startsWith('[收藏]')) {
    return <LegacyPlaceholder label="收藏" detail={content.replace(/^\[收藏\]\s*/, '')} />
  }

  if (content.startsWith('[聊天记录]')) {
    return <LegacyPlaceholder label="聊天记录" detail={content.replace(/^\[聊天记录\]\s*/, '')} />
  }

  if (content === '[通话]' || content.startsWith('[通话]')) {
    return <LegacyPlaceholder label="通话" />
  }

  return null
}

/** 全屏聊天记录 · 单条消息正文（支持富媒体） */
export function ChatHistoryMessageContent({ message, isSelf = false }: Props) {
  if (message.isRecalled) {
    return <p className="text-[13px] italic text-gray-400">该消息已撤回</p>
  }

  if (message.redPacket) {
    return (
      <RedPacketBubble
        data={{
          remark: message.redPacket.remark,
          opened: message.redPacket.opened,
          amountYuan: message.redPacket.amountYuan,
          expired: message.redPacket.expired,
        }}
        isSelf={isSelf}
      />
    )
  }

  if (message.transfer?.transferId) {
    return <HistoryTransferPreview transferId={message.transfer.transferId} isSelf={isSelf} />
  }

  if (message.voice) {
    const duration = Math.max(1, Math.round(message.voice.durationSec || 1))
    return (
      <VoiceMessageBubble
        isUser={isSelf}
        duration={duration}
        audioUrl={message.voice.audioUrl || ''}
        transcriptText={message.voice.transcriptText || message.content.replace(/^\[语音\]\s*/, '').trim() || '（暂未生成转写文本）'}
      />
    )
  }

  const image = message.images?.[0]
  if (image?.base64?.trim()) {
    return (
      <HistoryImagePreview
        src={imageDataUrl(image)}
        isSticker={message.isSticker}
      />
    )
  }

  const legacy = resolveLegacyContent(message)
  if (legacy) return legacy

  const text = message.content.trim()
  if (!text || text === '...') {
    return <p className="text-[14px] leading-relaxed text-gray-400">...</p>
  }

  return <p className="text-[14px] leading-relaxed text-gray-700">{text}</p>
}
