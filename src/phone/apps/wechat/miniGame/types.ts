/** 游乐空间 · 本地游戏类型 */
export type MiniGameType =
  | 'gravity'
  | 'gomoku'
  | 'serpent'
  | 'tetromino'
  | 'bubble'
  | 'stars'

/** 游戏内事件 — 由本地引擎抛出，驱动 LLM 伴玩反馈 */
export type GameEventType =
  | 'combo'
  | 'crisis'
  | 'gameOver'
  | 'opponentMove'
  | 'milestone'
  | 'win'
  | 'lose'

export interface GameEvent {
  type: GameEventType
  /** 人类可读细节，如「三连消」「棋盘将满」 */
  detail?: string
  score?: number
  won?: boolean
}

export type GameEventEmitter = (event: GameEvent) => void

/** 极简黑白色板 */
export const MONO = {
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  ink: '#0A0A0C',
  inkSoft: '#374151',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  platinum: '#D4D4D8',
  platinumBright: '#E8E8EC',
} as const
