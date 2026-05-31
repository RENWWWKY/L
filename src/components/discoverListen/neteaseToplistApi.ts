import { ncmApiGet } from './neteaseApiClient'
import { fetchPlaylistTracks, type NeteaseSongItem } from './neteaseMusicApi'
import type { NeteasePlaylistItem } from './neteaseProfileApi'

function coverUrl(raw: unknown): string {
  const url = typeof raw === 'string' ? raw : ''
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url.includes('?') ? url : `${url}?param=300y300`
}

/** 从 /toplist 里按名称匹配要展示的官方榜 */
const FEATURED_CHART_RULES: Array<{ key: string; match: RegExp; shortName: string }> = [
  { key: 'hot', match: /热歌榜/, shortName: '热歌榜' },
  { key: 'chinese', match: /华语榜/, shortName: '华语榜' },
  { key: 'new', match: /新歌榜/, shortName: '新歌榜' },
  { key: 'soar', match: /飙升榜/, shortName: '飙升榜' },
]

/** 接口不可用时的官方榜歌单 id（网易云默认榜） */
const FALLBACK_CHART_IDS: Array<{ id: number; shortName: string }> = [
  { id: 3778678, shortName: '热歌榜' },
  { id: 5059661512, shortName: '华语榜' },
  { id: 3779629, shortName: '新歌榜' },
  { id: 19723756, shortName: '飙升榜' },
]

export type NeteaseToplistChart = {
  id: number
  name: string
  cover: string
  count: number
  songs: NeteaseSongItem[]
}

type ToplistRow = {
  id: number
  name: string
  cover: string
  count: number
}

function parseToplistRows(body: Record<string, unknown>): ToplistRow[] {
  const list = Array.isArray(body.list) ? body.list : []
  const rows: ToplistRow[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const id = Number(row.id)
    if (!id) continue
    const name = String(row.name ?? '').trim()
    if (!name) continue
    rows.push({
      id,
      name,
      cover: coverUrl(row.coverImgUrl ?? row.cover),
      count: Number(row.trackCount ?? row.playCount ?? 0),
    })
  }
  return rows
}

function pickFeaturedCharts(all: ToplistRow[]): ToplistRow[] {
  const picked: ToplistRow[] = []
  const used = new Set<number>()

  for (const rule of FEATURED_CHART_RULES) {
    const hit =
      all.find((row) => {
        if (used.has(row.id)) return false
        return rule.match.test(row.name)
      }) ??
      all.find((row) => {
        if (used.has(row.id)) return false
        const normalized = row.name.replace(/^云音乐/, '')
        return rule.match.test(normalized)
      })
    if (hit) {
      used.add(hit.id)
      picked.push(hit)
    }
  }

  if (picked.length >= 2) return picked

  for (const fb of FALLBACK_CHART_IDS) {
    if (used.has(fb.id)) continue
    const fromApi = all.find((r) => r.id === fb.id)
    picked.push(
      fromApi ?? {
        id: fb.id,
        name: `云音乐${fb.shortName}`,
        cover: '',
        count: 0,
      },
    )
    used.add(fb.id)
    if (picked.length >= FEATURED_CHART_RULES.length) break
  }

  return picked
}

function displayChartName(fullName: string, shortName: string): string {
  const n = fullName.replace(/^云音乐/, '').trim()
  if (/榜$/.test(n)) return n
  return shortName
}

/** GET /toplist + 各榜歌单曲目预览 */
export async function fetchFeaturedToplistCharts(
  cookie: string,
  previewPerChart = 6,
): Promise<NeteaseToplistChart[]> {
  let allRows: ToplistRow[] = []
  try {
    const body = await ncmApiGet('/toplist', cookie)
    allRows = parseToplistRows(body)
  } catch {
    allRows = FALLBACK_CHART_IDS.map((fb) => ({
      id: fb.id,
      name: `云音乐${fb.shortName}`,
      cover: '',
      count: 0,
    }))
  }

  const selected = pickFeaturedCharts(allRows)
  const charts: NeteaseToplistChart[] = []

  for (const row of selected) {
    const rule = FEATURED_CHART_RULES.find(
      (r) => r.match.test(row.name) || r.match.test(row.name.replace(/^云音乐/, '')),
    )
    let songs: NeteaseSongItem[] = []
    try {
      songs = await fetchPlaylistTracks(cookie, row.id, previewPerChart, 0)
    } catch {
      songs = []
    }
    charts.push({
      id: row.id,
      name: displayChartName(row.name, rule?.shortName ?? row.name),
      cover: row.cover || songs[0]?.cover || '',
      count: row.count || songs.length,
      songs,
    })
  }

  return charts
}

export function toplistChartAsPlaylist(chart: NeteaseToplistChart): NeteasePlaylistItem {
  return {
    id: chart.id,
    title: chart.name,
    cover: chart.cover,
    count: chart.count,
  }
}
