import type { UserLoginStatus } from './types'

/** 本地 `npm run dev` 默认跳过账号校验；生产构建永不生效。设 VITE_LOCAL_DEV_BYPASS_AUTH=false 可关闭 */
export function isLocalDevBypassAuth(): boolean {
  if (!import.meta.env.DEV) return false
  const flag = String(import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH ?? '').trim().toLowerCase()
  if (flag === 'false' || flag === '0') return false
  return true
}

export const LOCAL_DEV_MOCK_STATUS: UserLoginStatus = {
  username: 'local-dev',
  auditStatus: 'approved',
  auditRejectReason: '',
  banStatus: 'normal',
  banReason: '',
  communityVerified: true,
  communityVerifyReason: 'ok',
  communityVerifyMessage: '',
}
