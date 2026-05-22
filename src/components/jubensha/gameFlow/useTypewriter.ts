import { useEffect, useState } from 'react'

export type UseTypewriterOptions = {
  /** 每个字符间隔（毫秒），默认偏慢 */
  msPerChar?: number
  /** 换行后多停一会（毫秒） */
  pauseAfterParagraphMs?: number
  active?: boolean
}

/**
 * 中文打字机：按字符输出，遇换行时略作停顿。
 */
export function useTypewriter(
  fullText: string,
  { msPerChar = 95, pauseAfterParagraphMs = 620, active = true }: UseTypewriterOptions = {},
) {
  const [displayed, setDisplayed] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!active || !fullText) {
      setDisplayed('')
      setIsTyping(false)
      return
    }

    setDisplayed('')
    setIsTyping(true)
    let index = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      index += 1
      setDisplayed(fullText.slice(0, index))
      if (index >= fullText.length) {
        setIsTyping(false)
        return
      }
      const prev = fullText[index - 1]
      const delay = prev === '\n' ? pauseAfterParagraphMs : msPerChar
      timer = window.setTimeout(tick, delay)
    }

    timer = window.setTimeout(tick, msPerChar)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      setIsTyping(false)
    }
  }, [fullText, active, msPerChar, pauseAfterParagraphMs])

  return {
    displayed,
    isTyping,
    isComplete: active && fullText.length > 0 && displayed.length >= fullText.length && !isTyping,
  }
}
