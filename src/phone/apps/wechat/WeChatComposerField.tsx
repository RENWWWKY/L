import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'

import {
  applyWeChatComposerText,
  serializeWeChatComposerEl,
} from './stickers/wechatClassicEmojiComposer'

/** 与 Tailwind `leading-6` 一致：单行 24px */
export const WECHAT_COMPOSER_LINE_HEIGHT_PX = 24
export const WECHAT_COMPOSER_MAX_VISIBLE_LINES = 5
export const WECHAT_COMPOSER_MAX_HEIGHT_PX =
  WECHAT_COMPOSER_LINE_HEIGHT_PX * WECHAT_COMPOSER_MAX_VISIBLE_LINES
export const WECHAT_COMPOSER_MIN_HEIGHT_PX = WECHAT_COMPOSER_LINE_HEIGHT_PX

export const weChatComposerScrollStyle: CSSProperties = {
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  WebkitOverflowScrolling: 'touch',
}

function syncComposerCaretScroll(el: HTMLElement) {
  if (el.scrollHeight <= el.clientHeight + 1) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
  const range = sel.getRangeAt(0)
  const caret = range.getBoundingClientRect()
  const box = el.getBoundingClientRect()
  if (caret.bottom > box.bottom - 2) {
    el.scrollTop += caret.bottom - box.bottom + 4
  } else if (caret.top < box.top + 2) {
    el.scrollTop -= box.top + 2 - caret.top
  }
}

function syncComposerSize(el: HTMLElement) {
  el.style.maxHeight = `${WECHAT_COMPOSER_MAX_HEIGHT_PX}px`
  el.style.height = '0px'
  const next = Math.min(
    WECHAT_COMPOSER_MAX_HEIGHT_PX,
    Math.max(WECHAT_COMPOSER_MIN_HEIGHT_PX, el.scrollHeight),
  )
  el.style.height = `${next}px`
  syncComposerCaretScroll(el)
}

type Props = {
  value: string
  onChange: (next: string) => void
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void
  className?: string
  style?: CSSProperties
  placeholder?: string
  'aria-label'?: string
} & Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onKeyDown' | 'children' | 'dangerouslySetInnerHTML'>

export function WeChatComposerField({
  value,
  onChange,
  onKeyDown,
  className,
  style,
  placeholder,
  'aria-label': ariaLabel,
  ref,
  ...rest
}: Props & { ref?: RefObject<HTMLDivElement | null> }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastEmittedRef = useRef(value)
  const composingRef = useRef(false)

  useEffect(() => {
    if (ref) ref.current = rootRef.current
  }, [ref])

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const current = serializeWeChatComposerEl(el)
    if (current !== value) {
      applyWeChatComposerText(el, value)
    }
    lastEmittedRef.current = value
    syncComposerSize(el)
  }, [value])

  const emitFromDom = () => {
    const el = rootRef.current
    if (!el) return
    const next = serializeWeChatComposerEl(el)
    lastEmittedRef.current = next
    syncComposerSize(el)
    onChange(next)
  }

  return (
    <div
      ref={rootRef}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || undefined}
      className={`${className ?? ''} whitespace-pre-wrap break-words outline-none empty:before:pointer-events-none empty:before:text-[#8E8E93] empty:before:content-[attr(data-placeholder)]`}
      style={{ ...weChatComposerScrollStyle, ...style }}
      {...rest}
      onInput={() => {
        if (composingRef.current) return
        emitFromDom()
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
        emitFromDom()
      }}
      onKeyDown={onKeyDown}
      onPaste={(e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        if (!text) return
        document.execCommand('insertText', false, text)
        emitFromDom()
      }}
    />
  )
}
