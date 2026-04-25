import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * 打字机效果：逐字展示文本。
 * - `speedMs`：每个字符的间隔
 * - 当 text 变化时自动重置
 */
export function useTypewriter(text: string, speedMs = 22) {
  const full = String(text ?? '')
  const [count, setCount] = useState(0)
  const textRef = useRef(full)
  textRef.current = full

  useEffect(() => {
    setCount(0)
    if (!full) return
    const safeSpeed = Math.max(8, Math.min(80, Math.round(speedMs)))
    let cancelled = false
    const id = window.setInterval(() => {
      if (cancelled) return
      setCount((c) => {
        const next = Math.min(textRef.current.length, c + 1)
        if (next >= textRef.current.length) window.clearInterval(id)
        return next
      })
    }, safeSpeed)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, speedMs])

  const done = count >= full.length
  const isTyping = !!full && !done
  const typed = useMemo(() => full.slice(0, count), [full, count])
  return { typed, done, isTyping, total: full.length, count }
}

