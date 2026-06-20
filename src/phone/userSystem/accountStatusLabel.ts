import type { UserLoginStatus, UserProfile } from './types'
import { formatBeijingDateTime } from './beijingTime'

export function accountStatusLabel(
  status: Pick<UserLoginStatus | UserProfile, 'auditStatus' | 'banStatus'>,
): { label: string; tone: 'normal' | 'pending' | 'banned' | 'rejected' } {
  if (status.banStatus === 'banned') return { label: '封禁', tone: 'banned' }
  if (status.auditStatus === 'approved') return { label: '正常', tone: 'normal' }
  if (status.auditStatus === 'rejected') return { label: '审核拒绝', tone: 'rejected' }
  return { label: '待审核', tone: 'pending' }
}

export function formatAccountDate(iso: string): string {
  return formatBeijingDateTime(iso)
}
