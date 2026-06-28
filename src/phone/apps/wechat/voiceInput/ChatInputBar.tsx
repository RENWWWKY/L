import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { Keyboard, Mic, Paperclip, Plus, Smile } from 'lucide-react'
import { motion } from 'framer-motion'
import { Pressable } from '../../../components/Pressable'
import { wechatChatComposerFontStyle } from '../WeChatChatMixedText'

const COMPOSER_ROW_CLASS = 'flex min-h-[36px] min-w-0 flex-1 items-center'
const COMPOSER_SIDE_BTN_CLASS = 'flex h-7 w-7 shrink-0 items-center justify-center text-[#8E8E93]'
const COMPOSER_TEXT_CLASS =
  'min-h-[24px] min-w-0 flex-1 resize-none bg-transparent text-[16px] leading-6 outline-none placeholder:text-[#8E8E93]'
const COMPOSER_HOLD_CLASS =
  'select-none flex min-h-[24px] min-w-0 flex-1 items-center justify-start bg-transparent text-[16px] leading-6 text-[#8E8E93]'

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

function resolveSendButtonColor(
  layout: 'wechat' | 'imessage' | 'telegram' | 'talkmaker',
  sendButtonColor?: string,
): string {
  const custom = sendButtonColor?.trim()
  if (custom) return custom
  if (layout === 'imessage') return '#0B93F6'
  if (layout === 'telegram') return '#3390EC'
  if (layout === 'talkmaker') return '#FEE500'
  return '#07C160'
}

function composerTextareaStyle(maxHeight: number): CSSProperties {
  return {
    color: 'var(--wx-text)',
    maxHeight,
    ...wechatChatComposerFontStyle,
  }
}

function ImessageSendIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V5m0 0l-6 6m6-6l6 6"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TelegramSendIcon() {
  return (
    <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

export function ChatInputBar({
  inputMode,
  btnPx,
  btnColor,
  borderRadius,
  borderColor,
  layout = 'lumi',
  sendButtonColor,
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
  layout?: 'lumi' | 'wechat' | 'imessage' | 'telegram' | 'talkmaker'
  sendButtonColor?: string
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
  const hasDraft = draft.trim().length > 0
  const sendBtnColor =
    layout === 'wechat' || layout === 'imessage' || layout === 'telegram' || layout === 'talkmaker'
      ? resolveSendButtonColor(layout, sendButtonColor)
      : undefined

  if (layout === 'talkmaker') {
    return (
      <div className="flex w-full items-center gap-2 px-3 py-2">
          <Pressable
            type="button"
            aria-label={plusMenuOpen ? '收起更多功能' : '更多功能'}
            onClick={onTogglePlus}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-gray-500"
          >
            <Plus size={28} strokeWidth={1.75} className={plusMenuOpen ? 'rotate-45' : ''} aria-hidden />
          </Pressable>
          <Pressable
            type="button"
            aria-label="表情"
            onClick={onToggleEmoji}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-gray-500"
          >
            <Smile size={24} strokeWidth={1.5} aria-hidden />
          </Pressable>
          <div className="flex min-h-[36px] min-w-0 flex-1 items-center rounded-full bg-[#F2F2F2] px-4 py-1.5">
            {inputMode === 'voice' ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onPointerDown={onVoicePointerDown}
                onPointerMove={onVoicePointerMove}
                onPointerUp={onVoicePointerUp}
                onPointerCancel={onVoicePointerUp}
                className={COMPOSER_HOLD_CLASS}
                style={{ touchAction: 'none' }}
              >
                按住说话
              </motion.button>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  className={COMPOSER_TEXT_CLASS}
                  style={composerTextareaStyle(96)}
                  placeholder="发送消息..."
                  aria-label="输入消息"
                  rows={1}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                />
                <Pressable
                  type="button"
                  aria-label="语音输入"
                  onClick={onToggleInputMode}
                  className="ml-2 shrink-0 text-gray-400"
                >
                  <Mic size={20} strokeWidth={1.75} aria-hidden />
                </Pressable>
              </>
            )}
          </div>
          <Pressable
            type="button"
            onClick={onSend}
            disabled={sendBusy || !planeCanAct}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black shadow-sm transition-[transform,opacity] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            style={{ backgroundColor: sendBtnColor }}
            aria-label={hasDraft ? '发送' : '请求 AI 回复'}
          >
          <TelegramSendIcon />
        </Pressable>
      </div>
    )
  }

  if (layout === 'telegram') {
    const telegramActionBtnClass = 'flex h-10 w-10 shrink-0 items-center justify-center'
    const telegramComposerRowClass = 'flex min-h-[40px] min-w-0 flex-1 items-center'

    return (
      <div className="flex w-full max-w-full items-end gap-1.5">
        <Pressable
          type="button"
          aria-label={plusMenuOpen ? '收起更多功能' : '附件'}
          onClick={onTogglePlus}
          className={`${telegramActionBtnClass} text-[#8E8E93]`}
        >
          <Paperclip size={24} strokeWidth={1.75} className="rotate-45" aria-hidden />
        </Pressable>

        {inputMode === 'voice' ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onPointerDown={onVoicePointerDown}
            onPointerMove={onVoicePointerMove}
            onPointerUp={onVoicePointerUp}
            onPointerCancel={onVoicePointerUp}
            className={`${telegramComposerRowClass} select-none justify-start rounded-[8px] bg-transparent text-[16px] leading-6 text-[#8E8E93]`}
            style={{ touchAction: 'none' }}
          >
            按住说话
          </motion.button>
        ) : (
          <div className={telegramComposerRowClass}>
            <textarea
              ref={textareaRef}
              className={COMPOSER_TEXT_CLASS}
              style={composerTextareaStyle(128)}
              placeholder="Message"
              aria-label="输入消息"
              rows={1}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={onComposerKeyDown}
            />
            <Pressable
              type="button"
              aria-label="表情"
              onClick={onToggleEmoji}
              className={`ml-2 ${telegramActionBtnClass} text-[#8E8E93]`}
            >
              <Smile size={24} strokeWidth={1.5} aria-hidden />
            </Pressable>
          </div>
        )}

        <Pressable
          type="button"
          aria-label={inputMode === 'text' ? '切换为语音输入' : '切换为文字输入'}
          onClick={onToggleInputMode}
          className={`${telegramActionBtnClass} text-[#8E8E93]`}
        >
          <Mic size={24} strokeWidth={1.75} aria-hidden />
        </Pressable>

        <Pressable
          type="button"
          onClick={onSend}
          disabled={sendBusy || !planeCanAct}
          className={`${telegramActionBtnClass} rounded-full text-white shadow-md transition-[transform,opacity] active:scale-95 disabled:pointer-events-none disabled:opacity-40`}
          style={{ backgroundColor: sendBtnColor }}
          aria-label={hasDraft ? '发送并请求回复' : '请求 AI 回复'}
        >
          <TelegramSendIcon />
        </Pressable>
      </div>
    )
  }

  if (layout === 'imessage') {
    return (
      <div className="flex w-full max-w-full items-end gap-2">
        <Pressable
          type="button"
          aria-label={plusMenuOpen ? '收起更多功能' : '更多功能'}
          onClick={onTogglePlus}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8E8E93]"
        >
          <Plus size={28} strokeWidth={1.75} className={plusMenuOpen ? 'rotate-45' : ''} aria-hidden />
        </Pressable>

        {inputMode === 'voice' ? (
          <div
            className={`${COMPOSER_ROW_CLASS} rounded-full border bg-white px-3 py-1 shadow-sm`}
            style={{ borderColor }}
          >
            <Pressable
              type="button"
              aria-label="切换为文字输入"
              onClick={onToggleInputMode}
              className={`mr-2 ${COMPOSER_SIDE_BTN_CLASS}`}
            >
              <Keyboard size={22} strokeWidth={1.5} aria-hidden />
            </Pressable>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onPointerDown={onVoicePointerDown}
              onPointerMove={onVoicePointerMove}
              onPointerUp={onVoicePointerUp}
              onPointerCancel={onVoicePointerUp}
              className={COMPOSER_HOLD_CLASS}
              style={{ touchAction: 'none' }}
            >
              按住说话
            </motion.button>
          </div>
        ) : (
          <div
            className={`${COMPOSER_ROW_CLASS} rounded-full border bg-white px-3 py-1 shadow-sm`}
            style={{ borderColor }}
          >
            <Pressable
              type="button"
              aria-label="表情"
              onClick={onToggleEmoji}
              className={`mr-2 ${COMPOSER_SIDE_BTN_CLASS}`}
            >
              <Smile size={24} strokeWidth={1.5} aria-hidden />
            </Pressable>
            <textarea
              ref={textareaRef}
              className={COMPOSER_TEXT_CLASS}
              style={composerTextareaStyle(96)}
              placeholder="iMessage"
              aria-label="输入消息"
              rows={1}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={onComposerKeyDown}
            />
            <Pressable
              type="button"
              aria-label={inputMode === 'text' ? '切换为语音输入' : '切换为文字输入'}
              onClick={onToggleInputMode}
              className={`ml-2 ${COMPOSER_SIDE_BTN_CLASS}`}
            >
              <Mic size={24} strokeWidth={1.5} aria-hidden />
            </Pressable>
          </div>
        )}

        <Pressable
          type="button"
          onClick={onSend}
          disabled={sendBusy || !planeCanAct}
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-[transform,opacity] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          style={{ backgroundColor: sendBtnColor }}
          aria-label={draft.trim() ? '发送并请求回复' : '请求 AI 回复'}
        >
          <ImessageSendIcon />
        </Pressable>
      </div>
    )
  }

  if (layout === 'wechat') {
  const wechatSideBtnClass =
    'flex h-7 w-7 shrink-0 items-center justify-center active:opacity-60'
  const wechatSideBtnStyle: CSSProperties = { color: 'var(--wx-chat-input-btn-color, #191919)' }
  const wechatComposerShellClass =
    'flex min-h-[36px] min-w-0 flex-1 items-center rounded-md border px-3 py-1.5'
  const wechatComposerShellStyle: CSSProperties = {
    backgroundColor: 'var(--wx-chat-input-shell-bg, #ffffff)',
    borderColor: 'var(--wx-chat-input-shell-border, #e5e5e5)',
    borderRadius: 'var(--wx-chat-input-shell-radius, 6px)',
  }

  return (
    <div className="flex w-full max-w-full items-center gap-3">
      <Pressable
        type="button"
        aria-label={inputMode === 'text' ? '切换为语音输入' : '切换为文字输入'}
        onClick={onToggleInputMode}
        className={wechatSideBtnClass}
        style={wechatSideBtnStyle}
      >
        {inputMode === 'voice' ? (
          <Keyboard size={28} strokeWidth={1.8} aria-hidden />
        ) : (
          <Mic size={28} strokeWidth={1.8} aria-hidden />
        )}
      </Pressable>

      {inputMode === 'voice' ? (
        <div data-wx-chat-input-shell className={wechatComposerShellClass} style={wechatComposerShellStyle}>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onPointerDown={onVoicePointerDown}
            onPointerMove={onVoicePointerMove}
            onPointerUp={onVoicePointerUp}
            onPointerCancel={onVoicePointerUp}
            className="select-none flex min-h-[24px] w-full items-center justify-center bg-transparent text-[15px] leading-6 outline-none"
            style={{
              touchAction: 'none',
              color: 'var(--wx-chat-input-text-color, var(--wx-text))',
            }}
          >
            按住 说话
          </motion.button>
        </div>
      ) : (
        <div data-wx-chat-input-shell className={wechatComposerShellClass} style={wechatComposerShellStyle}>
          <textarea
            ref={textareaRef}
            className="min-h-[24px] min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-6 outline-none"
            style={{
              maxHeight: 96,
              color: 'var(--wx-chat-input-text-color, var(--wx-text))',
              ...wechatChatComposerFontStyle,
            }}
            placeholder=""
            aria-label="输入消息"
            rows={1}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onComposerKeyDown}
          />
        </div>
      )}

      <Pressable
        type="button"
        aria-label="表情"
        onClick={onToggleEmoji}
        className={wechatSideBtnClass}
        style={wechatSideBtnStyle}
      >
        <Smile size={28} strokeWidth={1.8} aria-hidden />
      </Pressable>

      <Pressable
        type="button"
        aria-label={plusMenuOpen ? '收起更多功能' : '更多功能'}
        onClick={onTogglePlus}
        className={wechatSideBtnClass}
        style={wechatSideBtnStyle}
      >
        <Plus size={28} strokeWidth={1.8} className={plusMenuOpen ? 'rotate-45' : ''} aria-hidden />
      </Pressable>

      <Pressable
        type="button"
        onClick={onSend}
        disabled={sendBusy || !planeCanAct}
        className="shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold leading-6 text-white transition-[transform,opacity] active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        style={{ backgroundColor: sendBtnColor }}
        aria-label={hasDraft ? '发送' : '请求 AI 回复'}
      >
        发送
      </Pressable>
    </div>
  )
  }

  const lumiShellBg = 'var(--wx-chat-input-shell-bg, #ffffff)'

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
          data-wx-chat-input-shell
          className="select-none flex min-h-[44px] min-w-0 flex-1 items-center justify-center border text-[15px] text-[#4b5563]"
          style={{
            borderRadius,
            borderColor,
            backgroundColor: lumiShellBg,
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
          data-wx-chat-input-shell
          className="min-h-[44px] min-w-0 flex-1 resize-none text-[16px] leading-snug outline-none"
          style={{
            borderRadius,
            border: `1px solid ${borderColor}`,
            padding: '10px 16px',
            backgroundColor: lumiShellBg,
            color: 'var(--wx-chat-input-text-color, var(--wx-text))',
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
        aria-label={hasDraft ? '发送并请求回复' : '请求 AI 回复'}
      >
        <SendPlaneIcon color={!planeCanAct || sendBusy ? '#a3a3a3' : btnColor} />
      </Pressable>
    </div>
  )
}
