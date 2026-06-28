import { useCallback, useEffect, useState } from 'react'
import { MEMORY_HUB_COACH_SEEN_KEY, readMemoryCoachSeen, writeMemoryCoachSeen } from './memoryCoachTypes'

export function useMemoryTabCoach(params: {
  seenKey: string
  coachActive: boolean
  loading?: boolean
  startCoachEvent?: string
}) {
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [tutorialOpen, setTutorialOpen] = useState(false)

  const startLiveCoach = useCallback(() => {
    setCoachStepIndex(0)
    setCoachOpen(true)
  }, [])

  const finishCoach = useCallback(
    (opts?: { openTutorial?: boolean }) => {
      writeMemoryCoachSeen(params.seenKey)
      setCoachOpen(false)
      setCoachStepIndex(0)
      if (opts?.openTutorial) setTutorialOpen(true)
    },
    [params.seenKey],
  )

  useEffect(() => {
    if (!params.coachActive) {
      setCoachOpen(false)
      setCoachStepIndex(0)
      return
    }
    if (params.loading) return
    if (!readMemoryCoachSeen(MEMORY_HUB_COACH_SEEN_KEY)) return
    if (readMemoryCoachSeen(params.seenKey)) return
    const id = window.setTimeout(() => startLiveCoach(), 640)
    return () => window.clearTimeout(id)
  }, [params.coachActive, params.loading, params.seenKey, startLiveCoach])

  useEffect(() => {
    const eventName = params.startCoachEvent
    if (!eventName) return
    const onStart = () => startLiveCoach()
    window.addEventListener(eventName, onStart)
    return () => window.removeEventListener(eventName, onStart)
  }, [params.startCoachEvent, startLiveCoach])

  return {
    coachOpen,
    coachStepIndex,
    setCoachStepIndex,
    tutorialOpen,
    setTutorialOpen,
    startLiveCoach,
    finishCoach,
  }
}

export function dispatchMemoryTabCoachForHubTab(tabId: string) {
  const map: Record<string, string> = {
    config: 'memory-engine-start-coach',
    memories: 'memory-archive-start-coach',
    epilogue: 'memory-epilogue-start-coach',
    progress: 'memory-progress-start-coach',
    retry: 'memory-retry-start-coach',
  }
  const event = map[tabId]
  if (event) window.dispatchEvent(new CustomEvent(event))
}
