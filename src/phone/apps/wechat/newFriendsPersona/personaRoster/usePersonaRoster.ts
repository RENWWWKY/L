import { useCallback, useMemo, useState } from 'react'
import { useWechatStore } from '../../useWechatStore'
import {
  findAccountById,
  loadAccountsBundle,
  reconcileWeChatCharacterOwnershipAfterArchiveImport,
} from '../../wechatAccountPersistence'
import { countWeChatPersonaCoreStoreRecords } from '../../../dataArchive/scanWeChatPersonaIndexedDb'
import { personaDb } from '../idb'
import type { Character, PlayerIdentity } from '../types'
import {
  backfillAllNpcPlayerIdentityFromRootMains,
  backfillCharacterPlayerIdentityLinkMeta,
  buildIdentityDisplayNameMapForCharacters,
  repairCharacterSlotPrimaryBindingFromLinked,
} from '../../wechatCharacterPlayerIdentity'
import { characterAccessibleToWechatAccount } from '../../wechatAccountScope'
import {
  buildWechatSelfContactExclusionContext,
  isCharacterUserAccountSelf,
} from '../../wechatPersonaContactsSelfFilter'
import { isMainCharacter, isPersonaRosterMainCharacter } from './personaRosterTypes'

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
      if (!roots.length) {
        const core = await countWeChatPersonaCoreStoreRecords()
        if (core.characters > 0) {
          try {
            await reconcileWeChatCharacterOwnershipAfterArchiveImport()
            roots = await personaDb.listRootCharactersAccessibleToWechatAccount(acc, [...linkedCharacterIds])
          } catch (e) {
            console.warn('[persona-roster] ownership reconcile failed', e)
          }
        }
      }
      let repaired = false
      for (const c of roots) {
        if (await repairCharacterSlotPrimaryBindingFromLinked(c.id)) repaired = true
        if (await backfillCharacterPlayerIdentityLinkMeta(c.id)) repaired = true
      }
      if ((await backfillAllNpcPlayerIdentityFromRootMains(acc)) > 0) repaired = true
      if (repaired) {
        roots = await personaDb.listRootCharactersAccessibleToWechatAccount(acc, [...linkedCharacterIds])
      }

      const bundle = await loadAccountsBundle()
      const account = bundle ? findAccountById(bundle, acc) : null
      const selfExclusion = account ? await buildWechatSelfContactExclusionContext(account) : null
      roots = roots.filter(
        (c) =>
          isPersonaRosterMainCharacter(c) &&
          (!selfExclusion || !isCharacterUserAccountSelf(c, selfExclusion)),
      )

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
      setAccountsBundle(bundle)
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
