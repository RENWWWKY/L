import type { MeetPublicProfile } from './meetTypes'

/** 遇见「我的」未填写昵称时的对外展示默认名（与微信「我」页无关） */
export const MEET_DEFAULT_PUBLIC_DISPLAY_NAME = 'Lumi Meet'

/** 遇见对外展示昵称：仅读 meetProfile，不回落手机名片 / 微信主页 */
export function resolveMeetPublicDisplayName(
  profile: Pick<MeetPublicProfile, 'displayName'> | null | undefined,
): string {
  const t = profile?.displayName?.trim()
  return t || MEET_DEFAULT_PUBLIC_DISPLAY_NAME
}

/** 遇见临时会话己方头像：仅 meetAvatarUrl，不回落手机全局名片 */
export function resolveMeetSelfAvatarUrl(
  profile: Pick<MeetPublicProfile, 'meetAvatarUrl'> | null | undefined,
): string {
  return profile?.meetAvatarUrl?.trim() || ''
}
