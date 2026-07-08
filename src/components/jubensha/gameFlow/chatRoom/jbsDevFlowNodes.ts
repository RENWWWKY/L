import type { JBSStep } from './jbsFlowTypes'
import type { JbsVoicePlaybackState } from '../jbsProgressStore'
import type { ReadingSession } from './scriptReader/scriptReaderTypes'
import { buildScriptClues, getStoryBackgroundPremiseClueIds } from './jbsClueData'

/** 与产品「阶段流程」一致的开发调试节点 */
export type DevFlowNodeId =
  | 'opening'
  | 'story-bg'
  | 'read-intro'
  | 'public-plot-1'
  | 'unlock-act1-read'
  | 'act1-pre-discuss-clues'
  | 'discuss-1'
  | 'public-plot-2'
  | 'unlock-act2-read'
  | 'act2-pre-discuss-clues'
  | 'discuss-2'
  | 'public-plot-3'
  | 'unlock-act3-read'
  | 'act3-pre-discuss-clues'
  | 'discuss-3'
  | 'final-vote'
  | 'truth-reveal'

export type DevFlowNodeDef = {
  id: DevFlowNodeId
  index: number
  label: string
}

export const DEV_FLOW_NODES: readonly DevFlowNodeDef[] = [
  { id: 'opening', index: 1, label: '开场白' },
  { id: 'story-bg', index: 2, label: '故事背景' },
  { id: 'read-intro', index: 3, label: '阅读自我介绍' },
  { id: 'public-plot-1', index: 4, label: '公共剧情1' },
  { id: 'unlock-act1-read', index: 5, label: '解锁第一幕剧情并阅读' },
  { id: 'act1-pre-discuss-clues', index: 6, label: '第一幕后讨论前公开线索' },
  { id: 'discuss-1', index: 7, label: '公开讨论1' },
  { id: 'public-plot-2', index: 8, label: '公共剧情2' },
  { id: 'unlock-act2-read', index: 9, label: '解锁第二幕剧情并阅读' },
  { id: 'act2-pre-discuss-clues', index: 10, label: '第二幕后讨论前公开线索' },
  { id: 'discuss-2', index: 11, label: '公开讨论2' },
  { id: 'public-plot-3', index: 12, label: '公共剧情3' },
  { id: 'unlock-act3-read', index: 13, label: '解锁第三幕剧情并阅读' },
  { id: 'act3-pre-discuss-clues', index: 14, label: '第三幕后讨论前公开线索' },
  { id: 'discuss-3', index: 15, label: '公开讨论3' },
  { id: 'final-vote', index: 16, label: '最终投票' },
  { id: 'truth-reveal', index: 17, label: '真相还原' },
] as const

export type DevFlowEvidenceBatches = {
  batch1: string[]
  batch2: string[]
  batch3: string[]
}

export function getEvidenceClueBatches(scriptId: string): DevFlowEvidenceBatches {
  const clues = buildScriptClues(scriptId).filter((c) => c.category !== 'premise')
  return {
    batch1: clues.filter((c) => c.unlockStep === 6).map((c) => c.id),
    batch2: clues
      .filter((c) => c.unlockStep === 7 && c.unlockLoopRound === 2)
      .map((c) => c.id),
    batch3: clues.filter((c) => c.unlockStep >= 8).map((c) => c.id),
  }
}

export type DevFlowJumpTarget = {
  id: DevFlowNodeId
  label: string
  /** 仅 Shell：回到 DM 开场白 */
  shellOpening?: boolean
  step: JBSStep
  loopRound: number
  voice: JbsVoicePlaybackState
  readingSession: Partial<ReadingSession>
  premiseDispersalTriggered: boolean
  collectPremise: boolean
  collectBatch1: boolean
  collectBatch2: boolean
  collectBatch3: boolean
}

function voiceBase(): JbsVoicePlaybackState {
  return {
    storyBgDone: false,
    storyBgCompletedTrackCount: 0,
    act1PublicPlotDone: false,
    act1PublicPlotCompletedTrackCount: 0,
    act1ReadingPromptDismissed: false,
    introReadingPromptDismissed: false,
    act1TasksAccepted: false,
    discuss1OpeningDone: false,
    discuss1OpeningCompletedTrackCount: 0,
  }
}

export function resolveDevFlowJumpTarget(
  nodeId: DevFlowNodeId,
  scriptId: string,
): DevFlowJumpTarget {
  const def = DEV_FLOW_NODES.find((n) => n.id === nodeId)!

  if (nodeId === 'opening') {
    return {
      id: nodeId,
      label: def.label,
      shellOpening: true,
      step: 2,
      loopRound: 0,
      voice: voiceBase(),
      readingSession: { bookDelivered: false, bookOpenedOnce: false, isOpen: false, isMinimized: false },
      premiseDispersalTriggered: false,
      collectPremise: false,
      collectBatch1: false,
      collectBatch2: false,
      collectBatch3: false,
    }
  }

  const afterStoryBg: JbsVoicePlaybackState = {
    ...voiceBase(),
    storyBgDone: true,
    storyBgCompletedTrackCount: 0,
  }

  const afterIntroRead: JbsVoicePlaybackState = {
    ...afterStoryBg,
    introReadingPromptDismissed: true,
    act1ReadingPromptDismissed: true,
  }

  const atPublicPlot1: JbsVoicePlaybackState = {
    ...afterIntroRead,
    introReadingPromptDismissed: true,
    act1ReadingPromptDismissed: true,
    act1PublicPlotDone: false,
    act1PublicPlotCompletedTrackCount: 0,
  }

  const afterPublicPlot1: JbsVoicePlaybackState = {
    ...atPublicPlot1,
    act1PublicPlotDone: true,
    act1PublicPlotCompletedTrackCount: 0,
    act1ReadingPromptDismissed: false,
  }

  const afterAct1ReadAndTasks: JbsVoicePlaybackState = {
    ...afterPublicPlot1,
    act1PublicPlotDone: true,
    act1ReadingPromptDismissed: true,
    introReadingPromptDismissed: true,
    act1TasksAccepted: true,
  }

  const loop = (n: number) => n

  switch (nodeId) {
    case 'story-bg':
      return {
        id: nodeId,
        label: def.label,
        step: 2,
        loopRound: 0,
        voice: voiceBase(),
        readingSession: { bookDelivered: false, bookOpenedOnce: false },
        premiseDispersalTriggered: false,
        collectPremise: false,
        collectBatch1: false,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'read-intro':
      return {
        id: nodeId,
        label: def.label,
        step: 3,
        loopRound: 0,
        voice: {
          ...afterStoryBg,
          introReadingPromptDismissed: false,
          act1ReadingPromptDismissed: true,
        },
        readingSession: { bookDelivered: true, isOpen: false },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: false,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'public-plot-1':
      return {
        id: nodeId,
        label: def.label,
        step: 4,
        loopRound: 0,
        voice: atPublicPlot1,
        readingSession: { bookDelivered: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: false,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'unlock-act1-read':
      return {
        id: nodeId,
        label: def.label,
        step: 4,
        loopRound: 0,
        voice: afterPublicPlot1,
        readingSession: { bookDelivered: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: false,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'act1-pre-discuss-clues':
      return {
        id: nodeId,
        label: def.label,
        step: 6,
        loopRound: 0,
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: false,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'discuss-1':
      return {
        id: nodeId,
        label: def.label,
        step: 6,
        loopRound: 0,
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'public-plot-2':
      return {
        id: nodeId,
        label: def.label,
        step: 7,
        loopRound: loop(1),
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'unlock-act2-read':
      return {
        id: nodeId,
        label: def.label,
        step: 7,
        loopRound: loop(1),
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'act2-pre-discuss-clues':
      return {
        id: nodeId,
        label: def.label,
        step: 7,
        loopRound: loop(2),
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: false,
        collectBatch3: false,
      }
    case 'discuss-2':
      return {
        id: nodeId,
        label: def.label,
        step: 7,
        loopRound: loop(2),
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: false,
      }
    case 'public-plot-3':
      return {
        id: nodeId,
        label: def.label,
        step: 7,
        loopRound: loop(3),
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: false,
      }
    case 'unlock-act3-read':
      return {
        id: nodeId,
        label: def.label,
        step: 7,
        loopRound: loop(3),
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: false,
      }
    case 'act3-pre-discuss-clues':
      return {
        id: nodeId,
        label: def.label,
        step: 8,
        loopRound: 0,
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: false,
      }
    case 'discuss-3':
      return {
        id: nodeId,
        label: def.label,
        step: 8,
        loopRound: 0,
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: true,
      }
    case 'final-vote':
      return {
        id: nodeId,
        label: def.label,
        step: 8,
        loopRound: 0,
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true, hasFinishedPhase: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: true,
      }
    case 'truth-reveal':
      return {
        id: nodeId,
        label: def.label,
        step: 8,
        loopRound: 0,
        voice: afterAct1ReadAndTasks,
        readingSession: { bookDelivered: true, bookOpenedOnce: true, hasFinishedPhase: true },
        premiseDispersalTriggered: true,
        collectPremise: true,
        collectBatch1: true,
        collectBatch2: true,
        collectBatch3: true,
      }
    default:
      return resolveDevFlowJumpTarget('story-bg', scriptId)
  }
}

export function buildDevJumpCollectedClueIds(
  scriptId: string,
  target: DevFlowJumpTarget,
): string[] {
  const premiseIds = getStoryBackgroundPremiseClueIds(scriptId)
  const batches = getEvidenceClueBatches(scriptId)
  const ids: string[] = []
  if (target.collectPremise) ids.push(...premiseIds)
  if (target.collectBatch1) ids.push(...batches.batch1)
  if (target.collectBatch2) ids.push(...batches.batch2)
  if (target.collectBatch3) ids.push(...batches.batch3)
  return [...new Set(ids)]
}

export function getDevFlowNodeDef(nodeId: DevFlowNodeId): DevFlowNodeDef {
  return DEV_FLOW_NODES.find((n) => n.id === nodeId) ?? DEV_FLOW_NODES[1]
}
