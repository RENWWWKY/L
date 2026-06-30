import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../wechat/newFriendsPersona/types'
import { isPersonaRosterMainCharacter } from '../wechat/newFriendsPersona/personaRoster/personaRosterTypes'
import {
  findAccountById,
  loadAccountsBundle,
  resolveAccountSessionIdentityId,
} from '../wechat/wechatAccountPersistence'
import type { PulsePovOption } from './pulseTypes'
import { toCharPovId, toPlayerPovId } from './pulseTypes'

export function usePulsePovOptions() {
  const { state } = useCustomization()
  const [mainCharacters, setMainCharacters] = useState<Character[]>([])
  const [playerIdentity, setPlayerIdentity] = useState<PlayerIdentity | null>(null)
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const refresh = useCallback(async () => {
    const bundle = await loadAccountsBundle()
    if (!bundle) {
      setCurrentAccountId(null)
      setMainCharacters([])
      setPlayerIdentity(null)
      setHydrated(true)
      return
    }
    const accId = bundle.currentAccountId
    setCurrentAccountId(accId)
    const linkedIds = state.wechatPersonaContacts.map((c) => c.characterId).filter(Boolean)
    const roots = await personaDb.listRootCharactersAccessibleToWechatAccount(accId, linkedIds)
    setMainCharacters(roots.filter(isPersonaRosterMainCharacter))

    const account = findAccountById(bundle, accId)
    const sessionId = account ? resolveAccountSessionIdentityId(account).trim() : ''
    if (sessionId && sessionId !== '__none__') {
      const idRow = await personaDb.getPlayerIdentity(sessionId)
      setPlayerIdentity(idRow ?? null)
    } else {
      setPlayerIdentity(null)
    }
    setHydrated(true)
  }, [state.wechatPersonaContacts])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const options = useMemo((): PulsePovOption[] => {
    const rows: PulsePovOption[] = []
    const profile = state.profile
    const sessionId = playerIdentity?.id?.trim()
    if (sessionId) {
      rows.push({
        povId: toPlayerPovId(sessionId),
        kind: 'player',
        rawId: sessionId,
        label: profile.displayName?.trim() || playerIdentity?.name?.trim() || '我',
        avatarUrl: profile.avatarImageUrl?.trim() || playerIdentity?.avatarUrl?.trim(),
      })
    }
    for (const ch of mainCharacters) {
      const id = ch.id.trim()
      if (!id) continue
      rows.push({
        povId: toCharPovId(id),
        kind: 'char',
        rawId: id,
        label: ch.name?.trim() || '未命名',
        avatarUrl: ch.avatarUrl?.trim(),
      })
    }
    return rows
  }, [mainCharacters, playerIdentity, state.profile])

  return {
    hydrated,
    currentAccountId,
    options,
    refresh,
  }
}
