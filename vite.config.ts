import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv, type Plugin, type ResolvedConfig } from 'vite'

import { buildNeteaseDevProxyTable } from './viteNeteaseDevProxy'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PWA_MANIFEST_SRC = path.resolve(__dirname, 'pwa-manifest.template.json')

/** 按 Vite base 生成 manifest，避免 iOS 把「添加到主屏幕」当成普通书签（scope/start_url 不匹配） */
function pwaManifestPlugin(): Plugin {
  let resolvedBase = '/'

  const normalizeBase = (base: string) => (base === '/' ? '/' : base.endsWith('/') ? base : `${base}/`)

  const buildManifestJson = (base: string) => {
    const b = normalizeBase(base)
    const raw = JSON.parse(fs.readFileSync(PWA_MANIFEST_SRC, 'utf-8')) as {
      icons: { src: string; [k: string]: unknown }[]
      [k: string]: unknown
    }
    const withBase = (p: string) => (p.startsWith('/') ? p : `${b}${p}`)
    return {
      ...raw,
      id: b,
      start_url: '.',
      scope: '/',
      icons: raw.icons.map((icon) => ({ ...icon, src: withBase(icon.src) })),
    }
  }

  const manifestReqPath = (base: string) => {
    const b = normalizeBase(base)
    return b === '/' ? '/manifest.webmanifest' : `${b}manifest.webmanifest`.replace(/\/+/g, '/')
  }

  return {
    name: 'pwa-manifest',
    configResolved(config: ResolvedConfig) {
      resolvedBase = config.base
    },
    configureServer(server) {
      const serveManifest = (reqPath: string) => reqPath === manifestReqPath(server.config.base)
      server.middlewares.use((req, res, next) => {
        const reqPath = (req.url ?? '').split('?')[0]
        if (!serveManifest(reqPath)) return next()
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(JSON.stringify(buildManifestJson(server.config.base)))
      })
    },
    writeBundle() {
      const outDir = path.resolve(this.environment.config.build.outDir)
      const outFile = path.join(outDir, 'manifest.webmanifest')
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(outFile, `${JSON.stringify(buildManifestJson(resolvedBase), null, 2)}\n`)
    },
  }
}

/** 在 HTML 解析最早阶段注册 SW，提高刷新后被接管概率（安卓 dev 尤其需要） */
function injectEarlyServiceWorkerPlugin(): Plugin {
  let resolvedBase = '/'

  const buildRegisterSnippet = (base: string, isDev: boolean) => {
    /** 本机 dev：iOS「添加到主屏幕」与早期 SW 抢首屏易白屏，开发期不注入 */
    if (isDev) return ''
    const scope = base === '/' ? '/' : base.endsWith('/') ? base : `${base}/`
    const swUrl = `${base}sw.js`.replace(/([^:]\/)\/+/g, '$1')
    return `<script>(function(){if(!('serviceWorker'in navigator))return;var u=${JSON.stringify(swUrl)},s=${JSON.stringify(scope)},go=function(){navigator.serviceWorker.register(u,{scope:s,updateViaCache:'none'}).catch(function(){});};var ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(ios){window.addEventListener('load',function(){setTimeout(go,2000);},{once:true});}else{go();}})();</script>`
  }

  return {
    name: 'inject-early-service-worker',
    configResolved(config: ResolvedConfig) {
      resolvedBase = config.base
    },
    transformIndexHtml(html, ctx) {
      const isDev = !!ctx.server
      const snippet = buildRegisterSnippet(resolvedBase, isDev)
      if (!snippet) return html
      return html.replace('</head>', `${snippet}\n</head>`)
    },
  }
}

/** 将仓库根目录 `image/` 同步到 `dist/image/`；开发期在中间件中提供同源路径（与 `resolveMeetDefaultEncounterChatBgUrl` 一致） */
function copyRootImageDirToDist(): Plugin {
  const rootImage = path.resolve(__dirname, 'image')
  return {
    name: 'copy-root-image-dir-to-dist',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const full = req.url ?? ''
        let urlPath = ''
        try {
          const u = new URL(full, 'http://localhost')
          // 源码里 `import ... from '.../image/xx.png?import'` 等必须由 Vite 转成 JS；若此处返回裸图会触发 MIME 报错
          if (u.searchParams.has('import') || u.searchParams.has('url') || u.searchParams.has('raw')) {
            return next()
          }
          urlPath = u.pathname
        } catch {
          urlPath = full.split('?')[0] ?? ''
          if (full.includes('?import') || full.includes('?url')) return next()
        }
        const rawBase = server.config.base
        const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '')
        const expectedPrefix = base ? `${base}/image/` : '/image/'
        if (!urlPath.startsWith(expectedPrefix)) return next()
        const rel = decodeURIComponent(urlPath.slice(expectedPrefix.length))
        if (!rel || rel.includes('..')) return next()
        const file = path.resolve(rootImage, rel.replace(/\\/g, '/'))
        const rootResolved = path.resolve(rootImage)
        if (!file.startsWith(rootResolved + path.sep) && file !== rootResolved) return next()
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
        const ext = path.extname(file).toLowerCase()
        const ct =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.webp'
                ? 'image/webp'
                : 'application/octet-stream'
        res.setHeader('Content-Type', ct)
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      const src = path.resolve(__dirname, 'image')
      const dest = path.resolve(__dirname, 'dist', 'image')
      if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) return
      fs.cpSync(src, dest, { recursive: true })
    },
  }
}

/** dev：浏览器 PUT 头像 blob，供 iOS 通知栏直接拉取（绕过自签证书下 /assets 拉取失败） */
function notifyIconDevServerPlugin(): Plugin {
  const marker = '/__lumi_notify_icon__/'
  const store = new Map<string, { body: Buffer; mime: string }>()

  return {
    name: 'notify-icon-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const full = req.url ?? ''
        let urlPath = ''
        try {
          const u = new URL(full, 'http://localhost')
          urlPath = u.pathname
        } catch {
          urlPath = full.split('?')[0] ?? ''
        }
        if (!urlPath.includes(marker)) return next()

        const iconId = urlPath.slice(urlPath.indexOf(marker) + marker.length).split('/')[0]?.trim()
        if (!iconId || iconId.includes('..')) return next()

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.end()
          return
        }

        if (req.method === 'PUT' || req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            const body = Buffer.concat(chunks)
            const mime = (req.headers['content-type'] as string | undefined)?.trim() || 'image/png'
            store.set(iconId, { body, mime })
            res.statusCode = 204
            res.end()
          })
          return
        }

        if (req.method === 'GET' || req.method === 'HEAD') {
          const hit = store.get(iconId)
          if (!hit) {
            res.statusCode = 404
            res.end()
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', hit.mime)
          res.setHeader('Cache-Control', 'max-age=31536000, immutable')
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          res.end(hit.body)
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
// 与 GitHub 仓库名一致，生产构建 base 为 /Lumi-Phone/（GitHub Pages）
// 本地 dev/preview 用 /，便于局域网 IP 直接访问并正确安装 PWA
function resolveAppBase(command: 'build' | 'serve') {
  // dev：局域网 IP 直连根路径；build/preview/部署：GitHub Pages 子路径
  if (command === 'build') return '/Lumi-Phone/'
  if (process.env.npm_lifecycle_event === 'preview') return '/Lumi-Phone/'
  return '/'
}

export default defineConfig(({ command, mode }) => {
  const base = resolveAppBase(command)
  const env = loadEnv(mode, __dirname, '')
  const neteaseDevProxies = buildNeteaseDevProxyTable(env)

  return {
  base,
  plugins: [react(), tailwindcss(), basicSsl(), injectEarlyServiceWorkerPlugin(), notifyIconDevServerPlugin(), copyRootImageDirToDist(), pwaManifestPlugin()],
  /** 监听 0.0.0.0，同一局域网（同一 WiFi）内设备可通过本机 IP 访问 */
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [__dirname, path.resolve(__dirname, '剧本杀')],
    },
    // 通过 basicSsl() 启用 https；这里按 ServerOptions 传对象即可
    https: {},
    proxy: {
      /**
       * MiniMax：前端直连大概率遇到 CORS，这里提供 dev proxy。
       * - /minimax/* -> https://api.minimax.chat/*
       * - /minimaxi/* -> https://api.minimaxi.com/*
       */
      '/minimax': {
        target: 'https://api.minimax.chat',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/minimax/, ''),
      },
      '/minimaxi': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/minimaxi/, ''),
      },
      /**
       * 听一听 · 网易云 API 开发代理（/ncm-api-0… 对应不同公共节点，502 时自动切换）
       */
      ...neteaseDevProxies,
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  }
})
