import type { Character } from '../types'

/** 名册顶栏 Tab */
export type PersonaRosterTabId = 'main' | 'npc' | 'relations'

export const PERSONA_ROSTER_TABS: ReadonlyArray<{
  id: PersonaRosterTabId
  en: string
  zh: string
}> = [
  { id: 'main', en: 'MAIN', zh: '主要角色' },
  { id: 'npc', en: 'NPC', zh: '次要角色/NPC' },
  { id: 'relations', en: 'RELATIONS', zh: '关系与绑定' },
] as const

/** NPC 围绕生成的主角 id（与 Character.generatedForCharacterId 同义） */
export function boundMainCharId(ch: Pick<Character, 'generatedForCharacterId'>): string {
  return ch.generatedForCharacterId?.trim() ?? ''
}

export function isNpcCharacter(ch: Pick<Character, 'generatedForCharacterId'>): boolean {
  return !!boundMainCharId(ch)
}

export function isMainCharacter(ch: Pick<Character, 'generatedForCharacterId'>): boolean {
  return !isNpcCharacter(ch)
}
