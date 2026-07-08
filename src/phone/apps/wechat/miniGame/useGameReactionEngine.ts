import { useCallback, useEffect, useRef, useState } from 'react'

import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import type { GomokuDifficultyLevel } from './games/gomokuDifficulty'
import {
  buildDefaultClawSessionSetup,
  pickClawReactionLine,
  type ClawSessionSetup,
} from './games/claw/clawReactionBank'
import type { ClawDifficultyLevel } from './games/claw/clawDifficulty'
import {
  type GomokuSessionSetup,
  buildDefaultGomokuSessionSetup,
  loadGomokuPregenPromptContext,
  pickGomokuGameStartLineVariety,
  pickGomokuReactionVariety,
  pregenerateGomokuSessionSetup,
} from './gomokuReactionBank'
import type { GomokuReactionKey } from './gomokuSituation'
import { fetchGameReaction } from './miniGameAi'
import type { ClawReactionKey, GameEvent, MiniGameType } from './types'

const CLAW_KEY_REPEAT_MS: Partial<Record<ClawReactionKey, number>> = {
  thinking: 3_200,
  playerGrab: 2_000,
  playerMiss: 2_000,
  charGrab: 2_000,
  charMiss: 2_000,
  playerRare: 1_500,
  charRare: 1_500,
  drawPlayerFirst: 0,
  drawCharFirst: 0,
  gameStart: 0,
  win: 0,
  lose: 0,
  draw: 0,
}

const TURN_BASED_GAMES = new Set<MiniGameType>(['gomoku', 'claw'])
const THROTTLE_MS = 8_000
/** 同一局面键最短重复间隔；战术键短、碎碎念类略长 */
const GOMOKU_KEY_REPEAT_MS: Partial<Record<GomokuReactionKey, number>> = {
  routine: 3_200,
  playerMove: 2_400,
  playerBlockFour: 1_200,
  playerBlockWin: 1_200,
  thinking: 3_800,
  blockFour: 1_200,
  blockWin: 1_200,
  aiOpenFour: 1_200,
  aiOpenThree: 1_500,
  brilliant: 1_800,
  playerOpenFour: 1_500,
  firstMove: 0,
  charFirstMove: 0,
  drawPlayerFirst: 0,
  drawCharFirst: 0,
  win: 0,
  lose: 0,
  draw: 0,
}

const GOMOKU_TACTICAL_KEYS = new Set<GomokuReactionKey>([
  'blockFour',
  'blockWin',
  'playerBlockFour',
  'playerBlockWin',
  'aiOpenFour',
  'aiOpenThree',
  'brilliant',
  'playerOpenFour',
  'firstMove',
  'charFirstMove',
  'drawPlayerFirst',
  'drawCharFirst',
  'win',
  'lose',
  'draw',
])

/** 数值越大越优先；playerMove / routine 为最低档，不得覆盖战术/封堵类反应 */
const GOMOKU_REACTION_PRIORITY: Record<GomokuReactionKey, number> = {
  win: 100,
  lose: 100,
  draw: 100,
  playerBlockWin: 92,
  blockWin: 92,
  playerBlockFour: 90,
  blockFour: 90,
  playerOpenFour: 85,
  aiOpenFour: 84,
  brilliant: 82,
  aiOpenThree: 78,
  firstMove: 75,
  charFirstMove: 75,
  drawPlayerFirst: 75,
  drawCharFirst: 75,
  thinking: 50,
  playerMove: 10,
  routine: 10,
}

const GOMOKU_REACTION_PRIORITY_WINDOW_MS = 2_800

function gomokuReactionPriority(key: GomokuReactionKey): number {
  return GOMOKU_REACTION_PRIORITY[key] ?? 60
}

/** 关键事件不受节流限制 */
const PRIORITY_EVENTS = new Set<GameEvent['type']>(['gameOver', 'win', 'lose', 'milestone'])

/** 玩家 / 角色落子后的即时反应 */
const GOMOKU_IMMEDIATE_KEYS = new Set<GomokuReactionKey>([
  'firstMove',
  'charFirstMove',
  'drawPlayerFirst',
  'drawCharFirst',
  'playerMove',
  'playerOpenFour',
  'playerBlockFour',
  'playerBlockWin',
  'blockFour',
  'blockWin',
  'aiOpenFour',
  'aiOpenThree',
  'brilliant',
])

export type GomokuReactionContext = {
  stoneCount: number
  playerGoesFirst: boolean
  gameEnded: boolean
}

const DEFAULT_GOMOKU_CONTEXT: GomokuReactionContext = {
  stoneCount: 0,
  playerGoesFirst: true,
  gameEnded: false,
}

function mapEventToGomokuKey(event: GameEvent): GomokuReactionKey | null {
  if (event.gomokuKey) return event.gomokuKey
  if (event.type === 'win') return 'lose'
  if (event.type === 'lose') return 'win'
  if (event.type === 'gameOver' && event.detail?.includes('和')) return 'draw'
  if (event.type === 'milestone') return 'firstMove'
  if (event.type === 'opponentMove') return 'routine'
  return 'routine'
}

function isGomokuReactionKeyAllowed(
  key: GomokuReactionKey,
  ctx: GomokuReactionContext,
  eventType: GameEvent['type'],
): boolean {
  if (key === 'win' || key === 'lose' || key === 'draw') {
    return (
      ctx.gameEnded ||
      eventType === 'gameOver' ||
      eventType === 'win' ||
      eventType === 'lose'
    )
  }
  if (ctx.gameEnded) return false
  if (key === 'drawPlayerFirst' || key === 'drawCharFirst') {
    return ctx.stoneCount <= 0
  }
  if (key === 'firstMove') {
    return ctx.playerGoesFirst && ctx.stoneCount === 1
  }
  if (key === 'charFirstMove') {
    return !ctx.playerGoesFirst && ctx.stoneCount === 1
  }
  if (ctx.stoneCount <= 0) return false
  return ctx.stoneCount >= 1
}

export function useGameReactionEngine(
  charId: string,
  gameType: MiniGameType,
  reactionEnabled: boolean,
  opts?: {
    conversationKey?: string
    peerDisplayName?: string
    preloadedGomokuSetup?: GomokuSessionSetup | null
  },
) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [reactionText, setReactionText] = useState<string | null>(null)
  const [reactionVisible, setReactionVisible] = useState(false)
  const [settlementReactionText, setSettlementReactionText] = useState<string | null>(null)
  const [gomokuSetupLoading, setGomokuSetupLoading] = useState(false)
  const [gomokuSetupReady, setGomokuSetupReady] = useState(
    !reactionEnabled || (gameType !== 'gomoku' && gameType !== 'claw'),
  )
  const [clawDifficulty, setClawDifficulty] = useState<ClawDifficultyLevel>(
    buildDefaultClawSessionSetup().difficulty,
  )
  const [gomokuDifficulty, setGomokuDifficulty] = useState<GomokuDifficultyLevel>(
    buildDefaultGomokuSessionSetup().difficulty,
  )
  const [aiThinking, setAiThinkingState] = useState(false)
  const lastCallAtRef = useRef(0)
  const lastGomokuKeyShownRef = useRef<{ key: GomokuReactionKey; at: number } | null>(null)
  const pendingRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const characterRef = useRef<Character | null>(null)
  const gomokuSetupRef = useRef<GomokuSessionSetup>(buildDefaultGomokuSessionSetup())
  const gomokuUsedLinesRef = useRef<Partial<Record<GomokuReactionKey, Set<string>>>>({})
  const gomokuUsedStartLinesRef = useRef<Set<string>>(new Set())
  const gameStartShownRef = useRef(false)
  const drawResultShownRef = useRef(false)
  const settlementShownRef = useRef(false)
  const clawSetupRef = useRef<ClawSessionSetup>(buildDefaultClawSessionSetup())
  const clawUsedLinesRef = useRef<Partial<Record<ClawReactionKey, Set<string>>>>({})
  const lastClawKeyShownRef = useRef<{ key: ClawReactionKey; at: number } | null>(null)
  const clawGameStartShownRef = useRef(false)
  const clawDrawResultShownRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ch = await personaDb.getCharacter(charId)
      if (!cancelled) characterRef.current = ch
    })()
    return () => {
      cancelled = true
    }
  }, [charId])

  const gomokuContextRef = useRef<GomokuReactionContext>({ ...DEFAULT_GOMOKU_CONTEXT })

  useEffect(() => {
    gameStartShownRef.current = false
    drawResultShownRef.current = false
    settlementShownRef.current = false
    gomokuContextRef.current = { ...DEFAULT_GOMOKU_CONTEXT }
    setSettlementReactionText(null)
    setReactionVisible(false)
    setReactionText(null)
    gomokuSetupRef.current = buildDefaultGomokuSessionSetup()
    gomokuUsedLinesRef.current = {}
    gomokuUsedStartLinesRef.current = new Set()
    setGomokuDifficulty(buildDefaultGomokuSessionSetup().difficulty)
    clawSetupRef.current = buildDefaultClawSessionSetup()
    clawUsedLinesRef.current = {}
    lastClawKeyShownRef.current = null
    clawGameStartShownRef.current = false
    clawDrawResultShownRef.current = false
    setClawDifficulty(buildDefaultClawSessionSetup().difficulty)

    if (gameType === 'claw') {
      setGomokuSetupLoading(false)
      setGomokuSetupReady(true)
      return
    }

    if (!reactionEnabled || gameType !== 'gomoku') {
      setGomokuSetupLoading(false)
      setGomokuSetupReady(true)
      return
    }
    const preloaded = opts?.preloadedGomokuSetup
    if (preloaded) {
      gomokuSetupRef.current = preloaded
      setGomokuDifficulty(preloaded.difficulty)
      setGomokuSetupLoading(false)
      setGomokuSetupReady(true)
      return
    }
    let cancelled = false
    setGomokuSetupLoading(true)
    setGomokuSetupReady(false)
    void (async () => {
      const character = characterRef.current ?? (await personaDb.getCharacter(charId))
      if (!cancelled) characterRef.current = character
      const ctx = await loadGomokuPregenPromptContext({
        characterId: charId,
        character,
        conversationKey: opts?.conversationKey,
        peerDisplayName: opts?.peerDisplayName ?? character?.name,
        api: apiConfig,
      })
      const setup = await pregenerateGomokuSessionSetup({
        api: apiConfig,
        character,
        characterId: charId,
        conversationKey: opts?.conversationKey,
        peerDisplayName: opts?.peerDisplayName ?? character?.name,
        chatContext: ctx.chatContext,
        worldBookText: ctx.worldBookText,
        longTermMemoryText: ctx.longTermMemoryText,
      })
      if (cancelled) return
      gomokuSetupRef.current = setup
      setGomokuDifficulty(setup.difficulty)
      setGomokuSetupLoading(false)
      setGomokuSetupReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [apiConfig, charId, gameType, reactionEnabled, opts?.conversationKey, opts?.peerDisplayName, opts?.preloadedGomokuSetup])

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const clearThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = null
    }
  }, [])

  const showReaction = useCallback(
    (text: string, holdMs = 4000, opts?: { keepVisibleAfterHold?: boolean }) => {
      clearHideTimer()
      setReactionText(text)
      setReactionVisible(true)
      /** 五子棋对局中气泡保持到下一局面替换，避免自动收起造成一闪一闪 */
      if (opts?.keepVisibleAfterHold || TURN_BASED_GAMES.has(gameType)) return
      hideTimerRef.current = setTimeout(() => {
        setReactionVisible(false)
        hideTimerRef.current = setTimeout(() => setReactionText(null), 400)
      }, holdMs)
    },
    [clearHideTimer, gameType],
  )

  const syncGomokuContext = useCallback((ctx: GomokuReactionContext) => {
    gomokuContextRef.current = ctx
  }, [])

  const pickGomokuLine = useCallback((key: GomokuReactionKey): string | null => {
    const allowPostGameLines = key === 'win' || key === 'lose' || key === 'draw'
    const used = gomokuUsedLinesRef.current[key] ?? new Set<string>()
    const line = pickGomokuReactionVariety(gomokuSetupRef.current.bank, key, used, {
      allowPostGameLines,
    })
    if (line) gomokuUsedLinesRef.current[key] = used
    return line
  }, [])

  const showGomokuReactionForKey = useCallback(
    (key: GomokuReactionKey, holdMs = 4000, eventType: GameEvent['type'] = 'opponentMove') => {
      const ctx = gomokuContextRef.current
      if (!isGomokuReactionKeyAllowed(key, ctx, eventType)) return false

      const now = Date.now()
      const last = lastGomokuKeyShownRef.current
      const repeatMs = GOMOKU_KEY_REPEAT_MS[key] ?? 1_800
      if (repeatMs > 0 && last && last.key === key && now - last.at < repeatMs) return false

      const incomingPri = gomokuReactionPriority(key)
      if (last && now - last.at < GOMOKU_REACTION_PRIORITY_WINDOW_MS) {
        const lastPri = gomokuReactionPriority(last.key)
        if (incomingPri < lastPri) return false
      }

      if (key === 'win' || key === 'lose' || key === 'draw') {
        if (settlementShownRef.current) return false
        settlementShownRef.current = true
      }

      const line = pickGomokuLine(key)
      if (!line) return false

      lastCallAtRef.current = now
      lastGomokuKeyShownRef.current = { key, at: now }
      showReaction(line, holdMs, { keepVisibleAfterHold: true })

      if (key === 'win' || key === 'lose' || key === 'draw') {
        setSettlementReactionText(line)
      }
      return true
    },
    [pickGomokuLine, showReaction],
  )

  const showClawReactionForKey = useCallback(
    (key: ClawReactionKey, holdMs = 3600) => {
      const now = Date.now()
      const last = lastClawKeyShownRef.current
      const repeatMs = CLAW_KEY_REPEAT_MS[key] ?? 1_800
      if (repeatMs > 0 && last && last.key === key && now - last.at < repeatMs) return false

      if (key === 'win' || key === 'lose' || key === 'draw') {
        if (settlementShownRef.current) return false
        settlementShownRef.current = true
      }

      const used = clawUsedLinesRef.current[key] ?? new Set<string>()
      const line = pickClawReactionLine(key, used)
      if (!line) return false
      clawUsedLinesRef.current[key] = used

      lastCallAtRef.current = now
      lastClawKeyShownRef.current = { key, at: now }
      showReaction(line, holdMs, { keepVisibleAfterHold: true })

      if (key === 'win' || key === 'lose' || key === 'draw') {
        setSettlementReactionText(line)
      }
      return true
    },
    [showReaction],
  )

  const triggerClawDrawResultReaction = useCallback(
    (playerGoesFirst: boolean) => {
      if (!reactionEnabled || gameType !== 'claw') return
      if (clawDrawResultShownRef.current) return
      clawDrawResultShownRef.current = true
      const key: ClawReactionKey = playerGoesFirst ? 'drawPlayerFirst' : 'drawCharFirst'
      showClawReactionForKey(key, 3600)
    },
    [gameType, reactionEnabled, showClawReactionForKey],
  )

  const triggerClawGameStartReaction = useCallback(() => {
    if (!reactionEnabled || gameType !== 'claw') return
    if (clawGameStartShownRef.current) return
    if (clawDrawResultShownRef.current) {
      clawGameStartShownRef.current = true
      return
    }
    clawGameStartShownRef.current = true
    showClawReactionForKey('gameStart', 4200)
  }, [gameType, reactionEnabled, showClawReactionForKey])

  const triggerGomokuDrawResultReaction = useCallback(
    (playerGoesFirst: boolean) => {
      if (!reactionEnabled || gameType !== 'gomoku') return
      if (drawResultShownRef.current) return
      const ctx = gomokuContextRef.current
      if (ctx.gameEnded || ctx.stoneCount > 0) return
      drawResultShownRef.current = true
      const key: GomokuReactionKey = playerGoesFirst ? 'drawPlayerFirst' : 'drawCharFirst'
      showGomokuReactionForKey(key, 3600, 'milestone')
    },
    [gameType, reactionEnabled, showGomokuReactionForKey],
  )

  const triggerGomokuGameStartReaction = useCallback(() => {
    if (!reactionEnabled || gameType !== 'gomoku') return
    if (gameStartShownRef.current) return
    /** 先手抽签已有一句开场白，不再叠 gameStartLines */
    if (drawResultShownRef.current) {
      gameStartShownRef.current = true
      return
    }
    const ctx = gomokuContextRef.current
    if (ctx.gameEnded || ctx.stoneCount > 0) return
    gameStartShownRef.current = true
    const line = pickGomokuGameStartLineVariety(gomokuSetupRef.current, gomokuUsedStartLinesRef.current)
    if (line) showReaction(line, 4200, { keepVisibleAfterHold: true })
  }, [gameType, reactionEnabled, showReaction])

  const setAiThinking = useCallback(
    (thinking: boolean) => {
      setAiThinkingState(thinking)
      clearThinkingTimer()
      if (!thinking || !reactionEnabled) return
      if (gameType === 'claw') {
        thinkingTimerRef.current = setTimeout(() => {
          thinkingTimerRef.current = null
          showClawReactionForKey('thinking', 3400)
        }, 650)
        return
      }
      if (gameType !== 'gomoku') return
      const ctx = gomokuContextRef.current
      if (ctx.gameEnded || ctx.stoneCount <= 0) return
      thinkingTimerRef.current = setTimeout(() => {
        thinkingTimerRef.current = null
        const last = lastGomokuKeyShownRef.current
        const now = Date.now()
        if (last && now - last.at < GOMOKU_REACTION_PRIORITY_WINDOW_MS) {
          if (gomokuReactionPriority(last.key) > gomokuReactionPriority('thinking')) return
        }
        showGomokuReactionForKey('thinking', 3400, 'opponentMove')
      }, 650)
    },
    [clearThinkingTimer, gameType, reactionEnabled, showClawReactionForKey, showGomokuReactionForKey],
  )

  const pickThinkDelayMs = useCallback((): number => {
    if (gameType === 'claw') {
      const setup = clawSetupRef.current
      const min = setup.thinkDelayMinMs
      const max = setup.thinkDelayMaxMs
      if (max <= min) return min
      return Math.round(min + Math.random() * (max - min))
    }
    const setup = gomokuSetupRef.current
    const min = setup.thinkDelayMinMs
    const max = setup.thinkDelayMaxMs
    if (max <= min) return min
    return Math.round(min + Math.random() * (max - min))
  }, [gameType])

  const emitEvent = useCallback(
    (event: GameEvent) => {
      if (!reactionEnabled) return
      if (pendingRef.current) return

      const now = Date.now()
      const throttle = THROTTLE_MS

      if (gameType === 'claw') {
        const key = event.clawKey
        if (!key) return
        const holdMs =
          key === 'win' || key === 'lose' || key === 'draw'
            ? 4200
            : key === 'thinking'
              ? 3400
              : 3000
        showClawReactionForKey(key, holdMs)
        return
      }

      if (gameType === 'gomoku') {
        const key = mapEventToGomokuKey(event)
        if (!key) return
        const holdMs =
          key === 'win' || key === 'lose' || key === 'draw'
            ? 4200
            : key === 'thinking'
              ? 3400
              : GOMOKU_TACTICAL_KEYS.has(key)
                ? 3200
                : GOMOKU_IMMEDIATE_KEYS.has(key)
                  ? 2800
                  : 3000
        showGomokuReactionForKey(key, holdMs, event.type)
        return
      }

      if (!PRIORITY_EVENTS.has(event.type) && now - lastCallAtRef.current < throttle) {
        return
      }

      pendingRef.current = true
      void (async () => {
        try {
          const text = await fetchGameReaction({
            api: apiConfig,
            character: characterRef.current,
            gameType,
            eventType: event.type,
            eventDetail: event.detail,
            score: event.score,
          })
          if (text) {
            lastCallAtRef.current = Date.now()
            showReaction(text)
          }
        } finally {
          pendingRef.current = false
        }
      })()
    },
    [apiConfig, gameType, reactionEnabled, showClawReactionForKey, showGomokuReactionForKey, showReaction],
  )

  useEffect(
    () => () => {
      clearHideTimer()
      clearThinkingTimer()
    },
    [clearHideTimer, clearThinkingTimer],
  )

  return {
    reactionText,
    reactionVisible,
    settlementReactionText,
    emitEvent,
    gomokuSetupLoading,
    aiThinking,
    setAiThinking,
    syncGomokuContext,
    triggerGomokuGameStartReaction,
    triggerGomokuDrawResultReaction,
    triggerClawDrawResultReaction,
    triggerClawGameStartReaction,
    pickThinkDelayMs,
    gomokuDifficulty,
    clawDifficulty,
    gomokuSetupReady,
    getGomokuDifficulty: () => gomokuSetupRef.current.difficulty,
    getClawDifficulty: () => clawSetupRef.current.difficulty,
  }
}
