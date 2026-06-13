import type { ApiConfig } from '../../phone/apps/api/types'
import {
  openAiCompatibleChat,
  openAiCompatibleChatAny,
} from '../../phone/apps/wechat/newFriendsPersona/ai'

import { MAX_MOMENT_IMAGES } from './momentContentLimits'
import { isMomentUserImageRef, loadMomentUserImageDataUrl } from './momentUserImageStorage'

export const MOMENT_VISION_SYSTEM_APPENDIX = `
【朋友圈配图识图】
用户动态可能附有配图，你会在 user 消息中以多模态形式收到。
- 点赞/评论/回复须结合画面与文字，像真人刷朋友圈；可点到 1～2 个具体细节，勿写成逐像素长评。
- 若实际未收到图片或看不清：勿编造画面细节，可仅接文字或轻描淡写。
`.trim()

type VisionChatParams = {
  system: string
  userText: string
  momentImages?: string[] | null
  temperature?: number
  max_tokens?: number
}

function pickMomentImageUrls(raw?: string[] | null): string[] {
  return (raw ?? [])
    .map((u) => u.trim())
    .filter(
      (u) =>
        u.startsWith('data:') ||
        u.startsWith('blob:') ||
        /^https?:\/\//i.test(u) ||
        isMomentUserImageRef(u),
    )
    .slice(0, MAX_MOMENT_IMAGES)
}

async function blobToDataUrl(blobUrl: string): Promise<string | null> {
  try {
    const res = await fetch(blobUrl)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** 将朋友圈配图规范为 vision API 可接受的 URL（优先 data URL） */
export async function resolveMomentVisionImageUrls(raw?: string[] | null): Promise<string[]> {
  const picked = pickMomentImageUrls(raw)
  const out: string[] = []
  for (const url of picked) {
    if (isMomentUserImageRef(url)) {
      const data = await loadMomentUserImageDataUrl(url)
      if (data) out.push(data)
      continue
    }
    if (url.startsWith('data:')) {
      out.push(url)
      continue
    }
    if (url.startsWith('blob:')) {
      const data = await blobToDataUrl(url)
      if (data) out.push(data)
      continue
    }
    try {
      const res = await fetch(url)
      if (res.ok) {
        const blob = await res.blob()
        const data = await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
        if (data) {
          out.push(data)
          continue
        }
      }
    } catch {
      /* 跨域等失败时仍尝试把远程 URL 交给模型端拉取 */
    }
    out.push(url)
  }
  return out
}

function buildVisionUserContent(userText: string, imageUrls: string[]): unknown {
  const parts: unknown[] = [{ type: 'text', text: userText }]
  for (const url of imageUrls) {
    parts.push({ type: 'image_url', image_url: { url } })
  }
  return parts
}

function buildVisionMessageVariants(system: string, userText: string, imageUrls: string[]): unknown[][] {
  const userContent = buildVisionUserContent(userText, imageUrls)
  const base: unknown[] = [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ]
  const alt1: unknown[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        ...imageUrls.map((url) => ({ type: 'image_url', image_url: url })),
      ],
    },
  ]
  const alt2: unknown[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        ...imageUrls.map((url) => ({ type: 'image_url', url })),
      ],
    },
  ]
  return [base, alt1, alt2]
}

function appendVisionFallbackNote(userText: string, imageCount: number): string {
  if (imageCount <= 0) return userText
  return `${userText}\n\n（该动态含 ${imageCount} 张配图，但当前未能向模型传入图片；请仅根据文字与评论发挥，勿编造具体画面细节。）`
}

/**
 * 朋友圈 AI：有配图且模型支持时走多模态；失败则回退纯文本并注明未能识图。
 */
export async function runMomentsVisionChat(
  cfg: ApiConfig,
  params: VisionChatParams,
): Promise<string> {
  const temperature = params.temperature ?? 0.78
  const max_tokens = params.max_tokens ?? 1200
  const imageUrls = await resolveMomentVisionImageUrls(params.momentImages)

  if (!imageUrls.length) {
    return openAiCompatibleChat(
      cfg,
      [
        { role: 'system', content: params.system },
        { role: 'user', content: params.userText },
      ],
      { temperature, max_tokens },
    )
  }

  const system = `${params.system}\n\n${MOMENT_VISION_SYSTEM_APPENDIX}`
  const variants = buildVisionMessageVariants(system, params.userText, imageUrls)
  let lastErr: unknown = null
  for (const messages of variants) {
    try {
      return await openAiCompatibleChatAny(cfg, messages, { temperature, max_tokens })
    } catch (err) {
      lastErr = err
    }
  }

  void lastErr
  return openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: params.system },
      { role: 'user', content: appendVisionFallbackNote(params.userText, imageUrls.length) },
    ],
    { temperature, max_tokens },
  )
}
