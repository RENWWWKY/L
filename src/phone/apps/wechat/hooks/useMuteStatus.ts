import { useCallback, useEffect, useState } from 'react'

import { personaDb } from '../newFriendsPersona/idb'

/**
 * 按会话维度统一管理免打扰（IndexedDB `chatConversationSettings.isMuted`）。
 * 监听 `wechat-storage-changed`，供会话列表、资料卡等跨页同步。
 */
export function useMuteStatus(playerIdentityId: string | null) {
  const [muteByConversationKey, setMuteByConversationKey] = useState<Map<string, boolean>>(() => new Map())

  const refresh = useCallback(async () => {
    if (playerIdentityId == null || !playerIdentityId.trim()) {
      setMuteByConversationKey(new Map())
      return
    }
    const rows = await personaDb.listChatConversationSettingsByPlayerIdentity(playerIdentityId)
    const next = new Map<string, boolean>()
    for (const r of rows) {
      next.set(r.conversationKey, !!r.isMuted)
    }
    setMuteByConversationKey(next)
  }, [playerIdentityId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const on = () => void refresh()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [refresh])

  const isConversationMuted = useCallback(
    (conversationKey: string) => muteByConversationKey.get(conversationKey) ?? false,
    [muteByConversationKey],
  )

  return { isConversationMuted, muteByConversationKey, refresh }
}
