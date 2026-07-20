/** 与 wechatMediaSendFrequency 同步：未定制时不支持发图 */
export const IMAGE_DEFAULT_ROUND_TRIGGER_PERCENT = 0

const PROFILE_OR_COVER_HINT =
  /(?:换|改|设|当|用作?).{0,8}(?:微信)?(?:头像|封面|背景)|朋友圈.{0,6}(?:背景|封面)|(?:头像|封面|背景).{0,6}(?:换|改|设)/u
const STICKER_HINT = /表情包/u

const EXPLICIT_CHARACTER_IMAGE_REQUEST_PATTERNS: RegExp[] = [
  /(?:请|帮我|给我|能|可以|要|想)?(?:发|送|来|拍|传|share).{0,8}(?:张|个|一张|一下|点)?(?:图|照片|图片|自拍|风景照|实拍)/iu,
  /发.{0,2}(?:个|张|一下)?图(?:片)?/u,
  /(?:来|整|搞|弄).{0,4}(?:张|个|一下)?(?:图|照片|图片)/u,
  /(?:给|让).{0,6}(?:我|你看).{0,8}(?:看|瞧).{0,4}(?:下|一眼)?(?:你的|你)?(?:图|照片|图片|自拍)?/u,
  /(?:想|要).{0,4}看.{0,6}(?:你的|你)?(?:图|照片|图片|自拍)/u,
  /(?:照片|图片|自拍).{0,8}(?:发|给|晒).{0,6}(?:我|看看|瞧)/u,
  /(?:有|有没有|来点).{0,4}(?:照片|图片|自拍)/u,
  /(?:自拍|照片|图片).{0,6}(?:看看|瞧瞧|看下|来一个)/u,
  /(?:show|send).{0,6}(?:me)?.{0,6}(?:a|your)?.{0,6}(?:photo|picture|pic|selfie)/iu,
]

/** 用户本轮是否明确要求角色发送 AI 配图（非换头像/封面、非表情包） */
export function userExplicitlyRequestsCharacterImage(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (PROFILE_OR_COVER_HINT.test(t) || STICKER_HINT.test(t)) return false
  return EXPLICIT_CHARACTER_IMAGE_REQUEST_PATTERNS.some((re) => re.test(t))
}

const PHOTO_THREAD_HINT =
  /(?:自拍|照片|拍(?:一张|个|张|下|好)?|发图|重拍|再拍|发过去|发给你|发我|给你看|拍给你|前置)/u

const CHARACTER_ACTIVE_PHOTO_SEND_HINT =
  /(?:重拍|再拍|拍(?:一张|张|好)|发过去|等一下.{0,12}(?:拍|整理)|拍给你|翻.{0,8}张|找.{0,8}张|我(?:来|再)?拍)/u

const USER_PHOTO_THREAD_ACK_OR_URGE: RegExp[] = [
  /^好好好$/u,
  /^快快快$/u,
  /^嗯+$/u,
  /^好呢$/u,
  /^等你$/u,
  /^行$/u,
  /^OK$/iu,
  /^ok$/u,
  /好了吗/u,
  /发了吗/u,
  /拍好了吗/u,
  /可以发了/u,
  /赶紧/u,
  /快点/u,
  /行了没/u,
  /发过来/u,
  /然后呢/u,
]

export function collectRecentUserSelfTexts(
  transcript: readonly { from: string; text: string }[],
  limit = 8,
): string[] {
  const out: string[] = []
  for (let i = transcript.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const t = transcript[i]
    if (t?.from !== 'self') continue
    const text = String(t.text ?? '').trim()
    if (text) out.unshift(text)
  }
  return out
}

export function buildRecentPhotoThreadTranscriptTail(
  transcript: readonly { from: string; text: string }[],
  maxTurns = 14,
): string {
  return transcript
    .slice(-maxTurns)
    .map((t) => String(t.text ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/** 结合最近用户句与对话尾段，判断本轮是否应视为「明确要求/等待发图」 */
export function resolveCharacterImageRequestIntent(params: {
  transcript: readonly { from: 'self' | 'other'; text: string }[]
  recentUserLimit?: number
}): boolean {
  const recentUsers = collectRecentUserSelfTexts(params.transcript, params.recentUserLimit ?? 8)
  if (recentUsers.some(userExplicitlyRequestsCharacterImage)) return true

  const tail = buildRecentPhotoThreadTranscriptTail(params.transcript, 14)
  if (!tail || !PHOTO_THREAD_HINT.test(tail)) return false

  if (recentUsers.some((t) => USER_PHOTO_THREAD_ACK_OR_URGE.some((re) => re.test(t)))) return true

  const reversed = [...params.transcript].reverse()
  const lastSelf = reversed.find((t) => t.from === 'self')
  const lastOther = reversed.find((t) => t.from === 'other')
  if (
    lastSelf &&
    lastOther &&
    CHARACTER_ACTIVE_PHOTO_SEND_HINT.test(String(lastOther.text ?? '')) &&
    USER_PHOTO_THREAD_ACK_OR_URGE.some((re) => re.test(String(lastSelf.text ?? '').trim()))
  ) {
    return true
  }

  return false
}

const EXPLICIT_CHARACTER_STICKER_REQUEST_PATTERNS: RegExp[] = [
  /(?:请|帮我|给我|能|可以|要|想|再|最后)?.{0,8}(?:发|送|来|回).{0,16}表情包/u,
  /表情包.{0,10}(?:给|让).{0,6}(?:我|你看|看看|瞧)/u,
  /(?:发|送|来).{0,12}(?:这个|那个|同款).{0,8}表情/u,
  /\[表情包\].{0,16}(?:看看|看一下|瞧瞧|发我)/u,
  /(?:这个|那个|同款).{0,6}表情包.{0,8}(?:给|让|发).{0,6}(?:我|你看|看看)/u,
]

/** 用户本轮是否明确要求角色回发/展示表情包（应绕过「每轮概率」客户端拦截） */
export function userExplicitlyRequestsCharacterSticker(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (!STICKER_HINT.test(t) && !/\[表情\]/u.test(t)) return false
  return EXPLICIT_CHARACTER_STICKER_REQUEST_PATTERNS.some((re) => re.test(t))
}

export function buildUserExplicitCharacterImageRequestBias(explicit: boolean): string {
  if (!explicit) return ''
  return `[系统提示] 用户已**明确要求**发图/照片/自拍，或当前对话正处于「等你发照片/自拍/重拍」环节（AI 配图，非换头像/封面）。
本轮**须**在回复中单独占一行输出 \`[图片]通俗中文画面描述|||English visual tags\`（客户端气泡只显示左侧中文；点确认后直接用右侧英文 tag 生图，不再另推提示词）。
禁止只用「发过去了」「发给你了」「拍好了」等文字假装已发图而无 \`[图片]\` 行；**禁止**省略 \`|||\` 或右侧英文 tag。
若确实不宜发图，用文字说明原因并婉拒，**不要**输出 \`[图片]\` 行，也**不要**口头假装已发送。`
}
