export type LocalEmbeddingDownloadProgress = {
  label: string
  /** 0–100；仅在有真实字节进度时为 number，禁止虚拟估算 */
  percent: number | null
  loadedBytes?: number
  totalBytes?: number
}

function shortFileName(file: string): string {
  const trimmed = file.trim()
  if (!trimmed) return ''
  return trimmed.split('/').pop() || trimmed
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatLocalEmbeddingByteHint(loaded?: number, total?: number): string | null {
  if (typeof loaded !== 'number' || typeof total !== 'number' || total <= 0) return null
  return `${formatBytes(loaded)} / ${formatBytes(total)}`
}

/** 将 Transformers.js progress_callback 事件聚合为整体下载进度 */
export class LocalEmbeddingDownloadProgressAggregator {
  private files = new Map<string, { loaded: number; total: number }>()

  reset(): void {
    this.files.clear()
  }

  ingest(raw: unknown): LocalEmbeddingDownloadProgress {
    if (!raw || typeof raw !== 'object') {
      return { label: '等待下载进度…', percent: null }
    }

    const o = raw as Record<string, unknown>
    const status = String(o.status ?? '')

    if (status === 'progress_total') {
      const loaded = typeof o.loaded === 'number' ? o.loaded : 0
      const total = typeof o.total === 'number' ? o.total : 0
      const progress = typeof o.progress === 'number' ? o.progress : null
      const percent =
        progress != null
          ? Math.min(100, Math.round(progress))
          : total > 0
            ? Math.min(100, Math.round((loaded / total) * 100))
            : null
      return {
        label: '下载模型文件',
        percent,
        loadedBytes: total > 0 ? loaded : undefined,
        totalBytes: total > 0 ? total : undefined,
      }
    }

    if (status === 'progress') {
      const file = String(o.file ?? '')
      const loaded = typeof o.loaded === 'number' ? o.loaded : 0
      const total = typeof o.total === 'number' ? o.total : 0
      if (file) {
        this.files.set(file, { loaded, total })
      }

      const { sumLoaded, sumTotal } = this.sumFileBytes()
      const filePct = typeof o.progress === 'number' ? o.progress : null
      const percent =
        sumTotal > 0
          ? Math.min(100, Math.round((sumLoaded / sumTotal) * 100))
          : filePct != null
            ? Math.min(100, Math.round(filePct))
            : total > 0
              ? Math.min(100, Math.round((loaded / total) * 100))
              : null

      const shortFile = shortFileName(file)
      return {
        label: shortFile ? `下载 ${shortFile}` : '下载模型文件',
        percent,
        loadedBytes: sumTotal > 0 ? sumLoaded : total > 0 ? loaded : undefined,
        totalBytes: sumTotal > 0 ? sumTotal : total > 0 ? total : undefined,
      }
    }

    if (status === 'initiate') {
      const file = shortFileName(String(o.file ?? o.name ?? ''))
      return {
        label: file ? `准备 ${file}` : '准备下载…',
        percent: null,
      }
    }

    if (status === 'done') {
      const file = shortFileName(String(o.file ?? ''))
      const { sumLoaded, sumTotal } = this.sumFileBytes()
      return {
        label: file ? `${file} 完成` : '文件下载完成',
        percent: sumTotal > 0 ? Math.min(100, Math.round((sumLoaded / sumTotal) * 100)) : null,
        loadedBytes: sumTotal > 0 ? sumLoaded : undefined,
        totalBytes: sumTotal > 0 ? sumTotal : undefined,
      }
    }

    if (status === 'ready') {
      return { label: '模型就绪', percent: 100 }
    }

    return { label: status || '下载中…', percent: null }
  }

  private sumFileBytes(): { sumLoaded: number; sumTotal: number } {
    let sumLoaded = 0
    let sumTotal = 0
    for (const f of this.files.values()) {
      sumLoaded += f.loaded
      sumTotal += f.total
    }
    return { sumLoaded, sumTotal }
  }
}
