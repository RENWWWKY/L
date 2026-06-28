import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { personaDb } from '../newFriendsPersona/idb'
import type { StoryTimelineEventScope, StoryTimelinePlotRow, StoryTimelineState } from './storyTimelineTypes'
import type { MemoryCharacterRosterItem, MemorySceneTag } from './memoryArchiveTypes'

export type StoryTimelineArchiveRosterItem = MemoryCharacterRosterItem & {
  rowCount: number
  lastUpdatedAt: number
}

const SCOPE_TO_SCENE: Partial<Record<StoryTimelineEventScope, MemorySceneTag>> = {
  private: '私聊',
  offline: '线下',
  meet: '遇见',
  group: '群聊',
  linked: '关联线下',
}

function resolveDisplayName(
  charId: string,
  charNameById: Map<string, string>,
  contactByCharId: Map<string, WeChatContactRow>,
): { displayName: string; wechatRemarkName?: string; avatarUrl?: string } {
  const contact = contactByCharId.get(charId)
  const realName = charNameById.get(charId)?.trim()
  const remark = contact?.remarkName?.trim()
  const displayName = realName || remark || charId.slice(0, 8)
  return {
    displayName,
    ...(remark && realName && remark !== realName ? { wechatRemarkName: remark } : {}),
    ...(contact?.avatarUrl ? { avatarUrl: contact.avatarUrl } : {}),
  }
}

function sceneTagsFromRows(rows: StoryTimelinePlotRow[]): MemorySceneTag[] {
  const set = new Set<MemorySceneTag>()
  for (const row of rows) {
    const tag = SCOPE_TO_SCENE[row.sourceScope]
    if (tag) set.add(tag)
  }
  return [...set]
}

function hasMeaningfulState(state: StoryTimelineState | null | undefined): boolean {
  if (!state) return false
  return !!(
    state.manualAnchorBlock?.trim() ||
    state.currentLocation?.trim() ||
    state.currentStoryDay?.trim() ||
    state.currentStoryTime?.trim() ||
    state.costumes.length ||
    state.items.length ||
    state.foreshadows.length ||
    state.recentEvents.length
  )
}

/** 记忆档案馆 · 剧情摘要：按角色聚合 roster */
export async function buildStoryTimelineArchiveRoster(params: {
  contacts: WeChatContactRow[]
}): Promise<StoryTimelineArchiveRosterItem[]> {
  const [states, allRows, chars] = await Promise.all([
    personaDb.listAllStoryTimelineStates(),
    personaDb.listAllStoryTimelinePlotRows(),
    personaDb.listCharacters(),
  ])

  const charNameById = new Map<string, string>()
  for (const c of chars) {
    const id = c.id?.trim()
    const name = c.name?.trim() || c.wechatNickname?.trim()
    if (id && name) charNameById.set(id, name)
  }

  const contactByCharId = new Map<string, WeChatContactRow>()
  for (const c of params.contacts) {
    const id = c.id?.trim()
    if (id) contactByCharId.set(id, c)
  }

  const rowsByChar = new Map<string, StoryTimelinePlotRow[]>()
  for (const row of allRows) {
    const cid = row.characterId.trim()
    if (!cid) continue
    const list = rowsByChar.get(cid) ?? []
    list.push(row)
    rowsByChar.set(cid, list)
  }

  const stateByChar = new Map<string, StoryTimelineState>()
  for (const st of states) {
    const cid = st.characterId.trim()
    if (cid) stateByChar.set(cid, st)
  }

  const charIds = new Set<string>([...rowsByChar.keys(), ...stateByChar.keys()])
  const items: StoryTimelineArchiveRosterItem[] = []

  for (const charId of charIds) {
    const rows = rowsByChar.get(charId) ?? []
    const state = stateByChar.get(charId) ?? null
    if (!rows.length && !hasMeaningfulState(state)) continue

    const hasCharacter = charNameById.has(charId)
    const hasContact = contactByCharId.has(charId)
    if (!hasCharacter && !hasContact) continue

    const lastFromRows = rows.length ? Math.max(...rows.map((r) => r.recordedAt)) : 0
    const lastUpdatedAt = Math.max(lastFromRows, state?.updatedAt ?? 0)
    const { displayName, wechatRemarkName, avatarUrl } = resolveDisplayName(
      charId,
      charNameById,
      contactByCharId,
    )

    items.push({
      charId,
      displayName,
      wechatRemarkName,
      avatarUrl,
      memoryCount: rows.length || (hasMeaningfulState(state) ? 1 : 0),
      rowCount: rows.length,
      sceneTags: sceneTagsFromRows(rows),
      hasLinked: false,
      hasOwn: true,
      lastUpdatedAt,
    })
  }

  items.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt || a.displayName.localeCompare(b.displayName, 'zh'))
  return items
}

/** 角色/联系人已不存在的时间轴残留（如抹除账号后未清库） */
export async function purgeOrphanStoryTimelineArchiveData(params: {
  contacts: WeChatContactRow[]
}): Promise<number> {
  const [states, allRows, chars] = await Promise.all([
    personaDb.listAllStoryTimelineStates(),
    personaDb.listAllStoryTimelinePlotRows(),
    personaDb.listCharacters(),
  ])
  const valid = new Set<string>()
  for (const c of chars) {
    const id = c.id?.trim()
    if (id) valid.add(id)
  }
  for (const c of params.contacts) {
    const id = c.id?.trim()
    if (id) valid.add(id)
  }
  const orphan = new Set<string>()
  for (const st of states) {
    const id = st.characterId.trim()
    if (id && !valid.has(id)) orphan.add(id)
  }
  for (const row of allRows) {
    const id = row.characterId.trim()
    if (id && !valid.has(id)) orphan.add(id)
  }
  if (!orphan.size) return 0
  await personaDb.purgeStoryTimelineDataForCharacterIds(orphan)
  return orphan.size
}

export async function loadStoryTimelineArchiveForCharacter(characterId: string): Promise<{
  state: StoryTimelineState | null
  rows: StoryTimelinePlotRow[]
}> {
  const cid = characterId.trim()
  if (!cid) return { state: null, rows: [] }
  const [state, rows] = await Promise.all([
    personaDb.getStoryTimelineState(cid),
    personaDb.listStoryTimelinePlotRowsByCharacterId(cid),
  ])
  return { state, rows }
}

export function storyTimelineScopeLabel(scope: StoryTimelineEventScope): string {
  return SCOPE_TO_SCENE[scope] ?? scope
}
