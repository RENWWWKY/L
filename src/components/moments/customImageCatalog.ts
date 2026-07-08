import { buildOpenAiModelsEndpoint } from '../../phone/apps/api/openAiCompatibleEndpoints'
import { isSiliconFlowModelsApiUrl, extractOpenAiModelListRowId } from '../../phone/apps/api/embeddingModelList'
import { localizeMomentsImageGenError } from './momentsImageGenErrorZh'
import type { MomentsImageModelOption } from './momentsImageModelCatalog'

export const DEFAULT_CUSTOM_IMAGE_MODEL_ID = 'custom:'

/** 模型 id 上明显是文生图 */
const IMAGE_MODEL_ID_RE =
  /gpt-image|dall-?e|kolors|flux|stable[\s-]?diffusion|seedream|seedance|txt2img|text-to-image|imagen|wanx|ernie-image|z-image|midjourney|sdxl|sd3|playground|cogview|hunyuan-image|pixart|realvis|dreamshaper|ideogram|black-forest|bfl-|qwen-image|gemini-.*image|image-generation|image_generation/i

const NON_IMAGE_MODEL_ID_RE =
  /embed|embedding|whisper|tts|audio|transcrib|speech|rerank|moderation/i

/** 去掉中转站常见前缀后再判聊天模型 */
const CHAT_ONLY_MODEL_CORE_RE =
  /^(gpt-[0-9o]|chatgpt|o[0-9]|claude|gemini-[0-9](?!.*image)|deepseek|qwen(?!.*image)|llama|mistral|grok|glm-[0-9]|doubao-(?!.*seed)|moonshot|kimi|minimax|abab|hunyuan-(?!.*image)|ernie-(?!.*image)|spark|yi-|baichuan|internlm|phi-|solar-|command-)/i

const IMAGE_GEN_CAPABILITY_RE =
  /text-to-image|text_to_image|image.generation|image_generation|images\/generations|txt2img|generateimages|image-output|image_output/i

function readLower(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
  }
  return ''
}

export function normalizeCustomModelIdCore(modelId: string): string {
  return modelId
    .trim()
    .replace(/^(?:\[[^\]]+\]|Pro\/)+/gi, '')
    .trim()
}

export function parseCustomManualModelIds(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return []
  return Array.from(
    new Set(
      raw
        .split(/[,，;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  )
}

function capabilityIndicatesImageGeneration(cap: string): boolean {
  const c = cap.trim().toLowerCase()
  if (!c) return false
  if (IMAGE_GEN_CAPABILITY_RE.test(c)) return true
  if (c === 'image') return false
  if (/vision|image-input|image_input|image-understanding|image_input_only|input_image/i.test(c)) return false
  return false
}

function isLikelyChatOnlyModelCore(core: string): boolean {
  if (!core) return true
  if (CHAT_ONLY_MODEL_CORE_RE.test(core)) return true
  if (/instruct|chat(?!.*image)|-vision$|vision-preview/i.test(core)) return true
  return false
}

function modelIdLooksLikeImageGen(modelId: string): boolean {
  const core = normalizeCustomModelIdCore(modelId)
  return IMAGE_MODEL_ID_RE.test(modelId) || IMAGE_MODEL_ID_RE.test(core)
}

function modelRowEndpointText(row: Record<string, unknown>): string {
  const direct = readLower(row, 'endpoint', 'api_endpoint', 'route', 'path')
  if (direct) return direct
  const endpoints = row.endpoints
  if (typeof endpoints === 'string') return endpoints.trim().toLowerCase()
  if (Array.isArray(endpoints)) {
    return endpoints.map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean).join(' ')
  }
  return ''
}

function rowEndpointIndicatesChatImageGen(row: Record<string, unknown>, modelId: string): boolean {
  if (!modelIdLooksLikeImageGen(modelId)) return false
  const endpoint = modelRowEndpointText(row)
  return !!endpoint && /chat\/completions/.test(endpoint)
}

function isImageModelCandidate(row: unknown): boolean {
  const id = extractOpenAiModelListRowId(row)
  if (!id) return false
  if (NON_IMAGE_MODEL_ID_RE.test(id)) return false

  const core = normalizeCustomModelIdCore(id)

  if (modelIdLooksLikeImageGen(id)) {
    return !isLikelyChatOnlyModelCore(core)
  }

  if (typeof row === 'object' && row) {
    const r = row as Record<string, unknown>
    if (rowEndpointIndicatesChatImageGen(r, id)) return true

    const subType = readLower(r, 'sub_type', 'subType', 'subtype')
    if (subType === 'text-to-image' || subType === 'images') return true

    const type = readLower(r, 'type', 'model_type', 'modelType', 'kind')
    if (type === 'text-to-image') return true

    const capabilities = r.capabilities
    if (
      Array.isArray(capabilities) &&
      capabilities.some((c) => capabilityIndicatesImageGeneration(String(c))) &&
      !isLikelyChatOnlyModelCore(core)
    ) {
      return true
    }

    for (const capKey of ['supported_capabilities', 'supportedCapabilities', 'tasks']) {
      const caps = r[capKey]
      if (
        Array.isArray(caps) &&
        caps.some((c) => capabilityIndicatesImageGeneration(String(c))) &&
        !isLikelyChatOnlyModelCore(core)
      ) {
        return true
      }
    }
  }

  if (isLikelyChatOnlyModelCore(core)) return false
  return false
}

function shortModelLabel(modelId: string): string {
  const slash = modelId.lastIndexOf('/')
  return slash >= 0 ? modelId.slice(slash + 1) : modelId
}

function toCatalogOption(modelId: string, manual = false, viaChat = false): MomentsImageModelOption {
  const label = shortModelLabel(modelId)
  const chatNote = viaChat ? ' · chat/completions 生图' : ''
  return {
    id: `custom:${modelId}`,
    modelName: modelId,
    labelZh: label,
    title: label,
    brand: '自定义接口',
    description: manual ? `${modelId}（手动补充）` : `${modelId}${chatNote}`,
    free: false,
  }
}

async function requestModelsList(
  endpoint: string,
  apiKey: string,
): Promise<{ ok: true; list: unknown[] } | { ok: false; error: string; status?: number }> {
  const resp = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await resp.text()
  let data: unknown = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch {
    return { ok: false, error: '返回不是合法 JSON（请检查 API URL 是否指向正确的 /models 接口）' }
  }
  if (!resp.ok) {
    const msg =
      data && typeof data === 'object'
        ? String(
            (data as { error?: { message?: string }; message?: string }).error?.message ??
              (data as { message?: string }).message ??
              `拉取失败（HTTP ${resp.status}）`,
          )
        : `拉取失败（HTTP ${resp.status}）`
    return { ok: false, error: msg, status: resp.status }
  }
  const anyD = data as { data?: unknown; models?: unknown }
  const list = Array.isArray(anyD?.data) ? anyD.data : Array.isArray(anyD?.models) ? anyD.models : null
  if (!list) return { ok: false, error: '返回格式不符合预期（未找到模型列表）' }
  return { ok: true, list }
}

function mergeModelListRows(...lists: unknown[][]): unknown[] {
  const byId = new Map<string, unknown>()
  for (const list of lists) {
    for (const row of list) {
      const id = extractOpenAiModelListRowId(row)
      if (!id) continue
      if (!byId.has(id)) byId.set(id, row)
    }
  }
  return [...byId.values()]
}

function pickImageModelsFromList(list: unknown[]): MomentsImageModelOption[] {
  const seen = new Set<string>()
  const options: MomentsImageModelOption[] = []
  for (const row of list) {
    if (!isImageModelCandidate(row)) continue
    const modelId = extractOpenAiModelListRowId(row)
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    const viaChat =
      typeof row === 'object' && row
        ? rowEndpointIndicatesChatImageGen(row as Record<string, unknown>, modelId)
        : false
    options.push(toCatalogOption(modelId, false, viaChat))
  }
  options.sort((a, b) => a.labelZh.localeCompare(b.labelZh, 'zh-CN'))
  return options
}

/** /models?sub_type=text-to-image 返回的列表：信任接口筛选，但仍排除明显聊天/语音模型 */
function pickTrustedTextToImageModelsFromList(list: unknown[]): MomentsImageModelOption[] {
  const seen = new Set<string>()
  const options: MomentsImageModelOption[] = []
  for (const row of list) {
    const modelId = extractOpenAiModelListRowId(row)
    if (!modelId || seen.has(modelId)) continue
    if (NON_IMAGE_MODEL_ID_RE.test(modelId)) continue
    const core = normalizeCustomModelIdCore(modelId)
    if (isLikelyChatOnlyModelCore(core) && !modelIdLooksLikeImageGen(modelId)) continue
    seen.add(modelId)
    options.push(toCatalogOption(modelId))
  }
  options.sort((a, b) => a.labelZh.localeCompare(b.labelZh, 'zh-CN'))
  return options
}

function mergeCatalogOptions(...groups: MomentsImageModelOption[][]): MomentsImageModelOption[] {
  const seen = new Set<string>()
  const options: MomentsImageModelOption[] = []
  for (const group of groups) {
    for (const opt of group) {
      if (seen.has(opt.modelName)) continue
      seen.add(opt.modelName)
      options.push(opt)
    }
  }
  options.sort((a, b) => a.labelZh.localeCompare(b.labelZh, 'zh-CN'))
  return options
}

export async function fetchCustomImageModelCatalog(
  apiUrl: string,
  apiKey: string,
  manualModelIds: string[] = [],
): Promise<MomentsImageModelOption[]> {
  const url = apiUrl.trim()
  const key = apiKey.trim()
  if (!url) throw new Error('请先填写 API URL')
  if (!key) throw new Error('请先填写 API Key')
  if (!/^https?:\/\//i.test(url)) throw new Error('API URL 格式不正确（需以 http/https 开头）')

  const endpoint = buildOpenAiModelsEndpoint(url)
  if (!endpoint) throw new Error('API URL 无效')

  const imageSubTypeEndpoint = endpoint.includes('?')
    ? `${endpoint}&sub_type=text-to-image`
    : `${endpoint}?sub_type=text-to-image`

  let lastError = '未找到可用的生图模型'
  let lastTotalCount = 0
  const mergedLists: unknown[][] = []

  for (const planEndpoint of [imageSubTypeEndpoint, endpoint]) {
    try {
      const res = await requestModelsList(planEndpoint, key)
      if (!res.ok) {
        lastError = res.error
        continue
      }
      lastTotalCount = Math.max(lastTotalCount, res.list.length)
      if (res.list.length) mergedLists.push(res.list)
    } catch {
      lastError = '请求失败（可能被浏览器 CORS 限制，或网络不可达）'
    }
  }

  const merged = mergeModelListRows(...mergedLists)
  const subtypeList = mergedLists[0] ?? []
  const fromSubtype = subtypeList.length ? pickTrustedTextToImageModelsFromList(subtypeList) : []
  const fromStrict = merged.length ? pickImageModelsFromList(merged) : []
  const fromManual = manualModelIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => toCatalogOption(id, true))

  const options = mergeCatalogOptions(fromSubtype, fromStrict, fromManual)
  if (options.length) return options

  if (lastTotalCount > 0) {
    const hint = isSiliconFlowModelsApiUrl(url)
      ? '若使用硅基流动，也可直接选用内置「硅基流动」引擎。'
      : '多数 OneAPI/NewAPI 等中转站的 /models 只返回聊天模型，不会列出 gpt-image、dall-e、flux 等生图模型；请在下方「手动补充模型 ID」填写中转站后台实际模型名（如 gpt-image-2、[特价]gpt-image-2-1k）后重新拉取。部分 gpt-image 仅挂 /v1/chat/completions，客户端会自动走该接口生图。'
    throw new Error(
      `已从接口拉取 ${lastTotalCount} 个模型，但未识别出文生图模型（列表中的 gpt-4/claude 等多为聊天或识图模型，不是文生图）。${hint}`,
    )
  }

  throw new Error(localizeMomentsImageGenError('custom', 0, lastError))
}
