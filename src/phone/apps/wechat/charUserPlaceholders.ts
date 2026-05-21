/** SillyTavern 风格占位符：注入提示词或世界书正文后展开为当前会话的约会对象名 / 用户身份名 */

import { personaDb } from './newFriendsPersona/idb'
import type { Character, PlayerIdentity } from './newFriendsPersona/types'
import {
  formatPlayerIdentityDisplayName,
  getCharacterBoundPlayerIdentityId,
  getCharacterLinkedPlayerIdentityIds,
  isWechatAccountSessionSlotIdentityId,
} from './wechatCharacterPlayerIdentity'
import { loadAccountsBundle } from './wechatAccountPersistence'
import { resolvePlayerIdentityWechatAccountId } from './wechatContactIdentityPrompt'
import {
  formatPlayerLineScopeLabel,
  type MemoryPromptLineScope,
} from './wechatMemoryLineScope'

/** 档案室条目、人设世界书正文推荐写法：`{{char}}`=该人设角色本人，`{{user}}`=玩家绑定身份本人 */
export const WORLD_BOOK_CHAR_PLACEHOLDER = '{{char}}'
/** 正文只写此占位符；账号/身份绑定存在条目 `userPlaceholderBindings` 元数据。 */
export const WORLD_BOOK_USER_PLACEHOLDER = '{{user}}'

/** 旧式正文内嵌绑定 `{{user:账号:身份}}`（仍可读库展开）；新插入请用裸 `{{user}}` + 元数据。 */
export const SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE = /\{\{user:([^:}]+):([^}]+)\}\}/g

export type WorldBookUserInsertContext = {
  wechatAccountId: string
  playerIdentityId: string
  lineLabel: string
  displayName: string
}

export function buildScopedWorldBookUserPlaceholder(
  wechatAccountId: string,
  playerIdentityId: string,
): string {
  const acc = wechatAccountId.trim()
  const pid = playerIdentityId.trim()
  if (!acc || !pid || pid === '__none__') return WORLD_BOOK_USER_PLACEHOLDER
  return `{{user:${acc}:${pid}}}`
}

export function contentHasScopedWorldBookUserPlaceholder(content: string): boolean {
  SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE.lastIndex = 0
  return SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE.test(String(content ?? ''))
}

/** 将正文里已绑定的 `{{user:账号:身份}}` 展开为对应显示名（顺序在 {{char}}/裸 {{user}} 之前）。 */
export async function expandScopedWorldBookUserPlaceholdersInText(text: string): Promise<string> {
  let s = String(text ?? '')
  const tokens = new Set<string>()
  SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = SCOPED_WORLD_BOOK_USER_PLACEHOLDER_RE.exec(s)) !== null) {
    tokens.add(m[0])
  }
  if (!tokens.size) return s

  const nameByToken = new Map<string, string>()
  for (const token of tokens) {
    const parts = token.match(/^\{\{user:([^:}]+):([^}]+)\}\}$/)
    if (!parts) continue
    const pid = parts[2].trim()
    let row: PlayerIdentity | null = null
    try {
      row = await personaDb.getPlayerIdentity(pid)
    } catch {
      row = null
    }
    nameByToken.set(token, formatPlayerIdentityDisplayName(row, pid))
  }
  for (const [token, name] of nameByToken) {
    s = s.split(token).join(name)
  }
  return s
}

/** 世界书编辑页插入 {{user}} 时：取当前微信账号 + 当前选用的扮演身份。 */
export async function resolveWorldBookUserInsertContext(params: {
  wechatAccountId: string | null | undefined
  playerIdentityId?: string | null | undefined
  /** 玩家身份专属世界书：直接用该身份 */
  playerIdentityRow?: PlayerIdentity | null
}): Promise<WorldBookUserInsertContext | null> {
  if (params.playerIdentityRow) {
    const row = params.playerIdentityRow
    const pid = row.id?.trim()
    const acc = row.wechatAccountId?.trim()
    if (!pid || !acc) return null
    const scope = { wechatAccountId: acc, sessionPlayerIdentityId: pid }
    const bundle = await loadAccountsBundle()
    return {
      wechatAccountId: acc,
      playerIdentityId: pid,
      lineLabel: await formatPlayerLineScopeLabel(scope, bundle),
      displayName: formatPlayerIdentityDisplayName(row, pid),
    }
  }

  let acc = params.wechatAccountId?.trim() || ''
  let pid = params.playerIdentityId?.trim() || ''
  if (!pid || pid === '__none__') {
    try {
      pid = (await personaDb.getCurrentIdentityId()).trim()
    } catch {
      pid = ''
    }
  }
  if (!pid || pid === '__none__') return null

  const row = await personaDb.getPlayerIdentity(pid)
  if (!acc) acc = row?.wechatAccountId?.trim() || ''
  if (!acc) return null

  const scope = { wechatAccountId: acc, sessionPlayerIdentityId: pid }
  const bundle = await loadAccountsBundle()
  return {
    wechatAccountId: acc,
    playerIdentityId: pid,
    lineLabel: await formatPlayerLineScopeLabel(scope, bundle),
    displayName: formatPlayerIdentityDisplayName(row, pid),
  }
}

/** 发给模型前：先展开 scoped user，再展开 {{char}} / 裸 {{user}} / {{id}}。 */
export async function expandSystemPromptPlaceholders(
  raw: string,
  params: {
    character: Character | null
    /** 裸 `{{user}}`（未写账号:身份）时的回落，一般用世界书锚点身份 */
    worldBookPlayerIdentity: PlayerIdentity | null
    playerDisplayName: string
    idToDisplayName?: Readonly<Record<string, string>>
  },
): Promise<string> {
  let s = await expandScopedWorldBookUserPlaceholdersInText(raw)
  const expandNames = resolveCharUserNamesForPrompt({
    character: params.character,
    playerIdentity: params.worldBookPlayerIdentity,
    playerDisplayName: params.playerDisplayName,
  })
  return expandLinkedMemoryPlaceholders(s, {
    charName: expandNames.charName,
    userName: expandNames.userName,
    idToDisplayName: params.idToDisplayName ?? {},
  })
}

/** 同一条人脉档案下的其他人设（档案主角或其它 NPC）：`{{id:<人设 id>}}`，注入前替换为显示名 */
export function linkedCharacterPlaceholder(characterId: string): string {
  const id = String(characterId ?? '').trim()
  return id ? `{{id:${id}}}` : ''
}

export type CharUserNames = {
  /** 当前人设（约会对象）展示名，一般用 realName */
  charName: string
  /** 该人设绑定会话绑定的玩家身份姓名 */
  userName: string
}

/** 世界书 `{{user}}` 锚点：固定到主微信账号 + 扮演身份，不随当前聊天窗口马甲切换。 */
export type WorldBookUserBinding = {
  playerIdentityId: string
  wechatAccountId: string
  lineLabel: string
  displayName: string
  row: PlayerIdentity | null
  scope: MemoryPromptLineScope
}

async function identityWechatAccountId(
  character: Character,
  playerIdentityId: string,
  row: PlayerIdentity | null | undefined,
): Promise<string> {
  const fromMeta = character.playerIdentityLinkMeta?.find(
    (m) => m.playerIdentityId === playerIdentityId,
  )?.wechatAccountId?.trim()
  if (fromMeta) return fromMeta
  return resolvePlayerIdentityWechatAccountId(character, playerIdentityId, row)
}

/**
 * 解析世界书 `{{user}}` 锚点：优先 **bundle 第一个微信账号** 上绑定的扮演身份，
 * 避免小号加好友后 `playerIdentityId` 被改写导致世界书串到当前发言人。
 */
export async function resolveWorldBookUserBinding(
  character: Character | null | undefined,
): Promise<WorldBookUserBinding | null> {
  if (!character) return null
  const bundle = await loadAccountsBundle()
  const mainAccId = bundle?.accounts[0]?.accountId?.trim() || ''
  const linkedIds = getCharacterLinkedPlayerIdentityIds(character)

  const build = async (pid: string, preferAcc?: string): Promise<WorldBookUserBinding | null> => {
    if (!pid || pid === '__none__' || isWechatAccountSessionSlotIdentityId(pid)) return null
    const row = await personaDb.getPlayerIdentity(pid)
    const acc = (preferAcc || (await identityWechatAccountId(character, pid, row))).trim()
    if (!acc) return null
    const scope: MemoryPromptLineScope = { wechatAccountId: acc, sessionPlayerIdentityId: pid }
    const lineLabel = await formatPlayerLineScopeLabel(scope, bundle)
    const displayName = formatPlayerIdentityDisplayName(row, pid)
    return {
      playerIdentityId: pid,
      wechatAccountId: acc,
      lineLabel,
      displayName,
      row,
      scope,
    }
  }

  if (mainAccId) {
    for (const pid of linkedIds) {
      const row = await personaDb.getPlayerIdentity(pid)
      const acc = await identityWechatAccountId(character, pid, row)
      if (acc === mainAccId) {
        const hit = await build(pid, mainAccId)
        if (hit) return hit
      }
    }
  }

  const primaryId = getCharacterBoundPlayerIdentityId(character)
  if (primaryId) {
    const hit = await build(primaryId)
    if (hit) return hit
  }

  for (const pid of linkedIds) {
    const hit = await build(pid)
    if (hit) return hit
  }
  return null
}

/** @deprecated 请用 {@link resolveWorldBookUserBinding} */
export async function resolveBoundPlayerIdentityForCharacterWorldBook(
  character: Character | null | undefined,
): Promise<PlayerIdentity | null> {
  const b = await resolveWorldBookUserBinding(character)
  return b?.row ?? null
}

/**
 * 分线私聊：世界书 `{{user}}` 已展开为主绑定名；当前窗口发言人可能是另一马甲。
 */
export function buildWechatWorldBookUserPlaceholderDirective(params: {
  charName: string
  /** 世界书 {{user}} 锚点（主微信账号 · 扮演身份） */
  worldBookUserLineLabel: string
  primaryUserName: string
  /** 当前窗口发言人展示名（微信昵称或当前扮演档名） */
  currentWindowSpeakerLabel: string
}): string {
  const c = String(params.charName || '').trim() || '对方'
  const anchor = String(params.worldBookUserLineLabel || '').trim() || params.primaryUserName
  const u = String(params.primaryUserName || '').trim() || '用户'
  const cur = String(params.currentWindowSpeakerLabel || '').trim() || '当前联系人'
  return (
    `【世界书 · {{user}} 指称铁则（最高优先级）】\n` +
    `- 人设世界书、尾声延展中带 **{{user:微信号:身份}}** 的条目：该式子已锁定为 **${anchor}**（姓名「${u}」），勿随当前窗口改写。\n` +
    `- 裸 **{{user}}**（无账号:身份后缀）按档案主绑定回落；新条目请用编辑器「快捷插入」生成带绑定的式子。\n` +
    `- **{{user}} ≠ 本窗口发言人**：当前跟你聊天的是 **${cur}**（另一微信账号/另一扮演身份），不要把 {{user}} 理解成 TA。\n` +
    `- 条目中写明的对 {{user}} 的暗恋、好感、纠结、职务关系等，对象始终是 **「${u}」/ ${anchor}**，禁止改写成「其实喜欢 ${cur}」。\n` +
    `- 对方问「你对社长/老顾/${u} 有没有想法」且语境指主绑定那位：内心须与世界书一致（可对外嘴硬否认给 ${cur} 听），**禁止** OOC 全盘否认「绝对不喜欢他」，**禁止**在内心独白里把一年暗恋对象换成 ${cur}。\n` +
    `- 对**本窗口发言人「${cur}」**：不知真名时叫「你」；**禁止**用「社长大人」等 ${u} 的专属称呼叫 TA。\n`
  )
}

/** 聊天记录 user 侧「我」= 本窗口发言人，与世界书 {{user}} 分离。 */
export function buildWechatTranscriptSpeakerAttributionLine(params: {
  sessionSpeakerLabel: string
  worldBookUserLineLabel: string
  primaryUserName: string
}): string {
  const cur = params.sessionSpeakerLabel.trim() || '当前联系人'
  const anchor = params.worldBookUserLineLabel.trim() || params.primaryUserName
  const u = params.primaryUserName.trim() || '用户'
  return (
    `对方（本窗口发言人 **${cur}**）发来的「我」「我的」= **该发言人本人**在自述，**不是**世界书 {{user}} 所指的 **${anchor}**（${u}）。\n` +
    `不要把聊天记录里的 user 当成 ${u}；世界书暗恋/好感对象仍是 ${u}，不是 ${cur}。\n`
  )
}

export function buildWechatHeartWhisperSpeakerSplitDirective(params: {
  charName: string
  worldBookUserLineLabel: string
  primaryUserName: string
  sessionSpeakerLabel: string
}): string {
  const c = params.charName.trim() || '角色'
  const anchor = params.worldBookUserLineLabel.trim() || params.primaryUserName
  const u = params.primaryUserName.trim() || '用户'
  const cur = params.sessionSpeakerLabel.trim() || '当前联系人'
  return (
    `【心语 · 双人分线（必守）】\n` +
    `- 刚对话里 user 消息的「我」= 本窗口发言人 **${cur}**，**不是** ${anchor}（${u}）。\n` +
    `- 人设世界书 {{user}} / 暗恋 / 好感对象 = **${u}**（${anchor}），**禁止**在 inner_thoughts 里写成「其实喜欢 ${cur}」「喜欢的就是她本人」等，除非世界书明确三角设定。\n` +
    `- 「${c}」若对世界书设定暗恋 ${u}，内心独白须与此一致；view_on_user 描述的是 **${cur}** 这位发言人，不是 ${u}。\n`
  )
}

export function resolveCharUserNamesForPrompt(params: {
  character: Character | null
  playerIdentity: PlayerIdentity | null
  playerDisplayName: string
  /** 身份昵称、姓名、备注及 playerDisplayName 皆空时的兜底；默认「用户」 */
  userNameIfAnonymous?: string
}): CharUserNames {
  const charName =
    String(params.character?.name ?? '').trim() ||
    String(params.character?.wechatNickname ?? '').trim() ||
    '对方'
  const iden = params.playerIdentity
  const userName =
    String(iden?.wechatNickname ?? '').trim() ||
    String(iden?.name ?? '').trim() ||
    String(iden?.remark ?? '').trim() ||
    String(params.playerDisplayName ?? '').trim() ||
    (params.userNameIfAnonymous ?? '用户')
  return { charName, userName }
}

export function expandCharUserPlaceholders(text: string, names: CharUserNames): string {
  const charName = String(names.charName ?? '').trim() || '对方'
  const userName = String(names.userName ?? '').trim() || '用户'
  return String(text ?? '')
    .replace(/\{\{char\}\}/g, charName)
    .replace(/\{\{user\}\}/g, userName)
}

/** 关联长期记忆等：`{{archive_char}}` = 线下存档主角；`{{id:xxx}}` = 指定人设 id 的显示名（须与档案 id 完全一致） */
export const LINKED_MEMORY_ARCHIVE_CHAR_PLACEHOLDER = '{{archive_char}}'

export type LinkedMemoryPlaceholderExpandInput = {
  /** 当前档案所属人设（私聊对方 / 本条记忆的 characterId） */
  charName: string
  userName: string
  /** 关联记忆 `linkedFromCharacterId` 对应主角的显示名 */
  archiveCharName?: string
  /** `{{id:<characterId>}}` → 显示名（含存档主角与 listNpcsFor 人脉） */
  idToDisplayName?: Readonly<Record<string, string>>
}

/**
 * 在 `expandCharUserPlaceholders` 基础上扩展关联记忆占位符。
 * 顺序：`{{id:…}}` → `{{archive_char}}` → `{{char}}` / `{{user}}`
 */
export function expandLinkedMemoryPlaceholders(text: string, input: LinkedMemoryPlaceholderExpandInput): string {
  const idMap = input.idToDisplayName ?? {}
  let s = String(text ?? '')
  s = s.replace(/\{\{id:([^}]+)\}\}/g, (_m, rawId: string) => {
    const id = String(rawId ?? '').trim()
    if (!id) return ''
    const nm = idMap[id]
    return nm != null && String(nm).trim() ? String(nm).trim() : `{{id:${id}}}`
  })
  const arch = String(input.archiveCharName ?? '').trim()
  s = s.replace(/\{\{archive_char\}\}/g, arch || '主角')
  return expandCharUserPlaceholders(s, {
    charName: input.charName,
    userName: input.userName,
  })
}

/**
 * 约会专用：澄清「我＝用户」类世界书与约会对象人称，须在展开占位符之前附加到 system（本身不含未展开花括号）。
 */
export function buildDatingCharUserPerspectiveDirective(charName: string, userName: string): string {
  const c = String(charName || '').trim() || '对方'
  const u = String(userName || '').trim() || '用户'
  return (
    `【指称约定（最高优先级）】\n` +
    `- 「约会对象 / 当前人设」=「${c}」；「玩家」= 该人设绑定的玩家身份「${u}」。\n` +
    `- 人设侧世界书、档案室条目中出现的「{{char}}」「{{user}}」已替换为「${c}」「${u}」；其中**写在与「${u}」绑定的一侧**的校内职务、社团职级、远近关系等，**一律视为对玩家的有效设定**，与「用户身份卡」摘要**互补**——身份卡未逐字写的条目项**不得**当成「不存在」，也**禁止**因叙事常以「${c}」为描写重心，就把条目中赋予「${u}」的职务或上级身份改写到「${c}」头上。\n` +
    `- 「用户身份卡」及**玩家身份专属**世界书：专述玩家本体档案；勿把其中条目与「${c}」的人设条目混写、对调。\n` +
    `- 正文输出请直接写真实姓名或语境下合理称呼。\n\n`
  )
}
