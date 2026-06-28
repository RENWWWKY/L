import { useCallback, useEffect, useState } from 'react'

import { WECHAT_LUMI_ASSISTANT_CONTACT } from '../../components/WeChatContactsInstagram'
import { useCustomization } from '../../phone/CustomizationContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { loadAccountsBundle } from '../../phone/apps/wechat/wechatAccountPersistence'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from '../../phone/apps/wechat/wechatConversationKey'
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

export type UseInviteableWeChatContactsOptions = {
  /** 收藏/转发面板：允许投递到 Lumi 小助手 */
  includeLumiAssistant?: boolean
  /** 收藏/转发面板：允许投递到「发给自己」备忘录会话 */
  includeSelfChat?: boolean
}

export function useInviteableWeChatContacts(
  open: boolean,
  options: UseInviteableWeChatContactsOptions = {},
) {
  const { includeLumiAssistant = false, includeSelfChat = false } = options
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

      const systemRows: InviteableContact[] = []
      const taken = new Set(out.map((c) => c.characterId))

      if (includeLumiAssistant && !taken.has(WECHAT_LUMI_PEER_CHARACTER_ID)) {
        systemRows.push({
          id: WECHAT_LUMI_ASSISTANT_CONTACT.id,
          characterId: WECHAT_LUMI_PEER_CHARACTER_ID,
          remarkName: `${WECHAT_LUMI_ASSISTANT_CONTACT.remarkName} · 小助手`,
          avatarUrl:
            resolveCharacterAvatarUrl({ avatarUrl: WECHAT_LUMI_ASSISTANT_CONTACT.avatarUrl }) ||
            WECHAT_LUMI_ASSISTANT_CONTACT.avatarUrl ||
            undefined,
        })
      }

      if (includeSelfChat && !taken.has(WECHAT_SELF_PEER_CHARACTER_ID)) {
        const selfName =
          account.nickname?.trim() || state.profile.displayName?.trim() || '我'
        const selfAvatar =
          resolveCharacterAvatarUrl({
            avatarUrl: account.avatarUrl ?? state.profile.avatarImageUrl,
          }) || undefined
        systemRows.push({
          id: WECHAT_SELF_PEER_CHARACTER_ID,
          characterId: WECHAT_SELF_PEER_CHARACTER_ID,
          remarkName: `${selfName} · 发给自己`,
          avatarUrl: selfAvatar,
        })
      }

      setContacts([...systemRows, ...out])
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [
    includeLumiAssistant,
    includeSelfChat,
    state.profile.displayName,
    state.profile.avatarImageUrl,
    state.wechatPersonaContacts,
  ])

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
