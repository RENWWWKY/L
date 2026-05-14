import { upsertLoreEntry } from '../../worldbook/worldbookLoreStore'
import type { ComprehensivePersona } from './comprehensivePersona'
import { isMeetProfilePlaceholder } from './comprehensivePersona'
import { formatComprehensivePersonaMarkdown } from './formatComprehensivePersonaWorldbook'
import { rewriteMeetWorldbookNamesToPlaceholders } from './meetWorldbookPlaceholders'

const LORE_TITLE = '核心人设档案'

/** 档案法则条目标题 + 正文（与人设 vol10 结业稿共用一套占位符规则） */
export function buildMeetEpilogueLoreTitle(playerDisplayName?: string | null): string {
  const dn = playerDisplayName?.trim()
  const hasUser = !!(dn && !isMeetProfilePlaceholder(dn))
  return hasUser ? `对 {{user}} 的初印象 (Lumi Meet)` : '初遇印象 (Lumi Meet)'
}

export function formatMeetEpilogueImpressionForStorage(params: {
  rawContent: string
  charNickname: string
  charRealName?: string | null
  playerDisplayName?: string
}): { title: string; body: string } {
  const dn = params.playerDisplayName?.trim()
  const hasUser = !!(dn && !isMeetProfilePlaceholder(dn))
  const title = buildMeetEpilogueLoreTitle(params.playerDisplayName)
  const body = rewriteMeetWorldbookNamesToPlaceholders(params.rawContent.trim(), {
    nickname: params.charNickname,
    realName: params.charRealName,
    userDisplayName: hasUser ? dn : undefined,
  })
  return { title, body }
}

export function getMeetNineDossierEntryId(characterId: string): string {
  return `meet-nine-dossier-${characterId.trim()}`
}

/** 若 NPC 含九维档案则写入（或刷新）档案法则条目 */
export function ensureMeetNpcDossierInWorldbook(npc: {
  id: string
  nickname: string
  comprehensivePersona?: ComprehensivePersona | null
}): boolean {
  if (!npc.comprehensivePersona) return false
  syncMeetDossierToWorldbookLore(npc.id, npc.nickname, npc.comprehensivePersona)
  return true
}

/** 将九维档案写入全局档案法则（世界书），绑定指定角色 id */
export function syncMeetDossierToWorldbookLore(
  characterId: string,
  nickname: string,
  dossier: ComprehensivePersona,
): void {
  const id = getMeetNineDossierEntryId(characterId)
  upsertLoreEntry({
    id,
    title: LORE_TITLE,
    content: formatComprehensivePersonaMarkdown(nickname, dossier, characterId),
    enabled: true,
    plateScope: { mode: 'all' },
    characterScope: { mode: 'characters', ids: [characterId] },
    updatedAt: Date.now(),
  })
}

/** 遇见结业「初印象 / 尾声延展」条目 id（与九维档案分列） */
export function getMeetEpilogueImpressionEntryId(characterId: string): string {
  return `meet-epilogue-impression-${characterId.trim()}`
}

/** 互换联络完成后写入档案法则：尾声延展视角，作用范围为该 NPC 对应人设 id */
export function syncMeetEpilogueImpressionToWorldbookLore(params: {
  characterId: string
  playerDisplayName?: string
  content: string
  charNickname: string
  charRealName?: string | null
}): void {
  const { title, body } = formatMeetEpilogueImpressionForStorage({
    rawContent: params.content,
    charNickname: params.charNickname,
    charRealName: params.charRealName,
    playerDisplayName: params.playerDisplayName,
  })
  upsertLoreEntry({
    id: getMeetEpilogueImpressionEntryId(params.characterId),
    title,
    content: body,
    enabled: true,
    plateScope: { mode: 'all' },
    characterScope: { mode: 'characters', ids: [params.characterId] },
    updatedAt: Date.now(),
  })
}
