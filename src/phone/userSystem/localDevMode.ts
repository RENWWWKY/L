import type { UserLoginStatus } from './types'

/** 本地 `npm run dev` 且 .env 开启时，跳过账号登录与状态校验（生产构建永不生效） */
export function isLocalDevBypassAuth(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === 'true'
}

export const LOCAL_DEV_MOCK_STATUS: UserLoginStatus = {
  username: 'local-dev',
  auditStatus: 'approved',
  auditRejectReason: '',
  banStatus: 'normal',
  banReason: '',
}
