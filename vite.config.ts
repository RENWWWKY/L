import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'

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

// https://vite.dev/config/
// 与 GitHub 仓库名一致，生产构建 base 为 /Lumi-Phone/（GitHub Pages）
// 本地 dev/preview 用 /，便于局域网 IP 直接访问并正确安装 PWA
function resolveAppBase(command: 'build' | 'serve') {
  // dev：局域网 IP 直连根路径；build/preview/部署：GitHub Pages 子路径
  if (command === 'build') return '/Lumi-Phone/'
  if (process.env.npm_lifecycle_event === 'preview') return '/Lumi-Phone/'
  return '/'
}

export default defineConfig(({ command }) => {
  const base = resolveAppBase(command)
  return {
  base,
  plugins: [react(), tailwindcss(), basicSsl(), copyRootImageDirToDist(), pwaManifestPlugin()],
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
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  }
})
