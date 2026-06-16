import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { Mic, Plus, Smile } from 'lucide-react'
import { motion } from 'framer-motion'
import { Pressable } from '../../../components/Pressable'
import { wechatChatComposerFontStyle } from '../WeChatChatMixedText'

function SendPlaneIcon({ color }: { color: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

export function ChatInputBar({
  inputMode,
  btnPx,
  btnColor,
  borderRadius,
  borderColor,
  draft,
  sendBusy,
  planeCanAct,
  plusMenuOpen,
  onToggleInputMode,
  textareaRef,
  onVoicePointerDown,
  onVoicePointerMove,
  onVoicePointerUp,
  onDraftChange,
  onComposerKeyDown,
  onToggleEmoji,
  onTogglePlus,
  onSend,
}: {
  inputMode: 'text' | 'voice'
  btnPx: number
  btnColor: string
  borderRadius: number
  borderColor: string
  draft: string
  sendBusy: boolean
  planeCanAct: boolean
  plusMenuOpen: boolean
  onToggleInputMode: () => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onVoicePointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onVoicePointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onVoicePointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onDraftChange: (v: string) => void
  onComposerKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void
  onToggleEmoji: () => void
  onTogglePlus: () => void
  onSend: () => void
}) {
  return (
    <div className="flex w-full max-w-full items-end gap-2">
      <Pressable
        type="button"
        aria-label={inputMode === 'text' ? '切换为语音输入' : '切换为文字输入'}
        onClick={onToggleInputMode}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ color: btnColor }}
      >
        <Mic size={btnPx} strokeWidth={2} aria-hidden />
      </Pressable>

      {inputMode === 'voice' ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onPointerDown={onVoicePointerDown}
          onPointerMove={onVoicePointerMove}
          onPointerUp={onVoicePointerUp}
          onPointerCancel={onVoicePointerUp}
          className="select-none flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-[16px] border bg-white text-[15px] text-[#4b5563]"
          style={{
            borderRadius,
            borderColor,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        >
          按住说话
        </motion.button>
      ) : (
        <textarea
          ref={textareaRef}
          className="min-h-[44px] min-w-0 flex-1 resize-none bg-white text-[16px] leading-snug outline-none"
          style={{
            borderRadius,
            border: `1px solid ${borderColor}`,
            padding: '10px 16px',
            color: 'var(--wx-text)',
            maxHeight: 120,
            ...wechatChatComposerFontStyle,
          }}
          placeholder="输入消息..."
          aria-label="输入消息"
          rows={1}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onComposerKeyDown}
        />
      )}

      <Pressable
        type="button"
        aria-label="表情"
        onClick={onToggleEmoji}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ color: btnColor }}
      >
        <Smile size={btnPx} strokeWidth={2} aria-hidden />
      </Pressable>
      <Pressable
        type="button"
        aria-label={plusMenuOpen ? '收起更多功能' : '更多功能'}
        onClick={onTogglePlus}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      >
        <Plus
          size={20}
          strokeWidth={2}
          className={`text-black transition-transform duration-200 ease-out ${plusMenuOpen ? 'rotate-45' : ''}`}
          aria-hidden
        />
      </Pressable>
      <Pressable
        type="button"
        onClick={onSend}
        disabled={sendBusy || !planeCanAct}
        className="mb-[2px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
        aria-label={draft.trim() ? '发送并请求回复' : '请求 AI 回复'}
      >
        <SendPlaneIcon color={!planeCanAct || sendBusy ? '#a3a3a3' : btnColor} />
      </Pressable>
    </div>
  )
}
