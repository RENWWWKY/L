import type {
  Character,
  NetworkGraphViewRecord,
  PlayerNetworkLink,
  Relationship,
  WorldBackground,
} from './types'
import { emitWeChatStorageChanged, personaDb } from './idb'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import { uid } from './utils'
import { migrateLegacyRootPublicUrl } from '../../../../publicAssetUrl'

export const CHARACTER_BUNDLE_KIND = 'lumi-phone-character-bundle' as const
export const CHARACTER_BUNDLE_VERSION = 5 as const
/** 列表页「导出全部」：内含多个完整包（不包含长期记忆与聊天记录） */
export const CHARACTER_BUNDLES_LIST_KIND = 'lumi-phone-character-bundles' as const

export type CharacterBundleV5 = {
  kind: typeof CHARACTER_BUNDLE_KIND
  version: typeof CHARACTER_BUNDLE_VERSION
  exportedAt: number
  /** 人脉根角色 id（主角） */
  rootCharacterId: string
  mainCharacter: Character
  npcs: Character[]
  relationships: Relationship[]
  /** 主角关联的世界背景快照（预设也会写入，便于离线备份；导入时预设以目标库为准可跳过写入） */
  worldBackground: WorldBackground | null
  networkGraphViews: NetworkGraphViewRecord[]
  playerNetworkLinks: PlayerNetworkLink[]
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

/** 兼容 JSON 里 version 写成数字或字符串 */
function jsonVersionMatches(x: unknown, expected: number): boolean {
  if (x === expected) return true
  if (typeof x === 'string' && x.trim() === String(expected)) return true
  if (typeof x === 'number' && Number.isFinite(x) && Math.trunc(x) === expected) return true
  return false
}

function bundleKindMatches(kind: unknown, expected: string): boolean {
  return typeof kind === 'string' && kind.trim() === expected
}

function migrateCharacterPublicUrls(input: Character): Character {
  const out: Character = { ...input }
  if (typeof out.avatarUrl === 'string') out.avatarUrl = migrateLegacyRootPublicUrl(out.avatarUrl)
  if (typeof out.momentsCoverUrl === 'string') out.momentsCoverUrl = migrateLegacyRootPublicUrl(out.momentsCoverUrl)
  if (typeof out.chatBackground === 'string') out.chatBackground = migrateLegacyRootPublicUrl(out.chatBackground)
  return out
}

function migrateWorldBackgroundPublicUrls(input: WorldBackground): WorldBackground {
  const out: WorldBackground = { ...input }
  const map = out.map
  if (map && typeof map === 'object') {
    const imageUrl = typeof map.imageUrl === 'string' ? migrateLegacyRootPublicUrl(map.imageUrl) : map.imageUrl
    out.map = { ...map, imageUrl }
  }
  return out
}

function migrateBundlePublicUrls(bundle: CharacterBundleV5): CharacterBundleV5 {
  return {
    ...bundle,
    mainCharacter: migrateCharacterPublicUrls(bundle.mainCharacter),
    npcs: bundle.npcs.map(migrateCharacterPublicUrls),
    worldBackground: bundle.worldBackground ? migrateWorldBackgroundPublicUrls(bundle.worldBackground) : null,
  }
}

/** 分享用：去掉角色上导出的「绑定玩家身份」字段，由导入方使用当时选中的身份。 */
function stripExportedPlayerIdentityBinding(ch: Character): Character {
  const out: Character = { ...ch }
  delete out.playerIdentityId
  return out
}

async function getImportTargetPlayerIdentityId(): Promise<string | undefined> {
  const raw = (await personaDb.getCurrentIdentityId()).trim()
  return raw || undefined
}

function applyPlayerIdentityBindingForImport(ch: Character, bindingPid: string | undefined): Character {
  const out: Character = { ...ch }
  if (bindingPid) out.playerIdentityId = bindingPid
  else delete out.playerIdentityId
  return out
}

export async function buildCharacterExportBundle(data: Character): Promise<CharacterBundleV5> {
  const rootId = data.generatedForCharacterId?.trim() || data.id
  let main: Character
  if (data.generatedForCharacterId?.trim()) {
    const row = await personaDb.getCharacter(rootId)
    if (!row) throw new Error('未找到所属主角，无法导出完整人脉包')
    main = row
  } else {
    main = { ...data }
  }

  const npcsDb = await personaDb.listNpcsFor(rootId)
  const npcs = npcsDb.map((n) => (n.id === data.id ? { ...data } : { ...n }))

  const cliqueIds = [rootId, ...npcs.map((n) => n.id)]
  const cliqueSet = new Set(cliqueIds)
  const allRels = await personaDb.listAllRelationships()
  const relById = new Map<string, Relationship>()
  for (const r of allRels) {
    if (r.isPlayerIdentity) continue
    const bothIn = cliqueSet.has(r.fromCharacterId) && cliqueSet.has(r.toCharacterId)
    if (bothIn) relById.set(r.id, r)
  }
  const relationships = [...relById.values()]

  const wbId = main.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID
  const worldBackground = await personaDb.getWorldBackground(wbId)

  const [networkGraphViews, playerNetworkLinks] = await Promise.all([
    personaDb.listNetworkGraphViewsForRoot(rootId),
    personaDb.getPlayerNetworkLinks(rootId),
  ])

  return {
    kind: CHARACTER_BUNDLE_KIND,
    version: CHARACTER_BUNDLE_VERSION,
    exportedAt: Date.now(),
    rootCharacterId: rootId,
    mainCharacter: stripExportedPlayerIdentityBinding(main),
    npcs: npcs.map(stripExportedPlayerIdentityBinding),
    relationships,
    worldBackground,
    networkGraphViews,
    playerNetworkLinks,
  }
}

function parseBundleAny(raw: Record<string, unknown>): CharacterBundleV5 | null {
  if (!bundleKindMatches(raw.kind, CHARACTER_BUNDLE_KIND)) {
    return null
  }
  const isV5 = jsonVersionMatches(raw.version, CHARACTER_BUNDLE_VERSION)
  const isV4Legacy = jsonVersionMatches(raw.version, 4)
  const isV3Legacy = jsonVersionMatches(raw.version, 3)
  const isV2 = jsonVersionMatches(raw.version, 2)
  if (!isV5 && !isV4Legacy && !isV3Legacy && !isV2) return null
  const main = raw.mainCharacter
  if (!isRecord(main) || typeof main.id !== 'string') return null
  const npcs = Array.isArray(raw.npcs) ? (raw.npcs as Character[]) : []
  const rels = Array.isArray(raw.relationships) ? (raw.relationships as Relationship[]) : []
  const graphs = Array.isArray(raw.networkGraphViews) ? (raw.networkGraphViews as NetworkGraphViewRecord[]) : []
  const links = Array.isArray(raw.playerNetworkLinks) ? (raw.playerNetworkLinks as PlayerNetworkLink[]) : []
  const wbRaw = raw.worldBackground
  const worldBackground =
    wbRaw === null || wbRaw === undefined ? null : (isRecord(wbRaw) ? (wbRaw as unknown as WorldBackground) : null)
  const rootCharacterId = typeof raw.rootCharacterId === 'string' ? raw.rootCharacterId : main.id
  return {
    kind: CHARACTER_BUNDLE_KIND,
    version: CHARACTER_BUNDLE_VERSION,
    exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : Date.now(),
    rootCharacterId,
    mainCharacter: main as Character,
    npcs,
    relationships: rels,
    worldBackground,
    networkGraphViews: graphs,
    playerNetworkLinks: links,
  }
}

/**
 * 从导入 JSON 解析出若干完整包：单文件包 或 列表页导出的「全部包」数组。
 * 不再支持旧版 `character` / `characters` 扁平格式。
 */
export function parseCharacterImportFile(parsed: unknown): CharacterBundleV5[] | null {
  if (!isRecord(parsed)) return null
  if (
    bundleKindMatches(parsed.kind, CHARACTER_BUNDLES_LIST_KIND) &&
    jsonVersionMatches(parsed.version, 1) &&
    Array.isArray(parsed.bundles)
  ) {
    const out: CharacterBundleV5[] = []
    for (const item of parsed.bundles) {
      if (!isRecord(item)) return null
      const b = parseBundleAny(item)
      if (!b) return null
      out.push(b)
    }
    return out.length ? out : null
  }
  const single = parseBundleAny(parsed)
  return single ? [single] : null
}

function cloneBundleWithNewIds(
  bundle: CharacterBundleV5,
  importPlayerIdentityId: string | undefined,
): {
  main: Character
  npcs: Character[]
  relationships: Relationship[]
  graphs: NetworkGraphViewRecord[]
  links: PlayerNetworkLink[]
  worldBackground: WorldBackground | null
  newRootId: string
} {
  const oldToNew = new Map<string, string>()
  const mapId = (old: string) => {
    let n = oldToNew.get(old)
    if (!n) {
      n = uid('ch')
      oldToNew.set(old, n)
    }
    return n
  }

  const newRootId = mapId(bundle.mainCharacter.id)
  if (bundle.rootCharacterId !== bundle.mainCharacter.id) {
    oldToNew.set(bundle.rootCharacterId, newRootId)
  }

  let newWbId: string | undefined
  let worldBackground: WorldBackground | null = null
  if (bundle.worldBackground && !bundle.worldBackground.isPreset) {
    newWbId = uid('wb')
    const now = Date.now()
    worldBackground = {
      ...bundle.worldBackground,
      id: newWbId,
      createdAt: now,
      updatedAt: now,
    }
  } else {
    newWbId = bundle.mainCharacter.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID
  }

  const main: Character = applyPlayerIdentityBindingForImport(
    {
      ...bundle.mainCharacter,
      id: newRootId,
      generatedForCharacterId: undefined,
      worldBackgroundId: newWbId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    importPlayerIdentityId,
  )

  const npcs: Character[] = bundle.npcs.map((n) =>
    applyPlayerIdentityBindingForImport(
      {
        ...n,
        id: mapId(n.id),
        generatedForCharacterId: newRootId,
        worldBackgroundId: newWbId,
        createdAt: n.createdAt || Date.now(),
        updatedAt: Date.now(),
      },
      importPlayerIdentityId,
    ),
  )

  const cliqueNew = new Set([newRootId, ...npcs.map((n) => n.id)])

  const relationships: Relationship[] = bundle.relationships
    .filter((r) => !r.isPlayerIdentity)
    .map((r) => {
      const from = oldToNew.get(r.fromCharacterId)
      const to = oldToNew.get(r.toCharacterId)
      if (!from || !to) return null
      return {
        ...r,
        id: uid('rel'),
        fromCharacterId: from,
        toCharacterId: to,
      } satisfies Relationship
    })
    .filter((x): x is Relationship => !!x && cliqueNew.has(x.fromCharacterId) && cliqueNew.has(x.toCharacterId))

  const graphs: NetworkGraphViewRecord[] = bundle.networkGraphViews
    .map((g) => {
      const persp = oldToNew.get(g.perspectiveCharacterId)
      if (!persp) return null
      const positions: Record<string, { x: number; y: number }> = {}
      for (const [k, v] of Object.entries(g.positions ?? {})) {
        const nk = oldToNew.get(k) ?? k
        if (v && typeof v.x === 'number' && typeof v.y === 'number') positions[nk] = { x: v.x, y: v.y }
      }
      const row: NetworkGraphViewRecord = {
        id: `${newRootId}::${persp}`,
        rootCharacterId: newRootId,
        perspectiveCharacterId: persp,
        scale: g.scale,
        pan: g.pan,
        positions,
        updatedAt: Date.now(),
      }
      return row
    })
    .filter((x): x is NetworkGraphViewRecord => !!x)

  const links: PlayerNetworkLink[] = bundle.playerNetworkLinks
    .map((l) => {
      const cid = oldToNew.get(l.characterId)
      if (!cid) return null
      return {
        ...l,
        id: uid('pl'),
        characterId: cid,
      } satisfies PlayerNetworkLink
    })
    .filter((x): x is PlayerNetworkLink => !!x)

  return {
    main,
    npcs,
    relationships,
    graphs,
    links,
    worldBackground,
    newRootId,
  }
}

/**
 * 写入完整人脉包；返回新根 id 与模式。
 * - `new`：复制为新的人脉圈（新角色 id），与本地已有数据并存，适合重复导入同一模板做微调。
 * - `overwrite`：按包内 id 写回并清理该圈内旧关系/画布等（会覆盖同 id 角色）；仅保留作特殊恢复场景。
 */
export async function importCharacterBundle(
  bundle: CharacterBundleV5,
  mode: 'new' | 'overwrite',
): Promise<{ rootId: string; mode: 'new' | 'overwrite' }> {
  bundle = migrateBundlePublicUrls(bundle)
  const cliqueOld = new Set([bundle.rootCharacterId, ...bundle.npcs.map((n) => n.id)])
  const importPlayerIdentityId = await getImportTargetPlayerIdentityId()
  if (!importPlayerIdentityId) {
    throw new Error(
      '请先在「我的身份」中创建身份，并确保已设为当前使用（新建角色人设时在弹窗里选择身份也会写入当前身份）。未设置当前玩家身份时不能导入人设包，以免无法正确绑定。',
    )
  }

  if (mode === 'new') {
    const cloned = cloneBundleWithNewIds(bundle, importPlayerIdentityId)
    if (cloned.worldBackground) {
      await personaDb.upsertWorldBackground(cloned.worldBackground)
    }
    await personaDb.upsertCharacter(cloned.main)
    for (const n of cloned.npcs) await personaDb.upsertCharacter(n)
    await personaDb.bulkPutRelationships(cloned.relationships)
    for (const g of cloned.graphs) await personaDb.putNetworkGraphView(g)
    await personaDb.putPlayerNetworkLinks(cloned.newRootId, cloned.links)
    emitWeChatStorageChanged()
    return { rootId: cloned.newRootId, mode: 'new' }
  }

  // overwrite：先清掉该人脉圈内的关系、身份绑定边与画布，再整体写回
  await personaDb.deleteIntraCliqueRelationships([...cliqueOld])
  await personaDb.deletePlayerIdentityRelationshipsTouchingCharacterIds([...cliqueOld])
  await personaDb.deleteNetworkGraphViewsForRoot(bundle.rootCharacterId)

  if (bundle.worldBackground && !bundle.worldBackground.isPreset) {
    await personaDb.upsertWorldBackground(bundle.worldBackground)
  }

  await personaDb.upsertCharacter(applyPlayerIdentityBindingForImport(bundle.mainCharacter, importPlayerIdentityId))
  for (const n of bundle.npcs) {
    await personaDb.upsertCharacter(applyPlayerIdentityBindingForImport(n, importPlayerIdentityId))
  }
  await personaDb.bulkPutRelationships(bundle.relationships.filter((r) => !r.isPlayerIdentity))
  for (const g of bundle.networkGraphViews) await personaDb.putNetworkGraphView(g)
  await personaDb.putPlayerNetworkLinks(bundle.rootCharacterId, bundle.playerNetworkLinks)
  await personaDb.replaceWeChatChatMessagesByCharacterIds([...cliqueOld], [])

  emitWeChatStorageChanged()
  return { rootId: bundle.rootCharacterId, mode: 'overwrite' }
}
