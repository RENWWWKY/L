import { personaDb } from '../newFriendsPersona/idb'

const KV_PREFIX = 'checkPhone.spyWallpaper.v1:'

type GlobMod = { default: string }

const wallpaperModules = import.meta.glob<GlobMod>(
  '../../../../../image/查手机男生壁纸专用/*.{png,jpg,jpeg,webp,gif}',
  { eager: true },
)

const WALLPAPER_URLS = Object.values(wallpaperModules)
  .map((m) => m?.default)
  .filter((x): x is string => typeof x === 'string' && !!x.trim())

function pickOne<T>(arr: T[]): T | null {
  if (!arr.length) return null
  return arr[Math.floor(Math.random() * arr.length)] ?? null
}

export async function getOrInitSpyWallpaperUrl(characterId: string): Promise<string | null> {
  const key = `${KV_PREFIX}${String(characterId || 'unknown').trim()}`
  const existing = await personaDb.getPhoneKv(key)
  if (typeof existing === 'string' && existing.trim()) return existing.trim()

  const picked = pickOne(WALLPAPER_URLS)
  if (!picked) return null

  await personaDb.setPhoneKv(key, picked)
  return picked
}

