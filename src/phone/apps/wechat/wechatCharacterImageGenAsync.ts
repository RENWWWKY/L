import { generateMomentsImage } from '../../../components/moments/momentsImageGen'
import { isMomentsImageGenConfigured } from '../../../components/moments/momentsImageGenAvailability'
import type { MomentsImageGenSettings } from '../../../components/moments/useMomentsSettingsStore'
import { loadResolvedApiConfig } from '../api/loadResolvedApiConfig'
import { loadResolvedImageGenSettings } from '../api/loadResolvedImageGenSettings'
import { generatePulsePhoneFeedImagePrompts } from '../lumiPulse/pulsePostImagePromptAi'
import { buildCharacterMediaImageGenParams } from './characterAppearanceImageGen'
import type { Character, WeChatImageMime } from './newFriendsPersona/types'
import { personaDb } from './newFriendsPersona/idb'
import {
  imageGenDataUrlToPayload,
  looksLikeEnglishImageGenTags,
} from './wechatCharacterImageGen'
import {
  appearanceBundleToCharacterPatch,
  resolveScopedAppearanceRefs,
} from './resolveScopedAppearanceRefs'
import {
  isImageGenRateLimitError,
  markImageGenQuotaOrRateLimitBlocked,
} from './wechatMediaSendFrequency'

async function waitForWeChatChatMessageRow(messageId: string, maxMs = 15000): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    const row = await personaDb.getWeChatChatMessageById(messageId)
    if (row) return true
    await new Promise((resolve) => window.setTimeout(resolve, 120))
  }
  return false
}

export type WeChatImageGenUiPatch = {
  images?: { base64: string; type: WeChatImageMime }[]
  imageGenPending?: boolean
  imageGenAwaitingConfirm?: boolean
  imageGenFailed?: boolean
}

/** 跨 ChatRoom 重挂载与生图回调的全局 UI patch；生图预览直接 setState，聊天室靠此兜底 */
const globalImageGenUiPatches = new Map<string, WeChatImageGenUiPatch>()

export function rememberWeChatImageGenUiPatch(messageId: string, patch: WeChatImageGenUiPatch): void {
  const id = messageId.trim()
  if (!id) return
  globalImageGenUiPatches.set(id, patch)
}

export function getWeChatImageGenUiPatch(messageId: string): WeChatImageGenUiPatch | undefined {
  return globalImageGenUiPatches.get(messageId.trim())
}

export function getWeChatImageGenUiPatchMap(): ReadonlyMap<string, WeChatImageGenUiPatch> {
  return globalImageGenUiPatches
}

export function clearWeChatImageGenUiPatch(messageId: string): void {
  globalImageGenUiPatches.delete(messageId.trim())
}

export function isWeChatImageGenUiPatchResolved(patch: WeChatImageGenUiPatch): boolean {
  return !!patch.images?.[0]?.base64?.trim() || patch.imageGenFailed === true
}

export const WECHAT_IMAGE_GEN_UI_PATCH_EVENT = 'wechat-image-gen-ui-patch'

export function dispatchWeChatImageGenUiPatch(messageId: string, patch: WeChatImageGenUiPatch): void {
  const id = messageId.trim()
  if (!id) return
  rememberWeChatImageGenUiPatch(id, patch)
  window.dispatchEvent(
    new CustomEvent(WECHAT_IMAGE_GEN_UI_PATCH_EVENT, {
      detail: { messageId: id, patch },
    }),
  )
}

export type WeChatCharacterImageGenFailureKind = 'rate_limit' | 'safety' | 'other'

export function classifyWeChatCharacterImageGenFailure(err: unknown): {
  kind: WeChatCharacterImageGenFailureKind
  message: string
} {
  const message = err instanceof Error ? err.message : String(err)
  if (isImageGenRateLimitError(err)) {
    markImageGenQuotaOrRateLimitBlocked(err)
    return { kind: 'rate_limit', message }
  }
  if (/安全审核|content policy|safety|审核未通过|sexual/i.test(message)) {
    return { kind: 'safety', message }
  }
  return { kind: 'other', message }
}

async function markWeChatImageGenFailed(messageId: string): Promise<void> {
  const id = messageId.trim()
  if (!id) return
  try {
    await personaDb.patchWeChatChatMessageById(id, {
      imageGenPending: false,
      imageGenAwaitingConfirm: false,
      imageGenFailed: true,
    })
  } catch {
    /* ignore patch failure */
  }
  dispatchWeChatImageGenUiPatch(id, {
    imageGenPending: false,
    imageGenAwaitingConfirm: false,
    imageGenFailed: true,
  })
}

async function markWeChatImageGenRetrying(messageId: string): Promise<void> {
  const id = messageId.trim()
  if (!id) return
  try {
    await personaDb.patchWeChatChatMessageById(id, {
      imageGenPending: true,
      imageGenAwaitingConfirm: false,
      imageGenFailed: false,
    })
  } catch {
    /* ignore patch failure */
  }
  dispatchWeChatImageGenUiPatch(id, {
    imageGenPending: true,
    imageGenAwaitingConfirm: false,
    imageGenFailed: false,
  })
}

/**
 * 解析生图用英文 prompt：
 * - 已有缓存英文 tags → 直接用
 * - 入参/描述已是英文 tags（旧档）→ 直接用
 * - 否则把中文占位推演为英文 tags（同微博手机风）
 */
async function resolveWeChatChatImageGenEnglishPrompt(params: {
  description: string
  cachedPrompt?: string | null
  character: Character | null
  playerIdentityId?: string | null
}): Promise<string> {
  const cached = params.cachedPrompt?.trim() || ''
  if (cached && looksLikeEnglishImageGenTags(cached)) return cached.slice(0, 4000)

  const description = params.description.trim()
  if (!description) throw new Error('missing_image_description')

  if (looksLikeEnglishImageGenTags(description)) return description.slice(0, 4000)

  const settings = await loadResolvedImageGenSettings()
  if (!isMomentsImageGenConfigured(settings)) {
    throw new Error('请先在 API 预设或朋友圈设置中配置生图引擎')
  }

  const apiConfig = await loadResolvedApiConfig('chatCard')
  if (!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() || !apiConfig?.modelId?.trim()) {
    throw new Error('请先配置对话 API（用于配图提示词推演）')
  }

  const playerIdentityId = params.playerIdentityId?.trim() || ''
  const playerIdentity = playerIdentityId ? await personaDb.getPlayerIdentity(playerIdentityId) : null
  const playerDisplayName =
    playerIdentity?.wechatNickname?.trim() || playerIdentity?.name?.trim() || '玩家'

  let characterForGen = params.character
  const characterId = params.character?.id?.trim()
  if (characterForGen && characterId && playerIdentityId) {
    const scopedRefs = await resolveScopedAppearanceRefs({
      context: 'chat',
      playerIdentityId,
      characterId,
      character: characterForGen,
    })
    characterForGen = {
      ...characterForGen,
      ...appearanceBundleToCharacterPatch(scopedRefs.character),
    }
  }

  const pack = await generatePulsePhoneFeedImagePrompts({
    apiConfig,
    description,
    character: characterForGen,
    playerIdentity,
    playerDisplayName,
  })
  const promptRaw = pack.prompts[0]?.trim()
  if (!promptRaw) throw new Error('配图提示词推演失败，请稍后重试')
  return promptRaw.slice(0, 4000)
}

export async function retryWeChatCharacterImageGenMessage(params: {
  messageId: string
  /** 兼容旧调用：可为中文描述或英文 tags */
  prompt?: string | null
  playerIdentityId?: string | null
}): Promise<
  | { ok: true; images: { base64: string; type: WeChatImageMime }[] }
  | { ok: false; failure: ReturnType<typeof classifyWeChatCharacterImageGenFailure> }
> {
  const messageId = params.messageId.trim()
  if (!messageId) {
    return { ok: false, failure: { kind: 'other', message: 'missing_message_id' } }
  }
  const row = await personaDb.getWeChatChatMessageById(messageId)
  const description =
    row?.imageDescription?.trim() ||
    params.prompt?.trim() ||
    row?.imageGenPrompt?.trim() ||
    ''
  if (!description) {
    return { ok: false, failure: { kind: 'other', message: 'missing_image_gen_prompt' } }
  }
  const characterId = row?.characterId?.trim() || ''
  const character = characterId ? await personaDb.getCharacter(characterId) : null
  const settings = await loadResolvedImageGenSettings()
  await markWeChatImageGenRetrying(messageId)
  return finalizeWeChatCharacterImageGenMessage({
    messageId,
    description,
    cachedPrompt: row?.imageGenPrompt,
    character,
    settings,
    playerIdentityId: params.playerIdentityId?.trim() || row?.playerIdentityId?.trim() || null,
  })
}

export async function finalizeWeChatCharacterImageGenMessage(params: {
  messageId: string
  /** 中文画面描述（或旧档英文 tags） */
  description: string
  /** 已缓存的英文生图提示词 */
  cachedPrompt?: string | null
  /** @deprecated 使用 description */
  prompt?: string
  character: Character | null
  settings: MomentsImageGenSettings
  playerIdentityId?: string | null
}): Promise<
  | { ok: true; images: { base64: string; type: WeChatImageMime }[] }
  | { ok: false; failure: ReturnType<typeof classifyWeChatCharacterImageGenFailure> }
> {
  const messageId = params.messageId.trim()
  if (!messageId) {
    return { ok: false, failure: { kind: 'other', message: 'missing_message_id' } }
  }
  const rowReady = await waitForWeChatChatMessageRow(messageId)
  if (!rowReady) {
    await markWeChatImageGenFailed(messageId)
    return { ok: false, failure: { kind: 'other', message: 'message_not_persisted' } }
  }

  const description = (params.description || params.prompt || '').trim()
  if (!description) {
    await markWeChatImageGenFailed(messageId)
    return { ok: false, failure: { kind: 'other', message: 'missing_image_gen_prompt' } }
  }

  try {
    const promptForGen = await resolveWeChatChatImageGenEnglishPrompt({
      description,
      cachedPrompt: params.cachedPrompt,
      character: params.character,
      playerIdentityId: params.playerIdentityId,
    })

    try {
      await personaDb.patchWeChatChatMessageById(messageId, {
        ...(!looksLikeEnglishImageGenTags(description)
          ? { imageDescription: description.slice(0, 800) }
          : {}),
        imageGenPrompt: promptForGen,
      })
    } catch {
      /* ignore */
    }

    let characterForGen = params.character
    const characterId = params.character?.id?.trim()
    const playerIdentityId = params.playerIdentityId?.trim()
    if (characterForGen && characterId && playerIdentityId) {
      const scopedRefs = await resolveScopedAppearanceRefs({
        context: 'chat',
        playerIdentityId,
        characterId,
        character: characterForGen,
      })
      characterForGen = {
        ...characterForGen,
        ...appearanceBundleToCharacterPatch(scopedRefs.character),
      }
    }
    const dataUrl = await generateMomentsImage(
      buildCharacterMediaImageGenParams({
        prompt: promptForGen,
        settings: params.settings,
        character: characterForGen,
      }),
    )
    const payloadImage = imageGenDataUrlToPayload(dataUrl)
    const images = [{ base64: payloadImage.base64, type: payloadImage.mime }] as {
      base64: string
      type: WeChatImageMime
    }[]
    await personaDb.patchWeChatChatMessageById(messageId, {
      images,
      imageGenPending: false,
      imageGenAwaitingConfirm: false,
      imageGenFailed: false,
      imageGenPrompt: promptForGen,
    })
    const stored = await personaDb.getWeChatChatMessageById(messageId)
    if (!stored?.images?.length) {
      await markWeChatImageGenFailed(messageId)
      return {
        ok: false,
        failure: { kind: 'other', message: 'image_patch_not_persisted' },
      }
    }
    dispatchWeChatImageGenUiPatch(messageId, {
      images: stored.images,
      imageGenPending: false,
      imageGenAwaitingConfirm: false,
      imageGenFailed: false,
    })
    return { ok: true, images: stored.images }
  } catch (err) {
    const failure = classifyWeChatCharacterImageGenFailure(err)
    await markWeChatImageGenFailed(messageId)
    return { ok: false, failure }
  }
}

export function startWeChatCharacterImageGenInBackground(params: {
  messageId: string
  description?: string
  /** @deprecated 使用 description */
  prompt?: string
  cachedPrompt?: string | null
  character: Character | null
  settings: MomentsImageGenSettings
  playerIdentityId?: string | null
  onComplete?: (result: Awaited<ReturnType<typeof finalizeWeChatCharacterImageGenMessage>>) => void
}): void {
  void finalizeWeChatCharacterImageGenMessage({
    messageId: params.messageId,
    description: params.description || params.prompt || '',
    cachedPrompt: params.cachedPrompt,
    character: params.character,
    settings: params.settings,
    playerIdentityId: params.playerIdentityId,
  }).then((result) => {
    params.onComplete?.(result)
  })
}
