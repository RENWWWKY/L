/** 五子棋 · Alpha-Beta 剪枝 Minimax 本地 AI */
export type GomokuCell = 0 | 1 | 2 // 0=空 1=黑(玩家) 2=白(AI)

const SIZE = 15
const WIN = 5
const INF = 1_000_000

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE
}

function countLine(board: GomokuCell[][], r: number, c: number, dr: number, dc: number, player: 1 | 2) {
  let n = 0
  let rr = r
  let cc = c
  while (inBounds(rr, cc) && board[rr]![cc] === player) {
    n++
    rr += dr
    cc += dc
  }
  return n
}

function evaluatePoint(board: GomokuCell[][], r: number, c: number, player: 1 | 2): number {
  if (board[r]![c] !== 0) return 0
  let score = 0
  for (const [dr, dc] of DIRS) {
    const fwd = countLine(board, r + dr, c + dc, dr, dc, player)
    const bwd = countLine(board, r - dr, c - dc, -dr, -dc, player)
    const len = fwd + bwd
    if (len >= 4) score += 12000
    else if (len === 3) score += 800
    else if (len === 2) score += 80
    else if (len === 1) score += 8
  }
  const center = Math.abs(r - 7) + Math.abs(c - 7)
  score += Math.max(0, 14 - center)
  return score
}

function evaluateBoard(board: GomokuCell[][], ai: 2, human: 1): number {
  let s = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]![c] === 0) {
        s += evaluatePoint(board, r, c, ai) * 1.05
        s -= evaluatePoint(board, r, c, human)
      }
    }
  }
  return s
}

function checkWin(board: GomokuCell[][], r: number, c: number, player: 1 | 2): boolean {
  for (const [dr, dc] of DIRS) {
    const fwd = countLine(board, r + dr, c + dc, dr, dc, player)
    const bwd = countLine(board, r - dr, c - dc, -dr, -dc, player)
    if (fwd + bwd + 1 >= WIN) return true
  }
  return false
}

function orderedMoves(board: GomokuCell[][]): [number, number][] {
  const moves: { r: number; c: number; s: number }[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]![c] !== 0) continue
      let near = false
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (inBounds(nr, nc) && board[nr]![nc] !== 0) {
            near = true
            break
          }
        }
      }
      if (!near && board.flat().some((x) => x !== 0)) continue
      const s = evaluatePoint(board, r, c, 2) + evaluatePoint(board, r, c, 1)
      moves.push({ r, c, s })
    }
  }
  moves.sort((a, b) => b.s - a.s)
  return moves.slice(0, 12).map((m) => [m.r, m.c] as [number, number])
}

function minimax(
  board: GomokuCell[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r]![c]
      if (v === 0) continue
      if (checkWin(board, r, c, v)) return v === 2 ? INF - (4 - depth) : -INF + (4 - depth)
    }
  }
  if (depth === 0) return evaluateBoard(board, 2, 1)

  const moves = orderedMoves(board)
  if (!moves.length) return 0

  if (maximizing) {
    let best = -INF
    for (const [r, c] of moves) {
      board[r]![c] = 2
      const val = minimax(board, depth - 1, alpha, beta, false)
      board[r]![c] = 0
      best = Math.max(best, val)
      alpha = Math.max(alpha, val)
      if (beta <= alpha) break
    }
    return best
  }

  let best = INF
  for (const [r, c] of moves) {
    board[r]![c] = 1
    const val = minimax(board, depth - 1, alpha, beta, true)
    board[r]![c] = 0
    best = Math.min(best, val)
    beta = Math.min(beta, val)
    if (beta <= alpha) break
  }
  return best
}

export function createEmptyBoard(): GomokuCell[][] {
  return Array.from({ length: SIZE }, () => Array<GomokuCell>(SIZE).fill(0))
}

export function gomokuAiMove(board: GomokuCell[][]): { r: number; c: number; brilliant: boolean } | null {
  const moves = orderedMoves(board)
  if (!moves.length) {
    return { r: 7, c: 7, brilliant: false }
  }

  // 即时获胜 / 必防
  for (const [r, c] of moves) {
    board[r]![c] = 2
    const win = checkWin(board, r, c, 2)
    board[r]![c] = 0
    if (win) return { r, c, brilliant: true }
  }
  for (const [r, c] of moves) {
    board[r]![c] = 1
    const block = checkWin(board, r, c, 1)
    board[r]![c] = 0
    if (block) return { r, c, brilliant: false }
  }

  let bestMove = moves[0]!
  let bestScore = -INF
  const depth = board.flat().filter((x) => x !== 0).length < 4 ? 2 : 3

  for (const [r, c] of moves) {
    board[r]![c] = 2
    const score = minimax(board, depth, -INF, INF, false)
    board[r]![c] = 0
    if (score > bestScore) {
      bestScore = score
      bestMove = [r, c]
    }
  }

  const brilliant = bestScore > INF - 100
  return { r: bestMove[0], c: bestMove[1], brilliant }
}

export const GOMOKU_SIZE = SIZE

export function gomokuCheckWin(board: GomokuCell[][], r: number, c: number, player: 1 | 2) {
  return checkWin(board, r, c, player)
}

export function gomokuIsFull(board: GomokuCell[][]) {
  return board.every((row) => row.every((c) => c !== 0))
}
