import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSlot } from '../types'
import { personaDb } from '../apps/wechat/newFriendsPersona/idb'
import { WECHAT_LUMI_PEER_CHARACTER_ID, wechatConversationKey } from '../apps/wechat/wechatConversationKey'
import { DesktopAppTile } from './DesktopAppTile'
import { Dock } from './Dock'
import { MusicWidget } from './MusicWidget'
import { PersonalCard } from './PersonalCard'
import { StatusBar } from './StatusBar'
import { WheelWidget } from './WheelWidget'
import { useCustomization } from '../CustomizationContext'
import { useLongPress } from '../hooks/useLongPress'

type Props = {
  onOpenApp: (id: AppSlot['id']) => void
}

function useWeChatHomeUnreadBadge(): number {
  const { state } = useCustomization()
  const [playerIdentityId, setPlayerIdentityId] = useState<string | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    void personaDb.getCurrentIdentityId().then((id) => setPlayerIdentityId(id?.trim() ? id : '__none__'))
  }, [])

  const refresh = useCallback(() => {
    if (playerIdentityId === null) return
    const pid = playerIdentityId
    const list = state.wechatPersonaContacts ?? []
    const keySet = new Set<string>()
    keySet.add(wechatConversationKey(WECHAT_LUMI_PEER_CHARACTER_ID, pid))
    for (const c of list) {
      keySet.add(wechatConversationKey(c.characterId, pid))
    }
    const keys = Array.from(keySet)
    void Promise.all(keys.map((k) => personaDb.countUnreadWeChatCharacterMessages(k))).then((counts) =>
      setCount(counts.reduce((a, b) => a + b, 0)),
    )
  }, [state.wechatPersonaContacts, playerIdentityId])

  useEffect(() => {
    refresh()
    const on = () => refresh()
    window.addEventListener('wechat-storage-changed', on)
    return () => window.removeEventListener('wechat-storage-changed', on)
  }, [refresh])

  return count
}

const HOME_WIDGET_LAYOUT_STORAGE_KEY = 'lumi-home-widget-layout-v1'
const RESET_HOME_WIDGET_LAYOUT_EVENT = 'lumi-reset-home-widget-layout'
type ProfileAnchor = 'top' | 'bottom'
type MusicSide = 'left' | 'right'

type GridArea = {
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
}

type HomeWidgetLayout = {
  profile: GridArea
  music: GridArea
  wheel: GridArea
  desktopSlots: Array<{ col: number; row: number }>
}

function getHomeWidgetLayout(profileAnchor: ProfileAnchor, musicSide: MusicSide): HomeWidgetLayout {
  if (profileAnchor === 'bottom') {
    if (musicSide === 'left') {
      return {
        profile: { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 },
        music: { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 4 },
        wheel: { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 3 },
        desktopSlots: [
          { col: 3, row: 3 },
          { col: 4, row: 3 },
          { col: 1, row: 4 },
          { col: 2, row: 4 },
          { col: 3, row: 4 },
          { col: 4, row: 4 },
        ],
      }
    }
    return {
      profile: { colStart: 1, colEnd: 5, rowStart: 5, rowEnd: 9 },
      music: { colStart: 3, colEnd: 5, rowStart: 1, rowEnd: 4 },
      wheel: { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 3 },
      desktopSlots: [
        { col: 1, row: 3 },
        { col: 2, row: 3 },
        { col: 1, row: 4 },
        { col: 2, row: 4 },
        { col: 3, row: 4 },
        { col: 4, row: 4 },
      ],
    }
  }

  if (musicSide === 'right') {
    return {
      profile: { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 },
      music: { colStart: 3, colEnd: 5, rowStart: 5, rowEnd: 8 },
      wheel: { colStart: 1, colEnd: 3, rowStart: 7, rowEnd: 9 },
      desktopSlots: [
        { col: 1, row: 5 },
        { col: 2, row: 5 },
        { col: 1, row: 6 },
        { col: 2, row: 6 },
        { col: 3, row: 8 },
        { col: 4, row: 8 },
      ],
    }
  }

  return {
    profile: { colStart: 1, colEnd: 5, rowStart: 1, rowEnd: 5 },
    music: { colStart: 1, colEnd: 3, rowStart: 5, rowEnd: 8 },
    wheel: { colStart: 3, colEnd: 5, rowStart: 7, rowEnd: 9 },
    desktopSlots: [
      { col: 3, row: 5 },
      { col: 4, row: 5 },
      { col: 3, row: 6 },
      { col: 4, row: 6 },
      { col: 1, row: 8 },
      { col: 2, row: 8 },
    ],
  }
}

const FLOAT_TRANSITION = {
  duration: 2.6,
  repeat: Infinity,
  repeatType: 'mirror' as const,
  ease: 'easeInOut' as const,
}
const DOCK_COUNT = 4
const DESKTOP_GRID_COLUMNS = 4
const DESKTOP_GRID_ROWS = 8
const DESKTOP_GRID_GAP_PX = 10
const DOCK_GAP_PX = 8

type DropTarget =
  | { zone: 'desktop'; index: number }
  | { zone: 'dock'; index: number }

function firstDesktopCandidate(
  layout: Array<AppSlot['id'] | null>,
  excludedIds: Set<AppSlot['id']>,
  preferredIndex?: number,
): AppSlot['id'] | null {
  if (
    typeof preferredIndex === 'number' &&
    preferredIndex >= 0 &&
    preferredIndex < layout.length &&
    layout[preferredIndex] &&
    !excludedIds.has(layout[preferredIndex]!)
  ) {
    return layout[preferredIndex]!
  }
  for (const id of layout) {
    if (id && !excludedIds.has(id)) return id
  }
  return null
}

function previewPlacement(
  dockIds: AppSlot['id'][],
  desktopLayout: Array<AppSlot['id'] | null>,
  activeId: AppSlot['id'],
  source: DropTarget,
  target: DropTarget,
): { dockIds: AppSlot['id'][]; desktopLayout: Array<AppSlot['id'] | null> } {
  const nextDock = [...dockIds]
  const nextDesktop = [...desktopLayout]
  const excludedIds = new Set<AppSlot['id']>([activeId])

  if (source.zone === 'dock') nextDock[source.index] = '__empty__' as AppSlot['id']
  else nextDesktop[source.index] = null

  for (let i = 0; i < nextDock.length; i += 1) {
    if (i !== source.index && nextDock[i] === activeId) nextDock[i] = '__empty__' as AppSlot['id']
  }
  for (let i = 0; i < nextDesktop.length; i += 1) {
    if (nextDesktop[i] === activeId) nextDesktop[i] = null
  }

  if (target.zone === 'dock') {
    const displaced = nextDock[target.index]
    nextDock[target.index] = activeId
    if (displaced && displaced !== ('__empty__' as AppSlot['id'])) {
      if (source.zone === 'dock' && source.index !== target.index) {
        nextDock[source.index] = displaced
      } else if (source.zone === 'desktop' && nextDesktop[source.index] === null) {
        nextDesktop[source.index] = displaced
      } else {
        const emptyIndex = nextDesktop.findIndex((slot) => slot === null)
        if (emptyIndex >= 0) nextDesktop[emptyIndex] = displaced
      }
    }
  } else {
    const displaced = nextDesktop[target.index]
    nextDesktop[target.index] = activeId
    if (displaced) {
      if (source.zone === 'desktop' && source.index !== target.index && nextDesktop[source.index] === null) {
        nextDesktop[source.index] = displaced
      } else if (source.zone === 'dock') {
        nextDock[source.index] = displaced
      } else {
        const emptyIndex = nextDesktop.findIndex((slot) => slot === null)
        if (emptyIndex >= 0) nextDesktop[emptyIndex] = displaced
      }
    } else if (source.zone === 'dock') {
      const fallback = firstDesktopCandidate(nextDesktop, excludedIds, source.index)
      if (fallback) {
        nextDock[source.index] = fallback
        const fallbackIndex = nextDesktop.findIndex((slot) => slot === fallback)
        if (fallbackIndex >= 0) nextDesktop[fallbackIndex] = null
      }
    }
  }

  return {
    dockIds: nextDock.filter((id) => id !== ('__empty__' as AppSlot['id'])),
    desktopLayout: nextDesktop,
  }
}

type SortableDesktopTileProps = {
  app: AppSlot
  slotIndex: number
  slot: { col: number; row: number }
  compact: boolean
  isEditMode: boolean
  isActiveDrag: boolean
  isLongPressPrimed: boolean
  onOpenApp: (id: AppSlot['id']) => void
  onEnterEditMode: (id: AppSlot['id']) => void
  registerNode: (id: AppSlot['id'], node: HTMLDivElement | null) => void
  onPointerDragStart: (id: AppSlot['id'], event: React.PointerEvent<HTMLElement>) => void
}

function SortableDesktopTile({
  app,
  slotIndex,
  slot,
  compact,
  isEditMode,
  isActiveDrag,
  isLongPressPrimed,
  onOpenApp,
  onEnterEditMode,
  registerNode,
  onPointerDragStart,
}: SortableDesktopTileProps) {
  const longPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: () => onEnterEditMode(app.id),
  })

  const floatingSeed = slotIndex + 1

  return (
    <motion.div
      ref={(node) => registerNode(app.id, node)}
      layout
      style={{
        gridColumn: `${slot.col} / ${slot.col + 1}`,
        gridRow: `${slot.row} / ${slot.row + 1}`,
        zIndex: isActiveDrag ? 40 : 1,
      }}
      animate={
        isEditMode && !isActiveDrag
          ? {
              y: [-1.5 - (floatingSeed % 2) * 0.2, 2, -1.5 - (floatingSeed % 2) * 0.2],
              rotate: [-0.6, 0.8, -0.5],
            }
          : {
              y: 0,
              rotate: 0,
            }
      }
      transition={isEditMode && !isActiveDrag ? FLOAT_TRANSITION : { duration: 0.18, ease: 'easeOut' }}
    >
      <div className="h-full w-full touch-none">
        <DesktopAppTile
          app={app}
          onOpen={onOpenApp}
          className="h-full w-full"
          compact={compact}
          isEditMode={isEditMode}
          isActiveDrag={isActiveDrag}
          isLongPressPrimed={isLongPressPrimed}
          isGhosted={isActiveDrag}
          pointerHandlers={
            isEditMode
              ? {
                  onPointerDown: (event) => onPointerDragStart(app.id, event),
                }
              : longPressHandlers
          }
        />
      </div>
    </motion.div>
  )
}

type ActiveDragState = {
  id: AppSlot['id']
  source: DropTarget
  pointerId: number
  width: number
  height: number
  offsetX: number
  offsetY: number
  x: number
  y: number
}

type ActiveWidgetDragState = {
  widget: 'profile' | 'music'
  pointerId: number
  width: number
  height: number
  offsetX: number
  offsetY: number
  x: number
  y: number
}

export function HomeScreen({ onOpenApp }: Props) {
  const { state, reorderApps, setDesktopLayout } = useCustomization()
  const { apps, ui, theme } = state
  const wechatUnread = useWeChatHomeUnreadBadge()
  const appMap = new Map(apps.map((app) => [app.id, app] as const))
  const [profileAnchorState, setProfileAnchorState] = useState<ProfileAnchor>(() => {
    if (typeof window === 'undefined') return 'bottom'
    try {
      const saved = JSON.parse(window.localStorage.getItem(HOME_WIDGET_LAYOUT_STORAGE_KEY) || '{}') as {
        profileAnchor?: ProfileAnchor
      }
      return saved.profileAnchor === 'bottom' || saved.profileAnchor === 'top' ? saved.profileAnchor : 'top'
    } catch {
      return 'top'
    }
  })
  const [musicSideState, setMusicSideState] = useState<MusicSide>(() => {
    if (typeof window === 'undefined') return 'left'
    try {
      const saved = JSON.parse(window.localStorage.getItem(HOME_WIDGET_LAYOUT_STORAGE_KEY) || '{}') as {
        musicSide?: MusicSide
      }
      return saved.musicSide === 'right' || saved.musicSide === 'left' ? saved.musicSide : 'left'
    } catch {
      return 'left'
    }
  })
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null)
  const [activeWidgetDrag, setActiveWidgetDrag] = useState<ActiveWidgetDragState | null>(null)
  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false)
  const [hoverSlotIndex, setHoverSlotIndex] = useState<number | null>(null)
  const [hoverDockIndex, setHoverDockIndex] = useState<number | null>(null)
  const [hoverProfileAnchor, setHoverProfileAnchor] = useState<ProfileAnchor | null>(null)
  const [hoverMusicSide, setHoverMusicSide] = useState<MusicSide | null>(null)
  const [primedAppId, setPrimedAppId] = useState<AppSlot['id'] | null>(null)
  const [primedStaticWidget, setPrimedStaticWidget] = useState<'profile' | 'music' | null>(null)
  const [dockIdsState, setDockIdsState] = useState<AppSlot['id'][]>(() => apps.slice(0, DOCK_COUNT).map((app) => app.id))
  const [desktopLayoutState, setDesktopLayoutState] = useState<Array<AppSlot['id'] | null>>(() => state.desktopLayout)
  const dockIdsRef = useRef<AppSlot['id'][]>(apps.slice(0, DOCK_COUNT).map((app) => app.id))
  const desktopLayoutRef = useRef<Array<AppSlot['id'] | null>>(state.desktopLayout)
  const tileNodeMapRef = useRef(new Map<AppSlot['id'], HTMLDivElement | null>())
  const profileNodeRef = useRef<HTMLDivElement | null>(null)
  const musicNodeRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dockNavRef = useRef<HTMLElement | null>(null)
  const dragBaseRef = useRef<{ dockIds: AppSlot['id'][]; desktopLayout: Array<AppSlot['id'] | null> } | null>(null)
  const compactDesktop = !ui.fullScreen || ui.showDeviceFrame
  const hasWallpaper = !!theme.wallpaperUrl?.trim()
  const contentSafeTop = ui.fullScreen && !ui.showStatusBar ? 'env(safe-area-inset-top, 0px)' : '0px'
  const widgetLayout = getHomeWidgetLayout(profileAnchorState, musicSideState)
  const desktopSlots = widgetLayout.desktopSlots

  useEffect(() => {
    if (activeDrag || activeWidgetDrag) return
    const nextDock = apps.slice(0, DOCK_COUNT).map((app) => app.id)
    const allowed = new Set(apps.slice(DOCK_COUNT).map((app) => app.id))
    const next = desktopSlots.map((_, index) => {
      const id = state.desktopLayout[index] ?? null
      return id && allowed.has(id) ? id : null
    })
    for (const app of apps.slice(DOCK_COUNT)) {
      if (next.includes(app.id)) continue
      const emptyIndex = next.findIndex((slot) => slot === null)
      if (emptyIndex < 0) break
      next[emptyIndex] = app.id
    }
    dockIdsRef.current = nextDock
    setDockIdsState(nextDock)
    desktopLayoutRef.current = next
    setDesktopLayoutState(next)
  }, [activeDrag, activeWidgetDrag, apps, desktopSlots, state.desktopLayout])

  const handleEnterEditMode = useCallback((id: AppSlot['id']) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12)
    }
    setPrimedAppId(id)
    setIsEditMode(true)
    setActiveDrag(null)
    setActiveWidgetDrag(null)
    setHoverSlotIndex(null)
    setHoverDockIndex(null)
    setHoverProfileAnchor(null)
    setHoverMusicSide(null)
    window.setTimeout(() => {
      setPrimedAppId((current) => (current === id ? null : current))
    }, 280)
  }, [])

  const persistWidgetLayout = useCallback((nextProfileAnchor: ProfileAnchor, nextMusicSide: MusicSide) => {
    setProfileAnchorState(nextProfileAnchor)
    setMusicSideState(nextMusicSide)
    try {
      window.localStorage.setItem(
        HOME_WIDGET_LAYOUT_STORAGE_KEY,
        JSON.stringify({ profileAnchor: nextProfileAnchor, musicSide: nextMusicSide }),
      )
    } catch {
      // ignore storage failures
    }
  }, [])

  const handleEnterStaticWidgetEditMode = useCallback((widget: 'profile' | 'music') => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12)
    }
    setPrimedStaticWidget(widget)
    setIsEditMode(true)
    setActiveDrag(null)
    setActiveWidgetDrag(null)
    setHoverSlotIndex(null)
    setHoverDockIndex(null)
    setHoverProfileAnchor(null)
    setHoverMusicSide(null)
    window.setTimeout(() => {
      setPrimedStaticWidget((current) => (current === widget ? null : current))
    }, 280)
  }, [])

  const resetWidgetLayout = useCallback(() => {
    setProfileAnchorState('top')
    setMusicSideState('left')
    setActiveWidgetDrag(null)
    setHoverProfileAnchor(null)
    setHoverMusicSide(null)
    setPrimedStaticWidget(null)
    try {
      window.localStorage.removeItem(HOME_WIDGET_LAYOUT_STORAGE_KEY)
    } catch {
      // ignore storage failures
    }
  }, [])

  const handleAppOpen = useCallback((id: AppSlot['id']) => {
    if (isEditMode) return
    onOpenApp(id)
  }, [isEditMode, onOpenApp])

  const profileLongPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: (event) => {
      handleEnterStaticWidgetEditMode('profile')
      handleStaticWidgetPointerDragStart('profile', event)
    },
  })

  const musicLongPressHandlers = useLongPress({
    delay: 500,
    moveTolerance: 10,
    onLongPress: (event) => {
      handleEnterStaticWidgetEditMode('music')
      handleStaticWidgetPointerDragStart('music', event)
    },
  })

  const exitEditMode = useCallback(() => {
    reorderApps([...dockIdsRef.current, ...desktopLayoutRef.current.filter((id): id is AppSlot['id'] => !!id)])
    setDesktopLayout(desktopLayoutRef.current)
    setIsEditMode(false)
    setActiveDrag(null)
    setActiveWidgetDrag(null)
    setHoverSlotIndex(null)
    setHoverDockIndex(null)
    setHoverProfileAnchor(null)
    setHoverMusicSide(null)
    setPrimedAppId(null)
    setPrimedStaticWidget(null)
  }, [reorderApps, setDesktopLayout])

  const registerTileNode = useCallback((id: AppSlot['id'], node: HTMLDivElement | null) => {
    tileNodeMapRef.current.set(id, node)
  }, [])

  const getSlotCenter = useCallback((slotIndex: number) => {
    const grid = gridRef.current
    const slot = desktopSlots[slotIndex]
    if (!grid || !slot) return null
    const rect = grid.getBoundingClientRect()
    const colWidth = (rect.width - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_COLUMNS - 1)) / DESKTOP_GRID_COLUMNS
    const rowHeight = (rect.height - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_ROWS - 1)) / DESKTOP_GRID_ROWS
    const x = rect.left + (slot.col - 1) * (colWidth + DESKTOP_GRID_GAP_PX) + colWidth / 2
    const y = rect.top + (slot.row - 1) * (rowHeight + DESKTOP_GRID_GAP_PX) + rowHeight / 2
    return { x, y }
  }, [desktopSlots])

  const getAreaCenter = useCallback((area: GridArea) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const colWidth = (rect.width - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_COLUMNS - 1)) / DESKTOP_GRID_COLUMNS
    const rowHeight = (rect.height - DESKTOP_GRID_GAP_PX * (DESKTOP_GRID_ROWS - 1)) / DESKTOP_GRID_ROWS
    const startX = rect.left + (area.colStart - 1) * (colWidth + DESKTOP_GRID_GAP_PX)
    const endX = rect.left + (area.colEnd - 1) * colWidth + (area.colEnd - 2) * DESKTOP_GRID_GAP_PX
    const startY = rect.top + (area.rowStart - 1) * (rowHeight + DESKTOP_GRID_GAP_PX)
    const endY = rect.top + (area.rowEnd - 1) * rowHeight + (area.rowEnd - 2) * DESKTOP_GRID_GAP_PX
    return { x: (startX + endX) / 2, y: (startY + endY) / 2 }
  }, [])

  const getDockCenter = useCallback((slotIndex: number) => {
    const nav = dockNavRef.current
    if (!nav) return null
    const rect = nav.getBoundingClientRect()
    const colWidth = (rect.width - DOCK_GAP_PX * (DOCK_COUNT - 1)) / DOCK_COUNT
    return {
      x: rect.left + slotIndex * (colWidth + DOCK_GAP_PX) + colWidth / 2,
      y: rect.top + rect.height / 2,
    }
  }, [])

  const resolveNearestSlotIndex = useCallback((point: { x: number; y: number }) => {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < desktopSlots.length; i += 1) {
      const center = getSlotCenter(i)
      if (!center) continue
      const distance = Math.hypot(point.x - center.x, point.y - center.y)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = i
      }
    }
    return nearestIndex
  }, [desktopSlots.length, getSlotCenter])

  const resolveNearestProfileAnchor = useCallback((point: { x: number; y: number }): ProfileAnchor => {
    const topCenter = getAreaCenter(getHomeWidgetLayout('top', musicSideState).profile)
    const bottomCenter = getAreaCenter(getHomeWidgetLayout('bottom', musicSideState).profile)
    if (!topCenter || !bottomCenter) return profileAnchorState
    return Math.hypot(point.x - topCenter.x, point.y - topCenter.y) <=
      Math.hypot(point.x - bottomCenter.x, point.y - bottomCenter.y)
      ? 'top'
      : 'bottom'
  }, [getAreaCenter, musicSideState, profileAnchorState])

  const resolveNearestMusicSide = useCallback((point: { x: number; y: number }): MusicSide => {
    const leftCenter = getAreaCenter(getHomeWidgetLayout(profileAnchorState, 'left').music)
    const rightCenter = getAreaCenter(getHomeWidgetLayout(profileAnchorState, 'right').music)
    if (!leftCenter || !rightCenter) return musicSideState
    return Math.hypot(point.x - leftCenter.x, point.y - leftCenter.y) <=
      Math.hypot(point.x - rightCenter.x, point.y - rightCenter.y)
      ? 'left'
      : 'right'
  }, [getAreaCenter, musicSideState, profileAnchorState])

  const resolveDropTarget = useCallback((point: { x: number; y: number }): DropTarget => {
    const nav = dockNavRef.current
    if (nav) {
      const dockRect = nav.getBoundingClientRect()
      const inDockBand =
        point.y >= dockRect.top - 32 &&
        point.y <= dockRect.bottom + 32 &&
        point.x >= dockRect.left - 24 &&
        point.x <= dockRect.right + 24
      if (inDockBand) {
        let nearestIndex = 0
        let nearestDistance = Number.POSITIVE_INFINITY
        for (let i = 0; i < DOCK_COUNT; i += 1) {
          const center = getDockCenter(i)
          if (!center) continue
          const distance = Math.hypot(point.x - center.x, point.y - center.y)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = i
          }
        }
        return { zone: 'dock', index: nearestIndex }
      }
    }
    return { zone: 'desktop', index: resolveNearestSlotIndex(point) }
  }, [getDockCenter, resolveNearestSlotIndex])

  const applyPreview = useCallback((id: AppSlot['id'], source: DropTarget, target: DropTarget) => {
    const base = dragBaseRef.current
    if (!base) return
    const next = previewPlacement(base.dockIds, base.desktopLayout, id, source, target)
    dockIdsRef.current = next.dockIds
    desktopLayoutRef.current = next.desktopLayout
    setDockIdsState(next.dockIds)
    setDesktopLayoutState(next.desktopLayout)
    setHoverDockIndex(target.zone === 'dock' ? target.index : null)
    setHoverSlotIndex(target.zone === 'desktop' ? target.index : null)
  }, [])

  const handlePointerDragStart = useCallback((id: AppSlot['id'], source: DropTarget, event: React.PointerEvent<HTMLElement>) => {
    const tileNode = tileNodeMapRef.current.get(id)
    if (!tileNode) return
    const rect = tileNode.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragBaseRef.current = {
      dockIds: [...dockIdsRef.current],
      desktopLayout: [...desktopLayoutRef.current],
    }
    setActiveDrag({
      id,
      source,
      pointerId: event.pointerId,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      x: rect.left,
      y: rect.top,
    })
  }, [])

  const handleStaticWidgetPointerDragStart = useCallback((widget: 'profile' | 'music', event: React.PointerEvent<HTMLElement | HTMLButtonElement>) => {
    const node = widget === 'profile' ? profileNodeRef.current : musicNodeRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveWidgetDrag({
      widget,
      pointerId: event.pointerId,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      x: rect.left,
      y: rect.top,
    })
    if (widget === 'profile') setHoverProfileAnchor(profileAnchorState)
    else setHoverMusicSide(musicSideState)
  }, [musicSideState, profileAnchorState])

  useEffect(() => {
    if (!activeDrag) return

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== activeDrag.pointerId) return
      const nextX = event.clientX - activeDrag.offsetX
      const nextY = event.clientY - activeDrag.offsetY
      setActiveDrag((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev))
      const target = resolveDropTarget({ x: event.clientX, y: event.clientY })
      applyPreview(activeDrag.id, activeDrag.source, target)
    }

    const finish = (event: PointerEvent) => {
      if (event.pointerId !== activeDrag.pointerId) return
      reorderApps([...dockIdsRef.current, ...desktopLayoutRef.current.filter((id): id is AppSlot['id'] => !!id)])
      const committed = [...desktopLayoutRef.current]
      dragBaseRef.current = null
      setDesktopLayoutState(committed)
      setDesktopLayout(committed)
      setActiveDrag(null)
      setHoverSlotIndex(null)
      setHoverDockIndex(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [activeDrag, applyPreview, reorderApps, resolveDropTarget, setDesktopLayout])

  useEffect(() => {
    if (!activeWidgetDrag) return

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== activeWidgetDrag.pointerId) return
      const nextX = event.clientX - activeWidgetDrag.offsetX
      const nextY = event.clientY - activeWidgetDrag.offsetY
      setActiveWidgetDrag((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev))
      if (activeWidgetDrag.widget === 'profile') {
        const nextAnchor = resolveNearestProfileAnchor({ x: event.clientX, y: event.clientY })
        setProfileAnchorState(nextAnchor)
        setHoverProfileAnchor(nextAnchor)
      } else {
        const nextSide = resolveNearestMusicSide({ x: event.clientX, y: event.clientY })
        setMusicSideState(nextSide)
        setHoverMusicSide(nextSide)
      }
    }

    const finish = (event: PointerEvent) => {
      if (event.pointerId !== activeWidgetDrag.pointerId) return
      const nextProfileAnchor =
        activeWidgetDrag.widget === 'profile'
          ? resolveNearestProfileAnchor({ x: event.clientX, y: event.clientY })
          : profileAnchorState
      const nextMusicSide =
        activeWidgetDrag.widget === 'music'
          ? resolveNearestMusicSide({ x: event.clientX, y: event.clientY })
          : musicSideState
      persistWidgetLayout(nextProfileAnchor, nextMusicSide)
      setActiveWidgetDrag(null)
      setHoverProfileAnchor(null)
      setHoverMusicSide(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [activeWidgetDrag, musicSideState, persistWidgetLayout, profileAnchorState, resolveNearestMusicSide, resolveNearestProfileAnchor])

  useEffect(() => {
    const onReset = () => resetWidgetLayout()
    window.addEventListener(RESET_HOME_WIDGET_LAYOUT_EVENT, onReset)
    return () => window.removeEventListener(RESET_HOME_WIDGET_LAYOUT_EVENT, onReset)
  }, [resetWidgetLayout])

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        backgroundColor: hasWallpaper ? 'transparent' : 'var(--phone-bg)',
        backgroundImage: theme.wallpaperUrl ? `url(${theme.wallpaperUrl})` : 'none',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: theme.wallpaperFit === 'contain' ? 'contain' : 'cover',
      }}
    >
      <AnimatePresence>
        {isEditMode ? (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(2px) brightness(0.95)',
            }}
          />
        ) : null}
      </AnimatePresence>

      {ui.showStatusBar ? <StatusBar /> : null}

      <div
        className="relative z-[2] min-h-0 flex flex-1 items-stretch justify-center overflow-hidden px-3 pb-0"
        style={{ paddingTop: `calc(${contentSafeTop} + 0.25rem)` }}
        onPointerDown={(event) => {
          if (!isEditMode || activeDrag || activeWidgetDrag) return
          const target = event.target as HTMLElement | null
          if (!target) return
          if (target.closest('[data-desktop-tile="true"]')) return
          if (target.closest('[data-desktop-static="true"]')) return
          if (target.closest('[data-wheel-widget="true"]')) return
          if (target.closest('[data-dock-root="true"]')) return
          exitEditMode()
        }}
      >
        <div
          ref={gridRef}
          className="grid h-full w-full max-w-[360px] items-stretch gap-2.5 pb-5"
          style={{
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
          }}
        >
          {(['top', 'bottom'] as ProfileAnchor[]).map((anchor) => (
            <div
              key={`profile-anchor-${anchor}`}
              className="relative"
              style={{
                gridColumn: `${getHomeWidgetLayout(anchor, musicSideState).profile.colStart} / ${getHomeWidgetLayout(anchor, musicSideState).profile.colEnd}`,
                gridRow: `${getHomeWidgetLayout(anchor, musicSideState).profile.rowStart} / ${getHomeWidgetLayout(anchor, musicSideState).profile.rowEnd}`,
              }}
            >
              <AnimatePresence>
                {isEditMode && hoverProfileAnchor === anchor ? (
                  <motion.div
                    className="pointer-events-none absolute inset-1 rounded-[30px] border border-[#D4AF37]/70 bg-white/24 shadow-[0_10px_24px_rgba(212,175,55,0.12)]"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  />
                ) : null}
              </AnimatePresence>
              {anchor === profileAnchorState ? (
                <motion.div
                  ref={profileNodeRef}
                  layout
                  className="h-full w-full touch-none select-none"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: 'none',
                    opacity: activeWidgetDrag?.widget === 'profile' ? 0.04 : 1,
                  }}
                  animate={
                    isEditMode && activeWidgetDrag?.widget !== 'profile'
                      ? { y: [-1, 1.4, -1], rotate: [-0.25, 0.35, -0.2] }
                      : { y: 0, rotate: 0, scale: primedStaticWidget === 'profile' ? 1.02 : 1 }
                  }
                  transition={isEditMode && activeWidgetDrag?.widget !== 'profile' ? FLOAT_TRANSITION : { duration: 0.18, ease: 'easeOut' }}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={isEditMode ? (event) => handleStaticWidgetPointerDragStart('profile', event) : profileLongPressHandlers.onPointerDown}
                  onPointerMove={!isEditMode ? profileLongPressHandlers.onPointerMove : undefined}
                  onPointerUp={!isEditMode ? profileLongPressHandlers.onPointerUp : undefined}
                  onPointerCancel={!isEditMode ? profileLongPressHandlers.onPointerCancel : undefined}
                  onPointerLeave={!isEditMode ? profileLongPressHandlers.onPointerLeave : undefined}
                >
                  <PersonalCard />
                </motion.div>
              ) : null}
            </div>
          ))}

          {(['left', 'right'] as MusicSide[]).map((side) => (
            <div
              key={`music-side-${side}`}
              className="relative"
              style={{
                gridColumn: `${getHomeWidgetLayout(profileAnchorState, side).music.colStart} / ${getHomeWidgetLayout(profileAnchorState, side).music.colEnd}`,
                gridRow: `${getHomeWidgetLayout(profileAnchorState, side).music.rowStart} / ${getHomeWidgetLayout(profileAnchorState, side).music.rowEnd}`,
              }}
            >
              <AnimatePresence>
                {isEditMode && hoverMusicSide === side ? (
                  <motion.div
                    className="pointer-events-none absolute inset-1 rounded-[30px] border border-[#D4AF37]/70 bg-white/24 shadow-[0_10px_24px_rgba(212,175,55,0.12)]"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  />
                ) : null}
              </AnimatePresence>
              {side === musicSideState ? (
                <motion.div
                  ref={musicNodeRef}
                  layout
                  className="h-full w-full touch-none select-none"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    touchAction: 'none',
                    opacity: activeWidgetDrag?.widget === 'music' ? 0.04 : 1,
                  }}
                  animate={
                    isEditMode && activeWidgetDrag?.widget !== 'music'
                      ? { y: [-1, 1.4, -1], rotate: [-0.25, 0.35, -0.2] }
                      : { y: 0, rotate: 0, scale: primedStaticWidget === 'music' ? 1.02 : 1 }
                  }
                  transition={isEditMode && activeWidgetDrag?.widget !== 'music' ? FLOAT_TRANSITION : { duration: 0.18, ease: 'easeOut' }}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={isEditMode ? (event) => handleStaticWidgetPointerDragStart('music', event) : musicLongPressHandlers.onPointerDown}
                  onPointerMove={!isEditMode ? musicLongPressHandlers.onPointerMove : undefined}
                  onPointerUp={!isEditMode ? musicLongPressHandlers.onPointerUp : undefined}
                  onPointerCancel={!isEditMode ? musicLongPressHandlers.onPointerCancel : undefined}
                  onPointerLeave={!isEditMode ? musicLongPressHandlers.onPointerLeave : undefined}
                >
                  <MusicWidget isEditMode={isEditMode} />
                </motion.div>
              ) : null}
            </div>
          ))}

          <div
            style={{
              gridColumn: `${widgetLayout.wheel.colStart} / ${widgetLayout.wheel.colEnd}`,
              gridRow: `${widgetLayout.wheel.rowStart} / ${widgetLayout.wheel.rowEnd}`,
            }}
          >
            <WheelWidget open={isWheelModalOpen} onOpenChange={setIsWheelModalOpen} />
          </div>

          {desktopSlots.map((slot, slotIndex) => {
            const appId = desktopLayoutState[slotIndex]
            const app = appId ? appMap.get(appId) ?? null : null
            const isHighlighted = isEditMode && hoverSlotIndex === slotIndex
            return (
              <div
                key={`slot-${slotIndex}`}
                className="relative"
                style={{
                  gridColumn: `${slot.col} / ${slot.col + 1}`,
                  gridRow: `${slot.row} / ${slot.row + 1}`,
                }}
              >
                <AnimatePresence>
                  {isHighlighted ? (
                    <motion.div
                      className="pointer-events-none absolute inset-1 rounded-[22px] border border-[#D4AF37]/70 bg-white/24 shadow-[0_10px_24px_rgba(212,175,55,0.12)]"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    />
                  ) : null}
                </AnimatePresence>
                {app ? (
                  <SortableDesktopTile
                    key={app.id}
                    app={app}
                    slotIndex={slotIndex}
                    slot={slot}
                    compact={compactDesktop}
                    isEditMode={isEditMode}
                    isActiveDrag={activeDrag?.id === app.id}
                    isLongPressPrimed={primedAppId === app.id}
                    onOpenApp={handleAppOpen}
                    onEnterEditMode={handleEnterEditMode}
                    registerNode={registerTileNode}
                    onPointerDragStart={(id, event) => handlePointerDragStart(id, { zone: 'desktop', index: slotIndex }, event)}
                  />
                ) : null}
              </div>
            )
          })}
        </div>

        <AnimatePresence>
          {activeDrag ? (
            <motion.div
              className="pointer-events-none fixed z-[60]"
              initial={false}
              animate={{
                opacity: 1,
                scale: 1.08,
              }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
              style={{
                width: activeDrag.width,
                height: activeDrag.height,
                left: activeDrag.x,
                top: activeDrag.y,
              }}
            >
              <DesktopAppTile
                app={appMap.get(activeDrag.id) ?? apps[0]!}
                onOpen={handleAppOpen}
                compact={compactDesktop}
                isEditMode
                isActiveDrag
                className="h-full w-full"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {activeWidgetDrag ? (
            <motion.div
              className="pointer-events-none fixed z-[61]"
              initial={false}
              animate={{ opacity: 1, scale: 1.04 }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
              style={{
                width: activeWidgetDrag.width,
                height: activeWidgetDrag.height,
                left: activeWidgetDrag.x,
                top: activeWidgetDrag.y,
              }}
            >
              {activeWidgetDrag.widget === 'profile' ? <PersonalCard /> : <MusicWidget isEditMode />}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <Dock
        apps={dockIdsState.map((id) => appMap.get(id) ?? null)}
        onOpen={handleAppOpen}
        compact={compactDesktop}
        wechatBadgeCount={wechatUnread}
        isEditMode={isEditMode}
        onRequestEditMode={handleEnterEditMode}
        activeDragId={activeDrag?.id ?? null}
        hoverIndex={hoverDockIndex}
        registerNode={registerTileNode}
        dockNavRef={dockNavRef}
        onPointerDragStart={(id, event) => {
          const dockIndex = dockIdsRef.current.findIndex((dockId) => dockId === id)
          if (dockIndex < 0) return
          handlePointerDragStart(id, { zone: 'dock', index: dockIndex }, event)
        }}
      />
    </div>
  )
}
