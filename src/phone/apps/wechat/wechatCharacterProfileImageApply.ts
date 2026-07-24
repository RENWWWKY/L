import type { WeChatImageMime } from './newFriendsPersona/types'
import { emitWeChatStorageChanged, personaDb } from './newFriendsPersona/idb'
import type { Character } from './newFriendsPersona/types'

import {
  applyProfileImageUrlChange,
  resolveProfileImageRestoreUrl,
} from './wechatCharacterProfileImageHistory'

export type CharacterProfileImageApplyTarget = 'avatar' | 'momentsCover'

export type CharacterProfileImageAction =
  | { kind: 'userImage'; target: CharacterProfileImageApplyTarget }
  | { kind: 'restore'; target: CharacterProfileImageApplyTarget; restoreKey: string }

const AVATAR_DIRECTIVE_RE = /^\[(?:换头像|SET_AVATAR|SETAVATAR)\]\s*$/i
const MOMENTS_COVER_DIRECTIVE_RE =
  /^\[(?:换朋友圈背景|换朋友圈封面|SET_MOMENTS_COVER|SETMOMENTSCOVER)\]\s*$/i
const RESTORE_AVATAR_DIRECTIVE_RE =
  /^\[(?:恢复头像|RESTORE_AVATAR)\|([^\]]+)\]\s*$/i
const RESTORE_COVER_DIRECTIVE_RE =
  /^\[(?:恢复朋友圈背景|恢复朋友圈封面|RESTORE_MOMENTS_COVER)\|([^\]]+)\]\s*$/i

export {
  buildCharacterProfileImageCatalogBlock,
  buildCharacterSelfProfileVisionParts,
} from './wechatCharacterProfileImageHistory'

export function parseCharacterProfileImageApplyDirective(
  line: string,
): CharacterProfileImageApplyTarget | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  if (AVATAR_DIRECTIVE_RE.test(t)) return 'avatar'
  if (MOMENTS_COVER_DIRECTIVE_RE.test(t)) return 'momentsCover'
  return null
}

function parseCharacterProfileImageAction(line: string): CharacterProfileImageAction | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  const userAvatar = parseCharacterProfileImageApplyDirective(t)
  if (userAvatar) return { kind: 'userImage', target: userAvatar }
  const restoreAvatar = RESTORE_AVATAR_DIRECTIVE_RE.exec(t)
  if (restoreAvatar?.[1]?.trim()) {
    return { kind: 'restore', target: 'avatar', restoreKey: restoreAvatar[1].trim() }
  }
  const restoreCover = RESTORE_COVER_DIRECTIVE_RE.exec(t)
  if (restoreCover?.[1]?.trim()) {
    return { kind: 'restore', target: 'momentsCover', restoreKey: restoreCover[1].trim() }
  }
  return null
}

export function filterCharacterProfileImageApplyDirectives(bubbles: string[]): {
  bubbles: string[]
  targets: CharacterProfileImageApplyTarget[]
} {
  const filtered = filterCharacterProfileImageActions(bubbles)
  return {
    bubbles: filtered.bubbles,
    targets: filtered.actions
      .filter((a): a is Extract<CharacterProfileImageAction, { kind: 'userImage' }> => a.kind === 'userImage')
      .map((a) => a.target),
  }
}

export function filterCharacterProfileImageActions(bubbles: string[]): {
  bubbles: string[]
  actions: CharacterProfileImageAction[]
} {
  const actions: CharacterProfileImageAction[] = []
  const next = bubbles.filter((line) => {
    const action = parseCharacterProfileImageAction(line)
    if (!action) return true
    actions.push(action)
    return false
  })
  return { bubbles: next, actions }
}

export function buildUserImageDataUrl(base64: string, mime: WeChatImageMime = 'image/jpeg'): string {
  const b64 = String(base64 ?? '')
    .trim()
    .replace(/^data:image\/(?:jpeg|png|gif|webp);base64,/i, '')
  if (!b64) return ''
  const safeMime = mime || 'image/jpeg'
  return `data:${safeMime};base64,${b64}`
}

export const WECHAT_CHARACTER_PROFILE_IMAGE_APPLY_APPENDIX = `
---------------------
【你的微信头像 / 朋友圈背景 · 可见与更换】
---------------------
客户端会在对话前注入你**当前**的微信头像与朋友圈主页背景图（若模型支持识图，请据此了解自己的线上形象；看不清勿编造）。
【你的微信头像 / 朋友圈背景 · 当前与历史】块列出可恢复的 original 与序号；换图后旧图会自动存档。

意图由你根据对话**自行判断**，客户端不会用关键词替你分类。请严格区分三类能力：
- **换头像 / 换朋友圈背景**：改主页资料图（封面），**不是**发一条朋友圈动态。
- **发朋友圈**：发一条动态（另见【发朋友圈】协议），**不要**用发动态来「假装」已换背景或头像。
- **恢复历史图**：换回 original 或历史序号中的旧图。

■ 易混点（必读）
- 「把朋友圈背景换成我 / 换成这张 / 背景图用这张 / 封面改成…」→ **只**输出 \`[换朋友圈背景]\`，**禁止**输出 \`[发朋友圈]\`。
- 「发条朋友圈 / 晒一下 / 官宣发圈」→ 才用 \`[发朋友圈]\`；配图由客户端生成，**不要**把「换背景的那张用户图」当成发圈配图借口。
- 口头说「背景换好了」却输出 \`[发朋友圈]\` 是错误；口头已承认换背景时，指令行必须是 \`[换朋友圈背景]\`。

■ 用户发图更换（须你愿意）
当用户把图片发给你，且你判断对方是要你把「刚收到的那张图」设为微信头像或朋友圈背景时：
- 先像真人一样用 **1～2 句**口语回应。
- 若你**同意**更换：在可见回复中**另起一行**，整行**只**输出：
  - 换头像：\`[换头像]\`
  - 换朋友圈背景/封面：\`[换朋友圈背景]\`
- 客户端会用**用户刚发来的那张图**写入你的资料；**不要**编造 URL，**不要**用 \`[图片]\` 假装已换。
- 若本轮用户**没有**发来可用的图：只文字说明需要对方发图，或请对方发一张要用的图；**禁止**为此输出 \`[发朋友圈]\` 凑数。
- 若你不愿或图片不合适：只文字婉拒，**禁止**输出上述指令。

■ 恢复原始 / 历史图（须你愿意）
当你判断用户（或你自己）要换回**原始**或**以前用过**的头像/背景时：
- 先 1～2 句口语回应（可带一点怀旧/犹豫）。
- 同意则**另起一行**输出（整行仅此指令）：
  - \`[恢复头像|original]\` 或 \`[恢复头像|1]\`（数字见历史列表）
  - \`[恢复朋友圈背景|original]\` 或 \`[恢复朋友圈背景|1]\`
- 与当前完全相同时不要输出恢复指令。
- 没有更换/恢复意愿时，**不要**主动输出这些指令。
`.trim()

export const WECHAT_CHARACTER_PROFILE_IMAGE_APPLY_IMAGE_ROUND_HINT = `
本轮用户发来了图片。请先判断意图再选指令：
- 要你把该图设为**头像 / 朋友圈背景（主页封面）**：口语回应后**另起一行**只输出 \`[换头像]\` 或 \`[换朋友圈背景]\`；**禁止**用 \`[发朋友圈]\` 代替。
- 要你**发一条朋友圈动态**：才用 \`[发朋友圈]\`（另见发朋友圈协议）。
- 只是聊天配图：正常回复即可，不要输出资料图/发圈指令。
若上文在谈「换背景/换封面」且用户又发图说「这张也不错 / 用这张」：默认是换背景，输出 \`[换朋友圈背景]\`。
`.trim()

const MOMENTS_COVER_REQUEST_RE =
  /朋友圈.{0,10}(?:背景|封面)|(?:背景|封面).{0,10}(?:换|改|设|用|卡)|(?:换|改|设|用).{0,10}(?:背景|封面)/u
const AVATAR_REQUEST_RE =
  /(?:换|改|设|用).{0,8}(?:微信)?头像|(?:微信)?头像.{0,8}(?:换|改|设|用)/u
const EXPLICIT_MOMENT_PUBLISH_REQUEST_RE =
  /发(?:个|条|一[条个])?(?:朋友圈|动态)|(?:发到|晒到|发条|发个)朋友圈|帮我发朋友圈|你发(?:条|个)?朋友圈/u
const CLAIMS_COVER_UPDATED_RE =
  /(?:背景|封面).{0,16}(?:换好|更新|改好|设好|换成|一并)|(?:换好|更新|改好|设好).{0,16}(?:背景|封面)/u
const CLAIMS_AVATAR_UPDATED_RE =
  /头像.{0,16}(?:换好|更新|改好|设好|换成|一并)|(?:换好|更新|改好|设好).{0,16}头像/u

/** 近期用户话是否在要求换朋友圈背景/封面 */
export function userRequestedMomentsCoverUpdate(
  messages: readonly (string | null | undefined)[] | string | null | undefined,
): boolean {
  const list = Array.isArray(messages) ? messages : [messages]
  return list.some((m) => MOMENTS_COVER_REQUEST_RE.test(String(m ?? '').trim()))
}

/** 近期用户话是否在要求换头像 */
export function userRequestedAvatarUpdate(
  messages: readonly (string | null | undefined)[] | string | null | undefined,
): boolean {
  const list = Array.isArray(messages) ? messages : [messages]
  return list.some((m) => AVATAR_REQUEST_RE.test(String(m ?? '').trim()))
}

/** 近期用户话是否明确要求发朋友圈动态（不是换背景） */
export function userExplicitlyRequestedMomentPublish(
  messages: readonly (string | null | undefined)[] | string | null | undefined,
): boolean {
  const list = Array.isArray(messages) ? messages : [messages]
  return list.some((m) => EXPLICIT_MOMENT_PUBLISH_REQUEST_RE.test(String(m ?? '').trim()))
}

/** 用户提到换头像/背景时注入的意图提示 */
export function buildUserProfileImageChangeBias(
  messages: readonly (string | null | undefined)[] | string | null | undefined,
): string {
  const list = Array.isArray(messages) ? messages : [messages]
  const wantCover = userRequestedMomentsCoverUpdate(list)
  const wantAvatar = userRequestedAvatarUpdate(list)
  if (!wantCover && !wantAvatar) return ''
  const parts: string[] = []
  if (wantCover) {
    parts.push(
      '用户在请你换**朋友圈背景/封面**（主页顶部图）。同意则口语后**另起一行只**输出 `[换朋友圈背景]`；**禁止**用 `[发朋友圈]` 代替或「假装」已换背景。',
    )
  }
  if (wantAvatar) {
    parts.push(
      '用户在请你换**微信头像**。同意则口语后**另起一行只**输出 `[换头像]`；**禁止**用 `[发朋友圈]` 代替。',
    )
  }
  return `[系统提示] ${parts.join(' ')}`
}

/**
 * 纠错：模型口头/语境是换资料图，却误输出 `[发朋友圈]`。
 * 有用户图且未明确要求发圈时，去掉发圈指令并补上正确的换图指令。
 */
export function reconcileMistakenMomentPublishAsProfileImageChange(params: {
  bubbles: string[]
  hasUserImage: boolean
  recentUserTexts?: readonly string[]
}): { bubbles: string[]; rewritten: boolean; target: CharacterProfileImageApplyTarget | null } {
  const bubbles = params.bubbles.map((b) => String(b ?? ''))
  if (!params.hasUserImage) {
    return { bubbles, rewritten: false, target: null }
  }

  const hasCoverDirective = bubbles.some(
    (line) => parseCharacterProfileImageApplyDirective(line) === 'momentsCover',
  )
  const hasAvatarDirective = bubbles.some(
    (line) => parseCharacterProfileImageApplyDirective(line) === 'avatar',
  )
  const hasPublish = bubbles.some((line) => isMomentPublishDirectiveLine(line))
  if (!hasPublish) {
    return { bubbles, rewritten: false, target: null }
  }

  const spoken = bubbles.filter((line) => !isProfileOrMomentDirectiveLine(line)).join('\n')
  const recent = params.recentUserTexts ?? []
  const claimsCover = CLAIMS_COVER_UPDATED_RE.test(spoken)
  const claimsAvatar = CLAIMS_AVATAR_UPDATED_RE.test(spoken)
  const recentPublishAsk = userExplicitlyRequestedMomentPublish(recent.slice(-4))
  const recentCoverAsk = userRequestedMomentsCoverUpdate(recent)
  const recentAvatarAsk = userRequestedAvatarUpdate(recent)

  // 用户刚明确要求发圈，且模型没有谎称「背景/头像已换」→ 不干预
  if (recentPublishAsk && !claimsCover && !claimsAvatar) {
    return { bubbles, rewritten: false, target: null }
  }

  const wantCover = claimsCover || recentCoverAsk
  const wantAvatar = claimsAvatar || (!wantCover && recentAvatarAsk)
  if (!wantCover && !wantAvatar) {
    return { bubbles, rewritten: false, target: null }
  }

  const next = bubbles.filter((line) => !isMomentPublishDirectiveLine(line))
  let target: CharacterProfileImageApplyTarget | null = null
  if (wantCover) {
    target = 'momentsCover'
    if (!hasCoverDirective) next.push('[换朋友圈背景]')
  } else if (wantAvatar) {
    target = 'avatar'
    if (!hasAvatarDirective) next.push('[换头像]')
  }

  return { bubbles: next, rewritten: true, target }
}

function isMomentPublishDirectiveLine(line: string): boolean {
  return /^\[(?:发朋友圈|POST_MOMENT|MOMENT_POST)\](?:\s*(\{[\s\S]*\}))?\s*$/i.test(
    String(line ?? '').trim(),
  )
}

function isProfileOrMomentDirectiveLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return false
  if (parseCharacterProfileImageAction(t)) return true
  if (isMomentPublishDirectiveLine(t)) return true
  if (/^\[(?:改微信昵称|改个性签名|改微信资料|SET_WECHAT_)/i.test(t)) return true
  return false
}

export async function applyUserImageToCharacterProfile(params: {
  characterId: string
  target: CharacterProfileImageApplyTarget
  imageBase64: string
  imageMime?: WeChatImageMime
}): Promise<Character | null> {
  const cid = params.characterId.trim()
  if (!cid) return null
  const dataUrl = buildUserImageDataUrl(params.imageBase64, params.imageMime)
  if (!dataUrl) return null
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return null
  const next = applyProfileImageUrlChange(ch, params.target, dataUrl)
  if (next.avatarUrl === ch.avatarUrl && next.momentsCoverUrl === ch.momentsCoverUrl) return null
  await personaDb.upsertCharacter(next)
  emitWeChatStorageChanged()
  return next
}

export async function applyCharacterProfileImageRestore(params: {
  characterId: string
  target: CharacterProfileImageApplyTarget
  restoreKey: string
}): Promise<Character | null> {
  const cid = params.characterId.trim()
  if (!cid) return null
  const ch = await personaDb.getCharacter(cid)
  if (!ch) return null
  const url = resolveProfileImageRestoreUrl(ch, params.target, params.restoreKey)
  if (!url) return null
  const next = applyProfileImageUrlChange(ch, params.target, url)
  if (next.avatarUrl === ch.avatarUrl && next.momentsCoverUrl === ch.momentsCoverUrl) return null
  await personaDb.upsertCharacter(next)
  emitWeChatStorageChanged()
  return next
}

export async function stripAndApplyCharacterProfileImageActions(params: {
  characterId: string
  bubbles: string[]
  userImage?: { base64: string; mime: WeChatImageMime } | null
}): Promise<{
  bubbles: string[]
  updated: Character | null
  avatarChanged: boolean
  coverChanged: boolean
}> {
  const filtered = filterCharacterProfileImageActions(params.bubbles)
  if (!filtered.actions.length) {
    return { bubbles: filtered.bubbles, updated: null, avatarChanged: false, coverChanged: false }
  }

  let latest: Character | null = null
  let avatarChanged = false
  let coverChanged = false

  for (const action of filtered.actions) {
    if (action.kind === 'userImage') {
      if (!params.userImage?.base64?.trim()) continue
      const updated = await applyUserImageToCharacterProfile({
        characterId: params.characterId,
        target: action.target,
        imageBase64: params.userImage.base64,
        imageMime: params.userImage.mime,
      })
      if (!updated) continue
      latest = updated
      if (action.target === 'avatar') avatarChanged = true
      else coverChanged = true
      continue
    }

    const updated = await applyCharacterProfileImageRestore({
      characterId: params.characterId,
      target: action.target,
      restoreKey: action.restoreKey,
    })
    if (!updated) continue
    latest = updated
    if (action.target === 'avatar') avatarChanged = true
    else coverChanged = true
  }

  return { bubbles: filtered.bubbles, updated: latest, avatarChanged, coverChanged }
}
