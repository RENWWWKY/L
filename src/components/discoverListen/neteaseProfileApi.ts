import { ncmApiGet } from './neteaseApiClient'

export type NeteasePlaylistItem = {
  id: number
  title: string
  count: number
  cover: string
}

export type NeteaseVipInfo = {
  vipType: number
  vipLevel: number
  isVip: boolean
  vipLabel: string
}

export type NeteaseProfileBundle = {
  user: {
    userId: number
    nickname: string
    avatar: string
    /** 听歌等级（/user/detail 的 level） */
    neteaseLevel: number
    following: number
    followers: number
    /** 累计听歌时长（小时），来自 /listen/data/total */
    listenHours: number
    vip: NeteaseVipInfo
  }
  likedSongs: NeteasePlaylistItem
  createdPlaylists: NeteasePlaylistItem[]
  savedPlaylists: NeteasePlaylistItem[]
}

function coverUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw : ''
  if (!url) return ''
  return url.includes('?') ? url : `${url}?param=300y300`
}

function mapPlaylist(raw: Record<string, unknown>): NeteasePlaylistItem {
  return {
    id: Number(raw.id ?? 0),
    title: String(raw.name ?? '未命名歌单'),
    count: Number(raw.trackCount ?? 0),
    cover: coverUrl(raw.coverImgUrl),
  }
}

function pickPlaylistArray(body: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(body.playlist)) return body.playlist as Record<string, unknown>[]
  const data = body.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const pl = (data as Record<string, unknown>).playlist
    if (Array.isArray(pl)) return pl as Record<string, unknown>[]
  }
  return []
}

function playlistCreatorId(raw: Record<string, unknown>): number {
  const creator = raw.creator
  if (creator && typeof creator === 'object') {
    return Number((creator as Record<string, unknown>).userId ?? 0)
  }
  return 0
}

/** 解析网易云 VIP 类型与等级（account + detail） */
export function parseNeteaseVipInfo(...sources: Record<string, unknown>[]): NeteaseVipInfo {
  let vipType = 0
  let vipLevel = 0
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue
    const t = Number(src.vipType)
    if (Number.isFinite(t) && t > 0) vipType = t
    const lv = Number(src.redVipLevel ?? src.vipLevel)
    if (Number.isFinite(lv) && lv > vipLevel) vipLevel = lv
  }
  const isVip = vipType > 0 || vipLevel > 0

  let vipLabel = '未开通会员'
  if (vipType === 11) {
    vipLabel = vipLevel > 0 ? `黑胶 VIP ${vipLevel}` : '黑胶 VIP'
  } else if (vipType === 10) {
    vipLabel = vipLevel > 0 ? `音乐包 ${vipLevel}` : '音乐包'
  } else if (isVip) {
    vipLabel = vipLevel > 0 ? `VIP ${vipLevel}` : 'VIP'
  }

  return { vipType, vipLevel, isVip, vipLabel }
}

const EMPTY_LIKED: NeteasePlaylistItem = {
  id: 0,
  title: '我喜欢的音乐',
  count: 0,
  cover: '',
}

/** 文档：GET /user/playlist?uid= — 创建与收藏的歌单均在此列表（无 /playlist/sublist） */
async function fetchAllUserPlaylists(cookie: string, uid: number) {
  const all: Record<string, unknown>[] = []
  const limit = 50
  let offset = 0

  for (let page = 0; page < 20; page += 1) {
    const body = await ncmApiGet('/user/playlist', cookie, {
      uid: String(uid),
      limit: String(limit),
      offset: String(offset),
    })
    const batch = pickPlaylistArray(body)
    all.push(...batch)
    if (!body.more || batch.length < limit) break
    offset += limit
  }

  return all
}

async function ncmApiGetOptional(
  path: string,
  cookie: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  try {
    return await ncmApiGet(path, cookie, params)
  } catch {
    return null
  }
}

/** 解析 /user/level 返回的听歌等级 */
function parseNeteaseLevelFromBody(body: Record<string, unknown> | null): number {
  if (!body) return 0
  const data =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body
  const level = Number(data.level ?? data.userLevel ?? 0)
  return Number.isFinite(level) && level > 0 ? level : 0
}

function msToListenHours(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.max(0, Math.round(ms / 3_600_000))
}

function minutesToListenHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.max(0, Math.round(minutes / 60))
}

function secondsToListenHours(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.max(0, Math.round(seconds / 3600))
}

/** 将时长数值按字段名与量级推断为「累计小时」 */
function durationValueToHours(value: number, key: string): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  const k = key.toLowerCase()

  if (k.includes('hour') && !k.includes('threshold')) return Math.round(value)
  if (k.includes('min')) return minutesToListenHours(value)
  if (k.includes('ms')) return msToListenHours(value)
  if (k.includes('sec') || (k.endsWith('s') && k.includes('time'))) {
    return secondsToListenHours(value)
  }

  const isListenDurationKey =
    /totallisten|listen.*total|total.*listen|listentime|totaltime|totalduration|playtime|listenduration/i.test(
      k,
    )

  if (!isListenDurationKey) return 0

  const asMs = msToListenHours(value)
  const asSec = secondsToListenHours(value)
  const asMin = minutesToListenHours(value)

  if (value >= 1_000_000) {
    // 网易云部分接口用「秒」存累计时长（如 28800000 秒 ≈ 8000 小时），误当毫秒会变成 8 小时
    if (asSec >= 100 && asSec < 500_000 && asMs < Math.max(100, asSec / 20)) {
      return asSec
    }
    if (asMs >= 100) return asMs
    if (asSec > asMs) return asSec
    return asMs
  }

  if (value >= 3600) return asSec > 0 ? asSec : asMin
  if (value >= 120) return asMin > 0 ? asMin : asSec
  return Math.round(value)
}

function parseHoursFromDisplayText(text: string): number {
  const m = text.match(/([\d,.]+)\s*小时/)
  if (!m) return 0
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

function collectListenHourCandidates(node: unknown, depth = 0, out: number[] = []): number[] {
  if (depth > 8 || node == null) return out

  if (typeof node === 'string') {
    const fromText = parseHoursFromDisplayText(node)
    if (fromText > 0) out.push(fromText)
    return out
  }

  if (typeof node !== 'object') return out

  if (Array.isArray(node)) {
    if (node.length > 80) return out
    for (const item of node) collectListenHourCandidates(item, depth + 1, out)
    return out
  }

  const obj = node as Record<string, unknown>
  for (const [key, raw] of Object.entries(obj)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const hours = durationValueToHours(raw, key)
      if (hours > 0) out.push(hours)
    } else if (typeof raw === 'string') {
      const fromText = parseHoursFromDisplayText(raw)
      if (fromText > 0) out.push(fromText)
      else collectListenHourCandidates(raw, depth + 1, out)
    } else if (raw && typeof raw === 'object') {
      collectListenHourCandidates(raw, depth + 1, out)
    }
  }

  return out
}

/** 解析听歌足迹等接口返回的累计收听时长（小时），取可信候选中的最大值 */
export function parseListenTotalHours(body: Record<string, unknown> | null): number {
  if (!body) return 0
  const candidates = collectListenHourCandidates(body)
  if (candidates.length === 0) return 0
  return Math.max(...candidates)
}

/** 汇总多个接口响应中的累计听歌小时 */
function resolveCumulativeListenHours(
  ...sources: Array<Record<string, unknown> | null>
): number {
  const hours = sources.map((s) => parseListenTotalHours(s)).filter((h) => h > 0)
  return hours.length > 0 ? Math.max(...hours) : 0
}

/** 兼容旧版缓存（无 vip / listenHours 字段） */
export function normalizeNeteaseProfileBundle(
  profile: NeteaseProfileBundle,
): NeteaseProfileBundle {
  const user = profile.user as NeteaseProfileBundle['user'] & { listenSongs?: number }
  return {
    ...profile,
    user: {
      ...user,
      vip: user.vip ?? parseNeteaseVipInfo({}),
      listenHours:
        typeof user.listenHours === 'number'
          ? user.listenHours
          : 0,
    },
  }
}

/** 登录后拉取网易云账号资料与歌单 */
export async function fetchNeteaseProfile(cookie: string): Promise<NeteaseProfileBundle> {
  const accountBody = await ncmApiGet('/user/account', cookie)
  const accountProfile =
    accountBody.profile && typeof accountBody.profile === 'object'
      ? (accountBody.profile as Record<string, unknown>)
      : null
  if (!accountProfile) {
    throw new Error('未获取到账号信息，请重新扫码登录')
  }

  const uid = Number(accountProfile.userId ?? accountProfile.id ?? 0)
  if (!uid) throw new Error('账号 ID 无效')

  const [detailBody, rawPlaylists, levelBody, listenTotalBody, listenYearBody] =
    await Promise.all([
      ncmApiGet('/user/detail', cookie, { uid: String(uid) }),
      fetchAllUserPlaylists(cookie, uid),
      ncmApiGetOptional('/user/level', cookie),
      ncmApiGetOptional('/listen/data/total', cookie),
      ncmApiGetOptional('/listen/data/year/report', cookie),
    ])

  const detail =
    detailBody.profile && typeof detailBody.profile === 'object'
      ? (detailBody.profile as Record<string, unknown>)
      : {}

  const likedRaw =
    rawPlaylists.find((raw) => Number(raw.specialType) === 5) ??
    rawPlaylists.find((raw) => String(raw.name ?? '').includes('喜欢的音乐'))

  const createdPlaylists = rawPlaylists
    .filter((raw) => {
      if (raw === likedRaw) return false
      if (Number(raw.specialType) === 5) return false
      return playlistCreatorId(raw) === uid
    })
    .map(mapPlaylist)

  const savedPlaylists = rawPlaylists
    .filter((raw) => {
      if (raw === likedRaw) return false
      if (Number(raw.specialType) === 5) return false
      return playlistCreatorId(raw) !== uid
    })
    .map(mapPlaylist)

  const nickname = String(accountProfile.nickname ?? '网易云用户')
  const avatar = coverUrl(accountProfile.avatarUrl ?? accountProfile.avatar)

  const listenLevel =
    parseNeteaseLevelFromBody(levelBody) ||
    Number(detail.level ?? accountProfile.level ?? 0)
  const listenHours = resolveCumulativeListenHours(listenTotalBody, listenYearBody, detailBody)
  const vip = parseNeteaseVipInfo(accountProfile, detail)

  return {
    user: {
      userId: uid,
      nickname,
      avatar: avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed=netease',
      neteaseLevel: listenLevel,
      // 与 /user/follows（关注列表）、/user/followeds（粉丝列表）一致：follows=关注数，followeds=粉丝数
      following: Number(detail.follows ?? 0),
      followers: Number(detail.followeds ?? 0),
      listenHours,
      vip,
    },
    likedSongs: likedRaw ? mapPlaylist(likedRaw) : EMPTY_LIKED,
    createdPlaylists,
    savedPlaylists,
  }
}
