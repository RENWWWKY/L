export type UserAuditStatus = 'pending' | 'approved' | 'rejected' | 'correction_required'

export type CommunityVerifyReason =
  | 'ok'
  | 'skipped_admin'
  | 'not_configured'
  | 'missing_dc_id'
  | 'invalid_dc_id'
  | 'not_in_guild'
  | 'missing_role'
  | 'discord_unavailable'
  | 'bot_unauthorized'
  | 'bot_forbidden'

export type UserLoginStatus = {
  auditStatus: UserAuditStatus
  auditRejectReason: string
  auditInquiryImages?: string[]
  correctionRequestedAt?: string
  banStatus: 'normal' | 'banned'
  banReason: string
  username: string
  /** 是否持有官方 Discord 社区 Lumi 身份组；未配置服务端校验时为 true */
  communityVerified?: boolean
  communityVerifyReason?: CommunityVerifyReason | string
  communityVerifyMessage?: string
}

export type LumiSessionStatus = {
  username: string
  lumiOnline: boolean
  isThisDevice: boolean
  hasActiveSessionElsewhere: boolean
}

export type UserProfile = {
  username: string
  qq: string
  dcId: string
  discordHandle?: string
  discordDisplayName?: string
  auditStatus: UserAuditStatus
  auditRejectReason: string
  auditInquiryImages?: string[]
  correctionRequestedAt?: string
  banStatus: 'normal' | 'banned'
  banReason: string
  createdAt: string
  communityVerified?: boolean
  communityVerifyReason?: CommunityVerifyReason | string
  communityVerifyMessage?: string
}

export type UserAccountTab = 'announcement' | 'report' | 'unban' | 'overview' | 'auth'

export type UnbanApplicationSummary = {
  objectId: string
  reason: string
  correctedQq: string
  correctedDcId: string
  status: 'pending' | 'approved' | 'rejected'
  statusLabel: string
  adminNote: string
  createdAt: string
  reviewedAt: string
  evidenceCount: number
}

export type UnbanStatusState = {
  banned: boolean
  banReason: string
  currentQq: string
  currentDcId: string
  pendingApplication: boolean
  latestApplication: UnbanApplicationSummary | null
}

export type UserReportType = 'reship' | 'commercial' | 'both'

export type UserAuthSession = {
  token: string
  username: string
  status: UserLoginStatus
}

/** 是否可进入 Lumi 主页使用（封禁、审核驳回、待更正、未获社区身份组会拦截；待审核仅作后台核对，不影响使用） */
export function isUserActivated(status: UserLoginStatus | null | undefined): boolean {
  if (!status) return false
  if (status.banStatus === 'banned') return false
  if (status.auditStatus === 'rejected') return false
  if (status.auditStatus === 'correction_required') return false
  if (status.communityVerified === false) return false
  return true
}

export function needsCommunityRole(status: UserLoginStatus | null | undefined): boolean {
  return !!status && status.banStatus !== 'banned' && status.communityVerified === false
}

export function needsUserInfoCorrection(status: UserLoginStatus | null | undefined): boolean {
  return !!status && status.banStatus !== 'banned' && status.auditStatus === 'correction_required'
}
