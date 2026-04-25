import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  /** 监听 0.0.0.0，同一局域网（同一 WiFi）内设备可通过本机 IP 访问 */
  server: {
    host: true,
    port: 5173,
    // 通过 basicSsl() 启用 https；这里按 ServerOptions 传对象即可
    https: {},
  },
  preview: {
    host: true,
    port: 4173,
  },
})
