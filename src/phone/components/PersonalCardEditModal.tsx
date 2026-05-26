import { useEffect, useId, useMemo, useState } from 'react'

import { canonicalPublicImagePath } from '../../publicAssetUrl'
import { compressAvatarDataUrl, MAX_AVATAR_DATA_URL_LEN } from '../apps/wechat/avatarCompress'
import { ImageCropperModal } from './ImageCropperModal'
import { Pressable } from './Pressable'
import type { Profile } from '../types'
import {
  DEFAULT_PERSONAL_CARD_BG_PATH,
  DEFAULT_PUBLIC_AVATAR_PATH,
} from '../types'
import { normalizeProfileAvatarForSave, resolveProfileAvatarPreviewUrl } from '../utils/characterAvatarUrl'
import {
  normalizePersonalCardBackgroundForSave,
  resolvePersonalCardBackgroundUrl,
} from '../utils/personalCardAssets'

const MAX_CARD_BG_DATA_URL_LEN = 650_000

type Props = {
  open: boolean
  onClose: () => void
  profile: Profile
  backgroundUrl: string
  onSave: (patch: {
    profile: Partial<Profile>
    backgroundUrl: string
  }) => void
}

export function PersonalCardEditModal({
  open,
  onClose,
  profile,
  backgroundUrl,
  onSave,
}: Props) {
  const titleId = useId()
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [signature, setSignature] = useState(profile.signature)
  const [avatarImageUrl, setAvatarImageUrl] = useState(profile.avatarImageUrl)
  const [bgUrl, setBgUrl] = useState(backgroundUrl)
  const [bgUrlDraft, setBgUrlDraft] = useState('')
  const [avatarCropSrc, setAvatarCropSrc] = useState('')
  const [bgCropSrc, setBgCropSrc] = useState('')

  useEffect(() => {
    if (!open) return
    setDisplayName(profile.displayName)
    setSignature(profile.signature)
    setAvatarImageUrl(profile.avatarImageUrl)
    setBgUrl(backgroundUrl)
    setBgUrlDraft('')
    setAvatarCropSrc('')
    setBgCropSrc('')
  }, [open, profile, backgroundUrl])

  const avatarPreview = useMemo(
    () => resolveProfileAvatarPreviewUrl(avatarImageUrl),
    [avatarImageUrl],
  )
  const bgPreview = useMemo(() => resolvePersonalCardBackgroundUrl(bgUrl), [bgUrl])

  if (!open) return null

  const onPickAvatar = (file: File | null) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) setAvatarCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const onPickBackground = (file: File | null) => {
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src) setBgCropSrc(src)
    }
    reader.readAsDataURL(file)
  }

  const applyBgUrlDraft = () => {
    const next = bgUrlDraft.trim()
    if (!next) return
    setBgUrl(canonicalPublicImagePath(next) || next)
    setBgUrlDraft('')
  }

  const save = () => {
    onSave({
      profile: {
        displayName: displayName.trim() || profile.displayName,
        signature: signature.trim(),
        avatarImageUrl: normalizeProfileAvatarForSave(avatarImageUrl),
      },
      backgroundUrl: normalizePersonalCardBackgroundForSave(bgUrl),
    })
    onClose()
  }

  return (
    <div
      className="absolute inset-0 z-[1180] flex items-end justify-center sm:items-center"
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
          const next = await compressAvatarDataUrl(dataUrl, MAX_AVATAR_DATA_URL_LEN)
          if (next.length > MAX_AVATAR_DATA_URL_LEN) {
            window.alert('头像图片过大，请换一张较小的图片。')
            return
          }
          setAvatarImageUrl(next)
          setAvatarCropSrc('')
        }}
      />
      <ImageCropperModal
        open={!!bgCropSrc}
        imageSrc={bgCropSrc}
        title="裁剪背景图"
        aspect={2}
        maxSide={1600}
        objectFit="horizontal-cover"
        onCancel={() => setBgCropSrc('')}
        onConfirm={async (dataUrl) => {
          const next = await compressAvatarDataUrl(dataUrl, MAX_CARD_BG_DATA_URL_LEN)
          if (next.length > MAX_CARD_BG_DATA_URL_LEN) {
            window.alert('背景图过大，请换一张较小的图片。')
            return
          }
          setBgUrl(next)
          setBgCropSrc('')
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(88vh,640px)] w-full max-w-[400px] overflow-y-auto rounded-t-[18px] border bg-white p-4 shadow-lg sm:rounded-[16px]"
        style={{ borderColor: '#e5e5e5' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-center text-[16px] font-semibold text-[#111]">
          编辑桌面个人名片
        </h2>
        <p className="mt-1 text-center text-[11px] text-[#888]">
          与微信资料独立 · 仅影响主屏名片
        </p>

        <div className="mt-4">
          <p className="text-[12px] text-[#666]">背景图预览</p>
          <div
            className="mt-2 h-24 w-full overflow-hidden rounded-[12px] border"
            style={{
              borderColor: '#e5e5e5',
              backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.2) 100%), url(${JSON.stringify(bgPreview)})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          />
          <label className="mt-2 block">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPickBackground(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
            <span className="flex w-full items-center justify-center rounded-[10px] border border-[#e5e5e5] py-2 text-[12px] text-[#333]">
              本地上传背景
            </span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              value={bgUrlDraft}
              onChange={(e) => setBgUrlDraft(e.target.value)}
              placeholder="背景图 URL（http/https）"
              className="min-w-0 flex-1 rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[13px] outline-none"
            />
            <Pressable
              type="button"
              className="shrink-0 rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[12px]"
              onClick={applyBgUrlDraft}
            >
              应用
            </Pressable>
          </div>
          <Pressable
            type="button"
            className="mt-2 w-full text-center text-[11px] text-[#888]"
            onClick={() => setBgUrl(DEFAULT_PERSONAL_CARD_BG_PATH)}
          >
            恢复默认背景
          </Pressable>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          <label className="relative block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPickAvatar(e.target.files?.[0] ?? null)
                e.currentTarget.value = ''
              }}
            />
            <img
              src={avatarPreview}
              alt=""
              className="size-20 rounded-full border border-[#e5e5e5] object-cover"
            />
            <span className="mt-1 block text-center text-[12px] text-[#666]">点击更换头像</span>
          </label>
          <Pressable
            type="button"
            className="text-[11px] text-[#888]"
            onClick={() => setAvatarImageUrl(DEFAULT_PUBLIC_AVATAR_PATH)}
          >
            恢复默认头像
          </Pressable>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] text-[#666]">昵称</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            className="mt-1 w-full rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[15px] outline-none"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-[12px] text-[#666]">个性签名</span>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={120}
            rows={3}
            className="mt-1 w-full resize-none rounded-[10px] border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none"
            placeholder="桌面名片上显示的签名"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <Pressable
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[10px] border border-[#e5e5e5] py-2.5 text-[15px]"
          >
            取消
          </Pressable>
          <Pressable
            type="button"
            onClick={save}
            className="flex-1 rounded-[10px] border border-[#111] bg-[#111] py-2.5 text-[15px] font-semibold text-white"
          >
            保存
          </Pressable>
        </div>
      </div>
    </div>
  )
}
