import { useCallback, useEffect, useState } from 'react'

import { useCustomization } from '../../phone/CustomizationContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { loadAccountsBundle } from '../../phone/apps/wechat/wechatAccountPersistence'
import {
  excludeUserAccountFromPersonaContacts,
} from '../../phone/apps/wechat/wechatPersonaContactsSync'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import type { WeChatPersonaContact } from '../../phone/types'

export type InviteableContact = {
  id: string
  characterId: string
  remarkName: string
  avatarUrl?: string
}

export function useInviteableWeChatContacts(open: boolean) {
  const { state } = useCustomization()
  const [contacts, setContacts] = useState<InviteableContact[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const bundle = await loadAccountsBundle()
      if (!bundle) {
        setContacts([])
        return
      }
      const account = bundle.accounts.find((a) => a.accountId === bundle.currentAccountId)
      if (!account) {
        setContacts([])
        return
      }
      const filtered = await excludeUserAccountFromPersonaContacts(state.wechatPersonaContacts, account)
      const out: InviteableContact[] = []
      for (const c of filtered) {
        const ch = await personaDb.getCharacter(c.characterId)
        if (ch?.isBlocked) continue
        out.push({
          id: c.id,
          characterId: c.characterId,
          remarkName: c.remarkName,
          avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || c.avatarUrl || undefined,
        })
      }
      out.sort((a, b) => a.remarkName.localeCompare(b.remarkName, 'zh-CN'))
      setContacts(out)
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [state.wechatPersonaContacts])

  useEffect(() => {
    if (!open) return
    void load()
  }, [load, open])

  return { contacts, loading, reload: load }
}

export function inviteableContactFromPersona(c: WeChatPersonaContact): InviteableContact {
  return {
    id: c.id,
    characterId: c.characterId,
    remarkName: c.remarkName,
    avatarUrl: resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl }) || c.avatarUrl || undefined,
  }
}
