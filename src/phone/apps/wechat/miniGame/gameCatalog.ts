import type { MiniGameType } from './types'

/** 抓娃娃机暂用「开发中」占位；改 false 恢复完整流程 */
export const CLAW_MACHINE_UNDER_DEV = true

export interface GameCatalogEntry {
  id: MiniGameType
  /** 列表副标题 / 一句话说明 */
  subtitle: string
  zh: string
  /** 是否已接入完整流程（未接入则显示开发中） */
  available?: boolean
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  { id: 'gravity', zh: '合成大西瓜', subtitle: '越合越大', available: false },
  { id: 'gomoku', zh: '五子棋', subtitle: '和角色对弈', available: true },
  { id: 'claw', zh: '抓娃娃机', subtitle: '和角色轮流抓', available: !CLAW_MACHINE_UNDER_DEV },
  { id: 'serpent', zh: '贪吃蛇', subtitle: '吃豆变长', available: false },
  { id: 'tetromino', zh: '俄罗斯方块', subtitle: '消除整行', available: false },
  { id: 'bubble', zh: '泡泡龙', subtitle: '射泡泡消除', available: false },
  { id: 'stars', zh: '消星星', subtitle: '三个连起来消', available: false },
]

export function isGameAvailable(id: MiniGameType): boolean {
  const entry = GAME_CATALOG.find((g) => g.id === id)
  return entry?.available !== false
}

export function getGameLabel(id: MiniGameType): string {
  const entry = GAME_CATALOG.find((g) => g.id === id)
  return entry?.zh ?? id
}

export function getGameDisplayName(id: MiniGameType): string {
  return getGameLabel(id)
}
