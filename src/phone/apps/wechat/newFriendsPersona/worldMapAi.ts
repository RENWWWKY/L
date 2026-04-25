import type { ApiConfig } from '../../api/types'
import { openAiCompatibleChat } from './ai'
import type { WorldMapCanvasBg, WorldMapData, WorldMapMarker, WorldMapRegion, WorldMapRegionGeom } from './types'
import { WORLD_MAP_UNITS, normalizeWorldMapData } from './types'
import { getAllTerrainIds, LEGACY_TERRAIN_ALIASES } from './worldMapCatalog'
import { uid } from './utils'

function parseJsonFromModel(text: string): Record<string, unknown> {
  const t = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i
  const m = t.match(fence)
  const raw = (m ? m[1] : t).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型未返回可解析的 JSON')
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
}

function clampWorld(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(WORLD_MAP_UNITS, n))
}

/** 生成范围：越小模型输出越少，越不易闪退 */
export type WorldMapAiScaleId = 'micro' | 'street' | 'district' | 'city' | 'full'

export const WORLD_MAP_AI_SCALE_OPTIONS: { id: WorldMapAiScaleId; label: string; hint: string }[] = [
  { id: 'micro', label: '街区 / 生活圈（约 6～8 km）', hint: '几条街、小区、小商圈；板块最少，最省内存' },
  { id: 'street', label: '片区（约 15 km）', hint: '街道或镇中心一带' },
  { id: 'district', label: '城区（约 25 km）', hint: '多片功能区' },
  { id: 'city', label: '城市尺度（约 45 km）', hint: '市域主要结构' },
  { id: 'full', label: '整幅画布（100 km）', hint: '全图概览；仍限制板块数量以防卡顿' },
]

/** 快捷填入「必含要素」的示例（中文，模型会映射到 terrainType） */
export const WORLD_MAP_AI_ELEMENT_SUGGESTIONS: string[] = [
  '公寓楼',
  '奶茶店',
  '河流',
  '主干道',
  '公园',
  '学校',
  '地铁站',
  '湖泊',
  '独栋别墅',
  '便利店',
]

type ScaleLimits = {
  maxRegions: number
  maxMarkers: number
  maxPolyVertices: number
  maxTokens: number
  /** 从画布中心向四周的半边长（米），生成坐标应落在此正方形内 */
  halfExtentM: number
  minRegionsPrompt: number
  maxRegionsPrompt: number
}

function limitsForScale(scale: WorldMapAiScaleId): ScaleLimits {
  switch (scale) {
    case 'micro':
      return {
        maxRegions: 10,
        maxMarkers: 10,
        maxPolyVertices: 12,
        maxTokens: 2800,
        halfExtentM: 6500,
        minRegionsPrompt: 5,
        maxRegionsPrompt: 10,
      }
    case 'street':
      return {
        maxRegions: 14,
        maxMarkers: 14,
        maxPolyVertices: 16,
        maxTokens: 3200,
        halfExtentM: 14000,
        minRegionsPrompt: 8,
        maxRegionsPrompt: 14,
      }
    case 'district':
      return {
        maxRegions: 22,
        maxMarkers: 20,
        maxPolyVertices: 24,
        maxTokens: 4200,
        halfExtentM: 26000,
        minRegionsPrompt: 12,
        maxRegionsPrompt: 22,
      }
    case 'city':
      return {
        maxRegions: 28,
        maxMarkers: 26,
        maxPolyVertices: 32,
        maxTokens: 5200,
        halfExtentM: 45000,
        minRegionsPrompt: 16,
        maxRegionsPrompt: 28,
      }
    case 'full':
    default:
      return {
        maxRegions: 32,
        maxMarkers: 30,
        maxPolyVertices: 40,
        maxTokens: 6000,
        halfExtentM: WORLD_MAP_UNITS / 2,
        minRegionsPrompt: 14,
        maxRegionsPrompt: 32,
      }
  }
}

function bboxForScale(scale: WorldMapAiScaleId): { x0: number; y0: number; x1: number; y1: number } {
  const W = WORLD_MAP_UNITS
  const c = W / 2
  const { halfExtentM } = limitsForScale(scale)
  const h = Math.min(halfExtentM, c)
  return { x0: c - h, y0: c - h, x1: c + h, y1: c + h }
}

function downsamplePolygonRing(points: [number, number][], maxPts: number): [number, number][] {
  if (points.length <= maxPts) return points
  const out: [number, number][] = []
  const n = points.length
  const step = (n - 1) / (maxPts - 1)
  for (let k = 0; k < maxPts; k++) {
    const idx = Math.min(n - 1, Math.round(k * step))
    const q = points[idx]
    out.push([q[0], q[1]])
  }
  return out
}

function normalizeTerrainId(raw: string, terrainIdSet: Set<string>): string {
  const s = raw.trim()
  if (!s) return 'land_plain_grass'
  if (terrainIdSet.has(s)) return s
  if (LEGACY_TERRAIN_ALIASES[s]) return LEGACY_TERRAIN_ALIASES[s]!
  return 'land_plain_grass'
}

function parseGeometry(v: unknown, maxPolyVertices: number): WorldMapRegionGeom | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const kind = o.kind === 'polygon' ? 'polygon' : o.kind === 'rect' ? 'rect' : null
  if (!kind) return null
  if (kind === 'rect') {
    const x = clampWorld(Number(o.x))
    const y = clampWorld(Number(o.y))
    const w = Math.max(200, Math.min(WORLD_MAP_UNITS, Number(o.w) || 1000))
    const h = Math.max(200, Math.min(WORLD_MAP_UNITS, Number(o.h) || 1000))
    return { kind: 'rect', x, y, w, h, r: typeof o.r === 'number' ? o.r : 0 }
  }
  const pts = Array.isArray(o.points) ? o.points : []
  const points: [number, number][] = []
  for (const p of pts) {
    if (!Array.isArray(p) || p.length < 2) continue
    points.push([clampWorld(Number(p[0])), clampWorld(Number(p[1]))])
  }
  if (points.length < 3) return null
  return { kind: 'polygon', points: downsamplePolygonRing(points, maxPolyVertices) }
}

/**
 * 根据世界背景、世界书与用户选择的范围/要素生成地图。
 */
export async function generateWorldMapWithAi(params: {
  apiConfig: ApiConfig
  worldBackgroundText: string
  worldBooksText: string
  scale: WorldMapAiScaleId
  /** 用户描述必含要素，如「一栋公寓楼、一家奶茶店」 */
  requiredElements: string
}): Promise<WorldMapData> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim()) throw new Error('未配置 AI API')

  const lim = limitsForScale(params.scale)
  const box = bboxForScale(params.scale)
  const elements = params.requiredElements.trim()

  const idSample = getAllTerrainIds().slice(0, 60).join(', ')
  const idTotal = getAllTerrainIds().length

  const system = `你是架空世界地图编辑助手。只输出一个合法 JSON 对象，不要 Markdown 围栏外多余文字。
坐标系：正方形画布边长 ${WORLD_MAP_UNITS}（单位：米），原点左上，x 向右、y 向下。
【硬性范围】所有 geometry 的坐标必须落在闭区间：x∈[${Math.round(box.x0)}, ${Math.round(box.x1)}]，y∈[${Math.round(box.y0)}, ${Math.round(box.y1)}]（米）。禁止超出。
terrainType 必须是英文 id（共 ${idTotal} 个）。示例：${idSample} …（须从目录 id 中选，禁止用中文作 terrainType）
JSON 结构：
{
  "canvasBg": { "mode": "solid"|"gradient", "solidColor": "#hex", "gradientFrom": "#hex", "gradientTo": "#hex", "gradientAngle": 0-360 },
  "regions": [
    { "terrainType": "water_nat_river", "name": "可选", "geometry": { "kind": "rect", "x", "y", "w", "h" } }
  ],
  "markers": [ { "name", "type", "description", "worldX", "worldY" } ]
}
【数量硬上限】regions 必须 ${lim.minRegionsPrompt}～${lim.maxRegionsPrompt} 个，绝对不得超过 ${lim.maxRegions} 个。markers 不超过 ${lim.maxMarkers} 个。
优先使用 kind:"rect" 的矩形；少用多边形。若用多边形，每个不得超过 8 个顶点。
不要生成 imageUrl。输出尽量紧凑。`

  const userParts = [
    `【世界背景】\n${params.worldBackgroundText.slice(0, 8000)}`,
    `【世界书摘要】\n${params.worldBooksText.slice(0, 12000) || '（无）'}`,
    `【生成范围】${WORLD_MAP_AI_SCALE_OPTIONS.find((o) => o.id === params.scale)?.label ?? params.scale}`,
    elements
      ? `【必须包含的地理/建筑要素】请用对应 terrainType 画出下列内容（可略增配套道路/绿地）：\n${elements.slice(0, 1200)}`
      : `【要素】无额外清单，请结合世界背景在范围内合理配置地貌与建筑。`,
    `请生成符合上述范围与数量限制的 JSON。`,
  ]
  const user = userParts.join('\n\n')

  const text = await openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.4, max_tokens: lim.maxTokens },
  )

  const j = parseJsonFromModel(text)
  const terrainIdSet = new Set(getAllTerrainIds())
  const regionsRaw = Array.isArray(j.regions) ? j.regions : []
  const regions: WorldMapRegion[] = []
  let zi = 1
  for (const r of regionsRaw) {
    if (regions.length >= lim.maxRegions) break
    if (!r || typeof r !== 'object') continue
    const rr = r as Record<string, unknown>
    const geom = parseGeometry(rr.geometry, lim.maxPolyVertices)
    if (!geom) continue
    const terrainType = normalizeTerrainId(String(rr.terrainType ?? ''), terrainIdSet)
    regions.push({
      id: uid('rg'),
      terrainType,
      name: typeof rr.name === 'string' ? rr.name.slice(0, 64) : '',
      zIndex: zi++,
      geometry: geom,
    })
  }

  const markersRaw = Array.isArray(j.markers) ? j.markers : []
  const markers: WorldMapMarker[] = []
  for (const m of markersRaw) {
    if (markers.length >= lim.maxMarkers) break
    if (!m || typeof m !== 'object') continue
    const mm = m as Record<string, unknown>
    const worldX = clampWorld(Number(mm.worldX))
    const worldY = clampWorld(Number(mm.worldY))
    markers.push({
      id: uid('mk'),
      name: typeof mm.name === 'string' ? mm.name.slice(0, 64) : '地点',
      type: typeof mm.type === 'string' ? mm.type : '其他',
      description: typeof mm.description === 'string' ? mm.description.slice(0, 500) : '',
      x: (worldX / WORLD_MAP_UNITS) * 100,
      y: (worldY / WORLD_MAP_UNITS) * 100,
      worldX,
      worldY,
    })
  }

  let canvasBg: WorldMapCanvasBg | undefined
  const cb = j.canvasBg
  if (cb && typeof cb === 'object') {
    const c = cb as Record<string, unknown>
    canvasBg = {
      mode: c.mode === 'gradient' ? 'gradient' : 'solid',
      solidColor: typeof c.solidColor === 'string' ? c.solidColor : '#b8dce8',
      gradientFrom: typeof c.gradientFrom === 'string' ? c.gradientFrom : '#c9e8f2',
      gradientTo: typeof c.gradientTo === 'string' ? c.gradientTo : '#e8f6fb',
      gradientAngle: typeof c.gradientAngle === 'number' ? c.gradientAngle : 135,
    }
  }

  const base = normalizeWorldMapData({
    imageUrl: '',
    markers,
    regions,
    canvasBg,
    mapSchemaVersion: 2,
    terrainColorOverrides: {},
  })

  if (!base.regions?.length) {
    const span = Math.min(box.x1 - box.x0, box.y1 - box.y0) * 0.55
    const cx = (box.x0 + box.x1) / 2
    const cy = (box.y0 + box.y1) / 2
    base.regions = [
      {
        id: uid('rg'),
        terrainType: 'land_plain_grass',
        name: '',
        zIndex: 1,
        geometry: {
          kind: 'rect',
          x: cx - span / 2,
          y: cy - span / 2,
          w: span,
          h: span * 0.85,
          r: 0,
        },
      },
    ]
  }

  return base
}

export function summarizeWorldBooksForMap(worldBooks: { name: string; enabled: boolean; items: { name: string; enabled: boolean; content: string }[] }[]): string {
  const lines: string[] = []
  for (const wb of worldBooks) {
    if (!wb.enabled) continue
    const parts: string[] = []
    for (const it of wb.items ?? []) {
      if (!it.enabled) continue
      const c = String(it.content ?? '').trim().slice(0, 600)
      if (c) parts.push(`「${it.name}」：${c}`)
    }
    if (parts.length) lines.push(`《${wb.name}》\n${parts.join('\n')}`)
  }
  return lines.join('\n\n').slice(0, 14000)
}
