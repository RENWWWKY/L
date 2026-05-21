import { ChevronDown } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from 'react'
import { flushSync } from 'react-dom'
import { tryDeleteWholePlaceholderExpressionAtCaret } from '../placeholderExpressionDelete'
import { personaDb } from './idb'
import type { WorldBookUserPlaceholderBinding } from './types'

const WB_SHELL_BORDER = '#e5e5e5'
const WB_SHELL_SUBTEXT = '#666666'

/** 与记忆管理页一致：存库为占位符；失焦时在输入框内展示展开名，聚焦后编辑原文。 */
export function useCharacterFieldPlaceholderPreview(opts: {
  draft: string
  characterId: string | null | undefined
  worldBookUserPlaceholderBindings?: WorldBookUserPlaceholderBinding[] | null
  debounceMs?: number
  enabled?: boolean
}): { expanded: string; loading: boolean } {
  const enabled = opts.enabled !== false
  const [expanded, setExpanded] = useState('')
  const [loading, setLoading] = useState(false)
  const cid = opts.characterId?.trim() ?? ''

  useEffect(() => {
    if (!enabled || !cid) {
      setExpanded('')
      setLoading(false)
      return
    }
    const raw = String(opts.draft ?? '')
    if (!raw.includes('{{')) {
      setExpanded('')
      setLoading(false)
      return
    }
    let cancelled = false
    const ms = opts.debounceMs ?? 320
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const out = await personaDb.expandCharacterFieldPlaceholderPreview(raw, cid, {
            worldBookUserPlaceholderBindings: opts.worldBookUserPlaceholderBindings ?? undefined,
          })
          if (!cancelled) setExpanded(out)
        } catch {
          if (!cancelled) setExpanded('')
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, ms)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [enabled, cid, opts.draft, opts.debounceMs, opts.worldBookUserPlaceholderBindings])

  return { expanded, loading }
}

export type PlaceholderAwareTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> & {
  value: string
  onChange: (next: string) => void
  characterId?: string | null
  /** false：与普通 textarea 一致（如玩家身份世界书） */
  placeholderPreview?: boolean
  /**
   * 预览模式（含 {{ 占位符）下，需双击鼠标或触控双击才进入编辑，避免滚动/误触抢焦点。
   * 默认单次点按即进入编辑（人设其它字段行为保持不变）。
   */
  previewEditRequiresDoubleClick?: boolean
  /**
   * 当前框内文本与存库 `value` 一致（编辑原文、非展开预览）时，光标/选区变化回调。
   * 供外侧「插入占位符」等在失焦后仍能还原插入位置。
   */
  onCaretInRawText?: (start: number, end: number) => void
  /**
   * 世界书条目专用：预览态使用与「占位符说明」一致的虚线卡片 + 可折叠标题 + 散文排版（非 textarea 框体）。
   * 默认折叠正文；展开后双击正文进入编辑。
   */
  previewShellWorldBook?: boolean
  /** 世界书条目：按序展开正文中的 `{{user}}` */
  worldBookUserPlaceholderBindings?: WorldBookUserPlaceholderBinding[] | null
}

/** ref：替代原生 textarea ref；占位符插入等需取 DOM 时用 {@link PlaceholderAwareTextareaHandle.getTextareaElement} */
export type PlaceholderAwareTextareaHandle = {
  /** 切入编辑并聚焦（可走预览→原文）；建议在独立「编辑」按钮 onClick 内调用以便稳定唤起软键盘 */
  focusForEdit: () => void
  getTextareaElement: () => HTMLTextAreaElement | null
}

/**
 * 未聚焦且正文含 `{{` 时：框内只读展示占位符展开结果（预览样式）；聚焦后恢复原文表达式并可编辑。
 */
export const PlaceholderAwareTextarea = forwardRef<PlaceholderAwareTextareaHandle, PlaceholderAwareTextareaProps>(
  function PlaceholderAwareTextarea(
    {
      value,
      onChange,
      characterId,
      placeholderPreview = true,
      previewEditRequiresDoubleClick = false,
      previewShellWorldBook = false,
      worldBookUserPlaceholderBindings,
      onCaretInRawText,
      className,
      maxLength,
      onFocus,
      onBlur,
      disabled,
      readOnly: readOnlyFromParent,
      title,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const [focused, setFocused] = useState(false)
    /** 世界书壳：正文预览默认折叠（与占位符说明交互一致） */
    const [worldBookShellExpanded, setWorldBookShellExpanded] = useState(false)
    const innerRef = useRef<HTMLTextAreaElement | null>(null)
    /** 触控双击进入编辑：记录上一次 tap 时间 */
    const lastPreviewTapEndRef = useRef(0)

    const disabledRef = useRef(disabled)
    disabledRef.current = disabled
    const readOnlyFromParentRef = useRef(readOnlyFromParent)
    readOnlyFromParentRef.current = readOnlyFromParent
    const previewModeRef = useRef(false)

    const mergedRef = useCallback((el: HTMLTextAreaElement | null) => {
      innerRef.current = el
    }, [])

    const raw = String(value ?? '')
    const hasPh = raw.includes('{{')
    const cid = characterId?.trim() ?? ''
    const usePreview = placeholderPreview && !!cid

    const { expanded } = useCharacterFieldPlaceholderPreview({
      draft: raw,
      characterId: cid,
      worldBookUserPlaceholderBindings,
      enabled: usePreview,
    })

    const previewMode = usePreview && !focused && hasPh
    previewModeRef.current = previewMode
    const displayValue = !usePreview || focused || !hasPh ? raw : expanded || raw
    const readOnlyPreview = previewMode
    const effectiveMaxLength =
      maxLength != null && (focused || !hasPh || !usePreview) ? maxLength : undefined

    /**
     * 从预览切入编辑：必须在用户手势（pointer / touch / dblclick）同一次同步调用栈内
     * `flushSync` 提交后再 `focus()`，否则 iOS / 部分 WebView 不会弹出软键盘。
     */
    const enterEditFromPreviewPointer = useCallback(() => {
      if (!previewMode || disabled || readOnlyFromParent) return
      flushSync(() => {
        setFocused(true)
      })
      const el = innerRef.current
      if (!el) return
      el.focus()
      const len = el.value.length
      try {
        el.setSelectionRange(len, len)
      } catch {
        /* 部分 WebView 在未合成帧前调用会失败 */
      }
    }, [previewMode, disabled, readOnlyFromParent])

    useImperativeHandle(
      ref,
      () => ({
        focusForEdit: () => {
          if (disabledRef.current || readOnlyFromParentRef.current) return
          if (previewModeRef.current) {
            enterEditFromPreviewPointer()
            return
          }
          const el = innerRef.current
          if (!el) return
          el.focus()
          const len = el.value.length
          try {
            el.setSelectionRange(len, len)
          } catch {
            /* ignore */
          }
        },
        getTextareaElement: () => innerRef.current,
      }),
      [enterEditFromPreviewPointer],
    )

    const DOUBLE_TAP_MS = 420

    const notifyCaretIfRaw = useCallback(() => {
      if (!onCaretInRawText) return
      const el = innerRef.current
      if (!el || disabled || readOnlyFromParent) return
      if (readOnlyPreview) return
      const rawStr = String(value ?? '')
      if (el.value !== rawStr) return
      const s = el.selectionStart ?? 0
      const e = el.selectionEnd ?? s
      onCaretInRawText(s, e)
    }, [onCaretInRawText, value, disabled, readOnlyFromParent, readOnlyPreview])

    const showWorldBookPreviewShell =
      previewShellWorldBook && readOnlyPreview && previewEditRequiresDoubleClick

    const onWorldBookProseTouchEnd = useCallback(
      (_e: React.TouchEvent) => {
        if (
          !previewEditRequiresDoubleClick ||
          disabled ||
          readOnlyFromParent ||
          !previewMode
        ) {
          return
        }
        const now = Date.now()
        const prev = lastPreviewTapEndRef.current
        const delta = prev > 0 ? now - prev : 0
        if (prev > 0 && delta < DOUBLE_TAP_MS && delta > 35) {
          lastPreviewTapEndRef.current = 0
          enterEditFromPreviewPointer()
        } else {
          lastPreviewTapEndRef.current = now
        }
      },
      [
        DOUBLE_TAP_MS,
        disabled,
        enterEditFromPreviewPointer,
        previewEditRequiresDoubleClick,
        previewMode,
        readOnlyFromParent,
      ],
    )

    if (showWorldBookPreviewShell) {
      return (
        <div
          className="rounded-[10px] border border-dashed px-3 py-2"
          style={{ borderColor: WB_SHELL_BORDER }}
        >
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-lg py-1 text-left transition-colors hover:bg-neutral-50/80"
            aria-expanded={worldBookShellExpanded}
            onClick={() => setWorldBookShellExpanded((v) => !v)}
          >
            <ChevronDown
              className={`mt-0.5 size-4 shrink-0 transition-transform duration-200 ease-out ${
                worldBookShellExpanded ? 'rotate-180' : 'rotate-0'
              }`}
              color="#666666"
              strokeWidth={2}
            />
            <span className="text-[12px] font-medium text-neutral-900">条目正文</span>
          </button>
          {worldBookShellExpanded ? (
            <div
              role="presentation"
              tabIndex={-1}
              className="mt-2 max-h-[min(50vh,320px)] overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{ color: WB_SHELL_SUBTEXT }}
              title="双击进入编辑"
              onDoubleClick={() => {
                if (!disabled && !readOnlyFromParent) enterEditFromPreviewPointer()
              }}
              onTouchEnd={onWorldBookProseTouchEnd}
            >
              {displayValue}
            </div>
          ) : null}
        </div>
      )
    }

    return (
      <textarea
        ref={mergedRef}
        {...rest}
        title={
          previewEditRequiresDoubleClick && readOnlyPreview ? '双击进入编辑，或点上方「编辑原文」' : title
        }
        disabled={disabled}
        inputMode="text"
        enterKeyHint="enter"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
        value={displayValue}
        readOnly={readOnlyPreview || !!readOnlyFromParent || !!disabled}
        maxLength={effectiveMaxLength}
        className={`${className ?? ''} ${
          readOnlyPreview
            ? 'cursor-pointer border-dashed bg-white text-neutral-800'
            : ''
        }`.trim()}
        onPointerDown={(e) => {
          rest.onPointerDown?.(e as React.PointerEvent<HTMLTextAreaElement>)
          if (!previewEditRequiresDoubleClick) enterEditFromPreviewPointer()
        }}
        onTouchStart={(e) => {
          rest.onTouchStart?.(e)
          if (!previewEditRequiresDoubleClick) enterEditFromPreviewPointer()
        }}
        onTouchEnd={(e) => {
          rest.onTouchEnd?.(e)
          if (
            !previewEditRequiresDoubleClick ||
            disabled ||
            readOnlyFromParent ||
            !previewMode
          ) {
            return
          }
          const now = Date.now()
          const prev = lastPreviewTapEndRef.current
          const delta = prev > 0 ? now - prev : 0
          if (prev > 0 && delta < DOUBLE_TAP_MS && delta > 35) {
            lastPreviewTapEndRef.current = 0
            enterEditFromPreviewPointer()
          } else {
            lastPreviewTapEndRef.current = now
          }
        }}
        onDoubleClick={(e) => {
          rest.onDoubleClick?.(e)
          if (
            previewEditRequiresDoubleClick &&
            previewMode &&
            !disabled &&
            !readOnlyFromParent
          ) {
            enterEditFromPreviewPointer()
          }
        }}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
          queueMicrotask(() => notifyCaretIfRaw())
        }}
        onBlur={(e) => {
          if (onCaretInRawText && innerRef.current) {
            const el = innerRef.current
            const rawStr = String(value ?? '')
            if (el.value === rawStr) {
              const s = el.selectionStart ?? 0
              const ed = el.selectionEnd ?? s
              onCaretInRawText(s, ed)
            }
          }
          setFocused(false)
          lastPreviewTapEndRef.current = 0
          onBlur?.(e)
        }}
        onSelect={(e) => {
          rest.onSelect?.(e)
          notifyCaretIfRaw()
        }}
        onClick={(e) => {
          rest.onClick?.(e)
          notifyCaretIfRaw()
        }}
        onKeyDown={(e) => {
          if (
            !readOnlyPreview &&
            !disabled &&
            !readOnlyFromParent &&
            (e.key === 'Backspace' || e.key === 'Delete')
          ) {
            const el = innerRef.current
            const rawStr = String(value ?? '')
            if (el && el.value === rawStr) {
              const start = el.selectionStart ?? 0
              const end = el.selectionEnd ?? start
              const chunk = tryDeleteWholePlaceholderExpressionAtCaret(
                rawStr,
                start,
                end,
                e.key === 'Backspace' ? 'Backspace' : 'Delete',
              )
              if (chunk) {
                e.preventDefault()
                onChange(chunk.next)
                queueMicrotask(() => {
                  const t = innerRef.current
                  if (!t) return
                  try {
                    t.setSelectionRange(chunk.caret, chunk.caret)
                  } catch {
                    /* ignore */
                  }
                  notifyCaretIfRaw()
                })
                return
              }
            }
          }
          onKeyDown?.(e)
        }}
        onKeyUp={(e) => {
          rest.onKeyUp?.(e)
          notifyCaretIfRaw()
        }}
        onChange={(e) => {
          if (readOnlyPreview || disabled || readOnlyFromParent) return
          onChange(e.target.value)
          queueMicrotask(() => notifyCaretIfRaw())
        }}
      />
    )
  },
)
