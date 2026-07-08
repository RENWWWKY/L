import { loadImageUrlAsDataUrl } from '../characterAppearanceImageGen'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatImageMime } from '../newFriendsPersona/types'

export type AddPlotImageToAlbumResult = 'saved' | 'duplicate' | 'failed'

const DATING_PLOT_ALBUM_MSG_PREFIX = 'dating-plot-img:'

export function datingPlotAlbumMessageId(plotImageId: string): string {
  return `${DATING_PLOT_ALBUM_MSG_PREFIX}${plotImageId.trim()}`
}

function mimeFromDataUrl(dataUrl: string): WeChatImageMime {
  const m = /^data:([^;,]+)/i.exec(dataUrl.trim())
  const mime = m?.[1]?.trim().toLowerCase() ?? ''
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/gif') return 'image/gif'
  if (mime === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

async function resolvePlotImageDataUrl(url: string): Promise<string | null> {
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:')) return trimmed
  return loadImageUrlAsDataUrl(trimmed)
}

/** 将剧情穿插配图保存到对应角色的微信相册 / 记忆相册数据源 */
export async function addPlotImageToCharacterAlbum(params: {
  characterId: string
  plotImageId: string
  imageUrl: string
  timestamp?: number
  caption?: string
}): Promise<AddPlotImageToAlbumResult> {
  const characterId = params.characterId.trim()
  const plotImageId = params.plotImageId.trim()
  if (!characterId || !plotImageId) return 'failed'

  const messageId = datingPlotAlbumMessageId(plotImageId)
  const existing = await personaDb.findWeChatAlbumItemByMessageId(messageId)
  if (existing) return 'duplicate'

  const dataUrl = await resolvePlotImageDataUrl(params.imageUrl)
  if (!dataUrl) return 'failed'

  const saved = await personaDb.addWeChatAlbumItemFromImageUrl({
    messageId,
    characterId,
    imageDataUrl: dataUrl,
    mimeType: mimeFromDataUrl(dataUrl),
    timestamp: params.timestamp ?? Date.now(),
    caption: params.caption?.trim() || '剧情配图',
    senderKind: 'character',
  })
  return saved ? 'saved' : 'failed'
}
