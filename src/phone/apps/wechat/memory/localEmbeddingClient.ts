import { personaDb } from '../newFriendsPersona/idb'
import { normalizeLocalEmbeddingModelId } from './memoryEmbeddingConstants'
import {
  LocalEmbeddingDownloadProgressAggregator,
  type LocalEmbeddingDownloadProgress,
} from './localEmbeddingDownloadProgress'
import { resolveLocalEmbeddingRemoteHost } from './localEmbeddingRemoteHost'

export type { LocalEmbeddingDownloadProgress } from './localEmbeddingDownloadProgress'
export { formatLocalEmbeddingByteHint } from './localEmbeddingDownloadProgress'

type WorkerReady = { type: 'ready'; dimensions: number }
type WorkerResult = { type: 'result'; id: string; vectors: number[][] }
type WorkerError = { type: 'error'; id?: string; message: string }
type WorkerOut = WorkerReady | WorkerResult | WorkerError | { type: 'disposed' } | { type: 'progress'; data: unknown }

export type LocalEmbeddingDownloadRecord = {
  modelId: string
  dimensions: number
  downloadedAt: number
}

const LOCAL_EMBEDDING_CACHE_KV_KEY = 'wechat-local-embedding-model-cache-v1'

type LocalEmbeddingCacheMap = Record<string, { dimensions: number; downloadedAt: number }>

let worker: Worker | null = null
let dimensions = 0
let activeModel = ''
let initPromise: Promise<number> | null = null
let nextReqId = 1

let progressAggregator = new LocalEmbeddingDownloadProgressAggregator()
let latestDownloadProgress: LocalEmbeddingDownloadProgress | null = null
const progressSubscribers = new Set<(progress: LocalEmbeddingDownloadProgress) => void>()
let workerProgressBound = false

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./localEmbeddingWorker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

function emitDownloadProgress(raw: unknown): void {
  const next = progressAggregator.ingest(raw)
  latestDownloadProgress = next
  for (const fn of progressSubscribers) fn(next)
}

function subscribeDownloadProgress(onProgress: (progress: LocalEmbeddingDownloadProgress) => void): () => void {
  progressSubscribers.add(onProgress)
  if (latestDownloadProgress) onProgress(latestDownloadProgress)
  return () => {
    progressSubscribers.delete(onProgress)
  }
}

function bindWorkerProgressOnce(w: Worker): void {
  if (workerProgressBound) return
  workerProgressBound = true
  w.addEventListener('message', (event: MessageEvent<WorkerOut>) => {
    if (event.data.type === 'progress') {
      emitDownloadProgress(event.data.data)
    }
  })
}

async function readLocalEmbeddingCacheMap(): Promise<LocalEmbeddingCacheMap> {
  const raw = await personaDb.getPhoneKv(LOCAL_EMBEDDING_CACHE_KV_KEY)
  if (!raw || typeof raw !== 'object') return {}
  const map = raw as LocalEmbeddingCacheMap
  return map && typeof map === 'object' ? map : {}
}

export async function getLocalEmbeddingDownloadRecord(modelId?: string): Promise<LocalEmbeddingDownloadRecord | null> {
  const model = normalizeLocalEmbeddingModelId(modelId)
  const map = await readLocalEmbeddingCacheMap()
  const entry = map[model]
  if (!entry || typeof entry.downloadedAt !== 'number') return null
  return {
    modelId: model,
    dimensions: entry.dimensions,
    downloadedAt: entry.downloadedAt,
  }
}

export async function markLocalEmbeddingDownloaded(modelId: string, dims: number): Promise<void> {
  const model = modelId.trim()
  if (!model || !dims) return
  const map = await readLocalEmbeddingCacheMap()
  map[model] = { dimensions: dims, downloadedAt: Date.now() }
  await personaDb.setPhoneKv(LOCAL_EMBEDDING_CACHE_KV_KEY, map)
}

function waitForMessage<T extends WorkerOut>(
  w: Worker,
  match: (msg: WorkerOut) => msg is T,
  timeoutMs = 120_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      w.removeEventListener('message', onMsg)
      reject(new Error('本地向量 Worker 超时'))
    }, timeoutMs)
    const onMsg = (event: MessageEvent<WorkerOut>) => {
      const data = event.data
      if (data.type === 'error' && !match(data as T)) {
        window.clearTimeout(timer)
        w.removeEventListener('message', onMsg)
        reject(new Error(data.message || '本地向量失败'))
        return
      }
      if (match(data)) {
        window.clearTimeout(timer)
        w.removeEventListener('message', onMsg)
        resolve(data)
      }
    }
    w.addEventListener('message', onMsg)
  })
}

export type EnsureLocalEmbeddingModelOptions = {
  onProgress?: (progress: LocalEmbeddingDownloadProgress) => void
  forceDownload?: boolean
}

/** 初始化本地 embedding 模型；返回向量维度。 */
export async function ensureLocalEmbeddingModel(
  modelId?: string,
  opts?: EnsureLocalEmbeddingModelOptions,
): Promise<number> {
  const model = normalizeLocalEmbeddingModelId(modelId)

  if (opts?.forceDownload) {
    disposeLocalEmbeddingModel()
  } else if (dimensions > 0 && activeModel === model) {
    opts?.onProgress?.({ label: '已就绪', percent: 100 })
    await markLocalEmbeddingDownloaded(model, dimensions)
    return dimensions
  }

  const detach = opts?.onProgress ? subscribeDownloadProgress(opts.onProgress) : () => {}

  if (initPromise && activeModel === model) {
    try {
      return await initPromise
    } finally {
      detach()
    }
  }

  if (worker && activeModel && activeModel !== model) {
    disposeLocalEmbeddingModel()
  }

  activeModel = model
  progressAggregator.reset()
  latestDownloadProgress = null

  initPromise = (async () => {
    const w = getWorker()
    bindWorkerProgressOnce(w)
    try {
      const readyPromise = waitForMessage(w, (m): m is WorkerReady => m.type === 'ready', 600_000)
      w.postMessage({
        type: 'init',
        data: {
          model,
          dtype: 'q8',
          remoteHost: resolveLocalEmbeddingRemoteHost(),
        },
      })
      const ready = await readyPromise
      dimensions = ready.dimensions
      emitDownloadProgress({ status: 'ready' })
      await markLocalEmbeddingDownloaded(model, dimensions)
      return dimensions
    } finally {
      latestDownloadProgress = null
    }
  })()

  try {
    return await initPromise
  } catch (e) {
    initPromise = null
    dimensions = 0
    latestDownloadProgress = null
    throw e
  } finally {
    detach()
  }
}

/** 手动下载本地 embedding 模型（可显示进度）。 */
export async function downloadLocalEmbeddingModelManual(
  modelId?: string,
  onProgress?: (progress: LocalEmbeddingDownloadProgress) => void,
  options?: { force?: boolean },
): Promise<{ dimensions: number }> {
  const dim = await ensureLocalEmbeddingModel(modelId, {
    onProgress,
    forceDownload: options?.force,
  })
  return { dimensions: dim }
}

export function getLocalEmbeddingDimensions(): number {
  return dimensions
}

export async function embedTextsWithLocalModel(texts: string[], modelId?: string): Promise<number[][]> {
  const trimmed = texts.map((t) => String(t ?? '').trim()).filter(Boolean)
  if (!trimmed.length) return []
  await ensureLocalEmbeddingModel(modelId)
  const w = getWorker()
  const id = String(nextReqId++)
  const resultPromise = waitForMessage(w, (m): m is WorkerResult => m.type === 'result' && m.id === id)
  w.postMessage({ type: 'embed', id, data: { texts: trimmed } })
  const result = await resultPromise
  return result.vectors
}

export async function embedTextWithLocalModel(text: string, modelId?: string): Promise<number[]> {
  const [vec] = await embedTextsWithLocalModel([text], modelId)
  if (!vec?.length) throw new Error('local_embedding_empty')
  return vec
}

export function disposeLocalEmbeddingModel(): void {
  if (worker) {
    try {
      worker.postMessage({ type: 'dispose' })
      worker.terminate()
    } catch {
      /* ignore */
    }
  }
  worker = null
  workerProgressBound = false
  dimensions = 0
  activeModel = ''
  initPromise = null
  progressAggregator.reset()
  latestDownloadProgress = null
}

/** 探测本地模型是否可用 */
export async function testLocalEmbeddingConnection(modelId?: string): Promise<
  { ok: true; dimensions: number } | { ok: false; message: string }
> {
  try {
    const dim = await ensureLocalEmbeddingModel(modelId)
    if (!dim) return { ok: false, message: '返回维度为 0' }
    return { ok: true, dimensions: dim }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
