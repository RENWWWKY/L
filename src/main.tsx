import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  isLikelyIosBrowser,
  setupServiceWorkerControlWatcher,
} from './phone/apps/backgroundNotify/backgroundPushClient'
import { installBackgroundKeepAlive } from './phone/apps/backgroundNotify/backgroundKeepAlive'
import { maybeRecoverFromBrokenKeepAlivePwa } from './phone/apps/backgroundNotify/keepAliveBootRecovery'
import { installProactivePrivateMessageEngine } from './phone/apps/wechat/proactivePrivateMessageEngine'
import { installProactiveCharacterMomentEngine } from './components/moments/proactiveCharacterMomentEngine'

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

/** 本机 dev + iOS PWA：清掉历史 SW，避免旧接管状态导致主屏幕图标打开白屏 */
if (import.meta.env.DEV && isLikelyIosBrowser() && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    void Promise.all(regs.map((r) => r.unregister()))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/** 先渲染 UI，再挂 SW / 保活，避免 iOS PWA 冷启动被保活逻辑抢在 React 之前 */
queueMicrotask(() => {
  maybeRecoverFromBrokenKeepAlivePwa()
  /** 本机 dev 不注册 SW（尤其 iOS 主屏幕 PWA 易白屏）；正式构建再启用 */
  if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
    const installSwWatcher = () => setupServiceWorkerControlWatcher()
    const iosDeferMs = isLikelyIosBrowser() ? 2500 : 0
    if (iosDeferMs > 0) {
      window.setTimeout(installSwWatcher, iosDeferMs)
    } else {
      installSwWatcher()
    }
  }
  installBackgroundKeepAlive()
  installProactivePrivateMessageEngine()
  installProactiveCharacterMomentEngine()
})
