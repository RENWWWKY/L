import type { UserLoginStatus, UserProfile } from './types'
import { formatBeijingDateTime } from './beijingTime'

export function accountStatusLabel(
  status: Pick<UserLoginStatus | UserProfile, 'auditStatus' | 'banStatus'> & {
    communityVerified?: boolean
  },
): { label: string; tone: 'normal' | 'pending' | 'banned' | 'rejected' } {
  if (status.banStatus === 'banned') return { label: '封禁', tone: 'banned' }
  if (status.communityVerified === false) return { label: '未获身份组', tone: 'rejected' }
  if (status.auditStatus === 'correction_required') return { label: '待更正', tone: 'rejected' }
  if (status.auditStatus === 'approved') return { label: '正常', tone: 'normal' }
  if (status.auditStatus === 'rejected') return { label: '审核拒绝', tone: 'rejected' }
  return { label: '待审核', tone: 'pending' }
}

/** 社区 Lumi 身份组展示文案（账号概览等） */
export function communityRoleStatusLabel(
  status: Pick<UserLoginStatus | UserProfile, 'communityVerified' | 'communityVerifyReason'> | null | undefined,
): { label: string; tone: 'normal' | 'pending' | 'banned' | 'rejected' } | null {
  if (!status || status.communityVerified === undefined) return null
  if (status.communityVerified) {
    if (status.communityVerifyReason === 'not_configured') {
      return { label: '未启用检测', tone: 'pending' }
    }
    if (status.communityVerifyReason === 'skipped_admin') {
      return { label: '管理员（未绑 Discord）', tone: 'pending' }
    }
    return { label: '已获得', tone: 'normal' }
  }
  if (status.communityVerifyReason === 'discord_unavailable') {
    return { label: '暂时无法验证', tone: 'pending' }
  }
  if (status.communityVerifyReason === 'bot_unauthorized' || status.communityVerifyReason === 'bot_forbidden') {
    return { label: '验证服务异常', tone: 'pending' }
  }
  if (status.communityVerifyReason === 'missing_dc_id') {
    return { label: '未绑定 Discord', tone: 'rejected' }
  }
  if (status.communityVerifyReason === 'invalid_dc_id') {
    return { label: 'Discord ID 格式错误', tone: 'rejected' }
  }
  if (status.communityVerifyReason === 'not_in_guild') {
    return { label: '未加入社区', tone: 'rejected' }
  }
  return { label: '未获得', tone: 'rejected' }
}

export function formatAccountDate(iso: string): string {
  return formatBeijingDateTime(iso)
}
