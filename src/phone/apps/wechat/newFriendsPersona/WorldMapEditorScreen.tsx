import { ArrowLeft, Hand, Map as MapIcon, MapPin, Minus, Plus, Redo2, Search, Sparkles, Square, Undo2, Waypoints } from 'lucide-react'
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useCurrentApiConfig } from '../../api/ApiSettingsContext'
import type {
  MapTerrainType,
  WorldBackground,
  WorldMapCanvasBg,
  WorldMapData,
  WorldMapMarker,
  WorldMapRegion,
  WorldMapRegionGeom,
} from './types'
import { normalizeWorldMapData, WORLD_MAP_UNITS } from './types'
import { formatWorldBackgroundForPrompt } from './worldBackgroundFormat'
import {
  generateWorldMapWithAi,
  summarizeWorldBooksForMap,
  WORLD_MAP_AI_ELEMENT_SUGGESTIONS,
  WORLD_MAP_AI_SCALE_OPTIONS,
  type WorldMapAiScaleId,
} from './worldMapAi'
import { findTerrainLabel, flattenCatalogForPicker, WORLD_MAP_CATALOG } from './worldMapCatalog'
import { personaDb } from './idb'
import { getTerrainFill, isBuiltUpTerrain } from './worldMapTerrain'
import { uid } from './utils'

const C = {
  bg: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  sub: '#666666',
  faint: '#999999',
  border: '#e5e5e5',
  danger: '#ff3b30',
  accent: '#007aff',
} as const

const cardShadow = '0 1px 3px rgba(0,0,0,0.05)'

/** 画布「地貌默认色」里展示前若干类，避免列表过长 */
const TERRAIN_COLOR_OVERRIDE_ROWS = flattenCatalogForPicker().slice(0, 28)

/** 缩放系数：可大幅缩小看全貌，或放大细修；与画布大小无关 */
const MIN_ZOOM = 0.00045
const MAX_ZOOM = 320

/** 复位/进入时让整块逻辑画布（边长 WORLD_MAP_UNITS）适配视口，接近地图 App 的「全览」 */
const FIT_WORLD_PADDING = 0.9

function getFallbackViewportSize(): { vw: number; vh: number } {
  if (typeof window === 'undefined') return { vw: 380, vh: 300 }
  const vw = Math.min(window.innerWidth, 520)
  const vh = Math.min(window.innerHeight * 0.45, 520)
  return { vw: Math.max(180, vw), vh: Math.max(200, vh) }
}

function computeFitWorldView(vw: number, vh: number): { zoom: number; pan: { x: number; y: number } } {
  const W = WORLD_MAP_UNITS
  const zRaw = (Math.min(Math.max(1, vw), Math.max(1, vh)) / W) * FIT_WORLD_PADDING
  const z = clamp(zRaw, MIN_ZOOM, MAX_ZOOM)
  const cx = W / 2
  const cy = W / 2
  return { zoom: z, pan: { x: vw / 2 - cx * z, y: vh / 2 - cy * z } }
}

export const WB_MAP_MARKER_TYPES = [
  '城市',
  '山脉',
  '河流',
  '湖泊',
  '森林',
  '沙漠',
  '村庄',
  '城堡',
  '神殿',
  '战场',
  '禁地',
  '其他',
] as const

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

type EditorTool = 'view' | 'select' | 'rect' | 'poly' | 'marker'

function clientToWorld(
  clientX: number,
  clientY: number,
  viewport: HTMLElement,
  pan: { x: number; y: number },
  zoom: number,
) {
  const r = viewport.getBoundingClientRect()
  const sx = clientX - r.left
  const sy = clientY - r.top
  const wx = (sx - pan.x) / zoom
  const wy = (sy - pan.y) / zoom
  return { wx, wy }
}

/** 约定：逻辑坐标 1 单位 = 地面 1 m。世界坐标在屏幕上的长度（px）= 米数 × zoom。比例尺取合适档位使条长约 40–140px。 */
function pickScaleBar(zoom: number): { meters: number; barPx: number } {
  const candidates = [
    1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 200000,
  ]
  const inRange = candidates.filter((u) => {
    const px = u * zoom
    return px >= 40 && px <= 140
  })
  if (inRange.length) {
    let best = inRange[0]
    let bestScore = Math.abs(best * zoom - 72)
    for (const u of inRange) {
      const s = Math.abs(u * zoom - 72)
      if (s < bestScore) {
        best = u
        bestScore = s
      }
    }
    return { meters: best, barPx: best * zoom }
  }
  let u = clamp(72 / zoom, 0.5, WORLD_MAP_UNITS)
  if (u >= 100) u = Math.round(u)
  else if (u >= 10) u = Math.round(u * 10) / 10
  else u = Math.round(u * 100) / 100
  return { meters: u, barPx: u * zoom }
}

/** 用 m / km 展示长度（≥1000 m 用 km） */
function formatDistanceMeters(meters: number): string {
  const m = meters
  if (!Number.isFinite(m) || m < 0) return '0 m'
  if (m >= 1000) {
    const km = m / 1000
    if (Math.abs(km - Math.round(km)) < 1e-6) return `${Math.round(km)} km`
    if (km >= 10) return `${Math.round(km)} km`
    const rounded = Math.round(km * 10) / 10
    return `${rounded} km`
  }
  if (Math.abs(m - Math.round(m)) < 1e-6) return `${Math.round(m)} m`
  const rounded = Math.round(m * 10) / 10
  return `${rounded} m`
}

function syncMarkerPercents(m: WorldMapData): WorldMapData {
  const W = WORLD_MAP_UNITS
  return {
    ...m,
    markers: m.markers.map((mk) => {
      const wx = typeof mk.worldX === 'number' ? mk.worldX : (mk.x / 100) * W
      const wy = typeof mk.worldY === 'number' ? mk.worldY : (mk.y / 100) * W
      return {
        ...mk,
        worldX: wx,
        worldY: wy,
        x: (wx / W) * 100,
        y: (wy / W) * 100,
      }
    }),
  }
}

function deepCloneMap(m: WorldMapData): WorldMapData {
  try {
    if (typeof structuredClone !== 'undefined') return structuredClone(m)
  } catch {
    /* 极少数环境下 structuredClone 可能失败 */
  }
  return JSON.parse(JSON.stringify(m)) as WorldMapData
}

type MarkerFormState = {
  name: string
  type: string
  description: string
  x: number
  y: number
  worldX: number
  worldY: number
}

export function WorldMapEditorScreen({
  map: mapProp,
  onChange,
  onBack,
  worldBackgroundDraft,
}: {
  map: WorldMapData
  onChange: (next: WorldMapData) => void
  onBack: () => void
  /** 当前编辑的世界背景：供 AI 结合设定与世界书生成地图 */
  worldBackgroundDraft?: WorldBackground | null
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const map = useMemo(() => normalizeWorldMapData(mapProp), [mapProp])

  const fileRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldLayerRef = useRef<HTMLDivElement>(null)

  const [zoom, setZoom] = useState(() => computeFitWorldView(getFallbackViewportSize().vw, getFallbackViewportSize().vh).zoom)
  const [pan, setPan] = useState(() => {
    const { vw, vh } = getFallbackViewportSize()
    return computeFitWorldView(vw, vh).pan
  })

  const pinchRef = useRef<{ dist: number; z: number } | null>(null)
  const panRef = useRef<{ x: number; y: number } | null>(null)

  const [tool, setTool] = useState<EditorTool>('view')
  const [terrainPick, setTerrainPick] = useState<MapTerrainType>('land_plain_grass')
  const [terrainPickerOpen, setTerrainPickerOpen] = useState(false)
  const [terrainSearch, setTerrainSearch] = useState('')
  const [worldBooksText, setWorldBooksText] = useState('')
  const [mapAiBusy, setMapAiBusy] = useState(false)

  useEffect(() => {
    const wid = worldBackgroundDraft?.id?.trim()
    if (!wid) {
      setWorldBooksText('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const chars = await personaDb.listCharacters()
        const linked = chars.filter((c) => !c.generatedForCharacterId && c.worldBackgroundId === wid)
        const parts = linked.map((c) => summarizeWorldBooksForMap(c.worldBooks)).filter(Boolean)
        if (!cancelled) setWorldBooksText(parts.join('\n\n---\n\n'))
      } catch {
        if (!cancelled) setWorldBooksText('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [worldBackgroundDraft?.id])

  const initialFitDoneRef = useRef(false)
  /** 视口有有效尺寸后适配整图（flex 首帧可能为 0，用 ResizeObserver 补一次） */
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const tryFit = () => {
      if (initialFitDoneRef.current) return
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 8 || h < 8) return
      initialFitDoneRef.current = true
      const next = computeFitWorldView(w, h)
      setZoom(next.zoom)
      setPan(next.pan)
    }
    tryFit()
    const ro = new ResizeObserver(() => tryFit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [polyDraft, setPolyDraft] = useState<[number, number][] | null>(null)
  const rectDragRef = useRef<null | { sx: number; sy: number; wx0: number; wy0: number }>(null)
  const [rectPreview, setRectPreview] = useState<null | { x: number; y: number; w: number; h: number }>(null)

  const [markerModal, setMarkerModal] = useState<
    null | { mode: 'add' | 'edit'; id?: string; form: MarkerFormState }
  >(null)
  const [peekMarker, setPeekMarker] = useState<WorldMapMarker | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [bgPanelOpen, setBgPanelOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [aiGenModalOpen, setAiGenModalOpen] = useState(false)
  const [aiGenScale, setAiGenScale] = useState<WorldMapAiScaleId>('street')
  const [aiGenElements, setAiGenElements] = useState('')

  const historyPast = useRef<WorldMapData[]>([])
  const historyFuture = useRef<WorldMapData[]>([])

  const pushHistory = useCallback(() => {
    const norm = normalizeWorldMapData(map)
    historyPast.current.push(deepCloneMap(norm))
    const heavy = (norm.regions?.length ?? 0) > 22
    const cap = heavy ? 10 : 25
    while (historyPast.current.length > cap) historyPast.current.shift()
    historyFuture.current = []
  }, [map])

  const patchMap = useCallback(
    (patch: Partial<WorldMapData> | ((prev: WorldMapData) => WorldMapData), recordHistory = true) => {
      if (recordHistory) pushHistory()
      const prev = normalizeWorldMapData(map)
      const next = typeof patch === 'function' ? normalizeWorldMapData(patch(prev)) : normalizeWorldMapData({ ...prev, ...patch })
      onChange(syncMarkerPercents(next))
    },
    [map, onChange, pushHistory],
  )

  const terrainSearchHits = useMemo(() => {
    const flat = flattenCatalogForPicker()
    const q = terrainSearch.trim().toLowerCase()
    if (!q) return null
    return flat.filter((x) => x.label.toLowerCase().includes(q) || x.id.toLowerCase().includes(q))
  }, [terrainSearch])

  const runMapAi = useCallback(
    async (scale: WorldMapAiScaleId, requiredElements: string) => {
      if (!apiConfig?.apiUrl?.trim() || !apiConfig?.apiKey?.trim() || !apiConfig?.modelId?.trim()) {
        window.alert('请先在 API 设置中配置密钥与模型')
        return
      }
      setMapAiBusy(true)
      try {
        const wbText = formatWorldBackgroundForPrompt(worldBackgroundDraft ?? null)
        const generated = await generateWorldMapWithAi({
          apiConfig,
          worldBackgroundText: wbText,
          worldBooksText,
          scale,
          requiredElements,
        })
        startTransition(() => {
          try {
            patchMap((prev) => {
              const norm = normalizeWorldMapData(generated)
              return {
                ...norm,
                imageUrl: prev.imageUrl,
              }
            })
          } finally {
            setMapAiBusy(false)
          }
        })
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '生成失败')
        setMapAiBusy(false)
      }
    },
    [apiConfig, patchMap, worldBackgroundDraft, worldBooksText],
  )

  const undo = useCallback(() => {
    const snap = historyPast.current.pop()
    if (!snap) return
    historyFuture.current.push(deepCloneMap(normalizeWorldMapData(map)))
    onChange(syncMarkerPercents(normalizeWorldMapData(snap)))
  }, [map, onChange])

  const redo = useCallback(() => {
    const snap = historyFuture.current.pop()
    if (!snap) return
    historyPast.current.push(deepCloneMap(normalizeWorldMapData(map)))
    onChange(syncMarkerPercents(normalizeWorldMapData(snap)))
  }, [map, onChange])

  const resetView = () => {
    const el = viewportRef.current
    const { vw, vh } = el?.clientWidth && el?.clientHeight
      ? { vw: el.clientWidth, vh: el.clientHeight }
      : getFallbackViewportSize()
    const next = computeFitWorldView(vw, vh)
    setZoom(next.zoom)
    setPan(next.pan)
  }

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (url) patchMap({ imageUrl: url })
    }
    reader.readAsDataURL(f)
  }

  const addRegion = useCallback(
    (geometry: WorldMapRegionGeom, terrain: MapTerrainType) => {
      const r: WorldMapRegion = {
        id: uid('rg'),
        terrainType: terrain,
        name: '',
        zIndex: (map.regions?.length ?? 0) + 1,
        geometry,
      }
      patchMap((prev) => ({ ...prev, regions: [...(prev.regions ?? []), r] }))
      setSelectedRegionId(r.id)
    },
    [map.regions?.length, patchMap],
  )

  const deleteRegion = (id: string) => {
    patchMap((prev) => ({ ...prev, regions: (prev.regions ?? []).filter((x) => x.id !== id) }))
    setSelectedRegionId(null)
  }

  const openAddMarker = (worldX: number, worldY: number) => {
    const W = WORLD_MAP_UNITS
    setMarkerModal({
      mode: 'add',
      form: {
        name: '',
        type: '城市',
        description: '',
        x: (worldX / W) * 100,
        y: (worldY / W) * 100,
        worldX,
        worldY,
      },
    })
  }

  const saveMarkerModal = () => {
    if (!markerModal) return
    const { name, type, description, worldX, worldY } = markerModal.form
    if (!name.trim()) {
      window.alert('请填写标记名称')
      return
    }
    const W = WORLD_MAP_UNITS
    if (markerModal.mode === 'add') {
      const m: WorldMapMarker = {
        id: uid('mk'),
        name: name.trim(),
        type: type || '其他',
        description: description.trim(),
        x: (worldX / W) * 100,
        y: (worldY / W) * 100,
        worldX,
        worldY,
      }
      patchMap((prev) => ({ ...prev, markers: [...prev.markers, m] }))
    } else if (markerModal.id) {
      patchMap((prev) => ({
        ...prev,
        markers: prev.markers.map((mk) =>
          mk.id === markerModal.id
            ? {
                ...mk,
                name: name.trim(),
                type: type || '其他',
                description: description.trim(),
                x: (worldX / W) * 100,
                y: (worldY / W) * 100,
                worldX,
                worldY,
              }
            : mk,
        ),
      }))
    }
    setMarkerModal(null)
  }

  const deleteMarker = (id: string) => {
    patchMap((prev) => ({ ...prev, markers: prev.markers.filter((m) => m.id !== id) }))
    setPeekMarker(null)
    setMarkerModal(null)
  }

  const onTouchStartViewport = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement | null
    if (el?.closest('button') || el?.closest('[data-map-ui]')) return

    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      pinchRef.current = { dist: touchDistance(a, b), z: zoom }
      panRef.current = null
      rectDragRef.current = null
      return
    }

    if (e.touches.length === 1 && viewportRef.current) {
      const t = e.touches[0]
      const { wx, wy } = clientToWorld(t.clientX, t.clientY, viewportRef.current, pan, zoom)

      if (tool === 'view') {
        panRef.current = { x: t.clientX - pan.x, y: t.clientY - pan.y }
        return
      }

      if (tool === 'marker') {
        openAddMarker(wx, wy)
        return
      }

      if (tool === 'select') {
        const regs = [...(map.regions ?? [])].sort((a, b) => b.zIndex - a.zIndex)
        let hit: string | null = null
        for (const r of regs) {
          if (pointInRegion(wx, wy, r.geometry)) {
            hit = r.id
            break
          }
        }
        setSelectedRegionId(hit)
        if (!hit) {
          const mkHit = map.markers.find((m) => {
            const mwx = m.worldX ?? (m.x / 100) * WORLD_MAP_UNITS
            const mwy = m.worldY ?? (m.y / 100) * WORLD_MAP_UNITS
            return Math.hypot(mwx - wx, mwy - wy) < 28 / zoom
          })
          if (mkHit) setPeekMarker(mkHit)
        }
        return
      }

      if (tool === 'rect') {
        rectDragRef.current = { sx: t.clientX, sy: t.clientY, wx0: wx, wy0: wy }
        setRectPreview({ x: wx, y: wy, w: 0, h: 0 })
        return
      }

      if (tool === 'poly') {
        setPolyDraft((prev) => [...(prev ?? []), [wx, wy]])
      }
    }
  }

  const onTouchMoveViewport = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement | null
    if (el?.closest('button') || el?.closest('[data-map-ui]')) return

    if (e.touches.length === 2 && pinchRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const d = touchDistance(a, b)
      const ratio = d / Math.max(pinchRef.current.dist, 1)
      const nextZ = clamp(pinchRef.current.z * ratio, MIN_ZOOM, MAX_ZOOM)
      setZoom(nextZ)
      return
    }

    if (e.touches.length === 1 && panRef.current && tool === 'view') {
      const t = e.touches[0]
      setPan({
        x: t.clientX - panRef.current.x,
        y: t.clientY - panRef.current.y,
      })
    }

    if (e.touches.length === 1 && rectDragRef.current && viewportRef.current && tool === 'rect') {
      const t = e.touches[0]
      const { wx, wy } = clientToWorld(t.clientX, t.clientY, viewportRef.current, pan, zoom)
      const { wx0, wy0 } = rectDragRef.current
      const x = Math.min(wx0, wx)
      const y = Math.min(wy0, wy)
      const w = Math.abs(wx - wx0)
      const h = Math.abs(wy - wy0)
      setRectPreview({ x, y, w, h })
    }
  }

  const onTouchEndViewport = () => {
    if (rectDragRef.current && rectPreview && rectPreview.w >= 6 && rectPreview.h >= 6) {
      addRegion(
        { kind: 'rect', x: rectPreview.x, y: rectPreview.y, w: rectPreview.w, h: rectPreview.h, r: 2 },
        terrainPick,
      )
    }
    rectDragRef.current = null
    setRectPreview(null)
    pinchRef.current = null
    panRef.current = null
  }

  const finishPoly = () => {
    if (!polyDraft || polyDraft.length < 3) {
      window.alert('至少点击三个点构成多边形')
      return
    }
    addRegion({ kind: 'polygon', points: polyDraft }, terrainPick)
    setPolyDraft(null)
  }

  const cancelPoly = () => setPolyDraft(null)

  const canvasBg = map.canvasBg ?? { mode: 'solid' as const, solidColor: '#b8dce8', gradientFrom: '#c9e8f2', gradientTo: '#e8f6fb', gradientAngle: 135 }

  /** 视口铺满同色/渐变：缩放过小时逻辑画布只占屏幕中间一块，周围不再露灰色底 */
  const viewportCanvasBgStyle = useMemo(() => {
    if (canvasBg.mode === 'gradient') {
      return {
        background: `linear-gradient(${canvasBg.gradientAngle}deg, ${canvasBg.gradientFrom}, ${canvasBg.gradientTo})`,
      } as React.CSSProperties
    }
    return { background: canvasBg.solidColor } as React.CSSProperties
  }, [canvasBg])

  const sortedRegions = useMemo(
    () => [...(map.regions ?? [])].sort((a, b) => a.zIndex - b.zIndex),
    [map.regions],
  )

  const minimapScale = 72 / WORLD_MAP_UNITS
  const viewW = viewportRef.current?.clientWidth ?? 300
  const viewH = viewportRef.current?.clientHeight ?? 300
  const visX = -pan.x / zoom
  const visY = -pan.y / zoom
  const visW = viewW / zoom
  const visH = viewH / zoom

  const scaleBar = useMemo(() => pickScaleBar(zoom), [zoom])

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.bg }}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

      <header
        className="grid shrink-0 grid-cols-[40px_1fr_auto] items-center gap-2 border-b px-4 pb-3"
        style={{
          borderColor: C.border,
          background: C.bg,
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out hover:bg-black/5"
          aria-label="返回"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" style={{ color: C.text }} strokeWidth={2} />
        </button>
        <h1 className="min-w-0 truncate text-center text-[18px] font-bold" style={{ color: C.text }}>
          世界地图
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-full p-2 transition-opacity hover:opacity-70"
            aria-label="撤销"
            onClick={undo}
          >
            <Undo2 className="size-5" style={{ color: C.text }} />
          </button>
          <button
            type="button"
            className="rounded-full p-2 transition-opacity hover:opacity-70"
            aria-label="重做"
            onClick={redo}
          >
            <Redo2 className="size-5" style={{ color: C.text }} />
          </button>
        </div>
      </header>

      <div className="mx-4 mt-3 flex shrink-0 flex-wrap gap-2" data-map-ui>
        <ToolBtn active={tool === 'view'} label="浏览" icon={<Hand className="size-4" />} onClick={() => setTool('view')} />
        <ToolBtn active={tool === 'select'} label="选择" icon={<MapIcon className="size-4" />} onClick={() => setTool('select')} />
        <ToolBtn active={tool === 'rect'} label="矩形" icon={<Square className="size-4" />} onClick={() => setTool('rect')} />
        <ToolBtn active={tool === 'poly'} label="多边形" icon={<Waypoints className="size-4" />} onClick={() => setTool('poly')} />
        <ToolBtn active={tool === 'marker'} label="标记" icon={<MapPin className="size-4" />} onClick={() => setTool('marker')} />
      </div>

      <div className="mx-4 mt-2 min-h-0 flex-1 flex flex-col gap-2">
        <div className="flex shrink-0 flex-col gap-2" data-map-ui>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[12px] border bg-white px-3 py-2.5 text-left text-[13px] font-medium"
            style={{ borderColor: C.border, color: C.text }}
            onClick={() => {
              setTerrainSearch('')
              setTerrainPickerOpen(true)
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ background: getTerrainFill(map, terrainPick) }}
              />
              <span className="truncate">当前地貌：{findTerrainLabel(terrainPick)}</span>
            </span>
            <span className="shrink-0 text-[12px]" style={{ color: C.sub }}>
              选择
            </span>
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2" data-map-ui>
          <button
            type="button"
            className="rounded-[10px] border bg-white px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: C.border, color: C.text }}
            onClick={() => fileRef.current?.click()}
          >
            叠加图片
          </button>
          <button
            type="button"
            className="rounded-[10px] border bg-white px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: C.border, color: C.text }}
            onClick={() => setBgPanelOpen(true)}
          >
            画布底色
          </button>
          <button
            type="button"
            className="rounded-[10px] border bg-white px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: C.border, color: C.text }}
            onClick={() => setLegendOpen(true)}
          >
            图例
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-[10px] border bg-white px-3 py-2 text-[13px] font-medium disabled:opacity-50"
            style={{ borderColor: C.border, color: C.text }}
            disabled={mapAiBusy}
            onClick={() => setAiGenModalOpen(true)}
          >
            <Sparkles className="size-5" style={{ color: C.accent }} strokeWidth={2} />
            {mapAiBusy ? '生成中…' : 'AI 生成地图'}
          </button>
          <button
            type="button"
            className="rounded-[10px] border bg-white px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: C.border, color: C.text }}
            onClick={resetView}
          >
            全图适配
          </button>
          <div className="flex items-center gap-1 rounded-[10px] border bg-white px-2 py-1" style={{ borderColor: C.border }}>
            <button
              type="button"
              className="p-1.5"
              aria-label="缩小"
              onClick={() => setZoom((z) => clamp(z / 1.12, MIN_ZOOM, MAX_ZOOM))}
            >
              <Minus className="size-4" style={{ color: C.text }} />
            </button>
            <span className="min-w-[48px] text-center text-[11px] tabular-nums" style={{ color: C.sub }}>
              {zoom >= 0.01 ? `${Math.round(zoom * 100)}%` : `${zoom.toFixed(4)}×`}
            </span>
            <button
              type="button"
              className="p-1.5"
              aria-label="放大"
              onClick={() => setZoom((z) => clamp(z * 1.12, MIN_ZOOM, MAX_ZOOM))}
            >
              <Plus className="size-4" style={{ color: C.text }} />
            </button>
          </div>
        </div>

        {tool === 'poly' && (
          <div className="flex shrink-0 gap-2" data-map-ui>
            <button
              type="button"
              className="flex-1 rounded-[10px] py-2.5 text-[14px] font-semibold text-white"
              style={{ background: C.accent }}
              onClick={finishPoly}
            >
              闭合多边形（{polyDraft?.length ?? 0} 点）
            </button>
            <button
              type="button"
              className="rounded-[10px] border px-4 py-2.5 text-[14px] font-medium"
              style={{ borderColor: C.border, color: C.text }}
              onClick={cancelPoly}
            >
              取消
            </button>
          </div>
        )}

        <div
          ref={viewportRef}
          className="relative min-h-[280px] flex-1 touch-none select-none overflow-hidden rounded-[12px] border"
          style={{ borderColor: C.border, boxShadow: cardShadow, ...viewportCanvasBgStyle }}
          onTouchStart={onTouchStartViewport}
          onTouchMove={onTouchMoveViewport}
          onTouchEnd={onTouchEndViewport}
          onTouchCancel={onTouchEndViewport}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            ref={worldLayerRef}
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              width: WORLD_MAP_UNITS,
              height: WORLD_MAP_UNITS,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            {/* 底色层 */}
            <div
              className="absolute left-0 top-0"
              style={{
                width: WORLD_MAP_UNITS,
                height: WORLD_MAP_UNITS,
                ...(canvasBg.mode === 'gradient'
                  ? {
                      background: `linear-gradient(${canvasBg.gradientAngle}deg, ${canvasBg.gradientFrom}, ${canvasBg.gradientTo})`,
                    }
                  : { background: canvasBg.solidColor }),
              }}
            />

            {map.imageUrl ? (
              <img
                src={map.imageUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 opacity-90"
                style={{ width: WORLD_MAP_UNITS, height: WORLD_MAP_UNITS, objectFit: 'cover' }}
              />
            ) : null}

            <svg
              className="absolute left-0 top-0 pointer-events-none"
              width={WORLD_MAP_UNITS}
              height={WORLD_MAP_UNITS}
              style={{ overflow: 'visible' }}
            >
              {sortedRegions.map((r) => {
                const fill = r.colorOverride?.trim() || getTerrainFill(map, r.terrainType)
                const stroke = isBuiltUpTerrain(r.terrainType) ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)'
                const sel = r.id === selectedRegionId
                if (r.geometry.kind === 'rect') {
                  const g = r.geometry
                  return (
                    <rect
                      key={r.id}
                      x={g.x}
                      y={g.y}
                      width={g.w}
                      height={g.h}
                      rx={g.r ?? 0}
                      fill={fill}
                      fillOpacity={0.82}
                      stroke={sel ? C.accent : stroke}
                      strokeWidth={sel ? 3 / zoom : 1.5 / zoom}
                    />
                  )
                }
                const pts = r.geometry.points.map((p) => p.join(',')).join(' ')
                return (
                  <polygon
                    key={r.id}
                    points={pts}
                    fill={fill}
                    fillOpacity={0.82}
                    stroke={sel ? C.accent : stroke}
                    strokeWidth={sel ? 3 / zoom : 1.5 / zoom}
                  />
                )
              })}
              {rectPreview && rectPreview.w > 0 && rectPreview.h > 0 ? (
                <rect
                  x={rectPreview.x}
                  y={rectPreview.y}
                  width={rectPreview.w}
                  height={rectPreview.h}
                  fill="rgba(0,122,255,0.15)"
                  stroke={C.accent}
                  strokeWidth={2 / zoom}
                  strokeDasharray="6 4"
                />
              ) : null}
              {polyDraft && polyDraft.length > 0 ? (
                <polyline
                  points={polyDraft.map((p) => p.join(',')).join(' ')}
                  fill="none"
                  stroke={C.accent}
                  strokeWidth={2 / zoom}
                  strokeDasharray="4 3"
                />
              ) : null}
              {polyDraft && polyDraft.length > 0
                ? polyDraft.map((p, i) => (
                    <circle key={`pd-${i}`} cx={p[0]} cy={p[1]} r={5 / zoom} fill={C.accent} />
                  ))
                : null}
            </svg>

            {map.markers.map((mk, idx) => {
              const mwx = mk.worldX ?? (mk.x / 100) * WORLD_MAP_UNITS
              const mwy = mk.worldY ?? (mk.y / 100) * WORLD_MAP_UNITS
              return (
                <button
                  key={mk.id}
                  type="button"
                  className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-md"
                  style={{ left: mwx, top: mwy, background: C.text, zIndex: 50 }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPeekMarker(mk)
                  }}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>

          {/* 比例尺：1 逻辑单位 = 1 m，条长 = 米数 × zoom（px） */}
          <div
            className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg border bg-white/95 px-2.5 py-1.5 shadow"
            style={{ borderColor: C.border, maxWidth: 'min(92vw, 200px)' }}
            data-map-ui
          >
            <p className="mb-1 text-[9px] font-medium uppercase tracking-wide" style={{ color: C.faint }}>
              比例尺
            </p>
            <div className="flex flex-col items-stretch gap-1">
              <div className="relative" style={{ width: scaleBar.barPx, minWidth: 24 }}>
                <div className="h-[3px] rounded-[1px]" style={{ background: C.text, width: '100%' }} />
                <div
                  className="absolute bottom-0 left-0 w-px"
                  style={{ height: 8, background: C.text }}
                />
                <div
                  className="absolute bottom-0 right-0 w-px"
                  style={{ height: 8, background: C.text }}
                />
              </div>
              <p className="text-[11px] font-semibold tabular-nums leading-tight" style={{ color: C.text }}>
                {formatDistanceMeters(scaleBar.meters)}
              </p>
              <p className="text-[9px] leading-snug" style={{ color: C.sub }}>
                画布边长 {formatDistanceMeters(WORLD_MAP_UNITS)} × {formatDistanceMeters(WORLD_MAP_UNITS)}
              </p>
            </div>
          </div>

          {/* 小地图 */}
          <div
            className="pointer-events-none absolute bottom-2 right-2 z-10 overflow-hidden rounded-lg border bg-white/95 shadow"
            style={{ width: 76, height: 76, borderColor: C.border }}
            data-map-ui
          >
            <div className="relative h-full w-full bg-neutral-100">
              <div
                className="absolute border-2 border-[#007aff] bg-blue-500/10"
                style={{
                  left: visX * minimapScale,
                  top: visY * minimapScale,
                  width: Math.min(76, visW * minimapScale),
                  height: Math.min(76, visH * minimapScale),
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 pb-2" data-map-ui>
          <button
            type="button"
            className="rounded-[10px] border bg-white px-3 py-2 text-[13px]"
            style={{ borderColor: C.border, color: C.text }}
            onClick={() => openAddMarker(WORLD_MAP_UNITS * 0.5, WORLD_MAP_UNITS * 0.45)}
          >
            添加标记
          </button>
          {selectedRegionId ? (
            <button
              type="button"
              className="rounded-[10px] border px-3 py-2 text-[13px] font-medium"
              style={{ borderColor: C.danger, color: C.danger }}
              onClick={() => deleteRegion(selectedRegionId)}
            >
              删除选中板块
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-[10px] border bg-white px-3 py-2 text-[13px]"
            style={{ borderColor: C.border, color: C.sub }}
            onClick={() => (map.markers.length || (map.regions ?? []).length ? setClearOpen(true) : undefined)}
          >
            清空地图内容
          </button>
        </div>
      </div>

      {bgPanelOpen ? (
        <BgPanel
          map={map}
          onClose={() => setBgPanelOpen(false)}
          onApply={(nextBg, overrides) => {
            patchMap({ canvasBg: nextBg, terrainColorOverrides: overrides })
            setBgPanelOpen(false)
          }}
        />
      ) : null}

      {legendOpen ? (
        <LegendModal map={map} onClose={() => setLegendOpen(false)} />
      ) : null}

      {terrainPickerOpen ? (
        <div
          className="fixed inset-0 z-[1400] flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setTerrainPickerOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-[440px] flex-col rounded-t-[16px] bg-white sm:rounded-[16px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b p-4" style={{ borderColor: C.border }}>
              <p className="text-[17px] font-bold" style={{ color: C.text }}>
                选择地貌类型
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border px-3 py-2" style={{ borderColor: C.border }}>
                <Search className="size-4 shrink-0" style={{ color: C.sub }} strokeWidth={2} />
                <input
                  value={terrainSearch}
                  onChange={(e) => setTerrainSearch(e.target.value)}
                  placeholder="搜索名称或 id…"
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                  style={{ color: C.text }}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-2 [scrollbar-width:thin]">
              {terrainSearchHits && terrainSearchHits.length === 0 ? (
                <p className="py-8 text-center text-[14px]" style={{ color: C.sub }}>
                  无匹配项
                </p>
              ) : terrainSearchHits ? (
                <div className="flex flex-wrap gap-2">
                  {terrainSearchHits.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]"
                      style={{ borderColor: terrainPick === it.id ? C.accent : C.border, background: terrainPick === it.id ? 'rgba(0,122,255,0.06)' : C.card }}
                      onClick={() => {
                        setTerrainPick(it.id)
                        setTerrainPickerOpen(false)
                      }}
                    >
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: getTerrainFill(map, it.id) }} />
                      {it.label}
                    </button>
                  ))}
                </div>
              ) : (
                WORLD_MAP_CATALOG.map((sec) => (
                  <div key={sec.title} className="mb-4">
                    <p className="sticky top-0 z-[1] bg-white py-2 text-[14px] font-semibold" style={{ color: C.text }}>
                      {sec.title}
                    </p>
                    {sec.groups.map((g) => (
                      <div key={`${sec.title}-${g.title}`} className="mb-3">
                        <p className="mb-2 text-[12px] font-medium" style={{ color: C.sub }}>
                          {g.title}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {g.items.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px]"
                              style={{
                                borderColor: terrainPick === it.id ? C.accent : C.border,
                                background: terrainPick === it.id ? 'rgba(0,122,255,0.06)' : C.card,
                              }}
                              onClick={() => {
                                setTerrainPick(it.id)
                                setTerrainPickerOpen(false)
                              }}
                            >
                              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: getTerrainFill(map, it.id) }} />
                              {it.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="shrink-0 border-t p-4" style={{ borderColor: C.border }}>
              <button
                type="button"
                className="w-full rounded-[12px] border py-3 text-[14px] font-medium"
                style={{ borderColor: C.border, color: C.text }}
                onClick={() => setTerrainPickerOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aiGenModalOpen ? (
        <div
          className="fixed inset-0 z-[1410] flex items-end justify-center px-3 pb-6 sm:items-center sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            if (!mapAiBusy) setAiGenModalOpen(false)
          }}
        >
          <div
            className="max-h-[86vh] w-full max-w-[420px] overflow-y-auto rounded-t-[16px] border bg-white p-5 sm:max-h-[90vh] sm:rounded-[16px]"
            style={{ borderColor: C.border, boxShadow: cardShadow }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-bold" style={{ color: C.text }}>
              AI 生成地图
            </p>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: C.sub }}>
              请先选择要生成的地面范围；范围越小、板块越少，手机越不容易卡顿或闪退。再填写希望出现的建筑或地貌（可空）。
            </p>

            <p className="mt-4 text-[13px] font-semibold" style={{ color: C.text }}>
              比例尺 / 覆盖范围
            </p>
            <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="生成范围">
              {WORLD_MAP_AI_SCALE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer gap-3 rounded-[12px] border p-3"
                  style={{
                    borderColor: aiGenScale === opt.id ? C.accent : C.border,
                    background: aiGenScale === opt.id ? 'rgba(0,122,255,0.06)' : C.card,
                  }}
                >
                  <input
                    type="radio"
                    name="ai-map-scale"
                    className="mt-1 shrink-0"
                    checked={aiGenScale === opt.id}
                    onChange={() => setAiGenScale(opt.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium" style={{ color: C.text }}>
                      {opt.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: C.sub }}>
                      {opt.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <p className="mt-5 text-[13px] font-semibold" style={{ color: C.text }}>
              希望包含的要素（选填）
            </p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.sub }}>
              用口语列举即可，例如：一栋公寓楼、一家奶茶店、东南角有一条河。模型会尽量用对应地貌类型画出来。
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WORLD_MAP_AI_ELEMENT_SUGGESTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="rounded-full border px-2.5 py-1 text-[11px] transition-opacity hover:opacity-80"
                  style={{ borderColor: C.border, color: C.sub }}
                  onClick={() =>
                    setAiGenElements((s) => {
                      const t = s.trim()
                      return t ? `${t}、${tag}` : tag
                    })
                  }
                >
                  +{tag}
                </button>
              ))}
            </div>
            <textarea
              value={aiGenElements}
              onChange={(e) => setAiGenElements(e.target.value)}
              placeholder="例：高层公寓一栋、奶茶店、社区公园、北侧主干道……"
              rows={4}
              maxLength={1200}
              className="mt-2 w-full resize-none rounded-[12px] border px-3 py-2.5 text-[14px] outline-none"
              style={{ borderColor: C.border, color: C.text }}
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-3 text-[14px] font-medium"
                style={{ borderColor: C.border, color: C.text }}
                disabled={mapAiBusy}
                onClick={() => setAiGenModalOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                style={{ background: C.accent }}
                disabled={mapAiBusy}
                onClick={() => {
                  const sc = aiGenScale
                  const el = aiGenElements
                  setAiGenModalOpen(false)
                  void runMapAi(sc, el)
                }}
              >
                开始生成
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {peekMarker ? (
        <div
          className="fixed inset-0 z-[1400] flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPeekMarker(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-t-[16px] border bg-white p-5 sm:rounded-[16px]"
            style={{ borderColor: C.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold" style={{ color: C.text }}>
              {peekMarker.name || '未命名标记'}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: C.sub }}>
              {peekMarker.type}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: C.sub }}>
              {peekMarker.description?.trim() ? peekMarker.description : '暂无描述'}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-3 text-[14px] font-medium transition-all duration-200 ease-out"
                style={{ borderColor: C.text, color: C.text }}
                onClick={() => {
                  setPeekMarker(null)
                  const m = peekMarker
                  const W = WORLD_MAP_UNITS
                  setMarkerModal({
                    mode: 'edit',
                    id: m.id,
                    form: {
                      name: m.name,
                      type: m.type,
                      description: m.description,
                      x: m.x,
                      y: m.y,
                      worldX: m.worldX ?? (m.x / 100) * W,
                      worldY: m.worldY ?? (m.y / 100) * W,
                    },
                  })
                }}
              >
                编辑
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: C.danger }}
                onClick={() => deleteMarker(peekMarker.id)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {markerModal ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[400px] rounded-[16px] bg-white p-5">
            <p className="text-center text-[18px] font-bold" style={{ color: C.text }}>
              {markerModal.mode === 'add' ? '添加标记点' : '编辑标记点'}
            </p>
            <label className="mt-5 block">
              <span className="text-[12px]" style={{ color: C.sub }}>
                标记名称
              </span>
              <input
                value={markerModal.form.name}
                onChange={(e) =>
                  setMarkerModal((m) => (m ? { ...m, form: { ...m.form, name: e.target.value } } : m))
                }
                placeholder="请输入标记名称"
                className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none"
                style={{ borderColor: C.border, color: C.text }}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[12px]" style={{ color: C.sub }}>
                标记类型
              </span>
              <select
                value={markerModal.form.type}
                onChange={(e) =>
                  setMarkerModal((m) => (m ? { ...m, form: { ...m.form, type: e.target.value } } : m))
                }
                className="mt-1 w-full rounded-[12px] border bg-white px-4 py-3 text-[15px] outline-none"
                style={{ borderColor: C.border, color: C.text }}
              >
                {WB_MAP_MARKER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[12px]" style={{ color: C.sub }}>
                标记描述
              </span>
              <textarea
                value={markerModal.form.description}
                onChange={(e) =>
                  setMarkerModal((m) => (m ? { ...m, form: { ...m.form, description: e.target.value } } : m))
                }
                placeholder="请输入标记描述"
                rows={3}
                className="mt-1 min-h-[80px] w-full resize-none rounded-[12px] border bg-white px-4 py-3 text-[14px] outline-none"
                style={{ borderColor: C.border, color: C.text }}
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-3 text-[14px] font-medium transition-all duration-200 ease-out"
                style={{ borderColor: C.text, color: C.text }}
                onClick={() => setMarkerModal(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: C.text }}
                onClick={saveMarkerModal}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clearOpen ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-[350px] rounded-[16px] bg-white p-5">
            <p className="text-center text-[18px] font-bold" style={{ color: C.text }}>
              确认清空
            </p>
            <p className="mt-4 text-center text-[16px] leading-relaxed" style={{ color: C.sub }}>
              清空所有地貌板块、标记与叠加图（底色保留）？
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[12px] border py-3 text-[14px] font-medium transition-all duration-200 ease-out"
                style={{ borderColor: C.text, color: C.text }}
                onClick={() => setClearOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white transition-all duration-200 ease-out"
                style={{ background: C.danger }}
                onClick={() => {
                  const base = normalizeWorldMapData(map)
                  patchMap({
                    imageUrl: '',
                    markers: [],
                    regions: [],
                    canvasBg: base.canvasBg,
                    terrainColorOverrides: {},
                  })
                  setClearOpen(false)
                  setSelectedRegionId(null)
                }}
              >
                清空
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ToolBtn({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium"
      style={{
        borderColor: active ? C.accent : C.border,
        background: active ? 'rgba(0,122,255,0.1)' : C.card,
        color: C.text,
      }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}

function pointInRegion(wx: number, wy: number, g: WorldMapRegionGeom): boolean {
  if (g.kind === 'rect') {
    return wx >= g.x && wx <= g.x + g.w && wy >= g.y && wy <= g.y + g.h
  }
  return pointInPolygon(wx, wy, g.points)
}

function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function BgPanel({
  map,
  onClose,
  onApply,
}: {
  map: WorldMapData
  onClose: () => void
  onApply: (canvasBg: WorldMapCanvasBg, overrides: Partial<Record<MapTerrainType, string>>) => void
}) {
  const canvasBg = map.canvasBg ?? {
    mode: 'solid' as const,
    solidColor: '#b8dce8',
    gradientFrom: '#c9e8f2',
    gradientTo: '#e8f6fb',
    gradientAngle: 135,
  }
  const [mode, setMode] = useState(canvasBg.mode)
  const [solid, setSolid] = useState(canvasBg.solidColor)
  const [gf, setGf] = useState(canvasBg.gradientFrom)
  const [gt, setGt] = useState(canvasBg.gradientTo)
  const [ga, setGa] = useState(canvasBg.gradientAngle)
  const [localOverrides, setLocalOverrides] = useState<Partial<Record<MapTerrainType, string>>>(() => ({
    ...map.terrainColorOverrides,
  }))

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="max-h-[85vh] w-full max-w-[420px] overflow-y-auto rounded-t-[16px] bg-white p-5 sm:rounded-[16px]">
        <p className="text-[17px] font-bold" style={{ color: C.text }}>
          画布底色
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-[10px] border py-2 text-[14px]"
            style={{ borderColor: C.border, background: mode === 'solid' ? 'rgba(0,122,255,0.08)' : 'white' }}
            onClick={() => setMode('solid')}
          >
            纯色
          </button>
          <button
            type="button"
            className="flex-1 rounded-[10px] border py-2 text-[14px]"
            style={{ borderColor: C.border, background: mode === 'gradient' ? 'rgba(0,122,255,0.08)' : 'white' }}
            onClick={() => setMode('gradient')}
          >
            渐变
          </button>
        </div>
        {mode === 'solid' ? (
          <label className="mt-4 block">
            <span className="text-[12px]" style={{ color: C.sub }}>
              颜色
            </span>
            <div className="mt-1 flex items-center gap-3">
              <input type="color" value={solid} onChange={(e) => setSolid(e.target.value)} className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0" />
              <input
                value={solid}
                onChange={(e) => setSolid(e.target.value)}
                className="flex-1 rounded-[10px] border px-3 py-2 font-mono text-[14px]"
                style={{ borderColor: C.border }}
              />
            </div>
          </label>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="text-[12px]">起点色</span>
              <input type="color" value={gf} onChange={(e) => setGf(e.target.value)} className="mt-1 h-10 w-full" />
            </label>
            <label className="mt-3 block">
              <span className="text-[12px]">终点色</span>
              <input type="color" value={gt} onChange={(e) => setGt(e.target.value)} className="mt-1 h-10 w-full" />
            </label>
            <label className="mt-3 block">
              <span className="text-[12px]">角度 {ga}°</span>
              <input type="range" min={0} max={360} value={ga} onChange={(e) => setGa(Number(e.target.value))} className="mt-1 w-full" />
            </label>
          </>
        )}

        <p className="mt-6 text-[15px] font-semibold" style={{ color: C.text }}>
          地貌默认色覆盖
        </p>
        <p className="mt-1 text-[12px]" style={{ color: C.sub }}>
          聚落/建筑类会自动使用偏暖或强调色；也可单独改色。
        </p>
        <div className="mt-3 max-h-[200px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {TERRAIN_COLOR_OVERRIDE_ROWS.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: C.sub }} title={p.id}>
                {p.label}
              </span>
              <input
                type="color"
                value={getTerrainFill({ ...map, terrainColorOverrides: localOverrides }, p.id)}
                onChange={(e) =>
                  setLocalOverrides((o) => ({
                    ...o,
                    [p.id]: e.target.value,
                  }))
                }
                className="h-9 w-12 shrink-0 cursor-pointer rounded border-0 p-0"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" className="flex-1 rounded-[12px] border py-3 text-[14px] font-medium" style={{ borderColor: C.border }} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="flex-1 rounded-[12px] py-3 text-[14px] font-semibold text-white"
            style={{ background: C.text }}
            onClick={() =>
              onApply(
                mode === 'solid'
                  ? { mode: 'solid', solidColor: solid, gradientFrom: gf, gradientTo: gt, gradientAngle: ga }
                  : { mode: 'gradient', solidColor: solid, gradientFrom: gf, gradientTo: gt, gradientAngle: ga },
                localOverrides,
              )
            }
          >
            应用
          </button>
        </div>
      </div>
    </div>
  )
}

function LegendModal({ map, onClose }: { map: WorldMapData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-[400px] overflow-y-auto rounded-[16px] bg-white p-5 [scrollbar-width:thin]" onClick={(e) => e.stopPropagation()}>
        <p className="text-[17px] font-bold" style={{ color: C.text }}>
          地貌图例
        </p>
        <p className="mt-1 text-[12px]" style={{ color: C.sub }}>
          按大类浏览；实际填色以画布中板块为准。
        </p>
        <div className="mt-4 space-y-4">
          {WORLD_MAP_CATALOG.map((sec) => (
            <div key={sec.title}>
              <p className="text-[13px] font-semibold" style={{ color: C.text }}>
                {sec.title}
              </p>
              {sec.groups.map((g) => (
                <div key={`${sec.title}-${g.title}`} className="mt-2">
                  <p className="mb-1.5 text-[11px] font-medium" style={{ color: C.sub }}>
                    {g.title}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {g.items.map((p) => (
                      <div key={p.id} className="flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px]" style={{ borderColor: C.border }}>
                        <span className="size-3 shrink-0 rounded-sm" style={{ background: getTerrainFill(map, p.id) }} />
                        <span className="truncate">{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="mt-5 w-full rounded-[12px] border py-3 text-[14px]" style={{ borderColor: C.border }} onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
