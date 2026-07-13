import { Check } from 'lucide-react'
import { useMemo } from 'react'

import type { ImageGenStyleMode } from './imageGenStyleMode'
import { POLLINATIONS_STYLE_PRESETS, resolveStylePrefix } from './pollinationsPresets'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

type Props = {
  imageGen: MomentsImageGenSettings
  onPatch: (patch: Partial<MomentsImageGenSettings>) => void
  /** 是否支持参考图传参（影响「跟随参考形象图」说明） */
  refUploadSupported?: boolean
  intro?: string
  variant?: 'panel' | 'compact'
}

const STYLE_MODE_OPTIONS: { id: ImageGenStyleMode; label: string; compactLabel?: string }[] = [
  { id: 'preset', label: '预设风格', compactLabel: '预设风格' },
  { id: 'custom', label: '自定义', compactLabel: '自定义前缀' },
]

export function ImageGenStyleTabSection({
  imageGen,
  onPatch,
  refUploadSupported = false,
  intro,
  variant = 'panel',
}: Props) {
  const mode = imageGen.stylePrefixMode
  const activeStylePrefix = useMemo(() => resolveStylePrefix(imageGen), [imageGen])

  const isPanel = variant === 'panel'
  const modePillActive = isPanel ? 'bg-[#111827] text-white' : 'bg-[#576b95] text-white'
  const modePillIdle = isPanel ? 'text-[#9CA3AF] hover:text-[#6B7280]' : 'bg-[#f5f5f5] text-[#666]'
  const presetActive = isPanel
    ? 'border-[#111827] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
    : 'bg-[#576b95] text-white'
  const presetIdle = isPanel
    ? 'border-transparent bg-white/70 hover:bg-white'
    : 'bg-[#f5f5f5] text-[#666]'

  return (
    <div className="space-y-4">
      {intro ? <p className="text-[12px] leading-relaxed text-[#6B7280]">{intro}</p> : null}

      <section className="space-y-3">
        <div>
          <p className="text-[13px] font-medium text-[#111827]">生图风格</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#9CA3AF]">
            预设与自定义前缀二选一；模型输出的 `[图片]` 行里不要写风格词。
          </p>
        </div>

        <div className={isPanel ? 'inline-flex rounded-full bg-white p-1 shadow-sm' : 'mt-1.5 flex flex-wrap gap-1.5'}>
          {STYLE_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPatch({ stylePrefixMode: opt.id })}
              className={
                isPanel
                  ? `rounded-full px-4 py-1.5 text-[13px] transition-colors ${
                      mode === opt.id ? modePillActive : modePillIdle
                    }`
                  : `rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                      mode === opt.id ? modePillActive : modePillIdle
                    }`
              }
            >
              {isPanel ? opt.label : opt.compactLabel ?? opt.label}
            </button>
          ))}
        </div>

        {mode === 'preset' ? (
          <div className={isPanel ? 'grid grid-cols-2 gap-2' : 'mt-3 flex flex-wrap gap-1.5'}>
            {POLLINATIONS_STYLE_PRESETS.map((style) => {
              const active = imageGen.stylePresetId === style.id
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => onPatch({ stylePresetId: style.id })}
                  className={
                    isPanel
                      ? `rounded-xl border px-3 py-3 text-left transition-all ${
                          active ? presetActive : presetIdle
                        }`
                      : `rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                          active ? presetActive : presetIdle
                        }`
                  }
                >
                  {isPanel ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-[#111827]">{style.labelZh}</span>
                        {active ? <Check className="size-3.5 text-[#111827]" strokeWidth={2.5} /> : null}
                      </div>
                      <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF]">
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
        ) : (
          <div>
            <textarea
              value={imageGen.customStylePrefix}
              onChange={(e) => onPatch({ customStylePrefix: e.target.value })}
              placeholder="例如：soft lighting, detailed background, warm color palette,"
              rows={isPanel ? 4 : 3}
              className={
                isPanel
                  ? 'w-full resize-none rounded-xl border border-white bg-white px-4 py-3 text-[14px] text-[#111827] outline-none transition-colors focus:ring-2 focus:ring-[#111827]/10'
                  : 'mt-3 w-full resize-none rounded-[10px] border border-[#e5e5e5] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#333] outline-none placeholder:text-[#c7c7cc] focus:border-[#576b95]'
              }
            />
            <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
              自定义英文风格提示词，建议以 comma 结尾；仅拼接到 API 请求。
            </p>
          </div>
        )}

        {activeStylePrefix ? (
          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
              当前风格前缀（API 自动拼接）
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{activeStylePrefix}</p>
          </div>
        ) : mode === 'preset' && imageGen.stylePresetId === 'reference_match' ? (
          <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] leading-relaxed text-[#6B7280]">
            {refUploadSupported
              ? '已选「跟随参考形象图」：角色配置了形象参考且当前模型支持传图时，将匹配参考图画风。'
              : '已选「跟随参考形象图」，但当前模型不支持传参考图；请改用支持传图的模型，或改选其他预设。'}
          </p>
        ) : mode === 'custom' && !imageGen.customStylePrefix.trim() ? (
          <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] text-[#9CA3AF]">
            自定义前缀为空时，等同于「无风格」。
          </p>
        ) : null}
      </section>
    </div>
  )
}
