import type { CharacterMemory } from './newFriendsPersona/types'
import { stripPromptPolicyBlocksForTraceDisplay } from './memoryTraceDisplaySanitize'
import { personaDb } from './newFriendsPersona/idb'
import { loadAccountsBundle } from './wechatAccountPersistence'
import { formatPlayerIdentityDisplayName } from './wechatCharacterPlayerIdentity'
import {
  formatWechatAccountLabel,
  resolvePlayerIdentityWechatAccountId,
} from './wechatContactIdentityPrompt'
import { parseWechatAccountPrivateConversationKey } from './wechatConversationKey'
import { getCharacterBoundPlayerIdentityId } from './wechatCharacterPlayerIdentity'
import { WECHAT_MEMORY_LINE_SCOPE_RULES } from './wechatMemoryLineScopeRules'

/** 私聊注入：当前微信账号 + 当前会话扮演身份 */
export type MemoryPromptLineScope = {
  wechatAccountId: string
  sessionPlayerIdentityId: string
}

export function normalizeMemoryPromptLineScope(
  wechatAccountId: string | null | undefined,
  sessionPlayerIdentityId: string | null | undefined,
): MemoryPromptLineScope | null {
  const acc = wechatAccountId?.trim()
  const sid = sessionPlayerIdentityId?.trim() || '__none__'
  if (!acc) return null
  return { wechatAccountId: acc, sessionPlayerIdentityId: sid }
}

export function memoryHasTaggedSourceLine(m: CharacterMemory): boolean {
  return !!m.sourceWechatAccountId?.trim()
}

export function memoryIsOnCurrentPlayerLine(
  m: CharacterMemory,
  scope: MemoryPromptLineScope,
): boolean {
  const acc = m.sourceWechatAccountId?.trim()
  if (!acc) return false
  const sid = (m.sourceSessionPlayerIdentityId?.trim() || '__none__').trim() || '__none__'
  return (
    acc === scope.wechatAccountId.trim() &&
    sid === (scope.sessionPlayerIdentityId.trim() || '__none__')
  )
}

export async function formatPlayerLineScopeLabel(
  scope: MemoryPromptLineScope,
  bundle?: Awaited<ReturnType<typeof loadAccountsBundle>> | null,
): Promise<string> {
  const b = bundle ?? (await loadAccountsBundle())
  const accLabel = formatWechatAccountLabel(b, scope.wechatAccountId)
  const sid = scope.sessionPlayerIdentityId.trim() || '__none__'
  if (sid === '__none__') return accLabel
  const row = await personaDb.getPlayerIdentity(sid)
  const name = formatPlayerIdentityDisplayName(row, sid)
  return `${accLabel} · 扮演「${name}」`
}

export async function formatMemorySourceLineLabelFromConversationKey(
  conversationKey: string,
): Promise<string> {
  const scoped = parseWechatAccountPrivateConversationKey(conversationKey.trim())
  if (!scoped) return '来源未标注'
  return formatPlayerLineScopeLabel({
    wechatAccountId: scoped.wechatAccountId,
    sessionPlayerIdentityId: scoped.sessionPlayerId,
  })
}

/**
 * 私聊注入未总结摘录 / 跨号摘录前：锚定「本窗口是谁」与「下文各块归属」。
 */
export async function buildPrivateChatMemoryInjectionAnchor(params: {
  currentScope: MemoryPromptLineScope
  /** 非主绑定 / 小号等分线：强化它号摘录≠当前发言人 */
  strangerLine?: boolean
  characterId?: string
}): Promise<string> {
  const bundle = await loadAccountsBundle()
  const cur = await formatPlayerLineScopeLabel(params.currentScope, bundle)
  const lines: string[] = [
    '【私聊记忆注入 · 分线锚点（阅读以下各块前必看）】',
    `**本窗口当前发言人（你正在回复的对象）**：${cur}`,
    '· 标题含「**当前微信线**」的摘录 = 本窗口这位的发言与对话；',
    '· 标题含「**其它微信线**」的摘录 = **其它微信号 / 其它扮演身份**，发言人**不是**上面这位，勿对号认亲。',
  ]
  if (params.strangerLine) {
    const cid = params.characterId?.trim()
    const primaryId = cid ? getCharacterBoundPlayerIdentityId(await personaDb.getCharacter(cid)) : null
    if (primaryId && primaryId !== params.currentScope.sessionPlayerIdentityId.trim()) {
      const primaryRow = await personaDb.getPlayerIdentity(primaryId)
      const ch = cid ? await personaDb.getCharacter(cid) : null
      const primaryAcc = resolvePlayerIdentityWechatAccountId(ch, primaryId, primaryRow)
      if (primaryAcc) {
        const pri = await formatPlayerLineScopeLabel(
          { wechatAccountId: primaryAcc, sessionPlayerIdentityId: primaryId },
          bundle,
        )
        lines.push(
          `**档案主绑定玩家（第三人，≠ 当前发言人）**：${pri} — 仅用于理解「某某推的」等推荐人；**禁止**把当前发言人当成此人。`,
        )
      }
    }
    lines.push(
      '**分线铁则**：禁止对当前这位叫「社长大人」等主绑定称呼；禁止编造「微信昵称一样」；其它线摘录只供维持你自己日程/承诺与人设，不得当作当前这位已说过/已听过。',
    )
  }
  lines.push('', WECHAT_MEMORY_LINE_SCOPE_RULES)
  return lines.join('\n')
}

export async function formatPrivateMemoriesPromptWithLineScope(params: {
  memories: CharacterMemory[]
  contents: string[]
  scope: MemoryPromptLineScope
  vectorTail: string
}): Promise<string> {
  const { memories, contents, scope, vectorTail } = params
  if (!memories.length) return ''

  const bundle = await loadAccountsBundle()
  const currentLabel = await formatPlayerLineScopeLabel(scope, bundle)

  const currentItems: string[] = []
  const otherByKey = new Map<string, { label: string; lines: string[] }>()
  const unlabeled: string[] = []

  for (let i = 0; i < memories.length; i++) {
    const m = memories[i]!
    const body = contents[i]?.trim()
    if (!body) continue
    if (!memoryHasTaggedSourceLine(m)) {
      unlabeled.push(`${unlabeled.length + 1}. ${body}`)
      continue
    }
    if (memoryIsOnCurrentPlayerLine(m, scope)) {
      currentItems.push(`${currentItems.length + 1}. ${body}`)
      continue
    }
    const acc = m.sourceWechatAccountId!.trim()
    const sid = (m.sourceSessionPlayerIdentityId?.trim() || '__none__').trim() || '__none__'
    const key = `${acc}|${sid}`
    let bucket = otherByKey.get(key)
    if (!bucket) {
      bucket = {
        label: await formatPlayerLineScopeLabel(
          { wechatAccountId: acc, sessionPlayerIdentityId: sid },
          bundle,
        ),
        lines: [],
      }
      otherByKey.set(key, bucket)
    }
    bucket.lines.push(`${bucket.lines.length + 1}. ${body}`)
  }

  const chunks: string[] = [WECHAT_MEMORY_LINE_SCOPE_RULES, '']

  if (currentItems.length) {
    chunks.push(
      `【当前微信线 · ${currentLabel} · 长期记忆（默认已与当前这位相关）】`,
      currentItems.join('\n'),
      '',
    )
  }

  for (const { label, lines } of otherByKey.values()) {
    if (!lines.length) continue
    chunks.push(
      `【其它微信线 · ${label} · 长期记忆（勿默认当前这位已听过）】`,
      lines.join('\n'),
      '',
    )
  }

  if (unlabeled.length) {
    chunks.push(
      '【来源未标注 · 长期记忆（可能对任意联系人都说过，勿默认当前这位已知）】',
      unlabeled.join('\n'),
      '',
    )
  }

  chunks.push(`（${vectorTail}）`)
  return chunks.join('\n').trim()
}

export async function wrapUnsummarizedPrivateBlockWithLineLabel(
  block: string,
  scope: MemoryPromptLineScope | null,
  role: 'current' | 'other',
  otherLineLabel?: string,
): Promise<string> {
  const body = block.trim()
  if (!body) return ''
  if (!scope) return body
  const label =
    role === 'current'
      ? await formatPlayerLineScopeLabel(scope)
      : otherLineLabel?.trim() || '其它微信线'
  const head =
    role === 'current'
      ? `【当前微信线 · ${label} · 未总结私聊摘录】`
      : `【其它微信线 · ${label} · 未总结私聊摘录 · 勿默认当前这位已听过】`
  return `${head}\n${WECHAT_MEMORY_LINE_SCOPE_RULES}\n\n${body}`
}

/** 思维溯源 / UI：相对当前会话线的归属 */
export type MemoryLineRelation = 'current' | 'other' | 'unlabeled'

export function lineRelationUiLabel(rel: MemoryLineRelation): string {
  if (rel === 'current') return '当前微信线'
  if (rel === 'other') return '其它微信线'
  return '来源未标注'
}

export async function formatMemorySourceLineLabelFromMemory(m: CharacterMemory): Promise<string> {
  const acc = m.sourceWechatAccountId?.trim()
  if (!acc) return '来源未标注'
  return formatPlayerLineScopeLabel({
    wechatAccountId: acc,
    sessionPlayerIdentityId: m.sourceSessionPlayerIdentityId?.trim() || '__none__',
  })
}

export function resolveMemoryLineRelation(
  m: CharacterMemory,
  currentScope: MemoryPromptLineScope | null | undefined,
): MemoryLineRelation {
  if (!memoryHasTaggedSourceLine(m)) return 'unlabeled'
  if (currentScope && memoryIsOnCurrentPlayerLine(m, currentScope)) return 'current'
  return 'other'
}

export type MemoryTraceLineScopedRow = {
  sourceLineLabel: string
  lineRelation: MemoryLineRelation
  snippet: string
}

/** 从已注入的「分线未总结摘录」正文拆成多条（与 prompt 标题格式对齐） */
export function parseLineScopedUnsummarizedTextForTrace(text: string): MemoryTraceLineScopedRow[] {
  const raw = text.trim()
  if (!raw) return []
  const chunks = raw.split(/(?=【(?:当前|其它)微信)/).map((c) => c.trim()).filter(Boolean)
  const out: MemoryTraceLineScopedRow[] = []

  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    const firstLine = lines[0]?.trim() ?? ''
    const headerMatch = firstLine.match(/^【(.+)】$/)
    const headerFull = headerMatch?.[1]?.trim() ?? firstLine
    let lineRelation: MemoryLineRelation = 'unlabeled'
    if (headerFull.startsWith('当前微信线')) lineRelation = 'current'
    else if (headerFull.startsWith('其它微信')) lineRelation = 'other'

    const headerParts = headerFull.split('·').map((p) => p.trim())
    const sourceLineLabel =
      headerParts.length >= 2 && headerParts[1] ? headerParts[1] : headerFull || '私聊摘录'

    let start = 1
    while (start < lines.length) {
      const ln = lines[start]?.trim() ?? ''
      if (!ln) {
        start++
        continue
      }
      if (ln.startsWith('【') && (ln.includes('分线阅读') || ln.includes('客观剧情'))) {
        start++
        continue
      }
      break
    }
    let snippet = stripPromptPolicyBlocksForTraceDisplay(lines.slice(start).join('\n'))
    snippet = snippet.replace(/\n*（↑[\s\S]*$/, '').trim()
    if (snippet) out.push({ sourceLineLabel, lineRelation, snippet })
  }

  if (!out.length) {
    const fallback = stripPromptPolicyBlocksForTraceDisplay(raw)
    if (fallback) out.push({ sourceLineLabel: '私聊摘录', lineRelation: 'unlabeled', snippet: fallback })
  }
  return out
}

/** 思维溯源：未总结私聊按马甲分块（当前线 raw + 跨号合并块解析） */
export async function buildPrivateUnsummarizedTraceBlocks(params: {
  crossAccountMerged?: string
  currentLineRaw?: string
  lineScope: MemoryPromptLineScope | null
}): Promise<MemoryTraceLineScopedRow[]> {
  const blocks: MemoryTraceLineScopedRow[] = []
  if (params.crossAccountMerged?.trim()) {
    blocks.push(
      ...parseLineScopedUnsummarizedTextForTrace(
        stripPromptPolicyBlocksForTraceDisplay(params.crossAccountMerged),
      ),
    )
  }
  if (params.currentLineRaw?.trim()) {
    const label = params.lineScope
      ? await formatPlayerLineScopeLabel(params.lineScope)
      : '当前私聊'
    const snippet = stripPromptPolicyBlocksForTraceDisplay(params.currentLineRaw)
    if (snippet) {
      blocks.push({
        sourceLineLabel: label,
        lineRelation: 'current',
        snippet,
      })
    }
  }
  return blocks
}
