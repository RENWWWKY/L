import type { JBSStep } from './jbsFlowTypes'
import {
  extractDmBlockquoteChunks,
  extractDmBlockquotes,
  findDmSection,
  parseDmSections,
} from './parseDmHostScript'

import dmScriptRaw from '../../../../../剧本杀/《雨夜归零》/剧本/DM-主持剧本.md?raw'

const YUYE_DM = parseDmSections(dmScriptRaw)

function section(keyword: string): string {
  return findDmSection(YUYE_DM, keyword)
}

/** 入局后 Step 2 一次性播读的 DM 气泡序列 */
export function getYuyeGuilingBootDmBodies(): string[] {
  const welcome = section('开场欢迎词')
  const roles = section('角色卡速览')
  const background = section('故事背景')
  return [welcome, roles, background].filter((b) => b.length > 0)
}

/**
 * 每次「推进」进入新进程时播读的 DM 正文。
 * loopRound：Step 7 内 1=过场一，2=线索二，3=过场二；进入 Step 8 时忽略。
 */
export function getYuyeGuilingAdvanceDmBodies(step: JBSStep, loopRound: number): string[] {
  switch (step) {
    case 3:
      return []
    case 4:
      return []
    case 5:
      return []
    case 6:
      return [section('公共线索①')].filter(Boolean)
    case 7:
      if (loopRound === 1) return extractDmBlockquoteChunks(section('公共过场一')).filter(Boolean)
      if (loopRound === 2) return [section('公共线索②')].filter(Boolean)
      if (loopRound >= 3) return extractDmBlockquoteChunks(section('公共过场二')).filter(Boolean)
      return []
    case 8: {
      const clues3 = section('公共线索③')
      const vote = section('终局投票')
      return [clues3, vote].filter(Boolean)
    }
    default:
      return []
  }
}

export function getYuyeGuilingSystemHint(step: JBSStep, loopRound: number): string | null {
  switch (step) {
    case 3:
      return '个人剧本 · 自我介绍已解封。请阅读后等待主持人宣读公共剧情（本局无席间公开发言）。'
    case 4:
      return '主持人正在宣读公共剧情①，请静听，勿翻阅后续章节。'
    case 5:
      return '个人剧本 · 第一幕已解封。请结合方才公共剧情完整阅读第一幕。'
    case 7:
      if (loopRound === 1) return '个人剧本 · 第二幕已解封。'
      if (loopRound >= 3) return '个人剧本 · 第三幕已解封。'
      return null
    case 8:
      return '请在手札「公共线索区」核对终局物证，准备投票。'
    default:
      return null
  }
}

/** 终局：投对 / 投错 / 真相还原（由主持端另行触发时可调用） */
export function getYuyeGuilingEndingDmBodies(kind: 'correct' | 'wrong' | 'truth'): string[] {
  if (kind === 'correct') return [extractDmBlockquotes(section('投对结局'))].filter(Boolean)
  if (kind === 'wrong') return [extractDmBlockquotes(section('投错结局'))].filter(Boolean)
  return [section('真相还原')].filter(Boolean)
}

export function isYuyeGuilingScript(scriptId: string): boolean {
  return scriptId === 'yuye-guiling'
}
