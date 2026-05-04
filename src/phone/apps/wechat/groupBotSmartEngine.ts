import type { ApiConfig } from '../api/types'
import type { GroupChatRow, GroupMember, WeChatChatMessage } from './newFriendsPersona/types'
import { openAiCompatibleChat, type OpenAiCompatibleMessage } from './newFriendsPersona/ai'
import { WECHAT_GROUP_BOT_CHARACTER_ID } from './wechatConversationKey'

/** 群助手 / 群管家在设置页等处用的极简线框图标（B&W） */
export const GROUP_SMART_BOT_LINE_ICON_DATA_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="6" width="28" height="28" rx="6" stroke="#0a0a0a" stroke-width="1.5"/>
      <path d="M14 18h12M14 24h8" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  )

export const GROUP_SMART_BOT_AT_SYSTEM_PROMPT = `你是微信群里的「群管家」智能助手，人设接近**热心肠的群里阿姨/大姐 + 称职管家**：会来事、好商量、把群当家一样照应。
- **安慰与接情绪**：有人低落、委屈、吵架后冷场时，先接住情绪（一句「在呢」「先缓缓」也好），再轻轻带一带；避免空洞大道理和说教腔。
- **理性与分寸**：涉及规则、事实、怎么办时，条理清楚、建议具体，语气平易近人，不摆官僚架子，也不和稀泥到回避问题。
- **幽默与热场**：适当接梗、抖个小机灵、自嘲或打趣一句，帮群聊松一松、活一活；**禁止**刻薄羞辱、拿别人的难堪当笑料；**禁止**对真人用户居高临下嘲讽。
- **互动范围**：只回应本条里 **@ 到你**（或明显在点名问你）的内容；不要对群里其他人的无关闲聊逐条抢话。
- **与违禁系统提示区分**：用户 @ 你提问、吐槽、追问时，你是**会接话的群管家角色**，须针对上下文**自然接话**（解释为何拦截、安慰、打岔、自嘲都行）；**禁止**只用一句「请注意您的发言」式复读敷衍过去，除非用户明确只要这句提醒。
输出：纯中文气泡口吻，像真在群里打字；建议 **80 字以内**；不要 Markdown、不要扮演其他群成员、不要编造本群未给出的数据。`

export function defaultGroupMemberBotViolation(): NonNullable<GroupMember['botViolation']> {
  return { violationCount: 0, lastViolationTurn: -1, muteExpiresAt: null }
}

/** 群助手在消息里可被 @ 的昵称集合（与 {@link textMentionsGroupSmartBot} 一致，供输入框艾特列表过滤用） */
export function getGroupSmartBotMentionLabels(group: GroupChatRow | null | undefined): string[] {
  const extras = (group?.robotMentionAliases ?? [])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
  return Array.from(new Set(['群管家', '群助手', '群机器人', ...extras]))
}

/** 文本是否 @ 到群助手（含全角＠、自定义别名） */
export function textMentionsGroupSmartBot(text: string, group: GroupChatRow | null | undefined): boolean {
  const raw = String(text ?? '').replace(/\uFF20/g, '@')
  const needles = getGroupSmartBotMentionLabels(group)
  for (const n of needles) {
    if (!n) continue
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 允许「@ 群管家」等 @ 与昵称之间有空格（输入法/习惯常见）
    if (new RegExp(`@\\s*${esc}`, 'u').test(raw)) return true
  }
  return false
}

/**
 * 去掉群管家/群助手气泡正文里误加的「@群助手」等自称前缀（玩家侧已有头像与昵称，勿重复 @）。
 * 仅处理串首；可多次剥离。
 */
export function stripGroupSmartBotSelfMentionPrefixes(text: string, group: GroupChatRow | null | undefined): string {
  let s = String(text ?? '')
  const labels = getGroupSmartBotMentionLabels(group)
  for (let guard = 0; guard < 8; guard += 1) {
    const t = s.trimStart()
    let changed = false
    for (const label of labels) {
      if (!label) continue
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`^@\\s*${esc}(?:\\s*[：:，,。.!！?？])?\\s*`, 'u')
      if (re.test(t)) {
        s = t.replace(re, '')
        changed = true
        break
      }
    }
    if (!changed) break
  }
  return s.trimStart()
}

/**
 * 去掉模型误写的「群管家：」「群助手：」等**角色名+冒号**行首前缀（与头像/昵称条重复）。
 */
export function stripGroupSmartBotRoleColonLead(text: string, group: GroupChatRow | null | undefined): string {
  let s = String(text ?? '')
  const labels = getGroupSmartBotMentionLabels(group)
  for (let guard = 0; guard < 8; guard += 1) {
    const t = s.trimStart()
    let changed = false
    for (const label of labels) {
      if (!label) continue
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`^${esc}\\s*[：:]\\s*`, 'u')
      if (re.test(t)) {
        s = t.replace(re, '').trimStart()
        changed = true
        break
      }
    }
    if (!changed) break
  }
  return s.trimStart()
}

/** 群管家气泡落库/展示前统一清洗（@ 自称 + 昵称冒号） */
export function normalizeGroupSmartBotBubblePlaintext(text: string, group: GroupChatRow | null | undefined): string {
  return stripGroupSmartBotRoleColonLead(stripGroupSmartBotSelfMentionPrefixes(text, group), group)
}

/**
 * 违禁命中后的落库与群状态更新：屏蔽条 + 群助手黑底气泡；两轮内连犯 → 5 分钟禁言戳。
 * 调用方需保证已 match 到规则；本函数不负责正则判定。
 */
export function applyGroupSmartBotViolationPipeline(params: {
  group: GroupChatRow
  offenderCharId: string
  offenderNickname: string
  conversationKey: string
  playerIdentityId: string
  nowMs: number
  /** 被拦截的原文（存入系统条 ext，供会话内点击查看） */
  shieldedPlainText: string
}): { nextGroup: GroupChatRow; messages: WeChatChatMessage[] } {
  const { group, offenderCharId, offenderNickname, conversationKey, playerIdentityId, nowMs, shieldedPlainText } =
    params
  const shieldArchived = String(shieldedPlainText ?? '').trim().slice(0, 8000)
  const prevChatSeq = Math.max(0, Math.floor(group.chatTurnSequence ?? 0))
  const currentChatTurn = prevChatSeq + 1
  /** 仅违禁事件递增，与群内普通气泡轮次脱钩，避免「两轮内连犯」被中间插话撑大 gap 而永远不触发禁言 */
  const violationEventSeq = Math.max(0, Math.floor(group.smartBotViolationSeq ?? 0)) + 1
  const nick = offenderNickname.trim() || '成员'

  const members = group.members.map((m) => ({ ...m }))
  const ix = members.findIndex((m) => m.charId.trim() === offenderCharId.trim())
  const mm = ix >= 0 ? members[ix]! : null
  const bv = mm?.botViolation ?? defaultGroupMemberBotViolation()
  const lastEv = bv.lastViolationEventSeq
  let gap: number
  if (typeof lastEv === 'number' && Number.isFinite(lastEv) && lastEv >= 0) {
    gap = violationEventSeq - lastEv
  } else {
    const legacyLast = bv.lastViolationTurn
    gap = legacyLast < 0 ? 999 : currentChatTurn - legacyLast
  }
  const caseA = bv.violationCount === 0 || gap > 1

  const nextBv: NonNullable<GroupMember['botViolation']> = caseA
    ? {
        violationCount: 1,
        lastViolationTurn: currentChatTurn,
        lastViolationEventSeq: violationEventSeq,
        muteExpiresAt: null,
      }
    : {
        violationCount: Math.min(99, bv.violationCount + 1),
        lastViolationTurn: currentChatTurn,
        lastViolationEventSeq: violationEventSeq,
        muteExpiresAt: nowMs + 5 * 60 * 1000,
      }

  if (mm && ix >= 0) {
    members[ix] = { ...mm, botViolation: nextBv }
  }

  const t0 = nowMs
  const idShield = `wxm-${t0}-gshield-${Math.random().toString(36).slice(2, 8)}`
  const idBot = `wxm-${t0 + 1}-gbot-${Math.random().toString(36).slice(2, 8)}`
  const shieldContent = `【系统】「${nick}」的消息被自动屏蔽`
  const botLine = caseA ? `${nick}，请注意您的发言。` : `${nick}，您已被禁言5分钟，请规范您的发言。`

  const messages: WeChatChatMessage[] = [
    {
      id: idShield,
      characterId: WECHAT_GROUP_BOT_CHARACTER_ID,
      playerIdentityId,
      type: 'character',
      content: shieldContent,
      ext: {
        centerSystemStrip: true,
        ...(shieldArchived ? { shieldedMessageContent: shieldArchived } : {}),
      },
      timestamp: t0,
      isRead: true,
      conversationKey,
    },
    {
      id: idBot,
      characterId: WECHAT_GROUP_BOT_CHARACTER_ID,
      playerIdentityId,
      type: 'character',
      content: botLine,
      timestamp: t0 + 1,
      isRead: true,
      conversationKey,
    },
  ]

  const nextGroup: GroupChatRow = {
    ...group,
    members,
    chatTurnSequence: currentChatTurn,
    smartBotViolationSeq: violationEventSeq,
    updatedAt: nowMs,
  }
  return { nextGroup, messages }
}

/** 群成员是否因管理员禁言或群助手定时禁言而不可发言 */
export function groupMemberSpeechBlockedInGroup(m: GroupMember, nowMs: number): boolean {
  if (m.isMuted) return true
  const exp = m.botViolation?.muteExpiresAt
  return typeof exp === 'number' && Number.isFinite(exp) && exp > nowMs
}

/** 清理已过期的群助手禁言戳（不写 isMuted） */
export function pruneExpiredBotMutesOnGroup(group: GroupChatRow, nowMs: number): GroupChatRow {
  let changed = false
  const members = group.members.map((m) => {
    const exp = m.botViolation?.muteExpiresAt
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp > nowMs) return m
    const bv = m.botViolation ?? defaultGroupMemberBotViolation()
    if (bv.muteExpiresAt == null) return m
    changed = true
    return { ...m, botViolation: { ...bv, muteExpiresAt: null } }
  })
  return changed ? { ...group, members, updatedAt: nowMs } : group
}

export async function requestGroupSmartBotAtReply(params: {
  apiConfig: ApiConfig | null
  userQuestion: string
  memberNicknamesLine: string
}): Promise<string> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    return '（未配置 API，无法应答。）'
  }
  const q = params.userQuestion.trim().slice(0, 1200)
  const sys = `${GROUP_SMART_BOT_AT_SYSTEM_PROMPT}\n\n【当前群成员称呼参考】\n${params.memberNicknamesLine.trim().slice(0, 2000)}`
  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: sys },
    { role: 'user', content: q || '（空消息）' },
  ]
  try {
    const text = await openAiCompatibleChat(cfg, messages, { temperature: 0.55, max_tokens: 400 })
    const cleaned = normalizeGroupSmartBotBubblePlaintext(String(text ?? '').trim(), null)
    return cleaned.slice(0, 600) || '……'
  } catch {
    return '（请求失败，稍后再试。）'
  }
}
