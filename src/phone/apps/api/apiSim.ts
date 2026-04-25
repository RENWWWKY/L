import type { ApiConfig } from './types'

export type ModelFetchResult = { ok: true; models: string[] } | { ok: false; error: string }
export type TestResult = { ok: true } | { ok: false; error: string }

function normalizeBase(apiUrl: string) {
  const u = apiUrl.trim().replace(/\/+$/, '')
  if (!u) return ''
  // 如果用户填了 .../v1 或 .../v1/，直接拼 /models；否则按 OpenAI 风格补 /v1/models
  if (/(\/v1)$/i.test(u)) return u
  return u
}

function buildModelsEndpoint(apiUrl: string) {
  const base = normalizeBase(apiUrl)
  if (!base) return ''
  if (/\/v1$/i.test(base)) return `${base}/models`
  // 既支持用户直接填根域，也支持填到 /v1/models（这时避免重复拼）
  if (/\/v1\/models$/i.test(base)) return base
  return `${base}/v1/models`
}

function pickErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const anyP = payload as any
  const msg =
    anyP?.error?.message ??
    anyP?.message ??
    anyP?.error ??
    anyP?.detail ??
    anyP?.msg
  return typeof msg === 'string' ? msg : fallback
}

/** 拉取模型（真实请求，失败会给出原因；注意：浏览器可能被 CORS 限制） */
export async function fetchModels(cfg: ApiConfig): Promise<ModelFetchResult> {
  const url = cfg.apiUrl.trim()
  const key = cfg.apiKey.trim()
  if (!url) return { ok: false, error: '请先填写 API URL' }
  if (!key) return { ok: false, error: '请先填写 API Key' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'API URL 格式不正确（需以 http/https 开头）' }
  const endpoint = buildModelsEndpoint(url)
  if (!endpoint) return { ok: false, error: 'API URL 无效' }

  try {
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    })

    const text = await resp.text()
    const data = text ? (JSON.parse(text) as unknown) : null

    if (!resp.ok) {
      return { ok: false, error: pickErrorMessage(data, `拉取失败（HTTP ${resp.status}）`) }
    }

    // OpenAI 风格：{ data: [{ id: 'xxx' }, ...] }
    const anyD = data as any
    const list = Array.isArray(anyD?.data) ? anyD.data : Array.isArray(anyD?.models) ? anyD.models : null
    if (!Array.isArray(list)) return { ok: false, error: '返回格式不符合预期（未找到模型列表）' }
    const models = list
      .map((x: any) => (typeof x === 'string' ? x : typeof x?.id === 'string' ? x.id : ''))
      .filter((x: string) => !!x)

    if (!models.length) return { ok: false, error: '拉取成功但模型列表为空' }
    // 去重并排序（保持稳定体验）
    const uniq = Array.from(new Set(models)).sort((a, b) => a.localeCompare(b))
    return { ok: true, models: uniq }
  } catch (e) {
    const msg =
      e instanceof SyntaxError
        ? '返回不是合法 JSON（请检查 API URL 是否指向正确的 /models 接口）'
        : '请求失败（可能被浏览器 CORS 限制，或网络不可达）'
    return { ok: false, error: msg }
  }
}

/** 预留：对接真实连通性测试接口 */
export async function testConnectionSim(cfg: ApiConfig): Promise<TestResult> {
  const url = cfg.apiUrl.trim()
  const key = cfg.apiKey.trim()
  if (!url) return { ok: false, error: '缺少 API URL' }
  if (!key) return { ok: false, error: '缺少 API Key' }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'API URL 需以 http/https 开头' }
  if (url.toLowerCase().includes('timeout')) return { ok: false, error: '请求超时，请检查网络或域名' }
  if (key.toLowerCase().includes('fail')) return { ok: false, error: '鉴权失败：Key 被拒绝' }
  return { ok: true }
}

