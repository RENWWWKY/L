import { isMeetProfilePlaceholder } from './comprehensivePersona'
import { rewriteMeetWorldbookNamesToPlaceholders } from './meetWorldbookPlaceholders'

/** 旧版档案室条目 id（仅用于清理，不再写入） */
export function getMeetNineDossierEntryId(characterId: string): string {
  return `meet-nine-dossier-${characterId.trim()}`
}

/** 旧版档案室条目 id（仅用于清理，不再写入） */
export function getMeetEpilogueImpressionEntryId(characterId: string): string {
  return `meet-epilogue-impression-${characterId.trim()}`
}

/** 档案法则条目标题 + 正文（与人设 vol10 结业稿共用一套占位符规则） */
export function buildMeetEpilogueLoreTitle(playerDisplayName?: string | null): string {
  const dn = playerDisplayName?.trim()
  const hasUser = !!(dn && !isMeetProfilePlaceholder(dn))
  return hasUser ? `对 {{user}} 的初印象 (Lumi Meet)` : '初遇印象 (Lumi Meet)'
}

/** 尾声延展：落库前截断为约百字（按 Unicode 码点计），避免过长独白 */
export function clampMeetEpilogueBody(s: string, maxChars = 110): string {
  const t = String(s ?? '').trim()
  const arr = Array.from(t)
  if (arr.length <= maxChars) return t
  return `${arr.slice(0, Math.max(0, maxChars - 1)).join('')}…`
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
  const bodyRaw = rewriteMeetWorldbookNamesToPlaceholders(params.rawContent.trim(), {
    nickname: params.charNickname,
    realName: params.charRealName,
    userDisplayName: hasUser ? dn : undefined,
  })
  const body = clampMeetEpilogueBody(bodyRaw, 110)
  return { title, body }
}
