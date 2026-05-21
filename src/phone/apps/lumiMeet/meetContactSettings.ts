import type { EncounterSwapMeta, MeetPublicProfile } from './meetTypes'

/** 遇见档案里配置的用户微信号（交换联络方式时展示给对方） */
export function resolveMeetUserContactWechatId(
  profile: Pick<MeetPublicProfile, 'contactWechatId'>,
  swap?: Pick<EncounterSwapMeta, 'userWechatId'> | null,
): string {
  return swap?.userWechatId?.trim() || profile.contactWechatId?.trim() || ''
}

/** 规范化用户输入的微信号（去空格，仅保留常见合法字符） */
export function normalizeMeetContactWechatIdInput(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 32)
}

export function isMeetContactWechatIdPlausible(id: string): boolean {
  const t = id.trim()
  if (t.length < 4) return false
  return /^[a-zA-Z][\w-]{3,31}$/.test(t)
}
