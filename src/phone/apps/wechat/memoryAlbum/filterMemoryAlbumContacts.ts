import { WECHAT_LUMI_ASSISTANT_CONTACT } from '../../../../components/WeChatContactsInstagram'
import type { MemoryAlbumContact } from './memoryAlbumTypes'

/** 记忆相册仅展示角色相册，排除 Lumi 小助手 */
export function filterMemoryAlbumContacts(contacts: MemoryAlbumContact[]): MemoryAlbumContact[] {
  const lumiId = WECHAT_LUMI_ASSISTANT_CONTACT.id
  return contacts.filter((c) => c.id !== lumiId && c.remarkName.trim() !== 'Lumi')
}
