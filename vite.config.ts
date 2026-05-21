import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
        const name = decodeURIComponent(urlPath.slice(expectedPrefix.length))
        if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return next()
        const file = path.join(rootImage, name)
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
// 与 GitHub 仓库名一致，默认站点为 https://<用户>.github.io/Lumi-Phone/
// 绑定自定义域名并只用域名访问时，可改为 base: '/' 后重新构建部署
export default defineConfig({
  base: '/Lumi-Phone/',
  plugins: [react(), tailwindcss(), basicSsl(), copyRootImageDirToDist()],
  /** 监听 0.0.0.0，同一局域网（同一 WiFi）内设备可通过本机 IP 访问 */
  server: {
    host: true,
    port: 5173,
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
})
