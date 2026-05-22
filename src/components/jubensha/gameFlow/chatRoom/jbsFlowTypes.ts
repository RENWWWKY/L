/** 剧本杀沉浸式暗室 · 八步生命周期与聊天模型 */

export type JBSStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type JBSChatMessageKind = 'dm' | 'player' | 'system'

export type JBSChatMessage = {
  id: string
  kind: JBSChatMessageKind
  body: string
  /** 玩家发言时的剧本杀角色昵称 */
  roleName?: string
  at: number
}

export type DrawerTab = 'script' | 'manuscript' | 'clues'

export type ScriptSectionId = 'intro' | 'act1' | 'act2' | 'act3' | 'finale'

export type ScriptSection = {
  id: ScriptSectionId
  title: string
  body: string
}

export type JBSClue = {
  id: string
  title: string
  description: string
  /** 缩略图：物证插画 URL 或 data URI，禁止人物 */
  imageUrl: string
  /** 解锁所需最低步骤；Step 7 可叠加 loopRound */
  unlockStep: JBSStep
  unlockLoopRound?: number
}

export const JBS_STEP_LABELS: Record<JBSStep, string> = {
  1: '抽取角色卡',
  2: '故事背景',
  3: '自我介绍与第一幕',
  4: '公共剧情 A',
  5: '第一幕衔接',
  6: '第一轮讨论',
  7: '循环推进',
  8: '投票与真相',
}

export function jbsStepAnnouncement(step: JBSStep): string {
  const label = JBS_STEP_LABELS[step]
  switch (step) {
    case 2:
      return `现在进入第二阶段「${label}」。请静听主持人宣读背景，勿翻阅个人剧本中的后续章节。`
    case 3:
      return `现在进入第三阶段「${label}」。请打开手札「个人剧本」，依次阅读自我介绍与第一幕（其间无公开发言环节）。`
    case 4:
      return `现在进入第四阶段「${label}」。主持人将宣读公共剧情，请集中注意力。`
    case 5:
      return `现在进入第五阶段「${label}」。请结合公共剧情，完成第一幕阅读后参与讨论。`
    case 6:
      return `现在进入第六阶段「${label}」。可公开发言推理；公共线索区将发放第一批证据。`
    case 7:
      return `现在进入第七阶段「${label}」。主持人将继续推进公共剧情，随后解封下一幕与新一轮线索。`
    case 8:
      return `现在进入第八阶段「${label}」。请完成投票；结局与幕后真相将由主持人揭晓。`
    default:
      return `进程已更新：${label}。`
  }
}

/** 根据当前步骤与循环轮次，判断剧本章节是否可读 */
export function isScriptSectionUnlocked(
  sectionId: ScriptSectionId,
  step: JBSStep,
  loopRound: number,
): boolean {
  if (step < 3) return false
  if (sectionId === 'intro') return step >= 3
  if (sectionId === 'act1') return step >= 4
  if (sectionId === 'act2') return step >= 7 && loopRound >= 1
  if (sectionId === 'act3') return step >= 7 && loopRound >= 3
  if (sectionId === 'finale') return step >= 8
  return false
}

export function isClueUnlocked(clue: JBSClue, step: JBSStep, loopRound: number): boolean {
  if (step < clue.unlockStep) return false
  if (clue.unlockLoopRound != null && step >= 7) {
    return loopRound >= clue.unlockLoopRound
  }
  return step >= clue.unlockStep
}

export function manuscriptStorageKey(scriptId: string, roleId: string): string {
  return `jbs-manuscript-${scriptId}-${roleId}`
}
