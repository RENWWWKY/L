/** 抓娃娃机 · 玩偶素材目录（对应 public/claw-plushies/） */

export const PLUSH_CATALOG = [
  { id: 'hamster', file: '仓鼠.png', label: '仓鼠', value: 1, grabFactor: 0.96, radius: 19 },
  { id: 'panda', file: '熊猫.png', label: '熊猫', value: 3, grabFactor: 0.78, radius: 22 },
  { id: 'corgi', file: '小柯基.png', label: '柯基', value: 2, grabFactor: 0.9, radius: 20 },
  { id: 'dino', file: '小恐龙.png', label: '恐龙', value: 2, grabFactor: 0.88, radius: 20 },
  { id: 'kitten', file: '小猫.png', label: '小猫', value: 1, grabFactor: 0.95, radius: 18 },
  { id: 'sheep', file: '小绵羊.png', label: '绵羊', value: 1, grabFactor: 0.94, radius: 18 },
  { id: 'fox', file: '狐狸.png', label: '狐狸', value: 3, grabFactor: 0.8, radius: 21 },
  { id: 'bear', file: '小熊.png', label: '小熊', value: 2, grabFactor: 0.88, radius: 20 },
  { id: 'penguin', file: '企鹅.png', label: '企鹅', value: 2, grabFactor: 0.86, radius: 19 },
  { id: 'deer', file: '小鹿.png', label: '小鹿', value: 2, grabFactor: 0.9, radius: 20 },
  { id: 'snail', file: '蜗牛.png', label: '蜗牛', value: 1, grabFactor: 0.97, radius: 17 },
  { id: 'bunny', file: '兔子.png', label: '兔子', value: 1, grabFactor: 0.95, radius: 18 },
] as const

export type PlushKind = (typeof PLUSH_CATALOG)[number]['id']

export type PlushCatalogEntry = (typeof PLUSH_CATALOG)[number]

const BY_ID = new Map<PlushKind, PlushCatalogEntry>(PLUSH_CATALOG.map((e) => [e.id, e]))

export function getPlushCatalogEntry(kind: PlushKind): PlushCatalogEntry {
  return BY_ID.get(kind)!
}

/** 每局随机选 4 种玩偶 */
export function pickSessionPlushKinds(count = 4): PlushKind[] {
  const pool = [...PLUSH_CATALOG]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, count).map((e) => e.id)
}

/** 8 只玩偶：4 种各至少 1 个，其余随机 */
export function buildSpawnKindList(activeKinds: PlushKind[], total = 8): PlushKind[] {
  const list: PlushKind[] = [...activeKinds]
  while (list.length < total) {
    list.push(activeKinds[Math.floor(Math.random() * activeKinds.length)]!)
  }
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
  return list
}

export function plushImageUrl(file: string): string {
  return `/claw-plushies/${encodeURIComponent(file)}`
}
