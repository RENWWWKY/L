import { useMemo } from 'react'
import { POLLINATIONS_STYLE_PRESETS } from '../../../../components/moments/pollinationsPresets'
import {
  resolveCharacterMediaImageStyleHint,
  resolveImageStyleHint,
} from '../../../../components/moments/momentsImagePromptEnhancer'
import { useImageGenSettings } from '../../api/useImageGenSettings'

/** 无参考图时可选的预设（「跟随参考形象图」在有参考图时自动生效，无需手动选） */
const SELECTABLE_STYLE_PRESETS = POLLINATIONS_STYLE_PRESETS.filter(
  (style) => style.id !== 'reference_match',
)

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
  const styleHint = useMemo(
    () => resolveCharacterMediaImageStyleHint(imageGen, hasAppearanceReference),
    [imageGen, hasAppearanceReference],
  )

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
  const pillActiveCls = isDating
    ? 'bg-[#262626] text-white'
    : 'bg-[#576b95] text-white'
  const pillIdleCls = isDating
    ? 'bg-stone-100 text-[#666]'
    : 'bg-[#f5f5f5] text-[#666]'
  const presetActiveCls = isDating
    ? 'border-stone-400 bg-white text-[#262626] shadow-sm'
    : 'bg-[#576b95] text-white'
  const presetIdleCls = isDating
    ? 'border-stone-200/90 bg-stone-50 text-[#666]'
    : 'bg-[#f5f5f5] text-[#666]'
  const inputCls = isDating
    ? 'mt-3 w-full resize-none rounded-xl border border-stone-200/90 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#262626] outline-none placeholder:text-[#c7c7cc] focus:border-stone-400'
    : 'mt-3 w-full resize-none rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#333] outline-none placeholder:text-[#c7c7cc] focus:border-[#576b95]'

  return (
    <div className={className ?? 'mt-4 border-t border-[#f0f0f0] pt-4'}>
      <p className={titleCls}>生图风格</p>
      <p className={descCls}>
        {hasAppearanceReference
          ? '已设置形象参考图，配图将自动匹配参考图的画风、线条与色调，不再叠加预设风格前缀。'
          : '未设置形象参考图时，可在此选择生图风格；与 API 预设、聊天配图、朋友圈配图全局同步。'}
        {!configured ? ' 请先在 API 设置中启用并配置生图引擎。' : ''}
      </p>

      <div className={cardCls}>
        <p className={labelCls}>当前风格</p>
        <p className={valueCls}>{styleHint}</p>
      </div>

      {hasAppearanceReference ? null : (
        <>
          <div className="mt-3">
            <p className={labelCls}>风格模式</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'preset' as const, label: '预设风格' },
                  { id: 'custom' as const, label: '自定义前缀' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchImageGen({ stylePrefixMode: opt.id })}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    imageGen.stylePrefixMode === opt.id ? pillActiveCls : pillIdleCls
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {imageGen.stylePrefixMode === 'preset' ? (
            <div className={`mt-3 ${isDating ? '' : 'max-h-[180px] overflow-y-auto'}`}>
              <div className={`flex flex-wrap gap-1.5 ${isDating ? 'grid grid-cols-2 gap-2' : ''}`}>
                {SELECTABLE_STYLE_PRESETS.map((style) => {
                  const active = imageGen.stylePresetId === style.id
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => patchImageGen({ stylePresetId: style.id })}
                      className={
                        isDating
                          ? `rounded-xl border px-3 py-2.5 text-left text-[12px] transition-colors ${
                              active ? presetActiveCls : presetIdleCls
                            }`
                          : `rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                              active ? presetActiveCls : presetIdleCls
                            }`
                      }
                    >
                      {isDating ? (
                        <>
                          <span className="block font-medium">{style.labelZh}</span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide opacity-60">
                            {style.labelEn}
                          </span>
                        </>
                      ) : (
                        style.labelZh
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <textarea
              value={imageGen.customStylePrefix}
              onChange={(e) => patchImageGen({ customStylePrefix: e.target.value })}
              rows={3}
              placeholder="输入自定义风格前缀，如 anime illustration, soft lighting…"
              className={inputCls}
            />
          )}

          {imageGen.stylePrefixMode === 'preset' && imageGen.stylePresetId === 'reference_match' ? (
            <p className={`${descCls} mt-2`}>
              全局预设为「跟随参考形象图」；上传参考图后会自动生效，无需再选手动风格。
            </p>
          ) : imageGen.stylePrefixMode === 'custom' && !imageGen.customStylePrefix.trim() ? (
            <p className={`${descCls} mt-2`}>自定义前缀为空时，等同于「无风格」。</p>
          ) : imageGen.stylePrefixMode === 'preset' ? (
            <p className={`${descCls} mt-2`}>
              已选「{resolveImageStyleHint(imageGen)}」：模型只需写画面内容，风格由客户端自动拼接。
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
