import type { JBSStep } from './jbsFlowTypes'
import {
  getYuyeGuilingAdvanceDmBodies,
  getYuyeGuilingBootDmBodies,
  getYuyeGuilingSystemHint,
  isYuyeGuilingScript,
} from './yuyeGuilingDmFlow'

export type FlowAdvanceState = { step: JBSStep; loopRound: number }

/** 点击「推进」后的下一进程 */
export function computeNextFlowState(state: FlowAdvanceState): FlowAdvanceState {
  const { step, loopRound } = state
  if (step < 7) {
    let nextStep = (step + 1) as JBSStep
    if (step === 4) nextStep = 6
    return {
      step: nextStep,
      loopRound: nextStep === 7 ? 1 : loopRound,
    }
  }
  if (step === 7 && loopRound < 3) {
    return { step: 7, loopRound: loopRound + 1 }
  }
  if (step === 7 && loopRound >= 3) {
    return { step: 8, loopRound }
  }
  return state
}

export function getBootDmBodies(scriptId: string): string[] {
  if (isYuyeGuilingScript(scriptId)) return getYuyeGuilingBootDmBodies()
  return []
}

export function getAdvanceDmBodies(
  scriptId: string,
  state: FlowAdvanceState,
): string[] {
  if (!isYuyeGuilingScript(scriptId)) return []
  return getYuyeGuilingAdvanceDmBodies(state.step, state.loopRound)
}

export function getAdvanceSystemHint(scriptId: string, state: FlowAdvanceState): string | null {
  if (!isYuyeGuilingScript(scriptId)) return null
  return getYuyeGuilingSystemHint(state.step, state.loopRound)
}
