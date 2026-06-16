import { GitBranch, Move, RotateCcw } from 'lucide-react'
import { PERSONA_COACH_TARGET_ATTR } from '../../../memory/memoryCoachTypes'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { uid } from '../../utils'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import {
  edgeVisibleToAnchor,
  graphRelationLabel,
  neighborNodeKeysForGraphFocus,
  connectedNodeKeysFromEdges,
  nodeKey,
  parseNodeKey,
} from './crossBindingEngine'
import type { CrossBindingStore } from './useCrossBindingStore'
import type {
  CrossBindingGraphLayoutSnapshot,
  CrossBindingNode,
  RelationshipEdge,
} from './crossBindingTypes'
import { buildCrossBindingGraphLayoutSnapshot } from './crossBindingGraphLayout'

type NodePos = { x: number; y: number }

const DRAG_THRESHOLD_PX = 8
const NODE_SNAP_RADIUS = 52
const NODE_RELEASE_SNAP_RADIUS = 72
const MIN_NODE_SEPARATION = 92
const MIN_VIEWPORT_ZOOM = 0.35
const MAX_VIEWPORT_ZOOM = 2.5
const VIEWPORT_GRID_SIZE = 20

function refineGraphLayoutSpacing(
  layout: Record<string, NodePos>,
  w: number,
  h: number,
  minDist = MIN_NODE_SEPARATION,
): Record<string, NodePos> {
  const keys = Object.keys(layout)
  if (keys.length < 2) return layout
  const out: Record<string, NodePos> = {}
  for (const key of keys) {
    out[key] = { ...layout[key]! }
  }
  const pad = 52
  for (let iter = 0; iter < 48; iter++) {
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const ki = keys[i]!
        const kj = keys[j]!
        const a = out[ki]!
        const b = out[kj]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 1
        if (d >= minDist) continue
        const push = (minDist - d) / 2
        const nx = dx / d
        const ny = dy / d
        out[ki] = { x: a.x - nx * push, y: a.y - ny * push }
        out[kj] = { x: b.x + nx * push, y: b.y + ny * push }
      }
    }
  }
  for (const key of keys) {
    out[key] = {
      x: Math.min(w - pad, Math.max(pad, out[key]!.x)),
      y: Math.min(h - pad, Math.max(pad, out[key]!.y)),
    }
  }
  return out
}
/** 关系词标签沿连线可移动区间（避免压住两端头像） */
const LABEL_ALONG_MIN = 0.1
const LABEL_ALONG_MAX = 0.9

function clampLabelAlong(t: number): number {
  return Math.min(LABEL_ALONG_MAX, Math.max(LABEL_ALONG_MIN, t))
}

function pointOnEdge(s: NodePos, t: NodePos, along: number): NodePos {
  const a = clampLabelAlong(along)
  return { x: s.x + (t.x - s.x) * a, y: s.y + (t.y - s.y) * a }
}

/** 将触点投影到连线段，返回沿线的参数 t∈[0,1] */
function projectPointOntoEdgeSegment(p: NodePos, start: NodePos, end: NodePos): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return 0.5
  return clampLabelAlong(((p.x - start.x) * dx + (p.y - start.y) * dy) / len2)
}

const GRAPH_NO_SELECT_STYLE: CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
  WebkitTouchCallout: 'none',
  touchAction: 'none',
}

function clearDocumentSelection() {
  try {
    window.getSelection?.()?.removeAllRanges?.()
  } catch {
    /* ignore */
  }
}

function clampViewportZoom(zoom: number): number {
  return Math.min(MAX_VIEWPORT_ZOOM, Math.max(MIN_VIEWPORT_ZOOM, zoom))
}

function touchPairDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function touchPairCenterViewport(a: Touch, b: Touch, rect: DOMRect): NodePos {
  return {
    x: (a.clientX + b.clientX) / 2 - rect.left,
    y: (a.clientY + b.clientY) / 2 - rect.top,
  }
}

function layoutNodes(nodes: CrossBindingNode[], w: number, h: number): Record<string, NodePos> {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * (nodes.length > 8 ? 0.36 : 0.32)
  const out: Record<string, NodePos> = {}
  nodes.forEach((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2
    out[nodeKey(n.type, n.id)] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
  return refineGraphLayoutSpacing(out, w, h)
}

/** 聚焦视角：中心 + 邻居均匀绕圈，避免沿用全景坐标导致标签堆叠 */
function layoutFocusNeighborhood(
  focusKey: string,
  neighborKeys: ReadonlySet<string>,
  w: number,
  h: number,
): Record<string, NodePos> {
  const cx = w / 2
  const cy = h / 2
  const ringR = Math.min(w, h) * 0.3
  const out: Record<string, NodePos> = {}
  const orbitals = [...neighborKeys].filter((k) => k !== focusKey).sort()
  out[focusKey] = { x: cx, y: cy }
  orbitals.forEach((key, i) => {
    const a = (i / Math.max(1, orbitals.length)) * Math.PI * 2 - Math.PI / 2
    out[key] = { x: cx + Math.cos(a) * ringR, y: cy + Math.sin(a) * ringR }
  })
  return refineGraphLayoutSpacing(out, w, h, Math.min(w, h) * 0.22)
}

function truncateGraphRelationLabel(text: string, maxLen = 8): string {
  const t = text.trim()
  if (!t) return '关系'
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

function spreadLabelAlongForEdge(
  edgeId: string,
  sk: string,
  tk: string,
  focusKey: string | null,
  customAlong?: number,
): number {
  if (customAlong !== undefined) return customAlong
  if (!focusKey) return 0.5
  if (sk === focusKey) return 0.62
  if (tk === focusKey) return 0.38
  const hash = edgeId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return 0.42 + (hash % 17) * 0.01
}

function findEdgeBetween(
  edges: RelationshipEdge[],
  fromKey: string,
  toKey: string,
): RelationshipEdge | undefined {
  const from = parseNodeKey(fromKey)
  const to = parseNodeKey(toKey)
  if (!from || !to) return undefined
  return edges.find(
    (edge) =>
      (edge.sourceId === from.id &&
        edge.targetId === to.id &&
        edge.sourceType === from.type &&
        edge.targetType === to.type) ||
      (edge.sourceId === to.id &&
        edge.targetId === from.id &&
        edge.sourceType === to.type &&
        edge.targetType === from.type),
  )
}

export function CrossBindingGraphMode({
  store,
  onEditEdge,
  onCreateEdge,
  initialHighlightKey = null,
  onFocusIdChange,
  onHighlightKeyChange,
  linkEditMode: linkEditModeProp,
  onLinkEditModeChange,
  coachAssistActive = false,
  onCoachLayoutReady,
  initialLayout = null,
  layoutSessionKey = 0,
  onLayoutSnapshotChange,
  onLayoutDirty,
  resetLayoutSignal = 0,
  className,
}: {
  store: CrossBindingStore
  onEditEdge: (edge: RelationshipEdge, anchorId: string) => void
  onCreateEdge: (draft: RelationshipEdge, anchorId: string) => void
  /** 进入图谱时高亮当前角色/身份，但不进入聚焦布局 */
  initialHighlightKey?: string | null
  /** 用户轻点头像进入/退出聚焦时通知外层 */
  onFocusIdChange?: (focusId: string | null) => void
  /** 进入高亮是否仍生效（退出聚焦后会清掉） */
  onHighlightKeyChange?: (highlightKey: string | null) => void
  linkEditMode?: boolean
  onLinkEditModeChange?: (active: boolean) => void
  /** 引导进行中：无可用关系词时展示示例标签供高亮 */
  coachAssistActive?: boolean
  /** 引导锚点布局变化时通知外层重新测量 */
  onCoachLayoutReady?: () => void
  /** 从本地恢复的画布布局；随 layoutSessionKey 一起重置 */
  initialLayout?: CrossBindingGraphLayoutSnapshot | null
  layoutSessionKey?: number
  /** 节点位置或视口变化时同步给外层，用于脏检查与保存 */
  onLayoutSnapshotChange?: (snapshot: CrossBindingGraphLayoutSnapshot) => void
  /** 用户主动移动节点/平移/缩放画布 */
  onLayoutDirty?: () => void
  /** 递增时恢复默认环形布局并重置视口 */
  resetLayoutSignal?: number
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragFromRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const linkDragActiveRef = useRef(false)
  const hoverDropKeyRef = useRef<string | null>(null)
  const [size, setSize] = useState({ w: 320, h: 420 })
  const [highlightKey, setHighlightKey] = useState<string | null>(initialHighlightKey)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [linkEditModeInternal, setLinkEditModeInternal] = useState(false)
  const linkEditMode = linkEditModeProp ?? linkEditModeInternal
  const setLinkEditMode = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(linkEditMode) : next
      onLinkEditModeChange?.(resolved)
      if (linkEditModeProp === undefined) {
        setLinkEditModeInternal(resolved)
      }
    },
    [linkEditMode, linkEditModeProp, onLinkEditModeChange],
  )
  const [linkSourceKey, setLinkSourceKey] = useState<string | null>(null)
  const [linkDragActive, setLinkDragActive] = useState(false)
  const [dragFrom, setDragFrom] = useState<string | null>(null)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const [hoverDropKey, setHoverDropKey] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, NodePos>>({})
  const [labelOffsets, setLabelOffsets] = useState<Record<string, number>>({})
  const [labelDragEdgeId, setLabelDragEdgeId] = useState<string | null>(null)
  const labelDragEdgeIdRef = useRef<string | null>(null)
  const labelDragMovedRef = useRef(false)
  const labelOffsetsRef = useRef<Record<string, number>>({})
  const [viewportPan, setViewportPan] = useState({ x: 0, y: 0 })
  const [viewportZoom, setViewportZoom] = useState(1)
  const [canvasPanning, setCanvasPanning] = useState(false)
  const [pinchZooming, setPinchZooming] = useState(false)
  const viewportPanRef = useRef(viewportPan)
  const viewportZoomRef = useRef(viewportZoom)
  const canvasPanActiveRef = useRef(false)
  const canvasPanLastClientRef = useRef<{ x: number; y: number } | null>(null)
  const canvasPanPointerIdRef = useRef<number | null>(null)
  const pinchTouchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const graphBoundsRef = useRef({ minX: 0, minY: 0, width: 320, height: 420 })
  const dragLivePosRef = useRef<NodePos | null>(null)

  const nodes = useMemo(() => [...store.registry.values()], [store.registry])

  const connectedKeys = useMemo(
    () => connectedNodeKeysFromEdges(store.edges),
    [store.edges],
  )

  /** 连线模式需展示全部节点以便新建关系；平时只画有连线的节点，避免多余身份头像 */
  const nodesInGraph = useMemo(() => {
    if (linkEditMode) return nodes
    return nodes.filter((n) => connectedKeys.has(nodeKey(n.type, n.id)))
  }, [connectedKeys, linkEditMode, nodes])

  const baseLayout = useMemo(
    () => layoutNodes(nodesInGraph, size.w, size.h),
    [nodesInGraph, size.h, size.w],
  )

  const pos = useMemo(() => ({ ...baseLayout, ...positions }), [baseLayout, positions])

  /** 关系词方向 / 连线高亮视角：聚焦时以聚焦点为准，否则以进入时的高亮角色为准 */
  const perspectiveKey = focusId ?? highlightKey

  const focusNeighborKeys = useMemo(
    () => neighborNodeKeysForGraphFocus(focusId, store.edges),
    [focusId, store.edges],
  )

  const focusLayout = useMemo(() => {
    if (!focusId || linkEditMode || !focusNeighborKeys) return null
    return layoutFocusNeighborhood(focusId, focusNeighborKeys, size.w, size.h)
  }, [focusId, focusNeighborKeys, linkEditMode, size.h, size.w])

  const displayPos = useMemo(() => {
    if (!focusLayout || !focusNeighborKeys) return pos
    const merged: Record<string, NodePos> = {}
    for (const key of focusNeighborKeys) {
      merged[key] = positions[key] ?? focusLayout[key] ?? pos[key]
    }
    return merged
  }, [focusLayout, focusNeighborKeys, pos, positions])

  const renderPos = useMemo(() => {
    const dragKey = dragFrom
    if (!dragKey || !dragPoint || linkEditMode) return displayPos
    return { ...displayPos, [dragKey]: dragPoint }
  }, [displayPos, dragFrom, dragPoint, linkEditMode])

  const renderCanvasBounds = useMemo(
    () => ({ minX: 0, minY: 0, width: size.w, height: size.h }),
    [size.h, size.w],
  )

  const measure = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    setSize({ w: el.clientWidth, h: el.clientHeight })
  }, [])

  useEffect(() => {
    hoverDropKeyRef.current = hoverDropKey
  }, [hoverDropKey])

  useEffect(() => {
    viewportPanRef.current = viewportPan
  }, [viewportPan])

  useEffect(() => {
    viewportZoomRef.current = viewportZoom
  }, [viewportZoom])

  useEffect(() => {
    graphBoundsRef.current = renderCanvasBounds
  }, [renderCanvasBounds])

  const notifyLayoutDirty = useCallback(() => {
    onLayoutDirty?.()
  }, [onLayoutDirty])

  const clearDrag = useCallback(() => {
    dragFromRef.current = null
    dragMovedRef.current = false
    dragStartRef.current = null
    dragLivePosRef.current = null
    linkDragActiveRef.current = false
    setLinkDragActive(false)
    setLinkSourceKey(null)
    setDragFrom(null)
    setDragPoint(null)
    setHoverDropKey(null)
  }, [])

  const resetGraphLayout = useCallback(
    (opts?: { markDirty?: boolean }) => {
      dragLivePosRef.current = null
      labelOffsetsRef.current = {}
      setPositions({})
      setLabelOffsets({})
      setViewportPan({ x: 0, y: 0 })
      setViewportZoom(1)
      clearDrag()
      if (opts?.markDirty !== false) notifyLayoutDirty()
    },
    [clearDrag, notifyLayoutDirty],
  )

  useEffect(() => {
    if (initialLayout) {
      setPositions(initialLayout.positions)
      setViewportPan(initialLayout.viewportPan)
      setViewportZoom(initialLayout.viewportZoom)
      labelOffsetsRef.current = {}
      setLabelOffsets({})
      dragLivePosRef.current = null
      clearDrag()
      return
    }
    dragLivePosRef.current = null
    labelOffsetsRef.current = {}
    setPositions({})
    setLabelOffsets({})
    setViewportPan({ x: 0, y: 0 })
    setViewportZoom(1)
    clearDrag()
  }, [clearDrag, initialLayout, layoutSessionKey])

  useEffect(() => {
    if (!resetLayoutSignal) return
    resetGraphLayout({ markDirty: true })
  }, [resetLayoutSignal, resetGraphLayout])

  useEffect(() => {
    if (!onLayoutSnapshotChange) return
    onLayoutSnapshotChange(
      buildCrossBindingGraphLayoutSnapshot(nodesInGraph, pos, viewportPan, viewportZoom),
    )
  }, [nodesInGraph, onLayoutSnapshotChange, pos, viewportPan, viewportZoom])

  const toggleLinkEditMode = useCallback(() => {
    if (linkEditMode) {
      clearDrag()
      setLinkEditMode(false)
      return
    }
    clearDrag()
    setLinkEditMode(true)
  }, [clearDrag, linkEditMode, setLinkEditMode])

  useEffect(() => {
    if (!linkEditMode) clearDrag()
  }, [clearDrag, linkEditMode])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const block = (e: Event) => e.preventDefault()
    el.addEventListener('selectstart', block)
    el.addEventListener('dragstart', block)
    el.addEventListener('contextmenu', block)
    return () => {
      el.removeEventListener('selectstart', block)
      el.removeEventListener('dragstart', block)
      el.removeEventListener('contextmenu', block)
    }
  }, [])

  useEffect(() => {
    if (!linkEditMode) return
    const prevBodyUserSelect = document.body.style.userSelect
    const prevBodyWebkitUserSelect = document.body.style.webkitUserSelect
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    return () => {
      document.body.style.userSelect = prevBodyUserSelect
      document.body.style.webkitUserSelect = prevBodyWebkitUserSelect
      clearDocumentSelection()
    }
  }, [linkEditMode])

  const pointInWorld = useCallback((clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const pan = viewportPanRef.current
    const zoom = viewportZoomRef.current
    const { minX, minY } = graphBoundsRef.current
    return {
      x: (clientX - rect.left - pan.x) / zoom - minX,
      y: (clientY - rect.top - pan.y) / zoom - minY,
    }
  }, [])

  const cancelCanvasPan = useCallback(() => {
    if (!canvasPanActiveRef.current) return
    canvasPanActiveRef.current = false
    canvasPanLastClientRef.current = null
    setCanvasPanning(false)
    if (canvasPanPointerIdRef.current != null) {
      try {
        wrapRef.current?.releasePointerCapture(canvasPanPointerIdRef.current)
      } catch {
        /* ignore */
      }
    }
    canvasPanPointerIdRef.current = null
  }, [])

  const isGraphInteractionBlockingPinch = useCallback(() => {
    return !!(dragFromRef.current || labelDragEdgeIdRef.current)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const finishPinchTouch = () => {
      if (!pinchTouchRef.current) return
      pinchTouchRef.current = null
      setPinchZooming(false)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      if (isGraphInteractionBlockingPinch()) return

      cancelCanvasPan()
      if (linkEditMode && dragFromRef.current) {
        clearDrag()
      }

      const [a, b] = [e.touches[0]!, e.touches[1]!]
      pinchTouchRef.current = {
        distance: Math.max(touchPairDistance(a, b), 1),
        zoom: viewportZoomRef.current,
      }
      setPinchZooming(true)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchTouchRef.current) return
      if (isGraphInteractionBlockingPinch()) {
        finishPinchTouch()
        return
      }

      e.preventDefault()
      clearDocumentSelection()

      const rect = el.getBoundingClientRect()
      const [a, b] = [e.touches[0]!, e.touches[1]!]
      const distance = Math.max(touchPairDistance(a, b), 1)
      const center = touchPairCenterViewport(a, b, rect)
      const start = pinchTouchRef.current
      const nextZoom = start.zoom * (distance / start.distance)

      const zoom = viewportZoomRef.current
      const pan = viewportPanRef.current
      const { minX, minY } = graphBoundsRef.current
      const clamped = clampViewportZoom(nextZoom)
      const worldX = (center.x - minX - pan.x) / zoom
      const worldY = (center.y - minY - pan.y) / zoom
      setViewportZoom(clamped)
      setViewportPan({
        x: center.x - minX - worldX * clamped,
        y: center.y - minY - worldY * clamped,
      })
      notifyLayoutDirty()
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return
      finishPinchTouch()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [cancelCanvasPan, clearDrag, isGraphInteractionBlockingPinch, linkEditMode, notifyLayoutDirty])

  const findSnapTarget = useCallback(
    (
      clientX: number,
      clientY: number,
      excludeKey: string | null,
      layout: Record<string, NodePos>,
      radius = NODE_SNAP_RADIUS,
    ) => {
      const p = pointInWorld(clientX, clientY)
      if (!p) return null
      let bestKey: string | null = null
      let bestDist = radius
      for (const [key, np] of Object.entries(layout)) {
        if (excludeKey && key === excludeKey) continue
        const d = Math.hypot(p.x - np.x, p.y - np.y)
        if (d < bestDist) {
          bestDist = d
          bestKey = key
        }
      }
      return bestKey
    },
    [pointInWorld],
  )

  const isGraphUiControlTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return !!target.closest('[data-graph-ui-control]')
  }

  const isGraphInteractiveContentTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return !!(
      target.closest('[data-graph-edge-label]') || target.closest('[data-graph-node-key]')
    )
  }

  const finishCanvasPan = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    canvasPanActiveRef.current = false
    canvasPanLastClientRef.current = null
    setCanvasPanning(false)
    if (e && canvasPanPointerIdRef.current != null) {
      try {
        wrapRef.current?.releasePointerCapture(canvasPanPointerIdRef.current)
      } catch {
        /* ignore */
      }
    }
    canvasPanPointerIdRef.current = null
  }, [])

  const startCanvasPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    canvasPanActiveRef.current = true
    canvasPanLastClientRef.current = { x: e.clientX, y: e.clientY }
    canvasPanPointerIdRef.current = e.pointerId
    setCanvasPanning(true)
    clearDocumentSelection()
    try {
      wrapRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const updateCanvasPan = useCallback((clientX: number, clientY: number) => {
    const last = canvasPanLastClientRef.current
    if (!last) return
    const dx = clientX - last.x
    const dy = clientY - last.y
    canvasPanLastClientRef.current = { x: clientX, y: clientY }
    setViewportPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
    notifyLayoutDirty()
  }, [notifyLayoutDirty])

  useEffect(() => {
    setHighlightKey(initialHighlightKey ?? null)
    setFocusId(null)
  }, [initialHighlightKey])

  useEffect(() => {
    onFocusIdChange?.(focusId)
  }, [focusId, onFocusIdChange])

  useEffect(() => {
    onHighlightKeyChange?.(highlightKey)
  }, [highlightKey, onHighlightKeyChange])

  const exitFocus = useCallback(() => {
    setFocusId(null)
    setHighlightKey(null)
  }, [])

  const prevFocusIdRef = useRef<string | null>(null)
  const prevLinkEditModeRef = useRef(linkEditMode)

  /** 仅在用户主动切换聚焦 / 退出连线模式时重置视口；勿在初次加载时清空已保存布局 */
  useEffect(() => {
    const prevFocus = prevFocusIdRef.current
    const prevLink = prevLinkEditModeRef.current
    prevFocusIdRef.current = focusId
    prevLinkEditModeRef.current = linkEditMode

    if (!focusId || linkEditMode) return

    const focusChanged = prevFocus !== null && prevFocus !== focusId
    const exitedLinkEdit = prevLink && !linkEditMode
    if (!focusChanged && !exitedLinkEdit) return

    setViewportPan({ x: 0, y: 0 })
    setViewportZoom(1)
    setLabelOffsets({})
    labelOffsetsRef.current = {}
    dragLivePosRef.current = null
  }, [focusId, linkEditMode])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [measure, nodes.length])

  const edgeLines = useMemo(() => {
    return store.edges
      .map((edge) => {
        const sk = nodeKey(edge.sourceType, edge.sourceId)
        const tk = nodeKey(edge.targetType, edge.targetId)
        const s = renderPos[sk]
        const t = renderPos[tk]
        if (!s || !t) return null
        const perspectiveNodeId = perspectiveKey ? parseNodeKey(perspectiveKey)?.id ?? null : null
        const involvesPerspective =
          !!perspectiveNodeId &&
          (edge.sourceId === perspectiveNodeId || edge.targetId === perspectiveNodeId)
        const related =
          !perspectiveNodeId ||
          (involvesPerspective && edgeVisibleToAnchor(edge, perspectiveNodeId))
        if (focusId && !related) return null
        const customAlong = labelOffsetsRef.current[edge.id] ?? labelOffsets[edge.id]
        const along = spreadLabelAlongForEdge(edge.id, sk, tk, perspectiveKey, customAlong)
        const labelPos = pointOnEdge(s, t, along)
        return { edge, s, t, labelPos, along, related, sk, tk }
      })
      .filter(Boolean) as Array<{
      edge: RelationshipEdge
      s: NodePos
      t: NodePos
      labelPos: NodePos
      along: number
      related: boolean
      sk: string
      tk: string
    }>
  }, [focusId, labelOffsets, perspectiveKey, renderPos, store.edges])

  const coachEdgeLabelId = useMemo(
    () => edgeLines.find((line) => line.related)?.edge.id ?? null,
    [edgeLines],
  )

  useEffect(() => {
    if (!coachAssistActive) return
    onCoachLayoutReady?.()
  }, [coachAssistActive, coachEdgeLabelId, onCoachLayoutReady, size.h, size.w])

  const visibleNodes = useMemo(() => {
    const pool = nodesInGraph
    if (!focusId || linkEditMode || !focusNeighborKeys) return pool
    return pool.filter((node) => focusNeighborKeys.has(nodeKey(node.type, node.id)))
  }, [focusId, focusNeighborKeys, linkEditMode, nodesInGraph])

  const updateDragPoint = useCallback(
    (clientX: number, clientY: number) => {
      const key = dragFromRef.current
      if (!key) return

      const start = dragStartRef.current
      if (start && Math.hypot(clientX - start.x, clientY - start.y) > DRAG_THRESHOLD_PX) {
        dragMovedRef.current = true
      }

      const p = pointInWorld(clientX, clientY)
      if (!p) return

      if (linkEditMode && linkDragActiveRef.current) {
        const layout = { ...renderPos }
        const dropTarget = findSnapTarget(clientX, clientY, key, layout)
        setHoverDropKey(dropTarget)
        setDragPoint(p)
        return
      }

      if (linkEditMode) {
        setDragPoint(p)
        return
      }

      setHoverDropKey(null)
      dragLivePosRef.current = p
      setDragPoint(p)
    },
    [findSnapTarget, linkEditMode, pointInWorld, renderPos],
  )

  const completeLinkToTarget = useCallback(
    (fromKey: string, targetKey: string) => {
      const existing = findEdgeBetween(store.edges, fromKey, targetKey)
      if (existing) {
        const from = parseNodeKey(fromKey)
        onEditEdge(existing, from?.id ?? existing.sourceId)
        return
      }
      const from = parseNodeKey(fromKey)
      const to = parseNodeKey(targetKey)
      if (!from || !to) return
      const relId = uid('rel')
      onCreateEdge(
        {
          id: relId,
          sourceId: from.id,
          targetId: to.id,
          sourceType: from.type,
          targetType: to.type,
          forwardRelationLabel: '认识',
          forwardRelId: relId,
          isMutual: false,
        },
        from.id,
      )
    },
    [onCreateEdge, onEditEdge, store.edges],
  )

  const finishPointerOnNode = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const fromKey = dragFromRef.current
      if (!fromKey) return

      const start = dragStartRef.current
      const moved =
        dragMovedRef.current ||
        (start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD_PX : false)

      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      if (!moved) {
        if (focusId === fromKey) {
          exitFocus()
        } else {
          setFocusId(fromKey)
        }
        clearDrag()
        return
      }

      const p =
        dragLivePosRef.current ??
        pointInWorld(e.clientX, e.clientY) ??
        renderPos[fromKey] ??
        null
      if (p) {
        setPositions((prev) => ({
          ...prev,
          [fromKey]: p,
        }))
        notifyLayoutDirty()
      }
      clearDrag()
    },
    [clearDrag, exitFocus, focusId, notifyLayoutDirty, pointInWorld, renderPos],
  )

  const onNodePointerDown = (key: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (linkEditMode || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragFromRef.current = key
    dragMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setDragFrom(key)
    updateDragPoint(e.clientX, e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onNodePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (linkEditMode || !dragFromRef.current) return
    updateDragPoint(e.clientX, e.clientY)
  }

  const onNodePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (linkEditMode || !dragFromRef.current) return
    e.preventDefault()
    e.stopPropagation()
    finishPointerOnNode(e)
  }

  const onNodePointerCancel = () => {
    if (linkEditMode) return
    clearDrag()
  }

  const onWrapLinkPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!linkEditMode || e.button !== 0 || isGraphUiControlTarget(e.target)) return

      const layout = { ...renderPos }
      const sourceKey = findSnapTarget(e.clientX, e.clientY, null, layout)
      if (!sourceKey) return

      e.preventDefault()
      clearDocumentSelection()
      dragFromRef.current = sourceKey
      dragMovedRef.current = false
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      setLinkSourceKey(sourceKey)
      linkDragActiveRef.current = true
      setLinkDragActive(true)
      setDragFrom(sourceKey)
      updateDragPoint(e.clientX, e.clientY)

      wrapRef.current?.setPointerCapture(e.pointerId)
    },
    [renderPos, findSnapTarget, linkEditMode, updateDragPoint],
  )

  const onWrapLinkPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!linkEditMode || !dragFromRef.current || !linkDragActiveRef.current) return
      clearDocumentSelection()
      updateDragPoint(e.clientX, e.clientY)
    },
    [linkEditMode, updateDragPoint],
  )

  const finishWrapLinkPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const fromKey = dragFromRef.current
      if (!fromKey) return

      try {
        wrapRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      if (linkDragActiveRef.current) {
        const layout = { ...renderPos }
        const hovered = hoverDropKeyRef.current
        const targetKey =
          findSnapTarget(e.clientX, e.clientY, fromKey, layout, NODE_RELEASE_SNAP_RADIUS) ??
          (hovered && hovered !== fromKey ? hovered : null)
        if (targetKey && targetKey !== fromKey) {
          completeLinkToTarget(fromKey, targetKey)
        }
      }

      clearDrag()
    },
    [renderPos, clearDrag, completeLinkToTarget, findSnapTarget],
  )

  const onWrapLinkPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!linkEditMode) return
      finishWrapLinkPointer(e)
    },
    [finishWrapLinkPointer, linkEditMode],
  )

  const onWrapLinkPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!linkEditMode) return
      finishWrapLinkPointer(e)
    },
    [finishWrapLinkPointer, linkEditMode],
  )

  const onWrapPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || isGraphUiControlTarget(e.target)) return
      if (isGraphInteractiveContentTarget(e.target)) return
      if (pinchTouchRef.current) return

      if (linkEditMode) {
        onWrapLinkPointerDown(e)
        if (dragFromRef.current) return
      }

      startCanvasPan(e)
    },
    [linkEditMode, onWrapLinkPointerDown, startCanvasPan],
  )

  const onWrapPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pinchTouchRef.current) return

      if (canvasPanActiveRef.current) {
        clearDocumentSelection()
        updateCanvasPan(e.clientX, e.clientY)
        return
      }

      if (linkEditMode) {
        onWrapLinkPointerMove(e)
      }
    },
    [linkEditMode, onWrapLinkPointerMove, updateCanvasPan],
  )

  const onWrapPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pinchTouchRef.current) return

      if (canvasPanActiveRef.current) {
        finishCanvasPan(e)
        return
      }
      if (linkEditMode) {
        onWrapLinkPointerUp(e)
      }
    },
    [finishCanvasPan, linkEditMode, onWrapLinkPointerUp],
  )

  const onWrapPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pinchTouchRef.current) return

      if (canvasPanActiveRef.current) {
        finishCanvasPan(e)
        return
      }
      if (linkEditMode) {
        onWrapLinkPointerCancel(e)
      }
    },
    [finishCanvasPan, linkEditMode, onWrapLinkPointerCancel],
  )

  const onLabelPointerDown =
    (edge: RelationshipEdge) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      clearDocumentSelection()
      labelDragEdgeIdRef.current = edge.id
      labelDragMovedRef.current = false
      setLabelDragEdgeId(edge.id)
      e.currentTarget.setPointerCapture(e.pointerId)
    }

  const applyLabelPosition = useCallback(
    (
      edgeId: string,
      along: number,
      segmentStart: NodePos,
      segmentEnd: NodePos,
      el?: HTMLElement | null,
    ) => {
      labelOffsetsRef.current[edgeId] = along
      const lp = pointOnEdge(segmentStart, segmentEnd, along)
      if (el) {
        el.style.left = `${lp.x}px`
        el.style.top = `${lp.y}px`
      }
      return lp
    },
    [],
  )

  const onLabelPointerMove =
    (edge: RelationshipEdge, segmentStart: NodePos, segmentEnd: NodePos) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (labelDragEdgeIdRef.current !== edge.id) return
      const p = pointInWorld(e.clientX, e.clientY)
      if (!p) return
      labelDragMovedRef.current = true
      const along = projectPointOntoEdgeSegment(p, segmentStart, segmentEnd)
      applyLabelPosition(edge.id, along, segmentStart, segmentEnd, e.currentTarget)
    }

  const finishLabelPointer =
    (edge: RelationshipEdge) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (labelDragEdgeIdRef.current !== edge.id) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const moved = labelDragMovedRef.current
      const along = labelOffsetsRef.current[edge.id]
      labelDragEdgeIdRef.current = null
      labelDragMovedRef.current = false
      setLabelDragEdgeId(null)
      if (along !== undefined) {
        setLabelOffsets((prev) => ({ ...prev, [edge.id]: along }))
      }
      if (!moved) {
        const parsed = perspectiveKey ? parseNodeKey(perspectiveKey) : null
        onEditEdge(edge, parsed?.id ?? edge.sourceId)
      }
    }

  if (!nodesInGraph.length) {
    return (
      <div
        className={`flex h-[420px] items-center justify-center rounded-3xl bg-white text-[12px] text-[#9CA3AF] ${className ?? ''}`}
      >
        {nodes.length ? '暂无可绘制的连线关系' : '暂无可绘制的节点'}
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      {...{ [PERSONA_COACH_TARGET_ATTR]: 'graph-canvas' }}
      className={`relative select-none touch-manipulation overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.02)] [-webkit-touch-callout:none] ${
        canvasPanning || pinchZooming ? 'cursor-grabbing' : ''
      } ${className ?? 'h-[min(62vh,520px)]'}`}
      style={{
        ...GRAPH_NO_SELECT_STYLE,
        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundSize: `${VIEWPORT_GRID_SIZE * viewportZoom}px ${VIEWPORT_GRID_SIZE * viewportZoom}px`,
        backgroundPosition: `${viewportPan.x}px ${viewportPan.y}px`,
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onWrapPointerDown}
      onPointerMove={onWrapPointerMove}
      onPointerUp={onWrapPointerUp}
      onPointerCancel={onWrapPointerCancel}
    >
      <div
        className="absolute"
        style={{
          left: renderCanvasBounds.minX,
          top: renderCanvasBounds.minY,
          width: renderCanvasBounds.width,
          height: renderCanvasBounds.height,
          transform: `translate3d(${viewportPan.x}px, ${viewportPan.y}px, 0) scale(${viewportZoom})`,
          transformOrigin: '0 0',
          willChange: canvasPanning || pinchZooming || dragFrom ? 'transform' : undefined,
        }}
      >
      <svg
        className="pointer-events-none absolute left-0 top-0 z-0"
        width={renderCanvasBounds.width}
        height={renderCanvasBounds.height}
        viewBox={`${renderCanvasBounds.minX} ${renderCanvasBounds.minY} ${renderCanvasBounds.width} ${renderCanvasBounds.height}`}
        style={{ overflow: 'visible' }}
        aria-hidden
      >
        {edgeLines.map(({ edge, s, t, related }) => (
          <line
            key={edge.id}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke={related ? '#111827' : '#E5E7EB'}
            strokeWidth={related ? 1 : 0.75}
            strokeOpacity={related ? 0.35 : 0.2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {linkEditMode && linkDragActive && dragFrom && renderPos[dragFrom] ? (
          <line
            x1={renderPos[dragFrom].x}
            y1={renderPos[dragFrom].y}
            x2={
              hoverDropKey && renderPos[hoverDropKey]
                ? renderPos[hoverDropKey].x
                : dragPoint?.x ?? renderPos[dragFrom].x
            }
            y2={
              hoverDropKey && renderPos[hoverDropKey]
                ? renderPos[hoverDropKey].y
                : dragPoint?.y ?? renderPos[dragFrom].y
            }
            stroke="#111827"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {edgeLines.map(({ edge, s, t, labelPos, related }) => {
        const draggingLabel =
          labelDragEdgeIdRef.current === edge.id || labelDragEdgeId === edge.id
        const coachEdgeLabel = edge.id === coachEdgeLabelId
        const fullLabel = graphRelationLabel(edge, perspectiveKey) || '关系'
        const shortLabel = truncateGraphRelationLabel(fullLabel)
        return (
          <button
            key={`lbl-${edge.id}`}
            type="button"
            data-graph-edge-label
            title={fullLabel !== shortLabel ? fullLabel : undefined}
            {...(coachEdgeLabel ? { [PERSONA_COACH_TARGET_ATTR]: 'graph-edge-label' } : {})}
            style={{
              left: labelPos.x,
              top: labelPos.y,
              transform: 'translate3d(-50%, -50%, 0)',
            }}
            className={`absolute z-[15] max-w-[88px] min-h-[28px] cursor-grab rounded-full border border-gray-100 bg-white px-2.5 py-1 text-center text-[10px] leading-tight text-[#374151] shadow-sm active:cursor-grabbing ${
              related ? 'opacity-100' : 'opacity-35'
            } ${draggingLabel ? 'z-[25] ring-2 ring-[#111827]/15 shadow-md' : ''}`}
            onPointerDown={onLabelPointerDown(edge)}
            onPointerMove={onLabelPointerMove(edge, s, t)}
            onPointerUp={finishLabelPointer(edge)}
            onPointerCancel={finishLabelPointer(edge)}
          >
            <span className="block truncate">{shortLabel}</span>
          </button>
        )
      })}

      {coachAssistActive && !coachEdgeLabelId ? (
        <div
          {...{ [PERSONA_COACH_TARGET_ATTR]: 'graph-edge-label' }}
          className="pointer-events-none absolute left-1/2 top-[42%] z-[15] flex min-h-[28px] min-w-[56px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[10px] text-[#374151] shadow-sm"
        >
          关系词 · 示例
        </div>
      ) : null}

      {visibleNodes.map((node) => {
        const key = nodeKey(node.type, node.id)
        const p = renderPos[key]
        if (!p) return null
        const isFocusCenter = focusId === key
        const isEntryHighlight = !focusId && highlightKey === key
        const isFocusNeighbor = !!focusId && !!focusNeighborKeys?.has(key) && !isFocusCenter
        const isLinkSource = linkEditMode && linkSourceKey === key
        const isSnapTarget = linkEditMode && linkDragActive && hoverDropKey === key
        const isDropTarget = isSnapTarget
        const isDragging = !linkEditMode && dragFrom === key
        const nodeScale =
          isLinkSource || isFocusCenter || isEntryHighlight || isDropTarget
            ? 1.08
            : isFocusNeighbor || isDragging
              ? 1.04
              : 1
        return (
          <div
            key={key}
            className={`absolute z-20 flex w-[72px] flex-col items-center will-change-transform ${
              isDragging ? '' : 'transition-transform duration-200 ease-out'
            }`}
            style={{
              left: p.x,
              top: p.y,
              transform: `translate(-50%, -50%) scale(${nodeScale})`,
              pointerEvents: linkEditMode ? 'none' : undefined,
            }}
          >
            <button
              type="button"
              data-graph-node-key={key}
              style={linkEditMode ? { pointerEvents: 'none' } : undefined}
              className={`flex flex-col items-center rounded-2xl bg-white/95 p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow ${
                linkEditMode ? '' : 'cursor-grab active:cursor-grabbing'
              } ${
                isLinkSource
                  ? 'ring-2 ring-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.14)]'
                  : isFocusCenter || isEntryHighlight
                    ? 'ring-2 ring-[#111827] shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
                    : isFocusNeighbor
                      ? 'ring-2 ring-[#111827]/25'
                      : isDropTarget
                        ? 'ring-2 ring-[#111827]/40'
                        : isDragging
                          ? 'ring-2 ring-[#111827]/20 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
                          : ''
              }`}
              onPointerDown={onNodePointerDown(key)}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerUp}
              onPointerCancel={onNodePointerCancel}
            >
              <PersonaRosterAvatar
                character={node.avatar ?? null}
                size={40}
                kind={node.type === 'user' ? 'identity' : 'wechat'}
              />
              <span
                className="mt-1 max-w-[68px] truncate text-[9px] font-medium text-[#111827]"
                style={{ fontFamily: PERSONA_SERIF }}
              >
                {node.label}
              </span>
            </button>
          </div>
        )
      })}

      </div>

      <div
        data-graph-ui-control
        className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2"
      >
        <button
          type="button"
          data-graph-ui-control
          {...{ [PERSONA_COACH_TARGET_ATTR]: 'graph-link-mode' }}
          onClick={toggleLinkEditMode}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors ${
            linkEditMode
              ? 'bg-[#111827] text-white'
              : 'border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#FAFAFB]'
          }`}
        >
          <GitBranch className="size-3.5" />
          {linkEditMode ? '退出连线模式' : '编辑关系连线'}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-graph-ui-control
            onClick={() => resetGraphLayout({ markDirty: true })}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#111827] shadow-sm transition-colors hover:bg-[#FAFAFB]"
            aria-label="重置布局"
          >
            <RotateCcw className="size-3.5" />
            重置布局
          </button>
          {focusId && !linkEditMode ? (
            <button
              type="button"
              data-graph-ui-control
              {...{ [PERSONA_COACH_TARGET_ATTR]: 'graph-exit-focus' }}
              className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[10px] text-[#374151]"
              onClick={exitFocus}
            >
              退出聚焦
            </button>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 space-y-1 pr-24">
        {linkEditMode ? (
          <>
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#111827]">
              关系连线模式
            </p>
            <p className="text-[9px] leading-relaxed text-[#6B7280]">
              在起点头像按下并按住，拖到目标头像（高亮）后松手，将弹出关系编辑面板
            </p>
          </>
        ) : focusId ? (
          <>
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#111827]">
              聚焦视角
            </p>
            <p className="text-[9px] leading-relaxed text-[#6B7280]">
              仅显示与中心角色有绑定关系的对象；关系词可沿连线拖动。轻点头像切换聚焦。
            </p>
          </>
        ) : highlightKey ? (
          <>
            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#111827]">
              全景 · 当前角色高亮
            </p>
            <p className="text-[9px] leading-relaxed text-[#6B7280]">
              显示完整关系网；与当前角色可见的关系连线会加亮。轻点头像可进入聚焦视角。
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-[#9CA3AF]">
              <Move className="size-3" />
              空白处拖动平移 · 双指捏合缩放 · 拖头像排版
            </p>
            <p className="text-[9px] text-[#C4C4C4]">
              轻点切换聚焦 · 拖动关系词沿连线移动 · 点标签编辑 · 或「编辑关系连线」
            </p>
          </>
        )}
      </div>
    </div>
  )
}
