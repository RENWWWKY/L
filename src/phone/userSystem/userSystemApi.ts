import type { LumiSessionStatus, UnbanStatusState, UserLoginStatus, UserProfile, UserReportType } from './types'
import { isUserActivated, needsUserInfoCorrection } from './types'
import { getDeviceFingerprint } from './deviceFingerprint'
import { isLocalDevBypassAuth, LOCAL_DEV_MOCK_STATUS } from './localDevMode'

const TOKEN_KEY = 'us_auth_token'
const USERNAME_KEY = 'us_username'
const BANNED_NOTICE_KEY = 'us_banned_notice'
const SESSION_KICKED_NOTICE_KEY = 'us_session_kicked_notice'
const STATUS_CACHE_KEY = 'us_cached_user_status'
const PENDING_BAN_CHECK_KEY = 'us_pending_ban_check'
const PENDING_SESSION_CHECK_KEY = 'us_pending_session_check'
const PENDING_CORRECTION_CHECK_KEY = 'us_pending_correction_check'
const AUTH_VERIFIED_KEY = 'us_auth_verified'

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
  // 401/未登录：token 失效；用户不存在/Not Found/404：账号已删但本地仍留着旧 token。
  // 若不清理，会一直卡在「重新验证账号状态」，误报成网络超时。
  if (/未登录|401|403|用户不存在|Not Found|404/.test(error)) clearAuth()
}

export const STATUS_CHECK_MIN_OVERLAY_MS = 500
export const STATUS_FETCH_TIMEOUT_MS = 10000

export const STATUS_CHECK_NETWORK_ERROR =
  '网络连接失败或超时（10 秒），请打开梯子后点击「重新验证账号状态」'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function waitForStatusCheckOverlay(): Promise<void> {
  await sleep(STATUS_CHECK_MIN_OVERLAY_MS)
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

export function markPendingCorrectionCheck(): void {
  try {
    localStorage.setItem(PENDING_CORRECTION_CHECK_KEY, '1')
    localStorage.removeItem(AUTH_VERIFIED_KEY)
  } catch {
    /* ignore */
  }
}

export function clearPendingCorrectionCheck(): void {
  try {
    localStorage.removeItem(PENDING_CORRECTION_CHECK_KEY)
  } catch {
    /* ignore */
  }
}

export function isPendingCorrectionCheck(): boolean {
  try {
    if (localStorage.getItem(PENDING_CORRECTION_CHECK_KEY) === '1') return true
    const cached = readCachedUserStatus()
    return cached?.status.auditStatus === 'correction_required'
  } catch {
    return false
  }
}

export function clearPendingStatusChecks(): void {
  clearPendingBanStatusCheck()
  clearPendingSessionCheck()
  clearPendingCorrectionCheck()
}

export function readAuthVerified(): boolean {
  try {
    return localStorage.getItem(AUTH_VERIFIED_KEY) === '1'
  } catch {
    return false
  }
}

export function setAuthVerified(): void {
  try {
    localStorage.setItem(AUTH_VERIFIED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearAuthVerified(): void {
  try {
    localStorage.removeItem(AUTH_VERIFIED_KEY)
  } catch {
    /* ignore */
  }
}

function markAuthVerifiedIfActivated(status: UserLoginStatus): void {
  if (isUserActivated(status)) {
    setAuthVerified()
  }
}

/** 是否须在主页显示「正在检测账号状态」（页面刷新后开屏结束且已登录） */
export function shouldShowAccountStatusCheck(): boolean {
  if (isLocalDevBypassAuth()) return false
  if (getAuthToken()) return true
  return !!readBannedNotice()
}

/** 本地已知的封禁 / 待更正状态（无网也可用来展示检测弹窗与拦截面板） */
export function readLocalAccountGateStatus(): UserLoginStatus | null {
  const cached = readCachedUserStatus()?.status ?? null
  if (cached?.auditStatus === 'correction_required') return cached
  if (cached && !isUserActivated(cached)) return cached

  const bannedNotice = readBannedNotice()
  if (!bannedNotice) return null

  if (cached?.banStatus === 'banned') return cached

  return {
    username: bannedNotice.username || getStoredUsername() || '当前账号',
    auditStatus: 'approved',
    auditRejectReason: '',
    banStatus: 'banned',
    banReason: '',
  }
}

/** 本地是否处于须拦截进入 Lumi 的账号状态（封禁 / 待更正） */
export function isLocallyAccountGated(): boolean {
  if (isPendingBanStatusCheck()) return true
  if (isPendingCorrectionCheck()) return true
  const local = readLocalUserLoginStatus()
  if (!local) return true
  if (!isUserActivated(local)) return true
  if (needsUserInfoCorrection(local)) return true
  return false
}

/** 无网时是否允许凭本地缓存直接进入 Lumi（仅正常已验证账号） */
export function canEnterHomeOffline(): boolean {
  if (isLocalDevBypassAuth()) return true
  if (!getAuthToken()) return false
  if (!readAuthVerified()) return false
  if (isLocallyAccountGated()) return false
  const local = readLocalUserLoginStatus()
  return !!local && isUserActivated(local)
}

/** 联网验证失败时：若本地已有封禁/待更正等拦截态，由对应弹窗处理，不再重复网络报错 */
export function resolveOfflineAuthVerifyError(local: UserLoginStatus | null): string | null {
  if (canEnterHomeOffline()) return null
  if (local && needsUserInfoCorrection(local)) return null
  if (local && !isUserActivated(local)) return null
  return '无法连接账号服务器，请打开梯子后点击「重新验证账号状态」'
}

/** 是否必须联网核查（封禁 / 挤下线 / 待更正） */
export function needsRemoteAuthCheck(): boolean {
  if (isLocalDevBypassAuth()) return false
  try {
    if (localStorage.getItem(PENDING_BAN_CHECK_KEY) === '1') return true
    if (localStorage.getItem(PENDING_SESSION_CHECK_KEY) === '1') return true
    if (localStorage.getItem(PENDING_CORRECTION_CHECK_KEY) === '1') return true
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
    clearPendingCorrectionCheck()
    return
  }
  clearPendingBanStatusCheck()
  if (status.auditStatus === 'correction_required') {
    markPendingCorrectionCheck()
  } else {
    clearPendingCorrectionCheck()
  }
}

function shouldFetchUserStatus(options?: { force?: boolean }): boolean {
  if (options?.force) return true
  if (isPendingBanStatusCheck()) return true
  if (isPendingCorrectionCheck()) return true
  return !readCachedUserStatus()
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    localStorage.removeItem(STATUS_CACHE_KEY)
    localStorage.removeItem(AUTH_VERIFIED_KEY)
    localStorage.removeItem(PENDING_CORRECTION_CHECK_KEY)
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
export async function sendLumiHeartbeat(): Promise<
  'ok' | 'session_conflict' | 'banned' | 'community_required' | 'ignored'
> {
  if (isLocalDevBypassAuth()) return 'ignored'
  if (!getAuthToken()) return 'ignored'
  const fp = await getDeviceFingerprint()
  const r = await request<Record<string, never>>('POST', '/api/auth/lumi-heartbeat', { deviceId: fp.deviceId }, true)
  if (!r.ok && /封禁/.test(r.error)) {
    handleLumiBanned(r.error)
    return 'banned'
  }
  if (!r.ok && /身份组|社区身份|Discord 社区|Discord ID/.test(r.error)) {
    clearAuthVerified()
    return 'community_required'
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
export async function runLumiSessionGuard(): Promise<
  'ok' | 'displaced' | 'banned' | 'community_required' | 'ignored'
> {
  if (isLocalDevBypassAuth()) return 'ignored'
  if (!shouldCheckLumiSessionOnOpen()) return 'ignored'
  const sessionResult = await watchLumiSession()
  if (sessionResult === 'displaced') return 'displaced'
  const heartbeatResult = await sendLumiHeartbeat()
  if (heartbeatResult === 'session_conflict') return 'displaced'
  if (heartbeatResult === 'banned') return 'banned'
  if (heartbeatResult === 'community_required') return 'community_required'
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
  timeoutMs?: number,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const base = apiBase()
  if (!base) return { ok: false, error: '未配置账号系统 API（VITE_USER_SYSTEM_API_BASE）' }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getAuthToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const controller = timeoutMs != null ? new AbortController() : null
  const timer =
    controller != null
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null

  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || `请求失败 (${res.status})` }
    }
    return { ok: true, data: data as T }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, error: '网络连接超时，请打开梯子后重试' }
    }
    return { ok: false, error: e instanceof Error ? e.message : '网络错误，请检查网络或稍后重试' }
  } finally {
    if (timer != null) window.clearTimeout(timer)
  }
}

function persistAuthLogin(
  username: string,
  data: { token: string; status: UserLoginStatus },
  options?: { lumiEntry?: boolean },
): UserLoginStatus {
  try {
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USERNAME_KEY, data.status.username || username)
  } catch {
    /* ignore */
  }
  if (options?.lumiEntry && data.status.banStatus !== 'banned') {
    clearBannedNotice()
    clearSessionKickedNotice()
  }
  writeCachedUserStatus(data.status)
  if (data.status.banStatus !== 'banned') {
    clearPendingBanStatusCheck()
    clearBannedNotice()
  }
  if (data.status.auditStatus === 'correction_required') {
    markPendingCorrectionCheck()
  } else if (options?.lumiEntry && isUserActivated(data.status)) {
    setAuthVerified()
  }
  return data.status
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
  return { ok: true, status: persistAuthLogin(username, r.data, options) }
}

export async function loginWithDiscord(
  code: string,
  redirectUri: string,
  trace: { publicIp: string; deviceId: string; deviceType: string },
  options?: { lumiEntry?: boolean },
): Promise<
  | { ok: true; kind: 'session'; status: UserLoginStatus }
  | { ok: true; kind: 'register'; registerToken: string; discordId: string; discordHandle?: string; discordDisplayName?: string; discordUsername: string }
  | { ok: false; error: string; banned?: boolean }
> {
  const payload: Record<string, unknown> = { code, redirectUri, ...trace }
  if (options?.lumiEntry) payload.lumiEntry = true
  const r = await request<{
    token?: string
    status?: UserLoginStatus
    needsRegister?: boolean
    registerToken?: string
    discordId?: string
    discordHandle?: string
    discordDisplayName?: string
    discordUsername?: string
  }>(
    'POST',
    '/api/auth/discord/login',
    payload,
    false,
  )
  if (!r.ok) {
    const banned = /封禁/.test(r.error)
    const username = getStoredUsername()
    if (banned && !options?.lumiEntry) markPendingBanStatusCheck()
    if (banned && options?.lumiEntry) writeBannedNotice(username, r.error)
    return { ok: false, error: r.error, banned }
  }
  if (r.data.needsRegister && r.data.registerToken && r.data.discordId) {
    return {
      ok: true,
      kind: 'register',
      registerToken: r.data.registerToken,
      discordId: r.data.discordId,
      discordHandle: r.data.discordHandle?.trim() || '',
      discordDisplayName: r.data.discordDisplayName?.trim() || r.data.discordUsername?.trim() || '',
      discordUsername: r.data.discordUsername?.trim() || r.data.discordDisplayName?.trim() || '',
    }
  }
  if (!r.data.token || !r.data.status) {
    return { ok: false, error: 'Discord 登录响应异常，请稍后重试' }
  }
  const username = r.data.status.username || getStoredUsername()
  return {
    ok: true,
    kind: 'session',
    status: persistAuthLogin(username, { token: r.data.token, status: r.data.status }, options),
  }
}

export async function identifyDiscordUser(
  code: string,
  redirectUri: string,
  options?: { forRegister?: boolean },
): Promise<
  | { ok: true; discordId: string; discordHandle?: string; discordDisplayName?: string; discordUsername: string; registerToken?: string }
  | { ok: false; error: string }
> {
  const payload: Record<string, unknown> = { code, redirectUri }
  if (options?.forRegister) payload.forRegister = true
  const r = await request<{
    discordId: string
    discordHandle?: string
    discordDisplayName?: string
    discordUsername?: string
    registerToken?: string
  }>(
    'POST',
    '/api/auth/discord/identify',
    payload,
    false,
  )
  if (!r.ok) return r
  return {
    ok: true,
    discordId: r.data.discordId,
    discordHandle: r.data.discordHandle?.trim() || '',
    discordDisplayName: r.data.discordDisplayName?.trim() || r.data.discordUsername?.trim() || '',
    discordUsername: r.data.discordUsername?.trim() || r.data.discordDisplayName?.trim() || '',
    registerToken: r.data.registerToken?.trim() || undefined,
  }
}

export type DiscordRegisterConflict = {
  objectId: string
  username: string
  qq: string
  dcId: string
  matchReasons: string[]
}

export async function registerWithDiscord(payload: {
  registerToken: string
  username: string
  password: string
  qq?: string
  publicIp: string
  deviceId: string
  deviceType: string
  confirmReplace?: boolean
}): Promise<
  | { ok: true }
  | {
      ok: true
      needsReplaceConfirm: true
      conflicts: DiscordRegisterConflict[]
      message: string
    }
  | { ok: false; error: string }
> {
  const r = await request<{
    username?: string
    needsReplaceConfirm?: boolean
    conflicts?: DiscordRegisterConflict[]
    message?: string
  }>('POST', '/api/auth/discord/register', payload, false)
  if (!r.ok) return r
  if (r.data.needsReplaceConfirm) {
    return {
      ok: true,
      needsReplaceConfirm: true,
      conflicts: Array.isArray(r.data.conflicts) ? r.data.conflicts : [],
      message:
        r.data.message?.trim() ||
        '检测到重复的旧账号信息。确认后将回收旧登录账号；本浏览器玩法数据不会丢失。',
    }
  }
  return { ok: true }
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
    payload,
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
    discordHandle: String(p.discordHandle ?? ''),
    discordDisplayName: String(p.discordDisplayName ?? ''),
    auditStatus: (p.auditStatus as UserProfile['auditStatus']) ?? 'pending',
    auditRejectReason: String(p.auditRejectReason ?? ''),
    auditInquiryImages: Array.isArray(p.auditInquiryImages)
      ? p.auditInquiryImages.filter((x): x is string => typeof x === 'string')
      : [],
    correctionRequestedAt: String(p.correctionRequestedAt ?? ''),
    banStatus: (p.banStatus as UserProfile['banStatus']) ?? 'normal',
    banReason: String(p.banReason ?? ''),
    createdAt: String(p.createdAt ?? ''),
    communityVerified: typeof p.communityVerified === 'boolean' ? p.communityVerified : undefined,
    communityVerifyReason:
      typeof p.communityVerifyReason === 'string' ? p.communityVerifyReason : undefined,
    communityVerifyMessage:
      typeof p.communityVerifyMessage === 'string' ? p.communityVerifyMessage : undefined,
  }
}

export async function fetchUserStatus(options?: {
  force?: boolean
  timeoutMs?: number
}): Promise<UserLoginStatus | null> {
  if (isLocalDevBypassAuth()) return LOCAL_DEV_MOCK_STATUS
  if (!getAuthToken()) return null

  if (!shouldFetchUserStatus(options)) {
    return readCachedUserStatus()?.status ?? null
  }

  const r = await request<{ status: UserLoginStatus }>(
    'GET',
    '/api/auth/status',
    undefined,
    true,
    options?.timeoutMs,
  )
  if (!r.ok) {
    handleAuthFailure(r.error || '')
    if (options?.force) {
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
  markAuthVerifiedIfActivated(r.data.status)
  return r.data.status
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

export async function updateUserProfile(payload: {
  qq?: string
  dcId?: string
}): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> {
  if (!getAuthToken()) return { ok: false, error: '登录已失效，请重新登录后再修改' }
  const r = await request<{ profile: Record<string, unknown> }>('POST', '/api/user/profile', payload, true)
  if (!r.ok) return r
  const p = r.data.profile
  const profile: UserProfile = {
    username: String(p.username ?? ''),
    qq: String(p.qq ?? ''),
    dcId: String(p.dcId ?? ''),
    discordHandle: String(p.discordHandle ?? ''),
    discordDisplayName: String(p.discordDisplayName ?? ''),
    auditStatus: (p.auditStatus as UserProfile['auditStatus']) ?? 'pending',
    auditRejectReason: String(p.auditRejectReason ?? ''),
    auditInquiryImages: Array.isArray(p.auditInquiryImages)
      ? p.auditInquiryImages.filter((x): x is string => typeof x === 'string')
      : [],
    correctionRequestedAt: String(p.correctionRequestedAt ?? ''),
    banStatus: (p.banStatus as UserProfile['banStatus']) ?? 'normal',
    banReason: String(p.banReason ?? ''),
    createdAt: String(p.createdAt ?? ''),
    communityVerified: typeof p.communityVerified === 'boolean' ? p.communityVerified : undefined,
    communityVerifyReason:
      typeof p.communityVerifyReason === 'string' ? p.communityVerifyReason : undefined,
    communityVerifyMessage:
      typeof p.communityVerifyMessage === 'string' ? p.communityVerifyMessage : undefined,
  }
  return { ok: true, profile }
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

export async function changeUserPassword(payload: {
  currentPassword: string
  newPassword: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!getAuthToken()) return { ok: false, error: '登录已失效，请重新登录后再修改密码' }
  const r = await request<{ message?: string }>('POST', '/api/user/change-password', payload, true)
  if (!r.ok) return r
  return { ok: true, message: r.data.message || '密码已修改' }
}
