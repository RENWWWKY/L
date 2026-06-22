import { getDeviceFingerprint, getPublicIp } from './deviceFingerprint'
import { readDiscordRegisterPending } from '../components/DiscordRegisterCompleteModal'
import {
  clearDiscordOAuthCallbackFromUrl,
  clearDiscordOAuthSession,
  consumeDiscordOAuthCallbackFromUrl,
  getDiscordRedirectUri,
  hasDiscordOAuthReturnInUrl,
  readDiscordOAuthCallbackFromUrl,
  type DiscordOAuthCallback,
} from './discordOAuth'
import { identifyDiscordUser, loginWithDiscord } from './userSystemApi'
import type { UserLoginStatus } from './types'

export type DiscordOAuthProcessResult =
  | { kind: 'login'; ok: true; status: UserLoginStatus; lumiEntry?: boolean }
  | { kind: 'login'; ok: false; error: string; banned?: boolean }
  | {
      kind: 'register'
      ok: true
      registerToken: string
      discordId: string
      discordHandle?: string
      discordDisplayName?: string
      discordUsername: string
      fromUnregisteredLogin?: boolean
    }
  | { kind: 'register'; ok: false; error: string }

export async function processDiscordOAuthCallback(
  callback: DiscordOAuthCallback,
): Promise<DiscordOAuthProcessResult> {
  const redirectUri = callback.redirectUri || getDiscordRedirectUri()
  if (callback.intent === 'register') {
    const r = await identifyDiscordUser(callback.code, redirectUri, { forRegister: true })
    if (!r.ok) return { kind: 'register', ok: false, error: r.error }
    if (!r.registerToken) {
      return { kind: 'register', ok: false, error: '注册授权失败，请稍后重试' }
    }
    return {
      kind: 'register',
      ok: true,
      registerToken: r.registerToken,
      discordId: r.discordId,
      discordHandle: r.discordHandle,
      discordDisplayName: r.discordDisplayName,
      discordUsername: r.discordUsername,
    }
  }

  const fp = await getDeviceFingerprint()
  const ip = await getPublicIp()
  const r = await loginWithDiscord(callback.code, redirectUri, {
    publicIp: ip,
    deviceId: fp.deviceId,
    deviceType: fp.deviceType,
  }, { lumiEntry: callback.lumiEntry })
  if (!r.ok) return { kind: 'login', ok: false, error: r.error, banned: r.banned }
  if (r.kind === 'register') {
    return {
      kind: 'register',
      ok: true,
      registerToken: r.registerToken,
      discordId: r.discordId,
      discordHandle: r.discordHandle,
      discordDisplayName: r.discordDisplayName,
      discordUsername: r.discordUsername,
      fromUnregisteredLogin: true,
    }
  }
  return { kind: 'login', ok: true, status: r.status, lumiEntry: callback.lumiEntry }
}

export function resolveDiscordAuthTabAfterOAuth(): 'login' | 'register' | null {
  const pending = readDiscordRegisterPending()
  if (pending) return pending.fromUnregisteredLogin ? 'login' : 'register'
  if (!hasDiscordOAuthReturnInUrl()) return null
  const callback = readDiscordOAuthCallbackFromUrl()
  if (!callback) return 'login'
  return callback.intent === 'register' ? 'register' : 'login'
}

let oauthCallbackFlight: { code: string; promise: Promise<DiscordOAuthProcessResult | null> } | null = null

export async function runDiscordOAuthCallbackFromUrl(): Promise<DiscordOAuthProcessResult | null> {
  const callback = consumeDiscordOAuthCallbackFromUrl()
  if (!callback) return null

  if (oauthCallbackFlight?.code === callback.code) {
    return oauthCallbackFlight.promise
  }

  const promise = processDiscordOAuthCallback(callback).finally(() => {
    if (oauthCallbackFlight?.code === callback.code) oauthCallbackFlight = null
  })
  oauthCallbackFlight = { code: callback.code, promise }
  return promise
}

/** @deprecated 使用 runDiscordOAuthCallbackFromUrl */
export function peekDiscordOAuthCallback(): DiscordOAuthCallback | null {
  return consumeDiscordOAuthCallbackFromUrl()
}

export function finalizeDiscordOAuthCallback(): void {
  clearDiscordOAuthSession()
  clearDiscordOAuthCallbackFromUrl()
}

export const DISCORD_REGISTER_RESULT_KEY = 'us_discord_register_result'

/** @deprecated 注册改由 DiscordRegisterCompleteModal + registerToken 流程 */
export function storeDiscordRegisterResult(payload: { discordId: string; discordUsername: string }): void {
  try {
    sessionStorage.setItem(DISCORD_REGISTER_RESULT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function consumeDiscordRegisterResult(): { discordId: string; discordUsername: string } | null {
  try {
    const raw = sessionStorage.getItem(DISCORD_REGISTER_RESULT_KEY)
    sessionStorage.removeItem(DISCORD_REGISTER_RESULT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { discordId?: string; discordUsername?: string }
    if (!parsed.discordId?.trim()) return null
    return {
      discordId: parsed.discordId.trim(),
      discordUsername: parsed.discordUsername?.trim() || '',
    }
  } catch {
    return null
  }
}

export const DISCORD_OAUTH_ERROR_KEY = 'us_discord_oauth_error'

export function storeDiscordOAuthError(message: string): void {
  try {
    sessionStorage.setItem(DISCORD_OAUTH_ERROR_KEY, message)
  } catch {
    /* ignore */
  }
}

export function consumeDiscordOAuthError(): string | null {
  try {
    const message = sessionStorage.getItem(DISCORD_OAUTH_ERROR_KEY)?.trim()
    sessionStorage.removeItem(DISCORD_OAUTH_ERROR_KEY)
    return message || null
  } catch {
    return null
  }
}
