import { extractCharacterGenderHintForImageGen } from '../characterAppearanceImageGen'
import type { Character, Gender, PlayerIdentity } from '../newFriendsPersona/types'

function danbooruGenderTag(gender: Gender | undefined | null): string | null {
  if (gender === 'male') return '1boy'
  if (gender === 'female') return '1girl'
  return null
}

function wrongDanbooruTag(gender: Gender | undefined | null): string | null {
  if (gender === 'male') return '1girl'
  if (gender === 'female') return '1boy'
  return null
}

/** 修正 reference character / reference player 附近被模型或 LLM 写反的 1boy/1girl */
function fixReferenceRoleGenderTags(
  prompt: string,
  roleLabel: 'reference character' | 'reference player',
  gender: Gender | undefined | null,
): string {
  if (gender !== 'male' && gender !== 'female') return prompt
  const correct = danbooruGenderTag(gender)!
  const wrong = wrongDanbooruTag(gender)!
  const role = roleLabel.replace(' ', '\\s+')
  let s = prompt
  s = s.replace(new RegExp(`\\b${wrong}\\b\\s*,?\\s*(${role})\\b`, 'gi'), `${correct}, $1`)
  s = s.replace(new RegExp(`\\b(${role})\\b\\s*,?\\s*\\b${wrong}\\b`, 'gi'), `$1, ${correct}`)
  s = s.replace(
    new RegExp(
      `\\b(${role})\\b\\s+on\\s+(?:the\\s+)?(left|right|center)(?:\\s+side)?\\s*,?\\s*\\b${wrong}\\b`,
      'gi',
    ),
    `$1 on $2, ${correct}`,
  )
  if (new RegExp(`\\b${role}\\b`, 'i').test(s) && !new RegExp(`\\b${correct}\\b`, 'i').test(s)) {
    s = `${correct}, ${extractCharacterGenderHintForImageGen(gender)}, ${s}`
  }
  return s
}

/**
 * 发往生图 API 前：按档案性别校正 reference character / reference player 的 tag，
 * 降低「两女一男 → 两男一女」等 cast 性别反转。
 */
export function enforceDatingPlotImagePromptCastGenders(
  prompt: string,
  character: Character | null | undefined,
  playerIdentity?: PlayerIdentity | null,
): string {
  let s = prompt.trim()
  if (!s) return s
  if (/reference character/i.test(s)) {
    s = fixReferenceRoleGenderTags(s, 'reference character', character?.gender)
  }
  if (/reference player/i.test(s)) {
    s = fixReferenceRoleGenderTags(s, 'reference player', playerIdentity?.gender)
  }
  return s.replace(/\s*,\s*,+/g, ', ').replace(/^,\s*/, '').trim()
}

/** 写入 buildFullPrompt 的硬性性别锁（不依赖是否有参考图） */
export function buildDatingPlotGenderLockSuffix(params: {
  characterGenderHint?: string
  playerGenderHint?: string
  promptMentionsPlayer?: boolean
}): string {
  const charHint = params.characterGenderHint?.trim()
  const playerHint = params.playerGenderHint?.trim()
  const parts: string[] = []
  if (charHint) {
    parts.push(
      `dating character (reference character tag) must be ${charHint}, do NOT swap to opposite sex`,
    )
  }
  if (playerHint && params.promptMentionsPlayer) {
    parts.push(`player (reference player tag) must be ${playerHint}, do NOT swap to opposite sex`)
  }
  if (charHint && playerHint && params.promptMentionsPlayer) {
    parts.push('two distinct people with correct genders as specified, do NOT merge faces or swap identities')
  }
  return parts.length ? `, ${parts.join(', ')}` : ''
}
