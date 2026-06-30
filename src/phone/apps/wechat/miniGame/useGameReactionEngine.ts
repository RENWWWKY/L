import { useCallback, useEffect, useRef, useState } from 'react'

import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { fetchGameReaction } from './miniGameAi'
import type { GameEvent, MiniGameType } from './types'

const THROTTLE_MS = 30_000

/** 关键事件不受节流限制 */
const PRIORITY_EVENTS = new Set<GameEvent['type']>(['gameOver', 'win', 'lose', 'milestone'])

export function useGameReactionEngine(
  charId: string,
  gameType: MiniGameType,
  reactionEnabled: boolean,
) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const [reactionText, setReactionText] = useState<string | null>(null)
  const [reactionVisible, setReactionVisible] = useState(false)
  const lastCallAtRef = useRef(0)
  const pendingRef = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const characterRef = useRef<Character | null>(null)

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

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const showReaction = useCallback(
    (text: string) => {
      clearHideTimer()
      setReactionText(text)
      setReactionVisible(true)
      hideTimerRef.current = setTimeout(() => {
        setReactionVisible(false)
        hideTimerRef.current = setTimeout(() => setReactionText(null), 400)
      }, 4000)
    },
    [clearHideTimer],
  )

  const emitEvent = useCallback(
    (event: GameEvent) => {
      if (!reactionEnabled) return
      if (pendingRef.current) return

      const now = Date.now()
      if (!PRIORITY_EVENTS.has(event.type) && now - lastCallAtRef.current < THROTTLE_MS) {
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
    [apiConfig, gameType, reactionEnabled, showReaction],
  )

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  return { reactionText, reactionVisible, emitEvent }
}
