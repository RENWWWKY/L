import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'

import { isIOSWebKit } from '../../../../utils/platform'
import { parsePublishSyntax, PUBLISH_SYNTAX_COLORS } from '../../pulsePublishSyntax'

/** 两层必须像素级一致，否则光标会「吃进」字符里 */
const EDITOR_STYLE: CSSProperties = {
  fontFamily: 'var(--phone-font, "Noto Serif SC", Georgia, serif)',
  fontSize: 18,
  lineHeight: 1.625,
  fontWeight: 400,
  fontStyle: 'normal',
  letterSpacing: 'normal',
  wordSpacing: 'normal',
  padding: 24,
  margin: 0,
  border: 0,
  boxSizing: 'border-box',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  tabSize: 4,
  WebkitFontSmoothing: 'antialiased',
}

type PublishRichEditorProps = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  autoFocus?: boolean
}

function renderHighlighted(value: string, placeholder: string): ReactNode {
  if (!value) {
    return <span style={{ color: '#D4D4D4' }}>{placeholder}</span>
  }

  const parts = parsePublishSyntax(value)
  if (parts.length === 1 && parts[0]?.type === 'text') {
    return <span style={{ color: PUBLISH_SYNTAX_COLORS.ink }}>{parts[0].value}</span>
  }

  return parts.map((part, i) => {
    if (part.type === 'text') {
      return (
        <span key={`t-${i}`} style={{ color: PUBLISH_SYNTAX_COLORS.ink }}>
          {part.value}
        </span>
      )
    }
    if (part.type === 'hashtag') {
      return (
        <span key={`h-${i}`} style={{ color: PUBLISH_SYNTAX_COLORS.hashtag }}>
          {part.raw}
        </span>
      )
    }
    if (part.type === 'mention') {
      return (
        <span key={`m-${i}`} style={{ color: PUBLISH_SYNTAX_COLORS.mention }}>
          {part.raw}
        </span>
      )
    }
    if (part.type === 'supertopic') {
      return (
        <span
          key={`s-${i}`}
          style={{
            color: '#3A3A3C',
            backgroundColor: PUBLISH_SYNTAX_COLORS.supertopicBg,
            borderRadius: 4,
          }}
        >
          {part.raw}
        </span>
      )
    }
    return (
      <span key={`f-${i}`} style={{ color: PUBLISH_SYNTAX_COLORS.face }}>
        {part.raw}
      </span>
    )
  })
}

/**
 * pre 定高 + textarea 绝对铺满（react-simple-code-editor 同款）
 * 高亮层禁止改 font-weight，避免与 textarea 字宽不一致
 */
export function PublishRichEditor({
  value,
  onChange,
  placeholder = '此刻想说…',
  textareaRef: externalRef,
  autoFocus,
}: PublishRichEditorProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const textareaRef = externalRef ?? innerRef

  const highlighted = useMemo(() => renderHighlighted(value, placeholder), [value, placeholder])

  const syncScroll = () => {
    const ta = textareaRef.current
    const pre = preRef.current
    if (!ta || !pre) return
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }

  useLayoutEffect(() => {
    syncScroll()
  }, [value])

  const textareaColorStyle: CSSProperties = isIOSWebKit()
    ? { color: 'rgba(0,0,0,0)', WebkitTextFillColor: 'rgba(0,0,0,0)' }
    : { color: 'transparent', WebkitTextFillColor: 'transparent' }

  return (
    <div className="relative w-full" style={{ minHeight: 200 }}>
      <pre
        ref={preRef}
        aria-hidden
        className="pointer-events-none m-0 w-full overflow-hidden"
        style={EDITOR_STYLE}
      >
        {highlighted}
        {value.endsWith('\n') ? ' ' : ''}
        {'\n'}
      </pre>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        autoFocus={autoFocus}
        rows={1}
        className="absolute inset-0 m-0 h-full w-full resize-none overflow-auto bg-transparent outline-none"
        style={{
          ...EDITOR_STYLE,
          ...textareaColorStyle,
          caretColor: PUBLISH_SYNTAX_COLORS.ink,
          minHeight: 200,
        }}
      />
    </div>
  )
}
