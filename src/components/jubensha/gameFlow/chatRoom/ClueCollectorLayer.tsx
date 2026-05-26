import { useEffect, useRef } from 'react'

import { useJBSFlow } from './JBSFlowEngine'
import { ClueCollector } from './ClueCollector'

export type ClueCollectorLayerProps = {
  collectTargetRef: React.RefObject<HTMLElement | null>
}

/** 管理飞牌队列：同一时刻仅展示一张，收集完成后自动播放下一张 */
export function ClueCollectorLayer({ collectTargetRef }: ClueCollectorLayerProps) {
  const { clues, activeDispersalClueId, completeClueDispersal } = useJBSFlow()
  const clue = clues.find((c) => c.id === activeDispersalClueId)
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    handledRef.current = null
  }, [activeDispersalClueId])

  if (!clue || !activeDispersalClueId) return null

  return (
    <ClueCollector
      key={activeDispersalClueId}
      clue={clue}
      collectTargetRef={collectTargetRef}
      onCollectComplete={(id) => {
        if (handledRef.current === id) return
        handledRef.current = id
        completeClueDispersal(id)
      }}
    />
  )
}
