/** 游乐空间 · 本地游戏类型 */
export type MiniGameType =
  | 'gravity'
  | 'gomoku'
  | 'claw'
  | 'serpent'
  | 'tetromino'
  | 'bubble'
  | 'stars'

export type GameEventType =
  | 'combo'
  | 'crisis'
  | 'gameOver'
  | 'opponentMove'
  | 'milestone'
  | 'win'
  | 'lose'

/** 五子棋局面反应键（见 gomokuSituation.ts） */
export type GomokuReactionKey =
  | 'blockFour'
  | 'blockWin'
  | 'playerBlockFour'
  | 'playerBlockWin'
  | 'aiOpenFour'
  | 'aiOpenThree'
  | 'playerOpenFour'
  | 'playerMove'
  | 'brilliant'
  | 'routine'
  | 'thinking'
  | 'firstMove'
  | 'charFirstMove'
  | 'drawPlayerFirst'
  | 'drawCharFirst'
  | 'win'
  | 'lose'
  | 'draw'

/** 抓娃娃机局面反应键 */
export type ClawReactionKey =
  | 'drawPlayerFirst'
  | 'drawCharFirst'
  | 'playerGrab'
  | 'playerMiss'
  | 'charGrab'
  | 'charMiss'
  | 'playerRare'
  | 'charRare'
  | 'thinking'
  | 'win'
  | 'lose'
  | 'draw'
  | 'gameStart'

export interface GameEvent {
  type: GameEventType
  /** 人类可读细节，如「三连消」「棋盘将满」 */
  detail?: string
  score?: number
  won?: boolean
  /** 五子棋：预生成台词库索引键 */
  gomokuKey?: GomokuReactionKey
  /** 抓娃娃机：预置台词库索引键 */
  clawKey?: ClawReactionKey
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
