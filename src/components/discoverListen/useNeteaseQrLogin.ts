import { useCallback, useEffect, useRef, useState } from 'react'

import {
  neteaseQrCheck,
  neteaseQrStart,
  saveNeteaseCookie,
  type QrStartData,
} from './neteaseApiClient'

export type QrLoginPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'scanned'
  | 'success'
  | 'expired'
  | 'error'

const POLL_MS = 2000

export function useNeteaseQrLogin(open: boolean) {
  const [phase, setPhase] = useState<QrLoginPhase>('idle')
  const [qr, setQr] = useState<QrStartData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const keyRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const stopPoll = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    stopPoll()
    setPhase('loading')
    setError(null)
    try {
      const data = await neteaseQrStart(true)
      keyRef.current = data.key
      setQr(data)
      setPhase('ready')
    } catch (e) {
      setPhase('error')
      const msg = e instanceof Error ? e.message : '二维码加载失败'
      setError(
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? '无法连接登录服务，建议打开梯子后重试'
          : msg,
      )
    }
  }, [stopPoll])

  useEffect(() => {
    if (!open) {
      stopPoll()
      setPhase('idle')
      setQr(null)
      setError(null)
      keyRef.current = null
      return
    }
    void refresh()
    return stopPoll
  }, [open, refresh, stopPoll])

  useEffect(() => {
    if (!open || phase !== 'ready' && phase !== 'scanned') {
      return
    }
    const key = keyRef.current
    if (!key) return

    const tick = async () => {
      try {
        const res = await neteaseQrCheck(key)
        if (res.code === 801) {
          setPhase('ready')
          return
        }
        if (res.code === 802) {
          setPhase('scanned')
          return
        }
        if (res.code === 803) {
          stopPoll()
          if (res.cookie) saveNeteaseCookie(res.cookie)
          setPhase('success')
          return
        }
        if (res.code === 800) {
          stopPoll()
          setPhase('expired')
        }
      } catch (e) {
        stopPoll()
        setPhase('error')
        setError(e instanceof Error ? e.message : '状态查询失败')
      }
    }

    void tick()
    timerRef.current = window.setInterval(() => void tick(), POLL_MS)
    return stopPoll
  }, [open, phase, stopPoll])

  return {
    phase,
    qr,
    error,
    refresh,
    statusText:
      phase === 'loading'
        ? '正在生成二维码…'
        : phase === 'scanned'
          ? '已扫码，请在手机上确认'
          : phase === 'success'
            ? '登录成功'
            : phase === 'expired'
              ? '二维码已过期'
              : phase === 'error'
                ? (error ?? '出错了')
                : '使用网易云 App 扫码登录',
  }
}
