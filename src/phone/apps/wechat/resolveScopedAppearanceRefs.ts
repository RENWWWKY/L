import type { Character, PlayerIdentity } from './newFriendsPersona/types'
import {
  bundleFromCharacterFields,
  getAppearanceRefContextOverride,
  type AppearanceRefBundle,
  type AppearanceRefContext,
} from './appearanceRefContextStore'

export type ResolvedScopedAppearanceRefs = {
  character: AppearanceRefBundle
  user: AppearanceRefBundle
  characterForked: boolean
  userForked: boolean
}

export async function resolveScopedAppearanceRefs(params: {
  context: AppearanceRefContext | 'global'
  playerIdentityId?: string | null
  characterId?: string | null
  character?: Character | null
  playerIdentity?: PlayerIdentity | null
}): Promise<ResolvedScopedAppearanceRefs> {
  const character = params.character ?? null
  const playerIdentity = params.playerIdentity ?? null
  const pid = params.playerIdentityId?.trim() || playerIdentity?.id?.trim() || ''
  const cid = params.characterId?.trim() || character?.id?.trim() || ''

  const globalCharacter = bundleFromCharacterFields(
    character?.appearanceRefImages,
    character?.appearanceRefUrl,
    character?.appearanceRefNote,
  )
  const globalUser = bundleFromCharacterFields(
    playerIdentity?.appearanceRefImages,
    playerIdentity?.appearanceRefUrl,
    playerIdentity?.appearanceRefNote,
  )

  if (params.context === 'global' || !pid || !cid) {
    return {
      character: globalCharacter,
      user: globalUser,
      characterForked: false,
      userForked: false,
    }
  }

  const override = await getAppearanceRefContextOverride(pid, cid, params.context)
  if (!override?.forked) {
    return {
      character: globalCharacter,
      user: globalUser,
      characterForked: false,
      userForked: false,
    }
  }

  const characterOverride =
    override.characterRefImages?.length || override.characterRefNote
      ? bundleFromCharacterFields(override.characterRefImages, undefined, override.characterRefNote)
      : null
  const userOverride =
    override.userRefImages?.length || override.userRefNote
      ? bundleFromCharacterFields(override.userRefImages, undefined, override.userRefNote)
      : null

  return {
    character: characterOverride ?? globalCharacter,
    user: userOverride ?? globalUser,
    characterForked: characterOverride != null,
    userForked: userOverride != null,
  }
}

/** 将 bundle 写回 Character 形态字段，供 buildCharacterMediaImageGenParams 复用 */
export function appearanceBundleToCharacterPatch(bundle: AppearanceRefBundle): Pick<
  Character,
  'appearanceRefImages' | 'appearanceRefUrl' | 'appearanceRefNote'
> {
  const primary = bundle.images[0]?.url?.trim()
  return {
    appearanceRefImages: bundle.images.length ? bundle.images : undefined,
    appearanceRefUrl: primary || undefined,
    appearanceRefNote: bundle.note,
  }
}
