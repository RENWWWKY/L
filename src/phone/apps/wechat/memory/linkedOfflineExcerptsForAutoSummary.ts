import { offlinePlotBodyRelevantToNpcForLinkedExcerpt } from '../dating/offlineDatingNpcSpeakerDetect'
import { collectCharacterMentionSearchTokens, plotBodyMentionsCharacter } from '../dating/offlineDatingArchiveResolve'
import { splitDatingAssistantOutput } from '../dating/plotCoT'
import { extractVnVoiceParamsBlock } from '../dating/vnVoiceParamsStrip'
import type { Character } from '../newFriendsPersona/types'
import { listAllLinkedMemoryEligibleCharacters } from './linkedMemoryEligiblePeers'

const PER_NPC_CAP = 4500
const PER_PLOT_SNIP = 1200

/** 与 {@link unifiedMemoryAutoSummary.DatingPlotSnapshotItem} 结构一致，避免循环依赖 */
type PlotSnap = { type: string; content: string; timestamp?: number }

function plotBodyForExcerpt(p: PlotSnap): string {
  const raw = String(p.content || '').trim()
  if (!raw) return ''
  if (p.type === 'ai') {
    const prose = splitDatingAssistantOutput(raw).content.trim()
    return extractVnVoiceParamsBlock(prose).cleanedText.trim()
  }
  return raw
}

function excerptSectionForEligibleCharacter(
  ch: Character,
  peerId: string,
  offlinePlots: PlotSnap[],
  roleTag: '人脉子角色' | '已绑定主角',
): { id: string; section: string } | null {
  const nid = ch.id.trim()
  if (!nid || nid === peerId) return null
  const mentionTokens = collectCharacterMentionSearchTokens(ch)
  const chunks: string[] = []
  let total = 0
  for (const plot of offlinePlots) {
    const body = plotBodyForExcerpt(plot)
    if (!body) continue
    if (!offlinePlotBodyRelevantToNpcForLinkedExcerpt(body, ch, mentionTokens)) continue
    const snip = body.length > PER_PLOT_SNIP ? `${body.slice(0, PER_PLOT_SNIP)}\n…` : body
    const piece = snip.length + 24
    if (total + piece > PER_NPC_CAP) break
    chunks.push(snip)
    total += piece
  }
  if (!chunks.length) return null
  const label = (ch.name || ch.wechatNickname || nid).trim()
  return {
    id: nid,
    section: `### character_id: ${nid}\n显示名：${label}（${roleTag}）\n${chunks.join('\n\n---\n\n')}`,
  }
}

/**
 * 为「合并自动总结」拼出各可关联角色（人脉 NPC + 已绑定主角）在本次未游标线下剧情中的有关摘录。
 * `archiveCharacterId` 为 KV 存档归属 id（与 {@link resolveOfflineDatingArchiveContext} 一致）。
 * `allowedNpcIds` 为历史字段名，实际包含人脉子角色与已绑定主角 id。
 */
export async function buildNpcLinkedOfflineExcerptUserBlock(params: {
  archiveCharacterId: string
  perspectiveCharacterId: string
  offlinePlots: PlotSnap[]
}): Promise<{ linkedArchiveOwnerId: string; allowedNpcIds: Set<string>; block: string }> {
  const archiveId = params.archiveCharacterId.trim()
  const peerId = params.perspectiveCharacterId.trim()
  const linkedArchiveOwnerId = archiveId || peerId
  if (!params.offlinePlots.length || !archiveId) {
    return { linkedArchiveOwnerId, allowedNpcIds: new Set(), block: '（无）' }
  }
  const { npcs, boundProtagonists } = await listAllLinkedMemoryEligibleCharacters(archiveId)
  const latestPlot = params.offlinePlots.length ? params.offlinePlots[params.offlinePlots.length - 1] : null
  const latestBody = latestPlot ? plotBodyForExcerpt(latestPlot) : ''
  const sections: string[] = []
  const allowed = new Set<string>()
  for (const npc of npcs) {
    let row = excerptSectionForEligibleCharacter(npc, peerId, params.offlinePlots, '人脉子角色')
    if (!row && latestBody && plotBodyMentionsCharacter(npc, latestBody)) {
      row = excerptSectionForEligibleCharacter(npc, peerId, latestPlot ? [latestPlot] : [], '人脉子角色')
    }
    if (!row) continue
    allowed.add(row.id)
    sections.push(row.section)
  }
  for (const pro of boundProtagonists) {
    let row = excerptSectionForEligibleCharacter(pro, peerId, params.offlinePlots, '已绑定主角')
    if (!row && latestBody && plotBodyMentionsCharacter(pro, latestBody)) {
      row = excerptSectionForEligibleCharacter(pro, peerId, latestPlot ? [latestPlot] : [], '已绑定主角')
    }
    if (!row) continue
    allowed.add(row.id)
    sections.push(row.section)
  }
  if (!sections.length) return { linkedArchiveOwnerId, allowedNpcIds: new Set(), block: '（无）' }
  return { linkedArchiveOwnerId, allowedNpcIds: allowed, block: sections.join('\n\n===\n\n') }
}
