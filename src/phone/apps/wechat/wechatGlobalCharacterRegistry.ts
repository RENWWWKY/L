import { saveAccountsBundle } from './wechatAccountPersistence'
import { personaDb } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'
import type { WechatAccountsBundle } from './wechatAccountTypes'

export const WECHAT_GLOBAL_CHARACTER_REGISTRY_KV = 'wechat-global-character-registry-v1'

/** 老数据兼容迁移完成标记（可重复执行，后续步骤均幂等） */
export const WECHAT_GLOBAL_CHARACTER_COMPAT_MIGRATION_KEY = 'wechat-global-character-compat-v2'

export type GlobalWechatCharacterRegistryRow = {
  canonicalCharacterId: string
  ownerWechatAccountId?: string
  registeredAt: number
}

export type GlobalWechatCharacterRegistry = {
  byWechatId: Record<string, GlobalWechatCharacterRegistryRow>
  /** 重复人设 id / 历史副本 id → 全局 canonical */
  aliasToCanonical: Record<string, string>
}

const EMPTY_REGISTRY: GlobalWechatCharacterRegistry = {
  byWechatId: {},
  aliasToCanonical: {},
}

export function normalizeRegistryWechatId(wechatId: string): string {
  return wechatId.trim().toLowerCase()
}

function normalizeRegistry(raw: unknown): GlobalWechatCharacterRegistry {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_REGISTRY, aliasToCanonical: {}, byWechatId: {} }
  const o = raw as Record<string, unknown>
  const byWechatId: Record<string, GlobalWechatCharacterRegistryRow> = {}
  if (o.byWechatId && typeof o.byWechatId === 'object') {
    for (const [k, v] of Object.entries(o.byWechatId as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue
      const row = v as Record<string, unknown>
      const canonicalCharacterId =
        typeof row.canonicalCharacterId === 'string' ? row.canonicalCharacterId.trim() : ''
      if (!canonicalCharacterId) continue
      byWechatId[k.trim().toLowerCase()] = {
        canonicalCharacterId,
        ownerWechatAccountId:
          typeof row.ownerWechatAccountId === 'string' ? row.ownerWechatAccountId.trim() : undefined,
        registeredAt: typeof row.registeredAt === 'number' && Number.isFinite(row.registeredAt) ? row.registeredAt : Date.now(),
      }
    }
  }
  const aliasToCanonical: Record<string, string> = {}
  if (o.aliasToCanonical && typeof o.aliasToCanonical === 'object') {
    for (const [from, to] of Object.entries(o.aliasToCanonical as Record<string, unknown>)) {
      const f = from.trim()
      const t = typeof to === 'string' ? to.trim() : ''
      if (f && t && f !== t) aliasToCanonical[f] = t
    }
  }
  return { byWechatId, aliasToCanonical }
}

export async function loadGlobalWechatCharacterRegistry(): Promise<GlobalWechatCharacterRegistry> {
  const raw = await personaDb.getPhoneKv(WECHAT_GLOBAL_CHARACTER_REGISTRY_KV)
  return normalizeRegistry(raw)
}

export async function saveGlobalWechatCharacterRegistry(reg: GlobalWechatCharacterRegistry): Promise<void> {
  await personaDb.setPhoneKv(WECHAT_GLOBAL_CHARACTER_REGISTRY_KV, reg)
}

/** 从 IndexedDB 全量人设重建注册表（启动迁移） */
export async function rebuildGlobalWechatCharacterRegistryFromCharacters(): Promise<void> {
  const all = await personaDb.listCharacters()
  const reg = await loadGlobalWechatCharacterRegistry()
  const next: GlobalWechatCharacterRegistry = {
    byWechatId: { ...reg.byWechatId },
    aliasToCanonical: { ...reg.aliasToCanonical },
  }

  const byWx = new Map<string, Character[]>()
  for (const ch of all) {
    const wx = normalizeRegistryWechatId(ch.wechatId || '')
    if (!wx) continue
    const list = byWx.get(wx) ?? []
    list.push(ch)
    byWx.set(wx, list)
  }

  for (const [wx, rows] of byWx) {
    const sorted = [...rows].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    const canonical = sorted[0]!
    const existing = next.byWechatId[wx]
    if (!existing) {
      next.byWechatId[wx] = {
        canonicalCharacterId: canonical.id,
        ownerWechatAccountId: canonical.wechatAccountId?.trim(),
        registeredAt: Date.now(),
      }
    }
    const canonicalId = next.byWechatId[wx]!.canonicalCharacterId
    for (const row of sorted) {
      if (row.id !== canonicalId) next.aliasToCanonical[row.id] = canonicalId
    }
  }

  await saveGlobalWechatCharacterRegistry(next)
}

export async function resolveCanonicalCharacterIdByWechatId(wechatId: string): Promise<string | null> {
  const norm = normalizeRegistryWechatId(wechatId)
  if (!norm) return null
  const reg = await loadGlobalWechatCharacterRegistry()
  return reg.byWechatId[norm]?.canonicalCharacterId?.trim() || null
}

/**
 * 将角色 id 解析为全局 canonical id（别名表 + 注册表 + 行内 wechatId）。
 */
export async function resolveCanonicalCharacterId(characterId: string): Promise<string> {
  const id = characterId.trim()
  if (!id) return id

  const reg = await loadGlobalWechatCharacterRegistry()
  const aliased = reg.aliasToCanonical[id]?.trim()
  if (aliased) return aliased

  const row = await personaDb.getCharacterWithoutCanonicalRedirect(id)
  if (!row) return id

  const wx = normalizeRegistryWechatId(row.wechatId || '')
  if (!wx) return row.id

  const mapped = reg.byWechatId[wx]?.canonicalCharacterId?.trim()
  return mapped || row.id
}

export type RegisterGlobalWechatCharacterResult = {
  canonicalCharacterId: string
  mergedAlias: boolean
}

/** 注册微信号 → 全局唯一人设；若已存在则把 characterId 记为别名并返回既有 canonical。 */
export async function registerGlobalWechatCharacter(
  wechatId: string,
  characterId: string,
  ownerWechatAccountId?: string,
): Promise<RegisterGlobalWechatCharacterResult> {
  const norm = normalizeRegistryWechatId(wechatId)
  const cid = characterId.trim()
  if (!norm || !cid) return { canonicalCharacterId: cid, mergedAlias: false }

  const reg = await loadGlobalWechatCharacterRegistry()
  const existing = reg.byWechatId[norm]

  if (existing?.canonicalCharacterId) {
    const canonical = existing.canonicalCharacterId
    if (canonical !== cid) {
      reg.aliasToCanonical[cid] = canonical
      await saveGlobalWechatCharacterRegistry(reg)
      return { canonicalCharacterId: canonical, mergedAlias: true }
    }
    await saveGlobalWechatCharacterRegistry(reg)
    return { canonicalCharacterId: canonical, mergedAlias: false }
  }

  reg.byWechatId[norm] = {
    canonicalCharacterId: cid,
    ownerWechatAccountId: ownerWechatAccountId?.trim() || undefined,
    registeredAt: Date.now(),
  }
  await saveGlobalWechatCharacterRegistry(reg)
  return { canonicalCharacterId: cid, mergedAlias: false }
}

export async function unregisterGlobalWechatCharacterForCharacterId(characterId: string): Promise<void> {
  const cid = characterId.trim()
  if (!cid) return
  const reg = await loadGlobalWechatCharacterRegistry()
  let changed = false

  for (const [wx, row] of Object.entries(reg.byWechatId)) {
    if (row.canonicalCharacterId === cid) {
      delete reg.byWechatId[wx]
      changed = true
    }
  }
  for (const [from, to] of Object.entries(reg.aliasToCanonical)) {
    if (from === cid || to === cid) {
      delete reg.aliasToCanonical[from]
      changed = true
    }
  }
  if (changed) await saveGlobalWechatCharacterRegistry(reg)
}

/** 其它马甲通讯录仍引用该 canonical 时，注销本账号不得删除此人设/记忆。 */
export function collectCanonicalIdsPreservedAcrossAccounts(
  bundle: WechatAccountsBundle,
  deletingAccountId: string,
): Set<string> {
  const del = deletingAccountId.trim()
  const out = new Set<string>()
  for (const acc of bundle.accounts) {
    if (acc.accountId === del) continue
    for (const c of acc.personaContacts) {
      const id = c.characterId.trim()
      if (id) out.add(id)
    }
  }
  return out
}

export async function expandCanonicalIdSet(ids: Iterable<string>): Promise<Set<string>> {
  const out = new Set<string>()
  for (const raw of ids) {
    const canon = await resolveCanonicalCharacterId(raw)
    if (canon) out.add(canon)
  }
  return out
}

function remapCharacterIdMap(
  map: Record<string, number> | undefined,
  aliasToCanonical: Record<string, string>,
): Record<string, number> | undefined {
  if (!map) return map
  const next: Record<string, number> = {}
  for (const [k, v] of Object.entries(map)) {
    const canon = aliasToCanonical[k.trim()]?.trim() || k.trim()
    if (!canon) continue
    next[canon] = v
  }
  return next
}

/** 记忆游标等按 characterId 索引的设置项：别名 id → canonical */
async function migrateMemorySettingsCharacterIdKeys(
  aliasToCanonical: Record<string, string>,
): Promise<void> {
  if (!Object.keys(aliasToCanonical).length) return
  const settings = await personaDb.getMemorySettings()
  const dating = remapCharacterIdMap(settings.datingPlotSummaryCursorByCharacterId, aliasToCanonical)
  const meet = remapCharacterIdMap(settings.meetSummaryCursorTimestampByCharacterId, aliasToCanonical)
  const patch: Record<string, unknown> = {}
  if (dating !== settings.datingPlotSummaryCursorByCharacterId) {
    patch.datingPlotSummaryCursorByCharacterId = dating
  }
  if (meet !== settings.meetSummaryCursorTimestampByCharacterId) {
    patch.meetSummaryCursorTimestampByCharacterId = meet
  }
  if (Object.keys(patch).length) {
    await personaDb.putMemorySettings(patch, { emit: false })
  }
}

/** 各马甲通讯录中的 characterId 统一为 canonical（老版导入副本 id 仍可解析） */
export async function rewriteBundleContactsToCanonicalIds(
  bundle: WechatAccountsBundle,
): Promise<WechatAccountsBundle> {
  const accounts = await Promise.all(
    bundle.accounts.map(async (acc) => {
      const personaContacts = await Promise.all(
        acc.personaContacts.map(async (c) => {
          const canon = await resolveCanonicalCharacterId(c.characterId)
          return canon === c.characterId ? c : { ...c, characterId: canon }
        }),
      )
      return { ...acc, personaContacts }
    }),
  )
  return { accounts, currentAccountId: bundle.currentAccountId }
}

/**
 * 老版本已导入角色 / 旧版人设包兼容：
 * - 重建全局微信号注册表（同号多人设副本 → 别名指向 canonical）
 * - 长期记忆迁到 canonical（跨马甲共享）
 * - 通讯录 characterId 改写为 canonical（跨号搜索、小号试探）
 * - 无 wechatAccountId 的人设按通讯录归属补标
 *
 * 注意：角色须填写微信号才能进入全局注册表；无微信号的旧人设仍仅在本账号可见。
 */
export async function runLegacyGlobalCharacterCompatibilityMigration(
  bundle: WechatAccountsBundle | null,
): Promise<WechatAccountsBundle | null> {
  if (bundle?.accounts.length) {
    await personaDb.attachOrphanCharactersByContactOwnership(bundle)
  }

  await rebuildGlobalWechatCharacterRegistryFromCharacters()
  const reg = await loadGlobalWechatCharacterRegistry()

  await personaDb.migrateCharacterMemoriesAliasToCanonical(reg.aliasToCanonical)
  await migrateMemorySettingsCharacterIdKeys(reg.aliasToCanonical)

  let nextBundle = bundle
  if (bundle) {
    nextBundle = await rewriteBundleContactsToCanonicalIds(bundle)
    await saveAccountsBundle(nextBundle)
    await migrateImportedBundleArchivesToCanonical(nextBundle)
  }

  const prev = await personaDb.getPhoneKv(WECHAT_GLOBAL_CHARACTER_COMPAT_MIGRATION_KEY)
  if (prev == null) {
    await personaDb.setPhoneKv(WECHAT_GLOBAL_CHARACTER_COMPAT_MIGRATION_KEY, Date.now())
  }

  return nextBundle
}

/** 后台导入存档里的 rootCharacterId 同步为 canonical（旧版重复导入副本） */
async function migrateImportedBundleArchivesToCanonical(bundle: WechatAccountsBundle): Promise<void> {
  const { importedBundleArchivesKvKey } = await import('./newFriendsPersona/characterBundleIo')
  for (const acc of bundle.accounts) {
    const aid = acc.accountId.trim()
    if (!aid) continue
    const raw = await personaDb.getPhoneKv(importedBundleArchivesKvKey(aid))
    if (!Array.isArray(raw) || !raw.length) continue
    let changed = false
    const next = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const root = typeof o.rootCharacterId === 'string' ? o.rootCharacterId.trim() : ''
      if (!root) continue
      const canon = await resolveCanonicalCharacterId(root)
      if (canon !== root) changed = true
      next.push({ ...o, rootCharacterId: canon })
    }
    if (changed) await personaDb.setPhoneKv(importedBundleArchivesKvKey(aid), next)
  }
}
