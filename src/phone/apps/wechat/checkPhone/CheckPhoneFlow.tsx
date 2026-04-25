import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'

import { ConsentModal } from './ConsentModal'
import { SpyInfiltrationAnimation } from './SpyInfiltrationAnimation'
import { SpyDesktop } from './SpyDesktop'

type FlowStage = 'consent' | 'infiltrate' | 'desktop'

export function CheckPhoneFlow({
  open,
  characterId,
  characterName,
  playerIdentityId,
  playerDisplayName,
  useLumiProjectAssistantPrompt,
  onClose,
  onToast,
}: {
  open: boolean
  characterId: string
  characterName: string
  playerIdentityId: string
  playerDisplayName: string
  useLumiProjectAssistantPrompt: boolean
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const [stage, setStage] = useState<FlowStage>('consent')

  const resetAndClose = useCallback(() => {
    setStage('consent')
    onClose()
  }, [onClose])

  const onInfiltrationDone = useCallback(() => {
    setStage('desktop')
  }, [])

  const spyLabel = useMemo(() => {
    const pool = ['Accessing...', 'Decryption...', 'Handshake...', 'Bypassing...']
    return pool[Math.floor(Math.random() * pool.length)] ?? 'Accessing...'
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <ConsentModal
            open={stage === 'consent'}
            onClose={resetAndClose}
            onAsk={() => {
              onToast('Ask 分支即将上线')
              resetAndClose()
            }}
            onSpy={() => setStage('infiltrate')}
          />

          {stage === 'infiltrate' ? (
            <SpyInfiltrationAnimation
              label={spyLabel}
              onDone={onInfiltrationDone}
            />
          ) : null}

          {stage === 'desktop' ? (
            <SpyDesktop
              characterId={characterId}
              characterName={characterName}
              playerIdentityId={playerIdentityId}
              playerDisplayName={playerDisplayName}
              useLumiProjectAssistantPrompt={useLumiProjectAssistantPrompt}
              onToast={onToast}
              onExit={resetAndClose}
            />
          ) : null}
        </>
      ) : null}
    </AnimatePresence>
  )
}

