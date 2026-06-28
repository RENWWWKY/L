export interface Env {}

const HF_MIRROR = 'https://hf-mirror.com'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const url = new URL(request.url)
    if (url.pathname === '/health') {
      return withCors(
        new Response(JSON.stringify({ ok: true, service: 'hf-mirror-proxy' }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
      )
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return withCors(new Response('Method not allowed', { status: 405 }))
    }

    const upstream = `${HF_MIRROR}${url.pathname}${url.search}`
    try {
      const res = await fetch(upstream, {
        method: request.method,
        redirect: 'follow',
        headers: {
          Accept: request.headers.get('Accept') ?? '*/*',
          'User-Agent': 'lumi-phone-hf-mirror-proxy',
        },
      })
      return withCors(res)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return withCors(new Response(`hf-mirror proxy error: ${msg}`, { status: 502 }))
    }
  },
}
