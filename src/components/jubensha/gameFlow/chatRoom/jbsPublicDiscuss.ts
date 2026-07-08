import { buildScriptClues } from './jbsClueData'
import { getEvidenceClueBatches } from './jbsDevFlowNodes'
import type { JBSChatMessage, JBSStep } from './jbsFlowTypes'
import { isYuyeGuilingScript } from './yuyeGuilingDmFlow'

export const YUYE_PLAYER_ROLES = ['沈知意', '陆景川', '苏晚晴', '程予安'] as const
export type YuyePlayerRole = (typeof YUYE_PLAYER_ROLES)[number]

export type PublicDiscussRound = 1 | 2 | 3

export type PublicDiscussPhase = {
  round: PublicDiscussRound
  /** 玩家可自由讨论（开场白已结束或该轮无开场） */
  discussReady: boolean
  /** 该轮需要先播开场白 */
  openingRequired: boolean
}

export function isYuyePlayerRole(name: string): name is YuyePlayerRole {
  return (YUYE_PLAYER_ROLES as readonly string[]).includes(name)
}

export function getNpcRoster(playerRoleName: string): YuyePlayerRole[] {
  if (!isYuyePlayerRole(playerRoleName)) return [...YUYE_PLAYER_ROLES]
  return YUYE_PLAYER_ROLES.filter((r) => r !== playerRoleName)
}

function batchCollected(
  scriptId: string,
  round: PublicDiscussRound,
  collectedIds: string[],
): boolean {
  const batches = getEvidenceClueBatches(scriptId)
  const ids =
    round === 1 ? batches.batch1 : round === 2 ? batches.batch2 : batches.batch3
  return ids.length > 0 && ids.every((id) => collectedIds.includes(id))
}

/** 判定当前是否处于某轮公开讨论（含开场播放中） */
export function resolvePublicDiscussPhase(params: {
  scriptId: string
  currentStep: JBSStep
  loopRound: number
  collectedClueIds: string[]
  discuss1OpeningDone: boolean
  activeDispersalClueId: string | null
}): PublicDiscussPhase | null {
  const {
    scriptId,
    currentStep,
    loopRound,
    collectedClueIds,
    discuss1OpeningDone,
    activeDispersalClueId,
  } = params
  if (!isYuyeGuilingScript(scriptId)) return null
  if (activeDispersalClueId != null) return null

  if (currentStep === 6 && loopRound === 0) {
    if (!batchCollected(scriptId, 1, collectedClueIds)) return null
    return {
      round: 1,
      openingRequired: true,
      discussReady: discuss1OpeningDone,
    }
  }

  if (currentStep === 7 && loopRound === 2) {
    if (!batchCollected(scriptId, 2, collectedClueIds)) return null
    return { round: 2, openingRequired: false, discussReady: true }
  }

  if (currentStep === 7 && loopRound === 3) {
    if (!batchCollected(scriptId, 3, collectedClueIds)) return null
    return { round: 3, openingRequired: false, discussReady: true }
  }

  return null
}

export function getPublicClueSummaries(scriptId: string, collectedIds: string[]): string[] {
  const clues = buildScriptClues(scriptId)
  return clues
    .filter((c) => collectedIds.includes(c.id))
    .map((c) => `· ${c.title}：${c.description}`)
}

export function isNpcChatMessage(msg: JBSChatMessage, playerRoleName: string): boolean {
  if (msg.kind === 'npc') return true
  if (msg.kind === 'player' && msg.roleName && msg.roleName !== playerRoleName) return true
  return false
}

export function formatDiscussTranscriptLine(msg: JBSChatMessage, playerRoleName: string): string | null {
  if (msg.kind === 'system' || msg.kind === 'dm') return null
  const role = msg.roleName?.trim()
  if (!role) return null
  const body = msg.body.trim()
  const action = msg.actionLine?.trim()
  if (!body && !action) return null

  const isPlayer = msg.kind === 'player' && role === playerRoleName
  const prefix = isPlayer ? `【玩家·${role}】` : `【${role}】`
  if (!isPlayer && action) {
    const aside = `（旁白：${action}）`
    if (body) return `${prefix}${aside}${body}`
    return `${prefix}${aside}`
  }
  const actionPart = action ? `（动作：${action}）` : ''
  const linePart = body || '（仅动作，未发言）'
  return `${prefix}${actionPart}：${linePart}`
}

/** 统计玩家在本轮讨论中对各 NPC 的点名/针对次数，供模型判断可否略露破绽 */
export function buildDiscussPressureHints(
  messages: JBSChatMessage[],
  playerRoleName: string,
  npcRoles: readonly string[],
): string {
  const counts = new Map<string, number>()
  for (const role of npcRoles) counts.set(role, 0)

  for (const m of messages) {
    if (m.kind !== 'player' || m.roleName !== playerRoleName) continue
    const blob = `${m.body} ${m.actionLine ?? ''}`
    for (const role of npcRoles) {
      if (blob.includes(role)) {
        counts.set(role, (counts.get(role) ?? 0) + 1)
      }
    }
  }

  const lines: string[] = []
  for (const role of npcRoles) {
    const c = counts.get(role) ?? 0
    if (c >= 3) {
      lines.push(`- ${role}：已被玩家连续针对 ${c} 次，可略写轻微破绽（仍须嘴硬）。`)
    } else if (c === 2) {
      lines.push(`- ${role}：第二轮被针对，至多写极细微异样，不可崩溃认栽。`)
    } else if (c === 1) {
      lines.push(`- ${role}：首轮被点，宜镇定反驳，旁白勿写明显心虚。`)
    }
  }

  return lines.length > 0 ? `【施压程度参考】\n${lines.join('\n')}` : ''
}