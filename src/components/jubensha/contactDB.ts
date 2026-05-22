import type { WeChatPersonaContact } from '../../phone/types'

import type { JubenshaContactRef } from './types'

/**
 * ContactDB · 将微信通讯录映射为剧本杀馆可用的联系人索引。
 * 游玩记录中的 characterId 经此解析头像与展示名。
 */
export class ContactDB {
  private readonly byCharacterId = new Map<string, JubenshaContactRef>()
  private readonly byId = new Map<string, JubenshaContactRef>()

  constructor(contacts: Iterable<JubenshaContactRef>) {
    for (const c of contacts) {
      this.byCharacterId.set(c.characterId, c)
      this.byId.set(c.id, c)
    }
  }

  static fromWeChatPersonaContacts(rows: WeChatPersonaContact[]): ContactDB {
    return new ContactDB(
      rows.map((c) => ({
        id: c.id,
        characterId: c.characterId,
        remarkName: c.remarkName,
        avatarUrl: c.avatarUrl?.trim() || undefined,
      })),
    )
  }

  getByCharacterId(characterId: string): JubenshaContactRef | undefined {
    return this.byCharacterId.get(characterId)
  }

  getAvatarUrl(characterId: string): string | undefined {
    return this.byCharacterId.get(characterId)?.avatarUrl
  }

  getDisplayName(characterId: string, fallback = '旅人'): string {
    return this.byCharacterId.get(characterId)?.remarkName ?? fallback
  }

  resolveMany(characterIds: string[]): JubenshaContactRef[] {
    const out: JubenshaContactRef[] = []
    const seen = new Set<string>()
    for (const cid of characterIds) {
      if (seen.has(cid)) continue
      seen.add(cid)
      const row = this.byCharacterId.get(cid)
      if (row) out.push(row)
    }
    return out
  }
}

export function buildContactDBFromWeChat(contacts: WeChatPersonaContact[]): ContactDB {
  return ContactDB.fromWeChatPersonaContacts(contacts)
}
