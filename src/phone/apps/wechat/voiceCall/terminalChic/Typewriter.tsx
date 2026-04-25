import { useTypewriter } from '../useTypewriter'
import { useEffect, useRef } from 'react'

/**
 * 终端式打字机组件：
 * - 逐字输出
 * - 打字期间显示块状光标
 * - 完成后光标自动消失
 */
export function Typewriter({
  text,
  speedMs = 52,
  cursorColor = '#111',
  onDone,
}: {
  text: string
  speedMs?: number
  cursorColor?: string
  onDone?: () => void
}) {
  const { typed, isTyping, done } = useTypewriter(text, speedMs)
  const doneRef = useRef(false)
  useEffect(() => {
    if (!done) {
      doneRef.current = false
      return
    }
    if (!doneRef.current) {
      doneRef.current = true
      onDone?.()
    }
  }, [done, onDone])

  return (
    <>
      {typed}
      {isTyping ? (
        <span
          aria-hidden
          className="ml-1 inline-block h-[1.15em] w-[0.6em] align-[-0.12em]"
          style={{
            backgroundColor: cursorColor,
            borderRadius: '1px',
            animation: 'vc-blink 1s step-end infinite',
          }}
        />
      ) : null}
    </>
  )
}

