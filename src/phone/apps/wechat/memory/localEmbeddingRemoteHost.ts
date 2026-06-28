/**
 * Transformers.js 拉取 Xenova 模型文件的远程根地址。
 */

function normalizeRemoteHost(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'https://hf-mirror.com/'
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

export function resolveLocalEmbeddingRemoteHost(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.location?.origin) {
    return normalizeRemoteHost(`${window.location.origin}/hf-proxy`)
  }

  const fromEnv = import.meta.env.VITE_HF_REMOTE_HOST
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return normalizeRemoteHost(fromEnv)
  }

  return 'https://hf-mirror.com/'
}

/** dev 下载前探测 /hf-proxy 是否真能返回 JSON（避免拿到 index.html） */
export async function probeLocalEmbeddingDownloadChannel(modelId: string): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return

  const model = modelId.trim()
  const url = `${window.location.origin}/hf-proxy/${model}/resolve/main/config.json`
  let resp: Response
  try {
    resp = await fetch(url, { cache: 'no-store' })
  } catch (e) {
    throw new Error(`无法访问模型下载地址：${e instanceof Error ? e.message : String(e)}`)
  }

  const text = await resp.text()
  const head = text.trimStart().slice(0, 32).toLowerCase()

  if (!resp.ok) {
    throw new Error(`模型下载 HTTP ${resp.status}：${text.slice(0, 120)}`)
  }
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error(
      '当前页面拿不到模型文件（开发服务器返回了网页）。请确认浏览器地址栏端口与终端里 Vite 显示的端口一致，并关掉多余的旧 dev 进程。',
    )
  }

  try {
    JSON.parse(text)
  } catch {
    throw new Error(`模型配置不是有效 JSON：${text.slice(0, 120)}`)
  }
}

export function formatLocalEmbeddingDownloadError(message: string): string {
  const m = message.trim()
  return m || '下载失败'
}

/** 供设置页：探测模型 config.json 是否可达（新标签页打开，需梯子时常用） */
export function buildLocalEmbeddingModelConfigProbeUrl(modelId: string): string {
  const model = modelId.trim()
  const host = resolveLocalEmbeddingRemoteHost()
  return `${host}${model}/resolve/main/config.json`
}
