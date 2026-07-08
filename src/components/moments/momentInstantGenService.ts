import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { generateMomentsImage } from './momentsImageGen'
import { buildCharacterMediaImageGenParams } from '../../phone/apps/wechat/characterAppearanceImageGen'
import type { Character } from '../../phone/apps/wechat/newFriendsPersona/types'
import { generateInstantMomentWithInteractions } from './momentInstantGenAi'
import {
  buildInstantGenRecentContext,
  type MutualFriendRef,
} from './momentInstantGenContext'
import {
  loadMomentRelationships,
  resolveRelationshipBoundPeers,
} from './momentRelationshipGraph'
import type { InstantGenConfig, InstantGenInteractionDraft } from './momentInstantGenTypes'
import {
  instantGenChoiceToPostType,
  instantGenPostTypeIncludesText,
  instantGenPostTypeRequiresText,
} from './momentInstantGenTypes'
import { fallbackInstantGenBodyContent, MAX_MOMENT_IMAGES } from './momentContentLimits'
import {
  materializeInstantGenInteractions,
  materializePublisherSelfComments,
} from './momentInteractionTypes'
import { realignInteractionVisibleAt } from './momentInteractionTiming'
import {
  describeEmptyMomentPublishFailure,
  isMomentFeedVisible,
} from './momentInstantGenValidate'
import {
  buildMomentsUserContactRef,
  resolveEffectiveCharacterMentionUser,
} from './momentMentionUtils'
import type { MomentItemModel } from './mockMoments'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentContactRef } from './newMomentTypes'
import { characterPostToMomentItem } from './publishMomentUtils'
import { resolveCharacterMomentAttachedMusic } from './resolveCharacterMomentAttachedMusic'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type InstantGenPublishStage = 'context' | 'writing' | 'imaging' | 'saving' | 'done'

export type InstantGenPublishParams = {
  wechatCtx: AnonymousQaWechatContext
  config: InstantGenConfig
  characterContact: MomentContactRef
  momentContacts: MomentContactRef[]
  blockedCharacterIds: Set<string>
  imageGenSettings: MomentsImageGenSettings
  onProgress?: (stage: InstantGenPublishStage) => void
}

async function generateImages(
  prompts: string[],
  settings: MomentsImageGenSettings,
  character?: Character | null,
): Promise<string[]> {
  if (!settings.enabled || !prompts.length) return []
  const urls: string[] = []
  for (const prompt of prompts.slice(0, MAX_MOMENT_IMAGES)) {
    try {
      const url = await generateMomentsImage(
        buildCharacterMediaImageGenParams({
          prompt,
          settings,
          character,
          width: 512,
          height: 512,
        }),
      )
      if (url) urls.push(url)
    } catch {
      // skip failed image
    }
  }
  return urls
}

function filterInteractionsByBoundPeers(
  interactions: InstantGenInteractionDraft[],
  boundPeers: MutualFriendRef[],
): InstantGenInteractionDraft[] {
  const allowed = new Set(boundPeers.map((f) => f.charId))
  return interactions.filter((ix) => allowed.has(ix.authorId))
}

export async function publishInstantCharacterMoment(
  params: InstantGenPublishParams,
): Promise<MomentItemModel> {
  assertMomentsChatApiConfigured(params.wechatCtx.apiConfig)
  params.onProgress?.('context')

  const imageGenReady = isMomentsImageGenConfigured(params.imageGenSettings)
  const config =
    imageGenReady || params.config.postType === 'music'
      ? params.config
      : { ...params.config, postType: 'text' as const }

  const characterId = config.targetCharacterId
  const character = await personaDb.getCharacter(characterId)
  const displayName =
    params.characterContact.name.trim() ||
    character?.remark?.trim() ||
    character?.wechatNickname?.trim() ||
    character?.name?.trim() ||
    '未命名'
  const avatarUrl =
    resolveCharacterAvatarUrl({
      avatarUrl: params.characterContact.avatarUrl ?? character?.avatarUrl,
    }) || resolveCharacterAvatarUrl({ avatarUrl: '' })

  const relationships = await loadMomentRelationships()
  const boundPeers = resolveRelationshipBoundPeers(
    characterId,
    params.momentContacts,
    relationships,
    params.blockedCharacterIds,
  )

  const recentContext = await buildInstantGenRecentContext({
    wechatCtx: params.wechatCtx,
    characterId,
    includeRecentChat: config.includeRecentChat,
    includeOfflinePlots: config.includeOfflinePlots,
  })

  params.onProgress?.('writing')
  const aiDraft = await generateInstantMomentWithInteractions({
    wechatCtx: params.wechatCtx,
    config,
    targetDisplayName: displayName,
    recentContext,
    mutualFriends: boundPeers,
    momentContacts: params.momentContacts,
    blockedCharacterIds: params.blockedCharacterIds,
    imageGenSettings: params.imageGenSettings,
  })

  let postType = instantGenChoiceToPostType(config.postType)
  const textLimit = instantGenPostTypeIncludesText(config.postType)
    ? config.textLengthTarget
    : undefined
  let content = sanitizeMomentBodyText(aiDraft.content, textLimit)
  let imagePrompts = postType === 'text' || postType === 'music' ? [] : aiDraft.imagePrompts

  if (instantGenPostTypeRequiresText(config.postType) && !content.trim()) {
    content = sanitizeMomentBodyText(
      fallbackInstantGenBodyContent(config.textLengthTarget),
      textLimit,
    )
  }

  let imageUrls: string[] = []
  let attachedMusic = undefined as Awaited<ReturnType<typeof resolveCharacterMomentAttachedMusic>> | undefined

  if (config.postType === 'music') {
    if (!aiDraft.attachedMusicDraft) {
      throw new Error('模型未返回歌曲信息（attachedMusic），请重试或更换模型')
    }
    attachedMusic = await resolveCharacterMomentAttachedMusic(aiDraft.attachedMusicDraft)
    postType = 'music'
  } else {
    const needsImages = postType === 'image' || postType === 'mixed'
    if (needsImages && imageGenReady && imagePrompts.length) {
      params.onProgress?.('imaging')
      imageUrls = await generateImages(imagePrompts, params.imageGenSettings, character)
    }

    if (needsImages && !imageUrls.length) {
      if (postType === 'image') {
        postType = 'text'
        if (!content.trim()) {
          content = sanitizeMomentBodyText(
            fallbackInstantGenBodyContent(config.textLengthTarget),
            textLimit,
          )
        }
      } else if (postType === 'mixed' && !content.trim()) {
        postType = 'text'
        content = sanitizeMomentBodyText(
          fallbackInstantGenBodyContent(config.textLengthTarget),
          textLimit,
        )
      }
    }
  }

  const publishedAt = Date.now()
  const safeInteractions = filterInteractionsByBoundPeers(aiDraft.interactions, boundPeers)
  const hiddenFromIds = new Set(aiDraft.privacy.hideFromCharacterIds)
  const visibleInteractions = safeInteractions.filter((ix) => !hiddenFromIds.has(ix.authorId))
  const peerInteractions = materializeInstantGenInteractions(
    visibleInteractions,
    publishedAt,
    characterId,
  )
  const selfInteractions = materializePublisherSelfComments(
    aiDraft.publisherSelfComments ?? [],
    characterId,
    publishedAt,
  )
  const interactions = realignInteractionVisibleAt(
    [...peerInteractions, ...selfInteractions],
    publishedAt,
  )

  const userContact = buildMomentsUserContactRef(params.wechatCtx.playerDisplayName)

  const item = characterPostToMomentItem({
    characterId,
    authorName: displayName,
    authorAvatar: avatarUrl,
    postType,
    content,
    imageUrls: postType === 'text' || postType === 'music' ? [] : imageUrls,
    attachedMusic,
    location: aiDraft.location,
    privacy: aiDraft.privacy,
    userContact,
    momentContacts: params.momentContacts,
    mentionUser: resolveEffectiveCharacterMentionUser({
      mentionUser: aiDraft.mentionUser,
      privacy: aiDraft.privacy,
      suppressMentionUser: true,
    }),
    mentionCharacterIds: aiDraft.mentionCharacterIds,
  })

  const published = { ...item, interactions }
  if (!isMomentFeedVisible(published)) {
    throw new Error(describeEmptyMomentPublishFailure())
  }

  params.onProgress?.('done')
  return published
}
