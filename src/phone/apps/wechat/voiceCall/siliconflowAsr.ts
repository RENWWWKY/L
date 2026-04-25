import type { ApiConfig } from '../../api/types'

export type VoiceAsrResult = {
  text: string
  emotion?: string
}

const SILICONFLOW_ASR_MODEL = 'FunAudioLLM/SenseVoiceSmall'
export const SILICONFLOW_ASR_DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'

function resolveAsrEndpoint(apiUrl: string): string {
  const base = apiUrl.trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/v1\/audio\/transcriptions$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/audio/transcriptions`
  return `${base}/v1/audio/transcriptions`
}

function mapEmotionToken(token: string): string | undefined {
  const t = token.trim().toLowerCase()
  if (!t) return undefined
  if (t.includes('happy') || t.includes('joy')) return '开心'
  if (t.includes('sad')) return '难过'
  if (t.includes('angry') || t.includes('anger')) return '生气'
  if (t.includes('fear') || t.includes('scared')) return '紧张'
  if (t.includes('surprise')) return '惊讶'
  if (t.includes('disgust')) return '反感'
  if (t.includes('calm') || t.includes('neutral')) return '平静'
  return undefined
}

export function normalizeSenseVoiceText(raw: string): VoiceAsrResult {
  const src = String(raw ?? '').trim()
  if (!src) return { text: '' }
  const tags = [...src.matchAll(/<\|([^|>]+)\|>/g)].map((m) => String(m[1] ?? '').trim())
  const emotion = tags.map((t) => mapEmotionToken(t)).find((x) => !!x)
  const cleaned = src.replace(/<\|[^|>]+\|>/g, ' ').replace(/\s+/g, ' ').trim()
  return { text: cleaned, emotion }
}

export async function requestSiliconflowTranscription(cfg: ApiConfig | null, audioBlob: Blob): Promise<VoiceAsrResult> {
  if (!cfg?.apiKey?.trim()) {
    throw new Error('未配置语音识别 API，无法使用')
  }
  const endpoint = resolveAsrEndpoint(cfg.apiUrl || SILICONFLOW_ASR_DEFAULT_BASE_URL)
  if (!endpoint) throw new Error('语音识别 API URL 无效')
  const ext = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
  const file = new File([audioBlob], `voice.${ext}`, { type: audioBlob.type || 'audio/webm' })
  const form = new FormData()
  form.append('file', file)
  form.append('model', SILICONFLOW_ASR_MODEL)

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey.trim()}` },
    body: form,
  })
  const text = await resp.text()
  let payload: unknown = null
  try {
    payload = text ? (JSON.parse(text) as unknown) : null
  } catch {
    payload = null
  }
  if (!resp.ok) {
    const msg =
      payload && typeof payload === 'object'
        ? String(
            (payload as { message?: unknown; error?: { message?: unknown } }).error?.message ??
              (payload as { message?: unknown }).message ??
              `语音识别失败（HTTP ${resp.status})`,
          )
        : `语音识别失败（HTTP ${resp.status})`
    throw new Error(msg)
  }
  const asrText =
    payload && typeof payload === 'object'
      ? String((payload as { text?: unknown }).text ?? '')
      : ''
  return normalizeSenseVoiceText(asrText)
}

