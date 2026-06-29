import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../newFriendsPersona/idb'
import {
  parseWechatAccountPrivateConversationKey,
  resolvePrivateWeChatStorageConversationKey,
} from '../wechatConversationKey'
import { notifyMemorySummaryAttempt } from '../memory/memorySummaryRetry'
import { loadAccountsBundle, findAccountById, resolveAccountSessionIdentityId } from '../wechatAccountPersistence'
import { peekPrivateChatGroupAnchorFromDockStaging } from '../wechatPrivateGroupAnchorStaging'
import { resolveActivePrivateChatSessionPlayerIdentityId } from '../wechatCharacterPlayerIdentity'
import { migrateLegacyRootPublicUrl } from '../../../../publicAssetUrl'
import { repairCharacterAvatarForBundleImport } from '../../../utils/characterAvatarUrl'
import { buildEligibleLinkedMemoryRosterForDatingAppendix } from '../memory/linkedMemoryEligiblePeers'
import {
  aiPlotBodyFromSnapshotById,
  datingTurnMayNeedLinkedMemoryWrite,
  gatherUnifiedMemoryInputsForDatingTurn,
  lastAiDatingPlotIdInSnapshot,
  linkedMemoryOwnerIdsForGather,
  runDatingLinkedMemoryFallbackWhenNoJsonTail,
  runUnifiedAutoMemorySummaryAfterThreshold,
  tryApplyDatingCombinedMemoryJsonTail,
  type DatingPlotSnapshotItem,
  type UnifiedMemoryGatherResult,
} from '../unifiedMemoryAutoSummary'
import { finalizeWorldBookAfterAutoSummaryPhase, finalizeWorldBookAfterPerAiRound } from '../newFriendsPersona/worldBookAfterSync'
import {
  buildMemoryRelevanceHaystack,
  buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt,
  formatUnsummarizedPrivateChatBlock,
  MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
  MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
} from '../wechatMemoryPromptBlocks'
import {
  formatDatingGroupOnlineInjectScopeFooter,
  formatDatingOnlineInjectScopeFooter,
  formatDatingOnlineTemporalScopePromptRule,
  resolveLastOfflineAiPlotTimestampMs,
  type DatingOnlineInjectScopeMeta,
} from './datingOnlineInjectScope'
import { formatSystemRecordTime, resolveOnlineMessageTimeBoundsForConversation } from '../wechatCrossChannelTimeline'
import { loadStoryTimelinePromptBlock, loadStoryTimelineOpenAnchorsBlockForSummary, rebuildStoryTimelineFromDatingPlots } from '../memory/storyTimelinePersist'
import { buildStoryTimelineCalendarContextBlock, resolveStoryCalendarAnchorFromPlots } from '../memory/storyTimelineCalendarContext'
import {
  buildDatingStoryTimelineFallbackMaterial,
} from '../memory/storyTimelineSummaryFallback'
import { resolveStoryTimelineDeltaWithSeparateAttempt } from '../memory/storyTimelinePerRoundSync'
import { dispatchStoryTimelinePerRoundSyncResult } from '../memory/storyTimelinePerRoundResultEvents'
import {
  matchNpcIdsInParallelEventText,
  resolveParallelEventSummaryDelta,
} from '../memory/storyTimelineParallelFanOut'
import { deleteStoryTimelineLinkedRowsForDatingRound } from '../memory/storyTimelineLinkedFanOut'
import { hasTimelineDeltaContent } from '../memory/storyTimelineTypes'
import { peekWillSummarizeOnNextAiRound } from '../memory/memoryAutoSummaryInterval'
import { isOfflineDatingRowPerRoundMode, isLinkedMemoryAutoSummaryEnabled } from '../memory/memoryRowPerRoundMode'
import {
  clearOfflinePlotContextVectorsForCharacter,
  finalizeDatingPlotListMutationSideEffects,
  resolveDatingPlotLinkedOwnerIds,
} from './datingPlotContextSync'
import { isOpenAiEmptyAssistantParseError, openAiCompatibleChatLenient } from '../newFriendsPersona/ai'
import { formatApiClientError } from '../addFriend/friendRequestApiError'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import type { ApiConfig, ApiConfigCore } from '../../api/types'
import { useCustomization } from '../../../CustomizationContext'
import type {
  BranchOption,
  CharacterArchive,
  CharacterInfo,
  DateMode,
  DatingCardBgMode,
  DatingCardStyle,
  NarrativeGenOptions,
  NarrativePerspective,
  PlotItem,
  PlotDimensionKind,
  PlotDimensionArtifact,
  WorldBookAfterRevertEntry,
} from './types'
import {
  clampDatingLengthTargetChars,
  parsePlotDimensionLengthTarget,
  DATING_AI_HISTORY_PROMPT_MAX,
  DATING_AI_MAX_OUTPUT_TOKENS,
  DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP,
  DATING_AI_REFERENCE_SECTION_CHAR_CAP,
} from './types'
import { extractTimelineDeltaFromMemoryJsonText, extractTimelineSnapshotTextFromAiTextRaw } from './datingPlotTimelineSnapshot'
import { formatOfflineUnsummarizedBlockFromPlotSnapshots } from './loadOfflineDatingPlotsForWechatPrompt'
import { loadDatingNpcNetworkPromptBlock } from './datingNpcNetworkPrompt'
import { splitDatingAssistantOutput, resolveDatingPlotDisplayFromItem } from './plotCoT'
import { extractVnVoiceParamsBlock } from './vnVoiceParamsStrip'
import { PROSE_FORBIDDEN_LEXICON_PROMPT } from '../proseForbiddenLexiconPrompt'
import { buildDatingStyleSystemPrompt } from './lumiThinkingChainRules'
import { getLoreArchiveBuiltinPresetTogglesSnapshot } from '../../../worldbook/worldbookLoreStore'
import { appendAiRegenerateVersion, initialAiPlotVersions, plotWithVersionIndex } from './plotVersions'
import { buildDatingStyleSystemAppend } from './datingStylePrompt'
import { generateDatingBranchesAi } from './datingBranchesAi'
import { generateDatingPlotDimensionAi } from './datingPlotDimensionAi'
import { buildVnBackgroundPromptBlock } from './vnBackgroundCatalog'
import { buildVnAtmospherePromptBlock } from './vnAtmospherePromptBlock'
import { buildVnBgmPromptBlock } from './vnBgmCatalog'
import { buildDatingPlayerInputSemanticsBlock } from './formatDatingPlayerInputForPrompt'
import { buildDatingPresentNetworkCharactersPromptBlock } from './datingNetworkPeerMention'
import { buildUserReactionPromptBlock, summarizeUserReactionForSlimRetry } from './userReactionPrompt'
import type { Character, PlayerIdentity, ScheduleTable } from '../newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../newFriendsPersona/worldBackgroundFormat'
import { buildCharacterCard, buildPhysiquePromptSectionForCharacter, buildScheduleSection, buildWorldBookText } from '../wechatChatAi'
import { buildWorldbookContext } from '../../../worldbook/buildWorldbookContext'
import { getWorldbookLoreEntriesSnapshot } from '../../../worldbook/worldbookLoreStore'
import { resolveEffectiveDanmakuVisuals } from '../danmakuResolve'
import {
  buildDatingCombinedMemoryUserAppendix,
  requestWeChatDanmakuVarietyShow,
  splitDatingAiResponseAndUnifiedMemoryJson,
  type ChatTranscriptTurn,
} from '../wechatChatAi'
import {
  applyWorldBookAfterPatchesToCharacter,
  applyWorldBookAfterRevertEntries,
  buildChatAfterWorldBookDynamicSection,
  collectWorldBookAfterRevertSnapshot,
  extractWorldBookAfterPatchBlock,
  hasChatAfterWorldBookItems,
  listChatAfterWorldBookItems,
  sanitizeWorldBookAfterRevertEntries,
  WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT,
} from '../newFriendsPersona/worldBookAfterPatch'
import { emitDatingOfflineDanmakuLines } from './datingOfflineDanmakuBridge'
import {
  beginDatingPlotContentHint,
  beginDatingPlotGeneration,
  DATING_PLOT_GENERATION_COMPLETE_EVENT,
  dispatchDatingPlotGenerationComplete,
  dispatchDatingPlotGenerationError,
  endDatingPlotContentHint,
  endDatingPlotGeneration,
  isDatingPlotGenerating,
  subscribeDatingPlotGeneration,
} from './datingPlotGenerationEvents'
import { buildUnsummarizedOfflineDatingText } from './loadOfflineDatingPlotsForWechatPrompt'
import {
  buildWorldBookAfterChatTrace,
  buildWorldBookAfterPatchRowsFromSingleCharacter,
  publishDatingOfflineMemoryTrace,
} from '../memoryTracePublisher'
import {
  buildDatingCharUserPerspectiveDirective,
  expandCharUserPlaceholders,
  resolveCharUserNamesForPrompt,
  type CharUserNames,
} from '../charUserPlaceholders'
import {
  buildDatingEpilogueRelationshipBaselineBlock,
  buildDatingWorldBookAfterPatchOutputAppendix,
  countAiPlotsInDatingHistory,
  filterDatingWorldBookAfterPatches,
  isEarlyDatingPlotRound,
} from './datingEpilogueRelationshipRules'

/** 约会 AI 单次生成返回值：`text` 与剧情存档一致（已去尾声延展 JSON 块）；`worldBookAfterRevertEntries` 仅当本轮成功写库补丁时非空 */
type DatingAiGenResult = {
  text: string
  worldBookAfterRevertEntries?: WorldBookAfterRevertEntry[]
}

const STORAGE_KEY = 'wechat-dating-archives-v1'
const CHARACTERS_KEY = 'wechat-dating-characters-v1'

/** VN 撤回上一轮后写入 sessionStorage，由 DatingStoryPage 将气泡跳到上一轮 AI 末尾 */
export function vnRollbackJumpStorageKey(characterId: string): string {
  return `wechat-dating-vn-rollback-jump:${String(characterId || '').trim()}`
}
/** 约会续写请求里「最近剧情 / 场景人物线索」取自剧情历史的末尾条数 */
const DATING_AI_PLOT_HISTORY_MAX = 5
/** 单条剧情写入 prompt 的正文上限（去思维链后） */
const DATING_AI_HISTORY_PER_PLOT_CAP = 12_000
/** 分支续写上下文（尾部剧情摘录） */
const DATING_AI_BRANCH_TAIL_MAX = 40_000

async function notifyParallelSummaryTableWritten(
  displayName: string,
  protagonistId: string,
  plot: PlotItem,
): Promise<void> {
  const parallel = plot.parallelEvent?.content?.trim()
  if (!parallel || plot.type !== 'ai') return
  const npcCount = (await matchNpcIdsInParallelEventText(parallel, protagonistId, [protagonistId])).length
  const hero = displayName.trim() || '角色'
  const successMessage =
    npcCount > 0
      ? `已为「${hero}」写入屏外平行摘要至剧情摘要表（含 ${npcCount} 条人脉在场行）。`
      : `已为「${hero}」写入屏外平行摘要至剧情摘要表。`
  dispatchStoryTimelinePerRoundSyncResult({
    ok: true,
    displayName: hero,
    successMessage,
  })
}

/** 约会合并记忆附录：存档主角 id + 可写入 linked 的人脉 NPC / 已绑定主角 */
type DatingTurnModelExtras = {
  unifiedMemoryAppendix?: string
  regeneratingWorldBookBaseline?: boolean
}

/** 约会单轮 completion：仅正文；合并记忆 JSON 在落库后由 finalize 后台写。 */
async function buildDatingTurnModelExtras(params: {
  char: CharacterInfo
  plotsSnapshotForGather: DatingPlotSnapshotItem[]
  sessionPlayerIdentityId?: string | null
  wechatAccountId?: string | null
  conversationKey?: string | null
  regeneratingWorldBookBaseline?: boolean
  /** 重新生成：不计入自动总结计轮，附录按「仅 timeline」档 */
  skipMemoryRoundBump?: boolean
}): Promise<{ datingExtras: DatingTurnModelExtras; memoryGather: UnifiedMemoryGatherResult | null }> {
  const regeneratingWorldBookBaseline = params.regeneratingWorldBookBaseline === true
  const memSettings = await personaDb.getMemorySettings()
  const linkedOn = isLinkedMemoryAutoSummaryEnabled(memSettings)
  const datingMemOn = memSettings.autoSummaryEnabled !== false
  if (!datingMemOn && !linkedOn) {
    return {
      datingExtras: regeneratingWorldBookBaseline ? { regeneratingWorldBookBaseline: true } : {},
      memoryGather: null,
    }
  }

  const gather = await gatherUnifiedMemoryInputsForDatingTurn({
    characterId: params.char.id,
    characterRealName: params.char.realName,
    datingPlotsSnapshot: params.plotsSnapshotForGather,
    sessionPlayerIdentityId: params.sessionPlayerIdentityId ?? null,
    wechatAccountId: params.wechatAccountId ?? null,
    conversationKey: params.conversationKey ?? null,
  })
  if (!gather) {
    return {
      datingExtras: regeneratingWorldBookBaseline ? { regeneratingWorldBookBaseline: true } : {},
      memoryGather: null,
    }
  }

  const ck = gather.conversationKey.trim()
  const summaryRoundDue =
    datingMemOn &&
    params.skipMemoryRoundBump !== true &&
    !isOfflineDatingRowPerRoundMode(memSettings) &&
    peekWillSummarizeOnNextAiRound(memSettings, ck)

  let unifiedMemoryAppendix = ''
  try {
    const roster = await buildEligibleLinkedMemoryRosterForDatingAppendix(
      gather.plotsArchiveId,
      params.char.id,
    )
    const storyCalendarAnchor = resolveStoryCalendarAnchorFromPlots(params.plotsSnapshotForGather)
    const calendarContextBlock = await buildStoryTimelineCalendarContextBlock({
      peerCharacterId: params.char.id,
      sessionPlayerIdentityId: params.sessionPlayerIdentityId,
      storyCalendarAnchor,
    })
    const priorOpenAnchorsBlock = await loadStoryTimelineOpenAnchorsBlockForSummary(params.char.id)
    unifiedMemoryAppendix = buildDatingCombinedMemoryUserAppendix({
      onlineTranscript: gather.onlineTranscript,
      peerLabel: params.char.realName.trim() || '对方',
      offlinePriorBlock: gather.offlineBlock,
      npcLinkedExcerptsBlock: gather.npcLinked.block,
      datingPeerCharacterId: params.char.id,
      eligibleLinkedNpcRoster: roster,
      summaryRoundDue,
      calendarContextBlock,
      priorOpenAnchorsBlock,
    })
  } catch {
    unifiedMemoryAppendix = ''
  }

  return {
    datingExtras: {
      ...(regeneratingWorldBookBaseline ? { regeneratingWorldBookBaseline: true } : {}),
      ...(unifiedMemoryAppendix.trim() ? { unifiedMemoryAppendix } : {}),
    },
    memoryGather: gather,
  }
}


function stripPlotBodyForPrompt(plot: PlotItem): string {
  const raw = String(plot.content || '').trim()
  if (plot.type === 'player') return raw
  const prose = splitDatingAssistantOutput(raw).content.trim()
  /** VN 轮次存盘的正文后常带语音参数 JSON；拼进「最近剧情」会巨幅膨胀 prompt（尤其 VN→普通 续写时） */
  return extractVnVoiceParamsBlock(prose).cleanedText.trim()
}

function formatRecentPlotsForPrompt(history: PlotItem[], characterRealName: string, maxTotalChars: number): string {
  const tail = history.slice(-DATING_AI_PLOT_HISTORY_MAX)
  const parts: string[] = []
  for (const x of tail) {
    let body = stripPlotBodyForPrompt(x)
    if (body.length > DATING_AI_HISTORY_PER_PLOT_CAP) {
      body = `${body.slice(0, DATING_AI_HISTORY_PER_PLOT_CAP)}…`
    }
    const label = x.type === 'player' ? '我' : characterRealName
    const ts =
      typeof x.timestamp === 'number' && Number.isFinite(x.timestamp) ? x.timestamp : null
    const prefix = ts != null ? `[${formatSystemRecordTime(ts)}] ` : ''
    parts.push(`${prefix}${label}：${body}`)
  }
  const joined = parts.join('\n')
  if (joined.length <= maxTotalChars) return joined
  const marker = '…【上下文过长：以下保留最近剧情末尾，更早部分已省略】\n'
  const budget = Math.max(480, maxTotalChars - marker.length)
  return marker + joined.slice(-budget)
}

/** 参考资料段落防爆裁剪：默认保留末尾（适用于「按时间拼接、越后越新」的摘录） */
function clipDatingReferenceTail(raw: string, cap: number, label: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t.length <= cap) return t
  const marker = `…【${label}：过长已保留末尾最近内容】\n`
  const budget = Math.max(0, cap - marker.length)
  return marker + t.slice(-budget)
}

/** 参考资料段落防爆裁剪：保留开头（适用于结构化记忆条） */
function clipDatingReferenceHead(raw: string, cap: number, label: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  if (t.length <= cap) return t
  return `${t.slice(0, cap)}\n…【${label}：过长已截断】`
}

function plotsToDanmakuTranscript(plots: PlotItem[], characterRealName: string): ChatTranscriptTurn[] {
  return plots.map((p) => ({
    id: p.id,
    from: p.type === 'player' ? 'self' : 'other',
    text: stripPlotBodyForPrompt(p).slice(0, 8000),
    speakerLabel: p.type === 'player' ? undefined : characterRealName,
  }))
}

type ArchivesStore = Record<string, CharacterArchive>

type Ctx = {
  characters: CharacterInfo[]
  currentCharacterId: string
  currentCharacter: CharacterInfo
  currentArchive: CharacterArchive
  loading: boolean
  setCurrentCharacterId: (id: string) => void
  updateCharacter: (id: string, patch: Partial<Omit<CharacterInfo, 'id'>>) => void
  setMode: (mode: DateMode) => void
  setBranchEnabled: (enabled: boolean) => void
  setGodPerspective: (v: boolean) => void
  /** 主角色不在场：只写玩家与 NPC 场景，约会主角色不得出场（与上帝视角互斥） */
  setMainCharacterOffstage: (v: boolean) => void
  setVnVoiceDisabled: (disabled: boolean) => void
  /** 普通剧情：导演模式（输入为生成指引，非既成事实） */
  setDirectorMode: (v: boolean) => void
  /** 抢话：允许 AI 代写玩家当轮言行 */
  setAutoUserReaction: (v: boolean) => void
  /** 发送时同轮生成平行事件 */
  setGenerateParallelOnSend: (v: boolean) => void
  /** 发送时同轮生成 IF 线 */
  setGenerateIfLineOnSend: (v: boolean) => void
  /** 线下普通模式：每轮 AI 后是否拉取弹幕 */
  setOfflineDanmakuEnabled: (enabled: boolean) => void
  /** 持久化当前角色的剧情生成目标字数（与 DatingStoryPage 输入框同步） */
  setDatingLengthTargetChars: (chars: number) => void
  /** @returns 是否已成功写入 AI 剧情（失败时为 false，便于界面保留输入并重试） */
  sendPlayerInput: (text: string, perspective?: NarrativePerspective, genOptions?: NarrativeGenOptions) => Promise<boolean>
  /** 选中分支卡片：写入续写执导，由页面把 card 注入输入框 */
  stageBranchChoice: (option: BranchOption) => void
  /** 模型正在生成 4 条分支（仅分支开关开启时） */
  branchesLoading: boolean
  resetCurrentArchive: () => void
  rollbackBranchNode: () => void
  /** VN：删除本轮「玩家输入 + AI 回复」，回到上一轮并将气泡置于该轮末句（由界面同步进度） */
  vnRollbackLastRound: () => boolean
  savePlotText: () => string
  allArchives: ArchivesStore
  /** 正在重新生成的剧情块 id（仅该块显示加载态，不锁全页 loading） */
  regeneratingPlotId: string | null
  updatePlotItem: (
    plotId: string,
    patch: Partial<
      Pick<
        PlotItem,
        | 'content'
        | 'logicPass'
        | 'planSummary'
        | 'versions'
        | 'versionLogicPasses'
        | 'versionTimelineSnapshots'
        | 'timelineSnapshot'
        | 'currentVersionIndex'
        | 'parallelEvent'
        | 'ifLine'
      >
    >,
  ) => void
  /** 切换某条 AI 剧情的历史版本展示（不删数据） */
  setPlotVersionIndex: (plotId: string, index: number) => void
  /** 删除一条剧情节点 */
  deletePlotItem: (plotId: string) => void
  regenerateAiPlot: (
    plotId: string,
    perspective?: NarrativePerspective,
    genOptions?: NarrativeGenOptions,
    bias?: string,
  ) => Promise<void>
  /** 为某条 AI 剧情生成平行事件 / IF 线（存于该 plot 条目，可反复打开查看） */
  generatePlotDimension: (
    plotId: string,
    kind: PlotDimensionKind,
    writingGuide: string,
    lengthTargetChars: number,
    perspective?: NarrativePerspective,
  ) => Promise<void>
}

const DatingContext = createContext<Ctx | null>(null)

const EMPTY_CHARACTERS: CharacterInfo[] = []
const FALLBACK_CHARACTER: CharacterInfo = {
  id: '',
  avatarUrl: '',
  realName: '未命名',
  pinyin: 'UNKNOWN',
  age: 22,
  heightCm: 170,
  weightKg: 55,
  zodiac: '未知',
  birthdayMD: '01-01',
  motto: '',
  cardStyle: {},
  identityTags: [],
  signature: '',
  prompt: '',
}

function parseHeightCm(raw: string): number {
  const t = String(raw || '').trim().toLowerCase()
  const m = t.match(/(\d+(?:\.\d+)?)/)
  if (!m) return 170
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return 170
  const cm = n < 3 ? n * 100 : n
  return Math.max(120, Math.min(230, Math.round(cm)))
}

function parseWeightKg(raw: string): number {
  const t = String(raw || '').trim().toLowerCase()
  const m = t.match(/(\d+(?:\.\d+)?)/)
  if (!m) return 55
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return 55
  return Math.max(30, Math.min(200, Math.round(n)))
}

function toPinyinLike(name: string): string {
  const s = String(name || '').trim()
  if (!s) return 'UNKNOWN'
  return s
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .slice(0, 24)
}

function extractPainPointsForTags(row: Character): string[] {
  const direct = (row.painPoints ?? [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
  if (direct.length) return [...new Set(direct)].slice(0, 3)

  // 兜底：从世界书中提取“雷点/禁忌/讨厌”相关条目
  const fromBooks: string[] = []
  for (const wb of row.worldBooks ?? []) {
    for (const it of wb.items ?? []) {
      const name = String(it.name || '').trim()
      const kw = String(it.keywords || '').trim()
      const content = String(it.content || '').trim()
      const hit = /雷点|禁忌|讨厌|不喜欢|底线/i.test(`${name} ${kw}`)
      if (!hit || !content) continue
      const chunks = content
        .split(/[，,、。；;\/\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const c of chunks) {
        fromBooks.push(c)
        if (fromBooks.length >= 6) break
      }
      if (fromBooks.length >= 6) break
    }
    if (fromBooks.length >= 6) break
  }
  return [...new Set(fromBooks)].slice(0, 3)
}

function normalizeBirthdayMD(v: string): string {
  const t = String(v || '').trim()
  if (!t) return '01-01'
  const m = t.match(/^(\d{1,2})-(\d{1,2})$/)
  if (!m) return '01-01'
  const mm = Math.max(1, Math.min(12, Number(m[1])))
  const dd = Math.max(1, Math.min(31, Number(m[2])))
  return `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function resolveDatingLiveAvatarUrl(row: Character): string {
  return repairCharacterAvatarForBundleImport({
    avatarUrl: migrateLegacyRootPublicUrl(row.avatarUrl?.trim() || ''),
  })
}

function toCharacterInfo(row: Character, remarkName: string): CharacterInfo {
  const realName = row.name?.trim() || remarkName || '未命名'
  const baseTags = [row.identity?.trim(), row.mbti?.trim()].filter(Boolean) as string[]
  const painPointTags = extractPainPointsForTags(row)
    .map((x) => `雷点·${x}`)
  const tags = [...new Set([...baseTags, ...painPointTags])].slice(0, 8)
  return {
    id: row.id,
    avatarUrl: resolveDatingLiveAvatarUrl(row),
    realName,
    pinyin: toPinyinLike(realName),
    age: typeof row.age === 'number' && Number.isFinite(row.age) ? row.age : 22,
    heightCm: parseHeightCm(row.height || ''),
    weightKg: parseWeightKg(row.weight || ''),
    zodiac: row.zodiac?.trim() || '未知',
    birthdayMD: normalizeBirthdayMD(row.birthdayMD || ''),
    motto: row.motto?.trim() || '慢一点，也能抵达。',
    cardStyle: {},
    identityTags: tags.length ? tags : ['角色', '约会对象'],
    signature: row.wechatSignature?.trim() || row.bio?.trim() || '一起把今天过好。',
    prompt:
      row.bio?.trim() ||
      `你是${realName}，身份是${row.identity || '未设定'}。语气自然克制，重视真实细节与情绪节奏，不油腻不悬浮。`,
  }
}

function mergeSavedCharacters(baseChars: CharacterInfo[], parsed: unknown | null): CharacterInfo[] {
  try {
    if (!baseChars.length) return []
    if (parsed == null || !Array.isArray(parsed)) return baseChars
    const byId = new Map(baseChars.map((c) => [c.id, c]))
    const res: CharacterInfo[] = []
    const isBgMode = (x: unknown): x is DatingCardBgMode => x === 'solid' || x === 'gradient' || x === 'image'
    const sanitizeCardStyle = (base: CharacterInfo, saved: any): Partial<DatingCardStyle> => {
      const cs = saved?.cardStyle
      if (!cs || typeof cs !== 'object') return base.cardStyle ?? {}
      const out: Partial<DatingCardStyle> = {}
      if (typeof cs.showContent === 'boolean') out.showContent = cs.showContent
      if (typeof cs.textColor === 'string') out.textColor = cs.textColor
      if (isBgMode(cs.bgMode)) out.bgMode = cs.bgMode
      if (typeof cs.solidColor === 'string') out.solidColor = cs.solidColor
      if (typeof cs.gradientFrom === 'string') out.gradientFrom = cs.gradientFrom
      if (typeof cs.gradientTo === 'string') out.gradientTo = cs.gradientTo
      if (typeof cs.gradientAngle === 'number') out.gradientAngle = cs.gradientAngle
      if (typeof cs.imageUrl === 'string') out.imageUrl = migrateLegacyRootPublicUrl(cs.imageUrl)
      if (typeof cs.glass === 'boolean') out.glass = cs.glass
      if (typeof cs.glassBlur === 'number') out.glassBlur = cs.glassBlur
      if (typeof cs.bgOpacity === 'number') out.bgOpacity = cs.bgOpacity
      if (isBgMode(cs.tagBgMode)) out.tagBgMode = cs.tagBgMode
      if (typeof cs.tagSolidColor === 'string') out.tagSolidColor = cs.tagSolidColor
      if (typeof cs.tagGradientFrom === 'string') out.tagGradientFrom = cs.tagGradientFrom
      if (typeof cs.tagGradientTo === 'string') out.tagGradientTo = cs.tagGradientTo
      if (typeof cs.tagGradientAngle === 'number') out.tagGradientAngle = cs.tagGradientAngle
      if (typeof cs.tagImageUrl === 'string') out.tagImageUrl = migrateLegacyRootPublicUrl(cs.tagImageUrl)
      if (typeof cs.tagBgOpacity === 'number') out.tagBgOpacity = cs.tagBgOpacity
      if (typeof cs.tagTextColor === 'string') out.tagTextColor = cs.tagTextColor
      if (typeof cs.tagRadius === 'number') out.tagRadius = cs.tagRadius
      return { ...(base.cardStyle ?? {}), ...out }
    }

    for (const base of baseChars) {
      const saved = (parsed as any[]).find((x) => x?.id === base.id)
      if (!saved || typeof saved !== 'object') {
        res.push(base)
        continue
      }
      const birthdayRaw = typeof (saved as any).birthdayMD === 'string' ? ((saved as any).birthdayMD as string) : ''
      const birthday = /^\d{1,2}-\d{1,2}$/.test(birthdayRaw.trim()) ? birthdayRaw.trim() : base.birthdayMD
      res.push({
        ...base,
        /** 头像以人设库为准，与微信/朋友圈换头像同步；本地缓存仅保留卡片样式等约会页字段 */
        avatarUrl: base.avatarUrl,
        realName: typeof saved.realName === 'string' ? saved.realName : base.realName,
        pinyin: typeof saved.pinyin === 'string' ? saved.pinyin : base.pinyin,
        age: typeof saved.age === 'number' ? saved.age : base.age,
        heightCm: typeof saved.heightCm === 'number' ? saved.heightCm : base.heightCm,
        weightKg: typeof saved.weightKg === 'number' ? saved.weightKg : base.weightKg,
        zodiac: typeof (saved as any).zodiac === 'string' ? ((saved as any).zodiac as string) : base.zodiac,
        birthdayMD: birthday,
        motto: typeof (saved as any).motto === 'string' ? ((saved as any).motto as string) : base.motto,
        cardStyle: sanitizeCardStyle(base, saved),
        identityTags: (() => {
          const savedTags = Array.isArray(saved.identityTags)
            ? saved.identityTags.filter((t: unknown): t is string => typeof t === 'string')
            : []
          // 关键：旧缓存标签与最新人设推导标签做并集，避免雷点标签被旧数据覆盖丢失
          const merged = [...new Set([...savedTags, ...base.identityTags].map((x) => String(x || '').trim()).filter(Boolean))]
          return merged.slice(0, 8)
        })(),
        signature: typeof saved.signature === 'string' ? saved.signature : base.signature,
        prompt: typeof saved.prompt === 'string' ? saved.prompt : base.prompt,
      })
    }
    // 保底：若本地存了新 id（未来扩展），忽略它，仍按默认顺序渲染
    return res.length ? res : [...byId.values()]
  } catch {
    return baseChars
  }
}

function buildDefaultStore(chars: CharacterInfo[]): ArchivesStore {
  const res: ArchivesStore = {}
  for (const c of chars) res[c.id] = createDefaultArchive(c)
  return res
}

function mergeArchives(chars: CharacterInfo[], parsed: unknown | null): ArchivesStore {
  try {
    if (parsed == null || typeof parsed !== 'object') return buildDefaultStore(chars)
    const parsedArchive = parsed as Partial<ArchivesStore>
    const merged = buildDefaultStore(chars)
    for (const c of chars) {
      const saved = parsedArchive[c.id]
      if (!saved) continue
      merged[c.id] = {
        ...merged[c.id],
        ...saved,
        characterId: c.id,
        plots: Array.isArray(saved.plots) ? (saved.plots as PlotItem[]) : merged[c.id].plots,
        pendingBranches: Array.isArray(saved.pendingBranches)
          ? (saved.pendingBranches as BranchOption[])
          : merged[c.id].pendingBranches,
        branchNodeHistory: Array.isArray(saved.branchNodeHistory)
          ? (saved.branchNodeHistory as number[])
          : [],
        godPerspective:
          typeof saved.godPerspective === 'boolean' ? saved.godPerspective : merged[c.id].godPerspective,
        mainCharacterOffstage:
          typeof (saved as { mainCharacterOffstage?: unknown }).mainCharacterOffstage === 'boolean'
            ? (saved as { mainCharacterOffstage: boolean }).mainCharacterOffstage
            : merged[c.id].mainCharacterOffstage,
        vnVoiceDisabled:
          typeof (saved as any).vnVoiceDisabled === 'boolean'
            ? ((saved as any).vnVoiceDisabled as boolean)
            : merged[c.id].vnVoiceDisabled,
        directorMode: (() => {
          const savedDm = (saved as { directorMode?: unknown }).directorMode
          if (typeof savedDm === 'boolean') return savedDm
          const legacyParaphrase = (saved as { vnCustomInputParaphrase?: unknown }).vnCustomInputParaphrase
          if (typeof legacyParaphrase === 'boolean') return legacyParaphrase
          return merged[c.id].directorMode
        })(),
        autoUserReaction:
          typeof (saved as { autoUserReaction?: unknown }).autoUserReaction === 'boolean'
            ? (saved as { autoUserReaction: boolean }).autoUserReaction
            : merged[c.id].autoUserReaction,
        offlineDanmakuEnabled:
          typeof (saved as any).offlineDanmakuEnabled === 'boolean'
            ? (saved as any).offlineDanmakuEnabled
            : merged[c.id].offlineDanmakuEnabled,
        branchContinuationHint:
          typeof saved.branchContinuationHint === 'string' && saved.branchContinuationHint.trim()
            ? saved.branchContinuationHint.trim()
            : merged[c.id].branchContinuationHint,
        datingLengthTargetChars: (() => {
          const raw = (saved as { datingLengthTargetChars?: unknown }).datingLengthTargetChars
          if (typeof raw !== 'number' || !Number.isFinite(raw)) return merged[c.id].datingLengthTargetChars
          return clampDatingLengthTargetChars(raw)
        })(),
        generateParallelOnSend:
          typeof (saved as { generateParallelOnSend?: unknown }).generateParallelOnSend === 'boolean'
            ? (saved as { generateParallelOnSend: boolean }).generateParallelOnSend
            : merged[c.id].generateParallelOnSend,
        generateIfLineOnSend:
          typeof (saved as { generateIfLineOnSend?: unknown }).generateIfLineOnSend === 'boolean'
            ? (saved as { generateIfLineOnSend: boolean }).generateIfLineOnSend
            : merged[c.id].generateIfLineOnSend,
      }
    }
    return merged
  } catch {
    return buildDefaultStore(chars)
  }
}

/** 后台剧情落盘：不依赖 React 挂载，避免切走约会页后生成结果丢失 */
async function patchDatingArchiveInKv(
  characterId: string,
  characters: CharacterInfo[],
  updater: (prev: CharacterArchive) => CharacterArchive,
): Promise<ArchivesStore> {
  const archRaw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
  const store = mergeArchives(characters, archRaw)
  const baseChar = characters.find((c) => c.id === characterId) ?? FALLBACK_CHARACTER
  const base = store[characterId] ?? createDefaultArchive(baseChar)
  const nextStore = { ...store, [characterId]: updater(base) }
  await personaDb.setPhoneKv(STORAGE_KEY, nextStore)
  return nextStore
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 模型返回空白/解析失败时的 completion 重试次数（含一次精简上下文） */
const DATING_EMPTY_COMPLETION_ATTEMPTS = 3
const DATING_PLOT_MIN_RESPONSE_CHARS = 48

const STYLE_HINT =
  '旁白直写；对白只能用双引号"..."；内心OS：**仅**用一对英文半角 ** 包裹**一整句**可读心思（与界面渲染一致）；**禁止**星号内只有「我……」「我…」占位；**禁止**在 ** 外单独缀一行「我……」；上帝视角时旁白用他/她写约会对象与 NPC，他人心念/视线指向玩家须用「你」勿用身份卡姓名；OS 内「我」仍指约会对象且须语义连贯，勿在 OS 里写第三人称评价串戏。' +
  '对白口吻与微信私聊同角色对齐：口语短句、活人感；对白里勿用（）堆神态。'

function extractAiPlotSections(raw: string): { logicPass: string; planSummary: string; content: string } {
  return splitDatingAssistantOutput(raw)
}

function buildSlimDatingPlotChatMessages(params: {
  charUserDirective: string
  character: CharacterInfo
  userDemand: string
  userText: string | undefined
  historyBlock: string
  perspectiveRule: string
  perspectiveStrictRule: string
  userReactionRule: string
  userReactionSlimHint: string
  lengthRule: string
  charUserNames: CharUserNames
  godPerspective?: boolean
  mainCharacterOffstage?: boolean
}): Array<{ role: 'system' | 'user'; content: string }> {
  const historyTail = clipDatingReferenceTail(params.historyBlock, 6500, '最近剧情')
  const slimSystem = expandCharUserPlaceholders(
    `${params.charUserDirective}【约会剧情·精简续写】\n` +
      `${params.perspectiveRule}\n` +
      (params.perspectiveStrictRule ? `${params.perspectiveStrictRule}\n` : '') +
      `${params.userReactionRule}\n` +
      `【当轮抢话·精简提醒】${params.userReactionSlimHint}\n` +
      `${params.lengthRule}\n` +
      `【说明】上一轮请求上下文过长，材料已压缩。仍须先输出 \`<thinking>\`（可缩短至约 600 字内）再写正文。\n${PROSE_FORBIDDEN_LEXICON_PROMPT}`,
    params.charUserNames,
  )
  const inputLabel = params.godPerspective
    ? '屏外剧情引导'
    : params.mainCharacterOffstage
      ? '玩家与NPC场景输入'
      : '玩家输入'
  const slimUser = expandCharUserPlaceholders(
    `角色：${params.character.realName}；设定摘要=${params.character.prompt.slice(0, 900)}\n` +
      `${params.userDemand}\n` +
      `【${inputLabel}】\n${params.userText?.trim() || '（开场，无输入）'}\n\n` +
      `最近剧情（节选，按时间序，**末尾最新优先**）：\n${historyTail || '（无）'}\n\n` +
      `【精简续写·方向】须与玩家输入及最近剧情末尾一致；禁止拾取主客体相反的对称旧梗（如吃醋/质问方向翻转）。\n\n` +
      `请直接续写剧情，勿输出空行或仅占位符。`,
    params.charUserNames,
  )
  return [
    { role: 'system', content: slimSystem },
    { role: 'user', content: slimUser },
  ]
}

async function requestDatingPlotCompletion(params: {
  apiConfig: { apiUrl?: string; apiKey?: string; modelId?: string }
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  slimMessages: Array<{ role: 'system' | 'user'; content: string }>
  maxTokens: number
  timeoutPromise: Promise<string>
  charUserNames: CharUserNames
}): Promise<string> {
  const retryUser = expandCharUserPlaceholders(
    '你上一则回复几乎为空（仅空白或换行），未满足剧情要求。请重新输出：完整 `<thinking>` 思维链 + 正文剧情；不要只输出一个标点或换行。',
    params.charUserNames,
  )
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < DATING_EMPTY_COMPLETION_ATTEMPTS; attempt++) {
    const msgs =
      attempt === 0
        ? params.messages
        : attempt === 1
          ? [...params.messages, { role: 'user' as const, content: retryUser }]
          : params.slimMessages
    try {
      const raw = await Promise.race([
        openAiCompatibleChatLenient(params.apiConfig as any, msgs, {
          temperature: 0.68,
          max_tokens: params.maxTokens,
        }),
        params.timeoutPromise,
      ])
      const trimmed = raw.trim()
      if (trimmed.length >= DATING_PLOT_MIN_RESPONSE_CHARS) return raw
      lastErr = new Error(`模型返回正文过短（约 ${trimmed.length} 字）`)
    } catch (e) {
      if (e instanceof Error && e.message.includes('剧情生成超时')) throw e
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (!isOpenAiEmptyAssistantParseError(e) && attempt === 0) throw lastErr
    }
    console.warn(`[dating] plot completion empty, retry ${attempt + 1}/${DATING_EMPTY_COMPLETION_ATTEMPTS}`)
  }
  throw new Error(
    lastErr?.message?.includes('过短') || isOpenAiEmptyAssistantParseError(lastErr)
      ? `模型连续 ${DATING_EMPTY_COMPLETION_ATTEMPTS} 次几乎未返回正文（多为输入上下文过长或线路限流）。已自动精简材料重试仍失败：请换更稳定的聊天模型，或减少未总结微信摘录后重试。`
      : lastErr?.message || '剧情生成失败',
  )
}

async function timelinePersistFieldsFromAiTextRaw(
  aiTextRaw: string,
  recordedAtMs: number,
  opts?: {
    apiConfig?: ApiConfig | null
    plotBody?: string
    offlineBlock?: string
    characterId?: string
    characterRealName?: string
    /** 侧幕叙写：主角色未在场 */
    mainCharacterOffstage?: boolean
  },
) {
  const { memoryJsonText } = splitDatingAiResponseAndUnifiedMemoryJson(aiTextRaw)
  const timelineSnap = extractTimelineSnapshotTextFromAiTextRaw(aiTextRaw, recordedAtMs)
  let timelineDelta = extractTimelineDeltaFromMemoryJsonText(memoryJsonText)
  const plotBody =
    String(opts?.plotBody || '').trim() ||
    extractAiPlotSections(splitDatingAiResponseAndUnifiedMemoryJson(aiTextRaw).plotRaw).content.trim()
  if (!timelineDelta || !hasTimelineDeltaContent(timelineDelta)) {
    timelineDelta = await resolveStoryTimelineDeltaWithSeparateAttempt({
      chatFallback: opts?.apiConfig ?? null,
      inlineDelta: timelineDelta,
      fallback: {
        materialBlock: buildDatingStoryTimelineFallbackMaterial({
          offlineBlock: opts?.offlineBlock,
          plotBody,
        }),
        peerCharacterId: opts?.characterId,
        latestRoundBody: plotBody,
      },
      displayName: opts?.characterRealName?.trim() || '角色',
      notifyOnFailure: true,
    })
  }
  if (timelineDelta && opts?.mainCharacterOffstage) {
    timelineDelta = { ...timelineDelta, side_perspective: true }
  }
  return { timelineSnap, timelineDelta }
}

function aiPlotPersistFields(
  parsed: { logicPass: string; planSummary: string; content: string },
  timelineSnapshot?: string,
  timelineDelta?: import('../memory/storyTimelineTypes').StoryTimelineSummaryDelta,
): Pick<
  PlotItem,
  | 'content'
  | 'logicPass'
  | 'planSummary'
  | 'versions'
  | 'versionLogicPasses'
  | 'versionTimelineSnapshots'
  | 'versionTimelineDeltas'
  | 'currentVersionIndex'
  | 'timelineSnapshot'
  | 'timelineDelta'
> {
  const base = initialAiPlotVersions(
    parsed.content,
    parsed.logicPass || undefined,
    parsed.planSummary,
    timelineSnapshot,
    timelineDelta,
  )
  const snap = timelineSnapshot?.trim() || undefined
  const delta = timelineDelta && Object.keys(timelineDelta).length ? timelineDelta : undefined
  return {
    ...base,
    timelineSnapshot: snap,
    timelineDelta: delta,
    versionTimelineSnapshots: snap ? [snap] : [undefined],
    versionTimelineDeltas: delta ? [delta] : [undefined],
  }
}

function createDefaultArchive(character: CharacterInfo): CharacterArchive {
  return {
    characterId: character.id,
    plots: [],
    currentProgress: 0,
    modePreference: 'normal',
    godPerspective: false,
    mainCharacterOffstage: false,
    branchEnabled: false,
    offlineDanmakuEnabled: false,
    vnVoiceDisabled: false,
    directorMode: false,
    autoUserReaction: false,
    lastDateAt: null,
    pendingBranches: [],
    branchNodeHistory: [],
  }
}

async function loadPlayerIdentityForDating(
  characterId: string,
  sessionPlayerIdentityId?: string | null,
): Promise<PlayerIdentity | null> {
  const sid = String(sessionPlayerIdentityId ?? '').trim()
  if (sid && sid !== '__none__') {
    const sessionRow = await personaDb.getPlayerIdentity(sid).catch(() => null)
    if (sessionRow) return sessionRow
  }
  const cid = characterId.trim()
  if (!cid) return null
  const row = await personaDb.getCharacter(cid).catch(() => null)
  const bound = row?.playerIdentityId?.trim()
  if (bound && bound !== '__none__') {
    const boundRow = await personaDb.getPlayerIdentity(bound).catch(() => null)
    if (boundRow) return boundRow
  }
  const appId = (await personaDb.getCurrentIdentityId()).trim()
  if (appId && appId !== '__none__') {
    return (await personaDb.getPlayerIdentity(appId).catch(() => null)) ?? null
  }
  return null
}

async function enrichAiPlotWithOptionalDimensions(params: {
  char: CharacterInfo
  archiveSnap: CharacterArchive
  aiPlot: PlotItem
  plotsWithAi: PlotItem[]
  anchorBody: string
  mergedGen?: NarrativeGenOptions
  perspective: NarrativePerspective
  apiConfig: ApiConfigCore | null
}): Promise<PlotItem> {
  const wantParallel =
    params.mergedGen?.generateParallelOnSend ?? params.archiveSnap.generateParallelOnSend ?? false
  const wantIf = params.mergedGen?.generateIfLineOnSend ?? params.archiveSnap.generateIfLineOnSend ?? false
  if (!wantParallel && !wantIf) return params.aiPlot

  const tail = formatRecentPlotsForPrompt(params.plotsWithAi, params.char.realName, 2200)
  const memCtx = await resolveDatingMemorySessionContext(params.char.id)
  const playerIdentity = await loadPlayerIdentityForDating(
    params.char.id,
    memCtx.sessionPlayerIdentityId,
  )
  const playerName =
    playerIdentity?.wechatNickname?.trim() || playerIdentity?.name?.trim() || null
  const lengthTarget = parsePlotDimensionLengthTarget(
    params.mergedGen?.lengthTargetChars ?? params.archiveSnap.datingLengthTargetChars ?? 500,
    500,
  )
  const apiCfg =
    params.apiConfig?.apiUrl?.trim() && params.apiConfig?.apiKey?.trim() ? params.apiConfig : null

  let plot = params.aiPlot
  const genBase = {
    character: params.char,
    anchorPlotBody: params.anchorBody,
    tailContext: tail,
    writingGuide: '',
    lengthTargetChars: lengthTarget,
    godPerspective: params.archiveSnap.godPerspective,
    mainCharacterOffstage: !!params.archiveSnap.mainCharacterOffstage,
    perspective: params.perspective,
    apiConfig: apiCfg,
    playerIdentityCardName: playerName,
  }

  if (wantParallel) {
    const content = await generateDatingPlotDimensionAi({ ...genBase, kind: 'parallel' })
    const parallelEventBase = {
      content,
      writingGuide: '',
      lengthTargetChars: lengthTarget,
      updatedAt: Date.now(),
    }
    const timelineDelta = await resolveParallelEventSummaryDelta({
      apiConfig: apiCfg,
      mainCharacterId: params.char.id,
      plot: { ...plot, parallelEvent: parallelEventBase },
      anchorPlotBody: params.anchorBody,
    })
    plot = {
      ...plot,
      parallelEvent: {
        ...parallelEventBase,
        ...(timelineDelta ? { timelineDelta } : {}),
      },
    }
  }
  if (wantIf) {
    const content = await generateDatingPlotDimensionAi({ ...genBase, kind: 'if' })
    plot = {
      ...plot,
      ifLine: {
        content,
        writingGuide: '',
        lengthTargetChars: lengthTarget,
        updatedAt: Date.now(),
      },
    }
  }
  return plot
}

/** 与私聊 ChatRoom / 记忆进度页对齐：storage 键只用「马甲 + 会话身份」，不用绑定身份覆盖。 */
async function resolveDatingWeChatConversationScope(
  characterId: string,
  sessionPlayerIdentityId?: string | null,
): Promise<{
  chRow: Character | null
  sessionPid: string
  wechatAccountId: string | null
  conversationKey: string
}> {
  const cid = characterId.trim()
  const chRow = await personaDb.getCharacter(cid).catch(() => null)
  const bundle = await loadAccountsBundle()
  const wechatAccountId = bundle?.currentAccountId?.trim() || null
  const account = wechatAccountId && bundle ? findAccountById(bundle, wechatAccountId) : null
  const appPid = account
    ? resolveAccountSessionIdentityId(account)
    : (await personaDb.getCurrentIdentityId()).trim() || '__none__'
  const sessionPid = sessionPlayerIdentityId?.trim()
    ? sessionPlayerIdentityId.trim()
    : await resolveActivePrivateChatSessionPlayerIdentityId({
        characterId: cid,
        wechatAccountId,
        appPlayerIdentityId: appPid,
      })
  const conversationKey = resolvePrivateWeChatStorageConversationKey(cid, wechatAccountId, sessionPid)
  return { chRow, sessionPid, wechatAccountId, conversationKey }
}

/** 与私聊 ChatRoom / 记忆进度页同一套会话键，避免约会计轮与进度展示错位。 */
async function resolveDatingMemorySessionContext(characterId: string): Promise<{
  wechatAccountId: string | null
  sessionPlayerIdentityId: string
  conversationKey: string
}> {
  const cid = characterId.trim()
  const bundle = await loadAccountsBundle()
  const acc = bundle?.currentAccountId?.trim() || null
  const account = acc && bundle ? findAccountById(bundle, acc) : null
  const appPid = account
    ? resolveAccountSessionIdentityId(account)
    : (await personaDb.getCurrentIdentityId()).trim() || '__none__'
  const sessionPid = await resolveActivePrivateChatSessionPlayerIdentityId({
    characterId: cid,
    wechatAccountId: acc,
    appPlayerIdentityId: appPid,
  })
  const scope = await resolveDatingWeChatConversationScope(cid, sessionPid)
  return {
    wechatAccountId: acc,
    sessionPlayerIdentityId: sessionPid,
    conversationKey: scope.conversationKey,
  }
}

function countUnsummarizedInjectLines(block: string): number {
  return block.split('\n').filter((l) => l.trimStart().startsWith('- [')).length
}

function stripUnsummarizedBlockFooter(block: string): string {
  return block.replace(/\n（↑[\s\S]*$/u, '').trim()
}

function plotItemsToSnapshots(plots: PlotItem[]): DatingPlotSnapshotItem[] {
  return plots.map((p) => ({
    id: p.id,
    type: p.type,
    content: p.content,
    timestamp: p.timestamp,
    ...(p.planSummary ? { planSummary: p.planSummary } : {}),
    ...(p.type === 'ai' && p.timelineDelta ? { timelineDelta: p.timelineDelta } : {}),
    ...(p.type === 'ai' && p.timelineSnapshot ? { timelineSnapshot: p.timelineSnapshot } : {}),
  }))
}

/**
 * 已达「自动总结间隔」但同一 HTTP 未产出可解析合并 JSON 时：补一轮独立请求总结。
 * 与私聊共用 `autoSummaryInterval` 计数（仅 ChatRoom / 遇见触发 {@link personaDb.bumpMemoryAiRoundCount}；约会推剧情不计轮）。
 */
function scheduleDatingMemoryAutoSummary(
  characterId: string,
  characterRealName: string,
  apiCfg: ApiConfig | null,
  datingPlotsSnapshot: DatingPlotSnapshotItem[],
  conversationKey: string,
  datingAiPlotId?: string | null,
  sessionCtx?: { sessionPlayerIdentityId?: string | null; wechatAccountId?: string | null },
) {
  void (async () => {
    const cid = characterId.trim()
    const ck = conversationKey.trim()
    if (!cid || !ck) return
    try {
      await runUnifiedAutoMemorySummaryAfterThreshold({
        apiConfig: apiCfg,
        conversationKey: ck,
        characterId: cid,
        characterRealName,
        datingPlotsSnapshot,
        sessionPlayerIdentityId: sessionCtx?.sessionPlayerIdentityId ?? undefined,
        wechatAccountId: sessionCtx?.wechatAccountId ?? undefined,
        /** finalize 已 bump 消耗计轮；此处仅补写总结，失败时 catch 再 rollback 到临界值 */
        skipConversationRoundBump: true,
        datingAiPlotId: datingAiPlotId ?? undefined,
        summaryNotifyKind: 'dating',
      })
    } catch (err) {
      await personaDb.rollbackMemoryAiRoundCountForRetry(ck)
      const privSource = parseWechatAccountPrivateConversationKey(ck)
      await notifyMemorySummaryAttempt({
        ok: false,
        primaryWritten: false,
        conversationKey: ck,
        characterId: cid,
        displayName: characterRealName.trim() || '对方',
        kind: 'dating',
        sessionPlayerIdentityId: privSource?.sessionPlayerId,
        wechatAccountId: privSource?.wechatAccountId,
        datingAiPlotId: datingAiPlotId ?? undefined,
        failureReason: err instanceof Error ? err.message.trim() : String(err),
      })
    }
  })()
}

/**
 * 约会每段 AI 落库后：默认走每轮摘要表；不再占用微信私聊/群聊的「线上总结间隔」计轮。
 * 未到间隔 prose 总结时若尾部 JSON 含 linked，仍只落人脉关联记忆（不写主角、不推进游标）。
 */
async function finalizeDatingMemoryAfterAiReply(params: {
  apiConfig: ApiConfig | null
  aiTextRaw: string
  memoryGather: UnifiedMemoryGatherResult | null
  plotsSnapshotAfterAi: DatingPlotSnapshotItem[]
  char: CharacterInfo
  /**
   * 本轮写出合并记忆 JSON 的那条 AI 剧情气泡 id（与数组末尾无关）。
   * 重新生成中间某条时必须传入该条 id，否则会用「最后一条 AI」误绑轮次，关联记忆无法覆盖本条旧稿。
   */
  memoryTurnAiPlotId?: string | null
  /** 「重新回复」重生当轮 AI 剧情：不额外 +1 自动总结计轮 */
  skipMemoryRoundBump?: boolean
  /** 本轮模型 inline 尾声补丁是否已成功写库 */
  worldBookInlinePatchApplied?: boolean
  /** 落库后的完整 plot 列表，用于重建剧情时间轴行表（覆盖重新生成，不重复 append） */
  plotsAfterAi?: PlotItem[]
  /** 本轮刚生成平行事件时传入对应 plot id，rebuild 成功后弹 toast */
  notifyParallelSummaryForPlotId?: string | null
  /** 本轮玩家输入（用于尾声补丁过滤：是否主动拉近） */
  userText?: string
}): Promise<string[]> {
  const memSettings = await personaDb.getMemorySettings()
  const rowPerRoundMode = isOfflineDatingRowPerRoundMode(memSettings)
  const linkedOn = isLinkedMemoryAutoSummaryEnabled(memSettings)
  const datingMemOn = memSettings.autoSummaryEnabled !== false
  if (!linkedOn && !datingMemOn) return []

  /** 生成前 gather 不含本轮 AI 剧情；linked 校验需要含本轮正文的 freshGather。 */
  const memCtx = await resolveDatingMemorySessionContext(params.char.id)
  const freshGather =
    params.plotsSnapshotAfterAi.length > 0
      ? await gatherUnifiedMemoryInputsForDatingTurn({
          characterId: params.char.id,
          characterRealName: params.char.realName,
          datingPlotsSnapshot: params.plotsSnapshotAfterAi,
          sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
          wechatAccountId: memCtx.wechatAccountId,
          conversationKey: memCtx.conversationKey,
        })
      : null
  const gatherForApply = freshGather ?? params.memoryGather
  if (!gatherForApply) return []

  const ck = gatherForApply.conversationKey
  const datingAiPlotId =
    params.memoryTurnAiPlotId?.trim() ||
    lastAiDatingPlotIdInSnapshot(params.plotsSnapshotAfterAi)
  const turnPlotBody = aiPlotBodyFromSnapshotById(params.plotsSnapshotAfterAi, datingAiPlotId)
  /** 线下约会不再占用微信私聊/群聊的线上总结计轮（见记忆配置 · 线上总结间隔）。 */
  const shouldSummarize = false

  const isRegenerateTurn = params.skipMemoryRoundBump === true

  if (linkedOn && datingAiPlotId && isRegenerateTurn) {
    if (rowPerRoundMode) {
      const npcIds = [...gatherForApply.npcLinked.allowedNpcIds]
      await deleteStoryTimelineLinkedRowsForDatingRound({
        characterIds: [...linkedMemoryOwnerIdsForGather(gatherForApply), ...npcIds, params.char.id],
        plotId: datingAiPlotId,
      })
    } else {
      await personaDb.deleteAutoLinkedMemoriesForDatingRoundMulti(
        linkedMemoryOwnerIdsForGather(gatherForApply),
        datingAiPlotId,
      )
    }
  }

  const split = splitDatingAiResponseAndUnifiedMemoryJson(params.aiTextRaw)
  const linkedNpcNamesWritten: string[] = []
  let primaryWritten = false
  let epiloguePatchesApplied = 0
  if (split.memoryJsonText?.trim()) {
    const r = await tryApplyDatingCombinedMemoryJsonTail({
      memoryJsonText: split.memoryJsonText.trim(),
      gather: gatherForApply,
      offlinePlotsForCursorAdvance: gatherForApply.offlinePlotsPrior,
      writePrimaryAndAdvanceCursors: rowPerRoundMode ? false : shouldSummarize,
      datingAiPlotId,
      summaryNotifyKind: 'dating',
      skipConversationRoundBump: shouldSummarize,
      chatFallback: rowPerRoundMode ? undefined : params.apiConfig,
      latestAiPlotBody: turnPlotBody,
    })
    primaryWritten = r.primaryWritten
    epiloguePatchesApplied = r.epiloguePatchesApplied
    linkedNpcNamesWritten.push(...(r.linkedNpcNamesWritten ?? []))
  }
  if (shouldSummarize && primaryWritten) {
    await personaDb.resetMemoryAiRoundCountForConversation(ck)
    const mainRow = await personaDb.getCharacter(params.char.id).catch(() => null)
    const recentTranscript = params.plotsSnapshotAfterAi
      .slice(-12)
      .map((p) => {
        const who = p.type === 'player' ? '我' : params.char.realName.trim() || '角色'
        const body = String(p.content ?? '').trim().slice(0, 800)
        return body ? `${who}：${body}` : ''
      })
      .filter(Boolean)
      .join('\n')
    const summaryMaterials = [
      gatherForApply.offlineBlock?.trim() ? `【线下】\n${gatherForApply.offlineBlock.trim()}` : '',
      gatherForApply.npcLinked.block?.trim() ? `【人脉】\n${gatherForApply.npcLinked.block.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    await finalizeWorldBookAfterAutoSummaryPhase({
      apiConfig: params.apiConfig,
      conversationKey: ck,
      character: mainRow,
      epiloguePatchesApplied,
      recentTranscript,
      latestReplyHint: turnPlotBody.trim(),
      summaryMaterialsBlock: summaryMaterials,
    })
  }
  const shouldTryLinkedFallback =
    !rowPerRoundMode &&
    linkedOn &&
    linkedNpcNamesWritten.length === 0 &&
    (isRegenerateTurn
      ? turnPlotBody.trim().length > 0
      : await datingTurnMayNeedLinkedMemoryWrite(
          gatherForApply,
          params.plotsSnapshotAfterAi,
          datingAiPlotId,
        ))
  if (shouldTryLinkedFallback) {
    const roster = await buildEligibleLinkedMemoryRosterForDatingAppendix(
      gatherForApply.plotsArchiveId,
      params.char.id,
    )
    const r = await runDatingLinkedMemoryFallbackWhenNoJsonTail({
      apiConfig: params.apiConfig,
      gather: gatherForApply,
      offlinePlotsForCursorAdvance: gatherForApply.offlinePlotsPrior,
      datingAiPlotId,
      eligibleLinkedNpcRoster: roster,
      latestAiPlotBody: turnPlotBody,
    })
    if (r.linkedNpcNamesWritten.length) linkedNpcNamesWritten.push(...(r.linkedNpcNamesWritten ?? []))
  }
  if (shouldSummarize && datingMemOn && !primaryWritten && !rowPerRoundMode) {
    scheduleDatingMemoryAutoSummary(
      params.char.id,
      params.char.realName,
      params.apiConfig,
      params.plotsSnapshotAfterAi,
      ck,
      datingAiPlotId,
      {
        sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
        wechatAccountId: memCtx.wechatAccountId,
      },
    )
    return []
  }

  if (params.plotsAfterAi?.length && (rowPerRoundMode || !shouldSummarize || isRegenerateTurn)) {
    try {
      const rebuild = await rebuildStoryTimelineFromDatingPlots(params.char.id, params.plotsAfterAi, {
        apiConfig: params.apiConfig,
      })
      const notifyPlotId = params.notifyParallelSummaryForPlotId?.trim()
      if (notifyPlotId && rebuild.parallelSummaryPlotIds.includes(notifyPlotId)) {
        const plot = params.plotsAfterAi.find((p) => p.id === notifyPlotId)
        if (plot) {
          await notifyParallelSummaryTableWritten(params.char.realName, params.char.id, plot)
        }
      }
    } catch (rebuildErr) {
      console.warn('[dating] story timeline rebuild failed', rebuildErr)
    }
  }

  const latestRoundBodyForEpilogue = turnPlotBody.trim() || split.plotRaw.trim()
  if (latestRoundBodyForEpilogue) {
    try {
      const mainRow = await personaDb.getCharacter(params.char.id)
      const aiPlotCountInSnapshot = params.plotsSnapshotAfterAi.filter((p) => p.type === 'ai').length
      await finalizeWorldBookAfterPerAiRound({
        apiConfig: params.apiConfig,
        character: mainRow,
        latestRoundBody: latestRoundBodyForEpilogue,
        displayName: params.char.realName,
        inlinePatchApplied: params.worldBookInlinePatchApplied,
        epiloguePatchesApplied,
        datingContext: {
          isEarlyRound: aiPlotCountInSnapshot <= 1,
          hasOnlineWechatFacts: gatherForApply.hadOnline,
          historyPlotCount: aiPlotCountInSnapshot,
          userText: params.userText,
        },
      })
    } catch (epilogueErr) {
      console.warn('[dating] per-round epilogue sync failed', epilogueErr)
    }
  }

  return [...new Set(linkedNpcNamesWritten.map((n) => n.trim()).filter(Boolean))]
}

function buildPlayerIdentityPromptBlock(
  identity: PlayerIdentity | null,
  datingCharacterName: string,
  injectCaps?: { worldBookMaxChars?: number; bioMaxChars?: number },
): string {
  const deixisRule =
    `指代规则：玩家台词里的「你/你的」默认指向约会对象（${datingCharacterName}）一方；「我/我的」指玩家本人。` +
    '禁止把「你的经纪人/你的同事」误写成玩家职业。'
  if (!identity) {
    return `【用户身份卡】未绑定。称呼玩家时默认用「你」，不要编造姓名、职业或头衔。${deixisRule}`
  }
  const name = identity.name?.trim()
  const role = identity.identity?.trim()
  const head = name ? `称呼参考（供对白称呼，非旁白代词硬性规定）：${name}；` : ''
  const occ = role ? `职业/身份：${role}；` : ''
  const bioCap = injectCaps?.bioMaxChars ?? 2000
  const detailCard = `\n【用户身份档案·细节】\n${buildCharacterCard(identity, { bioMaxChars: bioCap })}`
  const wbBlock = (() => {
    const cap = injectCaps?.worldBookMaxChars ?? 4200
    const t = buildWorldBookText(identity, Math.max(400, cap), { voice: 'player_identity' }).trim()
    return t ? `\n【用户身份·世界书】\n${t}` : ''
  })()
  const occupationIronRule = role
    ? `【玩家身份铁律·最高优先级】凡描写**玩家本人（{{user}}）**的社会身份、职业、称谓、与 ${datingCharacterName}/NPC 的关系（如同事/员工/练习生/学生），**必须以本卡「职业/身份：${role}」及下方【用户身份·世界书】为准**。**禁止**擅自改写成公司员工、正式职员、打工人、办公室同事等与本卡矛盾的设定；**禁止**因 ${datingCharacterName} 的世界书、人脉网或长期记忆里出现模糊「上班/工作」字样，就把 {{user}} 默认当成 ${datingCharacterName} 的同事或下属——除非玩家身份卡或玩家世界书**明确**如此。\n`
    : `【玩家身份铁律】凡涉及**玩家本人（{{user}}）**的身份与职业，须以本卡与【用户身份·世界书】为准；无写明的职务**禁止**臆造（尤其禁止默认写成 ${datingCharacterName} 的公司员工）。\n`
  return (
    `【用户身份卡 · 须完整参考（高于约会对象档案中对玩家的模糊猜测）】` +
    `身份与**玩家侧**世界书条目均描述**玩家本人**；与约会对象「${datingCharacterName}」的人设、世界书勿混写。${head}${occ}\n` +
    `${occupationIronRule}` +
    `若当轮 user 里的「约会对象·世界书」或 system 档案室条目中，写明**玩家本人**的在校社团职务、职级等，且与本卡已知信息无矛盾，**一律以该条文为准**；**禁止**因本卡「职业/身份」栏未写而忽略，也**禁止**把条文里归玩家一方的职务改写到约会对象「${datingCharacterName}」头上；**若约会对象侧条文与本卡冲突，以本【用户身份卡】为准**。\n` +
    `${deixisRule}` +
    detailCard +
    wbBlock
  )
}

async function generateDatingAi(
  character: CharacterInfo,
  apiConfig: { apiUrl?: string; apiKey?: string; modelId?: string } | null,
  history: PlotItem[],
  prompt: string,
  userText: string | undefined,
  opts: {
    godPerspective: boolean
    mainCharacterOffstage: boolean
    perspective: NarrativePerspective
    isVnMode?: boolean
    vnVoiceDisabled?: boolean
  },
  onlineCtx?: {
    /** 已废弃注入：约会 prompt 不再贴「线上近期聊天」，与「尚未总结·私聊」去重；字段保留兼容旧调用 */
    recentMessages?: string
    longTermMemory: string
    initialBias?: string
    unsummarizedPrivateBlock?: string
    unsummarizedGroupBlock?: string
    unsummarizedOfflineBlock?: string
    /** 已废弃：「最近 6 轮参考」与「尚未总结」重复，不再注入 */
    recentPrivateAiRoundsBlock?: string
    recentOfflineAiRoundsBlock?: string
    /** 结构化剧情时间轴（自动总结维护） */
    storyTimelineBlock?: string
    dedupePrivateRecentOmitted?: boolean
    dedupeOfflineRecentOmitted?: boolean
    conversationKey?: string
    /** 本轮线下生成所对齐的线上消息时间窗 */
    onlineInjectScope?: DatingOnlineInjectScopeMeta
  },
  playerIdentity?: PlayerIdentity | null,
  genOptions?: NarrativeGenOptions,
  datingExtras?: { unifiedMemoryAppendix?: string; regeneratingWorldBookBaseline?: boolean },
): Promise<DatingAiGenResult> {
  if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
    await new Promise((r) => window.setTimeout(r, 240))
    const seed = userText?.trim() || prompt.slice(0, 28)
    const text = `<thinking>
【Lumi总控台】占位续写；承接玩家意图与人设边界。本分册·必查：是。
【时空场记卡】当场时间/地点一笔。本分册·必查：无瞬移：是。
【互动主轴卡】意图摘要一句（非复读原文）。本分册·必查：是。
【知情边界卡】仅写角色可知情点。本分册·必查：无私聊外挂：是。
【关系温度卡】阶段一句；数值仅场记。本分册·必查：正文无数值：是。
【文句风控卡】拟用首句类型：对白起笔；非比喻。本分册·必查：是。
【推进落点卡】锚点+衔接；动作→连锁；内心 OS 可有可无，若有须为 **整句** 勿占位。本分册·必查：是。
【代写边界卡】与本轮模式一致。本分册·必查：无抢话：是。
【Lumi终检单】预检维度1～23：占位均「该项：无」
自检结论：通过
</thinking>
${character.realName}把步子放慢半拍，先看了一眼门口，再把手机扣在桌面上。
"${seed.slice(0, 24)}。"他低声接住这个话题，语气平稳。`
    return { text }
  }
  const { godPerspective, mainCharacterOffstage, perspective, isVnMode = false, vnVoiceDisabled = false } =
    opts
  const userDisplayName =
    playerIdentity?.wechatNickname?.trim() || playerIdentity?.name?.trim() || '用户'
  const historyBlock = formatRecentPlotsForPrompt(history, character.realName, DATING_AI_HISTORY_PROMPT_MAX)
  const aiPlotCount = countAiPlotsInDatingHistory(history)
  const earlyDatingRound = isEarlyDatingPlotRound(history)
  const progressHint =
    aiPlotCount <= 1
      ? '关系阶段参考：**以尾声延展与线上聊天定义的当前关系态为准**（若冷淡/上下级/公事公办，本段须同温，禁止换场景即暧昧）；首轮禁止关系跨级跳跃。'
      : aiPlotCount <= 8
        ? '关系阶段参考：熟悉推进期（须有事件与玩家行为支撑，禁止无动因跨级靠近）'
        : '关系阶段参考：稳定互动期（在既有关系上推进新矛盾或新选择）'
  const roleMode = godPerspective
    ? '上帝视角：只写用户当前看不见、也不知晓的非面对面角色/NPC场景；**玩家本人不得出场、不得与约会对象/NPC 同场同框**；旁白一律第三人称写约会对象与 NPC（须在思维链【代写边界卡】与预检维度 8 中闭环）；禁止描写用户当下可见现场，禁止与用户直接对话；**与抢话互斥，不得代写玩家当轮言行**。**不得把「尚未总结」摘录或「长期记忆」里已出现的气泡/事实，改写成旁白里又发给用户/又讲一遍同款行程**；须写屏幕外或未写过的信息。'
    : mainCharacterOffstage
      ? `主角色缺席：本轮约会主角色 ${character.realName} **不在场**；正文只写玩家与 NPC/人脉角色之间的互动与场景，**禁止** ${character.realName} 出场、开口对白、被写成在场者（仅允许他人转述、手机/消息侧写、回忆等**非同框**信息，且不得把镜头切到其所在现场）。玩家可正常在场并与 NPC 互动。`
      : '角色视角：允许自然对白互动，但保持克制真实，不油腻；**线上微信聊天已说定内容为既定事实**，线下须服从（见【线上聊天事实铁律】），不得把已聊事实当新料对用户重复宣布。'
  const perspectiveRule = godPerspective
    ? `人称要求（本轮·上帝视角）：旁白以第三人称（他/她/${character.realName}等）写约会对象与在场他人；**禁止**旁白用「你」指${character.realName}或其动作。**禁止**描写玩家本人出场、在场、肢体动作或引号对白；玩家仅允许以心念、回忆、未在场的发消息侧写、他人转述等**屏外**方式被侧面提及，且「你」不得当作镜头前的互动对象。**禁止**用身份卡姓名「${userDisplayName}」直呼玩家（例：须写「他想到了你」，禁止「他想到了${userDisplayName}」）。${character.realName}的内心 OS：仅用 **…** 包裹**完整一句**第一人称心声（我=${character.realName}）；**禁止** OS 内写「他怎么……」类第三人称；**禁止**单独一行「我……」不接 ** 或星号内只有省略号。`
    : perspective === 'first'
      ? '人称要求：以下一段以第一人称为主（我/我们），除对白外避免第三人称叙事。'
      : perspective === 'second'
        ? '人称要求：以下一段以第二人称互动为主（你/你们），保持对象感。'
        : '人称要求：以下一段以第三人称叙事为主（他/她/他们），像镜头旁观。'
  const perspectiveStrictRule = godPerspective
    ? `【上帝视角·当轮硬约束】约会对象=${character.realName}：旁白主语须为他/她/其名；**禁止**「你把手机…」「你盯着屏幕…」类把约会对象写成「你」。**玩家出场禁令**：禁止玩家与${character.realName}/NPC 同处一室、对视、对话、肢体接触；禁止「你走过来/你开口/你们相对而坐」等同框描写。「你」仅可用于角色**不在场**时惦记玩家（如想到了你、给你发消息），**禁止**把「你」写成镜头前的面对面对象。界面「第二人称」仅为全书代入基调，**不**覆盖本轮上帝段写 NPC 的人称。`
    : perspective === 'second'
      ? '【第二人称硬约束】正文**旁白**叙述玩家时**只能**用「你/你的/你们」，**禁止**用身份卡姓名、小名、昵称、姓氏单独作主语、职衔等替代「你」（旁白里写成「某某某怎样」=把玩家当旁观对象，**破坏代入**）。**仅**在**双引号对白**中，角色可合理直呼或称呼玩家（须与身份卡不矛盾）。'
      : ''
  const autoUserReaction = !godPerspective && genOptions?.autoUserReaction === true
  const directorModeActive = genOptions?.directorMode === true
  const playerInputIntentMode: 'canon' | 'paraphrase' = directorModeActive ? 'paraphrase' : 'canon'
  const userDemand = userText?.trim()
    ? godPerspective
      ? playerInputIntentMode === 'paraphrase'
        ? `屏外剧情引导（玩家不在场；须写${character.realName}/NPC 独处或他人场景，禁止玩家出场）：${userText.trim()}`
        : `屏外观察意图（玩家不在场；下列仅作剧情方向，禁止把玩家写成在场）：${userText.trim()}`
      : playerInputIntentMode === 'paraphrase'
        ? `导演指令（尚未发生，须当场展开演出）：${userText.trim()}`
        : `玩家输入：${userText.trim()}`
    : `分支推进指令：${prompt}`
  const branchHintBlock =
    genOptions?.branchContinuationHint?.trim() ?
      `\n【剧情分支续写执导】\n${genOptions.branchContinuationHint.trim()}\n（须与玩家上句自然融合承接，勿机械复读本块全文。）\n`
      : ''
  const targetCharsRaw = Number(genOptions?.lengthTargetChars ?? 500)
  const targetChars = Number.isFinite(targetCharsRaw) ? clampDatingLengthTargetChars(targetCharsRaw) : 180
  const minBodyChars = Math.max(55, Math.round(targetChars * 0.88))
  const maxBodyChars = Math.round(targetChars * 1.18)
  const vnLengthConflictRule = isVnMode
    ? `【VN·篇幅统计】各行「【旁白】/【对白】/【内心】…」标签之后、到行尾的剧情汉字均计入上文「正文字数」；\`【VN语音参数】\`…\`【VN语音参数结束】\` 整块不计入。\n【篇幅与其它约束冲突时】若「去废话」「对白占比」与凑满 ${minBodyChars}～${maxBodyChars} 字冲突，**须优先满足该字数区间**：通过**增写口语对白与可见动作**拉够下限，禁止为删废话把正文压到低于 ${minBodyChars} 字。\n`
    : ''
  const lengthRule =
    `【篇幅·请严格遵守】「正文」=<thinking> 之后输出的剧情部分；**正文字数**按其中**汉字**估算（对白里的汉字计入；不含 <thinking> 内文字；不要用纯标点、空格或同义排比硬凑）。` +
    `用户目标 ${targetChars} 字 → **请把正文控制在约 ${minBodyChars}～${maxBodyChars} 字区间内**。**若你预估会低于 ${minBodyChars}，必须增写 1～4 句带新信息的对白或可见动作后再收束**；若明显超过 ${maxBodyChars} 可删无效氛围句。补足字数禁止靠堆砌感官或重复同义句。\n` +
    vnLengthConflictRule +
    `【思维链·速度】\`<thinking>\` 内全文建议 **≤ 900 汉字**（含【】标题）；各分册各 **1～3 句** 即可；【Lumi终检单】22 项可 **每项一行**（「无」须带半句理由）。**禁止**在思维链里写数千字长文——会极慢且易超出接口上限。`
  const antiFluffRule =
    `【当轮最高优先级·去废话硬约束】` +
    `正文必须“事件推进优先”，禁止把篇幅花在无功能的环境铺陈。` +
    `每一自然段至少包含以下其一：` +
    `1) 新动作（含**可见神态/微表情/肢体反应**，须带关系或情绪信息；**禁止**「他怎么样了」式空标签，须写具体脸红、视线、唇角、手部小动作等可拍细节）；2) 新对白；3) 新决定/新信息。` +
    `若某段三者都没有，整段删除重写。` +
    `环境与氛围句最多 1 句，且必须服务当下动作（例如遮挡视线、制造打断、影响距离）；` +
    `禁止连续两句纯景物、纯心理、纯感受堆叠。` +
    `同义改写视为重复，出现一次即删。` +
    `结尾必须落在可互动的动作或对白，不得抽象总结。`
  const dialogueDrivenPlotRule =
    `【当轮最高优先级·对话驱动正文】请以对话驱动剧情，全文紧扣当下矛盾与人物关系变化：` +
    `1. 对话核心：每一句对白须体现人设、推动剧情或改变关系；无效寒暄、凑字数对白一律删除。` +
    `对白之间的**神态、微反应与小动作**作点睛，用于补足情绪、潜台词与「活人感」；每轮宜有 2～4 处可见眉眼神态或肢体细节，禁止人物像只会念台词的木偶。**禁止**用「他/她很+情绪形容词+了」直述状态（如「他很尴尬」），**须**改写成脸红、视线躲闪、唇角似笑非笑、无意识摸耳垂等**可拍细节**（见 system【线下约会·神态与情绪外化】）。` +
    `2. 占比硬约束：正文对白占比（粗估）必须 **≥55%**（对白句数 /（对白句数 + 旁白句数））；若不足，先删无效旁白再补口语对白。` +
    `3. 节奏：对白衔接自然；神态句宜短、贴在对白前后，禁止大段与对白无关的铺垫或连续纯神态堆叠。` +
    `4. 禁用：禁止与对话核心无关的背景铺垫、无意义环境描写、重复心理活动；禁止为凑篇幅堆砌无效内容。` +
    (godPerspective
      ? `（本轮上帝视角：不向玩家当面喊话或假定玩家已开口；对白限于屏外角色/NPC 之间或独处自语式短句，仍须满足上列「对话驱动」要求。）`
      : autoUserReaction
        ? `（本轮抢话开：对白可含玩家引号台词；仍须以 ${character.realName}/NPC 对白为主轴。）`
        : `（本轮不抢话：**对白占比只计 ${character.realName}/NPC 引号对白**，禁止为凑占比新增玩家引号对白。）`)
  const npcRealNameRule =
    `【NPC命名铁律（最高优先级）】正文中凡 NPC 出场（旁白提及、对白前缀、他人转述）必须使用该 NPC 的真实姓名。` +
    `严禁用纯称呼替代真实姓名（例如：王老师、王女士、老师、经理、同学、阿姨、师傅、保安等）；` +
    `允许写法仅为「真实姓名」或「真实姓名+称呼后缀」（如“王静老师”），但禁止仅写称呼。`
  const vnBackgroundRule = isVnMode ? buildVnBackgroundPromptBlock() : ''
  const vnBgmRule = isVnMode ? buildVnBgmPromptBlock() : ''
  const vnAtmosphereRule = isVnMode ? buildVnAtmospherePromptBlock() : ''
  const vnVoiceParamsRule = isVnMode && !vnVoiceDisabled
    ? `11) 【VN对白语音参数·隐藏块】为了让前端能“只调用一次模型”就拿到整段对白的语音合成参数，你必须在正文输出完毕后，追加一个隐藏参数块：
   - 先输出一行：\`【VN语音参数】\`
   - 再输出一段 JSON 数组（一行即可，不要 Markdown），每项格式：\`{"idx":数字,"emotion":"...","tone":"..."}\`
     - idx：对应本段 VN 正文中**会显示为气泡**的【旁白】【内心】【对白】行序号，从 0 开始递增。**不要**把 BGM、【背景】、\`【VN雨】\`、\`【VN抖】\` 等控制/氛围独立行计入 idx。
     - emotion 仅可选：happy,sad,angry,fearful,disgusted,surprised,calm,fluent,whisper
     - tone 仅可选：clear-throat,laughs,chuckle,coughs,groans,breath,pant,inhale,exhale,gasps,sniffs,sighs,snorts,burps,lip-smacking,humming,hissing,emm,sneezes
     - 你只能基于“该行 + 上文最近 5 个气泡行”来判断（不要看更早内容）。
     - 只为**出声对白**输出参数（正文以「【对白】姓名：…」开头，或兼容旧稿的整行「姓名：…」且无【旁白】【内心】前缀）；**不要**为「【旁白】」「【内心】」及闪回/背景/BGM 控制行写项。
   - 最后输出一行：\`【VN语音参数结束】\`
   - 严格要求：这个隐藏块**不计入**正文目标字数；正文的字数/节奏必须先满足规则，再输出隐藏块。`
    : ''
  const vnFormatRule = isVnMode
    ? `【VN模式专用输出格式（最高优先级）】
客户端**仅按行首标签**切分气泡类型，**不对正文做「像对白还是像内心」的语义猜测**；你必须用下列标签标明每一行，否则「姓名：」出现在【旁白】里可能被误解析为对白并错误出现姓名条。

【三标签｜每行必须以之一开头（整行一条气泡）】
- \`【旁白】\` + 镜头/客观叙述正文：本行**之后**写正文；**禁止**在本行使用「姓名：」说话人前缀；**禁止**在旁白正文写「${userDisplayName}（你）」这类冗余嵌套。${
      godPerspective
        ? `【上帝视角】他人心念/视线/回忆**指向不在场的玩家**时须用「你」（如「他想到了你」），**禁止**旁白写「他想到了${userDisplayName}」；约会对象${character.realName}本人仍用他/她/其名，**禁止**用「你」指约会对象。**禁止** \`【对白】${userDisplayName}（你）：\` / \`【内心｜${userDisplayName}（你）】\` 等玩家在场气泡。`
        : `提及玩家：第二人称代入用「你」；客观第三人称镜头须与身份卡性别一致，勿把身份卡姓名当旁白主语指玩家。`
    }
- \`【内心】\`：**必须写清是谁的内心**。优先使用 \`【内心｜角色姓名或称呼】\` + 独白正文（可与「【对白】」里出现的姓名一致）；正文仍可用 **…** 包裹。**角色姓名**写在竖线与右括号「｜…」之间，客户端据此显示姓名条（如「沈若琳·内心」）及剧情日志「[沈若琳] 的内心」。若为约会主角视角内心且未写竖线，可仅用 \`【内心】\` + 正文，界面默认归为当前约会对象 \`${character.realName}\`；玩家第一人称内心须写 \`【内心｜${userDisplayName}（你）】\`。**内心行不出对白语音**，无语音按钮。
- \`【对白】\` + 紧跟「姓名：内容」；玩家口播必须写「${userDisplayName}（你）：内容」；其他角色写真实姓名加冒号。**仅【对白】行**播放对白语音按钮。**禁止**单独占一行只写「【对白】」而无「姓名：…」——标签与说话内容须同一条气泡（同一行），不要把「【对白】」拆成上一行、对白正文下一行。
- **兼容旧稿**：若整行**没有**上述三标签，但行首能严格匹配「姓名：」语法，则仍视为**对白**一行（新稿请尽量写【对白】前缀，避免旁白句里出现冒号被误切）。
- **防串台**：一行**仅允许一套**「姓名：」；对白折行时每行单独写完整「【对白】姓名：…」或旧稿「姓名：…」；**禁止**单行嵌两套「某某：」。
- 玩家与 NPC 轮替口播须**分行**，每行各带【对白】（或旧稿姓名：）；**禁止**「${character.realName}：${userDisplayName}（你）：…」单行双前缀。

3) **一行一个气泡（对白/内心）**：每条【对白】与【内心】仍须单独成行；换行即新气泡。
4) **【旁白】字数硬约束（约 25 字 / 条）**：每条 \`【旁白】\` **行内正文**（标签后到换行前）目标 **22～28 汉字**，**上限不宜超过约 32 字**；必须在**句号、问号、叹号**处优先收束；不得已再用**逗号、顿号**处断开。**禁止**把两三句旁白糊在同一行（客户端仍会尝试按句自动拆条，但模型自行分行可减少语气被切断）。
5) **旧稿无标签旁白**：整行无【对白】【内心】且无「姓名：」时视为旁白，同样遵守上条长度。
6) **折行续写**：续行必须自带类型标签（【旁白】/【内心】/【对白】）或旧稿「姓名：」；**禁止**只输出后半句接上一对白——无标签且无「姓名：」的行将整行按【旁白】解析。
7) 禁止序号、禁止 Markdown 代码围栏、禁止输出本说明的复述；正文内少用与「【」冲突的装饰。
8) 插叙/闪回/回忆段必须用成对控制行包裹：
   - 开始行：\`【插叙开始】\` 或 \`【闪回开始】\` 或 \`【回忆开始】\`
   - 结束行：\`【插叙结束】\` 或 \`【闪回结束】\` 或 \`【回忆结束】\`
   - 也支持简写：\`【插叙闪回】\` 视为开始；\`【插叙闪回结束】\` 视为结束。
   - \`【正常剧情】\` 视为回到主线（等同结束闪回）。
   - 闪回通常是连续多条气泡；未输出“结束”前视为仍在闪回中。
   - 普通台词里出现“那时候/想起/曾经”等词，不代表自动进入闪回，必须使用上述控制行。
   - 可与正文同一行，例如：\`【插叙闪回】【旁白】……\` 或 \`【插叙闪回】【对白】角色1：我都说了不要！\`
9) 闪回段须同时包含【旁白】推进、【对白】交锋与【内心】心理线索；**禁止**把大段心理混写在【旁白】里冒充镜头。
10) 闪回触发原则：当主线中角色明确出现“回忆从前/想起过去的某种经历”的语义时，应主动插入一段对应闪回演绎。
   - 触发后请输出：\`【插叙闪回】\` → 若干条闪回气泡 → \`【插叙闪回结束】\` → 回到主线。
   - 闪回气泡数量不作限制，以“完整讲清一段回忆剧情”为准。
   - 闪回内容必须服务当前矛盾或情绪，不得离题；结束后必须给出“回到当下”的承接句，再继续主线。
   - 闪回必须是“场景化演绎”（有当时动作、对白、旁白推进），禁止写成角色单纯口述往事摘要。
   - 若本轮没有明确回忆触发信号，则不要硬插闪回。
   - **进入闪回后必须立刻输出一行 \`【背景】闪回场景名\`；结束闪回回到主线后也必须立刻输出一行 \`【背景】主线场景名\`。禁止仅靠“白雾/滤镜”描述而不切换背景。**
   - **闪回内多场景**：若回忆里先后出现多个具体地点（例如教室内 → 走廊 → 操场），必须在**每次换场前**单独输出一行 \`【背景】\` + 列表中的下一场景名，再写下一条【旁白】/【对白】/【内心】；**禁止**整段闪回只挂一张背景图不换。每行 \`【背景】\` 从**紧接着的下一条气泡**起生效。
   - 回忆表达优先级：**闪回演绎 > 角色口述**。出现“我想起/那年/以前/当时”等回忆信号时，禁止连续用角色对白长篇复述往事。
   - 口述上限：允许用 0~1 句对白作为“引子”，随后必须进入闪回控制行并展开场景化回忆；禁止整段都用“他说过去如何如何”带过。
   - 闪回最小完成度：至少包含 1 条旁白推进 + 1 条人物对白 + 1 条情绪/心理线索，然后再回到主线。
   - 违反上列规则视为未完成任务，必须重写为闪回片段后再输出最终正文。
11) 人称与标签一致（最高优先级）：
   - 【旁白】行禁止第一人称「我/我们/咱」作主语叙述动作、心理、感受。
   - 第一人称心理、情绪**必须**写在【内心】行；口播**必须**写在【对白】行；禁止把心理长段混在【旁白】里。
   - 若出现「闪回段旁白 + 第一人称」冲突，以本条为绝对优先：改写成第三人称【旁白】或拆成【内心】。
${vnVoiceParamsRule ? `${vnVoiceParamsRule}\n` : ''}${vnBackgroundRule ? `${vnBackgroundRule}\n` : ''}${vnBgmRule ? `${vnBgmRule}\n` : ''}${vnAtmosphereRule ? `${vnAtmosphereRule}\n` : ''}`.trim()
    : ''
  const vnContinuityRule = isVnMode
    ? `【VN·时空连续与去重复（最高优先级）】` +
      `下方「最近剧情」按时间顺序排列，**越靠后越新**；**最后一条**中的场所（室内/户外/具体空间）、时段（昼/夜/睡前术后）、人物相对位置与姿态即当场锚点，本轮正文必须**直接承接**，禁止无因果的「状态清零」。` +
      `禁止无过渡的瞬移（例如上文已关灯就寝，下文突然户外路边）；若必须换场，至少用一行旁白交代「间隔多久 / 为何出门 / 如何抵达」。` +
      `禁止在近 ${DATING_AI_PLOT_HISTORY_MAX} 条已发生剧情中，把**同一核心桥段**改头换面再演一遍（重复接吻拉扯、同梗吃醋质问、已收束的回忆又当新情节）；须推进**新的**动作、对白信息或矛盾。\n`
    : ''
  const plotEmotionalDirectionRule =
    `【情绪方向与对称旧梗（最高优先级）】` +
    `1）**本轮锚点优先**：「玩家输入/导演指令/屏外引导」与「最近剧情」**末尾最新**条目共同决定当轮矛盾方向（谁嫉妒谁、谁质问谁、谁主动/谁退缩、谁道歉/谁冷战）。` +
    `2）**禁止对称翻案**：若历史上已演绎「A 因某事吃 B 的醋」，而本轮玩家输入或最近 1～2 条已转向「B 吃 A 的醋」或全新矛盾，**禁止**无过渡地写回旧方向；不得仅因长期记忆、剧情时间轴、尚未总结摘录或语义召回里出现同主题词（吃醋/嫉妒/质问/冷战）就复述**主客体相反**的旧桥段。` +
    `3）**未收束点须兼容**：可回接最近剧情中的未收束点，但**不得**与本轮输入及最近末尾方向矛盾；旧线若已在正文里说开、翻篇，或玩家已明确转向新矛盾，视为**已收束**，不得强行捡回。` +
    `4）**记忆块用法**：「尚未总结·私聊/群聊」与长期记忆里源自微信的内容作**既定事实**（见【线上聊天事实铁律】）；玩家输入/导演指令/屏外引导仅作**推进方向**。事实与引导冲突时**事实优先**，不得为情绪方向或自行发挥改写线上已说定内容。\n`
  const plotAntiEchoRule = !isVnMode
    ? `【普通模式·去重复】「最近剧情」**末尾最新**优先；禁止把更早条目里的**同一核心桥段**（同梗吃醋/同场质问/已和解又重演）改头换面再演一遍；须推进**新的**对白、动作或矛盾。\n`
    : ''
  /** 普通模式：历史里常混入曾用 VN 写的条目，模型会照抄标签；须明文禁止 */
  const normalPlotFormatRule = !isVnMode
    ? `【普通剧情模式·输出格式（最高优先级｜与 VN 互斥）】
- 当前为**普通剧情**，**禁止**使用任何 VN 行首标签与控制行，包括但不限于：【旁白】、【对白】、【内心】、【内心｜…】、【背景】、【插叙开始】/【闪回开始】/【回忆开始】及对应结束行、【插叙闪回】、【正常剧情】、【VN雨】、【VN抖】、【VN语音参数】…【VN语音参数结束】及同构写法。
- **禁止**把正文写成「一行一个气泡」的 VN 稿；请用**连续自然段**叙述，**对白**用弯引号 “…” 或半角直引号 "..." 写在段落内（与旁白同一排版，**不要**用日式直角引号「…」包裹整句台词）；内心 OS 仅用一对英文 **…** 包裹整句（与界面普通模式一致）。
- 下方「最近剧情」摘录**可能**含旧稿中的 VN 标签，**仅供理解情节与时间线**，**不得模仿该版式**；本轮输出必须是普通段落体。
`
    : ''
  const userReactionPromptBlock = buildUserReactionPromptBlock({
    autoUserReaction,
    godPerspective,
    userDisplayName,
    characterRealName: character.realName,
    isVnMode,
  })
  const userReactionSlimHint = summarizeUserReactionForSlimRetry({
    autoUserReaction,
    godPerspective,
  })
  const mainCharacterOffstageVnRule =
    isVnMode && mainCharacterOffstage
      ? `【VN·主角色缺席（最高优先级）】本轮约会主角色 ${character.realName} **不得**出现任何【对白】/【内心】气泡或被写成在场；只写玩家与 NPC/人脉的【旁白】/【对白】/【内心】。\n`
      : ''

  const autoUserRoleplaySpaceRule =
    !godPerspective && autoUserReaction
      ? ' [注意：你可以根据`<当前回复>`内容与当前剧情、{{user}}设定，对我的角色扮演进行适当衍生，合理地描写{{user}}可能的行为举止，但必须确保为我留下充裕的角色扮演空间]'
      : ''
  const longMem = onlineCtx?.longTermMemory?.trim()
  const initialBias = onlineCtx?.initialBias?.trim()
  const unsPrivBlock = onlineCtx?.unsummarizedPrivateBlock?.trim()
  const unsGrpBlock = onlineCtx?.unsummarizedGroupBlock?.trim()
  const unsOffBlock = onlineCtx?.unsummarizedOfflineBlock?.trim()
  const storyTimelineBlock = onlineCtx?.storyTimelineBlock?.trim()
  const refCap = DATING_AI_REFERENCE_SECTION_CHAR_CAP
  const longMemClipped = clipDatingReferenceHead(longMem ?? '', refCap, '长期记忆')
  const storyTimelineClipped = clipDatingReferenceHead(storyTimelineBlock ?? '', refCap, '剧情时间轴')
  const unsPrivClipped = clipDatingReferenceTail(unsPrivBlock ?? '', refCap, '尚未总结·私聊')
  const unsGrpClipped = clipDatingReferenceTail(unsGrpBlock ?? '', refCap, '尚未总结·群聊')
  let unsOffClipped = ''
  /** 微信原文摘录仅「未总结」块；用于强提醒触发，避免与长期记忆块重复要求 */
  const wechatUnsummarizedRefLen = unsPrivClipped.length + unsGrpClipped.length
  const historyClipped = historyBlock || ''
  /** 身份卡/人设世界书：不再按千字级硬砍；仍设软顶以防极端条目撑爆请求体 */
  const promptWbCap = Math.min(refCap, Math.max(8000, 320 + Math.round(targetChars * 6)))
  const promptBioCap = Math.min(refCap, Math.max(4000, 220 + Math.round(targetChars * 3)))
  const identityBlock = buildPlayerIdentityPromptBlock(playerIdentity ?? null, character.realName, {
    worldBookMaxChars: promptWbCap,
    bioMaxChars: promptBioCap,
  })
  const pg = playerIdentity?.gender
  const playerGenderPronounReminder =
    pg === 'male'
      ? `【当轮强提醒】用户身份卡性别为**男**：凡指**玩家本人**（含约会对象/NPC **对白**背称、约会对象 **OS** 里「想约谁、怕谁生气」**当对象=玩家**、以及「卫总」等**即玩家**时的第三人称）必须用「**他**」，**禁止**用「她」；**禁止**因场上有女性或「总裁」称谓而把玩家写成女性人称。\n`
      : pg === 'female'
        ? `【当轮强提醒】用户身份卡性别为**女**：凡指**玩家本人**必须用「**她**」，**禁止**用「他」。\n`
        : ''
  const styleAppend = buildDatingStyleSystemAppend(genOptions)
  const onlineInjectScope = onlineCtx?.onlineInjectScope
  const onlineTemporalScopeRule = onlineInjectScope
    ? formatDatingOnlineTemporalScopePromptRule(onlineInjectScope, Date.now())
    : ''
  const hasOnlineWechatFacts =
    wechatUnsummarizedRefLen > 8 || Boolean(longMemClipped?.trim())
  const onlineWechatFactCanonRule = hasOnlineWechatFacts
    ? `【线上聊天事实铁律（最高优先级｜高于导演指令、玩家输入与自行发挥）】` +
      `「尚未总结·私聊/群聊」及长期记忆里源自微信聊天的条目，记录的是**线上已发生、双方已知并已说出口**的内容（约定、承诺、排期、待办、饮食/工作反馈口径、谁承诺何时何地再谈等），**是事实约束，不是写作指导、灵感参考或语气样本**。` +
      `线下正文须**无条件服从**这些事实：` +
      `**禁止**提前兑现线上明确推迟的事（例：聊天说「瑕疵明天午饭当面聊」，线下不得在见面前就当面对方已同意的方式提前细讲）；` +
      `**禁止**与线上一致信息矛盾（改口、撤回、假装没说过、擅自改时间地点而无合理解释）；` +
      `**禁止**只借摘录学口吻却无视摘录里的约定与排期；` +
      `**禁止**线上仍冷淡公事、线下却写成暧昧/心动/私人越界（关系温度须与摘录及尾声延展一致，除非用户当轮明确打破）。` +
      `「玩家输入/导演指令/屏外引导」只决定**当轮镜头与推进方式**，**不得**覆盖或改写线上已定事实；若指令与事实冲突，**以线上事实为准**并在思维链【线上事实卡】写清如何按事实承接。` +
      `「最近剧情」旧稿若违背线上事实，须以线上事实**修正**承接，不得沿旧稿滑下去。` +
      (godPerspective
        ? `（上帝视角仍适用：角色屏外言行、独处自语、对他人转述须与线上一致；**禁止**借「屏外自由发挥」捏造与聊天矛盾的行程或态度反转。）\n`
        : `允许在不违背事实的前提下**新增**当面细节、动作与环境；**禁止**把线上已聊内容当「新发现」对用户重复宣布。\n`)
    : ''
  const onlinePrivBoundaryReminder =
    wechatUnsummarizedRefLen > 8
      ? `【当轮强提醒·知悉边界】下列摘录多为**私聊/群聊原文**；线下**其他 NPC** 不得无因知晓用户与**${character.realName}**私聊的具体内容；**${character.realName}**也不得无因知晓用户与其他 NPC 私聊的内容，除非摘录或前文已给出合法知情路径（须在思维链【知情边界卡】与预检 12 中自检）。\n`
      : ''
  const wechatDialogueParityReminder =
    wechatUnsummarizedRefLen > 8
      ? godPerspective
        ? `【当轮强提醒·对白口吻】「尚未总结」摘录为微信线上口吻参考；本轮为上帝视角**屏外场景**，角色对白限于 NPC 之间或独处自语，**禁止**当作与玩家当面说话，**禁止**把玩家写成在场。\n`
        : `【当轮强提醒·对白口吻】下方「尚未总结」块为**同一 ${character.realName}** 的微信原文：**事实与约定优先服从**，口吻仅作辅助——口语、短句、活人感；场景是面对面，**不是**换个人写小说腔长台词；**勿**在引号对白里堆「（笑）」类括号神态（须在思维链【文句风控卡】/预检 4 中闭环）。\n`
      : ''
  const trimmedUserForReminder = (userText ?? '').trim()
  const playerInputSemanticsBlock = buildDatingPlayerInputSemanticsBlock(
    trimmedUserForReminder,
    character.realName,
    { directorMode: playerInputIntentMode === 'paraphrase', godPerspective },
  )
  const presentNetworkBlock =
    genOptions?.presentNetworkCharacterIds?.length
      ? await buildDatingPresentNetworkCharactersPromptBlock({
          characterIds: genOptions.presentNetworkCharacterIds,
          datingPeerRealName: character.realName,
        })
      : ''
  const playerInputNoRecapReminder =
    trimmedUserForReminder.length > 0
      ? godPerspective
        ? `【当轮强提醒·上帝视角】玩家**不在场**；下列输入/指令仅作屏外剧情方向，**禁止**把玩家写成在场、同屏、当面互动；禁止描写玩家当轮动作或引号对白。\n`
        : playerInputIntentMode === 'paraphrase'
          ? `【当轮强提醒·导演模式】下列指令**尚未发生**；正文须从当前场面起笔**当场演出**过程，禁止把指令当作既成事实复述或直接跳到结果态（如指令写「他很震惊」，须写出如何逐步震惊，而非默认已震惊完毕）。\n`
          : `【当轮强提醒】「本轮玩家输入原文」与玩家同屏，**禁止**正文再分条、逐句、改写法把该段**重复叙述一遍**当剧情；禁止「先承接你第一句…」流水账。请直接按意图推进**新**对白、动作或冲突。\n`
      : ''
  /** 导演模式：按是否抢话给「宜/忌」示例，避免与「不抢话」打架 */
  const directorParaphraseModeBlock = godPerspective
    ? `【上帝×导演】指令须转写为**屏外第三者镜头**：只写 ${character.realName}/NPC 如何独处或在他人面前展开，**禁止**玩家出场或与玩家同场。**宜**：他独处时指尖一顿，盯着未读消息忽然想到了你。**忌**：你走近他、你对他开口、你与他同处一室对视。`
    : !autoUserReaction
      ? `【导演×不抢话】**禁止**「${userDisplayName}（你）：…」替你念完整质问/骂句；只用第二人称旁白写你的眼神、距离、停顿、声线、手部动作等，并写「${character.realName}」等在场人的应激对白或抢在你之前的半句话。` +
        `【示例·指令若概括「趁他不注意吻他，他很震惊」】**宜**：你指尖还搭在他肩侧，呼吸贴得很近；他余光一偏，还没来得及撤开——唇瓣已经压上来，他脊背猛地绷直，瞳孔骤缩。（震惊须写出过程，勿写「他已经很震惊」的既成报告。）` +
        `**忌**：开头就写「你吻上去后，他震惊得说不出话」当作已发生；或跳过偷袭过程直接写事后对峙。`
      : `【导演×抢话】允许「${userDisplayName}（你）：…」写出当场台词与动作，把指令里的对白要点演到眼前。` +
        `【示例·指令若概括「趁他不注意吻他」】**宜**：你趁他分神，一把揽过他的后颈吻上去；他僵了一瞬，「……你」字卡在喉咙里。` +
        `**忌**：只旁白写「你已经吻过了」却不写偷袭与接触过程；或把「他很震惊」写成上一秒就结束的结果态。`
  const playerInputIntentRule =
    godPerspective && trimmedUserForReminder.length > 0
      ? `【上帝视角·输入边界（最高优先级）】下列仅为屏外剧情引导；玩家本人**不在本轮画面**。**禁止**描写玩家出场、在场、与${character.realName}/NPC 当面互动、引号对白或肢体动作。须写 ${character.realName}/NPC 在玩家**看不见**处的独处、与他人互动，或隔空侧面提及（看手机、想起你、发消息等）。**但若与线上聊天已定事实冲突，以事实为准**（见【线上聊天事实铁律】）。\n`
      : trimmedUserForReminder.length > 0 && playerInputIntentMode === 'paraphrase'
        ? `【导演模式＝剧情引导（最高优先级）】` +
          `下列输入**不是**既定事实；禁止「玩家刚才已经……」「话一出口就已……」「他感到很震惊（已发生）」等既成事口径。` +
          `须从**当前这一刻**起笔，把指令里的意图**当场演出过程**：气氛、距离、动作如何发生、对方如何逐步反应等，勿直接跳到指令末尾的结果态。` +
          `**但若与「尚未总结·私聊/群聊」或长期记忆里的线上已定事实冲突，以线上事实为准**（见【线上聊天事实铁律】），指令只决定推进方式，不得改写已聊定内容。` +
          `${directorParaphraseModeBlock}\n` +
          (isVnMode
            ? `【VN 格式】导演模式下仍须用【旁白】/【对白】/【内心】行首标签输出；导演指令本身不要原样贴进正文当既成旁白。\n`
            : '')
        : trimmedUserForReminder.length > 0 && playerInputIntentMode === 'canon'
          ? `【玩家输入＝既定事实】下列输入视为进入本段正文前**已经发生**的玩家言行或既定场面；正文应从他人的**即时感知与反应**写起并推向下一步，禁止再铺垫「即将」重复发生同一事件。\n`
          : ''
  const godHistoryIsolationNote = godPerspective
    ? `【上帝视角·历史隔离】「最近剧情」中若含玩家与角色当面互动的旧稿，**本轮仍须切换为屏外镜头**；禁止延续同场同框，禁止把历史里的面对面对话当作本轮默认场面。\n`
    : ''
  const mainCharacterOffstageReminder = mainCharacterOffstage
    ? `【当轮强提醒·主角色缺席】约会对象 ${character.realName} **本轮不得出场**。重点写玩家与 NPC/人脉的对白、动作与矛盾；人脉角色须用真实姓名。**禁止** ${character.realName} 的引号对白、当面互动或同框描写。\n`
    : ''
  const mainCharacterOffstageHistoryNote = mainCharacterOffstage
    ? `【主角色缺席·历史隔离】「最近剧情」若含 ${character.realName} 出场旧稿，本轮仍须维持其**不在场**；禁止借承接把主角色拉回画面。\n`
    : ''
  const charWbCap = Math.min(refCap, Math.max(8000, 380 + Math.round(targetChars * 6)))
  const charWbgCap = Math.min(refCap, Math.max(4000, 260 + Math.round(targetChars * 3)))
  const [npcNetworkBlock, mainCharRow] = await Promise.all([
    loadDatingNpcNetworkPromptBlock({
      mainCharacterId: character.id,
      mainRealName: character.realName,
    }),
    personaDb.getCharacter(character.id).catch(() => null),
  ])
  let datingCharWorldBg = ''
  let datingCharWb = ''
  try {
    const row = mainCharRow
    if (row) {
      datingCharWb = buildWorldBookText(row, charWbCap).trim()
      if (row.worldBackgroundEnabled !== false && row.worldBackgroundId?.trim()) {
        const wbg = await personaDb.getWorldBackground(row.worldBackgroundId.trim())
        datingCharWorldBg = formatWorldBackgroundForPrompt(wbg).trim().slice(0, charWbgCap)
      }
    }
  } catch {
    // 无完整角色行时仍使用 CharacterInfo 中的设定摘要
  }
  const datingPhysiqueLines: string[] = []
  if (mainCharRow) {
    const o = buildPhysiquePromptSectionForCharacter(mainCharRow)
    if (o) datingPhysiqueLines.push(`【约会对象·体态档案】${o}`)
  }
  if (playerIdentity) {
    const p = buildPhysiquePromptSectionForCharacter(playerIdentity)
    if (p) datingPhysiqueLines.push(`【玩家（用户）·体态档案】${p}`)
  }
  const datingPhysiqueBlock = datingPhysiqueLines.length
    ? `${datingPhysiqueLines.join('\n')}\n` +
      (godPerspective
        ? `【上帝视角·体态档案】上列仅供人设一致；玩家**不在场**，**禁止**据此描写玩家与角色同框的空间关系（对视、并肩、拥抱等）。\n\n`
        : `【体态描写原则】上列为档案数值及 BMI（推算）事实锚点；**不必**每轮描写身材。凡对视高度、并肩、俯身、环抱等与身高相关的空间关系须与档案自洽，**禁止**明显颠倒高矮。若仅一侧填写身高、另一侧未填，勿编造对方具体厘米。\n\n`)
    : ''
  const datingWbIds = [character.id].map((x) => String(x ?? '').trim()).filter(Boolean)
  const datingArchivePlate = isVnMode ? ('vn' as const) : ('offline_plot' as const)
  const datingArchiveBlock = datingWbIds.length
    ? buildWorldbookContext(datingWbIds, getWorldbookLoreEntriesSnapshot(), datingArchivePlate).trim()
    : ''
  const datingArchiveBlockPlain = datingWbIds.length
    ? buildWorldbookContext(datingWbIds, getWorldbookLoreEntriesSnapshot(), datingArchivePlate, {
        plainUserEntriesOnly: true,
      }).trim()
    : ''
  const hasUnifiedMemAppendix = Boolean(datingExtras?.unifiedMemoryAppendix?.trim())
  const combinedMemNote = hasUnifiedMemAppendix
    ? `【本轮硬性附加】user 消息末尾含「同一回复内合并长期记忆 JSON」说明：完整剧情 / VN 正文写完后（若启用【VN语音参数】块则在其后）**另起一行**输出规定分隔符与 JSON，分隔符之后只允许 JSON。\n`
    : `【长期记忆】本轮**不要求**在回复末尾输出合并记忆 JSON；请专注剧情正文。记忆由客户端在落库后后台处理。\n`
  const charUserNames: CharUserNames = (() => {
    const r = resolveCharUserNamesForPrompt({
      character: mainCharRow,
      playerIdentity: playerIdentity ?? null,
      playerDisplayName: userDisplayName,
    })
    const charOk =
      String(mainCharRow?.name ?? '').trim() ||
      String(mainCharRow?.wechatNickname ?? '').trim() ||
      character.realName.trim()
    return {
      charName: charOk || r.charName,
      userName: r.userName,
    }
  })()
  const charUserDirective = buildDatingCharUserPerspectiveDirective(charUserNames.charName, charUserNames.userName)
  unsOffClipped = clipDatingReferenceTail(
    unsOffBlock ?? '',
    DATING_AI_OFFLINE_UNSUMMARIZED_CHAR_CAP,
    '尚未总结·线下剧情',
  )
  const worldBookRoleLockReminder =
    `【世界书职务与关系（须与条文一致）】条目中凡涉及「${charUserNames.charName}」（约会对象 / AI）与「${charUserNames.userName}」（玩家身份）的社团职务、职级、远近关系、单恋方向等，续写必须与原文逐项一致，**禁止**将一方的设定挪到另一方或对调二人身份。**即使用户身份卡未写同一职务**，只要条文已写明归属「${charUserNames.userName}」或「${charUserNames.charName}」，正文须按条文执行，**禁止**以「身份卡没写」为由把玩家侧职务默认套到约会对象上。\n`
  const wbAfterBlock =
    mainCharRow && hasChatAfterWorldBookItems(mainCharRow)
      ? `\n\n${buildChatAfterWorldBookDynamicSection(mainCharRow)}\n\n${buildDatingWorldBookAfterPatchOutputAppendix({ isEarlyRound: earlyDatingRound })}`
      : ''
  const epilogueRelationshipBaselineBlock = buildDatingEpilogueRelationshipBaselineBlock(mainCharRow, {
    historyPlotCount: aiPlotCount,
    hasOnlineWechatFacts: hasOnlineWechatFacts,
    userText: userText ?? '',
  })
  const systemPromptRaw =
    `${charUserDirective}${buildDatingStyleSystemPrompt(getLoreArchiveBuiltinPresetTogglesSnapshot())}${styleAppend}${
      datingArchiveBlock
        ? `\n\n${datingArchiveBlock}\n\n${worldBookRoleLockReminder}\n`
        : '\n'
    }\n${combinedMemNote}\n\n${wbAfterBlock}\n\n${PROSE_FORBIDDEN_LEXICON_PROMPT}`
  const datingCharProfileBlock = mainCharRow
    ? `【约会对象·档案与简介${
        mainCharacterOffstage ? '（缺席模式：仅供边界参考，**本轮正文禁止该角色出场**）' : ''
      }】\n${buildCharacterCard(mainCharRow, { bioMaxChars: promptBioCap })}\n\n`
    : `【约会对象·档案与简介${
        mainCharacterOffstage ? '（缺席模式：仅供边界参考，**本轮正文禁止该角色出场**）' : ''
      }】\n角色信息：姓名=${character.realName}；标签=${character.identityTags.join('、') || '无'}；座右铭=${character.motto || '无'}；设定摘要=${character.prompt}\n\n`
  const datingScheduleBlock = buildScheduleSection({
    playerIdentity: (playerIdentity?.schedule as ScheduleTable | undefined) ?? null,
    character: (mainCharRow?.schedule as ScheduleTable | undefined) ?? null,
  })
  const userPromptRaw =
        `${identityBlock}\n` +
        `${playerGenderPronounReminder}` +
        datingCharProfileBlock +
        datingPhysiqueBlock +
        (datingCharWorldBg ? `【约会对象·世界背景】\n${datingCharWorldBg}\n\n` : '') +
        (datingCharWb
          ? `【约会对象·世界书】\n${datingCharWb}\n\n${worldBookRoleLockReminder}\n`
          : '') +
        `${datingScheduleBlock}` +
        (npcNetworkBlock.trim() ? `${npcNetworkBlock.trim()}\n\n` : '') +
        `${progressHint}\n` +
        `${epilogueRelationshipBaselineBlock}\n\n` +
        `本轮模式：${roleMode}\n` +
        `${perspectiveRule}\n` +
        (perspectiveStrictRule ? `${perspectiveStrictRule}\n` : '') +
        `${lengthRule}\n` +
        `${antiFluffRule}\n` +
        `${dialogueDrivenPlotRule}\n` +
        `${npcRealNameRule}\n` +
        (vnFormatRule ? `${vnFormatRule}\n` : '') +
        (mainCharacterOffstageVnRule ? `${mainCharacterOffstageVnRule}` : '') +
        (normalPlotFormatRule ? `${normalPlotFormatRule}\n` : '') +
        (vnContinuityRule ? `${vnContinuityRule}` : '') +
        `${plotEmotionalDirectionRule}` +
        (plotAntiEchoRule ? `${plotAntiEchoRule}` : '') +
        `${userReactionPromptBlock}\n` +
        `${autoUserRoleplaySpaceRule}\n` +
        `${STYLE_HINT}\n` +
        (initialBias ? `本次生成偏向（最高优先级）：${initialBias}\n` : '') +
        `${onlineTemporalScopeRule}` +
        `${onlineWechatFactCanonRule}` +
        `${onlinePrivBoundaryReminder}` +
        `${wechatDialogueParityReminder}` +
        `${playerInputNoRecapReminder}` +
        `${playerInputIntentRule}` +
        (playerInputSemanticsBlock ? `${playerInputSemanticsBlock}\n\n` : '') +
        (presentNetworkBlock ? `${presentNetworkBlock}\n\n` : '') +
        `${mainCharacterOffstageReminder}` +
        `【本轮承接范围】**第一优先**对照「尚未总结·私聊/群聊」与长期记忆里的**线上已定事实**（见【线上聊天事实铁律】，事实高于指导）；在此之上再承接${
          godPerspective
            ? '屏外剧情引导'
            : playerInputIntentMode === 'paraphrase'
              ? '导演指令'
              : '“玩家输入：...”'
        }中的意图，并与「最近剧情」**末尾最新**在情绪方向、主动方上保持一致；可回接**兼容**的未收束点，但**禁止**拾取与本轮方向矛盾的对称旧梗（见【情绪方向与对称旧梗】）。${
          godPerspective
            ? '**本轮须维持玩家不在场的屏外镜头**'
            : mainCharacterOffstage
              ? `**本轮须维持 ${character.realName} 不在场，只写玩家与 NPC**`
              : ''
        }\n` +
        `${userDemand}${branchHintBlock}\n` +
        `【本轮${
          godPerspective
            ? '屏外剧情引导'
            : playerInputIntentMode === 'paraphrase'
              ? '导演指令'
              : '玩家输入'
        }原文（锚点优先来源；**正文禁止复读或分条重述本块**）】\n${userText?.trim() || '（本轮无玩家输入）'}\n\n` +
        `长期记忆（关键词触发 + 向量语义筛选；**已进自动总结的微信内容以本块为准**——属**线上已定事实**，须服从，勿与下方「尚未总结」矛盾）：\n${longMemClipped || '（暂无）'}\n\n` +
        `【剧情时间轴】（故事内时空状态；由自动总结维护；承接地点/时段/服装时优先对照本块；**未收动机伏笔与未完结待办**才须承接，已完结者勿再引用；**与下方「系统落库时刻」前缀独立**；**不得**违背上方线上聊天事实）：\n${storyTimelineClipped || '（暂无）'}\n\n` +
        `尚未总结·私聊（**线上已发生事实**｜见块尾时间窗说明；每条方括号内为**系统落库时刻**（真实发送钟点，非故事内剧情时间）；须服从，**不是**写作指导）：\n${unsPrivClipped || '（暂无）'}\n\n` +
        `尚未总结·群聊（**线上已发生事实**｜同一时间窗；每条前缀为**系统落库时刻**；须服从，**不是**写作指导）：\n${unsGrpClipped || '（暂无）'}\n\n` +
        `尚未总结·线下剧情（**系统落库时刻见每条条目前缀**——真实生成钟点，非故事内剧情时间；按落库先后理解）：\n${unsOffClipped || '（暂无）'}\n\n` +
        `【历史摘录·文风隔离（最高优先级）】下条「最近剧情」**只**供提取：**事实、关系、与本轮兼容的未收束点、人物在场与空间关系**；**禁止**把旧稿的措辞、节奏、修辞习惯、网文腔或油腻句式当作续写模板；**禁止**因旧稿曾出现某情绪主题就把本轮主客体方向写反。若上文显八股、堆砌感官词、触犯禁词表或与 system 白描要求相悖，本轮仍须按 **system 统一文风与禁词表** 落笔，**不得**「贴着旧稿语感滑下去」。重新生成同段时亦适用本条。\n` +
        `${godHistoryIsolationNote}` +
        `${mainCharacterOffstageHistoryNote}` +
        `最近剧情（最近 ${DATING_AI_PLOT_HISTORY_MAX} 条，**含本轮玩家输入**；按落库先后排列，**末尾最新**；**每条条目前缀为系统落库时刻**（真实生成钟点，非故事内剧情时间）；超长时保留末尾；正文已去思维链；**不含**屏外平行事件原文）：\n${historyClipped || '（暂无历史）'}\n\n` +
        (datingExtras?.regeneratingWorldBookBaseline
          ? `【重新生成】本条为对**某一旧 AI 气泡**的重写请求。\n` +
            `1）**上下文边界**：你只拥有「最近剧情」里**在该条之前的**内容与玩家输入；**切勿**假定或复述你已写过的上一版本条正文——上一版已从本轮材料中剔除，**禁止**对其洗稿、同义复述或微调后交差。\n` +
            `2）**重写目标**：在满足人设与连续性前提下，须有**可与旧稿区分开**的推进：**新的对白钩子、动作顺序、信息披露或交涉策略**至少占明显比重；若无玩家新指令，也不得把旧稿换一种说法再输出一遍。\n` +
            `3）「尾声延展」：若该条自上次成功落库后**未被你在人设里手改、也未被后续剧情覆盖**，客户端会将其恢复为**该次补丁写入前**的快照，避免旧稿补丁牵着走；**若你已编辑人设或条目正文已与当轮补丁结果不一致，则保持当前库内最新正文**，你必须以 **system 中注入的当前尾声延展** 为准，勿假定仍是首次生成时的旧条。\n`
            +
            (!isVnMode
              ? `4）**格式**：当前为普通剧情模式，**禁止**输出 VN 标签稿（【旁白】等），仅输出普通段落体。\n\n`
              : '\n')
          : '') +
        `请续写下一段剧情。` +
        (datingExtras?.unifiedMemoryAppendix?.trim() ? `\n\n${datingExtras.unifiedMemoryAppendix.trim()}` : '')
  const messages = [
    {
      role: 'system' as const,
      content: expandCharUserPlaceholders(systemPromptRaw, charUserNames),
    },
    {
      role: 'user' as const,
      content: expandCharUserPlaceholders(userPromptRaw, charUserNames),
    },
  ]
  /** 最大回复长度（词符/token） */
  const maxTokens = DATING_AI_MAX_OUTPUT_TOKENS
  const tokForTimeout = maxTokens
  const timeoutMs = Math.min(
    600_000,
    Math.max(120_000, 90_000 + tokForTimeout * 8),
  )
  const timeoutPromise = new Promise<string>((_, reject) => {
    window.setTimeout(
      () =>
        reject(
          new Error(
            `剧情生成超时（>${Math.round(timeoutMs / 1000)}s）。可尝试：降低「目标字数」、关闭本轮合并记忆要求、或换更快线路/模型后重试。`,
          ),
        ),
      timeoutMs,
    )
  })
  const slimMessages = buildSlimDatingPlotChatMessages({
    charUserDirective,
    character,
    userDemand,
    userText,
    historyBlock: historyClipped,
    perspectiveRule,
    perspectiveStrictRule,
    userReactionRule: userReactionPromptBlock,
    userReactionSlimHint,
    lengthRule,
    charUserNames,
    godPerspective,
    mainCharacterOffstage,
  })
  const out = await requestDatingPlotCompletion({
    apiConfig: apiConfig!,
    messages,
    slimMessages,
    maxTokens,
    timeoutPromise,
    charUserNames,
  })
  const trimmed = expandCharUserPlaceholders(out.trim(), charUserNames)
  const wbExtract = extractWorldBookAfterPatchBlock(trimmed)
  const trimmedForPlot = wbExtract.rest
  let wbAfterAppliedToDb = false
  let worldBookAfterRevertEntries: WorldBookAfterRevertEntry[] | undefined
  const filteredWbPatches =
    mainCharRow && wbExtract.patches.length
      ? filterDatingWorldBookAfterPatches(wbExtract.patches, mainCharRow, {
          historyPlotCount: aiPlotCount,
          plotBody: splitDatingAiResponseAndUnifiedMemoryJson(trimmedForPlot).plotRaw,
          userText: userText ?? '',
        })
      : wbExtract.patches
  if (mainCharRow && filteredWbPatches.length) {
    const snapshot = collectWorldBookAfterRevertSnapshot(mainCharRow, filteredWbPatches)
    try {
      const nextCh = applyWorldBookAfterPatchesToCharacter(mainCharRow, filteredWbPatches)
      if (nextCh) {
        wbAfterAppliedToDb = true
        await personaDb.upsertCharacter(nextCh)
        if (snapshot.length) worldBookAfterRevertEntries = snapshot
        window.dispatchEvent(
          new CustomEvent(WORLD_BOOK_AFTER_PATCH_UPDATED_EVENT, {
            detail: { appliedPatchCount: filteredWbPatches.length, source: 'model_inline' },
          }),
        )
      }
    } catch {
      /* 约会剧情：世界书补丁写库失败不影响正文落档 */
    }
  }
  const traceBody = splitDatingAiResponseAndUnifiedMemoryJson(trimmedForPlot).plotRaw
  const chatAfterProtocol = !!(mainCharRow && hasChatAfterWorldBookItems(mainCharRow))
  const injectedSnapshotEntries =
    chatAfterProtocol && mainCharRow
      ? listChatAfterWorldBookItems(mainCharRow).map((r) => ({
          characterId: mainCharRow.id,
          characterName: mainCharRow.name?.trim() || character.realName?.trim() || '角色',
          bookName: r.bookName,
          itemName: r.itemName,
          content: expandCharUserPlaceholders(r.content, charUserNames),
        }))
      : []
  const patchRowsForTrace = buildWorldBookAfterPatchRowsFromSingleCharacter(mainCharRow, filteredWbPatches)
  const worldBookAfterChatTrace =
    chatAfterProtocol || filteredWbPatches.length
      ? buildWorldBookAfterChatTrace({
          protocolInPrompt: chatAfterProtocol,
          injectedSnapshotEntries,
          patchOutputRulesIncluded: chatAfterProtocol,
          parsedPatches: patchRowsForTrace,
          appliedToDb: wbAfterAppliedToDb,
        })
      : null
  try {
    void publishDatingOfflineMemoryTrace({
      characterId: character.id,
      charName: character.realName,
      identityTags: character.identityTags ?? [],
      worldBackground: datingCharWorldBg,
      datingArchiveBlock,
      datingArchiveBlockPlain,
      isVnMode,
      historyPlotCount: history.length,
      userText,
      unsPrivateBlock: unsPrivClipped,
      unsGroupBlock: unsGrpClipped,
      unsOfflineBlock: unsOffClipped,
      storyTimelineNotes: storyTimelineClipped,
      conversationKey: onlineCtx?.conversationKey,
      apiConfig,
      rawAssistantOutput: traceBody,
      worldBookAfterChat: worldBookAfterChatTrace,
    })
  } catch {
    /* 思维溯源写入失败不影响剧情 */
  }
  return { text: trimmedForPlot, worldBookAfterRevertEntries }
}

export function DatingProvider({ children }: { children: ReactNode }) {
  const { state } = useCustomization()
  const apiConfig = useCurrentApiConfig('chatCard')
  const danmakuApiConfig = useCurrentApiConfig('danmaku')
  const [characters, setCharacters] = useState<CharacterInfo[]>(() => EMPTY_CHARACTERS)
  const [allArchives, setAllArchives] = useState<ArchivesStore>(() => buildDefaultStore(EMPTY_CHARACTERS))
  const [currentCharacterId, setCurrentCharacterId] = useState<string>('')
  const plotGenerating = useSyncExternalStore(
    subscribeDatingPlotGeneration,
    () => isDatingPlotGenerating(currentCharacterId),
    () => false,
  )
  /** 当前角色是否有后台剧情生成任务（不锁全页，可切走） */
  const loading = plotGenerating
  const [regeneratingPlotId, setRegeneratingPlotId] = useState<string | null>(null)
  const [datingHydrated, setDatingHydrated] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const contacts = state.wechatPersonaContacts
        const rows = await Promise.all(
          contacts.map(async (c) => {
            const row = await personaDb.getCharacter(c.characterId)
            if (!row) return null
            return toCharacterInfo(row, c.remarkName)
          }),
        )
        const baseChars = rows.filter((x): x is CharacterInfo => !!x)
        const charsRaw = await pullPhoneKvWithLocalStorageLegacy(CHARACTERS_KEY, [CHARACTERS_KEY])
        const archRaw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
        const mergedChars = mergeSavedCharacters(baseChars, charsRaw)
        setCharacters(mergedChars)
        setAllArchives(mergeArchives(mergedChars, archRaw))
      } catch {
        // keep defaults
      } finally {
        setDatingHydrated(true)
      }
    })()
  }, [state.wechatPersonaContacts])

  const charactersRef = useRef(characters)
  charactersRef.current = characters

  const refreshDatingCharacterAvatarsFromPersona = useCallback(async () => {
    const prev = charactersRef.current
    if (!prev.length) return
    const updates = new Map<string, string>()
    await Promise.all(
      prev.map(async (c) => {
        try {
          const row = await personaDb.getCharacter(c.id)
          if (!row) return
          updates.set(c.id, resolveDatingLiveAvatarUrl(row))
        } catch {
          /* ignore */
        }
      }),
    )
    if (!updates.size) return
    setCharacters((current) =>
      current.map((c) => {
        const nextUrl = updates.get(c.id)
        return nextUrl && nextUrl !== c.avatarUrl ? { ...c, avatarUrl: nextUrl } : c
      }),
    )
  }, [])

  useEffect(() => {
    if (!datingHydrated) return
    const onStorage = () => void refreshDatingCharacterAvatarsFromPersona()
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [datingHydrated, refreshDatingCharacterAvatarsFromPersona])

  useEffect(() => {
    if (!datingHydrated) return
    void personaDb.setPhoneKv(STORAGE_KEY, allArchives).catch(() => {})
  }, [allArchives, datingHydrated])

  useEffect(() => {
    if (!datingHydrated) return
    void personaDb.setPhoneKv(CHARACTERS_KEY, characters).catch(() => {})
  }, [characters, datingHydrated])

  useEffect(() => {
    if (!datingHydrated) return
    const reloadArchivesFromKv = () => {
      void (async () => {
        try {
          const archRaw = await pullPhoneKvWithLocalStorageLegacy(STORAGE_KEY, [STORAGE_KEY])
          setAllArchives(mergeArchives(charactersRef.current, archRaw))
        } catch {
          /* ignore */
        }
      })()
    }
    window.addEventListener(DATING_PLOT_GENERATION_COMPLETE_EVENT, reloadArchivesFromKv)
    return () => window.removeEventListener(DATING_PLOT_GENERATION_COMPLETE_EVENT, reloadArchivesFromKv)
  }, [datingHydrated])

  useEffect(() => {
    if (!currentCharacterId && characters[0]?.id) setCurrentCharacterId(characters[0].id)
  }, [characters, currentCharacterId])

  useEffect(() => {
    if (!characters.length) {
      if (currentCharacterId) setCurrentCharacterId('')
      return
    }
    if (!characters.some((c) => c.id === currentCharacterId)) {
      setCurrentCharacterId(characters[0]!.id)
    }
  }, [characters, currentCharacterId])

  const currentCharacter = useMemo(
    () => characters.find((c) => c.id === currentCharacterId) ?? characters[0] ?? FALLBACK_CHARACTER,
    [characters, currentCharacterId],
  )
  const currentArchive = allArchives[currentCharacter.id] ?? createDefaultArchive(currentCharacter)

  const updateCharacter = useCallback((id: string, patch: Partial<Omit<CharacterInfo, 'id'>>) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)))
  }, [])

  const patchArchive = useCallback(
    (characterId: string, updater: (prev: CharacterArchive) => CharacterArchive) => {
      setAllArchives((s) => {
        const baseChar = characters.find((c) => c.id === characterId) ?? FALLBACK_CHARACTER
        const base = s[characterId] ?? createDefaultArchive(baseChar)
        return { ...s, [characterId]: updater(base) }
      })
    },
    [characters],
  )

  /** 剧情等关键写入：先落 KV，再同步内存（切走微信/约会页后仍可读回） */
  const applyArchivePatch = useCallback(
    async (characterId: string, updater: (prev: CharacterArchive) => CharacterArchive) => {
      const nextStore = await patchDatingArchiveInKv(characterId, charactersRef.current, updater)
      setAllArchives(nextStore)
      return nextStore
    },
    [],
  )

  const archivesRef = useRef<ArchivesStore>(allArchives)
  useEffect(() => {
    archivesRef.current = allArchives
  }, [allArchives])

  const [branchesLoading, setBranchesLoading] = useState(false)

  const runGeneratePendingBranches = useCallback(
    async (characterId: string, char: CharacterInfo, arch: CharacterArchive) => {
      if (!arch.branchEnabled) {
        patchArchive(characterId, (p) => ({ ...p, pendingBranches: [] }))
        return
      }
      const lastAi = [...arch.plots].reverse().find((p) => p.type === 'ai')
      if (!lastAi) {
        patchArchive(characterId, (p) => ({ ...p, pendingBranches: [] }))
        return
      }
      const tail = formatRecentPlotsForPrompt(arch.plots, char.realName, DATING_AI_BRANCH_TAIL_MAX)
      setBranchesLoading(true)
      try {
        const memCtx = await resolveDatingMemorySessionContext(characterId)
        const playerIdentity = await loadPlayerIdentityForDating(
          characterId,
          memCtx.sessionPlayerIdentityId,
        )
        const list = await generateDatingBranchesAi({
          character: char,
          latestAiPlotBody: lastAi.content,
          tailContext: tail,
          godPerspective: arch.godPerspective,
          mainCharacterOffstage: !!arch.mainCharacterOffstage,
          apiConfig,
          playerIdentityCardName:
            playerIdentity?.wechatNickname?.trim() || playerIdentity?.name?.trim() || null,
        })
        patchArchive(characterId, (p) => ({ ...p, pendingBranches: list }))
      } catch (e) {
        window.alert(formatApiClientError(e, '分支生成失败，请稍后重试。'))
        patchArchive(characterId, (p) => ({ ...p, pendingBranches: [] }))
      } finally {
        setBranchesLoading(false)
      }
    },
    [apiConfig, patchArchive],
  )

  const enqueueRegenerateBranches = useCallback(
    (characterId: string) => {
      const arch = archivesRef.current[characterId]
      const char = characters.find((c) => c.id === characterId)
      if (!arch || !char) return
      void runGeneratePendingBranches(characterId, char, arch)
    },
    [characters, runGeneratePendingBranches],
  )

  const getOnlineMemoryContext = useCallback(
    async (
      characterId: string,
      relevance?: {
        userText?: string
        plotTail?: string
        /** 与本轮 generateDatingAi 使用的玩家身份一致，用于拼私聊 storage 键 */
        sessionPlayerIdentityId?: string | null
        /**
         * 重新生成 / 发送前传入：与本轮 plot 列表同源，避免 KV 异步或待重写旧稿进入注入块。
         */
        offlineUnsummarizedPlotSnapshot?: DatingPlotSnapshotItem[]
      },
    ): Promise<{
      recentMessages: string
      longTermMemory: string
      unsummarizedPrivateBlock: string
      unsummarizedGroupBlock: string
      unsummarizedOfflineBlock: string
      storyTimelineBlock: string
      conversationKey: string
      onlineInjectScope?: DatingOnlineInjectScopeMeta
    }> => {
      const cid = characterId.trim()
      const { chRow, sessionPid, conversationKey: convKey } = await resolveDatingWeChatConversationScope(
        cid,
        relevance?.sessionPlayerIdentityId,
      )

      const offlinePlotSnap = relevance?.offlineUnsummarizedPlotSnapshot ?? []
      const lastOfflineAiPlotTs = resolveLastOfflineAiPlotTimestampMs(offlinePlotSnap)

      let unsummarizedPrivateBlock = ''
      let unsummarizedGroupBlock = ''
      let onlineInjectScope: DatingOnlineInjectScopeMeta | undefined
      if (convKey && !convKey.startsWith('wxgrp:')) {
        const onlineBounds = await resolveOnlineMessageTimeBoundsForConversation({
          conversationKey: convKey,
          minMessageTimestamp: lastOfflineAiPlotTs,
        })
        try {
          const privRaw = await formatUnsummarizedPrivateChatBlock({
            conversationKey: convKey,
            maxMessages: MEMORY_UNSUMMARIZED_GATHER_MESSAGE_LIMIT,
            maxChars: MEMORY_UNSUMMARIZED_BLOCK_CHAR_CAP,
            minMessageTimestamp: lastOfflineAiPlotTs ?? undefined,
            includeMessageTimestamps: true,
            clipPreferRecent: true,
          })
          const privBody = stripUnsummarizedBlockFooter(privRaw)
          const privateMessageCount = countUnsummarizedInjectLines(privBody)
          if (privBody) {
            onlineInjectScope = {
              minMessageTimestamp:
                lastOfflineAiPlotTs != null
                  ? lastOfflineAiPlotTs + 1
                  : (await personaDb.getMemorySummaryCursorTimestamp(convKey) ?? 0) + 1,
              lastOfflineAiPlotTs,
              privateMessageCount: onlineBounds.count || privateMessageCount,
              onlineInjectMinTs: onlineBounds.minTs,
              onlineInjectMaxTs: onlineBounds.maxTs,
            }
            unsummarizedPrivateBlock =
              `${privBody}\n${formatDatingOnlineInjectScopeFooter(onlineInjectScope)}`
          }
        } catch {
          unsummarizedPrivateBlock = ''
        }
        try {
          const anchorGroupId =
            peekPrivateChatGroupAnchorFromDockStaging(cid) ??
            (await personaDb.getPrivateChatAnchorGroupId(cid, sessionPid))
          const grpRaw = await buildNpcGroupChatsUnsummarizedDigestForPrivatePrompt({
            npcCharacterId: cid,
            sessionPlayerIdentityId: sessionPid,
            boundPlayerIdentityId: chRow?.playerIdentityId,
            anchorGroupId,
            maxMessagesPerGroup: 60,
            charCap: DATING_AI_REFERENCE_SECTION_CHAR_CAP,
            minMessageTimestamp: lastOfflineAiPlotTs ?? undefined,
            includeMessageTimestamps: true,
          })
          const grpBody = stripUnsummarizedBlockFooter(grpRaw)
          const groupLineCount = countUnsummarizedInjectLines(grpBody)
          if (grpBody) {
            unsummarizedGroupBlock =
              `${grpBody}\n${formatDatingGroupOnlineInjectScopeFooter({
                lastOfflineAiPlotTs,
                lineCount: groupLineCount,
              })}`
          }
        } catch {
          unsummarizedGroupBlock = ''
        }
      }

      /** 仅用于长期记忆相关性 haystack，**不**再写入约会正文（避免与「尚未总结」重复） */
      const recent = await personaDb.listWeChatChatMessagesRecentByCharacter({ characterId: cid, limit: 48 })
      const recentHaystack = recent
        .map((m) => `${m.type === 'player' ? '我' : 'TA'}：${String(m.content || '').trim()}`)
        .filter((s) => s.length > 3)
        .join('\n')

      let unsummarizedOfflineBlock = ''
      const offlineSnap = relevance?.offlineUnsummarizedPlotSnapshot
      if (offlineSnap != null) {
        unsummarizedOfflineBlock = await formatOfflineUnsummarizedBlockFromPlotSnapshots(
          offlineSnap,
          chRow?.name?.trim() || chRow?.wechatNickname?.trim() || null,
        )
      } else {
        try {
          unsummarizedOfflineBlock = await buildUnsummarizedOfflineDatingText(
            cid,
            chRow?.name?.trim() || chRow?.wechatNickname?.trim() || null,
          )
        } catch {
          unsummarizedOfflineBlock = ''
        }
      }

      let storyTimelineBlock = ''
      const hay = buildMemoryRelevanceHaystack([
        relevance?.userText,
        relevance?.plotTail,
        unsummarizedPrivateBlock,
        unsummarizedGroupBlock,
        unsummarizedOfflineBlock.slice(0, 4000),
        recentHaystack,
      ])
      try {
        storyTimelineBlock = (
          await loadStoryTimelinePromptBlock(cid, {
            relevanceText: hay,
            apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
            conversationKey: convKey || undefined,
          })
        ).trim()
      } catch {
        storyTimelineBlock = ''
      }

      const { formatCharacterMemoriesForPromptInjection } = await import(
        '../memory/formatCharacterMemoriesForPromptInjection'
      )
      const longTermMemory = await formatCharacterMemoriesForPromptInjection(cid, hay, {
        apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
        conversationKey: convKey || undefined,
      })

      return {
        recentMessages: '',
        longTermMemory,
        unsummarizedPrivateBlock,
        unsummarizedGroupBlock,
        unsummarizedOfflineBlock,
        storyTimelineBlock,
        conversationKey: convKey || '',
        onlineInjectScope,
      }
    },
    [apiConfig],
  )

  const setMode = useCallback(
    (mode: DateMode) => {
      patchArchive(currentCharacter.id, (p) => ({ ...p, modePreference: mode }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setBranchEnabled = useCallback(
    (enabled: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({
        ...p,
        branchEnabled: enabled,
        branchContinuationHint: undefined,
        pendingBranches: [],
      }))
      if (enabled) queueMicrotask(() => enqueueRegenerateBranches(charId))
    },
    [currentCharacter.id, enqueueRegenerateBranches, patchArchive],
  )

  const setGodPerspective = useCallback(
    (v: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({
        ...p,
        godPerspective: v,
        ...(v ? { mainCharacterOffstage: false } : {}),
      }))
      if (archivesRef.current[charId]?.branchEnabled) {
        queueMicrotask(() => enqueueRegenerateBranches(charId))
      }
    },
    [currentCharacter.id, enqueueRegenerateBranches, patchArchive],
  )

  const setMainCharacterOffstage = useCallback(
    (v: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({
        ...p,
        mainCharacterOffstage: !!v,
        ...(v ? { godPerspective: false } : {}),
      }))
      if (archivesRef.current[charId]?.branchEnabled) {
        queueMicrotask(() => enqueueRegenerateBranches(charId))
      }
    },
    [currentCharacter.id, enqueueRegenerateBranches, patchArchive],
  )
  const setVnVoiceDisabled = useCallback(
    (disabled: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({ ...p, vnVoiceDisabled: !!disabled }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setDirectorMode = useCallback(
    (v: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({ ...p, directorMode: !!v }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setAutoUserReaction = useCallback(
    (v: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({ ...p, autoUserReaction: !!v }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setGenerateParallelOnSend = useCallback(
    (v: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({ ...p, generateParallelOnSend: !!v }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setGenerateIfLineOnSend = useCallback(
    (v: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({ ...p, generateIfLineOnSend: !!v }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setOfflineDanmakuEnabled = useCallback(
    (enabled: boolean) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({ ...p, offlineDanmakuEnabled: !!enabled }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setDatingLengthTargetChars = useCallback(
    (chars: number) => {
      const charId = currentCharacter.id
      if (!charId) return
      const n = clampDatingLengthTargetChars(Number(chars))
      if (!Number.isFinite(n)) return
      patchArchive(charId, (p) => ({ ...p, datingLengthTargetChars: n }))
    },
    [currentCharacter.id, patchArchive],
  )

  const runOfflineDanmakuAfterAi = useCallback(
    async (char: CharacterInfo, arch: CharacterArchive) => {
      if (arch.modePreference === 'vn' || !arch.offlineDanmakuEnabled) return
      try {
        const g = await personaDb.getGlobalSettings()
        const pid = char.id.trim()
        if (!pid) return
        const dmRow = await personaDb.getCharacterDanmakuSettings(pid)
        const eff = resolveEffectiveDanmakuVisuals(g, pid, dmRow)
        if (eff.skipCharacter) return
        const chRow = await personaDb.getCharacter(pid)
        const memCtx = await resolveDatingMemorySessionContext(pid)
        const playerIdentity = await loadPlayerIdentityForDating(
          pid,
          memCtx.sessionPlayerIdentityId,
        )
        const playerDisplayName = playerIdentity?.name?.trim() || '用户'
        let worldBackgroundPrompt = ''
        if (chRow?.worldBackgroundEnabled !== false && chRow?.worldBackgroundId?.trim()) {
          try {
            const wbg = await personaDb.getWorldBackground(chRow.worldBackgroundId.trim())
            worldBackgroundPrompt = formatWorldBackgroundForPrompt(wbg).trim()
          } catch {
            /* ignore */
          }
        }
        const lastPlayer = [...arch.plots].reverse().find((p) => p.type === 'player')
        const plotTail = formatRecentPlotsForPrompt(arch.plots, char.realName, 1600)
        const onlineCtx = await getOnlineMemoryContext(pid, {
          userText: lastPlayer?.content,
          plotTail,
          sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
          offlineUnsummarizedPlotSnapshot: plotItemsToSnapshots(arch.plots),
        })
        const { loadOfflineDatingPlotsPromptBlock } = await import('./loadOfflineDatingPlotsForWechatPrompt')
        const offlineDatingPlotsContext = await loadOfflineDatingPlotsPromptBlock(pid, char.realName)
        const transcript = plotsToDanmakuTranscript(arch.plots, char.realName)
        const lines = await requestWeChatDanmakuVarietyShow({
          apiConfig: danmakuApiConfig,
          character: chRow,
          playerIdentity,
          playerDisplayName,
          transcript,
          promptMode: 'persona',
          useMemory: eff.useMemory,
          generateCount: eff.generateCount,
          customRulesPrompt: eff.customPrompt.trim() || undefined,
          longTermMemoryNotes: onlineCtx.longTermMemory,
          worldBackgroundPrompt: worldBackgroundPrompt || undefined,
          offlineDatingPlotsContext,
          unsummarizedPrivateNotes: onlineCtx.unsummarizedPrivateBlock,
          unsummarizedGroupNotes: onlineCtx.unsummarizedGroupBlock,
          chatMemberIds: [pid],
          globalWechatPlate: 'offline_plot',
        })
        emitDatingOfflineDanmakuLines(lines)
      } catch {
        /* ignore */
      }
    },
    [danmakuApiConfig, getOnlineMemoryContext],
  )

  const sendPlayerInput = useCallback(
    async (text: string, perspective: NarrativePerspective = 'second', genOptions?: NarrativeGenOptions) => {
      const msg = text.trim()
      const charId = currentCharacter.id
      if (!msg || !charId || isDatingPlotGenerating(charId)) return false
      const char = currentCharacter
      const archiveSnap = currentArchive
      /** 须优先读 genOptions：VN 分支在同一次点击里会先 stage 再 send，React 尚未提交时 archive 里的 hint 仍为旧值。 */
      const hint =
        (genOptions?.branchContinuationHint ?? '').trim() || (archiveSnap.branchContinuationHint ?? '').trim() || undefined
      const p1: PlotItem = { id: uid('p'), type: 'player', content: msg, timestamp: Date.now() }
      const genOpts = {
        godPerspective: archiveSnap.godPerspective,
        mainCharacterOffstage: !!archiveSnap.mainCharacterOffstage,
        perspective,
        isVnMode: archiveSnap.modePreference === 'vn',
        vnVoiceDisabled: !!archiveSnap.vnVoiceDisabled,
      }
      const mergedGen: NarrativeGenOptions | undefined = (() => {
        const o: NarrativeGenOptions = { ...(genOptions ?? {}) }
        if (hint) o.branchContinuationHint = hint
        if (
          o.lengthTargetChars == null &&
          typeof archiveSnap.datingLengthTargetChars === 'number' &&
          Number.isFinite(archiveSnap.datingLengthTargetChars)
        ) {
          o.lengthTargetChars = archiveSnap.datingLengthTargetChars
        }
        return Object.keys(o).length ? o : undefined
      })()
      if (typeof mergedGen?.lengthTargetChars === 'number' && Number.isFinite(mergedGen.lengthTargetChars)) {
        const n = clampDatingLengthTargetChars(mergedGen.lengthTargetChars)
        patchArchive(charId, (p) => ({ ...p, datingLengthTargetChars: n }))
      }
      try {
        await applyArchivePatch(charId, (p) => {
          const checkpointIdx = hint ? p.plots.length : null
          return {
            ...p,
            branchContinuationHint: undefined,
            branchNodeHistory:
              checkpointIdx != null ? [...p.branchNodeHistory, checkpointIdx] : p.branchNodeHistory,
            plots: [...p.plots, p1],
          }
        })
      } catch {
        return false
      }
      const plotsForModel = [...archiveSnap.plots, p1]

      beginDatingPlotGeneration(charId)
      beginDatingPlotContentHint(charId)
      void (async () => {
        let aiAppended = false
        try {
          const plotTail = formatRecentPlotsForPrompt(plotsForModel, char.realName, 1600)
          const memCtx = await resolveDatingMemorySessionContext(char.id)
          const playerIdentity = await loadPlayerIdentityForDating(
            char.id,
            memCtx.sessionPlayerIdentityId,
          )
          const [onlineCtx, { datingExtras: turnExtras, memoryGather }] = await Promise.all([
            getOnlineMemoryContext(char.id, {
              userText: msg,
              plotTail,
              sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
              offlineUnsummarizedPlotSnapshot: plotItemsToSnapshots(plotsForModel),
            }),
            buildDatingTurnModelExtras({
              char,
              plotsSnapshotForGather: plotItemsToSnapshots(plotsForModel),
              sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
              wechatAccountId: memCtx.wechatAccountId,
              conversationKey: memCtx.conversationKey,
            }),
          ])
          const aiGen = await generateDatingAi(
            char,
            apiConfig,
            plotsForModel,
            char.prompt,
            msg,
            genOpts,
            onlineCtx,
            playerIdentity,
            mergedGen,
            turnExtras,
          )
          const aiTextRaw = aiGen.text
          const plotRawOnly = splitDatingAiResponseAndUnifiedMemoryJson(aiTextRaw).plotRaw
          const parsed = extractAiPlotSections(plotRawOnly)
          const plotTs = Date.now()
          const { timelineSnap, timelineDelta } = await timelinePersistFieldsFromAiTextRaw(aiTextRaw, plotTs, {
            apiConfig,
            plotBody: parsed.content,
            offlineBlock: memoryGather?.offlineBlock,
            characterId: char.id,
            characterRealName: char.realName,
            mainCharacterOffstage: !!archiveSnap.mainCharacterOffstage,
          })
          const wbRevertNew = sanitizeWorldBookAfterRevertEntries(aiGen.worldBookAfterRevertEntries)
          let aiPlot: PlotItem = {
            id: uid('ai'),
            type: 'ai',
            timestamp: plotTs,
            highlightText: char.realName,
            ...aiPlotPersistFields(parsed, timelineSnap, timelineDelta),
            worldBookAfterRevertEntries: wbRevertNew.length ? wbRevertNew : undefined,
          }
          const plotsWithAi = [...plotsForModel, aiPlot]
          await applyArchivePatch(charId, (p) => ({
            ...p,
            plots: [...p.plots, aiPlot],
            currentProgress: p.currentProgress + 1,
            lastDateAt: Date.now(),
            pendingBranches: [],
          }))
          let plotsWithAiFinal = plotsWithAi
          let parallelGeneratedPlotId: string | null = null
          const wantParallelOnSend =
            mergedGen?.generateParallelOnSend ?? archiveSnap.generateParallelOnSend ?? false
          const wantDims =
            wantParallelOnSend ||
            (mergedGen?.generateIfLineOnSend ?? archiveSnap.generateIfLineOnSend)
          if (wantDims) {
            aiPlot = await enrichAiPlotWithOptionalDimensions({
              char,
              archiveSnap,
              aiPlot,
              plotsWithAi,
              anchorBody: parsed.content,
              mergedGen,
              perspective,
              apiConfig,
            })
            plotsWithAiFinal = plotsWithAi.map((p) => (p.id === aiPlot.id ? aiPlot : p))
            if (wantParallelOnSend && aiPlot.parallelEvent?.content?.trim()) {
              parallelGeneratedPlotId = aiPlot.id
            }
            await applyArchivePatch(charId, (p) => ({
              ...p,
              plots: p.plots.map((x) => (x.id === aiPlot.id ? aiPlot : x)),
            }))
          }
          endDatingPlotContentHint(charId)
          aiAppended = true
          if (archiveSnap.branchEnabled) {
            void runGeneratePendingBranches(charId, char, {
              ...archiveSnap,
              plots: plotsWithAiFinal,
            })
          }
          void runOfflineDanmakuAfterAi(char, {
            ...archiveSnap,
            plots: plotsWithAiFinal,
          })
          let linkedNpcNames: string[] = []
          try {
            linkedNpcNames = await finalizeDatingMemoryAfterAiReply({
              apiConfig,
              aiTextRaw,
              memoryGather,
              plotsSnapshotAfterAi: plotItemsToSnapshots(plotsWithAiFinal),
              plotsAfterAi: plotsWithAiFinal,
              char,
              memoryTurnAiPlotId: aiPlot.id,
              worldBookInlinePatchApplied: Boolean(wbRevertNew.length),
              notifyParallelSummaryForPlotId: parallelGeneratedPlotId,
              userText: msg,
            })
          } catch (memErr) {
            console.warn('[dating] memory post failed after plot saved', memErr)
          }
          dispatchDatingPlotGenerationComplete({
            characterId: charId,
            characterName: char.realName,
            linkedNpcNames,
          })
        } catch (e) {
          if (!aiAppended) {
            try {
              await applyArchivePatch(charId, (p) => ({
                ...p,
                plots: p.plots.filter((x) => x.id !== p1.id),
                branchNodeHistory: hint ? p.branchNodeHistory.slice(0, -1) : p.branchNodeHistory,
                branchContinuationHint: hint || p.branchContinuationHint,
              }))
            } catch {
              /* ignore rollback failure */
            }
          }
          dispatchDatingPlotGenerationError({
            characterId: charId,
            characterName: char.realName,
            message: formatApiClientError(e, '剧情生成失败，请稍后重试。'),
          })
        } finally {
          endDatingPlotContentHint(charId)
          endDatingPlotGeneration(charId)
        }
      })()

      return true
    },
    [
      apiConfig,
      applyArchivePatch,
      currentArchive,
      currentCharacter,
      getOnlineMemoryContext,
      patchArchive,
      runGeneratePendingBranches,
      runOfflineDanmakuAfterAi,
    ],
  )

  const stageBranchChoice = useCallback(
    (option: BranchOption) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({
        ...p,
        branchContinuationHint: option.nextPrompt,
      }))
    },
    [currentCharacter.id, patchArchive],
  )

  const resetCurrentArchive = useCallback(() => {
    const c = currentCharacter
    if (!c.id) return
    setAllArchives((s) => ({ ...s, [c.id]: createDefaultArchive(c) }))
  }, [currentCharacter])

  const rollbackBranchNode = useCallback(() => {
    if (!currentCharacter.id) return
    const charId = currentCharacter.id
    void (async () => {
      const prevPlots = archivesRef.current[charId]?.plots ?? []
      await applyArchivePatch(charId, (p) => {
        if (!p.branchNodeHistory.length) return p
        const next = [...p.branchNodeHistory]
        const checkpoint = next.pop() ?? p.plots.length
        const trimmed = p.plots.slice(0, Math.max(1, checkpoint))
        return {
          ...p,
          plots: trimmed,
          branchNodeHistory: next,
          pendingBranches: [],
        }
      })
      const plotsAfterRollback = archivesRef.current[charId]?.plots ?? []
      const owners = await resolveDatingPlotLinkedOwnerIds(charId)
      await finalizeDatingPlotListMutationSideEffects({
        perspectiveCharacterId: charId,
        linkedFromCharacterIds: owners,
        prevPlots,
        nextPlots: plotsAfterRollback,
        apiConfig,
      })
      enqueueRegenerateBranches(charId)
    })()
  }, [apiConfig, applyArchivePatch, currentCharacter.id, enqueueRegenerateBranches])

  const vnRollbackLastRound = useCallback(() => {
    const charId = String(currentCharacter.id || '').trim()
    if (!charId || loading) return false
    if (currentArchive.modePreference !== 'vn') return false
    const plots = currentArchive.plots
    if (plots.length < 2) return false
    const last = plots[plots.length - 1]!
    if (last.type !== 'ai') return false
    const prev = plots[plots.length - 2]!
    const nextPlots = prev.type === 'player' ? plots.slice(0, -2) : plots.slice(0, -1)
    if (nextPlots.length < 1) return false
    try {
      sessionStorage.setItem(vnRollbackJumpStorageKey(charId), String(Date.now()))
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(`wechat-dating-vn-progress:${charId}`)
    } catch {
      /* ignore */
    }
    void (async () => {
      const prevPlots = plots
      await applyArchivePatch(charId, (p) => ({
        ...p,
        plots: nextPlots,
        pendingBranches: [],
        branchContinuationHint: undefined,
        currentProgress: Math.max(0, p.currentProgress - 1),
      }))
      const plotsAfterRollback = archivesRef.current[charId]?.plots ?? []
      const owners = await resolveDatingPlotLinkedOwnerIds(charId)
      await finalizeDatingPlotListMutationSideEffects({
        perspectiveCharacterId: charId,
        linkedFromCharacterIds: owners,
        prevPlots,
        nextPlots: plotsAfterRollback,
        apiConfig,
      })
      enqueueRegenerateBranches(charId)
    })()
    return true
  }, [
    apiConfig,
    applyArchivePatch,
    currentArchive.modePreference,
    currentArchive.plots,
    currentCharacter.id,
    enqueueRegenerateBranches,
    loading,
  ])

  const savePlotText = useCallback(() => {
    if (!currentCharacter.id) return ''
    const lines = currentArchive.plots.map((x) => `${x.type === 'player' ? '我' : currentCharacter.realName}：${x.content}`)
    const text = lines.join('\n\n')
    void navigator.clipboard?.writeText(text)
    return text
  }, [currentArchive, currentCharacter])

  const updatePlotItem = useCallback(
    (
      plotId: string,
      patch: Partial<
        Pick<
          PlotItem,
          | 'content'
          | 'logicPass'
          | 'planSummary'
          | 'versions'
          | 'versionLogicPasses'
        | 'versionTimelineSnapshots'
        | 'timelineSnapshot'
        | 'currentVersionIndex'
        | 'parallelEvent'
        | 'ifLine'
      >
    >,
  ) => {
      const charId = currentCharacter.id
      if (!charId) return
      patchArchive(charId, (p) => ({
        ...p,
        plots: p.plots.map((x) => (x.id === plotId ? { ...x, ...patch } : x)),
      }))
    },
    [currentCharacter.id, patchArchive],
  )

  const setPlotVersionIndex = useCallback(
    (plotId: string, index: number) => {
      const charId = currentCharacter.id
      if (!charId) return
      void (async () => {
        await applyArchivePatch(charId, (p) => ({
          ...p,
          plots: p.plots.map((x) => (x.id === plotId && x.type === 'ai' ? plotWithVersionIndex(x, index) : x)),
        }))
        const nextPlots = archivesRef.current[charId]?.plots ?? []
        try {
          await rebuildStoryTimelineFromDatingPlots(charId, nextPlots, { apiConfig })
        } catch (e) {
          console.warn('[dating] story timeline rebuild on version switch failed', e)
        }
      })()
    },
    [apiConfig, applyArchivePatch, currentCharacter.id],
  )

  const deletePlotItem = useCallback(
    (plotId: string) => {
      const charId = currentCharacter.id
      if (!charId) return
      void (async () => {
        const prevPlots = archivesRef.current[charId]?.plots ?? []
        await applyArchivePatch(charId, (p) => ({
          ...p,
          plots: p.plots.filter((x) => x.id !== plotId),
          pendingBranches: [],
        }))
        const nextPlots = archivesRef.current[charId]?.plots ?? []
        const owners = await resolveDatingPlotLinkedOwnerIds(charId)
        await finalizeDatingPlotListMutationSideEffects({
          perspectiveCharacterId: charId,
          linkedFromCharacterIds: owners,
          prevPlots,
          nextPlots,
          apiConfig,
        })
        enqueueRegenerateBranches(charId)
      })()
    },
    [apiConfig, applyArchivePatch, currentCharacter.id, enqueueRegenerateBranches],
  )

  const regenerateAiPlot = useCallback(
    async (
      plotId: string,
      perspective: NarrativePerspective = 'second',
      genOptions?: NarrativeGenOptions,
      bias?: string,
    ) => {
      if (!currentCharacter.id || regeneratingPlotId || isDatingPlotGenerating(currentCharacter.id)) return
      const charId = currentCharacter.id
      const char = currentCharacter
      const archive = currentArchive
      const idx = archive.plots.findIndex((p) => p.id === plotId)
      if (idx < 0 || archive.plots[idx]!.type !== 'ai') return

      setRegeneratingPlotId(plotId)
      beginDatingPlotGeneration(charId)
      beginDatingPlotContentHint(charId)
      void (async () => {
      try {
        const before = archive.plots.slice(0, idx)
        const prev = before[before.length - 1]
        const userMsg = prev?.type === 'player' ? prev.content : undefined
        const systemPromptField = userMsg
          ? char.prompt
          : `${char.realName}的线下剧情开场（请重写本段 AI：勿复读旧稿，保持人设与硬性输出格式含 <thinking>）`
        const plotTail = formatRecentPlotsForPrompt(before, char.realName, 1600)
        const memCtx = await resolveDatingMemorySessionContext(char.id)
        const playerIdentity = await loadPlayerIdentityForDating(
          char.id,
          memCtx.sessionPlayerIdentityId,
        )
        if (typeof genOptions?.lengthTargetChars === 'number' && Number.isFinite(genOptions.lengthTargetChars)) {
          const n = clampDatingLengthTargetChars(genOptions.lengthTargetChars)
          patchArchive(charId, (p) => ({ ...p, datingLengthTargetChars: n }))
        }
        const mergedRegenOpts: NarrativeGenOptions | undefined = (() => {
          const o: NarrativeGenOptions = { ...(genOptions ?? {}) }
          if (
            o.lengthTargetChars == null &&
            typeof archive.datingLengthTargetChars === 'number' &&
            Number.isFinite(archive.datingLengthTargetChars)
          ) {
            o.lengthTargetChars = archive.datingLengthTargetChars
          }
          return Object.keys(o).length ? o : undefined
        })()
        const genOpts = {
          godPerspective: archive.godPerspective,
          mainCharacterOffstage: !!archive.mainCharacterOffstage,
          perspective,
          isVnMode: archive.modePreference === 'vn',
          vnVoiceDisabled: !!archive.vnVoiceDisabled,
        }
        const plotSlot = archive.plots[idx]!
        const wbRevertForRegen = sanitizeWorldBookAfterRevertEntries(plotSlot.worldBookAfterRevertEntries)
        if (wbRevertForRegen.length) {
          try {
            const chRow = await personaDb.getCharacter(char.id)
            if (chRow) {
              const restored = applyWorldBookAfterRevertEntries(chRow, wbRevertForRegen)
              if (restored) await personaDb.upsertCharacter(restored)
            }
          } catch {
            /* 恢复失败则仍用当前人设尝试生成 */
          }
        }
        await clearOfflinePlotContextVectorsForCharacter(char.id)
        const [{ datingExtras: turnExtras, memoryGather }, onlineCtx] = await Promise.all([
          buildDatingTurnModelExtras({
            char,
            plotsSnapshotForGather: plotItemsToSnapshots(before),
            sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
            wechatAccountId: memCtx.wechatAccountId,
            conversationKey: memCtx.conversationKey,
            regeneratingWorldBookBaseline: true,
            skipMemoryRoundBump: true,
          }),
          getOnlineMemoryContext(char.id, {
            userText: userMsg ?? '',
            plotTail,
            sessionPlayerIdentityId: memCtx.sessionPlayerIdentityId,
            offlineUnsummarizedPlotSnapshot: plotItemsToSnapshots(before),
          }),
        ])
        const aiGenRegen = await generateDatingAi(
          char,
          apiConfig,
          before,
          systemPromptField,
          userMsg,
          genOpts,
          { ...onlineCtx, initialBias: String(bias || '').trim() || undefined },
          playerIdentity,
          mergedRegenOpts,
          turnExtras,
        )
        const aiTextRaw = String(aiGenRegen?.text ?? '')
        const plotRawRegen = splitDatingAiResponseAndUnifiedMemoryJson(aiTextRaw).plotRaw
        const parsed = extractAiPlotSections(plotRawRegen)
        const plotTsRegen = Date.now()
        const { timelineSnap: timelineSnapRegen, timelineDelta: timelineDeltaRegen } =
          await timelinePersistFieldsFromAiTextRaw(aiTextRaw, plotTsRegen, {
            apiConfig,
            plotBody: parsed.content,
            offlineBlock: memoryGather?.offlineBlock,
            characterId: char.id,
            characterRealName: char.realName,
            mainCharacterOffstage: !!archive.mainCharacterOffstage,
          })
        const nextRevert = sanitizeWorldBookAfterRevertEntries(aiGenRegen.worldBookAfterRevertEntries)
        const nextPlot: PlotItem = {
          ...appendAiRegenerateVersion(
            plotSlot,
            parsed.content,
            parsed.logicPass || undefined,
            parsed.planSummary,
            timelineSnapRegen,
            timelineDeltaRegen,
          ),
          worldBookAfterRevertEntries: nextRevert.length ? nextRevert : undefined,
        }
        await applyArchivePatch(charId, (p) => ({
          ...p,
          plots: p.plots.map((x, i) => (i === idx ? nextPlot : x)),
          pendingBranches: [],
        }))
        endDatingPlotContentHint(charId)
        const nextPlots = archive.plots.map((x, i) => (i === idx ? nextPlot : x))
        const archAfter: CharacterArchive = { ...archive, plots: nextPlots }
        if (archive.branchEnabled) {
          void runGeneratePendingBranches(charId, char, archAfter)
        }
        void runOfflineDanmakuAfterAi(char, archAfter)
        let linkedNpcNames: string[] = []
        try {
          linkedNpcNames = await finalizeDatingMemoryAfterAiReply({
            apiConfig,
            aiTextRaw,
            memoryGather,
            plotsSnapshotAfterAi: plotItemsToSnapshots(nextPlots),
            plotsAfterAi: nextPlots,
            char,
            memoryTurnAiPlotId: plotId,
            skipMemoryRoundBump: true,
            worldBookInlinePatchApplied: Boolean(nextRevert.length),
          })
        } catch (memErr) {
          console.warn('[dating] memory post failed after plot saved', memErr)
        }
        dispatchDatingPlotGenerationComplete({
          characterId: charId,
          characterName: char.realName,
          linkedNpcNames,
        })
      } catch (e) {
        dispatchDatingPlotGenerationError({
          characterId: charId,
          characterName: char.realName,
          message: formatApiClientError(e, '重新生成失败，请稍后重试。'),
        })
      } finally {
        setRegeneratingPlotId(null)
        endDatingPlotContentHint(charId)
        endDatingPlotGeneration(charId)
      }
      })()
    },
    [
      apiConfig,
      applyArchivePatch,
      currentArchive,
      currentCharacter,
      getOnlineMemoryContext,
      patchArchive,
      regeneratingPlotId,
      runGeneratePendingBranches,
      runOfflineDanmakuAfterAi,
    ],
  )

  const generatePlotDimension = useCallback(
    async (
      plotId: string,
      kind: PlotDimensionKind,
      writingGuide: string,
      lengthTargetChars: number,
      perspective: NarrativePerspective = 'second',
    ) => {
      const charId = currentCharacter.id
      if (!charId) throw new Error('未选择角色')
      const char = currentCharacter
      const archive = currentArchive
      const plotIdx = archive.plots.findIndex((p) => p.id === plotId)
      if (plotIdx < 0 || archive.plots[plotIdx]!.type !== 'ai') {
        throw new Error('仅 AI 剧情卡片可生成平行事件 / IF 线')
      }
      const plot = archive.plots[plotIdx]!
      const anchorBody = resolveDatingPlotDisplayFromItem(plot).displayBody.trim()
      if (!anchorBody) throw new Error('锚点剧情正文为空')
      const before = archive.plots.slice(0, plotIdx + 1)
      const tail = formatRecentPlotsForPrompt(before, char.realName, 2200)
      const memCtx = await resolveDatingMemorySessionContext(char.id)
      const playerIdentity = await loadPlayerIdentityForDating(
        char.id,
        memCtx.sessionPlayerIdentityId,
      )
      const playerName =
        playerIdentity?.wechatNickname?.trim() || playerIdentity?.name?.trim() || null
      const content = await generateDatingPlotDimensionAi({
        kind,
        character: char,
        anchorPlotBody: anchorBody,
        tailContext: tail,
        writingGuide,
        lengthTargetChars,
        godPerspective: archive.godPerspective,
        mainCharacterOffstage: !!archive.mainCharacterOffstage,
        perspective,
        apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
        playerIdentityCardName: playerName,
      })
      const parallelArtifactBase: PlotDimensionArtifact = {
        content,
        writingGuide: String(writingGuide ?? '').trim(),
        lengthTargetChars: parsePlotDimensionLengthTarget(lengthTargetChars, archive.datingLengthTargetChars ?? 500),
        updatedAt: Date.now(),
      }
      let parallelEvent: PlotDimensionArtifact = parallelArtifactBase
      if (kind === 'parallel') {
        const timelineDelta = await resolveParallelEventSummaryDelta({
          apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
          mainCharacterId: charId,
          plot: { ...plot, parallelEvent: parallelArtifactBase },
          anchorPlotBody: anchorBody,
        })
        parallelEvent = timelineDelta
          ? { ...parallelArtifactBase, timelineDelta }
          : parallelArtifactBase
      }
      const patch =
        kind === 'parallel' ? { parallelEvent } : { ifLine: parallelArtifactBase }
      const nextStore = await applyArchivePatch(charId, (p) => ({
        ...p,
        plots: p.plots.map((x) => (x.id === plotId ? { ...x, ...patch } : x)),
      }))
      if (kind === 'parallel') {
        const nextPlots = nextStore[charId]?.plots ?? []
        const rebuild = await rebuildStoryTimelineFromDatingPlots(charId, nextPlots, {
          apiConfig: apiConfig?.apiUrl?.trim() && apiConfig?.apiKey?.trim() ? apiConfig : null,
        })
        if (rebuild.parallelSummaryPlotIds.includes(plotId)) {
          const plotWithParallel = nextPlots.find((p) => p.id === plotId)
          if (plotWithParallel) {
            await notifyParallelSummaryTableWritten(char.realName, charId, plotWithParallel)
          }
        }
      }
    },
    [apiConfig, applyArchivePatch, currentArchive, currentCharacter],
  )

  const value: Ctx = {
    characters,
    currentCharacterId: currentCharacter.id || '',
    currentCharacter,
    currentArchive,
    loading,
    setCurrentCharacterId,
    updateCharacter,
    setMode,
    setBranchEnabled,
    setGodPerspective,
    setMainCharacterOffstage,
    setVnVoiceDisabled,
    setDirectorMode,
    setAutoUserReaction,
    setGenerateParallelOnSend,
    setGenerateIfLineOnSend,
    setOfflineDanmakuEnabled,
    setDatingLengthTargetChars,
    sendPlayerInput,
    stageBranchChoice,
    branchesLoading,
    resetCurrentArchive,
    rollbackBranchNode,
    vnRollbackLastRound,
    savePlotText,
    allArchives,
    regeneratingPlotId,
    updatePlotItem,
    setPlotVersionIndex,
    deletePlotItem,
    regenerateAiPlot,
    generatePlotDimension,
  }

  return <DatingContext.Provider value={value}>{children}</DatingContext.Provider>
}

export function useDating() {
  const ctx = useContext(DatingContext)
  if (!ctx) throw new Error('useDating must be used inside DatingProvider')
  return ctx
}

