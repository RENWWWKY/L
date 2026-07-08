import { useEffect, useState } from 'react'

/** 大图 data URL 在 iOS 上直接用 img 易出黑块，转为 blob URL 更稳定 */
export function useBlobImageSrc(dataUrl: string): string {
  const [src, setSrc] = useState(dataUrl)

  useEffect(() => {
    const raw = dataUrl.trim()
    if (!raw.startsWith('data:image/')) {
      setSrc(raw)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    void (async () => {
      try {
        const res = await fetch(raw)
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch {
        if (!cancelled) setSrc(raw)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dataUrl])

  return src
}
