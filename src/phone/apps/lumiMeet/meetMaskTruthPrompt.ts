import type { PlayerIdentity } from '../wechat/newFriendsPersona/types'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import { resolveMeetPublicDisplayName } from './meetPublicProfileDisplay'
import type { MeetMatchIntention, MeetPublicProfile } from './meetTypes'

const INTENT_ZH: Record<MeetMatchIntention, string> = {
  romance: '浪漫邂逅',
  soulmate: '灵魂伴侣',
  platonic: '纯粹友谊',
  casual: '闲聊搭子',
}

/** 遇见档案页多选意向 → 中文摘要（写入 legacy `intent` 与大模型提示） */
export function formatMeetMasqueradeIntentions(intentions: MeetMatchIntention[]): string {
  if (!intentions.length) return '（未勾选）'
  return intentions.map((k) => INTENT_ZH[k]).join('、')
}

/** 将微信玩家身份压缩为模型可用的「底层测写」短句（勿含辱骂或臆断取向用语） */
export function buildTruthAnchorSummaryForModel(identity: PlayerIdentity | null): string | null {
  if (!identity) return null
  const disp = identity.wechatNickname?.trim() || identity.name || '未命名'
  const genderZh = identity.gender === 'male' ? '男' : identity.gender === 'female' ? '女' : '其他／未声明'
  const bits = [
    `常用展示名：${disp}`,
    `资料侧性别栏：${genderZh}`,
    typeof identity.age === 'number' && identity.age > 0 ? `年龄：${identity.age}` : null,
    identity.identity?.trim() ? `身份标签：${identity.identity.trim().slice(0, 48)}` : null,
    identity.bio?.trim() ? `简介摘抄：${identity.bio.trim().slice(0, 220)}` : null,
  ].filter(Boolean)
  return bits.join('；')
}

/**
 * 注入邂逅模型：公开假面 vs 底层锚定；与策划「面具与真实」玩法一致。
 * 供 system（聊天）或 user 段（捏人）拼接。
 */
export function buildMeetDualPersonaDirective(params: {
  meetProfile: MeetPublicProfile
  truthSummary: string | null
}): string {
  const { meetProfile, truthSummary } = params
  const maskIntent = formatMeetMasqueradeIntentions(meetProfile.meetIntentionsPublic)
  const maskLine = `【遇见公开假面】展示昵称：${resolveMeetPublicDisplayName(meetProfile)}；交友意向（对外）：${maskIntent}；取向自述：${meetProfile.orientation || '未填'}；简介摘抄：${meetProfile.bio.trim().slice(0, 240) || '无'}。`
  if (!truthSummary) {
    return `${maskLine}
【底层锚定】用户未选择微信身份锚定；请仅依据公开假面理解其自述，勿编造与假面相悖的「被揭穿事实」。`
  }
  return `${maskLine}
【底层锚定 · 仅供你内部加权，勿当作对方已在遇见里亲口承认、更勿逐字宣读】${truthSummary}

【双面身份演出指令】公开假面与底层锚定可能被用户刻意设为冲突，用于后续跨应用社交的戏剧张力。若你从措辞、边界感、细节习惯中读出悖论，请在寒暄中保持礼貌与分寸，用停顿、轻描淡写的好奇或幽默试探；仅在气氛合适时轻点拨，禁止道德贬低、审讯式逼问。若无清晰悖论，不要硬拗。

【恋爱向意向】若对外资料含浪漫邂逅/灵魂伴侣：双方多半希望**真心**走向亲密关系，但初识时仍须克制——禁止一上来就用明显「为处对象而处对象」的话术、土味情话或越界定关系；靠近感应由互动自然生长。`
}

/** 读取 IndexedDB 玩家身份后拼装完整指令块（邂逅聊天 / 开场白 / 捏人提示共用） */
export async function resolveMeetDualPersonaDirective(meetProfile: MeetPublicProfile): Promise<string> {
  const id = meetProfile.baseWeChatIdentityId?.trim()
  if (!id) {
    return buildMeetDualPersonaDirective({ meetProfile, truthSummary: null })
  }
  const iden = await personaDb.getPlayerIdentity(id)
  return buildMeetDualPersonaDirective({
    meetProfile,
    truthSummary: buildTruthAnchorSummaryForModel(iden),
  })
}
