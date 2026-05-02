import { motion } from 'framer-motion'
import { LUMI_SYS_FIRST_BOOT_KEY, LUMI_SYS_TOKENS_TOTAL_KEY, PLATINUM } from './constants'
import { formatWithCommas, useCountUp } from './useCountUp'

function readFirstBootMs(): number {
  if (typeof localStorage === 'undefined') return Date.now()
  const raw = localStorage.getItem(LUMI_SYS_FIRST_BOOT_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : Date.now()
}

function readTokensTotal(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(LUMI_SYS_TOKENS_TOTAL_KEY)
  const n = raw ? Number(raw) : 0
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

function daysBetween(fromMs: number, toMs: number): number {
  const d = Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000))
  return Math.max(0, d)
}

export function OverviewCards() {
  const firstBoot = readFirstBootMs()
  const days = daysBetween(firstBoot, Date.now())
  const tokens = readTokensTotal()
  const countDays = useCountUp(days, 1000)
  const countTokens = useCountUp(tokens, 1400)
  const since = new Date(firstBoot)
  const sinceStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`

  return (
    <div className="grid grid-cols-2 gap-3">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[0_8px_32px_rgba(28,28,30,0.06)]"
        style={{
          borderColor: PLATINUM.line,
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: PLATINUM.ash }}>
          Days Together
        </p>
        <p className="mt-1 text-[34px] font-semibold tabular-nums leading-none" style={{ color: PLATINUM.ink }}>
          {countDays}
        </p>
        <p className="mt-1 text-[11px]" style={{ color: PLATINUM.ash }}>
          陪伴天数
        </p>
        <p
          className="absolute right-3 top-3 text-[8px] font-medium uppercase tracking-[0.12em]"
          style={{ color: PLATINUM.gold }}
        >
          Since {sinceStr}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.06 }}
        className="relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[0_8px_32px_rgba(28,28,30,0.06)]"
        style={{
          borderColor: PLATINUM.line,
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: PLATINUM.ash }}>
          Tokens Generated
        </p>
        <p className="mt-1 text-[22px] font-semibold tabular-nums leading-tight tracking-tight" style={{ color: PLATINUM.ink }}>
          {formatWithCommas(countTokens)}
        </p>
        <p className="mt-1 text-[11px]" style={{ color: PLATINUM.ash }}>
          灵感消耗（累计）
        </p>
      </motion.div>
    </div>
  )
}
