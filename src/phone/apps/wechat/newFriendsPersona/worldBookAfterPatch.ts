import type { WorldBookAfterRevertEntry } from '../dating/types'
import type { Character, WorldBook, WorldBookItem } from './types'

/** 与 wechatChatAi 中约会合并记忆分隔符一致，用于从混合输出中切出 JSON 段 */
export const DATING_MEMORY_JSON_DELIMITER = '<<<DATING_UNIFIED_MEMORY_JSON>>>'

export const WB_AFTER_PATCH_MARKER = '\n---WB_AFTER_PATCH---\n'

/** 成功将「尾声延展」世界书补丁写入人设后派发（例：约会页挂载临时提示） */
export const WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT = 'phone:worldbook-after-patch-updated'

/** {@link WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT} 的 `detail`（可选，缺省时提示组件按 1 条处理） */
export type WorldBookAfterPatchUpdatedEventDetail = {
  /** 本轮模型 JSON 中、且已成功写入人设的补丁条数 */
  appliedPatchCount: number
}

const MAX_ITEM_CONTENT_CHARS = 12000

export type WorldBookAfterPatch = {
  /** 群聊等多角色时必填；私聊可省略（默认同当前绑定人设 id） */
  characterId?: string
  worldBookId: string
  itemId: string
  newContent: string
}

export function getWorldBookAfterItemContent(
  character: Character,
  worldBookId: string,
  itemId: string,
): string | null {
  const wb = character.worldBooks?.find((w) => w.id === worldBookId)
  const it = wb?.items?.find((i) => i.id === itemId)
  if (!it || it.priority !== 'after') return null
  return String(it.content ?? '')
}

/** 剧情存档 JSON 反序列化后可能非数组；避免 `for...of` 误遍历字符串字符 */
export function sanitizeWorldBookAfterRevertEntries(raw: unknown): WorldBookAfterRevertEntry[] {
  if (!Array.isArray(raw)) return []
  const out: WorldBookAfterRevertEntry[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const worldBookId = String(o.worldBookId ?? '').trim()
    const itemId = String(o.itemId ?? '').trim()
    if (!worldBookId || !itemId) continue
    const contentAfterPatch = o.contentAfterPatch
    out.push({
      worldBookId,
      itemId,
      contentBefore: String(o.contentBefore ?? ''),
      ...(typeof contentAfterPatch === 'string' ? { contentAfterPatch } : {}),
    })
  }
  return out
}

/** 在应用补丁前采集各条目当前正文，供「重新生成」时写回 */
export function collectWorldBookAfterRevertSnapshot(
  character: Character,
  patches: WorldBookAfterPatch[],
): WorldBookAfterRevertEntry[] {
  const cidSelf = String(character.id ?? '').trim()
  const out: WorldBookAfterRevertEntry[] = []
  const seen = new Set<string>()
  for (const p of patches) {
    if (p.characterId?.trim() && p.characterId.trim() !== cidSelf) continue
    const key = `${p.worldBookId}\0${p.itemId}`
    if (seen.has(key)) continue
    seen.add(key)
    const cur = getWorldBookAfterItemContent(character, p.worldBookId, p.itemId)
    if (cur === null) continue
    out.push({
      worldBookId: p.worldBookId,
      itemId: p.itemId,
      contentBefore: cur,
      contentAfterPatch: String(p.newContent ?? ''),
    })
  }
  return out
}

export function hasChatAfterWorldBookItems(character: Character | null | undefined): boolean {
  if (!character?.worldBooks?.length) return false
  for (const w of character.worldBooks) {
    if (!w?.enabled) continue
    for (const it of w.items ?? []) {
      if (it?.enabled && it.priority === 'after' && String(it.content ?? '').trim()) return true
    }
  }
  return false
}

export function listChatAfterWorldBookItems(
  character: Character | null | undefined,
): Array<{ worldBookId: string; itemId: string; bookName: string; itemName: string; content: string }> {
  const out: Array<{ worldBookId: string; itemId: string; bookName: string; itemName: string; content: string }> = []
  if (!character?.worldBooks?.length) return out
  for (const w of character.worldBooks) {
    if (!w?.enabled) continue
    const bookName = String(w.name ?? '').trim() || '世界书'
    for (const it of w.items ?? []) {
      if (!it?.enabled || it.priority !== 'after') continue
      const body = String(it.content ?? '').trim()
      if (!body) continue
      out.push({
        worldBookId: w.id,
        itemId: it.id,
        bookName,
        itemName: String(it.name ?? '').trim() || '条目',
        content: body.slice(0, MAX_ITEM_CONTENT_CHARS),
      })
    }
  }
  return out
}

/** 注入 buildSystemContent：区分「序言介入」固定层与「尾声延展」可变层（数据字段 priority=before / after） */
export function buildChatAfterWorldBookDynamicSection(character: Character | null | undefined): string {
  const rows = listChatAfterWorldBookItems(character)
  if (!rows.length) return ''
  const lines = rows
    .map(
      (r) =>
        `- 世界书「${r.bookName}」·条目「${r.itemName}」·worldBookId=\`${r.worldBookId}\` · itemId=\`${r.itemId}\`\n  当前正文：${r.content}`,
    )
    .join('\n')
  return `
---
【世界书·生效时机铁律（剧情与人设一致性）】
- **序言介入**条目（priority=before）：角色的**恒常基底**（如先天性格模板、长期不变的立场）。用户在线上私聊、线下剧情中如何互动，**都不得**动摇这些条目所描述的「底层设定」——除非你在编辑器里手动改条目。
- **尾声延展**条目（priority=after）：角色的**当前关系态 / 态度快照**（类似好感度层）：角色应**基于以下最新正文**对用户与情境做出合理反应；当本轮回复所体现的态度、关系、承诺已明显与某条「尾声延展」正文**不一致**时，你须在输出末尾按协议提交覆盖稿，使数据库中的「尾声延展」条目与剧情同步。
- 若系统另注「当前发言人 ≠ 档案主绑定」：尾声延展中写明的你对**主绑定玩家（第三人）**的暗恋/好感/纠结等**仍约束你的内心**；分线仅禁止把**当前窗口这位**当成主绑定，**不授权**为此对第三人感情 OOC 翻篇或与世界书正面冲突的全盘否认。
- 下列为当前绑定人设中**已启用**的「尾声延展」条目（仅列可变层；固定层见上文世界书全文）：
${lines}
`.trim()
}

export function buildWorldBookAfterPatchOutputAppendix(): string {
  return `
---------------------
【同一回复内追加：尾声延展·世界书覆盖 JSON（仅在有变更时输出）】
在你写完**全部**可见聊天正文（及可选 <danmaku>、SPEAKER 等协议内容）之后：若且仅当你判断本轮回复与某一「尾声延展」条目所描述的关系态/态度**已产生可核对的变化**（例如条目仍写「冷漠」但本轮语气已明显缓和），则**另起一行**输出分隔行（必须完全一致）：
---WB_AFTER_PATCH---
分隔行下一行起输出**恰好一个** JSON 对象（可用 markdown \`\`\`json 围栏包裹），结构如下（字段名固定）：
{
  "patches": [
    {
      "characterId": "人设UUID（群聊涉及多名成员时必填；私聊单角色可省略）",
      "worldBookId": "世界书 id",
      "itemId": "条目 id",
      "newContent": "替换后的条目正文全文（须仍为「尾声延展」语义；可用 {{char}} {{user}} {{id:…}} 占位符）"
    }
  ]
}
规则：
- **仅**覆盖 **尾声延展**条目（数据字段 priority 为 after）、且上文列表或世界书全文中已存在的 worldBookId/itemId；禁止编造 id。
- **不要**为了凑数而改写；无变化则**不要**输出 ---WB_AFTER_PATCH--- 整段。
- **不要**在此 JSON 中修改**序言介入**条目（数据字段 priority 为 before）。
- newContent 长度建议不超过 ${MAX_ITEM_CONTENT_CHARS} 字；精简表述即可。
---------------------
`.trim()
}

export function buildAggregateGroupChatAfterPatchItemsSection(members: Character[]): string {
  const blocks: string[] = []
  for (const ch of members) {
    const rows = listChatAfterWorldBookItems(ch)
    if (!rows.length) continue
    const cid = String(ch.id ?? '').trim()
    if (!cid) continue
    const inner = rows
      .map(
        (r) =>
          `  - 「${r.bookName}」·「${r.itemName}」·worldBookId=\`${r.worldBookId}\` · itemId=\`${r.itemId}\`\n    当前：${r.content}`,
      )
      .join('\n')
    blocks.push(`【成员 characterId=\`${cid}\`（本群昵称参见成员列表）】\n${inner}`)
  }
  if (!blocks.length) return ''
  return `
---
【群聊·多名 NPC 的「尾声延展」可变条目快照】
下列条目会随剧情更新；若某成员本轮台词体现的态度/关系与下列正文不一致，可为该成员输出 patches（characterId 填该成员 id）。
${blocks.join('\n\n')}
`.trim()
}

function normalizePatch(raw: unknown): WorldBookAfterPatch | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const worldBookId = String(o.worldBookId ?? '').trim()
  const itemId = String(o.itemId ?? '').trim()
  const newContent = String(o.newContent ?? '').trim()
  const characterId = o.characterId != null ? String(o.characterId).trim() : undefined
  if (!worldBookId || !itemId || !newContent) return null
  if (newContent.length > MAX_ITEM_CONTENT_CHARS) return null
  return { characterId: characterId || undefined, worldBookId, itemId, newContent }
}

export function parseWorldBookAfterPatchJson(jsonStr: string): WorldBookAfterPatch[] {
  const t = String(jsonStr ?? '').trim()
  if (!t) return []
  try {
    const root = JSON.parse(t) as { patches?: unknown }
    const arr = root?.patches
    if (!Array.isArray(arr)) return []
    const out: WorldBookAfterPatch[] = []
    for (const x of arr) {
      const p = normalizePatch(x)
      if (p) out.push(p)
    }
    return out
  } catch {
    return []
  }
}

/**
 * 从模型输出中移除 WB_AFTER_PATCH 段；兼容约会文末合并记忆分隔符之后的正文。
 */
export function extractWorldBookAfterPatchBlock(raw: string): { rest: string; patches: WorldBookAfterPatch[] } {
  const src = String(raw ?? '')
  const marker = '---WB_AFTER_PATCH---'
  const idx = src.indexOf(marker)
  if (idx < 0) return { rest: src, patches: [] }

  const head = src.slice(0, idx)
  const tail = src.slice(idx + marker.length).trimStart()

  const memPos = tail.indexOf(DATING_MEMORY_JSON_DELIMITER)
  const jsonSection = memPos >= 0 ? tail.slice(0, memPos) : tail
  const afterMemory = memPos >= 0 ? tail.slice(memPos) : ''

  let jsonBody = jsonSection.trim()
  if (jsonBody.startsWith('```')) {
    jsonBody = jsonBody.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  }

  const patches = parseWorldBookAfterPatchJson(jsonBody)
  const rest = head.trimEnd() + (afterMemory ? (head.endsWith('\n') ? '' : '\n') + afterMemory.trimStart() : '')
  return { rest, patches }
}

function patchItemContent(items: WorldBookItem[], itemId: string, nextContent: string): WorldBookItem[] {
  const now = Date.now()
  return items.map((it) =>
    it.id === itemId ? { ...it, content: nextContent, updatedAt: now } : it,
  )
}

/** 将补丁应用到单个人设记录（仅改 priority===after 且 id 匹配的条目） */
export function applyWorldBookAfterPatchesToCharacter(
  character: Character,
  patches: WorldBookAfterPatch[],
): Character | null {
  const cidSelf = character.id.trim()
  const toApply = patches.filter((p) => !p.characterId?.trim() || p.characterId.trim() === cidSelf)
  if (!toApply.length) return null

  let worldBooks: WorldBook[] = (character.worldBooks ?? []).map((w) => ({
    ...w,
    items: [...(w.items ?? [])],
  }))
  let changed = false
  for (const p of toApply) {
    const wb = worldBooks.find((w) => w.id === p.worldBookId)
    const it = wb?.items?.find((i) => i.id === p.itemId)
    if (!wb || !it || it.priority !== 'after') continue
    if (String(it.content ?? '').trim() === String(p.newContent ?? '').trim()) continue
    const nextItems = patchItemContent(wb.items, p.itemId, p.newContent)
    worldBooks = worldBooks.map((w) => (w.id === wb!.id ? { ...w, items: nextItems } : w))
    changed = true
  }
  if (!changed) return null
  return {
    ...character,
    worldBooks,
    updatedAt: Math.max(character.updatedAt ?? 0, Date.now()),
  }
}

/** 将「尾声延展」条目恢复为快照中的 contentBefore（约会「重新生成」请求模型前写回人设） */
export function applyWorldBookAfterRevertEntries(
  character: Character,
  entries: WorldBookAfterRevertEntry[],
): Character | null {
  if (!entries.length) return null
  let worldBooks: WorldBook[] = (character.worldBooks ?? []).map((w) => ({
    ...w,
    items: [...(w.items ?? [])],
  }))
  let changed = false
  for (const e of entries) {
    const wb = worldBooks.find((w) => w.id === e.worldBookId)
    const it = wb?.items?.find((i) => i.id === e.itemId)
    if (!wb || !it || it.priority !== 'after') continue
    const curTrim = String(it.content ?? '').trim()
    const afterTrim = String(e.contentAfterPatch ?? '').trim()
    if (afterTrim && curTrim !== afterTrim) {
      // 与当轮成功落库后的正文不一致：用户在人设里改过，或后续剧情已覆盖该条
      continue
    }
    if (String(it.content ?? '') === e.contentBefore) continue
    const nextItems = patchItemContent(wb.items, e.itemId, e.contentBefore)
    worldBooks = worldBooks.map((w) => (w.id === wb.id ? { ...w, items: nextItems } : w))
    changed = true
  }
  if (!changed) return null
  return {
    ...character,
    worldBooks,
    updatedAt: Math.max(character.updatedAt ?? 0, Date.now()),
  }
}
