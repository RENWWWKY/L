/**
 * 指向 `public/` 下资源的完整 URL（自动带上 Vite `import.meta.env.BASE_URL`），
 * 部署在 GitHub Pages 子路径（如 `/Lumi-Phone/`）时不会请求到域名根下的 `/image/…`。
 *
 * @param pathFromSiteRoot 以 `/` 开头或不含开头的路径，如 `/image/a.png` 或 `image/a.png`
 */
export function publicAssetUrl(pathFromSiteRoot: string): string {
  const rel = pathFromSiteRoot.startsWith('/') ? pathFromSiteRoot.slice(1) : pathFromSiteRoot
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${rel}`
}

/** 将历史存的站点根路径 `/image/…` 转成带 `base` 的地址（子路径部署如 GitHub Pages 必需） */
export function migrateLegacyRootPublicUrl(url: string): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith('/image/')) return publicAssetUrl(u)
  return u
}
