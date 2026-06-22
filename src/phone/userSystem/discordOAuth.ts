export type DiscordOAuthIntent = 'login' | 'register'

/** 旧版 sessionStorage 键（兼容进行中的授权） */
const STATE_KEY = 'us_discord_oauth_state'
const INTENT_KEY = 'us_discord_oauth_intent'
const LUMI_ENTRY_KEY = 'us_discord_oauth_lumi_entry'
const REDIRECT_URI_KEY = 'us_discord_oauth_redirect_uri'

const STATE_VERSION = 1 as const

type OAuthStatePayload = {
  v: typeof STATE_VERSION
  n: string
  i: 'l' | 'r'
  e: 0 | 1
  u: string
}

/** 防止同一页面内 code 被重复消费（StrictMode 等） */
let consumedOAuthCode: string | null = null

export function getDiscordClientId(): string | null {
  const id = (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined)?.trim()
  return id || null
}

/** 与 Discord Developer Portal 中 Redirect URI 完全一致（含 base 路径） */
export function getDiscordRedirectUri(): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return new URL(prefix, window.location.origin).href
}

/** 授权回调落地（URL 仍带 code），用于跳过开屏、直达账号页 */
export function hasDiscordOAuthReturnInUrl(): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  return !!(url.searchParams.get('code')?.trim() && url.searchParams.get('state')?.trim())
}

export function isDiscordOAuthConfigured(): boolean {
  return !!getDiscordClientId()
}

function randomNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64url: string): string | null {
  try {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function encodeOAuthState(payload: OAuthStatePayload): string {
  return toBase64Url(JSON.stringify(payload))
}

function decodeOAuthState(state: string): OAuthStatePayload | null {
  const raw = fromBase64Url(state)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<OAuthStatePayload>
    if (p.v !== STATE_VERSION || !p.n || (p.i !== 'l' && p.i !== 'r') || !p.u?.trim()) return null
    if (p.n.length < 16) return null
    return { v: 1, n: p.n, i: p.i, e: p.e === 1 ? 1 : 0, u: p.u.trim() }
  } catch {
    return null
  }
}

export function beginDiscordOAuth(options: {
  intent: DiscordOAuthIntent
  lumiEntry?: boolean
}): { ok: true } | { ok: false; error: string } {
  const clientId = getDiscordClientId()
  if (!clientId) {
    return { ok: false, error: '未配置 Discord 登录（VITE_DISCORD_CLIENT_ID）' }
  }

  const redirectUri = getDiscordRedirectUri()
  const state = encodeOAuthState({
    v: 1,
    n: randomNonce(),
    i: options.intent === 'register' ? 'r' : 'l',
    e: options.lumiEntry ? 1 : 0,
    u: redirectUri,
  })

  // 可选写入 sessionStorage，供旧版 state 回调兼容；失败不影响跳转
  try {
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(INTENT_KEY, options.intent)
    sessionStorage.setItem(LUMI_ENTRY_KEY, options.lumiEntry ? '1' : '0')
    sessionStorage.setItem(REDIRECT_URI_KEY, redirectUri)
  } catch {
    /* 部分内置浏览器禁用 storage，state 已编码在 URL 参数中 */
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify',
    state,
  })

  window.location.assign(`https://discord.com/oauth2/authorize?${params.toString()}`)
  return { ok: true }
}

export type DiscordOAuthCallback = {
  code: string
  state: string
  intent: DiscordOAuthIntent
  lumiEntry: boolean
  redirectUri: string
}

function parseCallbackFromEncodedState(code: string, state: string): DiscordOAuthCallback | null {
  const decoded = decodeOAuthState(state)
  if (!decoded) return null
  return {
    code,
    state,
    intent: decoded.i === 'r' ? 'register' : 'login',
    lumiEntry: decoded.e === 1,
    redirectUri: decoded.u,
  }
}

function parseCallbackFromLegacySession(code: string, state: string): DiscordOAuthCallback | null {
  let savedState = ''
  let intent: DiscordOAuthIntent = 'login'
  let lumiEntry = false
  let redirectUri = getDiscordRedirectUri()
  try {
    savedState = sessionStorage.getItem(STATE_KEY) || ''
    intent = sessionStorage.getItem(INTENT_KEY) === 'register' ? 'register' : 'login'
    lumiEntry = sessionStorage.getItem(LUMI_ENTRY_KEY) === '1'
    redirectUri = sessionStorage.getItem(REDIRECT_URI_KEY)?.trim() || redirectUri
  } catch {
    return null
  }
  if (!savedState || savedState !== state) return null
  return { code, state, intent, lumiEntry, redirectUri }
}

export function readDiscordOAuthCallbackFromUrl(): DiscordOAuthCallback | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')?.trim()
  const state = url.searchParams.get('state')?.trim()
  if (!code || !state) return null

  return parseCallbackFromEncodedState(code, state) ?? parseCallbackFromLegacySession(code, state)
}

/** 读取并立即清除 URL / session，防止 code 被重复使用（刷新、StrictMode 等） */
export function consumeDiscordOAuthCallbackFromUrl(): DiscordOAuthCallback | null {
  const callback = readDiscordOAuthCallbackFromUrl()
  if (!callback) return null
  if (consumedOAuthCode === callback.code) return null
  consumedOAuthCode = callback.code
  clearDiscordOAuthCallbackFromUrl()
  clearDiscordOAuthSession()
  return callback
}

export function clearDiscordOAuthCallbackFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('guild_id')
  url.searchParams.delete('permissions')
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(window.history.state, '', next)
}

export function clearDiscordOAuthSession(): void {
  try {
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(INTENT_KEY)
    sessionStorage.removeItem(LUMI_ENTRY_KEY)
    sessionStorage.removeItem(REDIRECT_URI_KEY)
  } catch {
    /* ignore */
  }
}
