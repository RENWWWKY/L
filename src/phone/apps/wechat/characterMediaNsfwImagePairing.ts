import type { Gender } from './newFriendsPersona/types'

export type CharacterMediaNsfwImagePairing = 'solo' | 'bg' | 'bl' | 'gl'

const GL_EXPLICIT_RE =
  /\b(?:2girls?|yuri|lesbian|girls?\s*love|gl\b)\b|百合|女同|拉拉|姬圈|女女|两个女生|两个女孩|两位女生|两位女孩/i

const BL_EXPLICIT_RE =
  /\b(?:2boys?|yaoi|boys?\s*love|bl\b|bara)\b|男同|耽美|基佬|攻受|两个男生|两个男孩|两位男生|两位男孩|男男/i

const DUAL_INTIMATE_RE =
  /\b(?:two people|couple|partner|together|sex\b|fellatio|missionary|cowgirl|doggy|handjob|cunnilingus|tribadism)\b|两人|双人|同框|一起|对方|伴侣|reference player|1girl,\s*1boy|1boy,\s*1girl|2girls?|2boys?/i

const SOLO_HINT_RE =
  /\b(?:solo|selfie|mirror selfie|masturbat|only (?:her|him|one person))\b|单人|独自|自拍|自慰|只有(?:她|他|我)/i

export function detectCharacterMediaNsfwImagePairing(params: {
  imagePrompt: string
  chatContextTail?: string
  characterGender?: Gender | null
  playerGender?: Gender | null
}): CharacterMediaNsfwImagePairing {
  const combined = [params.imagePrompt, params.chatContextTail].filter(Boolean).join('\n')
  if (!combined.trim()) return 'solo'

  if (GL_EXPLICIT_RE.test(combined)) return 'gl'
  if (BL_EXPLICIT_RE.test(combined)) return 'bl'

  const charG = params.characterGender
  const playerG = params.playerGender
  const dualLikely = DUAL_INTIMATE_RE.test(combined)
  const soloLikely = SOLO_HINT_RE.test(combined)

  if (charG === 'female' && playerG === 'female' && dualLikely && !soloLikely) return 'gl'
  if (charG === 'male' && playerG === 'male' && dualLikely && !soloLikely) return 'bl'
  if (
    charG &&
    playerG &&
    charG !== playerG &&
    charG !== 'other' &&
    playerG !== 'other' &&
    dualLikely &&
    !soloLikely
  ) {
    return 'bg'
  }

  if (dualLikely && !soloLikely) return 'bg'
  return 'solo'
}

export function pairingLabelZh(pairing: CharacterMediaNsfwImagePairing): string {
  if (pairing === 'gl') return 'GL（女女 / yuri）'
  if (pairing === 'bl') return 'BL（男男 / yaoi）'
  if (pairing === 'bg') return 'BG（男女）'
  return '单人'
}
