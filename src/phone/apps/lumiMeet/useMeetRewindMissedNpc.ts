import { useCallback, useState } from 'react'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { aiMeetPostMatchOpeningLines, scrubMeetNpcWechatLeaks } from './lumiMeetAi'
import { computeMeetNpcStaggerDelayMs, sleep, yieldToPaint } from './lumiMeetChatReveal'
import { useMeetStore } from './LumiMeetStore'
import { resolveMeetDualPersonaDirective } from './meetMaskTruthPrompt'
import type { EncounterNPC } from './meetTypes'

export function useMeetRewindMissedNpc() {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { state, rewindMissedToMatched, pushChatMessage, bumpIntimacy } = useMeetStore()
  const [confirmNpc, setConfirmNpc] = useState<EncounterNPC | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)

  const charges = state.rewindChargesRemaining

  const canRewindNpc = useCallback(
    (npc: EncounterNPC | null | undefined): npc is EncounterNPC =>
      !!npc && npc.status === 'missed' && charges > 0,
    [charges],
  )

  const requestRewind = useCallback((npc: EncounterNPC) => {
    setConfirmNpc(npc)
  }, [])

  const cancelRewind = useCallback(() => setConfirmNpc(null), [])

  const confirmRewind = useCallback(() => {
    if (!confirmNpc) return
    const id = confirmNpc.id
    const npc = confirmNpc
    const ok = rewindMissedToMatched(id)
    if (!ok) {
      setConfirmNpc(null)
      return
    }
    const threadBefore = state.chatThreads[id] ?? []
    bumpIntimacy(id, 22)
    setConfirmNpc(null)
    setRevealingId(id)
    window.setTimeout(() => setRevealingId(null), 1600)
    void (async () => {
      if (!threadBefore.length) {
        const dual = await resolveMeetDualPersonaDirective(state.meetProfile)
        const lines = scrubMeetNpcWechatLeaks(
          await aiMeetPostMatchOpeningLines({
            apiConfig,
            npc,
            userProfile: state.meetProfile,
            dualPersonaDirective: dual,
          }),
          'none',
          npc.wechatId,
        )
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!
          if (i > 0) await sleep(computeMeetNpcStaggerDelayMs(lines[i - 1]!))
          else if (lines.length > 1) await sleep(320)
          pushChatMessage(id, { role: 'npc', content: line })
          await yieldToPaint()
        }
      }
    })()
    return true
  }, [
    apiConfig,
    bumpIntimacy,
    confirmNpc,
    pushChatMessage,
    rewindMissedToMatched,
    state.chatThreads,
    state.meetProfile,
  ])

  return {
    charges,
    confirmNpc,
    revealingId,
    canRewindNpc,
    requestRewind,
    cancelRewind,
    confirmRewind,
  }
}
