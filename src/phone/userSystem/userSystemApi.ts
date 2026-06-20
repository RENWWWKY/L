import type { LumiSessionStatus, UnbanStatusState, UserLoginStatus, UserProfile, UserReportType } from './types'
import { getDeviceFingerprint } from './deviceFingerprint'
import { isLocalDevBypassAuth, LOCAL_DEV_MOCK_STATUS } from './localDevMode'

const TOKEN_KEY = 'us_auth_token'
const USERNAME_KEY = 'us_username'
const BANNED_NOTICE_KEY = 'us_banned_notice'
const SESSION_KICKED_NOTICE_KEY = 'us_session_kicked_notice'
const STATUS_CACHE_KEY = 'us_cached_user_status'
const PENDING_BAN_CHECK_KEY = 'us_pending_ban_check'
const PENDING_SESSION_CHECK_KEY = 'us_pending_session_check'

type CachedUserStatus = {
  status: UserLoginStatus
}

export const SESSION_KICKED_MESSAGE = '账号已在其他浏览器登录，请重新登录'

export type BannedNotice = {
  username: string
  message: string
}

export function formatBannedNotice(username: string, serverError?: string): string {
  const name = username.trim() || '当前账号'
  const reasonMatch = serverError?.match(/：(.+)$/)
  const reason = reasonMatch?.[1]?.trim()
  return reason ? `账号「${name}」已被封禁：${reason}` : `账号「${name}」已被封禁`
}

export function readBannedNotice(): BannedNotice | null {
  try {
    const raw = localStorage.getItem(BANNED_NOTICE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BannedNotice
    if (!parsed?.message) return null
    return parsed
  } catch {
    return null
  }
}

export function writeBannedNotice(username: string, serverError?: string): BannedNotice {
  const notice: BannedNotice = {
    username: username.trim(),
    message: formatBannedNotice(username, serverError),
  }
  try {
    localStorage.setItem(BANNED_NOTICE_KEY, JSON.stringify(notice))
  } catch {
    /* ignore */
  }
  markPendingBanStatusCheck()
  return notice
}

export function clearBannedNotice(): void {
  try {
    localStorage.removeItem(BANNED_NOTICE_KEY)
  } catch {
    /* ignore */
  }
}

export function readSessionKickedNotice(): string | null {
  try {
    return localStorage.getItem(SESSION_KICKED_NOTICE_KEY) || null
  } catch {
    return null
  }
}

export function writeSessionKickedNotice(message = SESSION_KICKED_MESSAGE): void {
  try {
    localStorage.setItem(SESSION_KICKED_NOTICE_KEY, message)
  } catch {
    /* ignore */
  }
  markPendingSessionCheck()
}

export function clearSessionKickedNotice(): void {
  try {
    localStorage.removeItem(SESSION_KICKED_NOTICE_KEY)
  } catch {
    /* ignore */
  }
  clearPendingSessionCheck()
}

export function handleLumiSessionDisplaced(message = SESSION_KICKED_MESSAGE): void {
  writeSessionKickedNotice(message)
  clearPendingBanStatusCheck()
  clearAuth()
}

/** 使用中检测到封禁：立即退回登录页 */
export function handleLumiBanned(serverError?: string): void {
  writeBannedNotice(getStoredUsername(), serverError)
  clearAuth()
}

function handleAuthFailure(error: string): void {
  if (/封禁/.test(error)) return
  if (/未登录|401|403/.test(error)) clearAuth()
}

function apiBase(): string {
  const base = import.meta.env.VITE_USER_SYSTEM_API_BASE as string | undefined
  return (base || '').replace(/\/+$/, '')
}

export function markPendingBanStatusCheck(): void {
  try {
    localStorage.setItem(PENDING_BAN_CHECK_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearPendingBanStatusCheck(): void {
  try {
    localStorage.removeItem(PENDING_BAN_CHECK_KEY)
  } catch {
    /* ignore */
  }
}

export function markPendingSessionCheck(): void {
  try {
    localStorage.setItem(PENDING_SESSION_CHECK_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearPendingSessionCheck(): void {
  try {
    localStorage.removeItem(PENDING_SESSION_CHECK_KEY)
  } catch {
    /* ignore */
  }
}

export function isPendingBanStatusCheck(): boolean {
  try {
    if (localStorage.getItem(PENDING_BAN_CHECK_KEY) === '1') return true
    if (readBannedNotice()) return true
    const cached = readCachedUserStatus()
    return cached?.status.banStatus === 'banned'
  } catch {
    return false
  }
}

export function isPendingSessionCheck(): boolean {
  try {
    if (localStorage.getItem(PENDING_SESSION_CHECK_KEY) === '1') return true
    return !!readSessionKickedNotice()
  } catch {
    return false
  }
}

export function clearPendingStatusChecks(): void {
  clearPendingBanStatusCheck()
  clearPendingSessionCheck()
}

/** 是否必须联网核查（仅上次封禁/挤下线后待复查时为 true） */
export function needsRemoteAuthCheck(): boolean {
  if (isLocalDevBypassAuth()) return false
  try {
    if (localStorage.getItem(PENDING_BAN_CHECK_KEY) === '1') return true
    if (localStorage.getItem(PENDING_SESSION_CHECK_KEY) === '1') return true
    return false
  } catch {
    return false
  }
}

/** 读取本地登录态（无网时用于直接进入 Lumi） */
export function readLocalUserLoginStatus(): UserLoginStatus | null {
  const cached = readCachedUserStatus()?.status ?? null
  if (cached) return cached
  const username = getStoredUsername()
  if (!getAuthToken() || !username) return null
  return {
    username,
    auditStatus: 'approved',
    auditRejectReason: '',
    banStatus: 'normal',
    banReason: '',
  }
}

/** 是否需要在打开时联网校验会话（仅待复查账号） */
export function shouldCheckLumiSessionOnOpen(): boolean {
  if (isLocalDevBypassAuth()) return false
  return needsRemoteAuthCheck() && !!getAuthToken()
}

function syncPendingFlagsFromStatus(status: UserLoginStatus): void {
  if (status.banStatus === 'banned') {
    markPendingBanStatusCheck()
    return
  }
  clearPendingBanStatusCheck()
}

function shouldFetchUserStatus(options?: { force?: boolean }): boolean {
  if (options?.force) return true
  if (isPendingBanStatusCheck()) return true
  return !readCachedUserStatus()
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    localStorage.removeItem(STATUS_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

function readCachedUserStatus(): CachedUserStatus | null {
  try {
    const raw = localStorage.getItem(STATUS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedUserStatus & { slotKey?: string }
    if (!parsed?.status) return null
    return { status: parsed.status }
  } catch {
    return null
  }
}

function writeCachedUserStatus(status: UserLoginStatus): void {
  try {
    const payload: CachedUserStatus = { status }
    localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  syncPendingFlagsFromStatus(status)
}

/** 通知服务端退出 Lumi，再清除本地登录态 */
export async function logoutUser(): Promise<void> {
  if (getAuthToken()) {
    await request('POST', '/api/auth/logout', {}, true)
  }
  clearAuth()
  clearBannedNotice()
  clearSessionKickedNotice()
  clearPendingStatusChecks()
}

/** Lumi 机前台活跃心跳（管理端「在线」仅据此判断） */
export async function sendLumiHeartbeat(): Promise<'ok' | 'session_conflict' | 'banned' | 'ignored'> {
  if (isLocalDevBypassAuth()) return 'ignored'
  if (!getAuthToken()) return 'ignored'
  const fp = await getDeviceFingerprint()
  const r = await request('POST', '/api/auth/lumi-heartbeat', { deviceId: fp.deviceId }, true)
  if (!r.ok && /封禁/.test(r.error)) {
    handleLumiBanned(r.error)
    return 'banned'
  }
  if (!r.ok && /其他浏览器|会话已|已在其他浏览器登录/.test(r.error)) {
    handleLumiSessionDisplaced(r.error)
    return 'session_conflict'
  }
  return r.ok ? 'ok' : 'ignored'
}

/** 检测是否已被其他浏览器挤下线 */
export async function watchLumiSession(): Promise<'ok' | 'displaced' | 'ignored'> {
  if (!getAuthToken()) return 'ignored'
  const fp = await getDeviceFingerprint()
  const status = await fetchLumiSessionStatus(fp.deviceId)
  if (!getAuthToken()) return 'displaced'
  if (!status) return 'ignored'
  if (status.hasActiveSessionElsewhere) {
    handleLumiSessionDisplaced()
    return 'displaced'
  }
  clearPendingSessionCheck()
  return 'ok'
}

/** 打开主页且账号待复查时：联网校验会话 / 封禁 */
export async function runLumiSessionGuard(): Promise<'ok' | 'displaced' | 'banned' | 'ignored'> {
  if (isLocalDevBypassAuth()) return 'ignored'
  if (!shouldCheckLumiSessionOnOpen()) return 'ignored'
  const sessionResult = await watchLumiSession()
  if (sessionResult === 'displaced') return 'displaced'
  const heartbeatResult = await sendLumiHeartbeat()
  if (heartbeatResult === 'session_conflict') return 'displaced'
  if (heartbeatResult === 'banned') return 'banned'
  return heartbeatResult === 'ok' ? 'ok' : 'ignored'
}

export async function fetchLumiSessionStatus(deviceId: string): Promise<LumiSessionStatus | null> {
  if (!getAuthToken()) return null
  const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
  const r = await request<LumiSessionStatus>('GET', `/api/auth/lumi-session${q}`)
  if (!r.ok) {
    handleAuthFailure(r.error || '')
    return null
  }
  return r.data
}

export function getAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  auth = true,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const base = apiBase()
  if (!base) return { ok: false, error: '未配置账号系统 API（VITE_USER_SYSTEM_API_BASE）' }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getAuthToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || `请求失败 (${res.status})` }
    }
    return { ok: true, data: data as T }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误，请检查网络或稍后重试' }
  }
}

export async function loginUser(
  username: string,
  password: string,
  trace: { publicIp: string; deviceId: string; deviceType: string },
  options?: { lumiEntry?: boolean },
): Promise<{ ok: true; status: UserLoginStatus } | { ok: false; error: string; banned?: boolean }> {
  const payload: Record<string, unknown> = { username, password, ...trace }
  if (options?.lumiEntry) payload.lumiEntry = true
  const r = await request<{ token: string; status: UserLoginStatus }>(
    'POST',
    '/api/auth/login',
    payload,
    false,
  )
  if (!r.ok) {
    const banned = /封禁/.test(r.error)
    if (banned && !options?.lumiEntry) markPendingBanStatusCheck()
    if (banned && options?.lumiEntry) writeBannedNotice(username, r.error)
    return { ok: false, error: r.error, banned }
  }
  try {
    localStorage.setItem(TOKEN_KEY, r.data.token)
    localStorage.setItem(USERNAME_KEY, r.data.status.username || username)
  } catch {
    /* ignore */
  }
  if (options?.lumiEntry && r.data.status.banStatus !== 'banned') {
    clearBannedNotice()
    clearSessionKickedNotice()
  }
  writeCachedUserStatus(r.data.status)
  if (r.data.status.banStatus !== 'banned') {
    clearPendingBanStatusCheck()
    clearBannedNotice()
  }
  return { ok: true, status: r.data.status }
}

export async function registerUser(payload: {
  username: string
  password: string
  qq: string
  dcId: string
  publicIp: string
  deviceId: string
  deviceType: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await request<{ username: string }>('POST', '/api/auth/register', payload, false)
  if (!r.ok) return r
  return { ok: true }
}

export async function recoverAccountByContact(payload: {
  qq?: string
  dcId?: string
}): Promise<{ ok: true; username: string; password: string } | { ok: false; error: string }> {
  const r = await request<{ username: string; password: string }>(
    'POST',
    '/api/auth/recover-account',
    {
      qq: payload.qq || '',
      dcId: payload.dcId || '',
    },
    false,
  )
  if (!r.ok) return r
  return { ok: true, username: r.data.username, password: r.data.password }
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  if (!getAuthToken()) return null
  const r = await request<{ profile: Record<string, unknown> }>('GET', '/api/user/profile')
  if (!r.ok) {
    handleAuthFailure(r.error || '')
    return null
  }
  clearBannedNotice()
  const p = r.data.profile
  return {
    username: String(p.username ?? ''),
    qq: String(p.qq ?? ''),
    dcId: String(p.dcId ?? ''),
    auditStatus: (p.auditStatus as UserProfile['auditStatus']) ?? 'pending',
    auditRejectReason: String(p.auditRejectReason ?? ''),
    auditInquiryImages: Array.isArray(p.auditInquiryImages)
      ? p.auditInquiryImages.filter((x): x is string => typeof x === 'string')
      : [],
    correctionRequestedAt: String(p.correctionRequestedAt ?? ''),
    banStatus: (p.banStatus as UserProfile['banStatus']) ?? 'normal',
    banReason: String(p.banReason ?? ''),
    createdAt: String(p.createdAt ?? ''),
  }
}

export async function fetchUserStatus(options?: { force?: boolean }): Promise<UserLoginStatus | null> {
  if (isLocalDevBypassAuth()) return LOCAL_DEV_MOCK_STATUS
  if (!getAuthToken()) return null

  if (!shouldFetchUserStatus(options)) {
    return readCachedUserStatus()?.status ?? null
  }

  const r = await request<{ status: UserLoginStatus }>('GET', '/api/auth/status')
  if (!r.ok) {
    handleAuthFailure(r.error || '')
    if (options?.force && isLikelyNetworkError(r.error || '')) {
      return null
    }
    const cached = readCachedUserStatus()
    return cached?.status ?? null
  }
  if (r.data.status.banStatus !== 'banned') {
    clearBannedNotice()
    clearPendingBanStatusCheck()
  } else {
    handleLumiBanned(
      `账号已被封禁${r.data.status.banReason ? `：${r.data.status.banReason}` : ''}`,
    )
    return null
  }
  writeCachedUserStatus(r.data.status)
  return r.data.status
}

function isLikelyNetworkError(message: string): boolean {
  if (!message.trim()) return true
  return /网络|fetch|failed|timeout|aborterror|dns|连接|无法|unreachable|enotfound|econnrefused/i.test(message)
}

export function getStoredUsername(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) || ''
  } catch {
    return ''
  }
}

export async function submitUserReport(payload: {
  reportType: UserReportType
  suspectQq: string
  suspectDcId: string
  suspectPlatformInfo: string
  description: string
  evidenceImages: string[]
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!getAuthToken()) return { ok: false, error: '请先登录后再提交举报' }
  const r = await request<{ message?: string }>('POST', '/api/reports/submit', payload, true)
  if (!r.ok) return r
  return { ok: true, message: r.data.message || '举报已提交，感谢你的反馈' }
}

export async function fetchUnbanStatus(): Promise<UnbanStatusState | null> {
  if (!getAuthToken()) return null
  const r = await request<UnbanStatusState>('GET', '/api/unban/status')
  if (!r.ok) return null
  return r.data
}

export async function submitUnbanApplication(payload: {
  reason: string
  evidenceImages: string[]
  correctedQq: string
  correctedDcId: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!getAuthToken()) return { ok: false, error: '登录已失效，请重新登录后再提交解封申请' }
  const r = await request<{ message?: string }>('POST', '/api/unban/apply', payload, true)
  if (!r.ok) return r
  return { ok: true, message: r.data.message || '解封申请已提交，请等待管理员审核' }
}

export async function submitUserInfoCorrection(payload: {
  qq: string
  dcId: string
}): Promise<{ ok: true; message: string; status: UserLoginStatus } | { ok: false; error: string }> {
  if (!getAuthToken()) return { ok: false, error: '登录已失效，请重新登录后再提交' }
  const r = await request<{ message?: string; status: UserLoginStatus }>('POST', '/api/user/correction', payload, true)
  if (!r.ok) return r
  if (r.data.status) writeCachedUserStatus(r.data.status)
  return {
    ok: true,
    message: r.data.message || '信息已提交，请等待管理员重新审核',
    status: r.data.status,
  }
}
