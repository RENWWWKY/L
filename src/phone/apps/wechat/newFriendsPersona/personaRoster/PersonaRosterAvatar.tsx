import {
  resolvePersonaIdentityAvatarSrc,
  resolvePersonaWechatAvatarSrc,
} from './personaRosterDisplay'
import type { Character } from '../types'

export function PersonaRosterAvatar({
  character,
  size = 40,
  className = '',
  kind = 'wechat',
}: {
  character: Pick<Character, 'avatarUrl' | 'mbti'> | null | undefined
  size?: number
  className?: string
  /** wechat：角色/NPC 微信资料头像；identity：玩家身份（可回落 MBTI 形象） */
  kind?: 'wechat' | 'identity'
}) {
  const src =
    kind === 'identity'
      ? resolvePersonaIdentityAvatarSrc(character)
      : resolvePersonaWechatAvatarSrc(character)
  const dim = `${size}px`
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: dim, height: dim }}
      />
    )
  }
  return (
    <div
      className={`shrink-0 rounded-full bg-[#F3F4F6] ${className}`}
      style={{ width: dim, height: dim }}
      aria-hidden
    />
  )
}
