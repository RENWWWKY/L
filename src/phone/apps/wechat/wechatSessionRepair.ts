import { countWeChatPersonaCoreStoreRecords } from '../dataArchive/scanWeChatPersonaIndexedDb'
import { syncWeChatDataInventoryBaseline } from './wechatDataInventory'
import { emitWeChatStorageChanged } from './newFriendsPersona/idb'
import {
  loadAccountsBundle,
  reconcileWeChatCharacterOwnershipAfterArchiveImport,
  saveAccountsBundle,
} from './wechatAccountPersistence'
import { repairWeChatSessionPersistence } from './wechatPersonaContactsSync'

export const WECHAT_SESSION_REPAIR_APPLIED_EVENT = 'wechat:session-repair-applied'

export type WeChatSessionRepairResult = {
  ok: boolean
  message: string
  contactCount: number
}

/**
 * 从本机 IndexedDB / bundle 快照自动对齐微信通讯录（不读 .lumi 文件）。
 * 若聊天/人设表已被浏览器清空，则无法执行。
 */
export async function tryAutoRepairWeChatFromLocalDb(): Promise<WeChatSessionRepairResult> {
  const bundle = await loadAccountsBundle()
  if (!bundle?.accounts.length) {
    return { ok: false, message: '未找到微信账号，请先在微信中登录。', contactCount: 0 }
  }

  const activeId = bundle.currentAccountId.trim() || bundle.accounts[0]?.accountId?.trim() || ''
  const core = await countWeChatPersonaCoreStoreRecords()
  const idbHasCore = core.characters > 0 || core.chatMessages > 0
  const bundleContacts = bundle.accounts.reduce((n, a) => n + a.personaContacts.length, 0)

  if (!idbHasCore && bundleContacts === 0) {
    return {
      ok: false,
      message:
        '本机 IndexedDB 中已无人设与聊天记录，代码无法凭空生成数据。若曾导出 .lumi，请使用上方「恢复导入」。',
      contactCount: 0,
    }
  }

  try {
    const ownership = await reconcileWeChatCharacterOwnershipAfterArchiveImport()
    if (ownership.charactersRepaired > 0) {
      await syncWeChatDataInventoryBaseline()
      emitWeChatStorageChanged()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(WECHAT_SESSION_REPAIR_APPLIED_EVENT, {
            detail: { contacts: [], activeAccountId: activeId, charactersRepaired: ownership.charactersRepaired },
          }),
        )
      }
      return {
        ok: true,
        message: `已修复 ${ownership.charactersRepaired} 条人设的微信账号归属，并重新对齐聊天索引。请完全刷新页面后打开「世界线人物名册」与微信。`,
        contactCount: bundleContacts,
      }
    }
  } catch {
    /* 归属修复失败仍尝试通讯录对齐 */
  }

  const { bundle: nextBundle, contacts, repaired } = await repairWeChatSessionPersistence({
    bundle,
    activeAccountId: activeId,
    inMemoryContacts: [],
  })

  if (!repaired || !contacts.length) {
    if (idbHasCore) {
      return {
        ok: false,
        message: '本地库仍有数据，但未能重建通讯录。请刷新页面后打开微信，或联系支持。',
        contactCount: 0,
      }
    }
    return {
      ok: false,
      message: '未能从本地快照恢复通讯录，请尝试导入 .lumi 备份。',
      contactCount: 0,
    }
  }

  await saveAccountsBundle(nextBundle)
  await syncWeChatDataInventoryBaseline()
  emitWeChatStorageChanged()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(WECHAT_SESSION_REPAIR_APPLIED_EVENT, {
        detail: { contacts, activeAccountId: activeId },
      }),
    )
  }

  return {
    ok: true,
    message: `已从本机存储写回 ${contacts.length} 个联系人。请打开微信查看；若聊天列表仍空，请完全刷新页面后再试。`,
    contactCount: contacts.length,
  }
}
