export interface DiscordEnv {
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
}

export type DiscordTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  error?: string
  error_description?: string
}

export type DiscordUser = {
  id: string
  username: string
  global_name?: string | null
}

export async function exchangeDiscordCode(
  env: DiscordEnv,
  code: string,
  redirectUri: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const clientId = env.DISCORD_CLIENT_ID?.trim()
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Discord OAuth 未配置（DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET）' }
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = (await res.json().catch(() => ({}))) as DiscordTokenResponse
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `Discord token 交换失败 (${res.status})`
    return { ok: false, error: detail }
  }

  return { ok: true, accessToken: data.access_token }
}

export async function fetchDiscordUser(
  accessToken: string,
): Promise<{ ok: true; user: DiscordUser } | { ok: false; error: string }> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json().catch(() => ({}))) as Partial<DiscordUser> & {
    message?: string
  }
  if (!res.ok || !data.id) {
    return { ok: false, error: data.message || `Discord 用户信息获取失败 (${res.status})` }
  }
  return {
    ok: true,
    user: {
      id: String(data.id),
      username: String(data.username || ''),
      global_name: data.global_name ?? null,
    },
  }
}

export async function resolveDiscordIdentity(
  env: DiscordEnv,
  code: string,
  redirectUri: string,
): Promise<
  { ok: true; discordId: string; discordUsername: string } | { ok: false; error: string }
> {
  const token = await exchangeDiscordCode(env, code, redirectUri)
  if (!token.ok) return token

  const profile = await fetchDiscordUser(token.accessToken)
  if (!profile.ok) return profile

  const displayName = profile.user.global_name?.trim() || profile.user.username.trim()
  return {
    ok: true,
    discordId: profile.user.id,
    discordUsername: displayName,
  }
}
