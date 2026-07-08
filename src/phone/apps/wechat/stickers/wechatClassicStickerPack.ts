/**
 * 微信经典黄脸默认包（资源来自 npm `wechat-emojis` / xxk8/wechat-emojis，MIT 封装 + 腾讯表情素材，个人非商业用途）。
 */
import type { StickerGroup, StickerItem } from './stickerStore'

export const WECHAT_CLASSIC_GROUP_ID = 'default-sticker-pack-wechat-classic'

const CATEGORY_ORDER = ['face', 'gesture', 'animal', 'blessing', 'other'] as const

const wechatClassicModules = import.meta.glob(
  '../../../../../node_modules/wechat-emojis/assets/**/*.png',
  { eager: true, import: 'default' },
) as Record<string, string>

function fileLabelFromPath(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  const fileName = normalized.split('/').pop() ?? ''
  return fileName.replace(/\.[^.]+$/, '').trim() || '未命名表情'
}

function categoryRank(globKey: string): number {
  const normalized = globKey.replace(/\\/g, '/').toLowerCase()
  for (let i = 0; i < CATEGORY_ORDER.length; i += 1) {
    if (normalized.includes(`/assets/${CATEGORY_ORDER[i]}/`)) return i
  }
  return CATEGORY_ORDER.length
}

const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  face: '表情',
  gesture: '手势',
  animal: '动物',
  blessing: '祝福',
  other: '其它',
}

export type WechatClassicStickerGroup = {
  categoryId: (typeof CATEGORY_ORDER)[number]
  label: string
  items: StickerItem[]
}

function categoryIdFromPath(globKey: string): (typeof CATEGORY_ORDER)[number] {
  const normalized = globKey.replace(/\\/g, '/').toLowerCase()
  for (const cat of CATEGORY_ORDER) {
    if (normalized.includes(`/assets/${cat}/`)) return cat
  }
  return 'other'
}

export function buildWechatClassicStickerGroups(): WechatClassicStickerGroup[] {
  const keys = Object.keys(wechatClassicModules).sort((a, b) => {
    const ca = categoryRank(a)
    const cb = categoryRank(b)
    if (ca !== cb) return ca - cb
    return fileLabelFromPath(a).localeCompare(fileLabelFromPath(b), 'zh-CN')
  })
  const byCat = new Map<(typeof CATEGORY_ORDER)[number], StickerItem[]>()
  keys.forEach((k, idx) => {
    const cat = categoryIdFromPath(k)
    const list = byCat.get(cat) ?? []
    list.push({
      id: `wxc-${idx + 1}`,
      url: wechatClassicModules[k]!,
      description: fileLabelFromPath(k),
      createdAt: 0,
    })
    byCat.set(cat, list)
  })
  return CATEGORY_ORDER.filter((cat) => (byCat.get(cat)?.length ?? 0) > 0).map((cat) => ({
    categoryId: cat,
    label: CATEGORY_LABELS[cat],
    items: byCat.get(cat) ?? [],
  }))
}

export function buildWechatClassicStickerItems(): StickerItem[] {
  const keys = Object.keys(wechatClassicModules).sort((a, b) => {
    const ca = categoryRank(a)
    const cb = categoryRank(b)
    if (ca !== cb) return ca - cb
    return fileLabelFromPath(a).localeCompare(fileLabelFromPath(b), 'zh-CN')
  })
  return keys.map((k, idx) => ({
    id: `wxc-${idx + 1}`,
    url: wechatClassicModules[k]!,
    description: fileLabelFromPath(k),
    createdAt: 0,
  }))
}

let wechatClassicEmojiUrlByNameCache: ReadonlyMap<string, string> | null = null

/** `[微笑]` 等经典黄脸 token 名 → PNG URL */
export function getWechatClassicEmojiUrlByName(): ReadonlyMap<string, string> {
  if (wechatClassicEmojiUrlByNameCache) return wechatClassicEmojiUrlByNameCache
  const map = new Map<string, string>()
  for (const item of buildWechatClassicStickerItems()) {
    const name = item.description.trim()
    if (name) map.set(name, item.url)
  }
  wechatClassicEmojiUrlByNameCache = map
  return map
}

export function wechatClassicEmojiToken(name: string): string {
  return `[${name.trim()}]`
}

/** 从文字气泡中移除《微信经典表情》目录内的 inline 黄脸 token */
export function stripWechatClassicEmojiTokens(text: string): string {
  if (!text) return text
  const catalog = getWechatClassicEmojiUrlByName()
  if (!catalog.size) return text
  return text.replace(/\[([^\[\]\n]{1,24})\]/g, (full, name: string) => {
    if (catalog.has(String(name).trim())) return ''
    return full
  })
}

export function buildWechatClassicStickerGroup(): StickerGroup | null {
  const items = buildWechatClassicStickerItems()
  if (!items.length) return null
  const smileUrl = items.find((it) => it.description === '微笑')?.url ?? items[0]!.url
  return {
    id: WECHAT_CLASSIC_GROUP_ID,
    name: '微信经典表情',
    coverUrl: smileUrl,
    items,
    createdAt: 0,
    readonly: true,
  }
}
