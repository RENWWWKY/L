/**
 * 浏览器本地向量 Worker（Transformers.js / WASM）。
 * 模型从 CDN 按需加载，不进入主 bundle。
 */

let pipelineFn: ((task: string, model: string, opts?: Record<string, unknown>) => Promise<unknown>) | null = null
let extractor: { (text: string | string[], opts?: Record<string, unknown>): Promise<{ data: Float32Array | number[]; dims: number[] }> } | null = null
let dimensions = 0

type WorkerIn =
  | { type: 'init'; data: { model: string; dtype?: string; remoteHost?: string } }
  | { type: 'embed'; id: string; data: { texts: string[] } }
  | { type: 'dispose' }

type WorkerOut =
  | { type: 'ready'; dimensions: number }
  | { type: 'progress'; data: unknown }
  | { type: 'result'; id: string; vectors: number[][] }
  | { type: 'error'; id?: string; message: string }
  | { type: 'disposed' }

self.onmessage = async (event: MessageEvent<WorkerIn>) => {
  const msg = event.data
  try {
    switch (msg.type) {
            case 'init': {
                self.postMessage({
                  type: 'progress',
                  data: { status: 'initiate', name: 'runtime', file: '@huggingface/transformers' },
                } satisfies WorkerOut)
                // CDN 动态加载；运行时由 Worker 拉取，不参与主 bundle 类型检查
                // @ts-expect-error CDN module URL
                const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0')
                self.postMessage({
                  type: 'progress',
                  data: { status: 'done', file: '@huggingface/transformers' },
                } satisfies WorkerOut)
        const env = module.env as {
          allowLocalModels?: boolean
          allowRemoteModels?: boolean
          remoteHost?: string
          remotePathTemplate?: string
          useBrowserCache?: boolean
        }
        env.allowLocalModels = false
        env.allowRemoteModels = true
        env.useBrowserCache = true
        const remoteHost = msg.data.remoteHost?.trim()
        if (remoteHost) {
          env.remoteHost = remoteHost.endsWith('/') ? remoteHost : `${remoteHost}/`
          env.remotePathTemplate = '{model}/resolve/{revision}/'
        }
        pipelineFn = module.pipeline as typeof pipelineFn
        extractor = (await pipelineFn!('feature-extraction', msg.data.model, {
          dtype: msg.data.dtype || 'q8',
          device: 'wasm',
          progress_callback: (info: unknown) => {
            self.postMessage({ type: 'progress', data: info } satisfies WorkerOut)
          },
        })) as typeof extractor

        const probe = await extractor!('test', { pooling: 'cls', normalize: true })
        dimensions = probe.dims[probe.dims.length - 1] ?? 0
        if (!dimensions) throw new Error('本地模型维度探测失败')
        self.postMessage({ type: 'ready', dimensions } satisfies WorkerOut)
        break
      }
      case 'embed': {
        if (!extractor || !dimensions) {
          self.postMessage({ type: 'error', id: msg.id, message: '本地向量模型未初始化' } satisfies WorkerOut)
          return
        }
        const texts = msg.data.texts.map((t) => String(t ?? '').trim()).filter(Boolean)
        if (!texts.length) {
          self.postMessage({ type: 'result', id: msg.id, vectors: [] } satisfies WorkerOut)
          return
        }
        const output = await extractor(texts, { pooling: 'cls', normalize: true })
        const data = output.data instanceof Float32Array ? output.data : Float32Array.from(output.data)
        const vectors: number[][] = []
        for (let i = 0; i < texts.length; i++) {
          vectors.push(Array.from(data.slice(i * dimensions, (i + 1) * dimensions)))
        }
        self.postMessage({ type: 'result', id: msg.id, vectors } satisfies WorkerOut)
        break
      }
      case 'dispose': {
        extractor = null
        pipelineFn = null
        dimensions = 0
        self.postMessage({ type: 'disposed' } satisfies WorkerOut)
        break
      }
      default:
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({
      type: 'error',
      id: msg.type === 'embed' ? msg.id : undefined,
      message,
    } satisfies WorkerOut)
  }
}

export {}
