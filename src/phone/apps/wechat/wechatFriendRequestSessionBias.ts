import { personaDb } from './newFriendsPersona/idb'
import {
  formatPlayerIdentityDisplayName,
  getCharacterBoundPlayerIdentityId,
  isNonPrimaryBindingSession,
} from './wechatCharacterPlayerIdentity'

/** 好友验证/通过后问候：当前申请人是副绑定马甲，禁止当成档案主绑定本人。 */
export async function buildFriendRequestNonPrimaryBindingBias(params: {
  characterId: string
  sessionPlayerIdentityId: string
  wechatHomeDisplayName: string
}): Promise<string> {
  const cid = params.characterId.trim()
  const session = params.sessionPlayerIdentityId.trim()
  if (!cid || !session) return ''
  const ch = await personaDb.getCharacter(cid)
  if (!ch || !isNonPrimaryBindingSession(ch, session)) return ''

  const primaryId = getCharacterBoundPlayerIdentityId(ch)!
  const [primaryRow, sessionRow] = await Promise.all([
    personaDb.getPlayerIdentity(primaryId),
    personaDb.getPlayerIdentity(session),
  ])
  const primaryName = formatPlayerIdentityDisplayName(primaryRow, primaryId)
  const sessionName = formatPlayerIdentityDisplayName(sessionRow, session)
  const wxNick = params.wechatHomeDisplayName.trim() || '（见上方微信资料）'

  return [
    '【好友验证/通过后问候 · 当前申请人 ≠ 档案主绑定】',
    `角色档案主绑定玩家是 **${primaryName}**（熟人/推荐人档），**不是**正在加你的这位。`,
    `当前申请人为新联系人；系统标注的微信展示名「${wxNick}」**禁止**在台词里直呼（不是真名）。`,
    `**硬性禁止**：对当前申请人使用「社长大人」「${primaryName}」真名/职务、主绑定专属亲昵称呼、「你居然亲自来加」「看到社长申请」等；禁止用「${wxNick}」「${sessionName}」打招呼。`,
    '对方写「我是…」只表示其在验证里的自称，不得因此认定对方就是主绑定本人；不知真名时默认叫「你」。',
    'post_accept_greeting 须按**刚通过好友的新联系人**写 1~3 句：可礼貌、可试探，**不得**当作主绑定深夜上线，**不得**用微信昵称开场。',
  ].join('\n')
}
