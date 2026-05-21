import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory, WorldBookUserPlaceholderBinding } from '../newFriendsPersona/types'
import type { WechatAccountsBundle } from '../wechatAccountTypes'
import { loadAccountsBundle } from '../wechatAccountPersistence'
import { formatPlayerIdentityDisplayName } from '../wechatCharacterPlayerIdentity'
import type { MemoryPromptLineScope } from '../wechatMemoryLineScope'
import { countWorldBookUserPlaceholderSlots } from '../worldBookUserPlaceholderBindings'

/** 档案馆展示：微信昵称 · 扮演身份名（不含 wxid、不含「扮演」前缀） */
export async function formatMemoryArchiveSourceBindingLabel(
  scope: MemoryPromptLineScope,
  bundle?: WechatAccountsBundle | null,
): Promise<string> {
  const b = bundle ?? (await loadAccountsBundle())
  const acc = scope.wechatAccountId.trim()
  const accRow = b?.accounts.find((a) => a.accountId === acc)
  const wxNick = accRow?.nickname?.trim() || accRow?.wechatId?.trim() || acc || '未知微信'
  const sid = scope.sessionPlayerIdentityId.trim() || '__none__'
  if (sid === '__none__') return wxNick
  const pidRow = await personaDb.getPlayerIdentity(sid)
  const identityName = formatPlayerIdentityDisplayName(pidRow, sid)
  return `${wxNick} · ${identityName}`
}

export async function formatMemoryUserBindingLabel(
  binding: WorldBookUserPlaceholderBinding,
  bundle?: WechatAccountsBundle | null,
): Promise<string> {
  const acc = binding.wechatAccountId?.trim()
  const pid = binding.playerIdentityId?.trim()
  if (!acc || !pid) return '未绑定'
  return formatMemoryArchiveSourceBindingLabel(
    { wechatAccountId: acc, sessionPlayerIdentityId: pid },
    bundle,
  )
}

/** 记忆写入来源线（sourceWechatAccountId + sourceSessionPlayerIdentityId） */
export async function resolveMemoryEntrySourceLineLabel(
  m: CharacterMemory,
  bundle?: WechatAccountsBundle | null,
): Promise<string | undefined> {
  if (m.memoryScope === 'meet' && !m.sourceWechatAccountId?.trim()) {
    return '遇见'
  }
  const acc = m.sourceWechatAccountId?.trim()
  if (!acc) return undefined
  return formatMemoryArchiveSourceBindingLabel(
    {
      wechatAccountId: acc,
      sessionPlayerIdentityId: m.sourceSessionPlayerIdentityId?.trim() || '__none__',
    },
    bundle,
  )
}

/** 正文中每个 {{user}} 槽位对应的绑定展示（与来源线同格式） */
export async function resolveMemoryUserBindingLabels(
  m: CharacterMemory,
  bundle?: WechatAccountsBundle | null,
): Promise<string[]> {
  const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
  if (!slots) return []
  const bindings = m.userPlaceholderBindings ?? []
  const out: string[] = []
  for (let i = 0; i < slots; i++) {
    const b = bindings[i]
    if (!b?.wechatAccountId?.trim() || !b.playerIdentityId?.trim()) {
      out.push('未绑定')
      continue
    }
    out.push(await formatMemoryUserBindingLabel(b, bundle))
  }
  return out
}
