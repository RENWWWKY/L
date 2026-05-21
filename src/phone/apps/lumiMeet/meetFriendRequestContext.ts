import type { FriendRequestRow } from '../wechat/newFriendsPersona/idb'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { MeetUserProfileSnapshot } from './meetTypes'
import type { WeChatHomeProfile } from './meetUserProfileSnapshot'
import {
  buildMeetWechatPrivateChatContinuityBlock,
  isMeetSyncedCharacter,
  loadMeetUserProfileSnapshotFromKv,
  resolveMeetSnapshotForFriendRequest,
} from './meetUserProfileSnapshot'
/** 好友申请裁决：遇见已互动 → 微信验证承接；假面与微信主页不一致时可掉马 */
export async function buildMeetFriendRequestAdjudicationBias(
  frRow: FriendRequestRow,
  wechatHomeProfile?: WeChatHomeProfile | null,
): Promise<string> {
  const ch = await personaDb.getCharacter(frRow.characterId)
  const linked = frRow.meetLinkedNpcId?.trim() || frRow.characterId.trim()
  const fromMeet =
    !!frRow.meetLinkedNpcId ||
    !!frRow.meetUserProfileAtRequest ||
    isMeetSyncedCharacter(frRow.characterId, ch?.worldBooks)

  if (!fromMeet) return ''

  const meetSnapshot = await resolveMeetSnapshotForFriendRequest({
    characterId: frRow.characterId,
    meetLinkedNpcId: linked,
    meetUserProfileAtRequest: frRow.meetUserProfileAtRequest as MeetUserProfileSnapshot | undefined,
  })

  const wxProfile: WeChatHomeProfile = wechatHomeProfile ?? {
    displayName: '',
    signature: '',
  }
  const snap = meetSnapshot ?? (await loadMeetUserProfileSnapshotFromKv(linked))
  const continuity = buildMeetWechatPrivateChatContinuityBlock({
    meetSnapshot: snap,
    wechatProfile: wxProfile,
    forFriendRequest: true,
  })
  if (!continuity.trim() && !snap) {
    return [
      '【遇见来源】对方可能与你在「遇见」App 中互动过；当前为微信添加朋友验证。',
      '请结合人设决定是否通过；通过后像熟人续聊；若资料反差大可写掉马，勿写成完全初识。',
    ].join('\n')
  }
  return [
    continuity,
    '',
    '【好友验证裁决】当前为微信添加朋友验证阶段；须按系统要求输出裁决 XML。',
    '· 遇见里见过的是假面/遇见档案；**微信验证栏仍默认不认识**对方微信身份，禁止套档案主绑定/社长/它号旧识称呼。',
    '· 通过后 post_accept_greeting：像**已在遇见聊过**的人转场到微信；可接验证气氛；**禁止**用微信主页昵称直呼，可用遇见里已用过的假面称呼或默认「你」。',
    '· 若遇见假面与【微信主页资料】不一致：欢迎**掉马/抓马**（愣住、试探、调侃均可），但勿把遇见假面昵称当第一次听说。',
    '· 展示名以微信主页为准；勿主线复读「刚通过好快」而忽略遇见前情。',
    '· 系统提示中若含【尚未写入长期记忆的遇见临时会话片段】，须与验证回复、通过后打招呼一并承接。',
  ].join('\n')
}
