/**
 * 站内 `image/` 资源路径：存库与导入包用「规范路径」，展示时再按当前 Vite base 解析。
 */

const viteImageModules = import.meta.glob('../image/**/*.{png,jpg,jpeg,webp,gif,avif,AVIF}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const viteBundledUrlToCanonical = new Map<string, string>()
/** 规范路径 `/image/…` → 当前构建的 Vite ?url 产物（展示用） */
const canonicalToViteBundledUrl = new Map<string, string>()
for (const [file, url] of Object.entries(viteImageModules)) {
  if (typeof url !== 'string' || !url) continue
  const norm = file.replace(/\\/g, '/')
  const m = norm.match(/(?:^|\/)image\/(.+)$/i)
  if (!m?.[1]) continue
  const canon = `/image/${m[1]}`
  viteBundledUrlToCanonical.set(url, canon)
  if (!canonicalToViteBundledUrl.has(canon)) canonicalToViteBundledUrl.set(canon, url)
}

/** 当前部署 base 下的可请求 URL（仅用于展示，不要写入 localStorage / 人设包） */
export function publicAssetUrl(pathFromSiteRoot: string): string {
  const rel = pathFromSiteRoot.startsWith('/') ? pathFromSiteRoot.slice(1) : pathFromSiteRoot
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${rel}`
}

/**
 * 规范路径：永远是 `/image/…`（不带 Lumi-Phone、不带 /assets 哈希）。
 * 写入 IndexedDB、人设包、主题设置时请用此函数。
 */
export function canonicalPublicImagePath(url: string): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith('data:') || u.startsWith('blob:')) return u
  if (/^https?:\/\//i.test(u)) {
    if (/localhost|127\.0\.0\.1|192\.168\.\d+\.\d+/i.test(u)) {
      const imagePath = u.match(/\/image\/[^?#]+/i)?.[0]
      if (imagePath) return imagePath
      return ''
    }
    return u
  }

  const fromVite = viteBundledUrlToCanonical.get(u)
  if (fromVite) return fromVite

  const withoutOrigin = u.replace(/^https?:\/\/[^/]+/i, '')
  const imageRel = withoutOrigin
    .replace(/^\/?(?:Lumi-Phone|Phone)\/(image\/)/i, '$1')
    .replace(/^\/?(image\/)/i, '$1')

  if (/^image\//i.test(imageRel)) return `/${imageRel}`
  if (u.startsWith('/image/')) return u
  if (u.includes('/assets/')) return ''
  return u
}

/** 展示用：把规范路径或历史脏数据解析为当前环境可请求的 URL */
export function resolvePublicImageUrl(url: string): string {
  const u = url.trim()
  if (!u) return u
  if (u.startsWith('data:') || u.startsWith('blob:')) return u
  if (/^https?:\/\//i.test(u)) return u

  const bundled = viteBundledUrlToCanonical.has(u) ? u : canonicalToViteBundledUrl.get(canonicalPublicImagePath(u))
  if (bundled) return bundled

  const canon = canonicalPublicImagePath(u)
  if (canon.startsWith('/image/')) {
    const fromCanon = canonicalToViteBundledUrl.get(canon)
    if (fromCanon) return fromCanon
    return publicAssetUrl(canon)
  }

  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  if (u.startsWith(prefix)) return u

  return u
}

/** @deprecated 语义同 {@link canonicalPublicImagePath}，保留旧调用名 */
export function migrateLegacyRootPublicUrl(url: string): string {
  return canonicalPublicImagePath(url)
}
