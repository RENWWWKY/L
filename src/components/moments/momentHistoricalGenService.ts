import type { AnonymousQaWechatContext } from '../anonymousQa/buildAnonymousQaPersonaContext'
import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { buildMomentsUserContactRef, resolveEffectiveCharacterMentionUser } from './momentMentionUtils'
import type { MomentItemModel } from './mockMoments'
import { assertMomentsChatApiConfigured } from './momentsChatApiReady'
import type { CharacterMomentPostType } from './momentCharacterPublishTypes'
import { isMomentsImageGenConfigured } from './momentsImageGenAvailability'
import { generateMomentsImage } from './momentsImageGen'
import { buildCharacterMediaImageGenParams } from '../../phone/apps/wechat/characterAppearanceImageGen'
import type { Character } from '../../phone/apps/wechat/newFriendsPersona/types'
import { generateHistoricalCharacterMomentPost } from './momentHistoricalGenAi'
import type { HistoricalGenConfig } from './momentHistoricalGenTypes'
import { pickHistoricalPoolItem, pickHistoricalPinnedIndices } from './momentHistoricalGenTypes'
import { distributeHistoricalTimestamps } from './momentHistoricalGenUtils'
import type { MomentContactRef } from './newMomentTypes'
import { characterPostToMomentItem } from './publishMomentUtils'
import { resolveCharacterMomentAttachedMusic } from './resolveCharacterMomentAttachedMusic'
import { MAX_MOMENT_IMAGES, pickHistoricalTextLengthTarget, trimHistoricalMomentBody } from './momentContentLimits'
import { sanitizeMomentBodyText } from './momentTextSanitize'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

export type HistoricalGenPublishStage = 'writing' | 'imaging' | 'saving' | 'done'

export type PublishHistoricalCharacterMomentsParams = {
  wechatCtx: AnonymousQaWechatContext
  characterId: string
  characterContact: MomentContactRef
  momentContacts?: MomentContactRef[]
  blockedCharacterIds?: Set<string>
  imageGenSettings: MomentsImageGenSettings
  config: HistoricalGenConfig
  onProgress?: (stage: HistoricalGenPublishStage, index: number, total: number) => void
}

export type PublishHistoricalCharacterMomentsResult = {
  items: MomentItemModel[]
  failures: string[]
}

function resolvePostImages(
  postType: CharacterMomentPostType,
  imageUrls: string[],
): string[] | undefined {
  if (postType === 'text' || postType === 'music') return undefined
  return imageUrls.length ? imageUrls : undefined
}

async function generateHistoricalMomentImages(
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

function summarizeMomentForDedup(item: MomentItemModel): string {
  const content = sanitizeMomentBodyText(item.content).slice(0, 48)
  const date = new Date(item.timestamp)
  const label = `${date.getMonth() + 1}/${date.getDate()}`
  if (item.attachedMusic?.title) {
    return `[${label}] 🎵 ${item.attachedMusic.title}${content ? ` · ${content}` : ''}`
  }
  if (content) return `[${label}] ${content}`
  if (item.images?.length) return `[${label}] 图片动态`
  return `[${label}] 无文字动态`
}

export async function publishHistoricalCharacterMoments(
  params: PublishHistoricalCharacterMomentsParams,
): Promise<PublishHistoricalCharacterMomentsResult> {
  assertMomentsChatApiConfigured(params.wechatCtx.apiConfig)

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

  const postTypes = params.config.postTypes.length
    ? params.config.postTypes
    : (['mixed'] as const)
  const contentTypes = params.config.contentTypes.length
    ? params.config.contentTypes
    : (['auto'] as const)

  const timestamps = distributeHistoricalTimestamps(
    params.config.count,
    params.config.timeSpan.startMs,
    params.config.timeSpan.endMs,
  )
  const pinnedIndices = pickHistoricalPinnedIndices(
    timestamps.length,
    params.config.pinnedCount,
  )

  const userContact = buildMomentsUserContactRef(params.wechatCtx.playerDisplayName)

  const items: MomentItemModel[] = []
  const failures: string[] = []
  const priorSummaries: string[] = []

  for (let i = 0; i < timestamps.length; i += 1) {
    const timestampMs = timestamps[i]!
    const postTypeChoice = pickHistoricalPoolItem(postTypes, i)!
    const contentTypeChoice = pickHistoricalPoolItem(contentTypes, i)!
    const isPinned = pinnedIndices.has(i)
    params.onProgress?.('writing', i + 1, timestamps.length)

    try {
      const itemTextLengthTarget = pickHistoricalTextLengthTarget(
        params.config.textLengthMin,
        params.config.textLengthMax,
        i,
        isPinned,
      )
      const aiDraft = await generateHistoricalCharacterMomentPost({
        wechatCtx: params.wechatCtx,
        characterId: params.characterId,
        characterDisplayName: displayName,
        momentContacts: params.momentContacts,
        blockedCharacterIds: params.blockedCharacterIds,
        timestampMs,
        postType: postTypeChoice,
        contentType: contentTypeChoice,
        customContentDirection: params.config.customContentDirection,
        textLengthMin: params.config.textLengthMin,
        textLengthMax: params.config.textLengthMax,
        itemTextLengthTarget,
        priorSummaries,
        isPinnedIntent: isPinned,
      })

      let imageUrls: string[] = []
      let postType = aiDraft.postType
      let content = trimHistoricalMomentBody(
        sanitizeMomentBodyText(aiDraft.content),
        itemTextLengthTarget,
      )
      let attachedMusic = undefined as Awaited<ReturnType<typeof resolveCharacterMomentAttachedMusic>> | undefined

      if (postType === 'music') {
        if (!aiDraft.attachedMusicDraft) {
          throw new Error('模型未返回歌曲信息（attachedMusic）')
        }
        attachedMusic = await resolveCharacterMomentAttachedMusic(aiDraft.attachedMusicDraft)
      } else {
        const needsImages = postType === 'image' || postType === 'mixed'
        if (
          needsImages &&
          isMomentsImageGenConfigured(params.imageGenSettings) &&
          aiDraft.images.length
        ) {
          params.onProgress?.('imaging', i + 1, timestamps.length)
          imageUrls = await generateHistoricalMomentImages(aiDraft.images, params.imageGenSettings, character)
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

      params.onProgress?.('saving', i + 1, timestamps.length)
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
        timestamp: timestampMs,
        isPinned,
        mentionUser: resolveEffectiveCharacterMentionUser({
          mentionUser: aiDraft.mentionUser,
          privacy: aiDraft.privacy,
          suppressMentionUser: true,
        }),
        mentionCharacterIds: aiDraft.mentionCharacterIds,
        publisherSelfComments: aiDraft.publisherSelfComments,
      })
      items.push(item)
      priorSummaries.push(summarizeMomentForDedup(item))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败'
      failures.push(`第 ${i + 1} 条：${msg}`)
    }
  }

  params.onProgress?.('done', timestamps.length, timestamps.length)
  return { items, failures }
}
