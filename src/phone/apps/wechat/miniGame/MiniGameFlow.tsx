import { useCallback, useEffect, useState } from 'react'

import { GameCanvas } from './GameCanvas'
import { GameLobbySheet } from './GameLobbySheet'
import type { MiniGameType } from './types'

export function MiniGameFlow({
  open,
  charId,
  avatarUrl,
  onClose,
}: {
  open: boolean
  charId: string
  avatarUrl?: string
  onClose: () => void
}) {
  const [activeGame, setActiveGame] = useState<MiniGameType | null>(null)
  const [reactionEnabled, setReactionEnabled] = useState(true)

  useEffect(() => {
    if (!open) {
      setActiveGame(null)
    }
  }, [open])

  const handleCloseAll = useCallback(() => {
    setActiveGame(null)
    onClose()
  }, [onClose])

  const handleLaunch = useCallback((game: MiniGameType, reactions: boolean) => {
    setReactionEnabled(reactions)
    setActiveGame(game)
  }, [])

  const showLobby = open && !activeGame

  return (
    <>
      <GameLobbySheet open={showLobby} onClose={handleCloseAll} onLaunch={handleLaunch} />
      {activeGame ? (
        <GameCanvas
          open={!!activeGame}
          gameType={activeGame}
          charId={charId}
          avatarUrl={avatarUrl}
          reactionEnabled={reactionEnabled}
          onClose={() => setActiveGame(null)}
        />
      ) : null}
    </>
  )
}
