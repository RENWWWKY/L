import {
  characterHasAppearanceReference,
  extractCharacterAppearanceHint,
  extractCharacterAppearanceRefNote,
  extractCharacterGenderHintForImageGen,
} from '../characterAppearanceImageGen'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'

export type DatingPlotCastContext = {
  character: Character | null | undefined
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
}

function genderSubjectTags(gender: Character['gender'] | undefined): { en: string; danbooru: string } {
  if (gender === 'male') return { en: 'young man, male', danbooru: '1boy' }
  if (gender === 'female') return { en: 'young woman, female', danbooru: '1girl' }
  return { en: 'androgynous young adult', danbooru: '1person' }
}

function buildSubjectDnaLines(params: {
  label: string
  promptTag: string
  name: string
  subject: Character | null | undefined
}): string[] {
  const name = params.name.trim() || params.label
  const hasRef = characterHasAppearanceReference(params.subject)
  const genderHint = extractCharacterGenderHintForImageGen(params.subject?.gender)
  const genderTags = genderSubjectTags(params.subject?.gender)
  const refNote = extractCharacterAppearanceRefNote(params.subject)
  const appearanceHint = extractCharacterAppearanceHint(params.subject)

  const lines: string[] = [`${params.label}（${name}）· prompt 主 tag：${params.promptTag}`]
  if (genderHint) lines.push(`  性别（硬性）：${genderHint}；tag 建议 ${genderTags.danbooru}, ${genderTags.en}`)
  else lines.push(`  性别：正文/档案未明时写 ${genderTags.danbooru} + 可见特征，禁止猜错男女`)

  if (hasRef) {
    lines.push(`  形象参考：已配置 → 用 ${params.promptTag}，禁止写脸型/发色/瞳色/五官`)
    if (refNote) lines.push(`  参考补充：${refNote}`)
  } else if (appearanceHint) {
    lines.push(`  无参考图 DNA（每条同框 prompt 须复用）：${appearanceHint}`)
  } else {
    lines.push(`  无参考图：${genderTags.danbooru}, ${genderTags.en} + 1～2 个可见特征`)
  }
  return lines
}

/** 写入 prompt 生成器的双人/多人 cast 说明 */
export function buildDatingPlotCastDnaBlock(ctx: DatingPlotCastContext): string {
  const charName = ctx.character?.name?.trim() || '约会角色'
  const playerName =
    ctx.playerDisplayName?.trim() ||
    ctx.playerIdentity?.name?.trim() ||
    '玩家'

  const lines: string[] = [
    '【同框规则·最高优先级】',
    '- 正文**仅 1 人**或空镜：只画该人/环境，禁止凭空加第二人。',
    '- 正文**玩家与约会角色同框**：须同时写 reference character + reference player（或各自 DNA tag），并写清 left/center/right 站位与互动动作。',
    '- 正文**≥3 人**（含 NPC）：约会角色=reference character；玩家=reference player；其余路人用 1boy/1girl/1man/1woman + 正文可见特征，禁止与两位主角混淆。',
    '- **性别硬性**：每位可见人物须带正确 1boy/1girl（或 male/female）；禁止把男性写成 1girl、女性写成 1boy，禁止 fused bodies / merged faces。',
    `- **本档 cast 性别锁定（禁止写反）**：约会主角 ${genderSubjectTags(ctx.character?.gender).danbooru}；玩家 ${genderSubjectTags(ctx.playerIdentity?.gender).danbooru}。`,
    '',
    ...buildSubjectDnaLines({
      label: '约会主角',
      promptTag: 'reference character',
      name: charName,
      subject: ctx.character,
    }),
    '',
    ...buildSubjectDnaLines({
      label: '玩家「你」',
      promptTag: 'reference player',
      name: playerName,
      subject: ctx.playerIdentity ?? null,
    }),
  ]
  return lines.join('\n')
}

/** 发往生图 API 时：区分角色参考图 vs 玩家参考图 */
export function buildDatingPlotCastReferenceLockNote(params: {
  character: Character | null | undefined
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
  characterRefCount: number
  playerRefCount: number
}): string {
  const charName = params.character?.name?.trim() || 'dating character'
  const playerName =
    params.playerDisplayName?.trim() ||
    params.playerIdentity?.name?.trim() ||
    'player'
  const charGender = extractCharacterGenderHintForImageGen(params.character?.gender)
  const playerGender = extractCharacterGenderHintForImageGen(params.playerIdentity?.gender)

  const charNote = extractCharacterAppearanceRefNote(params.character)
  const playerNote = extractCharacterAppearanceRefNote(params.playerIdentity)

  const parts: string[] = []
  if (params.characterRefCount > 0) {
    parts.push(
      `Reference images #1–#${params.characterRefCount} = DATING CHARACTER "${charName}"${charGender ? ` (${charGender})` : ''} — match prompt tag "reference character".`,
    )
    if (charNote) parts.push(`Dating character traits: ${charNote}`)
  }
  if (params.playerRefCount > 0) {
    const start = params.characterRefCount + 1
    const end = params.characterRefCount + params.playerRefCount
    parts.push(
      `Reference images #${start}–#${end} = PLAYER "${playerName}"${playerGender ? ` (${playerGender})` : ''} — match prompt tag "reference player".`,
    )
    if (playerNote) parts.push(`Player traits: ${playerNote}`)
  }
  if (params.characterRefCount > 0 && params.playerRefCount > 0) {
    parts.push(
      'TWO DIFFERENT PEOPLE in scene — preserve distinct faces, genders, and outfits; do NOT merge or swap identities.',
    )
  } else if (charGender) {
    parts.push(`Subject must stay ${charGender}; do NOT change gender presentation.`)
  }
  return parts.join(' ')
}
