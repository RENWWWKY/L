import { useCallback, useEffect, useMemo, useState } from 'react'

type WalletSnapshot = {
  balance: number
  paymentPassword?: string
}

const KEY = 'wx-wallet-mock-v1'

function loadWallet(): WalletSnapshot {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { balance: 2000 }
    const parsed = JSON.parse(raw) as Partial<WalletSnapshot>
    const balance = Number(parsed.balance)
    return {
      balance: Number.isFinite(balance) ? balance : 2000,
      paymentPassword: typeof parsed.paymentPassword === 'string' ? parsed.paymentPassword : undefined,
    }
  } catch {
    return { balance: 2000 }
  }
}

function saveWallet(snapshot: WalletSnapshot) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot))
  } catch {
    // ignore
  }
}

export function useWallet() {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(() => loadWallet())

  useEffect(() => {
    saveWallet(snapshot)
  }, [snapshot])

  const hasPaymentPassword = useMemo(() => {
    return typeof snapshot.paymentPassword === 'string' && /^\d{6}$/.test(snapshot.paymentPassword)
  }, [snapshot.paymentPassword])

  const verifyPassword = useCallback(
    async (input: string) => {
      await new Promise((r) => window.setTimeout(r, 280))
      return !!snapshot.paymentPassword && snapshot.paymentPassword === input
    },
    [snapshot.paymentPassword],
  )

  const deduct = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return false
    if (snapshot.balance < amount) return false
    setSnapshot((prev) => ({ ...prev, balance: Math.round((prev.balance - amount) * 100) / 100 }))
    return true
  }, [snapshot.balance])

  const setPaymentPassword = useCallback((pwd: string) => {
    if (!/^\d{6}$/.test(pwd)) return
    setSnapshot((prev) => ({ ...prev, paymentPassword: pwd }))
  }, [])

  return {
    balance: snapshot.balance,
    hasPaymentPassword,
    verifyPassword,
    deduct,
    setPaymentPassword,
  }
}
