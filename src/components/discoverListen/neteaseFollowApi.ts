import { ncmApiGet } from './neteaseApiClient'

export type NeteaseFollowListKind = 'following' | 'followers'

export type NeteaseFollowListSubject =
  | { type: 'user'; userId: number; title?: string }
  | { type: 'artist'; artistId: number; accountUserId?: number; title?: string }

export type NeteaseFollowListItem = {
  id: number
  name: string
  avatar: string
  kind: 'user' | 'artist'
  artistId?: number
  userId?: number
  signature?: string
}

export type NeteaseFollowListPage = {
  items: NeteaseFollowListItem[]
  total: number
  more: boolean
  blocked: boolean
  blockReason?: string
}

const PRIVACY_MSG_RE = /关闭|权限|隐私|private|permission|不可见|无权/i

function avatarFromRaw(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  return raw.startsWith('//') ? `https:${raw}` : raw
}

function privacyBlockFromError(e: unknown): NeteaseFollowListPage | null {
  const msg = e instanceof Error ? e.message : String(e ?? '')
  if (PRIVACY_MSG_RE.test(msg)) {
    return {
      items: [],
      total: 0,
      more: false,
      blocked: true,
      blockReason: msg || '对方已关闭查看权限',
    }
  }
  return null
}

async function ncmFollowGet(
  path: string,
  cookie: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  try {
    return (await ncmApiGet(path, cookie, params)) as Record<string, unknown>
  } catch (e) {
    const blocked = privacyBlockFromError(e)
    if (blocked) {
      const err = new Error(blocked.blockReason ?? '无法查看列表')
      ;(err as Error & { followListBlocked?: NeteaseFollowListPage }).followListBlocked = blocked
      throw err
    }
    throw e
  }
}

function parsePrivacyBlock(body: Record<string, unknown>): { blocked: boolean; reason?: string } {
  const code = typeof body.code === 'number' ? body.code : 200
  const msg = String(body.message ?? body.msg ?? '').trim()
  if (msg && PRIVACY_MSG_RE.test(msg)) {
    return { blocked: true, reason: msg }
  }
  if (code === 404 || code === 403 || code === 502) {
    return { blocked: true, reason: msg || '无法查看该列表' }
  }
  return { blocked: false }
}

function mapFollowRow(raw: unknown): NeteaseFollowListItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const userId = Number(row.userId ?? row.uid ?? 0)
  const artistId = Number(
    row.artistId ??
      (row.artist && typeof row.artist === 'object'
        ? (row.artist as Record<string, unknown>).id
        : undefined) ??
      0,
  )
  const userType = Number(row.userType ?? 0)
  const isArtist = artistId > 0 || userType === 4 || userType === 2
  const id = isArtist ? artistId || userId : userId
  if (!id) return null
  const name = String(
    row.nickname ??
      row.userName ??
      row.name ??
      (row.artist && typeof row.artist === 'object'
        ? (row.artist as Record<string, unknown>).name
        : '') ??
      '',
  ).trim()
  if (!name) return null
  const avatar = avatarFromRaw(
    row.avatarUrl ??
      row.avatar ??
      (row.artist && typeof row.artist === 'object'
        ? (row.artist as Record<string, unknown>).img1v1Url ??
          (row.artist as Record<string, unknown>).picUrl
        : ''),
  )
  const signature =
    typeof row.signature === 'string' ? row.signature.trim().slice(0, 120) : undefined
  if (isArtist) {
    return {
      id,
      name,
      avatar,
      kind: 'artist',
      artistId: artistId || id,
      userId: userId || undefined,
      signature,
    }
  }
  return { id, name, avatar, kind: 'user', userId: id, signature }
}

function parseListPage(
  body: Record<string, unknown>,
  itemsRaw: unknown[],
  loadedCount: number,
  offset: number,
): NeteaseFollowListPage {
  const privacy = parsePrivacyBlock(body)
  if (privacy.blocked) {
    return {
      items: [],
      total: 0,
      more: false,
      blocked: true,
      blockReason: privacy.reason ?? '对方已关闭查看权限',
    }
  }
  const items = itemsRaw
    .map((row) => mapFollowRow(row))
    .filter((item): item is NeteaseFollowListItem => Boolean(item))
  const total = Number(body.size ?? body.total ?? body.count ?? items.length + offset)
  const more = loadedCount > 0 ? offset + loadedCount < total : items.length > 0
  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    more,
    blocked: false,
  }
}

/** GET /user/follows — 用户关注列表 */
export async function fetchUserFollowingsPage(
  cookie: string,
  uid: number,
  offset = 0,
  limit = 30,
): Promise<NeteaseFollowListPage> {
  if (!cookie.trim() || !uid) {
    return { items: [], total: 0, more: false, blocked: true, blockReason: '缺少用户信息' }
  }
  const body = await ncmFollowGet('/user/follows', cookie, {
    uid: String(uid),
    limit: String(limit),
    offset: String(offset),
  })
  const row = body as Record<string, unknown>
  const follow = Array.isArray(row.follow) ? row.follow : []
  return parseListPage(row, follow, follow.length, offset)
}

/** GET /user/followeds — 用户粉丝列表 */
export async function fetchUserFollowersPage(
  cookie: string,
  uid: number,
  offset = 0,
  limit = 30,
): Promise<NeteaseFollowListPage> {
  if (!cookie.trim() || !uid) {
    return { items: [], total: 0, more: false, blocked: true, blockReason: '缺少用户信息' }
  }
  const body = await ncmFollowGet('/user/followeds', cookie, {
    uid: String(uid),
    limit: String(limit),
    offset: String(offset),
  })
  const row = body as Record<string, unknown>
  const followeds = Array.isArray(row.followeds)
    ? row.followeds
    : Array.isArray(row.follow)
      ? row.follow
      : []
  return parseListPage(row, followeds, followeds.length, offset)
}

/** GET /artist/fans — 歌手粉丝列表 */
export async function fetchArtistFansPage(
  cookie: string,
  artistId: number,
  offset = 0,
  limit = 30,
): Promise<NeteaseFollowListPage> {
  if (!cookie.trim() || !artistId) {
    return { items: [], total: 0, more: false, blocked: true, blockReason: '缺少歌手信息' }
  }
  const body = await ncmFollowGet('/artist/fans', cookie, {
    id: String(artistId),
    limit: String(limit),
    offset: String(offset),
  })
  const row = body as Record<string, unknown>
  const fans = Array.isArray(row.fans) ? row.fans : Array.isArray(row.records) ? row.records : []
  return parseListPage(row, fans, fans.length, offset)
}

export async function fetchFollowListPage(
  cookie: string,
  subject: NeteaseFollowListSubject,
  listKind: NeteaseFollowListKind,
  offset = 0,
  limit = 30,
): Promise<NeteaseFollowListPage> {
  if (subject.type === 'artist') {
    if (listKind === 'followers') {
      return fetchArtistFansPage(cookie, subject.artistId, offset, limit)
    }
    const uid = subject.accountUserId ?? 0
    if (!uid) {
      return {
        items: [],
        total: 0,
        more: false,
        blocked: true,
        blockReason: '该歌手未绑定用户账号，无法查看关注列表',
      }
    }
    return fetchUserFollowingsPage(cookie, uid, offset, limit)
  }
  if (listKind === 'following') {
    return fetchUserFollowingsPage(cookie, subject.userId, offset, limit)
  }
  return fetchUserFollowersPage(cookie, subject.userId, offset, limit)
}

export function followListPageTitle(
  subject: NeteaseFollowListSubject,
  listKind: NeteaseFollowListKind,
): string {
  const who = subject.title?.trim() || (subject.type === 'artist' ? '歌手' : '用户')
  return listKind === 'following' ? `${who}的关注` : `${who}的粉丝`
}
