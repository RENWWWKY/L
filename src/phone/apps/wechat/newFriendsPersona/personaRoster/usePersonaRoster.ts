import { useCallback, useMemo, useState } from 'react'
import { useWechatStore } from '../../useWechatStore'
import { loadAccountsBundle } from '../../wechatAccountPersistence'
import { personaDb } from '../idb'
import type { Character, PlayerIdentity } from '../types'
import {
  backfillAllNpcPlayerIdentityFromRootMains,
  backfillCharacterPlayerIdentityLinkMeta,
  buildIdentityDisplayNameMapForCharacters,
  repairCharacterSlotPrimaryBindingFromLinked,
} from '../../wechatCharacterPlayerIdentity'
import { characterAccessibleToWechatAccount } from '../../wechatAccountScope'
import { isMainCharacter } from './personaRosterTypes'

export function usePersonaRoster(linkedCharacterIds: readonly string[]) {
  const { currentAccountId } = useWechatStore()
  const linkedCharacterIdSet = useMemo(() => new Set(linkedCharacterIds), [linkedCharacterIds])

  const [mainCharacters, setMainCharacters] = useState<Character[]>([])
  const [npcCharacters, setNpcCharacters] = useState<Character[]>([])
  const [identityList, setIdentityList] = useState<PlayerIdentity[]>([])
  const [identityNameById, setIdentityNameById] = useState<Record<string, string>>({})
  const [accountsBundle, setAccountsBundle] = useState<Awaited<ReturnType<typeof loadAccountsBundle>>>(null)
  const [loading, setLoading] = useState(false)

  const mainNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of mainCharacters) {
      const id = c.id.trim()
      if (id) map[id] = c.name?.trim() || '未命名'
    }
    return map
  }, [mainCharacters])

  const mainById = useMemo(() => {
    const map: Record<string, Character> = {}
    for (const c of mainCharacters) {
      const id = c.id.trim()
      if (id) map[id] = c
    }
    return map
  }, [mainCharacters])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const acc = currentAccountId?.trim()
      if (!acc) {
        setMainCharacters([])
        setNpcCharacters([])
        setIdentityNameById({})
        setIdentityList([])
        return
      }

      let roots = await personaDb.listRootCharactersAccessibleToWechatAccount(acc, [...linkedCharacterIds])
      let repaired = false
      for (const c of roots) {
        if (await repairCharacterSlotPrimaryBindingFromLinked(c.id)) repaired = true
        if (await backfillCharacterPlayerIdentityLinkMeta(c.id)) repaired = true
      }
      if ((await backfillAllNpcPlayerIdentityFromRootMains(acc)) > 0) repaired = true
      if (repaired) {
        roots = await personaDb.listRootCharactersAccessibleToWechatAccount(acc, [...linkedCharacterIds])
      }

      const allChars = await personaDb.listCharactersForWechatAccount(acc)
      const npcs = allChars.filter(
        (c) =>
          !isMainCharacter(c) &&
          characterAccessibleToWechatAccount(c, acc, linkedCharacterIdSet),
      )
      npcs.sort((a, b) => b.updatedAt - a.updatedAt)
      roots.sort((a, b) => b.updatedAt - a.updatedAt)

      const idents = await personaDb.listPlayerIdentities(acc)
      setMainCharacters(roots)
      setNpcCharacters(npcs)
      setIdentityList(idents)
      setIdentityNameById(await buildIdentityDisplayNameMapForCharacters(acc, [...roots, ...npcs]))
      setAccountsBundle(await loadAccountsBundle())
    } catch (e) {
      console.warn('[persona-roster] refresh failed', e)
      window.alert(e instanceof Error ? e.message : '加载人物名册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [currentAccountId, linkedCharacterIdSet, linkedCharacterIds])

  return {
    mainCharacters,
    npcCharacters,
    identityList,
    identityNameById,
    accountsBundle,
    mainNameById,
    mainById,
    loading,
    refresh,
  }
}
