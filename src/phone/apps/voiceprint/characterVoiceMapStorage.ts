const CHARACTER_VOICE_MAP_LS_KEY = 'minimax:characterVoiceMap'

export type CharacterVoiceMap = Record<string, string>

function safeParseMap(raw: string): CharacterVoiceMap {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: CharacterVoiceMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = String(k || '').trim()
      const voice = typeof v === 'string' ? v.trim() : ''
      if (id && voice) out[id] = voice
    }
    return out
  } catch {
    return {}
  }
}

export function readCharacterVoiceMapFromStorage(): CharacterVoiceMap {
  if (typeof localStorage === 'undefined') return {}
  return safeParseMap(localStorage.getItem(CHARACTER_VOICE_MAP_LS_KEY) ?? '')
}

export function writeCharacterVoiceMapToStorage(map: CharacterVoiceMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CHARACTER_VOICE_MAP_LS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/** 删除指定角色的声纹映射（角色从微信移除或彻底删除时调用） */
export function pruneCharacterVoiceMappings(characterIds: readonly string[]): CharacterVoiceMap {
  const remove = new Set(characterIds.map((id) => id.trim()).filter(Boolean))
  if (!remove.size) return readCharacterVoiceMapFromStorage()
  const current = readCharacterVoiceMapFromStorage()
  let changed = false
  const next: CharacterVoiceMap = {}
  for (const [k, v] of Object.entries(current)) {
    if (remove.has(k)) {
      changed = true
      continue
    }
    next[k] = v
  }
  if (changed) writeCharacterVoiceMapToStorage(next)
  return changed ? next : current
}

/** 仅保留仍存在于通讯录的角色映射，剔除孤儿条目 */
export function pruneCharacterVoiceMappingsToAllowed(allowedCharacterIds: ReadonlySet<string>): CharacterVoiceMap {
  const current = readCharacterVoiceMapFromStorage()
  let changed = false
  const next: CharacterVoiceMap = {}
  for (const [k, v] of Object.entries(current)) {
    if (!allowedCharacterIds.has(k)) {
      changed = true
      continue
    }
    next[k] = v
  }
  if (changed) writeCharacterVoiceMapToStorage(next)
  return changed ? next : current
}

export { CHARACTER_VOICE_MAP_LS_KEY }
