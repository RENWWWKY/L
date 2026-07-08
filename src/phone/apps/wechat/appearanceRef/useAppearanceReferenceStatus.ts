import { useCallback, useEffect, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'
import { resolveScopedAppearanceRefs } from '../resolveScopedAppearanceRefs'
import type { AppearanceRefPanelContext } from './AppearanceRefSettingsPanel'

type Subject = 'character' | 'user'

export function useAppearanceReferenceStatus(params: {
  context: AppearanceRefPanelContext
  characterId?: string
  playerIdentityId?: string
  /** 默认 character + user 均计入 */
  subjects?: Subject[]
}): { hasReference: boolean; loading: boolean } {
  const cid = params.characterId?.trim() ?? ''
  const pid = params.playerIdentityId?.trim() ?? ''
  const subjects = params.subjects ?? (['character', 'user'] as Subject[])

  const [hasReference, setHasReference] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const needsCharacter = subjects.includes('character')
    const needsUser = subjects.includes('user')

    if ((needsCharacter && !cid) && (needsUser && !pid)) {
      setHasReference(false)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const character = needsCharacter && cid ? ((await personaDb.getCharacter(cid)) ?? null) : null
      const playerIdentity = needsUser && pid ? ((await personaDb.getPlayerIdentity(pid)) ?? null) : null

      const resolved = await resolveScopedAppearanceRefs({
        context: params.context,
        playerIdentityId: pid,
        characterId: cid,
        character,
        playerIdentity,
      })

      const characterHasRef = needsCharacter && resolved.character.images.length > 0
      const userHasRef = needsUser && resolved.user.images.length > 0
      setHasReference(characterHasRef || userHasRef)
    } catch (err) {
      console.warn('[appearanceRef] status check failed', err)
      setHasReference(false)
    } finally {
      setLoading(false)
    }
  }, [cid, pid, params.context, subjects])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onChange = () => void refresh()
    window.addEventListener('wechat-storage-changed', onChange)
    return () => window.removeEventListener('wechat-storage-changed', onChange)
  }, [refresh])

  return { hasReference, loading }
}
