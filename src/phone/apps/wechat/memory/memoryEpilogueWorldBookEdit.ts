import {
  resolveWorldBookUserBinding,
  resolveWorldBookUserInsertContext,
  type WorldBookUserInsertContext,
} from '../charUserPlaceholders'
import { emitWeChatStorageChanged, personaDb } from '../newFriendsPersona/idb'
import type { Character, WorldBookItem } from '../newFriendsPersona/types'
import { loadAccountsBundle, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'

export type EpilogueLoreEditorSupport = {
  networkPeersForInsert: Array<{ id: string; label: string; role: 'archive_root' | 'network_npc' }>
  worldBookUserInsertContext: WorldBookUserInsertContext | null
}

function patchCharacterWorldBookItem(
  character: Character,
  worldBookId: string,
  itemId: string,
  patch: Partial<WorldBookItem>,
): Character | null {
  let changed = false
  const worldBooks = (character.worldBooks ?? []).map((wb) => {
    if (wb.id !== worldBookId) return wb
    const items = (wb.items ?? []).map((it) => {
      if (it.id !== itemId) return it
      const merged: WorldBookItem = { ...it, ...patch, updatedAt: Date.now() }
      if (patch.content !== undefined && String(patch.content) !== String(it.content ?? '')) {
        merged.contentPrevious = String(it.content ?? '')
      }
      const same =
        String(merged.name ?? '') === String(it.name ?? '') &&
        String(merged.content ?? '') === String(it.content ?? '') &&
        String(merged.keywords ?? '') === String(it.keywords ?? '') &&
        merged.priority === it.priority &&
        merged.enabled === it.enabled &&
        JSON.stringify(merged.userPlaceholderBindings ?? null) ===
          JSON.stringify(it.userPlaceholderBindings ?? null) &&
        String(merged.contentPrevious ?? '') === String(it.contentPrevious ?? '')
      if (same) return it
      changed = true
      return merged
    })
    return { ...wb, items }
  })
  if (!changed) return null
  return { ...character, worldBooks, updatedAt: Date.now() }
}

export function applyEpilogueWorldBookItemPatch(
  character: Character,
  worldBookId: string,
  itemId: string,
  patch: Partial<WorldBookItem>,
): Character {
  return patchCharacterWorldBookItem(character, worldBookId, itemId, patch) ?? character
}

export function applyEpilogueWorldBookItemDelete(
  character: Character,
  worldBookId: string,
  itemId: string,
): Character | null {
  let changed = false
  const worldBooks = (character.worldBooks ?? []).map((wb) => {
    if (wb.id !== worldBookId) return wb
    const before = wb.items ?? []
    const items = before.filter((it) => it.id !== itemId)
    if (items.length === before.length) return wb
    changed = true
    return { ...wb, items }
  })
  if (!changed) return null
  return { ...character, worldBooks, updatedAt: Date.now() }
}

export async function persistEpilogueCharacter(character: Character): Promise<void> {
  await personaDb.upsertCharacter(character)
  emitWeChatStorageChanged()
}

export async function deleteEpilogueWorldBookItem(params: {
  characterId: string
  worldBookId: string
  itemId: string
}): Promise<boolean> {
  const cid = params.characterId.trim()
  if (!cid) return false
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return false
  const next = applyEpilogueWorldBookItemDelete(ch, params.worldBookId, params.itemId)
  if (!next) return false
  await persistEpilogueCharacter(next)
  return true
}

export async function resolveEpilogueLoreEditorSupport(
  character: Character,
  currentWechatAccountId?: string | null,
): Promise<EpilogueLoreEditorSupport> {
  const acc = currentWechatAccountId?.trim() || ''
  let sessionPid = ''
  if (acc) {
    const bundle = await loadAccountsBundle()
    const row = bundle?.accounts.find((a) => a.accountId === acc)
    if (row) sessionPid = resolveAccountSessionIdentityId(row)
  }
  const wbBinding = await resolveWorldBookUserBinding(character)
  const worldBookUserInsertContext = await resolveWorldBookUserInsertContext({
    wechatAccountId: acc || undefined,
    character,
    playerIdentityId:
      wbBinding?.playerIdentityId || character.playerIdentityId || sessionPid || undefined,
  })

  const rootId = (character.generatedForCharacterId?.trim() || character.id || '').trim()
  if (!rootId) {
    return { networkPeersForInsert: [], worldBookUserInsertContext }
  }

  try {
    const mainCh = await personaDb.getCharacter(rootId)
    const npcs = await personaDb.listNpcsFor(rootId)
    const isNpc = !!character.generatedForCharacterId?.trim()
    const rootLabel = String(mainCh?.name ?? mainCh?.wechatNickname ?? '').trim() || '档案主角'
    const others = npcs
      .filter((n) => n.id !== character.id)
      .map((n) => ({
        id: n.id,
        label: String(n.name ?? n.wechatNickname ?? '').trim() || n.id.slice(0, 8),
        role: 'network_npc' as const,
      }))
    const networkPeersForInsert = isNpc
      ? [{ id: rootId, label: rootLabel, role: 'archive_root' as const }, ...others]
      : others
    return { networkPeersForInsert, worldBookUserInsertContext }
  } catch {
    return { networkPeersForInsert: [], worldBookUserInsertContext }
  }
}
