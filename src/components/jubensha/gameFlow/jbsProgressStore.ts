import type { FlowState } from './gameFlowTypes'
import type { ChatRoomPhase } from './chatRoom/chatRoomPhase'
import { CHAT_ROOM_PHASE_LABELS } from './chatRoom/chatRoomPhase'
import type { DrawerTab, JBSChatMessage, JBSStep } from './chatRoom/jbsFlowTypes'
import { JBS_STEP_LABELS } from './chatRoom/jbsFlowTypes'
import type { ReadingSession } from './chatRoom/scriptReader/scriptReaderTypes'

const STORAGE_KEY = 'jbs-script-progress-v1'
const PROGRESS_VERSION = 1 as const

/** 聊天室内语音序列播放进度（避免续玩重复播音频 / 重复推送气泡） */
export type JbsVoicePlaybackState = {
  /** 故事背景（Step 2）语音序列是否已全部播完 */
  storyBgDone: boolean
  /** 故事背景已 finalize 并入消息的轨数（0-based 计数，等于已显示气泡数） */
  storyBgCompletedTrackCount: number
  /** 第一幕公共剧情（Step 4）语音序列是否已全部播完 */
  act1PublicPlotDone: boolean
  /** 第一幕公共剧情已 finalize 的轨数 */
  act1PublicPlotCompletedTrackCount: number
}

export const EMPTY_VOICE_PLAYBACK: JbsVoicePlaybackState = {
  storyBgDone: false,
  storyBgCompletedTrackCount: 0,
  act1PublicPlotDone: false,
  act1PublicPlotCompletedTrackCount: 0,
}

export type JbsEngineSnapshot = {
  currentStep: JBSStep
  loopRound: number
  messages: JBSChatMessage[]
  collectedClueIds: string[]
  dispersalTriggeredIds: string[]
  readingSession: Pick<
    ReadingSession,
    'currentPage' | 'isOpen' | 'isMinimized' | 'hasFinishedPhase' | 'bookDelivered'
  >
  drawerOpen: boolean
  drawerTab: DrawerTab
  bgmMuted: boolean
  clueBadgeCount: number
  voicePlayback: JbsVoicePlaybackState
}

export type JbsScriptProgress = {
  version: typeof PROGRESS_VERSION
  scriptId: string
  savedAt: number
  playerDisplayName: string
  gameFlow: FlowState
  dmVoiceCompleted: boolean
  chatRoomPhase: ChatRoomPhase | null
  activeCardId: string | null
  lockedCardId: string | null
  lockedRoleName: string | null
  /** 入局 DM 开场白语音：已播完轨数 */
  dmIntroCompletedTrackCount: number
  engine: JbsEngineSnapshot | null
}

type StoredPayload = {
  byScript?: Record<string, JbsScriptProgress>
}

function readAll(): StoredPayload {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredPayload
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(payload: StoredPayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / private mode
  }
}

function isValidStep(n: unknown): n is JBSStep {
  return typeof n === 'number' && n >= 1 && n <= 8
}

function normalizeVoicePlayback(raw: unknown): JbsVoicePlaybackState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_VOICE_PLAYBACK }
  const o = raw as Record<string, unknown>
  return {
    storyBgDone: !!o.storyBgDone,
    storyBgCompletedTrackCount:
      typeof o.storyBgCompletedTrackCount === 'number' && o.storyBgCompletedTrackCount >= 0
        ? Math.floor(o.storyBgCompletedTrackCount)
        : 0,
    act1PublicPlotDone: !!o.act1PublicPlotDone,
    act1PublicPlotCompletedTrackCount:
      typeof o.act1PublicPlotCompletedTrackCount === 'number' &&
      o.act1PublicPlotCompletedTrackCount >= 0
        ? Math.floor(o.act1PublicPlotCompletedTrackCount)
        : 0,
  }
}

function normalizeEngine(raw: unknown): JbsEngineSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isValidStep(o.currentStep)) return null
  const rs = o.readingSession
  const readingSession =
    rs && typeof rs === 'object'
      ? {
          currentPage: typeof (rs as { currentPage?: unknown }).currentPage === 'number'
            ? (rs as { currentPage: number }).currentPage
            : 0,
          isOpen: !!(rs as { isOpen?: unknown }).isOpen,
          isMinimized: !!(rs as { isMinimized?: unknown }).isMinimized,
          hasFinishedPhase: !!(rs as { hasFinishedPhase?: unknown }).hasFinishedPhase,
          bookDelivered: !!(rs as { bookDelivered?: unknown }).bookDelivered,
        }
      : {
          currentPage: 0,
          isOpen: false,
          isMinimized: false,
          hasFinishedPhase: false,
          bookDelivered: false,
        }

  return {
    currentStep: o.currentStep,
    loopRound: typeof o.loopRound === 'number' ? o.loopRound : 0,
    messages: Array.isArray(o.messages) ? (o.messages as JBSChatMessage[]) : [],
    collectedClueIds: Array.isArray(o.collectedClueIds)
      ? (o.collectedClueIds as string[]).filter((id) => typeof id === 'string')
      : [],
    dispersalTriggeredIds: Array.isArray(o.dispersalTriggeredIds)
      ? (o.dispersalTriggeredIds as string[]).filter((id) => typeof id === 'string')
      : [],
    readingSession,
    drawerOpen: !!o.drawerOpen,
    drawerTab:
      o.drawerTab === 'script' || o.drawerTab === 'manuscript' || o.drawerTab === 'clues'
        ? o.drawerTab
        : 'script',
    bgmMuted: !!o.bgmMuted,
    clueBadgeCount: typeof o.clueBadgeCount === 'number' ? o.clueBadgeCount : 0,
    voicePlayback: normalizeVoicePlayback(o.voicePlayback),
  }
}

function normalizeProgress(raw: unknown): JbsScriptProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const scriptId = typeof o.scriptId === 'string' ? o.scriptId.trim() : ''
  if (!scriptId) return null
  const gameFlow =
    o.gameFlow === 'match-select' || o.gameFlow === 'searching' || o.gameFlow === 'chat-room'
      ? o.gameFlow
      : 'match-select'
  const chatRoomPhase =
    o.chatRoomPhase === 'dm-voice' ||
    o.chatRoomPhase === 'role-select' ||
    o.chatRoomPhase === 'reading-script' ||
    o.chatRoomPhase === 'playing'
      ? o.chatRoomPhase
      : null

  return {
    version: PROGRESS_VERSION,
    scriptId,
    savedAt: typeof o.savedAt === 'number' ? o.savedAt : Date.now(),
    playerDisplayName: typeof o.playerDisplayName === 'string' ? o.playerDisplayName : '',
    gameFlow,
    dmVoiceCompleted: !!o.dmVoiceCompleted,
    chatRoomPhase,
    activeCardId: typeof o.activeCardId === 'string' ? o.activeCardId : null,
    lockedCardId: typeof o.lockedCardId === 'string' ? o.lockedCardId : null,
    lockedRoleName: typeof o.lockedRoleName === 'string' ? o.lockedRoleName : null,
    dmIntroCompletedTrackCount:
      typeof o.dmIntroCompletedTrackCount === 'number' && o.dmIntroCompletedTrackCount >= 0
        ? Math.floor(o.dmIntroCompletedTrackCount)
        : 0,
    engine: normalizeEngine(o.engine),
  }
}

export function loadJbsProgress(scriptId: string): JbsScriptProgress | null {
  const id = scriptId.trim()
  if (!id) return null
  const all = readAll()
  return normalizeProgress(all.byScript?.[id]) ?? null
}

export function saveJbsProgress(progress: JbsScriptProgress): void {
  const id = progress.scriptId.trim()
  if (!id) return
  const all = readAll()
  const byScript = { ...(all.byScript ?? {}) }
  byScript[id] = { ...progress, scriptId: id, savedAt: Date.now(), version: PROGRESS_VERSION }
  writeAll({ ...all, byScript })
}

export function clearJbsProgress(scriptId: string): void {
  const id = scriptId.trim()
  if (!id) return
  const all = readAll()
  if (!all.byScript?.[id]) return
  const byScript = { ...all.byScript }
  delete byScript[id]
  writeAll({ ...all, byScript })
}

export function hasJbsProgress(scriptId: string): boolean {
  const p = loadJbsProgress(scriptId)
  if (!p) return false
  // 仅匹配选角阶段、尚未锁定角色时不提示续玩
  if (p.gameFlow === 'chat-room' && p.chatRoomPhase === 'role-select' && !p.lockedCardId && !p.engine) {
    return false
  }
  if (p.gameFlow === 'match-select' && !p.engine) return false
  return true
}

export type JbsProgressSummary = {
  roleName: string
  stepLabel: string
  phaseLabel: string
  savedAtLabel: string
}

export function summarizeJbsProgress(progress: JbsScriptProgress): JbsProgressSummary {
  const roleName = progress.lockedRoleName?.trim() || '尚未择定角色'
  let stepLabel = '入局匹配'
  if (progress.engine) {
    const { currentStep, loopRound } = progress.engine
    if (currentStep === 7) {
      stepLabel = `第 7 阶段 · 循环 ${loopRound}/3`
    } else {
      stepLabel = `第 ${currentStep} 阶段 · ${JBS_STEP_LABELS[currentStep]}`
    }
  } else if (progress.chatRoomPhase) {
    stepLabel = CHAT_ROOM_PHASE_LABELS[progress.chatRoomPhase]
  } else if (progress.gameFlow === 'searching') {
    stepLabel = '正在匹配入局者'
  }

  const phaseLabel =
    progress.gameFlow === 'chat-room'
      ? progress.chatRoomPhase
        ? CHAT_ROOM_PHASE_LABELS[progress.chatRoomPhase]
        : '演绎暗室'
      : progress.gameFlow === 'searching'
        ? '命运盲抽'
        : '择路入局'

  const d = new Date(progress.savedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const savedAtLabel = `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`

  return { roleName, stepLabel, phaseLabel, savedAtLabel }
}
