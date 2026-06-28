import type { ServerResponse } from 'http'
import type { Connect, Plugin } from 'vite'

const HF_MIRROR = 'https://hf-mirror.com'

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
}

function createHfMirrorProxyMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const raw = req.url ?? ''
    let pathname = ''
    let search = ''
    try {
      const u = new URL(raw, 'http://localhost')
      pathname = u.pathname
      search = u.search
    } catch {
      return next()
    }

    if (!pathname.startsWith('/hf-proxy/') && pathname !== '/hf-proxy') {
      return next()
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      setCors(res)
      res.end()
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next()
    }

    const upstreamPath = pathname.replace(/^\/hf-proxy\/?/, '/')
    const target = `${HF_MIRROR}${upstreamPath}${search}`

    void (async () => {
      try {
        const upstream = await fetch(target, {
          method: req.method,
          redirect: 'follow',
          headers: {
            Accept: req.headers.accept ?? '*/*',
            'User-Agent': 'lumi-phone-dev-hf-proxy',
          },
        })

        res.statusCode = upstream.status
        setCors(res)

        const ct = upstream.headers.get('content-type')
        if (ct) res.setHeader('Content-Type', ct)
        const cc = upstream.headers.get('cache-control')
        if (cc) res.setHeader('Cache-Control', cc)

        if (req.method === 'HEAD') {
          res.end()
          return
        }

        const body = Buffer.from(await upstream.arrayBuffer())
        res.end(body)
      } catch (e) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        setCors(res)
        const msg = e instanceof Error ? e.message : String(e)
        res.end(`hf-mirror proxy error: ${msg}`)
      }
    })()
  }
}

function prependMiddleware(app: Connect.Server, handler: Connect.NextHandleFunction) {
  const stack = (app as Connect.Server & { stack?: { route: string; handle: Connect.NextHandleFunction }[] }).stack
  if (stack) {
    stack.unshift({ route: '', handle: handler })
    return
  }
  app.use(handler)
}

/**
 * dev/preview：/hf-proxy/* 由 Node 向 hf-mirror 拉取（自动跟随 307）。
 * 必须插在 connect 栈最前，否则会被 SPA fallback 当成路由返回 index.html。
 */
export function hfMirrorDevProxyPlugin(): Plugin {
  const attach = (server: { middlewares: Connect.Server }) => {
    prependMiddleware(server.middlewares, createHfMirrorProxyMiddleware())
  }
  return {
    name: 'hf-mirror-dev-proxy',
    enforce: 'pre',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
