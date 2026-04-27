import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 将仓库根目录 `image/` 同步到 `dist/image/`，与默认 URL `/image/…`（经 base）一致，避免仅依赖 public 时漏拷 */
function copyRootImageDirToDist(): Plugin {
  return {
    name: 'copy-root-image-dir-to-dist',
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
