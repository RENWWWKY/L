import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../phone/CustomizationContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { loadAccountsBundle } from '../../phone/apps/wechat/wechatAccountPersistence'
import { excludeUserAccountFromPersonaContacts } from '../../phone/apps/wechat/wechatPersonaContactsSync'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { enrichMomentContactsWithLiveCharacterAvatars } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import { filterPrivacyPickableContacts } from './privacySelectionUtils'

function mergeMomentContacts(
  seedContacts: MomentContactRef[],
  liveContacts: MomentContactRef[],
): MomentContactRef[] {
  const byId = new Map<string, MomentContactRef>()
  for (const c of seedContacts) {
    if (c.id !== 'self') byId.set(c.id, c)
  }
  for (const c of liveContacts) {
    byId.set(c.id, c)
  }
  return filterPrivacyPickableContacts(Array.from(byId.values())).sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN'),
  )
}

/** 谁可以看 / 新建标签：打开弹窗时从当前微信通讯录拉取可选好友 */
export function useMomentsPrivacyPickableContacts(open: boolean, seedContacts: MomentContactRef[] = []) {
  const { state } = useCustomization()
  const [liveContacts, setLiveContacts] = useState<MomentContactRef[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const bundle = await loadAccountsBundle()
      if (!bundle) {
        setLiveContacts([])
        return
      }
      const account = bundle.accounts.find((a) => a.accountId === bundle.currentAccountId)
      if (!account) {
        setLiveContacts([])
        return
      }
      const filtered = await excludeUserAccountFromPersonaContacts(state.wechatPersonaContacts, account)
      const refs: MomentContactRef[] = []
      for (const c of filtered) {
        if (c.characterId?.trim()) {
          try {
            const ch = await personaDb.getCharacter(c.characterId)
            if (ch?.isBlocked) continue
          } catch {
            /* 静默 */
          }
        }
        refs.push({
          id: c.id,
          name: c.remarkName.trim() || '未命名',
          avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || c.avatarUrl || undefined,
          characterId: c.characterId,
        })
      }
      const enriched = await enrichMomentContactsWithLiveCharacterAvatars(refs)
      setLiveContacts(filterPrivacyPickableContacts(enriched))
    } catch {
      setLiveContacts([])
    } finally {
      setLoading(false)
    }
  }, [state.wechatPersonaContacts])

  useEffect(() => {
    if (!open) return
    void load()
  }, [load, open])

  const contacts = useMemo(
    () => mergeMomentContacts(seedContacts, liveContacts),
    [liveContacts, seedContacts],
  )

  return { contacts, loading, reload: load }
}
