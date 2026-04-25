/* 极简 Service Worker：满足 PWA 安装条件，不强制离线缓存业务资源 */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
