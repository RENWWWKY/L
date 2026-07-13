import { useMemo, useState } from 'react'

import { parseMomentsImageModelId } from './momentsImageModelCatalog'
import {
  getImageGenPromptFieldMetas,
  normalizeImageGenProviderPromptSettings,
  patchProviderPromptSettings,
  readProviderPromptValue,
  resolveCommonExtraPositivePrompt,
  resolveImageGenModelPromptProfile,
  resolveImageGenNegativePromptFieldPath,
  resolveProviderPromptSettings,
  type ImageGenPromptFieldMeta,
} from './imageGenProviderPromptSettings'
import {
  removeUserImageGenPromptPreset,
  upsertUserImageGenPromptPreset,
  type UserImageGenPromptPreset,
} from './userImageGenPromptPresets'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

type Props = {
  imageGen: MomentsImageGenSettings
  onPatch: (patch: Partial<MomentsImageGenSettings>) => void
}

function PromptField({
  field,
  value,
  onChange,
}: {
  field: ImageGenPromptFieldMeta
  value: string | number | boolean
  onChange: (value: string | number | boolean) => void
}) {
  if (field.type === 'toggle') {
    const checked = Boolean(value)
    return (
      <label className="flex items-start justify-between gap-3 rounded-xl bg-white px-3.5 py-3">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-[#111827]">{field.label}</span>
          {field.description ? (
            <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">{field.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            checked ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        <span className="text-[11px] font-medium text-[#6B7280]">{field.label}</span>
        {field.description ? (
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{field.description}</p>
        ) : null}
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'number') {
    return (
      <label className="block">
        <span className="text-[11px] font-medium text-[#6B7280]">{field.label}</span>
        {field.description ? (
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{field.description}</p>
        ) : null}
        <input
          type="number"
          value={typeof value === 'number' ? value : Number(value) || 0}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1.5 w-full rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
        />
      </label>
    )
  }

  const isTextarea = field.type === 'textarea'
  const Input = isTextarea ? 'textarea' : 'input'
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[#6B7280]">{field.label}</span>
      {field.description ? (
        <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{field.description}</p>
      ) : null}
      <Input
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        rows={isTextarea ? 3 : undefined}
        placeholder={isTextarea ? '英文逗号分隔标签…' : undefined}
        className="mt-1.5 w-full resize-none rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
      />
    </label>
  )
}

function ImageGenPromptPresetPanel({
  positive,
  negative,
  savedPresets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: {
  positive: string
  negative: string
  savedPresets: UserImageGenPromptPreset[]
  onApplyPreset: (positive: string, negative: string) => void
  onSavePreset: (label: string, positive: string, negative: string) => void
  onDeletePreset: (id: string) => void
}) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const canSave = !!(positive.trim() || negative.trim())

  const openSave = () => {
    setSaveLabel(positive.trim().slice(0, 24) || negative.trim().slice(0, 24))
    setSaveOpen(true)
  }

  const confirmSave = () => {
    if (!canSave) return
    onSavePreset(saveLabel.trim() || '未命名预设', positive, negative)
    setSaveOpen(false)
    setSaveLabel('')
  }

  return (
    <div className="border-t border-[#F3F4F6] pt-3">
      <p className="text-[11px] font-medium text-[#6B7280]">我的提示词预设</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-[#9CA3AF]">
        保存当前正面 + 负面提示词为一组；点击预设将同时填入两项。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canSave ? (
          <button
            type="button"
            onClick={() => (saveOpen ? confirmSave() : openSave())}
            className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F9FAFB]"
          >
            {saveOpen ? '确认保存' : '保存为预设'}
          </button>
        ) : null}
        {saveOpen ? (
          <>
            <input
              type="text"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              placeholder="预设名称"
              maxLength={32}
              className="min-w-[120px] flex-1 rounded-lg border border-[#F3F4F6] bg-white px-2.5 py-1 text-[12px] text-[#111827] outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSave()
                if (e.key === 'Escape') setSaveOpen(false)
              }}
            />
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280]"
            >
              取消
            </button>
          </>
        ) : null}
      </div>
      {savedPresets.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {savedPresets.map((preset) => (
            <span key={preset.id} className="inline-flex max-w-full items-center gap-0.5">
              <button
                type="button"
                title={`正面: ${preset.positive || '（空）'}\n负面: ${preset.negative || '（空）'}`}
                onClick={() => onApplyPreset(preset.positive, preset.negative)}
                className="max-w-[min(100%,220px)] truncate rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                {preset.label}
              </button>
              <button
                type="button"
                aria-label={`删除预设 ${preset.label}`}
                onClick={() => onDeletePreset(preset.id)}
                className="rounded-full px-1 text-[12px] leading-none text-[#9CA3AF] hover:text-[#EF4444]"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-[#9CA3AF]">暂无预设；填写正/负面提示词后可保存。</p>
      )}
    </div>
  )
}

export function ImageGenPromptSettingsSection({ imageGen, onPatch }: Props) {
  const provider = imageGen.provider
  const { modelName } = parseMomentsImageModelId(imageGen.modelId)
  const modelProfile = useMemo(
    () => resolveImageGenModelPromptProfile(provider, modelName),
    [provider, modelName],
  )

  const promptSettings = useMemo(
    () => resolveProviderPromptSettings(imageGen, provider),
    [imageGen, provider],
  )

  const fieldMetas = useMemo(
    () => getImageGenPromptFieldMetas(provider, modelName),
    [provider, modelName],
  )

  const negativeFieldPath = useMemo(
    () => resolveImageGenNegativePromptFieldPath(provider, modelName),
    [provider, modelName],
  )

  const negativeFieldMeta = useMemo(
    () => fieldMetas.find((f) => f.id.endsWith('.negativePrompt')) ?? null,
    [fieldMetas],
  )

  const positivePromptValue = useMemo(
    () => resolveCommonExtraPositivePrompt(promptSettings.common),
    [promptSettings.common],
  )

  const negativePromptValue = negativeFieldPath
    ? String(readProviderPromptValue(promptSettings, negativeFieldPath) ?? '')
    : ''

  const savedPresets = imageGen.savedImageGenPromptPresets ?? []

  const patchField = (path: string, value: string | number | boolean) => {
    onPatch({
      providerPromptSettings: patchProviderPromptSettings(imageGen.providerPromptSettings, path, value),
    })
  }

  const applyPromptPreset = (positive: string, negative: string) => {
    const nextSettings = patchProviderPromptSettings(
      imageGen.providerPromptSettings,
      'common.extraPositivePrompt',
      positive,
    )
    onPatch({
      providerPromptSettings: negativeFieldPath
        ? patchProviderPromptSettings(nextSettings, negativeFieldPath, negative)
        : nextSettings,
    })
  }

  const modelParamFields = fieldMetas.filter((f) => !f.id.endsWith('.negativePrompt'))

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-[#6B7280]">
        采样参数与正/负面提示词在此配置；画师串等风格词直接写在正面提示词即可。「风格」Tab 负责预设/自定义前缀。
      </p>

      {modelName ? (
        <div className="rounded-xl bg-white px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
            当前模型
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#111827]">{modelProfile.label}</p>
        </div>
      ) : (
        <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] text-[#9CA3AF]">
          请先在「模型」Tab 选择生图模型，此处将显示该模型支持的参数。
        </p>
      )}

      {modelParamFields.length ? (
        <div className="space-y-3 rounded-xl border border-[#F3F4F6] bg-[#FAFAFA]/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
            模型参数
          </p>
          <div className="space-y-3">
            {modelParamFields.map((field) => (
              <PromptField
                key={field.id}
                field={field}
                value={readProviderPromptValue(promptSettings, field.id)}
                onChange={(value) => patchField(field.id, value)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-[#F3F4F6] bg-[#FAFAFA]/60 p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
          提示词
        </p>

        <label className="block">
          <span className="text-[11px] font-medium text-[#6B7280]">正面提示词</span>
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
            拼接到主画面描述前，与「风格」Tab 预设/自定义前缀叠加；NovelAI 画师串也写在这里。
          </p>
          <textarea
            value={positivePromptValue}
            onChange={(e) => patchField('common.extraPositivePrompt', e.target.value)}
            rows={4}
            placeholder="英文逗号分隔，如 manhwa, webtoon, semi-realistic, masterpiece"
            className="mt-1.5 w-full resize-none rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
          />
        </label>

        {negativeFieldPath ? (
          <label className="block border-t border-[#F3F4F6] pt-3">
            <span className="text-[11px] font-medium text-[#6B7280]">负面提示词</span>
            <textarea
              value={negativePromptValue}
              onChange={(e) => patchField(negativeFieldPath, e.target.value)}
              rows={4}
              placeholder="英文逗号分隔标签…"
              className="mt-1.5 w-full resize-none rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
            />
            {negativeFieldMeta?.description ? (
              <p className="mt-1 text-[10px] leading-relaxed text-[#9CA3AF]">
                {negativeFieldMeta.description}
              </p>
            ) : null}
            {modelProfile.supportsNegative ? (
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#9CA3AF]">
                留空则不注入负面词；填写后写入接口的 negative_prompt / uc 字段，不会拼进正面提示词。
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#9CA3AF]">
                当前模型接口可能不支持提交负面词，此处内容仅作记录与备注。
              </p>
            )}
          </label>
        ) : modelName ? (
          <p className="border-t border-[#F3F4F6] pt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
            当前模型无负面提示词配置项。
          </p>
        ) : null}

        <ImageGenPromptPresetPanel
          positive={positivePromptValue}
          negative={negativePromptValue}
          savedPresets={savedPresets}
          onApplyPreset={applyPromptPreset}
          onSavePreset={(label, positive, negative) =>
            onPatch({
              savedImageGenPromptPresets: upsertUserImageGenPromptPreset(savedPresets, {
                label,
                positive,
                negative,
              }),
            })
          }
          onDeletePreset={(id) =>
            onPatch({
              savedImageGenPromptPresets: removeUserImageGenPromptPreset(savedPresets, id),
            })
          }
        />
      </div>
    </div>
  )
}

export function normalizeImageGenSettingsProviderPrompt(
  settings: MomentsImageGenSettings,
): MomentsImageGenSettings {
  return {
    ...settings,
    providerPromptSettings: normalizeImageGenProviderPromptSettings(settings.providerPromptSettings),
  }
}
