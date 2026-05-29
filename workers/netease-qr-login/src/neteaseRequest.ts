import { encryptWeapi } from './neteaseCrypto'
import { neteaseWeapiViaUpstream } from './neteaseUpstream'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const DEFAULT_COOKIE =
  'os=pc; osver=Microsoft-Windows-10.0; appver=2.10.4; channel=netease; mobilename=netease;'

export type NeteaseApiResult<T = unknown> = {
  status: number
  body: T
  cookie: string
}

export type NeteaseRequestOptions = {
  /** Cloudflare 环境变量 NETEASE_UPSTREAM：NeteaseCloudMusicApi 兼容镜像根地址 */
  upstream?: string
}

function mergeCookie(existing: string, setCookie: string | null) {
  if (!setCookie) return existing
  const jar = new Map<string, string>()
  for (const part of `${existing}; ${setCookie}`.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

function collectSetCookies(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().join('; ')
  }
  return res.headers.get('Set-Cookie') ?? ''
}

let warmedCookie = ''

export async function warmNeteaseCookie(): Promise<string> {
  if (warmedCookie.includes('__csrf')) return warmedCookie
  try {
    const res = await fetch('https://music.163.com/', {
      method: 'GET',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    })
    warmedCookie = mergeCookie(DEFAULT_COOKIE, collectSetCookies(res))
  } catch {
    warmedCookie = DEFAULT_COOKIE
  }
  return warmedCookie
}

function parseNeteaseJson<T>(text: string, status: number): T {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error(
      `网易云返回空内容 (HTTP ${status})。Worker 在海外机房访问 music.163.com 常被拒，可在 Cloudflare 设置变量 NETEASE_UPSTREAM 指向国内 NeteaseCloudMusicApi 镜像`,
    )
  }
  try {
    return JSON.parse(trimmed) as T
  } catch {
    throw new Error(
      `网易云返回非 JSON (HTTP ${status}): ${trimmed.slice(0, 120)}`,
    )
  }
}

/** 直连 music.163.com weapi */
export async function neteaseWeapiDirect<T = unknown>(
  path: string,
  data: Record<string, unknown> = {},
  cookie = '',
): Promise<NeteaseApiResult<T>> {
  const baseCookie = cookie || (await warmNeteaseCookie())
  const csrfMatch = baseCookie.match(/__csrf=([^;]+)/)
  const csrfToken = csrfMatch?.[1] ?? ''

  const { params, encSecKey } = await encryptWeapi({
    csrf_token: csrfToken,
    ...data,
  })
  const body = new URLSearchParams({ params, encSecKey })
  const url = `https://music.163.com/weapi${path}?csrf_token=${encodeURIComponent(csrfToken)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Referer: 'https://music.163.com/',
      Origin: 'https://music.163.com',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Cookie: baseCookie,
    },
    body: body.toString(),
  })

  const mergedCookie = mergeCookie(baseCookie, collectSetCookies(res))
  if (mergedCookie) warmedCookie = mergedCookie

  const text = await res.text()
  const json = parseNeteaseJson<T>(text, res.status)
  return { status: res.status, body: json, cookie: mergedCookie }
}

/** 直连失败时自动走 NETEASE_UPSTREAM 镜像 */
export async function neteaseWeapi<T = unknown>(
  path: string,
  data: Record<string, unknown> = {},
  cookie = '',
  options?: NeteaseRequestOptions,
): Promise<NeteaseApiResult<T>> {
  const upstream = options?.upstream?.trim()
  try {
    return await neteaseWeapiDirect<T>(path, data, cookie)
  } catch (directErr) {
    if (!upstream) throw directErr
    return neteaseWeapiViaUpstream<T>(path, data, upstream)
  }
}
