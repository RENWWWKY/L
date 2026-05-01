import Cropper from 'react-easy-crop'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable } from './Pressable'
import { getCroppedDataUrl } from '../utils/cropImage'

type Area = { x: number; y: number; width: number; height: number }

type Props = {
  open: boolean
  imageSrc: string
  title?: string
  aspect?: number
  maxSide?: number
  objectFit?: 'horizontal-cover' | 'vertical-cover' | 'contain'
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}

export function ImageCropperModal({
  open,
  imageSrc,
  title = '裁剪图标',
  aspect = 1,
  maxSide = 256,
  objectFit = 'horizontal-cover',
  onCancel,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    // 每次打开或切换图片时重置状态，避免沿用上一次裁剪坐标导致越界观感
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPixels(null)
  }, [open, imageSrc, aspect])

  const onCropComplete = useCallback((_a: unknown, pixels: Area) => {
    setAreaPixels(pixels)
  }, [])

  const canConfirm = useMemo(() => !!areaPixels && !busy, [areaPixels, busy])

  const confirm = useCallback(async () => {
    if (!areaPixels) return
    setBusy(true)
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, areaPixels, maxSide)
      onConfirm(dataUrl)
    } finally {
      setBusy(false)
    }
  }, [areaPixels, imageSrc, onConfirm])

  if (!open) return null

  return (
    <div
      className="absolute inset-0 z-[520] flex flex-col"
      style={{
        background: 'rgba(0,0,0,0.55)',
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="px-4 pt-2">
        <div
          className="flex items-center justify-between rounded-[18px] border px-3 py-2"
          style={{ background: 'var(--phone-surface)', borderColor: 'var(--phone-border)' }}
        >
          <p className="text-[13px] font-semibold" style={{ color: 'var(--phone-text)' }}>
            {title}
          </p>
          <Pressable
            onClick={onCancel}
            className="rounded-full px-3 py-1 text-[12px] font-medium"
            style={{ color: 'var(--phone-text-muted)' }}
          >
            关闭
          </Pressable>
        </div>
      </div>

      <div className="relative mx-4 mt-3 flex-1 overflow-hidden rounded-[18px] border"
        style={{ borderColor: 'rgba(255,255,255,0.16)' }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit={objectFit}
          restrictPosition
        />
      </div>

      <div
        className="mx-4 mb-2 mt-3 rounded-[18px] border px-4 py-3"
        style={{ background: 'var(--phone-surface)', borderColor: 'var(--phone-border)' }}
      >
        <label className="block text-[10px] font-medium uppercase tracking-[0.18em] opacity-70">
          缩放
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-3 flex gap-2">
          <Pressable
            onClick={onCancel}
            className="flex-1 rounded-[14px] border py-3 text-center text-[13px] font-medium"
            style={{
              borderColor: 'var(--phone-border)',
              background: 'var(--phone-surface-muted)',
              color: 'var(--phone-text-muted)',
            }}
          >
            取消
          </Pressable>
          <Pressable
            onClick={confirm}
            disabled={!canConfirm}
            className="flex-1 rounded-[14px] py-3 text-center text-[13px] font-medium"
            style={{
              background: canConfirm ? 'var(--phone-text)' : 'rgba(0,0,0,0.25)',
              color: 'var(--phone-surface)',
            }}
          >
            {busy ? '处理中…' : '应用'}
          </Pressable>
        </div>
      </div>
    </div>
  )
}

