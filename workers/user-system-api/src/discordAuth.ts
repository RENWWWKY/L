import { resolveDiscordIdentity, type DiscordEnv } from './discordOAuth'

export type UserLoginStatus = {
  auditStatus: 'pending' | 'approved' | 'rejected' | 'correction_required'
  auditRejectReason: string
  banStatus: 'normal' | 'banned'
  banReason: string
  username: string
}

export type UserAuthRecord = {
  username: string
  dcId: string
  banStatus: 'normal' | 'banned'
  banReason: string
  auditStatus: UserLoginStatus['auditStatus']
  auditRejectReason: string
}

export type DiscordLoginTrace = {
  publicIp: string
  deviceId: string
  deviceType: string
  lumiEntry?: boolean
}

export type DiscordAuthDeps = {
  findUserByDcId: (dcId: string) => Promise<UserAuthRecord | null>
  createLoginSession: (
    user: UserAuthRecord,
    trace: DiscordLoginTrace,
  ) => Promise<{ token: string; status: UserLoginStatus }>
}

type JsonResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string }

function json(data: JsonResult, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function readString(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? String(body[key]).trim() : ''
}

/**
 * POST /api/auth/discord/login
 * Body: { code, redirectUri, publicIp, deviceId, deviceType, lumiEntry? }
 */
export async function handleDiscordLoginRequest(
  request: Request,
  env: DiscordEnv,
  deps: DiscordAuthDeps,
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: '请求体无效' }, 400)
  }

  const code = readString(body, 'code')
  const redirectUri = readString(body, 'redirectUri')
  const publicIp = readString(body, 'publicIp')
  const deviceId = readString(body, 'deviceId')
  const deviceType = readString(body, 'deviceType')
  const lumiEntry = body.lumiEntry === true

  if (!code || !redirectUri) {
    return json({ ok: false, error: '缺少 code 或 redirectUri' }, 400)
  }
  if (!deviceId) {
    return json({ ok: false, error: '缺少 deviceId' }, 400)
  }

  const identity = await resolveDiscordIdentity(env, code, redirectUri)
  if (!identity.ok) return json(identity, 400)

  const user = await deps.findUserByDcId(identity.discordId)
  if (!user) {
    return json(
      {
        ok: false,
        error: '未找到与该 Discord 账号绑定的 Lumi 账号，请先注册并填写相同的 Discord ID',
      },
      404,
    )
  }

  if (user.banStatus === 'banned') {
    const reason = user.banReason?.trim()
    return json(
      {
        ok: false,
        error: reason ? `账号已被封禁：${reason}` : '账号已被封禁',
      },
      403,
    )
  }

  const session = await deps.createLoginSession(user, {
    publicIp,
    deviceId,
    deviceType,
    lumiEntry,
  })

  return json({
    ok: true,
    token: session.token,
    status: session.status,
  })
}

/**
 * POST /api/auth/discord/identify
 * Body: { code, redirectUri }
 */
export async function handleDiscordIdentifyRequest(
  request: Request,
  env: DiscordEnv,
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: '请求体无效' }, 400)
  }

  const code = readString(body, 'code')
  const redirectUri = readString(body, 'redirectUri')
  if (!code || !redirectUri) {
    return json({ ok: false, error: '缺少 code 或 redirectUri' }, 400)
  }

  const identity = await resolveDiscordIdentity(env, code, redirectUri)
  if (!identity.ok) return json(identity, 400)

  return json({
    ok: true,
    discordId: identity.discordId,
    discordUsername: identity.discordUsername,
  })
}
