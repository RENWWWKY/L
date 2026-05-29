import { pickQrCreate, pickUnikey } from './neteaseParse'
import { neteaseWeapi, neteaseWeapiDirect, warmNeteaseCookie } from './neteaseRequest'
import { normalizeUpstreamQrStart } from './neteaseUpstream'

export interface Env {
  /** 可选：NeteaseCloudMusicApi 兼容镜像，例如 https://你的国内节点.com */
  NETEASE_UPSTREAM?: string
}

function reqOpts(env: Env) {
  return { upstream: env.NETEASE_UPSTREAM }
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  })
}

function withTs(url: URL) {
  url.searchParams.set('timestamp', String(Date.now()))
  return url
}

/** 1. 获取 unikey */
async function qrKey(env: Env) {
  const result = await neteaseWeapi<{ code: number; unikey?: string }>(
    '/login/qrcode/unikey',
    { type: 1 },
    '',
    reqOpts(env),
  )
  const unikey = pickUnikey(result.body)
  if (!unikey) {
    return json({ code: 500, message: '无法获取二维码 key', raw: result.body }, 500)
  }
  return json({ code: 200, data: { unikey, key: unikey } })
}

/** 2. 生成二维码（base64 图 + 登录链接） */
async function qrCreate(env: Env, key: string, qrimg: boolean) {
  const result = await neteaseWeapi<{
    code: number
    qrimg?: string
    qrurl?: string
  }>(
    '/login/qrcode/create',
    {
      key,
      type: 1,
      ...(qrimg ? { qrimg: true } : {}),
    },
    '',
    reqOpts(env),
  )

  const body = pickQrCreate(result.body)
  const qrurl = body.qrurl ?? `https://music.163.com/login?codekey=${encodeURIComponent(key)}`
  let qrimgData = body.qrimg ?? ''
  if (qrimg && qrimgData && !qrimgData.startsWith('data:')) {
    qrimgData = `data:image/png;base64,${qrimgData}`
  }

  return json({
    code: 200,
    data: {
      key,
      qrurl,
      qrimg: qrimgData || null,
    },
  })
}

/** 3. 轮询扫码状态 */
async function qrCheck(env: Env, key: string) {
  const result = await neteaseWeapi<{
    code: number
    message?: string
    cookie?: string
    [key: string]: unknown
  }>('/login/qrcode/check', { key, type: 1 }, '', reqOpts(env))

  const body = result.body
  const code = body.code
  const cookie = result.cookie || (typeof body.cookie === 'string' ? body.cookie : '')

  return json({
    code,
    message: body.message ?? null,
    cookie: code === 803 ? cookie : '',
    data: body,
  })
}

/** 一步到位：key + 二维码 */
async function qrStart(env: Env, qrimg: boolean) {
  const opts = reqOpts(env)
  const keyRes = await neteaseWeapi<{ code: number; unikey?: string }>(
    '/login/qrcode/unikey',
    { type: 1 },
    '',
    opts,
  )
  const key = pickUnikey(keyRes.body)
  if (!key) {
    return json({ code: 500, message: '无法获取二维码 key', raw: keyRes.body }, 500)
  }
  const createRes = await neteaseWeapi(
    '/login/qrcode/create',
    { key, type: 1, ...(qrimg ? { qrimg: true } : {}) },
    '',
    opts,
  )
  const data = normalizeUpstreamQrStart(keyRes, createRes, key)
  return json({ code: 200, data })
}

async function loginStatus(env: Env, cookie: string) {
  if (!cookie) return json({ code: 400, message: '缺少 cookie' }, 400)
  const result = await neteaseWeapi('/w/nuser/account/get', {}, cookie, reqOpts(env))
  return json({ code: 200, data: result.body })
}

/** 将登录类 GET 请求转发到 NETEASE_UPSTREAM（NeteaseCloudMusicApi） */
async function proxyUpstreamNcmGet(env: Env, request: Request, ncmPath: string): Promise<Response> {
  const upstream = env.NETEASE_UPSTREAM?.replace(/\/+$/, '')
  if (!upstream) {
    return json(
      {
        code: 400,
        message:
          '手机号登录需配置 NETEASE_UPSTREAM 指向国内 NeteaseCloudMusicApi，或使用 VITE_NETEASE_API_MODE=ncm 直连 API',
      },
      400,
    )
  }

  const src = new URL(request.url)
  const target = new URL(`${upstream}${ncmPath}`)
  for (const [k, v] of src.searchParams.entries()) {
    if (k !== 'timestamp') target.searchParams.set(k, v)
  }
  target.searchParams.set('timestamp', String(Date.now()))

  const res = await fetch(target.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  })
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  })
}

async function debugNetease(env: Env) {
  const steps: Record<string, unknown>[] = []
  try {
    const cookie = await warmNeteaseCookie()
    steps.push({ step: 'warm_cookie', ok: true, cookiePreview: cookie.slice(0, 80) })
  } catch (e) {
    steps.push({ step: 'warm_cookie', ok: false, error: String(e) })
  }
  try {
    const r = await neteaseWeapiDirect('/login/qrcode/unikey', { type: 1 })
    const key = pickUnikey(r.body)
    steps.push({ step: 'direct_unikey', ok: Boolean(key), key, raw: r.body })
  } catch (e) {
    steps.push({ step: 'direct_unikey', ok: false, error: String(e) })
  }
  if (env.NETEASE_UPSTREAM) {
    try {
      const r = await neteaseWeapi('/login/qrcode/unikey', { type: 1 }, '', reqOpts(env))
      const key = pickUnikey(r.body)
      steps.push({ step: 'upstream_unikey', ok: Boolean(key), key, upstream: env.NETEASE_UPSTREAM })
    } catch (e) {
      steps.push({ step: 'upstream_unikey', ok: false, error: String(e) })
    }
  }
  return json({
    ok: true,
    hint: '梯子只影响你浏览器访问 workers.dev，不影响 Worker 在海外请求网易。若 direct 失败请配置 NETEASE_UPSTREAM。',
    upstream: env.NETEASE_UPSTREAM ?? null,
    steps,
  })
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = withTs(new URL(request.url))
    const path = url.pathname.replace(/\/+$/, '') || '/'

    try {
      if (path === '/' || path === '/health') {
        return json({
          ok: true,
          service: 'netease-qr-login',
          endpoints: [
            'GET  /api/login/qr/key',
            'GET  /api/login/qr/create?key=&qrimg=true',
            'GET  /api/login/qr/check?key=',
            'POST /api/login/qr/start  { "qrimg": true }',
            'GET  /api/login/status?cookie=',
            'GET  /api/login/cellphone?phone=&password=',
            'GET  /api/captcha/sent?phone=',
          ],
        })
      }

      if (path === '/api/debug/netease') {
        return debugNetease(env)
      }

      if (path === '/api/login/qr/key') {
        return qrKey(env)
      }

      if (path === '/api/login/qr/create') {
        const key = url.searchParams.get('key')
        if (!key) return json({ code: 400, message: '缺少 key' }, 400)
        const qrimg = url.searchParams.get('qrimg') !== 'false'
        return qrCreate(env, key, qrimg)
      }

      if (path === '/api/login/qr/check') {
        const key = url.searchParams.get('key')
        if (!key) return json({ code: 400, message: '缺少 key' }, 400)
        return qrCheck(env, key)
      }

      if (path === '/api/login/qr/start' && request.method === 'POST') {
        let qrimg = true
        try {
          const body = (await request.json()) as { qrimg?: boolean }
          if (body.qrimg === false) qrimg = false
        } catch {
          /* empty body ok */
        }
        return qrStart(env, qrimg)
      }

      if (path === '/api/login/status') {
        const cookie = url.searchParams.get('cookie') ?? ''
        return loginStatus(env, cookie)
      }

      if (path === '/api/login/cellphone' || path === '/login/cellphone') {
        return proxyUpstreamNcmGet(env, request, '/login/cellphone')
      }

      if (path === '/api/captcha/sent' || path === '/captcha/sent') {
        return proxyUpstreamNcmGet(env, request, '/captcha/sent')
      }

      // 兼容 NeteaseCloudMusicApi 风格路径（便于对照文档调试）
      if (path === '/login/qr/key') return qrKey(env)
      if (path === '/login/qr/create') {
        const key = url.searchParams.get('key')
        if (!key) return json({ code: 400, message: '缺少 key' }, 400)
        return qrCreate(env, key, url.searchParams.get('qrimg') === 'true')
      }
      if (path === '/login/qr/check') {
        const key = url.searchParams.get('key')
        if (!key) return json({ code: 400, message: '缺少 key' }, 400)
        return qrCheck(env, key)
      }

      return json({ code: 404, message: 'Not Found', path }, 404)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return json({ code: 500, message }, 500)
    }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return json({ code: 500, message: `Worker 异常: ${message}` }, 500)
    }
  },
}
