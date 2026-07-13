import { useMemo } from 'react'
import { ImageGenStyleTabSection } from '../../../../components/moments/ImageGenStyleTabSection'
import {
  resolveCharacterMediaImageStyleHint,
} from '../../../../components/moments/momentsImagePromptEnhancer'
import { useImageGenSettings } from '../../api/useImageGenSettings'
import { modelSupportsReferenceImageUploadFromSettings, describeReferenceImageSupportForModel } from '../../../../components/moments/imageGenModelCapabilities'
import { parseMomentsImageModelId } from '../../../../components/moments/momentsImageModelCatalog'

type Props = {
  className?: string
  /** @deprecated 仅保留布局兼容；有参考图时始终隐藏预设，无参考图时始终展示 */
  compact?: boolean
  hasAppearanceReference?: boolean
  /** 约会页等场景的柔和黑白样式 */
  variant?: 'default' | 'dating'
}

export function SharedImageGenStyleSection({
  className,
  compact: _compact,
  hasAppearanceReference = false,
  variant = 'default',
}: Props) {
  const { imageGen, patchImageGen, configured } = useImageGenSettings()
  const refUploadSupported = modelSupportsReferenceImageUploadFromSettings(imageGen)
  const useReferenceStyle = hasAppearanceReference && refUploadSupported
  const styleHint = useMemo(
    () => resolveCharacterMediaImageStyleHint(imageGen, hasAppearanceReference),
    [imageGen, hasAppearanceReference],
  )
  const refSupportNote = useMemo(() => {
    const { modelName } = parseMomentsImageModelId(imageGen.modelId)
    if (!modelName) return ''
    return describeReferenceImageSupportForModel(imageGen.provider, modelName)
  }, [imageGen])

  const isDating = variant === 'dating'
  const titleCls = isDating ? 'text-[14px] text-[#262626]' : 'text-[16px] text-black'
  const descCls = isDating
    ? 'mt-1 text-[12px] leading-relaxed text-[#8e8e8e]'
    : 'mt-1 text-[12px] leading-relaxed text-[#8e8e8e]'
  const cardCls = isDating
    ? 'mt-3 rounded-xl border border-stone-200/90 bg-[#fafafa] px-3 py-2.5'
    : 'mt-3 rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5'
  const labelCls = isDating ? 'text-[12px] text-[#8e8e8e]' : 'text-[12px] text-[#666]'
  const valueCls = isDating ? 'mt-0.5 text-[13px] text-[#262626]' : 'mt-0.5 text-[13px] text-[#333]'

  return (
    <div className={className ?? 'mt-4 border-t border-[#f0f0f0] pt-4'}>
      <p className={titleCls}>生图风格</p>
      <p className={descCls}>
        {useReferenceStyle
          ? '已设置形象参考图，且当前生图模型支持传参考图：配图将匹配参考图的画风、线条与色调，不再叠加预设风格前缀。'
          : hasAppearanceReference
            ? '已设置形象参考图，但当前模型不支持传图；请在下方选择预设或自定义风格。'
            : '未设置形象参考图时，可在此选择生图风格；与 API 预设、聊天配图、朋友圈配图全局同步。'}
        {!configured ? ' 请先在 API 设置中启用并配置生图引擎。' : ''}
      </p>
      {hasAppearanceReference && refSupportNote ? (
        <p className={`${descCls} mt-1`}>{refSupportNote}</p>
      ) : null}

      <div className={cardCls}>
        <p className={labelCls}>当前风格</p>
        <p className={valueCls}>{styleHint}</p>
      </div>

      {useReferenceStyle ? null : (
        <ImageGenStyleTabSection
          imageGen={imageGen}
          onPatch={patchImageGen}
          refUploadSupported={refUploadSupported}
          variant="compact"
        />
      )}
    </div>
  )
}
