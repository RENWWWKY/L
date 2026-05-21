import { useCallback, useState } from 'react'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { Pressable } from '../../components/Pressable'

const ASPECT = 9 / 16

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (e) => reject(e))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = src
  })
}

async function getCroppedImageDataUrl(imageSrc: string, crop: Area): Promise<string> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const w = Math.max(1, Math.floor(crop.width))
  const h = Math.max(1, Math.floor(crop.height))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas context')
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.9)
}

type Props = {
  open: boolean
  imageSrc: string
  onClose: () => void
  onComplete: (dataUrl: string) => void
}

export function MeetChatBackgroundCropperModal({ open, imageSrc, onClose, onComplete }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_area: Area, areaPx: Area) => {
    setCroppedAreaPixels(areaPx)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return
    setBusy(true)
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels)
      onComplete(dataUrl)
      onClose()
    } catch {
      // 跨域或解码失败时静默，由用户重试本地上传
    } finally {
      setBusy(false)
    }
  }, [croppedAreaPixels, imageSrc, onClose, onComplete])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[600] flex flex-col bg-black/72"
      role="dialog"
      aria-modal="true"
      aria-label="Crop chat background"
    >
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/75">
          Crop 9:16 | 裁切临时背景
        </p>
        <Pressable
          onClick={onClose}
          className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] text-white/90"
        >
          Close
        </Pressable>
      </div>
      <div className="relative min-h-0 flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={ASPECT}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="horizontal-cover"
        />
      </div>
      <div className="shrink-0 space-y-3 border-t border-white/10 px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <label className="block text-[11px] text-white/65">
          <span className="meet-caption-en font-mono text-[9px] uppercase tracking-[0.2em]">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-2 w-full accent-[#c9a227]"
          />
        </label>
        <Pressable
          onClick={() => void handleConfirm()}
          disabled={busy || !croppedAreaPixels}
          className="flex w-full items-center justify-center rounded-full border border-[#c9a227]/55 bg-[#1c1c1e] py-3 text-[13px] font-medium tracking-wide text-white transition-colors duration-300 disabled:opacity-40"
        >
          {busy ? 'Processing…' : 'Apply | 应用背景'}
        </Pressable>
      </div>
    </div>
  )
}
