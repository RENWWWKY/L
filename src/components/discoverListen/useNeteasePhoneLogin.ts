import { useCallback, useState } from 'react'

import { neteasePhoneLogin, neteaseSendCaptcha } from './neteaseApiClient'

export type PhoneLoginPhase = 'idle' | 'sending' | 'logging' | 'success' | 'error'

export function useNeteasePhoneLogin() {
  const [phase, setPhase] = useState<PhoneLoginPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [captchaSent, setCaptchaSent] = useState(false)

  const reset = useCallback(() => {
    setPhase('idle')
    setError(null)
    setCaptchaSent(false)
  }, [])

  const sendCaptcha = useCallback(async (phone: string, ctcode = '86') => {
    setPhase('sending')
    setError(null)
    try {
      await neteaseSendCaptcha(phone, ctcode)
      setCaptchaSent(true)
      setPhase('idle')
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : '验证码发送失败')
    }
  }, [])

  const login = useCallback(
    async (opts: {
      phone: string
      password?: string
      captcha?: string
      ctcode?: string
    }) => {
      setPhase('logging')
      setError(null)
      try {
        await neteasePhoneLogin(opts)
        setPhase('success')
      } catch (e) {
        setPhase('error')
        setError(e instanceof Error ? e.message : '登录失败')
      }
    },
    [],
  )

  return {
    phase,
    error,
    captchaSent,
    reset,
    sendCaptcha,
    login,
    busy: phase === 'sending' || phase === 'logging',
  }
}
