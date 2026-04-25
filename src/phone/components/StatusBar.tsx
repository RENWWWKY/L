import { useEffect, useState } from 'react'

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function StatusBar() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  return (
    <header
      className="flex shrink-0 items-center justify-between px-5 pb-2 text-[13px] tracking-wide"
      style={{
        color: 'var(--phone-text)',
        paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
      }}
    >
      <span className="font-medium tabular-nums">{time}</span>
      <div
        className="flex items-center gap-1.5 opacity-80"
        aria-hidden
      >
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" className="text-[var(--phone-text)]">
          <path d="M1 9h2.5v2H1V9Zm4-2h2.5v4H5V7Zm4-3h2.5v7H9V4Zm4-3h2.5v10h-2.5V1Z" fill="currentColor" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" className="text-[var(--phone-text)]">
          <rect x="1" y="2" width="18" height="7" rx="1.5" stroke="currentColor" strokeWidth="1" />
          <path d="M20 4v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="2.5" y="3.5" width="12" height="4" rx="0.5" fill="currentColor" />
        </svg>
      </div>
    </header>
  )
}
