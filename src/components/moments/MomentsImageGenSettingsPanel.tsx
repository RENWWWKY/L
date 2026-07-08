import { AnimatePresence, motion } from 'framer-motion'
import { Check, Eye, EyeOff, ImageIcon, Loader2, RefreshCw, Search, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { InlineDropdown } from '../../phone/apps/wechat/newFriendsPersona/InlineDropdown'
import { MemoryModelIdText } from '../../phone/apps/wechat/memory/MemoryModelIdText'
import {
  fetchMomentsImageModelCatalog,
  findMomentsImageModel,
  getCachedModelsForProvider,
  getDefaultModelIdForProvider,
  inferMomentsImageProviderFromModelId,
  isKnownMomentsImageModelId,
  parseMomentsImageModelId,
  replaceCachedModelsForProvider,
  type MomentsImageModelOption,
  type MomentsImageProvider,
} from './momentsImageModelCatalog'
import { isGeminiNativeImageModel } from './geminiImageCatalog'
import { generateMomentsImage } from './momentsImageGen'
import {
  getSupportedImageSizes,
  pickDefaultImageSize,
  type MomentsImageSizeOption,
} from './momentsImageSizePresets'
import { POLLINATIONS_STYLE_PRESETS, resolveStylePrefix } from './pollinationsPresets'
import {
  isVolcengineModelNotActivatedError,
  VOLCENGINE_ARK_OPEN_MANAGEMENT_URL,
} from './volcengineImageCatalog'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'
import {
  buildFetchCatalogOptions,
  getImageGenApiKey,
  getImageGenApiKeyField,
  getImageGenProviderMeta,
  MOMENTS_IMAGE_PROVIDER_LIST,
} from './momentsImageProviderRegistry'

const DEFAULT_PREVIEW_PROMPT = '夕阳下的湖边小路，宁静治愈'

type ImageGenTab = 'model' | 'prefix' | 'preview'

const IMAGE_GEN_TABS: { id: ImageGenTab; label: string }[] = [
  { id: 'model', label: '模型' },
  { id: 'prefix', label: '风格' },
  { id: 'preview', label: '生图预览' },
]

const IMAGE_PROVIDERS = MOMENTS_IMAGE_PROVIDER_LIST

const API_KEY_PLACEHOLDERS: Record<MomentsImageProvider, string> = {
  novelai: 'pst-...',
  gemini: 'AIza...',
  openai: 'sk-...',
  siliconflow: 'sk-...',
  qianfan: 'bce-v3/ALTAK-...',
  volcengine: 'ark-...',
  custom: 'sk-...',
}

function ImageGenProviderCredentialsFields({
  provider,
  imageGen,
  onPatch,
}: {
  provider: MomentsImageProvider
  imageGen: MomentsImageGenSettings
  onPatch: (patch: Partial<MomentsImageGenSettings>) => void
}) {
  const meta = getImageGenProviderMeta(provider)
  const field = getImageGenApiKeyField(provider)
  const [visible, setVisible] = useState(false)

  if (provider === 'custom') {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-medium text-[#6B7280]">API URL</span>
          <input
            type="url"
            value={imageGen.customApiUrl}
            onChange={(e) => onPatch({ customApiUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
            className="mt-1.5 w-full rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
            autoComplete="off"
          />
          <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
            填写 OpenAI 兼容接口根地址（通常到 <span className="font-mono">/v1</span>），将自动请求{' '}
            <span className="font-mono">/models</span> 与 <span className="font-mono">/images/generations</span>
            。若拉取失败，请确认与聊天 API 使用相同根地址，且该地址在浏览器中可访问（部分中转站有 CORS 限制）。
          </p>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-[#6B7280]">API Key</span>
          <div className="relative mt-1.5">
            <input
              type={visible ? 'text' : 'password'}
              value={imageGen.customApiKey}
              onChange={(e) => onPatch({ customApiKey: e.target.value })}
              placeholder={API_KEY_PLACEHOLDERS.custom}
              className="w-full rounded-xl border border-[#F3F4F6] bg-white py-2.5 pl-3 pr-10 text-[13px] text-[#111827] outline-none"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              aria-label={visible ? '隐藏密钥' : '显示密钥'}
            >
              {visible ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-[#6B7280]">手动补充模型 ID（可选）</span>
          <input
            type="text"
            value={imageGen.customManualModelIds}
            onChange={(e) => onPatch({ customManualModelIds: e.target.value })}
            placeholder="gpt-image-1, dall-e-3, gemini-2.5-flash-image"
            className="mt-1.5 w-full rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-[13px] text-[#111827] outline-none"
            autoComplete="off"
          />
          <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
            许多中转站 <span className="font-mono">/models</span> 只返回聊天模型，不会列出文生图模型。请在此填写中转站后台实际模型名（多个用逗号分隔），拉取后会并入列表。
          </p>
        </label>
      </div>
    )
  }

  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[#6B7280]">{meta.label} API Key</span>
      <div className="relative mt-1.5">
        <input
          type={visible ? 'text' : 'password'}
          value={imageGen[field]}
          onChange={(e) => onPatch({ [field]: e.target.value })}
          placeholder={API_KEY_PLACEHOLDERS[provider]}
          className="w-full rounded-xl border border-[#F3F4F6] bg-white py-2.5 pl-3 pr-10 text-[13px] text-[#111827] outline-none"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
          aria-label={visible ? '隐藏密钥' : '显示密钥'}
        >
          {visible ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
        API Key 获取：{' '}
        <a
          href={meta.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[#6E29F6] underline-offset-2 hover:underline"
        >
          {meta.keyLinkLabel}
        </a>
      </p>
    </label>
  )
}

type Props = {
  imageGen: MomentsImageGenSettings
  onPatch: (patch: Partial<MomentsImageGenSettings>) => void
  /** 引擎切换由外层顶部 Tab 承担（如 API 设置页） */
  hideProviderTabs?: boolean
  /** 嵌入 API 设置卡片时去掉外层边框与间距 */
  embedded?: boolean
  /** 文案语境：朋友圈法则页 vs API 生图设置页 */
  settingsContext?: 'moments' | 'api'
}

function ModelBadge({ free, priceLabel }: { free: boolean; priceLabel?: string }) {
  const text = priceLabel ?? (free ? '免费' : '付费')
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        free ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
      }`}
    >
      {text}
    </span>
  )
}

function ServiceActivationBadge({ activated }: { activated?: boolean | null }) {
  if (activated === true) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
        已开通
      </span>
    )
  }
  if (activated === false) {
    return (
      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
        未开通
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#9CA3AF]">
      待检测
    </span>
  )
}

function ImageGenTabBar({
  activeTab,
  onChange,
}: {
  activeTab: ImageGenTab
  onChange: (tab: ImageGenTab) => void
}) {
  return (
    <div className="flex border-b border-[#F3F4F6]">
      {IMAGE_GEN_TABS.map((tab) => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative min-w-0 flex-1 px-2 py-3 text-center text-[13px] font-medium transition-colors ${
              active ? 'text-[#111827]' : 'text-[#9CA3AF] hover:text-[#6B7280]'
            }`}
          >
            {tab.label}
            <span
              className={`absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#111827] transition-opacity ${
                active ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

export function MomentsImageGenSettingsPanel({
  imageGen,
  onPatch,
  hideProviderTabs = false,
  embedded = false,
  settingsContext = 'moments',
}: Props) {
  const [activeTab, setActiveTab] = useState<ImageGenTab>('model')
  const [modelOpen, setModelOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const modelSearchRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [previewPrompt, setPreviewPrompt] = useState(DEFAULT_PREVIEW_PROMPT)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewSizeId, setPreviewSizeId] = useState('')

  const provider = imageGen.provider

  const models = useMemo(
    () => getCachedModelsForProvider(imageGen.cachedModelsByProvider, provider),
    [imageGen.cachedModelsByProvider, provider],
  )

  const modelsFetchedAt = imageGen.modelsFetchedAtByProvider[provider]

  const selected = useMemo(
    () => findMomentsImageModel(imageGen.modelId, models),
    [imageGen.modelId, models],
  )

  useEffect(() => {
    if (!models.length) setModelOpen(false)
  }, [models.length])

  useEffect(() => {
    if (!modelOpen) {
      setModelSearch('')
      return
    }
    const timer = window.setTimeout(() => modelSearchRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [modelOpen])

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    if (!q) return models
    return models.filter((model) => {
      const haystack = [
        model.labelZh,
        model.modelName,
        model.brand,
        model.title,
        model.description,
        model.priceLabel,
        model.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [modelSearch, models])

  const activeStylePrefix = useMemo(() => resolveStylePrefix(imageGen), [imageGen])

  const fullPreviewPrompt = useMemo(() => {
    const body = previewPrompt.trim()
    if (!body) return activeStylePrefix.trim()
    return `${activeStylePrefix}${body}`.trim()
  }, [activeStylePrefix, previewPrompt])

  const supportedPreviewSizes = useMemo(() => {
    if (!selected) return []
    const { provider: modelProvider, modelName } = parseMomentsImageModelId(imageGen.modelId)
    return getSupportedImageSizes(modelProvider, modelName)
  }, [imageGen.modelId, selected])

  useEffect(() => {
    if (!supportedPreviewSizes.length) {
      setPreviewSizeId('')
      return
    }
    setPreviewSizeId((prev) => {
      if (supportedPreviewSizes.some((s) => s.id === prev)) return prev
      return pickDefaultImageSize(supportedPreviewSizes)?.id ?? ''
    })
  }, [supportedPreviewSizes, imageGen.modelId])

  const previewSize = useMemo(
    () =>
      supportedPreviewSizes.find((s) => s.id === previewSizeId) ??
      pickDefaultImageSize(supportedPreviewSizes),
    [previewSizeId, supportedPreviewSizes],
  )

  const runPreview = useCallback(async () => {
    const prompt = previewPrompt.trim()
    if (!prompt) {
      setPreviewError('请先输入预览提示词')
      return
    }
    if (!previewSize) {
      setPreviewError('请先在「模型」Tab 选择生图模型')
      return
    }

    setPreviewBusy(true)
    setPreviewError(null)
    try {
      const dataUrl = await generateMomentsImage({
        prompt,
        settings: imageGen,
        width: previewSize.width,
        height: previewSize.height,
        imageSize: previewSize.apiSize,
      })
      setPreviewImage(dataUrl)
    } catch (e) {
      setPreviewImage(null)
      setPreviewError(e instanceof Error ? e.message : '预览生图失败')
    } finally {
      setPreviewBusy(false)
    }
  }, [imageGen, previewPrompt, previewSize])

  const switchProvider = useCallback(
    (next: MomentsImageProvider) => {
      if (next === provider) return
      const defaultModelId = getDefaultModelIdForProvider(next)
      setModelOpen(false)
      setStatus(null)
      onPatch({
        provider: next,
        modelId:
          inferMomentsImageProviderFromModelId(imageGen.modelId) === next
            ? imageGen.modelId
            : defaultModelId,
      })
    },
    [imageGen.modelId, onPatch, provider],
  )

  const pullModels = useCallback(async () => {
    if (provider === 'custom') {
      if (!imageGen.customApiUrl.trim()) {
        setStatus({ ok: false, text: '请先填写 API URL' })
        return
      }
      if (!imageGen.customApiKey.trim()) {
        setStatus({ ok: false, text: '请先填写 API Key' })
        return
      }
    } else {
      const apiKey = getImageGenApiKey(imageGen, provider).trim()
      if (!apiKey) {
        const label = IMAGE_PROVIDERS.find((p) => p.id === provider)?.label ?? '当前引擎'
        setStatus({ ok: false, text: `请先填写 ${label} API Key` })
        return
      }
    }

    setLoading(true)
    setStatus(null)
    try {
      const catalog = await fetchMomentsImageModelCatalog(buildFetchCatalogOptions(provider, imageGen))
      const defaultModelId = getDefaultModelIdForProvider(provider)
      const fetchedAt = Date.now()
      onPatch({
        cachedModelsByProvider: replaceCachedModelsForProvider(
          imageGen.cachedModelsByProvider,
          provider,
          catalog,
        ),
        modelsFetchedAtByProvider: {
          ...imageGen.modelsFetchedAtByProvider,
          [provider]: fetchedAt,
        },
        modelId: isKnownMomentsImageModelId(imageGen.modelId, catalog)
          ? imageGen.modelId
          : catalog[0]?.id ?? defaultModelId,
      })
      const priced = catalog.filter((m) => m.priceLabel && m.priceLabel !== '价格未知').length
      const activatedCount =
        provider === 'volcengine'
          ? catalog.filter((m) => m.serviceActivated === true).length
          : 0
      const notActivatedCount =
        provider === 'volcengine'
          ? catalog.filter((m) => m.serviceActivated === false).length
          : 0
      const pendingCount =
        provider === 'volcengine'
          ? catalog.filter((m) => m.serviceActivated == null).length
          : 0
      setStatus({
        ok: true,
        text:
          provider === 'qianfan'
            ? `已加载 ${catalog.length} 个千帆文生图模型（${priced} 个已标注官方价格）`
            : provider === 'volcengine'
              ? `已检测 ${catalog.length} 个模型：${activatedCount} 个已开通，${notActivatedCount} 个未开通${pendingCount ? `，${pendingCount} 个待确认` : ''}`
              : provider === 'novelai' || provider === 'gemini' || provider === 'openai'
                ? `已加载 ${catalog.length} 个${IMAGE_PROVIDERS.find((p) => p.id === provider)?.label ?? ''}模型`
                : provider === 'custom'
                  ? `已拉取 ${catalog.length} 个生图模型`
                  : `已拉取 ${catalog.length} 个文生图模型（${priced} 个已匹配价格）`,
      })
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : '拉取模型失败',
      })
    } finally {
      setLoading(false)
    }
  }, [
    imageGen.cachedModelsByProvider,
    imageGen.modelId,
    imageGen.modelsFetchedAtByProvider,
    imageGen.qianfanApiKey,
    imageGen.volcengineApiKey,
    imageGen.siliconflowApiKey,
    imageGen.novelaiApiKey,
    imageGen.geminiApiKey,
    imageGen.openaiApiKey,
    imageGen.customApiUrl,
    imageGen.customApiKey,
    onPatch,
    provider,
  ])

  return (
    <div
      className={
        embedded
          ? 'overflow-hidden'
          : 'mt-5 overflow-hidden rounded-2xl border border-[#F3F4F6] bg-[#FAFAFA]/80'
      }
    >
      <ImageGenTabBar activeTab={activeTab} onChange={setActiveTab} />

      <div className="p-4">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'model' ? (
            <motion.div
              key="model"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {!hideProviderTabs ? (
                <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="inline-flex min-w-full rounded-full bg-white p-1 shadow-sm">
                    {IMAGE_PROVIDERS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => switchProvider(opt.id)}
                        className={`min-w-0 shrink-0 rounded-full px-3 py-1.5 text-[12px] transition-colors sm:flex-1 sm:text-[13px] ${
                          provider === opt.id
                            ? 'bg-[#111827] text-white'
                            : 'text-[#9CA3AF] hover:text-[#6B7280]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {provider === 'siliconflow' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">硅基流动文生图：</span>调用{' '}
                    <span className="font-mono text-[11px]">POST /v1/images/generations</span>。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    在{' '}
                    <a
                      href="https://cloud.siliconflow.cn/account/ak"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      硅基流动控制台
                    </a>{' '}
                    创建 API Key，填入后手动点击「拉取模型列表」；价格参考{' '}
                    <a
                      href="https://siliconflow.cn/pricing"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      官网定价
                    </a>
                    。
                  </p>
                </div>
              ) : provider === 'qianfan' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">百度千帆文生图：</span>调用{' '}
                    <span className="font-mono text-[11px]">POST /v2/images/generations</span>（蒸汽机
                    为 <span className="font-mono text-[11px]">/v2/musesteamer/images/generations</span>
                    ）。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    在{' '}
                    <a
                      href="https://console.bce.baidu.com/qianfan/ais/console/apiKey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      千帆控制台
                    </a>{' '}
                    创建 API Key，填入后点击「加载模型列表」；价格参考{' '}
                    <a
                      href="https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      官方计费说明
                    </a>
                    。
                  </p>
                </div>
              ) : provider === 'volcengine' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">豆包 Seedream 文生图：</span>调用{' '}
                    <span className="font-mono text-[11px]">POST /api/v3/images/generations</span>。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    在{' '}
                    <a
                      href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      火山方舟控制台
                    </a>{' '}
                    创建 API Key；并在{' '}
                    <a
                      href={VOLCENGINE_ARK_OPEN_MANAGEMENT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      开通管理
                    </a>{' '}
                    中开通 Seedream 模型。
                  </p>
                </div>
              ) : provider === 'novelai' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">NovelAI 生图：</span>调用{' '}
                    <span className="font-mono text-[11px]">POST /ai/generate-image</span>，按 Anlas 计费。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    在{' '}
                    <a
                      href={getImageGenProviderMeta('novelai').keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      {getImageGenProviderMeta('novelai').keyLinkLabel}
                    </a>{' '}
                    获取 API Key，支持 NAI Diffusion 3 / 4 / 4.5 系列模型。
                  </p>
                </div>
              ) : provider === 'gemini' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">Gemini / Imagen 生图：</span>支持 Gemini 原生生图与 Imagen 3/4。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    在{' '}
                    <a
                      href={getImageGenProviderMeta('gemini').keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      {getImageGenProviderMeta('gemini').keyLinkLabel}
                    </a>{' '}
                    创建 API Key 后填入。
                  </p>
                </div>
              ) : provider === 'openai' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">OpenAI GPT 生图：</span>支持{' '}
                    <span className="font-mono text-[11px]">gpt-image-1</span>、DALL·E 3 / 2。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    在{' '}
                    <a
                      href={getImageGenProviderMeta('openai').keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6E29F6] underline-offset-2 hover:underline"
                    >
                      {getImageGenProviderMeta('openai').keyLinkLabel}
                    </a>{' '}
                    创建 API Key；需可访问 OpenAI API 的网络环境。
                  </p>
                </div>
              ) : provider === 'custom' ? (
                <div className="rounded-xl bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[#6B7280]">
                  <p>
                    <span className="font-medium text-[#111827]">自定义 OpenAI 兼容接口：</span>支持硅基流动、
                    OneAPI、NewAPI 等聚合网关，或自建中转服务。
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    填入 API URL 与 Key 后点击「拉取模型列表」。客户端会优先请求{' '}
                    <span className="font-mono">/models?sub_type=text-to-image</span>，并过滤掉 gpt-4/claude
                    等聊天模型；若列表仍无生图模型，请在下方手动填写模型 ID（如 gpt-image-1、gpt-image-2）。
                    部分中转站的 gpt-image 仅注册 <span className="font-mono">/v1/chat/completions</span>，客户端会优先走该接口生图。
                  </p>
                </div>
              ) : null}

              {provider === 'volcengine' ? (
                <VolcengineModelActivationGuide modelName={selected?.modelName} compact />
              ) : null}

              <ImageGenProviderCredentialsFields provider={provider} imageGen={imageGen} onPatch={onPatch} />

              <button
                type="button"
                onClick={() => void pullModels()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-[13px] font-medium text-white transition-opacity disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <RefreshCw className="size-4" strokeWidth={1.75} />
                )}
                {loading
                  ? provider === 'volcengine'
                    ? '检测开通状态中…'
                    : '加载中…'
                  : provider === 'siliconflow' || provider === 'custom'
                    ? '拉取模型列表'
                    : '加载模型列表'}
              </button>

              {status ? (
                <p className={`text-center text-[11px] ${status.ok ? 'text-[#6B7280]' : 'text-[#EF4444]'}`}>
                  {status.text}
                </p>
              ) : models.length > 0 && modelsFetchedAt ? (
                <p className="text-center text-[11px] text-[#9CA3AF]">
                  已缓存 {models.length} 个模型 ·{' '}
                  {new Date(modelsFetchedAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              ) : null}

              <InlineDropdown
                label="选择生图模型"
                valueText={selected?.labelZh ?? '请选择模型'}
                open={modelOpen}
                disabled={!models.length}
                onToggle={() => setModelOpen((v) => !v)}
              >
                <div className="sticky top-0 z-[1] border-b border-[#F0F0F0] bg-white px-3 py-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      ref={modelSearchRef}
                      type="search"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="搜索模型名称…"
                      className="w-full rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] py-2.5 pl-9 pr-3 text-[13px] text-[#111827] outline-none focus:border-[#D1D5DB]"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {modelSearch.trim() ? (
                    <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                      匹配 {filteredModels.length} / {models.length} 个模型
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 px-3 py-2">
                  {filteredModels.length ? (
                    filteredModels.map((model) => (
                      <ModelRow
                        key={model.id}
                        model={model}
                        active={imageGen.modelId === model.id}
                        showServiceActivation={provider === 'volcengine'}
                        onSelect={() => {
                          onPatch({ modelId: model.id })
                          setModelOpen(false)
                        }}
                      />
                    ))
                  ) : (
                    <p className="px-1 py-6 text-center text-[12px] text-[#9CA3AF]">没有匹配的模型</p>
                  )}
                </div>
              </InlineDropdown>

              {selected ? (
                <div className="rounded-xl border border-white bg-white px-3.5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#111827]">{selected.labelZh}</p>
                      <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                        {selected.brand ? <MemoryModelIdText text={selected.brand} /> : null}
                        {selected.modelName ? (
                          <>
                            {selected.brand ? ' · ' : null}
                            <MemoryModelIdText text={selected.modelName} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ModelBadge free={selected.free} priceLabel={selected.priceLabel} />
                      {provider === 'volcengine' ? (
                        <ServiceActivationBadge activated={selected.serviceActivated} />
                      ) : null}
                    </div>
                  </div>
                  {selected.priceLabel ? (
                    <p className="mt-2 text-[12px] font-medium text-[#111827]">{selected.priceLabel}</p>
                  ) : null}
                  {provider === 'volcengine' && selected.serviceActivated === false ? (
                    <p className="mt-1 text-[11px] text-rose-600">
                      该模型尚未开通，请前往开通管理激活后再生图。
                    </p>
                  ) : null}
                  {provider === 'custom' && isGeminiNativeImageModel(selected.modelName) ? (
                    <p className="mt-1 text-[11px] text-[#6B7280]">
                      将自动走中转站的 Gemini <span className="font-mono">generateContent</span> 接口（非
                      <span className="font-mono"> /images/generations</span>）。
                    </p>
                  ) : null}
                  {selected.description ? (
                    <p className="mt-1 text-[12px] leading-relaxed text-[#6B7280]">{selected.description}</p>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          ) : null}

          {activeTab === 'prefix' ? (
            <motion.div
              key="prefix"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-[12px] leading-relaxed text-[#6B7280]">
                {settingsContext === 'api'
                  ? '生图风格由客户端自动拼接。角色私聊/群聊/朋友圈配图：非自拍写第一人称视角（平视/仰视/俯视按场景，肢体仅必要时入镜；比耶可写手入镜）；仅自拍才描述人像五官。'
                  : '生图风格由本页配置自动拼接。角色配图：非自拍为第一人称视角随手拍（非每张都露脚）；自拍才写五官外貌。预览样张可自由试词。'}
              </p>

              <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
                {(
                  [
                    { id: 'preset', label: '预设风格' },
                    { id: 'custom', label: '自定义' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onPatch({ stylePrefixMode: opt.id })}
                    className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${
                      imageGen.stylePrefixMode === opt.id
                        ? 'bg-[#111827] text-white'
                        : 'text-[#9CA3AF] hover:text-[#6B7280]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {imageGen.stylePrefixMode === 'preset' ? (
                <div className="grid grid-cols-2 gap-2">
                  {POLLINATIONS_STYLE_PRESETS.map((style) => {
                    const active = imageGen.stylePresetId === style.id
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => onPatch({ stylePresetId: style.id })}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${
                          active
                            ? 'border-[#111827] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                            : 'border-transparent bg-white/70 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-[#111827]">{style.labelZh}</span>
                          {active ? <Check className="size-3.5 text-[#111827]" strokeWidth={2.5} /> : null}
                        </div>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF]">
                          {style.labelEn}
                        </span>
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
                    rows={4}
                    className="w-full resize-none rounded-xl border border-white bg-white px-4 py-3 text-[14px] text-[#111827] outline-none transition-colors focus:ring-2 focus:ring-[#111827]/10"
                  />
                  <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                    自定义英文风格提示词，建议以逗号结尾；仅拼接到 API 请求，不会写入模型输出的 `[图片]` 行。
                  </p>
                </div>
              )}

              {activeStylePrefix ? (
                <div className="rounded-xl bg-white px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                    当前风格提示词（API 自动拼接）
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{activeStylePrefix}</p>
                </div>
              ) : imageGen.stylePrefixMode === 'preset' && imageGen.stylePresetId === 'reference_match' ? (
                <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] leading-relaxed text-[#6B7280]">
                  已选「跟随参考形象图」：角色自拍且配置了形象参考时，API 会匹配参考图的画风与线条，不再叠加写实/二次元等预设前缀。
                </p>
              ) : (
                <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] text-[#9CA3AF]">
                  当前为「无风格」，API 请求仅使用画面内容描述（含客户端人像增强词）。
                </p>
              )}
            </motion.div>
          ) : null}

          {activeTab === 'preview' ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-[12px] leading-relaxed text-[#6B7280]">
                使用「模型」与「风格」Tab 中的当前配置生成样张。预览提示词只需写画面内容，风格由上方配置自动拼接。
              </p>

              {activeStylePrefix ? (
                <div className="rounded-xl bg-white px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                    已引用风格提示词
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{activeStylePrefix}</p>
                </div>
              ) : imageGen.stylePrefixMode === 'preset' && imageGen.stylePresetId === 'reference_match' ? (
                <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] leading-relaxed text-[#6B7280]">
                  已选「跟随参考形象图」：预览不含额外风格前缀；角色自拍锁脸时会匹配参考图画风。
                </p>
              ) : (
                <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] text-[#9CA3AF]">
                  当前未设置风格提示词，预览将仅使用下方画面描述。
                </p>
              )}

              <label className="block">
                <span className="text-[11px] font-medium text-[#6B7280]">预览提示词</span>
                <textarea
                  value={previewPrompt}
                  onChange={(e) => setPreviewPrompt(e.target.value)}
                  placeholder="描述你想预览的画面，例如：一只猫坐在窗台上"
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border border-white bg-white px-4 py-3 text-[14px] text-[#111827] outline-none transition-colors focus:ring-2 focus:ring-[#111827]/10"
                />
              </label>

              {selected ? (
                <div>
                  <span className="text-[11px] font-medium text-[#6B7280]">生图尺寸</span>
                  <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
                    仅显示当前模型 {selected.labelZh} 支持的尺寸
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {supportedPreviewSizes.map((size) => (
                      <PreviewSizeOption
                        key={size.id}
                        size={size}
                        active={previewSizeId === size.id}
                        onSelect={() => setPreviewSizeId(size.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-white px-3 py-2.5 text-[11px] text-[#9CA3AF]">
                  请先在「模型」Tab 拉取并选择生图模型，再调整预览尺寸。
                </p>
              )}

              {fullPreviewPrompt ? (
                <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white/60 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9CA3AF]">
                    完整提示词
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{fullPreviewPrompt}</p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void runPreview()}
                disabled={previewBusy || !previewPrompt.trim() || !previewSize}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#111827] bg-white px-4 py-3 text-[13px] font-medium text-[#111827] transition-opacity disabled:opacity-50"
              >
                {previewBusy ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Wand2 className="size-4" strokeWidth={1.75} />
                )}
                {previewBusy ? '生成预览中…' : '生成预览'}
              </button>

              {previewError ? (
                <div className="space-y-2">
                  <p className="text-center text-[11px] text-[#EF4444]">{previewError}</p>
                  {provider === 'volcengine' && isVolcengineModelNotActivatedError(previewError) ? (
                    <VolcengineModelActivationGuide modelName={selected?.modelName} />
                  ) : null}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-white bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
                <div
                  className="relative w-full bg-[#F9FAFB]"
                  style={{
                    aspectRatio: previewSize
                      ? `${previewSize.width} / ${previewSize.height}`
                      : '1 / 1',
                  }}
                >
                  {previewBusy ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#9CA3AF]">
                      <Loader2 className="size-6 animate-spin" strokeWidth={1.75} />
                      <span className="text-[12px]">正在生成预览…</span>
                    </div>
                  ) : previewImage ? (
                    <img src={previewImage} alt="生图预览" className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-[#9CA3AF]">
                      <ImageIcon className="size-8" strokeWidth={1.25} />
                      <p className="text-[12px] leading-relaxed">
                        生成后将在此显示 {previewSize?.label ?? '预览'} 图片
                      </p>
                    </div>
                  )}
                </div>
                {selected ? (
                  <div className="border-t border-[#F3F4F6] px-3 py-2 text-[11px] text-[#9CA3AF]">
                    {selected.labelZh}
                    {selected.modelName ? ` · ${selected.modelName}` : ''}
                    {previewSize ? ` · ${previewSize.label}` : ''}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function VolcengineModelActivationGuide({
  modelName,
  compact = false,
}: {
  modelName?: string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed ${
        compact
          ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
          : 'border-amber-200 bg-amber-50 text-[#92400E]'
      }`}
    >
      <p className={`font-medium ${compact ? 'text-[#78350F]' : 'text-[#92400E]'}`}>
        {compact ? '提示：火山方舟需按模型单独开通' : '请先在火山方舟开通生图模型'}
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px]">
        <li>
          打开{' '}
          <a
            href={VOLCENGINE_ARK_OPEN_MANAGEMENT_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[#6E29F6] underline-offset-2 hover:underline"
          >
            火山方舟 · 开通管理
          </a>
        </li>
        <li>
          在「图片生成」分类（页面会自动定位）找到 Seedream
          {modelName ? (
            <>
              ，开通 <span className="font-mono text-[10px]">{modelName}</span>
            </>
          ) : (
            ' 并开通你要用的版本'
          )}
        </li>
        <li>确认账户有余额（按成功出图张数计费）</li>
        <li>开通后回到此处重新生成预览</li>
      </ol>
      {!compact ? (
        <a
          href={VOLCENGINE_ARK_OPEN_MANAGEMENT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-block text-[11px] font-medium text-[#6E29F6] underline-offset-2 hover:underline"
        >
          前往开通模型 →
        </a>
      ) : null}
    </div>
  )
}

function PreviewSizeOption({
  size,
  active,
  onSelect,
}: {
  size: MomentsImageSizeOption
  active: boolean
  onSelect: () => void
}) {
  const showApiHint = size.apiSize !== `${size.width}x${size.height}`
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
        active
          ? 'border-[#111827] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
          : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[#111827]">{size.label}</span>
        {active ? <Check className="size-3.5 text-[#111827]" strokeWidth={2.5} /> : null}
      </div>
      {showApiHint ? (
        <span className="mt-0.5 block font-mono text-[10px] text-[#9CA3AF]">{size.apiSize}</span>
      ) : null}
    </button>
  )
}

function ModelRow({
  model,
  active,
  showServiceActivation = false,
  onSelect,
}: {
  model: MomentsImageModelOption
  active: boolean
  showServiceActivation?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
        active
          ? 'border-[#111827] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
          : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#111827]">{model.labelZh}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#9CA3AF]">
                        {model.brand ? <MemoryModelIdText text={model.brand} /> : null}
                        {model.modelName ? (
                          <>
                            {model.brand ? ' · ' : null}
                            <MemoryModelIdText text={model.modelName} />
                          </>
                        ) : null}
                      </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ModelBadge free={model.free} priceLabel={model.priceLabel} />
          {showServiceActivation ? (
            <ServiceActivationBadge activated={model.serviceActivated} />
          ) : null}
        </div>
      </div>
      {model.priceLabel ? (
        <p className="mt-1 text-[11px] font-medium text-[#111827]">{model.priceLabel}</p>
      ) : null}
      {model.description ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] text-[#6B7280]">{model.description}</p>
      ) : null}
    </button>
  )
}
