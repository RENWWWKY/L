import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import {
  backfillCharacterPlayerIdentityLinkMeta,
  formatPlayerIdentityDisplayName,
  getCharacterBoundPlayerIdentityId,
  getCharacterLinkedPlayerIdentityIds,
} from '../wechatCharacterPlayerIdentity'
import type { WorldBookUserInsertContext } from '../charUserPlaceholders'
import { bindingFromInsertContext } from '../worldBookUserPlaceholderBindings'
import { formatMemoryArchiveSourceBindingLabel } from './memoryArchiveSourceLabel'
import { resolvePlayerIdentityWechatAccountId } from '../wechatContactIdentityPrompt'
import { parseGroupIdFromMemoryBucketCharacterId } from '../wechatConversationKey'

export type MemoryEditorIdentityOption = {
  key: string
  ctx: WorldBookUserInsertContext
  label: string
  role: 'primary' | 'linked' | 'session'
}

function optionKey(acc: string, pid: string): string {
  return `${acc.trim()}:${pid.trim()}`
}

async function buildOption(
  character: Character,
  playerIdentityId: string,
  role: MemoryEditorIdentityOption['role'],
): Promise<MemoryEditorIdentityOption | null> {
  const pid = playerIdentityId.trim()
  if (!pid || pid === '__none__') return null
  const row = await personaDb.getPlayerIdentity(pid)
  const acc = resolvePlayerIdentityWechatAccountId(character, pid, row).trim()
  if (!acc) return null
  const label = await formatMemoryArchiveSourceBindingLabel(
    { wechatAccountId: acc, sessionPlayerIdentityId: pid },
    null,
  )
  const displayName = formatPlayerIdentityDisplayName(row, pid)
  const ctx: WorldBookUserInsertContext = {
    wechatAccountId: acc,
    playerIdentityId: pid,
    lineLabel: label,
    displayName,
  }
  return { key: optionKey(acc, pid), ctx, label, role }
}

/** 本条记忆挂载的角色档案上已绑定的玩家身份（主绑定 + 副绑定），供编辑时选择 {{user}} 绑定目标。 */
export async function listMemoryEditorCharacterIdentityOptions(
  characterId: string | null | undefined,
  prefs?: {
    currentWechatAccountId?: string | null
    currentPlayerIdentityId?: string | null
  },
): Promise<MemoryEditorIdentityOption[]> {
  const cid = characterId?.trim()
  if (!cid || parseGroupIdFromMemoryBucketCharacterId(cid)) return []

  let character = await personaDb.getCharacter(cid)
  if (!character) return []

  await backfillCharacterPlayerIdentityLinkMeta(cid)
  character = (await personaDb.getCharacter(cid)) ?? character

  const primary = getCharacterBoundPlayerIdentityId(character)
  const linked = getCharacterLinkedPlayerIdentityIds(character)
  const sessionPid = prefs?.currentPlayerIdentityId?.trim()
  const sessionAcc = prefs?.currentWechatAccountId?.trim()

  const ordered: Array<{ pid: string; role: MemoryEditorIdentityOption['role'] }> = []
  const seen = new Set<string>()

  const push = (pid: string, role: MemoryEditorIdentityOption['role']) => {
    const id = pid.trim()
    if (!id || id === '__none__' || seen.has(id)) return
    seen.add(id)
    ordered.push({ pid: id, role })
  }

  if (sessionPid && sessionPid !== '__none__') push(sessionPid, 'session')
  if (primary) push(primary, 'primary')
  for (const pid of linked) {
    if (pid === primary) continue
    push(pid, 'linked')
  }

  const options: MemoryEditorIdentityOption[] = []
  for (const { pid, role } of ordered) {
    let roleFinal = role
    if (
      role === 'session' &&
      sessionAcc &&
      primary &&
      pid === primary
    ) {
      const row = await personaDb.getPlayerIdentity(pid)
      const acc = resolvePlayerIdentityWechatAccountId(character, pid, row).trim()
      if (acc && acc !== sessionAcc) roleFinal = 'primary'
    }
    const opt = await buildOption(character, pid, roleFinal)
    if (opt) options.push(opt)
  }

  const byKey = new Map<string, MemoryEditorIdentityOption>()
  for (const o of options) {
    if (!byKey.has(o.key)) byKey.set(o.key, o)
  }
  return [...byKey.values()]
}

export function pickDefaultMemoryEditorIdentityKey(
  options: MemoryEditorIdentityOption[],
  prefs?: {
    currentWechatAccountId?: string | null
    currentPlayerIdentityId?: string | null
  },
): string | null {
  if (!options.length) return null
  const sessionPid = prefs?.currentPlayerIdentityId?.trim()
  const sessionAcc = prefs?.currentWechatAccountId?.trim()
  if (sessionPid && sessionPid !== '__none__') {
    const hit = options.find(
      (o) =>
        o.ctx.playerIdentityId === sessionPid &&
        (!sessionAcc || o.ctx.wechatAccountId === sessionAcc),
    )
    if (hit) return hit.key
    const hitPid = options.find((o) => o.ctx.playerIdentityId === sessionPid)
    if (hitPid) return hitPid.key
  }
  const primary = options.find((o) => o.role === 'primary')
  return primary?.key ?? options[0].key
}

export function bindingFromMemoryEditorIdentityOption(
  opt: MemoryEditorIdentityOption,
): import('../newFriendsPersona/types').WorldBookUserPlaceholderBinding {
  return bindingFromInsertContext(opt.ctx)
}
