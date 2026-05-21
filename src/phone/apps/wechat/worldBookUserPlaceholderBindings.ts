import { personaDb } from './newFriendsPersona/idb'
import type {
  Character,
  WorldBookItem,
  WorldBookUserPlaceholderBinding,
} from './newFriendsPersona/types'
import { formatPlayerIdentityDisplayName } from './wechatCharacterPlayerIdentity'
import { loadAccountsBundle } from './wechatAccountPersistence'
import {
  SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE,
  type WorldBookUserInsertContext,
  contentHasScopedWorldBookUserPlaceholder,
  expandScopedWorldBookUserPlaceholdersInText,
} from './charUserPlaceholders'
import { formatPlayerLineScopeLabel } from './wechatMemoryLineScope'

/** 仅匹配正文里的 `{{user}}`，不含 `{{user:…}}` / `{{id:…}}`。 */
export const PLAIN_WORLD_BOOK_USER_PLACEHOLDER_RE = /\{\{user\}\}/g

/** 正文内 `{{user}}` 与旧式 `{{user:账号:身份}}` 按从左到右顺序扫描。 */
const WORLD_BOOK_USER_TOKEN_RE = /\{\{user(?::([^:}]+):([^}]+))?\}\}/g

export function countPlainWorldBookUserPlaceholders(content: string): number {
  const re = new RegExp(PLAIN_WORLD_BOOK_USER_PLACEHOLDER_RE.source, 'g')
  return (String(content ?? '').match(re) ?? []).length
}

export function countPlainWorldBookUserPlaceholdersBefore(content: string, index: number): number {
  const head = String(content ?? '').slice(0, Math.max(0, index))
  const re = new RegExp(PLAIN_WORLD_BOOK_USER_PLACEHOLDER_RE.source, 'g')
  return (head.match(re) ?? []).length
}

/** 正文内 `{{user}}` 与旧式 `{{user:…}}` 合计槽位数（与绑定表下标一一对应）。 */
export function countWorldBookUserPlaceholderSlots(content: string): number {
  const re = new RegExp(WORLD_BOOK_USER_TOKEN_RE.source, 'g')
  return (String(content ?? '').match(re) ?? []).length
}

export function countWorldBookUserPlaceholderSlotsBefore(content: string, index: number): number {
  const head = String(content ?? '').slice(0, Math.max(0, index))
  const re = new RegExp(WORLD_BOOK_USER_TOKEN_RE.source, 'g')
  return (head.match(re) ?? []).length
}

export function bindingFromInsertContext(ctx: WorldBookUserInsertContext): WorldBookUserPlaceholderBinding {
  return {
    wechatAccountId: ctx.wechatAccountId.trim(),
    playerIdentityId: ctx.playerIdentityId.trim(),
    lineLabel: ctx.lineLabel.trim(),
    displayName: ctx.displayName.trim(),
  }
}

/**
 * 正文里所有 user 槽位（裸 `{{user}}` + 旧式 `{{user:…}}`）与绑定表对齐；
 * 旧式占位符会写入绑定并改为裸 `{{user}}`。
 */
export function normalizeWorldBookItemUserPlaceholders(
  content: string,
  bindings: WorldBookUserPlaceholderBinding[] | null | undefined,
  fallback?: WorldBookUserInsertContext | null,
): { content: string; bindings: WorldBookUserPlaceholderBinding[]; changed: boolean } {
  const raw = String(content ?? '')
  const tokens: Array<{ kind: 'plain' } | { kind: 'scoped'; acc: string; pid: string }> = []
  const re = new RegExp(WORLD_BOOK_USER_TOKEN_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    if (m[1] != null && m[2] != null) {
      tokens.push({ kind: 'scoped', acc: m[1], pid: m[2] })
    } else {
      tokens.push({ kind: 'plain' })
    }
  }

  if (!tokens.length) {
    const had = (bindings ?? []).length > 0
    return { content: raw, bindings: [], changed: had }
  }

  const existing = [...(bindings ?? [])]
  let plainBindIdx = 0
  const outBindings: WorldBookUserPlaceholderBinding[] = []
  for (const t of tokens) {
    if (t.kind === 'scoped') {
      outBindings.push({
        wechatAccountId: t.acc.trim(),
        playerIdentityId: t.pid.trim(),
      })
    } else {
      const prev = existing[plainBindIdx]
      plainBindIdx += 1
      if (prev?.wechatAccountId?.trim() && prev?.playerIdentityId?.trim()) {
        outBindings.push({ ...prev })
      } else if (fallback) {
        outBindings.push(bindingFromInsertContext(fallback))
      } else {
        outBindings.push({ wechatAccountId: '', playerIdentityId: '' })
      }
    }
  }

  const nextContent = raw.replace(
    new RegExp(SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE.source, 'g'),
    '{{user}}',
  )

  const changed =
    nextContent !== raw ||
    outBindings.length !== (bindings?.length ?? 0) ||
    outBindings.some(
      (b, i) =>
        b.wechatAccountId !== (bindings?.[i]?.wechatAccountId ?? '') ||
        b.playerIdentityId !== (bindings?.[i]?.playerIdentityId ?? ''),
    )

  return { content: nextContent, bindings: outBindings, changed }
}

/** @deprecated 请用 {@link normalizeWorldBookItemUserPlaceholders} */
export function reconcileWorldBookUserPlaceholderBindings(
  content: string,
  bindings: WorldBookUserPlaceholderBinding[] | null | undefined,
  fallback?: WorldBookUserInsertContext | null,
): WorldBookUserPlaceholderBinding[] {
  return normalizeWorldBookItemUserPlaceholders(content, bindings, fallback).bindings
}

export function insertWorldBookUserPlaceholderInContent(params: {
  content: string
  bindings: WorldBookUserPlaceholderBinding[] | null | undefined
  caretStart: number
  caretEnd: number
  ctx: WorldBookUserInsertContext
}): { content: string; bindings: WorldBookUserPlaceholderBinding[] } {
  const cur = String(params.content ?? '')
  const start = Math.min(Math.max(0, params.caretStart), cur.length)
  const end = Math.min(Math.max(0, params.caretEnd), cur.length)
  const normalized = normalizeWorldBookItemUserPlaceholders(cur, params.bindings, null)
  const base = normalized.content
  const insertAt = countWorldBookUserPlaceholderSlotsBefore(base, start)
  const nextContent = `${base.slice(0, start)}{{user}}${base.slice(end)}`
  const prev = [...normalized.bindings]
  const row = bindingFromInsertContext(params.ctx)
  const nextBindings = [...prev.slice(0, insertAt), row, ...prev.slice(insertAt)]
  return { content: nextContent, bindings: nextBindings }
}

async function resolveBindingDisplayName(b: WorldBookUserPlaceholderBinding): Promise<string> {
  const cached = b.displayName?.trim()
  if (cached) return cached
  const pid = b.playerIdentityId.trim()
  let row = null
  try {
    row = await personaDb.getPlayerIdentity(pid)
  } catch {
    row = null
  }
  return formatPlayerIdentityDisplayName(row, pid)
}

/** 按出现顺序把 `{{user}}` 展开为绑定身份名；兼容旧式 `{{user:账号:身份}}`。 */
export async function expandWorldBookItemUserPlaceholders(
  content: string,
  bindings: WorldBookUserPlaceholderBinding[] | null | undefined,
): Promise<string> {
  let s = await expandScopedWorldBookUserPlaceholdersInText(String(content ?? ''))
  const list = bindings ?? []
  if (!s.includes('{{user}}')) return s

  let idx = 0
  const re = new RegExp(PLAIN_WORLD_BOOK_USER_PLACEHOLDER_RE.source, 'g')
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    parts.push(s.slice(last, m.index))
    const b = list[idx]
    idx += 1
    if (b) {
      parts.push(await resolveBindingDisplayName(b))
    } else {
      parts.push('{{user}}')
    }
    last = m.index + m[0].length
  }
  parts.push(s.slice(last))
  return parts.join('')
}

export function formatWorldBookUserBindingsSummary(
  bindings: WorldBookUserPlaceholderBinding[] | null | undefined,
): string {
  const list = bindings ?? []
  if (!list.length) return ''
  return list
    .map((b, i) => {
      const label = b.lineLabel?.trim() || b.displayName?.trim() || '未标注'
      const missing = !b.wechatAccountId?.trim() || !b.playerIdentityId?.trim()
      return missing ? `#${i + 1} （未绑定）` : `#${i + 1} ${label}`
    })
    .join(' · ')
}

/** 编辑页：正文槽位数 vs 已写入的绑定条数 */
export function describeWorldBookUserPlaceholderBindingState(
  content: string,
  bindings: WorldBookUserPlaceholderBinding[] | null | undefined,
): {
  slotCount: number
  boundCount: number
  hasLegacyScoped: boolean
  summary: string
  needsNormalize: boolean
} {
  const raw = String(content ?? '')
  const hasLegacyScoped = contentHasScopedWorldBookUserPlaceholder(raw)
  const slotCount = countWorldBookUserPlaceholderSlots(raw)
  const list = bindings ?? []
  const boundCount = list.filter((b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim()).length
  const summary = formatWorldBookUserBindingsSummary(list)
  const needsNormalize =
    hasLegacyScoped || slotCount !== list.length || (slotCount > 0 && boundCount < slotCount)
  return { slotCount, boundCount, hasLegacyScoped, summary, needsNormalize }
}

export function worldBookItemHasLegacyScopedUserPlaceholder(
  item: Pick<WorldBookItem, 'content'>,
): boolean {
  return contentHasScopedWorldBookUserPlaceholder(String(item.content ?? ''))
}

function bindingsNeedDisplayEnrich(bindings: WorldBookUserPlaceholderBinding[] | null | undefined): boolean {
  return (bindings ?? []).some(
    (b) =>
      b.wechatAccountId?.trim() &&
      b.playerIdentityId?.trim() &&
      (!b.lineLabel?.trim() || !b.displayName?.trim()),
  )
}

/** 正文槽位/绑定表不齐，或仍有旧式 `{{user:…}}`，或绑定缺展示字段。 */
export function characterWorldBooksNeedUserPlaceholderAlignment(character: Character): boolean {
  for (const w of character.worldBooks ?? []) {
    for (const it of w.items ?? []) {
      const st = describeWorldBookUserPlaceholderBindingState(
        it.content ?? '',
        it.userPlaceholderBindings,
      )
      if (st.needsNormalize || bindingsNeedDisplayEnrich(it.userPlaceholderBindings)) return true
    }
  }
  return false
}

/** @deprecated 请用 {@link characterWorldBooksNeedUserPlaceholderAlignment} */
export function characterWorldBooksNeedUserPlaceholderMigration(character: Character): boolean {
  return characterWorldBooksNeedUserPlaceholderAlignment(character)
}

async function enrichWorldBookUserPlaceholderBinding(
  b: WorldBookUserPlaceholderBinding,
): Promise<WorldBookUserPlaceholderBinding> {
  const acc = b.wechatAccountId.trim()
  const pid = b.playerIdentityId.trim()
  if (!acc || !pid || pid === '__none__') return b

  let row = null
  try {
    row = await personaDb.getPlayerIdentity(pid)
  } catch {
    row = null
  }
  const displayName = b.displayName?.trim() || formatPlayerIdentityDisplayName(row, pid)
  let lineLabel = b.lineLabel?.trim()
  if (!lineLabel) {
    const bundle = await loadAccountsBundle()
    lineLabel = await formatPlayerLineScopeLabel(
      { wechatAccountId: acc, sessionPlayerIdentityId: pid },
      bundle,
    )
  }
  return { wechatAccountId: acc, playerIdentityId: pid, displayName, lineLabel }
}

/**
 * 将正文里的旧式 `{{user:微信号:身份}}` 改为 `{{user}}`，并按出现顺序写入/合并 `userPlaceholderBindings`。
 * 若正文无旧式表达式则返回 null。
 */
export async function migrateWorldBookItemUserPlaceholderLegacy(
  item: Pick<WorldBookItem, 'content' | 'userPlaceholderBindings'>,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<Pick<WorldBookItem, 'content' | 'userPlaceholderBindings'> | null> {
  const content = String(item.content ?? '')
  if (!contentHasScopedWorldBookUserPlaceholder(content)) return null

  const tokens: Array<{ kind: 'plain' } | { kind: 'scoped'; acc: string; pid: string }> = []
  const re = new RegExp(WORLD_BOOK_USER_TOKEN_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m[1] != null && m[2] != null) {
      tokens.push({ kind: 'scoped', acc: m[1], pid: m[2] })
    } else {
      tokens.push({ kind: 'plain' })
    }
  }

  const existing = [...(item.userPlaceholderBindings ?? [])]
  let plainIdx = 0
  const draft: WorldBookUserPlaceholderBinding[] = []
  for (const t of tokens) {
    if (t.kind === 'scoped') {
      draft.push({
        wechatAccountId: t.acc.trim(),
        playerIdentityId: t.pid.trim(),
      })
    } else {
      const prev = existing[plainIdx]
      plainIdx += 1
      if (prev) draft.push({ ...prev })
      else if (opts?.fallback) draft.push(bindingFromInsertContext(opts.fallback))
    }
  }

  const nextContent = content.replace(
    new RegExp(SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE.source, 'g'),
    '{{user}}',
  )
  const userPlaceholderBindings = await Promise.all(draft.map(enrichWorldBookUserPlaceholderBinding))
  return { content: nextContent, userPlaceholderBindings }
}

/** 单角色：规范化正文 `{{user}}` 槽位与 `userPlaceholderBindings`（有变更才返回新 character）。 */
export async function alignCharacterWorldBookUserPlaceholders(
  character: Character,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<Character | null> {
  const summary = summarizeWorldBookUserPlaceholdersOnCharacter(character)
  const canFillUnbound = !!opts?.fallback && summary.slotCount > summary.boundCount
  if (!characterWorldBooksNeedUserPlaceholderAlignment(character) && !canFillUnbound) return null

  let changed = false
  const worldBooks = await Promise.all(
    (character.worldBooks ?? []).map(async (w) => {
      const items = await Promise.all(
        (w.items ?? []).map(async (it) => {
          const sync = normalizeWorldBookItemUserPlaceholders(
            it.content ?? '',
            it.userPlaceholderBindings,
            opts?.fallback,
          )
          let nextBindings = sync.bindings
          let itemChanged = sync.changed

          if (bindingsNeedDisplayEnrich(nextBindings)) {
            nextBindings = await Promise.all(nextBindings.map(enrichWorldBookUserPlaceholderBinding))
            itemChanged = true
          }

          if (!itemChanged) return it
          changed = true
          return {
            ...it,
            content: sync.content,
            userPlaceholderBindings: nextBindings,
            updatedAt: Date.now(),
          }
        }),
      )
      return { ...w, items }
    }),
  )
  if (!changed) return null
  return { ...character, worldBooks, updatedAt: Date.now() }
}

/** @deprecated 请用 {@link alignCharacterWorldBookUserPlaceholders} */
export async function migrateCharacterWorldBookUserPlaceholders(
  character: Character,
  opts?: { fallback?: WorldBookUserInsertContext | null },
): Promise<Character | null> {
  return alignCharacterWorldBookUserPlaceholders(character, opts)
}

/** 本档案世界书内 `{{user}}` / 旧式表达式统计（供一键对齐按钮） */
export function summarizeWorldBookUserPlaceholdersOnCharacter(character: Character): {
  slotCount: number
  boundCount: number
  itemCount: number
  needsAlign: boolean
} {
  let slotCount = 0
  let boundCount = 0
  let itemCount = 0
  for (const w of character.worldBooks ?? []) {
    for (const it of w.items ?? []) {
      const slots = countWorldBookUserPlaceholderSlots(it.content ?? '')
      if (!slots) continue
      itemCount += 1
      slotCount += slots
      boundCount += (it.userPlaceholderBindings ?? []).filter(
        (b) => b.wechatAccountId?.trim() && b.playerIdentityId?.trim(),
      ).length
    }
  }
  return {
    slotCount,
    boundCount,
    itemCount,
    needsAlign: characterWorldBooksNeedUserPlaceholderAlignment(character),
  }
}

/**
 * 进入微信应用时：扫描所有人设 / 玩家身份，写回对齐后的世界书 user 绑定。
 * @returns 实际写回库的角色条数
 */
export async function alignAllStoredWorldBookUserPlaceholders(): Promise<number> {
  const [chars, identities] = await Promise.all([
    personaDb.listCharacters(),
    personaDb.listPlayerIdentities(),
  ])
  const seen = new Set<string>()
  let written = 0

  for (const row of [...chars, ...identities]) {
    const id = row.id?.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)

    const next = await alignCharacterWorldBookUserPlaceholders(row)
    if (!next) continue

    if (row.isPlayerIdentity) await personaDb.upsertPlayerIdentity(next)
    else await personaDb.upsertCharacter(next)
    written += 1
  }

  return written
}
