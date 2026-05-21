import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat, openAiCompatibleChatAny } from '../wechat/newFriendsPersona/ai'
import type { MeetImageMime } from './meetTypes'

export type { MeetImageMime }

export function normalizeMeetImageBase64(raw: string): string {
  return raw.trim().replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '').trim()
}

export function meetImageDataUrl(mime: MeetImageMime, base64: string): string {
  return `data:${mime};base64,${normalizeMeetImageBase64(base64)}`
}

/** dataURL / http(s) / 同源路径 → vision 用 base64 */
export async function resolveMeetImagePayloadFromUrl(
  src: string,
): Promise<{ base64: string; mime: MeetImageMime } | null> {
  const url = src.trim()
  if (!url) return null

  const dataMatch = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i.exec(url)
  if (dataMatch) {
    const mime = dataMatch[1] as MeetImageMime
    const b64 = (dataMatch[2] ?? '').trim()
    if (b64.length >= 64) return { base64: b64, mime }
  }

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const mime = (
      blob.type && /^image\/(jpeg|png|gif|webp)$/i.test(blob.type) ? blob.type : 'image/jpeg'
    ) as MeetImageMime
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
    const b64 = btoa(binary)
    if (b64.length < 64) return null
    return { base64: b64, mime }
  } catch {
    return null
  }
}

export const MEET_USER_IMAGE_VISION_TEXT = '（我发来了一张图片）'

export const MEET_USER_AVATAR_VISION_TEXT =
  '（以下为我在遇见「社交假面」里设置的头像，仅作第一印象参考；不必刻意点评长相，自然融入后续聊天即可）'

export const MEET_IMAGE_VISION_APPENDIX = `
【图片消息】
用户可能发送图片。若当前接口支持 vision，请根据画面内容自然接话。
- 像真人微信聊天一样简短口语，可拆多条气泡；不要写成摄影评论或技术识图报告。
- 可结合对方公开资料与上文语境适度联想，勿编造看不清的细节。
`.trim()

function visionParts(text: string, dataUrl: string): unknown[] {
  return [
    { type: 'text', text },
    { type: 'image_url', image_url: { url: dataUrl } },
  ]
}

/**
 * OpenAI 风格多模态请求；失败时尝试兼容变体，最后回退纯文本（由模型自述看不见图）。
 */
export async function callMeetOpenAiVisionChat(
  cfg: ApiConfig,
  messages: unknown[],
  options?: { temperature?: number; max_tokens?: number },
): Promise<string> {
  const temperature = options?.temperature ?? 0.72
  const max_tokens = options?.max_tokens ?? 1400

  const tryCall = async (msgs: unknown[]) => openAiCompatibleChatAny(cfg, msgs, { temperature, max_tokens })

  try {
    return await tryCall(messages)
  } catch {
    /* 主格式失败，尝试变体 */
  }

  const last = messages[messages.length - 1]
  if (last && typeof last === 'object' && Array.isArray((last as { content?: unknown }).content)) {
    const parts = (last as { content: unknown[] }).content
    const textPart = parts.find((p) => p && typeof p === 'object' && (p as { type?: string }).type === 'text') as
      | { text?: string }
      | undefined
    const imgPart = parts.find((p) => p && typeof p === 'object' && (p as { type?: string }).type === 'image_url') as
      | { image_url?: { url?: string }; url?: string }
      | undefined
    const dataUrl =
      imgPart?.image_url?.url ??
      (typeof imgPart?.url === 'string' ? imgPart.url : undefined)
    const visionText = textPart?.text?.trim() || MEET_USER_IMAGE_VISION_TEXT
    if (dataUrl) {
      try {
        const alt1: unknown[] = [
          ...messages.slice(0, -1),
          { role: 'user', content: visionParts(visionText, dataUrl) },
        ]
        return await tryCall(alt1)
      } catch {
        /* ignore */
      }
      try {
        const alt2: unknown[] = [
          ...messages.slice(0, -1),
          {
            role: 'user',
            content: [
              { type: 'text', text: visionText },
              { type: 'image_url', url: dataUrl },
            ],
          },
        ]
        return await tryCall(alt2)
      } catch {
        /* ignore */
      }
    }
  }

  const fallbackUser =
    '我刚发了一张图片或分享了头像参考图，但你的当前模型/接口可能不支持看图。请用自然的微信聊天语气说明你看不见图片，并引导我用文字描述。'
  const textOnly = messages.filter(
    (m) => m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string',
  ) as Array<{ role: string; content: string }>
  return openAiCompatibleChat(
    cfg,
    [
      ...textOnly.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: fallbackUser },
    ],
    { temperature, max_tokens },
  )
}
