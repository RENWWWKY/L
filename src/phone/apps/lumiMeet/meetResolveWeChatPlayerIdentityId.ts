/** 仅使用遇见 03 CONTACT 中显式绑定的玩家身份 id（不回退微信侧「当前身份」） */
export async function resolveMeetWeChatPlayerIdentityId(
  meetProfileBaseWeChatIdentityId?: string | null,
): Promise<string> {
  const fromProfile = meetProfileBaseWeChatIdentityId?.trim() ?? ''
  if (fromProfile && fromProfile !== '__none__') return fromProfile
  return ''
}
