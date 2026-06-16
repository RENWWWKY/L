import type { ProxyOptions } from 'vite'

const LOCAL_NCM_HOST_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?/i

/** 听一听 dev：本机 / 局域网 NeteaseCloudMusicApi 走 /ncm-api 同源代理，避免 HTTPS 页面 Mixed Content */
export function buildNeteaseDevProxyTable(
  env: Record<string, string>,
): Record<string, ProxyOptions> {
  const configured = (env.VITE_NETEASE_API_BASE || '').trim().replace(/\/+$/, '')
  if (!configured || !LOCAL_NCM_HOST_RE.test(configured)) return {}

  const target = configured.replace(/\/music$/, '') || configured

  return {
    '/ncm-api': {
      target,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/ncm-api/, '') || '/',
    },
  }
}
