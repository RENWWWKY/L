import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * 键盘覆盖内容而不是挤压 viewport（Chromium 等）。
 * iOS WebKit 不支持 VirtualKeyboard API，强行设置会与 visualViewport 滚动抢布局。
 */
if (
  'virtualKeyboard' in navigator &&
  !/iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
) {
  ;(navigator as Navigator & { virtualKeyboard?: { overlaysContent: boolean } }).virtualKeyboard!.overlaysContent = true
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/** 生产构建注册 SW，满足 PWA 安装条件；开发时依赖 Vite 热更新不设缓存 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
