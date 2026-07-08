import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { buildMomentsUserContactRef, resolveEffectiveCharacterMentionUser } from './momentMentionUtils'
import type { MomentItemModel } from './mockMoments'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import { generateCharacterMomentPost } from './momentCharacterPublishAi'
import type { CharacterMomentPostType } from './momentCharacterPublishTypes'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { generateMomentsImage } from './momentsImageGen'
import { buildCharacterMediaImageGenParams } from '../../phone/apps/wechat/characterAppearanceImageGen'
import type { Character } from '../../phone/apps/wechat/newFriendsPersona/types'
import type { MomentContactRef } from './newMomentTypes'
import { characterPostToMomentItem } from './publishMomentUtils'
import { resolveCharacterMomentAttachedMusic } from './resolveCharacterMomentAttachedMusic'
import { MAX_MOMENT_IMAGES } from './momentContentLimits'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'
import type { ProactiveMomentMusicLanguageRatioSettings } from './proactiveCharacterMomentMusicLanguageRatio'
import { buildProactiveMomentMusicLanguageRatioPrompt } from './proactiveCharacterMomentMusicLanguageRatio'
import type { ProactiveMomentFollowUserMusicTasteSettings } from './proactiveCharacterMomentUserMusicTaste'
import {
  buildProactiveMomentUserMusicTastePrompt,
  collectUserMusicTasteProfile,
} from './proactiveCharacterMomentUserMusicTaste'

export type PublishCharacterMomentParams = {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  characterContact: MomentContactRef
  momentContacts?: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  imageGenSettings: MomentsImageGenSettings
  chatRequestHint?: string
  triggeredByUserRequest?: boolean
  /** 主动发布：分享歌曲语种权重 */
  musicShareLanguageRatio?: ProactiveMomentMusicLanguageRatioSettings
  /** 主动发布：向用户听歌偏好靠拢 */
  followUserMusicTaste?: ProactiveMomentFollowUserMusicTasteSettings
  /** 主动发布：离线补发时的历史发布时间戳 */
  publishedAt?: number
  onProgress?: (stage: 'writing' | 'imaging' | 'done') => void
}

export type PublishCharacterMomentResult = {
  item: MomentItemModel
  usedFallback: boolean
}

function resolvePostImages(
  postType: CharacterMomentPostType,
  imageUrls: string[],
): string[] | undefined {
  if (postType === 'text' || postType === 'music') return undefined
  return imageUrls.length ? imageUrls : undefined
}

async function generateCharacterMomentImages(
  prompts: string[],
  settings: MomentsImageGenSettings,
  character?: Character | null,
): Promise<string[]> {
  if (!settings.enabled) return []
  const capped = prompts.slice(0, MAX_MOMENT_IMAGES)
  const urls: string[] = []
  for (const prompt of capped) {
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
      // 单张失败不阻断整条动态
    }
  }
  return urls
}

export async function publishCharacterMoment(
  params: PublishCharacterMomentParams,
): Promise<PublishCharacterMomentResult> {
  assertMomentsChatApiConfigured(params.wechatCtx.apiConfig)
  params.onProgress?.('writing')

  const character = await personaDb.getCharacter(params.characterId)
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

  const musicShareLanguageRatioPrompt =
    !params.triggeredByUserRequest && params.musicShareLanguageRatio
      ? buildProactiveMomentMusicLanguageRatioPrompt(params.musicShareLanguageRatio)
      : undefined

  let musicShareUserTastePrompt: string | undefined
  if (
    !params.triggeredByUserRequest &&
    params.followUserMusicTaste?.enabled &&
    params.followUserMusicTaste.weight > 0
  ) {
    const tasteProfile = await collectUserMusicTasteProfile(params.wechatCtx.wechatAccountId)
    musicShareUserTastePrompt = buildProactiveMomentUserMusicTastePrompt(
      tasteProfile,
      params.followUserMusicTaste.weight,
    )
  }

  const aiDraft = await generateCharacterMomentPost({
    wechatCtx: params.wechatCtx,
    characterId: params.characterId,
    characterDisplayName: displayName,
    momentContacts: params.momentContacts,
    blockedCharacterIds: params.blockedCharacterIds,
    chatRequestHint: params.chatRequestHint,
    triggeredByUserRequest: params.triggeredByUserRequest,
    musicShareLanguageRatioPrompt,
    musicShareUserTastePrompt,
  })

  let imageUrls: string[] = []
  let postType = aiDraft.postType
  let content = sanitizeMomentBodyText(aiDraft.content)
  let attachedMusic = undefined as Awaited<ReturnType<typeof resolveCharacterMomentAttachedMusic>> | undefined

  if (postType === 'music') {
    if (!aiDraft.attachedMusicDraft) {
      throw new Error('模型未返回歌曲信息（attachedMusic）')
    }
    attachedMusic = await resolveCharacterMomentAttachedMusic(aiDraft.attachedMusicDraft)
  } else {
    const needsImages = postType === 'image' || postType === 'mixed'
    if (needsImages && isMomentsImageGenConfigured(params.imageGenSettings) && aiDraft.images.length) {
      params.onProgress?.('imaging')
      imageUrls = await generateCharacterMomentImages(aiDraft.images, params.imageGenSettings, character)
    }

    if (needsImages && !imageUrls.length) {
      if (postType === 'image') {
        postType = 'text'
        content = content || '。'
      } else if (postType === 'mixed' && !content.trim()) {
        postType = 'text'
        content = '。'
      }
    }
  }

  const userContact = buildMomentsUserContactRef(params.wechatCtx.playerDisplayName)

  const item = characterPostToMomentItem({
    characterId: params.characterId,
    authorName: displayName,
    authorAvatar: avatarUrl,
    postType,
    content,
    imageUrls: resolvePostImages(postType, imageUrls) ?? [],
    attachedMusic,
    location: aiDraft.location,
    privacy: aiDraft.privacy,
    userContact,
    momentContacts: params.momentContacts,
    isPinned: aiDraft.isPinned,
    mentionUser: resolveEffectiveCharacterMentionUser({
      mentionUser: aiDraft.mentionUser,
      privacy: aiDraft.privacy,
      chatRequestHint: params.chatRequestHint,
      triggeredByUserRequest: params.triggeredByUserRequest,
    }),
    mentionCharacterIds: aiDraft.mentionCharacterIds,
    publisherSelfComments: aiDraft.publisherSelfComments,
    timestamp: params.publishedAt,
  })

  params.onProgress?.('done')
  return { item, usedFallback: false }
}
