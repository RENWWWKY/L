import { fetchUserFollowingsPage } from './neteaseFollowApi'
import { ncmApiGet } from './neteaseApiClient'

export type NeteaseFollowUser = {
  userId: number
  nickname: string
  avatar: string
}

export function buildNeteaseSongPageUrl(songId: number): string {
  return `https://music.163.com/#/song?id=${songId}`
}

export function buildListenTogetherShareText(song: {
  title: string
  artist: string
  id: number
}): string {
  const url = buildNeteaseSongPageUrl(song.id)
  return `一起来听一听《${song.title}》— ${song.artist}\n${url}`
}

/** GET /user/follows — 当前账号的关注列表（用于分享给好友） */
export async function fetchNeteaseFollowUsers(
  cookie: string,
  uid: number,
  limit = 50,
): Promise<NeteaseFollowUser[]> {
  const page = await fetchUserFollowingsPage(cookie, uid, 0, limit)
  if (page.blocked) return []
  return page.items.map((item) => ({
    userId: item.userId ?? item.id,
    nickname: item.name,
    avatar: item.avatar,
  }))
}

/** GET /send/song — 私信分享单曲给网易云好友 */
export async function sendNeteaseSongToFriend(params: {
  cookie: string
  songId: number
  userId: number
  msg?: string
}): Promise<void> {
  const { cookie, songId, userId } = params
  if (!cookie.trim() || !songId || !userId) {
    throw new Error('缺少登录态或分享目标')
  }
  const msg =
    params.msg?.trim() ||
    `分享一首好歌给你`
  await ncmApiGet('/send/song', cookie, {
    id: String(songId),
    user_ids: String(userId),
    msg,
  })
}
