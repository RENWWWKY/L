import { useMemo } from 'react'
import { MomentsImageGenSettingsPanel } from '../../../../components/moments/MomentsImageGenSettingsPanel'
import type { MomentsImageProvider } from '../../../../components/moments/momentsImageModelCatalog'
import {
  getDefaultModelIdForProvider,
  inferMomentsImageProviderFromModelId,
} from '../../../../components/moments/momentsImageModelCatalog'
import {
  MOMENTS_IMAGE_PROVIDER_LIST,
  getImageGenProviderMeta,
} from '../../../../components/moments/momentsImageProviderRegistry'
import { resolveImageStyleHint } from '../../../../components/moments/momentsImagePromptEnhancer'
import type { MomentsImageGenSettings } from '../../../../components/moments/useMomentsSettingsStore'
import { apiTheme } from '../theme'
import { ToggleSwitch } from './ToggleSwitch'

const IMAGE_PROVIDERS = MOMENTS_IMAGE_PROVIDER_LIST

type Props = {
  imageGen: MomentsImageGenSettings
  onPatch: (patch: Partial<MomentsImageGenSettings>) => void
}

export function ApiPresetImageGenSection({ imageGen, onPatch }: Props) {
  const provider = imageGen.provider
  const styleHint = useMemo(() => resolveImageStyleHint(imageGen), [imageGen])
  const providerMeta = useMemo(() => getImageGenProviderMeta(provider), [provider])

  const switchProvider = (next: MomentsImageProvider) => {
    if (next === provider) return
    onPatch({
      provider: next,
      modelId:
        inferMomentsImageProviderFromModelId(imageGen.modelId) === next
          ? imageGen.modelId
          : getDefaultModelIdForProvider(next),
    })
  }

  return (
    <>
      <section className="mx-4 mt-4 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
        <p className="text-[14px] font-medium" style={{ color: apiTheme.text }}>
          生图 API
        </p>
        <p className="mt-1 text-[12px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
          供朋友圈配图与聊天室角色 `[图片]` 发图共用；风格由客户端自动拼接。
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-medium" style={{ color: apiTheme.text }}>
              启用生图
            </p>
            <p className="mt-1 text-[12px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
              关闭后朋友圈与聊天室均不会调用生图 API
            </p>
          </div>
          <ToggleSwitch checked={imageGen.enabled} onChange={(v) => onPatch({ enabled: v })} />
        </div>
      </section>

      {imageGen.enabled ? (
        <section className="mx-4 mt-4 rounded-2xl bg-white px-5 py-4" style={{ boxShadow: apiTheme.shadow }}>
          <p className="text-[14px] font-medium" style={{ color: apiTheme.text }}>
            当前生图风格
          </p>
          <p className="mt-1 text-[13px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
            {styleHint} · 模型 `[图片]` 输出只需写画面内容
          </p>
        </section>
      ) : null}

      <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-white" style={{ boxShadow: apiTheme.shadow }}>
        <div className="border-b px-2 pt-2" style={{ borderColor: apiTheme.border }}>
          <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-1 rounded-xl bg-[#F9FAFB] p-1">
              {IMAGE_PROVIDERS.map((opt) => {
                const active = provider === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => switchProvider(opt.id)}
                    className="min-w-[88px] shrink-0 rounded-lg px-2 py-2 text-center text-[12px] font-medium transition-colors"
                    style={{
                      background: active ? '#fff' : 'transparent',
                      color: active ? apiTheme.text : apiTheme.subText,
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {imageGen.enabled && providerMeta.keyUrl ? (
          <p
            className="border-b px-4 py-2.5 text-[12px]"
            style={{ borderColor: apiTheme.border, color: apiTheme.subText }}
          >
            API Key 获取：{' '}
            <a
              href={providerMeta.keyUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: apiTheme.accent, textDecoration: 'underline' }}
            >
              {providerMeta.keyLinkLabel}
            </a>
          </p>
        ) : null}

        {imageGen.enabled ? (
          <div className="p-4 pt-0">
            <MomentsImageGenSettingsPanel
              imageGen={imageGen}
              onPatch={onPatch}
              hideProviderTabs
              embedded
              settingsContext="api"
            />
          </div>
        ) : (
          <p className="p-5 text-[13px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
            开启「启用生图」后可配置引擎、模型、风格、提示词与预览。
          </p>
        )}
      </div>
    </>
  )
}
