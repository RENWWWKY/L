export type UserAuditStatus = 'pending' | 'approved' | 'rejected'

export type UserLoginStatus = {
  auditStatus: UserAuditStatus
  auditRejectReason: string
  banStatus: 'normal' | 'banned'
  banReason: string
  username: string
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
  auditStatus: UserAuditStatus
  auditRejectReason: string
  banStatus: 'normal' | 'banned'
  banReason: string
  createdAt: string
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

/** 是否可进入 Lumi 主页使用（封禁、审核驳回会拦截；待审核仅作后台核对，不影响使用） */
export function isUserActivated(status: UserLoginStatus | null | undefined): boolean {
  if (!status) return false
  if (status.banStatus === 'banned') return false
  if (status.auditStatus === 'rejected') return false
  return true
}
