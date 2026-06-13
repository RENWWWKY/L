import { useSyncExternalStore } from 'react'

import {
  getMomentInteractionGenerationSnapshot,
  isMomentInteractionGenerationPending,
  subscribeMomentInteractionGeneration,
  type MomentInteractionGenerationOutcome,
} from './momentInteractionGenerationRegistry'

export function useMomentInteractionGenerationPending(momentId: string): boolean {
  const id = momentId.trim()
  return useSyncExternalStore(
    subscribeMomentInteractionGeneration,
    () => (id ? isMomentInteractionGenerationPending(id) : false),
    () => false,
  )
}

export function useMomentInteractionGenerationState(momentId: string): {
  pending: boolean
  outcome: MomentInteractionGenerationOutcome | null
  outcomeAt: number
  aiDraftCount: number
} {
  const id = momentId.trim()
  return useSyncExternalStore(
    subscribeMomentInteractionGeneration,
    () => getMomentInteractionGenerationSnapshot(id),
    () => getMomentInteractionGenerationSnapshot(''),
  )
}
