/** Horae 对齐默认：中文小模型，512 维，浏览器 WASM 运行 */
export const DEFAULT_LOCAL_EMBEDDING_MODEL = 'Xenova/bge-small-zh-v1.5'

export type LocalEmbeddingModelOption = {
  id: string
  title: string
  subtitle: string
}

/** 经 Transformers.js / WASM 验证的本地模型预设，不支持自由输入 */
export const LOCAL_EMBEDDING_MODEL_OPTIONS: ReadonlyArray<LocalEmbeddingModelOption> = [
  {
    id: 'Xenova/bge-small-zh-v1.5',
    title: 'BGE Small 中文',
    subtitle: '推荐 · 体积小、速度快，适合日常语义召回',
  },
  {
    id: 'Xenova/bge-base-zh-v1.5',
    title: 'BGE Base 中文',
    subtitle: '效果更好 · 体积更大 · 下载与推理更慢',
  },
]

export function normalizeLocalEmbeddingModelId(raw?: string | null): string {
  const trimmed = raw?.trim()
  if (trimmed && LOCAL_EMBEDDING_MODEL_OPTIONS.some((o) => o.id === trimmed)) return trimmed
  return DEFAULT_LOCAL_EMBEDDING_MODEL
}

export function getLocalEmbeddingModelOption(modelId?: string | null): LocalEmbeddingModelOption {
  const id = normalizeLocalEmbeddingModelId(modelId)
  return LOCAL_EMBEDDING_MODEL_OPTIONS.find((o) => o.id === id) ?? LOCAL_EMBEDDING_MODEL_OPTIONS[0]
}
