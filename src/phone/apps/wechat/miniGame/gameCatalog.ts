import type { MiniGameType } from './types'

export interface GameCatalogEntry {
  id: MiniGameType
  /** 列表副标题 / 一句话说明 */
  subtitle: string
  zh: string
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  { id: 'gravity', zh: '合成大西瓜', subtitle: '越合越大' },
  { id: 'gomoku', zh: '五子棋', subtitle: '和人机下棋' },
  { id: 'serpent', zh: '贪吃蛇', subtitle: '吃豆变长' },
  { id: 'tetromino', zh: '俄罗斯方块', subtitle: '消除整行' },
  { id: 'bubble', zh: '泡泡龙', subtitle: '射泡泡消除' },
  { id: 'stars', zh: '消星星', subtitle: '三个连起来消' },
]

export function getGameLabel(id: MiniGameType): string {
  const entry = GAME_CATALOG.find((g) => g.id === id)
  return entry?.zh ?? id
}

export function getGameDisplayName(id: MiniGameType): string {
  return getGameLabel(id)
}
