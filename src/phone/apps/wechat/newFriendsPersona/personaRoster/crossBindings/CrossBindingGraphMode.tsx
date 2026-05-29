import { motion } from 'framer-motion'
import { GitBranch, Move } from 'lucide-react'
import { PERSONA_COACH_TARGET_ATTR } from '../../../memory/memoryCoachTypes'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { uid } from '../../utils'
import { PersonaRosterAvatar } from '../PersonaRosterAvatar'
import { PERSONA_SERIF } from '../personaRosterDisplay'
import {
  edgeVisibleToAnchor,
  graphRelationLabel,
  neighborNodeKeysForGraphFocus,
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

const DRAG_THRESHOLD_PX = 10
const NODE_SNAP_RADIUS = 58
const NODE_RELEASE_SNAP_RADIUS = 80
const MIN_VIEWPORT_ZOOM = 0.35
const MAX_VIEWPORT_ZOOM = 2.5
const VIEWPORT_GRID_SIZE = 20
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
  const r = Math.min(w, h) * 0.34
  const out: Record<string, NodePos> = {}
  nodes.forEach((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2
    out[nodeKey(n.type, n.id)] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
  return out
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
  initialFocusKey = null,
  linkEditMode: linkEditModeProp,
  onLinkEditModeChange,
  coachAssistActive = false,
  onCoachLayoutReady,
  initialLayout = null,
  layoutSessionKey = 0,
  onLayoutSnapshotChange,
  onLayoutDirty,
  className,
}: {
  store: CrossBindingStore
  onEditEdge: (edge: RelationshipEdge, anchorId: string) => void
  onCreateEdge: (draft: RelationshipEdge, anchorId: string) => void
  initialFocusKey?: string | null
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
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragFromRef = useRef<string | null>(null)
  const dragMovedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const linkDragActiveRef = useRef(false)
  const hoverDropKeyRef = useRef<string | null>(null)
  const [size, setSize] = useState({ w: 320, h: 420 })
  const [focusId, setFocusId] = useState<string | null>(initialFocusKey)
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

  const nodes = useMemo(() => [...store.registry.values()], [store.registry])

  const baseLayout = useMemo(
    () => layoutNodes(nodes, size.w, size.h),
    [nodes, size.h, size.w],
  )

  const pos = useMemo(() => ({ ...baseLayout, ...positions }), [baseLayout, positions])

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
    if (initialLayout) {
      setPositions(initialLayout.positions)
      setViewportPan(initialLayout.viewportPan)
      setViewportZoom(initialLayout.viewportZoom)
      return
    }
    setPositions({})
    setViewportPan({ x: 0, y: 0 })
    setViewportZoom(1)
  }, [initialLayout, layoutSessionKey])

  const notifyLayoutDirty = useCallback(() => {
    onLayoutDirty?.()
  }, [onLayoutDirty])

  useEffect(() => {
    if (!onLayoutSnapshotChange) return
    onLayoutSnapshotChange(
      buildCrossBindingGraphLayoutSnapshot(nodes, pos, viewportPan, viewportZoom),
    )
  }, [nodes, onLayoutSnapshotChange, pos, viewportPan, viewportZoom])

  const clearDrag = useCallback(() => {
    dragFromRef.current = null
    dragMovedRef.current = false
    dragStartRef.current = null
    linkDragActiveRef.current = false
    setLinkDragActive(false)
    setLinkSourceKey(null)
    setDragFrom(null)
    setDragPoint(null)
    setHoverDropKey(null)
  }, [])

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
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
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
      const clamped = clampViewportZoom(nextZoom)
      const worldX = (center.x - pan.x) / zoom
      const worldY = (center.y - pan.y) / zoom
      setViewportZoom(clamped)
      setViewportPan({
        x: center.x - worldX * clamped,
        y: center.y - worldY * clamped,
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
    setFocusId(initialFocusKey ?? null)
  }, [initialFocusKey])

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
        const s = pos[sk]
        const t = pos[tk]
        if (!s || !t) return null
        const along =
          labelOffsetsRef.current[edge.id] ?? labelOffsets[edge.id] ?? 0.5
        const labelPos = pointOnEdge(s, t, along)
        const focusNodeId = focusId ? parseNodeKey(focusId)?.id ?? null : null
        const involvesFocus =
          !!focusNodeId && (edge.sourceId === focusNodeId || edge.targetId === focusNodeId)
        if (involvesFocus && !edgeVisibleToAnchor(edge, focusNodeId!)) return null
        const related = !focusNodeId || involvesFocus
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
  }, [focusId, labelOffsets, pos, store.edges])

  const coachEdgeLabelId = useMemo(
    () => edgeLines.find((line) => line.related)?.edge.id ?? null,
    [edgeLines],
  )

  useEffect(() => {
    if (!coachAssistActive) return
    onCoachLayoutReady?.()
  }, [coachAssistActive, coachEdgeLabelId, onCoachLayoutReady, size.h, size.w])

  const focusNeighborKeys = useMemo(
    () => neighborNodeKeysForGraphFocus(focusId, store.edges),
    [focusId, store.edges],
  )

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

      const layout = { ...baseLayout, ...positions }

      if (linkEditMode && linkDragActiveRef.current) {
        const dropTarget = findSnapTarget(clientX, clientY, key, layout)
        setHoverDropKey(dropTarget)
        setDragPoint(p)
        return
      }

      const dropTarget = findSnapTarget(clientX, clientY, key, layout)
      setHoverDropKey(dropTarget)

      if (dropTarget) {
        setDragPoint(p)
        return
      }

      if (dragMovedRef.current) {
        setDragPoint(null)
        setHoverDropKey(null)
        setPositions((prev) => ({
          ...prev,
          [key]: p,
        }))
        notifyLayoutDirty()
        return
      }

      setDragPoint(p)
    },
    [baseLayout, findSnapTarget, linkEditMode, notifyLayoutDirty, pointInWorld, positions],
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
        setFocusId((prev) => (prev === fromKey ? null : fromKey))
        clearDrag()
        return
      }

      clearDrag()
    },
    [clearDrag],
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

      const layout = { ...baseLayout, ...positions }
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
    [baseLayout, findSnapTarget, linkEditMode, positions, updateDragPoint],
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
        const layout = { ...baseLayout, ...positions }
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
    [baseLayout, clearDrag, completeLinkToTarget, findSnapTarget, positions],
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
        const parsed = focusId ? parseNodeKey(focusId) : null
        onEditEdge(edge, parsed?.id ?? edge.sourceId)
      }
    }

  if (!nodes.length) {
    return (
      <div
        className={`flex h-[420px] items-center justify-center rounded-3xl bg-white text-[12px] text-[#9CA3AF] ${className ?? ''}`}
      >
        暂无可绘制的节点
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
        className="absolute inset-0"
        style={{
          transform: `translate3d(${viewportPan.x}px, ${viewportPan.y}px, 0) scale(${viewportZoom})`,
          transformOrigin: '0 0',
          willChange: canvasPanning || pinchZooming ? 'transform' : undefined,
        }}
      >
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full">
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
          />
        ))}
        {linkEditMode && linkDragActive && dragFrom && pos[dragFrom] ? (
          <line
            x1={pos[dragFrom].x}
            y1={pos[dragFrom].y}
            x2={
              hoverDropKey && pos[hoverDropKey]
                ? pos[hoverDropKey].x
                : dragPoint?.x ?? pos[dragFrom].x
            }
            y2={
              hoverDropKey && pos[hoverDropKey]
                ? pos[hoverDropKey].y
                : dragPoint?.y ?? pos[dragFrom].y
            }
            stroke="#111827"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ) : null}
      </svg>

      {edgeLines.map(({ edge, s, t, labelPos, related }) => {
        const draggingLabel =
          labelDragEdgeIdRef.current === edge.id || labelDragEdgeId === edge.id
        const coachEdgeLabel = edge.id === coachEdgeLabelId
        return (
          <button
            key={`lbl-${edge.id}`}
            type="button"
            data-graph-edge-label
            {...(coachEdgeLabel ? { [PERSONA_COACH_TARGET_ATTR]: 'graph-edge-label' } : {})}
            style={{
              left: labelPos.x,
              top: labelPos.y,
              transform: 'translate3d(-50%, -50%, 0)',
            }}
            className={`absolute z-[15] min-h-[28px] min-w-[44px] cursor-grab rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[10px] text-[#374151] shadow-sm active:cursor-grabbing ${
              related ? 'opacity-100' : 'opacity-35'
            } ${draggingLabel ? 'z-[25] ring-2 ring-[#111827]/15 shadow-md' : ''}`}
            onPointerDown={onLabelPointerDown(edge)}
            onPointerMove={onLabelPointerMove(edge, s, t)}
            onPointerUp={finishLabelPointer(edge)}
            onPointerCancel={finishLabelPointer(edge)}
          >
            {graphRelationLabel(edge, focusId) || '关系'}
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

      {nodes.map((node) => {
        const key = nodeKey(node.type, node.id)
        const p = pos[key]
        if (!p) return null
        const focused =
          linkEditMode || !focusNeighborKeys || focusNeighborKeys.has(key)
        const isFocusCenter = focusId === key
        const isFocusNeighbor = !!focusNeighborKeys?.has(key) && !isFocusCenter
        const isLinkSource = linkEditMode && linkSourceKey === key
        const isSnapTarget = linkEditMode && linkDragActive && hoverDropKey === key
        const isDropTarget = isSnapTarget
        const isDragging = !linkEditMode && dragFrom === key
        return (
          <motion.div
            key={key}
            className="absolute z-20 flex w-[72px] flex-col items-center"
            style={{
              left: p.x,
              top: p.y,
              x: '-50%',
              y: '-50%',
              pointerEvents: linkEditMode ? 'none' : undefined,
            }}
            animate={{
              scale:
                isLinkSource || isFocusCenter || isDropTarget
                  ? 1.08
                  : isFocusNeighbor
                    ? 1.04
                    : isDragging
                      ? 1.04
                      : 1,
              opacity: focused || isDropTarget || isDragging || isLinkSource ? 1 : 0.18,
            }}
            transition={{
              duration: isDragging ? 0 : 0.35,
              ease: [0.22, 1, 0.36, 1],
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
                  : isFocusCenter
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
          </motion.div>
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
        {focusId && !linkEditMode ? (
          <button
            type="button"
            data-graph-ui-control
            {...{ [PERSONA_COACH_TARGET_ATTR]: 'graph-exit-focus' }}
            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[10px] text-[#374151]"
            onClick={() => setFocusId(null)}
          >
            退出聚焦
          </button>
        ) : null}
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
              高亮：当前角色/身份及其已绑定关系对象；关系词可沿连线拖动。轻点头像切换聚焦。
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
