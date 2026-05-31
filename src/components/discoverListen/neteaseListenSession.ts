import {
  clearGuestMode,
  clearNeteaseLoginCookie,
  getNeteaseLoginCookieSync,
  hydrateGuestMode,
  hydrateNeteaseLoginCookie,
  isGuestModeSync,
  saveNeteaseLoginCookie,
  setGuestMode,
} from './listenTogetherPersistence'

export type NeteaseListenSession = {
  /** 网易账号 Cookie；游客模式下为空字符串 */
  cookie: string
  isGuest: boolean
  isLoggedIn: boolean
  /** 已登录网易账号，或已进入游客模式 */
  isActive: boolean
}

function buildSession(cookie: string, isGuest: boolean): NeteaseListenSession {
  const trimmedCookie = cookie.trim()
  const isLoggedIn = Boolean(trimmedCookie)
  const guestActive = isGuest && !isLoggedIn
  return {
    cookie: trimmedCookie,
    isGuest: guestActive,
    isLoggedIn,
    isActive: isLoggedIn || guestActive,
  }
}

export function getNeteaseListenSessionSync(): NeteaseListenSession {
  return buildSession(getNeteaseLoginCookieSync(), isGuestModeSync())
}

export async function hydrateNeteaseListenSession(): Promise<NeteaseListenSession> {
  const [cookie, isGuest] = await Promise.all([hydrateNeteaseLoginCookie(), hydrateGuestMode()])
  return buildSession(cookie, isGuest)
}

/** 进入游客模式：不保存网易 Cookie，可使用搜索/推荐/公开歌单播放 */
export async function enterGuestListenMode(): Promise<NeteaseListenSession> {
  await clearNeteaseLoginCookie()
  await setGuestMode(true)
  return buildSession('', true)
}

/** 网易账号登录成功：清除游客标记并保存 Cookie */
export async function applyNeteaseAccountLogin(cookie: string): Promise<NeteaseListenSession> {
  await clearGuestMode()
  await saveNeteaseLoginCookie(cookie)
  return buildSession(cookie, false)
}

/** 退出当前听一听会话（账号与游客） */
export async function clearNeteaseListenSession(): Promise<NeteaseListenSession> {
  await Promise.all([clearNeteaseLoginCookie(), clearGuestMode()])
  return buildSession('', false)
}
