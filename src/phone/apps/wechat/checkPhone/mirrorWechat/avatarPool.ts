type GlobMod = { default: string }

const avatarModules = {
  abstract: import.meta.glob<GlobMod>('../../../../../../image/抽象搞笑男女通用/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  maleSunny: import.meta.glob<GlobMod>('../../../../../../image/微信头像男E型阳光/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  maleCool: import.meta.glob<GlobMod>('../../../../../../image/微信头像男I型清冷/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  elderMale: import.meta.glob<GlobMod>('../../../../../../image/40岁以上长辈头像男/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  femaleCute: import.meta.glob<GlobMod>('../../../../../../image/微信头像女可爱活泼/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  femaleCool: import.meta.glob<GlobMod>('../../../../../../image/微信头像女清冷和御姐/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
  elderFemale: import.meta.glob<GlobMod>('../../../../../../image/40岁以上长辈头像女/*.{png,jpg,jpeg,webp,gif}', { eager: true }),
} as const

export type MirrorAvatarCategory = keyof typeof avatarModules

const avatarPool: Record<MirrorAvatarCategory, string[]> = Object.fromEntries(
  Object.entries(avatarModules).map(([key, mods]) => [
    key,
    Object.values(mods)
      .map((m) => m?.default)
      .filter((v): v is string => typeof v === 'string' && !!v.trim()),
  ]),
) as Record<MirrorAvatarCategory, string[]>

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function getRandomAvatar(category: MirrorAvatarCategory, seed = `${category}:${Date.now()}`): string | undefined {
  const pool = avatarPool[category] || []
  if (!pool.length) return undefined
  return pool[hashSeed(seed) % pool.length]
}

export function getAnyAvatar(seed = `any:${Date.now()}`): string | undefined {
  const all = Object.values(avatarPool).flat()
  if (!all.length) return undefined
  return all[hashSeed(seed) % all.length]
}
