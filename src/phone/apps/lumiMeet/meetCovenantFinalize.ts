import type { EncounterNPC } from './meetTypes'
import { pickWechatFromNpcPlainText } from './meetContractResponseParse'

export type MeetCovenantFinalizeDeps = {
  getPersistedSnapshot: () => { npcs: EncounterNPC[] }
  upsertNpc: (npc: EncounterNPC) => void
  /** 写入人设库并登记微信号，供微信「添加朋友」搜索；不写入通讯录 */
  upsertMeetNpcAsCharacter: (npc: EncounterNPC, wechatId: string) => Promise<void>
}

/** 契约 agree 后归档对方微信号（叙事层双方已知；可搜索添加，但不写入微信通讯录） */
export async function resolveCharWechatIdForCovenant(params: {
  npc: EncounterNPC
  explicitWechatId?: string
  bodyForBubbles: string
  scrubbedLines: string[]
  actionType: 'char_add_user' | 'user_add_char' | 'none'
  deps: MeetCovenantFinalizeDeps
}): Promise<string | undefined> {
  const { npc, explicitWechatId, bodyForBubbles, scrubbedLines, actionType, deps } = params
  let charWechatId: string | undefined = explicitWechatId?.trim() || undefined
  const snapNpc = () => deps.getPersistedSnapshot().npcs.find((x) => x.id === npc.id) ?? npc

  const persistWx = async (wxId: string) => {
    const snap = snapNpc()
    const next = { ...snap, wechatId: wxId }
    deps.upsertNpc(next)
    await deps.upsertMeetNpcAsCharacter(next, wxId)
    charWechatId = wxId
  }

  if (actionType === 'user_add_char') {
    const picked = pickWechatFromNpcPlainText(bodyForBubbles)
    let wxId = picked || snapNpc().wechatId?.trim()
    if (!wxId) wxId = `Lm_${Math.random().toString(36).slice(2, 10)}`
    await persistWx(wxId)
    return charWechatId
  }

  if (actionType === 'char_add_user') {
    const merged = `${bodyForBubbles}\n${scrubbedLines.join('\n')}`
    let wxId =
      charWechatId?.trim() ||
      pickWechatFromNpcPlainText(merged) ||
      snapNpc().wechatId?.trim()
    if (!wxId) wxId = `Lm_${Math.random().toString(36).slice(2, 10)}`
    const prevWx = snapNpc().wechatId?.trim()
    if (!prevWx || prevWx !== wxId) await persistWx(wxId)
    else {
      charWechatId = wxId
      await deps.upsertMeetNpcAsCharacter({ ...snapNpc(), wechatId: wxId }, wxId)
    }
    return charWechatId
  }

  if (!charWechatId?.trim()) {
    const mergedForPick = `${bodyForBubbles}\n${scrubbedLines.join('\n')}`
    const picked = pickWechatFromNpcPlainText(mergedForPick) || pickWechatFromNpcPlainText(bodyForBubbles)
    if (picked) {
      const snap = snapNpc()
      if (!snap.wechatId?.trim()) await persistWx(picked)
      else charWechatId = picked
    }
  }
  if (!charWechatId?.trim()) {
    const w = snapNpc().wechatId?.trim()
    if (w) charWechatId = w
  }

  const finalWx = charWechatId?.trim()
  if (finalWx) {
    const snap = snapNpc()
    if (snap.wechatId?.trim() !== finalWx) {
      await persistWx(finalWx)
    } else {
      await deps.upsertMeetNpcAsCharacter({ ...snap, wechatId: finalWx }, finalWx)
    }
  }

  return charWechatId
}

/** 复制/查看微信号前补登记人设库，避免「添加朋友」搜不到（尤其旧存档） */
export async function ensureMeetNpcWechatSearchable(params: {
  npc: EncounterNPC
  wechatId: string
  deps: MeetCovenantFinalizeDeps
}): Promise<void> {
  const wx = params.wechatId.trim()
  if (!wx) return
  const snap = params.deps.getPersistedSnapshot().npcs.find((x) => x.id === params.npc.id) ?? params.npc
  const next = { ...snap, wechatId: wx }
  if (snap.wechatId?.trim() !== wx) params.deps.upsertNpc(next)
  await params.deps.upsertMeetNpcAsCharacter(next, wx)
}
