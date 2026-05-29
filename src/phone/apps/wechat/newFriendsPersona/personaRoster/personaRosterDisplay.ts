import { resolveCharacterAvatarUrl } from '../../../../utils/characterAvatarUrl'
import { resolvePlayerIdentityPreviewAvatar } from '../mbtiProfileUi'
import type { Character, PlayerIdentity } from '../types'
import { genderLabelZh } from '../utils'
import { formatPlayerIdentityDisplayName } from '../../wechatCharacterPlayerIdentity'
import {
  formatWechatAccountLabel,
  resolvePlayerIdentityWechatAccountId,
} from '../../wechatContactIdentityPrompt'
import type { WechatAccountsBundle } from '../../wechatAccountTypes'
import { boundMainCharId } from './personaRosterTypes'

export const PERSONA_SERIF =
  '"Cormorant Garamond", "Noto Serif SC", "STSong", "STKaiti", "Songti SC", Georgia, serif'

export function resolvePersonaWechatAvatarSrc(
  character: Pick<Character, 'avatarUrl'> | null | undefined,
): string {
  return resolveCharacterAvatarUrl({ avatarUrl: character?.avatarUrl })
}

export function resolvePersonaIdentityAvatarSrc(
  identity: Pick<Character, 'avatarUrl' | 'mbti'> | null | undefined,
): string {
  if (!identity) return ''
  const preview = resolvePlayerIdentityPreviewAvatar({
    mbti: identity.mbti,
    avatarUrl: identity.avatarUrl,
  })
  if (preview.src) return preview.src
  return resolveCharacterAvatarUrl({ avatarUrl: identity.avatarUrl })
}

/** @deprecated 角色/NPC 请用 {@link resolvePersonaWechatAvatarSrc} */
export function resolvePersonaRosterAvatarSrc(
  character: Pick<Character, 'avatarUrl' | 'mbti'> | null | undefined,
): string {
  return resolvePersonaWechatAvatarSrc(character)
}

export function formatIdentityBindingDisplay(
  _character: Character,
  identityId: string | undefined,
  identityList: PlayerIdentity[],
  identityNameById: Record<string, string>,
): string {
  const pid = identityId?.trim()
  if (!pid) return '未绑定用户身份'
  return formatPlayerIdentityRosterLabel(pid, identityList, identityNameById)
}

/** 关系与绑定预览：身份姓名 + 职业标签 + 微信昵称 */
export function formatPlayerIdentityRosterLabel(
  identityId: string,
  identityList: PlayerIdentity[],
  identityNameById: Record<string, string>,
): string {
  const pid = identityId.trim()
  if (!pid) return '未命名身份'
  const row = identityList.find((i) => i.id === pid)
  const identityName = identityNameById[pid] || formatPlayerIdentityDisplayName(row, pid)
  const wxNick = row?.wechatNickname?.trim()
  if (wxNick) return `${identityName} @${wxNick}`
  return identityName
}

export function playerIdentityProfessionTag(
  identity: Pick<PlayerIdentity, 'identity'> | null | undefined,
): string | null {
  const tag = identity?.identity?.trim()
  return tag || null
}

export function formatAnchoredMainLabel(
  ch: Character,
  mainNameById: Record<string, string>,
): string {
  const rootId = boundMainCharId(ch)
  if (!rootId) return ''
  const name = mainNameById[rootId]?.trim() || '未命名主角'
  return `围绕 [${name}] 生成`
}

export function metaGender(ch: Character): string {
  return genderLabelZh(ch.gender)
}

export function metaMbti(ch: Character): string {
  return ch.mbti?.trim() || '—'
}

export function metaZodiac(ch: Character): string {
  return ch.zodiac?.trim() || '未设置'
}

export function formatIdentityWechatAccountSuffix(
  character: Character,
  identityId: string,
  identityList: PlayerIdentity[],
  accountsBundle: WechatAccountsBundle | null,
): string {
  const acc = resolvePlayerIdentityWechatAccountId(
    character,
    identityId,
    identityList.find((i) => i.id === identityId),
  )
  if (!acc) return ''
  return formatWechatAccountLabel(accountsBundle, acc)
}
