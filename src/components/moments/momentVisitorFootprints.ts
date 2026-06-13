import type { MomentItemModel } from './mockMoments'
import { isMomentInteractionGenerationPending } from './momentInteractionGenerationRegistry'
import type { AiMomentInteractionDraft, MomentInteraction } from './momentInteractionTypes'
import {
  collectEngagedCharacterIds,
  materializeInteractions,
  stripViewedForEngagedCharacters,
} from './momentInteractionTypes'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import type { MomentPrivacyMeta, NewMomentPrivacy } from './newMomentTypes'
import { injectFallbackEngagementDrafts } from './momentEngagementAudience'
import {
  assignOrganicCharacterAnchors,
  pickOrganicViewedDwellSeconds,
} from './momentInteractionTiming'
import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'
import {
  sampleByEngagementPercent,
  type ResolvedUserMomentEngagementRules,
} from './userMomentEngagementRules'

/** 将持久化的 privacy 还原为发布时筛选用的结构 */
export function privacyMetaToDraftPrivacy(meta: MomentPrivacyMeta | undefined): NewMomentPrivacy {
  if (!meta) return { mode: 'public', contacts: [] }
  return {
    mode: meta.mode,
    contacts: meta.visibleToOnly ?? meta.hiddenFrom ?? [],
    selectedTagIds: meta.selectedTagIds,
    selectedContactIds: meta.selectedContactIds,
    audience: meta.audience,
  }
}

export function momentHasVisitorFootprints(moment: MomentItemModel): boolean {
  return (moment.interactions ?? []).some((ix) => ix.type === 'viewed')
}

export function momentNeedsVisitorFootprintBackfill(moment: MomentItemModel): boolean {
  if (!moment.isUserAuthored) return false
  if (moment.privacy?.mode === 'private') return false
  if (isMomentInteractionGenerationPending(moment.id)) return false
  if (momentHasVisitorFootprints(moment)) return false

  const interactions = moment.interactions ?? []
  const hasLikeOrComment = interactions.some(
    (ix) => ix.type === 'like' || ix.type === 'comment',
  )
  if (hasLikeOrComment) return true

  // 刚发布、AI 互动尚未写入前勿抢先补 viewed，避免长期只剩浏览记录
  if (interactions.length === 0 && Date.now() - moment.timestamp < 90_000) return false

  return true
}

function ensureAtLeastOneViewedDraft(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
  engagementRules?: ResolvedUserMomentEngagementRules,
): AiMomentInteractionDraft[] {
  if (!allowed.length) return drafts

  const viewedPercent = engagementRules?.silentViewedPercent ?? 100
  if (viewedPercent <= 0) return drafts

  const engaged = collectEngagedCharacterIds(drafts)
  const hasSilentViewed = drafts.some(
    (d) => d.type === 'viewed' && !engaged.has(d.charId.trim()),
  )
  if (hasSilentViewed) return drafts

  const pick = allowed.find((c) => !engaged.has(c.charId.trim()))
  if (!pick) return drafts

  const out = [...drafts]
  const anchors = assignOrganicCharacterAnchors([pick.charId])
  out.push({
    charId: pick.charId,
    type: 'viewed',
    delaySeconds: anchors.get(pick.charId.trim()) ?? 24,
    dwellSeconds: pickOrganicViewedDwellSeconds(pick.charId, 0),
  })
  return out
}

/**
 * 为未点赞/未评论的角色补充静默浏览（viewed），不调用模型。
 */
export function supplementVisitorFootprintDrafts(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
  engagementRules?: ResolvedUserMomentEngagementRules,
): AiMomentInteractionDraft[] {
  if (!allowed.length) return drafts

  const viewedPercent = engagementRules?.silentViewedPercent ?? 100

  const out = [...drafts]
  const engaged = new Set(
    out.filter((d) => d.type === 'like' || d.type === 'comment').map((d) => d.charId.trim()),
  )
  const viewedCharIds = new Set(out.filter((d) => d.type === 'viewed').map((d) => d.charId.trim()))

  const silentCandidates = allowed.filter(
    (c) => !engaged.has(c.charId.trim()) && !viewedCharIds.has(c.charId.trim()),
  )
  const sampledCandidates = silentCandidates.filter((c) =>
    sampleByEngagementPercent(c.charId.trim(), viewedPercent, 'viewed-footprint'),
  )
  const silentOrder = sampledCandidates
    .map((c) => c.charId.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  const anchors = assignOrganicCharacterAnchors(silentOrder)

  for (let i = 0; i < sampledCandidates.length; i += 1) {
    const c = sampledCandidates[i]!
    const id = c.charId.trim()
    out.push({
      charId: c.charId,
      type: 'viewed',
      delaySeconds: anchors.get(id) ?? 20 + i * 17,
      dwellSeconds: pickOrganicViewedDwellSeconds(id, i),
    })
    viewedCharIds.add(id)
  }

  return ensureAtLeastOneViewedDraft(out, allowed, engagementRules)
}

/** 发布链路收尾：为未互动角色补充静默浏览（viewed），与展示开关无关 */
export function finalizeMomentInteractionDrafts(
  drafts: AiMomentInteractionDraft[],
  allowed: AllowedMomentCharacter[],
  options?: {
    playerIdentityId?: string | null
    mentionedCharacterIds?: ReadonlySet<string>
    relationships?: ReadonlyArray<Relationship>
    engagementRules?: ResolvedUserMomentEngagementRules
  },
): AiMomentInteractionDraft[] {
  if (!allowed.length) return stripViewedForEngagedCharacters(drafts)

  const next = injectFallbackEngagementDrafts(drafts, allowed, {
    playerIdentityId: options?.playerIdentityId,
    mentionedCharacterIds: options?.mentionedCharacterIds,
    relationships: options?.relationships ?? [],
    engagementRules: options?.engagementRules,
  })

  return stripViewedForEngagedCharacters(
    supplementVisitorFootprintDrafts(next, allowed, options?.engagementRules),
  )
}

/** 为已有动态追加 viewed 互动（补录历史数据） */
export function appendVisitorFootprintInteractions(
  moment: MomentItemModel,
  allowed: AllowedMomentCharacter[],
  immediate: boolean,
): MomentInteraction[] {
  if (!allowed.length) return []

  const existing = moment.interactions ?? []
  if (existing.some((ix) => ix.type === 'viewed')) return []

  const existingDrafts: AiMomentInteractionDraft[] = existing.map((ix, index) => ({
    charId: ix.charId,
    type: ix.type,
    content: ix.content,
    delaySeconds:
      Number.isFinite(moment.timestamp) && moment.timestamp > 0
        ? Math.max(0, Math.round((ix.visibleAt - moment.timestamp) / 1000))
        : 60 + index * 30,
    dwellSeconds: ix.dwellSeconds,
  }))

  const supplemented = supplementVisitorFootprintDrafts(existingDrafts, allowed)
  const newViewedDrafts = supplemented.filter(
    (d) =>
      d.type === 'viewed' &&
      !existing.some((e) => e.type === 'viewed' && e.charId.trim() === d.charId.trim()),
  )

  if (!newViewedDrafts.length) return []

  const publishedAt =
    Number.isFinite(moment.timestamp) && moment.timestamp > 0 ? moment.timestamp : Date.now()

  return materializeInteractions(newViewedDrafts, publishedAt, immediate)
}

export function mergeMomentInteractions(
  base: MomentInteraction[] | undefined,
  extra: MomentInteraction[],
): MomentInteraction[] {
  if (!extra.length) return base ?? []
  return [...(base ?? []), ...extra]
}
