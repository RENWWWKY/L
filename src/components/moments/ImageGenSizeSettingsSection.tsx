import { useEffect, useMemo } from 'react'
import { Check } from 'lucide-react'

import { parseMomentsImageModelId } from './momentsImageModelCatalog'
import {
  describeReferenceImageSupportForModel,
  modelSupportsReferenceImageUpload,
} from './imageGenModelCapabilities'
import {
  getSupportedImageSizes,
  type MomentsImageSizeOption,
} from './momentsImageSizePresets'
import { normalizeImageSizePoolIds, resolveImageGenDimensions } from './resolveImageGenDimensions'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

type Props = {
  imageGen: MomentsImageGenSettings
  onPatch: (patch: Partial<MomentsImageGenSettings>) => void
}

function SizeOptionButton({
  size,
  active,
  checked,
  onSelect,
  onTogglePool,
  showPoolToggle,
  poolToggleLabel = '纳入随机池',
}: {
  size: MomentsImageSizeOption
  active: boolean
  checked?: boolean
  onSelect: () => void
  onTogglePool?: () => void
  showPoolToggle?: boolean
  poolToggleLabel?: string
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-all ${
        active
          ? 'border-[#111827] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
          : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-[#111827]">{size.label}</span>
          {active ? <Check className="size-3.5 text-[#111827]" strokeWidth={2.5} /> : null}
        </div>
        {size.apiSize !== `${size.width}x${size.height}` ? (
          <span className="mt-0.5 block font-mono text-[10px] text-[#9CA3AF]">{size.apiSize}</span>
        ) : null}
      </button>
      {showPoolToggle ? (
        <label className="mt-2 flex items-center gap-2 border-t border-[#F3F4F6] pt-2 text-[11px] text-[#6B7280]">
          <input type="checkbox" checked={checked} onChange={onTogglePool} />
          {poolToggleLabel}
        </label>
      ) : null}
    </div>
  )
}

export function ImageGenSizeSettingsSection({ imageGen, onPatch }: Props) {
  const provider = imageGen.provider
  const { modelName } = parseMomentsImageModelId(imageGen.modelId)
  const supportedSizes = useMemo(
    () => getSupportedImageSizes(provider, modelName),
    [provider, modelName],
  )

  const sizeMode =
    imageGen.imageSizeMode === 'random'
      ? 'random'
      : imageGen.imageSizeMode === 'fixed'
        ? 'fixed'
        : 'scene'
  const poolIds = useMemo(
    () => normalizeImageSizePoolIds(imageGen.imageSizePoolIds, supportedSizes),
    [imageGen.imageSizePoolIds, supportedSizes],
  )

  useEffect(() => {
    if (!supportedSizes.length) return
    const validFixed = supportedSizes.some((s) => s.id === imageGen.imageSizeId)
    if (!validFixed && imageGen.imageSizeId) {
      onPatch({ imageSizeId: supportedSizes[0]?.id ?? '' })
    }
    const normalizedPool = normalizeImageSizePoolIds(imageGen.imageSizePoolIds, supportedSizes)
    if (
      imageGen.imageSizePoolIds?.length &&
      normalizedPool.join(',') !== imageGen.imageSizePoolIds.join(',')
    ) {
      onPatch({ imageSizePoolIds: normalizedPool })
    }
  }, [supportedSizes, imageGen.imageSizeId, imageGen.imageSizePoolIds, onPatch])

  const previewDims = useMemo(() => {
    if (sizeMode === 'scene') {
      return resolveImageGenDimensions(imageGen, {
        prompt: 'selfie shot, upper body, bedroom',
        context: 'character_media',
      })
    }
    return resolveImageGenDimensions(imageGen)
  }, [imageGen, sizeMode])

  const fixedSizeId = imageGen.imageSizeId?.trim() || supportedSizes[0]?.id || ''

  const selectFixedSize = (sizeId: string) => {
    onPatch({ imageSizeMode: 'fixed', imageSizeId: sizeId })
  }

  const switchSizeMode = (mode: 'scene' | 'fixed' | 'random') => {
    if (mode === 'fixed') {
      const nextId =
        imageGen.imageSizeId?.trim() ||
        (poolIds.length === 1 ? poolIds[0] : '') ||
        supportedSizes[0]?.id ||
        ''
      onPatch({
        imageSizeMode: 'fixed',
        ...(nextId ? { imageSizeId: nextId } : {}),
      })
      return
    }
    onPatch({ imageSizeMode: mode })
  }

  const refSupportText = useMemo(
    () => describeReferenceImageSupportForModel(provider, modelName),
    [provider, modelName],
  )
  const refSupported = modelSupportsReferenceImageUpload(provider, modelName)

  if (!modelName) {
    return (
      <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] text-[#9CA3AF]">
        请先在上方选择生图模型，再配置默认尺寸。
      </p>
    )
  }

  const togglePoolId = (id: string) => {
    const next = poolIds.includes(id) ? poolIds.filter((x) => x !== id) : [...poolIds, id]
    onPatch({ imageSizePoolIds: next.length ? next : supportedSizes.map((s) => s.id) })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
          参考图传图能力
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{refSupportText}</p>
      </div>

      <div>
        <p className="text-[11px] font-medium text-[#6B7280]">默认生图尺寸</p>
        <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
          角色聊天发图、朋友圈配图等将使用此处配置；仅显示当前模型支持的尺寸。
        </p>
        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {(
            [
              { id: 'scene' as const, label: '场景自适应' },
              { id: 'fixed' as const, label: '固定尺寸' },
              { id: 'random' as const, label: '随机尺寸' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => switchSizeMode(opt.id)}
              className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${
                sizeMode === opt.id ? 'bg-[#111827] text-white' : 'text-[#9CA3AF] hover:text-[#6B7280]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sizeMode === 'random' ? (
        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          随机模式：角色每次发图会从下方勾选的尺寸中随机选一档（勾选「纳入随机池」）。
        </p>
      ) : sizeMode === 'scene' ? (
        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          场景自适应（推荐）：按 prompt 推断竖/横/方，从下方<strong className="font-medium text-[#374151]">已纳入候选</strong>的尺寸里选最接近的一档。若要<strong className="font-medium text-[#374151]">始终固定</strong>某一档（如 640×640），请先切到「固定尺寸」再点选。
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          固定模式：角色发图始终使用下方高亮选中的尺寸（与 prompt 内容无关）。
        </p>
      )}

      {sizeMode === 'scene' ? (
        <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
          场景模式下点尺寸格子仅控制候选池（默认全选）；不会把某一档设为固定输出。
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {supportedSizes.map((size) => {
          const isFixedActive = sizeMode === 'fixed' && fixedSizeId === size.id
          const inPool = poolIds.includes(size.id)
          return (
            <SizeOptionButton
              key={size.id}
              size={size}
              active={isFixedActive}
              checked={inPool}
              showPoolToggle={sizeMode === 'random' || sizeMode === 'scene'}
              poolToggleLabel={sizeMode === 'scene' ? '纳入场景候选' : '纳入随机池'}
              onSelect={() => {
                if (sizeMode === 'fixed') selectFixedSize(size.id)
                else togglePoolId(size.id)
              }}
              onTogglePool={() => togglePoolId(size.id)}
            />
          )
        })}
      </div>

      <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white/60 px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
          当前生效示例
        </p>
        <p className="mt-1 text-[11px] text-[#6B7280]">
          {sizeMode === 'random'
            ? `随机池 ${poolIds.length} 档 · 示例：${previewDims.width}×${previewDims.height}`
            : sizeMode === 'scene'
              ? `场景示例（自拍竖图）≈ ${previewDims.width}×${previewDims.height} · 候选池 ${poolIds.length} 档`
              : `固定输出：${previewDims.width}×${previewDims.height}${previewDims.imageSize !== `${previewDims.width}x${previewDims.height}` ? `（API: ${previewDims.imageSize}）` : ''}`}
        </p>
        {!refSupported ? (
          <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
            参考图不会传至 API；发图尺寸与风格 Tab 预设仍正常生效。
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function ImageGenReferenceSupportHint({ imageGen }: { imageGen: MomentsImageGenSettings }) {
  const { modelName } = parseMomentsImageModelId(imageGen.modelId)
  if (!modelName) return null
  return (
    <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
      {describeReferenceImageSupportForModel(imageGen.provider, modelName)}
    </p>
  )
}
