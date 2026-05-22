import type { DeckRoleCard } from './gameFlowTypes'

/** 命运盲抽：从牌阵中随机锁定一名角色 */
export function pickBlindRoleCard(deck: DeckRoleCard[]): DeckRoleCard | null {
  if (deck.length === 0) return null
  return deck[Math.floor(Math.random() * deck.length)] ?? null
}
