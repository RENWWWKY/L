import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CompositionEvent,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react'

type Options = {
  value: string
  onChange: (next: string) => void
  normalize: (raw: string) => string
  maxLen: number
  /** 为 true 时在 keydown 拦截非 pattern 字符（用于仅字母数字字段） */
  blockInvalidKeys?: boolean
  keyPattern?: RegExp
  /**
   * 首触 readOnly 防浏览器抢填（微信号等）。
   * 密码框请关闭：readOnly 会导致部分 WebView 首点不弹键盘。
   */
  useAutofillGuard?: boolean
}

export type WechatAsciiFieldInputHandlers = {
  inputRef: RefObject<HTMLInputElement | null>
  autofillGuard: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onCompositionStart: () => void
  onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => void
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onPointerDown: (e: PointerEvent<HTMLInputElement>) => void
  onFocus: (e: FocusEvent<HTMLInputElement>) => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
}

/** 受控 ASCII 字段：支持 IME 合成、逐字输入、粘贴与光标复位（微信号/密码等） */
export function useWechatAsciiFieldInput({
  value,
  onChange,
  normalize,
  maxLen,
  blockInvalidKeys = false,
  keyPattern = /[a-zA-Z0-9]/,
  useAutofillGuard = true,
}: Options): WechatAsciiFieldInputHandlers {
  const inputRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const [autofillGuard, setAutofillGuard] = useState(useAutofillGuard)

  const releaseAutofillGuard = useCallback((el: HTMLInputElement) => {
    if (!useAutofillGuard) return
    el.readOnly = false
    setAutofillGuard(false)
  }, [useAutofillGuard])

  const commitValue = useCallback(
    (raw: string, cursor?: number | null) => {
      const next = normalize(raw)
      onChange(next)
      const el = inputRef.current
      if (!el || cursor == null) return
      const pos = Math.min(cursor, next.length)
      requestAnimationFrame(() => {
        if (document.activeElement !== el) return
        const start = el.selectionStart ?? 0
        const end = el.selectionEnd ?? 0
        if (start === pos && end === pos) return
        try {
          el.setSelectionRange(pos, pos)
        } catch {
          // iOS 在合成输入或类型切换瞬间可能拒绝设光标
        }
      })
    },
    [normalize, onChange],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) {
        onChange(e.target.value.slice(0, maxLen))
        return
      }
      const el = e.target
      commitValue(el.value, el.selectionStart)
    },
    [commitValue, maxLen, onChange],
  )

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false
      const el = e.currentTarget
      commitValue(el.value, el.selectionStart)
    },
    [commitValue],
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault()
      const paste = e.clipboardData.getData('text/plain')
      const el = e.currentTarget
      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? value.length
      const merged = value.slice(0, start) + paste + value.slice(end)
      const next = normalize(merged)
      onChange(next)
      const pos = Math.min(start + normalize(paste).length, next.length)
      requestAnimationFrame(() => {
        if (document.activeElement !== el) return
        try {
          el.setSelectionRange(pos, pos)
        } catch {
          // ignore
        }
      })
    },
    [normalize, onChange, value],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!blockInvalidKeys) return
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return
      if (keyPattern.test(e.key)) return
      e.preventDefault()
    },
    [blockInvalidKeys, keyPattern],
  )

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLInputElement>) => {
      releaseAutofillGuard(e.currentTarget)
    },
    [releaseAutofillGuard],
  )

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      releaseAutofillGuard(e.currentTarget)
      const el = e.currentTarget
      if (useAutofillGuard && el.value && el.value !== value) {
        onChange('')
      }
    },
    [onChange, releaseAutofillGuard, useAutofillGuard, value],
  )

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      commitValue(e.currentTarget.value, e.currentTarget.value.length)
    },
    [commitValue],
  )

  return {
    inputRef,
    autofillGuard: useAutofillGuard && autofillGuard,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
    onPaste: handlePaste,
    onKeyDown: handleKeyDown,
    onPointerDown: handlePointerDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
  }
}
