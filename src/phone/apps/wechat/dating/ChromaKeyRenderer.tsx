import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChromaKeyConfig } from './useVNStore'

type Props = {
  imageUrl: string
  chromaKey: ChromaKeyConfig
  className?: string
  /** 拖动滑块时传 true，走低分辨率预览 */
  lowQualityPreview?: boolean
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const s = String(hex || '').trim()
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) return { r: 0, g: 255, b: 0 }
  return {
    r: Number.parseInt(s.slice(1, 3), 16),
    g: Number.parseInt(s.slice(3, 5), 16),
    b: Number.parseInt(s.slice(5, 7), 16),
  }
}

export function ChromaKeyRenderer({
  imageUrl,
  chromaKey,
  className,
  lowQualityPreview = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)

  const targetRgb = useMemo(() => hexToRgb(chromaKey.targetColor), [chromaKey.targetColor])

  useEffect(() => {
    if (!imageUrl) {
      setImgEl(null)
      return
    }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => setImgEl(img)
    img.src = imageUrl
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [imageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgEl
    if (!canvas || !img) return

    const draw = () => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      const sourceW = Math.max(1, img.naturalWidth || img.width)
      const sourceH = Math.max(1, img.naturalHeight || img.height)
      const maxSide = lowQualityPreview ? 520 : 1280
      const scale = Math.min(1, maxSide / Math.max(sourceW, sourceH))
      const drawW = Math.max(1, Math.round(sourceW * scale))
      const drawH = Math.max(1, Math.round(sourceH * scale))

      canvas.width = drawW
      canvas.height = drawH
      ctx.clearRect(0, 0, drawW, drawH)
      ctx.drawImage(img, 0, 0, drawW, drawH)

      if (!chromaKey.enabled) return

      const imageData = ctx.getImageData(0, 0, drawW, drawH)
      const data = imageData.data
      const tol = Math.max(0, Math.min(100, chromaKey.tolerance))
      const soft = Math.max(0, Math.min(100, chromaKey.edgeSoftness))
      const threshold = (tol / 100) * 442
      const feather = Math.max(1, (soft / 100) * 120)

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - targetRgb.r
        const dg = data[i + 1] - targetRgb.g
        const db = data[i + 2] - targetRgb.b
        const dist = Math.sqrt(dr * dr + dg * dg + db * db)

        if (dist <= threshold - feather) {
          data[i + 3] = 0
          continue
        }
        if (dist >= threshold + feather) continue

        const t = (dist - (threshold - feather)) / (2 * feather)
        data[i + 3] = Math.max(0, Math.min(255, Math.round(t * 255)))
      }
      ctx.putImageData(imageData, 0, 0)
    }

    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    rafRef.current = window.requestAnimationFrame(draw)

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [imgEl, chromaKey.enabled, chromaKey.edgeSoftness, chromaKey.tolerance, lowQualityPreview, targetRgb.b, targetRgb.g, targetRgb.r])

  return <canvas ref={canvasRef} className={className} />
}

