import type { FriendRequestDecision } from './friendRequestDecisionParse'

/**
 * 模型未输出 <friend_request_response> 时的最后兜底（仅用户主动申请裁决链使用）。
 * 偏保守：明确拒绝优先；接受需较强信号，避免误加好友。
 */
export function inferFriendRequestDecisionFromCharacterText(texts: string[]): FriendRequestDecision | null {
  const joined = texts
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .join('\n')
  if (!joined) return null

  const declineStrong =
    /(婉拒|拒绝|不同意|不想加|不加你|先不加|暂时不加|别加了|算了吧|不方便加|抱歉.*(?:不能|无法).*加)/.test(joined) ||
    /<decision>\s*decline/i.test(joined)

  if (declineStrong) return 'decline'

  const acceptStrong =
    /<decision>\s*accept/i.test(joined) ||
    /(已通过|同意了你的|通过了你的|好友已通过|验证已通过|我通过了|那就通过|帮你通过了)/.test(joined) ||
    (/通过/.test(joined) && /(好友|验证|申请)/.test(joined) && !/(不|没|未|别)/.test(joined))

  if (acceptStrong) return 'accept'

  return null
}
