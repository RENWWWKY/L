import type { MomentsImageProvider } from './momentsImageModelCatalog'
import {
  formatVolcengineModelNotActivatedMessage,
  isVolcengineModelNotActivatedError,
} from './volcengineImageCatalog'

const PROVIDER_LABEL: Record<MomentsImageProvider, string> = {
  siliconflow: '硅基流动',
  qianfan: '百度千帆',
  volcengine: '火山方舟',
  novelai: 'NovelAI',
  gemini: 'Gemini',
  openai: 'OpenAI GPT 生图',
  custom: '自定义接口',
}

type ErrorRule = {
  test: RegExp
  zh: string
}

const ERROR_RULES: ErrorRule[] = [
  {
    test: /account balance is insufficient|insufficient balance|balance is insufficient|余额不足|余额不够|账户余额/i,
    zh: '{p_balance_hint}',
  },
  {
    test: /recaptcha token is required|trial generation/i,
    zh: '{p}当前为试用/免费档账户，官方 API 要求 reCAPTCHA 验证；本应用暂不支持自动过验证。请订阅 NovelAI 付费套餐（Tablet/Opus 等）后使用 API Key，或改用其他生图引擎',
  },
  {
    test: /invalid api[_\s-]?key|api key is invalid|incorrect api key|authentication failed|unauthorized|invalid authentication/i,
    zh: '{p} API Key 无效或已过期，请检查密钥',
  },
  {
    test: /rate limit|too many requests|请求过于频繁|throttl/i,
    zh: '{p}请求过于频繁，请稍后再试',
  },
  {
    test: /no available image quota|no available.*quota|image quota|quota exceeded|exceeded.*quota|用量超限|配额/i,
    zh: '{p}生图额度已用尽，请充值、更换模型或稍后再试',
  },
  {
    test: /only imagen models are supported|not supported model for image generation/i,
    zh: '当前中转站的 /images/generations 仅支持 Imagen 等模型；Gemini 原生图模会自动尝试 generateContent，并在失败时回退到 /images/generations',
  },
  {
    test: /model not found|model does not exist|unknown model|invalid model|模型不存在|模型未找到/i,
    zh: '{p}指定的生图模型不可用，请重新选择模型',
  },
  {
    test: /safety system|safety_violations|rejected by the safety|sexual/i,
    zh: '{p}提示词未通过内容安全审核，请修改描述后重试',
  },
  {
    test: /content policy|sensitive content|moderation|违规|敏感内容|审核未通过/i,
    zh: '{p}提示词未通过内容安全审核，请修改描述后重试',
  },
  {
    test: /prompt.*(empty|required|missing)|提示词.*(空|必填)/i,
    zh: '请先输入配图描述或朋友圈文字',
  },
  {
    test: /timeout|timed out|超时/i,
    zh: '{p}请求超时，请稍后重试',
  },
  {
    test: /internal server error|service unavailable|server error|503|502|504/i,
    zh: '{p}服务暂时不可用，请稍后再试',
  },
  {
    test: /bad request|invalid parameter|invalid request|参数错误|参数无效/i,
    zh: '{p}请求参数有误，请检查模型与尺寸设置',
  },
  {
    test: /permission denied|access denied|forbidden|无权限|权限不足/i,
    zh: '{p}当前 API Key 无权限调用该模型',
  },
  {
    test: /network|fetch failed|failed to fetch|网络/i,
    zh: '网络连接失败，请检查网络后重试',
  },
]

const INTERNAL_MESSAGE_ZH: Record<string, string> = {
  IMAGE_DOWNLOAD_FAILED: '图片下载失败，请稍后重试',
  IMAGE_READ_FAILED: '图片解析失败，请稍后重试',
}

function isMostlyChinese(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk >= 6 || cjk / t.length >= 0.25
}

function balanceInsufficientHint(provider: MomentsImageProvider): string {
  const label = PROVIDER_LABEL[provider]
  if (provider === 'siliconflow') {
    return (
      `${label}账户可用额度不足。` +
      '免费生图模型（如 Kolors）仍会从赠送额度扣费；请检查赠送额度是否用尽、是否已完成实名认证、API Key 是否与当前登录账户一致。' +
      '若使用的是付费模型，需充值后再试。'
    )
  }
  return `${label}账户余额不足，请前往控制台充值后再试`
}

function withProvider(template: string, provider: MomentsImageProvider): string {
  if (template === '{p_balance_hint}') return balanceInsufficientHint(provider)
  return template.replace(/\{p\}/g, PROVIDER_LABEL[provider])
}

/** 从 API 响应体中提取错误原文 */
export function extractApiErrorMessage(body: string): string {
  const raw = body.trim()
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as {
      message?: string
      msg?: string
      detail?: string
      error?: { message?: string; code?: string; type?: string }
    }
    const parts = [
      parsed.error?.message,
      parsed.message,
      parsed.msg,
      parsed.detail,
      parsed.error?.code ? `code: ${parsed.error.code}` : '',
    ].filter((x): x is string => typeof x === 'string' && !!x.trim())
    if (parts.length) return parts.join(' · ')
  } catch {
    // 非 JSON，继续用原文
  }
  return raw.slice(0, 600)
}

function matchLocalizedMessage(message: string, provider: MomentsImageProvider): string | null {
  const normalized = message.trim()
  if (!normalized) return null
  for (const rule of ERROR_RULES) {
    if (rule.test.test(normalized)) return withProvider(rule.zh, provider)
  }
  return null
}

/** 将生图 API 错误转为中文提示 */
export function localizeMomentsImageGenError(
  provider: MomentsImageProvider,
  status: number,
  bodyOrMessage: string,
  modelName?: string,
): string {
  const label = PROVIDER_LABEL[provider]
  const raw = extractApiErrorMessage(bodyOrMessage) || bodyOrMessage.trim()

  if (provider === 'volcengine' && raw && isVolcengineModelNotActivatedError(raw)) {
    return formatVolcengineModelNotActivatedMessage(raw, modelName)
  }

  if (status === 401) return `${label} API Key 无效或已过期，请检查密钥`
  if (status === 403) return `${label}无权限调用该接口，请检查账户与模型开通状态`
  if (status === 429) {
    if (/no available image quota|no available.*quota|image quota/i.test(raw)) {
      return `${label}生图额度已用尽，请充值、更换模型或稍后再试`
    }
    return `${label}请求过于频繁，请稍后再试`
  }
  if (status === 503 || status === 502 || status === 504) {
    return `${label}服务暂时不可用，请稍后再试`
  }

  const internal = INTERNAL_MESSAGE_ZH[raw]
  if (internal) return internal

  if (raw && isMostlyChinese(raw)) return raw

  const matched = raw ? matchLocalizedMessage(raw, provider) : null
  if (matched) return matched

  if (raw) {
    return `${label}生图失败：${raw}`
  }
  return `${label}生图失败（HTTP ${status}）`
}

/** 本地化 Error.message（含内部错误码与英文 API 原文） */
export function localizeMomentsImageGenThrownError(
  message: string,
  provider: MomentsImageProvider = 'siliconflow',
): string {
  const trimmed = message.trim()
  if (!trimmed) return '生图失败，请稍后重试'
  if (INTERNAL_MESSAGE_ZH[trimmed]) return INTERNAL_MESSAGE_ZH[trimmed]!
  if (isMostlyChinese(trimmed)) return trimmed
  const matched = matchLocalizedMessage(trimmed, provider)
  if (matched) return matched
  if (provider === 'volcengine' && isVolcengineModelNotActivatedError(trimmed)) {
    return formatVolcengineModelNotActivatedMessage(trimmed)
  }
  return localizeMomentsImageGenError(provider, 0, trimmed)
}
