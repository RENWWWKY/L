import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterTimeSettingsRow, WeChatTimeConfig } from '../newFriendsPersona/types'
import { normalizeWeChatTimeConfig, resolveWeChatCurrentTimeMs } from './wechatTimeUtils'

type UseWeChatCurrentTimeOptions = {
  characterId?: string | null
}

export function useWeChatCurrentTime(options?: UseWeChatCurrentTimeOptions) {
  const characterId = options?.characterId?.trim() || ''
  const [globalConfig, setGlobalConfig] = useState<WeChatTimeConfig>(() => normalizeWeChatTimeConfig())
  const [characterRow, setCharacterRow] = useState<CharacterTimeSettingsRow | null>(null)
  const effectiveConfig = useMemo(
    () => normalizeWeChatTimeConfig(characterRow?.config ?? globalConfig),
    [characterRow?.config, globalConfig],
  )
  const configRef = useRef(effectiveConfig)
  configRef.current = effectiveConfig

  const getCurrentTimeMs = useCallback((realNow = Date.now()) => {
    return resolveWeChatCurrentTimeMs(configRef.current, realNow)
  }, [])

  const [currentTimeMs, setCurrentTimeMs] = useState(() => getCurrentTimeMs())

  const reload = useCallback(async () => {
    const global = await personaDb.getGlobalSettings()
    setGlobalConfig(normalizeWeChatTimeConfig(global.globalTimeConfig))
    if (!characterId) {
      setCharacterRow(null)
      return
    }
    const row = await personaDb.getCharacterTimeSettings(characterId)
    setCharacterRow(row)
  }, [characterId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onStorage = () => void reload()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [reload])

  useEffect(() => {
    setCurrentTimeMs(getCurrentTimeMs())
    const tickMs =
      effectiveConfig.mode === 'custom'
        ? Math.max(250, Math.min(1000, Math.round(1000 / Math.max(1, effectiveConfig.timeMultiplier))))
        : 1000
    const id = window.setInterval(() => {
      setCurrentTimeMs(getCurrentTimeMs())
    }, tickMs)
    return () => window.clearInterval(id)
  }, [effectiveConfig.mode, effectiveConfig.timeMultiplier, getCurrentTimeMs])

  return {
    currentTimeMs,
    globalConfig,
    characterConfig: characterRow?.config ?? null,
    effectiveConfig,
    getCurrentTimeMs,
    reload,
  }
}
