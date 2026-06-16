import {
  clearNeteaseLoginCookie,
  getNeteaseLoginCookieSync,
  hydrateNeteaseLoginCookie,
  saveNeteaseLoginCookie,
} from './listenTogetherPersistence'

export { hydrateNeteaseLoginCookie }

/**
 * 社区公共网易云 API（主地址挂掉时 ncmGet 会自动切换下一个）。
 * 均为第三方服务，不保证长期可用；登录 Cookie 会经过对应服务器。
 */
export const PUBLIC_NCM_FALLBACK_BASES = [
  'https://apic.netstart.cn/music',
  'https://apis.netstart.cn/music',
  'https://docs-neteasecloudmusicapi.focalors.ltd',
  'https://api-enhanced-smoky-five.vercel.app',
] as const

/** 未配置 VITE_NETEASE_API_BASE 时使用 NetStart 公共实例 */
const DEFAULT_BASE = PUBLIC_NCM_FALLBACK_BASES[0]

/** 探测到可用公共节点后缓存，减少重复切换 */
let activeNcmBase: string | null = null

export function isWorkerOnlyMode(): boolean {
  return !isLocalNcmMode() && getNeteaseApiBase().includes('workers.dev')
}

const FETCH_TIMEOUT_MS = 25_000
/** 可选接口（NetStart 不支持的 enhanced 路径）快速失败，避免拖慢同步 */
const NCM_OPTIONAL_TIMEOUT_MS = 10_000

const LOCAL_NCM_HOST_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/i

/** 开发环境下本机 HTTP API 走 Vite 同源代理，避免 HTTPS 页面 Mixed Content 拦截 */
export const NCM_DEV_PROXY_PREFIX = '/ncm-api'

/** 当前是否为 NetStart 公共 API（Binaryify 原版，无 enhanced 专属接口） */
export function isNetStartPublicApi(): boolean {
  return getNeteaseApiBase().includes('netstart.cn')
}

export function getNeteaseApiBase(): string {
  const fromEnv = (import.meta.env.VITE_NETEASE_API_BASE as string | undefined)?.trim()
  const base = (fromEnv || DEFAULT_BASE).replace(/\/+$/, '')
  if (
    import.meta.env.DEV &&
    (base === NCM_DEV_PROXY_PREFIX || LOCAL_NCM_HOST_RE.test(base))
  ) {
    return NCM_DEV_PROXY_PREFIX
  }
  return base
}

function buildNeteaseRequestUrl(path: string): URL {
  const base = getNeteaseApiBase()
  if (base.startsWith('/')) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://127.0.0.1:5173'
    return new URL(`${base}${path}`, origin)
  }
  return new URL(`${base}${path}`)
}

/** 走 NeteaseCloudMusicApi 标准路径，含本机、公网公共实例 */
export function isLocalNcmMode(): boolean {
  const mode = (import.meta.env.VITE_NETEASE_API_MODE as string | undefined)?.trim()
  if (mode === 'ncm') return true
  if (mode === 'worker') return false
  const base = getNeteaseApiBase()
  if (base === NCM_DEV_PROXY_PREFIX) return true
  if (LOCAL_NCM_HOST_RE.test(base)) return true
  return !base.includes('workers.dev')
}

type ApiEnvelope<T> = {
  code: number
  message?: string | null
  data?: T
  cookie?: string
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs / 1000}秒）`)
    }
    if (e instanceof TypeError) {
      throw new Error('网络连接失败')
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

function getNcmCandidateBases(): string[] {
  const configured = getNeteaseApiBase().replace(/\/+$/, '')
  const fromEnv = (import.meta.env.VITE_NETEASE_API_BASE as string | undefined)?.trim()
  /** 用户已在 .env 指定 API 时，同步只打该节点，避免失败时串测多个公共站导致极慢 */
  if (fromEnv) return [configured]

  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [configured, ...PUBLIC_NCM_FALLBACK_BASES]) {
    const base = raw.replace(/\/+$/, '')
    if (!base || seen.has(base)) continue
    seen.add(base)
    out.push(base)
  }
  return out
}

function buildNcmRequestUrl(base: string, path: string, params?: Record<string, string>): string {
  let url: URL
  if (base.startsWith('/')) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://127.0.0.1:5173'
    url = new URL(`${base}${path}`, origin)
  } else {
    url = new URL(`${base}${path}`)
  }
  url.searchParams.set('timestamp', String(Date.now()))
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return url.toString()
}

function isNcmInfrastructureError(message: string): boolean {
  return /请求超时|网络连接|无法连接|接口无响应|接口不存在|502|503|504/i.test(message)
}

async function ncmGet(
  path: string,
  params?: Record<string, string>,
  timeoutMs = FETCH_TIMEOUT_MS,
) {
  const bases = activeNcmBase
    ? [activeNcmBase, ...getNcmCandidateBases().filter((b) => b !== activeNcmBase)]
    : getNcmCandidateBases()

  let lastError: Error | null = null
  for (const base of bases) {
    try {
      const res = await fetchWithTimeout(buildNcmRequestUrl(base, path, params), undefined, timeoutMs)
      let json: Record<string, unknown>
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        throw new Error(`接口无响应 (${res.status})`)
      }
      if (!res.ok) {
        const msg = (json.message as string) ?? `请求失败 (${res.status})`
        if (res.status === 404) {
          throw new Error(`接口不存在 (404): ${path}，请核对 API 文档路径`)
        }
        throw new Error(msg)
      }
      activeNcmBase = base
      return json
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('无法连接网易云 API')
    }
  }

  if (lastError?.message) {
    const msg = lastError.message
    if (isNcmInfrastructureError(msg) && bases.length > 1) {
      throw new Error(`${msg}（已尝试 ${bases.length} 个公共节点）`)
    }
    throw lastError
  }
  throw new Error(
    bases.length > 1
      ? `所有公共 API 均不可用（已尝试 ${bases.length} 个节点）`
      : '所有公共 API 均不可用',
  )
}

/** 带 cookie 的 NCM 请求，并校验 body.code === 200 */
export async function ncmApiGet(path: string, cookie: string, params?: Record<string, string>) {
  if (!isLocalNcmMode()) {
    throw new Error('需配置 VITE_NETEASE_API_MODE=ncm 及网易云 API 地址')
  }
  const body = await ncmGet(path, { ...params, cookie })
  const code = typeof body.code === 'number' ? body.code : 200
  if (code !== 200) {
    throw new Error((body.message as string) ?? `接口错误 (${code})`)
  }
  return body
}

/** 可选接口：失败或超时返回 null，不阻塞主流程 */
export async function ncmApiGetOptional(
  path: string,
  cookie: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await ncmGet(path, { ...params, cookie }, NCM_OPTIONAL_TIMEOUT_MS)
    const code = typeof body.code === 'number' ? body.code : 200
    if (code !== 200) return null
    return body
  } catch {
    return null
  }
}

async function apiGet<T>(path: string, params?: Record<string, string>) {
  const url = buildNeteaseRequestUrl(path)
  url.searchParams.set('timestamp', String(Date.now()))
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetchWithTimeout(url.toString(), { method: 'GET' })
  const json = (await res.json()) as ApiEnvelope<T>
  if (!res.ok) {
    throw new Error(json.message ?? `请求失败 (${res.status})`)
  }
  return json
}

export function loadNeteaseCookie(): string {
  return getNeteaseLoginCookieSync()
}

export async function saveNeteaseCookie(cookie: string) {
  await saveNeteaseLoginCookie(cookie)
}

export function clearNeteaseCookie() {
  void clearNeteaseLoginCookie()
}

export async function neteaseLoginStatus(cookie: string) {
  return apiGet('/api/login/status', { cookie })
}

function pickLoginCookie(body: Record<string, unknown>): string {
  if (typeof body.cookie === 'string' && body.cookie.trim()) return body.cookie.trim()
  if (typeof body.cookies === 'string' && body.cookies.trim()) return body.cookies.trim()
  const data = body.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as Record<string, unknown>
    const c = row.cookie ?? row.cookies
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return ''
}

function loginErrorMessage(body: Record<string, unknown>, fallback: string): string {
  const msg = body.message ?? body.msg
  if (typeof msg === 'string' && msg.trim()) return msg.trim()
  const code = typeof body.code === 'number' ? body.code : 0
  return code ? `${fallback} (${code})` : fallback
}

async function loginCellphoneRequest(params: Record<string, string>): Promise<string> {
  let body: Record<string, unknown>
  if (isLocalNcmMode()) {
    body = await ncmGet('/login/cellphone', params)
  } else {
    const res = await apiGet<Record<string, unknown>>('/api/login/cellphone', params)
    body = {
      code: res.code,
      message: res.message,
      cookie: res.cookie,
      ...(res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : {}),
    }
  }

  const code = typeof body.code === 'number' ? body.code : 200
  const cookie = pickLoginCookie(body)
  if (code === 200 && cookie) {
    await saveNeteaseCookie(cookie)
    return cookie
  }
  throw new Error(loginErrorMessage(body, '手机号登录失败'))
}

export type NeteasePhoneLoginParams = {
  phone: string
  captcha: string
  /** 国家区号，默认 86 */
  ctcode?: string
}

/** 发送手机验证码（需先调用再登录） */
export async function neteaseSendCaptcha(phone: string, ctcode = '86') {
  const trimmed = phone.trim()
  if (!trimmed) throw new Error('请输入手机号')

  const params = { phone: trimmed, ctcode }
  let body: Record<string, unknown>
  if (isLocalNcmMode()) {
    body = await ncmGet('/captcha/sent', params)
  } else {
    const res = await apiGet<Record<string, unknown>>('/api/captcha/sent', params)
    body = { code: res.code, message: res.message, ...(res.data as object) }
  }

  const code = typeof body.code === 'number' ? body.code : 200
  if (code === 200) return
  throw new Error(loginErrorMessage(body, '验证码发送失败'))
}

/** 手机号 + 短信验证码登录 */
export async function neteasePhoneLogin({
  phone,
  captcha,
  ctcode = '86',
}: NeteasePhoneLoginParams): Promise<string> {
  const trimmedPhone = phone.trim()
  if (!trimmedPhone) throw new Error('请输入手机号')

  const trimmedCaptcha = captcha.trim()
  if (!trimmedCaptcha) throw new Error('请输入验证码')

  const params: Record<string, string> = {
    phone: trimmedPhone,
    ctcode,
    captcha: trimmedCaptcha,
  }

  return loginCellphoneRequest(params)
}

/** 手机号登录是否可用（ncm 直连，或经 Worker 代理到 NETEASE_UPSTREAM） */
export function isPhoneLoginSupported(): boolean {
  return isLocalNcmMode() || !isWorkerOnlyMode()
}
