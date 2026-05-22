import type { CharacterMemory } from '../newFriendsPersona/types'

/** 角色私聊「自有」长期记忆（不含群聊桶、不含线下关联记忆） */
export function isCharacterOwnPrivateMemory(m: CharacterMemory): boolean {
  const scope = m.memoryScope ?? 'private'
  return scope !== 'group' && scope !== 'linked'
}

/** 人脉 NPC 或已绑定主角：挂在该角色 id 下的「关联记忆」（linkedFrom = 线下存档主角） */
export function isCharacterLinkedMemory(m: CharacterMemory): boolean {
  return m.memoryScope === 'linked'
}
