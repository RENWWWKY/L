import {
  clearNeteaseLoginCookie,
  getNeteaseLoginCookieSync,
  hydrateNeteaseLoginCookie,
  saveNeteaseLoginCookie,
} from './listenTogetherPersistence'

export { hydrateNeteaseLoginCookie }

/** 未配置时回退 Worker；上线请在 .env 配置国内公网 API（见 docs/听一听-网易云登录部署.md） */
const DEFAULT_BASE = 'https://netease-qr-login.lyx815934990.workers.dev'

export function isWorkerOnlyMode(): boolean {
  return !isLocalNcmMode() && getNeteaseApiBase().includes('workers.dev')
}
const FETCH_TIMEOUT_MS = 60_000

export function getNeteaseApiBase(): string {
  const fromEnv = (import.meta.env.VITE_NETEASE_API_BASE as string | undefined)?.trim()
  return (fromEnv || DEFAULT_BASE).replace(/\/+$/, '')
}

/** 直连本机 / 局域网 NeteaseCloudMusicApi（国内开发推荐） */
export function isLocalNcmMode(): boolean {
  const mode = (import.meta.env.VITE_NETEASE_API_MODE as string | undefined)?.trim()
  if (mode === 'ncm') return true
  if (mode === 'worker') return false
  const base = getNeteaseApiBase()
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/i.test(
    base,
  )
}

type ApiEnvelope<T> = {
  code: number
  message?: string | null
  data?: T
  cookie?: string
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`请求超时（${FETCH_TIMEOUT_MS / 1000}秒），建议打开梯子后重试`)
    }
    if (e instanceof TypeError) {
      throw new Error('无法连接登录服务，建议打开梯子后重试')
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

function pickUnikeyFromNcmBody(body: Record<string, unknown>): string | null {
  const data = body.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const unikey = (data as Record<string, unknown>).unikey
    if (typeof unikey === 'string' && unikey) return unikey
  }
  if (typeof body.unikey === 'string' && body.unikey) return body.unikey
  return null
}

function pickQrFromNcmCreate(body: Record<string, unknown>) {
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<
    string,
    unknown
  >
  const qrurl =
    typeof data.qrurl === 'string'
      ? data.qrurl
      : typeof data.url === 'string'
        ? data.url
        : null
  let qrimg = typeof data.qrimg === 'string' ? data.qrimg : ''
  if (qrimg && !qrimg.startsWith('data:')) {
    qrimg = `data:image/png;base64,${qrimg}`
  }
  return { qrurl, qrimg: qrimg || null }
}

async function ncmGet(path: string, params?: Record<string, string>) {
  const url = new URL(`${getNeteaseApiBase()}${path}`)
  url.searchParams.set('timestamp', String(Date.now()))
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetchWithTimeout(url.toString())
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
  return json
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

async function apiGet<T>(path: string, params?: Record<string, string>) {
  const url = new URL(`${getNeteaseApiBase()}${path}`)
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

async function apiPost<T>(path: string, body?: unknown) {
  const url = new URL(`${getNeteaseApiBase()}${path}`)
  url.searchParams.set('timestamp', String(Date.now()))
  const res = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json: ApiEnvelope<T>
  try {
    json = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new Error(`接口无响应 (${res.status})，请打开 /api/debug/netease 排查 Worker`)
  }
  if (!res.ok || json.code === 500) {
    throw new Error(
      (json as { message?: string }).message ?? `请求失败 (${res.status})`,
    )
  }
  return json
}

export type QrStartData = {
  key: string
  qrurl: string
  qrimg: string | null
}

export type QrCheckResult = {
  code: number
  message?: string | null
  cookie?: string
}

export function loadNeteaseCookie(): string {
  return getNeteaseLoginCookieSync()
}

export function saveNeteaseCookie(cookie: string) {
  void saveNeteaseLoginCookie(cookie)
}

export function clearNeteaseCookie() {
  void clearNeteaseLoginCookie()
}

async function workerQrStart(qrimg: boolean): Promise<QrStartData> {
  const res = await apiPost<QrStartData>('/api/login/qr/start', { qrimg })
  if (res.code !== 200 || !res.data?.key) {
    throw new Error(
      (res as { message?: string }).message ??
        'Worker 无法直连网易云。上线请在腾讯云部署 API 并配置 VITE_NETEASE_API_BASE，或在 Cloudflare 设置 NETEASE_UPSTREAM。详见 docs/听一听-网易云登录部署.md',
    )
  }
  return res.data
}

/** 本机 NeteaseCloudMusicApi：/login/qr/key + /login/qr/create */
async function ncmQrStart(qrimg: boolean): Promise<QrStartData> {
  const keyBody = await ncmGet('/login/qr/key')
  const key = pickUnikeyFromNcmBody(keyBody)
  if (!key) {
    throw new Error('本机 API 未返回 unikey，请确认 NeteaseCloudMusicApi 已启动（node app.js）')
  }
  const createBody = await ncmGet('/login/qr/create', {
    key,
    qrimg: qrimg ? 'true' : 'false',
  })
  const { qrurl: rawUrl, qrimg: rawImg } = pickQrFromNcmCreate(createBody)
  const qrurl =
    rawUrl ?? `https://music.163.com/login?codekey=${encodeURIComponent(key)}`
  return { key, qrurl, qrimg: rawImg }
}

/** 一步获取 key + 二维码图 */
export async function neteaseQrStart(qrimg = true) {
  if (isLocalNcmMode()) return ncmQrStart(qrimg)
  return workerQrStart(qrimg)
}

/** 轮询扫码状态 */
export async function neteaseQrCheck(key: string): Promise<QrCheckResult> {
  if (isLocalNcmMode()) {
    const body = await ncmGet('/login/qr/check', { key })
    return {
      code: typeof body.code === 'number' ? body.code : 500,
      message: typeof body.message === 'string' ? body.message : null,
      cookie: typeof body.cookie === 'string' ? body.cookie : '',
    }
  }
  const res = await apiGet<QrCheckResult>('/api/login/qr/check', { key })
  return {
    code: res.code,
    message: res.message,
    cookie: res.cookie ?? '',
  }
}

export async function neteaseLoginStatus(cookie: string) {
  return apiGet('/api/login/status', { cookie })
}

function pickLoginCookie(body: Record<string, unknown>): string {
  if (typeof body.cookie === 'string' && body.cookie.trim()) return body.cookie.trim()
  const data = body.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const c = (data as Record<string, unknown>).cookie
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
    saveNeteaseCookie(cookie)
    return cookie
  }
  throw new Error(loginErrorMessage(body, '手机号登录失败'))
}

export type NeteasePhoneLoginParams = {
  phone: string
  password?: string
  captcha?: string
  /** 国家区号，默认 86 */
  ctcode?: string
}

/** 发送手机验证码（需先调用再使用 captcha 登录） */
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

/** 手机号 + 密码，或手机号 + 短信验证码登录 */
export async function neteasePhoneLogin({
  phone,
  password,
  captcha,
  ctcode = '86',
}: NeteasePhoneLoginParams): Promise<string> {
  const trimmedPhone = phone.trim()
  if (!trimmedPhone) throw new Error('请输入手机号')

  const params: Record<string, string> = {
    phone: trimmedPhone,
    ctcode,
  }

  const code = captcha?.trim()
  const pwd = password?.trim()

  if (code) {
    params.captcha = code
  } else if (pwd) {
    params.password = pwd
  } else {
    throw new Error('请输入密码或验证码')
  }

  return loginCellphoneRequest(params)
}

/** 手机号登录是否可用（ncm 直连，或经 Worker 代理到 NETEASE_UPSTREAM） */
export function isPhoneLoginSupported(): boolean {
  return isLocalNcmMode() || !isWorkerOnlyMode()
}
