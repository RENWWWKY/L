import { generateMomentsImage } from '../../../../components/moments/momentsImageGen'
import type { MomentsImageGenSettings } from '../../../../components/moments/useMomentsSettingsStore'
import { loadResolvedImageGenSettings } from '../../api/loadResolvedImageGenSettings'
import { isCharacterImageGenEnabled } from '../../api/imageGenPresetUtils'
import type { ApiConfig } from '../../api/types'
import { buildDatingPlotImageGenParams } from '../characterAppearanceImageGen'
import { enforceDatingPlotImagePromptCastGenders } from './datingPlotImagePromptGenderEnforcer'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import {
  appearanceBundleToCharacterPatch,
  resolveScopedAppearanceRefs,
} from '../resolveScopedAppearanceRefs'
import {
  clampDatingPlotImageCount,
  drawDatingPlotImageCount,
  parseDatingPlotImageCountRange,
} from './datingPlotImageCount'
import { persistPlotImageItemsToSideStore } from './datingPlotImagePersist'
import { generateDatingPlotImagePrompts } from './datingPlotImagePromptAi'
import type { CharacterArchive, PlotImageItem, PlotItem } from './types'

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** 收集最近 AI 剧情配图的 prompt，供视觉连续性思维链参考 */
export function collectRecentDatingPlotVisualPrompts(
  plots: PlotItem[],
  maxPrompts = 4,
): string[] {
  const out: string[] = []
  for (let i = plots.length - 1; i >= 0 && out.length < maxPrompts; i--) {
    const p = plots[i]
    if (p?.type !== 'ai' || !p.plotImages?.length) continue
    for (let j = p.plotImages.length - 1; j >= 0 && out.length < maxPrompts; j--) {
      const prompt = p.plotImages[j]?.prompt?.trim()
      if (prompt) out.unshift(prompt)
    }
  }
  return out.slice(-maxPrompts)
}

function resolvePlayerDisplayName(player: PlayerIdentity | null | undefined): string {
  return player?.name?.trim() || '玩家'
}

export type DatingPlotImageGenResult = {
  images: PlotImageItem[]
  /** 开启配图但 0 张成功时的可读原因 */
  warning?: string
}

function formatPlotImageGenError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  return '生图 API 调用失败'
}

export async function generateDatingPlotImages(params: {
  apiConfig: ApiConfig
  imageGenSettings: MomentsImageGenSettings
  plotBody: string
  character: Character
  playerIdentity?: PlayerIdentity | null
  scopedRefs: Awaited<ReturnType<typeof resolveScopedAppearanceRefs>>
  countMin?: number
  countMax?: number
  recentVisualPrompts?: string[]
}): Promise<DatingPlotImageGenResult> {
  const range = parseDatingPlotImageCountRange(params.countMin, params.countMax)
  const target = drawDatingPlotImageCount(range)
  if (target <= 0) return { images: [] }

  const characterForGen: Character = {
    ...params.character,
    ...appearanceBundleToCharacterPatch(params.scopedRefs.character),
  }
  const playerForGen: PlayerIdentity | null = params.playerIdentity ?? null
  const playerDisplayName = resolvePlayerDisplayName(playerForGen)

  const { prompts } = await generateDatingPlotImagePrompts({
    apiConfig: params.apiConfig,
    plotBody: params.plotBody,
    character: characterForGen,
    playerIdentity: playerForGen,
    playerDisplayName,
    count: target,
    recentVisualPrompts: params.recentVisualPrompts,
  })
  if (!prompts.length) {
    return {
      images: [],
      warning:
        '配图提示词解析失败（模型未返回有效的 <image> 标签）。已扣费的可能是「配图提示词」文本模型，而非生图 API。',
    }
  }

  const out: PlotImageItem[] = []
  const errors: string[] = []
  for (const prompt of prompts) {
    try {
      const genParams = buildDatingPlotImageGenParams({
        prompt: enforceDatingPlotImagePromptCastGenders(
          prompt,
          characterForGen,
          playerForGen,
        ),
        settings: params.imageGenSettings,
        character: characterForGen,
        playerIdentity: playerForGen,
        playerDisplayName,
        additionalReferenceImages: params.scopedRefs.user.images,
      })
      const url = await generateMomentsImage(genParams)
      if (!url?.trim()) {
        errors.push('生图 API 未返回有效图片')
        continue
      }
      out.push({
        id: uid('dimg'),
        prompt,
        url: url.trim(),
        addedAt: Date.now(),
      })
      // 每张成功后立即落侧存储，避免第二张还在生成时 KV 重载丢失已完成的图
      await persistPlotImageItemsToSideStore([out[out.length - 1]!])
    } catch (err) {
      const msg = formatPlotImageGenError(err)
      errors.push(msg)
      console.warn('[dating] plot image gen failed', err)
    }
  }

  if (out.length) {
    if (out.length < prompts.length) {
      return {
        images: out,
        warning: `配图部分失败：${out.length}/${prompts.length} 张成功。${errors[0] ?? ''}`.trim(),
      }
    }
    return { images: out }
  }

  return {
    images: [],
    warning: errors[0] ?? '配图生成失败，请检查生图 API 配置与模型是否支持返回 base64 图片。',
  }
}

export type DatingPlotImagesResolveResult = {
  /** 已开启配图且 API 可用，客户端会等待生图流程结束 */
  awaited: boolean
  images: PlotImageItem[]
  warning?: string
}

/** 新发/重生成 AI 剧情前：若开启配图则同步生图，供与正文一并写入后再展示 */
export async function resolveDatingPlotImagesForAiPlot(params: {
  apiConfig: ApiConfig
  archive: CharacterArchive
  plotBody: string
  characterId: string
  playerIdentity?: PlayerIdentity | null
  playerIdentityId?: string | null
  plotsBeforeAi: PlotItem[]
}): Promise<DatingPlotImagesResolveResult> {
  if (!params.archive.plotImageGenEnabled) {
    return { awaited: false, images: [] }
  }
  const body = params.plotBody.trim()
  if (!body) return { awaited: false, images: [] }

  const imageGenSettings = await loadResolvedImageGenSettings()
  if (!isCharacterImageGenEnabled(imageGenSettings)) {
    return { awaited: false, images: [] }
  }

  const character = (await personaDb.getCharacter(params.characterId)) as Character | null
  if (!character) return { awaited: true, images: [] }

  const pid =
    params.playerIdentityId?.trim() ||
    params.playerIdentity?.id?.trim() ||
    character.playerIdentityId?.trim() ||
    ''
  const scopedRefs = await resolveScopedAppearanceRefs({
    context: 'dating',
    playerIdentityId: pid,
    characterId: params.characterId,
    character,
    playerIdentity: params.playerIdentity ?? null,
  })

  const range = parseDatingPlotImageCountRange(
    params.archive.plotImageCountMin,
    params.archive.plotImageCountMax,
  )

  const recentVisualPrompts = collectRecentDatingPlotVisualPrompts(params.plotsBeforeAi)

  const { images, warning } = await generateDatingPlotImages({
    apiConfig: params.apiConfig,
    imageGenSettings,
    plotBody: body,
    character,
    playerIdentity: params.playerIdentity ?? null,
    scopedRefs,
    countMin: range.min,
    countMax: range.max,
    recentVisualPrompts,
  })
  return { awaited: true, images, warning }
}

/** @deprecated 新发剧情已在入库前 await 配图；保留供旧调用 */
export async function runDatingPlotImageGenAfterAi(params: {
  apiConfig: ApiConfig
  characterId: string
  aiPlotId: string
  plotBody: string
  archive: CharacterArchive
  playerIdentity?: PlayerIdentity | null
  playerIdentityId?: string | null
  applyArchivePatch: (
    characterId: string,
    updater: (prev: CharacterArchive) => CharacterArchive,
  ) => Promise<void>
}): Promise<void> {
  if (!params.archive.plotImageGenEnabled) return
  const body = params.plotBody.trim()
  if (!body) return

  const imageGenSettings = await loadResolvedImageGenSettings()
  if (!isCharacterImageGenEnabled(imageGenSettings)) return

  const character = (await personaDb.getCharacter(params.characterId)) as Character | null
  if (!character) return

  const pid =
    params.playerIdentityId?.trim() ||
    params.playerIdentity?.id?.trim() ||
    character.playerIdentityId?.trim() ||
    ''
  const scopedRefs = await resolveScopedAppearanceRefs({
    context: 'dating',
    playerIdentityId: pid,
    characterId: params.characterId,
    character,
    playerIdentity: params.playerIdentity ?? null,
  })

  const range = parseDatingPlotImageCountRange(
    params.archive.plotImageCountMin,
    params.archive.plotImageCountMax,
  )

  const recentVisualPrompts = collectRecentDatingPlotVisualPrompts(
    params.archive.plots.filter((p) => p.id !== params.aiPlotId),
  )

  const { images } = await generateDatingPlotImages({
    apiConfig: params.apiConfig,
    imageGenSettings,
    plotBody: body,
    character,
    playerIdentity: params.playerIdentity ?? null,
    scopedRefs,
    countMin: range.min,
    countMax: range.max,
    recentVisualPrompts,
  })
  if (!images.length) return

  await params.applyArchivePatch(params.characterId, (prev) => ({
    ...prev,
    plots: prev.plots.map((p) =>
      p.id === params.aiPlotId ? ({ ...p, plotImages: images } satisfies PlotItem) : p,
    ),
  }))
}

export function patchDatingPlotImageSettings(
  archive: CharacterArchive,
  patch: {
    plotImageGenEnabled?: boolean
    plotImageCountMin?: number
    plotImageCountMax?: number
  },
): CharacterArchive {
  const next = { ...archive }
  if (patch.plotImageGenEnabled !== undefined) {
    next.plotImageGenEnabled = patch.plotImageGenEnabled
  }
  if (patch.plotImageCountMin !== undefined || patch.plotImageCountMax !== undefined) {
    const range = parseDatingPlotImageCountRange(
      patch.plotImageCountMin ?? archive.plotImageCountMin,
      patch.plotImageCountMax ?? archive.plotImageCountMax,
    )
    next.plotImageCountMin = clampDatingPlotImageCount(range.min)
    next.plotImageCountMax = clampDatingPlotImageCount(range.max)
  }
  return next
}
