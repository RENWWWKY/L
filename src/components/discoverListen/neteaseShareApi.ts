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

function mapFollowUser(raw: Record<string, unknown>): NeteaseFollowUser | null {
  const userId = Number(raw.userId ?? raw.uid ?? raw.id ?? 0)
  if (!userId) return null
  const nickname = String(raw.nickname ?? raw.userName ?? '网易云用户').trim() || '网易云用户'
  const avatarRaw = raw.avatarUrl ?? raw.avatar
  const avatar =
    typeof avatarRaw === 'string'
      ? avatarRaw.startsWith('//')
        ? `https:${avatarRaw}`
        : avatarRaw
      : ''
  return { userId, nickname, avatar }
}

/** GET /user/follows — 当前账号的关注列表（用于分享给好友） */
export async function fetchNeteaseFollowUsers(
  cookie: string,
  uid: number,
  limit = 50,
): Promise<NeteaseFollowUser[]> {
  if (!cookie.trim() || !uid) return []
  const body = await ncmApiGet('/user/follows', cookie, {
    uid: String(uid),
    limit: String(limit),
    offset: '0',
  })
  const follow = Array.isArray(body.follow) ? body.follow : []
  return follow
    .map((row) =>
      row && typeof row === 'object' ? mapFollowUser(row as Record<string, unknown>) : null,
    )
    .filter((u): u is NeteaseFollowUser => Boolean(u))
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
