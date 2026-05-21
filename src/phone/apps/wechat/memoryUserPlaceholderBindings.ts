import { personaDb } from './newFriendsPersona/idb'
import type { CharacterMemory, WorldBookUserPlaceholderBinding } from './newFriendsPersona/types'
import {
  bindingFromInsertContext,
  countWorldBookUserPlaceholderSlots,
  normalizeWorldBookItemUserPlaceholders,
} from './worldBookUserPlaceholderBindings'
import {
  resolveWorldBookUserInsertContext,
  type WorldBookUserInsertContext,
} from './charUserPlaceholders'
import { normalizeMemorySummaryBodyAfterModel } from './memory/memorySummaryContentNormalize'

/** 由总结来源线（微信账号 + 扮演身份）解析为与世界书插入一致的绑定上下文。 */
export async function resolveMemoryUserInsertContextFromSource(
  sourceWechatAccountId?: string | null,
  sourceSessionPlayerIdentityId?: string | null,
): Promise<WorldBookUserInsertContext | null> {
  const acc = sourceWechatAccountId?.trim()
  const pid = sourceSessionPlayerIdentityId?.trim()
  if (!acc) return null
  return resolveWorldBookUserInsertContext({
    wechatAccountId: acc,
    playerIdentityId: pid || undefined,
  })
}

/** 总结入库：正文中每个 `{{user}}` 绑定到同一条来源线（该段对话的账号·身份）。 */
export function buildMemoryUserPlaceholderBindingsForContent(
  content: string,
  ctx: WorldBookUserInsertContext | null,
): WorldBookUserPlaceholderBinding[] {
  if (!ctx) return []
  const n = countWorldBookUserPlaceholderSlots(content)
  if (!n) return []
  return Array.from({ length: n }, () => bindingFromInsertContext(ctx))
}

export type SanitizedMemoryBody = {
  content: string
  userPlaceholderBindings: WorldBookUserPlaceholderBinding[]
}

/** 手动保存记忆：按来源线合并 `{{user}}` 槽位绑定（不覆盖已有绑定）。 */
export async function reconcileMemoryUserPlaceholdersOnSave(
  params: Pick<
    CharacterMemory,
    'content' | 'userPlaceholderBindings' | 'sourceWechatAccountId' | 'sourceSessionPlayerIdentityId'
  >,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<SanitizedMemoryBody> {
  const content = String(params.content ?? '')
  const existing = params.userPlaceholderBindings ?? []
  if (!content.includes('{{user')) {
    return { content, userPlaceholderBindings: existing }
  }
  const fallback =
    opts?.fallback ??
    (await resolveMemoryUserInsertContextFromSource(
      params.sourceWechatAccountId,
      params.sourceSessionPlayerIdentityId,
    ))
  return attachMemoryUserPlaceholderBindings({ content, userPlaceholderBindings: existing }, fallback)
}

export function attachMemoryUserPlaceholderBindings(
  sanitized: SanitizedMemoryBody,
  bindCtx: WorldBookUserInsertContext | null,
): SanitizedMemoryBody {
  const content = sanitized.content
  if (!bindCtx || !content.includes('{{user')) {
    return { content, userPlaceholderBindings: sanitized.userPlaceholderBindings ?? [] }
  }
  const sync = normalizeWorldBookItemUserPlaceholders(
    content,
    sanitized.userPlaceholderBindings,
    bindCtx,
  )
  return { content: sync.content, userPlaceholderBindings: sync.bindings }
}

export function memoryNeedsUserPlaceholderAlignment(m: CharacterMemory): boolean {
  const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
  if (!slots) return false
  const bound = (m.userPlaceholderBindings ?? []).filter(
    (b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim(),
  ).length
  if (bound < slots) return true
  return normalizeWorldBookItemUserPlaceholders(m.content ?? '', m.userPlaceholderBindings, null).changed
}

/** 单条记忆：按 source* 或已有绑定对齐 `{{user}}` 槽位。 */
export async function alignCharacterMemoryUserPlaceholders(
  memory: CharacterMemory,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<CharacterMemory> {
  const fallback =
    opts?.fallback ??
    (await resolveMemoryUserInsertContextFromSource(
      memory.sourceWechatAccountId,
      memory.sourceSessionPlayerIdentityId,
    ))
  const sync = normalizeWorldBookItemUserPlaceholders(
    memory.content ?? '',
    memory.userPlaceholderBindings,
    fallback,
  )
  const content = normalizeMemorySummaryBodyAfterModel(sync.content)
  const firstPersonFixed = content !== (memory.content ?? '').trim()
  if (!sync.changed && !memoryNeedsUserPlaceholderAlignment(memory) && !firstPersonFixed) return memory
  return {
    ...memory,
    content,
    userPlaceholderBindings: sync.bindings,
    updatedAt: Date.now(),
  }
}

/** 某角色（及群记忆桶）下全部记忆条目对齐；返回写回条数。 */
export async function alignCharacterMemoriesUserPlaceholders(
  characterId: string,
): Promise<number> {
  const cid = characterId.trim()
  if (!cid) return 0
  const list = await personaDb.listCharacterMemoriesForCharacter(cid)
  let written = 0
  for (const m of list) {
    if (!memoryNeedsUserPlaceholderAlignment(m)) continue
    const next = await alignCharacterMemoryUserPlaceholders(m)
    if (next === m) continue
    await personaDb.upsertCharacterMemory(next)
    written += 1
  }
  return written
}

/** 全库记忆 `{{user}}` 槽位统计（供记忆档案馆「对齐」按钮） */
export function summarizeMemoryUserPlaceholders(memories: CharacterMemory[]): {
  slotCount: number
  boundCount: number
  memoryCount: number
  needsAlign: boolean
} {
  let slotCount = 0
  let boundCount = 0
  let memoryCount = 0
  for (const m of memories) {
    const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
    if (!slots) continue
    memoryCount += 1
    slotCount += slots
    boundCount += (m.userPlaceholderBindings ?? []).filter(
      (b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim(),
    ).length
  }
  return {
    slotCount,
    boundCount,
    memoryCount,
    needsAlign: memories.some((m) => memoryNeedsUserPlaceholderAlignment(m)),
  }
}

export type AlignAllMemoryUserPlaceholdersResult = {
  written: number
  after: ReturnType<typeof summarizeMemoryUserPlaceholders>
}

/**
 * 对齐全库记忆 `{{user}}`。
 * 1. 先按各条 `source*` 补绑 / 迁旧式表达式（与进微信自动对齐相同）；
 * 2. 若传入 `fillUnboundWith`，仅对仍空槽位绑到当前登录账号·扮演身份（已有绑定不改）。
 */
export async function alignAllStoredMemoryUserPlaceholders(opts?: {
  fillUnboundWith?: WorldBookUserInsertContext | null
}): Promise<AlignAllMemoryUserPlaceholdersResult> {
  const all = await personaDb.listAllCharacterMemories()
  let written = 0
  for (const m of all) {
    const slots = countWorldBookUserPlaceholderSlots(m.content ?? '')
    if (!slots) continue

    let cur = m
    if (memoryNeedsUserPlaceholderAlignment(cur)) {
      const next = await alignCharacterMemoryUserPlaceholders(cur)
      if (next !== cur) {
        await personaDb.upsertCharacterMemory(next)
        written += 1
        cur = next
      }
    }

    const fill = opts?.fillUnboundWith
    if (fill) {
      const bound = (cur.userPlaceholderBindings ?? []).filter(
        (b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim(),
      ).length
      if (bound < slots) {
        const next2 = await alignCharacterMemoryUserPlaceholders(cur, { fallback: fill })
        if (next2 !== cur) {
          await personaDb.upsertCharacterMemory(next2)
          written += 1
          cur = next2
        }
      }
    }
  }

  const fresh = await personaDb.listAllCharacterMemories()
  return { written, after: summarizeMemoryUserPlaceholders(fresh) }
}
