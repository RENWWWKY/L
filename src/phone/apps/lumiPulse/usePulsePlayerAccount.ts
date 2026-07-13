import { useEffect, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { findAccountById, loadAccountsBundle } from '../wechat/wechatAccountPersistence'
import { usePulseStore } from './usePulseStore'

/** 当前微信马甲对应的玩家微博账号（昵称 / 头像展示用） */
export function usePulsePlayerAccount() {
  const { state } = useCustomization()
  const playerPovId = usePulseStore((s) => s.currentPlayerPovId)
  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const bundle = await loadAccountsBundle()
      if (cancelled) return
      const account = bundle ? findAccountById(bundle, bundle.currentAccountId) : null
      setNickname(account?.nickname?.trim() || state.profile.displayName?.trim() || '我')
      setAvatarUrl(account?.avatarUrl?.trim() || state.profile.avatarImageUrl?.trim() || '')
    })()
    return () => {
      cancelled = true
    }
  }, [state.profile.avatarImageUrl, state.profile.displayName])

  return {
    playerPovId,
    displayName: nickname || '我',
    avatarUrl: avatarUrl || undefined,
  }
}
