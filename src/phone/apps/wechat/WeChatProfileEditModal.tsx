import { useEffect, useId, useState } from 'react'

import { ImageCropperModal } from '../../components/ImageCropperModal'
import { Pressable } from '../../components/Pressable'
import type { Profile } from '../../types'

const AVATAR_PREVIEW_FALLBACK = 'https://via.placeholder.com/120'
const MAX_DATA_URL_LEN = 350_000
const AVATAR_MAX_SIDE = 1080

async function compressAvatarDataUrl(src: string, maxLen: number): Promise<string> {
  if (!src || src.length <= maxLen) return src
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('头像图片读取失败'))
  })
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return src

  const side = Math.max(w, h)
  const baseScale = side > AVATAR_MAX_SIDE ? AVATAR_MAX_SIDE / side : 1
  const scales = [baseScale, baseScale * 0.85, baseScale * 0.72, baseScale * 0.6]
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58]
  let best = src

  for (const scale of scales) {
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.drawImage(img, 0, 0, tw, th)

    for (const q of qualities) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length < best.length) best = out
      if (out.length <= maxLen) return out
    }
  }
  return best
}

type Props = {
  open: boolean
  onClose: () => void
  profile: Profile
  onSave: (patch: Partial<Profile>) => void
}

export function WeChatProfileEditModal({ open, onClose, profile, onSave }: Props) {
  const titleId = useId()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [signature, setSignature] = useState(profile.signature)
  const [avatarImageUrl, setAvatarImageUrl] = useState(profile.avatarImageUrl)
  const [avatarCropSrc, setAvatarCropSrc] = useState('')

  useEffect(() => {
    if (!open) return
    setDisplayName(profile.displayName)
    setSignature(profile.signature)
    setAvatarImageUrl(profile.avatarImageUrl)
    setAvatarCropSrc('')
  }, [open, profile.displayName, profile.signature, profile.avatarImageUrl])

  if (!open) return null

  const previewSrc = avatarImageUrl.trim() || AVATAR_PREVIEW_FALLBACK

  const onPickFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      setAvatarCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const save = () => {
    onSave({
      displayName: displayName.trim() || profile.displayName,
      signature: signature.trim(),
      avatarImageUrl: avatarImageUrl.trim(),
    })
    onClose()
  }

  return (
    <div
      className="absolute inset-0 z-[1180] flex items-center justify-center px-3 py-[max(12px,env(safe-area-inset-bottom))]"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <ImageCropperModal
        open={!!avatarCropSrc}
        imageSrc={avatarCropSrc}
        title="裁剪头像"
        aspect={1}
        maxSide={1080}
        objectFit="horizontal-cover"
        onCancel={() => setAvatarCropSrc('')}
        onConfirm={async (dataUrl) => {
          const next = await compressAvatarDataUrl(dataUrl, MAX_DATA_URL_LEN)
          if (next.length > MAX_DATA_URL_LEN) {
            window.alert('图片过大，请选择较小的图片或使用 URL。')
            return
          }
          setAvatarImageUrl(next)
          setAvatarCropSrc('')
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[360px] rounded-[16px] border bg-white p-4 shadow-lg"
        style={{ borderColor: '#e5e5e5' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-center text-[16px] font-semibold" style={{ color: '#000' }}>
          编辑资料
        </h2>

        <div className="mt-4 flex flex-col items-center gap-2">
          <label className="relative block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
            <img
              src={previewSrc}
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 rounded-full border object-cover"
              style={{ borderColor: '#e5e5e5' }}
            />
            <span className="mt-1 block text-center text-[12px]" style={{ color: '#666' }}>
              点击更换头像
            </span>
          </label>
          <Pressable
            type="button"
            className="text-[12px]"
            style={{ color: '#888' }}
            onClick={() => setAvatarImageUrl('')}
          >
            清除头像
          </Pressable>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px]" style={{ color: '#666' }}>
            微信昵称
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            className="mt-1 w-full rounded-[10px] border px-3 py-2 text-[15px] outline-none"
            style={{ borderColor: '#e5e5e5', color: '#000' }}
            placeholder="昵称"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[12px]" style={{ color: '#666' }}>
            个性签名
          </span>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={120}
            rows={3}
            className="mt-1 w-full resize-none rounded-[10px] border px-3 py-2 text-[14px] outline-none"
            style={{ borderColor: '#e5e5e5', color: '#000' }}
            placeholder="一句话介绍自己"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <Pressable
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[10px] border py-2.5 text-[15px] font-medium"
            style={{ borderColor: '#e5e5e5', color: '#111', background: '#fff' }}
          >
            取消
          </Pressable>
          <Pressable
            type="button"
            onClick={save}
            className="flex-1 rounded-[10px] border py-2.5 text-[15px] font-semibold"
            style={{ borderColor: '#111', background: '#111', color: '#fff' }}
          >
            保存
          </Pressable>
        </div>
      </div>
    </div>
  )
}
