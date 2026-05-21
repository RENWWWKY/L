import { personaDb } from '../wechat/newFriendsPersona/idb'
import { isMeetContactWechatIdPlausible } from './meetContactSettings'
import { listMeetSelectableWechatAccounts, findMeetWechatAccount } from './meetWechatAccountPool'
import type { MeetPublicProfile } from './meetTypes'

/** 联络绑定缺口（匹配 / 缔结契约前须补齐） */
export type MeetBindingGap =
  | 'player_identity'
  | 'wechat_account'
  | 'wechat_register'
  | null

export const MEET_OPEN_PROFILE_CONTACT_TAB_KEY = 'meet-open-profile-contact-tab'
export const MEET_APP_GO_PROFILE_CONTACT_EVENT = 'meet-app-go-profile-contact'

function identityReady(profile: Pick<MeetPublicProfile, 'baseWeChatIdentityId'>): boolean {
  const pid = profile.baseWeChatIdentityId?.trim() ?? ''
  return !!pid && pid !== '__none__'
}

function contactWechatReady(profile: Pick<MeetPublicProfile, 'contactWechatId'>): boolean {
  const wx = profile.contactWechatId?.trim() ?? ''
  return !!wx && isMeetContactWechatIdPlausible(wx)
}

/** 仅根据已保存档案判断（同步） */
export function assessMeetBindingGapSync(
  profile: Pick<MeetPublicProfile, 'contactWechatId' | 'baseWeChatIdentityId'>,
): MeetBindingGap {
  if (!identityReady(profile)) return 'player_identity'
  if (!contactWechatReady(profile)) return 'wechat_account'
  return null
}

/** 含主微信是否已注册账号、所选微信号是否仍在可选列表中 */
export async function assessMeetBindingGap(
  profile: Pick<MeetPublicProfile, 'contactWechatId' | 'baseWeChatIdentityId'>,
): Promise<MeetBindingGap> {
  const syncGap = assessMeetBindingGapSync(profile)
  if (syncGap === 'player_identity') return syncGap

  const accounts = await listMeetSelectableWechatAccounts()
  if (!accounts.length) return 'wechat_register'
  const account = findMeetWechatAccount(accounts, profile.contactWechatId)
  if (!account) return 'wechat_account'

  const acc = account.accountId.trim()
  const rows = acc
    ? await personaDb.listPlayerIdentities(acc)
    : await personaDb.listPlayerIdentities()
  const pid = profile.baseWeChatIdentityId?.trim() ?? ''
  if (!pid || pid === '__none__' || !rows.some((r) => r.id === pid)) return 'player_identity'
  return null
}

export function meetBindingGapCopy(gap: MeetBindingGap): { title: string; body: string; cta: string } {
  switch (gap) {
    case 'player_identity':
      return {
        title: '请先绑定玩家身份',
        body: '开始寻觅前，请在「我的 → 联络绑定」里选定一套玩家身份。匹配成功后的好友验证、私聊会话线都会绑在这个身份上，未绑定会导致微信侧对不上人。',
        cta: '去绑定身份与微信',
      }
    case 'wechat_register':
      return {
        title: '请先在微信注册账号',
        body: '遇见需要从主微信拉取你已注册的微信账号，用于互换联络方式。请先到微信 App 完成身份注册，再回到遇见「我的 → 联络绑定」选择要展示的微信号。',
        cta: '去微信注册',
      }
    case 'wechat_account':
      return {
        title: '请先选择微信账号',
        body: '开始寻觅前，请在「我的 → 联络绑定」里选定要用于交换联络方式的微信账号。未选择则无法在「缔结契约」时向对方展示你的微信号，也无法绑定该账号下的玩家身份。',
        cta: '去绑定身份与微信',
      }
    default:
      return { title: '', body: '', cta: '知道了' }
  }
}

export function dispatchGoMeetProfileContact(opts?: { openWeChatRegistration?: boolean }) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(MEET_OPEN_PROFILE_CONTACT_TAB_KEY, '1')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MEET_APP_GO_PROFILE_CONTACT_EVENT))
  if (opts?.openWeChatRegistration) {
    window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'wechat' } }))
  }
}
