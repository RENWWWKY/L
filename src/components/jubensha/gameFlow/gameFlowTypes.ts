import type { JubenshaRoleBrief, JubenshaScript } from '../types'

export type FlowState = 'match-select' | 'searching' | 'chat-room'

/** 牌阵上的角色剧本小册 */
export type DeckRoleCard = {
  id: string
  tarotLabel: string
  tarotLabelZh: string
  totem: string
  role: JubenshaRoleBrief
  /** 个人剧本封面（书本正面） */
  coverImageUrl?: string
  /** 档案页「表面身份」 */
  publicIdentity: string
}

export type LockedRole = {
  script: JubenshaScript
  card: DeckRoleCard
}

export function buildRoleSystemPrompt(locked: LockedRole, playerDisplayName: string): string {
  const { script, card } = locked
  return [
    `你正在主持剧本杀《${script.title}》的专属对局房间。`,
    `玩家 "${playerDisplayName}" 已锁定角色：${card.role.name}（${card.role.gender}）。`,
    `表面身份：${card.publicIdentity}。`,
    `角色侧写：${card.role.blurb}`,
    `卷首背景：${script.loreIntro.replace(/\n+/g, ' ')}`,
    `请以该角色的口吻与玩家对谈，保持悬疑与沉浸感，勿剧透真凶与核心诡计。`,
  ].join('\n')
}
