import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'

/**
 * 存档主角在「管理关系 / 人脉」中通过角色↔角色边绑定的其它主角（非 `generatedForCharacterId` 人脉子角色）。
 * 与 {@link personaDb.listNpcsFor} 互补，供关联记忆 linked 落库与模型 id 表共用。
 */
export async function listRelationshipBoundProtagonistPeers(archiveOwnerId: string): Promise<Character[]> {
  const owner = archiveOwnerId.trim()
  if (!owner) return []

  let rels: Awaited<ReturnType<typeof personaDb.listAllRelationships>> = []
  try {
    rels = await personaDb.listAllRelationships()
  } catch {
    return []
  }

  const peerIds = new Set<string>()
  for (const r of rels) {
    if (r.isPlayerIdentity) continue
    if (r.fromCharacterId === owner) peerIds.add(r.toCharacterId.trim())
    else if (r.toCharacterId === owner) peerIds.add(r.fromCharacterId.trim())
  }

  const out: Character[] = []
  for (const id of peerIds) {
    if (!id || id === owner) continue
    let ch: Character | null = null
    try {
      ch = await personaDb.getCharacter(id)
    } catch {
      ch = null
    }
    if (!ch) continue
    if (ch.generatedForCharacterId?.trim() === owner) continue
    out.push(ch)
  }
  return out
}

export function characterDisplayNameForIdMap(ch: Character | null, id: string): string {
  return String(ch?.name ?? ch?.wechatNickname ?? '').trim() || id.slice(0, 8)
}

/** 存档主角 + 人脉子角色 + 已绑定跨档案主角 → `{{id:…}}` 展开表（与入库 sanitize 一致） */
export async function buildLinkedMemoryIdDisplayNameMap(
  archiveOwnerId: string,
  seed?: Readonly<Record<string, string>>,
): Promise<Record<string, string>> {
  const owner = archiveOwnerId.trim()
  const map: Record<string, string> = { ...(seed ?? {}) }
  if (!owner) return map

  let main: Character | null = null
  try {
    main = await personaDb.getCharacter(owner)
  } catch {
    main = null
  }
  map[owner] = characterDisplayNameForIdMap(main, owner)

  try {
    const { all } = await listAllLinkedMemoryEligibleCharacters(owner)
    for (const n of all) {
      const nid = n.id.trim()
      if (!nid) continue
      map[nid] = characterDisplayNameForIdMap(n, nid)
    }
  } catch {
    /* keep seed */
  }
  return map
}

const ID_PLACEHOLDER_RE = /\{\{id:([^}]+)\}\}/g

export function collectIdPlaceholderCharacterIds(texts: Iterable<string>): string[] {
  const ids = new Set<string>()
  for (const t of texts) {
    const s = String(t ?? '')
    if (!s.includes('{{id:')) continue
    for (const m of s.matchAll(ID_PLACEHOLDER_RE)) {
      const id = m[1]?.trim()
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

/** 正文中出现但未在档案人脉表里的 `{{id:…}}`（如跨角色绑定主角）按人设 id 兜底查库 */
export async function resolveMissingIdPlaceholderDisplayNames(
  idMap: Readonly<Record<string, string>>,
  texts: Iterable<string>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...idMap }
  for (const id of collectIdPlaceholderCharacterIds(texts)) {
    if (String(out[id] ?? '').trim()) continue
    try {
      const ch = await personaDb.getCharacter(id)
      out[id] = characterDisplayNameForIdMap(ch, id)
    } catch {
      out[id] = id.slice(0, 8)
    }
  }
  return out
}

export async function listAllLinkedMemoryEligibleCharacters(archiveOwnerId: string): Promise<{
  npcs: Character[]
  boundProtagonists: Character[]
  all: Character[]
  allIds: Set<string>
}> {
  const owner = archiveOwnerId.trim()
  const npcs = (await personaDb.listNpcsFor(owner)) as Character[]
  const boundProtagonists = await listRelationshipBoundProtagonistPeers(owner)
  const seen = new Set<string>()
  const all: Character[] = []
  for (const row of [...npcs, ...boundProtagonists]) {
    const id = row.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    all.push(row)
  }
  return { npcs, boundProtagonists, all, allIds: seen }
}

/** 约会合并记忆附录：可写入 linked 的角色 id 表（人脉子角色 + 已绑定主角） */
export async function buildEligibleLinkedMemoryRosterForDatingAppendix(
  plotsArchiveId: string,
  datingPeerCharacterId: string,
): Promise<string> {
  const peer = datingPeerCharacterId.trim()
  const owner = plotsArchiveId.trim()
  if (!owner) return '（当前无可关联角色，linked 一般为 []）'

  let mainLabel = owner.slice(0, 8)
  try {
    const mainRow = await personaDb.getCharacter(owner)
    mainLabel = (mainRow?.name || mainRow?.wechatNickname || '').trim() || mainLabel
  } catch {
    /* keep slice */
  }

  const header = `- \`${owner}\`：${mainLabel}（线下存档主角；正文用 {{archive_char}}，**勿**将此 id 填入 linked.character_id）`

  try {
    const { npcs, boundProtagonists } = await listAllLinkedMemoryEligibleCharacters(owner)
    const npcLines = npcs
      .filter((n) => String(n.id || '').trim() && String(n.id).trim() !== peer)
      .map((n) => {
        const nm = (n.name || n.wechatNickname || '').trim() || '未命名'
        return `- \`${String(n.id).trim()}\`：${nm}（人脉子角色）`
      })
    const protagLines = boundProtagonists
      .filter((n) => String(n.id || '').trim() && String(n.id).trim() !== peer)
      .map((n) => {
        const nm = (n.name || n.wechatNickname || '').trim() || '未命名'
        return `- \`${String(n.id).trim()}\`：${nm}（已绑定主角）`
      })

    const sections: string[] = [header]
    if (npcLines.length) {
      sections.push('【人脉子角色】', npcLines.join('\n'))
    }
    if (protagLines.length) {
      sections.push('【已绑定主角】', protagLines.join('\n'))
    }
    if (!npcLines.length && !protagLines.length) {
      sections.push('（当前无人脉子角色且未绑定其它主角；linked 可为 []）')
    }
    return sections.join('\n')
  } catch {
    return `${header}\n（可关联角色列表读取失败；若无把握请 linked=[]）`
  }
}
