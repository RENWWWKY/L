import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import { personaDb } from '../newFriendsPersona/idb'
import { resolveTimelineSummaryApiConfig } from './memoryTimelineSummaryApi'
import {
  appendStoryTimelineOpenTodoToState,
  createEmptyStoryTimelineState,
  formatStoryTimelineTodoLedgerForPrompt,
  removeStoryTimelineTodoFromState,
  resolveStoryTimelineOpenTodoInState,
  type StoryTimelineState,
  type StoryTimelineTodoOutcome,
} from './storyTimelineTypes'

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

type OnlineTodoSyncPatch = {
  resolve: Array<{ text: string; outcome: StoryTimelineTodoOutcome }>
  remove: string[]
  add: string[]
}

function parseOnlineTodoSyncPatch(raw: string): OnlineTodoSyncPatch {
  let jsonBody = stripJsonFence(raw)
  const start = jsonBody.indexOf('{')
  const end = jsonBody.lastIndexOf('}')
  if (start >= 0 && end > start) jsonBody = jsonBody.slice(start, end + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonBody)
  } catch {
    return { resolve: [], remove: [], add: [] }
  }
  if (!parsed || typeof parsed !== 'object') return { resolve: [], remove: [], add: [] }
  const o = parsed as Record<string, unknown>

  const resolve: OnlineTodoSyncPatch['resolve'] = []
  const resolveRaw = Array.isArray(o.resolve) ? o.resolve : Array.isArray(o.resolved) ? o.resolved : []
  for (const row of resolveRaw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const text = String(r.text ?? r.content ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160)
    if (!text) continue
    const outcomeRaw = String(r.outcome ?? r.status ?? 'done')
      .trim()
      .toLowerCase()
    const outcome: StoryTimelineTodoOutcome =
      outcomeRaw === 'missed' || outcomeRaw === '未兑现'
        ? 'missed'
        : outcomeRaw === 'cancelled' || outcomeRaw === '取消'
          ? 'cancelled'
          : 'done'
    resolve.push({ text, outcome })
    if (resolve.length >= 16) break
  }

  const remove: string[] = []
  const removeRaw = Array.isArray(o.remove) ? o.remove : Array.isArray(o.delete) ? o.delete : []
  for (const row of removeRaw) {
    const text =
      typeof row === 'string'
        ? row
        : row && typeof row === 'object'
          ? String((row as Record<string, unknown>).text ?? '')
          : ''
    const t = text.replace(/\s+/g, ' ').trim().slice(0, 160)
    if (!t) continue
    remove.push(t)
    if (remove.length >= 16) break
  }

  const add: string[] = []
  const addRaw = Array.isArray(o.add) ? o.add : Array.isArray(o.todos) ? o.todos : []
  for (const row of addRaw) {
    const text =
      typeof row === 'string'
        ? row
        : row && typeof row === 'object'
          ? String((row as Record<string, unknown>).text ?? (row as Record<string, unknown>).content ?? '')
          : ''
    const t = text.replace(/\s+/g, ' ').trim().slice(0, 160)
    if (!t || t.length < 4) continue
    add.push(t)
    if (add.length >= 16) break
  }

  return { resolve, remove, add }
}

function todosSignature(state: StoryTimelineState): string {
  return JSON.stringify(state.todos ?? [])
}

function applyOnlineTodoSyncPatch(
  prev: StoryTimelineState,
  patch: OnlineTodoSyncPatch,
): { next: StoryTimelineState; changed: boolean } {
  let next = prev
  const beforeSig = todosSignature(prev)

  for (const r of patch.resolve) {
    next = resolveStoryTimelineOpenTodoInState(next, r.text, r.outcome)
  }
  for (const text of patch.remove) {
    next = removeStoryTimelineTodoFromState(next, text)
  }
  for (const text of patch.add) {
    const appended = appendStoryTimelineOpenTodoToState(next, text)
    if (appended) next = appended
  }

  if (todosSignature(next) === beforeSig) return { next: prev, changed: false }
  return {
    next: { ...next, characterId: prev.characterId, updatedAt: Date.now() },
    changed: true,
  }
}

/**
 * 微信线上回复后：让模型根据本轮对话判断并编辑待办台账（完成 / 删除 / 新增）。
 * 不写按轮摘要行，只更新 StoryTimelineState.todos。
 */
export async function syncStoryTimelineTodoLedgerAfterOnlineReply(params: {
  apiConfig: ApiConfig | null
  characterId: string
  displayName?: string
  latestUserText?: string
  latestAiText: string
}): Promise<
  | { status: 'applied'; changed: boolean }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }
> {
  const cid = params.characterId.trim()
  if (!cid) return { status: 'failed', reason: '无效角色' }

  const aiText = String(params.latestAiText ?? '').trim()
  if (aiText.length < 4) return { status: 'skipped', reason: '本轮回复过短' }

  const memSettings = await personaDb.getMemorySettings()
  if (memSettings.autoSummaryEnabled === false) {
    return { status: 'skipped', reason: '自动总结已关闭' }
  }

  const cfg = await resolveTimelineSummaryApiConfig(params.apiConfig)
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    return { status: 'failed', reason: '未配置剧情摘要 / 聊天 API（记忆设置）' }
  }

  const prev = (await personaDb.getStoryTimelineState(cid)) ?? createEmptyStoryTimelineState(cid)
  const ledgerBlock = formatStoryTimelineTodoLedgerForPrompt(prev) || '（当前无待办 / 已完成事项）'
  const userText = String(params.latestUserText ?? '').trim()
  const who = params.displayName?.trim() || '对方'

  const ledgerEmpty = !(prev.todos ?? []).some((t) => t.status === 'open')
  const system = `
你是「待办台账」线上同步助手。根据本轮微信私聊，判断是否需要更新待办台账。
规则：
- 只处理可核对的具体事项（赴约、交作业、回复、提醒、提交等），不要写心情/动机伏笔。
- resolve：本轮已表明做完 / 明确未兑现 / 取消的旧待办（text 尽量贴近台账原文）。
- remove：台账里重复、过时、本就不该存在的条目。
- add：仅当本轮对话**新约定**且仍未完成的事项；指角色用 {{char}}，指玩家用 {{user}}。
- 若本轮与待办无关，三类数组都给 []。
${
  ledgerEmpty
    ? '- **当前台账为空**：禁止根据往事/旧摘要「恢复」或重写已被用户清空的待办；仅当本轮明确新约定时才允许 add，否则 add 必须为 []。'
    : ''
}
- 只输出 JSON，禁止 markdown 围栏与解释：
{"resolve":[{"text":"……","outcome":"done|missed|cancelled"}],"remove":["……"],"add":["……"]}
`.trim()

  const userContent = [
    prev.currentStoryDay?.trim() ? `【当前剧情日】${prev.currentStoryDay.trim()}` : '',
    '【当前待办台账】',
    ledgerBlock,
    '',
    '【本轮私聊】',
    userText ? `我：${userText.slice(0, 1200)}` : '我：（无）',
    `${who}：${aiText.slice(0, 2200)}`,
    '',
    '请输出待办台账变更 JSON。',
  ]
    .filter(Boolean)
    .join('\n')

  let raw: string
  try {
    raw = await openAiCompatibleChat(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ])
  } catch (e) {
    const msg = e instanceof Error && e.message.trim() ? e.message.trim() : '请求失败'
    return { status: 'failed', reason: msg }
  }

  const patch = parseOnlineTodoSyncPatch(raw)
  if (!patch.resolve.length && !patch.remove.length && !patch.add.length) {
    return { status: 'applied', changed: false }
  }

  const { next, changed } = applyOnlineTodoSyncPatch(prev, patch)
  if (!changed) return { status: 'applied', changed: false }

  await personaDb.putStoryTimelineState(next)
  return { status: 'applied', changed: true }
}
