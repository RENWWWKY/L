import { canonicalPublicImagePath, resolvePublicImageUrl } from '../../../publicAssetUrl'

const globModules = import.meta.glob('../../../../image/默认微信聊天背景图/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export type WeChatDefaultChatBackgroundPreset = {
  id: string
  label: string
  /** 存 IndexedDB 用规范路径 `/image/…` */
  storagePath: string
  /** 界面预览 */
  previewUrl: string
}

function labelFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/i, '')
  if (base === '默认壁纸') return '默认壁纸'
  if (/^\d+$/.test(base)) return `背景 ${base}`
  return base
}

function presetSortRank(filename: string): number {
  if (/默认壁纸/i.test(filename)) return 0
  const m = filename.match(/(\d+)/)
  if (m) return Number(m[1])
  return 999
}

export function listWeChatDefaultChatBackgroundPresets(): WeChatDefaultChatBackgroundPreset[] {
  const out: WeChatDefaultChatBackgroundPreset[] = []
  for (const [file, bundledUrl] of Object.entries(globModules)) {
    if (typeof bundledUrl !== 'string' || !bundledUrl.trim()) continue
    const filename = file.replace(/^.*[/\\]/, '')
    const storagePath = canonicalPublicImagePath(bundledUrl)
    if (!storagePath.startsWith('/image/')) continue
    out.push({
      id: storagePath,
      label: labelFromFilename(filename),
      storagePath,
      previewUrl: resolvePublicImageUrl(storagePath),
    })
  }
  out.sort((a, b) => {
    const fa = a.storagePath.split('/').pop() ?? ''
    const fb = b.storagePath.split('/').pop() ?? ''
    const dr = presetSortRank(fa) - presetSortRank(fb)
    if (dr !== 0) return dr
    return fa.localeCompare(fb, 'zh-CN')
  })
  return out
}

export function isWeChatDefaultChatBackgroundPath(url: string): boolean {
  const canon = canonicalPublicImagePath(url.trim())
  return listWeChatDefaultChatBackgroundPresets().some((p) => p.storagePath === canon)
}
