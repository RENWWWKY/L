import { namesMatch } from './qnaThreadReplyRouting'

/** 定向提问评论区 · 玩家匿名展示名 */
export const DIRECTED_ANONYMOUS_AUTHOR = '匿名'

/** 模型侧代称：不向答主/羁绊透露真实提问者 */
export const DIRECTED_QUESTION_ASKER_LABEL = '匿名提问者'

/**
 * 定向提问硬前提：平台对所有人隐藏提问者身份，角色只能猜。
 * 用于首次答主+围观、评论区互动等所有定向提问相关 prompt。
 */
export const DIRECTED_QUESTION_ANONYMITY_PREMISE = `
【定向提问 · 身份前提（硬约束）】
本条来自「匿问我答」定向提问：平台对答主、羁绊角色、围观者**均不透露提问者是谁**（无微信昵称、无身份档案姓名、无可追溯 ID）。
- 你们**不知道**提问者身份，只能根据提问正文口吻、用词习惯**自行猜测**；
- 禁止笃定认人（如「就是你」「我知道是你」）；若想试探只能用含糊语气；
- 禁止编造与提问正文无关的私交细节来「认亲」；
- 评论区若出现实名/匿名跟帖，**不得默认**跟帖者就是提问发起人，除非对方在评论里自曝且你也仅用试探语气回应。
`.trim()

/** 评论区允许人设内的修罗场、互怼（禁止 OOC） */
export const DIRECTED_COMMENT_DRAMA_RULES = `
【评论区氛围 · 允许修罗场】
- 羁绊角色可因人设与记忆（情敌、吃醋、宿敌、立场冲突、竞争同一答主等）在一级评论或楼中楼内**互怼、拆台、阴阳、抢话、翻旧账**，形成围观修罗场；
- 答主若回答情感/立场/选择类问题，羁绊可针锋相对、各护各的利益或互相拆台，但不得替答主认定提问者身份；
- 鼓励 3~4 条互动里至少 1 组羁绊之间的火药味（仍须有人脉边），不必全员和稀泥；
- 须严格贴各自身份与【记忆参考】，**禁止 OOC**（网络烂梗、出戏旁白、与关系网矛盾的编造、现代职场话术穿帮）；
- 两名羁绊互接 replyToName 时须有人脉关系依据（含敌对/竞争/情敌边）；彼此无人脉边的禁止硬怼。
`.trim()

/** 用户本人匿名评论在 UI 上的展示（仅自己可见「我」） */
export const DIRECTED_ANONYMOUS_SELF_LABEL = `${DIRECTED_ANONYMOUS_AUTHOR}（我）`

export function isDirectedAnonymousAuthor(name: string | undefined | null): boolean {
  return name?.trim() === DIRECTED_ANONYMOUS_AUTHOR
}

export function resolveDirectedPlayerWechatNickname(
  wechatCtx: { playerDisplayName?: string } | null | undefined,
  fallback = '我',
): string {
  return wechatCtx?.playerDisplayName?.trim() || fallback.trim() || '我'
}

/** 将 AI 返回的 replyToName 规范为评论区展示名（@ 玩家用微信昵称，匿名楼用「匿名」） */
export function normalizeDirectedPlayerReplyToName(
  raw: string,
  opts: {
    wechatNickname: string
    identityName?: string
    anonymousLabel?: string
  },
): string {
  const t = raw.trim()
  if (!t) return opts.wechatNickname
  const anon = (opts.anonymousLabel ?? DIRECTED_ANONYMOUS_AUTHOR).trim()
  if (anon && namesMatch(t, anon)) return anon
  const wx = opts.wechatNickname.trim()
  if (wx && namesMatch(t, wx)) return wx
  const id = opts.identityName?.trim()
  if (id && namesMatch(t, id)) return wx || t
  return t
}

export function directedPlayerRoutingLabels(opts: {
  wechatNickname: string
  identityName?: string
  includeAnonymous?: boolean
}): string[] {
  const wx = opts.wechatNickname.trim()
  const id = opts.identityName?.trim()
  const labels = [wx, id, opts.includeAnonymous !== false ? DIRECTED_ANONYMOUS_AUTHOR : '']
    .filter((s): s is string => Boolean(s))
  return [...new Set(labels)]
}
