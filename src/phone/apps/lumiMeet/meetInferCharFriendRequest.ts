import type { EncounterSwapMeta } from './meetTypes'

/** 与邂逅工具栏「已缔结」一致：契约同意或旧版已互换 */
export function isMeetEncounterWeChatLinked(
  swap: Pick<EncounterSwapMeta, 'covenantAgreed' | 'wechatSwapStatus'> | undefined | null,
): boolean {
  if (!swap) return false
  return !!swap.covenantAgreed || swap.wechatSwapStatus === 'swapped'
}

/**
 * 模型 evaluation 常漏标 char_friend_request；口语已答应「发验证」时由客户端兜底。
 */
export function inferCharFriendRequestFromTurn(params: {
  evaluationFlag: boolean
  lastUserContent: string
  outboundTexts: string[]
}): boolean {
  if (params.evaluationFlag) return true

  const user = params.lastUserContent.replace(/\u200b/g, '').trim()
  const npc = params.outboundTexts
    .map((t) => t.replace(/\u200b/g, '').trim())
    .filter((t) => t.length > 0 && t !== '。')
    .join('\n')
  if (!user || !npc) return false

  const userWantsCharAdd =
    /(你|这边|那边).{0,10}(先|主动).{0,8}(加|添加|发).{0,12}(我|好友|微信|验证)/.test(user) ||
    /(加|添加).{0,6}我.{0,8}(好友|微信|验证)/.test(user) ||
    /微信.{0,10}(加|添加).{0,6}我/.test(user) ||
    /(发|送).{0,6}(好友)?验证/.test(user) ||
    /通过一下/.test(user) ||
    /新的朋友/.test(user)

  const npcCommits =
    /(已|已经).{0,6}(发|送|提交|点).{0,10}(验证|申请|好友|添加)/.test(npc) ||
    /好友验证/.test(npc) ||
    /新的朋友/.test(npc) ||
    /(这就|马上|现在|稍后).{0,8}(加|发|送)/.test(npc) ||
    /(加|添加).{0,6}你.{0,8}(好友|微信)/.test(npc) ||
    /通过一下/.test(npc)

  return userWantsCharAdd && npcCommits
}
