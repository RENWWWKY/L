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

const MEET_EPILOGUE_BODY_MAX_CHARS = 120

/** 在 maxChars 内尽量于句读处收束，避免「愿意在…」式硬截断省略号。 */
export function clampMeetEpilogueBody(s: string, maxChars = MEET_EPILOGUE_BODY_MAX_CHARS): string {
  const t = String(s ?? '').trim()
  const arr = Array.from(t)
  if (arr.length <= maxChars) return t

  const head = arr.slice(0, maxChars).join('')
  const sentenceEnders = ['。', '！', '？', '；', '.', '!', '?'] as const
  let cut = -1
  for (const ch of sentenceEnders) {
    const i = head.lastIndexOf(ch)
    if (i > cut) cut = i
  }
  if (cut >= Math.floor(maxChars * 0.5)) {
    return head.slice(0, cut + 1).trim()
  }

  const commaCut = Math.max(head.lastIndexOf('，'), head.lastIndexOf(','))
  if (commaCut >= Math.floor(maxChars * 0.65)) {
    return `${head.slice(0, commaCut + 1).trim()}。`
  }

  return head.trimEnd()
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
