export type DatingStyleTuning = {
  stylePrompt: string
  referenceSnippet: string
}

const keyFor = (characterId: string) => `wechat-dating-style-tuning:${characterId.trim()}`

export function loadDatingStyleTuning(characterId: string): DatingStyleTuning {
  const id = characterId.trim()
  if (!id || typeof localStorage === 'undefined') return { stylePrompt: '', referenceSnippet: '' }
  try {
    const raw = localStorage.getItem(keyFor(id))
    if (!raw) return { stylePrompt: '', referenceSnippet: '' }
    const o = JSON.parse(raw) as Partial<DatingStyleTuning>
    return {
      stylePrompt: typeof o.stylePrompt === 'string' ? o.stylePrompt : '',
      referenceSnippet: typeof o.referenceSnippet === 'string' ? o.referenceSnippet : '',
    }
  } catch {
    return { stylePrompt: '', referenceSnippet: '' }
  }
}

export function saveDatingStyleTuning(characterId: string, v: DatingStyleTuning): void {
  const id = characterId.trim()
  if (!id || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      keyFor(id),
      JSON.stringify({
        stylePrompt: String(v.stylePrompt ?? ''),
        referenceSnippet: String(v.referenceSnippet ?? ''),
      }),
    )
  } catch {
    // ignore quota
  }
}
